package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/transport/http/middleware"
)

// AIHandler handles AI-related endpoints.
type AIHandler struct {
	aiService *ai.Service
}

func NewAIHandler(aiService *ai.Service) *AIHandler {
	return &AIHandler{aiService: aiService}
}

// AIGenerate handles POST /ai/generate — synchronous AI response.
func (h *AIHandler) AIGenerate(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req ai.GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.aiService.Generate(c.Request.Context(), user.ID, req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// AIGenerateStream handles POST /ai/generate/stream — SSE streaming AI response.
func (h *AIHandler) AIGenerateStream(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req ai.GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "streaming not supported"})
		return
	}

	_, err := h.aiService.GenerateStream(c.Request.Context(), user.ID, req, c.Writer, flusher)
	if err != nil {
		// If headers already sent, we can't write JSON error — the stream already started.
		// The error would have been sent as an SSE event by the gateway.
		return
	}
}
