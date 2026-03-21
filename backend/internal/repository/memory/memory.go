package memory

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
)

type store struct {
	mu                sync.RWMutex
	users             map[string]domain.User
	patients          map[string]domain.Patient
	templates         map[string]domain.Template
	protocols         map[string]domain.Protocol
	audit             []domain.AuditEvent
	uploadedTemplates map[string]domain.UploadedTemplate
	indexJobs         map[string]domain.TemplateIndexJob
	knowledgeItems    map[string][]domain.TemplateKnowledgeItem
}

func NewRepositories() repository.Repositories {
	now := time.Now().UTC().Format(time.RFC3339)

	s := &store{
		users: map[string]domain.User{
			"u-admin": {
				ID:           "u-admin",
				Email:        "admin@radassist.local",
				FullName:     "Администратор",
				PasswordHash: "admin123",
				Role:         domain.RoleAdmin,
				TwoFAEnabled: true,
			},
			"u-doctor": {
				ID:           "u-doctor",
				Email:        "doctor@radassist.local",
				FullName:     "Врач-рентгенолог",
				PasswordHash: "doctor123",
				Role:         domain.RoleDoctor,
				TwoFAEnabled: false,
			},
		},
		patients: map[string]domain.Patient{
			"1": {ID: "1", Name: "Иванов Иван Иванович", BirthDate: "1975-05-15", Gender: "male", Phone: "+7 (999) 123-45-67"},
			"2": {ID: "2", Name: "Петрова Мария Сергеевна", BirthDate: "1988-11-23", Gender: "female", Phone: "+7 (999) 987-65-43"},
		},
		templates: map[string]domain.Template{
			"t1": {ID: "t1", Name: "КТ органов грудной клетки", Modality: "CT", Content: "ТЕХНИКА ИССЛЕДОВАНИЯ:\n...", CreatedAt: now},
			"t2": {ID: "t2", Name: "МРТ головного мозга", Modality: "MRI", Content: "ТЕХНИКА ИССЛЕДОВАНИЯ:\n...", CreatedAt: now},
		},
		protocols:         map[string]domain.Protocol{},
		audit:             []domain.AuditEvent{},
		uploadedTemplates: map[string]domain.UploadedTemplate{},
		indexJobs:         map[string]domain.TemplateIndexJob{},
		knowledgeItems:    map[string][]domain.TemplateKnowledgeItem{},
	}

	for _, patient := range s.patients {
		tpl := s.templates["t1"]
		s.protocols["p-"+patient.ID] = domain.Protocol{
			ID:        "p-" + patient.ID,
			Patient:   patient,
			Modality:  "CT",
			Template:  &tpl,
			Content:   tpl.Content,
			CreatedAt: now,
			UpdatedAt: now,
			Status:    "draft",
		}
	}

	return repository.Repositories{
		Users:             &userRepo{s},
		Patients:          &patientRepo{s},
		Templates:         &templateRepo{s},
		Protocols:         &protocolRepo{s},
		Audit:             &auditRepo{s},
		UploadedTemplates: &uploadedTemplateRepo{s},
		Knowledge:         &knowledgeRepo{s},
	}
}

type userRepo struct{ s *store }

type patientRepo struct{ s *store }

type templateRepo struct{ s *store }

type protocolRepo struct{ s *store }

type auditRepo struct{ s *store }

type uploadedTemplateRepo struct{ s *store }

type knowledgeRepo struct{ s *store }

func (r *userRepo) FindByEmail(email string) (*domain.User, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	for _, user := range r.s.users {
		if strings.EqualFold(user.Email, email) {
			copy := user
			return &copy, nil
		}
	}

	return nil, errors.New("user not found")
}

func (r *userRepo) FindByID(id string) (*domain.User, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	user, ok := r.s.users[id]
	if !ok {
		return nil, errors.New("user not found")
	}

	copy := user
	return &copy, nil
}

