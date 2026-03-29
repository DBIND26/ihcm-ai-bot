# IHCM Live Beta Test Report

Date: 2026-03-28

Live URL tested:

- `https://ihcm-ai-bot.vercel.app/`

## Beta Verdict

The live app appears healthy enough for a controlled internal beta.

I was able to verify:

- the deployed app shell loads from Vercel
- the API responds in production
- multiple role engines return role-appropriate answers
- building-specific context is being applied at least at a basic level
- workflow/draft mode returns structured output

This is good enough for an internal pilot.

It is not yet a fully governed production platform.

## What I Tested

### Deployment shell

- homepage returned `200 OK`
- Vercel served the HTML shell and JS/CSS assets successfully

### API checks

I sent lightweight production requests to:

- DON
- Billing
- Regional
- Regional with `buildingId='crossett'`
- DON with `workflowId='poc_drafter'` and draft mode

### What happened

- DON returned focused falls-prevention guidance
- Billing correctly recognized `CO-96`
- Regional returned portfolio comparison-style guidance
- Crossett-specific prompt referenced turnaround priority and focused next steps
- Draft workflow returned a structured Plan of Correction-style document

## What This Means

The core value proposition is already visible:

- role-aware answers
- building-aware answers
- workflow-specific drafting

That is enough to start learning from a small team pilot.

## Highest-Priority Next Steps

### 1. Fill the building profiles with real strategic content

Right now the live behavior suggests the bot has some building identity and strategic labels, but not a deep operating knowledge layer yet.

Priority:

- add real payer context
- add referral notes
- add growth barriers
- add growth opportunities
- add survey/staffing/reimbursement context
- add freshness dates and owners

### 2. Add lightweight access control before broad sharing

The app is live and usable, but if access is still URL-based and the API is using a server-side service key without caller verification, this should be treated as an internal beta, not a fully secured rollout.

Minimum next step:

- simple password gate or magic-link auth

### 3. Add rate limiting

Because every message hits Anthropic, you should add a basic limit before larger rollout.

Minimum next step:

- per-IP or per-session throttling on `/api/chat`

### 4. Decide whether conversation history stays local or moves server-side

For beta, local browser history is fine.

For the next layer, if you want:

- audit
- feedback
- review queue
- learning loops

then you need authenticated server-side persistence using the `conversations` and `workflow_runs` tables from the production schema.

### 5. Use the production schema as the long-term backend

Keep:

- `supabase/migrations/*`

Treat as reference only:

- `v2_definitive/schema.sql`

The live widget can keep using the static config layer now, but the next integration should target the governed `public` schema.

### 6. Wire feedback into the product

Add simple buttons:

- useful
- not useful
- wrong
- needs review

This will help you improve prompts and workflows quickly.

## Important Technical Note

The current `v2_definitive/api/chat.js` still looks like a scaffolded context pipeline. It has static fallback data and optional Supabase reads, which is good for speed, but it should not be mistaken for full secure platform enforcement yet.

Two concrete next code tasks:

1. make the API explicitly authenticated before claiming RLS protection
2. add a production `public.v_bot_building_context` view and query that instead of relying on the standalone `ihcm_bot` path

## Recommended Rollout Shape

### Safe now

- founder use
- 2-5 trusted internal beta users
- guided role/workflow testing

### Wait until next build layer

- wider building admin rollout
- anything that implies secured auditability
- any claim that the platform is fully governed end-to-end

## Bottom Line

The live app is real, responsive, and already useful.

For a beta, that is a win.

The fastest way to make it a true 10X team tool now is:

1. enrich building context
2. add light access control
3. add feedback capture
4. then connect the widget to the governed production schema
