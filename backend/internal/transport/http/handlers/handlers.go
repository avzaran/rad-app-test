package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/service/auth"
	"github.com/radassist/backend/internal/service/data"
	"github.com/radassist/backend/internal/transport/http/middleware"
)

type Handler struct {
	authService   *auth.Service
	dataService   *data.Service
	storageBase   string
	storageBucket string
	refreshHours  int
}

func New(authService *auth.Service, dataService *data.Service, storageBase, storageBucket string, refreshHours int) *Handler {
	return &Handler{
		authService:   authService,
		dataService:   dataService,
		storageBase:   strings.TrimSuffix(storageBase, "/"),
		storageBucket: storageBucket,
		refreshHours:  refreshHours,
	}
}

func (h *Handler) Healthz(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *Handler) Login(c *gin.Context) {
	var payload struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.authService.Login(payload.Email, payload.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	c.SetCookie("refresh_token", result.RefreshToken, h.refreshHours*3600, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{
		"accessToken": result.AccessToken,
		"user": gin.H{
			"id":           result.User.ID,
			"email":        result.User.Email,
			"fullName":     result.User.FullName,
			"role":         result.User.Role,
			"twoFaEnabled": result.User.TwoFAEnabled,
		},
	})
}

func (h *Handler) Logout(c *gin.Context) {
	refreshToken, _ := c.Cookie("refresh_token")
	if refreshToken != "" {
		h.authService.Logout(refreshToken)
	}
	c.SetCookie("refresh_token", "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}

func (h *Handler) Refresh(c *gin.Context) {
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil || refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	accessToken, rotatedRefresh, refreshErr := h.authService.Refresh(refreshToken)
	if refreshErr != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": refreshErr.Error()})
		return
	}

	c.SetCookie("refresh_token", rotatedRefresh, h.refreshHours*3600, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"accessToken": accessToken})
}

func (h *Handler) Verify2FA(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var payload struct {
		Code string `json:"code" binding:"required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ok := h.authService.Verify2FA(user.ID, payload.Code)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"ok": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) Me(c *gin.Context) {
	user := middleware.CurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	resolved, err := h.authService.Me(user.ID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           resolved.ID,
		"email":        resolved.Email,
		"fullName":     resolved.FullName,
		"role":         resolved.Role,
		"twoFaEnabled": resolved.TwoFAEnabled,
	})
}

func (h *Handler) ListPatients(c *gin.Context) {
	items, err := h.dataService.ListPatients()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) CreatePatient(c *gin.Context) {
	var payload domain.Patient
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.dataService.CreatePatient(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) PatchPatient(c *gin.Context) {
	var payload domain.Patient
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.dataService.UpdatePatient(c.Param("id"), payload)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) DeletePatient(c *gin.Context) {
	if err := h.dataService.DeletePatient(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ListTemplates(c *gin.Context) {
	items, err := h.dataService.ListTemplates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var payload domain.Template
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.dataService.CreateTemplate(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) PatchTemplate(c *gin.Context) {
	var payload domain.Template
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.dataService.UpdateTemplate(c.Param("id"), payload)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) DeleteTemplate(c *gin.Context) {
	if err := h.dataService.DeleteTemplate(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ListProtocols(c *gin.Context) {
	items, err := h.dataService.ListProtocols()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *Handler) GetProtocol(c *gin.Context) {
	protocol, err := h.dataService.GetProtocol(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "protocol not found"})
		return
	}
	c.JSON(http.StatusOK, protocol)
}

func (h *Handler) CreateProtocol(c *gin.Context) {
	var payload domain.Protocol
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.dataService.CreateProtocol(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

func (h *Handler) UpdateProtocol(c *gin.Context) {
	var patch domain.Protocol
	if err := c.ShouldBindJSON(&patch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.dataService.UpdateProtocol(c.Param("id"), patch)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) DeleteProtocol(c *gin.Context) {
	if err := h.dataService.DeleteProtocol(c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) PresignUpload(c *gin.Context) {
	var payload struct {
		Filename string `json:"filename" binding:"required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expiresAt := time.Now().UTC().Add(10 * time.Minute)
	c.JSON(http.StatusOK, gin.H{
		"url":       fmt.Sprintf("%s/%s/%s?signature=mock", h.storageBase, h.storageBucket, payload.Filename),
		"expiresAt": expiresAt.Format(time.RFC3339),
	})
}

func (h *Handler) PresignDownload(c *gin.Context) {
	var payload struct {
		Filename string `json:"filename" binding:"required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expiresAt := time.Now().UTC().Add(10 * time.Minute)
	c.JSON(http.StatusOK, gin.H{
		"url":       fmt.Sprintf("%s/%s/%s?signature=mock", h.storageBase, h.storageBucket, payload.Filename),
		"expiresAt": expiresAt.Format(time.RFC3339),
	})
}
