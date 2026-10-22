package model

import (
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// The released users schema has no persisted daily-wallet fields. Keeping its
// original int tag exercises upgrading an existing wallet rather than replacing it.
type dailyWalletLegacyUser struct {
	User  `gorm:"embedded"`
	Quota int `gorm:"type:int;default:0"`
}

func dailyWalletTestDatabase(t *testing.T, dialect string) *gorm.DB {
	t.Helper()
	var driver gorm.Dialector
	switch dialect {
	case "sqlite":
		driver = sqlite.Open(filepath.Join(t.TempDir(), "wallet.db") + "?_pragma=busy_timeout(30000)&_pragma=journal_mode(WAL)&_txlock=immediate")
	case "mysql":
		dsn := os.Getenv("TEST_MYSQL_DSN")
		if dsn == "" {
			t.Skip("TEST_MYSQL_DSN not configured")
		}
		driver = mysql.Open(dsn)
	case "postgres":
		dsn := os.Getenv("TEST_POSTGRES_DSN")
		if dsn == "" {
			t.Skip("TEST_POSTGRES_DSN not configured")
		}
		driver = postgres.Open(dsn)
	}
	db, err := gorm.Open(driver, &gorm.Config{
		NamingStrategy: schema.NamingStrategy{TablePrefix: "wallet_regression_"},
		Logger:         logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	previousDB, previousLogDB := DB, LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	previousRedis, previousBatch := common.RedisEnabled, common.BatchUpdateEnabled
	DB, LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseType(dialect), common.DatabaseType(dialect))
	common.RedisEnabled, common.BatchUpdateEnabled = false, false
	initCol()
	t.Cleanup(func() {
		for _, table := range []any{&DailyWalletRequest{}, &DailyWalletAudit{}, &DailyWalletPeriod{}, &DailyQuotaOverride{}, &DailyQuotaPolicy{}, &Task{}, &Midjourney{}, &User{}, &TopUp{}, &Log{}} {
			assert.NoError(t, db.Migrator().DropTable(table))
		}
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		common.RedisEnabled, common.BatchUpdateEnabled = previousRedis, previousBatch
		initCol()
		assert.NoError(t, sqlDB.Close())
	})
	var version string
	query := "SELECT version()"
	if dialect == "sqlite" {
		query = "SELECT sqlite_version()"
	}
	require.NoError(t, db.Raw(query).Scan(&version).Error)
	t.Logf("%s version: %s", dialect, version)

	userTable := db.NamingStrategy.TableName("User")
	require.NoError(t, db.Table(userTable).AutoMigrate(&dailyWalletLegacyUser{}))
	require.NoError(t, db.Migrator().DropColumn(&User{}, "DailyWalletManaged"))
	require.False(t, db.Migrator().HasColumn(&User{}, "DailyWalletManaged"))
	require.NoError(t, db.AutoMigrate(&Task{}, &Midjourney{}, &TopUp{}, &Log{}))
	for _, column := range []string{"DailyWalletPeriodID", "DailyWalletRequestID"} {
		require.NoError(t, db.Migrator().DropColumn(&Midjourney{}, column))
	}
	return db
}

func dailyWalletTestUser(t *testing.T, group string, quota int) *User {
	t.Helper()
	var count int64
	require.NoError(t, DB.Unscoped().Model(&User{}).Count(&count).Error)
	name := "wallet_" + strconv.FormatInt(count+1, 10)
	user := &User{Username: name, AffCode: name, Group: group, Quota: quota, UsedQuota: 321, RequestCount: 7}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func dailyWalletAt(t *testing.T, userID int, at time.Time) *DailyQuotaSnapshot {
	t.Helper()
	var snapshot *DailyQuotaSnapshot
	require.NoError(t, dailyWalletTransaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		var err error
		snapshot, err = ensureDailyWalletTx(tx, &user, at, 23)
		return err
	}))
	return snapshot
}

func dailyWalletOverride(t *testing.T, userID int, input string) error {
	t.Helper()
	return dailyWalletTransaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		user.DailyQuotaOverrideInput = []byte(input)
		return applyDailyQuotaOverrideTx(tx, &user)
	})
}

func TestDailyWalletDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			db := dailyWalletTestDatabase(t, dialect)
			legacyUser := &User{Username: "legacy_wallet", AffCode: "legacy_wallet", Group: "default", Quota: 12345, UsedQuota: 321, RequestCount: 7}
			require.NoError(t, db.Omit("DailyWalletManaged").Create(legacyUser).Error)
			legacyMJ := &Midjourney{UserId: legacyUser.Id, MjId: "legacy_mj", Quota: 70, Status: "SUBMITTED"}
			require.NoError(t, db.Omit("DailyWalletPeriodID", "DailyWalletRequestID").Create(legacyMJ).Error)
			legacyTask := Task{TaskID: "wallet_legacy_task", UserId: legacyUser.Id, Status: TaskStatusInProgress, Quota: 100, PrivateData: TaskPrivateData{ResultURL: "https://example.com/preserved"}}
			require.NoError(t, db.Create(&legacyTask).Error)
			for range 2 {
				require.NoError(t, db.AutoMigrate(&User{}, &Task{}, &Midjourney{}))
				require.NoError(t, MigrateDailyWalletSchema(db))
				require.NoError(t, InitializeDailyQuotaPolicies())
			}
			var preservedUser User
			require.NoError(t, db.First(&preservedUser, legacyUser.Id).Error)
			assert.Equal(t, 12345, preservedUser.Quota)
			assert.False(t, preservedUser.DailyWalletManaged)
			var preservedMJ Midjourney
			require.NoError(t, db.First(&preservedMJ, legacyMJ.Id).Error)
			assert.Equal(t, 70, preservedMJ.Quota)
			assert.Equal(t, "legacy_mj", preservedMJ.MjId)
			assert.Zero(t, preservedMJ.DailyWalletPeriodID)
			assert.Equal(t, 321, preservedUser.UsedQuota)
			assert.Equal(t, 7, preservedUser.RequestCount)
			var preservedTask Task
			require.NoError(t, db.First(&preservedTask, legacyTask.ID).Error)
			assert.Equal(t, legacyTask.TaskID, preservedTask.TaskID)
			assert.Equal(t, legacyTask.Quota, preservedTask.Quota)
			assert.Equal(t, legacyTask.PrivateData.ResultURL, preservedTask.PrivateData.ResultURL)
			policies, err := ListDailyQuotaPolicies()
			require.NoError(t, err)
			require.Len(t, policies, 1)
			defaultQuota := common.QuotaFromFloat(50 * common.QuotaPerUnit)
			assert.Equal(t, DailyQuotaPolicy{Group: "workmate", DailyQuota: defaultQuota, Timezone: DailyWalletTimezone, ResetTime: "00:00"}, policies[0])

			t.Run("midnight_overwrites_wallet_and_preserves_counters", func(t *testing.T) {
				user := dailyWalletTestUser(t, "workmate", defaultQuota*2)
				beforeMidnight := time.Date(2026, 1, 5, 15, 59, 59, 0, time.UTC)
				first := dailyWalletAt(t, user.Id, beforeMidnight)
				require.NotNil(t, first)
				assert.Equal(t, "2026-01-05", first.BusinessDate)
				assert.Equal(t, defaultQuota, first.Balance)
				assert.Equal(t, beforeMidnight.Add(time.Second).Unix(), first.NextResetAt)
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", -27).Error)
				second := dailyWalletAt(t, user.Id, beforeMidnight.Add(time.Second))
				assert.Equal(t, "2026-01-06", second.BusinessDate)
				assert.NotEqual(t, first.PeriodID, second.PeriodID)
				assert.Equal(t, defaultQuota, second.Balance, "reset replaces an exhausted wallet")
				var old DailyWalletPeriod
				require.NoError(t, db.First(&old, first.PeriodID).Error)
				assert.Equal(t, -27, old.Balance)
				var stored User
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Equal(t, 321, stored.UsedQuota)
				assert.Equal(t, 7, stored.RequestCount)
				var audit DailyWalletAudit
				require.NoError(t, db.Where("period_id = ?", second.PeriodID).First(&audit).Error)
				assert.Equal(t, "daily_reset", audit.Kind)
				assert.Equal(t, -27, audit.Before)
				assert.Equal(t, defaultQuota, audit.After)
				assert.Equal(t, 23, audit.OperatorID)
			})

			t.Run("actual_group_first_entry_and_same_day_rejoin", func(t *testing.T) {
				user := dailyWalletTestUser(t, "default", 800)
				snapshot, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Nil(t, snapshot)
				var stored User
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Equal(t, 800, stored.Quota)
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "workmate").Error)
				snapshot, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				require.NotNil(t, snapshot)
				assert.Equal(t, defaultQuota, snapshot.Balance)
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "rejoin_request", snapshot.PeriodID, 60, true))
				require.NoError(t, dailyWalletOverride(t, user.Id, "100"))
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "default").Error)
				var former User
				require.NoError(t, db.First(&former, user.Id).Error)
				require.NoError(t, AttachDailyQuota(&former))
				assert.Nil(t, former.DailyQuota)
				assert.Equal(t, "100", string(former.DailyQuotaOverrideInput))
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "workmate").Error)
				require.NoError(t, dailyWalletOverride(t, user.Id, "null"))
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "default").Error)
				unmanaged, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Nil(t, unmanaged)
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "workmate").Error)
				rejoined, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, snapshot.PeriodID, rejoined.PeriodID)
				assert.Equal(t, defaultQuota-60, rejoined.Balance)
				assert.Equal(t, 60, rejoined.PendingQuota)
			})

			t.Run("cross_day_credit_and_queued_legacy_balance", func(t *testing.T) {
				user := dailyWalletTestUser(t, "workmate", 800)
				previous := dailyWalletAt(t, user.Id, time.Now().Add(-24*time.Hour))
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("quota", 17).Error)
				require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
					return creditTopUpQuota(tx, user.Id, 123, nil)
				}))
				current, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.NotEqual(t, previous.PeriodID, current.PeriodID)
				assert.Equal(t, defaultQuota+123, current.Balance, "credit is applied after the overdue reset")
				updateUserQuotaUsedQuotaAndRequestCount(user.Id, -80, 80, 1)
				current, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, defaultQuota+123, current.Balance, "queued pre-entry wallet deltas cannot undo a reset")
				var stored User
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Equal(t, 401, stored.UsedQuota)
				assert.Equal(t, 8, stored.RequestCount)
				require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("group", "default").Error)
				common.BatchUpdateEnabled = true
				err = DecreaseUserQuota(user.Id, 40, false)
				common.BatchUpdateEnabled = false
				require.NoError(t, err)
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Equal(t, defaultQuota+83, stored.Quota, "former managed wallets remain synchronous")
				ordinary := dailyWalletTestUser(t, "default", 800)
				updateUserQuotaUsedQuotaAndRequestCount(ordinary.Id, -80, 80, 1)
				stored = User{}
				require.NoError(t, db.First(&stored, ordinary.Id).Error)
				assert.Equal(t, 720, stored.Quota)
			})

			t.Run("startup_batches_drain_due_users", func(t *testing.T) {
				for range 3 {
					dailyWalletTestUser(t, "workmate", 13)
				}
				total := 0
				for range 100 {
					count, err := MaintainDailyWallets(2)
					require.NoError(t, err)
					require.LessOrEqual(t, count, 2)
					total += count
					if count == 0 {
						break
					}
				}
				assert.GreaterOrEqual(t, total, 3)
				count, err := MaintainDailyWallets(2)
				require.NoError(t, err)
				assert.Zero(t, count)
			})

			t.Run("stale_redis_balance_cannot_bypass_database", func(t *testing.T) {
				if address := os.Getenv("TEST_REDIS_ADDR"); address != "" {
					previous := common.RDB
					common.RDB = redis.NewClient(&redis.Options{Addr: address})
					common.RedisEnabled = true
					t.Cleanup(func() {
						_ = common.RDB.Close()
						common.RDB, common.RedisEnabled = previous, false
					})
					require.NoError(t, common.RDB.Ping(t.Context()).Err())
				} else {
					useUserCacheMiniRedis(t)
				}
				user := dailyWalletTestUser(t, "workmate", 1)
				snapshot, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				require.NoError(t, common.RDB.HSet(t.Context(), getUserCacheKey(user.Id), "Id", user.Id, "CacheSchema", userCacheSchemaVersion, "Quota", common.MaxWalletQuota).Err())
				balance, err := GetUserQuota(user.Id, false)
				require.NoError(t, err)
				assert.Equal(t, snapshot.Balance, balance)
				require.NoError(t, dailyWalletOverride(t, user.Id, "0"))
				require.NoError(t, common.RDB.HSet(t.Context(), getUserCacheKey(user.Id), "Id", user.Id, "CacheSchema", userCacheSchemaVersion, "Quota", common.MaxWalletQuota).Err())
				common.BatchUpdateEnabled = true
				reserved, err := TryReserveUserQuota(user.Id, 1)
				common.BatchUpdateEnabled = false
				require.NoError(t, err)
				assert.False(t, reserved, "unlimited cached quota cannot spend an empty managed wallet")
				var stored User
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Zero(t, stored.Quota)
			})

			t.Run("configuration_delta_zero_override_and_null_inheritance", func(t *testing.T) {
				require.NoError(t, UpdateDailyQuotaPolicy("workmate", 1000, 23))
				t.Cleanup(func() { require.NoError(t, UpdateDailyQuotaPolicy("workmate", defaultQuota, 23)) })
				user := dailyWalletTestUser(t, "workmate", 10)
				first, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "config_settled", first.PeriodID, 600, true))
				settled, err := SettleDailyWalletRequest(user.Id, "config_settled", first.PeriodID, 600)
				require.NoError(t, err)
				require.True(t, settled)
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "config_request", first.PeriodID, 300, true))
				require.NoError(t, UpdateDailyQuotaPolicy("workmate", 10, 23))
				changed, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, -890, changed.Balance)
				assert.Equal(t, 300, changed.PendingQuota)
				assert.Equal(t, 600, changed.SpentQuota)
				assert.Equal(t, "group", changed.Source)
				assert.Nil(t, changed.OverrideQuota)
				require.NoError(t, dailyWalletOverride(t, user.Id, "0"))
				zero, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				require.NotNil(t, zero.OverrideQuota)
				assert.Zero(t, *zero.OverrideQuota)
				assert.Equal(t, "user", zero.Source)
				assert.Equal(t, -900, zero.Balance)
				require.NoError(t, UpdateDailyQuotaPolicy("workmate", 20, 23))
				zero, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, -900, zero.Balance, "group edits do not replace a numeric override")
				require.NoError(t, dailyWalletOverride(t, user.Id, "null"))
				inherited, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Nil(t, inherited.OverrideQuota)
				assert.Equal(t, "group", inherited.Source)
				assert.Equal(t, 20, inherited.LimitQuota)
				assert.Equal(t, -880, inherited.Balance)
				assert.Equal(t, 300, inherited.PendingQuota)
				assert.Equal(t, 600, inherited.SpentQuota)
				for _, input := range []string{"-1", "1.5", "\"0\"", strconv.Itoa(common.MaxWalletQuota + 1)} {
					assert.ErrorIs(t, dailyWalletOverride(t, user.Id, input), ErrInvalidDailyQuota)
				}
				var stored User
				require.NoError(t, db.First(&stored, user.Id).Error)
				assert.Equal(t, -880, stored.Quota)
				assert.Equal(t, 321, stored.UsedQuota)
				assert.Equal(t, 7, stored.RequestCount)
				assert.ErrorIs(t, UpdateDailyQuotaPolicy("workmate", -1, 23), ErrInvalidDailyQuota)
				assert.ErrorIs(t, UpdateDailyQuotaPolicy("workmate", common.MaxWalletQuota+1, 23), ErrInvalidDailyQuota)
			})

			t.Run("late_settlement_refunds_and_duplicate_requests", func(t *testing.T) {
				user := dailyWalletTestUser(t, "workmate", 0)
				old, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				for request, quota := range map[string]int{"late_settle": 100, "late_pending_refund": 120, "late_extra": 80} {
					require.NoError(t, ReserveDailyWalletRequest(user.Id, request, old.PeriodID, quota, true))
				}
				yesterday := time.Now().In(dailyWalletLocation).AddDate(0, 0, -1)
				require.NoError(t, db.Model(&DailyWalletPeriod{}).Where("id = ?", old.PeriodID).Update("business_date", yesterday.Format("2006-01-02")).Error)
				current, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.NotEqual(t, old.PeriodID, current.PeriodID)
				assert.Equal(t, defaultQuota, current.Balance)
				changed, err := SettleDailyWalletRequest(user.Id, "late_settle", old.PeriodID, 40)
				require.NoError(t, err)
				assert.True(t, changed)
				changed, err = SettleDailyWalletRequest(user.Id, "late_settle", old.PeriodID, 40)
				require.NoError(t, err)
				assert.False(t, changed)
				_, err = SettleDailyWalletRequest(user.Id, "late_settle", old.PeriodID, 41)
				assert.ErrorIs(t, err, ErrDailyWalletConflict)
				for range 2 {
					_, err = AdjustDailyWalletRequest(user.Id, "late_pending_refund", old.PeriodID, 120, 0, true)
					require.NoError(t, err)
				}
				changed, err = SettleDailyWalletRequest(user.Id, "late_extra", old.PeriodID, 90)
				require.NoError(t, err)
				assert.True(t, changed)
				for range 2 {
					_, err = AdjustDailyWalletRequest(user.Id, "late_settle", old.PeriodID, 40, 0, true)
					require.NoError(t, err)
				}
				changed, err = SettleDailyWalletRequest(user.Id, "late_settle", old.PeriodID, 40)
				require.NoError(t, err)
				assert.False(t, changed, "a completed refund cannot be settled a second time")
				var closed DailyWalletPeriod
				require.NoError(t, db.First(&closed, old.PeriodID).Error)
				assert.Equal(t, defaultQuota-90, closed.Balance)
				assert.Equal(t, 90, closed.SpentQuota)
				assert.Zero(t, closed.PendingQuota)
				current, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, defaultQuota, current.Balance, "old-day refunds never credit today's grant")
				assert.Zero(t, current.SpentQuota)
				assert.Zero(t, current.PendingQuota)
				historical, err := EnsureDailyWalletAt(user.Id, yesterday)
				require.NoError(t, err)
				assert.Equal(t, old.PeriodID, historical.PeriodID)
				assert.Equal(t, closed.Balance, historical.Balance)
				assert.ErrorIs(t, ReserveDailyWalletRequest(user.Id, "late_extra", current.PeriodID, 90, true), ErrDailyWalletConflict)
				other := dailyWalletTestUser(t, "workmate", 0)
				otherPeriod, err := EnsureDailyWallet(other.Id)
				require.NoError(t, err)
				assert.ErrorIs(t, ReserveDailyWalletRequest(other.Id, "late_extra", otherPeriod.PeriodID, 90, true), ErrDailyWalletConflict)
			})

			t.Run("concurrent_reservations_and_settlement_are_idempotent", func(t *testing.T) {
				user := dailyWalletTestUser(t, "workmate", 0)
				require.NoError(t, dailyWalletOverride(t, user.Id, "100"))
				period, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				var wg sync.WaitGroup
				start := make(chan struct{})
				errors := make([]error, 4)
				for i := range errors {
					wg.Go(func() {
						<-start
						errors[i] = ReserveDailyWalletRequest(user.Id, "concurrent_same", period.PeriodID, 60, true)
					})
				}
				close(start)
				wg.Wait()
				for _, err := range errors {
					require.NoError(t, err)
				}
				changes := make([]bool, len(errors))
				for i := range errors {
					wg.Go(func() {
						changes[i], errors[i] = SettleDailyWalletRequest(user.Id, "concurrent_same", period.PeriodID, 40)
					})
				}
				wg.Wait()
				changedCount := 0
				for i, changed := range changes {
					require.NoError(t, errors[i])
					if changed {
						changedCount++
					}
				}
				assert.Equal(t, 1, changedCount)
				period, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, 60, period.Balance)
				assert.Equal(t, 40, period.SpentQuota)
				assert.Zero(t, period.PendingQuota)
				errors = make([]error, 2)
				start = make(chan struct{})
				for i := range errors {
					wg.Go(func() {
						<-start
						errors[i] = ReserveDailyWalletRequest(user.Id, "competing_"+strconv.Itoa(i), period.PeriodID, 40, true)
					})
				}
				close(start)
				wg.Wait()
				reservedCount := 0
				for _, err := range errors {
					if err == nil {
						reservedCount++
					} else {
						assert.ErrorIs(t, err, ErrDailyWalletInsufficient)
					}
				}
				assert.Equal(t, 1, reservedCount, "competing requests cannot overspend the same available balance")
				assert.ErrorIs(t, ReserveDailyWalletRequest(user.Id, "too_large", period.PeriodID, 21, true), ErrDailyWalletInsufficient)
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "allow_debt", period.PeriodID, 21, false))
				period, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, -1, period.Balance)
				assert.Equal(t, 61, period.PendingQuota)
			})

			t.Run("bigint_boundaries_and_repeated_migration", func(t *testing.T) {
				user := dailyWalletTestUser(t, "workmate", 0)
				require.NoError(t, dailyWalletOverride(t, user.Id, strconv.Itoa(common.MaxWalletQuota)))
				period, err := EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, common.MaxWalletQuota, period.Balance)
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "bigint_request", period.PeriodID, common.MaxWalletQuota, true))
				for range 2 {
					require.NoError(t, MigrateDailyWalletSchema(db))
					require.NoError(t, InitializeDailyQuotaPolicies())
				}
				assert.True(t, db.Migrator().HasIndex(&DailyWalletPeriod{}, "idx_daily_wallet_user_date"))
				duplicate := DailyWalletPeriod{UserID: user.Id, BusinessDate: period.BusinessDate, PolicyGroup: "workmate"}
				assert.Error(t, db.Create(&duplicate).Error, "a restart preserves one grant per user and business date")
				changed, err := AdjustDailyWalletRequest(user.Id, "bigint_request", period.PeriodID, common.MaxWalletQuota, 0, true)
				require.NoError(t, err)
				assert.True(t, changed)
				period, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, common.MaxWalletQuota, period.Balance)
				assert.Zero(t, period.PendingQuota)
				assert.ErrorIs(t, ReserveDailyWalletRequest(user.Id, "overflow", period.PeriodID, common.MaxWalletQuota+1, true), ErrInvalidDailyQuota)
				assert.ErrorIs(t, ReserveDailyWalletRequest(user.Id, "negative", period.PeriodID, -1, true), ErrInvalidDailyQuota)
				var request DailyWalletRequest
				require.NoError(t, db.First(&request, "request_id = ?", "bigint_request").Error)
				assert.Equal(t, "refunded", request.State)
				require.NoError(t, dailyWalletOverride(t, user.Id, "0"))
				require.NoError(t, ReserveDailyWalletRequest(user.Id, "max_debt", period.PeriodID, common.MaxWalletQuota, false))
				assert.ErrorIs(t, ReserveDailyWalletRequest(user.Id, "debt_overflow", period.PeriodID, 1, false), ErrInvalidDailyQuota)
				period, err = EnsureDailyWallet(user.Id)
				require.NoError(t, err)
				assert.Equal(t, -common.MaxWalletQuota, period.Balance)
				assert.Equal(t, common.MaxWalletQuota, period.PendingQuota)
			})

			var topupCount int64
			require.NoError(t, db.Model(&TopUp{}).Count(&topupCount).Error)
			assert.Zero(t, topupCount, "daily resets and policy changes are not paid top-ups")
			var auditCount int64
			require.NoError(t, db.Model(&DailyWalletAudit{}).Count(&auditCount).Error)
			assert.Positive(t, auditCount, "wallet grants and changes retain an audit trail")
		})
	}
}
