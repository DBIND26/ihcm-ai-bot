-- IHCM AI Command Center
-- Migration 8: Building profiles table with real operational data
--
-- Separates strategic profile data from facility identity.
-- The v_bot_building_context view is updated to JOIN this table.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Building profiles table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.building_profiles (
    profile_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id         UUID NOT NULL UNIQUE REFERENCES public.facilities(facility_id),
    payer_context       TEXT,
    market_summary      TEXT,
    referral_summary    TEXT,
    physician_relationships TEXT,
    hospital_partners   TEXT,
    survey_context      TEXT,
    staffing_context    TEXT,
    reimbursement_context TEXT,
    risk_watchlist      TEXT,
    strategic_notes     TEXT,
    growth_barriers     JSONB,
    growth_opportunities JSONB,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by          TEXT
);

CREATE TRIGGER trg_building_profiles_updated_at
BEFORE UPDATE ON public.building_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.building_profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.building_profiles TO service_role;
GRANT SELECT ON public.building_profiles TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Update facilities with current census data
-- ════════════════════════════════════════════════════════════════════════════

UPDATE public.facilities SET current_census = 82  WHERE facility_code = 'arkadelphia';
UPDATE public.facilities SET current_census = 60  WHERE facility_code = 'stonegate';
UPDATE public.facilities SET current_census = 54, licensed_beds = 80 WHERE facility_code = 'glenwood';
UPDATE public.facilities SET current_census = 71  WHERE facility_code = 'thewoods';
UPDATE public.facilities SET current_census = 61, licensed_beds = 83 WHERE facility_code = 'crossett';
UPDATE public.facilities SET current_census = 162, licensed_beds = 234 WHERE facility_code = 'marymount';
UPDATE public.facilities SET current_census = 143, licensed_beds = 171 WHERE facility_code = 'erie';

-- Update operational status based on real conditions
UPDATE public.facilities SET operational_status = 'high_risk' WHERE facility_code = 'thewoods';
UPDATE public.facilities SET operational_status = 'watch' WHERE facility_code = 'crossett';
UPDATE public.facilities SET operational_status = 'watch' WHERE facility_code = 'marymount';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Insert building profiles
-- ════════════════════════════════════════════════════════════════════════════

-- Arkadelphia
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, strategic_notes, updated_by) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Med A 6%, Managed 7%, Private 9%, MA Pending 6%, Medicaid 66%, VA 6%. VA patient base is a differentiator.',
    'Rural Arkansas market. 100 beds, 82 census. Stable operations with room for skilled mix growth.',
    'Hospitals, hospice agencies, and physicians. No specific named partners yet — general referral base.',
    'No recent survey issues. Clean compliance history.',
    'Staffing stable. No current concerns.',
    '["Referral competition", "Lack of community marketing"]',
    '["Increase skilled mix", "VA patient growth", "Specialty programs"]',
    'Stable building. Key opportunity is growing VA referrals and skilled mix to improve revenue per patient day.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, strategic_notes = EXCLUDED.strategic_notes;

-- Stonegate
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, strategic_notes, risk_watchlist, updated_by) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Med A 13%, MA Pending 8%, Private 10%, Managed 2%, Medicaid 67%. Strongest Med A percentage in the AR portfolio.',
    'Small community suburban AR market. 76 beds, 60 census. Occupancy gap of 16 beds is significant for this size.',
    'General referral base. Coordination opportunity with Crossett (sister building).',
    'No recent survey issues.',
    'Some staffing changes lately to monitor. New Administrator, DON, and ADON — leadership team is entirely new.',
    '["Staffing challenges", "Small community limits referral volume"]',
    '["Specialty programs", "Community events", "Culture shift in building under new leadership"]',
    'New leadership team creates both risk and opportunity. If new Admin/DON stabilize, this building has the best Med A mix in AR. Monitor closely.',
    'New Admin, DON, and ADON — watch leadership stability over next 90 days.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, strategic_notes = EXCLUDED.strategic_notes,
    risk_watchlist = EXCLUDED.risk_watchlist;

-- Glenwood
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, strategic_notes, updated_by) VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Med A 9%, Managed 5%, Private 4%, MA Pending 2%, Medicaid 80%. Highest Medicaid concentration in portfolio.',
    'Rural AR market. 80 licensed / 72 operational beds, 54 census. Large occupancy gap (18 beds) despite being the model building operationally.',
    'Small town referral base. Building cherry-picks referrals — selective admissions.',
    'No survey issues. Clean compliance.',
    'Staffing stable. No concerns.',
    '["Small town limits total addressable market", "Cherry-picking referrals limits census growth"]',
    '["Centralized admissions to reduce cherry-picking", "Deepen NP relationship", "Utilize RN hospital presence", "Market specialty programs"]',
    'Model building for operations and culture. Main challenge is census — need to accept more referrals through centralized admissions and grow the funnel through NP/hospital relationships.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, strategic_notes = EXCLUDED.strategic_notes;

