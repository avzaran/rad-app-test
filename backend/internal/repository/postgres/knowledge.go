package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/radassist/backend/internal/domain"
	"github.com/radassist/backend/internal/repository"
)

const knowledgeSchema = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS uploaded_templates (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  modality TEXT NOT NULL,
  study_profile TEXT NOT NULL,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  classification_mode TEXT NOT NULL,
  extracted_text TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by TEXT NOT NULL,
  index_status TEXT NOT NULL,
  last_indexed_at TIMESTAMPTZ,
  last_index_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploaded_templates_by_owner_idx
  ON uploaded_templates (uploaded_by, modality, study_profile, created_at DESC);

CREATE TABLE IF NOT EXISTS template_index_jobs (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  modality TEXT NOT NULL,
  study_profile TEXT NOT NULL,
  source_template_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  total_templates INT NOT NULL DEFAULT 0,
  processed_templates INT NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS template_index_jobs_owner_idx
  ON template_index_jobs (created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS template_knowledge_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES uploaded_templates(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  modality TEXT NOT NULL,
  study_profile TEXT NOT NULL,
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  section TEXT NOT NULL,
  category TEXT NOT NULL,
  anatomy_terms_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  pathology_terms_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_text TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS template_knowledge_items_owner_idx
  ON template_knowledge_items (uploaded_by, modality, study_profile, template_id, sort_order);

CREATE INDEX IF NOT EXISTS template_knowledge_items_search_fts_idx
  ON template_knowledge_items USING GIN (to_tsvector('simple', search_text));

CREATE INDEX IF NOT EXISTS template_knowledge_items_search_trgm_idx
  ON template_knowledge_items USING GIN (search_text gin_trgm_ops);
`

type KnowledgeStore struct {
	db *sql.DB
}

var (
	_ repository.UploadedTemplateRepository = (*KnowledgeStore)(nil)
	_ repository.KnowledgeRepository        = (*KnowledgeStore)(nil)
)

func Open(ctx context.Context, dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return db, nil
}

func EnsureSchema(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, knowledgeSchema); err != nil {
		return fmt.Errorf("ensure knowledge schema: %w", err)
	}
	return nil
}

func NewKnowledgeStore(db *sql.DB) *KnowledgeStore {
	return &KnowledgeStore{db: db}
}

func (s *KnowledgeStore) ListUploadedTemplates(ctx context.Context, userID string) ([]domain.UploadedTemplate, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, file_name, original_name, modality, study_profile, tags_json, classification_mode,
		       extracted_text, file_size, uploaded_by, index_status, last_indexed_at, last_index_error, created_at
		FROM uploaded_templates
		WHERE uploaded_by = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list uploaded templates: %w", err)
	}
	defer rows.Close()

	return scanUploadedTemplates(rows)
}

func (s *KnowledgeStore) CreateUploadedTemplate(ctx context.Context, t domain.UploadedTemplate) error {
	tagsJSON, err := json.Marshal(t.Tags)
	if err != nil {
		return fmt.Errorf("marshal tags: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO uploaded_templates (
			id, file_name, original_name, modality, study_profile, tags_json, classification_mode,
			extracted_text, file_size, uploaded_by, index_status, last_indexed_at, last_index_error, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14
		)
	`,
		t.ID,
		t.FileName,
		t.OriginalName,
		t.Modality,
		t.StudyProfile,
		string(tagsJSON),
		string(t.ClassificationMode),
		t.ExtractedText,
		t.FileSize,
		t.UploadedBy,
		string(t.IndexStatus),
		t.LastIndexedAt,
		t.LastIndexError,
		t.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("insert uploaded template: %w", err)
	}

	return nil
}

func (s *KnowledgeStore) UpdateUploadedTemplate(ctx context.Context, t domain.UploadedTemplate) error {
	tagsJSON, err := json.Marshal(t.Tags)
	if err != nil {
		return fmt.Errorf("marshal tags: %w", err)
	}

	res, err := s.db.ExecContext(ctx, `
		UPDATE uploaded_templates
		SET study_profile = $1,
		    tags_json = $2::jsonb,
		    classification_mode = $3,
		    extracted_text = $4,
		    index_status = $5,
		    last_indexed_at = $6,
		    last_index_error = $7
		WHERE id = $8 AND uploaded_by = $9
	`,
		t.StudyProfile,
		string(tagsJSON),
		string(t.ClassificationMode),
		t.ExtractedText,
		string(t.IndexStatus),
		t.LastIndexedAt,
		t.LastIndexError,
		t.ID,
		t.UploadedBy,
	)
	if err != nil {
		return fmt.Errorf("update uploaded template: %w", err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("uploaded template not found")
	}

	return nil
}

func (s *KnowledgeStore) DeleteUploadedTemplate(ctx context.Context, id, userID string) error {
	res, err := s.db.ExecContext(ctx, `
		DELETE FROM uploaded_templates
		WHERE id = $1 AND uploaded_by = $2
	`, id, userID)
	if err != nil {
		return fmt.Errorf("delete uploaded template: %w", err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return errors.New("uploaded template not found")
	}

	return nil
}

func (s *KnowledgeStore) GetUploadedTemplate(ctx context.Context, id, userID string) (*domain.UploadedTemplate, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, file_name, original_name, modality, study_profile, tags_json, classification_mode,
		       extracted_text, file_size, uploaded_by, index_status, last_indexed_at, last_index_error, created_at
		FROM uploaded_templates
		WHERE id = $1 AND uploaded_by = $2
	`, id, userID)
	if err != nil {
		return nil, fmt.Errorf("get uploaded template: %w", err)
	}
	defer rows.Close()

	templates, err := scanUploadedTemplates(rows)
	if err != nil {
		return nil, err
	}
	if len(templates) == 0 {
		return nil, errors.New("uploaded template not found")
	}

	return &templates[0], nil
}

func (s *KnowledgeStore) GetUploadedTemplatesByModality(ctx context.Context, userID, modality string) ([]domain.UploadedTemplate, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, file_name, original_name, modality, study_profile, tags_json, classification_mode,
		       extracted_text, file_size, uploaded_by, index_status, last_indexed_at, last_index_error, created_at
		FROM uploaded_templates
		WHERE uploaded_by = $1 AND modality = $2
		ORDER BY created_at DESC
	`, userID, modality)
	if err != nil {
		return nil, fmt.Errorf("get uploaded templates by modality: %w", err)
	}
	defer rows.Close()

	return scanUploadedTemplates(rows)
}

func (s *KnowledgeStore) FindUploadedTemplates(ctx context.Context, userID string, filter domain.UploadedTemplateFilter) ([]domain.UploadedTemplate, error) {
	items, err := s.ListUploadedTemplates(ctx, userID)
	if err != nil {
		return nil, err
	}

	sourceIDs := make(map[string]struct{}, len(filter.SourceTemplateIDs))
	for _, id := range filter.SourceTemplateIDs {
		sourceIDs[id] = struct{}{}
	}

	statuses := make(map[domain.TemplateIndexStatus]struct{}, len(filter.IndexStatuses))
	for _, status := range filter.IndexStatuses {
		statuses[status] = struct{}{}
	}

	filtered := make([]domain.UploadedTemplate, 0, len(items))
	for _, item := range items {
		if filter.Modality != "" && !strings.EqualFold(item.Modality, filter.Modality) {
			continue
		}
		if filter.StudyProfile != "" && !strings.EqualFold(item.StudyProfile, filter.StudyProfile) {
			continue
		}
		if len(sourceIDs) > 0 {
			if _, ok := sourceIDs[item.ID]; !ok {
				continue
			}
		}
		if len(statuses) > 0 {
			if _, ok := statuses[item.IndexStatus]; !ok {
				continue
			}
		}
		if !containsAllTags(item.Tags, filter.Tags) {
			continue
		}
		filtered = append(filtered, item)
	}

	return filtered, nil
}

func (s *KnowledgeStore) CreateIndexJob(ctx context.Context, job domain.TemplateIndexJob) error {
	sourceIDsJSON, err := json.Marshal(job.SourceTemplateIDs)
	if err != nil {
		return fmt.Errorf("marshal source template ids: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO template_index_jobs (
			id, created_by, modality, study_profile, source_template_ids_json, status,
			total_templates, processed_templates, last_error, created_at, started_at, finished_at, last_heartbeat_at
		) VALUES (
			$1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13
		)
	`,
		job.ID,
		job.CreatedBy,
		job.Modality,
		job.StudyProfile,
		string(sourceIDsJSON),
		string(job.Status),
		job.TotalTemplates,
		job.ProcessedTemplates,
		job.LastError,
		job.CreatedAt,
		job.StartedAt,
		job.FinishedAt,
		job.LastHeartbeatAt,
	)
	if err != nil {
		return fmt.Errorf("create index job: %w", err)
	}

	return nil
}

func (s *KnowledgeStore) GetIndexJob(ctx context.Context, jobID, userID string) (*domain.TemplateIndexJob, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, created_by, modality, study_profile, source_template_ids_json, status,
		       total_templates, processed_templates, last_error, created_at, started_at, finished_at, last_heartbeat_at
		FROM template_index_jobs
		WHERE id = $1 AND created_by = $2
	`, jobID, userID)

	job, err := scanIndexJob(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("index job not found")
		}
		return nil, fmt.Errorf("get index job: %w", err)
	}

	return job, nil
}

func (s *KnowledgeStore) ClaimPendingIndexJob(ctx context.Context) (*domain.TemplateIndexJob, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin claim index job tx: %w", err)
	}
	defer tx.Rollback()

	row := tx.QueryRowContext(ctx, `
		SELECT id, created_by, modality, study_profile, source_template_ids_json, status,
		       total_templates, processed_templates, last_error, created_at, started_at, finished_at, last_heartbeat_at
		FROM template_index_jobs
		WHERE status = $1
		ORDER BY created_at ASC
		LIMIT 1
		FOR UPDATE SKIP LOCKED
	`, string(domain.TemplateIndexJobPending))

	job, err := scanIndexJob(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			if err := tx.Commit(); err != nil {
				return nil, fmt.Errorf("commit empty claim tx: %w", err)
			}
			return nil, nil
		}
		return nil, fmt.Errorf("claim index job: %w", err)
	}

	now := time.Now().UTC()
	job.Status = domain.TemplateIndexJobRunning
	job.StartedAt = &now
	job.LastHeartbeatAt = &now

	if err := updateIndexJobTx(ctx, tx, *job); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit claim index job tx: %w", err)
	}

	return job, nil
}

