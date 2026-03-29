// ============================================================================
// IHCM AI Bot Widget v2 — Context Assembly Pipeline (DEFINITIVE)
// ============================================================================
// Layered context assembly (matches PROMPT_ASSEMBLY_PATTERN.md):
//   1. Global core       — org identity, safety rules, tone
//   2. Role module        — role system prompt, decision framework
//   3. Building profile   — strategic context (if building selected)
//   4. Building snapshot  — operational facts (if available)
//   5. Intelligence       — latest AI-generated insights (if available)
//   6. Workflow contract   — output rules for the active workflow/draft mode
//   7. User conversation  — the actual messages
//
// This file is the Vercel serverless function: POST /api/chat
//
// Data sources:
//   Production → Supabase (v_bot_building_context view in public schema)
//   Dev/offline → static fallbacks from src/bots.js, src/buildings.js, src/workflows.js
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { getRoleById } from '../src/bots.js';
import { getBuildingById, getBuildingProfile } from '../src/buildings.js';
import { getWorkflowById } from '../src/workflows.js';

// ── Configuration ──

const ALLOWED_ORIGINS = [
  'https://ihcm-bots.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
];

const MAX_BODY_SIZE = 256 * 1024;   // 256 KB (need room for document context)
const MAX_MESSAGE_LENGTH = 4000;    // per-message char limit (down from 8000)
const MAX_MESSAGES = 10;            // context window size (down from 20)
const MAX_DOCUMENT_CONTEXT = 30000; // document context char limit (down from 60000)
const MAX_HISTORY_CONTEXT = 5000;   // building history char limit (down from 10000)
const CHAT_MAX_TOKENS = 2000;
const DRAFT_MAX_TOKENS = 4096;
const MODEL = 'claude-sonnet-4-20250514';

// ── Supabase client (optional — gracefully falls back to static data) ──

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;


// ════════════════════════════════════════════════════════════════════════════
// GLOBAL CORE LAYER
// ════════════════════════════════════════════════════════════════════════════
// In production, fetched from ihcm_bot.global_core table (sorted by sort_order).
// Static fallback for launch.

const GLOBAL_CORE = `
You are an AI assistant for Independence Healthcare Management (IHCM), a skilled nursing facility operator with 7 buildings across Arkansas, Ohio, and Pennsylvania.

IDENTITY
- You serve IHCM's clinical and administrative teams
- You know IHCM's 2026 organizational goals, building portfolio, and operational context
- You speak with authority on SNF operations, but you are not a substitute for legal counsel, medical professionals, or regulatory experts

SAFETY RULES
- NEVER include resident names, dates of birth, Social Security numbers, or any protected health information (PHI) in your responses
- If the user includes PHI in their message, acknowledge it but do not repeat it in your response. Refer to residents by role, room number, or initials only.
- When asked about specific regulatory citations, billing codes, or clinical rules, provide your best guidance but always note that the user should verify against current CMS/state sources
- NEVER invent regulatory citations, dollar amounts, census figures, or clinical data. If you do not have the information, say so clearly.
- Label any assumptions with [ASSUMED — verify before use]

DRAFTING RULES
- Before drafting any document, check if you have the key facts needed. If critical facts are missing, ask 2-4 targeted follow-up questions instead of proceeding with assumptions.
- End every draft-mode output with: "This is an AI-generated draft. Review all facts, names, dates, and regulatory references before use."
- For topics involving litigation, HIPAA breach response, termination, or abuse/neglect reporting, always include: "This topic may require legal review. Consult your compliance officer or legal counsel before submitting."
- If you cannot reliably produce the requested content, say "I don't have enough information to draft this reliably" and explain what you need.

TONE
- Professional but approachable
- Specific and actionable — avoid generic advice
- When in doubt, ask rather than assume
- Frame answers in terms the user's role understands

BUILDING-AWARE RULES
- If a building is selected, answer from that building's context first
- If no building is selected, answer generally and note what would change per building
- Do not fabricate building-specific facts — if the data is missing, say so
`.trim();


// ════════════════════════════════════════════════════════════════════════════
// CONTEXT ASSEMBLY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Assemble the full system prompt from layered context.
 *
 * @param {object} params
 * @param {string} params.roleId
 * @param {string|null} params.buildingId
 * @param {boolean} params.isDraft
 * @param {string|null} params.workflowId
 * @param {object|null} params.buildingContext - from ihcm_bot.v_building_context
 * @param {string|null} params.documentContext - uploaded document text (e.g. parsed 2567 citations)
 * @param {string|null} params.historyContext - building history text (surveys + events)
 * @returns {string} assembled system prompt
 */
