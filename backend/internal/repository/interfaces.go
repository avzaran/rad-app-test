package repository

import "github.com/radassist/backend/internal/domain"

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

type Repositories struct {
	Users     UserRepository
	Patients  PatientRepository
	Templates TemplateRepository
	Protocols ProtocolRepository
	Audit     AuditRepository
}
