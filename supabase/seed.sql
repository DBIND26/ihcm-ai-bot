-- IHCM AI Command Center seed data
-- Aligned with actual IHCM building portfolio (buildings.js slugs as facility_code).
-- Auth users are created through Supabase Auth (or beta_users for pre-auth phase).

-- ════════════════════════════════════════════════════════════════════════════
-- Facilities — 7 actual IHCM buildings
-- ════════════════════════════════════════════════════════════════════════════

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
    ('11111111-1111-1111-1111-111111111111', 'arkadelphia',  'Nightingale at Arkadelphia',  'AR', 100, 82, NULL, NULL, NULL, 'active', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'stonegate',    'Nightingale at Stonegate',    'AR', 76,  68, NULL, NULL, NULL, 'active', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'glenwood',     'Nightingale at Glenwood',     'AR', 72,  70, NULL, NULL, NULL, 'active', TRUE),
    ('44444444-4444-4444-4444-444444444444', 'thewoods',     'The Woods',                   'AR', 120, 98, NULL, NULL, NULL, 'active', TRUE),
    ('55555555-5555-5555-5555-555555555555', 'crossett',     'Nightingale at Crossett',     'AR', 72,  45, NULL, NULL, NULL, 'high_risk', TRUE),
    ('66666666-6666-6666-6666-666666666666', 'marymount',    'Villa at Marymount',          'OH', 90,  78, NULL, NULL, NULL, 'active', TRUE),
    ('77777777-7777-7777-7777-777777777777', 'erie',         'Nightingale Erie',            'PA', 85,  72, NULL, NULL, NULL, 'active', TRUE)
ON CONFLICT (facility_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample resident episodes
-- ════════════════════════════════════════════════════════════════════════════

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
    ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'RG-1001', '11111111-1111-1111-1111-111111111111', 'medicare',      'pdpm',         CURRENT_DATE - 14, NULL, 'high',   FALSE, TRUE,  'active', 'ehr_demo', 'ep-1001'),
    ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'RG-2002', '55555555-5555-5555-5555-555555555555', 'medicaid',      'state_cmi',    CURRENT_DATE - 42, NULL, 'medium', TRUE,  FALSE, 'active', 'ehr_demo', 'ep-2002'),
    ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'RG-3003', '33333333-3333-3333-3333-333333333333', 'medicare',      'pdpm',         CURRENT_DATE - 9,  NULL, 'high',   FALSE, FALSE, 'active', 'ehr_demo', 'ep-3003'),
    ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'RG-4004', '66666666-6666-6666-6666-666666666666', 'managed_care',  'managed_care', CURRENT_DATE - 5,  NULL, 'high',   TRUE,  TRUE,  'active', 'ehr_demo', 'ep-4004')
ON CONFLICT (episode_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample MDS assessments
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.mds_assessments (
    assessment_id, episode_id, facility_id, assessment_track, assessment_type,
    payment_model, ard_date, due_date, submitted_date, status,
    case_mix_index, documentation_risk_flag, source_system, source_record_id, notes
) VALUES
    ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'medicare', '5_day',               'pdpm',         CURRENT_DATE - 10, CURRENT_DATE - 7,  CURRENT_DATE - 6, 'submitted',  1.8200, FALSE, 'mds_demo', 'mds-1001',      'Submitted on time with complete documentation.'),
    ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '55555555-5555-5555-5555-555555555555', 'medicaid', 'quarterly',           'state_cmi',    CURRENT_DATE - 2,  CURRENT_DATE + 3,  NULL,             'in_progress', 1.4400, TRUE,  'mds_demo', 'mds-2002',      'State case-mix review in progress at Crossett.'),
    ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '33333333-3333-3333-3333-333333333333', 'medicare', '14_day',              'pdpm',         CURRENT_DATE - 1,  CURRENT_DATE + 1,  NULL,             'due',         1.6700, TRUE,  'mds_demo', 'mds-3003',      'PDPM 14-day assessment due at Glenwood.'),
    ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '66666666-6666-6666-6666-666666666666', 'managed_care', 'significant_change', 'managed_care', CURRENT_DATE - 4,  CURRENT_DATE - 1, NULL,             'overdue',     NULL,   TRUE,  'mds_demo', 'mds-4004',      'Behavioral escalation triggered missed due date at Marymount.'),
    ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'obra', 'admission',               'other',        CURRENT_DATE - 13, CURRENT_DATE - 9, CURRENT_DATE - 9, 'submitted',   NULL,   FALSE, 'mds_demo', 'mds-1001-obra', 'OBRA admission completed on time at Arkadelphia.')
