CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS forum_os;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'chapter_role'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.chapter_role AS ENUM (
            'member',
            'moderator',
            'forum_chair',
            'privacy_admin',
            'platform_admin'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'membership_role'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.membership_role AS ENUM (
            'member',
            'moderator',
            'alternate'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'issue_status'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.issue_status AS ENUM (
            'draft',
            'ready',
            'archived'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'retention_mode'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.retention_mode AS ENUM (
            'ephemeral',
            'days_30',
            'days_90',
            'days_365',
            'manual'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'reflection_type'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.reflection_type AS ENUM (
            'pre_forum',
            'post_forum',
            'theme_map',
            'pattern_note'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'session_status'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.session_status AS ENUM (
            'planned',
            'active',
            'completed',
            'cancelled'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'privacy_mode'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.privacy_mode AS ENUM (
            'transient',
            'retained_process_only'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'process_note_type'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.process_note_type AS ENUM (
            'parking_lot',
            'process_check',
            'follow_up'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'resource_audience'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.resource_audience AS ENUM (
            'member',
            'moderator',
            'chapter'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'resource_type'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.resource_type AS ENUM (
            'article',
            'checklist',
            'exercise',
            'template'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'training_status'
          AND n.nspname = 'forum_os'
    ) THEN
        CREATE TYPE forum_os.training_status AS ENUM (
            'assigned',
            'in_progress',
            'completed',
            'waived'
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION forum_os.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE forum_os.chapters (
    chapter_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_name                TEXT NOT NULL UNIQUE,
    region_name                 TEXT,
    confidentiality_version     TEXT NOT NULL DEFAULT 'beta-v1',
    status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'pilot', 'paused', 'inactive')),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE forum_os.forums (
    forum_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    forum_name                  TEXT NOT NULL,
    cadence_label               TEXT,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forum_name_per_chapter UNIQUE (chapter_id, forum_name)
);

CREATE INDEX idx_forums_chapter ON forum_os.forums(chapter_id);

CREATE TABLE forum_os.forum_profiles (
    profile_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    email                       TEXT,
    full_name                   TEXT,
    display_name                TEXT,
    chapter_role                forum_os.chapter_role NOT NULL DEFAULT 'member',
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forum_profile_per_chapter UNIQUE (user_id, chapter_id)
);

CREATE INDEX idx_forum_profiles_user ON forum_os.forum_profiles(user_id);
CREATE INDEX idx_forum_profiles_chapter ON forum_os.forum_profiles(chapter_id, chapter_role);

CREATE TABLE forum_os.forum_memberships (
    membership_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forum_id                    UUID NOT NULL REFERENCES forum_os.forums(forum_id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    membership_role             forum_os.membership_role NOT NULL DEFAULT 'member',
    joined_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_forum_membership UNIQUE (forum_id, user_id)
);

CREATE INDEX idx_forum_memberships_forum ON forum_os.forum_memberships(forum_id, membership_role);
CREATE INDEX idx_forum_memberships_user ON forum_os.forum_memberships(user_id);

CREATE TABLE forum_os.member_private_issues (
    issue_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    forum_id                    UUID REFERENCES forum_os.forums(forum_id) ON DELETE SET NULL,
    owner_user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issue_title                 TEXT NOT NULL,
    encrypted_issue_body        TEXT NOT NULL,
    emotional_stakes            JSONB NOT NULL DEFAULT '{}'::JSONB,
    ai_depth_feedback           JSONB NOT NULL DEFAULT '{}'::JSONB,
    issue_status                forum_os.issue_status NOT NULL DEFAULT 'draft',
    retention_mode              forum_os.retention_mode NOT NULL DEFAULT 'days_90',
    expires_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_private_issues_owner ON forum_os.member_private_issues(owner_user_id, created_at DESC);
CREATE INDEX idx_private_issues_expiry ON forum_os.member_private_issues(expires_at);

CREATE TABLE forum_os.member_private_reflections (
    reflection_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    owner_user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issue_id                    UUID REFERENCES forum_os.member_private_issues(issue_id) ON DELETE SET NULL,
    reflection_type             forum_os.reflection_type NOT NULL,
    encrypted_reflection_body   TEXT NOT NULL,
    tags                        JSONB NOT NULL DEFAULT '[]'::JSONB,
    retention_mode              forum_os.retention_mode NOT NULL DEFAULT 'days_90',
    expires_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_private_reflections_owner ON forum_os.member_private_reflections(owner_user_id, created_at DESC);
CREATE INDEX idx_private_reflections_issue ON forum_os.member_private_reflections(issue_id);

CREATE TABLE forum_os.forum_sessions (
    session_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forum_id                    UUID NOT NULL REFERENCES forum_os.forums(forum_id) ON DELETE CASCADE,
    scheduled_for               TIMESTAMPTZ NOT NULL,
    session_status              forum_os.session_status NOT NULL DEFAULT 'planned',
    facilitator_user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    privacy_mode                forum_os.privacy_mode NOT NULL DEFAULT 'transient',
    started_at                  TIMESTAMPTZ,
    ended_at                    TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_session_times
        CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX idx_forum_sessions_forum ON forum_os.forum_sessions(forum_id, scheduled_for DESC);
CREATE INDEX idx_forum_sessions_status ON forum_os.forum_sessions(session_status, scheduled_for DESC);

CREATE TABLE forum_os.session_process_notes (
    note_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                  UUID NOT NULL REFERENCES forum_os.forum_sessions(session_id) ON DELETE CASCADE,
    created_by_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note_type                   forum_os.process_note_type NOT NULL,
    note_text                   TEXT NOT NULL,
    is_retained                 BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at                  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_process_note_retention
        CHECK (
            (is_retained = FALSE AND expires_at IS NOT NULL)
            OR is_retained = TRUE
        )
);

CREATE INDEX idx_session_process_notes_session ON forum_os.session_process_notes(session_id, created_at DESC);
CREATE INDEX idx_session_process_notes_expiry ON forum_os.session_process_notes(expires_at);

CREATE TABLE forum_os.moderator_self_reviews (
    review_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                  UUID NOT NULL REFERENCES forum_os.forum_sessions(session_id) ON DELETE CASCADE,
    moderator_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discussion_depth_rating     SMALLINT NOT NULL CHECK (discussion_depth_rating BETWEEN 1 AND 5),
    psychological_safety_rating SMALLINT NOT NULL CHECK (psychological_safety_rating BETWEEN 1 AND 5),
    advice_loop_flag            BOOLEAN NOT NULL DEFAULT FALSE,
    experiential_sharing_flag   BOOLEAN NOT NULL DEFAULT FALSE,
    requested_support_topics    JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_moderator_review UNIQUE (session_id, moderator_user_id)
);

CREATE INDEX idx_moderator_reviews_session ON forum_os.moderator_self_reviews(session_id);
CREATE INDEX idx_moderator_reviews_moderator ON forum_os.moderator_self_reviews(moderator_user_id, created_at DESC);

CREATE TABLE forum_os.learning_resources (
    resource_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    audience                    forum_os.resource_audience NOT NULL,
    resource_type               forum_os.resource_type NOT NULL,
    title                       TEXT NOT NULL,
    slug                        TEXT NOT NULL,
    body_markdown               TEXT NOT NULL,
    created_by_user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_resource_slug UNIQUE (chapter_id, slug)
);

CREATE INDEX idx_learning_resources_audience ON forum_os.learning_resources(audience, is_active);

CREATE TABLE forum_os.moderator_training_assignments (
    assignment_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_id                 UUID NOT NULL REFERENCES forum_os.learning_resources(resource_id) ON DELETE CASCADE,
    training_status             forum_os.training_status NOT NULL DEFAULT 'assigned',
    assigned_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_training_assignment UNIQUE (user_id, resource_id),
    CONSTRAINT chk_training_completion
        CHECK (
            (training_status <> 'completed')
            OR (completed_at IS NOT NULL)
        )
);

CREATE INDEX idx_training_assignments_user ON forum_os.moderator_training_assignments(user_id, training_status);
CREATE INDEX idx_training_assignments_chapter ON forum_os.moderator_training_assignments(chapter_id, training_status);

CREATE TABLE forum_os.chapter_metric_snapshots (
    snapshot_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id                  UUID NOT NULL REFERENCES forum_os.chapters(chapter_id) ON DELETE CASCADE,
    snapshot_date               DATE NOT NULL,
    metric_key                  TEXT NOT NULL,
    metric_value                NUMERIC(10,2) NOT NULL,
    cohort_size                 INTEGER NOT NULL CHECK (cohort_size >= 0),
    generated_by                TEXT NOT NULL DEFAULT 'system'
                                CHECK (generated_by IN ('system', 'manual')),
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_metric_snapshot UNIQUE (chapter_id, snapshot_date, metric_key)
);

CREATE INDEX idx_chapter_metric_snapshots ON forum_os.chapter_metric_snapshots(chapter_id, snapshot_date DESC);

CREATE TRIGGER trg_chapters_updated_at
BEFORE UPDATE ON forum_os.chapters
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_forums_updated_at
BEFORE UPDATE ON forum_os.forums
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_forum_profiles_updated_at
BEFORE UPDATE ON forum_os.forum_profiles
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_forum_memberships_updated_at
BEFORE UPDATE ON forum_os.forum_memberships
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_member_private_issues_updated_at
BEFORE UPDATE ON forum_os.member_private_issues
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_member_private_reflections_updated_at
BEFORE UPDATE ON forum_os.member_private_reflections
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_forum_sessions_updated_at
BEFORE UPDATE ON forum_os.forum_sessions
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_session_process_notes_updated_at
BEFORE UPDATE ON forum_os.session_process_notes
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_learning_resources_updated_at
BEFORE UPDATE ON forum_os.learning_resources
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE TRIGGER trg_training_assignments_updated_at
BEFORE UPDATE ON forum_os.moderator_training_assignments
FOR EACH ROW
EXECUTE FUNCTION forum_os.set_updated_at();

CREATE OR REPLACE VIEW forum_os.v_session_queue
WITH (security_invoker = true) AS
SELECT
    s.session_id,
    s.forum_id,
    f.chapter_id,
    f.forum_name,
    s.scheduled_for,
    s.session_status,
    s.privacy_mode,
    s.facilitator_user_id
FROM forum_os.forum_sessions s
JOIN forum_os.forums f ON f.forum_id = s.forum_id
WHERE s.session_status IN ('planned', 'active')
ORDER BY s.scheduled_for ASC;

CREATE OR REPLACE VIEW forum_os.v_chapter_process_health
WITH (security_invoker = true) AS
SELECT
    f.chapter_id,
    COUNT(*) AS review_count,
    ROUND(AVG(r.discussion_depth_rating)::NUMERIC, 2) AS avg_discussion_depth,
    ROUND(AVG(r.psychological_safety_rating)::NUMERIC, 2) AS avg_psychological_safety,
    COUNT(*) FILTER (WHERE r.advice_loop_flag = TRUE) AS advice_loop_count,
    COUNT(*) FILTER (WHERE r.experiential_sharing_flag = TRUE) AS experiential_sharing_count,
    MAX(r.created_at) AS last_review_at
FROM forum_os.moderator_self_reviews r
JOIN forum_os.forum_sessions s ON s.session_id = r.session_id
JOIN forum_os.forums f ON f.forum_id = s.forum_id
GROUP BY f.chapter_id
HAVING COUNT(*) >= 3;

CREATE OR REPLACE VIEW forum_os.v_training_completion
WITH (security_invoker = true) AS
SELECT
    a.chapter_id,
    a.resource_id,
    lr.title,
    COUNT(*) AS assigned_count,
    COUNT(*) FILTER (WHERE a.training_status = 'completed') AS completed_count,
    ROUND(
        (
            COUNT(*) FILTER (WHERE a.training_status = 'completed')::NUMERIC
            / NULLIF(COUNT(*), 0)
        ) * 100,
        2
    ) AS completion_rate
FROM forum_os.moderator_training_assignments a
JOIN forum_os.learning_resources lr ON lr.resource_id = a.resource_id
GROUP BY a.chapter_id, a.resource_id, lr.title;
