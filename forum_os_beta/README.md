# YPO Forum OS Beta

This folder contains a self-contained beta foundation for a privacy-first YPO Forum Operating System.

The beta is designed for pilot testing in Supabase/Postgres and focuses on three trust zones:

- member private reflection
- forum facilitation
- chapter enablement

## What Is Included

- Core schema: [forum_os_beta/sql/202603130001_forum_os_beta_schema.sql](C:\Users\DovBraun\Documents\New project\forum_os_beta\sql\202603130001_forum_os_beta_schema.sql)
- Auth and row-level security: [forum_os_beta/sql/202603130002_forum_os_beta_auth_rls.sql](C:\Users\DovBraun\Documents\New project\forum_os_beta\sql\202603130002_forum_os_beta_auth_rls.sql)
- Pilot seed data: [forum_os_beta/sql/seed.sql](C:\Users\DovBraun\Documents\New project\forum_os_beta\sql\seed.sql)

## Beta Scope

This beta supports:

- chapter and forum setup
- chapter-scoped user profiles and forum memberships
- private member issue drafts and reflections
- moderator session setup and process-only notes
- moderator self-reviews after sessions
- chapter learning resources and training assignments
- minimum-threshold chapter process metrics

This beta intentionally does not include:

- transcript storage
- audio capture
- chapter-wide access to issue text
- member vulnerability scoring
- cross-forum issue sharing
- model training on Forum content

## Design Assumptions

- private issue and reflection content is stored as encrypted application payloads, not readable plaintext for chapter staff
- in-session facilitation data is process-only and can expire automatically
- chapter analytics are aggregate-only and should not be shown below a minimum cohort threshold
- chapter leaders can manage enablement data but cannot access private member reflection content

## Suggested Build Order

1. Run the schema migration.
2. Run the auth and RLS migration.
3. Load the seed data.
4. Create a few auth users in Supabase Auth.
5. Insert the first `forum_chair` or `privacy_admin` profile using the Supabase SQL editor or a service-role connection, then add the rest of the profiles and forum memberships using the examples in the seed file.
6. Test the RLS boundaries with member, moderator, and forum-chair accounts.

## Pilot Test Flows

### Member Flow

1. Member signs in.
2. Member creates a private issue draft.
3. Member adds a private pre-forum reflection.
4. Member confirms that only their own account can read those records.

### Moderator Flow

1. Moderator signs in.
2. Moderator opens an upcoming forum session.
3. Moderator adds process-only notes or parking-lot reminders.
4. Moderator completes a post-session self-review.

### Chapter Lead Flow

1. Forum chair or privacy admin signs in.
2. They manage learning resources and training assignments.
3. They review aggregate process metrics.
4. They confirm they cannot read private issue or reflection tables.

## Documents That Would Help Next

I can keep building without these, but these would materially improve the beta:

- chapter confidentiality wording or Forum handbook
- moderator funnel or moderator training guide
- issue-prep examples or member orientation materials
- desired pilot structure: number of forums, moderators, and members
- any legal/privacy requirements you want reflected in retention or consent UX

## Recommended Next Step

After you review this backend foundation, the best next move is either:

- build a small test UI on top of it, or
- add encrypted issue workflows and server-side APIs for AI-assisted feedback

The data model is intentionally narrow so we can test trust and behavior before expanding scope.
