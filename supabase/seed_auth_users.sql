-- IHCM Auth Users Setup
-- Run this AFTER migration 10 (202603290005_auth_users_setup.sql)
--
-- IMPORTANT: This script creates user_profiles entries.
-- The actual auth.users must be created via the Supabase dashboard:
--   Authentication → Users → Add User → Set email + password
--
-- After creating each user in the dashboard, their user_profiles row
-- is auto-created by the trg_ihcm_auth_user_created trigger.
-- Then run the UPDATE statements below to set their roles.
--
-- STEP 1: Create users in Supabase Dashboard (Authentication → Users → Add User)
--   Email: DBraun@indhcm.com     Password: (set a temp password, user changes on first login)
--   Email: anukicic@indhcm.com   Password: (set a temp password)
--   Email: JEdwards@indhcm.com   Password: (set a temp password)
--   Email: lkotora@indhcm.com    Password: (set a temp password)
--   Email: lgreenwood@indhcm.com Password: (set a temp password)
--   Email: SIsaac@indhcm.com     Password: (set a temp password)
--
-- STEP 2: After all users are created in the dashboard, run these UPDATE statements:

-- Dov Braun — super_admin, all roles, all buildings
UPDATE public.user_profiles SET
    full_name = 'Dov Braun',
    app_role = 'super_admin',
    global_access_level = 'admin',
    allowed_bot_roles = ARRAY['don', 'mds', 'billing', 'admin', 'regional']
WHERE email = 'dbraun@indhcm.com';

-- Azra Nukicic — corporate_admin, all except billing
UPDATE public.user_profiles SET
    full_name = 'Azra Nukicic',
    app_role = 'corporate_admin',
    global_access_level = 'edit',
    allowed_bot_roles = ARRAY['don', 'mds', 'admin', 'regional']
WHERE email = 'anukicic@indhcm.com';

-- Jeff Edwards — corporate_admin, all except billing
UPDATE public.user_profiles SET
    full_name = 'Jeff Edwards',
    app_role = 'corporate_admin',
    global_access_level = 'edit',
    allowed_bot_roles = ARRAY['don', 'mds', 'admin', 'regional']
WHERE email = 'jedwards@indhcm.com';

-- Lisa Kotora — regional_director, Regional and MDS only
UPDATE public.user_profiles SET
    full_name = 'Lisa Kotora',
    app_role = 'regional_director',
    global_access_level = 'view',
    allowed_bot_roles = ARRAY['regional', 'mds']
WHERE email = 'lkotora@indhcm.com';

-- Lauren Greenwood — regional_director, MDS, Regional, and DON
UPDATE public.user_profiles SET
    full_name = 'Lauren Greenwood',
    app_role = 'regional_director',
    global_access_level = 'view',
    allowed_bot_roles = ARRAY['mds', 'regional', 'don']
WHERE email = 'lgreenwood@indhcm.com';

-- Steven Isaac — regional_director, Regional and Admin
UPDATE public.user_profiles SET
    full_name = 'Steven Isaac',
    app_role = 'regional_director',
    global_access_level = 'view',
    allowed_bot_roles = ARRAY['regional', 'admin']
WHERE email = 'sisaac@indhcm.com';