func (s *KnowledgeStore) UpdateIndexJob(ctx context.Context, job domain.TemplateIndexJob) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE template_index_jobs
		SET status = $1,
		    total_templates = $2,
		    processed_templates = $3,
		    last_error = $4,
		    started_at = $5,
		    finished_at = $6,
		    last_heartbeat_at = $7
		WHERE id = $8
	`,
		string(job.Status),
		job.TotalTemplates,
		job.ProcessedTemplates,
		job.LastError,
		job.StartedAt,
		job.FinishedAt,
		job.LastHeartbeatAt,
		job.ID,
	)
	if err != nil {
		return fmt.Errorf("update index job: %w", err)
	}

	return nil
}

func (s *KnowledgeStore) ReplaceTemplateKnowledge(ctx context.Context, template domain.UploadedTemplate, items []domain.TemplateKnowledgeItem) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin replace template knowledge tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		DELETE FROM template_knowledge_items
		WHERE template_id = $1 AND uploaded_by = $2
	`, template.ID, template.UploadedBy); err != nil {
		return fmt.Errorf("delete existing template knowledge: %w", err)
	}

	for _, item := range items {
		tagsJSON, err := json.Marshal(item.Tags)
		if err != nil {
			return fmt.Errorf("marshal item tags: %w", err)
		}
		anatomyJSON, err := json.Marshal(item.AnatomyTerms)
		if err != nil {
			return fmt.Errorf("marshal anatomy terms: %w", err)
		}
		pathologyJSON, err := json.Marshal(item.PathologyTerms)
		if err != nil {
			return fmt.Errorf("marshal pathology terms: %w", err)
		}
		metadataJSON, err := json.Marshal(item.Metadata)
		if err != nil {
			return fmt.Errorf("marshal knowledge metadata: %w", err)
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO template_knowledge_items (
				id, template_id, uploaded_by, modality, study_profile, tags_json, section, category,
				anatomy_terms_json, pathology_terms_json, search_text, content, sort_order, metadata_json, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, $15
			)
		`,
			item.ID,
			template.ID,
			template.UploadedBy,
			item.Modality,
			item.StudyProfile,
			string(tagsJSON),
			item.Section,
			string(item.Category),
			string(anatomyJSON),
			string(pathologyJSON),
			item.SearchText,
			item.Content,
			item.SortOrder,
			string(metadataJSON),
			item.CreatedAt,
		); err != nil {
			return fmt.Errorf("insert template knowledge item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit replace template knowledge tx: %w", err)
	}

	return nil
}

func (s *KnowledgeStore) SearchKnowledge(ctx context.Context, params domain.KnowledgeSearchParams) ([]domain.TemplateKnowledgeItem, error) {
	query := strings.TrimSpace(params.Query)
	limit := params.Limit
	if limit <= 0 {
		limit = 10
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, template_id, uploaded_by, modality, study_profile, tags_json, section, category,
		       anatomy_terms_json, pathology_terms_json, search_text, content, sort_order, metadata_json, created_at
		FROM template_knowledge_items
		WHERE uploaded_by = $1
		  AND ($2 = '' OR modality = $2)
		  AND ($3 = '' OR LOWER(study_profile) = LOWER($3))
		  AND (
		    $4 = '' OR
		    to_tsvector('simple', search_text) @@ plainto_tsquery('simple', $4) OR
		    search_text ILIKE '%' || $4 || '%' OR
		    similarity(search_text, $4) > 0.08
		  )
		ORDER BY
		  CASE
		    WHEN $4 = '' THEN 0
		    ELSE ts_rank_cd(to_tsvector('simple', search_text), plainto_tsquery('simple', $4))
		  END DESC,
		  CASE
		    WHEN $4 = '' THEN 0
		    ELSE similarity(search_text, $4)
		  END DESC,
		  sort_order ASC
		LIMIT $5
	`, params.UserID, params.Modality, params.StudyProfile, query, limit*3)
	if err != nil {
		return nil, fmt.Errorf("search knowledge: %w", err)
	}
	defer rows.Close()

	var items []domain.TemplateKnowledgeItem
	for rows.Next() {
		item, err := scanKnowledgeItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate knowledge rows: %w", err)
	}

	sourceIDs := make(map[string]struct{}, len(params.SourceTemplateIDs))
	for _, id := range params.SourceTemplateIDs {
		sourceIDs[id] = struct{}{}
	}

	filtered := make([]domain.TemplateKnowledgeItem, 0, len(items))
	for _, item := range items {
		if len(sourceIDs) > 0 {
			if _, ok := sourceIDs[item.TemplateID]; !ok {
				continue
			}
		}
		if !containsAllTags(item.Tags, params.Tags) {
			continue
		}
		filtered = append(filtered, item)
		if len(filtered) == limit {
			break
		}
	}

	return filtered, nil
}

