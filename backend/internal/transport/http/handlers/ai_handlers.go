package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/service/data"
	"github.com/radassist/backend/internal/transport/http/middleware"
)

// maxAutoTemplates is the maximum number of templates to auto-fetch by modality.
const maxAutoTemplates = 5

// AIHandler handles AI-related endpoints.
type AIHandler struct {
	aiService   *ai.Service
	dataService *data.Service
}

func NewAIHandler(aiService *ai.Service, dataService *data.Service) *AIHandler {
	return &AIHandler{
		aiService:   aiService,
		dataService: dataService,
	}
}

// enrichWithTemplateContext fetches uploaded templates and builds template context on the request.
// If specific template IDs are provided, those are fetched. Otherwise, templates are auto-fetched
// by modality (up to maxAutoTemplates).
func (h *AIHandler) enrichWithTemplateContext(c *gin.Context, req *ai.GenerateRequest) {
	ctx := c.Request.Context()
	var templates []domain.UploadedTemplate

	if len(req.UploadedTemplateIDs) > 0 {
		// Fetch specific templates by ID
		for _, id := range req.UploadedTemplateIDs {
			t, err := h.dataService.GetUploadedTemplate(ctx, id)
			if err != nil {
				continue // skip templates that can't be found
			}
			templates = append(templates, *t)
		}
	} else if req.Modality != "" {
		// Auto-fetch templates by modality
		modTemplates, err := h.dataService.GetUploadedTemplatesByModality(ctx, req.Modality)
		if err == nil && len(modTemplates) > 0 {
			if len(modTemplates) > maxAutoTemplates {
				modTemplates = modTemplates[:maxAutoTemplates]
			}
			templates = modTemplates
		}
	}

	if len(templates) > 0 {
		req.TemplateContext = ai.BuildTemplateContext(templates)
	}
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

	h.enrichWithTemplateContext(c, &req)

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

	h.enrichWithTemplateContext(c, &req)

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
