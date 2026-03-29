-- IHCM AI Command Center
-- Migration 9: Knowledge source dedupe and approval support
--
-- Adds unique constraint to prevent duplicate knowledge sources
-- Adds content_hash for fast duplicate detection

BEGIN;

-- Add content hash column for dedupe
ALTER TABLE public.knowledge_sources
    ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Unique constraint: same title + type + state + facility = duplicate
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_source_identity
    ON public.knowledge_sources(title, source_type, COALESCE(state_code, ''), COALESCE(facility_id, '00000000-0000-0000-0000-000000000000'))
    WHERE status <> 'archived';

COMMENT ON COLUMN public.knowledge_sources.content_hash IS
    'MD5 hash of full_content for fast duplicate detection';

COMMIT;
