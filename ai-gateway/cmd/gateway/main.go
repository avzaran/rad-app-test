package main

import (
	"fmt"
	"net/http"
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

	p := buildProvider(cfg, logger)

	service := server.New(
		p,
		server.Config{
			Timeout:        time.Duration(cfg.RequestTimeoutMs) * time.Millisecond,
			Retries:        cfg.RetryCount,
			RetryBackoff:   time.Duration(cfg.RetryBackoffMs) * time.Millisecond,
			CircuitBreaker: resilience.NewCircuitBreaker(cfg.CircuitThreshold, time.Duration(cfg.CircuitCooldownS)*time.Second),
		},
		logger,
	)

	router := service.Router()
	logger.Info("starting ai-gateway", zap.String("port", cfg.Port), zap.String("provider", cfg.ProviderMode))
	if err := router.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		logger.Fatal("failed to start ai-gateway", zap.Error(err))
	}
}

func buildProvider(cfg config.Config, logger *zap.Logger) provider.Provider {
	switch cfg.ProviderMode {
	case "openai":
		logger.Info("using OpenAI-compatible provider",
			zap.String("base_url", cfg.LLMBaseURL),
			zap.String("model", cfg.LLMModel),
		)
		return provider.NewOpenAIProvider(
			cfg.LLMBaseURL,
			cfg.LLMAPIKey,
			cfg.LLMModel,
			&http.Client{Timeout: 120 * time.Second},
		)
	default:
		logger.Info("using mock provider")
		return provider.NewMockProvider()
	}
}
