-- IHCM Knowledge Base — Initial regulatory seed data
-- These are summary references from public CMS and state sources.
-- Full documents can be ingested via the /api/ingest-knowledge endpoint.

-- CMS PDPM Overview
INSERT INTO public.knowledge_sources (title, source_type, tags, status, effective_date, citation_text, full_content) VALUES (
    'CMS PDPM Payment Model Overview',
    'payer_guidance',
    ARRAY['pdpm', 'medicare', 'reimbursement', 'cms'],
    'approved',
    '2026-01-01',
    'Patient-Driven Payment Model (PDPM) replaced RUG-IV for Medicare Part A SNF reimbursement effective October 1, 2019.',
    'PATIENT-DRIVEN PAYMENT MODEL (PDPM) — KEY REFERENCE

PDPM classifies patients into payment groups based on clinical characteristics rather than volume of services.

FIVE CASE-MIX ADJUSTED COMPONENTS:
1. Physical Therapy (PT) — based on functional status (Section GG)
2. Occupational Therapy (OT) — based on functional status (Section GG)
3. Speech-Language Pathology (SLP) — based on cognitive status and swallowing disorders
4. Nursing — based on clinical conditions, comorbidities, and extensive services
5. Non-Therapy Ancillary (NTA) — based on diagnoses, conditions, and medications

VARIABLE PER DIEM ADJUSTMENTS:
- PT, OT, SLP: per diem rate decreases over the stay (front-loaded)
- Nursing: flat per diem for entire stay
- NTA: per diem decreases after day 3 (front-loaded)

SECTION GG — CRITICAL FOR REIMBURSEMENT:
- Self-care items: eating, oral hygiene, toileting, dressing upper/lower body, putting on/taking off footwear
- Mobility items: lying to sitting, sitting to standing, chair/bed to chair transfer, toilet transfer, walking
- Score range: 01 (dependent) to 06 (independent)
- LOWER scores = HIGHER payment (more dependent = more care needed)
- Must reflect ADMISSION performance, not potential

KEY MDS ASSESSMENT TIMING:
- 5-day: ARD must be set within days 1-8 of admission
- IPA (Interim Payment Assessment): optional, for significant clinical change
- Discharge assessment: required within 14 days of discharge

COMMON REVENUE LEAKAGE POINTS:
- Section GG scores coded too high (patients coded as more independent than admission performance)
- Missing NTA-qualifying diagnoses in the MDS
- Late assessments missing the ARD window
- Failure to capture extensive services (IV meds, tracheostomy care, ventilator, isolation)
- Not utilizing IPA when clinical status changes significantly

IHCM PRIORITY ACTIONS:
- Train all nursing staff on accurate Section GG scoring at admission
- MDS coordinators should review NTA capture checklist for every admission
- Use the clinical documentation prompt workflow to ensure supporting documentation
- Monitor PDPM case-mix index trends monthly per building'
) ON CONFLICT DO NOTHING;

-- CMS Survey Process
INSERT INTO public.knowledge_sources (title, source_type, tags, status, effective_date, citation_text, full_content) VALUES (
    'CMS Survey Process and F-Tag Structure',
    'survey_template',
    ARRAY['survey', 'compliance', 'f-tags', 'cms', 'poc'],
    'approved',
    '2026-01-01',
    'CMS surveys evaluate SNF compliance with federal requirements. Deficiencies are cited as F-tags with scope and severity ratings.',
    'CMS SURVEY PROCESS AND F-TAG REFERENCE

SURVEY TYPES:
- Standard (annual) survey: comprehensive review of all requirements
- Complaint survey: triggered by specific allegations
- Revisit survey: follows up on previously cited deficiencies

SCOPE AND SEVERITY GRID:
Severity levels (1-4):
  1 = No actual harm with potential for minimal harm
  2 = No actual harm with potential for more than minimal harm
  3 = Actual harm that is not immediate jeopardy
  4 = Immediate Jeopardy (IJ) — serious injury, harm, impairment, or death

Scope levels:
  A-C = Isolated (affects one or a very limited number of residents)
  D-F = Pattern (affects more than a limited number but not all residents)
  G-I = Widespread (affects all or nearly all residents)

IMMEDIATE JEOPARDY (IJ):
- Most serious citation level
- Facility must remove the IJ situation immediately
- Results in per-instance or per-day civil money penalties
- Can result in denial of payment for new admissions
- Triggers state monitoring and accelerated revisit

HIGH-PRIORITY F-TAGS FOR IHCM:
- F600-F609: Freedom from abuse, neglect, exploitation
- F684: Quality of care — treatment and services
- F689: Free from accident hazards (falls, elopement)
- F725: Sufficient staffing
- F726: Competent staffing
- F880: Infection prevention and control

PLAN OF CORRECTION (POC) REQUIREMENTS:
1. How the facility will correct the deficiency for affected residents
2. How the facility will identify other residents who may be affected
3. What systemic changes will prevent recurrence
4. How the facility will monitor the corrective actions
5. Completion date (within regulatory timeframe)

POC BEST PRACTICES:
- Be specific — name the actions, responsible parties, and timelines
- Address root cause, not just the symptom
- Include staff education with dates and topics
- Include monitoring plan with frequency and responsible person
- Do not admit liability — describe corrective actions factually'
) ON CONFLICT DO NOTHING;

