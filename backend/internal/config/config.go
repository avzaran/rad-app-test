package config

import (
	"net/http"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Port                  string
	JWTSecret             string
	AccessTTLMinutes      int
	RefreshTTLHours       int
	RateLimitPerMin       int
	StorageBaseURL        string
	StorageBucketName     string
	AIGatewayURL          string
	AIGatewaySharedSecret string
	KnowledgeDatabaseURL  string
	KnowledgeWorkerPollMS int
	CORSAllowedOrigins    []string
	CookieSecure          bool
	CookieSameSite        http.SameSite
}

func Load() Config {
	viper.SetDefault("PORT", "8080")
	viper.SetDefault("JWT_SECRET", "dev-secret-change-me")
	viper.SetDefault("ACCESS_TTL_MINUTES", 15)
	viper.SetDefault("REFRESH_TTL_HOURS", 168)
	viper.SetDefault("RATE_LIMIT_PER_MIN", 240)
	viper.SetDefault("STORAGE_BASE_URL", "http://localhost:9000")
	viper.SetDefault("STORAGE_BUCKET_NAME", "radassist-files")
	viper.SetDefault("AI_GATEWAY_URL", "http://localhost:8090")
	viper.SetDefault("AI_GATEWAY_SHARED_SECRET", "")
	viper.SetDefault("KNOWLEDGE_DATABASE_URL", "")
	viper.SetDefault("KNOWLEDGE_WORKER_POLL_MS", 1500)
	viper.SetDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
	viper.SetDefault("COOKIE_SECURE", false)
	viper.SetDefault("COOKIE_SAMESITE", "lax")

	viper.AutomaticEnv()

	return Config{
		Port:                  viper.GetString("PORT"),
		JWTSecret:             viper.GetString("JWT_SECRET"),
		AccessTTLMinutes:      viper.GetInt("ACCESS_TTL_MINUTES"),
		RefreshTTLHours:       viper.GetInt("REFRESH_TTL_HOURS"),
		RateLimitPerMin:       viper.GetInt("RATE_LIMIT_PER_MIN"),
		StorageBaseURL:        viper.GetString("STORAGE_BASE_URL"),
		StorageBucketName:     viper.GetString("STORAGE_BUCKET_NAME"),
		AIGatewayURL:          viper.GetString("AI_GATEWAY_URL"),
		AIGatewaySharedSecret: viper.GetString("AI_GATEWAY_SHARED_SECRET"),
		KnowledgeDatabaseURL:  viper.GetString("KNOWLEDGE_DATABASE_URL"),
		KnowledgeWorkerPollMS: viper.GetInt("KNOWLEDGE_WORKER_POLL_MS"),
		CORSAllowedOrigins:    parseCSV(viper.GetString("CORS_ALLOWED_ORIGINS")),
		CookieSecure:          viper.GetBool("COOKIE_SECURE"),
		CookieSameSite:        parseSameSite(viper.GetString("COOKIE_SAMESITE")),
	}
}

func parseCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func parseSameSite(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "default":
		return http.SameSiteDefaultMode
	case "lax", "":
		fallthrough
	default:
		return http.SameSiteLaxMode
	}
}
