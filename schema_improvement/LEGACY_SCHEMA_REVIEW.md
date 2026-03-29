# Legacy Schema Review

## Executive Summary

The legacy schema can be improved substantially. Its biggest problems are:

- duplicated sources of truth
- inconsistent user identity references
- excessive JSONB and array storage for core entities
- uncontrolled text fields for statuses and types
- derived values stored in ways that can drift
- backup tables mixed into the live application schema

The schema is trying to support several product areas at once:

- coaching
- board sessions
- commitments and growth scoring
- executive intelligence
- QA reviews

Those are all valid domains, but the current model mixes transactional records, analytics snapshots, and archival copies in the same layer.

## Highest-Risk Problems

### 1. Two competing session systems

You have:

- normalized session tables such as `coaching_sessions`, `messages`, `commitments`, `growth_scores`
- a second giant aggregate record in `sessions`

That creates ambiguity about where the source of truth lives for:

- messages
- commitments
- insights
- rocks
- scorecards
- board logs
- sage threads

Recommendation:

- keep normalized tables
- deprecate `public.sessions`
- move any still-needed cached aggregates into views or materialized views

### 2. Identity is inconsistent

Different tables reference:

- `public.profiles(id)`
- `auth.users(id)`
- `profiles.user_id`
- `user_email`

This will create duplicate joins, stale emails, and hard-to-reason-about authorization.

Recommendation:

- make `profiles.id` the same as `auth.users.id`
- reference `profiles(id)` from app tables
- keep `user_email` only if it is intentionally a historical snapshot

### 3. Arrays are hiding relationships

The schema uses arrays for things that are relational:

- `board_sessions.sages_involved`
- `profiles.coach_access`
- `insights.tags`
- `rocks.risk_factors`

Recommendation:

- replace arrays with child tables for filtering, joining, and uniqueness control

### 4. Core status fields are loose text

Many business-critical fields are plain `text` with no guardrails:

- `status`
- `priority`
- `mode`
- `coach`
- `brief_type`
- `run_type`
- `severity`
- `source_type`

Recommendation:

- use enums or `CHECK` constraints
- keep the allowed values centralized and explicit

### 5. Derived data can drift

`growth_scores.composite_score` is defined with a `DEFAULT` expression. That computes once on insert, not automatically on future updates to component scores.

Recommendation:

- use a generated stored column
- or compute it in a view
- or maintain it with a trigger

### 6. Backup tables are in the app schema

These should not live beside application tables:

- `sessions_backup`
- `sessions_backup_march16`
- `sessions_backup_march22`
- `sessions_backup_march23`

Recommendation:

- move them to a `backup` schema
- or export them outside the production app database

## Table-by-Table Direction

### Keep and refine

- `profiles`
- `coaching_sessions`
- `messages`
- `commitments`
- `growth_scores`
- `insights`
- `rocks`
- `scorecard_entries`
- `board_sessions`
- `intelligence_runs`
- `intelligence_insights`
- `ceo_briefs`
- `qa_runs`
- `qa_bugs`
- `team_intelligence`
- `user_signals`

### Replace or reshape

- `sessions` -> replace with normalized tables plus views
- `profiles.coach_access` -> replace with `profile_coach_access`
- `board_sessions.sages_involved` -> replace with `board_session_sages`
- `insights.tags` -> replace with `insight_tags`
- `rocks.risk_factors` -> replace with `rock_risk_factors`

### Deprecate from the live model

- all `sessions_backup*` tables

## Recommended Target Architecture

Split the model into five layers:

### 1. Identity and access

- `profiles`
- `profile_coach_access`

### 2. Coaching workflow

- `coaching_sessions`
- `session_messages`
- `commitments`
- `growth_assessments`
- `insights`
- `insight_tags`

### 3. Planning and execution

- `rocks`
- `rock_risk_factors`
- `scorecard_entries`
- `issues`

### 4. Board workflow

- `board_sessions`
- `board_session_sages`

### 5. Intelligence and QA

- `intelligence_runs`
- `intelligence_insights`
- `executive_briefs`
- `team_reports`
- `user_signal_snapshots`
- `qa_runs`
- `qa_bugs`

## Rules the New Schema Should Follow

1. One table owns each fact.
2. Application tables reference one canonical user key.
3. Emails are profile data, not foreign-key substitutes.
4. Arrays are used only for truly unordered payloads that never need joins.
5. JSONB is used only for flexible payloads, not primary domain structure.
6. Derived values are generated, not manually copied.
7. Backups are not part of the live app schema.
8. Every foreign key that supports filtering or joins gets an index.

## Quick Wins Before a Full Rebuild

- add `CHECK` constraints for status and type columns
- add missing indexes on foreign keys and common query paths
- stop writing new data into `sessions`
- stop writing `user_email` redundantly unless snapshot semantics are required
- convert `growth_scores.composite_score` to generated logic in the next migration
- move backup tables out of `public`
