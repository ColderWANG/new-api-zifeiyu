package operation_setting

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

type StudioSetting struct {
	ImageStudioEnabled       bool `json:"image_studio_enabled"`
	TranslationStudioEnabled bool `json:"translation_studio_enabled"`
}

var studioSetting = StudioSetting{ImageStudioEnabled: true, TranslationStudioEnabled: true}

func init() { config.GlobalConfig.Register("studio_setting", &studioSetting) }

// Read the published option snapshot under the same lock used by option updates.
func StudioEnabled(module string) bool {
	if module != "image_studio" && module != "translation_studio" {
		return false
	}
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	value, exists := common.OptionMap["studio_setting."+module+"_enabled"]
	return !exists || value == "true"
}
