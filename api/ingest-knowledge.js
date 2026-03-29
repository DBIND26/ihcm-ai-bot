// ============================================================================
// Knowledge Ingestion — POST /api/ingest-knowledge
// ============================================================================
// Accepts documents (text, PDF, or URL) and stores them in knowledge_sources.
//
// Input (JSON):
//   { title, source_type, content, state_code?, facility_id?, tags?, url? }
//
// source_type: corporate_playbook, state_reimbursement, payer_guidance,
//              survey_template, operator_practice, faq, other
//
// If url is provided and content is empty, fetches the URL and extracts text.

import { requireAuth } from './lib/requireAuth.js';

const MAX_CONTENT_LENGTH = 100000;

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth check
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user: authUser, supabase } = auth;

  // ── GET: list knowledge sources ──
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const sourceType = url.searchParams.get('type');
    const stateCode = url.searchParams.get('state');
    const statusFilter = url.searchParams.get('status'); // 'draft', 'approved', 'all'

    let query = supabase
      .from('knowledge_sources')
      .select('source_id, title, source_type, state_code, facility_id, tags, status, effective_date, updated_at, citation_text')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (sourceType) query = query.eq('source_type', sourceType);
    if (stateCode) query = query.eq('state_code', stateCode);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ sources: data || [] });
  }

  // ── PATCH: approve/reject/archive a knowledge source ──
  if (req.method === 'PATCH') {
    const { source_id, status: newStatus } = req.body || {};
    if (!source_id) return res.status(400).json({ error: 'source_id is required' });
    if (!['approved', 'archived', 'in_review', 'draft'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status. Use: approved, archived, in_review, draft' });
    }

    const { data, error } = await supabase
      .from('knowledge_sources')
      .update({ status: newStatus })
      .eq('source_id', source_id)
      .select('source_id, title, status')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    console.log(JSON.stringify({
      event: 'knowledge_status_changed',
      source_id, new_status: newStatus,
      user: authUser.email,
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, source: data });
  }

  // ── POST: ingest new knowledge source ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, source_type, content, state_code, facility_id, tags, url, region, building_id } = req.body || {};

  if (!title || !source_type) {
    return res.status(400).json({ error: 'title and source_type are required' });
  }

  const validTypes = ['corporate_playbook', 'state_reimbursement', 'payer_guidance',
    'survey_template', 'referral_intelligence', 'operator_practice', 'faq', 'workflow_template', 'other'];
  if (!validTypes.includes(source_type)) {
    return res.status(400).json({ error: `Invalid source_type. Valid: ${validTypes.join(', ')}` });
  }

  let fullContent = content || '';

  let resolvedFacilityId = facility_id || null;
  let resolvedStateCode = state_code || null;

  if (building_id) {
    const { data: facility, error: facilityError } = await supabase
      .from('facilities')
      .select('facility_id, state_code')
      .eq('facility_code', building_id)
      .single();

    if (facilityError || !facility) {
      return res.status(400).json({ error: 'Unknown building_id' });
    }

    resolvedFacilityId = facility.facility_id;
    if (resolvedStateCode && resolvedStateCode !== facility.state_code) {
      return res.status(400).json({ error: 'state_code does not match the selected building' });
    }
    resolvedStateCode = facility.state_code;
  }

  // If URL provided but no content, fetch it
  if (url && !fullContent) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only https URLs are allowed' });
    }

    try {
      const response = await fetch(parsedUrl, {
        headers: { 'User-Agent': 'IHCM-Bot-Knowledge-Ingestion/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      // Basic HTML to text extraction
      fullContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
      fullContent = fullContent.slice(0, MAX_CONTENT_LENGTH);
    } catch (err) {
      return res.status(400).json({ error: `Failed to fetch URL: ${err.message}` });
    }
  }

  if (!fullContent || fullContent.length < 10) {
    return res.status(400).json({ error: 'No content provided or fetched' });
  }
  fullContent = fullContent.slice(0, MAX_CONTENT_LENGTH);

  // Generate citation_text and content hash for dedupe
  const citationText = fullContent.slice(0, 500).replace(/\s+/g, ' ').trim();
  const { createHash } = await import('node:crypto');
  const contentHash = createHash('md5').update(fullContent).digest('hex');

  // Dedupe check: same title + type + state + facility
  try {
    const { data: existing } = await supabase
      .from('knowledge_sources')
      .select('source_id, title, status')
      .eq('title', title)
      .eq('source_type', source_type)
      .neq('status', 'archived')
      .limit(1);

    if (existing?.length > 0) {
      return res.status(409).json({
        error: 'A knowledge source with this title and type already exists',
        existing: existing[0],
      });
    }
  } catch { /* proceed if dedupe check fails */ }

  try {
    const { data, error } = await supabase
      .from('knowledge_sources')
      .insert({
        title,
        source_type,
        state_code: resolvedStateCode,
        facility_id: resolvedFacilityId,
        region: region || null,
        tags: tags || [],
        status: 'draft',
        effective_date: new Date().toISOString().split('T')[0],
        citation_text: citationText,
        full_content: fullContent,
        content_hash: contentHash,
      })
      .select('source_id, title, source_type, status')
      .single();

    if (error) {
      console.error('[ingest-knowledge] Insert failed:', error.message);
      return res.status(500).json({ error: 'Failed to store knowledge source' });
    }

    console.log(JSON.stringify({
      event: 'knowledge_ingested',
      source_id: data.source_id,
      title,
      source_type,
      facility_id: resolvedFacilityId,
      state_code: resolvedStateCode,
      status: 'draft',
      content_length: fullContent.length,
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, source: data });

  } catch (err) {
    console.error('[ingest-knowledge] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
