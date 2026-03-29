// ============================================================================
// IHCM AI Bot Widget v2 — Workflow Templates
// ============================================================================
// Each workflow defines:
//   - requiredInputs: fields the user must fill before generation
//   - optionalInputs: fields that improve output but aren't blocking
//   - missingInfoQuestions: what the bot asks if inputs are incomplete
//   - outputSections: required sections in the generated document
//   - reviewChecklist: post-generation review items
//   - promptTemplate(inputs): builds the structured prompt from collected fields
//
// In production, these live in the workflow_templates Supabase table.
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

  census_growth_plan: {
    id: 'census_growth_plan',
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

  // ── MDS workflows ──

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
};

// ── Helpers ──

export function getWorkflowById(id) {
  return WORKFLOWS[id] || null;
}

export function getWorkflowsForRole(roleId) {
  return Object.values(WORKFLOWS).filter(w => w.roleId === roleId);
}
