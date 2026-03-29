// ============================================================================
// Hospitalization Review endpoint — GET/POST/PATCH /api/hospitalization-review
// ============================================================================
// Submit anonymized hospitalization reviews with AI avoidability analysis,
// list reviews by building, get aggregate stats, and confirm/override AI.
//
// Role-restricted: DON, Admin, MDS, Regional (+ super_admin, corporate_admin)
// PHI guardrails: server-side pattern rejection on free-text fields (heuristic, not guaranteed)
// AI output: structured JSON parsing with fallback logging
// RLS: table policies are currently open (USING true) — access enforced at API layer
//
// ACTIVATION CHECKLIST:
// 1. Run migration 202603290010_hospitalization_reviews.sql in Supabase SQL Editor
// 2. Run migration 202603290011_hosp_review_audit_fix.sql in Supabase SQL Editor
// 3. Set SHOW_HOSPITALIZATIONS = true in src/components/Dashboard.jsx
// 4. Set hidden: false on hospitalization_review_* workflows in workflows.js

import { requireAuth } from './lib/requireAuth.js';

const DIAGNOSIS_CATEGORIES = [
  'cardiac', 'respiratory', 'infection', 'fall',
  'gi', 'neuro', 'dehydration', 'medication',
  'wound', 'behavioral', 'other',
];

const ROOT_CAUSE_OPTIONS = [
  'staffing', 'communication', 'clinical_capability',
  'documentation', 'physician_response', 'family_decision',
  'equipment', 'process_failure', 'after_hours_coverage',
];

const ALLOWED_APP_ROLES = ['super_admin', 'corporate_admin', 'regional_director', 'facility_admin'];
const ALLOWED_BOT_ROLES = ['don', 'admin', 'mds', 'regional'];

