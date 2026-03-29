-- IHCM AI Command Center
-- Migration 4: Review fixes
-- Addresses P1/P2 findings from the 2026-03-28 QA critique
--
-- Depends on:
--   202603120001_core_schema.sql
--   202603120002_auth_and_rls.sql
--   202603270001_platform_hardening.sql

BEGIN;

-- ============================================================================
-- 1. MAKE knowledge_versions APPEND-ONLY
--    Version history should be readable only by knowledge reviewers and should
--    never be mutable by authenticated users.
-- ============================================================================

DROP POLICY IF EXISTS knowledge_versions_select ON public.knowledge_versions;
DROP POLICY IF EXISTS knowledge_versions_select_knowledge ON public.knowledge_versions;
DROP POLICY IF EXISTS knowledge_versions_insert ON public.knowledge_versions;
DROP POLICY IF EXISTS knowledge_versions_manage ON public.knowledge_versions;

CREATE POLICY knowledge_versions_select_knowledge ON public.knowledge_versions
FOR SELECT USING (
    public.current_user_can_domain('knowledge')
);

CREATE POLICY knowledge_versions_insert_knowledge ON public.knowledge_versions
FOR INSERT WITH CHECK (
    public.current_user_can_domain('knowledge')
);

REVOKE UPDATE, DELETE ON public.knowledge_versions FROM authenticated;
GRANT SELECT, INSERT ON public.knowledge_versions TO authenticated;
GRANT ALL ON public.knowledge_versions TO service_role;


-- ============================================================================
-- 2. ADD FACILITY-SCOPE AND LINEAGE CHECKS
--    Conversations and workflow runs should be owned by the current user,
--    scoped to accessible facilities, and internally consistent.
-- ============================================================================

DROP POLICY IF EXISTS conversations_own ON public.conversations;
DROP POLICY IF EXISTS conversations_own_select ON public.conversations;
DROP POLICY IF EXISTS conversations_own_insert ON public.conversations;
DROP POLICY IF EXISTS conversations_own_update ON public.conversations;
DROP POLICY IF EXISTS conversations_own_delete ON public.conversations;

CREATE POLICY conversations_own_select ON public.conversations
FOR SELECT USING (
    auth.uid() = user_id
);

CREATE POLICY conversations_own_insert ON public.conversations
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (facility_id IS NULL OR public.can_access_facility(facility_id))
);

CREATE POLICY conversations_own_update ON public.conversations
FOR UPDATE USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
    AND (facility_id IS NULL OR public.can_access_facility(facility_id))
);

CREATE POLICY conversations_own_delete ON public.conversations
FOR DELETE USING (
    auth.uid() = user_id
);

DROP POLICY IF EXISTS workflow_runs_own ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_own_select ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_own_insert ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_own_update ON public.workflow_runs;
DROP POLICY IF EXISTS workflow_runs_own_delete ON public.workflow_runs;

CREATE POLICY workflow_runs_own_select ON public.workflow_runs
FOR SELECT USING (
    auth.uid() = user_id
);

CREATE POLICY workflow_runs_own_insert ON public.workflow_runs
FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (facility_id IS NULL OR public.can_access_facility(facility_id))
);

CREATE POLICY workflow_runs_own_update ON public.workflow_runs
FOR UPDATE USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
    AND (facility_id IS NULL OR public.can_access_facility(facility_id))
);

CREATE POLICY workflow_runs_own_delete ON public.workflow_runs
FOR DELETE USING (
    auth.uid() = user_id
);

CREATE OR REPLACE FUNCTION public.check_workflow_run_lineage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conv_user_id  UUID;
    v_conv_facility UUID;