ON CONFLICT (assessment_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample assessment reimbursement classifications
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.assessment_reimbursement_classifications (
    assessment_classification_id, assessment_id, payment_model,
    component_name, component_code, component_value, component_score, is_primary
) VALUES
    ('c1111111-1111-1111-1111-111111111111', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'pdpm',      'nursing',      'HDE2',   'Extensive Services',      1.8200, TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'pdpm',      'pt_ot',        'TC',     'Rehab Category TC',       1.1200, FALSE),
    ('c3333333-3333-3333-3333-333333333333', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'state_cmi', 'medicaid_cmi', 'AR-CMI', 'Arkansas Medicaid CMI',    1.4400, TRUE),
    ('c4444444-4444-4444-4444-444444444444', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'pdpm',      'nursing',      'HDE1',   'Extensive Services',      1.6700, TRUE)
ON CONFLICT (assessment_classification_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample staffing data
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.staffing_daily (
    staffing_id, facility_id, staffing_date, shift, resident_census_snapshot,
    rn_hours, lpn_hours, cna_hours, agency_hours, overtime_hours,
    hours_per_resident_day, below_target_flag, target_hours_per_resident_day,
    source_system, source_record_id, notes
) VALUES
    ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, 'all_day', 82,  22.00, 36.00, 80.00, 4.00,  6.00,  1.8049, FALSE, 1.8000, 'staffing_demo', 'staff-1001', 'Arkadelphia coverage met target.'),
    ('d2222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', CURRENT_DATE - 1, 'all_day', 45,  10.00, 16.00, 40.00, 12.00, 10.00, 1.5111, TRUE,  1.8000, 'staffing_demo', 'staff-2002', 'Crossett staffing under target — high agency use.'),
    ('d3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', CURRENT_DATE - 1, 'all_day', 70,  20.00, 32.00, 72.00, 0.00,  4.00,  1.8286, FALSE, 1.8000, 'staffing_demo', 'staff-3003', 'Glenwood model building — exemplary staffing pattern.'),
    ('d4444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666666', CURRENT_DATE - 1, 'all_day', 78,  18.00, 30.00, 68.00, 6.00,  8.00,  1.5641, TRUE,  1.7500, 'staffing_demo', 'staff-4004', 'Marymount evening shift callouts.'),
    ('d5555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', CURRENT_DATE - 2, 'all_day', 98,  26.00, 40.00, 96.00, 2.00,  6.00,  1.7347, FALSE, 1.7500, 'staffing_demo', 'staff-5005', 'The Woods stable coverage.')
ON CONFLICT (staffing_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample AI alerts
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.ai_alerts (
    alert_id, facility_id, episode_id, alert_date, alert_category,
    alert_type, severity, title, description, recommended_action,
    owner_role, dedupe_key, status
) VALUES
    ('e1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', NOW() - INTERVAL '4 hours', 'staffing', 'staffing_gap', 'critical', 'Crossett staffing crisis — census at 63% with high agency dependency', 'Crossett has 45 residents with 72 beds. Agency hours are 27% of total nursing hours. HPRD is below target.', 'Activate emergency staffing protocol and consider temporary admissions hold.', 'Regional', 'alert-crossett-staffing', 'open'),
    ('e2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', NOW() - INTERVAL '2 hours', 'mds', 'assessment_due', 'high', 'PDPM 14-day assessment due within 24 hours at Glenwood', 'PDPM 14-day assessment has documentation risk flag. Missing supporting documentation.', 'Escalate to MDS lead for same-day documentation review.', 'MDS', 'alert-glenwood-mds', 'open'),
    ('e3333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', NOW() - INTERVAL '1 hours', 'clinical', 'behavioral_cluster', 'high', 'Behavioral and wound risk at Marymount', 'Multiple high-acuity concerns on one managed-care episode with overdue assessment.', 'Activate clinical review and same-day interdisciplinary huddle.', 'DON', 'alert-marymount-clinical', 'in_progress'),
    ('e4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', NULL, NOW() - INTERVAL '6 hours', 'staffing', 'agency_overtime_spike', 'medium', 'The Woods weekend overtime trending up', 'Two-day staffing pattern suggests weekend coverage pressure.', 'Audit schedule and freeze discretionary PTO approvals.', 'Administrator', 'alert-thewoods-staffing', 'acknowledged')
ON CONFLICT (alert_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample risk scores
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.facility_risk_scores (
    score_id, facility_id, score_date, model_version,
    clinical_score, survey_score, staffing_score, reimbursement_score,
    admissions_score, mds_score, composite_score, risk_label,
    primary_driver, recommended_action, scoring_notes
) VALUES
    ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', CURRENT_DATE, 'v1.1', 12, 6,  10, 8,  5, 10, 51,  'stable',    'reimbursement', 'Continue current operational cadence.',                          'Arkadelphia stable across all dimensions.'),
    ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', CURRENT_DATE, 'v1.1', 10, 4,  8,  6,  5, 8,  41,  'stable',    'mds',           'Routine MDS monitoring.',                                       'Stonegate performing well.'),
    ('f3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', CURRENT_DATE, 'v1.1', 8,  4,  6,  6,  4, 12, 40,  'stable',    'mds',           'Glenwood is the model — share best practices with portfolio.',  'Model building with strong fundamentals.'),
    ('f4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', CURRENT_DATE, 'v1.1', 14, 8,  12, 10, 7, 10, 61,  'watch',     'staffing',      'Monitor weekend staffing trends.',                              'The Woods watch-level for staffing.'),
    ('f5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', CURRENT_DATE, 'v1.1', 28, 18, 30, 22, 14, 24, 136, 'critical',  'staffing',      'Immediate turnaround plan: stabilize staffing and census.',     'Crossett is highest priority turnaround.'),
    ('f6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', CURRENT_DATE, 'v1.1', 16, 10, 18, 12, 8, 14, 78,  'watch',     'staffing',      'Address evening shift coverage gaps.',                          'Marymount watch-level for clinical + staffing.'),
    ('f7777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', CURRENT_DATE, 'v1.1', 12, 8,  10, 10, 6, 10, 56,  'stable',    'reimbursement', 'Continue managed care contract optimization.',                  'Erie stable with managed care focus.')
ON CONFLICT (score_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample incidents
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.incident_events (
    incident_id, episode_id, facility_id, incident_date, reported_at,
    incident_type, harm_level, transferred_out, investigation_status,
    investigation_due_date, survey_sensitive_flag,
    root_cause, corrective_action, source_system, source_record_id, notes
) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'fall', 'minor', FALSE, 'in_progress', CURRENT_DATE + 2, FALSE, 'Unwitnessed transfer attempt', 'Reinforce toileting round compliance.', 'incident_demo', 'inc-1001', 'No hospital transfer required. Arkadelphia.'),
    ('a2222222-1111-1111-1111-222222222222', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '55555555-5555-5555-5555-555555555555', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days', 'med_error', 'major', TRUE, 'open', CURRENT_DATE + 1, TRUE, 'Shift handoff gap at Crossett', 'Pharmacy reconciliation and DON review.', 'incident_demo', 'inc-2002', 'Resident transferred for observation. Crossett turnaround issue.'),
    ('a3333333-1111-1111-1111-333333333333', 'aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '66666666-6666-6666-6666-666666666666', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours', 'behavioral_incident', 'major', FALSE, 'open', CURRENT_DATE + 3, TRUE, 'Escalating behaviors during care at Marymount', 'Immediate psych consult and staffing enhancement.', 'incident_demo', 'inc-4004', 'Managed care episode with behavioral escalation.')
ON CONFLICT (incident_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample reimbursement events
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.reimbursement_events (
    reimbursement_event_id, episode_id, assessment_id, facility_id, event_date,
    event_type, payment_model, payer_type, metric_name, metric_value,
    estimated_impact_amount, status, documentation_support_flag,
    source_system, source_record_id, notes
) VALUES
    ('b1111111-2222-1111-1111-111111111111', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', '11111111-1111-1111-1111-111111111111', CURRENT_DATE - 6, 'late_submission', 'pdpm', 'medicare', 'days_late', 1.0000, 950.00, 'resolved', TRUE, 'reimb_demo', 'reimb-1001', 'Arkadelphia late submission recovered.'),
    ('b2222222-2222-1111-1111-222222222222', 'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', '33333333-3333-3333-3333-333333333333', CURRENT_DATE - 1, 'pdpm_variance', 'pdpm', 'medicare', 'projected_rate_delta', 210.5000, 4200.00, 'open', TRUE, 'reimb_demo', 'reimb-3003', 'Glenwood PDPM variance needs documentation support.'),
    ('b3333333-2222-1111-1111-333333333333', 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '55555555-5555-5555-5555-555555555555', CURRENT_DATE, 'state_cmi_variance', 'state_cmi', 'medicaid', 'expected_cmi_delta', 0.1800, 1800.00, 'in_review', FALSE, 'reimb_demo', 'reimb-2002', 'Crossett state CMI review may lower reimbursement.')
ON CONFLICT (reimbursement_event_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Sample daily briefs
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.daily_briefs (
    brief_id, brief_date, brief_scope, facility_id, brief_text, generated_by, generated_at
) VALUES
    ('c1111111-3333-1111-1111-111111111111', CURRENT_DATE, 'portfolio', NULL, 'Portfolio view: Crossett needs immediate attention — staffing crisis with 63% occupancy and high agency dependency. Marymount has behavioral escalation on a managed-care episode. Glenwood and Arkadelphia remain stable and can serve as best-practice references.', 'system', NOW()),
    ('c2222222-3333-1111-1111-222222222222', CURRENT_DATE, 'facility', '55555555-5555-5555-5555-555555555555', 'Crossett remains the highest-priority turnaround building. Focus today: stabilize staffing, complete overdue MDS reviews, and address med error follow-up from yesterday.', 'system', NOW())
ON CONFLICT (brief_id) DO NOTHING;

INSERT INTO public.daily_brief_actions (
    brief_action_id, brief_id, action_rank, action_text, owner_role
) VALUES
    ('d1111111-4444-1111-1111-111111111111', 'c1111111-3333-1111-1111-111111111111', 1, 'Regional ops to lead Crossett turnaround review by noon.', 'Regional'),
    ('d2222222-4444-1111-1111-222222222222', 'c1111111-3333-1111-1111-111111111111', 2, 'MDS to validate Glenwood 14-day assessment documentation.', 'MDS'),
    ('d3333333-4444-1111-1111-333333333333', 'c1111111-3333-1111-1111-111111111111', 3, 'DON at Marymount to complete behavioral incident follow-up.', 'DON'),
    ('d4444444-4444-1111-1111-444444444444', 'c2222222-3333-1111-1111-222222222222', 1, 'Complete med error investigation and staffing contingency plan.', 'DON')
ON CONFLICT (brief_action_id) DO NOTHING;

INSERT INTO public.daily_brief_facilities (
    brief_facility_id, brief_id, facility_id, priority_rank, reason
) VALUES
    ('e1111111-5555-1111-1111-111111111111', 'c1111111-3333-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 1, 'Highest priority turnaround — staffing and census crisis.'),
    ('e2222222-5555-1111-1111-222222222222', 'c1111111-3333-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 2, 'Behavioral escalation on managed-care episode.'),
    ('e3333333-5555-1111-1111-333333333333', 'c1111111-3333-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 3, 'Stable but monitor fall incident.'),
    ('e4444444-5555-1111-1111-444444444444', 'c2222222-3333-1111-1111-222222222222', '55555555-5555-5555-5555-555555555555', 1, 'Facility-specific turnaround brief.')
ON CONFLICT (brief_facility_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- After migration 6, use beta_users for user identity:
-- INSERT INTO public.beta_users (user_name, role_hint) VALUES ('dov', 'super_admin');
-- ════════════════════════════════════════════════════════════════════════════
