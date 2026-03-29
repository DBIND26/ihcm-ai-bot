-- Normalized v2 proposal for the legacy coaching and board schema.
-- Draft only. Review naming, constraints, and migration assumptions before use.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
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
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coach_type') THEN
        CREATE TYPE public.coach_type AS ENUM ('beri', 'lew', 'tony', 'system', 'custom');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_status') THEN
        CREATE TYPE public.session_status AS ENUM ('active', 'completed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_source') THEN
        CREATE TYPE public.session_source AS ENUM ('coaching', 'board', 'system', 'import');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
        CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'coach', 'system');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commitment_status') THEN
        CREATE TYPE public.commitment_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled', 'overdue');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_source_type') THEN
        CREATE TYPE public.insight_source_type AS ENUM ('coaching_session', 'board_session', 'manual', 'system');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'board_mode') THEN
        CREATE TYPE public.board_mode AS ENUM ('single', 'duo', 'full_board', 'async');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
        CREATE TYPE public.run_status AS ENUM ('pending', 'running', 'completed', 'failed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_type') THEN
        CREATE TYPE public.run_type AS ENUM ('nightly', 'weekly', 'monthly', 'manual');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_severity') THEN
        CREATE TYPE public.insight_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brief_type') THEN
        CREATE TYPE public.brief_type AS ENUM ('daily', 'weekly', 'sunday', 'monthly', 'ad_hoc');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rock_status') THEN
        CREATE TYPE public.rock_status AS ENUM ('on_track', 'at_risk', 'off_track', 'complete', 'paused');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qa_verdict') THEN
        CREATE TYPE public.qa_verdict AS ENUM ('pass', 'fail', 'warning');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qa_severity') THEN
        CREATE TYPE public.qa_severity AS ENUM ('critical', 'high', 'medium', 'low');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
    id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email                   TEXT NOT NULL UNIQUE,
    full_name               TEXT NOT NULL,
    role                    TEXT,
    building                TEXT,
    is_admin                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    onboarding_done         BOOLEAN NOT NULL DEFAULT FALSE,
    timezone                TEXT NOT NULL DEFAULT 'America/New_York',
    foundation              JSONB NOT NULL DEFAULT '{}'::JSONB,
    challenge               JSONB NOT NULL DEFAULT '{}'::JSONB,
    patterns                JSONB NOT NULL DEFAULT '{}'::JSONB,
    pre_brief               JSONB NOT NULL DEFAULT '{}'::JSONB,
    scorecard_config        JSONB NOT NULL DEFAULT '[]'::JSONB,
    tov                     TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profile_coach_access (
    profile_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coach                    public.coach_type NOT NULL,
    granted_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profile_id, coach)
);

CREATE INDEX IF NOT EXISTS idx_profile_coach_access_coach
    ON public.profile_coach_access(coach);

