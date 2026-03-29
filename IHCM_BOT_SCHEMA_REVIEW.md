# IHCM AI Bot — Full Schema for QA Review

**Date:** 2026-03-29
**Live URL:** https://ihcm-ai-bot.vercel.app
**Repo:** https://github.com/DBIND26/ihcm-ai-bot
**Latest commit:** 254df3e (Split App.jsx into components + add context windowing)

---

## 1. System Overview

An AI-powered operational assistant for Independence Healthcare Management (IHCM), a skilled nursing facility operator with **7 buildings** across Arkansas, Ohio, and Pennsylvania. Uses Claude Sonnet 4 with a 7-layer context assembly pipeline to give role-specific, building-aware guidance.

### Key Capabilities
- 5 role engines (DON, MDS, Billing, Admin, Regional)
- 7 building profiles with real operational data from Supabase
- 12+ workflow templates for structured document drafting
- CMS 2567 PDF parsing with citation-level POC guidance
- Server-side conversation persistence
- Server-side feedback collection
- Context windowing for cost/latency control

---

## 2. Architecture

```
Browser (React 18 + Vite)
  |
  |-- POST /api/verify-access  →  Beta password gate + beta_users creation
  |-- POST /api/chat            →  7-layer context assembly + Claude Sonnet 4
  |-- POST /api/feedback        →  feedback_events table (Supabase)
  |-- POST /api/parse-2567      →  CMS 2567 PDF parsing
  |-- GET  /api/conversations   →  List/load conversations (Supabase)
  |
Vercel Serverless Functions (Node.js ESM)
  |
  |-- Anthropic SDK (Claude Sonnet 4)
  |-- Supabase JS Client (service_role key, bypasses RLS)
  |
PostgreSQL (Supabase)
  |-- 6 migrations applied
  |-- v_bot_building_context view
  |-- beta_users for pre-auth identity
```

---

## 3. File Structure (Active Files Only)

### Frontend (React 18 + Vite)
| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | 1247 | Main app shell: state management, API calls, layout |
| `src/components/AccessGate.jsx` | 203 | Login form, role/building picker, session |
| `src/components/MessageList.jsx` | 98 | Message rendering, feedback buttons, copy |
| `src/components/BuildingHistoryPanel.jsx` | 142 | Survey history, event timeline, add event |
| `src/components/ConversationHistoryPanel.jsx` | 54 | Server-side conversation list + load |
| `src/components/formatMarkdown.jsx` | 144 | Markdown renderer (bold, links, lists, code blocks) |
| `src/storage.js` | 76 | localStorage persistence (fallback) |
| `src/buildingHistory.js` | 171 | Per-building survey & event tracking (localStorage) |
| `src/index.css` | — | Global styles |
| `src/main.jsx` | — | React entry point |

### Backend (Vercel Serverless)
| File | Lines | Purpose |
|------|-------|---------|
| `v2_definitive/api/chat.js` | 629 | Core chat handler: context assembly, Claude API, conversation persistence |
| `api/conversations.js` | 147 | GET endpoint: list + load conversations from Supabase |
| `api/feedback.js` | 105 | POST endpoint: feedback to Supabase feedback_events |
| `api/verify-access.js` | 63 | POST endpoint: beta password gate + beta user creation |
| `api/parse-2567.js` | 355 | POST endpoint: CMS 2567 PDF parsing |
| `api/lib/betaUser.js` | 60 | Shared helper: getOrCreateBetaUser() |
| `api/chat.js` | 2 | Vercel routing wrapper → v2_definitive/api/chat.js |
| `server.js` | 125 | Local dev server (wraps all endpoints) |

### Data Layer (Static Fallbacks)
| File | Lines | Purpose |
|------|-------|---------|
| `v2_definitive/src/bots.js` | 390 | 5 role engines with system prompts, starters, decision frameworks |
| `v2_definitive/src/buildings.js` | 275 | 7 buildings with profiles, strategic context |
| `v2_definitive/src/workflows.js` | 661 | 12+ workflow templates with required inputs, output contracts |