BEGIN
    IF NEW.conversation_id IS NOT NULL THEN
        SELECT c.user_id, c.facility_id
          INTO v_conv_user_id, v_conv_facility
          FROM public.conversations c
         WHERE c.conversation_id = NEW.conversation_id;

        IF v_conv_user_id IS NULL THEN
            RAISE EXCEPTION 'workflow_runs: conversation_id (%) does not exist', NEW.conversation_id;
        END IF;

        IF v_conv_user_id <> NEW.user_id THEN
            RAISE EXCEPTION 'workflow_runs: conversation_id (%) belongs to a different user', NEW.conversation_id;
        END IF;

        IF v_conv_facility IS NULL THEN
            IF NEW.facility_id IS NOT NULL THEN
                RAISE EXCEPTION 'workflow_runs: facility_id must be NULL when linked conversation has no facility';
            END IF;
        ELSE
            IF NEW.facility_id IS NULL THEN
                NEW.facility_id := v_conv_facility;
            ELSIF NEW.facility_id <> v_conv_facility THEN
                RAISE EXCEPTION 'workflow_runs: facility_id (%) does not match conversation facility_id (%)',
                    NEW.facility_id, v_conv_facility;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_run_lineage ON public.workflow_runs;
CREATE TRIGGER trg_workflow_run_lineage
BEFORE INSERT OR UPDATE ON public.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION public.check_workflow_run_lineage();

CREATE OR REPLACE FUNCTION public.stamp_user_id_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.user_id := auth.uid();
    ELSIF NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'conversations: user_id cannot be changed after creation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_stamp_user ON public.conversations;
CREATE TRIGGER trg_conversations_stamp_user
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.stamp_user_id_conversations();

CREATE OR REPLACE FUNCTION public.stamp_user_id_workflow_runs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.user_id := auth.uid();
    ELSIF NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'workflow_runs: user_id cannot be changed after creation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_runs_stamp_user ON public.workflow_runs;
CREATE TRIGGER trg_workflow_runs_stamp_user
BEFORE INSERT OR UPDATE ON public.workflow_runs
FOR EACH ROW
EXECUTE FUNCTION public.stamp_user_id_workflow_runs();


-- ============================================================================
-- 3. SEPARATE DRAFT OWNERSHIP FROM APPROVAL AUTHORITY
--    Owners may edit draft content. Reviewers may change approval state.
--    Neither side may alter provenance after creation.
-- ============================================================================

DROP POLICY IF EXISTS draft_outputs_own ON public.draft_outputs;
DROP POLICY IF EXISTS draft_outputs_own_select ON public.draft_outputs;
DROP POLICY IF EXISTS draft_outputs_own_insert ON public.draft_outputs;
DROP POLICY IF EXISTS draft_outputs_own_update ON public.draft_outputs;
DROP POLICY IF EXISTS draft_outputs_reviewer_select ON public.draft_outputs;
DROP POLICY IF EXISTS draft_outputs_reviewer_update ON public.draft_outputs;

CREATE POLICY draft_outputs_own_select ON public.draft_outputs
FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.workflow_runs wr
        WHERE wr.run_id = draft_outputs.run_id
          AND wr.user_id = auth.uid()
    )
);

CREATE POLICY draft_outputs_own_insert ON public.draft_outputs
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workflow_runs wr
        WHERE wr.run_id = draft_outputs.run_id
          AND wr.user_id = auth.uid()
    )
    AND status = 'draft'
    AND approved_by IS NULL
    AND approved_at IS NULL
);

CREATE POLICY draft_outputs_own_update ON public.draft_outputs
FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.workflow_runs wr
        WHERE wr.run_id = draft_outputs.run_id
          AND wr.user_id = auth.uid()
    )
);

CREATE POLICY draft_outputs_reviewer_select ON public.draft_outputs
FOR SELECT USING (
    public.current_user_can_domain('knowledge')
);

CREATE POLICY draft_outputs_reviewer_update ON public.draft_outputs
FOR UPDATE USING (
    public.current_user_can_domain('knowledge')
);

REVOKE DELETE ON public.draft_outputs FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.draft_outputs TO authenticated;
GRANT ALL ON public.draft_outputs TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_draft_approval_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_draft_owner UUID;
    v_is_reviewer BOOLEAN;
    v_is_owner BOOLEAN;
    v_approval_states TEXT[] := ARRAY['approved', 'rejected', 'exported'];
