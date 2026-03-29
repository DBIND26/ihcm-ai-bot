-- ============================================================================
-- IHCM AI COMMAND CENTER - DATABASE SCHEMA v1.1
-- Target: Supabase Postgres or PostgreSQL 14+
-- ============================================================================
-- Design changes from v1.0
-- - separates human-managed facility operational status from computed risk label
-- - supports current and historical reimbursement methods (PDPM, RUG-IV, state CMI)
-- - replaces fragile arrays with relational child tables for API-friendly access
-- - adds stronger constraints, dedupe keys, and deterministic views
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Two-letter state codes without hard-coding a specific portfolio footprint.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'us_state_code'
          AND n.nspname = 'public'
    ) THEN
        CREATE DOMAIN us_state_code AS CHAR(2)
            CHECK (VALUE ~ '^[A-Z]{2}$');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- SPRINT 1: FOUNDATION
-- ============================================================================

CREATE TABLE facilities (
    facility_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_code           TEXT UNIQUE,
    facility_name           TEXT NOT NULL,
    state_code              us_state_code NOT NULL,
    licensed_beds           INTEGER NOT NULL CHECK (licensed_beds > 0),
    current_census          INTEGER NOT NULL DEFAULT 0 CHECK (current_census >= 0),
    administrator_name      TEXT,
    don_name                TEXT,
    mds_lead_name           TEXT,
    operational_status      TEXT NOT NULL DEFAULT 'active'
                            CHECK (operational_status IN ('active', 'watch', 'high_risk', 'critical', 'inactive')),
    is_accepting_admissions BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_facility_name_state UNIQUE (facility_name, state_code)
);

CREATE INDEX idx_facilities_state ON facilities(state_code);
CREATE INDEX idx_facilities_status ON facilities(operational_status);

CREATE TABLE resident_episodes (
    episode_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_internal_id    TEXT NOT NULL, -- Tokenized ID only; no PHI/MRN/name.
    facility_id             UUID NOT NULL REFERENCES facilities(facility_id),
    payer_type              TEXT NOT NULL DEFAULT 'other'
                            CHECK (payer_type IN ('medicare', 'medicaid', 'managed_care', 'private', 'other')),
    payment_model           TEXT NOT NULL DEFAULT 'other'
                            CHECK (payment_model IN ('pdpm', 'rugs_iv', 'state_cmi', 'case_rate', 'managed_care', 'other')),
    admission_date          DATE NOT NULL,
    discharge_date          DATE,
    acuity_level            TEXT NOT NULL DEFAULT 'medium'
                            CHECK (acuity_level IN ('low', 'medium', 'high')),
    behavioral_flag         BOOLEAN NOT NULL DEFAULT FALSE,
    wound_flag              BOOLEAN NOT NULL DEFAULT FALSE,
    episode_status          TEXT NOT NULL DEFAULT 'active'
                            CHECK (episode_status IN ('active', 'discharged', 'pending')),
    source_system           TEXT,
    source_record_id        TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_episode_dates
        CHECK (discharge_date IS NULL OR discharge_date >= admission_date),
    CONSTRAINT chk_episode_discharged_requires_date
        CHECK (episode_status <> 'discharged' OR discharge_date IS NOT NULL),
    CONSTRAINT uq_episode_facility_link
        UNIQUE (episode_id, facility_id),
    CONSTRAINT uq_episode_business_key
        UNIQUE (facility_id, resident_internal_id, admission_date)
);

