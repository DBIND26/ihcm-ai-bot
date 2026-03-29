// ============================================================================
// IHCM AI Bot Widget v2 — Context Assembly Pipeline (api/chat.js)
// ============================================================================
// Layered context assembly:
//   1. Global core      — org identity, safety rules, tone
//   2. Role module       — role system prompt, decision framework
//   3. Building profile  — strategic context (if building selected)
//   4. Intelligence      — latest AI-generated insights (if available)
//   5. Workflow contract  — output rules for the active workflow/draft mode
//   6. User conversation — the actual messages
//
// This file is the Vercel serverless function that handles POST /api/chat.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { ROLES, getRoleById } from '../src_v2/bots.js';
import { BUILDINGS, getBuildingById } from '../src_v2/buildings.js';
import { getWorkflowById } from '../src_v2/workflows.js';

// ── Configuration ──

const ALLOWED_ORIGINS = [
  'https://ihcm-bots.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const MAX_BODY_SIZE = 32 * 1024;    // 32 KB
const MAX_MESSAGE_LENGTH = 8000;
const MAX_MESSAGES = 20;
const CHAT_MAX_TOKENS = 1000;
const DRAFT_MAX_TOKENS = 2000;
const MODEL = 'claude-sonnet-4-20250514';


// ── Global Core Layer ──
// In production, fetch from the global_core Supabase table.
// Static fallback for v2 launch.

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
`.trim();


// ── Context Assembly ──

/**
 * Assemble the full system prompt from layered context.
 *
 * Order: global core → role → building profile → intelligence → workflow/mode
 *
 * @param {object} params
 * @param {string} params.roleId
 * @param {string|null} params.buildingId
 * @param {boolean} params.isDraft
 * @param {string|null} params.workflowId
 * @param {object|null} params.buildingContext - from Supabase v_building_context view
 * @returns {string} assembled system prompt
 */
function assembleSystemPrompt({ roleId, buildingId, isDraft, workflowId, buildingContext }) {
  const layers = [];

  // Layer 1: Global core
  layers.push(GLOBAL_CORE);

  // Layer 2: Role module
  const role = getRoleById(roleId);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  layers.push(role.systemPrompt);

  // Layer 3: Building context (profile + snapshot)
  if (buildingId && buildingId !== 'none') {
    const ctx = buildingContext || buildBuildingContextFallback(buildingId);
    if (ctx) {
      layers.push(formatBuildingContext(ctx));
    }
  }

  // Layer 4: Intelligence (latest insights)
  if (buildingContext?.intel_headline) {
    layers.push(formatIntelligence(buildingContext));
  }

  // Layer 5: Workflow contract OR mode suffix
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


// ── Building Context Formatter ──

function formatBuildingContext(ctx) {
  const parts = [`ACTIVE BUILDING CONTEXT — ${ctx.label || ctx.building_label} (${ctx.state}) | CMS ID: ${ctx.cms_id || 'N/A'}`];

  if (ctx.bed_capacity) parts.push(`Bed Capacity: ${ctx.bed_capacity}`);
  if (ctx.strategic_status) parts.push(`Strategic Status: ${ctx.strategic_status.toUpperCase()}`);
  if (ctx.strategic_identity) parts.push(`Strategic Identity: ${ctx.strategic_identity}`);

  // Snapshot data
  if (ctx.census != null) parts.push(`Current Census: ${ctx.census}`);
  if (ctx.occupancy_gap != null) parts.push(`Occupancy Gap: ${ctx.occupancy_gap} beds below capacity`);
  if (ctx.skilled_mix != null) parts.push(`Skilled Mix: ${ctx.skilled_mix}%`);
  if (ctx.survey_exposure) parts.push(`Survey Exposure: ${ctx.survey_exposure}`);
  if (ctx.staffing_pressure) parts.push(`Staffing Pressure: ${ctx.staffing_pressure}`);
  if (ctx.top_priorities?.length) parts.push(`Top Priorities: ${ctx.top_priorities.join(', ')}`);

  // Profile data
  if (ctx.referral_sources) parts.push(`Key Referral Sources: ${ctx.referral_sources}`);
  if (ctx.physician_gaps) parts.push(`Physician Gaps: ${ctx.physician_gaps}`);
  if (ctx.payer_context) parts.push(`Payer Context: ${ctx.payer_context}`);
  if (ctx.risk_watchlist) parts.push(`Risk Watchlist: ${ctx.risk_watchlist}`);
  if (ctx.opportunities) parts.push(`Opportunities: ${ctx.opportunities}`);

  // Freshness
  if (ctx.snapshot_updated_at) {
    const daysOld = daysSince(ctx.snapshot_updated_at);
    if (daysOld > 30) {
      parts.push(`⚠️ BUILDING DATA MAY BE OUTDATED — last updated ${daysOld} days ago. Verify current figures before using in any document.`);
    }
  }

  return parts.join('\n');
}


// ── Intelligence Formatter ──

function formatIntelligence(ctx) {
  const parts = ['LATEST BUILDING INTELLIGENCE'];
  if (ctx.intel_headline) parts.push(`Headline: ${ctx.intel_headline}`);
  if (ctx.intel_status) parts.push(`Status: ${ctx.intel_status}`);
  if (ctx.intel_risks?.length) parts.push(`Top Risks: ${ctx.intel_risks.join(', ')}`);
  if (ctx.intel_opportunities?.length) parts.push(`Top Opportunities: ${ctx.intel_opportunities.join(', ')}`);
  if (ctx.intel_actions?.length) parts.push(`Recommended Actions: ${ctx.intel_actions.join(', ')}`);
  if (ctx.intel_narrative) parts.push(`\n${ctx.intel_narrative}`);
  if (ctx.intel_freshness) parts.push(`Intelligence Freshness: ${ctx.intel_freshness}`);
  return parts.join('\n');
}


// ── Workflow Contract Formatter ──

function formatWorkflowContract(workflow) {
  const parts = [
    `WORKFLOW: ${workflow.label}`,
    `${workflow.description}`,
    '',
    'REQUIRED OUTPUT SECTIONS:',
    ...workflow.outputSections.map((s, i) => `${i + 1}. ${s}`),
    '',
    'REVIEW CHECKLIST (include at the end of the document):',
    ...workflow.reviewChecklist.map(c => `☐ ${c}`),
    '',
    'OUTPUT FORMAT — DRAFT MODE ACTIVE: respond as a structured, professional document with section headings, numbered steps where appropriate, and formal language.',
    '',
    'End with: "This is an AI-generated draft. Review all facts, names, dates, and regulatory references before use."',
  ];
  return parts.join('\n');
}


// ── Mode Suffixes (fallback when no workflow is active) ──

const CHAT_SUFFIX = `
OUTPUT FORMAT — CHAT MODE: Respond conversationally and concisely. Use bullet points for lists. Keep answers focused and actionable. If the question is vague, ask a clarifying question before giving generic advice.
`.trim();

const DRAFT_SUFFIX = `
OUTPUT FORMAT — DRAFT MODE ACTIVE: Respond as a structured, professional document with section headings, numbered steps where appropriate, and formal language. Use a format appropriate to the document type being requested.

Before drafting, verify you have the necessary facts. If critical information is missing, ask for it first.

End with: "This is an AI-generated draft. Review all facts, names, dates, and regulatory references before use."
`.trim();


// ── Static fallback for building context (when Supabase is not connected) ──

function buildBuildingContextFallback(buildingId) {
  const building = getBuildingById(buildingId);
  if (!building || building.id === 'none') return null;
  return {
    label: building.label,
    state: building.state,
    cms_id: building.cmsId,
    bed_capacity: building.bedCapacity,
    // Other fields will be null — that's fine for fallback
  };
}


// ── Utilities ──

function daysSince(dateString) {
  const then = new Date(dateString);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function sanitizeMessages(messages) {
  return messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }))
    .slice(-MAX_MESSAGES);
}


// ── CORS ──

function getCorsHeaders(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  return {};
}


// ── Main Handler ──

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

  // Request size check (v1.1 requirement)
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
    const { botId, buildingId, isDraft, messages, workflowId } = req.body;
    const requestId = crypto.randomUUID?.() || `req_${Date.now()}`;

    // Validate botId
    const role = getRoleById(botId);
    if (!role) {
      return res.status(400).json({ error: `Unknown bot: ${botId}` });
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const sanitized = sanitizeMessages(messages);
    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    // ── Fetch building context from Supabase (if connected) ──
    // In production, replace this with a Supabase client call:
    //   const { data: buildingContext } = await supabase
    //     .from('v_building_context')
    //     .select('*')
    //     .eq('slug', buildingId)
    //     .single();
    const buildingContext = null; // static fallback for now

    // ── Assemble system prompt ──
    const systemPrompt = assembleSystemPrompt({
      roleId: botId,
      buildingId: buildingId || null,
      isDraft: isDraft || false,
      workflowId: workflowId || null,
      buildingContext,
    });

    // ── Call Anthropic ──
    const startTime = Date.now();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: isDraft ? DRAFT_MAX_TOKENS : CHAT_MAX_TOKENS,
      system: systemPrompt,
      messages: sanitized,
    });

    const reply = response.content[0]?.text || '';
    const latency = Date.now() - startTime;

    // ── Structured logging (v1.1 requirement) ──
    console.log(JSON.stringify({
      event: 'chat_response',
      requestId,
      botId,
      buildingId: buildingId || null,
      isDraft: isDraft || false,
      workflowId: workflowId || null,
      messageCount: sanitized.length,
      responseTokens: response.usage?.output_tokens,
      latencyMs: latency,
      timestamp: new Date().toISOString(),
      // NEVER log message content or API key
    }));

    return res.status(200).json({ reply });

  } catch (err) {
    console.error(JSON.stringify({
      event: 'chat_error',
      error: err.message,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      timestamp: new Date().toISOString(),
    }));
    return res.status(500).json({ error: 'Internal server error' });
  }
}