func (r *patientRepo) List() ([]domain.Patient, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	patients := make([]domain.Patient, 0, len(r.s.patients))
	for _, patient := range r.s.patients {
		patients = append(patients, patient)
	}

	sort.Slice(patients, func(i, j int) bool {
		return patients[i].Name < patients[j].Name
	})

	return patients, nil
}

func (r *patientRepo) Create(patient domain.Patient) (domain.Patient, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	patient.ID = uuid.NewString()
	r.s.patients[patient.ID] = patient
	return patient, nil
}

func (r *patientRepo) Update(id string, patch domain.Patient) (domain.Patient, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	current, ok := r.s.patients[id]
	if !ok {
		return domain.Patient{}, errors.New("patient not found")
	}

	if patch.Name != "" {
		current.Name = patch.Name
	}
	if patch.BirthDate != "" {
		current.BirthDate = patch.BirthDate
	}
	if patch.Gender != "" {
		current.Gender = patch.Gender
	}
	if patch.Phone != "" {
		current.Phone = patch.Phone
	}
	if patch.Email != "" {
		current.Email = patch.Email
	}

	r.s.patients[id] = current
	return current, nil
}
func (r *patientRepo) Delete(id string) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	delete(r.s.patients, id)
	return nil
}

func (r *templateRepo) List() ([]domain.Template, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	templates := make([]domain.Template, 0, len(r.s.templates))
	for _, template := range r.s.templates {
		templates = append(templates, template)
	}

	sort.Slice(templates, func(i, j int) bool {
		return templates[i].CreatedAt > templates[j].CreatedAt
	})

	return templates, nil
}

func (r *templateRepo) Create(template domain.Template) (domain.Template, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	template.ID = uuid.NewString()
	template.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	r.s.templates[template.ID] = template
	return template, nil
}

func (r *templateRepo) Update(id string, patch domain.Template) (domain.Template, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	current, ok := r.s.templates[id]
	if !ok {
		return domain.Template{}, errors.New("template not found")
	}

	if patch.Name != "" {
		current.Name = patch.Name
	}
	if patch.Modality != "" {
		current.Modality = patch.Modality
	}
	if patch.Content != "" {
		current.Content = patch.Content
	}

	r.s.templates[id] = current
	return current, nil
}
func (r *templateRepo) Delete(id string) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	delete(r.s.templates, id)
	return nil
}

func (r *templateRepo) FindByID(id string) (*domain.Template, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	template, ok := r.s.templates[id]
	if !ok {
		return nil, errors.New("template not found")
	}

	copy := template
	return &copy, nil
}

func (r *protocolRepo) List() ([]domain.Protocol, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	protocols := make([]domain.Protocol, 0, len(r.s.protocols))
	for _, protocol := range r.s.protocols {
		protocols = append(protocols, protocol)
	}

	sort.Slice(protocols, func(i, j int) bool {
		return protocols[i].UpdatedAt > protocols[j].UpdatedAt
	})

	return protocols, nil
}

func (r *protocolRepo) FindByID(id string) (*domain.Protocol, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	protocol, ok := r.s.protocols[id]
	if !ok {
		return nil, errors.New("protocol not found")
	}

	copy := protocol
	return &copy, nil
}

func (r *protocolRepo) Create(protocol domain.Protocol) (domain.Protocol, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	protocol.ID = uuid.NewString()
	protocol.CreatedAt = now
	protocol.UpdatedAt = now
	protocol.Status = "draft"
	r.s.protocols[protocol.ID] = protocol
	return protocol, nil
}

func (r *protocolRepo) Update(id string, patch domain.Protocol) (domain.Protocol, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	current, ok := r.s.protocols[id]
	if !ok {
		return domain.Protocol{}, errors.New("protocol not found")
	}

	if patch.Content != "" {
		current.Content = patch.Content
	}
	if patch.Status != "" {
		current.Status = patch.Status
	}
	current.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.s.protocols[id] = current

	return current, nil
}

