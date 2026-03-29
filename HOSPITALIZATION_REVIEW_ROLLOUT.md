# Hospitalization Review Tool — Rollout Guide

## Activation Steps

### 1. Run both migrations in Supabase SQL Editor (in order)
- `supabase/migrations/202603290010_hospitalization_reviews.sql` — creates table, indexes, RLS
- `supabase/migrations/202603290011_hosp_review_audit_fix.sql` — adds submitted_by, reviewed_at columns

### 2. Enable the UI (two code changes, then deploy)
- `src/components/Dashboard.jsx` line 5: change `SHOW_HOSPITALIZATIONS = false` to `true`
- `v2_definitive/src/workflows.js`: set `hidden: false` on all 4 workflows:
  - `hospitalization_review_don`
  - `hospitalization_review_admin`
  - `hospitalization_review_mds`
  - `hospitalization_review_regional`

### 3. Deploy
- Commit + push to trigger Vercel deploy

## Known Beta Constraints

1. **Access is API-enforced, not RLS-hardened** — the table RLS policies are `USING (true)` for all authenticated users. Role restriction (DON/Admin/MDS/Regional) is enforced in the API handler. No direct client queries exist, so this is safe for beta. Tighten RLS when `user_facility_access` is populated.

2. **Review/override is inline only** — after submitting a case, the AI result and confirm/override buttons appear in the chat area. Once the user navigates away or refreshes, there is no queue or history UI to revisit pending reviews. The backend supports `GET /api/hospitalization-review?building=<slug>` for listing, but the frontend doesn't expose it yet. Build a review panel when real usage patterns emerge.

3. **PHI protection is guardrail-based** — server-side regex checks reject obvious identifiers (SSN, DOB, MRN, room numbers, name+age patterns). This is a heuristic, not a guarantee. Users are responsible for not entering PHI. The PHI disclaimer is visible in the workflow form and chat input.

4. **AI classification is structured JSON** — Claude returns JSON with classification, reasoning, root causes, INTERACT pathway, prevention, and QI actions. If JSON parsing fails, the raw response is logged server-side and the user sees "AI analysis unavailable — please classify manually."

## How It Works

### For DON / Admin
1. Select DON or Admin role → enable Draft Mode or select "Hospitalization Review" workflow
2. Fill in the de-identified case details (transfer date, diagnosis, clinical indicators)
3. Submit → AI analyzes avoidability using CMS PAH criteria and INTERACT pathways
4. Review the AI classification → confirm or override with your determination
5. Result is saved to `hospitalization_reviews` table with both AI and final classifications

### For Regional
1. Same submission flow, but framed as portfolio intelligence
2. Dashboard shows hospitalization summary card (total, avoidable %, pending)
3. Stats endpoint provides breakdowns by building, category, time of day, month

### For MDS
1. Submission focused on documentation and assessment impact
2. Lighter input form (fewer optional fields)

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/hospitalization-review` | Submit case + get AI analysis |
| GET | `/api/hospitalization-review?mode=stats&building=<slug>&months=12` | Aggregate stats |
| GET | `/api/hospitalization-review?building=<slug>` | List reviews |
| PATCH | `/api/hospitalization-review` | Confirm/override AI determination |
