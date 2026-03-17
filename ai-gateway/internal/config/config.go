package config

import "github.com/spf13/viper"

type Config struct {
	Port                 string
	RequestTimeoutMs     int
	RetryCount           int
	RetryBackoffMs       int
	CircuitThreshold     int
	CircuitCooldownS     int
	ProviderMode         string
	InternalSharedSecret string

	// OpenAI
	LLMBaseURL         string
	LLMAPIKey          string
	LLMModel           string
	LLMCompletionsPath string

	// DeepSeek
	DeepSeekBaseURL string
	DeepSeekAPIKey  string
	DeepSeekModel   string

	// Gemini
	GeminiBaseURL string
	GeminiAPIKey  string
	GeminiModel   string
}

func Load() Config {
	viper.SetDefault("PORT", "8090")
	viper.SetDefault("REQUEST_TIMEOUT_MS", 30000)
	viper.SetDefault("RETRY_COUNT", 2)
	viper.SetDefault("RETRY_BACKOFF_MS", 250)
	viper.SetDefault("CIRCUIT_THRESHOLD", 5)
	viper.SetDefault("CIRCUIT_COOLDOWN_S", 30)
	viper.SetDefault("PROVIDER_MODE", "mock")
	viper.SetDefault("AI_GATEWAY_SHARED_SECRET", "")

	// OpenAI defaults
	viper.SetDefault("LLM_BASE_URL", "https://api.openai.com")
	viper.SetDefault("LLM_API_KEY", "")
	viper.SetDefault("LLM_MODEL", "gpt-4o")
	viper.SetDefault("LLM_COMPLETIONS_PATH", "/v1/chat/completions")

	// DeepSeek defaults
	viper.SetDefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
	viper.SetDefault("DEEPSEEK_API_KEY", "")
	viper.SetDefault("DEEPSEEK_MODEL", "deepseek-chat")

	// Gemini defaults
	viper.SetDefault("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
	viper.SetDefault("GEMINI_API_KEY", "")
	viper.SetDefault("GEMINI_MODEL", "gemini-2.5-flash")

	viper.AutomaticEnv()

	return Config{
		Port:                 viper.GetString("PORT"),
		RequestTimeoutMs:     viper.GetInt("REQUEST_TIMEOUT_MS"),
		RetryCount:           viper.GetInt("RETRY_COUNT"),
		RetryBackoffMs:       viper.GetInt("RETRY_BACKOFF_MS"),
		CircuitThreshold:     viper.GetInt("CIRCUIT_THRESHOLD"),
		CircuitCooldownS:     viper.GetInt("CIRCUIT_COOLDOWN_S"),
		ProviderMode:         viper.GetString("PROVIDER_MODE"),
		InternalSharedSecret: viper.GetString("AI_GATEWAY_SHARED_SECRET"),
		LLMBaseURL:           viper.GetString("LLM_BASE_URL"),
		LLMAPIKey:            viper.GetString("LLM_API_KEY"),
		LLMModel:             viper.GetString("LLM_MODEL"),
		LLMCompletionsPath:   viper.GetString("LLM_COMPLETIONS_PATH"),
		DeepSeekBaseURL:      viper.GetString("DEEPSEEK_BASE_URL"),
		DeepSeekAPIKey:       viper.GetString("DEEPSEEK_API_KEY"),
		DeepSeekModel:        viper.GetString("DEEPSEEK_MODEL"),
		GeminiBaseURL:        viper.GetString("GEMINI_BASE_URL"),
		GeminiAPIKey:         viper.GetString("GEMINI_API_KEY"),
		GeminiModel:          viper.GetString("GEMINI_MODEL"),
	}
}
