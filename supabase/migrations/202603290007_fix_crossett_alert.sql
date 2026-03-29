-- ============================================================================
-- Fix Crossett alert: correct census data, remove false agency dependency claim
-- ============================================================================
-- Crossett actual: 61 census, 83 beds, staffing stable, no agency dependency.
-- Old alert had fabricated demo data (45 census, 63%, high agency).

UPDATE public.ai_alerts
SET
    alert_category = 'survey',
    alert_type = 'survey_due',
    severity = 'high',
    title = 'Crossett survey overdue — last survey over 1 year ago with many tags',
    description = 'Crossett has 61 residents with 83 licensed beds (72 operational). Last survey was over a year ago with significant findings. Due for resurvey.',
    recommended_action = 'Prepare survey readiness plan and conduct mock survey. Review prior deficiency areas.',
    dedupe_key = 'alert-crossett-survey',
    updated_at = NOW()
WHERE alert_id = 'e1111111-1111-1111-1111-111111111111';

-- Fix daily briefs referencing wrong Crossett data
UPDATE public.daily_briefs
SET brief_text = 'Portfolio view: Crossett is overdue for survey with prior significant findings — prepare survey readiness. Marymount has behavioral escalation on a managed-care episode. Glenwood and Arkadelphia remain stable and can serve as best-practice references.'
WHERE brief_id = 'c1111111-3333-1111-1111-111111111111';

UPDATE public.daily_briefs
SET brief_text = 'Crossett is the priority watch building. Focus today: survey readiness preparation, MD relationship rebuilding, and coordinated marketing planning with Stonegate.'
WHERE brief_id = 'c2222222-3333-1111-1111-222222222222';

-- Fix staffing daily record
UPDATE public.staffing_daily
SET
    resident_census_snapshot = 61,
    rn_hours = 12.00,
    lpn_hours = 20.00,
    cna_hours = 48.00,
    agency_hours = 0.00,
    overtime_hours = 4.00,
    hours_per_resident_day = 1.3115,
    below_target_flag = FALSE,
    notes = 'Crossett staffing stable — no agency use.'
WHERE staffing_id = 'd2222222-2222-2222-2222-222222222222';

-- Fix brief facility reason
UPDATE public.daily_brief_facilities
SET reason = 'Priority watch — survey overdue, prepare readiness plan.'
WHERE brief_facility_id = 'e1111111-5555-1111-1111-111111111111';
