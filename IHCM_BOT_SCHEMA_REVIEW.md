# IHCM AI Bot — Full Schema for QA Review (v2)

**Date:** 2026-03-29 (end of day)
**Live URL:** https://ihcm-ai-bot.vercel.app
**Repo:** https://github.com/DBIND26/ihcm-ai-bot
**Latest commit:** 35859c0 (Fix CMS survey ingestion: use new Provider Data API)

---

## 1. System Overview

An AI-powered operational assistant for Independence Healthcare Management (IHCM), a skilled nursing facility operator with **7 buildings** across Arkansas, Ohio, and Pennsylvania. Uses Claude Sonnet 4 with a 7-layer context assembly pipeline to give role-specific, building-aware guidance.

### Key Capabilities
- 5 role engines (DON, MDS, Billing, Admin, Regional)
- 7 building profiles with real operational data from Supabase
- 12+ workflow templates for structured document drafting
- CMS 2567 PDF parsing with citation-level POC guidance
- **Supabase Auth** (email/password, JWT-verified on all endpoints)
- Server-side conversation persistence with role-scoped history
- Server-side feedback collection
- Knowledge base with approval workflow and regulatory seed data
- Portfolio dashboard with risk cards and alerts
- SNF Metrics daily census CSV ingest
- CMS survey deficiency data ingestion (public API, last 2 years)
- Building history (surveys + events) persisted to Supabase
- Upstash Redis rate limiting (production-safe across serverless instances)
- Context windowing for cost/latency control
- PHI disclaimer on chat input
- Password reset flow
- Conversation export (download as .txt)

---

## 2. Architecture

```
Browser (React 18 + Vite)
  |
  |-- Supabase Auth (signInWithPassword, JWT in localStorage)
  |
  |-- POST /api/chat              →  7-layer context assembly + Claude Sonnet 4
  |-- POST /api/feedback           →  feedback_events table
  |-- POST /api/parse-2567         →  CMS 2567 PDF parsing
  |-- GET  /api/conversations      →  List/load conversations (JWT-scoped)
  |-- GET  /api/dashboard          →  Portfolio building cards + alerts
  |-- GET  /api/building-history   →  Surveys + events per building
  |-- POST /api/building-history   →  Add building event
  |-- POST /api/ingest-census      →  SNF Metrics CSV upload
  |-- POST /api/ingest-cms-surveys →  CMS deficiency data pull
  |-- GET/POST/PATCH /api/ingest-knowledge → Knowledge base CRUD
  |
Vercel Serverless Functions (Node.js ESM)
  |
  |-- Anthropic SDK (Claude Sonnet 4)
  |-- Supabase JS Client (service_role key for writes, JWT verification for auth)
  |-- Upstash Redis (rate limiting)
  |
PostgreSQL (Supabase)
  |-- 11 migrations applied
  |-- Supabase Auth (email/password)
  |-- v_bot_building_context view (with building_profiles JOIN)
  |-- CMS survey deficiency data (132 deficiencies across 34 surveys)
```

---

## 3. File Structure (Active Files Only)

### Frontend (React 18 + Vite) — 2,421 lines
| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | 1,643 | Main app shell: state, API calls, layout, view switching |
| `src/components/AccessGate.jsx` | 176 | Supabase Auth login form + password reset |
| `src/components/Dashboard.jsx` | 157 | Portfolio view: building cards, risk scores, alerts |
| `src/components/MessageList.jsx` | 98 | Message rendering, feedback buttons, copy |
| `src/components/BuildingHistoryPanel.jsx` | 142 | Survey history, event timeline, add event |
| `src/components/ConversationHistoryPanel.jsx` | 54 | Server-side conversation list + load |
| `src/components/formatMarkdown.jsx` | 144 | Markdown renderer (bold, links, lists, code blocks) |
| `src/lib/supabase.js` | 7 | Browser Supabase client (anon key) |
| `src/storage.js` | 76 | localStorage persistence (fallback only) |
| `src/buildingHistory.js` | 171 | localStorage building history (fallback only) |