func (r *protocolRepo) Delete(id string) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	delete(r.s.protocols, id)
	return nil
}

func (r *auditRepo) Add(event domain.AuditEvent) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	event.ID = uuid.NewString()
	event.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	r.s.audit = append(r.s.audit, event)
	return nil
}

// --- UploadedTemplate repository ---

func (r *uploadedTemplateRepo) ListUploadedTemplates(_ context.Context, userID string) ([]domain.UploadedTemplate, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	items := make([]domain.UploadedTemplate, 0, len(r.s.uploadedTemplates))
	for _, t := range r.s.uploadedTemplates {
		if t.UploadedBy == userID {
			items = append(items, t)
		}
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

	return items, nil
}

func (r *uploadedTemplateRepo) CreateUploadedTemplate(_ context.Context, t domain.UploadedTemplate) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	r.s.uploadedTemplates[t.ID] = t
	return nil
}

func (r *uploadedTemplateRepo) UpdateUploadedTemplate(_ context.Context, t domain.UploadedTemplate) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	if _, ok := r.s.uploadedTemplates[t.ID]; !ok {
		return errors.New("uploaded template not found")
	}

	r.s.uploadedTemplates[t.ID] = t
	return nil
}

func (r *uploadedTemplateRepo) DeleteUploadedTemplate(_ context.Context, id, userID string) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	current, ok := r.s.uploadedTemplates[id]
	if !ok || current.UploadedBy != userID {
		return errors.New("uploaded template not found")
	}

	delete(r.s.uploadedTemplates, id)
	delete(r.s.knowledgeItems, id)
	return nil
}

func (r *uploadedTemplateRepo) GetUploadedTemplate(_ context.Context, id, userID string) (*domain.UploadedTemplate, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	t, ok := r.s.uploadedTemplates[id]
	if !ok || t.UploadedBy != userID {
		return nil, errors.New("uploaded template not found")
	}

	cp := t
	return &cp, nil
}

func (r *uploadedTemplateRepo) GetUploadedTemplatesByModality(_ context.Context, userID, modality string) ([]domain.UploadedTemplate, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	var items []domain.UploadedTemplate
	for _, t := range r.s.uploadedTemplates {
		if t.UploadedBy == userID && strings.EqualFold(t.Modality, modality) {
			items = append(items, t)
		}
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

	return items, nil
}

func (r *uploadedTemplateRepo) FindUploadedTemplates(_ context.Context, userID string, filter domain.UploadedTemplateFilter) ([]domain.UploadedTemplate, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	sourceIDs := make(map[string]struct{}, len(filter.SourceTemplateIDs))
	for _, id := range filter.SourceTemplateIDs {
		sourceIDs[id] = struct{}{}
	}

	statuses := make(map[domain.TemplateIndexStatus]struct{}, len(filter.IndexStatuses))
	for _, status := range filter.IndexStatuses {
		statuses[status] = struct{}{}
	}

	var items []domain.UploadedTemplate
	for _, t := range r.s.uploadedTemplates {
		if t.UploadedBy != userID {
			continue
		}
		if filter.Modality != "" && !strings.EqualFold(t.Modality, filter.Modality) {
			continue
		}
		if filter.StudyProfile != "" && !strings.EqualFold(t.StudyProfile, filter.StudyProfile) {
			continue
		}
		if len(sourceIDs) > 0 {
			if _, ok := sourceIDs[t.ID]; !ok {
				continue
			}
		}
		if len(statuses) > 0 {
			if _, ok := statuses[t.IndexStatus]; !ok {
				continue
			}
		}
		if !containsAllTags(t.Tags, filter.Tags) {
			continue
		}
		items = append(items, t)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})

	return items, nil
}

func (r *knowledgeRepo) CreateIndexJob(_ context.Context, job domain.TemplateIndexJob) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	r.s.indexJobs[job.ID] = job
	return nil
}

