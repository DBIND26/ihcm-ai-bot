-- ============================================================================
-- IHCM AI Bot Widget v2 — Supabase/Postgres Schema
-- Architecture: layered context assembly
--   global core → role → building → intelligence → workflow → conversation
-- ============================================================================
-- Run this file against a fresh Supabase project (or any Postgres 15+ instance).
-- All tables use UUID primary keys and RLS-ready ownership columns.
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ────────────────────────────────────────────────────────────────────────────
-- 1. GLOBAL CORE
-- Org-wide identity, tone, safety rules, and shared prompt fragments.
-- These are injected into every request regardless of role or building.
-- ────────────────────────────────────────────────────────────────────────────

create table global_core (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,           -- e.g. 'identity', 'safety_rules', 'tone'
  label         text not null,
  content       text not null,                  -- prompt fragment (Markdown or plain text)
  sort_order    int not null default 0,         -- controls injection order
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text                            -- who last touched it
);

comment on table global_core is
  'Org-wide prompt fragments injected into every request. '
  'Examples: IHCM identity block, no-PHI rules, ask-before-drafting rules, '
  'assumption labeling policy, output safety rules.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. ROLES (role engines)
-- One row per audience. Each role carries a system prompt module,
-- decision framework, and links to its playbooks and workflows.
-- ────────────────────────────────────────────────────────────────────────────

