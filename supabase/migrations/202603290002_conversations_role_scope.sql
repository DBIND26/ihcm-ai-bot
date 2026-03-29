-- IHCM AI Command Center
-- Migration 7: Add bot_id (role) column to conversations for role-scoped threads
--
-- Without this, a DON conversation can be auto-loaded when switching to Billing
-- for the same building, causing coherence bugs.

BEGIN;

ALTER TABLE public.conversations
    ADD COLUMN IF NOT EXISTS bot_id TEXT;

COMMENT ON COLUMN public.conversations.bot_id IS
    'The role/bot ID (don, mds, billing, admin, regional) that this conversation belongs to. '
    'Used to scope conversation loading by user + role + building.';

CREATE INDEX IF NOT EXISTS idx_conversations_user_bot
    ON public.conversations(user_id, bot_id, updated_at DESC);

COMMIT;