### Database (Supabase PostgreSQL)
| File | Purpose |
|------|---------|
| `supabase/migrations/202603120001_core_schema.sql` | Core tables: facilities, episodes, MDS, staffing, alerts, risk scores, incidents, reimbursement, briefs |
| `supabase/migrations/202603120002_auth_and_rls.sql` | Auth tables, RLS policies, permission functions |
| `supabase/migrations/202603270001_platform_hardening.sql` | Role-based domains, audit, conversations, feedback, knowledge tables |
| `supabase/migrations/202603280001_review_fixes.sql` | Governance tightening, triggers, draft approval |
| `supabase/migrations/202603280002_bot_context_view.sql` | v_bot_building_context view for chat API |
| `supabase/migrations/202603290001_beta_users.sql` | Beta user identity, FK relaxation for pre-auth |
| `supabase/seed.sql` | 7 IHCM buildings + sample operational data |

### Config
| File | Purpose |
|------|---------|
| `package.json` | Dependencies: React 18, Vite 5, Anthropic SDK, Supabase SDK, pdf-parse |
| `vite.config.js` | Vite + React, proxy /api to localhost:3001 |
| `.env.local` | ANTHROPIC_API_KEY, BETA_ACCESS_CODE, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| `index.html` | React app entry |

---

## 4. Database Schema

### Production Tables (migration 1: core_schema)
| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `facilities` | facility_id, facility_code (slug), facility_name, state_code, licensed_beds, current_census, operational_status | 7 IHCM buildings |
| `resident_episodes` | episode_id, facility_id, payer_type, payment_model, admission_date, acuity_level | Patient stays |
| `mds_assessments` | assessment_id, episode_id, facility_id, assessment_type, payment_model, due_date, status, case_mix_index | MDS tracking |
| `assessment_reimbursement_classifications` | assessment_id, payment_model, component_name, component_score | PDPM/RUG components |
| `staffing_daily` | facility_id, staffing_date, rn_hours, cna_hours, agency_hours, hours_per_resident_day, below_target_flag | Daily staffing |
| `ai_alerts` | facility_id, alert_category, severity, title, status | System-generated alerts |
| `facility_risk_scores` | facility_id, score_date, composite_score, risk_label, primary_driver | Risk model output |
| `incident_events` | facility_id, incident_type, harm_level, investigation_status, survey_sensitive_flag | Safety incidents |
| `reimbursement_events` | facility_id, event_type, payment_model, estimated_impact_amount, status | Revenue issues |
| `daily_briefs` | brief_date, brief_scope, brief_text | Narrative summaries |
| `daily_brief_actions` | brief_id, action_rank, action_text, owner_role | Action items |
| `daily_brief_facilities` | brief_id, facility_id, priority_rank, reason | Priority buildings |

### Auth & Access (migration 2: auth_and_rls)
| Table | Purpose |
|-------|---------|
| `user_profiles` | user_id → auth.users, app_role, global_access_level |
| `user_facility_access` | user_id, facility_id, access_level (view/edit/admin) |

### Platform Intelligence (migration 3: platform_hardening)
| Table | Purpose |
|-------|---------|
| `audit_events` | Immutable append-only audit trail |
| `knowledge_sources` | Governed content with versioning + approval workflow |
| `knowledge_versions` | Change history per knowledge source |
| `conversations` | Server-side chat sessions (user_id, facility_id, title, status) |
| `conversation_messages` | Messages per conversation (role, content, model_used, token_count) |
| `workflow_runs` | Structured bot operations (inputs, status, started_at) |
| `draft_outputs` | AI-generated documents with approval workflow |
| `feedback_events` | User ratings (useful, not_useful, questionable, needs_review) |
| `review_queue` | Knowledge manager oversight queue |

