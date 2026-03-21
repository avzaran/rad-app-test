package repository

import (
	"context"

	"github.com/radassist/backend/internal/domain"
)

type UserRepository interface {
	FindByEmail(email string) (*domain.User, error)
	FindByID(id string) (*domain.User, error)
}

type PatientRepository interface {
	List() ([]domain.Patient, error)
	Create(patient domain.Patient) (domain.Patient, error)
	Update(id string, patch domain.Patient) (domain.Patient, error)
	Delete(id string) error
}

type TemplateRepository interface {
	List() ([]domain.Template, error)
	Create(template domain.Template) (domain.Template, error)
	Update(id string, patch domain.Template) (domain.Template, error)
	Delete(id string) error
	FindByID(id string) (*domain.Template, error)
}

type ProtocolRepository interface {
	List() ([]domain.Protocol, error)
	FindByID(id string) (*domain.Protocol, error)
	Create(protocol domain.Protocol) (domain.Protocol, error)
	Update(id string, patch domain.Protocol) (domain.Protocol, error)
	Delete(id string) error
}

type AuditRepository interface {
	Add(event domain.AuditEvent) error
}

type UploadedTemplateRepository interface {
	ListUploadedTemplates(ctx context.Context, userID string) ([]domain.UploadedTemplate, error)
	CreateUploadedTemplate(ctx context.Context, t domain.UploadedTemplate) error
	UpdateUploadedTemplate(ctx context.Context, t domain.UploadedTemplate) error
	DeleteUploadedTemplate(ctx context.Context, id, userID string) error
	GetUploadedTemplate(ctx context.Context, id, userID string) (*domain.UploadedTemplate, error)
	GetUploadedTemplatesByModality(ctx context.Context, userID, modality string) ([]domain.UploadedTemplate, error)
	FindUploadedTemplates(ctx context.Context, userID string, filter domain.UploadedTemplateFilter) ([]domain.UploadedTemplate, error)
}

type KnowledgeRepository interface {
	CreateIndexJob(ctx context.Context, job domain.TemplateIndexJob) error
	GetIndexJob(ctx context.Context, jobID, userID string) (*domain.TemplateIndexJob, error)
	ClaimPendingIndexJob(ctx context.Context) (*domain.TemplateIndexJob, error)
	UpdateIndexJob(ctx context.Context, job domain.TemplateIndexJob) error
	ReplaceTemplateKnowledge(ctx context.Context, template domain.UploadedTemplate, items []domain.TemplateKnowledgeItem) error
	SearchKnowledge(ctx context.Context, params domain.KnowledgeSearchParams) ([]domain.TemplateKnowledgeItem, error)
}

type Repositories struct {
	Users             UserRepository
	Patients          PatientRepository
	Templates         TemplateRepository
	Protocols         ProtocolRepository
	Audit             AuditRepository
	UploadedTemplates UploadedTemplateRepository
	Knowledge         KnowledgeRepository
}
