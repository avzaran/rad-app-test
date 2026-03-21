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
