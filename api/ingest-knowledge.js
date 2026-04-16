// ============================================================================
// Knowledge Ingestion - GET/POST/PATCH /api/ingest-knowledge
// ============================================================================
// Supports:
//   - JSON text submission
//   - multipart document upload (.pdf, .docx, .xlsx, .pptx, .txt, .csv)
//   - governed review flow for every uploaded knowledge source

import { createHash } from 'node:crypto';

import {
  extractTextFromDocument,
  MAX_DOCUMENT_UPLOAD_BYTES,
  parseMultipartForm,
} from './lib/documentUpload.js';
import {
  ApprovedSourceOverwriteError,
  canApproveKnowledgeSource,
  canReviewKnowledge,
  canSubmitKnowledge,
  resolveKnowledgeScope,
  syncKnowledgeReviewDecision,
  upsertKnowledgeDraft,
} from './lib/knowledgeGovernance.js';
import { storeKnowledgeAsset } from './lib/knowledgeAssets.js';
import { requireAuth } from './lib/requireAuth.js';

const MAX_CONTENT_LENGTH = 100000;
const VALID_SOURCE_TYPES = [
  'corporate_playbook',
  'state_reimbursement',
  'payer_guidance',
  'survey_template',
  'referral_intelligence',
  'operator_practice',
  'faq',
  'workflow_template',
  'other',
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function normalizeTags(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((tag) => String(tag || '').trim()).filter(Boolean))];
  }

  if (typeof input === 'string') {
    return [...new Set(
      input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )];
  }

  return [];
}

async function parseKnowledgePost(req) {
  const contentType = req.headers['content-type'] || '';
  let payload = {
    title: '',
    source_type: '',
    content: '',
    state_code: '',
    facility_id: '',
    building_id: '',
    tags: [],
    url: '',
    region: '',
  };
  let fileUpload = null;

  if (contentType.includes('multipart/form-data')) {
    const rawBody = await readRawBody(req);
    const { fields, fileBuffer, fileName, mimeType } = parseMultipartForm(rawBody, contentType);

    payload = {
      title: fields.title || '',
      source_type: fields.source_type || '',
      content: fields.content || '',
      state_code: fields.state_code || '',
      facility_id: fields.facility_id || '',
      building_id: fields.building_id || '',
      tags: normalizeTags(fields.tags),
      url: fields.url || '',
      region: fields.region || '',
    };

    if (fileBuffer) {
      fileUpload = {
        buffer: fileBuffer,
        fileName: fileName || 'upload',
        mimeType,
      };
    }
  } else if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    payload = {
      title: req.body.title || '',
      source_type: req.body.source_type || '',
      content: req.body.content || '',
      state_code: req.body.state_code || '',
      facility_id: req.body.facility_id || '',
      building_id: req.body.building_id || '',
      tags: normalizeTags(req.body.tags),
      url: req.body.url || '',
      region: req.body.region || '',
    };
  } else {
    const rawBody = await readRawBody(req);
    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawBody.toString('utf8'));
        payload = {
          title: body.title || '',
          source_type: body.source_type || '',
          content: body.content || '',
          state_code: body.state_code || '',
          facility_id: body.facility_id || '',
          building_id: body.building_id || '',
          tags: normalizeTags(body.tags),
          url: body.url || '',
          region: body.region || '',
        };
      } catch {
        payload = { ...payload };
      }
    }
  }

  return { contentType, payload, fileUpload };
}

