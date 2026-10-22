package model

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrInvalidDailyQuota       = errors.New("invalid daily wallet quota")
	ErrDailyWalletInsufficient = errors.New("daily wallet quota insufficient")
	ErrDailyWalletConflict     = errors.New("daily wallet request state conflict")
)

const DailyWalletTimezone = "Asia/Shanghai"

var dailyWalletLocation = time.FixedZone(DailyWalletTimezone, 8*60*60)
var dailyWalletGroups sync.Map

func init() { dailyWalletGroups.Store("workmate", true) }

type DailyQuotaPolicy struct {
	Group      string `json:"group" gorm:"column:group_name;primaryKey;size:64"`
	DailyQuota int    `json:"daily_quota" gorm:"type:bigint;not null"`
	Timezone   string `json:"timezone" gorm:"size:64;not null"`
	ResetTime  string `json:"reset_time" gorm:"size:8;not null"`
}

type DailyQuotaOverride struct {
	UserID int  `gorm:"primaryKey;autoIncrement:false"`
	Quota  *int `gorm:"type:bigint"`
}

type DailyWalletPeriod struct {
	ID           int64  `gorm:"primaryKey"`
	UserID       int    `gorm:"not null;uniqueIndex:idx_daily_wallet_user_date,priority:1"`
	BusinessDate string `gorm:"size:10;not null;uniqueIndex:idx_daily_wallet_user_date,priority:2"`
	PolicyGroup  string `gorm:"size:64;not null"`
	AppliedLimit int    `gorm:"type:bigint;not null"`
	Balance      int    `gorm:"type:bigint;not null"`
	SpentQuota   int    `gorm:"type:bigint;not null"`
	PendingQuota int    `gorm:"type:bigint;not null"`
}

type DailyWalletRequest struct {
	RequestID string `gorm:"primaryKey;size:128"`
	UserID    int    `gorm:"not null;index"`
	PeriodID  int64  `gorm:"not null;index"`
	Quota     int    `gorm:"type:bigint;not null"`
	State     string `gorm:"size:16;not null"`
}

// DailyWalletAudit is committed alongside the wallet change, never as top-up income.
type DailyWalletAudit struct {
	ID         int64  `gorm:"primaryKey"`
	UserID     int    `gorm:"not null;index"`
	PeriodID   int64  `gorm:"not null;index"`
	Kind       string `gorm:"size:32;not null"`
	Before     int    `gorm:"type:bigint;not null"`
	After      int    `gorm:"type:bigint;not null"`
	OperatorID int
	CreatedAt  int64 `gorm:"autoCreateTime"`
}

type DailyQuotaSnapshot struct {
	Group         string `json:"group"`
	LimitQuota    int    `json:"limit_quota"`
	GroupQuota    int    `json:"group_quota"`
	OverrideQuota *int   `json:"override_quota"`
	Source        string `json:"source"`
	PeriodID      int64  `json:"period_id"`
	BusinessDate  string `json:"business_date"`
	Balance       int    `json:"balance"`
	SpentQuota    int    `json:"spent_quota"`
	PendingQuota  int    `json:"pending_quota"`
	NextResetAt   int64  `json:"next_reset_at"`
	Timezone      string `json:"timezone"`
}

func MigrateDailyWalletSchema(db *gorm.DB) error {
	return db.AutoMigrate(&DailyQuotaPolicy{}, &DailyQuotaOverride{}, &DailyWalletPeriod{}, &DailyWalletRequest{}, &DailyWalletAudit{})
}

func InitializeDailyQuotaPolicies() error {
	policy := DailyQuotaPolicy{Group: "workmate", DailyQuota: common.QuotaFromFloat(50 * common.QuotaPerUnit), Timezone: DailyWalletTimezone, ResetTime: "00:00"}
	if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&policy).Error; err != nil {
		return err
	}
	var policies []DailyQuotaPolicy
	if err := DB.Find(&policies).Error; err != nil {
		return err
	}
	for _, p := range policies {
		dailyWalletGroups.Store(p.Group, true)
	}
	return nil
}

func ListDailyQuotaPolicies() ([]DailyQuotaPolicy, error) {
	var policies []DailyQuotaPolicy
	err := DB.Order("group_name asc").Find(&policies).Error
	return policies, err
}

