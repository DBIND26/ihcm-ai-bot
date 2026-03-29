INSERT INTO forum_os.chapters (
    chapter_id,
    chapter_name,
    region_name,
    confidentiality_version,
    status
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'YPO Gotham Chapter',
    'Northeast',
    'beta-v1',
    'pilot'
)
ON CONFLICT (chapter_id) DO NOTHING;

INSERT INTO forum_os.forums (
    forum_id,
    chapter_id,
    forum_name,
    cadence_label,
    is_active
) VALUES
    (
        '20000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Forum Atlas',
        'Monthly',
        TRUE
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'Forum Harbor',
        'Monthly',
        TRUE
    )
ON CONFLICT (forum_id) DO NOTHING;

INSERT INTO forum_os.forum_sessions (
    session_id,
    forum_id,
    scheduled_for,
    session_status,
    facilitator_user_id,
    privacy_mode
) VALUES
    (
        '30000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        NOW() + INTERVAL '7 days',
        'planned',
        NULL,
        'transient'
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',
        NOW() + INTERVAL '10 days',
        'planned',
        NULL,
        'retained_process_only'
    )
ON CONFLICT (session_id) DO NOTHING;

INSERT INTO forum_os.learning_resources (
    resource_id,
    chapter_id,
    audience,
    resource_type,
    title,
    slug,
    body_markdown,
    created_by_user_id,
    is_active
) VALUES
    (
        '40000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'member',
        'template',
        'How To Bring A Real Forum Issue',
        'how-to-bring-a-real-forum-issue',
        '# Strong issues\n\nFocus on internal conflict, emotional truth, and real stakes. Avoid advice-seeking problem statements.',
        NULL,
        TRUE
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'moderator',
        'checklist',
        'Moderator Funnel Quick Guide',
        'moderator-funnel-quick-guide',
        '# Moderator Funnel\n\n1. Slow down the story.\n2. Move from facts to meaning.\n3. Invite experience over advice.',
        NULL,
        TRUE
    ),
    (
        '40000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'chapter',
        'article',
        'Forum Process Health Review Standards',
        'forum-process-health-review-standards',
        '# Process Health Review\n\nOnly use aggregate, minimum-threshold metrics. Never review issue content.',
        NULL,
        TRUE
    )
ON CONFLICT (resource_id) DO NOTHING;

INSERT INTO forum_os.chapter_metric_snapshots (
    snapshot_id,
    chapter_id,
    snapshot_date,
    metric_key,
    metric_value,
    cohort_size,
    generated_by,
    notes
) VALUES
    (
        '50000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        CURRENT_DATE,
        'member_issue_prep_usage_pct',
        62.00,
        24,
        'manual',
        'Pilot estimate from orientation and prep-tool usage.'
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        CURRENT_DATE,
        'moderator_refresher_completion_pct',
        75.00,
        8,
        'manual',
        'Three of four moderators completed refresher work across active forums.'
    ),
    (
        '50000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        CURRENT_DATE,
        'forums_submitting_process_reviews_pct',
        50.00,
        2,
        'manual',
        'Low cohort size included here only for seed/demo purposes; production UI should suppress this.'
    )
ON CONFLICT (snapshot_id) DO NOTHING;

-- After real users sign in through Supabase Auth, create their chapter profiles.
-- Bootstrap the first forum_chair or privacy_admin with the Supabase SQL editor
-- or a service-role connection, since no self-service chapter admin exists yet.
-- Example roles:
-- member, moderator, forum_chair, privacy_admin, platform_admin
--
-- INSERT INTO forum_os.forum_profiles (
--     user_id,
--     chapter_id,
--     email,
--     full_name,
--     display_name,
--     chapter_role
-- ) VALUES
--     ('<auth-user-uuid>', '10000000-0000-0000-0000-000000000001', 'chair@example.com', 'Jordan Avery', 'Jordan', 'forum_chair'),
--     ('<auth-user-uuid>', '10000000-0000-0000-0000-000000000001', 'moderator@example.com', 'Taylor Quinn', 'Taylor', 'moderator'),
--     ('<auth-user-uuid>', '10000000-0000-0000-0000-000000000001', 'member@example.com', 'Morgan Lee', 'Morgan', 'member');
--
-- Assign users to forums after their profiles exist.
--
-- INSERT INTO forum_os.forum_memberships (
--     forum_id,
--     user_id,
--     membership_role
-- ) VALUES
--     ('20000000-0000-0000-0000-000000000001', '<auth-user-uuid>', 'moderator'),
--     ('20000000-0000-0000-0000-000000000001', '<auth-user-uuid>', 'member');
--
-- Members can then create private issue drafts and reflections.
--
-- INSERT INTO forum_os.member_private_issues (
--     chapter_id,
--     forum_id,
--     owner_user_id,
--     issue_title,
--     encrypted_issue_body,
--     emotional_stakes,
--     ai_depth_feedback,
--     issue_status,
--     retention_mode
-- ) VALUES (
--     '10000000-0000-0000-0000-000000000001',
--     '20000000-0000-0000-0000-000000000001',
--     '<auth-user-uuid>',
--     'Succession anxiety',
--     'enc::<client-encrypted-payload>',
--     '{"stakes":["identity","family","legacy"]}'::jsonb,
--     '{"vulnerability":4,"clarity":3,"suggestion":"Name the fear under the decision."}'::jsonb,
--     'draft',
--     'days_90'
-- );
