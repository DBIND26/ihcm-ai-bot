-- ============================================================================
-- IHCM AI Bot Widget v2 — DEFINITIVE Supabase/Postgres Schema
-- ============================================================================
-- Merged from:
--   • Dov's ihcm_bot_architecture/supabase_schema.sql (enums, triggers, ihcm_bot namespace)
--   • Claude's ihcm_ai_platform_v2_schema.sql (global_core, roles w/ UI, conversations, feedback, audit, v_building_context)
--
-- Architecture: layered context assembly
--   global_core → role → building profile → snapshot → intelligence → workflow → conversation
--
-- Run against a fresh Supabase project (Postgres 15+).
-- ============================================================================

-- ── Extensions ──
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Uncomment when you enable vector search for knowledge chunks:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ── Schema namespace ──
CREATE SCHEMA IF NOT EXISTS ihcm_bot;


-- ════════════════════════════════════════════════════════════════════════════
-- UTILITY: auto-update trigger function
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ihcm_bot.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- ENUMS
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'knowledge_status' AND n.nspname = 'ihcm_bot') THEN
    CREATE TYPE ihcm_bot.knowledge_status AS ENUM ('draft', 'approved', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'role_type' AND n.nspname = 'ihcm_bot') THEN
    CREATE TYPE ihcm_bot.role_type AS ENUM ('regional', 'administrator', 'don', 'mds', 'billing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'building_status' AND n.nspname = 'ihcm_bot') THEN
    CREATE TYPE ihcm_bot.building_status AS ENUM ('model', 'stable', 'watch', 'turnaround');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'doc_type' AND n.nspname = 'ihcm_bot') THEN
    CREATE TYPE ihcm_bot.doc_type AS ENUM (
      'core_context', 'policy', 'role_playbook', 'workflow_template',
      'building_profile', 'reference_guide', 'example_output',
      'intelligence_schema', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'intelligence_kind' AND n.nspname = 'ihcm_bot') THEN
    CREATE TYPE ihcm_bot.intelligence_kind AS ENUM (
      'daily_snapshot', 'weekly_brief', 'risk_packet',
      'opportunity_packet', 'comparison_brief'
    );
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. GLOBAL CORE
-- Org-wide prompt fragments injected into every request.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.global_core (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,         -- 'identity', 'safety_rules', 'tone', 'drafting_rules'
  label         TEXT NOT NULL,
  content       TEXT NOT NULL,                -- prompt fragment (Markdown or plain text)
  sort_order    INT NOT NULL DEFAULT 0,       -- controls injection order
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    TEXT
);

COMMENT ON TABLE ihcm_bot.global_core IS
  'Org-wide prompt fragments injected into every request. '
  'Examples: IHCM identity, no-PHI rules, ask-before-drafting rules, '
  'assumption labeling policy, output safety rules.';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. ROLES (role engines)
-- Combines UI identity (tabs, colors) with the role system prompt module.
-- In the JS static fallback these map to the ROLES array in bots.js.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,       -- 'mds', 'don', 'billing', 'admin', 'regional'
  role            ihcm_bot.role_type NOT NULL UNIQUE,
  tab_label       TEXT NOT NULL,              -- UI tab label
  name            TEXT NOT NULL,              -- full display name
  avatar          TEXT NOT NULL,              -- 2-3 letter initials
  color           TEXT NOT NULL,              -- hex accent
  color_bg        TEXT NOT NULL,              -- hex background tint
  system_prompt   TEXT NOT NULL,              -- role-layer prompt module
  decision_framework TEXT,                    -- how this role makes decisions
  boundaries      TEXT,                       -- "things this bot does not do"
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  approved_status ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner           TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ihcm_bot.roles IS
  'One row per bot role. system_prompt holds the role-layer fragment '
  'that sits between global core and building context at runtime.';


-- ════════════════════════════════════════════════════════════════════════════
-- 3. ROLE PLAYBOOKS
-- Canonical knowledge owned by the org, scoped to a role.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.role_playbooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES ihcm_bot.roles(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,                -- full playbook text (Markdown)
  category      TEXT,                         -- 'reimbursement', 'compliance', 'operations'
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  approved_status ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner         TEXT,
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role_id, slug)
);

