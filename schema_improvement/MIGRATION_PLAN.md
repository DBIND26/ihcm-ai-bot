# Migration Plan

## Goal

Move from the legacy mixed relational and JSONB design to a normalized v2 schema without losing data or breaking reporting.

## Phase 0: Freeze the Data Contract

Before changing structure:

1. Decide which tables are authoritative today.
2. Stop adding new features on top of `public.sessions`.
3. Document every writer that touches:
   - `sessions`
   - `coaching_sessions`
   - `messages`
   - `commitments`
   - `growth_scores`
   - `profiles`

The main decision:

- treat normalized tables as the source of truth
- treat `sessions` as a legacy aggregate cache to be retired

## Phase 1: Harden the Legacy Schema

Apply low-risk improvements first:

- add missing indexes
- add `CHECK` constraints for controlled vocabulary fields
- add timestamp consistency checks
- make array element types explicit if they stay temporarily
- move backup tables to a `backup` schema

Use `legacy_hardening.sql` as a draft for this phase.

## Phase 2: Create v2 Tables Beside the Old Ones

Create new normalized tables without immediately dropping old ones.

New tables to introduce first:

- `profile_coach_access`
- `session_messages`
- `growth_assessments`
- `insight_tags`
- `rock_risk_factors`
- `board_session_sages`
- `user_signal_snapshots`
- `team_reports`

Tables to keep but reshape or rename later:

- `coaching_sessions`
- `commitments`
- `insights`
- `rocks`
- `ceo_briefs`

## Phase 3: Backfill New Structures

Backfill child tables from arrays and duplicate fields.

Examples:

- explode `profiles.coach_access` into `profile_coach_access`
- explode `board_sessions.sages_involved` into `board_session_sages`
- explode `insights.tags` into `insight_tags`
- explode `rocks.risk_factors` into `rock_risk_factors`

Then backfill any still-needed denormalized fields from the normalized source tables.

## Phase 4: Switch Reads

Update application reads in this order:

1. read from normalized child tables instead of arrays
2. read from `session_messages` instead of embedded JSONB in `sessions`
3. read from views for aggregate dashboards
4. confirm reporting parity with the old model

Recommended compatibility pattern:

- add views with legacy-friendly names if the app needs a gradual transition

## Phase 5: Switch Writes

Update write paths so that:

- no new writes go to `sessions`
- all session messages go to `session_messages`
- all tag and access relationships go to child tables
- analytics snapshots are written only by scheduled jobs

During this phase, keep read-only compatibility views if needed.

## Phase 6: Deprecate Legacy Tables

After parity checks:

1. stop querying `sessions`
2. archive `sessions`
3. archive `sessions_backup*`
4. drop legacy compatibility views only after application code no longer depends on them

## Recommended Data Ownership After Migration

### Transactional tables

- `profiles`
- `coaching_sessions`
- `session_messages`
- `commitments`
- `growth_assessments`
- `insights`
- `rocks`
- `scorecard_entries`
- `issues`
- `board_sessions`

### Relationship tables

- `profile_coach_access`
- `insight_tags`
- `rock_risk_factors`
- `board_session_sages`

### Computed or scheduled outputs

- `intelligence_runs`
- `intelligence_insights`
- `executive_briefs`
- `team_reports`
- `user_signal_snapshots`
- `qa_runs`
- `qa_bugs`

### Deprecated

- `sessions`
- `sessions_backup`
- `sessions_backup_march16`
- `sessions_backup_march22`
- `sessions_backup_march23`

## Legacy to V2 Mapping

- `profiles` -> `profiles` plus `profile_coach_access`
- `coaching_sessions` -> `coaching_sessions`
- `messages` -> `session_messages`
- `commitments` -> `commitments`
- `growth_scores` -> `growth_assessments`
- `insights` -> `insights` plus `insight_tags`
- `issues` -> `issues`
- `rocks` -> `rocks` plus `rock_risk_factors`
- `scorecard_entries` -> `scorecard_entries`
- `board_sessions` -> `board_sessions` plus `board_session_sages`
- `intelligence_runs` -> `intelligence_runs`
- `intelligence_insights` -> `intelligence_insights`
- `ceo_briefs` -> `executive_briefs`
- `team_intelligence` -> `team_reports`
- `user_signals` -> `user_signal_snapshots`
- `qa_runs` -> `qa_runs`
- `qa_bugs` -> `qa_bugs`
- `sessions` -> deprecated, replaced by normalized tables and reporting views

## Suggested Migration Sequence for Claude

If you want Claude to help execute this, the cleanest order is:

1. Review `schema_v2_proposal.sql` and confirm naming conventions.
2. Generate a delta migration from the live schema to the proposed v2 shape.
3. Generate data backfill SQL for array-to-child-table moves.
4. Generate compatibility views for old application reads.
5. Generate a final cleanup migration that archives and drops deprecated tables.

## Validation Checklist

- every FK has an index
- every controlled text field has an enum or `CHECK`
- every duplicated email field has a documented reason
- every JSONB field has a clear justification
- no live workflow depends on `sessions`
- reporting results match before and after cutover
