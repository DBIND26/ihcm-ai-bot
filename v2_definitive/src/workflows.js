// ============================================================================
// IHCM AI Bot Widget v2 — Workflow Templates (DEFINITIVE)
// ============================================================================
// Static fallback for ihcm_bot.workflow_templates table.
//
// Each workflow defines:
//   - requiredInputs / optionalInputs: fields for the UI form
//   - missingInfoQuestions: what the bot asks if inputs are incomplete
//   - outputSections: required sections in the generated document
//   - reviewChecklist: post-generation review items
//   - promptTemplate(inputs): builds the structured prompt from collected fields
//
// In production, workflow_templates rows are fetched from Supabase.
// This file provides the runtime shape and static fallback.
// ============================================================================

export const WORKFLOWS = {

  // ── DON workflows ──

  poc_drafter: {
    id: 'poc_drafter',
    roleId: 'don',
    label: 'Plan of Correction',
    description: 'Draft a structured POC for a state or federal citation.',
    requiredInputs: [
      { name: 'f_tag', label: 'F-Tag Number', type: 'text', placeholder: 'e.g. F689' },
      { name: 'survey_date', label: 'Survey Date', type: 'date', placeholder: '' },
      { name: 'building', label: 'Building Name', type: 'text', placeholder: '' },
      { name: 'deficient_practice', label: 'Deficient Practice Summary', type: 'textarea', placeholder: 'Briefly describe what was cited' },
    ],
    optionalInputs: [
      { name: 'scope_severity', label: 'Scope & Severity', type: 'text', placeholder: 'e.g. D, G, J' },
      { name: 'immediate_actions', label: 'Immediate Actions Already Taken', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: [
      'What F-tag were you cited for?',
      'What date was the survey?',
      'Which building was cited?',
      'Can you briefly describe the deficient practice?',
    ],
    outputSections: [
      'Citation Reference',
      'Deficient Practice Statement',
      'Immediate Corrective Actions',
      'Root Cause Analysis',
      'Systemic Changes',
      'Monitoring Plan (with responsible party and frequency)',
      'Completion Date',
    ],
    reviewChecklist: [
      'F-tag number matches the actual citation',
      'Deficient practice statement is accurate and complete',
      'Root cause analysis identifies the system failure, not just the individual',
      'Monitoring plan has specific frequency, responsible party, and duration',
      'Completion date is realistic and within regulatory requirements',
      'No resident names or PHI in the document',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a Plan of Correction for the following citation.`,
        ``,
        `F-Tag: ${inputs.f_tag}`,
        `Survey Date: ${inputs.survey_date}`,
        `Building: ${inputs.building}`,
        `Deficient Practice: ${inputs.deficient_practice}`,
        inputs.scope_severity ? `Scope & Severity: ${inputs.scope_severity}` : '',
        inputs.immediate_actions ? `Immediate Actions Already Taken: ${inputs.immediate_actions}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  staff_education_outline: {
    id: 'staff_education_outline',
    roleId: 'don',
    label: 'Staff Education Outline',
    description: 'Generate a structured education session outline.',
    requiredInputs: [
      { name: 'topic', label: 'Education Topic', type: 'text', placeholder: 'e.g. Fall Prevention, Infection Control' },
      { name: 'target_audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. All CNAs, Night Shift RNs' },
      { name: 'compliance_driver', label: 'Compliance Driver', type: 'text', placeholder: 'e.g. F689 citation, annual requirement, QAPI finding' },
    ],
    optionalInputs: [
      { name: 'duration', label: 'Session Duration', type: 'text', placeholder: 'e.g. 30 minutes' },
    ],
    missingInfoQuestions: [
      'What topic should the education cover?',
      'Who is the target audience?',
      'What is driving this education need (citation, QAPI, annual requirement)?',
    ],
    outputSections: [
      'Session Title',
      'Learning Objectives (3-5)',
      'Compliance/Regulatory Background',
      'Key Content Points',
      'Case Scenario or Discussion Question',
      'Competency Verification Method',
      'Documentation Requirements',
    ],
    reviewChecklist: [
      'Learning objectives are measurable',
      'Content aligns with the compliance driver',
      'Competency verification method is practical for the audience',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a staff education session outline.`,
        ``,
        `Topic: ${inputs.topic}`,
        `Target Audience: ${inputs.target_audience}`,
        `Compliance Driver: ${inputs.compliance_driver}`,
        inputs.duration ? `Duration: ${inputs.duration}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  incident_followup_plan: {
    id: 'incident_followup_plan',
    roleId: 'don',
    label: 'Incident Follow-Up Plan',
    description: 'Generate a follow-up plan after a clinical incident.',
    requiredInputs: [
      { name: 'incident_type', label: 'Incident Type', type: 'text', placeholder: 'e.g. Fall with injury, Medication error, Elopement' },
      { name: 'incident_date', label: 'Incident Date', type: 'date', placeholder: '' },
      { name: 'immediate_actions', label: 'Immediate Actions Taken', type: 'textarea', placeholder: '' },
    ],
    optionalInputs: [
      { name: 'building', label: 'Building', type: 'text', placeholder: '' },
      { name: 'outcome', label: 'Resident Outcome', type: 'text', placeholder: 'e.g. Sent to ER, No injury, Minor bruise' },
    ],
    missingInfoQuestions: [
      'What type of incident occurred?',
      'When did it happen?',
      'What immediate actions were already taken?',
    ],
    outputSections: [
      'Incident Summary',
      'Immediate Response Actions',
      'Root Cause Investigation Steps',
      'Care Plan Revisions',
      'Staff Re-education Plan',
      'Monitoring Plan (frequency, responsible party, duration)',
      'Family/Responsible Party Communication Plan',
      'Reporting Requirements',
    ],
    reviewChecklist: [
      'All immediate actions are documented',
      'Root cause investigation is thorough (not just individual blame)',
      'Monitoring plan has specific metrics and timeframes',
      'Reporting requirements (state, CMS, family) are addressed',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft an incident follow-up plan.`,
        ``,
        `Incident Type: ${inputs.incident_type}`,
        `Date: ${inputs.incident_date}`,
        `Immediate Actions Taken: ${inputs.immediate_actions}`,
        inputs.building ? `Building: ${inputs.building}` : '',
        inputs.outcome ? `Resident Outcome: ${inputs.outcome}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── Admin workflows ──

  admin_census_growth_plan: {
    id: 'admin_census_growth_plan',
    roleId: 'admin',
    label: 'Census Growth Plan',
    description: 'Draft a 30/60/90-day census growth plan.',
    requiredInputs: [
      { name: 'building', label: 'Building Name', type: 'text', placeholder: '' },
      { name: 'current_census', label: 'Current Census', type: 'number', placeholder: '' },
      { name: 'bed_capacity', label: 'Bed Capacity', type: 'number', placeholder: '' },
      { name: 'target_census', label: 'Target Census', type: 'number', placeholder: '' },
    ],
    optionalInputs: [
      { name: 'top_referral_sources', label: 'Top Referral Sources', type: 'textarea', placeholder: 'List current top referral sources' },
      { name: 'payer_mix', label: 'Current Payer Mix', type: 'text', placeholder: 'e.g. 35% Medicare, 50% Medicaid, 15% MA' },
      { name: 'timeline', label: 'Timeline', type: 'text', placeholder: 'e.g. 60 days, 90 days' },
    ],
    missingInfoQuestions: [
      'Which building is this plan for?',
      'What is your current census?',
      'What is the bed capacity?',
      'What census target are you aiming for?',
    ],
    outputSections: [
      'Current State (census, capacity, payer mix, occupancy gap)',
      '30-Day Targets and Actions',
      '60-Day Targets and Actions',
      '90-Day Targets and Actions',
      'Referral Source Strategy',
      'Discharge Planner Outreach Plan',
      'Marketing Actions',
      'Responsible Parties',
      'Tracking Metrics',
    ],
    reviewChecklist: [
      'Census figures are accurate',
      'Targets are realistic given historical trends',
      'Each 30-day phase has specific, actionable items',
      'Referral sources are named and strategies are specific',
      'Tracking metrics are measurable',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a 30/60/90-day census growth plan.`,
        ``,
        `Building: ${inputs.building}`,
        `Current Census: ${inputs.current_census}`,
        `Bed Capacity: ${inputs.bed_capacity}`,
        `Target Census: ${inputs.target_census}`,
        inputs.top_referral_sources ? `Top Referral Sources: ${inputs.top_referral_sources}` : '',
        inputs.payer_mix ? `Current Payer Mix: ${inputs.payer_mix}` : '',
        inputs.timeline ? `Timeline: ${inputs.timeline}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  board_memo: {
    id: 'board_memo',
    roleId: 'admin',
    label: 'Board Memo',
    description: 'Draft a formatted board memo.',
    requiredInputs: [
      { name: 'subject', label: 'Subject', type: 'text', placeholder: '' },
      { name: 'key_data', label: 'Key Data Points', type: 'textarea', placeholder: 'List the most important facts, numbers, or findings' },
      { name: 'recommendation', label: 'Recommendation', type: 'textarea', placeholder: 'What action do you want the board to take?' },
    ],
    optionalInputs: [
      { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'e.g. Full Board, Finance Committee' },
      { name: 'buildings_in_scope', label: 'Buildings in Scope', type: 'text', placeholder: '' },
    ],
    missingInfoQuestions: [
      'What is the subject of the memo?',
      'What are the key data points or findings?',
      'What recommendation do you want to make?',
    ],
    outputSections: [
      'Subject Line',
      'Executive Summary (3-5 sentences)',
      'Background',
      'Analysis with Financial Impact',
      'Recommendation',
      'Next Steps',
      'Prepared By',
    ],
    reviewChecklist: [
      'Executive summary is concise and actionable',
      'Financial figures are accurate',
      'Recommendation is clear and specific',
      'No confidential operational details that should not go to the board',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a board memo.`,
        ``,
        `Subject: ${inputs.subject}`,
        `Key Data Points: ${inputs.key_data}`,
        `Recommendation: ${inputs.recommendation}`,
        inputs.audience ? `Target Audience: ${inputs.audience}` : '',
        inputs.buildings_in_scope ? `Buildings in Scope: ${inputs.buildings_in_scope}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── Admin workflows (continued) ──

  survey_prep_checklist: {
    id: 'survey_prep_checklist',
    roleId: 'admin',
    label: 'Survey Preparedness Checklist',
    description: 'Generate a survey readiness checklist for an upcoming state or federal survey.',
    requiredInputs: [
      { name: 'building', label: 'Building Name', type: 'text', placeholder: '' },
      { name: 'survey_type', label: 'Survey Type', type: 'text', placeholder: 'e.g. Annual state survey, Federal recert, Complaint investigation' },
      { name: 'expected_timeframe', label: 'Expected Timeframe', type: 'text', placeholder: 'e.g. Within 30 days, Next quarter, Overdue' },
    ],
    optionalInputs: [
      { name: 'last_survey_date', label: 'Last Survey Date', type: 'date', placeholder: '' },
      { name: 'previous_citations', label: 'Previous Citations', type: 'textarea', placeholder: 'List F-tags from last survey' },
      { name: 'known_risks', label: 'Known Risk Areas', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: [
      'Which building is preparing for survey?',
      'What type of survey are you expecting?',
      'When do you expect the survey?',
    ],
    outputSections: [
      'Survey Readiness Overview',
      'High-Risk Areas (based on previous citations and known risks)',
      'Environmental Readiness Checklist',
      'Clinical Documentation Readiness',
      'Staff Interview Preparation',
      'Resident/Family Preparation',
      'Day-of-Survey Logistics',
      'Post-Survey Response Plan',
    ],
    reviewChecklist: [
      'Previous citations are accurately referenced',
      'High-risk areas reflect current building conditions',
      'Staff interview preparation covers common survey questions',
      'Day-of logistics include contact list and document staging',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a survey preparedness checklist.`,
        ``,
        `Building: ${inputs.building}`,
        `Survey Type: ${inputs.survey_type}`,
        `Expected Timeframe: ${inputs.expected_timeframe}`,
        inputs.last_survey_date ? `Last Survey Date: ${inputs.last_survey_date}` : '',
        inputs.previous_citations ? `Previous Citations: ${inputs.previous_citations}` : '',
        inputs.known_risks ? `Known Risk Areas: ${inputs.known_risks}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── Billing workflows ──

  appeal_letter: {
    id: 'appeal_letter',
    roleId: 'billing',
    label: 'Denial Appeal Letter',
    description: 'Draft a structured appeal letter for a claim denial.',
    requiredInputs: [
      { name: 'payer', label: 'Payer', type: 'text', placeholder: 'e.g. Medicare Part A, UHC, Aetna MA' },
      { name: 'denial_code', label: 'Denial Code', type: 'text', placeholder: 'e.g. CO-96, CO-97, PR-1' },
      { name: 'denial_reason', label: 'Denial Reason', type: 'textarea', placeholder: 'What reason did the payer give?' },
      { name: 'clinical_justification', label: 'Clinical Justification', type: 'textarea', placeholder: 'Why the services were medically necessary' },
    ],
    optionalInputs: [
      { name: 'building', label: 'Building', type: 'text', placeholder: '' },
      { name: 'claim_amount', label: 'Claim Amount', type: 'text', placeholder: '' },
      { name: 'dates_of_service', label: 'Dates of Service', type: 'text', placeholder: '' },
    ],
    missingInfoQuestions: [
      'Which payer denied the claim?',
      'What is the denial code?',
      'What reason did the payer give for the denial?',
      'What clinical justification supports the services provided?',
    ],
    outputSections: [
      'Appeal Reference (claim number, dates, payer)',
      'Statement of Denial',
      'Clinical Justification',
      'Regulatory/Coverage Basis',
      'Supporting Documentation List',
      'Requested Action',
      'Contact Information',
    ],
    reviewChecklist: [
      'Denial code and reason match the actual denial',
      'Clinical justification is specific to this resident (no generic language)',
      'Appeal deadline has been verified',
      'Supporting documents are listed and attached',
      'No resident names or PHI beyond what is required for the appeal',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a denial appeal letter.`,
        ``,
        `Payer: ${inputs.payer}`,
        `Denial Code: ${inputs.denial_code}`,
        `Denial Reason: ${inputs.denial_reason}`,
        `Clinical Justification: ${inputs.clinical_justification}`,
        inputs.building ? `Building: ${inputs.building}` : '',
        inputs.claim_amount ? `Claim Amount: ${inputs.claim_amount}` : '',
        inputs.dates_of_service ? `Dates of Service: ${inputs.dates_of_service}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  denial_pattern_analysis: {
    id: 'denial_pattern_analysis',
    roleId: 'billing',
    label: 'Denial Pattern Analysis',
    description: 'Analyze denial trends across a building or portfolio.',
    requiredInputs: [
      { name: 'scope', label: 'Scope', type: 'text', placeholder: 'e.g. Crossett only, All Arkansas, Portfolio-wide' },
      { name: 'time_period', label: 'Time Period', type: 'text', placeholder: 'e.g. Q1 2026, Last 90 days' },
      { name: 'denial_data', label: 'Denial Data Summary', type: 'textarea', placeholder: 'List top denial codes, counts, payers, and dollar amounts' },
    ],
    optionalInputs: [
      { name: 'comparison_period', label: 'Comparison Period', type: 'text', placeholder: 'e.g. Q4 2025' },
    ],
    missingInfoQuestions: [
      'What scope should this analysis cover (one building, state, or portfolio)?',
      'What time period should I analyze?',
      'Can you provide the denial data (codes, counts, payers, dollar amounts)?',
    ],
    outputSections: [
      'Executive Summary',
      'Top Denial Codes by Volume',
      'Top Denial Codes by Dollar Amount',
      'Payer-Specific Patterns',
      'Root Cause Analysis',
      'Recommended Actions (ranked by financial impact)',
      'Tracking Plan',
    ],
    reviewChecklist: [
      'Denial data matches source reports',
      'Dollar amounts are verified',
      'Root causes are actionable (not just descriptive)',
      'Recommendations have assigned owners and timelines',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a denial pattern analysis memo.`,
        ``,
        `Scope: ${inputs.scope}`,
        `Time Period: ${inputs.time_period}`,
        `Denial Data: ${inputs.denial_data}`,
        inputs.comparison_period ? `Comparison Period: ${inputs.comparison_period}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── MDS workflows ──

  clinical_documentation_prompt: {
    id: 'clinical_documentation_prompt',
    roleId: 'mds',
    label: 'Clinical Documentation Prompt',
    description: 'Generate targeted documentation prompts to strengthen MDS coding support.',
    requiredInputs: [
      { name: 'mds_section', label: 'MDS Section', type: 'text', placeholder: 'e.g. Section GG, NTA, Nursing Classification' },
      { name: 'current_documentation', label: 'What Documentation Exists', type: 'textarea', placeholder: 'Describe what is currently in the clinical record' },
      { name: 'coding_goal', label: 'Coding Goal', type: 'textarea', placeholder: 'What MDS item or classification are you trying to support?' },
    ],
    optionalInputs: [
      { name: 'building', label: 'Building', type: 'text', placeholder: '' },
      { name: 'discipline', label: 'Target Discipline', type: 'text', placeholder: 'e.g. Nursing, Therapy, Physician' },
    ],
    missingInfoQuestions: [
      'Which MDS section are you working on?',
      'What documentation currently exists in the record?',
      'What coding goal are you trying to support?',
    ],
    outputSections: [
      'Current Documentation Assessment',
      'Documentation Gaps Identified',
      'Recommended Documentation Language (by discipline)',
      'MDS Coding Connection (how documentation supports the code)',
      'Compliance Notes',
    ],
    reviewChecklist: [
      'Documentation recommendations are clinically accurate',
      'Recommendations do not suggest documenting anything not clinically present',
      'MDS coding connections are correct per RAI manual',
      'No resident-identifying information included',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft clinical documentation prompts to strengthen MDS coding support.`,
        ``,
        `MDS Section: ${inputs.mds_section}`,
        `Current Documentation: ${inputs.current_documentation}`,
        `Coding Goal: ${inputs.coding_goal}`,
        inputs.building ? `Building: ${inputs.building}` : '',
        inputs.discipline ? `Target Discipline: ${inputs.discipline}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  pdpm_optimization_review: {
    id: 'pdpm_optimization_review',
    roleId: 'mds',
    label: 'PDPM Optimization Review',
    description: 'Analyze a new admission for reimbursement optimization.',
    requiredInputs: [
      { name: 'admission_date', label: 'Admission Date', type: 'date', placeholder: '' },
      { name: 'primary_diagnosis', label: 'Primary Diagnosis', type: 'text', placeholder: '' },
      { name: 'section_gg_scores', label: 'Section GG Scores', type: 'textarea', placeholder: 'List key GG items and scores' },
      { name: 'nta_items', label: 'NTA Items Present', type: 'textarea', placeholder: 'List comorbidities and treatments present on days 1-3' },
    ],
    optionalInputs: [
      { name: 'building', label: 'Building', type: 'text', placeholder: '' },
      { name: 'payer', label: 'Payer', type: 'text', placeholder: 'e.g. Medicare A, UHC MA' },
      { name: 'expected_los', label: 'Expected Length of Stay', type: 'text', placeholder: '' },
    ],
    missingInfoQuestions: [
      'When was the resident admitted?',
      'What is the primary diagnosis?',
      'What are the key Section GG scores?',
      'What NTA-qualifying items are present in the first 3 days?',
    ],
    outputSections: [
      'Admission Summary',
      'PDPM Classification Analysis (PT, OT, SLP, Nursing, NTA)',
      'Section GG Assessment',
      'NTA Capture Opportunities',
      'Documentation Gaps',
      'Reimbursement Optimization Recommendations',
      'ARD Timing Strategy',
    ],
    reviewChecklist: [
      'PDPM category assignments are clinically supported',
      'NTA items are within the days 1-3 window',
      'Section GG scores match the documented functional status',
      'No coding recommendations that exceed what documentation supports',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a PDPM optimization review for a new admission.`,
        ``,
        `Admission Date: ${inputs.admission_date}`,
        `Primary Diagnosis: ${inputs.primary_diagnosis}`,
        `Section GG Scores: ${inputs.section_gg_scores}`,
        `NTA Items: ${inputs.nta_items}`,
        inputs.building ? `Building: ${inputs.building}` : '',
        inputs.payer ? `Payer: ${inputs.payer}` : '',
        inputs.expected_los ? `Expected LOS: ${inputs.expected_los}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── Regional workflows ──

  building_comparison: {
    id: 'building_comparison',
    roleId: 'regional',
    label: 'Building Comparison',
    description: 'Side-by-side analysis of two buildings.',
    requiredInputs: [
      { name: 'building_a', label: 'Building A', type: 'text', placeholder: '' },
      { name: 'building_b', label: 'Building B', type: 'text', placeholder: '' },
    ],
    optionalInputs: [
      { name: 'focus_area', label: 'Focus Area', type: 'text', placeholder: 'e.g. census, quality, financial, overall' },
    ],
    missingInfoQuestions: [
      'Which two buildings should I compare?',
    ],
    outputSections: [
      'Building A Summary',
      'Building B Summary',
      'Side-by-Side Metrics (census, occupancy, skilled mix, survey status)',
      'Key Differences',
      'Risk Comparison',
      'Recommendation: Where to Focus First',
    ],
    reviewChecklist: [
      'Census figures match current snapshots',
      'Strategic status labels are accurate',
      'Recommendation is supported by the data presented',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a building comparison brief.`,
        ``,
        `Building A: ${inputs.building_a}`,
        `Building B: ${inputs.building_b}`,
        inputs.focus_area ? `Focus Area: ${inputs.focus_area}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },

  executive_summary: {
    id: 'executive_summary',
    roleId: 'regional',
    label: 'Executive Summary',
    description: 'Regional executive summary for leadership.',
    requiredInputs: [
      { name: 'topic', label: 'Topic / Focus', type: 'text', placeholder: '' },
      { name: 'buildings_in_scope', label: 'Buildings in Scope', type: 'text', placeholder: 'e.g. All, Arkansas only, Crossett + Glenwood' },
      { name: 'time_period', label: 'Time Period', type: 'text', placeholder: 'e.g. Q1 2026, March 2026' },
    ],
    optionalInputs: [
      { name: 'audience', label: 'Audience', type: 'text', placeholder: 'e.g. Board, Leadership Team, Investors' },
    ],
    missingInfoQuestions: [
      'What topic should the summary focus on?',
      'Which buildings are in scope?',
      'What time period does this cover?',
    ],
    outputSections: [
      'Executive Summary (3-5 sentences)',
      'Portfolio Overview',
      'Key Metrics by Building',
      'Highlights and Wins',
      'Risks and Watch Items',
      'Recommended Actions',
    ],
    reviewChecklist: [
      'Metrics are current and accurate',
      'Highlights reflect actual achievements',
      'Risk items are actionable, not just flagged',
    ],
    draftModeRequired: true,
    promptTemplate(inputs) {
      return [
        `Draft a regional executive summary.`,
        ``,
        `Topic: ${inputs.topic}`,
        `Buildings in Scope: ${inputs.buildings_in_scope}`,
        `Time Period: ${inputs.time_period}`,
        inputs.audience ? `Audience: ${inputs.audience}` : '',
        ``,
        `Required sections: ${this.outputSections.join(', ')}.`,
        `End with the standard review disclaimer.`,
      ].filter(Boolean).join('\n');
    },
  },
  // ── Marketing workflows ──

  swot_analysis: {
    id: 'swot_analysis',
    roleId: 'marketing',
    label: 'SWOT Analysis',
    description: 'Generate a comprehensive SWOT analysis for a building using operational data, market context, and survey history.',
    requiredInputs: [
      { name: 'building', label: 'Building Name', type: 'text', placeholder: 'e.g. Nightingale at Crossett' },
    ],
    optionalInputs: [
      { name: 'focus_area', label: 'Focus Area', type: 'text', placeholder: 'e.g. skilled census growth, referral development' },
      { name: 'competitor_notes', label: 'Competitor Notes', type: 'textarea', placeholder: 'Any known competitor info' },
    ],
    missingInfoQuestions: ['Which building should I analyze?'],
    outputSections: [
      'Strengths (internal advantages)',
      'Weaknesses (internal challenges)',
      'Opportunities (external growth levers)',
      'Threats (external risks)',
      'Priority Actions (top 3 strategic moves)',
      'Metrics to Track',
    ],
    reviewChecklist: [
      'Strengths grounded in real building data (census, payer, staffing)',
      'Weaknesses reflect actual operational challenges',
      'Opportunities are actionable within 90 days',
      'Threats include competitive and regulatory factors',
      'Priority actions have owners and timelines',
    ],
    promptTemplate(inputs) {
      return [
        `Generate a SWOT analysis for ${inputs.building}.`,
        inputs.focus_area ? `Focus area: ${inputs.focus_area}` : '',
        inputs.competitor_notes ? `Competitor context: ${inputs.competitor_notes}` : '',
        `Use the building's actual payer mix, census, occupancy gap, survey history, staffing context, and strategic notes.`,
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  census_growth_plan: {
    id: 'census_growth_plan',
    roleId: 'marketing',
    label: '90-Day Census Growth Plan',
    description: 'Draft a structured 90-day plan to grow census with specific actions, owners, and milestones.',
    requiredInputs: [
      { name: 'building', label: 'Building Name', type: 'text', placeholder: '' },
      { name: 'target_census', label: 'Target Census (90 days)', type: 'text', placeholder: 'e.g. 75' },
    ],
    optionalInputs: [
      { name: 'current_initiatives', label: 'Current Marketing Initiatives', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: ['Which building?', 'What is the 90-day census target?'],
    outputSections: [
      'Current State (census, occupancy, payer mix)',
      'Month 1 Actions (quick wins)',
      'Month 2 Actions (referral development)',
      'Month 3 Actions (program launches)',
      'Referral Source Targets (top 5)',
      'Payer Mix Strategy',
      'Milestones and KPIs',
    ],
    reviewChecklist: [
      'Current state uses actual building data',
      'Actions are specific with responsible parties',
      'Referral targets are named or categorized',
      'KPIs are measurable',
    ],
    promptTemplate(inputs) {
      return [
        `Draft a 90-day census growth plan for ${inputs.building} with target census of ${inputs.target_census}.`,
        inputs.current_initiatives ? `Current initiatives: ${inputs.current_initiatives}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  referral_development_plan: {
    id: 'referral_development_plan',
    roleId: 'marketing',
    label: 'Referral Development Plan',
    description: 'Create a targeted referral development strategy identifying top referral sources and relationship-building actions.',
    requiredInputs: [
      { name: 'building', label: 'Building Name', type: 'text', placeholder: '' },
    ],
    optionalInputs: [
      { name: 'current_sources', label: 'Current Top Referral Sources', type: 'textarea', placeholder: 'e.g. Baptist Hospital, Dr. Smith' },
      { name: 'target_payer', label: 'Target Payer Type', type: 'text', placeholder: 'e.g. Medicare, Managed Care' },
    ],
    missingInfoQuestions: ['Which building?'],
    outputSections: [
      'Current Referral Landscape',
      'Target Referral Sources (top 5-10)',
      'Outreach Strategy per Source',
      'Managed Care Contract Opportunities',
      'Physician Relationship Plan',
      'Community Partnership Targets',
      'Timeline and Milestones',
    ],
    reviewChecklist: [
      'Referral targets are specific and prioritized',
      'Outreach actions have owners and timelines',
      'Managed care strategy aligned with building payer context',
    ],
    promptTemplate(inputs) {
      return [
        `Draft a referral development plan for ${inputs.building}.`,
        inputs.current_sources ? `Current referral sources: ${inputs.current_sources}` : '',
        inputs.target_payer ? `Target payer focus: ${inputs.target_payer}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  // ── Therapy workflows ──

  hipps_analysis: {
    id: 'hipps_analysis',
    roleId: 'therapy',
    label: 'HIPPS Code Analysis',
    description: 'Analyze a HIPPS code to identify the weakest component and targeted education opportunities.',
    requiredInputs: [
      { name: 'hipps_code', label: 'HIPPS Code (5 characters)', type: 'text', placeholder: 'e.g. 4LJ20' },
      { name: 'patient_summary', label: 'Patient Clinical Summary', type: 'textarea', placeholder: 'Key diagnoses, functional status, services' },
    ],
    optionalInputs: [
      { name: 'gg_scores', label: 'Section GG Scores', type: 'textarea', placeholder: 'e.g. Eating: 03, Toileting: 02, Transfer: 01' },
      { name: 'nta_items', label: 'Active NTA Items', type: 'textarea', placeholder: 'e.g. IV meds, ventilator, isolation' },
    ],
    missingInfoQuestions: ['What is the HIPPS code?', 'Brief patient clinical summary?'],
    outputSections: [
      'HIPPS Code Breakdown (5 components)',
      'Current Payment Tier per Component',
      'Weakest Component Identification',
      'Documentation Gap Analysis',
      'Targeted Education Recommendations',
      'Estimated Revenue Impact if Improved',
    ],
    reviewChecklist: [
      'HIPPS breakdown is accurate',
      'Weak component identification is justified',
      'Education recommendations are specific and actionable',
      'Revenue impact estimates are reasonable',
    ],
    promptTemplate(inputs) {
      return [
        `Analyze HIPPS code: ${inputs.hipps_code}`,
        `Patient summary: ${inputs.patient_summary}`,
        inputs.gg_scores ? `Section GG scores: ${inputs.gg_scores}` : '',
        inputs.nta_items ? `Active NTA items: ${inputs.nta_items}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  gg_scoring_review: {
    id: 'gg_scoring_review',
    roleId: 'therapy',
    label: 'Section GG Scoring Review',
    description: 'Review Section GG functional scoring for accuracy and identify if scores reflect actual admission-day performance.',
    requiredInputs: [
      { name: 'patient_description', label: 'Patient Functional Description', type: 'textarea', placeholder: 'Describe the patient\'s actual functional performance at admission' },
    ],
    optionalInputs: [
      { name: 'current_gg_scores', label: 'Current GG Scores (if already coded)', type: 'textarea', placeholder: 'e.g. Eating: 04, Oral hygiene: 03, Toilet transfer: 02' },
      { name: 'diagnoses', label: 'Primary Diagnoses', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: ['Describe the patient\'s functional performance at admission'],
    outputSections: [
      'Recommended GG Scores per Item',
      'Justification for Each Score',
      'Scores That May Be Coded Too High',
      'Scores That May Be Coded Too Low',
      'Documentation Recommendations',
      'Quality Measure Impact (SO42, ADL, Mobility)',
    ],
    reviewChecklist: [
      'Scores reflect admission-day performance, not potential',
      'Each score has clinical justification',
      'Quality measure impact is noted',
    ],
    promptTemplate(inputs) {
      return [
        `Review Section GG scoring for this patient.`,
        `Functional description: ${inputs.patient_description}`,
        inputs.current_gg_scores ? `Current GG scores: ${inputs.current_gg_scores}` : '',
        inputs.diagnoses ? `Diagnoses: ${inputs.diagnoses}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  cmi_optimization: {
    id: 'cmi_optimization',
    roleId: 'therapy',
    label: 'CMI Optimization Report',
    description: 'Analyze case mix components to identify patients close to a higher payment tier and what documentation would move them up.',
    requiredInputs: [
      { name: 'patient_info', label: 'Patient Info (diagnoses, services, GG scores)', type: 'textarea', placeholder: 'Include key diagnoses, active services, and GG scores if available' },
      { name: 'current_cmi', label: 'Current CMI / Payment Category', type: 'text', placeholder: 'e.g. 1.42 or Nursing HDE1' },
    ],
    optionalInputs: [
      { name: 'hipps_code', label: 'HIPPS Code', type: 'text', placeholder: '' },
    ],
    missingInfoQuestions: ['What are the patient\'s key diagnoses and services?', 'What is the current CMI or payment category?'],
    outputSections: [
      'Current Component Breakdown (PT, OT, SLP, Nursing, NTA)',
      'Proximity to Next Tier per Component',
      'Highest-Impact Documentation Targets',
      'Specific Actions to Capture Missing Items',
      'Revenue Impact Estimate',
    ],
    reviewChecklist: [
      'Component analysis is accurate',
      'Tier proximity is realistic',
      'Documentation targets are clinically supportable',
    ],
    promptTemplate(inputs) {
      return [
        `Analyze CMI components and identify optimization opportunities.`,
        `Patient info: ${inputs.patient_info}`,
        `Current CMI/category: ${inputs.current_cmi}`,
        inputs.hipps_code ? `HIPPS code: ${inputs.hipps_code}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },

  therapy_progress_appeal: {
    id: 'therapy_progress_appeal',
    roleId: 'therapy',
    label: 'Therapy Progress / Appeal Support',
    description: 'Generate a therapy progress comparison (7-day by 7-day) and supporting documentation for continued stay appeals.',
    requiredInputs: [
      { name: 'patient_summary', label: 'Patient Summary', type: 'textarea', placeholder: 'Diagnoses, admission reason, therapy goals' },
      { name: 'functional_data', label: 'Functional Status Data (7-day comparisons)', type: 'textarea', placeholder: 'e.g. Week 1: Transfer 02, Walking 01; Week 2: Transfer 03, Walking 02' },
    ],
    optionalInputs: [
      { name: 'plof', label: 'Prior Level of Function (PLOF)', type: 'textarea', placeholder: '' },
      { name: 'denial_reason', label: 'Denial Reason (if appealing)', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: ['Patient summary?', 'Functional status data for comparison periods?'],
    outputSections: [
      'Patient Background and Therapy Goals',
      'Functional Progress Comparison (week-by-week)',
      'Measurable Gains Identified',
      'Plateaus or Areas of Concern',
      'Clinical Justification for Continued Services',
      'PLOF Comparison and Discharge Safety Assessment',
      'Appeal Language (if applicable)',
    ],
    reviewChecklist: [
      'Progress data is accurately represented',
      'Gains are measurable and documented',
      'Appeal language is factual and clinical',
      'PLOF comparison supports continued stay',
    ],
    promptTemplate(inputs) {
      return [
        `Generate a therapy progress analysis and appeal support document.`,
        `Patient: ${inputs.patient_summary}`,
        `Functional data: ${inputs.functional_data}`,
        inputs.plof ? `PLOF: ${inputs.plof}` : '',
        inputs.denial_reason ? `Denial reason: ${inputs.denial_reason}` : '',
        `Required sections: ${this.outputSections.join(', ')}.`,
      ].filter(Boolean).join('\n');
    },
  },
  // ── Hospitalization Review (shared across DON, Admin, MDS, Regional) ──
  // HIDDEN — set hidden: false to enable in UI

  hospitalization_review_don: {
    id: 'hospitalization_review_don',
    roleId: 'don',
    hidden: false,
    label: 'Hospitalization Review',
    description: 'Analyze a hospitalization transfer for avoidability using CMS PAH criteria and INTERACT pathways. No PHI — use de-identified case details only.',
    requiredInputs: [
      { name: 'transferDate', label: 'Transfer Date', type: 'date', placeholder: '' },
      { name: 'primaryDiagnosis', label: 'Primary Diagnosis / Reason for Transfer', type: 'text', placeholder: 'e.g. CHF exacerbation, fall with hip fracture, sepsis' },
      { name: 'diagnosisCategory', label: 'Diagnosis Category', type: 'text', placeholder: 'cardiac, respiratory, infection, fall, gi, neuro, dehydration, medication, wound, behavioral, other' },
    ],
    optionalInputs: [
      { name: 'transferTimeCategory', label: 'Time of Transfer', type: 'text', placeholder: 'business_hours, evening, night, weekend' },
      { name: 'daysSinceAdmission', label: 'Days Since SNF Admission', type: 'text', placeholder: 'e.g. 5' },
      { name: 'payerType', label: 'Payer Type', type: 'text', placeholder: 'medicare, managed_care, medicaid, private' },
      { name: 'presentOnAdmission', label: 'Condition Present on Admission?', type: 'text', placeholder: 'yes or no' },
      { name: 'physicianNotified', label: 'Physician Notified Before Transfer?', type: 'text', placeholder: 'yes or no' },
      { name: 'conditionChangeDocumented', label: 'Change in Condition Documented?', type: 'text', placeholder: 'yes or no' },
      { name: 'interactToolUsed', label: 'INTERACT Tool Used?', type: 'text', placeholder: 'yes or no' },
      { name: 'readmissionFlag', label: '30-Day Readmission?', type: 'text', placeholder: 'yes or no' },
      { name: 'additionalContext', label: 'Additional Context (no PHI)', type: 'textarea', placeholder: 'Any relevant clinical or operational context' },
    ],
    missingInfoQuestions: [
      'What was the date of the hospital transfer?',
      'What was the primary diagnosis or reason for transfer?',
      'What category does this fall under? (cardiac, respiratory, infection, fall, etc.)',
    ],
    outputSections: [
      'Classification (Avoidable / Possibly Avoidable / Unavoidable)',
      'Reasoning',
      'Root Causes',
      'INTERACT Pathway',
      'Prevention Measures',
      'QI Action Items',
    ],
    reviewChecklist: [
      'No patient names, DOBs, or PHI in the submission',
      'Diagnosis category is accurate',
      'Clinical indicators (physician notified, documentation, INTERACT) are factual',
      'AI classification reviewed — confirm or override',
      'QI actions are assigned to responsible parties',
    ],
    draftModeRequired: false,
    promptTemplate(inputs) {
      return [
        `Analyze this hospitalization transfer for avoidability.`,
        ``,
        `Transfer Date: ${inputs.transferDate}`,
        `Primary Diagnosis: ${inputs.primaryDiagnosis}`,
        `Category: ${inputs.diagnosisCategory}`,
        inputs.transferTimeCategory ? `Time: ${inputs.transferTimeCategory}` : '',
        inputs.daysSinceAdmission ? `Days Since Admission: ${inputs.daysSinceAdmission}` : '',
        inputs.payerType ? `Payer: ${inputs.payerType}` : '',
        inputs.presentOnAdmission ? `Present on Admission: ${inputs.presentOnAdmission}` : '',
        inputs.physicianNotified ? `Physician Notified: ${inputs.physicianNotified}` : '',
        inputs.conditionChangeDocumented ? `Condition Change Documented: ${inputs.conditionChangeDocumented}` : '',
        inputs.interactToolUsed ? `INTERACT Tool Used: ${inputs.interactToolUsed}` : '',
        inputs.readmissionFlag ? `30-Day Readmission: ${inputs.readmissionFlag}` : '',
        inputs.additionalContext ? `\nAdditional Context: ${inputs.additionalContext}` : '',
        ``,
        `Provide classification (avoidable/possibly_avoidable/unavoidable), reasoning, root causes, applicable INTERACT pathway, prevention measures, and QI action items.`,
      ].filter(Boolean).join('\n');
    },
  },

  hospitalization_review_admin: {
    id: 'hospitalization_review_admin',
    roleId: 'admin',
    hidden: false,
    label: 'Hospitalization Review',
    description: 'Review a hospitalization transfer for avoidability — operational and financial impact analysis.',
    requiredInputs: [
      { name: 'transferDate', label: 'Transfer Date', type: 'date', placeholder: '' },
      { name: 'primaryDiagnosis', label: 'Primary Diagnosis / Reason for Transfer', type: 'text', placeholder: 'e.g. CHF exacerbation, fall with hip fracture' },
      { name: 'diagnosisCategory', label: 'Diagnosis Category', type: 'text', placeholder: 'cardiac, respiratory, infection, fall, gi, neuro, dehydration, medication, wound, behavioral, other' },
    ],
    optionalInputs: [
      { name: 'transferTimeCategory', label: 'Time of Transfer', type: 'text', placeholder: 'business_hours, evening, night, weekend' },
      { name: 'daysSinceAdmission', label: 'Days Since SNF Admission', type: 'text', placeholder: 'e.g. 5' },
      { name: 'payerType', label: 'Payer Type', type: 'text', placeholder: 'medicare, managed_care, medicaid, private' },
      { name: 'physicianNotified', label: 'Physician Notified?', type: 'text', placeholder: 'yes or no' },
      { name: 'interactToolUsed', label: 'INTERACT Tool Used?', type: 'text', placeholder: 'yes or no' },
      { name: 'readmissionFlag', label: '30-Day Readmission?', type: 'text', placeholder: 'yes or no' },
      { name: 'additionalContext', label: 'Additional Context (no PHI)', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: [],
    outputSections: ['Classification', 'Reasoning', 'Root Causes', 'Prevention', 'QI Actions'],
    reviewChecklist: ['No PHI in submission', 'AI classification reviewed', 'QI actions assigned'],
    draftModeRequired: false,
    promptTemplate(inputs) {
      return [
        `Analyze this hospitalization for avoidability from an operational perspective.`,
        `Transfer Date: ${inputs.transferDate}`,
        `Diagnosis: ${inputs.primaryDiagnosis} (${inputs.diagnosisCategory})`,
        inputs.payerType ? `Payer: ${inputs.payerType}` : '',
        inputs.transferTimeCategory ? `Time: ${inputs.transferTimeCategory}` : '',
        inputs.physicianNotified ? `Physician Notified: ${inputs.physicianNotified}` : '',
        inputs.interactToolUsed ? `INTERACT Used: ${inputs.interactToolUsed}` : '',
        inputs.readmissionFlag ? `30-Day Readmission: ${inputs.readmissionFlag}` : '',
        inputs.additionalContext ? `Context: ${inputs.additionalContext}` : '',
        ``,
        `Provide classification, reasoning, root causes, prevention measures, and QI actions.`,
      ].filter(Boolean).join('\n');
    },
  },

  hospitalization_review_mds: {
    id: 'hospitalization_review_mds',
    roleId: 'mds',
    hidden: false,
    label: 'Hospitalization Review',
    description: 'Analyze a hospitalization transfer — focus on documentation and assessment impact.',
    requiredInputs: [
      { name: 'transferDate', label: 'Transfer Date', type: 'date', placeholder: '' },
      { name: 'primaryDiagnosis', label: 'Primary Diagnosis / Reason', type: 'text', placeholder: '' },
      { name: 'diagnosisCategory', label: 'Category', type: 'text', placeholder: 'cardiac, respiratory, infection, fall, gi, neuro, dehydration, medication, wound, behavioral, other' },
    ],
    optionalInputs: [
      { name: 'daysSinceAdmission', label: 'Days Since Admission', type: 'text', placeholder: '' },
      { name: 'conditionChangeDocumented', label: 'Change in Condition Documented?', type: 'text', placeholder: 'yes or no' },
      { name: 'additionalContext', label: 'Additional Context (no PHI)', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: [],
    outputSections: ['Classification', 'Reasoning', 'Root Causes', 'Prevention', 'QI Actions'],
    reviewChecklist: ['No PHI', 'Classification reviewed'],
    draftModeRequired: false,
    promptTemplate(inputs) {
      return [
        `Analyze this hospitalization for avoidability — focus on documentation and MDS implications.`,
        `Transfer Date: ${inputs.transferDate}`,
        `Diagnosis: ${inputs.primaryDiagnosis} (${inputs.diagnosisCategory})`,
        inputs.daysSinceAdmission ? `Days Since Admission: ${inputs.daysSinceAdmission}` : '',
        inputs.conditionChangeDocumented ? `Condition Change Documented: ${inputs.conditionChangeDocumented}` : '',
        inputs.additionalContext ? `Context: ${inputs.additionalContext}` : '',
        ``,
        `Provide classification, reasoning, root causes, prevention, and QI actions.`,
      ].filter(Boolean).join('\n');
    },
  },

  hospitalization_review_regional: {
    id: 'hospitalization_review_regional',
    roleId: 'regional',
    hidden: false,
    label: 'Hospitalization Review',
    description: 'Portfolio-level hospitalization analysis — identify patterns and focus areas across buildings.',
    requiredInputs: [
      { name: 'transferDate', label: 'Transfer Date', type: 'date', placeholder: '' },
      { name: 'primaryDiagnosis', label: 'Primary Diagnosis / Reason', type: 'text', placeholder: '' },
      { name: 'diagnosisCategory', label: 'Category', type: 'text', placeholder: 'cardiac, respiratory, infection, fall, gi, neuro, dehydration, medication, wound, behavioral, other' },
    ],
    optionalInputs: [
      { name: 'transferTimeCategory', label: 'Time of Transfer', type: 'text', placeholder: 'business_hours, evening, night, weekend' },
      { name: 'payerType', label: 'Payer', type: 'text', placeholder: 'medicare, managed_care, medicaid, private' },
      { name: 'readmissionFlag', label: '30-Day Readmission?', type: 'text', placeholder: 'yes or no' },
      { name: 'additionalContext', label: 'Additional Context (no PHI)', type: 'textarea', placeholder: '' },
    ],
    missingInfoQuestions: [],
    outputSections: ['Classification', 'Reasoning', 'Root Causes', 'Portfolio Pattern', 'QI Actions'],
    reviewChecklist: ['No PHI', 'Pattern analysis reviewed'],
    draftModeRequired: false,
    promptTemplate(inputs) {
      return [
        `Analyze this hospitalization from a regional/portfolio perspective.`,
        `Transfer Date: ${inputs.transferDate}`,
        `Diagnosis: ${inputs.primaryDiagnosis} (${inputs.diagnosisCategory})`,
        inputs.transferTimeCategory ? `Time: ${inputs.transferTimeCategory}` : '',
        inputs.payerType ? `Payer: ${inputs.payerType}` : '',
        inputs.readmissionFlag ? `30-Day Readmission: ${inputs.readmissionFlag}` : '',
        inputs.additionalContext ? `Context: ${inputs.additionalContext}` : '',
        ``,
        `Provide classification, reasoning, root causes, portfolio-level pattern analysis, and QI actions.`,
      ].filter(Boolean).join('\n');
    },
  },

};

// ── Helpers ──

export function getWorkflowById(id) {
  return WORKFLOWS[id] || null;
}

export function getWorkflowsForRole(roleId) {
  return Object.values(WORKFLOWS).filter(w => w.roleId === roleId && !w.hidden);
}
