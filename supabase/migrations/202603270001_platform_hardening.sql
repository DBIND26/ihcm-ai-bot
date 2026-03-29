-- IHCM AI Command Center
-- Migration 3: Platform hardening — role-aware RLS, audit events, platform tables, data integrity
-- Addresses QA findings P0 and P1 from 2026-03-27 review

-- ============================================================================
-- 1. ROLE-AWARE AUTHORIZATION (P0)
--    The old model gates on global_access_level only. A billing user and a DON
--    with the same access level see the same rows. That violates minimum-necessary.
--    Fix: introduce role-aware helper functions and rewrite sensitive RLS policies
--    so that app_role determines WHAT a user may see, while access_level determines
--    WHERE (which facilities).
-- ============================================================================

-- Add knowledge_manager to app_role enum (P1 fix: separation of duties for review queue)
-- Supabase CHECK constraints on user_profiles.app_role must be widened.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_app_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_app_role_check
    CHECK (app_role IN (
        'super_admin','corporate_admin','regional_director','facility_admin',
        'don','mds_lead','billing','clinical_lead','knowledge_manager','read_only'
    ));

-- Role → domain mapping. Returns the data domains a role is allowed to touch.
CREATE OR REPLACE FUNCTION public.role_allowed_domains(p_role TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_role
        -- Super/corporate admins see everything
        WHEN 'super_admin'       THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'corporate_admin'   THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'regional_director' THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs']
        WHEN 'facility_admin'    THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs']
        -- Role-specific minimum-necessary boundaries
        WHEN 'don'               THEN ARRAY['clinical','staffing','incidents','mds','briefs']
        WHEN 'mds_lead'          THEN ARRAY['mds','reimbursement','clinical','briefs']
        WHEN 'billing'           THEN ARRAY['reimbursement','mds','briefs']
        WHEN 'clinical_lead'     THEN ARRAY['clinical','incidents','staffing','briefs']
        -- Knowledge manager: can operate review queue and knowledge base without being admin
        WHEN 'knowledge_manager' THEN ARRAY['knowledge','briefs','clinical','mds','reimbursement']
        WHEN 'read_only'         THEN ARRAY['briefs']
        ELSE                          ARRAY[]::TEXT[]
    END;
$$;

-- Check whether the current user's role is allowed a given domain.
CREATE OR REPLACE FUNCTION public.current_user_can_domain(p_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.user_id = auth.uid()
          AND up.is_active = TRUE
          AND p_domain = ANY(public.role_allowed_domains(up.app_role))
    );
$$;

-- Convenience: get the current user's app_role.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT up.app_role
         FROM public.user_profiles up
         WHERE up.user_id = auth.uid()
           AND up.is_active = TRUE
         LIMIT 1),
        'read_only'
    );
$$;

GRANT EXECUTE ON FUNCTION public.role_allowed_domains(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_can_domain(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;

-- Rewrite sensitive domain policies to be role-aware.
-- MDS: only roles with 'mds' domain
DROP POLICY IF EXISTS mds_assessments_select ON public.mds_assessments;
CREATE POLICY mds_assessments_select ON public.mds_assessments
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND public.current_user_can_domain('mds')
);

DROP POLICY IF EXISTS mds_assessments_insert ON public.mds_assessments;
CREATE POLICY mds_assessments_insert ON public.mds_assessments
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('mds')
);

DROP POLICY IF EXISTS mds_assessments_update ON public.mds_assessments;
CREATE POLICY mds_assessments_update ON public.mds_assessments
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain('mds'))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain('mds'));

DROP POLICY IF EXISTS mds_assessments_delete ON public.mds_assessments;
CREATE POLICY mds_assessments_delete ON public.mds_assessments
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('mds')
);

-- Reimbursement: only roles with 'reimbursement' domain
DROP POLICY IF EXISTS reimbursement_events_select ON public.reimbursement_events;
CREATE POLICY reimbursement_events_select ON public.reimbursement_events
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND public.current_user_can_domain('reimbursement')
);