create table roles (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,           -- 'mds', 'don', 'billing', 'admin', 'regional'
  tab_label     text not null,                  -- display label for the UI tab
  name          text not null,                  -- full display name
  avatar        text not null,                  -- 2-3 letter avatar initials
  color         text not null,                  -- hex accent color
  color_bg      text not null,                  -- hex background tint
  system_prompt text not null,                  -- role-specific prompt module
  decision_framework text,                      -- how this role makes decisions
  boundaries    text,                           -- "things this bot does not do"
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

comment on table roles is
  'One row per bot role. The system_prompt column holds the role-layer '
  'prompt fragment that sits between global core and building context.';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. ROLE PLAYBOOKS
-- Canonical knowledge owned by the organization, scoped to a role.
-- Examples: PDPM cheat sheet, denial appeal playbook, census growth SOP.
-- ────────────────────────────────────────────────────────────────────────────

create table role_playbooks (
  id            uuid primary key default uuid_generate_v4(),
  role_id       uuid not null references roles(id) on delete cascade,
  slug          text not null,
  title         text not null,
  content       text not null,                  -- full playbook text (Markdown)
  category      text,                           -- e.g. 'reimbursement', 'compliance', 'operations'
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (role_id, slug)
);

comment on table role_playbooks is
  'Canonical, durable, org-owned knowledge scoped to a role. '
  'Retrieved when the bot needs deeper reference material.';


-- ────────────────────────────────────────────────────────────────────────────
-- 4. BUILDINGS
-- Stable identity facts that rarely change.
-- ────────────────────────────────────────────────────────────────────────────

create table buildings (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,           -- 'arkadelphia', 'crossett', etc.
  label         text not null,                  -- 'Nightingale at Arkadelphia'
  short_name    text not null,                  -- 'Arkadelphia'
  state         text not null,                  -- 'AR', 'OH', 'PA'
  cms_id        text,                           -- CMS Provider ID
  bed_capacity  int,
  market_type   text,                           -- 'rural', 'suburban', 'urban'
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

comment on table buildings is
  'Stable building identity. Facts here change rarely (name, state, CMS ID, beds).';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. BUILDING PROFILES
-- Semi-stable strategic facts: strategic posture, referral map,
-- physician relationships, local market notes.
-- Review cadence: quarterly.
-- ────────────────────────────────────────────────────────────────────────────

create table building_profiles (
  id            uuid primary key default uuid_generate_v4(),
  building_id   uuid not null references buildings(id) on delete cascade,
  strategic_status  text not null default 'stable',  -- 'model', 'stable', 'watch', 'turnaround'
  strategic_identity text,                      -- e.g. 'THE MODEL BUILDING', 'HIGHEST PRIORITY TURNAROUND'
  referral_sources   text,                      -- key referral relationships (structured text or JSONB)
  physician_gaps     text,                      -- known physician relationship gaps
  hospital_partners  text,                      -- hospital partner relationships
  local_market_notes text,                      -- market context, competition, community
  payer_context      text,                      -- state-specific payer rules and nuances
  risk_watchlist     text,                      -- survey, staffing, collections, documentation, census
  opportunities      text,                      -- vent unit, network growth, skilled upside
  confidence    text default 'high',            -- 'high', 'medium', 'low'
  review_cadence text default 'quarterly',
  owner         text,                           -- who owns keeping this current
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (building_id)                          -- one active profile per building
);

comment on table building_profiles is
  'Semi-stable strategic context per building. Review quarterly. '
  'Includes referral map, strategic posture, payer context, risk watchlist.';


-- ────────────────────────────────────────────────────────────────────────────
-- 6. BUILDING SNAPSHOTS
-- Frequently updated operational facts: census, skilled mix, payer mix,
-- occupancy gap, staffing pressure, AR issues, top priorities.
-- Review cadence: weekly or monthly.
-- ────────────────────────────────────────────────────────────────────────────

create table building_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  building_id   uuid not null references buildings(id) on delete cascade,
  snapshot_date date not null default current_date,
  census        int,
  occupancy_gap int,                            -- beds below capacity
  skilled_mix   numeric(5,2),                   -- percentage
  payer_mix     jsonb,                          -- { "medicare_a": 0.35, "medicaid": 0.40, ... }
  survey_exposure text,                         -- current survey risk summary
  staffing_pressure text,                       -- staffing status summary
  ar_issues     text,                           -- accounts receivable concerns
  top_priorities text[],                        -- array of top 3-5 priorities this period
  notes         text,                           -- free-form operational notes
  owner         text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

comment on table building_snapshots is
  'Time-series operational snapshots. One row per building per period. '
  'The most recent snapshot is injected into the building context layer.';

create index idx_snapshots_building_date
  on building_snapshots (building_id, snapshot_date desc);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. BUILDING INTELLIGENCE RUNS + INSIGHTS
-- AI- or analyst-generated intelligence packets.
-- Computed from the latest snapshot + profile.
-- ────────────────────────────────────────────────────────────────────────────

create table building_intelligence_runs (
  id            uuid primary key default uuid_generate_v4(),
  building_id   uuid not null references buildings(id) on delete cascade,
  run_date      timestamptz not null default now(),
  run_type      text not null default 'scheduled',  -- 'scheduled', 'manual', 'triggered'
  source_snapshot_id uuid references building_snapshots(id),
  status        text not null default 'completed',  -- 'pending', 'running', 'completed', 'failed'
  created_at    timestamptz not null default now()
);

comment on table building_intelligence_runs is
  'Tracks when intelligence was generated for a building. '
  'Each run produces one or more insights.';

create table building_intelligence_insights (
  id            uuid primary key default uuid_generate_v4(),
  run_id        uuid not null references building_intelligence_runs(id) on delete cascade,
  building_id   uuid not null references buildings(id) on delete cascade,
  headline      text not null,                  -- one-line summary
  status        text,                           -- 'critical', 'warning', 'stable', 'opportunity'
  top_risks     text[],
  top_opportunities text[],
  recommended_actions text[],
  key_metrics   jsonb,                          -- { "census": 56, "gap": 16, "skilled_mix": 0.14 }
  narrative     text,                           -- full intelligence brief paragraph
  confidence    text default 'medium',
  source_refs   text[],                         -- references to data sources
  freshness     text default 'current',         -- 'current', 'aging', 'stale'
  created_at    timestamptz not null default now()
);

comment on table building_intelligence_insights is
  'AI-generated intelligence packets per building. '
  'The most recent insight is injected into the intelligence context layer.';

create index idx_insights_building_date
  on building_intelligence_insights (building_id, created_at desc);


-- ────────────────────────────────────────────────────────────────────────────
-- 8. WORKFLOW TEMPLATES
-- Structured workflows with required/optional inputs, missing-info questions,
-- output templates, and review checklists.
-- ────────────────────────────────────────────────────────────────────────────

create table workflow_templates (
  id            uuid primary key default uuid_generate_v4(),
  role_id       uuid not null references roles(id) on delete cascade,
  slug          text not null,                  -- 'poc_draft', 'appeal_letter', 'census_plan'
  label         text not null,                  -- display name in the UI
  description   text,
  required_inputs jsonb not null,               -- [{ "name": "f_tag", "label": "F-Tag Number", "type": "text", "required": true }]
  optional_inputs jsonb,                        -- same shape, required: false
  missing_info_questions text[],                -- questions the bot asks if inputs are incomplete
  output_template text,                         -- prompt template with {{placeholders}}
  output_sections text[],                       -- required sections in the output
  review_checklist text[],                      -- post-generation review items
  draft_mode_required boolean not null default true,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  updated_by    text,
  unique (role_id, slug)
);

comment on table workflow_templates is
  'Structured workflows per role. Each defines inputs, a prompt template, '
  'expected output sections, and a review checklist.';


-- ────────────────────────────────────────────────────────────────────────────
-- 9. KNOWLEDGE DOCUMENTS + CHUNKS
-- Longer reference material: policies, training docs, appeal examples,
-- POC examples, reimbursement cheat sheets.
-- Chunked for retrieval.
-- ────────────────────────────────────────────────────────────────────────────

create table knowledge_documents (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  source        text,                           -- file path, URL, or description of origin
  doc_type      text not null,                  -- 'policy', 'training', 'example', 'cheat_sheet', 'template'
  category      text,                           -- 'compliance', 'reimbursement', 'clinical', 'operations'
  full_text     text,                           -- complete document text (if small enough)
  metadata      jsonb,                          -- arbitrary metadata
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create table knowledge_chunks (
  id            uuid primary key default uuid_generate_v4(),
  document_id   uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index   int not null,
  content       text not null,
  token_count   int,
  embedding     vector(1536),                   -- for pgvector similarity search (optional)
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

comment on table knowledge_chunks is
  'Chunked segments of knowledge documents for retrieval. '
  'Enable pgvector extension and populate embedding column for semantic search.';

create index idx_chunks_document
  on knowledge_chunks (document_id, chunk_index);


-- ────────────────────────────────────────────────────────────────────────────
-- 10. BUILDING ↔ DOCUMENT LINKS
-- Many-to-many: which documents are relevant to which buildings.
-- ────────────────────────────────────────────────────────────────────────────

create table building_document_links (
  id            uuid primary key default uuid_generate_v4(),
  building_id   uuid not null references buildings(id) on delete cascade,
  document_id   uuid not null references knowledge_documents(id) on delete cascade,
  relevance     text default 'standard',        -- 'primary', 'standard', 'reference'
  created_at    timestamptz not null default now(),
  unique (building_id, document_id)
);


-- ────────────────────────────────────────────────────────────────────────────
-- 11. CONVERSATION SESSIONS (optional, Phase 2+)
-- Server-side conversation storage with proper retention controls.
-- ────────────────────────────────────────────────────────────────────────────

create table conversation_sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       text,                           -- authenticated user identifier
  role_slug     text not null,                  -- which bot
  building_slug text,                           -- which building (nullable)
  is_draft_mode boolean not null default false,
  started_at    timestamptz not null default now(),
  last_active   timestamptz not null default now(),
  is_archived   boolean not null default false,
  metadata      jsonb
);

create table conversation_messages (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null references conversation_sessions(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  is_draft      boolean not null default false,
  token_count   int,
  created_at    timestamptz not null default now()
);

create index idx_messages_session
  on conversation_messages (session_id, created_at);


-- ────────────────────────────────────────────────────────────────────────────
-- 12. FEEDBACK (optional, Phase 2+)
-- Thumbs up/down on bot responses for quality tracking.
-- ────────────────────────────────────────────────────────────────────────────

create table response_feedback (
  id            uuid primary key default uuid_generate_v4(),
  message_id    uuid not null references conversation_messages(id) on delete cascade,
  user_id       text,
  rating        int not null check (rating in (-1, 1)),   -- -1 = thumbs down, 1 = thumbs up
  comment       text,
  created_at    timestamptz not null default now()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 13. AUDIT LOG
-- Track changes to critical configuration tables.
-- ────────────────────────────────────────────────────────────────────────────

create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  table_name    text not null,
  record_id     uuid not null,
  action        text not null,                  -- 'insert', 'update', 'delete'
  changed_by    text,
  changed_at    timestamptz not null default now(),
  old_values    jsonb,
  new_values    jsonb
);


-- ────────────────────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ────────────────────────────────────────────────────────────────────────────

-- Latest snapshot per building
create view v_latest_snapshots as
select distinct on (building_id)
  s.*,
  b.slug as building_slug,
  b.label as building_label
from building_snapshots s
join buildings b on b.id = s.building_id
order by building_id, snapshot_date desc;

-- Latest intelligence per building
create view v_latest_intelligence as
select distinct on (i.building_id)
  i.*,
  b.slug as building_slug,
  b.label as building_label,
  r.run_date,
  r.run_type
from building_intelligence_insights i
join building_intelligence_runs r on r.id = i.run_id
join buildings b on b.id = i.building_id
order by i.building_id, i.created_at desc;

-- Full building context (profile + latest snapshot + latest intelligence)
create view v_building_context as
select
  b.id as building_id,
  b.slug,
  b.label,
  b.short_name,
  b.state,
  b.cms_id,
  b.bed_capacity,
  bp.strategic_status,
  bp.strategic_identity,
  bp.referral_sources,
  bp.physician_gaps,
  bp.hospital_partners,
  bp.payer_context,
  bp.risk_watchlist,
  bp.opportunities,
  bp.confidence as profile_confidence,
  bp.updated_at as profile_updated_at,
  bp.owner as profile_owner,
  ls.snapshot_date,
  ls.census,
  ls.occupancy_gap,
  ls.skilled_mix,
  ls.payer_mix,
  ls.survey_exposure,
  ls.staffing_pressure,
  ls.ar_issues,
  ls.top_priorities,
  ls.updated_at as snapshot_updated_at,
  li.headline as intel_headline,
  li.status as intel_status,
  li.top_risks as intel_risks,
  li.top_opportunities as intel_opportunities,
  li.recommended_actions as intel_actions,
  li.key_metrics as intel_metrics,
  li.narrative as intel_narrative,
  li.freshness as intel_freshness,
  li.created_at as intel_created_at
from buildings b
left join building_profiles bp on bp.building_id = b.id
left join v_latest_snapshots ls on ls.building_id = b.id
left join v_latest_intelligence li on li.building_id = b.id
where b.is_active = true;


-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) scaffolding
-- Enable RLS on tables that will be accessed from the client.
-- Actual policies depend on your auth setup (Supabase Auth, custom JWT, etc.)
-- ────────────────────────────────────────────────────────────────────────────

alter table conversation_sessions enable row level security;
alter table conversation_messages enable row level security;
alter table response_feedback enable row level security;

-- Example policy (uncomment and customize):
-- create policy "Users see own sessions"
--   on conversation_sessions for select
--   using (user_id = auth.uid()::text);


-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
