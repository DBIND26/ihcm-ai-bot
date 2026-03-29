// ============================================================================
// Hospitalization Review endpoint — GET/POST/PATCH /api/hospitalization-review
// ============================================================================
// Submit anonymized hospitalization reviews with AI avoidability analysis,
// list reviews by building, and get aggregate stats.
//
// HIDDEN FEATURE — not exposed in UI until enabled.

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
  const { user, supabase, supabaseUser } = auth;

  try {
    // ── GET: list reviews or get stats ──
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const building = url.searchParams.get('building');
      const mode = url.searchParams.get('mode'); // 'stats' or 'list' (default)
      const months = parseInt(url.searchParams.get('months') || '12', 10);

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const cutoffDate = cutoff.toISOString().split('T')[0];

      // Resolve building slug if provided
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
        // Aggregate stats
        let query = supabaseUser
          .from('hospitalization_reviews')
          .select('facility_id, transfer_date, diagnosis_category, ai_avoidability, final_avoidability, transfer_time_category, readmission_flag, payer_type')
          .gte('transfer_date', cutoffDate);

        if (facilityId) query = query.eq('facility_id', facilityId);

        const { data: reviews, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        // Build stats
        const total = reviews.length;
        const withDetermination = reviews.filter(r => r.final_avoidability);
        const avoidable = withDetermination.filter(r => r.final_avoidability === 'avoidable').length;
        const possiblyAvoidable = withDetermination.filter(r => r.final_avoidability === 'possibly_avoidable').length;
        const unavoidable = withDetermination.filter(r => r.final_avoidability === 'unavoidable').length;
        const pending = reviews.filter(r => !r.final_avoidability).length;
        const readmissions = reviews.filter(r => r.readmission_flag).length;

        // By category
        const byCategory = {};
        for (const r of reviews) {
          byCategory[r.diagnosis_category] = (byCategory[r.diagnosis_category] || 0) + 1;
        }

        // By time of day
        const byTimeOfDay = {};
        for (const r of reviews) {
          byTimeOfDay[r.transfer_time_category] = (byTimeOfDay[r.transfer_time_category] || 0) + 1;
        }

        // By month
        const byMonth = {};
        for (const r of reviews) {
          const month = r.transfer_date.slice(0, 7); // YYYY-MM
          if (!byMonth[month]) byMonth[month] = { total: 0, avoidable: 0 };
          byMonth[month].total++;
          if (r.final_avoidability === 'avoidable') byMonth[month].avoidable++;
        }

        // By building (portfolio view)
        const byBuilding = {};
        const { data: facilities } = await supabaseUser
          .from('facilities')
          .select('facility_id, facility_code, facility_name');
        const facMap = {};
        for (const f of (facilities || [])) facMap[f.facility_id] = f;

        for (const r of reviews) {
          const fac = facMap[r.facility_id];
          const slug = fac?.facility_code || 'unknown';
          if (!byBuilding[slug]) byBuilding[slug] = { name: fac?.facility_name || slug, total: 0, avoidable: 0, readmissions: 0 };
          byBuilding[slug].total++;
          if (r.final_avoidability === 'avoidable') byBuilding[slug].avoidable++;
          if (r.readmission_flag) byBuilding[slug].readmissions++;
        }

        return res.status(200).json({
          total,
          avoidable,
          possibly_avoidable: possiblyAvoidable,
          unavoidable,
          pending,
          readmissions,
          avoidable_pct: withDetermination.length > 0 ? Math.round((avoidable / withDetermination.length) * 100) : null,
          by_category: byCategory,
          by_time_of_day: byTimeOfDay,
          by_month: byMonth,
          by_building: byBuilding,
          months,
        });
      }

      // Default: list mode
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

      // Call Claude for analysis
      let aiAnalysis = null;
      let aiAvoidability = null;
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic();
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are a skilled nursing facility clinical analyst specializing in hospitalization avoidability review. You use CMS Potentially Avoidable Hospitalization (PAH) criteria and INTERACT clinical pathways to evaluate cases. You never use patient names or PHI. Your analysis is structured and actionable.

Always respond with this exact structure:
CLASSIFICATION: [avoidable / possibly_avoidable / unavoidable]
REASONING: [2-3 sentences explaining why]
ROOT CAUSES: [comma-separated list from: staffing, communication, clinical_capability, documentation, physician_response, family_decision, equipment, process_failure, after_hours_coverage]
INTERACT PATHWAY: [which INTERACT tool/pathway should have been used, if applicable]
PREVENTION: [specific steps to prevent similar transfers]
QI ACTIONS: [1-3 concrete quality improvement items]`,
          messages: [{ role: 'user', content: analysisPrompt }],
        });

        aiAnalysis = response.content[0]?.text || null;

        // Extract classification from structured response
        const classMatch = aiAnalysis?.match(/CLASSIFICATION:\s*(avoidable|possibly_avoidable|unavoidable)/i);
        if (classMatch) {
          aiAvoidability = classMatch[1].toLowerCase();
        }
      } catch (err) {
        console.warn('[hosp-review] AI analysis failed:', err.message);
        aiAnalysis = 'AI analysis unavailable — please classify manually.';
      }

      // Parse root causes from AI response
      let rootCauses = [];
      if (aiAnalysis) {
        const rcMatch = aiAnalysis.match(/ROOT CAUSES:\s*(.+?)(?:\n|$)/i);
        if (rcMatch) {
          rootCauses = rcMatch[1].split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_'))
            .filter(s => ROOT_CAUSE_OPTIONS.includes(s));
        }
      }

      // Parse QI actions
      let qiActions = [];
      if (aiAnalysis) {
        const qiMatch = aiAnalysis.match(/QI ACTIONS:\s*(.+?)(?:\n\n|$)/is);
        if (qiMatch) {
          qiActions = qiMatch[1].split(/\n|;/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        }
      }

      // Insert review
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
          ai_avoidability: aiAvoidability,
          ai_analysis: aiAnalysis,
          root_causes: rootCauses,
          qi_actions: qiActions,
          reviewed_by: user.id,
        })
        .select('review_id')
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        review_id: review.review_id,
        ai_avoidability: aiAvoidability,
        ai_analysis: aiAnalysis,
        root_causes: rootCauses,
        qi_actions: qiActions,
      });
    }

    // ── PATCH: update final determination ──
    if (req.method === 'PATCH') {
      const { reviewId, finalAvoidability, overrideReason } = req.body || {};
      if (!reviewId || !finalAvoidability) {
        return res.status(400).json({ error: 'reviewId and finalAvoidability are required' });
      }

      const valid = ['avoidable', 'possibly_avoidable', 'unavoidable'];
      if (!valid.includes(finalAvoidability)) {
        return res.status(400).json({ error: `finalAvoidability must be one of: ${valid.join(', ')}` });
      }

      const { error } = await supabase
        .from('hospitalization_reviews')
        .update({
          final_avoidability: finalAvoidability,
          override_reason: overrideReason || null,
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
  parts.push('Provide your structured analysis using the required format (CLASSIFICATION, REASONING, ROOT CAUSES, INTERACT PATHWAY, PREVENTION, QI ACTIONS).');

  return parts.filter(Boolean).join('\n');
}
