package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/repository/memory"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	"github.com/radassist/backend/internal/service/knowledge"
	"go.uber.org/zap"
	gohttp "net/http"
)

func testRouter() http.Handler {
	cfg := config.Config{
		JWTSecret:         "test-secret",
		AccessTTLMinutes:  15,
		RefreshTTLHours:   48,
		RateLimitPerMin:   1000,
		StorageBaseURL:    "http://localhost:9000",
		StorageBucketName: "radassist-files",
		AIGatewayURL:      "http://localhost:8090",
		CORSAllowedOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		},
		CookieSecure:   false,
		CookieSameSite: gohttp.SameSiteLaxMode,
	}

	repos := memory.NewRepositories()
	authService := auth.NewService(repos, cfg.JWTSecret, 15*time.Minute, 48*time.Hour)
	dataService := data.NewService(repos)
	aiService := ai.NewService(cfg.AIGatewayURL, "", &http.Client{Timeout: time.Second}, repos.Audit)
	knowledgeService := knowledge.NewService(repos.UploadedTemplates, repos.Knowledge, aiService, zap.NewNop(), 0)

	logger := zap.NewNop()
	return NewRouter(cfg, authService, dataService, aiService, knowledgeService, logger)
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

	cookieHeader := loginRes.Header().Get("Set-Cookie")
	if !strings.Contains(cookieHeader, "HttpOnly") {
		t.Fatalf("expected refresh cookie to be HttpOnly, got %q", cookieHeader)
	}
	if !strings.Contains(cookieHeader, "SameSite=Lax") {
		t.Fatalf("expected refresh cookie SameSite=Lax, got %q", cookieHeader)
	}
	if strings.Contains(cookieHeader, "Secure") {
		t.Fatalf("did not expect Secure flag in local test cookie, got %q", cookieHeader)
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

func TestCORSAllowsConfiguredOrigin(t *testing.T) {
	router := testRouter()
	req := httptest.NewRequest(http.MethodOptions, "/auth/login", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, res.Code)
	}
	if got := res.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("expected allow origin header to be set, got %q", got)
	}
	if got := res.Header().Values("Vary"); len(got) == 0 || got[0] != "Origin" {
		t.Fatalf("expected Vary: Origin header, got %v", got)
	}
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	router := testRouter()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Origin", "http://evil.example")
	res := httptest.NewRecorder()

	router.ServeHTTP(res, req)

	if res.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, res.Code)
	}
}