COMMENT ON TABLE ihcm_bot.role_playbooks IS
  'Canonical, durable, org-owned knowledge scoped to a role. '
  'Retrieved when the bot needs deeper reference material.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. BUILDINGS
-- Stable identity facts that rarely change.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.buildings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,     -- 'arkadelphia', 'crossett', etc.
  label             TEXT NOT NULL,            -- 'Nightingale at Arkadelphia'
  short_name        TEXT NOT NULL,
  state             TEXT NOT NULL CHECK (state IN ('AR', 'OH', 'PA')),
  cms_id            TEXT UNIQUE,              -- CMS Provider ID
  bed_capacity      INT CHECK (bed_capacity IS NULL OR bed_capacity > 0),
  market_type       TEXT,                     -- 'rural', 'suburban', 'urban'
  strategic_status  ihcm_bot.building_status NOT NULL DEFAULT 'stable',
  strategic_label   TEXT,                     -- e.g. 'THE MODEL BUILDING'
  sort_order        INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  context_owner     TEXT,
  context_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buildings_state_status
  ON ihcm_bot.buildings(state, strategic_status);

COMMENT ON TABLE ihcm_bot.buildings IS
  'Stable building identity. Facts here change rarely (name, state, CMS ID, beds). '
  'strategic_status and strategic_label live here for quick portfolio views.';


-- ════════════════════════════════════════════════════════════════════════════
-- 5. BUILDING PROFILES
-- Semi-stable strategic facts. Review cadence: quarterly.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.building_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id     UUID NOT NULL REFERENCES ihcm_bot.buildings(id) ON DELETE CASCADE,
  payer_context   TEXT,
  market_summary  TEXT,
  referral_summary TEXT,
  physician_relationships TEXT,
  hospital_partners TEXT,
  growth_barriers   JSONB NOT NULL DEFAULT '[]'::JSONB,
  growth_opportunities JSONB NOT NULL DEFAULT '[]'::JSONB,
  survey_context  TEXT,
  staffing_context TEXT,
  reimbursement_context TEXT,
  risk_watchlist  TEXT,
  strategic_notes TEXT,
  confidence      TEXT DEFAULT 'high',        -- 'high', 'medium', 'low'
  review_cadence  TEXT DEFAULT 'quarterly',
  approved_status ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner           TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id)
);

COMMENT ON TABLE ihcm_bot.building_profiles IS
  'Semi-stable strategic context per building. Review quarterly. '
  'Referral map, payer context, growth barriers/opps, risk watchlist.';


-- ════════════════════════════════════════════════════════════════════════════
-- 6. BUILDING SNAPSHOTS
-- Frequently updated operational facts. Review: weekly or monthly.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.building_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id       UUID NOT NULL REFERENCES ihcm_bot.buildings(id) ON DELETE CASCADE,
  snapshot_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  census            INT CHECK (census IS NULL OR census >= 0),
  occupancy_gap     INT,                      -- beds below capacity
  skilled_mix_pct   NUMERIC(5,2),
  medicare_pct      NUMERIC(5,2),
  medicaid_pct      NUMERIC(5,2),
  managed_care_pct  NUMERIC(5,2),
  payer_mix         JSONB,                    -- full breakdown if needed
  referral_pressure TEXT,
  survey_risk_level TEXT,
  staffing_risk_level TEXT,
  reimbursement_risk_level TEXT,
  ar_issues         TEXT,
  top_priorities    TEXT[],                    -- top 3-5 priorities this period
  top_issues        JSONB NOT NULL DEFAULT '[]'::JSONB,
  top_opportunities JSONB NOT NULL DEFAULT '[]'::JSONB,
  raw_data          JSONB NOT NULL DEFAULT '{}'::JSONB,
  source            TEXT NOT NULL DEFAULT 'manual',
  confidence_score  NUMERIC(5,2),
  notes             TEXT,
  owner             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, snapshot_date)
);

