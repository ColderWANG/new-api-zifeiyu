package codex

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseOAuthKeyAcceptsCodexAuthJSON(t *testing.T) {
	const raw = `{"auth_mode":"chatgpt","OPENAI_API_KEY":null,"tokens":{"id_token":"id","access_token":"access","refresh_token":"refresh","account_id":"account"},"last_refresh":"2026-10-21T00:00:00Z"}`

	key, err := ParseOAuthKey(raw)
	require.NoError(t, err)
	require.Equal(t, "access", key.AccessToken)
	require.Equal(t, "refresh", key.RefreshToken)
	require.Equal(t, "account", key.AccountID)
	require.Equal(t, "2026-10-21T00:00:00Z", key.LastRefresh)
}

func TestParseOAuthKeyKeepsFlatCredential(t *testing.T) {
	key, err := ParseOAuthKey(`{"access_token":"access","refresh_token":"refresh","account_id":"account"}`)
	require.NoError(t, err)
	require.Equal(t, "access", key.AccessToken)
	require.Equal(t, "account", key.AccountID)
}

func TestParseOAuthKeyRejectsMalformedNestedCredential(t *testing.T) {
	_, err := ParseOAuthKey(`{"tokens":"secret-value"}`)
	require.EqualError(t, err, "codex channel: invalid oauth key json")
}
