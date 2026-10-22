package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestParseCodexOAuthKeyAcceptsCodexAuthJSON(t *testing.T) {
	const raw = `{"auth_mode":"chatgpt","OPENAI_API_KEY":null,"tokens":{"id_token":"id","access_token":"access","refresh_token":"refresh","account_id":"account"},"last_refresh":"2026-10-21T00:00:00Z"}`

	key, err := parseCodexOAuthKey(raw)
	require.NoError(t, err)
	require.Equal(t, "access", key.AccessToken)
	require.Equal(t, "refresh", key.RefreshToken)
	require.Equal(t, "account", key.AccountID)
	require.Equal(t, "2026-10-21T00:00:00Z", key.LastRefresh)
}

func TestParseCodexOAuthKeyKeepsFlatCredential(t *testing.T) {
	key, err := parseCodexOAuthKey(`{"access_token":"access","refresh_token":"refresh","account_id":"account"}`)
	require.NoError(t, err)
	require.Equal(t, "access", key.AccessToken)
	require.Equal(t, "account", key.AccountID)
}

func TestParseCodexOAuthKeyRejectsMalformedNestedCredential(t *testing.T) {
	_, err := parseCodexOAuthKey(`{"tokens":"secret-value"}`)
	require.EqualError(t, err, "codex channel: invalid oauth key json")
}

func TestFetchCodexChannelModelsWithCodexAuthJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/backend-api/codex/models", r.URL.Path)
		require.Equal(t, "Bearer access", r.Header.Get("Authorization"))
		require.Equal(t, "account", r.Header.Get("ChatGPT-Account-Id"))
		_, _ = w.Write([]byte(`{"models":[{"slug":"gpt-5"}]}`))
	}))
	defer server.Close()

	channel := &model.Channel{Key: `{"tokens":{"access_token":"access","account_id":"account"}}`}
	models, err := fetchCodexChannelModels(context.Background(), channel, server.URL, server.Client(), "0.1.0")
	require.NoError(t, err)
	require.Equal(t, []string{"gpt-5"}, models)
}