### Backend (Vercel Serverless) — 2,399 lines
| File | Lines | Purpose |
|------|-------|---------|
| `v2_definitive/api/chat.js` | 709 | Core chat: auth, context assembly, Claude API, conversation persistence |
| `api/dashboard.js` | 88 | Portfolio data: buildings + alerts from Supabase |
| `api/conversations.js` | 131 | List/load conversations (JWT ownership-checked) |
| `api/building-history.js` | 107 | Building surveys + events from Supabase |
| `api/feedback.js` | 92 | Feedback to Supabase feedback_events |
| `api/ingest-census.js` | 204 | SNF Metrics CSV parsing + Supabase update |
| `api/ingest-cms-surveys.js` | 176 | CMS Provider Data API → building_surveys |
| `api/ingest-knowledge.js` | 224 | Knowledge base CRUD with dedupe + approval |
| `api/parse-2567.js` | 355 | CMS 2567 PDF parsing |
| `api/chat.js` | 2 | Vercel routing wrapper → v2_definitive/api/chat.js |
| `api/lib/requireAuth.js` | 48 | JWT verification middleware (Supabase Auth) |
| `api/lib/rateLimit.js` | 63 | Upstash Redis rate limiting |
| `server.js` | 175 | Local dev server (wraps all endpoints) |

### Data Layer (Static Fallbacks) — 1,326 lines
| File | Lines | Purpose |
|------|-------|---------|
| `v2_definitive/src/bots.js` | 390 | 5 role engines with system prompts |
| `v2_definitive/src/buildings.js` | 275 | 7 buildings with profiles |
| `v2_definitive/src/workflows.js` | 661 | 12+ workflow templates |

### Database (Supabase PostgreSQL) — 11 migrations
| Migration | Purpose |
|-----------|---------|
| `202603120001_core_schema.sql` | Core tables: facilities, episodes, MDS, staffing, alerts, risk, incidents, reimbursement, briefs |
| `202603120002_auth_and_rls.sql` | Auth tables, RLS policies, permission functions |
| `202603270001_platform_hardening.sql` | Role-based domains, audit, conversations, feedback, knowledge tables |
| `202603280001_review_fixes.sql` | Governance tightening, triggers, draft approval |
| `202603280002_bot_context_view.sql` | v_bot_building_context view |
| `202603290001_beta_users.sql` | Beta user identity (pre-auth, now superseded) |
| `202603290002_conversations_role_scope.sql` | bot_id column on conversations for role scoping |
| `202603290003_building_profiles.sql` | Building profiles table + real data for all 7 buildings + view update |
| `202603290004_knowledge_dedupe.sql` | content_hash + unique constraint on knowledge_sources |
| `202603290005_auth_users_setup.sql` | allowed_bot_roles column + FK relaxation for Supabase Auth |
| `202603290006_building_history.sql` | building_surveys + building_events tables + CMS provider IDs |

---

## 4. Database Schema

### Core Operational Tables (migration 1)
| Table | Purpose |
|-------|---------|
| `facilities` | 7 IHCM buildings with census, beds, status, CMS provider ID |
| `resident_episodes` | Patient stays (payer type, acuity, admission/discharge) |
| `mds_assessments` | MDS tracking (type, due date, status, case mix index) |
| `assessment_reimbursement_classifications` | PDPM/RUG components per assessment |
| `staffing_daily` | Daily staffing hours (RN, LPN, CNA, agency, overtime, HPRD) |
| `ai_alerts` | System-generated alerts (severity, category, status) |
| `facility_risk_scores` | Composite risk model (clinical, survey, staffing, reimbursement) |
| `incident_events` | Safety incidents (type, harm level, investigation) |
| `reimbursement_events` | Revenue issues (variance, denial, late submission) |
| `daily_briefs` | Narrative summaries (portfolio and facility-level) |
| `daily_brief_actions` | Action items per brief |
| `daily_brief_facilities` | Priority buildings per brief |

### Auth & Access (migration 2 + 10)
| Table | Purpose |
|-------|---------|
| `user_profiles` | user_id → auth.users, app_role, global_access_level, allowed_bot_roles |
| `user_facility_access` | Per-user facility access (view/edit/admin) |