function assembleSystemPrompt({ roleId, buildingId, isDraft, workflowId, buildingContext, documentContext, historyContext, knowledgeContext }) {
  const layers = [];

  // Layer 1: Global core
  layers.push(GLOBAL_CORE);

  // Layer 2: Role module
  const role = getRoleById(roleId);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  layers.push(role.systemPrompt);

  // Layer 3: Building profile (from Supabase context or static fallback)
  if (buildingId && buildingId !== 'none') {
    const ctx = buildingContext || buildBuildingContextFallback(buildingId);
    if (ctx) {
      layers.push(formatBuildingProfile(ctx));
    }
  }

  // Layer 4: Building snapshot (operational facts)
  if (buildingContext?.census != null || buildingContext?.snapshot_date) {
    layers.push(formatBuildingSnapshot(buildingContext));
  }

  // Layer 5: Intelligence (latest AI-generated insights)
  if (buildingContext?.intel_headline) {
    layers.push(formatIntelligence(buildingContext));
  }

  // Layer 5b: Building history (from client localStorage)
  if (historyContext) {
    layers.push(historyContext);
  }

  // Layer 5c: Knowledge sources (governed content from Supabase)
  if (knowledgeContext) {
    layers.push(`KNOWLEDGE BASE\nThe following governed reference content is available. Use it to ground your answers in verified organizational knowledge.\n\n${knowledgeContext}`);
  }

  // Layer 5d: Uploaded document context (parsed 2567 citations, etc.)
  if (documentContext) {
    layers.push(`UPLOADED DOCUMENT CONTEXT\nThe user has uploaded a survey document. Use this data to give specific, citation-level guidance.\n\n${documentContext}`);
  }

  // Layer 6: Workflow contract OR mode suffix
  if (workflowId) {
    const workflow = getWorkflowById(workflowId);
    if (workflow) {
      layers.push(formatWorkflowContract(workflow));
    }
  } else if (isDraft) {
    layers.push(DRAFT_SUFFIX);
  } else {
    layers.push(CHAT_SUFFIX);
  }

  return layers.join('\n\n---\n\n');
}


// ════════════════════════════════════════════════════════════════════════════
// FORMATTERS — one per context layer
// ════════════════════════════════════════════════════════════════════════════

function formatBuildingProfile(ctx) {
  const parts = [
    `ACTIVE BUILDING CONTEXT — ${ctx.label || ctx.building_label || ctx.short_name} (${ctx.state}) | CMS ID: ${ctx.cms_id || 'N/A'}`,
  ];

  if (ctx.bed_capacity) parts.push(`Bed Capacity: ${ctx.bed_capacity}`);
  if (ctx.market_type) parts.push(`Market Type: ${ctx.market_type}`);
  if (ctx.strategic_status) parts.push(`Strategic Status: ${ctx.strategic_status.toUpperCase()}`);
  if (ctx.strategic_label) parts.push(`Strategic Label: ${ctx.strategic_label}`);

  // Profile fields (from building_profiles)
  if (ctx.payer_context) parts.push(`Payer Context: ${ctx.payer_context}`);
  if (ctx.market_summary) parts.push(`Market Summary: ${ctx.market_summary}`);
  if (ctx.referral_summary) parts.push(`Referral Sources: ${ctx.referral_summary}`);
  if (ctx.physician_relationships) parts.push(`Physician Relationships: ${ctx.physician_relationships}`);
  if (ctx.hospital_partners) parts.push(`Hospital Partners: ${ctx.hospital_partners}`);
  if (ctx.survey_context) parts.push(`Survey Context: ${ctx.survey_context}`);
  if (ctx.staffing_context) parts.push(`Staffing Context: ${ctx.staffing_context}`);
  if (ctx.reimbursement_context) parts.push(`Reimbursement Context: ${ctx.reimbursement_context}`);
  if (ctx.risk_watchlist) parts.push(`Risk Watchlist: ${ctx.risk_watchlist}`);
  if (ctx.strategic_notes) parts.push(`Strategic Notes: ${ctx.strategic_notes}`);

  // JSONB arrays
  if (ctx.growth_barriers?.length) parts.push(`Growth Barriers: ${JSON.stringify(ctx.growth_barriers)}`);
  if (ctx.growth_opportunities?.length) parts.push(`Growth Opportunities: ${JSON.stringify(ctx.growth_opportunities)}`);

  // Profile freshness
  if (ctx.profile_updated_at) {
    const daysOld = daysSince(ctx.profile_updated_at);
    if (daysOld > 90) {
      parts.push(`WARNING: Building profile last updated ${daysOld} days ago. Strategic context may be outdated.`);
    }
  }

  return parts.join('\n');
}

