-- IHCM AI Command Center seed data
-- This file seeds operational sample data only.
-- Auth users are created through Supabase Auth and then mapped in user_profiles/user_facility_access.

INSERT INTO public.facilities (
    facility_id,
    facility_code,
    facility_name,
    state_code,
    licensed_beds,
    current_census,
    administrator_name,
    don_name,
    mds_lead_name,
    operational_status,
    is_accepting_admissions
) VALUES
    ('11111111-1111-1111-1111-111111111111', 'IHCM-OH-001', 'Maple Grove Care Center', 'OH', 120, 98, 'Angela Morris', 'Kelly Stone', 'Monica Reed', 'watch', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'IHCM-OH-002', 'Pine Ridge Health & Rehab', 'OH', 90, 82, 'David Warren', 'Cynthia Cole', 'Alisha Kent', 'active', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'IHCM-OH-003', 'River Valley Nursing', 'OH', 100, 91, 'Henry Price', 'Jill Harper', 'Sandra Myles', 'active', TRUE),
    ('44444444-4444-4444-4444-444444444444', 'IHCM-PA-001', 'Heritage Hills Care', 'PA', 110, 95, 'Maria Fox', 'Tanya Lewis', 'Heather Boone', 'watch', TRUE),
    ('55555555-5555-5555-5555-555555555555', 'IHCM-PA-002', 'Lakeside Manor', 'PA', 85, 78, 'Jason Clark', 'Nicole Pratt', 'Violet Sims', 'active', TRUE),
    ('66666666-6666-6666-6666-666666666666', 'IHCM-AR-001', 'Ozark Springs Care Center', 'AR', 95, 88, 'Stephen Rice', 'Brandi Holt', 'Elaine Ross', 'high_risk', TRUE),
    ('77777777-7777-7777-7777-777777777777', 'IHCM-AR-002', 'Valley View Health', 'AR', 100, 110, 'Kimberly West', 'Rachel Dunn', 'Paula Vance', 'critical', FALSE)
ON CONFLICT (facility_id) DO NOTHING;

INSERT INTO public.resident_episodes (
    episode_id,
    resident_internal_id,
    facility_id,
    payer_type,
    payment_model,
    admission_date,
    discharge_date,
    acuity_level,
    behavioral_flag,
    wound_flag,
    episode_status,
    source_system,
    source_record_id
) VALUES
    ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'RG-1001', '11111111-1111-1111-1111-111111111111', 'medicare', 'pdpm', CURRENT_DATE - 14, NULL, 'high', FALSE, TRUE, 'active', 'ehr_demo', 'ep-1001'),
    ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'RG-2002', '22222222-2222-2222-2222-222222222222', 'medicaid', 'state_cmi', CURRENT_DATE - 42, NULL, 'medium', TRUE, FALSE, 'active', 'ehr_demo', 'ep-2002'),
    ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'RG-3003', '66666666-6666-6666-6666-666666666666', 'medicare', 'rugs_iv', CURRENT_DATE - 9, NULL, 'high', FALSE, FALSE, 'active', 'ehr_demo', 'ep-3003'),
    ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'RG-4004', '77777777-7777-7777-7777-777777777777', 'managed_care', 'managed_care', CURRENT_DATE - 5, NULL, 'high', TRUE, TRUE, 'active', 'ehr_demo', 'ep-4004')
ON CONFLICT (episode_id) DO NOTHING;

INSERT INTO public.mds_assessments (
    assessment_id,
    episode_id,
    facility_id,
    assessment_track,
    assessment_type,
    payment_model,
    ard_date,
    due_date,
    submitted_date,
    status,
    case_mix_index,
    documentation_risk_flag,
    source_system,
    source_record_id,
    notes
) VALUES
    ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'medicare', '5_day', 'pdpm', CURRENT_DATE - 10, CURRENT_DATE - 7, CURRENT_DATE - 6, 'submitted', 1.8200, FALSE, 'mds_demo', 'mds-1001', 'Submitted one day late after documentation catch-up.'),
    ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'medicaid', 'quarterly', 'state_cmi', CURRENT_DATE - 2, CURRENT_DATE + 3, NULL, 'in_progress', 1.4400, TRUE, 'mds_demo', 'mds-2002', 'State case-mix review in progress.'),
    ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '66666666-6666-6666-6666-666666666666', 'medicare', '14_day', 'rugs_iv', CURRENT_DATE - 1, CURRENT_DATE + 1, NULL, 'due', 1.6700, TRUE, 'mds_demo', 'mds-3003', 'Historical RUG-IV payer still active for this market.'),
    ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '77777777-7777-7777-7777-777777777777', 'managed_care', 'significant_change', 'managed_care', CURRENT_DATE - 4, CURRENT_DATE - 1, NULL, 'overdue', NULL, TRUE, 'mds_demo', 'mds-4004', 'Behavioral escalation triggered missed due date.'),
    ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'obra', 'admission', 'other', CURRENT_DATE - 13, CURRENT_DATE - 9, CURRENT_DATE - 9, 'submitted', NULL, FALSE, 'mds_demo', 'mds-1001-obra', 'OBRA admission completed on time.')
