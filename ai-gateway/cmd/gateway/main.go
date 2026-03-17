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
	httpClient := &http.Client{Timeout: 120 * time.Second}

	switch cfg.ProviderMode {
	case "openai":
		logger.Info("using OpenAI provider",
			zap.String("base_url", cfg.LLMBaseURL),
			zap.String("model", cfg.LLMModel),
			zap.String("completions_path", cfg.LLMCompletionsPath),
		)
		return provider.NewOpenAIProvider(cfg.LLMBaseURL, cfg.LLMAPIKey, cfg.LLMModel, httpClient).
			WithCompletionsPath(cfg.LLMCompletionsPath)

	case "deepseek":
		logger.Info("using DeepSeek provider",
			zap.String("base_url", cfg.DeepSeekBaseURL),
			zap.String("model", cfg.DeepSeekModel),
		)
		return provider.NewOpenAIProvider(cfg.DeepSeekBaseURL, cfg.DeepSeekAPIKey, cfg.DeepSeekModel, httpClient)

	case "gemini":
		logger.Info("using Gemini provider",
			zap.String("base_url", cfg.GeminiBaseURL),
			zap.String("model", cfg.GeminiModel),
		)
		return provider.NewOpenAIProvider(cfg.GeminiBaseURL, cfg.GeminiAPIKey, cfg.GeminiModel, httpClient).
			WithCompletionsPath("/chat/completions")

	default:
		logger.Info("using mock provider")
		return provider.NewMockProvider()
	}
}
