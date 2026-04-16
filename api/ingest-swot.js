// ============================================================================
// SWOT Analysis Ingestion - POST /api/ingest-swot
// ============================================================================
// Accepts SWOT analysis content (text, PDF, Word, Excel, PowerPoint, text)
// and stores it as draft knowledge_sources scoped to the detected building(s).

import { createHash } from 'node:crypto';

import {
  extractTextFromDocument,
  MAX_DOCUMENT_UPLOAD_BYTES,
  parseMultipartForm,
} from './lib/documentUpload.js';
import {
  ApprovedSourceOverwriteError,
  canReviewKnowledge,
  queueKnowledgeReview,
  upsertKnowledgeDraft,
} from './lib/knowledgeGovernance.js';
import { storeKnowledgeAsset } from './lib/knowledgeAssets.js';
import { requireAuth } from './lib/requireAuth.js';

const BUILDING_KEYWORDS = {
  arkadelphia: 'arkadelphia',
  stonegate: 'stonegate',
  glenwood: 'glenwood',
  'the woods': 'thewoods',
  thewoods: 'thewoods',
  crossett: 'crossett',
  marymount: 'marymount',
  'villa at marymount': 'marymount',
  erie: 'erie',
  'nightingale erie': 'erie',
  'nightingale at arkadelphia': 'arkadelphia',
  'nightingale at stonegate': 'stonegate',
  'nightingale at glenwood': 'glenwood',
  'nightingale at crossett': 'crossett',
};

