package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/radassist/backend/internal/config"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	"github.com/radassist/backend/internal/transport/http/handlers"
	"github.com/radassist/backend/internal/transport/http/middleware"
	"go.uber.org/zap"
)

func NewRouter(cfg config.Config, authService *auth.Service, dataService *data.Service, logger *zap.Logger) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.RateLimit(cfg.RateLimitPerMin))

	h := handlers.New(authService, dataService, cfg.StorageBaseURL, cfg.StorageBucketName, cfg.RefreshTTLHours)

	router.GET("/healthz", h.Healthz)

	authGroup := router.Group("/auth")
	{
		authGroup.POST("/login", h.Login)
		authGroup.POST("/refresh", h.Refresh)
		authGroup.POST("/logout", h.Logout)
		authGroup.POST("/2fa/verify", middleware.Auth(authService), h.Verify2FA)
	}

	protected := router.Group("/")
	protected.Use(middleware.Auth(authService))
	{
		protected.GET("/me", h.Me)

		protected.GET("/patients", h.ListPatients)
		protected.POST("/patients", h.CreatePatient)
		protected.PATCH("/patients/:id", h.PatchPatient)
		protected.DELETE("/patients/:id", middleware.RequireRoles(domain.RoleAdmin), h.DeletePatient)

		protected.GET("/templates", h.ListTemplates)
		protected.POST("/templates", h.CreateTemplate)
		protected.PATCH("/templates/:id", h.PatchTemplate)
		protected.DELETE("/templates/:id", middleware.RequireRoles(domain.RoleAdmin), h.DeleteTemplate)

		protected.GET("/protocols", h.ListProtocols)
		protected.GET("/protocols/:id", h.GetProtocol)
		protected.POST("/protocols", h.CreateProtocol)
		protected.PATCH("/protocols/:id", h.UpdateProtocol)
		protected.DELETE("/protocols/:id", middleware.RequireRoles(domain.RoleAdmin), h.DeleteProtocol)

		protected.POST("/files/presign-upload", h.PresignUpload)
		protected.POST("/files/presign-download", h.PresignDownload)
	}

	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
	})

	return router
}