func UpdateDailyQuotaPolicy(group string, quota int, operatorID int) error {
	if group == "" || quota < 0 || quota > common.MaxWalletQuota {
		return ErrInvalidDailyQuota
	}
	result := DB.Model(&DailyQuotaPolicy{}).Where("group_name = ?", group).Update("daily_quota", quota)
	if result.Error != nil {
		return result.Error
	}
	var count int64
	if err := DB.Model(&DailyQuotaPolicy{}).Where("group_name = ?", group).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	// Reads and reservations reconcile immediately; maintenance handles idle users.
	return nil
}

func dailyWalletTransaction(fn func(*gorm.DB) error) error {
	var err error
	for attempt := 0; attempt < 10; attempt++ {
		err = DB.Transaction(fn)
		if err == nil {
			return nil
		}
		message := strings.ToLower(err.Error())
		if !strings.Contains(message, "database is locked") && !strings.Contains(message, "sqlite_busy") && !strings.Contains(message, "deadlock") && !strings.Contains(message, "serialization") {
			return err
		}
		time.Sleep(time.Duration(attempt+1) * 5 * time.Millisecond)
	}
	return err
}

func dailyWalletAuditTx(tx *gorm.DB, userID int, periodID int64, kind string, before, after, operatorID int) error {
	return tx.Create(&DailyWalletAudit{UserID: userID, PeriodID: periodID, Kind: kind, Before: before, After: after, OperatorID: operatorID}).Error
}

func ensureDailyWalletTx(tx *gorm.DB, user *User, at time.Time, operatorID int) (*DailyQuotaSnapshot, error) {
	if _, managed := dailyWalletGroups.Load(user.Group); !managed {
		return nil, nil
	}
	var policy DailyQuotaPolicy
	err := tx.Where("group_name = ?", user.Group).First(&policy).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var override DailyQuotaOverride
	if err = tx.First(&override, "user_id = ?", user.Id).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	limit := policy.DailyQuota
	source := "group"
	if override.Quota != nil {
		limit = *override.Quota
		source = "user"
	}
	date := at.In(dailyWalletLocation).Format("2006-01-02")
	var period DailyWalletPeriod
	err = tx.Where("user_id = ? AND business_date = ?", user.Id, date).First(&period).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// The previous period closes at the actual wallet balance, including extra credits.
		var previous DailyWalletPeriod
		if previousErr := tx.Where("user_id = ?", user.Id).Order("business_date desc").First(&previous).Error; previousErr == nil {
			if err = tx.Model(&previous).Update("balance", user.Quota).Error; err != nil {
				return nil, err
			}
		} else if !errors.Is(previousErr, gorm.ErrRecordNotFound) {
			return nil, previousErr
		}
		period = DailyWalletPeriod{UserID: user.Id, BusinessDate: date, PolicyGroup: user.Group, AppliedLimit: limit, Balance: limit}
		if err = tx.Create(&period).Error; err != nil {
			return nil, err
		}
		if err = dailyWalletAuditTx(tx, user.Id, period.ID, "daily_reset", user.Quota, limit, operatorID); err != nil {
			return nil, err
		}
		user.Quota = limit
		user.DailyWalletManaged = true
	} else if err != nil {
		return nil, err
	} else {
		// The wallet is authoritative for extra credits and same-day leave/rejoin.
		period.Balance = user.Quota
		delta := int64(limit) - int64(period.AppliedLimit)
		after := int64(user.Quota) + delta
		if after > common.MaxWalletQuota || after < -common.MaxWalletQuota {
			return nil, ErrInvalidDailyQuota
		}
		if delta != 0 {
			if err = dailyWalletAuditTx(tx, user.Id, period.ID, "limit_adjustment", user.Quota, int(after), operatorID); err != nil {
				return nil, err
			}
		}
		user.Quota = int(after)
		period.Balance = user.Quota
		period.AppliedLimit = limit
		if err = tx.Save(&period).Error; err != nil {
			return nil, err
		}
	}
	user.DailyWalletManaged = true
	if err = tx.Model(&User{}).Where("id = ?", user.Id).Updates(map[string]any{"quota": user.Quota, "daily_wallet_managed": true}).Error; err != nil {
		return nil, err
	}
	local := at.In(dailyWalletLocation)
	next := time.Date(local.Year(), local.Month(), local.Day()+1, 0, 0, 0, 0, dailyWalletLocation)
	return &DailyQuotaSnapshot{Group: user.Group, LimitQuota: limit, GroupQuota: policy.DailyQuota, OverrideQuota: override.Quota, Source: source, PeriodID: period.ID, BusinessDate: date, Balance: user.Quota, SpentQuota: period.SpentQuota, PendingQuota: period.PendingQuota, NextResetAt: next.Unix(), Timezone: DailyWalletTimezone}, nil
}

