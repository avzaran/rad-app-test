package config

import "github.com/spf13/viper"

type Config struct {
	Port              string
	JWTSecret         string
	AccessTTLMinutes  int
	RefreshTTLHours   int
	RateLimitPerMin   int
	StorageBaseURL    string
	StorageBucketName string
	AIGatewayURL      string
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

	viper.AutomaticEnv()

	return Config{
		Port:              viper.GetString("PORT"),
		JWTSecret:         viper.GetString("JWT_SECRET"),
		AccessTTLMinutes:  viper.GetInt("ACCESS_TTL_MINUTES"),
		RefreshTTLHours:   viper.GetInt("REFRESH_TTL_HOURS"),
		RateLimitPerMin:   viper.GetInt("RATE_LIMIT_PER_MIN"),
		StorageBaseURL:    viper.GetString("STORAGE_BASE_URL"),
		StorageBucketName: viper.GetString("STORAGE_BUCKET_NAME"),
		AIGatewayURL:      viper.GetString("AI_GATEWAY_URL"),
	}
}
