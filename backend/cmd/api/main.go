package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/repository/memory"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	httptransport "github.com/radassist/backend/internal/transport/http"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	repos := memory.NewRepositories()
	authService := auth.NewService(
		repos,
		cfg.JWTSecret,
		time.Duration(cfg.AccessTTLMinutes)*time.Minute,
		time.Duration(cfg.RefreshTTLHours)*time.Hour,
	)
	dataService := data.NewService(repos)
	aiService := ai.NewService(
		cfg.AIGatewayURL,
		cfg.AIGatewaySharedSecret,
		&http.Client{Timeout: 120 * time.Second},
		repos.Audit,
	)

	router := httptransport.NewRouter(cfg, authService, dataService, aiService, logger)
	logger.Info("starting backend", zap.String("port", cfg.Port), zap.String("ai_gateway", cfg.AIGatewayURL))
	if err := router.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		logger.Fatal("failed to start backend", zap.Error(err))
	}
}
