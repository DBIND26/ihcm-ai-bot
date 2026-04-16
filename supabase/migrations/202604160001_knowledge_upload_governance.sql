-- ============================================================================
-- Knowledge upload governance: document assets, approval timestamps, and queue
-- linkage for uploaded knowledge sources.
-- ============================================================================

BEGIN;

ALTER TABLE public.knowledge_sources
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.knowledge_sources.approved_at IS
    'Timestamp when the current approved version was approved. NULL for draft/in-review items.';

CREATE TABLE IF NOT EXISTS public.knowledge_assets (
    asset_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id            UUID NOT NULL REFERENCES public.knowledge_sources(source_id) ON DELETE CASCADE,
    storage_bucket       TEXT NOT NULL,
    storage_path         TEXT NOT NULL,
    original_filename    TEXT NOT NULL,
    mime_type            TEXT,
    file_ext             TEXT,
    size_bytes           BIGINT NOT NULL CHECK (size_bytes >= 0),
    sha256               TEXT,
    extracted_text       TEXT,
    extraction_status    TEXT NOT NULL DEFAULT 'completed'
                         CHECK (extraction_status IN ('pending', 'completed', 'failed')),
    parser_used          TEXT,
    created_by           UUID REFERENCES auth.users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_assets_source
    ON public.knowledge_assets(source_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_assets_source_path
    ON public.knowledge_assets(source_id, storage_bucket, storage_path);

ALTER TABLE public.knowledge_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_assets_select ON public.knowledge_assets;
CREATE POLICY knowledge_assets_select
    ON public.knowledge_assets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.knowledge_sources ks
            WHERE ks.source_id = knowledge_assets.source_id
        )
    );

DROP POLICY IF EXISTS knowledge_assets_insert_owner ON public.knowledge_assets;
CREATE POLICY knowledge_assets_insert_owner
    ON public.knowledge_assets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = created_by OR public.current_user_can_domain('knowledge')
    );

DROP POLICY IF EXISTS knowledge_assets_manage_reviewers ON public.knowledge_assets;
CREATE POLICY knowledge_assets_manage_reviewers
    ON public.knowledge_assets
    FOR UPDATE
    TO authenticated
    USING (public.current_user_can_domain('knowledge'))
    WITH CHECK (public.current_user_can_domain('knowledge'));

GRANT SELECT, INSERT, UPDATE ON public.knowledge_assets TO authenticated;
GRANT ALL ON public.knowledge_assets TO service_role;

DROP POLICY IF EXISTS knowledge_sources_select ON public.knowledge_sources;
CREATE POLICY knowledge_sources_select
    ON public.knowledge_sources
    FOR SELECT
    USING (
        public.current_user_can_domain('knowledge')
        OR owner_user_id = auth.uid()
        OR (
            status = 'approved'
            AND (
                (facility_id IS NOT NULL AND public.can_access_facility(facility_id))
                OR (facility_id IS NULL AND public.can_view_portfolio())
            )
        )
    );

ALTER TABLE public.review_queue
    ADD COLUMN IF NOT EXISTS knowledge_source_id UUID REFERENCES public.knowledge_sources(source_id);

CREATE INDEX IF NOT EXISTS idx_review_queue_knowledge_source
    ON public.review_queue(knowledge_source_id, created_at DESC)
    WHERE knowledge_source_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_queue_active_knowledge_source
    ON public.review_queue(knowledge_source_id)
    WHERE knowledge_source_id IS NOT NULL
      AND status IN ('pending', 'in_review', 'deferred');

ALTER TABLE public.review_queue
    DROP CONSTRAINT IF EXISTS review_queue_item_type_check;

ALTER TABLE public.review_queue
    ADD CONSTRAINT review_queue_item_type_check
    CHECK (item_type IN (
        'answer', 'draft', 'question_cluster', 'stale_source',
        'unsafe_output', 'knowledge_source'
    ));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'knowledge-uploads',
    'knowledge-uploads',
    false,
    20971520,
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
    ]::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS building_profiles_select ON public.building_profiles;
CREATE POLICY building_profiles_select
    ON public.building_profiles
    FOR SELECT
    TO authenticated
    USING (public.can_access_facility(facility_id));

DROP POLICY IF EXISTS building_surveys_select ON public.building_surveys;
CREATE POLICY building_surveys_select
    ON public.building_surveys
    FOR SELECT
    TO authenticated
    USING (public.can_access_facility(facility_id));

DROP POLICY IF EXISTS building_events_select ON public.building_events;
CREATE POLICY building_events_select
    ON public.building_events
    FOR SELECT
    TO authenticated
    USING (public.can_access_facility(facility_id));

COMMIT;
