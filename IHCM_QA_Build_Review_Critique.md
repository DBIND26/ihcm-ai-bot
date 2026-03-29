# IHCM QA Build Review Critique

## Findings

### [P1] `knowledge_versions` is not actually immutable

The QA review describes `knowledge_versions` as "Immutable version history per knowledge source," but the hardening migration grants full mutation rights to knowledge users. `knowledge_versions_manage` is `FOR ALL`, and authenticated users also receive `UPDATE` and `DELETE` grants on the table. That means version history can be rewritten or erased, which breaks the auditability story this table is meant to provide.

References:

- [IHCM_QA_Build_Review_extracted.txt](C:\Users\DovBraun\Documents\New project\IHCM_QA_Build_Review_extracted.txt:191)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:614)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:618)

Recommended fix:

- change the policy to `INSERT` and `SELECT` only
- revoke `UPDATE` and `DELETE` from `authenticated`
- treat version rows as append-only forever
- if content must change, create a new version row and update `knowledge_sources.current_version`

### [P1] `conversations` and `workflow_runs` do not validate facility scope or lineage integrity

The ownership RLS on `conversations` and `workflow_runs` checks only `auth.uid() = user_id`. It does not verify that:

- the chosen `facility_id` is one the user can access
- the `conversation_id` on a workflow run belongs to the same user
- the workflow run's facility matches the linked conversation when both are present

That leaves room for inconsistent lineage and lets users create records tied to facilities outside their scope, even if they cannot later read facility data. This is the kind of integrity gap that becomes painful once orchestration and analytics are added.

References:

- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:645)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:686)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:710)

Recommended fix:

- add `WITH CHECK` requirements that `facility_id IS NULL OR can_access_facility(facility_id)`
- add a trigger on `workflow_runs` to verify `conversation_id` belongs to the same `user_id`
- if both `workflow_runs.facility_id` and `conversations.facility_id` exist, require them to match
- consider stamping `user_id` server-side on insert instead of trusting the client

### [P1] Draft approval can be self-forged by the draft owner

`draft_outputs` has approval fields (`status`, `approved_by`, `approved_at`), but the only write policy is the owner's `FOR ALL` policy inherited from the workflow run owner. That means a user can mark their own draft as `approved` and set `approved_by` arbitrarily. This undermines the governance model the build review claims is being established.

References:

- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:721)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:744)
- [IHCM_QA_Build_Review_extracted.txt](C:\Users\DovBraun\Documents\New project\IHCM_QA_Build_Review_extracted.txt:205)

Recommended fix:

- split policies into owner-editable fields versus reviewer-only approval fields
- prevent owners from setting `status IN ('approved','rejected','exported')`
- stamp `approved_by` and `approved_at` in a reviewer-only function or trigger
- route approval changes through the review queue or a privileged service path

### [P2] `knowledge_manager` is broader than the comment implies and weakens minimum-necessary

The comment says knowledge managers can operate the review queue and knowledge base without being admins, but the actual domain mapping also grants `clinical`, `mds`, and `reimbursement`. That is much broader than a pure governance role and reintroduces minimum-necessary concerns for a role that sounds like it should manage knowledge, not read raw operational domains.

References:

- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:40)
- [202603270001_platform_hardening.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603270001_platform_hardening.sql:41)

Recommended fix:

- narrow `knowledge_manager` to `knowledge` and possibly `briefs`
- if reviewers truly need operational context, expose reviewed or redacted artifacts instead of raw tables
- document this role explicitly in the blueprint and auth migration

## Documentation Accuracy Issue

The build review says `ai_alerts` has 5 severity levels, but the core schema defines 4: `low`, `medium`, `high`, `critical`. This is minor compared with the schema issues above, but it is still review drift that can confuse QA.

References:

- [IHCM_QA_Build_Review_extracted.txt](C:\Users\DovBraun\Documents\New project\IHCM_QA_Build_Review_extracted.txt:69)
- [202603120001_core_schema.sql](C:\Users\DovBraun\Documents\New project\supabase\migrations\202603120001_core_schema.sql:200)

Recommended fix:

- correct the QA build review document
- add a migration verification script so documentation claims can be generated from the schema instead of maintained manually

## Suggested Next Fix Sequence

1. Make `knowledge_versions` append-only.
2. Add facility and conversation lineage validation for `conversations` and `workflow_runs`.
3. Split draft ownership from draft approval authority.
4. Tighten the `knowledge_manager` role.
5. Regenerate the QA review doc from the actual schema where possible.

## Bottom Line

The review document is mostly honest about the build being a scaffold, and that is good. The database foundation is solid enough to continue from. But before you build the app layer on top of it, you should close the governance and integrity gaps above so the platform's trust model is real, not just well-described.