### Platform Intelligence (migration 3 + 4)
| Table | Purpose |
|-------|---------|
| `audit_events` | Immutable append-only audit trail |
| `knowledge_sources` | Governed content with versioning, approval, dedupe (content_hash) |
| `knowledge_versions` | Change history per knowledge source |
| `conversations` | Server-side chat sessions (user_id, facility_id, bot_id, title) |
| `conversation_messages` | Messages per conversation (role, content, model, tokens) |
| `workflow_runs` | Structured bot operations |
| `draft_outputs` | AI-generated documents with approval workflow |
| `feedback_events` | User ratings (useful, not_useful, questionable, needs_review) |
| `review_queue` | Knowledge manager oversight queue |

### Building Intelligence (migrations 8 + 11)
| Table | Purpose |
|-------|---------|
| `building_profiles` | Strategic profiles: payer context, market summary, referrals, growth barriers/opportunities, survey/staffing context, risk watchlist |
| `building_surveys` | CMS deficiency data + uploaded 2567s (date, type, F-tags, scope/severity, IJ flag) |
| `building_events` | Operational timeline (leadership changes, incidents, regulatory events) |

### Key View
| View | Purpose |
|------|---------|
| `v_bot_building_context` | Flat context for chat API: facilities + facility_risk_scores + building_profiles joined |

---

## 5. API Endpoints (10 total, all JWT-authenticated)

### POST /api/chat
- **Auth**: Supabase JWT required (requireAuth)
- **Rate limit**: 15/min per IP (Upstash Redis)
- **Input**: `{ botId, buildingId, isDraft, messages, workflowId, documentContext, historyContext, conversationId }`
- **Processing**: 7-layer context assembly + Claude Sonnet 4 + conversation persistence
- **Context window**: Last 10 messages (4K chars each), 30K doc context, 5K history, 15K knowledge. Older messages summarized (user asks + assistant commitments).
- **Output**: `{ reply, conversationId }`

### GET /api/dashboard
- **Output**: `{ buildings: [...], totals: { total_beds, total_census, occupancy_pct, total_alerts, buildings_at_risk } }`
- Data from v_bot_building_context + open ai_alerts per building

### GET /api/conversations
- **Params**: `?role=<botId>&building=<slug>` (list) or `?id=<uuid>` (detail)
- Ownership enforced: only returns conversations for the authenticated user
- Role-scoped: filters by bot_id

### GET/POST /api/building-history
- **GET**: `?building=<slug>` → surveys + events from Supabase
- **POST**: `{ buildingId, category, title, description, date }` → creates event

### POST /api/feedback
- **Rate limit**: 10/min per IP (Upstash Redis)
- Maps: useful → useful, not_useful → not_useful, wrong → questionable
- Stores in feedback_events with auth user_id

### POST /api/ingest-census
- Accepts SNF Metrics Daily Census CSV
- Updates facilities.current_census + building_profiles.payer_context

### POST /api/ingest-cms-surveys
- Fetches from data.cms.gov Provider Data API for all 7 buildings
- Stores in building_surveys with F-tags, scope/severity, IJ detection

### GET/POST/PATCH /api/ingest-knowledge
- **GET**: `?status=all&type=<type>&state=<code>` → list knowledge sources
- **POST**: Create new source (draft status, dedupe check)
- **PATCH**: `{ source_id, status }` → approve/archive

### POST /api/parse-2567
- Multipart PDF upload → parsed citations with F-tags

---

## 6. Context Assembly Pipeline

```
Layer 1: Global Core       — IHCM identity, safety rules, tone, PHI rules
Layer 2: Role Module       — Role-specific system prompt (from bots.js)
Layer 3: Building Profile  — Payer mix, market, referrals (from v_bot_building_context)
Layer 4: Building Snapshot — Census, risk scores, staffing (from v_bot_building_context)
Layer 5: Intelligence      — AI-generated insights (from v_bot_building_context, future)
Layer 5b: Building History — CMS surveys + events (from building_surveys/events via API)
Layer 5c: Knowledge Base   — Governed content: PDPM, state reimbursement, staffing reqs (facility > state > portfolio ranking)
Layer 5d: Document Context — Uploaded 2567 citations (max 30K chars)
Layer 6: Workflow Contract  — Required output sections + review checklist
Layer 7: Conversation      — Context-windowed messages (last 10 + older summary with user asks AND assistant commitments)
```

