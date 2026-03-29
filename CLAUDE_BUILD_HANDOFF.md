# IHCM 10X Bot Build Handoff

## Executive Decision

There are two incompatible schema paths in this repo:

1. `supabase/migrations/`
2. `v2_definitive/schema.sql`

These are not the same system.

### Source of truth

Use `supabase/migrations/` as the production foundation.

Why:

- it has auth
- it has RLS
- it has role-aware access control
- it has audit tables
- it has platform intelligence tables
- it includes the review-fix migration

Do **not** treat `v2_definitive/schema.sql` as the main database source of truth for production. It is a merged standalone schema concept, not the governed schema path.

## What Is Actually Buildable Tonight

### The repo currently has:

- production-grade database migrations in [202603120001_core_schema.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603120001_core_schema.sql)
- auth/RLS in [202603120002_auth_and_rls.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603120002_auth_and_rls.sql)
- platform hardening in [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql)
- review fixes in [202603280001_review_fixes.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603280001_review_fixes.sql)
- static role/building/workflow data in:
  - [bots.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\bots.js)
  - [buildings.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\buildings.js)
  - [workflows.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\workflows.js)
- a serverless chat implementation in [chat.js](C:\Users\DovBraun\Documents\New project\v2_definitive\api\chat.js)

### The repo does not currently have:

- a frontend scaffold in this workspace
- a `package.json`
- a `vite.config`
- a React app shell
- a production-ready Supabase-backed context view in the `public` schema that matches what `api/chat.js` expects

## The Correct Build Strategy For Tonight

### Tonight's target

Build a working internal bot app end-to-end using:

- frontend scaffold
- serverless chat API
- static role/building/workflow fallbacks

Then make Supabase integration the next layer.

This is the fastest path that still respects the architecture.

## Why This Is The Right Path

If you try to fully reconcile the `public` production schema and the `ihcm_bot` standalone schema tonight, you will burn time on schema translation instead of getting a working product in front of your team.

The static data path is enough to get:

- 5 role engines
- building-aware prompting
- workflow-specific drafting
- a usable internal tool

The governed data layer can then be wired in safely.

## Required Technical Decisions

### 1. Frontend

Build a fresh React + Vite frontend in this repo or in a dedicated app repo.

Minimum files needed:

- `package.json`
- `vite.config.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`
- `src/index.css`
- `src/storage.js`

### 2. API

Use [chat.js](C:\Users\DovBraun\Documents\New project\v2_definitive\api\chat.js) as the starting serverless function, but do not assume the Supabase queries are valid against the production migrations.

For tonight:

- keep static fallback as the primary path
- treat Supabase reads as optional
- do not block the build on `ihcm_bot.v_building_context`

### 3. Database

If using Supabase tonight, run only:

1. [202603120001_core_schema.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603120001_core_schema.sql)
2. [202603120002_auth_and_rls.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603120002_auth_and_rls.sql)
3. [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql)
4. [202603280001_review_fixes.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603280001_review_fixes.sql)
5. [seed.sql](C:\Users\DovBraun\Documents\New project\supabase\seed.sql)

Do not run `v2_definitive/schema.sql` into the same database tonight.

## Critical Fixes Claude Should Apply While Building

### Fix 1. Treat `v2_definitive` data as application config, not DB truth

Use:

- [bots.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\bots.js)
- [buildings.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\buildings.js)
- [workflows.js](C:\Users\DovBraun\Documents\New project\v2_definitive\src\workflows.js)

as the runtime source for:

- tabs
- role prompts
- building context fallback
- workflow contracts

### Fix 2. Do not block on `ihcm_bot` namespace queries

In [chat.js](C:\Users\DovBraun\Documents\New project\v2_definitive\api\chat.js), the `ihcm_bot` queries should be considered optional.

Claude should:

- preserve static fallback behavior
- avoid making the app fail if Supabase context reads do not resolve
- make the widget work first with the JS fallback data

### Fix 3. Do not claim auth is enforced if the API uses service role without user verification

If the serverless function uses `SUPABASE_SERVICE_KEY`, it must not be described as user-scoped or RLS-enforced unless Claude also adds user authentication and verifies the caller server-side.

For tonight:

- internal-only scaffold is acceptable
- but Claude should label it as pre-auth
- do not pretend the API path is protected by RLS if it bypasses it

### Fix 4. Keep conversation persistence local for tonight unless server-side auth is added

The migrations support:

- `conversations`
- `conversation_messages`
- `workflow_runs`
- `draft_outputs`

But unless auth and caller identity are wired correctly, do not rush server-side persistence tonight.

For tonight:

- local browser persistence is acceptable
- server-side persistence should be the next layer

## The 10X Bot MVP

To make this genuinely useful for your team, Claude should build these first-class workflows:

### Regional

- building comparison brief
- turnaround priority memo
- market opportunity memo

### Administrator

- 30/60/90-day census growth plan
- referral repair plan
- board summary memo

### DON

- plan of correction draft
- staff education plan
- QAPI / PDSA draft

### MDS

- PDPM / NTA guidance
- Section GG coaching
- skilled documentation check

### Billing

- denial appeal draft
- denial pattern analysis
- auth cut response plan

## Required UI For Tonight

Minimum working UI:

- 5 role tabs
- building selector
- workflow selector
- draft mode toggle
- message thread
- starter prompts
- local history restore

Do not overbuild dashboards tonight.

## What Claude Should Defer Until Next Layer

- real Supabase context retrieval from `public` schema
- auth-enforced conversation storage
- review queue UI
- knowledge ingestion workflow
- vector retrieval
- rate limiting
- production analytics

## The Right Next Integration Layer After Tonight

After the widget is working:

1. create a `public.v_bot_building_context` view over the production tables
2. adapt `api/chat.js` to query that view instead of `ihcm_bot.v_building_context`
3. add authenticated user verification in the API
4. start writing conversations and workflow runs server-side
5. wire in governed knowledge sources and promoted artifacts

## Exact Instruction For Claude

Use this as the prompt:

```text
Build the IHCM AI Bot Widget tonight as a working internal scaffold.

Source of truth for the production database is the `supabase/migrations/` path, not `v2_definitive/schema.sql`.

For tonight:
- scaffold a fresh React + Vite frontend in this repo
- use `v2_definitive/api/chat.js` as the starting API
- use `v2_definitive/src/bots.js`, `v2_definitive/src/buildings.js`, and `v2_definitive/src/workflows.js` as the runtime fallback data
- make the app work even if Supabase context queries fail or are absent
- do not block the build on `ihcm_bot` namespace tables or views
- do not claim auth/RLS protects the API path unless you add real user auth on the server

Build a polished internal widget with:
- 5 role tabs
- building selector
- workflow selector
- draft mode
- local history persistence
- starter prompts
- working POST /api/chat integration

Prioritize these workflows:
- DON: Plan of Correction, staff education, QAPI
- MDS: PDPM/NTA/GG/skilled documentation
- Billing: denial appeal, denial analysis
- Admin: census growth, referral plan, board memo
- Regional: building comparison, turnaround memo

Defer full Supabase integration, server-side persistence, review queue UI, and vector retrieval to the next phase.
```

## Bottom Line

Tonight's success condition is not "fully governed platform complete."

Tonight's success condition is:

- a working role-aware widget
- with building-aware prompting
- workflow-specific drafting
- and a clean path to plug into the production schema next

That is the fastest path to a real 10X tool for your team.
