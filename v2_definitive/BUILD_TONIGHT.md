# IHCM Bot Widget v2 — Build Tonight Checklist

## What's in this folder

```
v2_definitive/
  schema.sql          ← Run this in Supabase SQL Editor (one shot)
  api/chat.js         ← Vercel serverless function (POST /api/chat)
  src/bots.js         ← 5 role engines (static fallback for ihcm_bot.roles)
  src/buildings.js    ← 7 buildings + profiles (static fallback)
  src/workflows.js    ← 12 workflows (static fallback for ihcm_bot.workflow_templates)
```

Your architecture pack (`ihcm_bot_architecture/`) is unchanged — it's the design spec. This folder is the implementation.

## What changed from the separate versions

The schema merges your `ihcm_bot` namespace (enums, triggers, `prompt_profiles`, `cross_building_intelligence`, granular payer/risk fields) with my tables (`global_core`, `roles` with UI fields, `role_playbooks`, `conversation_sessions`, `response_feedback`, `audit_log`, `v_building_context` composite view).

`api/chat.js` now has a real Supabase client that fetches `v_building_context` at runtime, with graceful fallback to static data when Supabase env vars are missing.

`bots.js` adds a `role` field matching the `ihcm_bot.role_type` enum and a `getRoleBySlug()` helper.

`buildings.js` moves `strategicStatus` and `strategicLabel` onto the building identity (matching the merged schema) and aligns profile fields to the expanded `building_profiles` table shape.

`workflows.js` adds the two missing Billing workflows (`appeal_letter`, `denial_pattern_analysis`) that were referenced in `bots.js` but not previously defined.

## Step-by-step tonight

### 1. Supabase (15 min)

- Create project at supabase.com (or use existing)
- Open SQL Editor, paste `schema.sql`, run
- Grab your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from Settings > API

### 2. Environment variables

Set these in Vercel (or `.env.local` for dev):

```
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

The app works WITHOUT the Supabase vars — it just uses static fallbacks from the JS files.

### 3. Install dependencies

```bash
npm install @anthropic-ai/sdk @supabase/supabase-js
```

### 4. Wire up the frontend

Your existing React frontend already sends `{ botId, buildingId, isDraft, messages, workflowId }` to `POST /api/chat`. The new `api/chat.js` expects exactly this shape. Drop it in and it works.

### 5. Test the pipeline

Try these requests to verify each layer:

| Test | botId | buildingId | workflowId | isDraft |
|------|-------|------------|------------|---------|
| Chat mode, no building | `mds` | `none` | null | false |
| Chat mode, with building | `don` | `crossett` | null | false |
| Draft mode, no workflow | `admin` | `arkadelphia` | null | true |
| Workflow mode | `don` | `glenwood` | `poc_drafter` | false |
| Regional comparison | `regional` | `none` | `building_comparison` | false |

### 6. Populate Supabase (when ready)

Not blocking for tonight — the static fallbacks work. But when you're ready:

1. Insert `global_core` rows (identity, safety, tone, drafting rules)
2. Insert `roles` rows from bots.js data
3. Insert `buildings` rows from buildings.js data
4. Insert `building_profiles` — one per building, fill in real strategic context
5. Insert first `building_snapshots` — census, skilled mix, payer mix for each building
6. Insert `workflow_templates` from workflows.js data

The `v_building_context` view automatically joins buildings + profiles + latest snapshot + latest intelligence. Once rows exist, `api/chat.js` uses them instead of static fallbacks.

## What's NOT in this folder (by design)

- **Frontend code** — your existing React/Vite app is unchanged
- **Auth** — add Azure AD SSO or magic link per the v1.1 blueprint when ready
- **Rate limiting** — add Vercel Edge Middleware or Upstash when you go to production
- **Knowledge chunk retrieval** — enable `pgvector` extension and build the retrieval layer when you have documents loaded
- **Intelligence generation** — build the cron job that creates `building_intelligence_packets` from snapshots + profiles

## Architecture reference

Your architecture pack files are the design spec:

- `KNOWLEDGE_BASE_STRUCTURE.md` — four knowledge layers, folder tree
- `DOCUMENT_INVENTORY.md` — prioritized doc creation order
- `PROMPT_ASSEMBLY_PATTERN.md` — runtime context stack and retrieval priority
- `supabase_schema.sql` — original schema (now merged into `v2_definitive/schema.sql`)