---

## 7. Authentication & Authorization

### Current State (Supabase Auth — Production)
| Layer | Implementation | Security Level |
|-------|---------------|----------------|
| Login | Supabase Auth email/password | **Server-issued JWT** |
| Session | Supabase SDK handles refresh/persistence | Automatic |
| Password reset | supabase.auth.resetPasswordForEmail() | Email-based |
| Role assignment | user_profiles.app_role + allowed_bot_roles | **Server-side** |
| Building access | user_profiles.global_access_level | **Server-side** |
| API auth | Every endpoint calls requireAuth(req) → verifies JWT | **Enforced** |
| Conversation ownership | Verified: user_id from JWT matches conversation.user_id | **Enforced** |
| Rate limiting | Upstash Redis: 15 chat/min, 10 feedback/min per IP | **Production-safe** |

### Users (6 configured)
| Name | Email | Role | Bot Roles |
|------|-------|------|-----------|
| Dov Braun | DBraun@indhcm.com | super_admin | all |
| Azra Nukicic | anukicic@indhcm.com | corporate_admin | don, mds, admin, regional |
| Jeff Edwards | JEdwards@indhcm.com | corporate_admin | don, mds, admin, regional |
| Lisa Kotora | lkotora@indhcm.com | regional_director | regional, mds |
| Lauren Greenwood | lgreenwood@indhcm.com | regional_director | mds, regional, don |
| Steven Isaac | SIsaac@indhcm.com | regional_director | regional, admin |

### Remaining Auth Gap
- RLS not yet enforced (service_role key used for all DB writes; JWT is verified but the DB query uses service key)
- user_facility_access not yet populated (all users have global access via global_access_level)

---

## 8. Data Inventory

### Building Profiles (all 7 populated)
| Building | Beds | Census | Top Payer | Risk | Key Issue |
|----------|------|--------|-----------|------|-----------|
| Arkadelphia | 100 | 82 | Medicaid 66% | stable (51) | Referral competition |
| Stonegate | 76 | 60 | Medicaid 67% | stable (41) | New leadership team |
| Glenwood | 80 | 54 | Medicaid 80% | stable (40) | Small town, cherry-pick referrals |
| The Woods | 120 | 71 | Medicaid 66% | high_risk (61→watch) | IJ elopement, staffing weak |
| Crossett | 83 | 61 | Medicaid 79% | watch (136→critical) | Old building, MD not referring |
| Marymount | 234 | 162 | SNF: Medicaid 57%, Managed 16% | watch (78) | 2-star, reputation, turnover |
| Erie | 171 | 143 | Managed 20%, Medicaid 52% | stable (56) | Admin/DON turnover, agency |

### CMS Survey Data (ingested)
| Building | Surveys | Deficiencies | Has IJ? |
|----------|---------|-------------|---------|
| Arkadelphia | 3 | 9 | No |
| Stonegate | 4 | 12 | No |
| Glenwood | 2 | 5 | No |
| The Woods | 7 | 36 | Yes |
| Crossett | 3 | 28 | Check |
| Marymount | 8 | 26 | Check |
| Erie | 7 | 16 | No |

### Knowledge Base (6 approved sources)
- CMS PDPM Payment Model Overview
- CMS Survey Process and F-Tag Structure
- Arkansas Medicaid SNF Reimbursement
- Ohio Medicaid SNF Reimbursement
- Pennsylvania Medicaid SNF Reimbursement
- CMS SNF Staffing Requirements and Best Practices

---

