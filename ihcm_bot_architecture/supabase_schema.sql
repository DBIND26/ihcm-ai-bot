-- IHCM Bot knowledge and intelligence schema
-- Draft for Supabase/Postgres

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS ihcm_bot;

CREATE OR REPLACE FUNCTION ihcm_bot.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'knowledge_status'
          AND n.nspname = 'ihcm_bot'
    ) THEN
        CREATE TYPE ihcm_bot.knowledge_status AS ENUM ('draft', 'approved', 'archived');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'role_type'
          AND n.nspname = 'ihcm_bot'
    ) THEN
        CREATE TYPE ihcm_bot.role_type AS ENUM ('regional', 'administrator', 'don', 'mds', 'billing');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'building_status'
          AND n.nspname = 'ihcm_bot'
    ) THEN
        CREATE TYPE ihcm_bot.building_status AS ENUM ('model', 'stable', 'watch', 'turnaround');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'doc_type'
          AND n.nspname = 'ihcm_bot'
    ) THEN
        CREATE TYPE ihcm_bot.doc_type AS ENUM (
            'core_context',
            'policy',
            'role_playbook',
            'workflow_template',
            'building_profile',
            'reference_guide',
            'example_output',
            'intelligence_schema',
            'other'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'intelligence_kind'
          AND n.nspname = 'ihcm_bot'
    ) THEN
        CREATE TYPE ihcm_bot.intelligence_kind AS ENUM (
            'daily_snapshot',
            'weekly_brief',
            'risk_packet',
            'opportunity_packet',
            'comparison_brief'
        );
    END IF;
END $$;

