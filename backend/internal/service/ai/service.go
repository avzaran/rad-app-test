package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
)

// Service proxies AI requests through the AI Gateway.
const gatewayAuthHeader = "X-AI-Gateway-Secret"

type Service struct {
	gatewayURL          string
	gatewaySharedSecret string
	httpClient          *http.Client
	audit               repository.AuditRepository
}

// GenerateRequest is the input from the frontend.
type GenerateRequest struct {
	Modality            string   `json:"modality"`
	TemplateContent     string   `json:"templateContent"`
	Section             string   `json:"section"`
	CurrentContent      string   `json:"currentContent"`
	UserMessage         string   `json:"userMessage"`
	ProtocolID          string   `json:"protocolId"`
	StudyProfile        string   `json:"studyProfile,omitempty"`
	KnowledgeTags       []string `json:"knowledgeTags,omitempty"`
	SourceTemplateIDs   []string `json:"sourceTemplateIds,omitempty"`
	UploadedTemplateIDs []string `json:"uploadedTemplateIds,omitempty"`
	KnowledgeContext    string   `json:"-"` // populated by handler, not from JSON
}

// GenerateResponse is the synchronous output to the frontend.
type GenerateResponse struct {
	Text       string `json:"text"`
	TokensUsed int    `json:"tokensUsed"`
}

// gatewayRequest matches the ai-gateway provider.Request format.
type gatewayRequest struct {
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"maxTokens"`
}

// gatewayResponse matches the ai-gateway provider.Response format.
type gatewayResponse struct {
	Output       string `json:"output"`
	TokensUsed   int    `json:"tokensUsed"`
	FinishReason string `json:"finishReason"`
}

func NewService(gatewayURL, gatewaySharedSecret string, httpClient *http.Client, audit repository.AuditRepository) *Service {
	if httpClient == nil {
		httpClient = &http.Client{}
	}
	return &Service{
		gatewayURL:          strings.TrimRight(gatewayURL, "/"),
		gatewaySharedSecret: gatewaySharedSecret,
		httpClient:          httpClient,
		audit:               audit,
	}
}

// Generate calls the AI Gateway synchronously and returns the full response.
func (s *Service) Generate(ctx context.Context, userID string, req GenerateRequest) (*GenerateResponse, error) {
	gwReq := s.buildGatewayRequest(req)
	return s.generateFromGateway(ctx, userID, fmt.Sprintf("ai_generate:%s:%s", req.Section, req.Modality), gwReq)
}

// GenerateStream calls the AI Gateway streaming endpoint and writes SSE chunks to the writer.
// It returns the total tokens used after the stream completes.
func (s *Service) GenerateStream(ctx context.Context, userID string, req GenerateRequest, w io.Writer, flusher http.Flusher) (int, error) {
	gwReq := s.buildGatewayRequest(req)

	body, err := json.Marshal(gwReq)
	if err != nil {
		return 0, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.gatewayURL+"/v1/inference/stream", bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if s.gatewaySharedSecret != "" {
		httpReq.Header.Set(gatewayAuthHeader, s.gatewaySharedSecret)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("gateway stream request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("gateway returned %d: %s", resp.StatusCode, string(data))
	}

	// Proxy SSE from gateway to client
	scanner := bufio.NewScanner(resp.Body)
	totalTokens := 0

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data: ") {
			// Parse to extract tokensUsed from final chunk
			dataStr := strings.TrimPrefix(line, "data: ")
			var chunk struct {
				TokensUsed int  `json:"tokensUsed"`
				Done       bool `json:"done"`
			}
			if json.Unmarshal([]byte(dataStr), &chunk) == nil && chunk.TokensUsed > 0 {
				totalTokens = chunk.TokensUsed
			}

			// Write full SSE event atomically with double newline
			fmt.Fprintf(w, "%s\n\n", line)
			flusher.Flush()
		}
		// Skip blank separator lines — they were part of the upstream SSE framing
	}

	if totalTokens > 0 {
		s.logAudit(userID, fmt.Sprintf("ai_generate:%s:%s", req.Section, req.Modality))
	}

	return totalTokens, scanner.Err()
}

func (s *Service) GenerateWithMessages(ctx context.Context, userID, auditAction string, messages []Message, temperature float64, maxTokens int) (*GenerateResponse, error) {
	return s.generateFromGateway(ctx, userID, auditAction, gatewayRequest{
		Messages:    messages,
		Temperature: temperature,
		MaxTokens:   maxTokens,
	})
}

func (s *Service) buildGatewayRequest(req GenerateRequest) gatewayRequest {
	// Sanitize PII before building prompts
	sanitizedTemplate := SanitizePII(req.TemplateContent)
	sanitizedContent := SanitizePII(req.CurrentContent)
	sanitizedMessage := SanitizePII(req.UserMessage)

	messages := BuildMessages(PromptContext{
		Modality:         req.Modality,
		Section:          req.Section,
		TemplateContent:  sanitizedTemplate,
		CurrentContent:   sanitizedContent,
		UserMessage:      sanitizedMessage,
		KnowledgeContext: req.KnowledgeContext,
		StudyProfile:     req.StudyProfile,
	})

	return gatewayRequest{
		Messages:    messages,
		Temperature: TemperatureForSection(req.Section),
		MaxTokens:   MaxTokensForSection(req.Section),
	}
}

func (s *Service) generateFromGateway(ctx context.Context, userID, auditAction string, gwReq gatewayRequest) (*GenerateResponse, error) {
	body, err := json.Marshal(gwReq)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, s.gatewayURL+"/v1/inference", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if s.gatewaySharedSecret != "" {
		httpReq.Header.Set(gatewayAuthHeader, s.gatewaySharedSecret)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("gateway request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gateway returned %d: %s", resp.StatusCode, string(data))
	}

	var gwResp gatewayResponse
	if err := json.NewDecoder(resp.Body).Decode(&gwResp); err != nil {
		return nil, fmt.Errorf("decode gateway response: %w", err)
	}

	if gwResp.TokensUsed > 0 {
		s.logAudit(userID, auditAction)
	}

	return &GenerateResponse{
		Text:       gwResp.Output,
		TokensUsed: gwResp.TokensUsed,
	}, nil
}

func (s *Service) logAudit(userID, action string) {
	if s.audit == nil {
		return
	}
	_ = s.audit.Add(domain.AuditEvent{
		UserID: userID,
		Action: action,
	})
}
