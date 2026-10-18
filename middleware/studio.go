package middleware

import (
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"net/http"
)

func StudioEnabled(module string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !operation_setting.StudioEnabled(module) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "message": "This studio is disabled by the administrator"})
			return
		}
		c.Next()
	}
}