BEGIN
    SELECT wr.user_id
      INTO v_draft_owner
      FROM public.workflow_runs wr
     WHERE wr.run_id = NEW.run_id;

    IF v_draft_owner IS NULL THEN
        RAISE EXCEPTION 'draft_outputs: run_id (%) does not exist', NEW.run_id;
    END IF;

    v_is_reviewer := public.current_user_can_domain('knowledge');
    v_is_owner := auth.uid() = v_draft_owner;

    IF NEW.run_id <> OLD.run_id THEN
        RAISE EXCEPTION 'draft_outputs: run_id is immutable after creation';
    END IF;

    IF NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'draft_outputs: created_at is immutable after creation';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status = ANY(v_approval_states) THEN
        IF NOT v_is_reviewer THEN
            RAISE EXCEPTION 'draft_outputs: only reviewers can set status to %', NEW.status;
        END IF;

        IF v_is_owner THEN
            RAISE EXCEPTION 'draft_outputs: you cannot approve or reject your own draft';
        END IF;

        IF NEW.draft_content IS DISTINCT FROM OLD.draft_content
           OR NEW.edited_content IS DISTINCT FROM OLD.edited_content
           OR NEW.assumptions IS DISTINCT FROM OLD.assumptions
           OR NEW.source_basis IS DISTINCT FROM OLD.source_basis THEN
            RAISE EXCEPTION 'draft_outputs: reviewers may not edit draft content while changing approval state';
        END IF;

        NEW.approved_by := auth.uid();
        NEW.approved_at := NOW();
        RETURN NEW;
    END IF;

    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
        RAISE EXCEPTION 'draft_outputs: approval fields are managed only by the approval transition';
    END IF;

    IF v_is_owner AND NOT v_is_reviewer THEN
        IF NEW.status IS DISTINCT FROM OLD.status
           AND NEW.status NOT IN ('draft', 'edited') THEN
            RAISE EXCEPTION 'draft_outputs: owner may only use draft or edited status';
        END IF;

        RETURN NEW;
    END IF;

    IF v_is_reviewer AND NOT v_is_owner THEN
        IF NEW.draft_content IS DISTINCT FROM OLD.draft_content
           OR NEW.edited_content IS DISTINCT FROM OLD.edited_content
           OR NEW.assumptions IS DISTINCT FROM OLD.assumptions
           OR NEW.source_basis IS DISTINCT FROM OLD.source_basis THEN
            RAISE EXCEPTION 'draft_outputs: reviewers may not modify content fields directly';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NEW.status NOT IN ('approved', 'rejected', 'exported') THEN
            RAISE EXCEPTION 'draft_outputs: reviewers may only change approval-state statuses';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_draft_approval_rules ON public.draft_outputs;
CREATE TRIGGER trg_draft_approval_rules
BEFORE UPDATE ON public.draft_outputs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_draft_approval_rules();


-- ============================================================================
-- 4. NARROW knowledge_manager ROLE
--    Knowledge managers should work through governed artifacts and queues,
--    not raw operational domains.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.role_allowed_domains(p_role TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'super_admin'       THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'corporate_admin'   THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'regional_director' THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs']
        WHEN 'facility_admin'    THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs']
        WHEN 'don'               THEN ARRAY['clinical','staffing','incidents','mds','briefs']
        WHEN 'mds_lead'          THEN ARRAY['mds','reimbursement','clinical','briefs']
        WHEN 'billing'           THEN ARRAY['reimbursement','mds','briefs']
        WHEN 'clinical_lead'     THEN ARRAY['clinical','incidents','staffing','briefs']
        WHEN 'knowledge_manager' THEN ARRAY['knowledge','briefs']
        WHEN 'read_only'         THEN ARRAY['briefs']
        ELSE                          ARRAY[]::TEXT[]
    END;
$$;


-- ============================================================================
-- 5. DOCUMENTATION DRIFT FIX
-- ============================================================================

COMMENT ON COLUMN public.ai_alerts.severity IS
    'Severity level. Valid values: low, medium, high, critical (4 levels total).';


-- ============================================================================
-- 6. GRANT EXECUTE ON NEW FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.check_workflow_run_lineage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stamp_user_id_conversations() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stamp_user_id_workflow_runs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_draft_approval_rules() TO authenticated, service_role;

COMMIT;
