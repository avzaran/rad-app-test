package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
)

type Service struct {
	users          repository.UserRepository
	audit          repository.AuditRepository
	jwtSecret      []byte
	accessTTL      time.Duration
	refreshTTL     time.Duration
	refreshStorage map[string]refreshToken
}

type refreshToken struct {
	UserID    string
	ExpiresAt time.Time
}

type LoginResult struct {
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken"`
	User         domain.User `json:"user"`
}

func NewService(repos repository.Repositories, jwtSecret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		users:          repos.Users,
		audit:          repos.Audit,
		jwtSecret:      []byte(jwtSecret),
		accessTTL:      accessTTL,
		refreshTTL:     refreshTTL,
		refreshStorage: map[string]refreshToken{},
	}
}

func (s *Service) Login(email, password string) (*LoginResult, error) {
	user, err := s.users.FindByEmail(email)
	if err != nil {
		return nil, errors.New("invalid credentials")
	}

	if user.PasswordHash != password {
		_ = s.audit.Add(domain.AuditEvent{UserID: user.ID, Action: "login_failed"})
		return nil, errors.New("invalid credentials")
	}

	accessToken, err := s.newAccessToken(*user)
	if err != nil {
		return nil, err
	}

	refresh := uuid.NewString()
	s.refreshStorage[refresh] = refreshToken{
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}

	_ = s.audit.Add(domain.AuditEvent{UserID: user.ID, Action: "login_success"})

	return &LoginResult{
		AccessToken:  accessToken,
		RefreshToken: refresh,
		User:         *user,
	}, nil
}

func (s *Service) Refresh(token string) (string, string, error) {
	stored, ok := s.refreshStorage[token]
	if !ok || time.Now().After(stored.ExpiresAt) {
		return "", "", errors.New("refresh token expired")
	}

	user, err := s.users.FindByID(stored.UserID)
	if err != nil {
		return "", "", errors.New("refresh token invalid")
	}

	accessToken, err := s.newAccessToken(*user)
	if err != nil {
		return "", "", err
	}

	delete(s.refreshStorage, token)
	rotatedRefresh := uuid.NewString()
	s.refreshStorage[rotatedRefresh] = refreshToken{
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}

	_ = s.audit.Add(domain.AuditEvent{UserID: user.ID, Action: "token_refresh"})

	return accessToken, rotatedRefresh, nil
}

func (s *Service) Verify2FA(userID, code string) bool {
	if code == "" {
		return false
	}
	_ = s.audit.Add(domain.AuditEvent{UserID: userID, Action: "2fa_verify"})
	return true
}

func (s *Service) Logout(refreshToken string) {
	delete(s.refreshStorage, refreshToken)
}

func (s *Service) ParseAccessToken(accessToken string) (*domain.User, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(
		accessToken,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
			}
			return s.jwtSecret, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	userID, _ := claims["sub"].(string)
	role, _ := claims["role"].(string)
	email, _ := claims["email"].(string)
	fullName, _ := claims["fullName"].(string)

	if userID == "" || role == "" {
		return nil, errors.New("invalid token claims")
	}

	return &domain.User{
		ID:       userID,
		Email:    email,
		FullName: fullName,
		Role:     domain.Role(role),
	}, nil
}

func (s *Service) Me(userID string) (*domain.User, error) {
	return s.users.FindByID(userID)
}

func (s *Service) newAccessToken(user domain.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      user.ID,
		"email":    user.Email,
		"fullName": user.FullName,
		"role":     string(user.Role),
		"iat":      now.Unix(),
		"exp":      now.Add(s.accessTTL).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
