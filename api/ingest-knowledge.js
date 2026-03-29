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

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── GET: list knowledge sources ──
  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const sourceType = url.searchParams.get('type');
    const stateCode = url.searchParams.get('state');

    let query = supabase
      .from('knowledge_sources')
      .select('source_id, title, source_type, state_code, tags, status, effective_date, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (sourceType) query = query.eq('source_type', sourceType);
    if (stateCode) query = query.eq('state_code', stateCode);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ sources: data || [] });
  }

  // ── POST: ingest new knowledge source ──
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, source_type, content, state_code, facility_id, tags, url, region } = req.body || {};

  if (!title || !source_type) {
    return res.status(400).json({ error: 'title and source_type are required' });
  }

  const validTypes = ['corporate_playbook', 'state_reimbursement', 'payer_guidance',
    'survey_template', 'referral_intelligence', 'operator_practice', 'faq', 'workflow_template', 'other'];
  if (!validTypes.includes(source_type)) {
    return res.status(400).json({ error: `Invalid source_type. Valid: ${validTypes.join(', ')}` });
  }

  let fullContent = content || '';

  // If URL provided but no content, fetch it
  if (url && !fullContent) {
    try {
      const response = await fetch(url, {
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
      // Limit to 100K chars
      fullContent = fullContent.slice(0, 100000);
    } catch (err) {
      return res.status(400).json({ error: `Failed to fetch URL: ${err.message}` });
    }
  }

  if (!fullContent || fullContent.length < 10) {
    return res.status(400).json({ error: 'No content provided or fetched' });
  }

  // Generate a citation_text (first 500 chars as summary)
  const citationText = fullContent.slice(0, 500).replace(/\s+/g, ' ').trim();

  try {
    const { data, error } = await supabase
      .from('knowledge_sources')
      .insert({
        title,
        source_type,
        state_code: state_code || null,
        facility_id: facility_id || null,
        region: region || null,
        tags: tags || [],
        status: 'approved', // auto-approve for now
        effective_date: new Date().toISOString().split('T')[0],
        citation_text: citationText,
        full_content: fullContent,
      })
      .select('source_id, title, source_type')
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
      content_length: fullContent.length,
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, source: data });

  } catch (err) {
    console.error('[ingest-knowledge] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