-- Arkansas Medicaid SNF Reimbursement
INSERT INTO public.knowledge_sources (title, source_type, state_code, tags, status, effective_date, citation_text, full_content) VALUES (
    'Arkansas Medicaid SNF Reimbursement Overview',
    'state_reimbursement',
    'AR',
    ARRAY['medicaid', 'reimbursement', 'arkansas', 'case-mix'],
    'approved',
    '2026-01-01',
    'Arkansas Medicaid uses a case-mix adjusted per diem rate for SNF reimbursement, with rates set by DHS.',
    'ARKANSAS MEDICAID SNF REIMBURSEMENT

RATE STRUCTURE:
- Prospective per diem rate, case-mix adjusted
- Rates established by Arkansas Department of Human Services (DHS)
- Components: nursing, capital, and ancillary
- Case-mix index based on RUG classification from MDS assessments
- Rates rebased periodically with cost report data

KEY CONSIDERATIONS FOR IHCM AR BUILDINGS:
- Arkadelphia, Stonegate, Glenwood, The Woods, Crossett all have 66-80% Medicaid census
- Medicaid rate adequacy is critical for operational sustainability
- Case-mix accuracy directly impacts revenue — ensure MDS coding captures true acuity
- Medicaid Pending residents (significant at The Woods 23%) represent cash flow risk until approved
- VA patients at Arkadelphia (6%) follow separate VA per diem rates

COST REPORT REQUIREMENTS:
- Annual Medicaid cost report required
- Accurate cost allocation between nursing, capital, and ancillary
- Staffing costs are the largest component
- Agency staffing costs may be treated differently than direct-hire costs

RATE APPEAL PROCESS:
- Facilities can appeal rate determinations
- Must demonstrate errors in rate calculation or cost report processing
- Time-limited filing window after rate notification'
) ON CONFLICT DO NOTHING;

-- Ohio Medicaid SNF Reimbursement
INSERT INTO public.knowledge_sources (title, source_type, state_code, tags, status, effective_date, citation_text, full_content) VALUES (
    'Ohio Medicaid SNF Reimbursement Overview',
    'state_reimbursement',
    'OH',
    ARRAY['medicaid', 'reimbursement', 'ohio', 'case-mix'],
    'approved',
    '2026-01-01',
    'Ohio uses a case-mix per diem system for Medicaid SNF reimbursement administered by the Ohio Department of Medicaid.',
    'OHIO MEDICAID SNF REIMBURSEMENT

RATE STRUCTURE:
- Case-mix adjusted per diem rate
- Administered by Ohio Department of Medicaid (ODM)
- Components: direct care, ancillary/indirect, capital, tax add-on
- Case-mix index derived from MDS assessment data
- Quality incentive payment available for facilities meeting quality metrics

KEY CONSIDERATIONS FOR IHCM MARYMOUNT:
- Marymount SNF: 57% Medicaid, ALF: 67% Medicaid
- Managed care is 16% of SNF census — Ohio has significant Medicaid managed care penetration
- Star rating (currently 2-star) may impact managed care contract rates
- Quality metrics improvement can unlock incentive payments
- ALF Medicaid rates follow separate waiver program rules

MANAGED CARE IN OHIO:
- Ohio transitioned much of its Medicaid to managed care organizations (MCOs)
- MCO contracts may offer different rates than fee-for-service Medicaid
- MCOs may have different authorization requirements
- Marymount should actively manage MCO relationships for rate optimization

QUALITY METRICS:
- Ohio Quality Incentive Payment (QIP) program rewards high-performing facilities
- Metrics include staffing levels, quality measures, and survey performance
- 2-star rating at Marymount currently limits QIP eligibility — improving survey performance is a revenue opportunity'
) ON CONFLICT DO NOTHING;