DROP POLICY IF EXISTS reimbursement_events_insert ON public.reimbursement_events;
CREATE POLICY reimbursement_events_insert ON public.reimbursement_events
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('reimbursement')
);

DROP POLICY IF EXISTS reimbursement_events_update ON public.reimbursement_events;
CREATE POLICY reimbursement_events_update ON public.reimbursement_events
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain('reimbursement'))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain('reimbursement'));

DROP POLICY IF EXISTS reimbursement_events_delete ON public.reimbursement_events;
CREATE POLICY reimbursement_events_delete ON public.reimbursement_events
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('reimbursement')
);

-- Incidents: only roles with 'incidents' domain
DROP POLICY IF EXISTS incident_events_select ON public.incident_events;
CREATE POLICY incident_events_select ON public.incident_events
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND public.current_user_can_domain('incidents')
);

DROP POLICY IF EXISTS incident_events_insert ON public.incident_events;
CREATE POLICY incident_events_insert ON public.incident_events
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('incidents')
);

DROP POLICY IF EXISTS incident_events_update ON public.incident_events;
CREATE POLICY incident_events_update ON public.incident_events
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain('incidents'))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain('incidents'));

DROP POLICY IF EXISTS incident_events_delete ON public.incident_events;
CREATE POLICY incident_events_delete ON public.incident_events
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('incidents')
);

-- Staffing: only roles with 'staffing' domain
DROP POLICY IF EXISTS staffing_daily_select ON public.staffing_daily;
CREATE POLICY staffing_daily_select ON public.staffing_daily
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND public.current_user_can_domain('staffing')
);

DROP POLICY IF EXISTS staffing_daily_insert ON public.staffing_daily;
CREATE POLICY staffing_daily_insert ON public.staffing_daily
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('staffing')
);

DROP POLICY IF EXISTS staffing_daily_update ON public.staffing_daily;
CREATE POLICY staffing_daily_update ON public.staffing_daily
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain('staffing'))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain('staffing'));

DROP POLICY IF EXISTS staffing_daily_delete ON public.staffing_daily;
CREATE POLICY staffing_daily_delete ON public.staffing_daily
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('staffing')
);

-- Resident episodes: require 'clinical' domain (P0 fix: was facility-only)
DROP POLICY IF EXISTS resident_episodes_select ON public.resident_episodes;
CREATE POLICY resident_episodes_select ON public.resident_episodes
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND public.current_user_can_domain('clinical')
);

DROP POLICY IF EXISTS resident_episodes_insert ON public.resident_episodes;
CREATE POLICY resident_episodes_insert ON public.resident_episodes
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('clinical')
);

DROP POLICY IF EXISTS resident_episodes_update ON public.resident_episodes;
CREATE POLICY resident_episodes_update ON public.resident_episodes
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain('clinical'))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain('clinical'));

DROP POLICY IF EXISTS resident_episodes_delete ON public.resident_episodes;
CREATE POLICY resident_episodes_delete ON public.resident_episodes
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain('clinical')
);

-- AI alerts: require domain matching the alert_category
-- Alerts span multiple domains (clinical, staffing, reimbursement, etc.)
-- Gate on the union of any operational domain the user has access to.
DROP POLICY IF EXISTS ai_alerts_select ON public.ai_alerts;
CREATE POLICY ai_alerts_select ON public.ai_alerts
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND (
        public.current_user_can_domain(alert_category)
        OR public.current_user_can_domain('briefs')  -- brief-eligible users see alerts in their brief context
    )
);

DROP POLICY IF EXISTS ai_alerts_insert ON public.ai_alerts;
CREATE POLICY ai_alerts_insert ON public.ai_alerts
FOR INSERT WITH CHECK (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain(alert_category)
);

DROP POLICY IF EXISTS ai_alerts_update ON public.ai_alerts;
CREATE POLICY ai_alerts_update ON public.ai_alerts
FOR UPDATE
USING (public.can_manage_facility(facility_id) AND public.current_user_can_domain(alert_category))
WITH CHECK (public.can_manage_facility(facility_id) AND public.current_user_can_domain(alert_category));