CREATE TABLE ihcm_bot.buildings (
    building_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     TEXT NOT NULL UNIQUE,
    name                     TEXT NOT NULL,
    short_name               TEXT NOT NULL,
    state_code               TEXT NOT NULL CHECK (state_code IN ('AR', 'OH', 'PA')),
    cms_provider_id          TEXT NOT NULL UNIQUE,
    licensed_beds            INTEGER CHECK (licensed_beds IS NULL OR licensed_beds > 0),
    current_census           INTEGER CHECK (current_census IS NULL OR current_census >= 0),
    strategic_status         ihcm_bot.building_status NOT NULL DEFAULT 'stable',
    strategic_label          TEXT,
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    owner_name               TEXT,
    context_owner            TEXT,
    context_updated_at       TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buildings_state_status
    ON ihcm_bot.buildings(state_code, strategic_status);

CREATE TABLE ihcm_bot.building_profiles (
    profile_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id              UUID NOT NULL REFERENCES ihcm_bot.buildings(building_id) ON DELETE CASCADE,
    payer_context            TEXT,
    market_summary           TEXT,
    referral_summary         TEXT,
    physician_relationships  TEXT,
    growth_barriers          JSONB NOT NULL DEFAULT '[]'::JSONB,
    growth_opportunities     JSONB NOT NULL DEFAULT '[]'::JSONB,
    survey_context           TEXT,
    staffing_context         TEXT,
    reimbursement_context    TEXT,
    strategic_notes          TEXT,
    approved_status          ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
    owner                    TEXT,
    approved_by              TEXT,
    approved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_building_profiles_building UNIQUE (building_id)
);

CREATE TABLE ihcm_bot.role_modules (
    role_module_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role                     ihcm_bot.role_type NOT NULL UNIQUE,
    name                     TEXT NOT NULL,
    purpose                  TEXT NOT NULL,
    response_rules           TEXT NOT NULL,
    workflow_summary         TEXT,
    risk_boundaries          TEXT,
    approved_status          ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
    owner                    TEXT,
    approved_by              TEXT,
    approved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ihcm_bot.workflow_templates (
    workflow_template_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     TEXT NOT NULL UNIQUE,
    role                     ihcm_bot.role_type NOT NULL,
    name                     TEXT NOT NULL,
    description              TEXT,
    required_inputs          JSONB NOT NULL DEFAULT '[]'::JSONB,
    optional_inputs          JSONB NOT NULL DEFAULT '[]'::JSONB,
    missing_info_questions   JSONB NOT NULL DEFAULT '[]'::JSONB,
    output_contract          JSONB NOT NULL DEFAULT '{}'::JSONB,
    template_body            TEXT NOT NULL,
    approved_status          ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
    owner                    TEXT,
    approved_by              TEXT,
    approved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_templates_role
    ON ihcm_bot.workflow_templates(role);

CREATE TABLE ihcm_bot.knowledge_documents (
    document_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     TEXT NOT NULL UNIQUE,
    title                    TEXT NOT NULL,
    doc_type                 ihcm_bot.doc_type NOT NULL,
    audience                 TEXT,
    role_scope               ihcm_bot.role_type,
    building_id              UUID REFERENCES ihcm_bot.buildings(building_id) ON DELETE SET NULL,
    state_scope              TEXT,
    file_path                TEXT,
    source_url               TEXT,
    body_markdown            TEXT NOT NULL,
    tags                     JSONB NOT NULL DEFAULT '[]'::JSONB,
    approved_status          ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
    owner                    TEXT,
    approved_by              TEXT,
    approved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_documents_type_role
    ON ihcm_bot.knowledge_documents(doc_type, role_scope);

CREATE INDEX idx_knowledge_documents_building
    ON ihcm_bot.knowledge_documents(building_id);

CREATE TABLE ihcm_bot.knowledge_chunks (
    chunk_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id              UUID NOT NULL REFERENCES ihcm_bot.knowledge_documents(document_id) ON DELETE CASCADE,
    chunk_index              INTEGER NOT NULL,
    heading                  TEXT,
    content_text             TEXT NOT NULL,
    token_estimate           INTEGER,
    metadata                 JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_knowledge_chunk UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_knowledge_chunks_document
    ON ihcm_bot.knowledge_chunks(document_id, chunk_index);

CREATE TABLE ihcm_bot.building_snapshots (
    snapshot_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id              UUID NOT NULL REFERENCES ihcm_bot.buildings(building_id) ON DELETE CASCADE,
    snapshot_date            DATE NOT NULL,
    census                   INTEGER CHECK (census IS NULL OR census >= 0),
    occupancy_gap            INTEGER,
    skilled_mix_pct          NUMERIC(5,2),
    medicare_pct             NUMERIC(5,2),
    medicaid_pct             NUMERIC(5,2),
    managed_care_pct         NUMERIC(5,2),
    referral_pressure        TEXT,
    survey_risk_level        TEXT,
    staffing_risk_level      TEXT,
    reimbursement_risk_level TEXT,
    top_issues               JSONB NOT NULL DEFAULT '[]'::JSONB,
    top_opportunities        JSONB NOT NULL DEFAULT '[]'::JSONB,
    raw_data                 JSONB NOT NULL DEFAULT '{}'::JSONB,
    source                   TEXT NOT NULL DEFAULT 'manual',
    confidence_score         NUMERIC(5,2),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_building_snapshot_day UNIQUE (building_id, snapshot_date)
);

CREATE INDEX idx_building_snapshots_building_date
    ON ihcm_bot.building_snapshots(building_id, snapshot_date DESC);

CREATE TABLE ihcm_bot.intelligence_runs (
    run_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date                 DATE NOT NULL,
    run_name                 TEXT,
    status                   TEXT NOT NULL DEFAULT 'pending',
    source                   TEXT NOT NULL DEFAULT 'system',
    error                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at             TIMESTAMPTZ
);

CREATE INDEX idx_intelligence_runs_date
    ON ihcm_bot.intelligence_runs(run_date DESC, created_at DESC);

CREATE TABLE ihcm_bot.building_intelligence_packets (
    packet_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id              UUID NOT NULL REFERENCES ihcm_bot.buildings(building_id) ON DELETE CASCADE,
    run_id                   UUID REFERENCES ihcm_bot.intelligence_runs(run_id) ON DELETE SET NULL,
    packet_date              DATE NOT NULL,
    intelligence_kind        ihcm_bot.intelligence_kind NOT NULL,
    headline                 TEXT NOT NULL,
    executive_summary        TEXT NOT NULL,
    top_risks                JSONB NOT NULL DEFAULT '[]'::JSONB,
    top_opportunities        JSONB NOT NULL DEFAULT '[]'::JSONB,
    recommended_actions      JSONB NOT NULL DEFAULT '[]'::JSONB,
    key_metrics              JSONB NOT NULL DEFAULT '{}'::JSONB,
    source_refs              JSONB NOT NULL DEFAULT '[]'::JSONB,
    confidence_score         NUMERIC(5,2),
    freshness_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_building_packet_kind_day UNIQUE (building_id, packet_date, intelligence_kind)
);

CREATE INDEX idx_building_intelligence_packets_building_date
    ON ihcm_bot.building_intelligence_packets(building_id, packet_date DESC);

CREATE TABLE ihcm_bot.cross_building_intelligence (
    insight_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                   UUID REFERENCES ihcm_bot.intelligence_runs(run_id) ON DELETE SET NULL,
    insight_date             DATE NOT NULL,
    title                    TEXT NOT NULL,
    body                     TEXT NOT NULL,
    data                     JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ihcm_bot.prompt_profiles (
    prompt_profile_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     TEXT NOT NULL UNIQUE,
    role                     ihcm_bot.role_type NOT NULL,
    workflow_template_id     UUID REFERENCES ihcm_bot.workflow_templates(workflow_template_id) ON DELETE SET NULL,
    system_core              TEXT NOT NULL,
    prompt_contract          JSONB NOT NULL DEFAULT '{}'::JSONB,
    approved_status          ihcm_bot.knowledge_status NOT NULL DEFAULT 'draft',
    owner                    TEXT,
    approved_by              TEXT,
    approved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_profiles_role
    ON ihcm_bot.prompt_profiles(role);

DROP TRIGGER IF EXISTS trg_buildings_set_updated_at ON ihcm_bot.buildings;
CREATE TRIGGER trg_buildings_set_updated_at
BEFORE UPDATE ON ihcm_bot.buildings
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_building_profiles_set_updated_at ON ihcm_bot.building_profiles;
CREATE TRIGGER trg_building_profiles_set_updated_at
BEFORE UPDATE ON ihcm_bot.building_profiles
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_role_modules_set_updated_at ON ihcm_bot.role_modules;
CREATE TRIGGER trg_role_modules_set_updated_at
BEFORE UPDATE ON ihcm_bot.role_modules
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_templates_set_updated_at ON ihcm_bot.workflow_templates;
CREATE TRIGGER trg_workflow_templates_set_updated_at
BEFORE UPDATE ON ihcm_bot.workflow_templates
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_knowledge_documents_set_updated_at ON ihcm_bot.knowledge_documents;
CREATE TRIGGER trg_knowledge_documents_set_updated_at
BEFORE UPDATE ON ihcm_bot.knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_building_snapshots_set_updated_at ON ihcm_bot.building_snapshots;
CREATE TRIGGER trg_building_snapshots_set_updated_at
BEFORE UPDATE ON ihcm_bot.building_snapshots
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

DROP TRIGGER IF EXISTS trg_prompt_profiles_set_updated_at ON ihcm_bot.prompt_profiles;
CREATE TRIGGER trg_prompt_profiles_set_updated_at
BEFORE UPDATE ON ihcm_bot.prompt_profiles
FOR EACH ROW
EXECUTE FUNCTION ihcm_bot.set_updated_at();

CREATE OR REPLACE VIEW ihcm_bot.v_latest_building_snapshot AS
SELECT DISTINCT ON (building_id)
    snapshot_id,
    building_id,
    snapshot_date,
    census,
    occupancy_gap,
    skilled_mix_pct,
    medicare_pct,
    medicaid_pct,
    managed_care_pct,
    referral_pressure,
    survey_risk_level,
    staffing_risk_level,
    reimbursement_risk_level,
    top_issues,
    top_opportunities,
    confidence_score,
    created_at
FROM ihcm_bot.building_snapshots
ORDER BY building_id, snapshot_date DESC, created_at DESC;

CREATE OR REPLACE VIEW ihcm_bot.v_latest_building_intelligence AS
SELECT DISTINCT ON (building_id, intelligence_kind)
    packet_id,
    building_id,
    packet_date,
    intelligence_kind,
    headline,
    executive_summary,
    top_risks,
    top_opportunities,
    recommended_actions,
    key_metrics,
    source_refs,
    confidence_score,
    freshness_at,
    created_at
FROM ihcm_bot.building_intelligence_packets
ORDER BY building_id, intelligence_kind, packet_date DESC, created_at DESC;
