// ============================================================================
// Conversations endpoint — GET /api/conversations
// ============================================================================
// Lists conversations and loads messages for a specific conversation.
//
// Query params:
//   ?user=<userName>                           → list conversations for user
//   ?user=<userName>&building=<buildingId>     → filter by building
//   ?id=<conversationId>                       → load messages for a conversation
//
// Returns:
//   List mode:  { conversations: [{ conversation_id, title, facility_code, status, updated_at, message_count, last_message }] }
//   Detail mode: { conversation: { conversation_id, title, ... }, messages: [{ role, content }] }

import { getOrCreateBetaUser } from './lib/betaUser.js';

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Parse query params
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const conversationId = url.searchParams.get('id');
  const userName = url.searchParams.get('user');
  const buildingId = url.searchParams.get('building');
  const roleId = url.searchParams.get('role');

  try {
    // ── Detail mode: load a specific conversation's messages ──
    if (conversationId) {
      // Ownership check: require user param and verify the conversation belongs to them
      if (!userName) {
        return res.status(400).json({ error: 'Missing user parameter for ownership verification' });
      }
      const betaUserId = await getOrCreateBetaUser(supabase, userName);
      if (!betaUserId) {
        return res.status(403).json({ error: 'Unknown user' });
      }

      // Verify conversation ownership before loading messages
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', betaUserId)
        .single();

      if (convError || !conv) {
        return res.status(403).json({ error: 'Conversation not found or access denied' });
      }

      const { data: messages, error } = await supabase
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[conversations] Message fetch failed:', error.message);
        return res.status(500).json({ error: 'Failed to load messages' });
      }

      return res.status(200).json({
        messages: (messages || []).map(m => ({ role: m.role, content: m.content })),
      });
    }

    // ── List mode: list conversations for a user ──
    if (!userName) {
      return res.status(400).json({ error: 'Missing user or id parameter' });
    }

    const betaUserId = await getOrCreateBetaUser(supabase, userName);
    if (!betaUserId) {
      return res.status(200).json({ conversations: [] });
    }

    // Resolve building slug to facility UUID
    let facilityId = null;
    if (buildingId && buildingId !== 'none') {
      const { data: fac } = await supabase
        .from('facilities')
        .select('facility_id')
        .eq('facility_code', buildingId)
        .single();
      facilityId = fac?.facility_id || null;
    }

    // Build query
    let query = supabase
      .from('conversations')
      .select(`
        conversation_id,
        title,
        facility_id,
        workflow_type,
        status,
        updated_at,
        created_at
      `)
      .eq('user_id', betaUserId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }
    if (roleId) {
      query = query.eq('bot_id', roleId);
    }

    const { data: conversations, error } = await query;

    if (error) {
      console.warn('[conversations] List fetch failed:', error.message);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }

    // Get message counts and last message preview for each conversation
    const enriched = await Promise.all((conversations || []).map(async (conv) => {
      const { data: msgs } = await supabase
        .from('conversation_messages')
        .select('role, content')
        .eq('conversation_id', conv.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = msgs?.[0];
      const { count } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.conversation_id);

      return {
        conversation_id: conv.conversation_id,
        title: conv.title,
        facility_id: conv.facility_id,
        workflow_type: conv.workflow_type,
        status: conv.status,
        updated_at: conv.updated_at,
        message_count: count || 0,
        last_message: lastMsg?.content?.slice(0, 100) || '',
        last_role: lastMsg?.role || 'user',
      };
    }));

    return res.status(200).json({ conversations: enriched });

  } catch (err) {
    console.error('[conversations] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
