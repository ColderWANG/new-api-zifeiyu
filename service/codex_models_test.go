package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCodexVersionLookupFallsBackToDirectWhenProxyIsForbidden(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls == 1 {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"0.163.0"}`))
	}))
	t.Cleanup(server.Close)

	cache := &codexClientVersionCache{}
	version, err := cache.getWithFallback(
		context.Background(), server.Client(), server.Client(), server.URL, time.Now(),
	)
	require.NoError(t, err)
	require.Equal(t, "0.163.0", version)
	require.Equal(t, 2, calls)

	version, err = cache.getWithFallback(
		context.Background(), server.Client(), server.Client(), server.URL, time.Now(),
	)
	require.NoError(t, err)
	require.Equal(t, "0.163.0", version)
	require.Equal(t, 2, calls)
}
