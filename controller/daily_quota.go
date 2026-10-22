package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetDailyQuotaPolicies(c *gin.Context) {
	policies, err := model.ListDailyQuotaPolicies()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if policies == nil {
		policies = []model.DailyQuotaPolicy{}
	}
	common.ApiSuccess(c, policies)
}

func UpdateDailyQuotaPolicy(c *gin.Context) {
	var request struct {
		DailyQuota *int `json:"daily_quota"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.DailyQuota == nil || *request.DailyQuota < 0 || *request.DailyQuota > common.MaxWalletQuota {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	group := c.Param("group")
	if err := model.UpdateDailyQuotaPolicy(group, *request.DailyQuota, c.GetInt("id")); err != nil {
		if errors.Is(err, model.ErrInvalidDailyQuota) {
			common.ApiErrorT(c, "Invalid parameters")
		} else {
			common.ApiError(c, err)
		}
		return
	}
	recordManageAudit(c, "option.update", map[string]any{
		"key":         "DailyQuotaPolicy",
		"group":       group,
		"daily_quota": *request.DailyQuota,
	})
	common.ApiSuccess(c, nil)
}
