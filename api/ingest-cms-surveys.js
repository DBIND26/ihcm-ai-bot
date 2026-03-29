// ============================================================================
// CMS Survey Data Ingestion — POST /api/ingest-cms-surveys
// ============================================================================
// Fetches health deficiency data from the CMS Nursing Home Compare public API
// for all IHCM buildings and stores it in building_surveys.
//
// CMS API: data.cms.gov — Health Deficiencies dataset
// Endpoint: https://data.cms.gov/resource/r5ix-sfxw.json
//
// Pulls last 2 years of survey data per facility by CMS provider ID.

import { requireAuth } from './lib/requireAuth.js';

const CMS_DEFICIENCIES_URL = 'https://data.cms.gov/resource/r5ix-sfxw.json';
const CMS_SURVEYS_URL = 'https://data.cms.gov/resource/djen-97ju.json';

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
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString().split('T')[0];

    for (const facility of facilities) {
      const providerId = facility.cms_provider_id;
      let deficiencies = [];
      let surveysProcessed = 0;

      try {
        // Fetch health deficiencies from CMS
        const defUrl = `${CMS_DEFICIENCIES_URL}?$where=federal_provider_number='${providerId}' AND survey_date_output>='${cutoffDate}'&$limit=500&$order=survey_date_output DESC`;
        const defRes = await fetch(defUrl, {
          headers: { 'Accept': 'application/json' },
        });

        if (defRes.ok) {
          deficiencies = await defRes.json();
        }
      } catch (err) {
        console.warn(`[cms-ingest] Deficiency fetch failed for ${providerId}:`, err.message);
      }

      if (deficiencies.length === 0) {
        results.push({ building: facility.facility_code, surveys: 0, deficiencies: 0, status: 'no_data' });
        continue;
      }

      // Group deficiencies by survey date + type
      const surveyMap = {};
      for (const def of deficiencies) {
        const surveyDate = def.survey_date_output?.split('T')[0];
        if (!surveyDate) continue;

        const surveyType = mapCmsSurveyType(def.survey_type);
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

        const scopeSeverity = def.scope_severity_code || def.scope_severity || null;
        const defRecord = {
          f_tag: def.deficiency_tag || def.tag_number || null,
          scope_severity: scopeSeverity,
          description: def.deficiency_description || def.tag_description || null,
          category: def.deficiency_category || null,
        };

        surveyMap[key].deficiencies.push(defRecord);

        // Check for IJ (severity level J, K, L)
        if (scopeSeverity && /[JKL]/.test(scopeSeverity)) {
          surveyMap[key].has_ij = true;
        }
        // Check for substandard care (severity F, H, I, J, K, L on certain tags)
        if (scopeSeverity && /[FHIJKL]/.test(scopeSeverity)) {
          surveyMap[key].has_substandard = true;
        }
        // Track max scope/severity
        if (scopeSeverity && (!surveyMap[key].max_scope_severity || scopeSeverity > surveyMap[key].max_scope_severity)) {
          surveyMap[key].max_scope_severity = scopeSeverity;
        }
      }

      // Insert surveys into Supabase
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
    return res.status(500).json({ error: 'CMS data ingestion failed' });
  }
}

function mapCmsSurveyType(cmsType) {
  if (!cmsType) return 'standard';
  const t = cmsType.toLowerCase();
  if (t.includes('complaint')) return 'complaint';
  if (t.includes('revisit')) return 'revisit';
  if (t.includes('infection')) return 'infection_control';
  if (t.includes('life safety') || t.includes('lsc')) return 'life_safety';
  if (t.includes('health')) return 'standard';
  return 'standard';
}