DROP POLICY IF EXISTS ai_alerts_delete ON public.ai_alerts;
CREATE POLICY ai_alerts_delete ON public.ai_alerts
FOR DELETE USING (
    public.can_manage_facility(facility_id)
    AND public.current_user_can_domain(alert_category)
);

-- Facility risk scores: require at least one operational domain beyond briefs
-- Risk scores are aggregate — if you can see any operational domain you can see the score.
DROP POLICY IF EXISTS facility_risk_scores_select ON public.facility_risk_scores;
CREATE POLICY facility_risk_scores_select ON public.facility_risk_scores
FOR SELECT USING (
    public.can_access_facility(facility_id)
    AND (
        public.current_user_can_domain('clinical')
        OR public.current_user_can_domain('staffing')
        OR public.current_user_can_domain('reimbursement')
        OR public.current_user_can_domain('mds')
        OR public.current_user_can_domain('admissions')
    )
);

DROP POLICY IF EXISTS facility_risk_scores_insert ON public.facility_risk_scores;
CREATE POLICY facility_risk_scores_insert ON public.facility_risk_scores
FOR INSERT WITH CHECK (public.can_manage_portfolio());

DROP POLICY IF EXISTS facility_risk_scores_update ON public.facility_risk_scores;
CREATE POLICY facility_risk_scores_update ON public.facility_risk_scores
FOR UPDATE
USING (public.can_manage_portfolio())
WITH CHECK (public.can_manage_portfolio());

DROP POLICY IF EXISTS facility_risk_scores_delete ON public.facility_risk_scores;
CREATE POLICY facility_risk_scores_delete ON public.facility_risk_scores
FOR DELETE USING (public.can_manage_portfolio());

