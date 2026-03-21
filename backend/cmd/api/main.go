package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/repository/memory"
	"github.com/radassist/backend/internal/repository/postgres"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	"github.com/radassist/backend/internal/service/knowledge"
	httptransport "github.com/radassist/backend/internal/transport/http"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	repos := memory.NewRepositories()
	appCtx := context.Background()

	if cfg.KnowledgeDatabaseURL != "" {
		db, err := postgres.Open(appCtx, cfg.KnowledgeDatabaseURL)
		if err != nil {
			logger.Warn("knowledge postgres unavailable, falling back to memory", zap.Error(err))
		} else {
			if err := postgres.EnsureSchema(appCtx, db); err != nil {
				logger.Warn("knowledge schema ensure failed, falling back to memory", zap.Error(err))
				_ = db.Close()
			} else {
				knowledgeStore := postgres.NewKnowledgeStore(db)
				repos.UploadedTemplates = knowledgeStore
				repos.Knowledge = knowledgeStore
				logger.Info("knowledge subsystem connected to postgres")
			}
		}
	}
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
	knowledgeService := knowledge.NewService(
		repos.UploadedTemplates,
		repos.Knowledge,
		aiService,
		logger,
		time.Duration(cfg.KnowledgeWorkerPollMS)*time.Millisecond,
	)

	go knowledgeService.RunWorker(appCtx)

	router := httptransport.NewRouter(cfg, authService, dataService, aiService, knowledgeService, logger)
	logger.Info("starting backend", zap.String("port", cfg.Port), zap.String("ai_gateway", cfg.AIGatewayURL))
	if err := router.Run(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		logger.Fatal("failed to start backend", zap.Error(err))
	}
}