CREATE INDEX idx_snapshots_building_date
  ON ihcm_bot.building_snapshots(building_id, snapshot_date DESC);

COMMENT ON TABLE ihcm_bot.building_snapshots IS
  'Time-series operational snapshots. One row per building per period. '
  'The most recent snapshot is injected into the building context layer.';


-- ════════════════════════════════════════════════════════════════════════════
-- 7. INTELLIGENCE RUNS + PACKETS + CROSS-BUILDING
-- AI- or analyst-generated intelligence.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.intelligence_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date      DATE NOT NULL,
  run_name      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  source        TEXT NOT NULL DEFAULT 'system',
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_intelligence_runs_date
  ON ihcm_bot.intelligence_runs(run_date DESC, created_at DESC);

CREATE TABLE ihcm_bot.building_intelligence_packets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id       UUID NOT NULL REFERENCES ihcm_bot.buildings(id) ON DELETE CASCADE,
  run_id            UUID REFERENCES ihcm_bot.intelligence_runs(id) ON DELETE SET NULL,
  packet_date       DATE NOT NULL,
  intelligence_kind ihcm_bot.intelligence_kind NOT NULL,
  headline          TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  top_risks         JSONB NOT NULL DEFAULT '[]'::JSONB,
  top_opportunities JSONB NOT NULL DEFAULT '[]'::JSONB,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::JSONB,
  key_metrics       JSONB NOT NULL DEFAULT '{}'::JSONB,
  narrative         TEXT,                     -- full intelligence brief
  source_refs       JSONB NOT NULL DEFAULT '[]'::JSONB,
  confidence_score  NUMERIC(5,2),
  freshness         TEXT DEFAULT 'current',   -- 'current', 'aging', 'stale'
  freshness_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, packet_date, intelligence_kind)
);

CREATE INDEX idx_intel_packets_building_date
  ON ihcm_bot.building_intelligence_packets(building_id, packet_date DESC);

COMMENT ON TABLE ihcm_bot.building_intelligence_packets IS
  'AI-generated intelligence packets per building. '
  'The latest packet is injected into the intelligence context layer.';

CREATE TABLE ihcm_bot.cross_building_intelligence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID REFERENCES ihcm_bot.intelligence_runs(id) ON DELETE SET NULL,
  insight_date  DATE NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ihcm_bot.cross_building_intelligence IS
  'Portfolio-level intelligence: regional priority rankings, '
  'cross-building denial patterns, system-wide MDS risks.';


-- ════════════════════════════════════════════════════════════════════════════
-- 8. WORKFLOW TEMPLATES
-- Structured workflows with inputs, output contracts, review checklists.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.workflow_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id           UUID NOT NULL REFERENCES ihcm_bot.roles(id) ON DELETE CASCADE,
  slug              TEXT UNIQUE NOT NULL,
  label             TEXT NOT NULL,
  description       TEXT,
  required_inputs   JSONB NOT NULL DEFAULT '[]'::JSONB,
  optional_inputs   JSONB NOT NULL DEFAULT '[]'::JSONB,
  missing_info_questions TEXT[],
  output_template   TEXT,                     -- prompt template with {{placeholders}}
  output_sections   TEXT[],
  output_contract   JSONB NOT NULL DEFAULT '{}'::JSONB,
  review_checklist  TEXT[],
  draft_mode_required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  approved_status   ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner             TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_role
  ON ihcm_bot.workflow_templates(role_id);

COMMENT ON TABLE ihcm_bot.workflow_templates IS
  'Structured workflows per role. Each defines inputs, a prompt template, '
  'expected output sections, and a review checklist.';


-- ════════════════════════════════════════════════════════════════════════════
-- 9. PROMPT PROFILES
-- Versioned, approvable prompt assembly configs per role + optional workflow.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.prompt_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  role_id           UUID NOT NULL REFERENCES ihcm_bot.roles(id) ON DELETE CASCADE,
  workflow_id       UUID REFERENCES ihcm_bot.workflow_templates(id) ON DELETE SET NULL,
  system_core       TEXT NOT NULL,            -- the assembled prompt core for this combo
  prompt_contract   JSONB NOT NULL DEFAULT '{}'::JSONB,
  approved_status   ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner             TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_profiles_role
  ON ihcm_bot.prompt_profiles(role_id);

