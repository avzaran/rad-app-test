package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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

func New(p provider.Provider, config Config, logger *zap.Logger) *Server {
	return &Server{
		provider: p,
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
	r.POST("/v1/inference/stream", s.inferenceStream)

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

func (s *Server) inferenceStream(c *gin.Context) {
	var req provider.Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.config.CircuitBreaker.Allow(); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "circuit breaker open"})
		return
	}

	// If the provider supports streaming, use it; otherwise fall back to Generate.
	sp, ok := s.provider.(provider.StreamProvider)
	if !ok {
		s.streamFallback(c, req)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), s.config.Timeout*10) // longer timeout for streaming
	defer cancel()

	ch, err := sp.GenerateStream(ctx, req)
	if err != nil {
		s.config.CircuitBreaker.Failure()
		s.logger.Warn("stream start failed", zap.Error(err))
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("provider failed: %v", err)})
		return
	}

	s.writeSSE(c, ch)
	s.config.CircuitBreaker.Success()
}

// streamFallback calls Generate() and sends the result as a single SSE chunk.
func (s *Server) streamFallback(c *gin.Context, req provider.Request) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), s.config.Timeout)
	defer cancel()

	resp, err := s.provider.Generate(ctx, req)
	if err != nil {
		s.config.CircuitBreaker.Failure()
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("provider failed: %v", err)})
		return
	}
	s.config.CircuitBreaker.Success()

	ch := make(chan provider.StreamChunk, 2)
	ch <- provider.StreamChunk{Delta: resp.Output}
	ch <- provider.StreamChunk{Done: true, TokensUsed: resp.TokensUsed}
	close(ch)

	s.writeSSE(c, ch)
}

func (s *Server) writeSSE(c *gin.Context, ch <-chan provider.StreamChunk) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	c.Stream(func(w io.Writer) bool {
		chunk, ok := <-ch
		if !ok {
			return false
		}

		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		return !chunk.Done
	})
}