### Beta Identity (migration 6: beta_users)
| Table | Purpose |
|-------|---------|
| `beta_users` | Lightweight user identity for pre-auth phase (user_id, user_name, role_hint) |

### Key View
| View | Purpose |
|------|---------|
| `v_bot_building_context` | Flat building context for chat API: identity + profile + snapshot + intelligence fields. Maps facilities + facility_risk_scores into the shape chat.js expects. |

### RLS Model
- All operational tables gate on `can_access_facility(facility_id)`
- Domain-aware policies: MDS tables require domain='mds', staffing requires domain='staffing', etc.
- Role → domain mapping via `role_allowed_domains()` function
- **Currently bypassed**: API uses service_role key (no RLS enforcement)
- Platform tables (conversations, feedback) had auth.uid() triggers **dropped** in migration 6 for beta compatibility

---

## 5. API Endpoints

### POST /api/verify-access
- **Auth**: Shared beta password (BETA_ACCESS_CODE env var)
- **Input**: `{ code, name }`
- **Output**: `{ valid: true, betaUserId }` or `{ valid: false }`
- **Side effect**: Creates beta_users row if Supabase connected

### POST /api/chat
- **Auth**: None (pre-auth scaffold)
- **Input**: `{ botId, buildingId, isDraft, messages, workflowId, documentContext, historyContext, userName, conversationId }`
- **Processing**:
  1. Validate botId and messages
  2. Rate limit (15/min per IP)
  3. Fetch building context from Supabase (`v_bot_building_context`) or static fallback
  4. Assemble 7-layer system prompt
  5. Call Claude Sonnet 4 with context-windowed messages
  6. Persist conversation to Supabase (best-effort, non-blocking)
- **Output**: `{ reply, conversationId }`
- **Context window**: Last 10 messages (4K chars each), 30K doc context, 5K history context. Older messages summarized.

### GET /api/conversations
- **Input (query params)**:
  - `?user=<name>` — list conversations for user
  - `?user=<name>&building=<slug>` — filter by building
  - `?id=<uuid>` — load messages for a specific conversation
- **Output**:
  - List mode: `{ conversations: [{ conversation_id, title, message_count, last_message, ... }] }`
  - Detail mode: `{ messages: [{ role, content }] }`

### POST /api/feedback
- **Input**: `{ type, user, role, building, messagePreview, userQuestion, conversationId }`
- **Rating map**: useful → useful, not_useful → not_useful, wrong → questionable
- **Storage**: Supabase `feedback_events` table (with beta user resolution), falls back to server console log

### POST /api/parse-2567
- **Input**: Multipart form with PDF file
- **Output**: Parsed citations with f_tag, scope_severity, deficient_practice, findings

---

## 6. Context Assembly Pipeline (chat.js)

```
Layer 1: Global Core       — IHCM identity, safety rules, tone, PHI rules
Layer 2: Role Module       — Role-specific system prompt (from bots.js or Supabase)
Layer 3: Building Profile  — Strategic context: payer mix, market, referrals (from v_bot_building_context or static)
Layer 4: Building Snapshot — Operational facts: census, risk scores, staffing levels
Layer 5: Intelligence      — AI-generated insights (headline, risks, opportunities)
Layer 5b: Building History — Surveys + events from client localStorage
Layer 5c: Document Context — Parsed 2567 citations from uploaded PDFs
Layer 6: Workflow Contract  — Required output sections + review checklist (if workflow active)
Layer 7: Conversation      — Context-windowed user messages (last 10 + older summary)
```

---

## 7. Frontend Component Architecture

```
App.jsx (1247 lines — state management + layout shell)
├── AccessGate.jsx (login, role/building picker)
├── Header (inline — title, user info, sign out)
├── Role Tabs (inline — role switcher)
├── Controls Row (inline — building select, draft toggle, upload, history buttons)
├── ConversationHistoryPanel.jsx (server-side conversation list)
├── BuildingHistoryPanel.jsx (survey + event timeline)
├── Workflow Panel (inline — workflow selector + input form)
├── MessageList.jsx (messages + feedback + copy)
│   └── formatMarkdown.jsx (bold, links, lists, code blocks, headers)
├── Starter Prompts (inline — quick-start chips)
└── Input Area (inline — textarea + send button)
```

