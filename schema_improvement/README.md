# Legacy Schema Improvement Pack

This folder turns the legacy coaching and board schema into a concrete cleanup package.

Use the files in this order:

1. `LEGACY_SCHEMA_REVIEW.md`
2. `MIGRATION_PLAN.md`
3. `legacy_hardening.sql`
4. `schema_v2_proposal.sql`

What each file is for:

- `LEGACY_SCHEMA_REVIEW.md`: structural review of the pasted schema, with clear keep, replace, and deprecate guidance.
- `MIGRATION_PLAN.md`: phased migration plan from the legacy schema to a normalized design.
- `legacy_hardening.sql`: safe-ish improvement pass for the existing schema before a full rebuild.
- `schema_v2_proposal.sql`: a cleaner v2 schema draft you can evolve with Claude.

Important notes:

- The pasted schema was provided as context only, so the SQL here is a draft and should be reviewed before execution.
- The v2 proposal assumes Supabase Postgres with `auth.users(id)` as the canonical identity anchor.
- The proposal intentionally removes the wide `sessions` JSONB record and all backup tables from the application model.
