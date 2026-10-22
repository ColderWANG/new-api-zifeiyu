package model

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CodexWeeklyEstimateObservation keeps the first usable measurement in a
// weekly window. The account identifier is hashed so observations do not
// disclose account IDs through the database.
type CodexWeeklyEstimateObservation struct {
	Id               int64   `gorm:"primaryKey"`
	ChannelId        int     `gorm:"uniqueIndex:idx_codex_weekly_observation"`
	AccountHash      string  `gorm:"type:varchar(64);uniqueIndex:idx_codex_weekly_observation"`
	ResetAt          int64   `gorm:"uniqueIndex:idx_codex_weekly_observation"`
	WindowSeconds    int64   `gorm:"not null"`
	BaselinePercent  float64 `gorm:"not null"`
	BaselineNetQuota int64   `gorm:"not null"`
	BaselineAt       int64   `gorm:"not null"`
	LastPercent      float64 `gorm:"not null"`
	LastNetQuota     int64   `gorm:"not null"`
	LastAt           int64   `gorm:"not null"`
	SampleCount      int     `gorm:"not null;default:1"`
}

type CodexWeeklyUSDEstimate struct {
	Status                string   `json:"status"`
	EstimatedLimitUSD     *float64 `json:"estimated_limit_usd"`
	EstimatedRemainingUSD *float64 `json:"estimated_remaining_usd"`
	ObservedSpendUSD      *float64 `json:"observed_spend_usd"`
	ObservedPercentPoints *float64 `json:"observed_percent_points"`
	CurrentWindowSpendUSD *float64 `json:"current_window_spend_usd"`
	SampleCount           int      `json:"sample_count"`
}

const (
	codexWeeklyEstimateMinPercentPoints = 3
	codexWeeklyEstimateMinSpendUSD      = 0.10
	codexWeeklyWindowMinSeconds         = 5 * 24 * 60 * 60
	codexWeeklyWindowMaxSeconds         = 9 * 24 * 60 * 60
)

func unavailableCodexWeeklyEstimate(status string) CodexWeeklyUSDEstimate {
	return CodexWeeklyUSDEstimate{Status: status}
}

// ObserveCodexWeeklyUsage estimates a USD-equivalent ceiling from the change
// in this channel's billed quota and the upstream weekly usage percentage.
// The result is deliberately unavailable until two meaningful measurements
// exist in the same window.
func ObserveCodexWeeklyUsage(channelID int, accountID string, resetAt, windowSeconds int64, usedPercent float64, now time.Time) (CodexWeeklyUSDEstimate, error) {
	result := unavailableCodexWeeklyEstimate("unavailable")
	nowUnix := now.Unix()
	if channelID <= 0 || accountID == "" || resetAt <= nowUnix || windowSeconds < codexWeeklyWindowMinSeconds || windowSeconds > codexWeeklyWindowMaxSeconds ||
		resetAt-windowSeconds > nowUnix || math.IsNaN(usedPercent) || math.IsInf(usedPercent, 0) || usedPercent < 0 || usedPercent > 100 ||
		common.QuotaPerUnit <= 0 || !common.LogConsumeEnabled || LOG_DB == nil || DB == nil {
		return result, nil
	}

	var totals struct{ NetQuota int64 }
	err := LOG_DB.Model(&Log{}).
		Select("COALESCE(SUM(CASE WHEN type = ? THEN quota WHEN type = ? THEN -quota ELSE 0 END), 0) AS net_quota", LogTypeConsume, LogTypeRefund).
		Where("channel_id = ? AND created_at >= ? AND created_at <= ? AND type IN (?, ?)", channelID, resetAt-windowSeconds, nowUnix, LogTypeConsume, LogTypeRefund).
		Scan(&totals).Error
	if err != nil {
		return result, err
	}
	currentWindowSpendUSD := float64(totals.NetQuota) / common.QuotaPerUnit
	result.CurrentWindowSpendUSD = &currentWindowSpendUSD

	hash := sha256.Sum256([]byte(accountID))
	accountHash := hex.EncodeToString(hash[:])
	err = DB.Transaction(func(tx *gorm.DB) error {
		var observation CodexWeeklyEstimateObservation
		query := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("channel_id = ? AND account_hash = ? AND reset_at = ?", channelID, accountHash, resetAt)
		err := query.First(&observation).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			observation = CodexWeeklyEstimateObservation{
				ChannelId: channelID, AccountHash: accountHash, ResetAt: resetAt,
				WindowSeconds:   windowSeconds,
				BaselinePercent: usedPercent, BaselineNetQuota: totals.NetQuota, BaselineAt: nowUnix,
				LastPercent: usedPercent, LastNetQuota: totals.NetQuota, LastAt: nowUnix, SampleCount: 1,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&observation).Error; err != nil {
				return err
			}
			result.Status = "insufficient_samples"
			result.SampleCount = 1
			return nil
		}
		if err != nil {
			return err
		}

		// A reset credit or deleted/refunded logs can make the historical
		// slope invalid. Start a fresh baseline instead of showing a negative
		// or inflated estimate.
		if nowUnix < observation.LastAt {
			return nil
		}
		spendAdvancedWithoutPercent := totals.NetQuota > observation.LastNetQuota && usedPercent == observation.LastPercent
		if windowSeconds != observation.WindowSeconds || usedPercent < observation.LastPercent || totals.NetQuota < observation.LastNetQuota ||
			(usedPercent > observation.LastPercent && totals.NetQuota == observation.LastNetQuota) {
			observation.WindowSeconds = windowSeconds
			observation.BaselinePercent = usedPercent
			observation.BaselineNetQuota = totals.NetQuota
			observation.BaselineAt = nowUnix
			observation.SampleCount = 1
		} else if usedPercent != observation.LastPercent || totals.NetQuota != observation.LastNetQuota {
			observation.SampleCount++
		}
		observation.LastPercent = usedPercent
		observation.LastNetQuota = totals.NetQuota
		observation.LastAt = nowUnix
		if err := tx.Save(&observation).Error; err != nil {
			return err
		}
		result.SampleCount = observation.SampleCount
		if observation.SampleCount < 2 {
			result.Status = "insufficient_samples"
			return nil
		}
		if spendAdvancedWithoutPercent {
			result.Status = "insufficient_change"
			return nil
		}
		percentDelta := usedPercent - observation.BaselinePercent
		quotaDelta := totals.NetQuota - observation.BaselineNetQuota
		spendUSD := float64(quotaDelta) / common.QuotaPerUnit
		if percentDelta < codexWeeklyEstimateMinPercentPoints || spendUSD < codexWeeklyEstimateMinSpendUSD {
			result.Status = "insufficient_change"
			return nil
		}
		limitUSD := spendUSD * 100 / percentDelta
		remainingUSD := limitUSD * (100 - usedPercent) / 100
		if math.IsNaN(limitUSD) || math.IsInf(limitUSD, 0) || limitUSD <= 0 {
			result.Status = "unavailable"
			return nil
		}
		result.Status = "available"
		result.EstimatedLimitUSD = &limitUSD
		result.EstimatedRemainingUSD = &remainingUSD
		result.ObservedSpendUSD = &spendUSD
		result.ObservedPercentPoints = &percentDelta
		return nil
	})
	return result, err
}
