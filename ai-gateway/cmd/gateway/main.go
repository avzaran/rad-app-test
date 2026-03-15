package main

import (
	"fmt"
	"time"

	"github.com/radassist/ai-gateway/internal/config"
	"github.com/radassist/ai-gateway/internal/provider"
	"github.com/radassist/ai-gateway/internal/resilience"
	"github.com/radassist/ai-gateway/internal/server"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	service := server.New(
		provider.NewMockProvider(),
		server.Config{
			Timeout:        time.Duration(cfg.RequestTimeoutMs) * time.Millisecond,
			Retries:        cfg.RetryCount,
			RetryBackoff:   time.Duration(cfg.RetryBackoffMs) * time.Millisecond,
			CircuitBreaker: resilience.NewCircuitBreaker(cfg.CircuitThreshold, time.Duration(cfg.CircuitCooldownS)*time.Second),
		},
		logger,
	)

	router := service.Router()
	if err := router.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		logger.Fatal("failed to start ai-gateway", zap.Error(err))
	}
}
