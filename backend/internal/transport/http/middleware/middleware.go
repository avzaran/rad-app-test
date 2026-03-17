package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/service/auth"
	"go.uber.org/zap"
)

const (
	ContextUserKey = "auth-user"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-Id")
		if requestID == "" {
			requestID = uuid.NewString()
		}

		c.Set("request-id", requestID)
		c.Writer.Header().Set("X-Request-Id", requestID)
		c.Next()
	}
}

func Logger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		startedAt := time.Now()
		c.Next()

		requestID, _ := c.Get("request-id")
		logger.Info("http_request",
			zap.String("request_id", toString(requestID)),
			zap.String("method", c.Request.Method),
			zap.String("path", c.FullPath()),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("duration", time.Since(startedAt)),
		)
	}
}

// RateLimit applies per-IP rate limiting with a sliding window.
// Auth endpoints (/auth/*) are excluded from rate limiting so that
// login/refresh flows are never blocked by general API traffic.
func RateLimit(limitPerMinute int) gin.HandlerFunc {
	type client struct {
		count    int
		windowAt time.Time
	}

	clients := map[string]*client{}
	var mu sync.Mutex

	return func(c *gin.Context) {
		// Skip rate limiting for auth endpoints — they must always be reachable
		// to prevent login/refresh deadlocks (429 on refresh → user locked out).
		if strings.HasPrefix(c.FullPath(), "/auth") {
			c.Next()
			return
		}

		ip := c.ClientIP()
		now := time.Now()

		mu.Lock()
		entry, exists := clients[ip]
		if !exists || now.After(entry.windowAt.Add(time.Minute)) {
			entry = &client{count: 0, windowAt: now}
			clients[ip] = entry
		}

		entry.count++
		count := entry.count
		mu.Unlock()

		if count > limitPerMinute {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}

		c.Next()
	}
}

func Auth(authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing access token"})
			return
		}

		user, err := authService.ParseAccessToken(authHeader[7:])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid access token"})
			return
		}

		c.Set(ContextUserKey, user)
		c.Next()
	}
}

func RequireRoles(roles ...domain.Role) gin.HandlerFunc {
	allowed := map[domain.Role]bool{}
	for _, role := range roles {
		allowed[role] = true
	}

	return func(c *gin.Context) {
		userValue, exists := c.Get(ContextUserKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		user, ok := userValue.(*domain.User)
		if !ok || !allowed[user.Role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		c.Next()
	}
}

func CurrentUser(c *gin.Context) *domain.User {
	value, exists := c.Get(ContextUserKey)
	if !exists {
		return nil
	}

	user, ok := value.(*domain.User)
	if !ok {
		return nil
	}

	return user
}

func toString(value any) string {
	if value == nil {
		return ""
	}
	result, ok := value.(string)
	if !ok {
		return ""
	}
	return result
}
