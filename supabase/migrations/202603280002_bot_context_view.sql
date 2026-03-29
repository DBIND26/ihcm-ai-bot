-- IHCM AI Command Center
-- Migration 5: Bot building context view
-- Creates v_bot_building_context in the public schema to serve the chat API.
--
-- This view maps production tables (facilities, facility_risk_scores) into the
-- flat shape that api/chat.js formatters expect. Fields that don't exist yet in
-- the production schema return NULL — chat.js handles missing fields gracefully
-- with its `if (ctx.field)` guards.
--
-- When profile/snapshot/intelligence tables are added to the production schema,
-- this view should be extended with LEFT JOINs to those tables.
--
-- Depends on:
--   202603120001_core_schema.sql (facilities, facility_risk_scores)

BEGIN;

CREATE OR REPLACE VIEW public.v_bot_building_context
WITH (security_invoker = true) AS
WITH latest_risk AS (
    SELECT
        rs.*,
        ROW_NUMBER() OVER (
            PARTITION BY rs.facility_id
            ORDER BY rs.score_date DESC, rs.created_at DESC, rs.score_id DESC
        ) AS rn
    FROM public.facility_risk_scores rs
)
SELECT
    -- Identity (from facilities)
    f.facility_id,
    f.facility_code                             AS slug,
    f.facility_name                             AS label,
    f.facility_name                             AS building_label,
    f.facility_name                             AS short_name,
    f.state_code                                AS state,
    NULL::TEXT                                   AS cms_id,
    f.licensed_beds                              AS bed_capacity,
    NULL::TEXT                                   AS market_type,
    f.operational_status                         AS strategic_status,
    NULL::TEXT                                   AS strategic_label,

    -- Profile fields (not yet in production schema — return NULL)
    -- These will be populated when a building_profiles table is added
    NULL::TEXT                                   AS payer_context,
    NULL::TEXT                                   AS market_summary,
    NULL::TEXT                                   AS referral_summary,
    NULL::TEXT                                   AS physician_relationships,
    NULL::TEXT                                   AS hospital_partners,
    NULL::TEXT                                   AS survey_context,
    NULL::TEXT                                   AS staffing_context,
    NULL::TEXT                                   AS reimbursement_context,
    NULL::TEXT                                   AS risk_watchlist,
    NULL::TEXT                                   AS strategic_notes,
    NULL::JSONB                                  AS growth_barriers,
    NULL::JSONB                                  AS growth_opportunities,
    NULL::TIMESTAMPTZ                            AS profile_updated_at,

    -- Snapshot fields (derived from current facility + risk data)
    rs.score_date                                AS snapshot_date,
    f.current_census                             AS census,
    (f.licensed_beds - f.current_census)         AS occupancy_gap,
    NULL::NUMERIC                                AS skilled_mix_pct,
    NULL::NUMERIC                                AS medicare_pct,
    NULL::NUMERIC                                AS medicaid_pct,
    NULL::NUMERIC                                AS managed_care_pct,
    NULL::TEXT                                   AS referral_pressure,
    CASE
        WHEN rs.survey_score >= 20 THEN 'high'
        WHEN rs.survey_score >= 10 THEN 'medium'
        ELSE 'low'
    END                                          AS survey_risk_level,
    CASE
        WHEN rs.staffing_score >= 24 THEN 'high'
        WHEN rs.staffing_score >= 12 THEN 'medium'
        ELSE 'low'
    END                                          AS staffing_risk_level,
    CASE
        WHEN rs.reimbursement_score >= 20 THEN 'high'
        WHEN rs.reimbursement_score >= 10 THEN 'medium'
        ELSE 'low'
    END                                          AS reimbursement_risk_level,
    NULL::TEXT                                   AS ar_issues,
    CASE
        WHEN rs.primary_driver IS NOT NULL THEN ARRAY[rs.primary_driver]
        ELSE NULL
    END                                          AS top_priorities,
    rs.created_at                                AS snapshot_updated_at,

    -- Intelligence fields (not yet in production schema)
    NULL::TEXT                                   AS intel_headline,
    NULL::TEXT                                   AS intel_summary,
    NULL::TEXT                                   AS intel_kind,
    NULL::JSONB                                  AS intel_risks,
    NULL::JSONB                                  AS intel_opportunities,
    NULL::JSONB                                  AS intel_actions,
    NULL::TEXT                                   AS intel_narrative,
    NULL::TEXT                                   AS intel_freshness,

    -- Composite risk for sorting/filtering
    rs.composite_score,
    rs.risk_label

FROM public.facilities f
LEFT JOIN latest_risk rs
    ON rs.facility_id = f.facility_id
   AND rs.rn = 1
WHERE f.operational_status <> 'inactive';

-- Grant access through RLS (security_invoker means the caller's policies apply)
GRANT SELECT ON public.v_bot_building_context TO authenticated, service_role;

COMMENT ON VIEW public.v_bot_building_context IS
    'Flat building context view for the bot chat API. Maps production tables into '
    'the shape api/chat.js expects. NULL columns are placeholders for profile, '
    'snapshot, and intelligence fields that will be added in future migrations.';

COMMIT;
