package ai

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/radassist/backend/internal/repository/memory"
)

func TestGenerateAddsGatewaySecretHeader(t *testing.T) {
	var gotHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get(gatewayAuthHeader)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"output":"ok","tokensUsed":1,"finishReason":"stop"}`)
	}))
	defer server.Close()

	svc := NewService(server.URL, "shared-secret", server.Client(), memory.NewRepositories().Audit)
	resp, err := svc.Generate(context.Background(), "user-1", GenerateRequest{
		Modality:        "CT",
		Section:         "findings",
		CurrentContent:  "test",
		TemplateContent: "template",
	})
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}
	if resp.Text != "ok" {
		t.Fatalf("expected response text ok, got %q", resp.Text)
	}
	if gotHeader != "shared-secret" {
		t.Fatalf("expected %s header to be sent, got %q", gatewayAuthHeader, gotHeader)
	}
}

func TestGenerateStreamAddsGatewaySecretHeader(t *testing.T) {
	var gotHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get(gatewayAuthHeader)
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, `data: {"delta":"ok ","done":false}

`)
		_, _ = io.WriteString(w, `data: {"done":true,"tokensUsed":2}

`)
	}))
	defer server.Close()

	svc := NewService(server.URL, "shared-secret", server.Client(), memory.NewRepositories().Audit)
	var out bytes.Buffer
	tokens, err := svc.GenerateStream(context.Background(), "user-1", GenerateRequest{
		Modality:        "CT",
		Section:         "findings",
		CurrentContent:  "test",
		TemplateContent: "template",
	}, &out, nopFlusher{})
	if err != nil {
		t.Fatalf("GenerateStream returned error: %v", err)
	}
	if tokens != 2 {
		t.Fatalf("expected 2 tokens, got %d", tokens)
	}
	if gotHeader != "shared-secret" {
		t.Fatalf("expected %s header to be sent, got %q", gatewayAuthHeader, gotHeader)
	}
}

type nopFlusher struct{}

func (nopFlusher) Flush() {}