async function maybeFetchUrlContent(url) {
  if (!url) return '';

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only https URLs are allowed');
  }

  const response = await fetch(parsedUrl, {
    headers: { 'User-Agent': 'IHCM-Bot-Knowledge-Ingestion/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
  }

  const html = await response.text();
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user: authUser, profile, supabase, supabaseUser } = auth;

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const sourceType = url.searchParams.get('type');
    const stateCode = url.searchParams.get('state');
    const statusFilter = url.searchParams.get('status');

    let query = supabaseUser
      .from('knowledge_sources')
      .select('source_id, title, source_type, state_code, facility_id, tags, status, effective_date, review_due_date, approved_at, updated_at, citation_text, current_version, approver_user_id, owner_user_id')
      .order('updated_at', { ascending: false })
      .limit(50);

    if (sourceType) query = query.eq('source_type', sourceType);
    if (stateCode) query = query.eq('state_code', stateCode);
    if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ sources: data || [] });
  }

  if (req.method === 'PATCH') {
    if (!canReviewKnowledge(profile)) {
      return res.status(403).json({ error: 'Only knowledge reviewers can approve or archive knowledge sources' });
    }

    const { source_id: sourceId, status: newStatus } = req.body || {};
    if (!sourceId) return res.status(400).json({ error: 'source_id is required' });
    if (!['approved', 'archived', 'in_review', 'draft'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status. Use: approved, archived, in_review, draft' });
    }

    const { data: current, error: currentError } = await supabase
      .from('knowledge_sources')
      .select('source_id, title, full_content, current_version, status, facility_id')
      .eq('source_id', sourceId)
      .single();

    if (currentError || !current) {
      return res.status(404).json({ error: 'Knowledge source not found' });
    }

    const approvalAllowed = await canApproveKnowledgeSource({
      supabaseUser,
      profile,
      source: current,
    });
    if (!approvalAllowed) {
      return res.status(403).json({
        error: current.facility_id
          ? 'You can only review knowledge sources for facilities you have access to'
          : 'Only portfolio-level reviewers can approve organization-wide knowledge sources',
      });
    }

    let nextVersion = current.current_version || 1;
    if (newStatus === 'approved' && current.status !== 'approved') {
      nextVersion += 1;
      const { error: versionError } = await supabase
        .from('knowledge_versions')
        .insert({
          source_id: sourceId,
          version_number: nextVersion,
          content_snapshot: current.full_content?.slice(0, 50000) || '',
          changed_by: authUser.id,
          change_summary: `Status changed to ${newStatus} by ${authUser.email}`,
        });

      if (versionError) {
        return res.status(500).json({ error: `Failed to create knowledge version audit trail: ${versionError.message}` });
      }
    }

    const updatePayload = {
      status: newStatus,
      approver_user_id: newStatus === 'approved' ? authUser.id : null,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
    };

    if (newStatus === 'approved' && current.status !== 'approved') {
      updatePayload.current_version = nextVersion;
    }

    const { data, error } = await supabase
      .from('knowledge_sources')
      .update(updatePayload)
      .eq('source_id', sourceId)
      .select('source_id, title, status, current_version, approver_user_id, approved_at')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    try {
      await syncKnowledgeReviewDecision({
        supabase,
        sourceId,
        reviewerId: authUser.id,
        sourceStatus: newStatus,
        note: `Knowledge source marked ${newStatus} by ${authUser.email}`,
      });
    } catch (queueError) {
      console.warn('[ingest-knowledge] Review queue sync failed:', queueError.message);
    }

    return res.status(200).json({ success: true, source: data });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!canSubmitKnowledge(profile)) {
    return res.status(403).json({ error: 'Your account does not have permission to submit knowledge uploads' });
  }

  try {
    const { payload, fileUpload } = await parseKnowledgePost(req);
    const title = String(payload.title || '').trim();
    const sourceType = String(payload.source_type || '').trim();
    const stateCode = String(payload.state_code || '').trim().toUpperCase() || null;
    const region = String(payload.region || '').trim() || null;

    if (!title || !sourceType) {
      return res.status(400).json({ error: 'title and source_type are required' });
    }
    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return res.status(400).json({ error: `Invalid source_type. Valid: ${VALID_SOURCE_TYPES.join(', ')}` });
    }

    const scope = await resolveKnowledgeScope({
      supabaseUser,
      buildingId: payload.building_id || null,
      facilityId: payload.facility_id || null,
      stateCode,
    });

    let fullContent = String(payload.content || '').trim();
    let parserUsed = null;
    let normalizedMimeType = null;
    let assetWarning = null;

    if (fileUpload) {
      if (fileUpload.buffer.length > MAX_DOCUMENT_UPLOAD_BYTES) {
        return res.status(413).json({ error: `File too large (max ${MAX_DOCUMENT_UPLOAD_BYTES / 1024 / 1024}MB)` });
      }

      const extracted = await extractTextFromDocument({
        buffer: fileUpload.buffer,
        fileName: fileUpload.fileName,
        mimeType: fileUpload.mimeType,
      });
      fullContent = extracted.text || '';
      parserUsed = extracted.parser;
      normalizedMimeType = extracted.normalizedMimeType;
    } else if (payload.url && !fullContent) {
      fullContent = await maybeFetchUrlContent(payload.url);
    }

    if (!fullContent || fullContent.length < 10) {
      return res.status(400).json({ error: 'No document content could be extracted. Try a text-based PDF/Office file or paste the content directly.' });
    }

    fullContent = fullContent.slice(0, MAX_CONTENT_LENGTH);
    const citationText = fullContent.slice(0, 500).replace(/\s+/g, ' ').trim();
    const contentHash = createHash('md5').update(fullContent).digest('hex');

    const noteBase = fileUpload
      ? `Uploaded file "${fileUpload.fileName}" submitted by ${authUser.email}`
      : `Knowledge source submitted by ${authUser.email}`;

    const result = await upsertKnowledgeDraft({
      supabase,
      authUser,
      title,
      sourceType,
      facilityId: scope.facilityId,
      stateCode: scope.stateCode,
      region,
      tags: payload.tags,
      fullContent,
      citationText,
      contentHash,
      reviewNote: noteBase,
      isReviewer: canReviewKnowledge(profile),
    });

    let asset = null;
    if (fileUpload) {
      try {
        asset = await storeKnowledgeAsset({
          supabase,
          authUser,
          sourceId: result.source.source_id,
          fileBuffer: fileUpload.buffer,
          fileName: fileUpload.fileName,
          mimeType: normalizedMimeType || fileUpload.mimeType,
          extractedText: fullContent,
          parserUsed,
        });
      } catch (assetError) {
        assetWarning = assetError.message;
        console.warn('[ingest-knowledge] Asset storage warning:', assetError.message);
      }
    }

    return res.status(200).json({
      success: true,
      source: result.source,
      change_type: result.changeType,
      review_status: 'pending',
      review_queued: result.reviewQueued,
      asset,
      warning: assetWarning,
    });
  } catch (err) {
    if (err instanceof ApprovedSourceOverwriteError) {
      return res.status(409).json({
        error: err.message,
        code: err.code,
        approved_source_id: err.sourceId,
      });
    }
    console.error('[ingest-knowledge] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
