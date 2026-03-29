// ============================================================================
// Dashboard endpoint — GET /api/dashboard
// ============================================================================
// Returns portfolio-level building data for the dashboard view.
// Combines v_bot_building_context with open alerts count.

import { requireAuth } from './lib/requireAuth.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { supabase, supabaseUser } = auth;

  try {
    // Get all buildings with context
    const { data: buildings, error: bErr } = await supabaseUser
      .from('v_bot_building_context')
      .select('slug, label, state, bed_capacity, census, occupancy_gap, strategic_status, composite_score, risk_label, skilled_mix_pct, medicaid_pct, payer_context, survey_context, staffing_context, reimbursement_context, risk_watchlist, strategic_notes, market_summary, referral_summary, growth_barriers, growth_opportunities')
      .order('composite_score', { ascending: false, nullsFirst: false });

    if (bErr) {
      console.warn('[dashboard] Building fetch failed:', bErr.message);
      return res.status(500).json({ error: 'Failed to load buildings' });
    }

    // Get open alerts per facility
    const { data: alerts, error: aErr } = await supabaseUser
      .from('ai_alerts')
      .select('facility_id, alert_id, alert_category, alert_type, severity, title, description, recommended_action, owner_role, status, alert_date')
      .in('status', ['open', 'acknowledged', 'in_progress'])
      .order('alert_date', { ascending: false });

    // Get facility code → id mapping for alert matching
    const { data: facilities } = await supabaseUser
      .from('facilities')
      .select('facility_id, facility_code');

    const facilityMap = {};
    for (const f of (facilities || [])) {
      facilityMap[f.facility_id] = f.facility_code;
    }

    // Group alerts by building slug
    const alertsBySlug = {};
    for (const alert of (alerts || [])) {
      const slug = facilityMap[alert.facility_id];
      if (!slug) continue;
      if (!alertsBySlug[slug]) alertsBySlug[slug] = [];
      alertsBySlug[slug].push({
        alert_id: alert.alert_id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        recommended_action: alert.recommended_action,
        alert_category: alert.alert_category,
        alert_type: alert.alert_type,
        owner_role: alert.owner_role,
        status: alert.status,
        alert_date: alert.alert_date,
      });
    }

    // Combine
    const dashboard = (buildings || []).map(b => ({
      ...b,
      alerts: alertsBySlug[b.slug] || [],
      alert_count: (alertsBySlug[b.slug] || []).length,
      top_alert: (alertsBySlug[b.slug] || [])[0] || null,
    }));

    // Portfolio totals
    const totals = {
      total_beds: dashboard.reduce((s, b) => s + (b.bed_capacity || 0), 0),
      total_census: dashboard.reduce((s, b) => s + (b.census || 0), 0),
      total_gap: dashboard.reduce((s, b) => s + (b.occupancy_gap || 0), 0),
      total_alerts: (alerts || []).length,
      buildings_at_risk: dashboard.filter(b => b.risk_label === 'critical' || b.risk_label === 'high_risk').length,
      buildings_watch: dashboard.filter(b => b.risk_label === 'watch').length,
    };
    totals.occupancy_pct = totals.total_beds > 0
      ? Math.round((totals.total_census / totals.total_beds) * 100)
      : 0;

    return res.status(200).json({ buildings: dashboard, totals });

  } catch (err) {
    console.error('[dashboard] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