---

## 8. Authentication & Authorization

### Current State (Pre-Auth Scaffold)
| Layer | Implementation | Security Level |
|-------|---------------|----------------|
| Login | Shared beta password (BETA_ACCESS_CODE) | Low — anyone with code gets in |
| Role selection | Client-side, stored in sessionStorage | **Bypassable** — editable in devtools |
| Building access | Client-side filtering based on role | **Bypassable** — same |
| User identity | beta_users table (userName → stable UUID) | Medium — server-tracked |
| API auth | None — service_role key bypasses RLS | **No per-user enforcement** |
| Conversation ownership | beta_users.user_id FK on conversations | Medium — but not verified on read |

### Known Vulnerability (Finding #1 from code review)
Authorization is client-authored. Anyone editing `ihcm_session` in devtools can escalate to any role or building. The fix is Supabase Auth with server-issued JWTs — planned for next phase.

### Target State (Post-Supabase Auth)
- Supabase Auth (email/password) for login
- Server-issued JWT with role + facility claims
- RLS enforcement on all queries (remove service_role key from chat API)
- auth.uid() triggers re-enabled on conversations, feedback, workflow_runs

---

## 9. Data Flow

### Chat Message Flow
```
1. User types message in browser
2. App.jsx sends POST /api/chat with:
   - messages (last 10 + older summary)
   - buildingId, botId, isDraft, workflowId
   - documentContext (uploaded 2567s, max 30K chars)
   - historyContext (building events, max 5K chars)
   - userName, conversationId
3. chat.js:
   a. Fetches building context from v_bot_building_context (Supabase) or static fallback
   b. Assembles 7-layer system prompt
   c. Calls Claude Sonnet 4 (max 2K tokens chat / 4K draft)
   d. Persists conversation + messages to Supabase (best-effort)
   e. Returns { reply, conversationId }
4. App.jsx:
   a. Displays assistant message
   b. Saves to localStorage (backup)
   c. Stores conversationId for subsequent messages
```

### Conversation Load Flow
```
1. User switches role or building (or page load)
2. App.jsx calls GET /api/conversations?user=X&building=Y
3. API returns list of conversations with message counts
4. App.jsx auto-loads most recent conversation's messages
5. Falls back to localStorage if API unavailable
```

---

## 10. Rate Limiting & Security

| Control | Implementation |
|---------|---------------|
| Chat rate limit | 15 requests/min per IP (in-memory map) |
| Feedback rate limit | 1 request/2 seconds per IP |
| Request body size | 256 KB max |
| Message sanitization | 4,000 char max per message, last 10 messages |
| Document context | 30,000 char max |
| CORS | Whitelist: *.vercel.app + localhost |
| Link sanitization | Only http/https/relative URLs rendered as links (blocks javascript:, data:, etc.) |
| localStorage guard | All reads wrapped in try/catch for privacy-restricted browsers |

---

## 11. Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Vercel + .env.local | Claude API access |
| `BETA_ACCESS_CODE` | Vercel + .env.local | Shared login password |
| `SUPABASE_URL` | Vercel + .env.local | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Vercel + .env.local | Service role key (bypasses RLS) |

---

## 12. Known Issues & Technical Debt

### High Priority
1. **Client-authored authorization** — roles/buildings are self-selected and stored in sessionStorage. Needs server-issued claims via Supabase Auth.
2. **Service role key in serverless functions** — bypasses all RLS. Must switch to per-user auth tokens.
3. **No conversation ownership verification on read** — GET /api/conversations doesn't verify the requesting user owns the conversation being loaded (trusts the `user` query param).

