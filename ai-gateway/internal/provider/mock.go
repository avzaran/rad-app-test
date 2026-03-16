package provider

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// MockProvider simulates an LLM for development without an API key.
type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (p *MockProvider) Generate(ctx context.Context, req Request) (Response, error) {
	select {
	case <-ctx.Done():
		return Response{}, ctx.Err()
	case <-time.After(80 * time.Millisecond):
	}

	prompt := extractUserMessage(req)
	return Response{
		Output:       fmt.Sprintf("[MOCK] Ответ для: %s", prompt),
		TokensUsed:   len(strings.Fields(prompt)) * 2,
		FinishReason: "stop",
	}, nil
}

// GenerateStream implements StreamProvider with simulated word-by-word streaming.
func (p *MockProvider) GenerateStream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	prompt := extractUserMessage(req)
	mockText := fmt.Sprintf("[MOCK] Ответ для: %s\n\nТЕХНИКА ИССЛЕДОВАНИЯ:\nИсследование выполнено по стандартному протоколу.\n\nОПИСАНИЕ:\nБез патологических изменений.\n\nЗАКЛЮЧЕНИЕ:\nНорма.", prompt)

	words := strings.Fields(mockText)
	ch := make(chan StreamChunk, len(words)+1)

	go func() {
		defer close(ch)
		for i, word := range words {
			select {
			case <-ctx.Done():
				ch <- StreamChunk{Error: ctx.Err().Error(), Done: true}
				return
			case <-time.After(30 * time.Millisecond):
			}

			suffix := " "
			if i == len(words)-1 {
				suffix = ""
			}
			ch <- StreamChunk{Delta: word + suffix}
		}
		ch <- StreamChunk{Done: true, TokensUsed: len(words) * 2}
	}()

	return ch, nil
}

func extractUserMessage(req Request) string {
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			msg := strings.TrimSpace(req.Messages[i].Content)
			if msg != "" {
				return msg
			}
		}
	}
	return "без запроса"
}
