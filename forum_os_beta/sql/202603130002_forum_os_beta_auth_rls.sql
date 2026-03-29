GRANT USAGE ON SCHEMA forum_os TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON forum_os.chapters,
   forum_os.forums,
   forum_os.forum_profiles,
   forum_os.forum_memberships,
   forum_os.member_private_issues,
   forum_os.member_private_reflections,
   forum_os.forum_sessions,
   forum_os.session_process_notes,
   forum_os.moderator_self_reviews,
   forum_os.learning_resources,
   forum_os.moderator_training_assignments,
   forum_os.chapter_metric_snapshots
TO authenticated;

GRANT ALL
ON forum_os.chapters,
   forum_os.forums,
   forum_os.forum_profiles,
   forum_os.forum_memberships,
   forum_os.member_private_issues,
   forum_os.member_private_reflections,
   forum_os.forum_sessions,
   forum_os.session_process_notes,
   forum_os.moderator_self_reviews,
   forum_os.learning_resources,
   forum_os.moderator_training_assignments,
   forum_os.chapter_metric_snapshots
TO service_role;

GRANT SELECT
ON forum_os.v_session_queue,
   forum_os.v_chapter_process_health,
   forum_os.v_training_completion
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION forum_os.current_chapter_role(target_chapter_id UUID)
RETURNS forum_os.chapter_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT fp.chapter_role
    FROM forum_os.forum_profiles fp
    WHERE fp.user_id = auth.uid()
      AND fp.chapter_id = target_chapter_id
      AND fp.is_active = TRUE
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION forum_os.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM forum_os.forum_profiles fp
        WHERE fp.user_id = auth.uid()
          AND fp.chapter_role = 'platform_admin'
          AND fp.is_active = TRUE
    );
$$;

CREATE OR REPLACE FUNCTION forum_os.can_view_chapter(target_chapter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN forum_os.is_platform_admin() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM forum_os.forum_profiles fp
                WHERE fp.user_id = auth.uid()
                  AND fp.chapter_id = target_chapter_id
                  AND fp.is_active = TRUE
            )
        END;
$$;

CREATE OR REPLACE FUNCTION forum_os.can_manage_chapter(target_chapter_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN forum_os.is_platform_admin() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM forum_os.forum_profiles fp
                WHERE fp.user_id = auth.uid()
                  AND fp.chapter_id = target_chapter_id
                  AND fp.is_active = TRUE
                  AND fp.chapter_role IN ('forum_chair', 'privacy_admin')
            )
        END;
$$;

CREATE OR REPLACE FUNCTION forum_os.can_access_forum(target_forum_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN forum_os.is_platform_admin() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM forum_os.forums f
                WHERE f.forum_id = target_forum_id
                  AND (
                      forum_os.can_manage_chapter(f.chapter_id)
                      OR EXISTS (
                          SELECT 1
                          FROM forum_os.forum_memberships fm
                          WHERE fm.forum_id = f.forum_id
                            AND fm.user_id = auth.uid()
                            AND fm.is_active = TRUE
                      )
                  )
            )
        END;
$$;

