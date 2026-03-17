package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/radassist/backend/internal/repository/memory"
)

func TestParseAccessTokenRejectsUnexpectedAlgorithm(t *testing.T) {
	repos := memory.NewRepositories()
	service := NewService(repos, "test-secret", time.Minute, time.Hour)

	token := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub":      "user-1",
		"email":    "admin@radassist.local",
		"fullName": "Admin",
		"role":     "admin",
		"iat":      time.Now().Unix(),
		"exp":      time.Now().Add(time.Minute).Unix(),
	})
	raw, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	if _, err := service.ParseAccessToken(raw); err == nil {
		t.Fatal("expected token with unexpected signing method to be rejected")
	}
}