CREATE TABLE IF NOT EXISTS public.coaching_sessions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coach                    public.coach_type NOT NULL,
    source                   public.session_source NOT NULL DEFAULT 'coaching',
    mandate_title            TEXT,
    shadow                   TEXT,
    session_date             DATE,
    pre_brief                JSONB NOT NULL DEFAULT '{}'::JSONB,
    energy_check             JSONB NOT NULL DEFAULT '{}'::JSONB,
    summary                  TEXT,
    challenge                TEXT,
    growth_index             INTEGER CHECK (growth_index IS NULL OR growth_index BETWEEN 0 AND 100),
    strategic_alignment      INTEGER CHECK (strategic_alignment IS NULL OR strategic_alignment BETWEEN 0 AND 100),
    hospitality_soul         INTEGER CHECK (hospitality_soul IS NULL OR hospitality_soul BETWEEN 0 AND 100),
    radical_candor           INTEGER CHECK (radical_candor IS NULL OR radical_candor BETWEEN 0 AND 100),
    execution                INTEGER CHECK (execution IS NULL OR execution BETWEEN 0 AND 100),
    status                   public.session_status NOT NULL DEFAULT 'active',
    started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                 TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coaching_sessions_time
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_status_started
    ON public.coaching_sessions(user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.session_messages (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id               UUID NOT NULL REFERENCES public.coaching_sessions(id) ON DELETE CASCADE,
    user_id                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    coach                    public.coach_type,
    sage_id                  TEXT,
    role                     public.message_role NOT NULL,
    content                  TEXT NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_messages_session_created
    ON public.session_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS public.commitments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id               UUID REFERENCES public.coaching_sessions(id) ON DELETE SET NULL,
    follow_up_session_id     UUID REFERENCES public.coaching_sessions(id) ON DELETE SET NULL,
    coach                    public.coach_type NOT NULL DEFAULT 'beri',
    description              TEXT NOT NULL,
    due_date                 DATE,
    status                   public.commitment_status NOT NULL DEFAULT 'open',
    completed_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_commitments_completion_time
        CHECK (completed_at IS NULL OR status = 'completed')
);

CREATE INDEX IF NOT EXISTS idx_commitments_user_status_due
    ON public.commitments(user_id, status, due_date);

CREATE TABLE IF NOT EXISTS public.growth_assessments (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id               UUID REFERENCES public.coaching_sessions(id) ON DELETE SET NULL,
    scorer                   TEXT NOT NULL CHECK (scorer IN ('coach', 'self', 'system')),
    dimension                TEXT,
    self_score               INTEGER CHECK (self_score IS NULL OR self_score BETWEEN 0 AND 100),
    self_awareness           INTEGER CHECK (self_awareness IS NULL OR self_awareness BETWEEN 0 AND 100),
    strategic_thinking       INTEGER CHECK (strategic_thinking IS NULL OR strategic_thinking BETWEEN 0 AND 100),
    emotional_regulation     INTEGER CHECK (emotional_regulation IS NULL OR emotional_regulation BETWEEN 0 AND 100),
    communication            INTEGER CHECK (communication IS NULL OR communication BETWEEN 0 AND 100),
    delegation               INTEGER CHECK (delegation IS NULL OR delegation BETWEEN 0 AND 100),
    execution                INTEGER CHECK (execution IS NULL OR execution BETWEEN 0 AND 100),
    radical_candor           INTEGER CHECK (radical_candor IS NULL OR radical_candor BETWEEN 0 AND 100),
    hospitality_soul         INTEGER CHECK (hospitality_soul IS NULL OR hospitality_soul BETWEEN 0 AND 100),
    strategic_alignment      INTEGER CHECK (strategic_alignment IS NULL OR strategic_alignment BETWEEN 0 AND 100),
    composite_score          NUMERIC(5,2) GENERATED ALWAYS AS (
        (
            COALESCE(execution, 0)
            + COALESCE(radical_candor, 0)
            + COALESCE(hospitality_soul, 0)
            + COALESCE(strategic_alignment, 0)
        )::NUMERIC / 4.0
    ) STORED,
    raw_xml                  TEXT,
    scored_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_assessments_user_scored_at
    ON public.growth_assessments(user_id, scored_at DESC);

CREATE TABLE IF NOT EXISTS public.insights (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_type              public.insight_source_type NOT NULL,
    source_session_id        UUID,
    content                  TEXT NOT NULL,
    is_starred               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_created
    ON public.insights(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.insight_tags (
    insight_id               UUID NOT NULL REFERENCES public.insights(id) ON DELETE CASCADE,
    tag                      TEXT NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (insight_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_insight_tags_tag
    ON public.insight_tags(tag);

CREATE TABLE IF NOT EXISTS public.issues (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                    TEXT NOT NULL,
    description              TEXT,
    priority                 public.issue_priority NOT NULL DEFAULT 'medium',
    status                   public.issue_status NOT NULL DEFAULT 'open',
    resolution               TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_issues_user_status_created
    ON public.issues(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rocks (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                    TEXT NOT NULL,
    description              TEXT,
    quarter                  TEXT NOT NULL,
    owner                    TEXT,
    status                   public.rock_status NOT NULL DEFAULT 'on_track',
    progress_pct             INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    milestones               JSONB NOT NULL DEFAULT '[]'::JSONB,
    risk_score               NUMERIC,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rocks_user_quarter_status
    ON public.rocks(user_id, quarter, status);

CREATE TABLE IF NOT EXISTS public.rock_risk_factors (
    rock_id                  UUID NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
    risk_factor              TEXT NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rock_id, risk_factor)
);

CREATE INDEX IF NOT EXISTS idx_rock_risk_factors_factor
    ON public.rock_risk_factors(risk_factor);

CREATE TABLE IF NOT EXISTS public.scorecard_entries (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_of                  DATE NOT NULL,
    metric_name              TEXT NOT NULL,
    target_value             NUMERIC,
    actual_value             NUMERIC,
    on_track                 BOOLEAN,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_scorecard_entries_user_week_metric
        UNIQUE (user_id, week_of, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_scorecard_entries_user_week
    ON public.scorecard_entries(user_id, week_of DESC);

CREATE TABLE IF NOT EXISTS public.board_sessions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode                     public.board_mode NOT NULL,
    topic                    TEXT,
    status                   public.session_status NOT NULL DEFAULT 'active',
    started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at                 TIMESTAMPTZ,
    CONSTRAINT chk_board_sessions_time
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_board_sessions_user_status_started
    ON public.board_sessions(user_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.board_session_sages (
    board_session_id         UUID NOT NULL REFERENCES public.board_sessions(id) ON DELETE CASCADE,
    sage                     public.coach_type NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_session_id, sage)
);

CREATE TABLE IF NOT EXISTS public.intelligence_runs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date                 DATE NOT NULL UNIQUE,
    run_type                 public.run_type NOT NULL DEFAULT 'nightly',
    status                   public.run_status NOT NULL DEFAULT 'pending',
    started_at               TIMESTAMPTZ,
    completed_at             TIMESTAMPTZ,
    tokens_used              INTEGER,
    error                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_intelligence_runs_time
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.intelligence_insights (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                   UUID NOT NULL REFERENCES public.intelligence_runs(id) ON DELETE CASCADE,
    user_id                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    insight_type             TEXT NOT NULL,
    severity                 public.insight_severity NOT NULL DEFAULT 'info',
    title                    TEXT NOT NULL,
    body                     TEXT NOT NULL,
    data                     JSONB NOT NULL DEFAULT '{}'::JSONB,
    acknowledged             BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_at          TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_run_created
    ON public.intelligence_insights(run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.executive_briefs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                   UUID REFERENCES public.intelligence_runs(id) ON DELETE SET NULL,
    brief_date               DATE NOT NULL,
    brief_type               public.brief_type NOT NULL DEFAULT 'sunday',
    content                  TEXT NOT NULL,
    data                     JSONB NOT NULL DEFAULT '{}'::JSONB,
    sent_at                  TIMESTAMPTZ,
    opened_at                TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_executive_briefs_date_type
        UNIQUE (brief_date, brief_type)
);

CREATE INDEX IF NOT EXISTS idx_executive_briefs_date_type
    ON public.executive_briefs(brief_date DESC, brief_type);

CREATE TABLE IF NOT EXISTS public.team_reports (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type              TEXT NOT NULL,
    report_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    content                  TEXT NOT NULL,
    data                     JSONB NOT NULL DEFAULT '{}'::JSONB,
    generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_reports_type_date
        UNIQUE (report_type, report_date)
);

CREATE TABLE IF NOT EXISTS public.user_signal_snapshots (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    days_since_session       INTEGER,
    sessions_last_30         INTEGER NOT NULL DEFAULT 0,
    sessions_total           INTEGER NOT NULL DEFAULT 0,
    avg_growth_index         INTEGER,
    growth_trend             TEXT,
    open_commitments         INTEGER NOT NULL DEFAULT 0,
    overdue_commitments      INTEGER NOT NULL DEFAULT 0,
    completion_rate          NUMERIC,
    at_risk                  BOOLEAN NOT NULL DEFAULT FALSE,
    at_risk_reasons          JSONB NOT NULL DEFAULT '[]'::JSONB,
    strongest_dimension      TEXT,
    weakest_dimension        TEXT,
    top_pattern              TEXT,
    active_rocks             INTEGER NOT NULL DEFAULT 0,
    off_track_rocks          INTEGER NOT NULL DEFAULT 0,
    computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_signal_snapshots_user_computed
    ON public.user_signal_snapshots(user_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_signal_snapshots_at_risk
    ON public.user_signal_snapshots(at_risk, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.qa_runs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project                  TEXT NOT NULL,
    file_path                TEXT,
    verdict                  public.qa_verdict NOT NULL,
    score                    INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    summary                  TEXT,
    bug_count                INTEGER NOT NULL DEFAULT 0 CHECK (bug_count >= 0),
    critical_count           INTEGER NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
    high_count               INTEGER NOT NULL DEFAULT 0 CHECK (high_count >= 0),
    medium_count             INTEGER NOT NULL DEFAULT 0 CHECK (medium_count >= 0),
    low_count                INTEGER NOT NULL DEFAULT 0 CHECK (low_count >= 0),
    coverage_gap_count       INTEGER NOT NULL DEFAULT 0 CHECK (coverage_gap_count >= 0),
    source                   TEXT NOT NULL DEFAULT 'web',
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.qa_bugs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                   UUID REFERENCES public.qa_runs(id) ON DELETE CASCADE,
    project                  TEXT NOT NULL,
    file_path                TEXT,
    severity                 public.qa_severity NOT NULL,
    title                    TEXT NOT NULL,
    description              TEXT,
    location                 TEXT,
    fix                      TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_bugs_run_severity
    ON public.qa_bugs(run_id, severity);

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_coaching_sessions_set_updated_at ON public.coaching_sessions;
CREATE TRIGGER trg_coaching_sessions_set_updated_at
BEFORE UPDATE ON public.coaching_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_commitments_set_updated_at ON public.commitments;
CREATE TRIGGER trg_commitments_set_updated_at
BEFORE UPDATE ON public.commitments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rocks_set_updated_at ON public.rocks;
CREATE TRIGGER trg_rocks_set_updated_at
BEFORE UPDATE ON public.rocks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Intentionally omitted from v2:
--   public.sessions
--   public.sessions_backup
--   public.sessions_backup_march16
--   public.sessions_backup_march22
--   public.sessions_backup_march23
