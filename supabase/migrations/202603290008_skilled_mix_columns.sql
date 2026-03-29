-- ============================================================================
-- Add skilled_mix_pct and medicaid_pct to building_profiles
-- ============================================================================
-- Skilled mix = Med A % + Managed Care % (the revenue-driving payer types)

ALTER TABLE public.building_profiles
    ADD COLUMN IF NOT EXISTS skilled_mix_pct NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS medicaid_pct NUMERIC(5,1);

-- Populate from payer_context data for all 7 buildings
-- Arkadelphia: Med A 6% + Managed 7% = 13%, Medicaid 66%
UPDATE public.building_profiles SET skilled_mix_pct = 13.0, medicaid_pct = 66.0
WHERE facility_id = '11111111-1111-1111-1111-111111111111';

-- Stonegate: Med A 13% + Managed 2% = 15%, Medicaid 67%
UPDATE public.building_profiles SET skilled_mix_pct = 15.0, medicaid_pct = 67.0
WHERE facility_id = '22222222-2222-2222-2222-222222222222';

-- Glenwood: Med A 9% + Managed 5% = 14%, Medicaid 80%
UPDATE public.building_profiles SET skilled_mix_pct = 14.0, medicaid_pct = 80.0
WHERE facility_id = '33333333-3333-3333-3333-333333333333';

-- The Woods: Med A 3% + Managed 0% = 3%, Medicaid 66%
UPDATE public.building_profiles SET skilled_mix_pct = 3.0, medicaid_pct = 66.0
WHERE facility_id = '44444444-4444-4444-4444-444444444444';

-- Crossett: Med A 8% + Managed 5% = 13%, Medicaid 79%
UPDATE public.building_profiles SET skilled_mix_pct = 13.0, medicaid_pct = 79.0
WHERE facility_id = '55555555-5555-5555-5555-555555555555';

-- Marymount: Med A 11% + Managed 16% = 27%, Medicaid 57%
UPDATE public.building_profiles SET skilled_mix_pct = 27.0, medicaid_pct = 57.0
WHERE facility_id = '66666666-6666-6666-6666-666666666666';

-- Erie: Med A 8% + Managed 20% = 28%, Medicaid 52%
UPDATE public.building_profiles SET skilled_mix_pct = 28.0, medicaid_pct = 52.0
WHERE facility_id = '77777777-7777-7777-7777-777777777777';

-- ============================================================================
-- Update v_bot_building_context view to use real values
-- ============================================================================
-- Must DROP first because column type changes from NULL::NUMERIC to NUMERIC(5,1)

DROP VIEW IF EXISTS public.v_bot_building_context;

CREATE VIEW public.v_bot_building_context
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
    -- Identity
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

    -- Profile fields (from building_profiles table)
    bp.payer_context,
    bp.market_summary,
    bp.referral_summary,
    bp.physician_relationships,
    bp.hospital_partners,
    bp.survey_context,
    bp.staffing_context,
    bp.reimbursement_context,
    bp.risk_watchlist,
    bp.strategic_notes,
    bp.growth_barriers,
    bp.growth_opportunities,
    bp.updated_at                               AS profile_updated_at,

    -- Snapshot fields
    rs.score_date                                AS snapshot_date,
    f.current_census                             AS census,
    (f.licensed_beds - f.current_census)         AS occupancy_gap,
    bp.skilled_mix_pct,
    NULL::NUMERIC                                AS medicare_pct,
    bp.medicaid_pct,
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

    -- Intelligence fields (still NULL — future phase)
    NULL::TEXT                                   AS intel_headline,
    NULL::TEXT                                   AS intel_summary,
    NULL::TEXT                                   AS intel_kind,
    NULL::JSONB                                  AS intel_risks,
    NULL::JSONB                                  AS intel_opportunities,
    NULL::JSONB                                  AS intel_actions,
    NULL::TEXT                                   AS intel_narrative,
    NULL::TEXT                                   AS intel_freshness,

    -- Composite risk
    rs.composite_score,
    rs.risk_label

FROM public.facilities f
LEFT JOIN latest_risk rs
    ON rs.facility_id = f.facility_id
   AND rs.rn = 1
LEFT JOIN public.building_profiles bp
    ON bp.facility_id = f.facility_id
WHERE f.operational_status <> 'inactive';

GRANT SELECT ON public.v_bot_building_context TO authenticated, service_role;
