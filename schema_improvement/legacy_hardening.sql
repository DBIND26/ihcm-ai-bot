-- Legacy hardening draft for the pasted coaching and board schema.
-- Review before execution. This is intended as a first-pass cleanup,
-- not a full redesign.

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

-- ---------------------------------------------------------------------------
-- Indexes for common foreign keys and query paths
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_board_sessions_user_status_started
    ON public.board_sessions(user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ceo_briefs_brief_date_type
    ON public.ceo_briefs(brief_date DESC, brief_type);

CREATE INDEX IF NOT EXISTS idx_coaching_sessions_user_status_started
    ON public.coaching_sessions(user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_commitments_user_status_due
    ON public.commitments(user_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_commitments_session
    ON public.commitments(session_id);

CREATE INDEX IF NOT EXISTS idx_growth_scores_user_scored_at
    ON public.growth_scores(user_id, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_scores_session
    ON public.growth_scores(session_id);

CREATE INDEX IF NOT EXISTS idx_insights_user_created
    ON public.insights(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_run_created
    ON public.intelligence_insights(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_user
    ON public.intelligence_insights(user_id);

CREATE INDEX IF NOT EXISTS idx_issues_user_status_created
    ON public.issues(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_session_created
    ON public.messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_created
    ON public.messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_bugs_run_severity
    ON public.qa_bugs(run_id, severity);

CREATE INDEX IF NOT EXISTS idx_rocks_user_quarter_status
    ON public.rocks(user_id, quarter, status);

CREATE INDEX IF NOT EXISTS idx_scorecard_entries_user_week
    ON public.scorecard_entries(user_id, week_of DESC);

CREATE INDEX IF NOT EXISTS idx_user_signals_at_risk
    ON public.user_signals(at_risk, computed_at DESC);

-- ---------------------------------------------------------------------------
-- Controlled vocabulary constraints
-- ---------------------------------------------------------------------------

ALTER TABLE public.board_sessions
    ADD CONSTRAINT chk_board_sessions_mode
    CHECK (mode IN ('single', 'duo', 'full_board', 'async'));

ALTER TABLE public.board_sessions
    ADD CONSTRAINT chk_board_sessions_status
    CHECK (status IN ('active', 'completed', 'cancelled'));

ALTER TABLE public.ceo_briefs
    ADD CONSTRAINT chk_ceo_briefs_brief_type
    CHECK (brief_type IN ('daily', 'weekly', 'sunday', 'monthly', 'ad_hoc'));

ALTER TABLE public.coaching_sessions
    ADD CONSTRAINT chk_coaching_sessions_status
    CHECK (status IN ('active', 'completed', 'cancelled'));

ALTER TABLE public.coaching_sessions
    ADD CONSTRAINT chk_coaching_sessions_source
    CHECK (source IN ('coaching', 'board', 'system', 'import'));

ALTER TABLE public.commitments
    ADD CONSTRAINT chk_commitments_status
    CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled', 'overdue'));

ALTER TABLE public.growth_scores
    ADD CONSTRAINT chk_growth_scores_scorer
    CHECK (scorer IN ('coach', 'self', 'system'));

ALTER TABLE public.insights
    ADD CONSTRAINT chk_insights_source_type
    CHECK (source_type IN ('coaching_session', 'board_session', 'manual', 'system'));

ALTER TABLE public.intelligence_insights
    ADD CONSTRAINT chk_intelligence_insights_severity
    CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical'));

ALTER TABLE public.intelligence_runs
    ADD CONSTRAINT chk_intelligence_runs_run_type
    CHECK (run_type IN ('nightly', 'weekly', 'monthly', 'manual'));

ALTER TABLE public.intelligence_runs
    ADD CONSTRAINT chk_intelligence_runs_status
    CHECK (status IN ('pending', 'running', 'completed', 'failed'));

ALTER TABLE public.issues
    ADD CONSTRAINT chk_issues_priority
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.issues
    ADD CONSTRAINT chk_issues_status
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE public.messages
    ADD CONSTRAINT chk_messages_role
    CHECK (role IN ('user', 'assistant', 'coach', 'system'));

ALTER TABLE public.qa_bugs
    ADD CONSTRAINT chk_qa_bugs_severity
    CHECK (severity IN ('critical', 'high', 'medium', 'low'));

ALTER TABLE public.qa_runs
    ADD CONSTRAINT chk_qa_runs_verdict
    CHECK (verdict IN ('pass', 'fail', 'warning'));

ALTER TABLE public.rocks
    ADD CONSTRAINT chk_rocks_status
    CHECK (status IN ('on_track', 'at_risk', 'off_track', 'complete', 'paused'));

-- ---------------------------------------------------------------------------
-- Time consistency and basic integrity
-- ---------------------------------------------------------------------------

ALTER TABLE public.board_sessions
    ADD CONSTRAINT chk_board_sessions_time
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at);

ALTER TABLE public.coaching_sessions
    ADD CONSTRAINT chk_coaching_sessions_time
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at);

ALTER TABLE public.commitments
    ADD CONSTRAINT chk_commitments_completion_time
    CHECK (completed_at IS NULL OR status = 'completed');

ALTER TABLE public.intelligence_runs
    ADD CONSTRAINT chk_intelligence_runs_time
    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);

ALTER TABLE public.qa_runs
    ADD CONSTRAINT chk_qa_runs_score
    CHECK (score BETWEEN 0 AND 100);

ALTER TABLE public.qa_runs
    ADD CONSTRAINT chk_qa_runs_counts
    CHECK (
        bug_count >= 0
        AND critical_count >= 0
        AND high_count >= 0
        AND medium_count >= 0
        AND low_count >= 0
        AND coverage_gap_count >= 0
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_scorecard_entries_user_week_metric
    ON public.scorecard_entries(user_id, week_of, metric_name);

-- ---------------------------------------------------------------------------
-- Updated-at triggers where useful
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
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

-- ---------------------------------------------------------------------------
-- Guidance-only changes that should be handled carefully in a separate migration
-- ---------------------------------------------------------------------------

-- 1. Convert growth_scores.composite_score away from a DEFAULT expression.
-- 2. Replace user_email copies with joins to profiles unless snapshot behavior is required.
-- 3. Replace array columns with child tables:
--      profiles.coach_access
--      board_sessions.sages_involved
--      insights.tags
--      rocks.risk_factors
-- 4. Retire public.sessions and move backup tables out of public.