func updateIndexJobTx(ctx context.Context, tx *sql.Tx, job domain.TemplateIndexJob) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE template_index_jobs
		SET status = $1,
		    total_templates = $2,
		    processed_templates = $3,
		    last_error = $4,
		    started_at = $5,
		    finished_at = $6,
		    last_heartbeat_at = $7
		WHERE id = $8
	`,
		string(job.Status),
		job.TotalTemplates,
		job.ProcessedTemplates,
		job.LastError,
		job.StartedAt,
		job.FinishedAt,
		job.LastHeartbeatAt,
		job.ID,
	); err != nil {
		return fmt.Errorf("update index job in tx: %w", err)
	}
	return nil
}

func scanUploadedTemplates(rows *sql.Rows) ([]domain.UploadedTemplate, error) {
	var items []domain.UploadedTemplate
	for rows.Next() {
		var (
			item          domain.UploadedTemplate
			tagsJSON      []byte
			mode          string
			indexStatus   string
			lastIndexedAt sql.NullTime
		)

		if err := rows.Scan(
			&item.ID,
			&item.FileName,
			&item.OriginalName,
			&item.Modality,
			&item.StudyProfile,
			&tagsJSON,
			&mode,
			&item.ExtractedText,
			&item.FileSize,
			&item.UploadedBy,
			&indexStatus,
			&lastIndexedAt,
			&item.LastIndexError,
			&item.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan uploaded template: %w", err)
		}
		if err := json.Unmarshal(tagsJSON, &item.Tags); err != nil {
			return nil, fmt.Errorf("unmarshal template tags: %w", err)
		}
		item.ClassificationMode = domain.TemplateClassificationMode(mode)
		item.IndexStatus = domain.TemplateIndexStatus(indexStatus)
		if lastIndexedAt.Valid {
			ts := lastIndexedAt.Time
			item.LastIndexedAt = &ts
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate uploaded templates rows: %w", err)
	}

	return items, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanIndexJob(row rowScanner) (*domain.TemplateIndexJob, error) {
	var (
		job             domain.TemplateIndexJob
		sourceIDsJSON   []byte
		status          string
		startedAt       sql.NullTime
		finishedAt      sql.NullTime
		lastHeartbeatAt sql.NullTime
	)

	if err := row.Scan(
		&job.ID,
		&job.CreatedBy,
		&job.Modality,
		&job.StudyProfile,
		&sourceIDsJSON,
		&status,
		&job.TotalTemplates,
		&job.ProcessedTemplates,
		&job.LastError,
		&job.CreatedAt,
		&startedAt,
		&finishedAt,
		&lastHeartbeatAt,
	); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(sourceIDsJSON, &job.SourceTemplateIDs); err != nil {
		return nil, fmt.Errorf("unmarshal source template ids: %w", err)
	}
	job.Status = domain.TemplateIndexJobStatus(status)
	if startedAt.Valid {
		ts := startedAt.Time
		job.StartedAt = &ts
	}
	if finishedAt.Valid {
		ts := finishedAt.Time
		job.FinishedAt = &ts
	}
	if lastHeartbeatAt.Valid {
		ts := lastHeartbeatAt.Time
		job.LastHeartbeatAt = &ts
	}

	return &job, nil
}

func scanKnowledgeItem(row rowScanner) (domain.TemplateKnowledgeItem, error) {
	var (
		item          domain.TemplateKnowledgeItem
		tagsJSON      []byte
		category      string
		anatomyJSON   []byte
		pathologyJSON []byte
		metadataJSON  []byte
	)

	if err := row.Scan(
		&item.ID,
		&item.TemplateID,
		&item.UploadedBy,
		&item.Modality,
		&item.StudyProfile,
		&tagsJSON,
		&item.Section,
		&category,
		&anatomyJSON,
		&pathologyJSON,
		&item.SearchText,
		&item.Content,
		&item.SortOrder,
		&metadataJSON,
		&item.CreatedAt,
	); err != nil {
		return item, fmt.Errorf("scan knowledge item: %w", err)
	}
	if err := json.Unmarshal(tagsJSON, &item.Tags); err != nil {
		return item, fmt.Errorf("unmarshal knowledge tags: %w", err)
	}
	if err := json.Unmarshal(anatomyJSON, &item.AnatomyTerms); err != nil {
		return item, fmt.Errorf("unmarshal anatomy terms: %w", err)
	}
	if err := json.Unmarshal(pathologyJSON, &item.PathologyTerms); err != nil {
		return item, fmt.Errorf("unmarshal pathology terms: %w", err)
	}
	if err := json.Unmarshal(metadataJSON, &item.Metadata); err != nil {
		return item, fmt.Errorf("unmarshal knowledge metadata: %w", err)
	}
	item.Category = domain.KnowledgeItemCategory(category)

	return item, nil
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