ON CONFLICT (assessment_id) DO NOTHING;

INSERT INTO public.assessment_reimbursement_classifications (
    assessment_classification_id,
    assessment_id,
    payment_model,
    component_name,
    component_code,
    component_value,
    component_score,
    is_primary
) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'pdpm', 'nursing', 'HDE2', 'Extensive Services', 1.8200, TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'pdpm', 'pt_ot', 'TC', 'Rehab Category TC', 1.1200, FALSE),
    ('c3333333-3333-3333-3333-333333333333', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'state_cmi', 'medicaid_cmi', 'PA-CMI', 'Pennsylvania Medicaid CMI', 1.4400, TRUE),
    ('c4444444-4444-4444-4444-444444444444', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'rugs_iv', 'rug_group', 'RUB', 'Rehabilitation Ultra High', 1.6700, TRUE)
ON CONFLICT (assessment_classification_id) DO NOTHING;

INSERT INTO public.staffing_daily (
    staffing_id,
    facility_id,
    staffing_date,
    shift,
    resident_census_snapshot,
    rn_hours,
    lpn_hours,
    cna_hours,
    agency_hours,
    overtime_hours,
    hours_per_resident_day,
    below_target_flag,
    target_hours_per_resident_day,
    source_system,
    source_record_id,
    notes
) VALUES
    ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, 'all_day', 98, 24.00, 40.00, 96.00, 8.00, 12.00, 1.7143, TRUE, 1.8500, 'staffing_demo', 'staff-1001', 'Agency use remained above plan.'),
    ('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', CURRENT_DATE - 1, 'all_day', 82, 22.00, 36.00, 88.00, 0.00, 4.00, 1.7805, FALSE, 1.7000, 'staffing_demo', 'staff-2002', 'Coverage met target.'),
    ('d3333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', CURRENT_DATE - 1, 'all_day', 88, 18.00, 28.00, 68.00, 16.00, 18.00, 1.4773, TRUE, 1.8000, 'staffing_demo', 'staff-3003', 'Open CNA callouts impacted coverage.'),
    ('d4444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', CURRENT_DATE - 1, 'all_day', 110, 20.00, 30.00, 72.00, 22.00, 20.00, 1.3091, TRUE, 1.8500, 'staffing_demo', 'staff-4004', 'Census exceeded licensed bed target; urgent staffing review.'),
    ('d5555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', CURRENT_DATE - 2, 'all_day', 95, 24.00, 34.00, 90.00, 4.00, 8.00, 1.6000, TRUE, 1.7500, 'staffing_demo', 'staff-5005', 'Evening callouts increased overtime.')
ON CONFLICT (staffing_id) DO NOTHING;

