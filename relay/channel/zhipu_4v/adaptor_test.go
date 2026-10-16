package zhipu_4v

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Exercise the native adaptor's conversion, URL, headers, and HTTP transport.
// GLM-5.3 always thinks; low effort keeps this reproduction inexpensive.
func requestGLM53(t *testing.T, baseURL, apiKey string, format types.RelayFormat, stream bool) (*http.Response, *gin.Context) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	service.GetHttpClient().Timeout = 60 * time.Second
	t.Cleanup(service.GetHttpClient().CloseIdleConnections)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	path := "/v1/chat/completions"
	if format == types.RelayFormatClaude {
		path = "/v1/messages"
	}
	c.Request = httptest.NewRequest(http.MethodPost, path, nil)
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeChatCompletions,
		RelayFormat: format,
		IsStream:    stream,
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeZhipu_v4,
			ChannelBaseUrl:    baseURL,
			ApiKey:            apiKey,
			UpstreamModelName: "glm-5.3",
		},
	}
	adaptor := &Adaptor{}
	adaptor.Init(info)
	var converted any
	var err error
	if format == types.RelayFormatClaude {
		request := &dto.ClaudeRequest{
			Model:     "glm-5.3",
			Messages:  []dto.ClaudeMessage{{Role: "user", Content: "Reply with OK only."}},
			Stream:    common.GetPointer(stream),
			MaxTokens: common.GetPointer[uint](256),
		}
		converted, err = adaptor.ConvertClaudeRequest(c, info, request)
	} else {
		request := &dto.GeneralOpenAIRequest{
			Model:           "glm-5.3",
			Messages:        []dto.Message{{Role: "user", Content: "Reply with OK only."}},
			Stream:          common.GetPointer(stream),
			MaxTokens:       common.GetPointer[uint](128),
			ReasoningEffort: "low",
		}
		converted, err = adaptor.ConvertOpenAIRequest(c, info, request)
	}
	require.NoError(t, err)
	body, err := common.Marshal(converted)
	require.NoError(t, err)
	result, err := adaptor.DoRequest(c, info, bytes.NewReader(body))
	require.NoError(t, err)
	response, ok := result.(*http.Response)
	require.True(t, ok)
	t.Cleanup(func() { _ = response.Body.Close() })
	return response, c
}

func TestGLM53InsufficientBalance(t *testing.T) {
	// Recorded upstream HTTP 429 / 1113 response; it is a balance error,
	// even though HTTP 429 is also used for rate limits.
	const upstreamBody = `{"error":{"code":"1113","message":"\u4f59\u989d\u4e0d\u8db3\u6216\u65e0\u53ef\u7528\u8d44\u6e90\u5305,\u8bf7\u5145\u503c\u3002"}}`
	const upstreamMessage = "\u4f59\u989d\u4e0d\u8db3\u6216\u65e0\u53ef\u7528\u8d44\u6e90\u5305,\u8bf7\u5145\u503c\u3002"

	for _, stream := range []bool{false, true} {
		name := "non_stream"
		if stream {
			name = "stream"
		}
		t.Run(name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, "/api/paas/v4/chat/completions", r.URL.Path)
				assert.Equal(t, "Bearer test-zhipu-key", r.Header.Get("Authorization"))
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
				if stream {
					assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))
				}
				var request dto.GeneralOpenAIRequest
				if assert.NoError(t, common.DecodeJson(r.Body, &request)) {
					assert.Equal(t, "glm-5.3", request.Model)
					assert.Equal(t, common.GetPointer(stream), request.Stream)
					assert.Equal(t, common.GetPointer[uint](128), request.MaxTokens)
					assert.Equal(t, "low", request.ReasoningEffort)
					assert.Empty(t, request.THINKING)
					assert.Equal(t, []dto.Message{{Role: "user", Content: "Reply with OK only."}}, request.Messages)
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = io.WriteString(w, upstreamBody)
			}))
			t.Cleanup(upstream.Close)

			response, c := requestGLM53(t, upstream.URL, "test-zhipu-key", types.RelayFormatOpenAI, stream)
			require.Equal(t, http.StatusTooManyRequests, response.StatusCode)
			// The relay handles unsuccessful statuses before calling DoResponse,
			// including JSON errors returned for a streaming request.
			apiError := service.RelayErrorHandler(c.Request.Context(), response, false)
			require.NotNil(t, apiError)
			assert.Equal(t, http.StatusTooManyRequests, apiError.StatusCode)
			assert.Equal(t, "1113", string(apiError.GetErrorCode()))
			assert.Equal(t, upstreamMessage, apiError.Error())
		})
	}
}

