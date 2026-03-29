// ============================================================================
// SWOT Analysis Ingestion — POST /api/ingest-swot
// ============================================================================
// Accepts SWOT analysis content (text, PDF, or Word) and stores it as
// knowledge_sources scoped to the building(s) identified in the content.
//
// Input modes:
//   1. JSON body: { building_id, content } — text paste
//   2. Multipart form: file upload (PDF or Word) + optional building_id field

import { requireAuth } from './lib/requireAuth.js';

const BUILDING_KEYWORDS = {
  'arkadelphia': 'arkadelphia',
  'stonegate': 'stonegate',
  'glenwood': 'glenwood',
  'the woods': 'thewoods',
  'thewoods': 'thewoods',
  'crossett': 'crossett',
  'marymount': 'marymount',
  'villa at marymount': 'marymount',
  'erie': 'erie',
  'nightingale erie': 'erie',
  'nightingale at arkadelphia': 'arkadelphia',
  'nightingale at stonegate': 'stonegate',
  'nightingale at glenwood': 'glenwood',
  'nightingale at crossett': 'crossett',
};

function detectBuildings(text) {
  // Only detect buildings that appear as section headers or prominent labels.
  // A building name in body text (e.g., "coordinate with Stonegate") should NOT
  // create a separate entry for that building.
  const found = new Set();
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines that look like section headers:
    // - All caps line with a building name
    // - "Building: Name" or "## Name" patterns
    // - Lines that are mostly the building name (short lines)
    const isHeader = (
      trimmed.length < 80 &&
      (trimmed === trimmed.toUpperCase() || /^#+\s/.test(trimmed) || /^(?:building|facility|location)\s*[:\-]/i.test(trimmed))
    );
    if (!isHeader && trimmed.length > 80) continue; // skip body text lines

    const lower = trimmed.toLowerCase();
    for (const [keyword, slug] of Object.entries(BUILDING_KEYWORDS)) {
      if (lower.includes(keyword) && !found.has(slug)) {
        // Additional check: the keyword should be a substantial part of the line
        if (keyword.length > trimmed.length * 0.2 || isHeader) {
          found.add(slug);
        }
      }
    }
  }

  return [...found];
}

function parseMultipart(rawBody, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
  if (!boundaryMatch) return { fields: {}, fileBuffer: null, fileName: null };

  const boundary = boundaryMatch[1].trim();
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let pos = 0;

  while (pos < rawBody.length) {
    const start = rawBody.indexOf(boundaryBuf, pos);
    if (start === -1) break;
    const nextStart = rawBody.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;
    parts.push(rawBody.slice(start + boundaryBuf.length, nextStart));
    pos = nextStart;
  }

  const fields = {};
  let fileBuffer = null;
  let fileName = null;

  for (const part of parts) {
    const sep = Buffer.from('\r\n\r\n');
    const headerEnd = part.indexOf(sep);
    if (headerEnd === -1) continue;
    const header = part.slice(0, headerEnd).toString('utf8');
    let body = part.slice(headerEnd + sep.length);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.slice(0, -2);
    }

    const nameMatch = header.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    if (header.includes('filename=')) {
      fileBuffer = body;
      const fnMatch = header.match(/filename="([^"]+)"/);
      fileName = fnMatch ? fnMatch[1] : 'upload';
    } else {
      fields[nameMatch[1]] = body.toString('utf8').trim();
    }
  }

  return { fields, fileBuffer, fileName };
}