INSERT INTO public.ai_alerts (
    alert_id,
    facility_id,
    episode_id,
    alert_date,
    alert_category,
    alert_type,
    severity,
    title,
    description,
    recommended_action,
    owner_role,
    dedupe_key,
    status
) VALUES
    ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', NOW() - INTERVAL '4 hours', 'staffing', 'staffing_gap', 'high', 'Staffing target missed at Maple Grove', 'RN and CNA coverage missed HPRD target for the prior day.', 'Review agency plan and approve weekend incentive coverage.', 'DON', 'alert-maple-staffing-20260312', 'open'),
    ('e2222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', NOW() - INTERVAL '2 hours', 'mds', 'historical_payer_assessment_due', 'critical', 'RUG-IV assessment due within 24 hours', 'Historical RUG-IV reimbursement assessment is due tomorrow with documentation risk flagged.', 'Escalate to MDS lead and regional reimbursement support.', 'MDS', 'alert-ozark-mds-20260312', 'open'),
    ('e3333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', NOW() - INTERVAL '1 hours', 'clinical', 'behavioral_cluster', 'critical', 'Behavioral and wound risk escalation', 'Multiple high-acuity concerns are clustering on one managed-care episode with overdue assessment activity.', 'Activate regional clinical review and same-day interdisciplinary huddle.', 'Regional', 'alert-valley-clinical-20260312', 'in_progress'),
    ('e4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', NULL, NOW() - INTERVAL '6 hours', 'staffing', 'agency_overtime_spike', 'medium', 'Agency and overtime trending up', 'Two-day staffing pattern suggests weekend coverage pressure at Heritage Hills.', 'Audit schedule and freeze discretionary PTO approvals.', 'Administrator', 'alert-heritage-staffing-20260312', 'acknowledged')
ON CONFLICT (alert_id) DO NOTHING;

INSERT INTO public.facility_risk_scores (
    score_id,
    facility_id,
    score_date,
    model_version,
    clinical_score,
    survey_score,
    staffing_score,
    reimbursement_score,
    admissions_score,
    mds_score,
    composite_score,
    risk_label,
    primary_driver,
    recommended_action,
    scoring_notes
) VALUES
    ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, 'v1.1', 20, 8, 26, 12, 6, 18, 90, 'watch', 'staffing', 'Stabilize staffing before next weekend and verify MDS completion timing.', 'Elevated staffing pressure but clinical indicators stable.'),
    ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, 'v1.1', 10, 4, 8, 10, 5, 14, 51, 'stable', 'mds', 'Close out the in-progress state CMI review.', 'Mostly stable with one pending reimbursement-sensitive assessment.'),
    ('f3333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', CURRENT_DATE, 'v1.1', 14, 12, 20, 8, 7, 10, 71, 'watch', 'staffing', 'Rebalance weekend schedule and validate overtime controls.', 'Survey exposure low but staffing trend needs attention.'),
    ('f4444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', CURRENT_DATE, 'v1.1', 18, 10, 24, 28, 9, 30, 119, 'high_risk', 'mds', 'Assign regional reimbursement support to historical payer workflows.', 'Legacy reimbursement workflows are creating deadline risk.'),
    ('f5555555-5555-5555-5555-555555555555', '77777777-7777-7777-7777-777777777777', CURRENT_DATE, 'v1.1', 34, 16, 30, 18, 12, 32, 142, 'critical', 'clinical', 'Immediate corporate review with admissions hold until stabilization.', 'High census, overdue assessment work, and clinical acuity stacked together.')
ON CONFLICT (score_id) DO NOTHING;

