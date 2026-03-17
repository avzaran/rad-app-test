package server

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/radassist/ai-gateway/internal/provider"
	"github.com/radassist/ai-gateway/internal/resilience"
	"go.uber.org/zap"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	return New(provider.NewMockProvider(), Config{
		Timeout:        time.Second,
		Retries:        0,
		RetryBackoff:   0,
		CircuitBreaker: resilience.NewCircuitBreaker(5, time.Second),
		SharedSecret:   "shared-secret",
	}, zap.NewNop())
}

func TestHealthzDoesNotRequireSharedSecret(t *testing.T) {
	router := testServer(t).Router()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestInferenceRequiresSharedSecret(t *testing.T) {
	router := testServer(t).Router()
	req := httptest.NewRequest(http.MethodPost, "/v1/inference", bytes.NewBufferString(`{"messages":[],"temperature":0,"maxTokens":1}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, res.Code)
	}
}

func TestInferenceAcceptsValidSharedSecret(t *testing.T) {
	router := testServer(t).Router()
	req := httptest.NewRequest(http.MethodPost, "/v1/inference", bytes.NewBufferString(`{"messages":[{"role":"user","content":"hello"}],"temperature":0,"maxTokens":1}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(GatewayAuthHeader, "shared-secret")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d; body=%s", http.StatusOK, res.Code, res.Body.String())
	}
}
