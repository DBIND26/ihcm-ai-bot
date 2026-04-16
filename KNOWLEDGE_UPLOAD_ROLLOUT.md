# Knowledge Upload Governance — Rollout Guide

Deploys the governed document-upload flow (PDF / Word / Excel / PowerPoint / text / CSV) with a draft → review → approval workflow and one-click approval for regional_director and above.

## Activation Steps

### 1. Preflight in Supabase SQL Editor (read-only, ~2 min)

Run these queries before any migration. They surface the one real rollout risk: migration 1 tightens RLS on `building_profiles / building_surveys / building_events` from `USING (true)` to `can_access_facility(facility_id)`. Users without `user_facility_access` entries will lose reads on those tables.

```sql
-- (a) user_facility_access coverage by role
SELECT
    up.app_role,
    COUNT(*) FILTER (WHERE up.is_active) AS active_users,
    COUNT(*) FILTER (WHERE up.is_active AND ufa.user_id IS NOT NULL) AS with_facility_access,
    COUNT(*) FILTER (WHERE up.is_active AND ufa.user_id IS NULL) AS without_facility_access
FROM public.user_profiles up
LEFT JOIN (SELECT DISTINCT user_id FROM public.user_facility_access WHERE is_active) ufa
    ON ufa.user_id = up.user_id
GROUP BY up.app_role
ORDER BY up.app_role;

-- (b) bucket pre-existence
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'knowledge-uploads';

-- (c) existing storage.objects policies
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';

-- (d) migration 1 not-yet-applied sanity
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'knowledge_sources' AND column_name = 'approved_at';
-- expect: 0 rows
```

**Red flag:** any row in (a) where `without_facility_access > 0` for `regional_director` or `facility_admin`. Populate `user_facility_access` for those users before running migration 1, or accept that they will temporarily lose building-table reads until access rows are added.

### 2. Run the three migrations in Supabase SQL Editor, in order

Each migration is wrapped in `BEGIN / COMMIT` so a failure rolls that file back cleanly.

1. `supabase/migrations/202604160001_knowledge_upload_governance.sql` — knowledge_assets table, review_queue linkage, knowledge-uploads storage bucket, approved_at column, RLS tightening on building_*
2. `supabase/migrations/202604160002_knowledge_upload_rls_hardening.sql` — explicit storage.objects SELECT policy on knowledge-uploads, tighter knowledge_assets RLS
3. `supabase/migrations/202604160003_regional_knowledge_review.sql` — grants regional_director the `'knowledge'` domain

If migration 1 fails, stop and re-check preflight (b) and (d).

### 3. Merge the PR

Once all three migrations commit successfully:

- PR: `feat/knowledge-upload-governance`
- Squash-merge to `main`
- Vercel auto-deploys from `main` (first deploy ~1 min)

### 4. Smoke-test on prod

1. Sign in as a `regional_director`, `corporate_admin`, `knowledge_manager`, or `super_admin`.
2. Click **Add Playbook** in the header controls row.
3. Pick a small `.docx` or `.pdf`, fill in the title, click **Submit to Knowledge Base** → button flips to "Playbook queued".
4. Scroll to the Knowledge Base list at the bottom of the form → new row with a yellow `DRAFT` badge.
5. Click **Approve** → badge flips to green `APPROVED`.
6. Negative test (optional): as a regional_director, attempt to approve a source for a building outside your region → red banner: *"You can only review knowledge sources for facilities you have access to"*.

DB verification:

```sql
SELECT source_id, title, status, owner_user_id, approver_user_id, approved_at, current_version
FROM public.knowledge_sources ORDER BY updated_at DESC LIMIT 5;

SELECT review_id, item_type, status, submitted_by, reviewer_id, reviewed_at
FROM public.review_queue ORDER BY created_at DESC LIMIT 5;

SELECT asset_id, original_filename, mime_type, size_bytes, extraction_status, parser_used
FROM public.knowledge_assets ORDER BY created_at DESC LIMIT 5;
```

## How It Works

### Draft → review → approval flow

1. **Upload.** POST `/api/ingest-knowledge` (multipart) gated by `canSubmitKnowledge`. File is parsed server-side; extracted text + sha256 are stored in `knowledge_assets`; the original file lands in the `knowledge-uploads` storage bucket.
2. **Draft created.** `knowledge_sources` row with `status='draft'`, `approved_at=NULL`, `owner_user_id=<uploader>`. Invisible to non-reviewers / non-owners (RLS).
3. **Queued.** `review_queue` row with `item_type='knowledge_source'`, `status='pending'`.
4. **Approval.** PATCH `/api/ingest-knowledge` with `{source_id, status:'approved'}` by a reviewer. Handler snapshots the prior `full_content` into `knowledge_versions`, sets `status='approved'`, stamps `approver_user_id` and `approved_at`, and bumps `current_version`. Queue row flips to `approved` with `reviewer_id` and `reviewed_at`. The source is now readable by facility-scoped users via the approved branch of RLS.

