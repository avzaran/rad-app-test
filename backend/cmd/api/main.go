package main

import (
	"fmt"
	"time"

	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/repository/memory"
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

	router := httptransport.NewRouter(cfg, authService, dataService, logger)
	if err := router.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		logger.Fatal("failed to start backend", zap.Error(err))
	}
}
