package service

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const dailyWalletResetBatchSize = 300

var dailyWalletResetOnce sync.Once
var dailyWalletResetRunning atomic.Bool

// StartDailyWalletResetTask catches up at startup and after midnight or downtime.
// Model reads also enforce the current period, so scheduler latency never extends a day.
func StartDailyWalletResetTask() {
	if !common.IsMasterNode {
		return
	}
	dailyWalletResetOnce.Do(func() {
		gopool.Go(func() {
			ticker := time.NewTicker(time.Minute)
			defer ticker.Stop()
			runDailyWalletResetOnce()
			for range ticker.C {
				runDailyWalletResetOnce()
			}
		})
	})
}

func runDailyWalletResetOnce() {
	if !dailyWalletResetRunning.CompareAndSwap(false, true) {
		return
	}
	defer dailyWalletResetRunning.Store(false)
	for {
		n, err := model.MaintainDailyWallets(dailyWalletResetBatchSize)
		if err != nil {
			logger.LogWarn(context.Background(), common.LogText("daily wallet maintenance failed: %v", err))
			return
		}
		if n < dailyWalletResetBatchSize {
			return
		}
	}
}