func TestGLM53EndpointSelection(t *testing.T) {
	for _, tc := range []struct {
		name    string
		baseURL string
		format  types.RelayFormat
		wantURL string
	}{
		{"default_chat", "", types.RelayFormatOpenAI, "https://open.bigmodel.cn/api/paas/v4/chat/completions"},
		{"coding_chat", "glm-coding-plan", types.RelayFormatOpenAI, "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions"},
		{"default_anthropic", "", types.RelayFormatClaude, "https://open.bigmodel.cn/api/anthropic/v1/messages"},
		{"coding_anthropic", "glm-coding-plan", types.RelayFormatClaude, "https://open.bigmodel.cn/api/anthropic/v1/messages"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayMode:   relayconstant.RelayModeChatCompletions,
				RelayFormat: tc.format,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: tc.baseURL, UpstreamModelName: "glm-5.3"},
			}
			url, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tc.wantURL, url)
		})
	}
}

func TestGLM53AnthropicRequest(t *testing.T) {
	const upstreamBody = `{"id":"msg_test","type":"message","role":"assistant","model":"glm-5.3","content":[{"type":"text","text":"OK"}],"stop_reason":"end_turn","usage":{"input_tokens":17,"output_tokens":50}}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/anthropic/v1/messages", r.URL.Path)
		assert.Equal(t, "Bearer test-zhipu-key", r.Header.Get("Authorization"))
		var request dto.ClaudeRequest
		if assert.NoError(t, common.DecodeJson(r.Body, &request)) {
			assert.Equal(t, "glm-5.3", request.Model)
			assert.Equal(t, common.GetPointer[uint](256), request.MaxTokens)
			assert.Equal(t, []dto.ClaudeMessage{{Role: "user", Content: "Reply with OK only."}}, request.Messages)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, upstreamBody)
	}))
	t.Cleanup(upstream.Close)
	response, _ := requestGLM53(t, upstream.URL, "test-zhipu-key", types.RelayFormatClaude, false)
	require.Equal(t, http.StatusOK, response.StatusCode)
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	assert.JSONEq(t, upstreamBody, string(body))
}

type zhipuTestTransport func(*http.Request) (*http.Response, error)

func (transport zhipuTestTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestGLM53CodingEndpointFallback(t *testing.T) {
	const balanceError = `{"error":{"code":"1113","message":"Insufficient balance or no available resource package"}}`
	const completion = `{"choices":[{"message":{"role":"assistant","content":"OK"}}],"usage":{"prompt_tokens":17,"completion_tokens":50,"total_tokens":67}}`
	for _, tc := range []struct {
		name        string
		baseURL     string
		status      int
		body        string
		retryStatus int
		stream      bool
		noReplay    bool
		replayError bool
		retryError  bool
		wantCalls   int
	}{
		{name: "coding_key", status: 429, body: balanceError, retryStatus: 200, wantCalls: 2},
		{name: "coding_key_stream", status: 429, body: balanceError, retryStatus: 200, stream: true, wantCalls: 2},
		{name: "explicit_official_host", baseURL: "https://open.bigmodel.cn", status: 429, body: balanceError, retryStatus: 200, wantCalls: 2},
		{name: "standard_key", status: 200, body: completion, wantCalls: 1},
		{name: "rate_limit", status: 429, body: `{"error":{"code":"1302","message":"Rate limit exceeded"}}`, wantCalls: 1},
		{name: "invalid_key", status: 401, body: `{"error":{"code":"1000","message":"Invalid key"}}`, wantCalls: 1},
		{name: "invalid_json", status: 429, body: "upstream unavailable", wantCalls: 1},
		{name: "oversized_error", status: 429, body: strings.Repeat("x", 70<<10), wantCalls: 1},
		{name: "custom_host", baseURL: "https://custom.example", status: 429, body: balanceError, wantCalls: 1},
		{name: "explicit_plan", baseURL: "glm-coding-plan", status: 429, body: balanceError, wantCalls: 1},
		{name: "unreplayable_request", status: 429, body: balanceError, noReplay: true, wantCalls: 1},
		{name: "replay_error", status: 429, body: balanceError, replayError: true, wantCalls: 1},
		{name: "both_endpoints_reject", status: 429, body: balanceError, retryStatus: 429, wantCalls: 2},
		{name: "coding_unavailable", status: 429, body: balanceError, retryError: true, wantCalls: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			service.InitHttpClient()
			client := service.GetHttpClient()
			originalTransport := client.Transport
			t.Cleanup(func() { client.Transport = originalTransport })
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(t.Context())
			c.Request.Header.Set("Content-Type", "application/json")
			info := &relaycommon.RelayInfo{
				RelayMode:   relayconstant.RelayModeChatCompletions,
				RelayFormat: types.RelayFormatOpenAI,
				IsStream:    tc.stream,
				DisablePing: true,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    tc.baseURL,
					ApiKey:            "test-zhipu-key",
					UpstreamModelName: "glm-5.3",
					HeadersOverride:   map[string]any{"X-Trace-Id": "trace-test"},
				},
			}
			payload := []byte(`{"model":"glm-5.3","messages":[{"role":"user","content":"Reply with OK only."}],"max_tokens":128,"reasoning_effort":"low","stream":false}`)
			if tc.stream {
				payload = bytes.Replace(payload, []byte(`"stream":false`), []byte(`"stream":true`), 1)
			}
			body, closer, err := relaycommon.NewOutboundJSONBody(payload)
			require.NoError(t, err)
			t.Cleanup(func() { _ = closer.Close() })
			calls := 0
			retryBody := completion
			if tc.stream {
				retryBody = "data: " + completion + "\n\ndata: [DONE]\n\n"
			}
			client.Transport = zhipuTestTransport(func(request *http.Request) (*http.Response, error) {
				calls++
				wire, readErr := io.ReadAll(request.Body)
				assert.NoError(t, readErr)
				assert.Equal(t, payload, wire, "the retry must preserve every request byte")
				assert.EqualValues(t, len(payload), request.ContentLength)
				assert.Equal(t, "Bearer test-zhipu-key", request.Header.Get("Authorization"))
				assert.Equal(t, "trace-test", request.Header.Get("X-Trace-Id"))
				status, responseBody := tc.status, tc.body
				if calls > 1 {
					assert.Equal(t, "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions", request.URL.String())
					assert.Equal(t, c.Request.Context(), request.Context())
					if tc.retryError {
						return nil, errors.New("coding endpoint unavailable")
					}
					status, responseBody = tc.retryStatus, retryBody
				}
				if tc.noReplay {
					request.GetBody = nil
				}
				if tc.replayError {
					request.GetBody = func() (io.ReadCloser, error) {
						return nil, errors.New("body storage closed")
					}
				}
				return &http.Response{
					StatusCode: status,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader(responseBody)),
					Request:    request,
				}, nil
			})
			result, err := (&Adaptor{}).DoRequest(c, info, body)
			require.NoError(t, err)
			response, ok := result.(*http.Response)
			require.True(t, ok)
			defer response.Body.Close()
			gotBody, err := io.ReadAll(response.Body)
			require.NoError(t, err)
			assert.Equal(t, tc.wantCalls, calls)
			wantStatus, wantBody := tc.status, tc.body
			if tc.retryStatus == http.StatusOK {
				wantStatus, wantBody = http.StatusOK, retryBody
			}
			assert.Equal(t, wantStatus, response.StatusCode)
			assert.Equal(t, wantBody, string(gotBody), "preserve either the successful generation or the original error")
			assert.Equal(t, tc.baseURL, info.ChannelBaseUrl, "fallback must not alter channel configuration")
		})
	}
}

// Opt in with ZHIPU_API_KEY to check the real native channel. No credential is
// stored in fixtures, and ordinary unit tests never call the paid upstream.
func TestGLM53Live(t *testing.T) {
	apiKey := os.Getenv("ZHIPU_API_KEY")
	if apiKey == "" {
		t.Skip("set ZHIPU_API_KEY to run the live native Zhipu request")
	}
	for _, tc := range []struct {
		name    string
		baseURL string
		format  types.RelayFormat
		stream  bool
	}{
		{"default_chat", "", types.RelayFormatOpenAI, false},
		{"default_chat_stream", "", types.RelayFormatOpenAI, true},
		{"coding_chat", "glm-coding-plan", types.RelayFormatOpenAI, false},
		{"anthropic", "", types.RelayFormatClaude, false},
		{"anthropic_stream", "", types.RelayFormatClaude, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response, c := requestGLM53(t, tc.baseURL, apiKey, tc.format, tc.stream)
			if response.StatusCode != http.StatusOK {
				apiError := service.RelayErrorHandler(c.Request.Context(), response, false)
				t.Fatalf("native Zhipu: HTTP %d, code=%s, message=%s", response.StatusCode,
					apiError.GetErrorCode(), strings.ReplaceAll(apiError.Error(), apiKey, "[REDACTED]"))
			}
			if tc.stream {
				body, err := io.ReadAll(response.Body)
				require.NoError(t, err)
				assert.Contains(t, response.Header.Get("Content-Type"), "text/event-stream")
				if tc.format == types.RelayFormatClaude {
					assert.Contains(t, string(body), "event: message_start")
					assert.Contains(t, string(body), "event: message_stop")
					assert.Contains(t, string(body), `"text_delta"`)
				} else {
					assert.Contains(t, string(body), "data: [DONE]")
					assert.Contains(t, string(body), `"chat.completion.chunk"`)
				}
				return
			}
			if tc.format == types.RelayFormatClaude {
				var completion dto.ClaudeResponse
				require.NoError(t, common.DecodeJson(response.Body, &completion))
				assert.Equal(t, "assistant", completion.Role)
				var text strings.Builder
				for _, block := range completion.Content {
					if block.Type == "text" {
						text.WriteString(block.GetText())
					}
				}
				assert.NotEmpty(t, text.String())
				return
			}
			var completion dto.OpenAITextResponse
			require.NoError(t, common.DecodeJson(response.Body, &completion))
			require.NotEmpty(t, completion.Choices)
			assert.Equal(t, "assistant", completion.Choices[0].Message.Role)
			assert.NotEmpty(t, completion.Choices[0].Message.StringContent())
		})
	}
}
