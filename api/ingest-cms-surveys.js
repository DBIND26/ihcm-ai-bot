// ============================================================================
// CMS Survey Data Ingestion — POST /api/ingest-cms-surveys
// ============================================================================
// Fetches health deficiency data from the CMS Provider Data API
// for all IHCM buildings and stores it in building_surveys.
//
// New API: https://data.cms.gov/provider-data/api/1/datastore/query/r5ix-sfxw/0

import { requireAuth } from './lib/requireAuth.js';

const CMS_API_BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query/r5ix-sfxw/0';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { supabase } = auth;

  try {
    // Get all facilities with CMS provider IDs
    const { data: facilities, error: facErr } = await supabase
      .from('facilities')
      .select('facility_id, facility_code, facility_name, cms_provider_id')
      .not('cms_provider_id', 'is', null);

    if (facErr || !facilities?.length) {
      return res.status(500).json({ error: 'No facilities with CMS IDs found' });
    }

    const results = [];

    for (const facility of facilities) {
      const providerId = facility.cms_provider_id;
      let deficiencies = [];
      let surveysProcessed = 0;

      try {
        // Fetch from new CMS Provider Data API
        const url = `${CMS_API_BASE}?` + new URLSearchParams({
          'conditions[0][property]': 'cms_certification_number_ccn',
          'conditions[0][value]': providerId,
          'conditions[0][operator]': '=',
          'limit': '500',
          'sort[0][property]': 'survey_date',
          'sort[0][order]': 'desc',
        }).toString();

        const cmsRes = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (cmsRes.ok) {
          const data = await cmsRes.json();
          deficiencies = data.results || [];
        }
      } catch (err) {
        console.warn(`[cms-ingest] Fetch failed for ${providerId}:`, err.message);
      }

      if (deficiencies.length === 0) {
        results.push({ building: facility.facility_code, name: facility.facility_name, surveys: 0, deficiencies: 0, status: 'no_data' });
        continue;
      }

      // Group deficiencies by survey date + type
      const surveyMap = {};
      for (const def of deficiencies) {
        const surveyDate = def.survey_date;
        if (!surveyDate) continue;

        const surveyType = mapCmsSurveyType(def.survey_type, def.complaint_deficiency);
        const key = `${surveyDate}::${surveyType}`;

        if (!surveyMap[key]) {
          surveyMap[key] = {
            survey_date: surveyDate,
            survey_type: surveyType,
            deficiencies: [],
            has_ij: false,
            has_substandard: false,
            max_scope_severity: null,
          };
        }

        const scopeSeverity = def.scope_severity_code || null;
        const defRecord = {
          f_tag: def.deficiency_prefix && def.deficiency_tag_number
            ? `${def.deficiency_prefix}${def.deficiency_tag_number}`
            : def.deficiency_tag_number || null,
          scope_severity: scopeSeverity,
          description: def.deficiency_description || null,
          category: def.deficiency_category || null,
          corrected: def.deficiency_corrected || null,
          correction_date: def.correction_date || null,
          is_complaint: def.complaint_deficiency === 'Y',
        };

        surveyMap[key].deficiencies.push(defRecord);

        // Check for IJ (scope/severity J, K, L)
        if (scopeSeverity && /[JKL]/.test(scopeSeverity)) {
          surveyMap[key].has_ij = true;
        }
        if (scopeSeverity && /[FHIJKL]/.test(scopeSeverity)) {
          surveyMap[key].has_substandard = true;
        }
        if (scopeSeverity && (!surveyMap[key].max_scope_severity || scopeSeverity > surveyMap[key].max_scope_severity)) {
          surveyMap[key].max_scope_severity = scopeSeverity;
        }
      }

      // Upsert surveys into Supabase
      for (const [, survey] of Object.entries(surveyMap)) {
        const { error: insertErr } = await supabase
          .from('building_surveys')
          .upsert({
            facility_id: facility.facility_id,
            survey_date: survey.survey_date,
            survey_type: survey.survey_type,
            source: 'cms',
            total_deficiencies: survey.deficiencies.length,
            scope_severity_max: survey.max_scope_severity,
            has_immediate_jeopardy: survey.has_ij,
            has_substandard_care: survey.has_substandard,
            deficiencies: survey.deficiencies,
            cms_provider_id: providerId,
          }, {
            onConflict: 'facility_id,survey_date,survey_type,source',
          });

        if (!insertErr) surveysProcessed++;
      }

      results.push({
        building: facility.facility_code,
        name: facility.facility_name,
        surveys: surveysProcessed,
        deficiencies: deficiencies.length,
        status: 'ok',
      });
    }

    console.log(JSON.stringify({
      event: 'cms_surveys_ingested',
      buildings: results.length,
      total_surveys: results.reduce((s, r) => s + r.surveys, 0),
      total_deficiencies: results.reduce((s, r) => s + r.deficiencies, 0),
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, results });

  } catch (err) {
    console.error('[cms-ingest] Error:', err.message);
    return res.status(500).json({ error: 'CMS data ingestion failed: ' + err.message });
  }
}

function mapCmsSurveyType(cmsType, isComplaint) {
  if (isComplaint === 'Y') return 'complaint';
  if (!cmsType) return 'standard';
  const t = cmsType.toLowerCase();
  if (t.includes('complaint')) return 'complaint';
  if (t.includes('revisit')) return 'revisit';
  if (t.includes('infection')) return 'infection_control';
  if (t.includes('life safety') || t.includes('lsc')) return 'life_safety';
  return 'standard';
}
