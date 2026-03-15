package provider

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Request struct {
	Prompt      string  `json:"prompt"`
	Temperature float64 `json:"temperature"`
}

type Response struct {
	Output string `json:"output"`
}

type Provider interface {
	Generate(ctx context.Context, request Request) (Response, error)
}

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (p *MockProvider) Generate(ctx context.Context, request Request) (Response, error) {
	select {
	case <-ctx.Done():
		return Response{}, ctx.Err()
	case <-time.After(80 * time.Millisecond):
	}

	normalized := strings.TrimSpace(request.Prompt)
	if normalized == "" {
		normalized = "без запроса"
	}

	return Response{Output: fmt.Sprintf("[MOCK] Ответ для: %s", normalized)}, nil
}