function formatBuildingSnapshot(ctx) {
  const parts = ['CURRENT BUILDING SNAPSHOT'];

  if (ctx.snapshot_date) parts.push(`Snapshot Date: ${ctx.snapshot_date}`);
  if (ctx.census != null) parts.push(`Census: ${ctx.census}`);
  if (ctx.occupancy_gap != null) parts.push(`Occupancy Gap: ${ctx.occupancy_gap} beds below capacity`);
  if (ctx.skilled_mix_pct != null) parts.push(`Skilled Mix: ${ctx.skilled_mix_pct}%`);
  if (ctx.medicare_pct != null) parts.push(`Medicare: ${ctx.medicare_pct}%`);
  if (ctx.medicaid_pct != null) parts.push(`Medicaid: ${ctx.medicaid_pct}%`);
  if (ctx.managed_care_pct != null) parts.push(`Managed Care: ${ctx.managed_care_pct}%`);
  if (ctx.referral_pressure) parts.push(`Referral Pressure: ${ctx.referral_pressure}`);
  if (ctx.survey_risk_level) parts.push(`Survey Risk: ${ctx.survey_risk_level}`);
  if (ctx.staffing_risk_level) parts.push(`Staffing Risk: ${ctx.staffing_risk_level}`);
  if (ctx.reimbursement_risk_level) parts.push(`Reimbursement Risk: ${ctx.reimbursement_risk_level}`);
  if (ctx.ar_issues) parts.push(`AR Issues: ${ctx.ar_issues}`);
  if (ctx.top_priorities?.length) parts.push(`Top Priorities: ${ctx.top_priorities.join(', ')}`);

  // Snapshot freshness
  if (ctx.snapshot_updated_at) {
    const daysOld = daysSince(ctx.snapshot_updated_at);
    if (daysOld > 30) {
      parts.push(`WARNING: Snapshot data is ${daysOld} days old. Verify current figures before using in any document.`);
    }
  }

  return parts.join('\n');
}

function formatIntelligence(ctx) {
  const parts = ['LATEST BUILDING INTELLIGENCE'];
  if (ctx.intel_headline) parts.push(`Headline: ${ctx.intel_headline}`);
  if (ctx.intel_summary) parts.push(`Summary: ${ctx.intel_summary}`);
  if (ctx.intel_kind) parts.push(`Type: ${ctx.intel_kind}`);
  if (ctx.intel_risks?.length) parts.push(`Top Risks: ${JSON.stringify(ctx.intel_risks)}`);
  if (ctx.intel_opportunities?.length) parts.push(`Top Opportunities: ${JSON.stringify(ctx.intel_opportunities)}`);
  if (ctx.intel_actions?.length) parts.push(`Recommended Actions: ${JSON.stringify(ctx.intel_actions)}`);
  if (ctx.intel_narrative) parts.push(`\n${ctx.intel_narrative}`);
  if (ctx.intel_freshness) parts.push(`Intelligence Freshness: ${ctx.intel_freshness}`);
  return parts.join('\n');
}

function formatWorkflowContract(workflow) {
  const parts = [
    `WORKFLOW: ${workflow.label}`,
    `${workflow.description}`,
    '',
    'REQUIRED OUTPUT SECTIONS:',
    ...workflow.outputSections.map((s, i) => `${i + 1}. ${s}`),
    '',
    'REVIEW CHECKLIST (include at the end of the document):',
    ...workflow.reviewChecklist.map(c => `- ${c}`),
    '',
    'OUTPUT FORMAT — DRAFT MODE ACTIVE: respond as a structured, professional document with section headings, numbered steps where appropriate, and formal language.',
    '',
    'End with: "This is an AI-generated draft. Review all facts, names, dates, and regulatory references before use."',
  ];
  return parts.join('\n');
}


