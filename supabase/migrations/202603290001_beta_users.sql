-- IHCM AI Command Center
-- Migration 6: Beta user identity for pre-auth phase
--
-- The platform tables (conversations, feedback_events, workflow_runs) require
-- user_id FK → auth.users. Since the app uses a shared beta password instead
-- of Supabase Auth, we need a lightweight user identity layer.
--
-- This migration:
--   1. Creates beta_users table for beta tester identity
--   2. Drops auth.users FK constraints on platform tables
--   3. Drops auth.uid()-dependent triggers that fail with service key
--   4. Adds beta_users FKs as replacements
--
-- When migrating to full Supabase Auth:
--   1. Create auth.users entries for each beta user
--   2. Re-point FKs back to auth.users
--   3. Re-enable the stamp_user_id triggers
--
-- Depends on:
--   202603270001_platform_hardening.sql (conversations, feedback_events, workflow_runs)
--   202603280001_review_fixes.sql (stamp_user_id triggers, lineage triggers)

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Beta users table
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.beta_users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_name   TEXT NOT NULL UNIQUE,
    role_hint   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.beta_users IS
    'Lightweight user identity for pre-auth beta phase. '
    'Will be replaced by auth.users entries when Supabase Auth is enabled.';

-- Service role needs full access; no RLS needed (only accessed server-side)
ALTER TABLE public.beta_users ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.beta_users TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Drop auth.uid()-dependent triggers
-- ════════════════════════════════════════════════════════════════════════════
-- These triggers call auth.uid() which returns NULL when using the service key,
-- causing NOT NULL violations on user_id columns.

DROP TRIGGER IF EXISTS trg_conversations_stamp_user ON public.conversations;
DROP TRIGGER IF EXISTS trg_workflow_runs_stamp_user ON public.workflow_runs;
DROP TRIGGER IF EXISTS trg_workflow_run_lineage ON public.workflow_runs;
DROP TRIGGER IF EXISTS trg_feedback_ownership_check ON public.feedback_events;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Replace auth.users FKs with beta_users FKs on platform tables
-- ════════════════════════════════════════════════════════════════════════════

-- conversations.user_id
ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE public.conversations
    ADD CONSTRAINT conversations_user_id_beta_fkey
    FOREIGN KEY (user_id) REFERENCES public.beta_users(user_id);

-- workflow_runs.user_id
ALTER TABLE public.workflow_runs
    DROP CONSTRAINT IF EXISTS workflow_runs_user_id_fkey;
ALTER TABLE public.workflow_runs
    ADD CONSTRAINT workflow_runs_user_id_beta_fkey
    FOREIGN KEY (user_id) REFERENCES public.beta_users(user_id);

-- feedback_events.user_id
ALTER TABLE public.feedback_events
    DROP CONSTRAINT IF EXISTS feedback_events_user_id_fkey;
ALTER TABLE public.feedback_events
    ADD CONSTRAINT feedback_events_user_id_beta_fkey
    FOREIGN KEY (user_id) REFERENCES public.beta_users(user_id);

-- knowledge_sources.owner_user_id and approver_user_id (leave as-is for now,
-- these are nullable and won't be used during beta)

-- conversation_messages inherits via conversation_id cascade, no user_id FK to change

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Relax RLS on platform tables for service_role beta usage
-- ════════════════════════════════════════════════════════════════════════════
-- The existing RLS policies use auth.uid() which returns NULL for service_role.
-- Service role bypasses RLS by default in Supabase, so these tables are already
-- accessible. No changes needed here — but noting for documentation.

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Grants
-- ════════════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_users TO service_role;

COMMIT;