func EnsureDailyWallet(userID int) (*DailyQuotaSnapshot, error) {
	return EnsureDailyWalletAt(userID, time.Now())
}

func EnsureDailyWalletAt(userID int, at time.Time) (*DailyQuotaSnapshot, error) {
	if userID <= 0 {
		return nil, ErrInvalidDailyQuota
	}
	if at.IsZero() {
		at = time.Now()
	}
	var snapshot *DailyQuotaSnapshot
	err := dailyWalletTransaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		now := time.Now()
		var err error
		snapshot, err = ensureDailyWalletTx(tx, &user, now, 0)
		if err != nil || snapshot == nil {
			return err
		}
		date := at.In(dailyWalletLocation).Format("2006-01-02")
		if date >= snapshot.BusinessDate {
			return nil
		}
		var historical DailyWalletPeriod
		err = tx.Where("user_id = ? AND business_date = ?", userID, date).First(&historical).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			historical = DailyWalletPeriod{UserID: userID, BusinessDate: date, PolicyGroup: user.Group, AppliedLimit: snapshot.LimitQuota, Balance: snapshot.LimitQuota}
			err = tx.Create(&historical).Error
		}
		if err != nil {
			return err
		}
		snapshot.PeriodID = historical.ID
		snapshot.BusinessDate = date
		snapshot.Balance = historical.Balance
		snapshot.SpentQuota = historical.SpentQuota
		snapshot.PendingQuota = historical.PendingQuota
		return nil
	})
	if err == nil && snapshot != nil {
		_ = invalidateUserCache(userID)
	}
	return snapshot, err
}

func AttachDailyQuota(user *User) error {
	if user == nil || user.DeletedAt.Valid {
		return nil
	}
	if _, managed := dailyWalletGroups.Load(user.Group); !managed {
		user.DailyQuota = nil
		user.DailyQuotaOverrideInput = nil
		// Retain the saved personal choice when an administrator later rejoins
		// this account to its managed group. No reset runs outside that group.
		if user.DailyWalletManaged {
			var override DailyQuotaOverride
			if err := DB.First(&override, "user_id = ?", user.Id).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			data, err := common.Marshal(override.Quota)
			if err != nil {
				return err
			}
			user.DailyQuotaOverrideInput = data
		}
		return nil
	}
	snapshot, err := EnsureDailyWallet(user.Id)
	if err != nil {
		return err
	}
	user.DailyQuota = snapshot
	user.DailyQuotaOverrideInput = nil
	if snapshot != nil {
		user.Quota = snapshot.Balance
	}
	return nil
}

func applyDailyQuotaOverrideTx(tx *gorm.DB, user *User) error {
	input := user.DailyQuotaOverrideInput
	if len(input) > 0 {
		var quota *int
		if err := common.Unmarshal(input, &quota); err != nil || (quota != nil && (*quota < 0 || *quota > common.MaxWalletQuota)) {
			return ErrInvalidDailyQuota
		}
		row := DailyQuotaOverride{UserID: user.Id, Quota: quota}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "user_id"}}, DoUpdates: clause.AssignmentColumns([]string{"quota"})}).Create(&row).Error; err != nil {
			return err
		}
	}
	_, err := ensureDailyWalletTx(tx, user, time.Now(), 0)
	return err
}

// currentDailyWalletTx serializes resets and request mutations in the same user lock.
func currentDailyWalletTx(tx *gorm.DB, userID int, periodID int64) (*User, *DailyWalletPeriod, bool, error) {
	var user User
	if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
		return nil, nil, false, err
	}
	if _, err := ensureDailyWalletTx(tx, &user, time.Now(), 0); err != nil {
		return nil, nil, false, err
	}
	var period DailyWalletPeriod
	if err := tx.First(&period, "id = ? AND user_id = ?", periodID, userID).Error; err != nil {
		return nil, nil, false, err
	}
	var latest DailyWalletPeriod
	if err := tx.Where("user_id = ?", userID).Order("business_date desc").First(&latest).Error; err != nil {
		return nil, nil, false, err
	}
	active := latest.ID == period.ID
	if active {
		period.Balance = user.Quota
	}
	return &user, &period, active, nil
}