async function extractTextFromFile(buffer, fileName) {
  const ext = (fileName || '').toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const data = await pdf(buffer);
    return data.text || '';
  }

  if (ext === 'docx' || ext === 'doc') {
    // Basic DOCX text extraction (DOCX is a ZIP of XML files)
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file('word/document.xml')?.async('text');
      if (docXml) {
        return docXml
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (err) {
      console.warn('[ingest-swot] DOCX parse failed:', err.message);
    }
    return '';
  }

  // Plain text
  return buffer.toString('utf8');
}

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
  const { user: authUser, profile: authProfile, supabase } = auth;

  // Only marketing/admin/regional roles can upload SWOTs
  const allowedRoles = ['super_admin', 'corporate_admin', 'regional_director'];
  const allowedBotRoles = authProfile?.allowed_bot_roles || [];
  const hasMarketingAccess = allowedRoles.includes(authProfile?.app_role) ||
    ['marketing', 'admin', 'regional'].some(r => allowedBotRoles.includes(r));
  if (!hasMarketingAccess) {
    return res.status(403).json({ error: 'SWOT upload requires marketing, admin, or regional access' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';

    let textContent = '';
    let explicitBuildingId = null;

    if (contentType.includes('multipart/form-data')) {
      const { fields, fileBuffer, fileName } = parseMultipart(rawBody, contentType);
      explicitBuildingId = fields.building_id || null;
      if (fileBuffer) {
        textContent = await extractTextFromFile(fileBuffer, fileName);
      }
      if (!textContent && fields.content) {
        textContent = fields.content;
      }
    } else if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawBody.toString('utf8'));
        textContent = body.content || '';
        explicitBuildingId = body.building_id || null;
      } catch { /* ignore */ }
    } else {
      textContent = rawBody.toString('utf8');
    }

    if (!textContent || textContent.length < 20) {
      return res.status(400).json({ error: 'No SWOT content provided or extracted' });
    }

    // Detect buildings from content
    // If explicit building_id is provided, use it exclusively (no auto-detection)
    // If not, try to detect from section headers — but only clear headers, not body mentions
    let buildingSlugs;
    if (explicitBuildingId) {
      buildingSlugs = [explicitBuildingId];
    } else {
      buildingSlugs = detectBuildings(textContent);
      // Safety: if detection found more than 3 buildings, it's probably noise — store as portfolio
      if (buildingSlugs.length > 3) {
        console.warn(`[ingest-swot] Detected ${buildingSlugs.length} buildings — likely noise, storing as portfolio`);
        buildingSlugs = [];
      }
    }

    const results = [];

    if (buildingSlugs.length === 0) {
      buildingSlugs = [null]; // portfolio-level
    }

    for (const slug of buildingSlugs) {
      let facilityId = null;
      let stateCode = null;
      let title = 'SWOT Analysis';

      if (slug) {
        const { data: fac } = await supabase
          .from('facilities')
          .select('facility_id, facility_name, state_code')
          .eq('facility_code', slug)
          .single();
        if (fac) {
          facilityId = fac.facility_id;
          stateCode = fac.state_code;
          title = `SWOT Analysis — ${fac.facility_name}`;
        }
      } else {
        title = 'SWOT Analysis — IHCM Portfolio';
      }

      // Extract the section for this building if multi-building doc
      let sectionContent = textContent;
      if (buildingSlugs.length > 1 && slug) {
        // Try to find a section for this building
        const buildingNames = Object.entries(BUILDING_KEYWORDS)
          .filter(([, s]) => s === slug)
          .map(([k]) => k);
        for (const name of buildingNames) {
          const idx = textContent.toLowerCase().indexOf(name);
          if (idx >= 0) {
            // Find the next building name after this one
            let endIdx = textContent.length;
            for (const [otherName, otherSlug] of Object.entries(BUILDING_KEYWORDS)) {
              if (otherSlug === slug) continue;
              const otherIdx = textContent.toLowerCase().indexOf(otherName, idx + name.length + 50);
              if (otherIdx > 0 && otherIdx < endIdx) endIdx = otherIdx;
            }
            sectionContent = textContent.slice(Math.max(0, idx - 50), endIdx).trim();
            break;
          }
        }
      }

      // Upsert into knowledge_sources
      const citationText = sectionContent.slice(0, 500).replace(/\s+/g, ' ').trim();
      const { createHash } = await import('node:crypto');
      const contentHash = createHash('md5').update(sectionContent).digest('hex');

      const { data, error } = await supabase
        .from('knowledge_sources')
        .upsert({
          title,
          source_type: 'corporate_playbook',
          state_code: stateCode,
          facility_id: facilityId,
          tags: ['swot', 'marketing', 'strategy'],
          status: 'approved', // SWOTs are owner-provided, auto-approve
          effective_date: new Date().toISOString().split('T')[0],
          citation_text: citationText,
          full_content: sectionContent.slice(0, 100000),
          content_hash: contentHash,
        }, {
          onConflict: 'title,source_type,COALESCE(state_code,\'\'),COALESCE(facility_id,\'00000000-0000-0000-0000-000000000000\')',
          ignoreDuplicates: false,
        })
        .select('source_id, title, status')
        .single();

      if (error) {
        // Try insert without upsert if conflict resolution fails
        const { data: inserted, error: insertErr } = await supabase
          .from('knowledge_sources')
          .insert({
            title,
            source_type: 'corporate_playbook',
            state_code: stateCode,
            facility_id: facilityId,
            tags: ['swot', 'marketing', 'strategy'],
            status: 'approved',
            effective_date: new Date().toISOString().split('T')[0],
            citation_text: citationText,
            full_content: sectionContent.slice(0, 100000),
            content_hash: contentHash,
          })
          .select('source_id, title, status')
          .single();

        if (insertErr) {
          results.push({ building: slug || 'portfolio', status: 'error', error: insertErr.message });
          continue;
        }
        results.push({ building: slug || 'portfolio', title, status: 'saved', source_id: inserted?.source_id });
      } else {
        results.push({ building: slug || 'portfolio', title, status: 'saved', source_id: data?.source_id });
      }
    }

    console.log(JSON.stringify({
      event: 'swot_ingested',
      buildings: results.length,
      user: authUser.email,
      timestamp: new Date().toISOString(),
    }));

    return res.status(200).json({ success: true, results });

  } catch (err) {
    console.error('[ingest-swot] Error:', err.message);
    return res.status(500).json({ error: 'SWOT ingestion failed: ' + err.message });
  }
}