-- Pennsylvania Medicaid SNF Reimbursement
INSERT INTO public.knowledge_sources (title, source_type, state_code, tags, status, effective_date, citation_text, full_content) VALUES (
    'Pennsylvania Medicaid SNF Reimbursement Overview',
    'state_reimbursement',
    'PA',
    ARRAY['medicaid', 'reimbursement', 'pennsylvania', 'case-mix'],
    'approved',
    '2026-01-01',
    'Pennsylvania uses a case-mix per diem system for Medicaid SNF reimbursement administered by DHS with managed care overlay.',
    'PENNSYLVANIA MEDICAID SNF REIMBURSEMENT

RATE STRUCTURE:
- Case-mix adjusted per diem rate
- Administered by Pennsylvania Department of Human Services (DHS)
- Significant managed care penetration through HealthChoices program
- Components: nursing, resident care, administrative, capital
- Rates adjusted annually based on cost reports and case-mix data

KEY CONSIDERATIONS FOR IHCM ERIE:
- Erie SNF: 52% Medicaid, 20% Managed Care — highest managed care mix in portfolio
- Managed care contracts are a critical revenue driver
- In-house dialysis program creates a competitive advantage for managed care contracts
- Personal Care (14 census / 32 available) operates under separate PA licensing and rates
- Agency staffing dependency (DON/Admin turnover) increases costs and risks managed care penalties

MANAGED CARE IN PENNSYLVANIA:
- HealthChoices is PA mandatory Medicaid managed care program
- MCOs negotiate rates directly with SNFs
- Contract terms may include quality metrics, readmission penalties, and length-of-stay targets
- Erie 20% managed care position is strong — protect and expand these relationships
- Referral conversion rate improvement is the key growth lever

PERSONAL CARE HOMES:
- Licensed separately from SNFs in PA
- Private pay and Medicaid waiver funding
- Can serve as feeder pipeline to SNF (step-up when acuity increases)
- Erie has significant vacancy (14/32) — filling these beds creates SNF referral pipeline'
) ON CONFLICT DO NOTHING;

-- SNF Staffing Requirements
INSERT INTO public.knowledge_sources (title, source_type, tags, status, effective_date, citation_text, full_content) VALUES (
    'CMS SNF Staffing Requirements and Best Practices',
    'operator_practice',
    ARRAY['staffing', 'compliance', 'cms', 'hprd'],
    'approved',
    '2026-01-01',
    'CMS requires sufficient staffing to meet resident needs. The proposed minimum staffing rule targets 3.48 HPRD including 0.55 RN HPRD.',
    'SNF STAFFING REQUIREMENTS AND BEST PRACTICES

FEDERAL REQUIREMENTS:
- Sufficient nursing staff to meet resident needs (F725)
- Licensed nurse 24/7 (at least one RN 8 consecutive hours/day, 7 days/week)
- Director of Nursing must be an RN
- Competent staff with appropriate training (F726)

CMS PROPOSED MINIMUM STAFFING RULE:
- Total nursing: 3.48 hours per resident day (HPRD)
- RN minimum: 0.55 HPRD
- Nurse aide minimum: 2.45 HPRD
- 24/7 RN on-site requirement
- Phase-in period with rural exemptions

IHCM PORTFOLIO STAFFING ANALYSIS:
- Target HPRD varies by building (1.75-1.85 currently)
- Below-target flags most common at Crossett (agency-dependent) and The Woods (instability)
- Glenwood is the staffing model — zero agency, meets targets consistently
- Erie has structural DON/Admin turnover creating instability
- Stonegate has entirely new leadership team — monitor closely

AGENCY STAFFING RISKS:
- Higher cost per hour than direct-hire staff
- Less continuity of care (different staff each shift)
- Survey risk — surveyors look at agency percentage
- Quality risk — agency staff less familiar with residents and protocols
- Agency dependency at Crossett and Erie needs reduction plans

STAFFING BEST PRACTICES:
- Track HPRD daily, not just monthly averages
- Set building-specific targets based on acuity mix
- Monitor agency percentage as a key metric (target: <10% of total hours)
- Retention programs: shift differentials, referral bonuses, education support
- Weekend/holiday coverage plans established monthly in advance
- Cross-training CNAs for specialized care (wound care, feeding assistance)'
) ON CONFLICT DO NOTHING;