// Payment and reward transactions cross midnight before crediting new money,
// so a later lazy reset cannot erase a post-midnight credit.
func reconcileDailyWalletBeforeMutationTx(tx *gorm.DB, userID int) (*User, error) {
	var user User
	if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
		return nil, err
	}
	_, err := ensureDailyWalletTx(tx, &user, time.Now(), 0)
	return &user, err
}

func saveDailyWalletChargeTx(tx *gorm.DB, user *User, period *DailyWalletPeriod, active bool, delta int) error {
	after := int64(period.Balance) - int64(delta)
	if after > common.MaxWalletQuota || after < -common.MaxWalletQuota || period.SpentQuota < 0 || period.PendingQuota < 0 || period.SpentQuota > common.MaxWalletQuota || period.PendingQuota > common.MaxWalletQuota {
		return ErrInvalidDailyQuota
	}
	period.Balance = int(after)
	if err := tx.Save(period).Error; err != nil {
		return err
	}
	if active {
		return tx.Model(&User{}).Where("id = ?", user.Id).Update("quota", period.Balance).Error
	}
	return nil
}

func ReserveDailyWalletRequest(userID int, requestID string, periodID int64, targetQuota int, requireAvailable bool) error {
	_, err := ReserveDailyWalletRequestWithResult(userID, requestID, periodID, targetQuota, requireAvailable)
	return err
}