func (r *knowledgeRepo) GetIndexJob(_ context.Context, jobID, userID string) (*domain.TemplateIndexJob, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	job, ok := r.s.indexJobs[jobID]
	if !ok || job.CreatedBy != userID {
		return nil, errors.New("index job not found")
	}

	copy := job
	return &copy, nil
}

func (r *knowledgeRepo) ClaimPendingIndexJob(_ context.Context) (*domain.TemplateIndexJob, error) {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	var chosen *domain.TemplateIndexJob
	for _, job := range r.s.indexJobs {
		if job.Status != domain.TemplateIndexJobPending {
			continue
		}
		if chosen == nil || job.CreatedAt.Before(chosen.CreatedAt) {
			cp := job
			chosen = &cp
		}
	}
	if chosen == nil {
		return nil, nil
	}

	now := time.Now().UTC()
	chosen.Status = domain.TemplateIndexJobRunning
	chosen.StartedAt = &now
	chosen.LastHeartbeatAt = &now
	r.s.indexJobs[chosen.ID] = *chosen

	copy := *chosen
	return &copy, nil
}

func (r *knowledgeRepo) UpdateIndexJob(_ context.Context, job domain.TemplateIndexJob) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	if _, ok := r.s.indexJobs[job.ID]; !ok {
		return errors.New("index job not found")
	}

	r.s.indexJobs[job.ID] = job
	return nil
}

func (r *knowledgeRepo) ReplaceTemplateKnowledge(_ context.Context, template domain.UploadedTemplate, items []domain.TemplateKnowledgeItem) error {
	r.s.mu.Lock()
	defer r.s.mu.Unlock()

	r.s.knowledgeItems[template.ID] = append([]domain.TemplateKnowledgeItem(nil), items...)
	return nil
}

func (r *knowledgeRepo) SearchKnowledge(_ context.Context, params domain.KnowledgeSearchParams) ([]domain.TemplateKnowledgeItem, error) {
	r.s.mu.RLock()
	defer r.s.mu.RUnlock()

	sourceIDs := make(map[string]struct{}, len(params.SourceTemplateIDs))
	for _, id := range params.SourceTemplateIDs {
		sourceIDs[id] = struct{}{}
	}

	query := strings.ToLower(strings.TrimSpace(params.Query))
	var items []domain.TemplateKnowledgeItem
	for _, group := range r.s.knowledgeItems {
		for _, item := range group {
			if item.UploadedBy != params.UserID {
				continue
			}
			if params.Modality != "" && !strings.EqualFold(item.Modality, params.Modality) {
				continue
			}
			if params.StudyProfile != "" && !strings.EqualFold(item.StudyProfile, params.StudyProfile) {
				continue
			}
			if len(sourceIDs) > 0 {
				if _, ok := sourceIDs[item.TemplateID]; !ok {
					continue
				}
			}
			if !containsAllTags(item.Tags, params.Tags) {
				continue
			}
			if query != "" {
				content := strings.ToLower(item.SearchText + " " + item.Content)
				if !strings.Contains(content, query) {
					continue
				}
			}
			items = append(items, item)
		}
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].SortOrder == items[j].SortOrder {
			return items[i].CreatedAt.Before(items[j].CreatedAt)
		}
		return items[i].SortOrder < items[j].SortOrder
	})
	if params.Limit > 0 && len(items) > params.Limit {
		items = items[:params.Limit]
	}

	return items, nil
}

func containsAllTags(current, required []string) bool {
	if len(required) == 0 {
		return true
	}

	lookup := make(map[string]struct{}, len(current))
	for _, tag := range current {
		lookup[strings.ToLower(strings.TrimSpace(tag))] = struct{}{}
	}
	for _, tag := range required {
		if _, ok := lookup[strings.ToLower(strings.TrimSpace(tag))]; !ok {
			return false
		}
	}

	return true
}