### Medium Priority
4. **Building history still client-side** — surveys and events stored in localStorage, not Supabase. Lost on browser clear.
5. **No conversation deletion/archival UI** — conversations accumulate with no way to clean up.
6. **Unused imports in App.jsx** — some buildingHistory imports may be removable after panel extraction.

### Low Priority
7. **No conversation export** — no PDF/JSON download of conversations or drafts.
8. **No admin dashboard** — no way to view all users, conversations, or feedback.
9. **Static data in bots.js/buildings.js/workflows.js** — could be moved to Supabase for dynamic management.

---

## 13. Deployment

| Environment | URL | Method |
|-------------|-----|--------|
| Production | https://ihcm-ai-bot.vercel.app | Auto-deploy on push to main |
| Local dev | http://localhost:5173 (frontend) + :3001 (API) | `npm run dev` + `node server.js` |

### Vercel Configuration
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Serverless functions: `api/` directory (auto-detected)
- Node.js version: 18.x

---

## 14. Database Seed Data Summary

| Table | Rows | Notes |
|-------|------|-------|
| facilities | 7 | Actual IHCM buildings (slugs: arkadelphia, stonegate, glenwood, thewoods, crossett, marymount, erie) |
| resident_episodes | 4 | Sample across Arkadelphia, Crossett, Glenwood, Marymount |
| mds_assessments | 5 | Mix of submitted, in_progress, due, overdue |
| assessment_reimbursement_classifications | 4 | PDPM + state CMI components |
| staffing_daily | 5 | Mix of on-target and below-target |
| ai_alerts | 4 | Critical (Crossett staffing), high (Glenwood MDS, Marymount clinical), medium (The Woods) |
| facility_risk_scores | 7 | One per building. Crossett=136/critical, Marymount=78/watch, rest=40-61/stable-watch |
| incident_events | 3 | Fall (Arkadelphia), med error (Crossett), behavioral (Marymount) |
| reimbursement_events | 3 | Late submission, PDPM variance, state CMI variance |
| daily_briefs | 2 | Portfolio brief + Crossett facility brief |
| beta_users | dynamic | Created on first login |
| conversations | dynamic | Created on first chat message |

---

## 15. Testing Checklist

### Functional
- [ ] Login with valid beta code → enters app
- [ ] Login with invalid code → shows error
- [ ] Each of 5 roles loads correct tab, starters, and workflows
- [ ] Each of 7 buildings loads and returns building-specific answers
- [ ] "All Buildings" option returns general answers
- [ ] Draft mode toggle changes response format
- [ ] Workflow selector shows role-appropriate workflows
- [ ] Workflow input validation (required fields)
- [ ] Upload 2567 PDF → parses citations → auto-sends analysis message
- [ ] Multi-file upload → all succeed or none persist
- [ ] Feedback buttons (useful/not useful/wrong) → persist to Supabase
- [ ] Copy button copies message to clipboard
- [ ] New Chat clears conversation (with confirmation if messages exist)
- [ ] Chat History loads conversation list from server
- [ ] Clicking a conversation loads its messages
- [ ] Role/building change loads most recent conversation from server
- [ ] Conversation continues with same conversationId on subsequent messages

### Supabase Integration
- [ ] `hasBuildingContext: true` in API logs when building selected
- [ ] beta_users row created on first login
- [ ] conversations + conversation_messages rows created after first message
- [ ] feedback_events rows created on feedback button click
- [ ] v_bot_building_context returns all 7 buildings with risk scores

### Security
- [ ] Rate limiting: 16th request in 1 minute returns 429
- [ ] Oversized request body returns 413
- [ ] Invalid botId returns 400
- [ ] Empty messages array returns 400
- [ ] Links with javascript: protocol rendered as plain text
- [ ] localStorage failures don't crash the app

### Error Handling
- [ ] Network disconnect → "Connection error" message
- [ ] API 429 → "Too many requests" message
- [ ] API 500 → "Server error" message
- [ ] Supabase down → app works with static fallbacks
- [ ] Conversation persistence failure → non-blocking, chat still works
