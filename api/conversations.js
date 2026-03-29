// ============================================================================
// Conversations endpoint — GET/DELETE /api/conversations
// ============================================================================
// Lists conversations, loads messages, and deletes conversations.
// Requires Supabase Auth JWT.
//
// Query params:
//   ?role=<botId>&building=<slug>  → list conversations for authenticated user
//   ?id=<conversationId>           → load messages (GET) or delete (DELETE)

import { requireAuth } from './lib/requireAuth.js';

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user, supabase, supabaseUser } = auth;
  const userId = user.id;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const conversationId = url.searchParams.get('id');
  const buildingId = url.searchParams.get('building');
  const roleId = url.searchParams.get('role');

  try {
    // ── DELETE mode: remove a conversation and its messages ──
    if (req.method === 'DELETE') {
      if (!conversationId) {
        return res.status(400).json({ error: 'Conversation ID required' });
      }

      // Verify ownership
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conv) {
        return res.status(403).json({ error: 'Conversation not found or access denied' });
      }

      // Delete messages first (FK dependency)
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete conversation
      const { error: delErr } = await supabase
        .from('conversations')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (delErr) {
        console.warn('[conversations] Delete failed:', delErr.message);
        return res.status(500).json({ error: 'Failed to delete conversation' });
      }

      return res.status(200).json({ deleted: true });
    }

    // ── Detail mode: load a specific conversation's messages ──
    if (conversationId) {
      // Verify ownership
      const { data: conv, error: convError } = await supabaseUser
        .from('conversations')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      if (convError || !conv) {
        return res.status(403).json({ error: 'Conversation not found or access denied' });
      }

      const { data: messages, error } = await supabaseUser
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

    // ── List mode: list conversations for authenticated user ──

    // Resolve building slug to facility UUID
    let facilityId = null;
    if (buildingId && buildingId !== 'none') {
      const { data: fac } = await supabaseUser
        .from('facilities')
        .select('facility_id')
        .eq('facility_code', buildingId)
        .single();
      facilityId = fac?.facility_id || null;
    }

    let query = supabaseUser
      .from('conversations')
      .select('conversation_id, title, facility_id, workflow_type, bot_id, status, updated_at, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (facilityId) query = query.eq('facility_id', facilityId);
    if (roleId) query = query.eq('bot_id', roleId);

    const { data: conversations, error } = await query;

    if (error) {
      console.warn('[conversations] List fetch failed:', error.message);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }

    // Get message counts and last message preview
    const enriched = await Promise.all((conversations || []).map(async (conv) => {
      const { data: msgs } = await supabaseUser
        .from('conversation_messages')
        .select('role, content')
        .eq('conversation_id', conv.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMsg = msgs?.[0];
      const { count } = await supabaseUser
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.conversation_id);

      return {
        conversation_id: conv.conversation_id,
        title: conv.title,
        facility_id: conv.facility_id,
        bot_id: conv.bot_id,
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
