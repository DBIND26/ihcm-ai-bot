-- IHCM AI Command Center
-- Supabase auth, grants, and row-level security

CREATE TABLE public.user_profiles (
    user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email                TEXT,
    full_name            TEXT,
    app_role             TEXT NOT NULL DEFAULT 'read_only'
                         CHECK (app_role IN (
                             'super_admin',
                             'corporate_admin',
                             'regional_director',
                             'facility_admin',
                             'don',
                             'mds_lead',
                             'billing',
                             'clinical_lead',
                             'read_only'
                         )),
    global_access_level  TEXT NOT NULL DEFAULT 'none'
                         CHECK (global_access_level IN ('none', 'view', 'edit', 'admin')),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_facility_access (
    access_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    facility_id          UUID NOT NULL REFERENCES public.facilities(facility_id) ON DELETE CASCADE,
    access_level         TEXT NOT NULL DEFAULT 'view'
                         CHECK (access_level IN ('view', 'edit', 'admin')),
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_facility_access UNIQUE (user_id, facility_id)
);

CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_facility_access_updated_at
BEFORE UPDATE ON public.user_facility_access
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ihcm_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ihcm_handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ihcm_auth_user_created ON auth.users;

CREATE TRIGGER trg_ihcm_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.ihcm_handle_new_user();

CREATE OR REPLACE FUNCTION public.current_global_access_level()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT up.global_access_level
            FROM public.user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.is_active = TRUE
            LIMIT 1
        ),
        'none'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_portfolio()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.current_global_access_level() IN ('view', 'edit', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_portfolio()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.current_global_access_level() IN ('edit', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.can_access_facility(target_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN public.can_view_portfolio() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM public.user_facility_access ufa
                WHERE ufa.user_id = auth.uid()
                  AND ufa.facility_id = target_facility_id
                  AND ufa.is_active = TRUE
            )
        END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_facility(target_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN public.can_manage_portfolio() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM public.user_facility_access ufa
                WHERE ufa.user_id = auth.uid()
                  AND ufa.facility_id = target_facility_id
                  AND ufa.is_active = TRUE
                  AND ufa.access_level IN ('edit', 'admin')
            )
        END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_assessment(target_assessment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.mds_assessments m
        WHERE m.assessment_id = target_assessment_id
          AND public.can_access_facility(m.facility_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assessment(target_assessment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.mds_assessments m
        WHERE m.assessment_id = target_assessment_id
          AND public.can_manage_facility(m.facility_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_daily_brief(target_scope TEXT, target_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN target_scope = 'portfolio' THEN public.can_view_portfolio()
            WHEN target_scope = 'facility' AND target_facility_id IS NOT NULL THEN public.can_access_facility(target_facility_id)
            ELSE FALSE
        END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_daily_brief(target_scope TEXT, target_facility_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN target_scope = 'portfolio' THEN public.can_manage_portfolio()
            WHEN target_scope = 'facility' AND target_facility_id IS NOT NULL THEN public.can_manage_facility(target_facility_id)
            ELSE FALSE
        END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_brief(target_brief_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.daily_briefs db
        WHERE db.brief_id = target_brief_id
          AND public.can_access_daily_brief(db.brief_scope, db.facility_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_brief(target_brief_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.daily_briefs db
        WHERE db.brief_id = target_brief_id
          AND public.can_manage_daily_brief(db.brief_scope, db.facility_id)
    );
$$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.facilities,
   public.resident_episodes,
   public.mds_assessments,
   public.assessment_reimbursement_classifications,
   public.staffing_daily,
   public.ai_alerts,
   public.facility_risk_scores,
   public.incident_events,
   public.reimbursement_events,
   public.daily_briefs,
   public.daily_brief_actions,
   public.daily_brief_facilities,
   public.user_profiles,
   public.user_facility_access
TO authenticated;

GRANT ALL
ON public.facilities,
   public.resident_episodes,
   public.mds_assessments,
   public.assessment_reimbursement_classifications,
   public.staffing_daily,
   public.ai_alerts,
   public.facility_risk_scores,
   public.incident_events,
   public.reimbursement_events,
   public.daily_briefs,
   public.daily_brief_actions,
   public.daily_brief_facilities,
   public.user_profiles,
   public.user_facility_access
TO service_role;

GRANT SELECT
ON public.v_facility_risk_current,
   public.v_alerts_open,
   public.v_mds_control_tower,
   public.v_staffing_issues,
   public.v_revenue_leakage,
   public.v_incident_trending
TO authenticated, service_role;

GRANT EXECUTE
ON FUNCTION public.current_global_access_level(),
   public.can_view_portfolio(),
   public.can_manage_portfolio(),
   public.can_access_facility(UUID),
   public.can_manage_facility(UUID),
   public.can_access_assessment(UUID),
   public.can_manage_assessment(UUID),
   public.can_access_daily_brief(TEXT, UUID),
   public.can_manage_daily_brief(TEXT, UUID),
   public.can_access_brief(UUID),
   public.can_manage_brief(UUID)
TO authenticated, service_role;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facility_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mds_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_reimbursement_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffing_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_brief_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_brief_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_select
ON public.user_profiles
FOR SELECT
USING (
    auth.uid() = user_id
    OR public.current_global_access_level() = 'admin'
);

CREATE POLICY user_profiles_admin_insert
ON public.user_profiles
FOR INSERT
WITH CHECK (public.current_global_access_level() = 'admin');

CREATE POLICY user_profiles_admin_update
ON public.user_profiles
FOR UPDATE
USING (public.current_global_access_level() = 'admin')
WITH CHECK (public.current_global_access_level() = 'admin');

CREATE POLICY user_profiles_admin_delete
ON public.user_profiles
FOR DELETE
USING (public.current_global_access_level() = 'admin');

CREATE POLICY user_facility_access_select
ON public.user_facility_access
FOR SELECT
USING (
    auth.uid() = user_id
    OR public.current_global_access_level() = 'admin'
);

CREATE POLICY user_facility_access_admin_insert
ON public.user_facility_access
FOR INSERT
WITH CHECK (public.current_global_access_level() = 'admin');

CREATE POLICY user_facility_access_admin_update
ON public.user_facility_access
FOR UPDATE
USING (public.current_global_access_level() = 'admin')
WITH CHECK (public.current_global_access_level() = 'admin');

CREATE POLICY user_facility_access_admin_delete
ON public.user_facility_access
FOR DELETE
USING (public.current_global_access_level() = 'admin');

CREATE POLICY facilities_select
ON public.facilities
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY facilities_insert
ON public.facilities
FOR INSERT
WITH CHECK (public.can_manage_portfolio());

CREATE POLICY facilities_update
ON public.facilities
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY facilities_delete
ON public.facilities
FOR DELETE
USING (public.can_manage_portfolio());

CREATE POLICY resident_episodes_select
ON public.resident_episodes
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY resident_episodes_insert
ON public.resident_episodes
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY resident_episodes_update
ON public.resident_episodes
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY resident_episodes_delete
ON public.resident_episodes
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY mds_assessments_select
ON public.mds_assessments
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY mds_assessments_insert
ON public.mds_assessments
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY mds_assessments_update
ON public.mds_assessments
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY mds_assessments_delete
ON public.mds_assessments
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY assessment_reimbursement_classifications_select
ON public.assessment_reimbursement_classifications
FOR SELECT
USING (public.can_access_assessment(assessment_id));

CREATE POLICY assessment_reimbursement_classifications_insert
ON public.assessment_reimbursement_classifications
FOR INSERT
WITH CHECK (public.can_manage_assessment(assessment_id));

CREATE POLICY assessment_reimbursement_classifications_update
ON public.assessment_reimbursement_classifications
FOR UPDATE
USING (public.can_manage_assessment(assessment_id))
WITH CHECK (public.can_manage_assessment(assessment_id));

CREATE POLICY assessment_reimbursement_classifications_delete
ON public.assessment_reimbursement_classifications
FOR DELETE
USING (public.can_manage_assessment(assessment_id));

CREATE POLICY staffing_daily_select
ON public.staffing_daily
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY staffing_daily_insert
ON public.staffing_daily
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY staffing_daily_update
ON public.staffing_daily
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY staffing_daily_delete
ON public.staffing_daily
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY ai_alerts_select
ON public.ai_alerts
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY ai_alerts_insert
ON public.ai_alerts
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY ai_alerts_update
ON public.ai_alerts
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY ai_alerts_delete
ON public.ai_alerts
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY facility_risk_scores_select
ON public.facility_risk_scores
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY facility_risk_scores_insert
ON public.facility_risk_scores
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY facility_risk_scores_update
ON public.facility_risk_scores
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY facility_risk_scores_delete
ON public.facility_risk_scores
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY incident_events_select
ON public.incident_events
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY incident_events_insert
ON public.incident_events
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY incident_events_update
ON public.incident_events
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY incident_events_delete
ON public.incident_events
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY reimbursement_events_select
ON public.reimbursement_events
FOR SELECT
USING (public.can_access_facility(facility_id));

CREATE POLICY reimbursement_events_insert
ON public.reimbursement_events
FOR INSERT
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY reimbursement_events_update
ON public.reimbursement_events
FOR UPDATE
USING (public.can_manage_facility(facility_id))
WITH CHECK (public.can_manage_facility(facility_id));

CREATE POLICY reimbursement_events_delete
ON public.reimbursement_events
FOR DELETE
USING (public.can_manage_facility(facility_id));

CREATE POLICY daily_briefs_select
ON public.daily_briefs
FOR SELECT
USING (public.can_access_daily_brief(brief_scope, facility_id));

CREATE POLICY daily_briefs_insert
ON public.daily_briefs
FOR INSERT
WITH CHECK (public.can_manage_daily_brief(brief_scope, facility_id));

CREATE POLICY daily_briefs_update
ON public.daily_briefs
FOR UPDATE
USING (public.can_manage_daily_brief(brief_scope, facility_id))
WITH CHECK (public.can_manage_daily_brief(brief_scope, facility_id));

CREATE POLICY daily_briefs_delete
ON public.daily_briefs
FOR DELETE
USING (public.can_manage_daily_brief(brief_scope, facility_id));

CREATE POLICY daily_brief_actions_select
ON public.daily_brief_actions
FOR SELECT
USING (public.can_access_brief(brief_id));

CREATE POLICY daily_brief_actions_insert
ON public.daily_brief_actions
FOR INSERT
WITH CHECK (public.can_manage_brief(brief_id));

CREATE POLICY daily_brief_actions_update
ON public.daily_brief_actions
FOR UPDATE
USING (public.can_manage_brief(brief_id))
WITH CHECK (public.can_manage_brief(brief_id));

CREATE POLICY daily_brief_actions_delete
ON public.daily_brief_actions
FOR DELETE
USING (public.can_manage_brief(brief_id));

CREATE POLICY daily_brief_facilities_select
ON public.daily_brief_facilities
FOR SELECT
USING (public.can_access_brief(brief_id));

CREATE POLICY daily_brief_facilities_insert
ON public.daily_brief_facilities
FOR INSERT
WITH CHECK (public.can_manage_brief(brief_id));

CREATE POLICY daily_brief_facilities_update
ON public.daily_brief_facilities
FOR UPDATE
USING (public.can_manage_brief(brief_id))
WITH CHECK (public.can_manage_brief(brief_id));

CREATE POLICY daily_brief_facilities_delete
ON public.daily_brief_facilities
FOR DELETE
USING (public.can_manage_brief(brief_id));