func ReserveDailyWalletRequestWithResult(userID int, requestID string, periodID int64, targetQuota int, requireAvailable bool) (bool, error) {
	if requestID == "" || len(requestID) > 128 || targetQuota < 0 || targetQuota > common.MaxWalletQuota {
		return false, ErrInvalidDailyQuota
	}
	changed := false
	err := dailyWalletTransaction(func(tx *gorm.DB) error {
		changed = false
		user, period, active, err := currentDailyWalletTx(tx, userID, periodID)
		if err != nil {
			return err
		}
		var request DailyWalletRequest
		err = tx.First(&request, "request_id = ?", requestID).Error
		created := errors.Is(err, gorm.ErrRecordNotFound)
		if created {
			request = DailyWalletRequest{RequestID: requestID, UserID: userID, PeriodID: periodID, State: "pending"}
		} else if err != nil {
			return err
		}
		if request.UserID != userID || request.PeriodID != periodID || request.State != "pending" {
			return ErrDailyWalletConflict
		}
		delta := targetQuota - request.Quota
		if !created && delta == 0 {
			return nil
		}
		if requireAvailable && delta > 0 && period.Balance < delta {
			return ErrDailyWalletInsufficient
		}
		period.PendingQuota += delta
		if err = saveDailyWalletChargeTx(tx, user, period, active, delta); err != nil {
			return err
		}
		request.Quota = targetQuota
		if err = tx.Save(&request).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	if err == nil {
		_ = invalidateUserCache(userID)
	}
	return changed, err
}

func SettleDailyWalletRequest(userID int, requestID string, periodID int64, actualQuota int) (bool, error) {
	return adjustDailyWalletRequest(userID, requestID, periodID, -1, actualQuota, false)
}

func AdjustDailyWalletRequest(userID int, requestID string, periodID int64, fromQuota, toQuota int, refunded bool) (bool, error) {
	return adjustDailyWalletRequest(userID, requestID, periodID, fromQuota, toQuota, refunded)
}

func adjustDailyWalletRequest(userID int, requestID string, periodID int64, fromQuota, toQuota int, refunded bool) (bool, error) {
	if requestID == "" || len(requestID) > 128 || toQuota < 0 || toQuota > common.MaxWalletQuota || (refunded && toQuota != 0) {
		return false, ErrInvalidDailyQuota
	}
	changed := false
	err := dailyWalletTransaction(func(tx *gorm.DB) error {
		changed = false
		user, period, active, err := currentDailyWalletTx(tx, userID, periodID)
		if err != nil {
			return err
		}
		var request DailyWalletRequest
		err = tx.First(&request, "request_id = ?", requestID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			request = DailyWalletRequest{RequestID: requestID, UserID: userID, PeriodID: periodID, State: "pending"}
		} else if err != nil {
			return err
		}
		if request.UserID != userID || request.PeriodID != periodID {
			return ErrDailyWalletConflict
		}
		if request.State == "refunded" {
			return nil
		}
		if request.State == "settled" && request.Quota == toQuota && !refunded {
			return nil
		}
		if fromQuota < 0 && request.State == "settled" {
			return ErrDailyWalletConflict
		}
		if fromQuota >= 0 && request.Quota != fromQuota {
			return ErrDailyWalletConflict
		}
		if request.State == "pending" {
			period.PendingQuota -= request.Quota
		} else {
			period.SpentQuota -= request.Quota
		}
		if !refunded {
			period.SpentQuota += toQuota
		}
		if err = saveDailyWalletChargeTx(tx, user, period, active, toQuota-request.Quota); err != nil {
			return err
		}
		request.Quota = toQuota
		request.State = "settled"
		if refunded {
			request.State = "refunded"
		}
		if err = tx.Save(&request).Error; err != nil {
			return err
		}
		changed = true
		return nil
	})
	if err == nil && changed {
		_ = invalidateUserCache(userID)
	}
	return changed, err
}

func MaintainDailyWallets(batchSize int) (int, error) {
	if batchSize <= 0 {
		batchSize = 300
	}
	date := time.Now().In(dailyWalletLocation).Format("2006-01-02")
	userTable := DB.NamingStrategy.TableName("User")
	policyTable := DB.NamingStrategy.TableName("DailyQuotaPolicy")
	overrideTable := DB.NamingStrategy.TableName("DailyQuotaOverride")
	periodTable := DB.NamingStrategy.TableName("DailyWalletPeriod")
	var users []User
	if err := DB.Model(&User{}).Table(userTable+" AS u").Select("u.id").
		Joins("JOIN "+policyTable+" p ON p.group_name = u."+commonGroupCol).
		Joins("LEFT JOIN "+overrideTable+" o ON o.user_id = u.id").
		Joins("LEFT JOIN "+periodTable+" d ON d.user_id = u.id AND d.business_date = ?", date).
		Where("d.id IS NULL OR d.applied_limit <> COALESCE(o.quota,p.daily_quota)").
		Order("u.id asc").Limit(batchSize).Find(&users).Error; err != nil {
		return 0, err
	}
	count := 0
	for _, user := range users {
		if _, err := EnsureDailyWallet(user.Id); err != nil {
			return count, fmt.Errorf("daily wallet user %d: %w", user.Id, err)
		}
		count++
	}
	return count, nil
}

// applyManagedWalletDelta keeps generic credits and legacy debits synchronous
// for managed users. Period-bound requests use the request ledger instead.
func applyManagedWalletDelta(userID, delta int, requireAvailable bool) (bool, error) {
	snapshot, err := EnsureDailyWallet(userID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if snapshot == nil {
		var user User
		if err = DB.Select("daily_wallet_managed").First(&user, userID).Error; err != nil {
			return false, err
		}
		if !user.DailyWalletManaged {
			return false, nil
		}
	}
	err = dailyWalletTransaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		current, err := ensureDailyWalletTx(tx, &user, time.Now(), 0)
		if err != nil {
			return err
		}
		periodID := int64(0)
		if current != nil {
			periodID = current.PeriodID
		} else {
			var latest DailyWalletPeriod
			if err = tx.Where("user_id = ?", userID).Order("business_date desc").First(&latest).Error; err != nil {
				return err
			}
			periodID = latest.ID
		}
		if requireAvailable && delta < 0 && user.Quota < -delta {
			return ErrDailyWalletInsufficient
		}
		after := int64(user.Quota) + int64(delta)
		if after > common.MaxWalletQuota || after < -common.MaxWalletQuota {
			return ErrWalletQuotaLimitExceeded
		}
		if err = tx.Model(&User{}).Where("id = ?", userID).Update("quota", int(after)).Error; err != nil {
			return err
		}
		return tx.Model(&DailyWalletPeriod{}).Where("id = ?", periodID).Update("balance", int(after)).Error
	})
	if err == nil {
		_ = invalidateUserCache(userID)
	}
	return true, err
}