CREATE UNIQUE INDEX uq_episode_source
    ON resident_episodes(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX idx_episodes_facility_status
    ON resident_episodes(facility_id, episode_status);
CREATE INDEX idx_episodes_admission_date
    ON resident_episodes(admission_date);

CREATE TABLE mds_assessments (
    assessment_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id                  UUID NOT NULL,
    facility_id                 UUID NOT NULL REFERENCES facilities(facility_id),
    assessment_track            TEXT NOT NULL DEFAULT 'other'
                                CHECK (assessment_track IN ('obra', 'medicare', 'medicaid', 'managed_care', 'other')),
    assessment_type             TEXT NOT NULL
                                CHECK (assessment_type IN (
                                    'entry_tracking', 'admission', 'quarterly', 'annual',
                                    'significant_change', 'significant_correction',
                                    '5_day', '14_day', '30_day', '60_day', '90_day',
                                    'ipa', 'omra', 'discharge',
                                    'death_in_facility_tracking', 'other'
                                )),
    payment_model               TEXT NOT NULL DEFAULT 'other'
                                CHECK (payment_model IN ('pdpm', 'rugs_iv', 'state_cmi', 'case_rate', 'managed_care', 'other')),
    ard_date                    DATE,
    due_date                    DATE NOT NULL,
    submitted_date              DATE,
    status                      TEXT NOT NULL DEFAULT 'due'
                                CHECK (status IN ('due', 'in_progress', 'submitted', 'overdue', 'modified', 'inactivated')),
    case_mix_index              NUMERIC(8,4) CHECK (case_mix_index IS NULL OR case_mix_index >= 0),
    late_flag                   BOOLEAN GENERATED ALWAYS AS (
                                    submitted_date IS NOT NULL AND submitted_date > due_date
                                ) STORED,
    documentation_risk_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    source_system               TEXT,
    source_record_id            TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_mds_episode_facility
        FOREIGN KEY (episode_id, facility_id)
        REFERENCES resident_episodes(episode_id, facility_id),
    CONSTRAINT chk_mds_submission_date
        CHECK (submitted_date IS NULL OR ard_date IS NULL OR submitted_date >= ard_date)
);

CREATE UNIQUE INDEX uq_mds_source
    ON mds_assessments(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX uq_mds_active_business_key
    ON mds_assessments(facility_id, episode_id, assessment_type, due_date, payment_model)
    WHERE status NOT IN ('modified', 'inactivated');

CREATE INDEX idx_mds_facility_status_due
    ON mds_assessments(facility_id, status, due_date);
CREATE INDEX idx_mds_episode
    ON mds_assessments(episode_id);

CREATE TABLE assessment_reimbursement_classifications (
    assessment_classification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id                UUID NOT NULL REFERENCES mds_assessments(assessment_id) ON DELETE CASCADE,
    payment_model                TEXT NOT NULL
                                  CHECK (payment_model IN ('pdpm', 'rugs_iv', 'state_cmi', 'case_rate', 'managed_care', 'other')),
    component_name               TEXT NOT NULL,
    component_code               TEXT,
    component_value              TEXT,
    component_score              NUMERIC(10,4) CHECK (component_score IS NULL OR component_score >= 0),
    is_primary                   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assessment_component
        UNIQUE (assessment_id, payment_model, component_name)
);

CREATE INDEX idx_assessment_classifications_assessment
    ON assessment_reimbursement_classifications(assessment_id);
CREATE INDEX idx_assessment_classifications_model
    ON assessment_reimbursement_classifications(payment_model);

CREATE TABLE staffing_daily (
    staffing_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id                 UUID NOT NULL REFERENCES facilities(facility_id),
    staffing_date               DATE NOT NULL,
    shift                       TEXT NOT NULL CHECK (shift IN ('day', 'evening', 'night', 'all_day')),
    resident_census_snapshot    INTEGER NOT NULL DEFAULT 0 CHECK (resident_census_snapshot >= 0),
    rn_hours                    NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (rn_hours >= 0),
    lpn_hours                   NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (lpn_hours >= 0),
    cna_hours                   NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (cna_hours >= 0),
    agency_hours                NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (agency_hours >= 0),
    overtime_hours              NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
    hours_per_resident_day      NUMERIC(8,4) CHECK (hours_per_resident_day IS NULL OR hours_per_resident_day >= 0),
    below_target_flag           BOOLEAN NOT NULL DEFAULT FALSE,
    target_hours_per_resident_day NUMERIC(8,4) CHECK (target_hours_per_resident_day IS NULL OR target_hours_per_resident_day >= 0),
    source_system               TEXT,
    source_record_id            TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staffing_shift
        UNIQUE (facility_id, staffing_date, shift)
);

CREATE UNIQUE INDEX uq_staffing_source
    ON staffing_daily(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX idx_staffing_facility_date
    ON staffing_daily(facility_id, staffing_date DESC);
CREATE INDEX idx_staffing_issues
    ON staffing_daily(staffing_date DESC, below_target_flag);

CREATE TABLE ai_alerts (
    alert_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id              UUID NOT NULL REFERENCES facilities(facility_id),
    episode_id               UUID,
    alert_date               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_category           TEXT NOT NULL
                              CHECK (alert_category IN ('clinical', 'survey', 'staffing', 'reimbursement', 'admissions', 'mds')),
    alert_type               TEXT NOT NULL,
    severity                 TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title                    TEXT NOT NULL,
    description              TEXT NOT NULL,
    recommended_action       TEXT,
    owner_role               TEXT,
    dedupe_key               TEXT,
    status                   TEXT NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed')),
    acknowledged_by          TEXT,
    acknowledged_at          TIMESTAMPTZ,
    resolved_at              TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_alert_episode_facility
        FOREIGN KEY (episode_id, facility_id)
        REFERENCES resident_episodes(episode_id, facility_id),
    CONSTRAINT uq_alert_dedupe_key UNIQUE (dedupe_key),
    CONSTRAINT chk_alert_acknowledgement
        CHECK (
            acknowledged_at IS NULL
            OR acknowledged_by IS NOT NULL
        )
);

CREATE INDEX idx_alerts_open
    ON ai_alerts(status, severity, alert_date DESC);
CREATE INDEX idx_alerts_facility_category
    ON ai_alerts(facility_id, alert_category);

CREATE TABLE facility_risk_scores (
    score_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id             UUID NOT NULL REFERENCES facilities(facility_id),
    score_date              DATE NOT NULL,
    model_version           TEXT NOT NULL DEFAULT 'v1.1',
    clinical_score          INTEGER NOT NULL DEFAULT 0 CHECK (clinical_score >= 0),
    survey_score            INTEGER NOT NULL DEFAULT 0 CHECK (survey_score >= 0),
    staffing_score          INTEGER NOT NULL DEFAULT 0 CHECK (staffing_score >= 0),
    reimbursement_score     INTEGER NOT NULL DEFAULT 0 CHECK (reimbursement_score >= 0),
    admissions_score        INTEGER NOT NULL DEFAULT 0 CHECK (admissions_score >= 0),
    mds_score               INTEGER NOT NULL DEFAULT 0 CHECK (mds_score >= 0),
    composite_score         INTEGER NOT NULL DEFAULT 0 CHECK (composite_score >= 0),
    risk_label              TEXT NOT NULL CHECK (risk_label IN ('stable', 'watch', 'high_risk', 'critical')),
    primary_driver          TEXT,
    recommended_action      TEXT,
    scoring_notes           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risk_score_per_model_day
        UNIQUE (facility_id, score_date, model_version)
);

CREATE INDEX idx_risk_facility_date
    ON facility_risk_scores(facility_id, score_date DESC, created_at DESC);

-- ============================================================================
-- SPRINT 2: CLINICAL & INCIDENTS
-- ============================================================================

CREATE TABLE incident_events (
    incident_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id                  UUID,
    facility_id                 UUID NOT NULL REFERENCES facilities(facility_id),
    incident_date               TIMESTAMPTZ NOT NULL,
    reported_at                 TIMESTAMPTZ,
    incident_type               TEXT NOT NULL
                                CHECK (incident_type IN (
                                    'fall', 'fall_with_injury', 'med_error', 'skin_injury', 'elopement',
                                    'abuse_allegation', 'choking', 'infection', 'hospitalization',
                                    'behavioral_incident', 'other'
                                )),
    harm_level                  TEXT NOT NULL DEFAULT 'none'
                                CHECK (harm_level IN ('none', 'minor', 'major', 'sentinel')),
    transferred_out             BOOLEAN NOT NULL DEFAULT FALSE,
    investigation_status        TEXT NOT NULL DEFAULT 'open'
                                CHECK (investigation_status IN ('open', 'in_progress', 'complete', 'not_required')),
    investigation_due_date      DATE,
    investigation_completed_at  TIMESTAMPTZ,
    survey_sensitive_flag       BOOLEAN NOT NULL DEFAULT FALSE,
    root_cause                  TEXT,
    corrective_action           TEXT,
    source_system               TEXT,
    source_record_id            TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_incident_episode_facility
        FOREIGN KEY (episode_id, facility_id)
        REFERENCES resident_episodes(episode_id, facility_id),
    CONSTRAINT chk_incident_due_date
        CHECK (
            investigation_due_date IS NULL
            OR investigation_due_date >= incident_date::DATE
        ),
    CONSTRAINT chk_incident_complete_timestamp
        CHECK (
            investigation_status <> 'complete'
            OR investigation_completed_at IS NOT NULL
        )
);

CREATE UNIQUE INDEX uq_incident_source
    ON incident_events(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX idx_incidents_facility_date
    ON incident_events(facility_id, incident_date DESC);
CREATE INDEX idx_incidents_type
    ON incident_events(incident_type);
CREATE INDEX idx_incidents_investigation_status
    ON incident_events(investigation_status);

-- ============================================================================
-- SPRINT 3: REIMBURSEMENT
-- ============================================================================

CREATE TABLE reimbursement_events (
    reimbursement_event_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id                  UUID,
    assessment_id               UUID REFERENCES mds_assessments(assessment_id),
    facility_id                 UUID NOT NULL REFERENCES facilities(facility_id),
    event_date                  DATE NOT NULL,
    event_type                  TEXT NOT NULL
                                CHECK (event_type IN (
                                    'pdpm_variance', 'rugs_variance', 'state_cmi_variance',
                                    'auth_denial', 'missed_assessment', 'late_submission',
                                    'triple_check_variance', 'payer_dispute', 'other'
                                )),
    payment_model               TEXT NOT NULL DEFAULT 'other'
                                CHECK (payment_model IN ('pdpm', 'rugs_iv', 'state_cmi', 'case_rate', 'managed_care', 'other')),
    payer_type                  TEXT
                                CHECK (payer_type IS NULL OR payer_type IN ('medicare', 'medicaid', 'managed_care', 'private', 'other')),
    metric_name                 TEXT,
    metric_value                NUMERIC(12,4),
    estimated_impact_amount     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_impact_amount >= 0),
    status                      TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'in_review', 'resolved', 'monitor', 'written_off')),
    documentation_support_flag  BOOLEAN NOT NULL DEFAULT FALSE,
    source_system               TEXT,
    source_record_id            TEXT,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_reimbursement_episode_facility
        FOREIGN KEY (episode_id, facility_id)
        REFERENCES resident_episodes(episode_id, facility_id)
);

CREATE UNIQUE INDEX uq_reimbursement_source
    ON reimbursement_events(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX idx_reimbursement_facility_date
    ON reimbursement_events(facility_id, event_date DESC);
CREATE INDEX idx_reimbursement_status
    ON reimbursement_events(status);
CREATE INDEX idx_reimbursement_type
    ON reimbursement_events(event_type);

-- ============================================================================
-- SPRINT 4: DAILY BRIEFS & WORKFLOWS
-- ============================================================================

CREATE TABLE daily_briefs (
    brief_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_date               DATE NOT NULL,
    brief_scope              TEXT NOT NULL DEFAULT 'portfolio'
                              CHECK (brief_scope IN ('portfolio', 'facility')),
    facility_id              UUID REFERENCES facilities(facility_id),
    brief_text               TEXT NOT NULL,
    generated_by             TEXT NOT NULL DEFAULT 'system'
                              CHECK (generated_by IN ('system', 'human', 'hybrid')),
    generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_brief_scope_matches_facility
        CHECK (
            (brief_scope = 'portfolio' AND facility_id IS NULL)
            OR (brief_scope = 'facility' AND facility_id IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_daily_portfolio_brief
    ON daily_briefs(brief_date, brief_scope)
    WHERE brief_scope = 'portfolio';

CREATE UNIQUE INDEX uq_daily_facility_brief
    ON daily_briefs(brief_date, facility_id)
    WHERE brief_scope = 'facility';

CREATE INDEX idx_daily_briefs_date
    ON daily_briefs(brief_date DESC);

CREATE TABLE daily_brief_actions (
    brief_action_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id                  UUID NOT NULL REFERENCES daily_briefs(brief_id) ON DELETE CASCADE,
    action_rank               SMALLINT NOT NULL CHECK (action_rank > 0),
    action_text               TEXT NOT NULL,
    owner_role                TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brief_action_rank UNIQUE (brief_id, action_rank)
);

CREATE TABLE daily_brief_facilities (
    brief_facility_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id                  UUID NOT NULL REFERENCES daily_briefs(brief_id) ON DELETE CASCADE,
    facility_id               UUID NOT NULL REFERENCES facilities(facility_id),
    priority_rank             SMALLINT NOT NULL CHECK (priority_rank > 0),
    reason                    TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brief_facility UNIQUE (brief_id, facility_id),
    CONSTRAINT uq_brief_facility_rank UNIQUE (brief_id, priority_rank)
);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_facilities_updated_at
BEFORE UPDATE ON facilities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_resident_episodes_updated_at
BEFORE UPDATE ON resident_episodes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_mds_assessments_updated_at
BEFORE UPDATE ON mds_assessments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ai_alerts_updated_at
BEFORE UPDATE ON ai_alerts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_incident_events_updated_at
BEFORE UPDATE ON incident_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reimbursement_events_updated_at
BEFORE UPDATE ON reimbursement_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- VIEWS: COMMAND CENTER QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW v_facility_risk_current AS
WITH ranked_scores AS (
    SELECT
        rs.*,
        ROW_NUMBER() OVER (
            PARTITION BY rs.facility_id
            ORDER BY rs.score_date DESC, rs.created_at DESC, rs.score_id DESC
        ) AS rn
    FROM facility_risk_scores rs
)
SELECT
    f.facility_id,
    f.facility_code,
    f.facility_name,
    f.state_code,
    f.licensed_beds,
    f.current_census,
    f.administrator_name,
    f.don_name,
    f.mds_lead_name,
    f.operational_status,
    rs.score_id,
    rs.score_date,
    rs.model_version,
    rs.composite_score,
    rs.risk_label,
    rs.clinical_score,
    rs.survey_score,
    rs.staffing_score,
    rs.reimbursement_score,
    rs.admissions_score,
    rs.mds_score,
    rs.primary_driver,
    rs.recommended_action
FROM facilities f
LEFT JOIN ranked_scores rs
    ON rs.facility_id = f.facility_id
   AND rs.rn = 1;

CREATE OR REPLACE VIEW v_alerts_open AS
SELECT
    a.alert_id,
    a.facility_id,
    f.facility_name,
    a.episode_id,
    a.alert_category,
    a.alert_type,
    a.severity,
    a.title,
    a.description,
    a.recommended_action,
    a.owner_role,
    a.status,
    a.alert_date,
    a.acknowledged_by,
    a.acknowledged_at
FROM ai_alerts a
JOIN facilities f ON f.facility_id = a.facility_id
WHERE a.status IN ('open', 'acknowledged', 'in_progress')
ORDER BY
    CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    a.alert_date DESC,
    a.alert_id DESC;

CREATE OR REPLACE VIEW v_mds_control_tower AS
SELECT
    m.assessment_id,
    m.facility_id,
    f.facility_name,
    m.episode_id,
    m.assessment_track,
    m.assessment_type,
    m.payment_model,
    m.ard_date,
    m.due_date,
    m.submitted_date,
    m.status,
    m.late_flag,
    m.documentation_risk_flag,
    m.case_mix_index,
    CASE
        WHEN m.due_date < CURRENT_DATE AND m.status NOT IN ('submitted', 'inactivated') THEN 'OVERDUE'
        WHEN m.due_date <= CURRENT_DATE + INTERVAL '3 days' AND m.status NOT IN ('submitted', 'inactivated') THEN 'DUE SOON'
        ELSE 'ON TRACK'
    END AS urgency
FROM mds_assessments m
JOIN facilities f ON f.facility_id = m.facility_id
WHERE m.status NOT IN ('submitted', 'inactivated')
ORDER BY m.due_date ASC, f.facility_name, m.assessment_id;

CREATE OR REPLACE VIEW v_staffing_issues AS
SELECT
    s.staffing_id,
    s.facility_id,
    f.facility_name,
    s.staffing_date,
    s.shift,
    s.resident_census_snapshot,
    s.rn_hours,
    s.lpn_hours,
    s.cna_hours,
    s.agency_hours,
    s.overtime_hours,
    s.hours_per_resident_day,
    s.target_hours_per_resident_day,
    s.below_target_flag
FROM staffing_daily s
JOIN facilities f ON f.facility_id = s.facility_id
WHERE s.staffing_date >= CURRENT_DATE - INTERVAL '7 days'
  AND s.below_target_flag = TRUE
ORDER BY s.staffing_date DESC, f.facility_name, s.shift;

CREATE OR REPLACE VIEW v_revenue_leakage AS
SELECT
    r.facility_id,
    f.facility_name,
    r.payment_model,
    r.event_type,
    COUNT(*) FILTER (WHERE r.event_date >= CURRENT_DATE - INTERVAL '30 days') AS last_30_day_event_count,
    COALESCE(SUM(r.estimated_impact_amount) FILTER (WHERE r.event_date >= CURRENT_DATE - INTERVAL '30 days'), 0) AS last_30_day_dollars_at_risk,
    COUNT(*) FILTER (WHERE r.status IN ('open', 'in_review', 'monitor')) AS open_event_count,
    COALESCE(SUM(r.estimated_impact_amount) FILTER (WHERE r.status IN ('open', 'in_review', 'monitor')), 0) AS open_dollars_at_risk
FROM reimbursement_events r
JOIN facilities f ON f.facility_id = r.facility_id
GROUP BY r.facility_id, f.facility_name, r.payment_model, r.event_type
ORDER BY open_dollars_at_risk DESC, last_30_day_dollars_at_risk DESC;

CREATE OR REPLACE VIEW v_incident_trending AS
SELECT
    i.facility_id,
    f.facility_name,
    i.incident_type,
    COUNT(*) FILTER (WHERE i.incident_date >= CURRENT_DATE - INTERVAL '30 days') AS incident_count_30d,
    COUNT(*) FILTER (
        WHERE i.incident_date >= CURRENT_DATE - INTERVAL '30 days'
          AND i.harm_level IN ('major', 'sentinel')
    ) AS serious_count_30d,
    COUNT(*) FILTER (WHERE i.investigation_status IN ('open', 'in_progress')) AS open_investigations,
    COUNT(*) FILTER (
        WHERE i.incident_date >= CURRENT_DATE - INTERVAL '30 days'
          AND i.survey_sensitive_flag = TRUE
    ) AS survey_sensitive_count_30d
FROM incident_events i
JOIN facilities f ON f.facility_id = i.facility_id
GROUP BY i.facility_id, f.facility_name, i.incident_type
ORDER BY serious_count_30d DESC, incident_count_30d DESC, f.facility_name;

-- ============================================================================
-- SECURITY NOTE
-- ============================================================================
-- If this schema will be exposed through Supabase client APIs, add row-level
-- security after defining your user/role/facility-access model. This draft keeps
-- auth out of the schema so it remains portable to standard PostgreSQL as well.
