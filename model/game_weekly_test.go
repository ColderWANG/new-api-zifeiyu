package model

import (
	"errors"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"sync"
	"testing"
	"time"
)

func verifyWeeklyPodiumRewards(t *testing.T, db *gorm.DB) {
	t.Helper()
	now := time.Date(2026, 11, 16, 12, 0, 0, 0, gameZone)
	_, week, _ := GameCalendar(now)
	for id := 401; id <= 404; id++ {
		require.NoError(t, db.Create(&User{Id: id, Username: fmt.Sprintf("podium%d", id), Password: "unusable", AffCode: fmt.Sprintf("podium%d", id), Status: common.UserStatusEnabled}).Error)
	}
	for _, row := range []struct{ id, day, score int }{{401, 16, 100}, {401, 17, 300}, {402, 16, 350}, {403, 16, 200}, {404, 16, 200}} {
		require.NoError(t, db.Create(&GameRun{ID: fmt.Sprintf("podium-%d-%d", row.id, row.day), UserID: row.id, Day: fmt.Sprintf("2026-11-%02d", row.day), Week: week, Status: "survived", Score: row.score, FinishedAt: time.Date(2026, 11, row.day, 12, 405-row.id, 0, 0, gameZone).UnixMilli(), StateJSON: "{}"}).Error)
	}
	// Fixed amounts replace this unsettled week; every version rewards only the podium.
	require.NoError(t, db.Create(&GamePeriod{ID: "week:" + week, Budget: 1000}).Error)
	settings := GameSettings{Enabled: true, RewardsEnabled: true, RewardVersion: 2, WeeklyRewardVersion: 2, WeeklyFirstQuota: 10000000, WeeklySecondQuota: 5000000, WeeklyThirdQuota: 2500000}
	require.NoError(t, saveGameSettingsAt(settings, now))
	budgets, err := GetGameBudgets(settings, now)
	require.NoError(t, err)
	require.Equal(t, 10000000, budgets.WeeklyFirstQuota, "saving must update the current week's actual prizes")
	require.Equal(t, 5000000, budgets.WeeklySecondQuota)
	require.Equal(t, 2500000, budgets.WeeklyThirdQuota)
	require.Equal(t, 17500000, budgets.WeeklyPool)
	require.Equal(t, 2, budgets.WeeklyRewardVersion)
	require.True(t, budgets.WeeklyRewardsEnabled)
	settings.WeeklyFirstQuota, settings.WeeklySecondQuota, settings.WeeklyThirdQuota = 15000000, 6000000, 3000000
	require.NoError(t, saveGameSettingsAt(settings, now.Add(24*time.Hour)))
	budgets, err = GetGameBudgets(settings, now)
	require.NoError(t, err)
	require.Equal(t, 15000000, budgets.WeeklyFirstQuota)
	require.Equal(t, 24000000, budgets.WeeklyPool)
	off := settings
	off.RewardsEnabled = false
	require.NoError(t, saveGameSettingsAt(off, now.Add(24*time.Hour)))
	offView, err := GetGameBudgets(off, now)
	require.NoError(t, err)
	require.True(t, offView.WeeklyRewardsEnabled)
	require.Equal(t, 24000000, offView.WeeklyPool, "disabling rewards must not cancel an already activated week")
	require.NoError(t, saveGameSettingsAt(settings, now.Add(24*time.Hour)))
	require.NoError(t, SettleGameWeek(week, now.Add(24*time.Hour)))
	var ledgerCount int64
	require.NoError(t, db.Model(&GameReward{}).Where("user_id BETWEEN ? AND ?", 401, 404).Count(&ledgerCount).Error)
	require.Zero(t, ledgerCount, "editing prizes must not issue money early")
	// Next week's settings must never replace the closing week's snapshot.
	end := time.Date(2026, 11, 23, 0, 6, 0, 0, gameZone)
	nextSettings := settings
	nextSettings.WeeklyFirstQuota, nextSettings.WeeklySecondQuota, nextSettings.WeeklyThirdQuota = 1000000, 500000, 250000
	require.NoError(t, saveGameSettingsAt(nextSettings, end))
	var wg sync.WaitGroup
	for range 4 {
		wg.Go(func() { _ = SettleGameWeek(week, end) })
	}
	wg.Wait()
	require.NoError(t, SettleGameWeek(week, end))
	for _, row := range []struct{ id, quota int }{{401, 15000000}, {402, 6000000}, {403, 0}, {404, 3000000}} {
		var user User
		require.NoError(t, db.First(&user, row.id).Error)
		require.Equal(t, row.quota, user.Quota)
	}
	require.NoError(t, db.Model(&GameReward{}).Where("user_id BETWEEN ? AND ?", 401, 404).Count(&ledgerCount).Error)
	require.EqualValues(t, 3, ledgerCount, "only the top three are paid, exactly once")
	var settled GamePeriod
	require.NoError(t, db.First(&settled, "id = ?", "week:"+week).Error)
	require.True(t, settled.Settled)
	require.Equal(t, 24000000, settled.Spent)
	// Even a delayed save aimed at a settled week must not rewrite its audit record.
	require.NoError(t, saveGameSettingsAt(nextSettings, now))
	var preserved GamePeriod
	require.NoError(t, db.First(&preserved, "id = ?", settled.ID).Error)
	require.Equal(t, settled, preserved)
	invalid := settings
	invalid.WeeklyFirstQuota = -1
	require.ErrorIs(t, saveGameSettingsAt(invalid, end), ErrGameSettings)
	invalid.WeeklyFirstQuota, invalid.WeeklySecondQuota = 1000000000, 1000000000
	require.ErrorIs(t, saveGameSettingsAt(invalid, end), ErrGameSettings)
	// Unsettled legacy versions also pay exactly three places, never ranks 4-10.
	for _, version := range []int{0, 1} {
		start := time.Date(2027, 1, 4+7*version, 12, 0, 0, 0, gameZone)
		_, legacyWeek, _ := GameCalendar(start)
		for rank := 1; rank <= 4; rank++ {
			id := 500 + version*10 + rank
			require.NoError(t, db.Create(&User{Id: id, Username: fmt.Sprintf("legacy-podium%d", id), Password: "unusable", AffCode: fmt.Sprintf("legacy-podium%d", id), Status: common.UserStatusEnabled}).Error)
			require.NoError(t, db.Create(&GameRun{ID: fmt.Sprintf("legacy-podium%d", id), UserID: id, Day: legacyWeek, Week: legacyWeek, Status: "survived", Score: 5 - rank, FinishedAt: start.UnixMilli(), StateJSON: "{}"}).Error)
		}
		require.NoError(t, db.Create(&GamePeriod{ID: "week:" + legacyWeek, Budget: 1000, WeeklyRewardVersion: version}).Error)
		view, err := GetGameBudgets(settings, start)
		require.NoError(t, err)
		require.Equal(t, 650, view.WeeklyPool, "the displayed total must include only the three payable rewards")
		require.NoError(t, SettleGameWeek(legacyWeek, start.AddDate(0, 0, 7)))
		for i, expected := range []int{300, 200, 150, 0} {
			var user User
			require.NoError(t, db.First(&user, 501+version*10+i).Error)
			require.Equal(t, expected, user.Quota)
		}
		var count int64
		require.NoError(t, db.Model(&GameReward{}).Where("id LIKE ?", "week:"+legacyWeek+":%").Count(&count).Error)
		require.EqualValues(t, 3, count)
		require.NoError(t, SettleGameWeek(legacyWeek, start.AddDate(0, 0, 7)))
	}
	// Both the option and active week must roll back if either write fails.
	var before Option
	require.NoError(t, db.Where(&Option{Key: "game_center"}).First(&before).Error)
	beforeCache := common.OptionMap["game_center"]
	require.NoError(t, db.Callback().Update().Before("gorm:update").Register("fail-weekly-prize-update", func(tx *gorm.DB) {
		if tx.Statement.Table == "game_periods" {
			tx.AddError(errors.New("test weekly write failure"))
		}
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Update().Remove("fail-weekly-prize-update")) })
	require.Error(t, saveGameSettingsAt(settings, end))
	var after Option
	require.NoError(t, db.Where(&Option{Key: "game_center"}).First(&after).Error)
	require.Equal(t, before, after)
	require.Equal(t, beforeCache, common.OptionMap["game_center"])
}
