-- IHCM AI Command Center
-- Migration 10: Add allowed_bot_roles to user_profiles and prepare for Supabase Auth
--
-- The allowed_bot_roles column controls which bot role tabs a user can access.
-- This replaces the client-side getUserAccess() logic.

BEGIN;

-- Add allowed_bot_roles column
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS allowed_bot_roles TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.user_profiles.allowed_bot_roles IS
    'Which bot role tabs this user can access: don, mds, billing, admin, regional. '
    'Empty array = no access. Used by the frontend to show/hide role tabs.';

-- Repoint FKs from beta_users back to auth.users
-- (These were relaxed in migration 6 for the beta period)

ALTER TABLE public.conversations
    DROP CONSTRAINT IF EXISTS conversations_user_id_beta_fkey;

ALTER TABLE public.workflow_runs
    DROP CONSTRAINT IF EXISTS workflow_runs_user_id_beta_fkey;

ALTER TABLE public.feedback_events
    DROP CONSTRAINT IF EXISTS feedback_events_user_id_beta_fkey;

-- Don't add auth.users FKs yet — we'll do that after users are created
-- and existing conversation data is migrated.

COMMIT;