COMMENT ON TABLE ihcm_bot.prompt_profiles IS
  'Versioned, approvable prompt assembly configs. '
  'Allows you to lock down the exact prompt used for a role+workflow combo.';


-- ════════════════════════════════════════════════════════════════════════════
-- 10. KNOWLEDGE DOCUMENTS + CHUNKS
-- Reference material: policies, guides, examples, cheat sheets.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.knowledge_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  doc_type        ihcm_bot.doc_type NOT NULL,
  audience        TEXT,
  role_scope      ihcm_bot.role_type,         -- NULL = all roles
  building_id     UUID REFERENCES ihcm_bot.buildings(id) ON DELETE SET NULL,
  state_scope     TEXT,                       -- 'AR', 'OH', 'PA', or NULL = all
  file_path       TEXT,
  source_url      TEXT,
  body_markdown   TEXT NOT NULL,
  tags            JSONB NOT NULL DEFAULT '[]'::JSONB,
  approved_status ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
  owner           TEXT,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_docs_type_role
  ON ihcm_bot.knowledge_documents(doc_type, role_scope);

CREATE INDEX idx_knowledge_docs_building
  ON ihcm_bot.knowledge_documents(building_id);

CREATE TABLE ihcm_bot.knowledge_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES ihcm_bot.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  heading         TEXT,
  content         TEXT NOT NULL,
  token_estimate  INT,
  -- embedding    vector(1536),               -- uncomment when pgvector is enabled
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_doc
  ON ihcm_bot.knowledge_chunks(document_id, chunk_index);


-- ════════════════════════════════════════════════════════════════════════════
-- 11. CONVERSATION SESSIONS + MESSAGES (Phase 2+)
-- Server-side conversation storage with retention controls.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.conversation_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT,                       -- authenticated user identifier
  role_slug       TEXT NOT NULL,
  building_slug   TEXT,
  workflow_slug   TEXT,
  is_draft_mode   BOOLEAN NOT NULL DEFAULT FALSE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB
);

CREATE TABLE ihcm_bot.conversation_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES ihcm_bot.conversation_sessions(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  is_draft        BOOLEAN NOT NULL DEFAULT FALSE,
  token_count     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session
  ON ihcm_bot.conversation_messages(session_id, created_at);


-- ════════════════════════════════════════════════════════════════════════════
-- 12. RESPONSE FEEDBACK (Phase 2+)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.response_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID NOT NULL REFERENCES ihcm_bot.conversation_messages(id) ON DELETE CASCADE,
  user_id         TEXT,
  rating          INT NOT NULL CHECK (rating IN (-1, 1)),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════════════
-- 13. AUDIT LOG
-- Track changes to critical configuration tables.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE ihcm_bot.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  action          TEXT NOT NULL,              -- 'insert', 'update', 'delete'
  changed_by      TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_values      JSONB,
  new_values      JSONB
);


-- ════════════════════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'global_core', 'roles', 'role_playbooks', 'buildings',
    'building_profiles', 'building_snapshots', 'workflow_templates',
    'prompt_profiles', 'knowledge_documents'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_set_updated_at ON ihcm_bot.%I; '
      'CREATE TRIGGER trg_%s_set_updated_at '
      'BEFORE UPDATE ON ihcm_bot.%I '
      'FOR EACH ROW EXECUTE FUNCTION ihcm_bot.set_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════════════════════════

-- Latest snapshot per building
CREATE OR REPLACE VIEW ihcm_bot.v_latest_snapshots AS
SELECT DISTINCT ON (s.building_id)
  s.*,
  b.slug AS building_slug,
  b.label AS building_label
FROM ihcm_bot.building_snapshots s
JOIN ihcm_bot.buildings b ON b.id = s.building_id
ORDER BY s.building_id, s.snapshot_date DESC, s.created_at DESC;

