// ============================================================================
// Census Ingest — POST /api/ingest-census
// ============================================================================
// Accepts a SNF Metrics Daily Census CSV upload and updates:
//   1. facilities.current_census
//   2. building_profiles.payer_context (auto-generated from payer breakdown)
//
// The CSV has a messy multi-section format. We parse the detailed section
// which has rows like: Saturday,3/28/2026,Medicare A,...,Arkadelphia,5,6.1%

// Facility name mapping: SNF Metrics names → our facility_codes
const FACILITY_MAP = {
  'Arkadelphia': 'arkadelphia',
  'Crossett': 'crossett',
  'Glenwood': 'glenwood',
  'Stonegate': 'stonegate',
  'The Woods': 'thewoods',
  'Marymount': 'marymount',
  'Marymount Place ALF': 'marymount_alf',
  'Nightingale': 'erie',
  'Nightingale ALF-2': 'erie_pc',
};

// Which payer types to track
const PAYER_TYPES = ['Medicare A', 'Medicaid Pending', 'Private', 'Managed Care', 'Medicaid', 'Other', 'Leave', 'Unassigned'];

import { requireAuth } from './lib/requireAuth.js';

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  try {
    // Read CSV from request body (text)
    let csvText = '';
    if (typeof req.body === 'string') {
      csvText = req.body;
    } else if (req.body?.csv) {
      csvText = req.body.csv;
    } else {
      // Read raw body
      const chunks = [];
      for await (const chunk of req) { chunks.push(chunk); }
      csvText = Buffer.concat(chunks).toString('utf8');
    }

    if (!csvText || csvText.length < 100) {
      return res.status(400).json({ error: 'No CSV data received' });
    }

    // Remove BOM if present
    csvText = csvText.replace(/^\uFEFF/, '');

    // Parse the detailed payer section
    // Look for rows matching: day,date,PayerType,ReportTitle,Region,FacilityName,Count,Percent
    const lines = csvText.split('\n');
    const parsed = {}; // { facilitySlug: { census: N, payers: { type: { count, pct } } } }
    let reportDate = null;

    for (const line of lines) {
      // Match detailed rows: starts with day of week, has a date, payer type, and facility
      const match = line.match(/^(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),(\d{1,2}\/\d{1,2}\/\d{4}),([^,]+),Independence Healthcare Management.*?,(?:Arkansas|Ohio|Pennsylvania|Region Totals|Total),([^,]+),(\d+|-),/);
      if (!match) continue;

      const [, date, payerType, facilityName, countStr] = match;
      if (!reportDate) reportDate = date;

      // Skip region totals and grand totals
      if (facilityName === 'Arkansas' || facilityName === 'Pennsylvania' || facilityName === 'Ohio' || facilityName === 'Total') continue;

      const slug = FACILITY_MAP[facilityName];
      if (!slug) continue;

      const count = countStr === '-' ? 0 : parseInt(countStr, 10);
      if (isNaN(count)) continue;

      if (!parsed[slug]) {
        parsed[slug] = { census: 0, payers: {} };
      }

      if (payerType === 'TOTAL') {
        parsed[slug].census = count;
      } else if (PAYER_TYPES.includes(payerType)) {
        parsed[slug].payers[payerType] = count;
      }
    }

    if (Object.keys(parsed).length === 0) {
      return res.status(400).json({ error: 'Could not parse any facility data from CSV' });
    }

    // Merge ALF data into parent facilities
    // Marymount ALF → marymount (combined)
    if (parsed['marymount'] && parsed['marymount_alf']) {
      const snf = parsed['marymount'];
      const alf = parsed['marymount_alf'];
      snf.census += alf.census;
      snf.alfCensus = alf.census;
      snf.snfCensus = snf.census - alf.census;
      snf.alfPayers = { ...alf.payers };
      delete parsed['marymount_alf'];
    }

    // Erie PC → erie (combined)
    if (parsed['erie'] && parsed['erie_pc']) {
      const snf = parsed['erie'];
      const pc = parsed['erie_pc'];
      snf.census += pc.census;
      snf.pcCensus = pc.census;
      snf.snfCensus = snf.census - pc.census;
      snf.pcPayers = { ...pc.payers };
      delete parsed['erie_pc'];
    }

    // Update Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = [];

    for (const [slug, data] of Object.entries(parsed)) {
      // Build payer context string
      const totalCensus = data.census || 1;
      const payerLines = Object.entries(data.payers)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${type}: ${count} (${Math.round(count / totalCensus * 100)}%)`)
        .join(', ');

      let payerContext = `Census ${totalCensus}. ${payerLines}.`;

      // Add ALF/PC breakdown if applicable
      if (data.alfCensus !== undefined) {
        const alfLines = Object.entries(data.alfPayers || {})
          .filter(([, count]) => count > 0)
          .map(([type, count]) => `${type}: ${count}`)
          .join(', ');
        payerContext = `SNF: ${data.snfCensus} census. ${payerLines}. ALF: ${data.alfCensus} census. ${alfLines}.`;
      }
      if (data.pcCensus !== undefined) {
        const pcLines = Object.entries(data.pcPayers || {})
          .filter(([, count]) => count > 0)
          .map(([type, count]) => `${type}: ${count}`)
          .join(', ');
        payerContext = `SNF: ${data.snfCensus} census. ${payerLines}. Personal Care: ${data.pcCensus} census. ${pcLines}.`;
      }

      payerContext += ` (Updated from SNF Metrics ${reportDate || 'today'})`;

      // Update facilities.current_census
      const { error: censusErr } = await supabase
        .from('facilities')
        .update({ current_census: data.census })
        .eq('facility_code', slug);

      // Update building_profiles.payer_context
      const { error: payerErr } = await supabase
        .from('building_profiles')
        .update({ payer_context: payerContext })
        .eq('facility_id', (await supabase.from('facilities').select('facility_id').eq('facility_code', slug).single()).data?.facility_id);

      results.push({
        building: slug,
        census: data.census,
        payers: Object.keys(data.payers).length,
        censusUpdated: !censusErr,
        payerUpdated: !payerErr,
      });
    }

    console.log(JSON.stringify({
      event: 'census_ingested',
      reportDate,
      buildings: results.length,
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({
      success: true,
      reportDate,
      buildings: results,
    });

  } catch (err) {
    console.error('[ingest-census] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process census data' });
  }
}
