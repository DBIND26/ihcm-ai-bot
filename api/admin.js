// ============================================================================
// Admin Dashboard API — GET /api/admin
// ============================================================================
// Returns platform metrics for admin users: user activity, conversations,
// feedback, knowledge status, census trends, and recent uploads.
// Restricted to super_admin and corporate_admin roles.

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

  // Admin only
  const adminRoles = ['super_admin'];
  if (!adminRoles.includes(auth.profile.app_role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { supabase } = auth;

  try {
    const results = {};

    // ── Users ──
    const { data: users } = await supabase
      .from('user_profiles')
      .select('user_id, email, full_name, app_role, allowed_bot_roles, is_active, created_at')
      .order('created_at', { ascending: false });

    // Get last activity per user from conversations
    const { data: userActivity } = await supabase
      .from('conversations')
      .select('user_id, updated_at')
      .order('updated_at', { ascending: false });

    const lastActiveMap = {};
    for (const conv of (userActivity || [])) {
      if (!lastActiveMap[conv.user_id]) {
        lastActiveMap[conv.user_id] = conv.updated_at;
      }
    }

    results.users = (users || []).map(u => ({
      ...u,
      last_active: lastActiveMap[u.user_id] || null,
    }));

    // ── Conversations (last 7 days) ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentConvs } = await supabase
      .from('conversations')
      .select('conversation_id, user_id, bot_id, facility_id, title, status, created_at, updated_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get message counts per conversation
    const convIds = (recentConvs || []).map(c => c.conversation_id);
    let msgCounts = {};
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from('conversation_messages')
        .select('conversation_id')
        .in('conversation_id', convIds);
      for (const m of (msgs || [])) {
        msgCounts[m.conversation_id] = (msgCounts[m.conversation_id] || 0) + 1;
      }
    }

    // Map user_id to name
    const userNameMap = {};
    for (const u of (users || [])) {
      userNameMap[u.user_id] = u.full_name || u.email;
    }

    // Map facility_id to name
    const { data: facilities } = await supabase
      .from('facilities')
      .select('facility_id, facility_code, facility_name');
    const facilityMap = {};
    for (const f of (facilities || [])) {
      facilityMap[f.facility_id] = f.facility_name;
    }

    results.conversations = (recentConvs || []).map(c => ({
      ...c,
      user_name: userNameMap[c.user_id] || 'Unknown',
      facility_name: c.facility_id ? facilityMap[c.facility_id] || null : 'All Buildings',
      message_count: msgCounts[c.conversation_id] || 0,
    }));

    // ── Conversation totals ──
    const { count: totalConvs } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true });
    const { count: weekConvs } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    results.conversation_totals = {
      all_time: totalConvs || 0,
      last_7_days: weekConvs || 0,
    };

    // ── Feedback ──
    const { data: feedback } = await supabase
      .from('feedback_events')
      .select('feedback_id, user_id, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    results.feedback = (feedback || []).map(f => ({
      ...f,
      user_name: userNameMap[f.user_id] || 'Unknown',
    }));

    // Feedback summary
    const { data: allFeedback } = await supabase
      .from('feedback_events')
      .select('rating');
    const feedbackSummary = { useful: 0, not_useful: 0, questionable: 0, needs_review: 0, total: 0 };
    for (const f of (allFeedback || [])) {
      feedbackSummary[f.rating] = (feedbackSummary[f.rating] || 0) + 1;
      feedbackSummary.total++;
    }
    results.feedback_summary = feedbackSummary;

    // ── Knowledge Sources ──
    const { data: knowledge } = await supabase
      .from('knowledge_sources')
      .select('source_id, title, source_type, status, state_code, facility_id, tags, current_version, updated_at')
      .order('updated_at', { ascending: false })
      .limit(30);

    results.knowledge = (knowledge || []).map(k => ({
      ...k,
      facility_name: k.facility_id ? facilityMap[k.facility_id] || null : null,
    }));

    const knowledgeSummary = { draft: 0, approved: 0, archived: 0, in_review: 0 };
    for (const k of (knowledge || [])) {
      knowledgeSummary[k.status] = (knowledgeSummary[k.status] || 0) + 1;
    }
    results.knowledge_summary = knowledgeSummary;

    // ── Building Surveys (recent uploads) ──
    const { data: recentSurveys } = await supabase
      .from('building_surveys')
      .select('survey_id, facility_id, survey_date, survey_type, source, total_deficiencies, has_immediate_jeopardy, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    results.recent_surveys = (recentSurveys || []).map(s => ({
      ...s,
      facility_name: s.facility_id ? facilityMap[s.facility_id] || null : null,
    }));

    // ── Usage by role (conversations breakdown) ──
    const { data: roleUsage } = await supabase
      .from('conversations')
      .select('bot_id');
    const roleCounts = {};
    for (const c of (roleUsage || [])) {
      roleCounts[c.bot_id || 'unknown'] = (roleCounts[c.bot_id || 'unknown'] || 0) + 1;
    }
    results.usage_by_role = roleCounts;

    return res.status(200).json(results);

  } catch (err) {
    console.error('[admin] Error:', err.message);
    return res.status(500).json({ error: 'Failed to load admin data' });
  }
}