-- The Woods
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, risk_watchlist, strategic_notes, updated_by) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'Med A 3%, Managed 0%, Medicaid 66%, Medicaid Pending 23%, Private 8%. Very low skilled mix — almost no Medicare or managed care.',
    'Suburban AR market. 120 licensed beds, 71 census. Massive occupancy gap of 49 beds. Lowest skilled mix in the portfolio.',
    'General referral base. Needs significant referral development.',
    'CRITICAL: Horrible survey with Immediate Jeopardy (IJ) for elopement. This is the highest survey risk building in the portfolio.',
    'Staffing stability is weak. Ongoing concern.',
    '["Reputation damage from IJ survey", "Building condition not attractive for skilled patients"]',
    '["Centralized admissions", "Marketing skilled capabilities", "Specialty programs"]',
    'IJ for elopement — survey risk is critical. Staffing instability compounds the problem. Must stabilize before growth push.',
    'Highest risk building in AR portfolio. IJ elopement tag puts this on state radar. Priority: stabilize staffing, remediate elopement risk, then rebuild census. Do not push admissions until staffing and compliance are stable.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, risk_watchlist = EXCLUDED.risk_watchlist,
    strategic_notes = EXCLUDED.strategic_notes;

-- Crossett
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, strategic_notes, updated_by) VALUES (
    '55555555-5555-5555-5555-555555555555',
    'Med A 8%, Managed 5%, MA Pending 6%, Private 2%, Medicaid 79%.',
    'Rural AR market. 83 licensed / 72 operational beds, 61 census. Small town with older building. Sister building to Stonegate.',
    'Medical director not currently referring. Need to rebuild MD relationships and develop community partnerships.',
    'Last survey was over a year ago with many tags. Due for another survey — risk of repeat findings.',
    'Staffing currently stable.',
    '["Small town", "Older building condition", "Medical director not referring", "Managing community messaging on leadership changes", "Lack of local partnerships", "No coordination with sister building Stonegate"]',
    '["Coordinate with Stonegate for 10X marketing outcomes", "Proactive messaging on team changes", "MD business development meetings", "Community marketing to senior centers"]',
    'Crossett + Stonegate should be managed as a market pair. Biggest quick win is coordinated marketing between the two buildings. MD referral development is the key revenue unlock.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, strategic_notes = EXCLUDED.strategic_notes;

-- Marymount (SNF + ALF)
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, risk_watchlist, strategic_notes, updated_by) VALUES (
    '66666666-6666-6666-6666-666666666666',
    'SNF: Med A 11%, MA Pending 3%, Private 13%, Managed 16%, Medicaid 57%. ALF: Private 33%, Medicaid 67%. Strongest managed care mix in the portfolio (16% SNF).',
    'Suburban Ohio market. SNF: 130 beds / 102 census. ALF: 104 beds / 60 census. Combined 234 beds / 162 census. Largest campus in the portfolio.',
    'Needs expanded referral partners. Reputation is limiting referral volume despite strong managed care positioning.',
    'Last survey over a year ago and below average. Current leadership seems stable — need a good survey now to rebuild credibility.',
    'High staff turnover historically. Current leadership seems stable but stability is fragile.',
    '["Reputation", "Low star ratings (2-star)", "Complaint surveys", "High staff turnover history", "Lack of operational stability"]',
    '["Specialty programming", "Expanding referral partners", "Building staff stability", "Increase community engagement"]',
    '2-star rating and complaint survey history. Need a clean survey to rebuild. Leadership stability is the prerequisite for everything else.',
    'Marymount is the biggest opportunity AND biggest risk in the portfolio. If leadership stabilizes and the next survey is clean, the managed care mix and campus size make this the highest-ceiling building. If not, the reputation spiral continues.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, risk_watchlist = EXCLUDED.risk_watchlist,
    strategic_notes = EXCLUDED.strategic_notes;

-- Erie (SNF + Personal Care)
INSERT INTO public.building_profiles (facility_id, payer_context, market_summary, referral_summary, survey_context, staffing_context, growth_barriers, growth_opportunities, risk_watchlist, strategic_notes, updated_by) VALUES (
    '77777777-7777-7777-7777-777777777777',
    'SNF: Managed 20%, Med A 8%, MA Pending 10%, Medicaid 52%, Private 8%, Bed Hold 2%. Personal Care: 14 census / 32 available (all private pay). Strongest managed care building in the portfolio at 20%.',
    'Urban PA market. SNF: 139 available beds / 129 census + 3 bed holds. Personal Care: 32 available / 14 census. Combined 171 beds / 143 census. Second largest facility.',
    'Good marketing team in place. Conversion rates on referrals need improvement despite adequate volume.',
    'No current survey concerns.',
    'Staff stability is a concern. DON and Admin turnover. Agency staffing dependency.',
    '["Staff stability — DON and Admin turnover", "Agency staffing costs", "Low conversion rates on referrals"]',
    '["Specialty programming", "Maximize in-house dialysis program", "Good marketing team — leverage for growth", "Fill Personal Care beds as feeder to SNF"]',
    'DON and Admin turnover — watch leadership stability. Agency dependency increases cost and quality risk.',
    'Erie has the strongest managed care position (20%) and an in-house dialysis program — two major competitive advantages. The PC-to-SNF feeder pipeline is underdeveloped. Main risk is leadership churn eroding the advantages.',
    'dov'
) ON CONFLICT (facility_id) DO UPDATE SET
    payer_context = EXCLUDED.payer_context, market_summary = EXCLUDED.market_summary,
    referral_summary = EXCLUDED.referral_summary, survey_context = EXCLUDED.survey_context,
    staffing_context = EXCLUDED.staffing_context, growth_barriers = EXCLUDED.growth_barriers,
    growth_opportunities = EXCLUDED.growth_opportunities, risk_watchlist = EXCLUDED.risk_watchlist,
    strategic_notes = EXCLUDED.strategic_notes;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Update v_bot_building_context to JOIN building_profiles
-- ════════════════════════════════════════════════════════════════════════════

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

    -- Profile fields (now from building_profiles table)
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

COMMIT;
