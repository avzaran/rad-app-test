package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/radassist/ai-gateway/internal/provider"
	"github.com/radassist/ai-gateway/internal/resilience"
	"go.uber.org/zap"
)

type Config struct {
	Timeout        time.Duration
	Retries        int
	RetryBackoff   time.Duration
	CircuitBreaker *resilience.CircuitBreaker
}

type Server struct {
	provider provider.Provider
	config   Config
	logger   *zap.Logger
}

func New(provider provider.Provider, config Config, logger *zap.Logger) *Server {
	return &Server{
		provider: provider,
		config:   config,
		logger:   logger,
	}
}

func (s *Server) Router() *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.POST("/v1/inference", s.inference)

	return r
}

func (s *Server) inference(c *gin.Context) {
	var req provider.Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.config.CircuitBreaker.Allow(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "circuit breaker open"})
		return
	}

	var lastErr error
	for attempt := 0; attempt <= s.config.Retries; attempt++ {
		ctx, cancel := context.WithTimeout(c.Request.Context(), s.config.Timeout)
		resp, err := s.provider.Generate(ctx, req)
		cancel()

		if err == nil {
			s.config.CircuitBreaker.Success()
			c.JSON(http.StatusOK, resp)
			return
		}

		lastErr = err
		s.config.CircuitBreaker.Failure()
		time.Sleep(s.config.RetryBackoff * time.Duration(attempt+1))
	}

	s.logger.Warn("inference failed", zap.Error(lastErr))
	c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("provider failed: %v", lastErr)})
}