function detectBuildings(text) {
  const found = new Set();
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const isShort = trimmed.length < 100;
    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3;
    const isMarkdownHeading = /^#+\s/.test(trimmed);
    const isLabeledHeader = /^(?:building|facility|location|swot|analysis)\s*[:\-]/i.test(trimmed);

    if (!isShort) continue;

    for (const [keyword, slug] of Object.entries(BUILDING_KEYWORDS)) {
      if (!lower.includes(keyword) || found.has(slug)) continue;

      const nameRatio = keyword.length / trimmed.length;
      const isProminent = nameRatio > 0.25 || isAllCaps || isMarkdownHeading || isLabeledHeader;

      if (isProminent || trimmed.length < 50) {
        found.add(slug);
      }
    }
  }

  return [...found];
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function hasSwotUploadAccess(profile) {
  const allowedRoles = new Set(['super_admin', 'corporate_admin', 'regional_director']);
  const allowedBotRoles = new Set(['marketing', 'admin', 'regional']);
  return allowedRoles.has(profile?.app_role)
    || canReviewKnowledge(profile)
    || (profile?.allowed_bot_roles || []).some((role) => allowedBotRoles.has(role));
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const { user: authUser, profile: authProfile, supabase, supabaseUser } = auth;

  if (!hasSwotUploadAccess(authProfile)) {
    return res.status(403).json({ error: 'SWOT upload requires marketing, admin, regional, or knowledge-review access' });
  }

  try {
    const contentType = req.headers['content-type'] || '';
    let textContent = '';
    let explicitBuildingId = null;
    let fileUpload = null;

    if (contentType.includes('multipart/form-data')) {
      const rawBody = await readRawBody(req);
      const { fields, fileBuffer, fileName, mimeType } = parseMultipartForm(rawBody, contentType);
      explicitBuildingId = fields.building_id || null;

      if (fileBuffer) {
        if (fileBuffer.length > MAX_DOCUMENT_UPLOAD_BYTES) {
          return res.status(413).json({ error: `File too large (max ${MAX_DOCUMENT_UPLOAD_BYTES / 1024 / 1024}MB)` });
        }

        const extracted = await extractTextFromDocument({
          buffer: fileBuffer,
          fileName,
          mimeType,
        });

        textContent = extracted.text || '';
        fileUpload = {
          buffer: fileBuffer,
          fileName,
          mimeType: extracted.normalizedMimeType || mimeType,
          parserUsed: extracted.parser,
        };
      }

      if (!textContent && fields.content) {
        textContent = fields.content;
      }
    } else if (contentType.includes('application/json')) {
      const rawBody = await readRawBody(req);
      try {
        const body = JSON.parse(rawBody.toString('utf8'));
        textContent = body.content || '';
        explicitBuildingId = body.building_id || null;
      } catch {
        textContent = '';
      }
    } else {
      const rawBody = await readRawBody(req);
      textContent = rawBody.toString('utf8');
    }

    if (!textContent || textContent.length < 20) {
      return res.status(400).json({ error: 'No SWOT content provided or extracted' });
    }

    let buildingSlugs = explicitBuildingId ? [explicitBuildingId] : detectBuildings(textContent);
    if (buildingSlugs.length > 3) {
      buildingSlugs = [];
    }

    if (!explicitBuildingId && buildingSlugs.length === 0) {
      const topText = textContent.slice(0, 500).toLowerCase();
      for (const [keyword, slug] of Object.entries(BUILDING_KEYWORDS)) {
        if (topText.includes(keyword)) {
          buildingSlugs = [slug];
          break;
        }
      }
    }

    if (!buildingSlugs.length) {
      buildingSlugs = [null];
    }

    const results = [];

    for (const slug of buildingSlugs) {
      let facilityId = null;
      let stateCode = null;
      let title = 'SWOT Analysis';

      if (slug) {
        const { data: facility } = await supabaseUser
          .from('facilities')
          .select('facility_id, facility_name, state_code')
          .eq('facility_code', slug)
          .maybeSingle();

        if (!facility) {
          results.push({
            building: slug,
            status: 'error',
            error: 'Detected building is unavailable or outside your access scope',
          });
          continue;
        }

        facilityId = facility.facility_id;
        stateCode = facility.state_code;
        title = `SWOT Analysis - ${facility.facility_name}`;
      } else {
        title = 'SWOT Analysis - IHCM Portfolio';
      }

      let sectionContent = textContent;
      if (buildingSlugs.length > 1 && slug) {
        const buildingNames = Object.entries(BUILDING_KEYWORDS)
          .filter(([, value]) => value === slug)
          .map(([keyword]) => keyword);

        for (const name of buildingNames) {
          const lower = textContent.toLowerCase();
          const startIndex = lower.indexOf(name);
          if (startIndex < 0) continue;

          let endIndex = textContent.length;
          for (const [otherName, otherSlug] of Object.entries(BUILDING_KEYWORDS)) {
            if (otherSlug === slug) continue;
            const otherIndex = lower.indexOf(otherName, startIndex + name.length + 25);
            if (otherIndex > 0 && otherIndex < endIndex) endIndex = otherIndex;
          }

          sectionContent = textContent.slice(Math.max(0, startIndex - 50), endIndex).trim();
          break;
        }
      }

      sectionContent = sectionContent.slice(0, 100000);
      const citationText = sectionContent.slice(0, 500).replace(/\s+/g, ' ').trim();
      const contentHash = createHash('md5').update(sectionContent).digest('hex');

      let draftResult;
      try {
        draftResult = await upsertKnowledgeDraft({
          supabase,
          authUser,
          title,
          sourceType: 'corporate_playbook',
          facilityId,
          stateCode,
          region: null,
          tags: ['swot', 'marketing', 'strategy'],
          fullContent: sectionContent,
          citationText,
          contentHash,
          reviewNote: fileUpload
            ? `SWOT upload "${fileUpload.fileName}" submitted by ${authUser.email}`
            : `SWOT content submitted by ${authUser.email}`,
          isReviewer: canReviewKnowledge(authProfile),
        });
      } catch (err) {
        if (err instanceof ApprovedSourceOverwriteError) {
          results.push({
            building: slug || 'portfolio',
            title,
            status: 'blocked_approved',
            approved_source_id: err.sourceId,
            error: err.message,
          });
          continue;
        }
        throw err;
      }

      let asset = null;
      let warning = null;
      if (fileUpload && draftResult.changeType !== 'already_exists') {
        try {
          asset = await storeKnowledgeAsset({
            supabase,
            authUser,
            sourceId: draftResult.source.source_id,
            fileBuffer: fileUpload.buffer,
            fileName: fileUpload.fileName,
            mimeType: fileUpload.mimeType,
            extractedText: sectionContent,
            parserUsed: fileUpload.parserUsed,
          });
        } catch (assetError) {
          warning = assetError.message;
          console.warn('[ingest-swot] Asset storage warning:', assetError.message);
        }
      }

      if (draftResult.changeType === 'already_exists') {
        await queueKnowledgeReview({
          supabase,
          sourceId: draftResult.source.source_id,
          submittedBy: authUser.id,
          note: `SWOT review requested again by ${authUser.email}`,
        });
      }

      results.push({
        building: slug || 'portfolio',
        title,
        status: draftResult.changeType === 'created'
          ? 'queued'
          : draftResult.changeType === 'updated'
            ? 'updated_draft'
            : 'already_exists',
        source_id: draftResult.source.source_id,
        review_status: 'pending',
        asset_id: asset?.asset_id || null,
        warning,
      });
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('[ingest-swot] Error:', err.message);
    return res.status(500).json({ error: `SWOT ingestion failed: ${err.message}` });
  }
}
