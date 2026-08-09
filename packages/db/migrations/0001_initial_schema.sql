-- OpenPaperReview Initial Schema Migration
-- Generated from packages/db/src/schema.ts

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE provider_type AS ENUM ('openai', 'anthropic', 'gemini', 'openrouter');
CREATE TYPE venue_bundle_status AS ENUM ('rubric_only', 'calibrated', 'deprecated');
CREATE TYPE review_job_status AS ENUM ('pending', 'gate', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE review_language AS ENUM ('en', 'zh');
CREATE TYPE job_event_type AS ENUM ('stage_start', 'stage_complete', 'stage_error', 'progress', 'info');
CREATE TYPE gate_finding_type AS ENUM ('hard_stop', 'needs_confirmation');
CREATE TYPE specialist_dimension AS ENUM ('methodology', 'novelty', 'experiments', 'writing', 'ethics');
CREATE TYPE export_format AS ENUM ('json', 'markdown', 'pdf');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- API Tokens
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);

-- Model Profiles
CREATE TABLE model_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  provider provider_type NOT NULL,
  model VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider Usage
CREATE TABLE provider_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_profile_id UUID REFERENCES model_profiles(id) ON DELETE CASCADE,
  review_job_id UUID,
  stage VARCHAR(50) NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_usage_job ON provider_usage(review_job_id);
CREATE INDEX idx_provider_usage_profile ON provider_usage(model_profile_id);

-- Venue Bundles
CREATE TABLE venue_bundles (
  id TEXT PRIMARY KEY,
  conference_id VARCHAR(50) NOT NULL,
  track VARCHAR(50) NOT NULL,
  year INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status venue_bundle_status NOT NULL DEFAULT 'rubric_only',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_venue_bundles_conference ON venue_bundles(conference_id);

-- Papers
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(1000) NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',
  abstract TEXT NOT NULL DEFAULT '',
  arxiv_id VARCHAR(50),
  file_hash VARCHAR(64) NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_papers_arxiv_id ON papers(arxiv_id);
CREATE INDEX idx_papers_uploaded_by ON papers(uploaded_by_id);

-- Paper Pages
CREATE TABLE paper_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL DEFAULT '',
  ocr_content TEXT,
  image_path TEXT NOT NULL DEFAULT '',
  coordinates JSONB NOT NULL DEFAULT '{}',
  UNIQUE(paper_id, page_number)
);
CREATE INDEX idx_paper_pages_paper ON paper_pages(paper_id);

-- Paper Chunks
CREATE TABLE paper_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  page_id UUID REFERENCES paper_pages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  section_title VARCHAR(500) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  start_page INTEGER NOT NULL,
  end_page INTEGER NOT NULL,
  UNIQUE(paper_id, chunk_index)
);
CREATE INDEX idx_paper_chunks_paper ON paper_chunks(paper_id);

-- References
CREATE TABLE "references" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  ref_index INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  title TEXT,
  authors JSONB NOT NULL DEFAULT '[]',
  year INTEGER,
  doi VARCHAR(255),
  open_alex_id VARCHAR(255),
  semantic_scholar_id VARCHAR(255),
  verified BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(paper_id, ref_index)
);
CREATE INDEX idx_references_paper ON "references"(paper_id);

-- Review Jobs
CREATE TABLE review_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  venue_bundle_id TEXT NOT NULL,
  status review_job_status NOT NULL DEFAULT 'pending',
  current_stage VARCHAR(50),
  language review_language NOT NULL DEFAULT 'en',
  config JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_jobs_paper ON review_jobs(paper_id);
CREATE INDEX idx_review_jobs_status ON review_jobs(status);
CREATE INDEX idx_review_jobs_created_by ON review_jobs(created_by);

-- Job Events
CREATE TABLE job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id UUID NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  type job_event_type NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_events_job ON job_events(review_job_id);
CREATE INDEX idx_job_events_created ON job_events(created_at);

-- Gate Findings
CREATE TABLE gate_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id UUID NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
  type gate_finding_type NOT NULL,
  category VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]',
  page_numbers INTEGER[] NOT NULL DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_gate_findings_job ON gate_findings(review_job_id);

-- Specialist Audits
CREATE TABLE specialist_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id UUID NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
  dimension specialist_dimension NOT NULL,
  findings JSONB NOT NULL DEFAULT '[]',
  prompt_version VARCHAR(50) NOT NULL,
  model_used VARCHAR(100) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_specialist_audits_job ON specialist_audits(review_job_id);

-- Score Candidates
CREATE TABLE score_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id UUID NOT NULL REFERENCES review_jobs(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  rationale TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]',
  weaknesses JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
  prompt_version VARCHAR(50) NOT NULL,
  model_used VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_candidates_job ON score_candidates(review_job_id);

-- Review Results
CREATE TABLE review_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_job_id UUID NOT NULL UNIQUE REFERENCES review_jobs(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL,
  confidence NUMERIC(3, 2) NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  strengths JSONB NOT NULL DEFAULT '[]',
  major_issues JSONB NOT NULL DEFAULT '[]',
  minor_issues JSONB NOT NULL DEFAULT '[]',
  questions JSONB NOT NULL DEFAULT '[]',
  main_review TEXT NOT NULL DEFAULT '',
  optimistic_view TEXT NOT NULL DEFAULT '',
  critical_view TEXT NOT NULL DEFAULT '',
  improvements JSONB NOT NULL DEFAULT '[]',
  calibration JSONB NOT NULL DEFAULT '{}',
  prompt_versions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Annotations
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_result_id UUID NOT NULL REFERENCES review_results(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  x NUMERIC(8, 4) NOT NULL DEFAULT 0,
  y NUMERIC(8, 4) NOT NULL DEFAULT 0,
  width NUMERIC(8, 4) NOT NULL DEFAULT 0,
  height NUMERIC(8, 4) NOT NULL DEFAULT 0,
  content TEXT NOT NULL DEFAULT '',
  type VARCHAR(50) NOT NULL DEFAULT 'highlight'
);
CREATE INDEX idx_annotations_result ON annotations(review_result_id);
CREATE INDEX idx_annotations_paper ON annotations(paper_id);

-- Exports
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_result_id UUID NOT NULL REFERENCES review_results(id) ON DELETE CASCADE,
  format export_format NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exports_result ON exports(review_result_id);

-- Add FK constraint for provider_usage -> review_jobs (deferred because of ordering)
ALTER TABLE provider_usage
  ADD CONSTRAINT fk_provider_usage_job
  FOREIGN KEY (review_job_id) REFERENCES review_jobs(id) ON DELETE CASCADE;
