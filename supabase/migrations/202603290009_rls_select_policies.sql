-- ============================================================================
-- Add missing SELECT policies for RLS-enforced reads
-- ============================================================================
-- building_profiles, building_surveys, and building_events had RLS enabled
-- but no SELECT policies, so the anon key + JWT client returns empty results.
-- These are read-only policies — all authenticated users can view building data.

-- Building profiles: all authenticated users can read
CREATE POLICY building_profiles_select
    ON public.building_profiles
    FOR SELECT
    TO authenticated
    USING (true);

-- Building surveys: all authenticated users can read
CREATE POLICY building_surveys_select
    ON public.building_surveys
    FOR SELECT
    TO authenticated
    USING (true);

-- Building events: all authenticated users can read
CREATE POLICY building_events_select
    ON public.building_events
    FOR SELECT
    TO authenticated
    USING (true);
