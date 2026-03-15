package config

import "github.com/spf13/viper"

type Config struct {
	Port             string
	RequestTimeoutMs int
	RetryCount       int
	RetryBackoffMs   int
	CircuitThreshold int
	CircuitCooldownS int
	ProviderMode     string
}

func Load() Config {
	viper.SetDefault("PORT", "8090")
	viper.SetDefault("REQUEST_TIMEOUT_MS", 5000)
	viper.SetDefault("RETRY_COUNT", 2)
	viper.SetDefault("RETRY_BACKOFF_MS", 250)
	viper.SetDefault("CIRCUIT_THRESHOLD", 5)
	viper.SetDefault("CIRCUIT_COOLDOWN_S", 30)
	viper.SetDefault("PROVIDER_MODE", "mock")
	viper.AutomaticEnv()

	return Config{
		Port:             viper.GetString("PORT"),
		RequestTimeoutMs: viper.GetInt("REQUEST_TIMEOUT_MS"),
		RetryCount:       viper.GetInt("RETRY_COUNT"),
		RetryBackoffMs:   viper.GetInt("RETRY_BACKOFF_MS"),
		CircuitThreshold: viper.GetInt("CIRCUIT_THRESHOLD"),
		CircuitCooldownS: viper.GetInt("CIRCUIT_COOLDOWN_S"),
		ProviderMode:     viper.GetString("PROVIDER_MODE"),
	}
}
