package data

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
	"github.com/radassist/backend/internal/service/docx"
)

const maxDocxFileSize = 10 << 20 // 10 MB

type Service struct {
	patients          repository.PatientRepository
	templates         repository.TemplateRepository
	protocols         repository.ProtocolRepository
	audit             repository.AuditRepository
	uploadedTemplates repository.UploadedTemplateRepository
}

func NewService(repos repository.Repositories) *Service {
	return &Service{
		patients:          repos.Patients,
		templates:         repos.Templates,
		protocols:         repos.Protocols,
		audit:             repos.Audit,
		uploadedTemplates: repos.UploadedTemplates,
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

// --- Uploaded template methods ---

func (s *Service) UploadTemplate(ctx context.Context, file multipart.File, header *multipart.FileHeader, modality, userID string) (*domain.UploadedTemplate, error) {
	if err := validateDocx(header); err != nil {
		return nil, err
	}

	extractedText, err := docx.ExtractText(file)
	if err != nil {
		return nil, fmt.Errorf("extracting text from docx: %w", err)
	}

	t := domain.UploadedTemplate{
		ID:            uuid.NewString(),
		FileName:      uuid.NewString() + ".docx",
		OriginalName:  header.Filename,
		Modality:      modality,
		ExtractedText: extractedText,
		FileSize:      header.Size,
		UploadedBy:    userID,
		CreatedAt:     time.Now().UTC(),
	}

	if err := s.uploadedTemplates.CreateUploadedTemplate(ctx, t); err != nil {
		return nil, fmt.Errorf("storing uploaded template: %w", err)
	}

	return &t, nil
}

func (s *Service) UploadTemplatesBatch(ctx context.Context, files []*multipart.FileHeader, form *multipart.Form, modality, userID string) ([]domain.UploadedTemplate, error) {
	var results []domain.UploadedTemplate

	for _, header := range files {
		if err := validateDocx(header); err != nil {
			return nil, fmt.Errorf("file %s: %w", header.Filename, err)
		}

		file, err := header.Open()
		if err != nil {
			return nil, fmt.Errorf("opening file %s: %w", header.Filename, err)
		}

		extractedText, err := docx.ExtractText(file)
		file.Close()
		if err != nil {
			return nil, fmt.Errorf("extracting text from %s: %w", header.Filename, err)
		}

		t := domain.UploadedTemplate{
			ID:            uuid.NewString(),
			FileName:      uuid.NewString() + ".docx",
			OriginalName:  header.Filename,
			Modality:      modality,
			ExtractedText: extractedText,
			FileSize:      header.Size,
			UploadedBy:    userID,
			CreatedAt:     time.Now().UTC(),
		}

		if err := s.uploadedTemplates.CreateUploadedTemplate(ctx, t); err != nil {
			return nil, fmt.Errorf("storing uploaded template %s: %w", header.Filename, err)
		}

		results = append(results, t)
	}

	return results, nil
}

func (s *Service) ListUploadedTemplates(ctx context.Context) ([]domain.UploadedTemplate, error) {
	return s.uploadedTemplates.ListUploadedTemplates(ctx)
}

func (s *Service) DeleteUploadedTemplate(ctx context.Context, id string) error {
	return s.uploadedTemplates.DeleteUploadedTemplate(ctx, id)
}

func (s *Service) GetUploadedTemplate(ctx context.Context, id string) (*domain.UploadedTemplate, error) {
	return s.uploadedTemplates.GetUploadedTemplate(ctx, id)
}

func (s *Service) GetUploadedTemplatesByModality(ctx context.Context, modality string) ([]domain.UploadedTemplate, error) {
	return s.uploadedTemplates.GetUploadedTemplatesByModality(ctx, modality)
}

// validateDocx checks that the file has a .docx extension and is within the size limit.
func validateDocx(header *multipart.FileHeader) error {
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".docx" {
		return fmt.Errorf("invalid file type: expected .docx, got %s", ext)
	}

	if header.Size > maxDocxFileSize {
		return fmt.Errorf("file %s exceeds maximum size of 10MB", header.Filename)
	}

	return nil
}
