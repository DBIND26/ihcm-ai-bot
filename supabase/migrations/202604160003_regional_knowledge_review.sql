-- ============================================================================
-- Grant regional_director the 'knowledge' domain so they can review and
-- approve knowledge_sources uploads within their facility scope. Building-
-- level roles (facility_admin, don, mds_lead, etc.) deliberately do not get
-- knowledge review access.
--
-- The API-level PATCH handler applies a second, tighter guard: regional_director
-- may only approve sources whose facility_id is in their user_facility_access.
-- Portfolio-scoped sources (facility_id IS NULL) remain super_admin /
-- corporate_admin only.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.role_allowed_domains(p_role TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'super_admin'       THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'corporate_admin'   THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge','audit']
        WHEN 'regional_director' THEN ARRAY['clinical','mds','staffing','reimbursement','admissions','survey','incidents','briefs','knowledge']
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

COMMIT;
