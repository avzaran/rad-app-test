package domain

import "time"

type Role string

const (
	RoleAdmin  Role = "admin"
	RoleDoctor Role = "doctor"
)

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	FullName     string `json:"fullName"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	TwoFAEnabled bool   `json:"twoFaEnabled"`
}

type Patient struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	BirthDate string `json:"birthDate"`
	Gender    string `json:"gender"`
	Phone     string `json:"phone,omitempty"`
	Email     string `json:"email,omitempty"`
}

type Template struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Modality  string `json:"modality"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

type Protocol struct {
	ID        string    `json:"id"`
	Patient   Patient   `json:"patient"`
	Modality  string    `json:"modality"`
	Template  *Template `json:"template"`
	Content   string    `json:"content"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
	Status    string    `json:"status"`
}

type AuditEvent struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Action    string `json:"action"`
	CreatedAt string `json:"createdAt"`
}

type TemplateClassificationMode string

const (
	TemplateClassificationManual TemplateClassificationMode = "manual"
	TemplateClassificationAI     TemplateClassificationMode = "ai"
)

type TemplateIndexStatus string

const (
	TemplateIndexStatusPending      TemplateIndexStatus = "pending"
	TemplateIndexStatusRunning      TemplateIndexStatus = "running"
	TemplateIndexStatusReady        TemplateIndexStatus = "ready"
	TemplateIndexStatusFailed       TemplateIndexStatus = "failed"
	TemplateIndexStatusNeedsReindex TemplateIndexStatus = "needs_reindex"
)

type TemplateIndexJobStatus string

const (
	TemplateIndexJobPending   TemplateIndexJobStatus = "pending"
	TemplateIndexJobRunning   TemplateIndexJobStatus = "running"
	TemplateIndexJobCompleted TemplateIndexJobStatus = "completed"
	TemplateIndexJobFailed    TemplateIndexJobStatus = "failed"
)

type KnowledgeItemCategory string

const (
	KnowledgeCategoryNorm           KnowledgeItemCategory = "norm"
	KnowledgeCategoryPathology      KnowledgeItemCategory = "pathology"
	KnowledgeCategoryRecommendation KnowledgeItemCategory = "recommendation"
	KnowledgeCategoryTechnique      KnowledgeItemCategory = "technique"
	KnowledgeCategoryOther          KnowledgeItemCategory = "other"
)

type KnowledgeVariantOrigin string

const (
	KnowledgeOriginDB         KnowledgeVariantOrigin = "db"
	KnowledgeOriginAIFromDB   KnowledgeVariantOrigin = "ai_from_db"
	KnowledgeOriginAIFallback KnowledgeVariantOrigin = "ai_fallback"
)

type UploadedTemplate struct {
	ID                 string                     `json:"id"`
	FileName           string                     `json:"fileName"`
	OriginalName       string                     `json:"originalName"`
	Modality           string                     `json:"modality"`
	StudyProfile       string                     `json:"studyProfile"`
	Tags               []string                   `json:"tags"`
	ClassificationMode TemplateClassificationMode `json:"classificationMode"`
	ExtractedText      string                     `json:"extractedText"`
	FileSize           int64                      `json:"fileSize"`
	UploadedBy         string                     `json:"uploadedBy"`
	IndexStatus        TemplateIndexStatus        `json:"indexStatus"`
	LastIndexedAt      *time.Time                 `json:"lastIndexedAt,omitempty"`
	LastIndexError     string                     `json:"lastIndexError,omitempty"`
	CreatedAt          time.Time                  `json:"createdAt"`
}

type UploadedTemplateFilter struct {
	Modality          string
	StudyProfile      string
	Tags              []string
	SourceTemplateIDs []string
	IndexStatuses     []TemplateIndexStatus
}

type TemplateIndexJob struct {
	ID                 string                 `json:"id"`
	CreatedBy          string                 `json:"createdBy"`
	Modality           string                 `json:"modality"`
	StudyProfile       string                 `json:"studyProfile"`
	SourceTemplateIDs  []string               `json:"sourceTemplateIds"`
	Status             TemplateIndexJobStatus `json:"status"`
	TotalTemplates     int                    `json:"totalTemplates"`
	ProcessedTemplates int                    `json:"processedTemplates"`
	LastError          string                 `json:"lastError,omitempty"`
	CreatedAt          time.Time              `json:"createdAt"`
	StartedAt          *time.Time             `json:"startedAt,omitempty"`
	FinishedAt         *time.Time             `json:"finishedAt,omitempty"`
	LastHeartbeatAt    *time.Time             `json:"lastHeartbeatAt,omitempty"`
}

type TemplateKnowledgeItem struct {
	ID             string                `json:"id"`
	TemplateID     string                `json:"templateId"`
	UploadedBy     string                `json:"uploadedBy"`
	Modality       string                `json:"modality"`
	StudyProfile   string                `json:"studyProfile"`
	Tags           []string              `json:"tags"`
	Section        string                `json:"section"`
	Category       KnowledgeItemCategory `json:"category"`
	AnatomyTerms   []string              `json:"anatomyTerms"`
	PathologyTerms []string              `json:"pathologyTerms"`
	SearchText     string                `json:"searchText"`
	Content        string                `json:"content"`
	SortOrder      int                   `json:"sortOrder"`
	Metadata       map[string]string     `json:"metadata,omitempty"`
	CreatedAt      time.Time             `json:"createdAt"`
}

type KnowledgeSearchParams struct {
	UserID            string
	Modality          string
	StudyProfile      string
	Query             string
	Tags              []string
	SourceTemplateIDs []string
	Limit             int
}

type KnowledgeSource struct {
	TemplateID   string                `json:"templateId"`
	TemplateName string                `json:"templateName"`
	Section      string                `json:"section"`
	Category     KnowledgeItemCategory `json:"category"`
}

type KnowledgeVariant struct {
	ID       string                 `json:"id"`
	Category KnowledgeItemCategory  `json:"category"`
	Text     string                 `json:"text"`
	Origin   KnowledgeVariantOrigin `json:"origin"`
	Sources  []KnowledgeSource      `json:"sources"`
}

type KnowledgeSearchResponse struct {
	Query        string             `json:"query"`
	Variants     []KnowledgeVariant `json:"variants"`
	UsedFallback bool               `json:"usedFallback"`
}