// ════════════════════════════════════════════════════════════════════════════
// MODE SUFFIXES (fallback when no workflow is active)
// ════════════════════════════════════════════════════════════════════════════

const CHAT_SUFFIX = `
OUTPUT FORMAT — CHAT MODE: Respond conversationally and concisely. Use bullet points for lists. Keep answers focused and actionable. If the question is vague, ask a clarifying question before giving generic advice.
`.trim();

const DRAFT_SUFFIX = `
OUTPUT FORMAT — DRAFT MODE ACTIVE: Respond as a structured, professional document with section headings, numbered steps where appropriate, and formal language. Use a format appropriate to the document type being requested.

Before drafting, verify you have the necessary facts. If critical information is missing, ask for it first.

End with: "This is an AI-generated draft. Review all facts, names, dates, and regulatory references before use."
`.trim();


// ════════════════════════════════════════════════════════════════════════════
// DATA FETCHING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fetch building context from Supabase (profile + snapshot + intelligence).
 * Returns null if Supabase is not connected or query fails.
 */
async function fetchBuildingContext(buildingSlug) {
  if (!supabase || !buildingSlug || buildingSlug === 'none') return null;

  try {
    const { data, error } = await supabase
      .from('v_bot_building_context')
      .select('*')
      .eq('slug', buildingSlug)
      .single();

    if (error) {
      console.warn('Supabase building context fetch failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase connection error:', err.message);
    return null;
  }
}


/**
 * Fetch relevant knowledge sources for the current role and building.
 * Returns a formatted text block, or null if none found.
 */
async function fetchKnowledgeContext(roleId, facilityId, stateCode) {
  if (!supabase) return null;

  try {
    // Map roles to relevant source types
    const roleSourceTypes = {
      don: ['corporate_playbook', 'survey_template', 'operator_practice'],
      mds: ['corporate_playbook', 'payer_guidance', 'state_reimbursement'],
      billing: ['payer_guidance', 'state_reimbursement'],
      admin: ['corporate_playbook', 'operator_practice', 'referral_intelligence'],
      regional: ['corporate_playbook', 'operator_practice', 'state_reimbursement', 'referral_intelligence'],
    };

    const types = roleSourceTypes[roleId] || ['corporate_playbook', 'operator_practice'];

    const collected = [];
    const seenSourceIds = new Set();

    const collectSources = (rows) => {
      for (const row of rows || []) {
        if (!row?.source_id || seenSourceIds.has(row.source_id)) continue;
        seenSourceIds.add(row.source_id);
        collected.push(row);
      }
    };

    if (facilityId) {
      const { data: facilitySources, error: facilityError } = await supabase
        .from('knowledge_sources')
        .select('source_id, title, source_type, citation_text, full_content, state_code, facility_id, tags')
        .eq('status', 'approved')
        .eq('facility_id', facilityId)
        .in('source_type', types)
        .order('updated_at', { ascending: false })
        .limit(3);

      if (facilityError) return null;
      collectSources(facilitySources);
    }

    let scopeQuery = supabase
      .from('knowledge_sources')
      .select('source_id, title, source_type, citation_text, full_content, state_code, facility_id, tags')
      .eq('status', 'approved')
      .is('facility_id', null)
      .in('source_type', types)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (stateCode) {
      scopeQuery = scopeQuery.or(`state_code.eq.${stateCode},state_code.is.null`);
    } else {
      scopeQuery = scopeQuery.is('state_code', null);
    }

    const { data: scopedSources, error: scopeError } = await scopeQuery;
    if (scopeError) return null;
    collectSources(scopedSources);

    if (!collected.length) return null;

    // Format knowledge sources into context block (max 15K chars total)
    const parts = [];
    let totalLen = 0;
    const MAX_KNOWLEDGE = 15000;

    for (const source of collected) {
      const content = source.full_content || source.citation_text || '';
      const scopeLabel = source.facility_id ? 'facility' : (source.state_code || 'portfolio');
      const chunk = `=== ${source.title} (${source.source_type}, ${scopeLabel}) ===\n${content.slice(0, 3000)}`;
      if (totalLen + chunk.length > MAX_KNOWLEDGE) break;
      parts.push(chunk);
      totalLen += chunk.length;
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  } catch (err) {
    console.warn('Knowledge fetch error:', err.message);
    return null;
  }
}

/**
 * Static fallback when Supabase is not connected.
 */
function buildBuildingContextFallback(buildingId) {
  const building = getBuildingById(buildingId);
  if (!building || building.id === 'none') return null;

  const profile = getBuildingProfile(buildingId);

  return {
    label: building.label,
    short_name: building.shortName,
    state: building.state,
    cms_id: building.cmsId,
    bed_capacity: building.bedCapacity,
    market_type: building.marketType,
    strategic_status: building.strategicStatus,
    strategic_label: building.strategicLabel,
    // Profile fields (snake_case to match Supabase column names)
    payer_context: profile?.payerContext || null,
    market_summary: profile?.marketSummary || null,
    referral_summary: profile?.referralSummary || null,
    physician_relationships: profile?.physicianRelationships || null,
    hospital_partners: profile?.hospitalPartners || null,
    growth_barriers: profile?.growthBarriers || null,
    growth_opportunities: profile?.growthOpportunities || null,
    survey_context: profile?.surveyContext || null,
    staffing_context: profile?.staffingContext || null,
    reimbursement_context: profile?.reimbursementContext || null,
    risk_watchlist: profile?.riskWatchlist || null,
    strategic_notes: profile?.strategicNotes || null,
  };
}


// ════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function daysSince(dateString) {
  const then = new Date(dateString);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function sanitizeMessages(messages) {
  const filtered = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }));

  // If conversation exceeds window, prepend a summary of older exchanges
  if (filtered.length > MAX_MESSAGES) {
    const older = filtered.slice(0, filtered.length - MAX_MESSAGES);

    // Summarize both user asks AND assistant commitments
    const userSummary = older
      .filter(m => m.role === 'user')
      .map(m => m.content.slice(0, 100))
      .join('; ');
    const assistantSummary = older
      .filter(m => m.role === 'assistant')
      .map(m => {
        // Extract key commitments: section headers, action items, caveats
        const lines = m.content.split('\n');
        const keyLines = lines
          .filter(l => l.startsWith('##') || l.startsWith('- ') || l.includes('ASSUMED') || l.includes('verify'))
          .slice(0, 3)
          .map(l => l.replace(/^##\s*/, '').replace(/^-\s*/, '').trim());
        return keyLines.length > 0 ? keyLines.join('; ') : m.content.slice(0, 80);
      })
      .join('; ');

    const window = filtered.slice(-MAX_MESSAGES);
    const summaryParts = [];
    if (userSummary) summaryParts.push(`User asked about: ${userSummary.slice(0, 400)}`);
    if (assistantSummary) summaryParts.push(`Assistant covered: ${assistantSummary.slice(0, 400)}`);

    if (summaryParts.length > 0 && window.length > 0) {
      window.unshift({
        role: 'user',
        content: `[Earlier in this conversation — ${summaryParts.join('. ')}]`,
      });
    }
    return window;
  }

  return filtered;
}


// ════════════════════════════════════════════════════════════════════════════
// CORS
// ════════════════════════════════════════════════════════════════════════════

function getCorsHeaders(origin) {
  const isAllowed = ALLOWED_ORIGINS.includes(origin)
    || (origin && origin.endsWith('.vercel.app'));
  if (isAllowed) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
  return {};
}


// ════════════════════════════════════════════════════════════════════════════
// RATE LIMITING — Upstash Redis (shared across Vercel instances)
// ════════════════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — POST /api/chat
// ════════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const cors = getCorsHeaders(origin);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit check (Upstash Redis — shared across Vercel instances)
  const { getChatLimiter, checkRateLimit } = await import('../../api/lib/rateLimit.js');
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';
  const rateLimitResult = await checkRateLimit(getChatLimiter(), clientIp);
  if (!rateLimitResult.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  // Request size check
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    console.error(JSON.stringify({
      event: 'request_rejected',
      reason: 'body_too_large',
      size: contentLength,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      timestamp: new Date().toISOString(),
    }));
    return res.status(413).json({ error: 'Request body too large' });
  }

  try {
    // ── Auth check ──
    const { requireAuth } = await import('../../api/lib/requireAuth.js');
    const auth = await requireAuth(req);
    if (!auth) {
      return res.status(401).json({ error: 'Unauthorized — valid session required' });
    }
    const { user: authUser, profile: authProfile } = auth;

    const { botId, buildingId, isDraft, messages, workflowId, documentContext, historyContext } = req.body;
    const userName = authProfile.full_name || authUser.email;
    const requestId = crypto.randomUUID?.() || `req_${Date.now()}`;

    // Validate botId
    const role = getRoleById(botId);
    if (!role) {
      return res.status(400).json({ error: `Unknown bot: ${botId}` });
    }

    // Enforce role authorization: user must have this bot role
    const allowedRoles = Array.isArray(authProfile.allowed_bot_roles) ? authProfile.allowed_bot_roles : [];
    const isSuperAdmin = authProfile.app_role === 'super_admin';
    if (!isSuperAdmin && (allowedRoles.length === 0 || !allowedRoles.includes(botId))) {
      return res.status(403).json({ error: `You do not have access to the ${botId} role` });
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const sanitized = sanitizeMessages(messages);
    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    // ── Fetch context layers ──
    const buildingContext = await fetchBuildingContext(buildingId);
    const stateCode = buildingContext?.state || null;
    const facilityId = buildingContext?.facility_id || null;
    const knowledgeContext = await fetchKnowledgeContext(botId, facilityId, stateCode);

    // ── Assemble system prompt ──
    const systemPrompt = assembleSystemPrompt({
      roleId: botId,
      buildingId: buildingId || null,
      isDraft: isDraft || false,
      workflowId: workflowId || null,
      buildingContext,
      knowledgeContext,
      documentContext: typeof documentContext === 'string' ? documentContext.slice(0, MAX_DOCUMENT_CONTEXT) : null,
      historyContext: typeof historyContext === 'string' ? historyContext.slice(0, MAX_HISTORY_CONTEXT) : null,
    });

    // ── Call Anthropic ──
    const startTime = Date.now();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: (isDraft || workflowId) ? DRAFT_MAX_TOKENS : CHAT_MAX_TOKENS,
      system: systemPrompt,
      messages: sanitized,
    });

    const reply = response.content[0]?.text || '';
    const latency = Date.now() - startTime;

    // ── Structured logging ──
    console.log(JSON.stringify({
      event: 'chat_response',
      requestId,
      botId,
      buildingId: buildingId || null,
      isDraft: isDraft || false,
      workflowId: workflowId || null,
      messageCount: sanitized.length,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
      latencyMs: latency,
      userName: userName || null,
      supabaseConnected: !!supabase,
      hasBuildingContext: !!buildingContext,
      timestamp: new Date().toISOString(),
      // NEVER log message content or API key
    }));

    // ── Persist conversation server-side (best-effort) ──
    let conversationId = req.body.conversationId || null;
    try {
      if (supabase && authUser) {
        const userId = authUser.id;
        if (userId) {
          // Resolve building slug to facility UUID for FK
          let facilityId = null;
          if (buildingId && buildingId !== 'none') {
            const { data: fac } = await supabase
              .from('facilities')
              .select('facility_id')
              .eq('facility_code', buildingId)
              .single();
            facilityId = fac?.facility_id || null;
          }

          // Create or reuse conversation
          if (!conversationId) {
            const { data: conv } = await supabase
              .from('conversations')
              .insert({
                user_id: userId,
                facility_id: facilityId,
                bot_id: botId || null,
                workflow_type: workflowId || null,
                title: sanitized[0]?.content?.slice(0, 100) || 'New conversation',
                status: 'active',
              })
              .select('conversation_id')
              .single();
            conversationId = conv?.conversation_id || null;
          }

          // Insert user message + assistant reply
          if (conversationId) {
            const lastUserMsg = sanitized[sanitized.length - 1];
            await supabase.from('conversation_messages').insert([
              {
                conversation_id: conversationId,
                role: 'user',
                content: lastUserMsg.content,
              },
              {
                conversation_id: conversationId,
                role: 'assistant',
                content: reply,
                model_used: MODEL,
                token_count: response.usage?.output_tokens || null,
              },
            ]);
          }
        }
      }
    } catch (persistErr) {
      console.warn('[chat] Conversation persistence failed (non-blocking):', persistErr.message);
    }

    return res.status(200).json({ reply, conversationId });

  } catch (err) {
    console.error(JSON.stringify({
      event: 'chat_error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
}
