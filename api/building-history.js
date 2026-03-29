// ============================================================================
// Building History endpoint — GET/POST /api/building-history
// ============================================================================
// Serves survey and event data for a specific building from Supabase.
// Replaces localStorage-based buildingHistory.js.

import { requireAuth } from './lib/requireAuth.js';

function mapUploadedSurveyType(surveyType) {
  switch (String(surveyType || '').toLowerCase()) {
    case 'annual':
    case 'standard':
      return 'standard';
    case 'complaint':
      return 'complaint';
    case 'revisit':
      return 'revisit';
    case 'infection_control':
      return 'infection_control';
    case 'life_safety':
      return 'life_safety';
    default:
      return 'other';
  }
}

function getMaxScopeSeverity(citations) {
  const rank = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  let best = null;
  let bestIdx = -1;

  for (const citation of citations || []) {
    const normalized = String(citation.scope_severity || citation.scopeSeverity || '')
      .toUpperCase()
      .replace(/[^A-L]/g, '');
    for (const char of normalized) {
      const idx = rank.indexOf(char);
      if (idx > bestIdx) {
        bestIdx = idx;
        best = char;
      }
    }
  }

  return best;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user, supabase, supabaseUser } = auth;

  // ── GET: load building history ──
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const buildingId = url.searchParams.get('building');
    if (!buildingId) return res.status(400).json({ error: 'Missing building parameter' });

    // Resolve slug to facility_id
    const { data: fac } = await supabaseUser
      .from('facilities')
      .select('facility_id')
      .eq('facility_code', buildingId)
      .single();
    if (!fac) return res.status(404).json({ error: 'Building not found' });

    // Fetch surveys
    const { data: surveys } = await supabaseUser
      .from('building_surveys')
      .select('survey_id, survey_date, survey_type, source, total_deficiencies, scope_severity_max, has_immediate_jeopardy, deficiencies')
      .eq('facility_id', fac.facility_id)
      .order('survey_date', { ascending: false })
      .limit(20);

    // Fetch events
    const { data: events } = await supabaseUser
      .from('building_events')
      .select('event_id, event_date, category, title, description')
      .eq('facility_id', fac.facility_id)
      .order('event_date', { ascending: false })
      .limit(50);

    return res.status(200).json({
      surveys: (surveys || []).map(s => ({
        id: s.survey_id,
        date: s.survey_date,
        type: s.survey_type,
        source: s.source,
        totalTags: s.total_deficiencies,
        maxSeverity: s.scope_severity_max,
        hasIJ: s.has_immediate_jeopardy,
        citations: (s.deficiencies || []).map(d => ({
          fTag: d.f_tag,
          scopeSeverity: d.scope_severity,
          description: d.description,
        })),
      })),
      events: (events || []).map(e => ({
        id: e.event_id,
        date: e.event_date,
        category: e.category,
        title: e.title,
        description: e.description,
      })),
    });
  }

  // ── POST: add an event or persist an uploaded survey ──
  if (req.method === 'POST') {
    const { buildingId, category, title, description, date, kind, survey } = req.body || {};
    if (!buildingId) return res.status(400).json({ error: 'buildingId is required' });

    const { data: fac } = await supabase
      .from('facilities')
      .select('facility_id')
      .eq('facility_code', buildingId)
      .single();
    if (!fac) return res.status(404).json({ error: 'Building not found' });

    if (kind === 'survey') {
      const citations = Array.isArray(survey?.citations) ? survey.citations : [];
      const surveyDate = survey?.survey_date || survey?.date || date || new Date().toISOString().split('T')[0];
      const surveyType = mapUploadedSurveyType(survey?.survey_type || survey?.type);
      const maxSeverity = getMaxScopeSeverity(citations);
      const hasIJ = citations.some(citation => /[JKL]/i.test(String(citation.scope_severity || citation.scopeSeverity || '')));

      const deficiencies = citations.map(citation => ({
        f_tag: citation.f_tag || citation.fTag || null,
        scope_severity: citation.scope_severity || citation.scopeSeverity || null,
        description: citation.tag_description || citation.description || null,
        regulation: citation.regulation || null,
        deficient_practice: citation.deficient_practice || null,
        findings: citation.findings || null,
        plan_of_correction_due: citation.plan_of_correction_due || null,
      }));

      const payload = {
        facility_id: fac.facility_id,
        survey_date: surveyDate,
        survey_type: surveyType,
        source: 'uploaded_2567',
        total_deficiencies: survey?.total_citations ?? deficiencies.length,
        scope_severity_max: maxSeverity,
        has_immediate_jeopardy: hasIJ,
        has_substandard_care: Boolean(maxSeverity && ['F', 'H', 'I', 'J', 'K', 'L'].includes(maxSeverity)),
        deficiencies,
        raw_data: survey || null,
      };

      const { data, error } = await supabase
        .from('building_surveys')
        .upsert(payload, { onConflict: 'facility_id,survey_date,survey_type,source' })
        .select('survey_id')
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, survey_id: data?.survey_id || null });
    }

    if (!title) return res.status(400).json({ error: 'title is required' });

    const { data, error } = await supabase
      .from('building_events')
      .insert({
        facility_id: fac.facility_id,
        event_date: date || new Date().toISOString().split('T')[0],
        category: category || 'general',
        title,
        description: description || null,
        created_by: user.id,
      })
      .select('event_id')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, event_id: data.event_id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
