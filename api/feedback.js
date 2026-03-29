// ============================================================================
// Feedback endpoint — POST /api/feedback
// ============================================================================
// Receives feedback from the chat UI (useful / not_useful / wrong) and
// persists it. If Supabase is configured, stores in public.feedback_events.
// Otherwise, logs to server console for later review.

import { requireAuth } from './lib/requireAuth.js';

let lastFeedback = {};
const RATE_LIMIT_MS = 2000; // 2 seconds between feedback from same IP

// Map frontend feedback types to schema-allowed ratings
const RATING_MAP = {
  useful: 'useful',
  not_useful: 'not_useful',
  wrong: 'questionable',
  needs_review: 'needs_review',
};

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
  const { user: authUser, supabase: authSupabase } = auth;

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  if (lastFeedback[ip] && now - lastFeedback[ip] < RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  lastFeedback[ip] = now;

  // Validate input
  const { type, user, role, building, messagePreview, userQuestion, conversationId, timestamp } = req.body || {};

  if (!type || !RATING_MAP[type]) {
    return res.status(400).json({ error: 'Invalid feedback type' });
  }

  const feedbackRecord = {
    type,
    user: (user || '').slice(0, 100) || null,
    role: (role || '').slice(0, 50) || null,
    building: (building || '').slice(0, 50) || null,
    message_preview: (messagePreview || '').slice(0, 500) || null,
    user_question: (userQuestion || '').slice(0, 500) || null,
    timestamp: timestamp || new Date().toISOString(),
    ip,
  };

  if (authSupabase) {
    try {
      const commentParts = [];
      if (feedbackRecord.user_question) commentParts.push(`Q: ${feedbackRecord.user_question}`);
      if (feedbackRecord.message_preview) commentParts.push(`A: ${feedbackRecord.message_preview}`);
      if (feedbackRecord.role) commentParts.push(`Role: ${feedbackRecord.role}`);
      if (feedbackRecord.building) commentParts.push(`Building: ${feedbackRecord.building}`);

      const { error } = await authSupabase
        .from('feedback_events')
        .insert({
          user_id: authUser.id,
          conversation_id: conversationId || null,
          rating: RATING_MAP[feedbackRecord.type],
          comment: commentParts.join(' | ') || null,
        });

      if (error) {
        console.warn('[feedback] Supabase insert failed, falling back to log:', error.message);
      } else {
        console.log(JSON.stringify({ event: 'feedback_saved', source: 'supabase', ...feedbackRecord }));
        return res.status(200).json({ saved: true, source: 'supabase' });
      }
    } catch (err) {
      console.warn('[feedback] Supabase unavailable, falling back to log:', err.message);
    }
  }

  // Fallback: log to console (visible in Vercel function logs)
  console.log(JSON.stringify({ event: 'feedback_saved', source: 'log', ...feedbackRecord }));
  return res.status(200).json({ saved: true, source: 'log' });
}