### Who can approve

| Role              | Can submit | Can approve | Scope                           |
| ----------------- | ---------- | ----------- | ------------------------------- |
| super_admin       | yes        | yes         | anything                        |
| corporate_admin   | yes        | yes         | anything                        |
| knowledge_manager | yes        | yes         | anything                        |
| regional_director | yes        | **yes**     | only facilities in their region |
| facility_admin    | yes        | no          | —                               |
| don / mds_lead / billing / clinical_lead / read_only | varies | no | — |

Regional reviewers are scoped via `canApproveKnowledgeSource`: the handler runs a user-JWT query against `facilities` (RLS-enforced) before writing. Portfolio-scoped sources (`facility_id IS NULL`) can only be approved by super_admin / corporate_admin / knowledge_manager.

### Overwrite protection

If a submitter tries to re-upload with a title/type/facility/state that matches an already-approved source owned by someone else, the server returns **HTTP 409 `APPROVED_SOURCE_OVERWRITE`** with the `approved_source_id`. The submitter must change the title or ask a reviewer to archive the approved version first. This prevents a facility-level user from silently demoting approved content to draft.

### Storage access

The `knowledge-uploads` bucket is private (`public=false`). Authenticated reads are gated by an explicit `storage.objects` policy that joins through `knowledge_assets → knowledge_sources` and applies the same reviewer / owner / approved-in-scope rule as `knowledge_sources_select`. All writes go through server handlers using the service_role key; there are no client-side upload or delete policies.

### Supported formats

PDF, Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`), TXT, CSV.

**Not supported:** legacy `.doc`, `.xls`, `.ppt`. Users get a 400 with an explicit error if they try these.

File size limit: 20 MB (matched in `MAX_DOCUMENT_UPLOAD_BYTES` and the bucket's `file_size_limit`).

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/api/ingest-knowledge` | Submit a new knowledge source (JSON or multipart with file) |
| GET    | `/api/ingest-knowledge?status=draft&type=corporate_playbook&state=AR` | List knowledge sources (RLS-scoped) |
| PATCH  | `/api/ingest-knowledge` | Approve / archive / revert (`{source_id, status}`); scope-checked server-side |
| POST   | `/api/ingest-swot` | SWOT-specific upload path (auto-detects building, creates portfolio-scoped draft if none) |

## Known Beta Constraints

1. **No approval UI outside the playbook panel.** Approve/Archive buttons appear next to each knowledge row in the Add Playbook form's Knowledge Base list. The admin dashboard Knowledge tab is read-only. Reviewers currently use the playbook panel for one-click approval.

2. **Asset-storage failures are non-fatal.** If the file upload to storage or the `knowledge_assets` insert fails after the `knowledge_sources` row is created, the source still exists with extracted text. The API response carries a `warning` field. Submitter can re-upload; reviewer sees the source without a downloadable file.

3. **Multipart parser limitations.** Hand-rolled parser keeps only the last file part when multiple are sent in one request; no RFC 5987 encoded-filename support. Fine for the current single-file UI.

4. **Approval does not clean up superseded drafts.** If a reviewer approves a brand-new draft while an older approved row with the same identity (title + type + facility + state) still exists, both stay alive — the reviewer must archive the old one manually. The `upsertKnowledgeDraft` guard keeps submitters from creating this situation; reviewers can, by design.

5. **Re-uploading approved content re-queues for review.** If the content hash matches (identical content), the helper now returns `already_exists` with `reviewQueued: false` for `approved` sources — no reviewer spam. If the content differs, a reviewer must re-approve.

6. **RLS tightening on building_* is bundled with this rollout.** `building_profiles / building_surveys / building_events` SELECT policies move from `USING(true)` to `can_access_facility(facility_id)` in migration 1. This is strictly more secure but depends on `user_facility_access` being populated. See preflight (a).

## Rollback

Revert the merge on `main` → Vercel redeploys the previous bundle within ~1 minute.

Do **not** roll the DB back in the normal case — the new tables are additive, the tightened RLS is strictly safer than the old `USING(true)` it replaces, and the `knowledge` domain grant to `regional_director` only adds permission. Forward-fix via another migration or a targeted `UPDATE`.

If you truly need to revert the DB:

```sql
-- In reverse order. This removes access, not data.
DROP POLICY IF EXISTS knowledge_uploads_select ON storage.objects;
DROP POLICY IF EXISTS knowledge_assets_select ON public.knowledge_assets;
-- Restore the pre-202604160001 policies for knowledge_sources and building_*
-- from 202603270001_platform_hardening.sql and 202603290009_rls_select_policies.sql
-- manually. The old USING(true) policies on building_* were a tenant-isolation
-- bug; restoring them is a security regression -- do not do this lightly.
```

To roll back the `regional_director` knowledge grant specifically:

```sql
-- Re-deploy the role_allowed_domains function without 'knowledge' in the
-- regional_director array. See 202603280001_review_fixes.sql for the prior
-- body.
```
