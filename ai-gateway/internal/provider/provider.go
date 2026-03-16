package provider

import "context"

// Message represents a chat message with a role.
type Message struct {
	Role    string `json:"role"`    // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// Request is the input to a Provider.
type Request struct {
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"maxTokens"`
}

// Response is the synchronous output of a Provider.
type Response struct {
	Output       string `json:"output"`
	TokensUsed   int    `json:"tokensUsed"`
	FinishReason string `json:"finishReason"` // "stop" | "length"
}

// StreamChunk is a single piece of a streaming response.
type StreamChunk struct {
	Delta      string `json:"delta"`
	Done       bool   `json:"done"`
	TokensUsed int    `json:"tokensUsed,omitempty"`
	Error      string `json:"error,omitempty"`
}

// Provider generates a complete response.
type Provider interface {
	Generate(ctx context.Context, req Request) (Response, error)
}

// StreamProvider extends Provider with streaming support.
type StreamProvider interface {
	Provider
	GenerateStream(ctx context.Context, req Request) (<-chan StreamChunk, error)
}