INSERT INTO public.incident_events (
    incident_id,
    episode_id,
    facility_id,
    incident_date,
    reported_at,
    incident_type,
    harm_level,
    transferred_out,
    investigation_status,
    investigation_due_date,
    survey_sensitive_flag,
    root_cause,
    corrective_action,
    source_system,
    source_record_id,
    notes
) VALUES
    ('g1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'fall', 'minor', FALSE, 'in_progress', CURRENT_DATE + 2, FALSE, 'Unwitnessed transfer attempt', 'Reinforce toileting round compliance.', 'incident_demo', 'inc-1001', 'No hospital transfer required.'),
    ('g2222222-2222-2222-2222-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '66666666-6666-6666-6666-666666666666', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days', 'med_error', 'major', TRUE, 'open', CURRENT_DATE + 1, TRUE, 'Shift handoff gap', 'Pharmacy reconciliation and DON review.', 'incident_demo', 'inc-3003', 'Resident transferred for observation.'),
    ('g3333333-3333-3333-3333-333333333333', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '77777777-7777-7777-7777-777777777777', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours', 'behavioral_incident', 'major', FALSE, 'open', CURRENT_DATE + 3, TRUE, 'Escalating behaviors during care', 'Immediate psych consult and staffing enhancement.', 'incident_demo', 'inc-4004', 'Triggered same-day command-center attention.')
ON CONFLICT (incident_id) DO NOTHING;

INSERT INTO public.reimbursement_events (
    reimbursement_event_id,
    episode_id,
    assessment_id,
    facility_id,
    event_date,
    event_type,
    payment_model,
    payer_type,
    metric_name,
    metric_value,
    estimated_impact_amount,
    status,
    documentation_support_flag,
    source_system,
    source_record_id,
    notes
) VALUES
    ('h1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 6, 'late_submission', 'pdpm', 'medicare', 'days_late', 1.0000, 950.00, 'resolved', TRUE, 'reimb_demo', 'reimb-1001', 'Late submission recovered after supporting documentation review.'),
    ('h2222222-2222-2222-2222-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '66666666-6666-6666-6666-666666666666', CURRENT_DATE - 1, 'rugs_variance', 'rugs_iv', 'medicare', 'projected_rate_delta', 210.5000, 4200.00, 'open', TRUE, 'reimb_demo', 'reimb-3003', 'Legacy payer workflow shows material reimbursement variance risk.'),
    ('h3333333-3333-3333-3333-333333333333', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, 'state_cmi_variance', 'state_cmi', 'medicaid', 'expected_cmi_delta', 0.1800, 1800.00, 'in_review', FALSE, 'reimb_demo', 'reimb-2002', 'State case-mix review may lower expected reimbursement if not supported.')
ON CONFLICT (reimbursement_event_id) DO NOTHING;

INSERT INTO public.daily_briefs (
    brief_id,
    brief_date,
    brief_scope,
    facility_id,
    brief_text,
    generated_by,
    generated_at
) VALUES
    ('i1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'portfolio', NULL, 'Portfolio view: Valley View and Ozark Springs need immediate attention due to stacked clinical, MDS, and reimbursement risk. Maple Grove and Heritage Hills show staffing pressure that should be managed before it becomes survey exposure.', 'system', NOW()),
    ('i2222222-2222-2222-2222-222222222222', CURRENT_DATE, 'facility', '77777777-7777-7777-7777-777777777777', 'Valley View remains in critical operating mode. Focus today on admissions freeze enforcement, overdue MDS completion, and clinical incident follow-up.', 'system', NOW())
ON CONFLICT (brief_id) DO NOTHING;

INSERT INTO public.daily_brief_actions (
    brief_action_id,
    brief_id,
    action_rank,
    action_text,
    owner_role
) VALUES
    ('j1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', 1, 'Regional clinical leadership to review Valley View before noon.', 'Regional'),
    ('j2222222-2222-2222-2222-222222222222', 'i1111111-1111-1111-1111-111111111111', 2, 'MDS support to validate Ozark Springs historical payer workflow.', 'MDS'),
    ('j3333333-3333-3333-3333-333333333333', 'i1111111-1111-1111-1111-111111111111', 3, 'Operations to address Maple Grove and Heritage Hills staffing plans.', 'Administrator'),
    ('j4444444-4444-4444-4444-444444444444', 'i2222222-2222-2222-2222-222222222222', 1, 'Complete significant-change assessment triage and hold new admissions.', 'DON')
ON CONFLICT (brief_action_id) DO NOTHING;

INSERT INTO public.daily_brief_facilities (
    brief_facility_id,
    brief_id,
    facility_id,
    priority_rank,
    reason
) VALUES
    ('k1111111-1111-1111-1111-111111111111', 'i1111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 1, 'Critical clinical and census pressure.'),
    ('k2222222-2222-2222-2222-222222222222', 'i1111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 2, 'Legacy reimbursement workflow and staffing risk.'),
    ('k3333333-3333-3333-3333-333333333333', 'i1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 3, 'Staffing below target with moderate reimbursement exposure.'),
    ('k4444444-4444-4444-4444-444444444444', 'i2222222-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777', 1, 'Facility-specific escalation remains active.')
ON CONFLICT (brief_facility_id) DO NOTHING;

-- After users sign in through Supabase Auth, assign their access with statements like:
-- UPDATE public.user_profiles
-- SET app_role = 'regional_director',
--     global_access_level = 'view'
-- WHERE email = 'regional@example.com';
--
-- INSERT INTO public.user_facility_access (user_id, facility_id, access_level)
-- VALUES ('<auth-user-uuid>', '11111111-1111-1111-1111-111111111111', 'admin');
