package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/radassist/backend/internal/service/ai"
	"github.com/radassist/backend/internal/service/knowledge"
	"github.com/radassist/backend/internal/transport/http/middleware"
)

// AIHandler handles AI-related endpoints.
type AIHandler struct {
	aiService        *ai.Service
	knowledgeService *knowledge.Service
}

func NewAIHandler(aiService *ai.Service, knowledgeService *knowledge.Service) *AIHandler {
	return &AIHandler{
		aiService:        aiService,
		knowledgeService: knowledgeService,
	}
}

func (h *AIHandler) enrichWithKnowledgeContext(ctx *gin.Context, userID string, req *ai.GenerateRequest) (*knowledge.ContextResult, error) {
	sourceTemplateIDs := req.SourceTemplateIDs
	if len(sourceTemplateIDs) == 0 && len(req.UploadedTemplateIDs) > 0 {
		sourceTemplateIDs = append(sourceTemplateIDs, req.UploadedTemplateIDs...)
	}

	result, err := h.knowledgeService.BuildContext(ctx.Request.Context(), userID, knowledge.ContextRequest{
		Section:           req.Section,
		Modality:          req.Modality,
		StudyProfile:      req.StudyProfile,
		Query:             req.UserMessage,
		CurrentContent:    req.CurrentContent,
		KnowledgeTags:     req.KnowledgeTags,
		SourceTemplateIDs: sourceTemplateIDs,
	})
	if err != nil {
		return nil, err
	}

	req.KnowledgeContext = result.KnowledgeContext
	req.SourceTemplateIDs = sourceTemplateIDs
	return result, nil
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

	ctxResult, err := h.enrichWithKnowledgeContext(c, user.ID, &req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	if req.Section == "autocomplete" && ctxResult != nil && ctxResult.DirectAutocomplete != "" {
		c.JSON(http.StatusOK, ai.GenerateResponse{
			Text:       ctxResult.DirectAutocomplete,
			TokensUsed: 0,
		})
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

	ctxResult, err := h.enrichWithKnowledgeContext(c, user.ID, &req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
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

	if req.Section == "autocomplete" && ctxResult != nil && ctxResult.DirectAutocomplete != "" {
		writeSSEChunk(c.Writer, flusher, map[string]any{
			"delta": ctxResult.DirectAutocomplete,
			"done":  false,
		})
		writeSSEChunk(c.Writer, flusher, map[string]any{
			"delta":      "",
			"done":       true,
			"tokensUsed": 0,
		})
		return
	}

	_, err = h.aiService.GenerateStream(c.Request.Context(), user.ID, req, c.Writer, flusher)
	if err != nil {
		return
	}
}

func (h *AIHandler) CreateIndexJob(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req knowledge.CreateIndexJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job, err := h.knowledgeService.CreateIndexJob(c.Request.Context(), user.ID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, job)
}

func (h *AIHandler) GetIndexJob(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	job, err := h.knowledgeService.GetIndexJob(c.Request.Context(), user.ID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, job)
}

func (h *AIHandler) SearchKnowledge(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req knowledge.SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.knowledgeService.Search(c.Request.Context(), user.ID, req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func writeSSEChunk(w http.ResponseWriter, flusher http.Flusher, payload map[string]any) {
	data, _ := json.Marshal(payload)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}