-- Daily briefs: require 'briefs' domain (all roles have this, but read_only gets filtered by scope)
DROP POLICY IF EXISTS daily_briefs_select ON public.daily_briefs;
CREATE POLICY daily_briefs_select ON public.daily_briefs
FOR SELECT USING (
    public.can_access_daily_brief(brief_scope, facility_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_briefs_insert ON public.daily_briefs;
CREATE POLICY daily_briefs_insert ON public.daily_briefs
FOR INSERT WITH CHECK (
    public.can_manage_daily_brief(brief_scope, facility_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_briefs_update ON public.daily_briefs;
CREATE POLICY daily_briefs_update ON public.daily_briefs
FOR UPDATE
USING (public.can_manage_daily_brief(brief_scope, facility_id) AND public.current_user_can_domain('briefs'))
WITH CHECK (public.can_manage_daily_brief(brief_scope, facility_id) AND public.current_user_can_domain('briefs'));

DROP POLICY IF EXISTS daily_briefs_delete ON public.daily_briefs;
CREATE POLICY daily_briefs_delete ON public.daily_briefs
FOR DELETE USING (
    public.can_manage_daily_brief(brief_scope, facility_id)
    AND public.current_user_can_domain('briefs')
);

-- Daily brief actions and facilities inherit from brief
DROP POLICY IF EXISTS daily_brief_actions_select ON public.daily_brief_actions;
CREATE POLICY daily_brief_actions_select ON public.daily_brief_actions
FOR SELECT USING (
    public.can_access_brief(brief_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_brief_actions_insert ON public.daily_brief_actions;
CREATE POLICY daily_brief_actions_insert ON public.daily_brief_actions
FOR INSERT WITH CHECK (
    public.can_manage_brief(brief_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_brief_actions_update ON public.daily_brief_actions;
CREATE POLICY daily_brief_actions_update ON public.daily_brief_actions
FOR UPDATE
USING (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'))
WITH CHECK (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'));

DROP POLICY IF EXISTS daily_brief_actions_delete ON public.daily_brief_actions;
CREATE POLICY daily_brief_actions_delete ON public.daily_brief_actions
FOR DELETE USING (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'));

DROP POLICY IF EXISTS daily_brief_facilities_select ON public.daily_brief_facilities;
CREATE POLICY daily_brief_facilities_select ON public.daily_brief_facilities
FOR SELECT USING (
    public.can_access_brief(brief_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_brief_facilities_insert ON public.daily_brief_facilities;
CREATE POLICY daily_brief_facilities_insert ON public.daily_brief_facilities
FOR INSERT WITH CHECK (
    public.can_manage_brief(brief_id)
    AND public.current_user_can_domain('briefs')
);

DROP POLICY IF EXISTS daily_brief_facilities_update ON public.daily_brief_facilities;
CREATE POLICY daily_brief_facilities_update ON public.daily_brief_facilities
FOR UPDATE
USING (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'))
WITH CHECK (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'));

DROP POLICY IF EXISTS daily_brief_facilities_delete ON public.daily_brief_facilities;
CREATE POLICY daily_brief_facilities_delete ON public.daily_brief_facilities
FOR DELETE USING (public.can_manage_brief(brief_id) AND public.current_user_can_domain('briefs'));

-- Assessment classifications inherit MDS domain
DROP POLICY IF EXISTS assessment_reimbursement_classifications_select ON public.assessment_reimbursement_classifications;
CREATE POLICY assessment_reimbursement_classifications_select ON public.assessment_reimbursement_classifications
FOR SELECT USING (
    public.can_access_assessment(assessment_id)
    AND public.current_user_can_domain('mds')
);

DROP POLICY IF EXISTS assessment_reimbursement_classifications_insert ON public.assessment_reimbursement_classifications;
CREATE POLICY assessment_reimbursement_classifications_insert ON public.assessment_reimbursement_classifications
FOR INSERT WITH CHECK (
    public.can_manage_assessment(assessment_id)
    AND public.current_user_can_domain('mds')
);

DROP POLICY IF EXISTS assessment_reimbursement_classifications_update ON public.assessment_reimbursement_classifications;
CREATE POLICY assessment_reimbursement_classifications_update ON public.assessment_reimbursement_classifications
FOR UPDATE
USING (public.can_manage_assessment(assessment_id) AND public.current_user_can_domain('mds'))
WITH CHECK (public.can_manage_assessment(assessment_id) AND public.current_user_can_domain('mds'));

DROP POLICY IF EXISTS assessment_reimbursement_classifications_delete ON public.assessment_reimbursement_classifications;
CREATE POLICY assessment_reimbursement_classifications_delete ON public.assessment_reimbursement_classifications
FOR DELETE USING (
    public.can_manage_assessment(assessment_id)
    AND public.current_user_can_domain('mds')
);


-- ============================================================================
-- 2. REIMBURSEMENT_EVENTS CROSS-FACILITY INTEGRITY (P1)
--    assessment_id FK points at mds_assessments which is facility-scoped.
--    A row could silently link an assessment from facility A to facility B.
--    Fix: add a CHECK constraint enforced by trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_reimbursement_assessment_facility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.assessment_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.mds_assessments m
            WHERE m.assessment_id = NEW.assessment_id
              AND m.facility_id = NEW.facility_id
        ) THEN
            RAISE EXCEPTION 'reimbursement_events.assessment_id (%) belongs to a different facility than facility_id (%)',
                NEW.assessment_id, NEW.facility_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reimbursement_assessment_facility_check
BEFORE INSERT OR UPDATE ON public.reimbursement_events
FOR EACH ROW
EXECUTE FUNCTION public.check_reimbursement_assessment_facility();


-- ============================================================================
-- 3. AUDITABILITY FIX (P1)
--    a) Replace acknowledged_by TEXT with a proper UUID FK to auth.users
--    b) Create immutable audit_events table for platform-wide event logging
-- ============================================================================

-- 3a. Fix acknowledged_by on ai_alerts
ALTER TABLE public.ai_alerts
    ADD COLUMN acknowledged_by_user_id UUID REFERENCES auth.users(id);

-- Migrate any existing text data if it matches an email in user_profiles
UPDATE public.ai_alerts a
SET acknowledged_by_user_id = up.user_id
FROM public.user_profiles up
WHERE a.acknowledged_by IS NOT NULL
  AND up.email = a.acknowledged_by;

-- Keep the old column temporarily for backward compat, but new code uses the FK
COMMENT ON COLUMN public.ai_alerts.acknowledged_by IS 'DEPRECATED: use acknowledged_by_user_id instead. Will be dropped in a future migration.';

CREATE INDEX idx_alerts_acknowledged_by_user ON public.ai_alerts(acknowledged_by_user_id)
    WHERE acknowledged_by_user_id IS NOT NULL;

-- 3b. Immutable, server-stamped audit_events table
--     P0 fix: user_id and app_role are server-set via trigger, not client-supplied.
--     Clients supply only: event_domain, event_type, event_subtype, target_table,
--     target_id, facility_id, detail. The trigger overwrites user_id, app_role, event_ts.
CREATE TABLE public.audit_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id             UUID REFERENCES auth.users(id),
    app_role            TEXT,
    facility_id         UUID REFERENCES public.facilities(facility_id),
    event_domain        TEXT NOT NULL
                        CHECK (event_domain IN (
                            'clinical','mds','staffing','reimbursement','admissions',
                            'survey','incidents','briefs','knowledge','auth','system','audit'
                        )),
    event_type          TEXT NOT NULL,
    event_subtype       TEXT,
    target_table        TEXT,
    target_id           UUID,
    detail              JSONB NOT NULL DEFAULT '{}'::JSONB,
    source_ip           INET,
    session_id          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Server-side stamp: overwrite identity fields so clients cannot forge them.
CREATE OR REPLACE FUNCTION public.stamp_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Always overwrite with server-known identity, regardless of what client sent
    NEW.user_id   := auth.uid();
    NEW.app_role  := public.current_app_role();
    NEW.event_ts  := NOW();
    NEW.created_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_events_stamp
BEFORE INSERT ON public.audit_events
FOR EACH ROW
EXECUTE FUNCTION public.stamp_audit_event();

-- Append-only: revoke UPDATE and DELETE from authenticated users
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Insert policy: authenticated users can log events, but identity is server-stamped
CREATE POLICY audit_events_insert ON public.audit_events
FOR INSERT WITH CHECK (TRUE);

CREATE POLICY audit_events_select ON public.audit_events
FOR SELECT USING (
    public.current_user_can_domain('audit')
);

-- No UPDATE or DELETE policies = immutable for authenticated role

GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;

CREATE INDEX idx_audit_events_ts ON public.audit_events(event_ts DESC);
CREATE INDEX idx_audit_events_user ON public.audit_events(user_id, event_ts DESC);
CREATE INDEX idx_audit_events_facility ON public.audit_events(facility_id, event_ts DESC);
CREATE INDEX idx_audit_events_domain ON public.audit_events(event_domain, event_type, event_ts DESC);

COMMENT ON TABLE public.audit_events IS 'Immutable audit log. Identity fields (user_id, app_role, event_ts) are server-stamped via trigger — clients cannot forge them. No UPDATE or DELETE policies exist for authenticated users. Required by blueprint section 8.4.';


-- ============================================================================
-- 4. PLATFORM INTELLIGENCE TABLES (P0)
--    The blueprint (section 12.1) requires: knowledge_sources, knowledge_versions,
--    conversations, messages, workflows, workflow_runs, draft_outputs,
--    feedback_events, review_queue, promoted_artifacts.
--    These are the missing trust primitives.
-- ============================================================================

-- 4a. Knowledge sources (governed, versioned knowledge base)
CREATE TABLE public.knowledge_sources (
    source_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    source_type         TEXT NOT NULL
                        CHECK (source_type IN (
                            'corporate_playbook','building_profile','state_reimbursement',
                            'payer_guidance','survey_template','referral_intelligence',
                            'operator_practice','faq','workflow_template','other'
                        )),
    owner_user_id       UUID REFERENCES auth.users(id),
    approver_user_id    UUID REFERENCES auth.users(id),
    facility_id         UUID REFERENCES public.facilities(facility_id),
    region              TEXT,
    state_code          public.us_state_code,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','in_review','approved','archived')),
    effective_date      DATE,
    review_due_date     DATE,
    citation_text       TEXT,
    full_content         TEXT,
    current_version     INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_sources_type_status ON public.knowledge_sources(source_type, status);
CREATE INDEX idx_knowledge_sources_facility ON public.knowledge_sources(facility_id) WHERE facility_id IS NOT NULL;
CREATE INDEX idx_knowledge_sources_state ON public.knowledge_sources(state_code) WHERE state_code IS NOT NULL;

CREATE TRIGGER trg_knowledge_sources_updated_at
BEFORE UPDATE ON public.knowledge_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

-- P1 fix: reads also require knowledge domain or status=approved with relevant domain.
-- Non-knowledge users can only see approved sources in their operational scope.
CREATE POLICY knowledge_sources_select ON public.knowledge_sources
FOR SELECT USING (
    -- Knowledge managers see everything
    public.current_user_can_domain('knowledge')
    OR (
        -- Other users see only approved sources within their facility/portfolio scope
        status = 'approved'
        AND (
            (facility_id IS NOT NULL AND public.can_access_facility(facility_id))
            OR (facility_id IS NULL AND public.can_view_portfolio())
        )
    )
);

CREATE POLICY knowledge_sources_manage ON public.knowledge_sources
FOR ALL USING (
    public.current_user_can_domain('knowledge')
) WITH CHECK (
    public.current_user_can_domain('knowledge')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_sources TO authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;

-- 4b. Knowledge versions (change history per source)
CREATE TABLE public.knowledge_versions (
    version_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id           UUID NOT NULL REFERENCES public.knowledge_sources(source_id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL,
    content_snapshot    TEXT NOT NULL,
    changed_by          UUID REFERENCES auth.users(id),
    change_summary      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_knowledge_version UNIQUE (source_id, version_number)
);

CREATE INDEX idx_knowledge_versions_source ON public.knowledge_versions(source_id, version_number DESC);

ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_versions_select ON public.knowledge_versions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.knowledge_sources ks WHERE ks.source_id = knowledge_versions.source_id)
);

CREATE POLICY knowledge_versions_manage ON public.knowledge_versions
FOR ALL USING (public.current_user_can_domain('knowledge'))
WITH CHECK (public.current_user_can_domain('knowledge'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_versions TO authenticated;
GRANT ALL ON public.knowledge_versions TO service_role;

-- 4c. Conversations (server-side conversation storage)
CREATE TABLE public.conversations (
    conversation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    facility_id         UUID REFERENCES public.facilities(facility_id),
    workflow_type       TEXT,
    risk_tier           SMALLINT NOT NULL DEFAULT 1
                        CHECK (risk_tier BETWEEN 1 AND 4),
    title               TEXT,
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','completed','archived')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_facility ON public.conversations(facility_id, updated_at DESC) WHERE facility_id IS NOT NULL;

CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_own ON public.conversations
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY conversations_audit ON public.conversations
FOR SELECT USING (public.current_user_can_domain('audit'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

-- 4d. Messages (per-conversation messages)
CREATE TABLE public.conversation_messages (
    message_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES public.conversations(conversation_id) ON DELETE CASCADE,
    role                TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
    content             TEXT NOT NULL,
    sources_used        JSONB NOT NULL DEFAULT '[]'::JSONB,
    model_used          TEXT,
    policy_version      TEXT,
    token_count         INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversation_messages_conv ON public.conversation_messages(conversation_id, created_at);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversation_messages_own ON public.conversation_messages
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.conversation_id = conversation_messages.conversation_id AND c.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.conversation_id = conversation_messages.conversation_id AND c.user_id = auth.uid())
);

CREATE POLICY conversation_messages_audit ON public.conversation_messages
FOR SELECT USING (public.current_user_can_domain('audit'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;

-- 4e. Workflow runs
CREATE TABLE public.workflow_runs (
    run_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID REFERENCES public.conversations(conversation_id),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    facility_id         UUID REFERENCES public.facilities(facility_id),
    workflow_type       TEXT NOT NULL
                        CHECK (workflow_type IN (
                            'ask','poc_draft','denial_appeal','census_plan',
                            'building_comparison','performance_review','knowledge_search','other'
                        )),
    risk_tier           SMALLINT NOT NULL DEFAULT 1 CHECK (risk_tier BETWEEN 1 AND 4),
    inputs              JSONB NOT NULL DEFAULT '{}'::JSONB,
    status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','failed','cancelled')),
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_user ON public.workflow_runs(user_id, started_at DESC);
CREATE INDEX idx_workflow_runs_type ON public.workflow_runs(workflow_type, status);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_runs_own ON public.workflow_runs
FOR ALL USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY workflow_runs_audit ON public.workflow_runs
FOR SELECT USING (public.current_user_can_domain('audit'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_runs TO authenticated;
GRANT ALL ON public.workflow_runs TO service_role;

-- 4f. Draft outputs (generated documents from workflow runs)
CREATE TABLE public.draft_outputs (
    draft_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES public.workflow_runs(run_id) ON DELETE CASCADE,
    draft_content       TEXT NOT NULL,
    source_basis        JSONB NOT NULL DEFAULT '[]'::JSONB,
    assumptions         TEXT,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','edited','approved','exported','rejected')),
    edited_content      TEXT,
    approved_by         UUID REFERENCES auth.users(id),
    approved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_draft_outputs_run ON public.draft_outputs(run_id);

CREATE TRIGGER trg_draft_outputs_updated_at
BEFORE UPDATE ON public.draft_outputs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.draft_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY draft_outputs_own ON public.draft_outputs
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workflow_runs wr WHERE wr.run_id = draft_outputs.run_id AND wr.user_id = auth.uid())
) WITH CHECK (
    EXISTS (SELECT 1 FROM public.workflow_runs wr WHERE wr.run_id = draft_outputs.run_id AND wr.user_id = auth.uid())
);

CREATE POLICY draft_outputs_audit ON public.draft_outputs
FOR SELECT USING (public.current_user_can_domain('audit'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_outputs TO authenticated;
GRANT ALL ON public.draft_outputs TO service_role;

-- 4g. Feedback events
CREATE TABLE public.feedback_events (
    feedback_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id),
    conversation_id     UUID REFERENCES public.conversations(conversation_id),
    message_id          UUID REFERENCES public.conversation_messages(message_id),
    run_id              UUID REFERENCES public.workflow_runs(run_id),
    draft_id            UUID REFERENCES public.draft_outputs(draft_id),
    rating              TEXT NOT NULL CHECK (rating IN ('useful','not_useful','correct','questionable','needs_review','saved')),
    comment             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_events_user ON public.feedback_events(user_id, created_at DESC);
CREATE INDEX idx_feedback_events_rating ON public.feedback_events(rating, created_at DESC);

ALTER TABLE public.feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_events_own ON public.feedback_events
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY feedback_events_audit ON public.feedback_events
FOR SELECT USING (public.current_user_can_domain('audit') OR public.current_user_can_domain('knowledge'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_events TO authenticated;
GRANT ALL ON public.feedback_events TO service_role;

-- P1 fix: Validate that FK references in feedback_events belong to the inserting user.
-- Prevents UUID-leak attacks where users attach bogus feedback to others' artifacts.
CREATE OR REPLACE FUNCTION public.check_feedback_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify conversation belongs to this user
    IF NEW.conversation_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.conversation_id = NEW.conversation_id AND c.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'feedback_events: conversation_id (%) does not belong to current user', NEW.conversation_id;
        END IF;
    END IF;

    -- Verify message belongs to a conversation owned by this user
    IF NEW.message_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.conversation_messages cm
            JOIN public.conversations c ON c.conversation_id = cm.conversation_id
            WHERE cm.message_id = NEW.message_id AND c.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'feedback_events: message_id (%) does not belong to current user', NEW.message_id;
        END IF;
    END IF;

    -- Verify workflow run belongs to this user
    IF NEW.run_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.workflow_runs wr
            WHERE wr.run_id = NEW.run_id AND wr.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'feedback_events: run_id (%) does not belong to current user', NEW.run_id;
        END IF;
    END IF;

    -- Verify draft belongs to a run owned by this user
    IF NEW.draft_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.draft_outputs d
            JOIN public.workflow_runs wr ON wr.run_id = d.run_id
            WHERE d.draft_id = NEW.draft_id AND wr.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'feedback_events: draft_id (%) does not belong to current user', NEW.draft_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_feedback_ownership_check
BEFORE INSERT OR UPDATE ON public.feedback_events
FOR EACH ROW
EXECUTE FUNCTION public.check_feedback_ownership();

-- 4h. Review queue (for knowledge managers)
CREATE TABLE public.review_queue (
    review_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type           TEXT NOT NULL CHECK (item_type IN ('answer','draft','question_cluster','stale_source','unsafe_output')),
    source_run_id       UUID REFERENCES public.workflow_runs(run_id),
    source_draft_id     UUID REFERENCES public.draft_outputs(draft_id),
    source_feedback_id  UUID REFERENCES public.feedback_events(feedback_id),
    submitted_by        UUID REFERENCES auth.users(id),
    reviewer_id         UUID REFERENCES auth.users(id),
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in_review','approved','rejected','deferred')),
    priority            TEXT NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','urgent')),
    notes               TEXT,
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_queue_status ON public.review_queue(status, priority, created_at);

CREATE TRIGGER trg_review_queue_updated_at
BEFORE UPDATE ON public.review_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_queue_manage ON public.review_queue
FOR ALL USING (public.current_user_can_domain('knowledge'))
WITH CHECK (public.current_user_can_domain('knowledge'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_queue TO authenticated;
GRANT ALL ON public.review_queue TO service_role;

-- 4i. Promoted artifacts (reusable knowledge from reviewed outputs)
CREATE TABLE public.promoted_artifacts (
    artifact_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_run_id       UUID REFERENCES public.workflow_runs(run_id),
    source_draft_id     UUID REFERENCES public.draft_outputs(draft_id),
    review_id           UUID REFERENCES public.review_queue(review_id),
    knowledge_source_id UUID REFERENCES public.knowledge_sources(source_id),
    artifact_type       TEXT NOT NULL
                        CHECK (artifact_type IN ('faq','workflow_template','building_playbook','payer_guidance','example_output','best_practice')),
    title               TEXT NOT NULL,
    content             TEXT NOT NULL,
    facility_id         UUID REFERENCES public.facilities(facility_id),
    state_code          public.us_state_code,
    promoted_by         UUID NOT NULL REFERENCES auth.users(id),
    promoted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','archived')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promoted_artifacts_type ON public.promoted_artifacts(artifact_type, status);

ALTER TABLE public.promoted_artifacts ENABLE ROW LEVEL SECURITY;

-- P1 fix: non-knowledge users only see active artifacts in their scope
CREATE POLICY promoted_artifacts_select ON public.promoted_artifacts
FOR SELECT USING (
    public.current_user_can_domain('knowledge')
    OR (
        status = 'active'
        AND (
            (facility_id IS NOT NULL AND public.can_access_facility(facility_id))
            OR (facility_id IS NULL AND public.can_view_portfolio())
        )
    )
);

CREATE POLICY promoted_artifacts_manage ON public.promoted_artifacts
FOR ALL USING (public.current_user_can_domain('knowledge'))
WITH CHECK (public.current_user_can_domain('knowledge'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promoted_artifacts TO authenticated;
GRANT ALL ON public.promoted_artifacts TO service_role;


-- ============================================================================
-- 5. GRANT EXECUTE on new functions
-- ============================================================================

-- Already granted above inline.

-- Done. Run 202603120001 and 202603120002 first, then this migration.
-- All RLS policies in migration 2 that are domain-sensitive have been replaced here.
-- Tables with rewritten policies in this migration:
--   resident_episodes, mds_assessments, assessment_reimbursement_classifications,
--   staffing_daily, ai_alerts, facility_risk_scores, incident_events,
--   reimbursement_events, daily_briefs, daily_brief_actions, daily_brief_facilities
