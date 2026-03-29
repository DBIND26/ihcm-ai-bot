# IHCM AI Command Center Backend Scaffold

This repository now contains the database foundation for launching the IHCM AI Command Center on Supabase/Postgres.

## Included

- Core schema migration: [supabase/migrations/202603120001_core_schema.sql](supabase/migrations/202603120001_core_schema.sql)
- Supabase auth/RLS migration: [supabase/migrations/202603120002_auth_and_rls.sql](supabase/migrations/202603120002_auth_and_rls.sql)
- Platform hardening migration: [supabase/migrations/202603270001_platform_hardening.sql](supabase/migrations/202603270001_platform_hardening.sql)
- Seed data: [supabase/seed.sql](supabase/seed.sql)
- Standalone schema draft/reference: [ihcm_ai_command_center_schema_v1_1.sql](ihcm_ai_command_center_schema_v1_1.sql)

## What This Gets You

- A normalized operational schema for facilities, episodes, MDS, staffing, incidents, reimbursement, alerts, and daily briefs
- API-friendly views for command-center dashboards
- Supabase-native user bootstrap from `auth.users`
- Role-aware, domain-gated row-level security (minimum-necessary enforcement)
- Immutable, server-stamped audit event log
- Platform intelligence tables: knowledge sources, conversations, workflow runs, draft outputs, feedback, review queue, promoted artifacts
- Realistic seed data for the seven example facilities

## What Is Still Outside This Repo

- The Supabase CLI is not installed in this workspace
- No frontend or backend application code has been created yet
- No ETL/import jobs exist yet for your source systems
- No monitoring, backups, or deployment automation has been configured yet

## Launch Steps

1. Install the Supabase CLI on the machine where you want to run/deploy this.
2. Create a Supabase project.
3. Point this repo at that project.
4. Run the migrations in order.
5. Load the seed data.
6. Sign in once with your first admin account.
7. Promote that first user to an admin using the SQL editor or a service-role connection.

Example bootstrap SQL for the first admin:

```sql
UPDATE public.user_profiles
SET app_role = 'super_admin',
    global_access_level = 'admin'
WHERE email = 'you@example.com';
```

After that, assign facility access as needed:

```sql
INSERT INTO public.user_facility_access (user_id, facility_id, access_level)
VALUES ('<auth-user-uuid>', '11111111-1111-1111-1111-111111111111', 'admin');
```

## Suggested Execution Flow

For hosted Supabase:

1. Run [supabase/migrations/202603120001_core_schema.sql](supabase/migrations/202603120001_core_schema.sql)
2. Run [supabase/migrations/202603120002_auth_and_rls.sql](supabase/migrations/202603120002_auth_and_rls.sql)
3. Run [supabase/migrations/202603270001_platform_hardening.sql](supabase/migrations/202603270001_platform_hardening.sql)
4. Run [supabase/seed.sql](supabase/seed.sql)

**All three migrations are required.** Migration 3 rewrites RLS policies to enforce role-based minimum-necessary access and adds the platform intelligence tables. Deploying without it leaves the weaker facility-only access model in place.

For local Supabase CLI workflows, place these files into your initialized Supabase project and use the normal migration/seed commands for your environment.

## Recommended Next Build Items

1. Add a small backend service or Edge Functions layer for privileged workflows like AI alert generation and daily brief generation.
2. Define import pipelines for staffing, MDS, incident, and reimbursement feeds.
3. Add automated tests that validate the migrations, views, and RLS policies against a disposable Postgres database.
4. Build the command-center UI and wire it to the views plus table endpoints.
