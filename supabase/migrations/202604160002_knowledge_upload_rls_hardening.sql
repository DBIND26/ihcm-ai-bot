-- ============================================================================
-- Knowledge upload RLS hardening: explicit storage.objects policy for the
-- knowledge-uploads bucket and a tighter policy on knowledge_assets so that
-- direct reads respect the same scope as the parent knowledge_source.
--
-- Background: migration 202604160001 created the bucket with public=false
-- but did not add any storage.objects policies. With RLS enabled, that
-- implicitly denies client reads/writes, which is safe today but fragile --
-- a future migration could add a permissive policy inadvertently. This
-- migration makes the access model explicit: authenticated SELECT is gated
-- by access to the owning knowledge_source, and all writes continue to go
-- through the server (service_role bypasses RLS).
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS knowledge_uploads_select ON storage.objects;
CREATE POLICY knowledge_uploads_select
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'knowledge-uploads'
        AND EXISTS (
            SELECT 1
            FROM public.knowledge_assets ka
            JOIN public.knowledge_sources ks ON ks.source_id = ka.source_id
            WHERE ka.storage_bucket = 'knowledge-uploads'
              AND ka.storage_path = storage.objects.name
              AND (
                  public.current_user_can_domain('knowledge')
                  OR ks.owner_user_id = auth.uid()
                  OR (
                      ks.status = 'approved'
                      AND (
                          (ks.facility_id IS NOT NULL AND public.can_access_facility(ks.facility_id))
                          OR (ks.facility_id IS NULL AND public.can_view_portfolio())
                      )
                  )
              )
        )
    );

-- No INSERT/UPDATE/DELETE policies for authenticated on this bucket by design:
-- all uploads, updates, and deletes go through server handlers using the
-- service_role key, which bypasses RLS. If a client-upload path is added
-- later, add explicit INSERT/UPDATE/DELETE policies scoped by can_access_facility
-- on the target source.

-- Tighten knowledge_assets_select to mirror storage access rules instead of
-- just checking parent-exists. The previous policy was effectively permissive
-- (any row in knowledge_sources satisfied it) and relied on knowledge_sources
-- RLS chaining through the subquery. This rewrites it explicitly so the asset
-- metadata (including extracted_text) respects the same scope as the file.
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
              AND (
                  public.current_user_can_domain('knowledge')
                  OR ks.owner_user_id = auth.uid()
                  OR (
                      ks.status = 'approved'
                      AND (
                          (ks.facility_id IS NOT NULL AND public.can_access_facility(ks.facility_id))
                          OR (ks.facility_id IS NULL AND public.can_view_portfolio())
                      )
                  )
              )
        )
    );

COMMIT;
