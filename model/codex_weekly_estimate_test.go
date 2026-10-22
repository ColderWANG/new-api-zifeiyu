package model

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexWeeklyEstimateTest(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "estimate.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}, &CodexWeeklyEstimateObservation{}))
	require.NoError(t, db.AutoMigrate(&Log{}, &CodexWeeklyEstimateObservation{}))
	oldDB, oldLogDB := DB, LOG_DB
	oldLogEnabled, oldQuotaPerUnit := common.LogConsumeEnabled, common.QuotaPerUnit
	DB, LOG_DB = db, db
	common.LogConsumeEnabled = true
	common.QuotaPerUnit = 500_000
	t.Cleanup(func() {
		DB, LOG_DB = oldDB, oldLogDB
		common.LogConsumeEnabled, common.QuotaPerUnit = oldLogEnabled, oldQuotaPerUnit
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
	return db
}

func TestCodexWeeklyEstimateUsesChannelNetSpendAndPercentDelta(t *testing.T) {
	db := setupCodexWeeklyEstimateTest(t)
	now := time.Unix(1_800_000_000, 0)
	resetAt := now.Add(3 * 24 * time.Hour).Unix()
	first, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 7*24*3600, 12, now)
	require.NoError(t, err)
	require.Equal(t, "insufficient_samples", first.Status)
	require.Nil(t, first.EstimatedLimitUSD)
	require.InDelta(t, 0, *first.CurrentWindowSpendUSD, 0.001)

	require.NoError(t, db.Create(&Log{ChannelId: 1, CreatedAt: now.Add(time.Minute).Unix(), Type: LogTypeConsume, Quota: 2_500_000}).Error)
	require.NoError(t, db.Create(&Log{ChannelId: 1, CreatedAt: now.Add(2 * time.Minute).Unix(), Type: LogTypeRefund, Quota: 500_000}).Error)
	require.NoError(t, db.Create(&Log{ChannelId: 2, CreatedAt: now.Add(2 * time.Minute).Unix(), Type: LogTypeConsume, Quota: 50_000_000}).Error)
	second, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 7*24*3600, 16, now.Add(3*time.Minute))
	require.NoError(t, err)
	require.Equal(t, "available", second.Status)
	require.InDelta(t, 100, *second.EstimatedLimitUSD, 0.001)
	require.InDelta(t, 84, *second.EstimatedRemainingUSD, 0.001)
	require.InDelta(t, 4, *second.ObservedSpendUSD, 0.001)
	require.InDelta(t, 4, *second.ObservedPercentPoints, 0.001)
	require.InDelta(t, 4, *second.CurrentWindowSpendUSD, 0.001)

	require.NoError(t, db.Create(&Log{ChannelId: 1, CreatedAt: now.Add(4 * time.Minute).Unix(), Type: LogTypeConsume, Quota: 500_000}).Error)
	pendingUpstream, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 7*24*3600, 16, now.Add(5*time.Minute))
	require.NoError(t, err)
	require.Equal(t, "insufficient_change", pendingUpstream.Status)
	require.Nil(t, pendingUpstream.EstimatedLimitUSD)
}

func TestCodexWeeklyEstimateRejectsWeakAndResetSamples(t *testing.T) {
	db := setupCodexWeeklyEstimateTest(t)
	now := time.Unix(1_800_000_000, 0)
	resetAt := now.Add(3 * 24 * time.Hour).Unix()
	observe := func(account string, reset int64, percent float64, offset time.Duration) CodexWeeklyUSDEstimate {
		t.Helper()
		result, err := ObserveCodexWeeklyUsage(1, account, reset, 7*24*3600, percent, now.Add(offset))
		require.NoError(t, err)
		return result
	}
	require.Equal(t, "insufficient_samples", observe("account-1", resetAt, 10, 0).Status)
	require.NoError(t, db.Create(&Log{ChannelId: 1, CreatedAt: now.Add(time.Minute).Unix(), Type: LogTypeConsume, Quota: 500_000}).Error)
	require.Equal(t, "insufficient_change", observe("account-1", resetAt, 11, 2*time.Minute).Status)
	require.Equal(t, "insufficient_samples", observe("account-1", resetAt, 9, 3*time.Minute).Status)
	require.Equal(t, "insufficient_samples", observe("account-2", resetAt, 12, 4*time.Minute).Status)
	require.Equal(t, "insufficient_samples", observe("account-1", resetAt+3600, 12, 5*time.Minute).Status)
	require.NoError(t, db.Create(&Log{ChannelId: 1, CreatedAt: now.Add(5*time.Minute + 30*time.Second).Unix(), Type: LogTypeConsume, Quota: 500_000}).Error)
	changedWindow, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 5*24*3600, 13, now.Add(6*time.Minute))
	require.NoError(t, err)
	require.Equal(t, "insufficient_samples", changedWindow.Status)
	common.LogConsumeEnabled = false
	require.Equal(t, "unavailable", observe("account-1", resetAt, 15, 7*time.Minute).Status)
}

func TestCodexWeeklyEstimateRestartsWhenOtherAccountUsageRises(t *testing.T) {
	setupCodexWeeklyEstimateTest(t)
	now := time.Unix(1_800_000_000, 0)
	resetAt := now.Add(3 * 24 * time.Hour).Unix()
	_, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 7*24*3600, 10, now)
	require.NoError(t, err)
	result, err := ObserveCodexWeeklyUsage(1, "account-1", resetAt, 7*24*3600, 15, now.Add(time.Minute))
	require.NoError(t, err)
	require.Equal(t, "insufficient_samples", result.Status)
	require.Nil(t, result.EstimatedLimitUSD)
}