// PHI detection patterns — reject if any match
const PHI_PATTERNS = [
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/,                    // SSN
  /\b\d{2}\/\d{2}\/(?:19|20)\d{2}\b/,                       // DOB (MM/DD/YYYY)
  /\b(?:DOB|date\s+of\s+birth)\s*[:\-]?\s*\d/i,            // DOB label
  /\b(?:MRN|medical\s+record)\s*[:\-#]?\s*\d{4,}/i,        // MRN
  /\b(?:room|bed)\s*[:\-#]?\s*\d{1,4}[A-Za-z]?\b/i,        // Room/bed number
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s*,?\s*(?:Jr|Sr|III?|IV)?\s*(?:,\s*\d{2,3}\s*(?:y\.?o\.?|years?\s*old))/i, // Name + age
];

function containsPHI(text) {
  if (!text) return false;
  return PHI_PATTERNS.some(pat => pat.test(text));
}

function checkPHIFields(fields) {
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'string' && containsPHI(value)) {
      return `The "${name}" field appears to contain protected health information (PHI). Please remove patient names, DOBs, SSNs, MRNs, and room numbers before submitting.`;
    }
  }
  return null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user, profile, supabase, supabaseUser } = auth;

  // Role check
  const hasAppRole = ALLOWED_APP_ROLES.includes(profile.app_role);
  const hasBotRole = (profile.allowed_bot_roles || []).some(r => ALLOWED_BOT_ROLES.includes(r));
  if (!hasAppRole && !hasBotRole) {
    return res.status(403).json({ error: 'Hospitalization review requires DON, Admin, MDS, or Regional access' });
  }

  try {
    // ── GET: list reviews or get stats ──
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const building = url.searchParams.get('building');
      const mode = url.searchParams.get('mode');
      const months = parseInt(url.searchParams.get('months') || '12', 10);

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffDate = cutoff.toISOString().split('T')[0];

      let facilityId = null;
      if (building && building !== 'all') {
        const { data: fac } = await supabaseUser
          .from('facilities')
          .select('facility_id')
          .eq('facility_code', building)
          .single();
        facilityId = fac?.facility_id || null;
      }

      if (mode === 'stats') {
        let query = supabaseUser
          .from('hospitalization_reviews')
          .select('facility_id, transfer_date, diagnosis_category, ai_avoidability, final_avoidability, transfer_time_category, readmission_flag, payer_type')
          .gte('transfer_date', cutoffDate);

        if (facilityId) query = query.eq('facility_id', facilityId);

        const { data: reviews, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        const total = reviews.length;
        const withFinal = reviews.filter(r => r.final_avoidability);
        const withAI = reviews.filter(r => r.ai_avoidability);
        const finalAvoidable = withFinal.filter(r => r.final_avoidability === 'avoidable').length;
        const aiAvoidable = withAI.filter(r => r.ai_avoidability === 'avoidable').length;
        const pending = reviews.filter(r => !r.final_avoidability).length;
        const readmissions = reviews.filter(r => r.readmission_flag).length;

        const byCategory = {};
        const byTimeOfDay = {};
        const byMonth = {};
        for (const r of reviews) {
          byCategory[r.diagnosis_category] = (byCategory[r.diagnosis_category] || 0) + 1;
          byTimeOfDay[r.transfer_time_category] = (byTimeOfDay[r.transfer_time_category] || 0) + 1;
          const month = r.transfer_date.slice(0, 7);
          if (!byMonth[month]) byMonth[month] = { total: 0, avoidable: 0, ai_avoidable: 0 };
          byMonth[month].total++;
          if (r.final_avoidability === 'avoidable') byMonth[month].avoidable++;
          if (r.ai_avoidability === 'avoidable') byMonth[month].ai_avoidable++;
        }

        const { data: facilities } = await supabaseUser
          .from('facilities')
          .select('facility_id, facility_code, facility_name');
        const facMap = {};
        for (const f of (facilities || [])) facMap[f.facility_id] = f;

        const byBuilding = {};
        for (const r of reviews) {
          const fac = facMap[r.facility_id];
          const slug = fac?.facility_code || 'unknown';
          if (!byBuilding[slug]) byBuilding[slug] = { name: fac?.facility_name || slug, total: 0, avoidable: 0, ai_avoidable: 0, readmissions: 0 };
          byBuilding[slug].total++;
          if (r.final_avoidability === 'avoidable') byBuilding[slug].avoidable++;
          if (r.ai_avoidability === 'avoidable') byBuilding[slug].ai_avoidable++;
          if (r.readmission_flag) byBuilding[slug].readmissions++;
        }

        return res.status(200).json({
          total,
          pending,
          readmissions,
          final_avoidable: finalAvoidable,
          final_avoidable_pct: withFinal.length > 0 ? Math.round((finalAvoidable / withFinal.length) * 100) : null,
          ai_avoidable: aiAvoidable,
          ai_avoidable_pct: withAI.length > 0 ? Math.round((aiAvoidable / withAI.length) * 100) : null,
          by_category: byCategory,
          by_time_of_day: byTimeOfDay,
          by_month: byMonth,
          by_building: byBuilding,
          months,
        });
      }

      // List mode
      let query = supabaseUser
        .from('hospitalization_reviews')
        .select('*')
        .gte('transfer_date', cutoffDate)
        .order('transfer_date', { ascending: false })
        .limit(100);

      if (facilityId) query = query.eq('facility_id', facilityId);

      const { data: reviews, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ reviews: reviews || [] });
    }

    // ── POST: submit new review ──
    if (req.method === 'POST') {
      const body = req.body || {};
      const {
        buildingId, transferDate, transferTimeCategory,
        daysSinceAdmission, primaryDiagnosis, diagnosisCategory,
        presentOnAdmission, physicianNotified, conditionChangeDocumented,
        interactToolUsed, payerType, readmissionFlag, additionalContext,
      } = body;

      if (!buildingId || !transferDate || !primaryDiagnosis) {
        return res.status(400).json({ error: 'buildingId, transferDate, and primaryDiagnosis are required' });
      }

      if (diagnosisCategory && !DIAGNOSIS_CATEGORIES.includes(diagnosisCategory)) {
        return res.status(400).json({ error: `Invalid diagnosis category. Must be one of: ${DIAGNOSIS_CATEGORIES.join(', ')}` });
      }

      // PHI check on free-text fields
      const phiError = checkPHIFields({
        'Primary Diagnosis': primaryDiagnosis,
        'Additional Context': additionalContext,
      });
      if (phiError) return res.status(422).json({ error: phiError });

      // Resolve building
      const { data: fac } = await supabaseUser
        .from('facilities')
        .select('facility_id, facility_name')
        .eq('facility_code', buildingId)
        .single();
      if (!fac) return res.status(404).json({ error: 'Building not found' });

      // Get building context for AI analysis
      const { data: buildingCtx } = await supabaseUser
        .from('v_bot_building_context')
        .select('staffing_context, survey_context, risk_watchlist')
        .eq('slug', buildingId)
        .single();

      // Build AI analysis prompt
      const analysisPrompt = buildAnalysisPrompt({
        facilityName: fac.facility_name,
        transferDate, transferTimeCategory, daysSinceAdmission,
        primaryDiagnosis, diagnosisCategory,
        presentOnAdmission, physicianNotified, conditionChangeDocumented,
        interactToolUsed, payerType, readmissionFlag, additionalContext,
        buildingContext: buildingCtx,
      });

      // Call Claude for structured JSON analysis
      let aiResult = { classification: null, reasoning: null, root_causes: [], interact_pathway: null, prevention: null, qi_actions: [] };
      let aiAnalysisText = null;
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic();
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are a skilled nursing facility clinical analyst specializing in hospitalization avoidability review. You use CMS Potentially Avoidable Hospitalization (PAH) criteria and INTERACT clinical pathways.

You MUST respond with valid JSON only — no markdown, no text before or after. Use this exact structure:
{
  "classification": "avoidable" | "possibly_avoidable" | "unavoidable",
  "reasoning": "2-3 sentence explanation",
  "root_causes": ["staffing", "communication", ...],
  "interact_pathway": "which INTERACT tool/pathway applies",
  "prevention": "specific prevention steps",
  "qi_actions": ["action 1", "action 2", "action 3"]
}

Valid root_causes: staffing, communication, clinical_capability, documentation, physician_response, family_decision, equipment, process_failure, after_hours_coverage.
Only include root_causes that genuinely apply — do not pad the list.`,
          messages: [{ role: 'user', content: analysisPrompt }],
        });

        const rawText = response.content[0]?.text || '';
        aiAnalysisText = rawText;

        // Parse JSON from response (handle possible markdown wrapping)
        const jsonStr = rawText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        const parsed = JSON.parse(jsonStr);

        aiResult = {
          classification: ['avoidable', 'possibly_avoidable', 'unavoidable'].includes(parsed.classification) ? parsed.classification : null,
          reasoning: parsed.reasoning || null,
          root_causes: (parsed.root_causes || []).filter(rc => ROOT_CAUSE_OPTIONS.includes(rc)),
          interact_pathway: parsed.interact_pathway || null,
          prevention: parsed.prevention || null,
          qi_actions: Array.isArray(parsed.qi_actions) ? parsed.qi_actions.filter(Boolean) : [],
        };
      } catch (err) {
        console.warn('[hosp-review] AI analysis failed:', err.message);
        // Log raw response for debugging (never shown to user)
        if (aiAnalysisText) {
          console.warn('[hosp-review] Raw AI response (parse failed):', aiAnalysisText.slice(0, 500));
        }
        aiAnalysisText = 'AI analysis unavailable — please classify manually.';
      }

      // PHI check on AI output before storing
      if (aiAnalysisText && containsPHI(aiAnalysisText)) {
        aiAnalysisText = '[AI response redacted — contained potential PHI]';
        aiResult = { classification: null, reasoning: null, root_causes: [], interact_pathway: null, prevention: null, qi_actions: [] };
      }

      // Build human-readable analysis text
      const analysisText = aiResult.classification
        ? [
            `CLASSIFICATION: ${aiResult.classification}`,
            `REASONING: ${aiResult.reasoning}`,
            `ROOT CAUSES: ${aiResult.root_causes.join(', ') || 'none identified'}`,
            `INTERACT PATHWAY: ${aiResult.interact_pathway || 'N/A'}`,
            `PREVENTION: ${aiResult.prevention || 'N/A'}`,
            `QI ACTIONS: ${aiResult.qi_actions.join('; ') || 'none'}`,
          ].join('\n')
        : aiAnalysisText;

      // Insert review — submitted_by is the user, reviewed_by is null until confirmation
      const { data: review, error } = await supabase
        .from('hospitalization_reviews')
        .insert({
          facility_id: fac.facility_id,
          transfer_date: transferDate,
          transfer_time_category: transferTimeCategory || 'business_hours',
          days_since_admission: daysSinceAdmission || null,
          primary_diagnosis: primaryDiagnosis,
          diagnosis_category: diagnosisCategory || 'other',
          present_on_admission: presentOnAdmission ?? null,
          physician_notified: physicianNotified ?? null,
          condition_change_documented: conditionChangeDocumented ?? null,
          interact_tool_used: interactToolUsed ?? null,
          payer_type: payerType || null,
          readmission_flag: readmissionFlag || false,
          ai_avoidability: aiResult.classification,
          ai_analysis: analysisText,
          root_causes: aiResult.root_causes,
          qi_actions: aiResult.qi_actions,
          prevention_notes: aiResult.prevention,
          submitted_by: user.id,
          reviewed_by: null,
        })
        .select('review_id')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        review_id: review.review_id,
        ai_avoidability: aiResult.classification,
        ai_reasoning: aiResult.reasoning,
        ai_root_causes: aiResult.root_causes,
        ai_interact_pathway: aiResult.interact_pathway,
        ai_prevention: aiResult.prevention,
        ai_qi_actions: aiResult.qi_actions,
        ai_analysis: analysisText,
      });
    }

    // ── PATCH: confirm or override AI determination ──
    if (req.method === 'PATCH') {
      const { reviewId, finalAvoidability, overrideReason } = req.body || {};
      if (!reviewId || !finalAvoidability) {
        return res.status(400).json({ error: 'reviewId and finalAvoidability are required' });
      }

      const valid = ['avoidable', 'possibly_avoidable', 'unavoidable'];
      if (!valid.includes(finalAvoidability)) {
        return res.status(400).json({ error: `finalAvoidability must be one of: ${valid.join(', ')}` });
      }

      // PHI check on override reason
      if (overrideReason && containsPHI(overrideReason)) {
        return res.status(422).json({ error: 'Override reason appears to contain PHI. Please remove identifiers.' });
      }

      const { error } = await supabase
        .from('hospitalization_reviews')
        .update({
          final_avoidability: finalAvoidability,
          override_reason: overrideReason || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('review_id', reviewId);

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({ updated: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[hosp-review] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function buildAnalysisPrompt({
  facilityName, transferDate, transferTimeCategory, daysSinceAdmission,
  primaryDiagnosis, diagnosisCategory, presentOnAdmission, physicianNotified,
  conditionChangeDocumented, interactToolUsed, payerType, readmissionFlag,
  additionalContext, buildingContext,
}) {
  const parts = [
    `Analyze this hospitalization transfer for avoidability.`,
    ``,
    `CASE DETAILS (anonymized, no PHI):`,
    `Building: ${facilityName}`,
    `Transfer date: ${transferDate}`,
    `Time of transfer: ${transferTimeCategory || 'unknown'}`,
    daysSinceAdmission != null ? `Days since SNF admission: ${daysSinceAdmission}` : '',
    `Primary diagnosis/reason: ${primaryDiagnosis}`,
    diagnosisCategory ? `Category: ${diagnosisCategory}` : '',
    payerType ? `Payer: ${payerType}` : '',
    ``,
    `CLINICAL INDICATORS:`,
    presentOnAdmission != null ? `Condition present on admission: ${presentOnAdmission ? 'Yes' : 'No'}` : '',
    physicianNotified != null ? `Physician notified before transfer: ${physicianNotified ? 'Yes' : 'No'}` : '',
    conditionChangeDocumented != null ? `Change in condition documented: ${conditionChangeDocumented ? 'Yes' : 'No'}` : '',
    interactToolUsed != null ? `INTERACT tool used: ${interactToolUsed ? 'Yes' : 'No'}` : '',
    readmissionFlag ? `This is a 30-day hospital readmission.` : '',
    additionalContext ? `\nAdditional context: ${additionalContext}` : '',
  ];

  if (buildingContext) {
    parts.push('');
    parts.push('BUILDING CONTEXT:');
    if (buildingContext.staffing_context) parts.push(`Staffing: ${buildingContext.staffing_context}`);
    if (buildingContext.survey_context) parts.push(`Survey: ${buildingContext.survey_context}`);
    if (buildingContext.risk_watchlist) parts.push(`Risk watchlist: ${buildingContext.risk_watchlist}`);
  }

  parts.push('');
  parts.push('Respond with JSON only.');

  return parts.filter(Boolean).join('\n');
}
