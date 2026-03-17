package provider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// OpenAIProvider calls any OpenAI-compatible chat completions endpoint.
type OpenAIProvider struct {
	baseURL         string
	apiKey          string
	model           string
	completionsPath string // default: "/v1/chat/completions"
	client          *http.Client
}

func NewOpenAIProvider(baseURL, apiKey, model string, client *http.Client) *OpenAIProvider {
	if client == nil {
		client = http.DefaultClient
	}
	return &OpenAIProvider{
		baseURL:         strings.TrimRight(baseURL, "/"),
		apiKey:          apiKey,
		model:           model,
		completionsPath: "/v1/chat/completions",
		client:          client,
	}
}

// WithCompletionsPath overrides the default /v1/chat/completions path.
// Useful for providers like Gemini that use a different path.
func (p *OpenAIProvider) WithCompletionsPath(path string) *OpenAIProvider {
	p.completionsPath = path
	return p
}

// -- OpenAI API types --

type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Temperature float64         `json:"temperature"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
	Stream      bool            `json:"stream,omitempty"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []openAIChoice `json:"choices"`
	Usage   openAIUsage    `json:"usage"`
}

type openAIChoice struct {
	Message      openAIMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

type openAIUsage struct {
	TotalTokens int `json:"total_tokens"`
}

type openAIStreamChunk struct {
	Choices []openAIStreamChoice `json:"choices"`
	Usage   *openAIUsage         `json:"usage,omitempty"`
}

type openAIStreamChoice struct {
	Delta        openAIStreamDelta `json:"delta"`
	FinishReason *string           `json:"finish_reason"`
}

type openAIStreamDelta struct {
	Content string `json:"content"`
}

// Generate sends a synchronous chat completion request.
func (p *OpenAIProvider) Generate(ctx context.Context, req Request) (Response, error) {
	body := p.buildRequest(req, false)
	httpReq, err := p.newHTTPRequest(ctx, body)
	if err != nil {
		return Response{}, err
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return Response{}, fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return Response{}, fmt.Errorf("openai returned %d: %s", resp.StatusCode, string(data))
	}

	var oaiResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&oaiResp); err != nil {
		return Response{}, fmt.Errorf("openai decode error: %w", err)
	}

	if len(oaiResp.Choices) == 0 {
		return Response{}, fmt.Errorf("openai returned no choices")
	}

	return Response{
		Output:       oaiResp.Choices[0].Message.Content,
		TokensUsed:   oaiResp.Usage.TotalTokens,
		FinishReason: oaiResp.Choices[0].FinishReason,
	}, nil
}

// GenerateStream sends a streaming chat completion request, returning chunks via channel.
func (p *OpenAIProvider) GenerateStream(ctx context.Context, req Request) (<-chan StreamChunk, error) {
	body := p.buildRequest(req, true)
	httpReq, err := p.newHTTPRequest(ctx, body)
	if err != nil {
		return nil, err
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("openai stream request failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("openai returned %d: %s", resp.StatusCode, string(data))
	}

	ch := make(chan StreamChunk, 64)

	go func() {
		defer close(ch)
		defer resp.Body.Close()

		scanner := bufio.NewScanner(resp.Body)
		totalTokens := 0

		for scanner.Scan() {
			line := scanner.Text()

			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")

			if data == "[DONE]" {
				ch <- StreamChunk{Done: true, TokensUsed: totalTokens}
				return
			}

			var chunk openAIStreamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil {
				continue
			}

			if chunk.Usage != nil {
				totalTokens = chunk.Usage.TotalTokens
			}

			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				ch <- StreamChunk{Delta: chunk.Choices[0].Delta.Content}
			}
		}

		if err := scanner.Err(); err != nil {
			select {
			case <-ctx.Done():
			default:
				ch <- StreamChunk{Error: err.Error(), Done: true}
			}
		}
	}()

	return ch, nil
}

func (p *OpenAIProvider) buildRequest(req Request, stream bool) openAIRequest {
	messages := make([]openAIMessage, len(req.Messages))
	for i, m := range req.Messages {
		messages[i] = openAIMessage{Role: m.Role, Content: m.Content}
	}
	return openAIRequest{
		Model:       p.model,
		Messages:    messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      stream,
	}
}

func (p *OpenAIProvider) newHTTPRequest(ctx context.Context, body openAIRequest) (*http.Request, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := p.baseURL + p.completionsPath
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}
	return httpReq, nil
}