-- Latest intelligence packet per building (most recent of any kind)
CREATE OR REPLACE VIEW ihcm_bot.v_latest_intelligence AS
SELECT DISTINCT ON (p.building_id)
  p.*,
  b.slug AS building_slug,
  b.label AS building_label,
  r.run_date,
  r.source AS run_source
FROM ihcm_bot.building_intelligence_packets p
JOIN ihcm_bot.buildings b ON b.id = p.building_id
LEFT JOIN ihcm_bot.intelligence_runs r ON r.id = p.run_id
ORDER BY p.building_id, p.packet_date DESC, p.created_at DESC;

-- Latest intelligence per building per kind (for multi-kind queries)
CREATE OR REPLACE VIEW ihcm_bot.v_latest_intelligence_by_kind AS
SELECT DISTINCT ON (p.building_id, p.intelligence_kind)
  p.*,
  b.slug AS building_slug,
  b.label AS building_label
FROM ihcm_bot.building_intelligence_packets p
JOIN ihcm_bot.buildings b ON b.id = p.building_id
ORDER BY p.building_id, p.intelligence_kind, p.packet_date DESC, p.created_at DESC;

-- ── Composite: full building context (the workhorse view for api/chat.js) ──
CREATE OR REPLACE VIEW ihcm_bot.v_building_context AS
SELECT
  b.id        AS building_id,
  b.slug,
  b.label,
  b.short_name,
  b.state,
  b.cms_id,
  b.bed_capacity,
  b.market_type,
  b.strategic_status,
  b.strategic_label,
  -- Profile
  bp.payer_context,
  bp.market_summary,
  bp.referral_summary,
  bp.physician_relationships,
  bp.hospital_partners,
  bp.growth_barriers,
  bp.growth_opportunities,
  bp.survey_context,
  bp.staffing_context,
  bp.reimbursement_context,
  bp.risk_watchlist,
  bp.strategic_notes,
  bp.confidence       AS profile_confidence,
  bp.updated_at       AS profile_updated_at,
  bp.owner            AS profile_owner,
  -- Snapshot
  ls.snapshot_date,
  ls.census,
  ls.occupancy_gap,
  ls.skilled_mix_pct,
  ls.medicare_pct,
  ls.medicaid_pct,
  ls.managed_care_pct,
  ls.payer_mix,
  ls.referral_pressure,
  ls.survey_risk_level,
  ls.staffing_risk_level,
  ls.reimbursement_risk_level,
  ls.ar_issues,
  ls.top_priorities,
  ls.top_issues,
  ls.top_opportunities AS snapshot_opportunities,
  ls.confidence_score  AS snapshot_confidence,
  ls.updated_at        AS snapshot_updated_at,
  -- Intelligence
  li.headline          AS intel_headline,
  li.executive_summary AS intel_summary,
  li.intelligence_kind AS intel_kind,
  li.top_risks         AS intel_risks,
  li.top_opportunities AS intel_opportunities,
  li.recommended_actions AS intel_actions,
  li.key_metrics       AS intel_metrics,
  li.narrative         AS intel_narrative,
  li.freshness         AS intel_freshness,
  li.created_at        AS intel_created_at
FROM ihcm_bot.buildings b
LEFT JOIN ihcm_bot.building_profiles bp ON bp.building_id = b.id
LEFT JOIN ihcm_bot.v_latest_snapshots ls ON ls.building_id = b.id
LEFT JOIN ihcm_bot.v_latest_intelligence li ON li.building_id = b.id
WHERE b.is_active = TRUE;


-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (scaffolding)
-- Enable RLS on client-facing tables. Policies depend on your auth setup.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE ihcm_bot.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ihcm_bot.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ihcm_bot.response_feedback ENABLE ROW LEVEL SECURITY;

-- Example policy (uncomment and customize):
-- CREATE POLICY "Users see own sessions"
--   ON ihcm_bot.conversation_sessions FOR SELECT
--   USING (user_id = auth.uid()::text);


-- ============================================================================
-- END OF DEFINITIVE SCHEMA
-- ============================================================================