## 9. Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Vercel + .env.local | Claude API access |
| `SUPABASE_URL` | Vercel + .env.local | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_KEY` | Vercel + .env.local | Service role key (server-side writes) |
| `VITE_SUPABASE_URL` | Vercel + .env.local | Supabase URL (browser, build-time) |
| `VITE_SUPABASE_ANON_KEY` | Vercel + .env.local | Anon key (browser, build-time) |
| `UPSTASH_REDIS_REST_URL` | Vercel + .env.local | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + .env.local | Upstash Redis token |

**Removed:** `BETA_ACCESS_CODE` (replaced by Supabase Auth)

---

## 10. Known Issues & Technical Debt

### Medium Priority
1. **RLS not enforced** — service_role key bypasses RLS. JWT is verified but DB queries use admin access. Fix: use anon key + pass JWT for RLS-enforced queries.
2. **user_facility_access not populated** — all users have global access. Building-level restrictions not active.
3. **App.jsx still 1,643 lines** — controls row, workflow panel, input area could be extracted further.
4. **No automated census ingest** — manual CSV upload or cron needed.

### Low Priority
5. **No admin dashboard** — no way to view all users, conversations, feedback metrics.
6. **Static data in bots.js/buildings.js/workflows.js** — could move to Supabase for dynamic management.
7. **No conversation deletion** — conversations accumulate.
8. **localStorage fallbacks still in code** — storage.js and buildingHistory.js still present for offline fallback.

---

## 11. Testing Checklist

### Authentication
- [ ] Login with valid IHCM email/password → enters app
- [ ] Login with wrong password → shows error
- [ ] Password reset → sends email, user can reset
- [ ] Session persists on page refresh (Supabase auto-recovery)
- [ ] Sign out clears session
- [ ] Each user sees only their allowed role tabs
- [ ] API returns 401 without valid JWT

### Portfolio Dashboard
- [ ] Dashboard loads on login as default view
- [ ] Shows all 7 buildings with census, risk score, occupancy bar
- [ ] Risk badges (critical/high_risk/watch/stable) are color-coded
- [ ] Open alerts shown per building
- [ ] Portfolio totals correct (census, beds, occupancy %, alerts)
- [ ] Clicking a building card switches to chat with that building selected

### Chat
- [ ] Each of 5 roles loads correct starters and workflows
- [ ] Each of 7 buildings returns building-specific answers
- [ ] Bot references real payer mix, survey history, strategic notes
- [ ] Knowledge base content appears in responses (PDPM, state reimbursement)
- [ ] CMS survey history available in building context
- [ ] Draft mode toggle changes response format
- [ ] Workflow selector shows role-appropriate workflows
- [ ] Workflow input validation (required fields)
- [ ] Context windowing: long conversations get summary prefix

### Conversations
- [ ] Chat History button loads conversation list from server
- [ ] Conversations are role-scoped (DON threads don't show in Billing)
- [ ] Clicking a conversation loads its messages
- [ ] New Chat clears conversation (with confirmation)
- [ ] Conversation continues with same ID on subsequent messages
- [ ] Export conversation downloads .txt file

### Building History
- [ ] History panel loads CMS survey data from Supabase (not localStorage)
- [ ] CMS deficiencies show F-tags, scope/severity per survey
- [ ] Add Event form saves to Supabase
- [ ] Events persist across sessions and devices

### Data Ingestion
- [ ] Upload Census: SNF Metrics CSV updates census + payer in Supabase
- [ ] Upload 2567: PDF parses citations and auto-sends analysis
- [ ] CMS survey import: pulls deficiency data for all 7 buildings
- [ ] Add Playbook: saves to knowledge_sources as draft
- [ ] Approve button promotes draft to approved (bot can reference)
- [ ] Duplicate playbook submission rejected

### Security
- [ ] Rate limiting: 16th chat request in 1 minute returns 429
- [ ] Oversized request body returns 413
- [ ] Invalid botId returns 400
- [ ] Links with javascript: protocol rendered as plain text
- [ ] PHI disclaimer visible below chat input
- [ ] All API endpoints return 401 without Authorization header

### Error Handling
- [ ] Network disconnect → "Connection error" message
- [ ] API 429 → "Too many requests" message
- [ ] API 500 → "Server error" message
- [ ] Supabase down → static fallbacks work for building context
- [ ] Conversation persistence failure → non-blocking, chat still works
- [ ] Upstash down → rate limiter fails open (no blocking)