CREATE OR REPLACE FUNCTION forum_os.can_moderate_forum(target_forum_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT
        CASE
            WHEN auth.uid() IS NULL THEN FALSE
            WHEN forum_os.is_platform_admin() THEN TRUE
            ELSE EXISTS (
                SELECT 1
                FROM forum_os.forums f
                WHERE f.forum_id = target_forum_id
                  AND (
                      forum_os.can_manage_chapter(f.chapter_id)
                      OR EXISTS (
                          SELECT 1
                          FROM forum_os.forum_memberships fm
                          WHERE fm.forum_id = f.forum_id
                            AND fm.user_id = auth.uid()
                            AND fm.is_active = TRUE
                            AND fm.membership_role = 'moderator'
                      )
                  )
            )
        END;
$$;

CREATE OR REPLACE FUNCTION forum_os.can_manage_forum_roster(target_forum_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM forum_os.forums f
        WHERE f.forum_id = target_forum_id
          AND forum_os.can_manage_chapter(f.chapter_id)
    );
$$;

CREATE OR REPLACE FUNCTION forum_os.can_access_session(target_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM forum_os.forum_sessions s
        WHERE s.session_id = target_session_id
          AND forum_os.can_access_forum(s.forum_id)
    );
$$;

CREATE OR REPLACE FUNCTION forum_os.can_manage_session(target_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = forum_os, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM forum_os.forum_sessions s
        WHERE s.session_id = target_session_id
          AND forum_os.can_moderate_forum(s.forum_id)
    );
$$;

GRANT EXECUTE
ON FUNCTION forum_os.current_chapter_role(UUID),
   forum_os.is_platform_admin(),
   forum_os.can_view_chapter(UUID),
   forum_os.can_manage_chapter(UUID),
   forum_os.can_access_forum(UUID),
   forum_os.can_moderate_forum(UUID),
   forum_os.can_manage_forum_roster(UUID),
   forum_os.can_access_session(UUID),
   forum_os.can_manage_session(UUID)
TO authenticated, service_role;

ALTER TABLE forum_os.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.forums ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.forum_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.forum_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.member_private_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.member_private_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.forum_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.session_process_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.moderator_self_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.learning_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.moderator_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_os.chapter_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY chapters_select
ON forum_os.chapters
FOR SELECT
USING (forum_os.can_view_chapter(chapter_id));

CREATE POLICY chapters_insert
ON forum_os.chapters
FOR INSERT
WITH CHECK (forum_os.is_platform_admin());

CREATE POLICY chapters_update
ON forum_os.chapters
FOR UPDATE
USING (forum_os.can_manage_chapter(chapter_id))
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY chapters_delete
ON forum_os.chapters
FOR DELETE
USING (forum_os.is_platform_admin());

CREATE POLICY forums_select
ON forum_os.forums
FOR SELECT
USING (forum_os.can_view_chapter(chapter_id));

CREATE POLICY forums_insert
ON forum_os.forums
FOR INSERT
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY forums_update
ON forum_os.forums
FOR UPDATE
USING (forum_os.can_manage_chapter(chapter_id))
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY forums_delete
ON forum_os.forums
FOR DELETE
USING (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY forum_profiles_select
ON forum_os.forum_profiles
FOR SELECT
USING (
    auth.uid() = user_id
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY forum_profiles_insert
ON forum_os.forum_profiles
FOR INSERT
WITH CHECK (
    forum_os.can_manage_chapter(chapter_id)
    OR forum_os.is_platform_admin()
);

CREATE POLICY forum_profiles_update
ON forum_os.forum_profiles
FOR UPDATE
USING (
    forum_os.can_manage_chapter(chapter_id)
    OR forum_os.is_platform_admin()
)
WITH CHECK (
    forum_os.can_manage_chapter(chapter_id)
    OR forum_os.is_platform_admin()
);

CREATE POLICY forum_profiles_delete
ON forum_os.forum_profiles
FOR DELETE
USING (
    forum_os.can_manage_chapter(chapter_id)
    OR forum_os.is_platform_admin()
);

CREATE POLICY forum_memberships_select
ON forum_os.forum_memberships
FOR SELECT
USING (
    auth.uid() = user_id
    OR forum_os.can_access_forum(forum_id)
);

CREATE POLICY forum_memberships_insert
ON forum_os.forum_memberships
FOR INSERT
WITH CHECK (forum_os.can_manage_forum_roster(forum_id));

CREATE POLICY forum_memberships_update
ON forum_os.forum_memberships
FOR UPDATE
USING (forum_os.can_manage_forum_roster(forum_id))
WITH CHECK (forum_os.can_manage_forum_roster(forum_id));

CREATE POLICY forum_memberships_delete
ON forum_os.forum_memberships
FOR DELETE
USING (forum_os.can_manage_forum_roster(forum_id));

CREATE POLICY member_private_issues_select
ON forum_os.member_private_issues
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY member_private_issues_insert
ON forum_os.member_private_issues
FOR INSERT
WITH CHECK (
    auth.uid() = owner_user_id
    AND forum_os.can_view_chapter(chapter_id)
);

CREATE POLICY member_private_issues_update
ON forum_os.member_private_issues
FOR UPDATE
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY member_private_issues_delete
ON forum_os.member_private_issues
FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE POLICY member_private_reflections_select
ON forum_os.member_private_reflections
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY member_private_reflections_insert
ON forum_os.member_private_reflections
FOR INSERT
WITH CHECK (
    auth.uid() = owner_user_id
    AND forum_os.can_view_chapter(chapter_id)
);

CREATE POLICY member_private_reflections_update
ON forum_os.member_private_reflections
FOR UPDATE
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY member_private_reflections_delete
ON forum_os.member_private_reflections
FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE POLICY forum_sessions_select
ON forum_os.forum_sessions
FOR SELECT
USING (forum_os.can_access_forum(forum_id));

CREATE POLICY forum_sessions_insert
ON forum_os.forum_sessions
FOR INSERT
WITH CHECK (forum_os.can_moderate_forum(forum_id));

CREATE POLICY forum_sessions_update
ON forum_os.forum_sessions
FOR UPDATE
USING (forum_os.can_moderate_forum(forum_id))
WITH CHECK (forum_os.can_moderate_forum(forum_id));

CREATE POLICY forum_sessions_delete
ON forum_os.forum_sessions
FOR DELETE
USING (forum_os.can_moderate_forum(forum_id));

CREATE POLICY session_process_notes_select
ON forum_os.session_process_notes
FOR SELECT
USING (forum_os.can_access_session(session_id));

CREATE POLICY session_process_notes_insert
ON forum_os.session_process_notes
FOR INSERT
WITH CHECK (
    forum_os.can_access_session(session_id)
    AND (
        created_by_user_id IS NULL
        OR created_by_user_id = auth.uid()
    )
);

CREATE POLICY session_process_notes_update
ON forum_os.session_process_notes
FOR UPDATE
USING (
    forum_os.can_manage_session(session_id)
    OR created_by_user_id = auth.uid()
)
WITH CHECK (
    forum_os.can_manage_session(session_id)
    OR created_by_user_id = auth.uid()
);

CREATE POLICY session_process_notes_delete
ON forum_os.session_process_notes
FOR DELETE
USING (
    forum_os.can_manage_session(session_id)
    OR created_by_user_id = auth.uid()
);

CREATE POLICY moderator_self_reviews_select
ON forum_os.moderator_self_reviews
FOR SELECT
USING (
    auth.uid() = moderator_user_id
    OR forum_os.can_manage_session(session_id)
);

CREATE POLICY moderator_self_reviews_insert
ON forum_os.moderator_self_reviews
FOR INSERT
WITH CHECK (
    auth.uid() = moderator_user_id
    AND forum_os.can_manage_session(session_id)
);

CREATE POLICY moderator_self_reviews_update
ON forum_os.moderator_self_reviews
FOR UPDATE
USING (
    auth.uid() = moderator_user_id
    OR forum_os.can_manage_session(session_id)
)
WITH CHECK (
    auth.uid() = moderator_user_id
    OR forum_os.can_manage_session(session_id)
);

CREATE POLICY moderator_self_reviews_delete
ON forum_os.moderator_self_reviews
FOR DELETE
USING (
    auth.uid() = moderator_user_id
    OR forum_os.can_manage_session(session_id)
);

CREATE POLICY learning_resources_select
ON forum_os.learning_resources
FOR SELECT
USING (
    chapter_id IS NULL
    OR forum_os.can_view_chapter(chapter_id)
);

CREATE POLICY learning_resources_insert
ON forum_os.learning_resources
FOR INSERT
WITH CHECK (
    (chapter_id IS NULL AND forum_os.is_platform_admin())
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY learning_resources_update
ON forum_os.learning_resources
FOR UPDATE
USING (
    (chapter_id IS NULL AND forum_os.is_platform_admin())
    OR forum_os.can_manage_chapter(chapter_id)
)
WITH CHECK (
    (chapter_id IS NULL AND forum_os.is_platform_admin())
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY learning_resources_delete
ON forum_os.learning_resources
FOR DELETE
USING (
    (chapter_id IS NULL AND forum_os.is_platform_admin())
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY moderator_training_assignments_select
ON forum_os.moderator_training_assignments
FOR SELECT
USING (
    auth.uid() = user_id
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY moderator_training_assignments_insert
ON forum_os.moderator_training_assignments
FOR INSERT
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY moderator_training_assignments_update
ON forum_os.moderator_training_assignments
FOR UPDATE
USING (
    auth.uid() = user_id
    OR forum_os.can_manage_chapter(chapter_id)
)
WITH CHECK (
    auth.uid() = user_id
    OR forum_os.can_manage_chapter(chapter_id)
);

CREATE POLICY moderator_training_assignments_delete
ON forum_os.moderator_training_assignments
FOR DELETE
USING (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY chapter_metric_snapshots_select
ON forum_os.chapter_metric_snapshots
FOR SELECT
USING (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY chapter_metric_snapshots_insert
ON forum_os.chapter_metric_snapshots
FOR INSERT
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY chapter_metric_snapshots_update
ON forum_os.chapter_metric_snapshots
FOR UPDATE
USING (forum_os.can_manage_chapter(chapter_id))
WITH CHECK (forum_os.can_manage_chapter(chapter_id));

CREATE POLICY chapter_metric_snapshots_delete
ON forum_os.chapter_metric_snapshots
FOR DELETE
USING (forum_os.can_manage_chapter(chapter_id));
