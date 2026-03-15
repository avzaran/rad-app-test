package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/repository/memory"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	"go.uber.org/zap"
)

func testRouter() http.Handler {
	cfg := config.Config{
		JWTSecret:         "test-secret",
		AccessTTLMinutes:  15,
		RefreshTTLHours:   48,
		RateLimitPerMin:   1000,
		StorageBaseURL:    "http://localhost:9000",
		StorageBucketName: "radassist-files",
	}

	repos := memory.NewRepositories()
	authService := auth.NewService(repos, cfg.JWTSecret, 15*time.Minute, 48*time.Hour)
	dataService := data.NewService(repos)

	logger := zap.NewNop()
	return NewRouter(cfg, authService, dataService, logger)
}

func TestHealthz(t *testing.T) {
	router := testRouter()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestLoginAndMe(t *testing.T) {
	router := testRouter()

	payload := map[string]string{"email": "admin@radassist.local", "password": "admin123"}
	body, _ := json.Marshal(payload)

	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(body))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRes := httptest.NewRecorder()
	router.ServeHTTP(loginRes, loginReq)

	if loginRes.Code != http.StatusOK {
		t.Fatalf("expected login status %d, got %d", http.StatusOK, loginRes.Code)
	}

	var loginData map[string]any
	_ = json.Unmarshal(loginRes.Body.Bytes(), &loginData)

	token, ok := loginData["accessToken"].(string)
	if !ok || token == "" {
		t.Fatalf("expected access token in login response")
	}

	meReq := httptest.NewRequest(http.MethodGet, "/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+token)
	meRes := httptest.NewRecorder()
	router.ServeHTTP(meRes, meReq)

	if meRes.Code != http.StatusOK {
		t.Fatalf("expected /me status %d, got %d", http.StatusOK, meRes.Code)
	}
}
