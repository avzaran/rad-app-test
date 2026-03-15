package data

import (
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
)

type Service struct {
	patients  repository.PatientRepository
	templates repository.TemplateRepository
	protocols repository.ProtocolRepository
	audit     repository.AuditRepository
}

func NewService(repos repository.Repositories) *Service {
	return &Service{
		patients:  repos.Patients,
		templates: repos.Templates,
		protocols: repos.Protocols,
		audit:     repos.Audit,
	}
}

func (s *Service) ListPatients() ([]domain.Patient, error) {
	return s.patients.List()
}

func (s *Service) CreatePatient(patient domain.Patient) (domain.Patient, error) {
	return s.patients.Create(patient)
}

func (s *Service) UpdatePatient(id string, patch domain.Patient) (domain.Patient, error) {
	return s.patients.Update(id, patch)
}

func (s *Service) DeletePatient(id string) error {
	return s.patients.Delete(id)
}

func (s *Service) ListTemplates() ([]domain.Template, error) {
	return s.templates.List()
}

func (s *Service) CreateTemplate(template domain.Template) (domain.Template, error) {
	return s.templates.Create(template)
}

func (s *Service) UpdateTemplate(id string, patch domain.Template) (domain.Template, error) {
	return s.templates.Update(id, patch)
}

func (s *Service) DeleteTemplate(id string) error {
	return s.templates.Delete(id)
}

func (s *Service) ListProtocols() ([]domain.Protocol, error) {
	return s.protocols.List()
}

func (s *Service) GetProtocol(id string) (*domain.Protocol, error) {
	return s.protocols.FindByID(id)
}

func (s *Service) CreateProtocol(protocol domain.Protocol) (domain.Protocol, error) {
	return s.protocols.Create(protocol)
}

func (s *Service) UpdateProtocol(id string, patch domain.Protocol) (domain.Protocol, error) {
	return s.protocols.Update(id, patch)
}

func (s *Service) DeleteProtocol(id string) error {
	return s.protocols.Delete(id)
}
