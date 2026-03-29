-- IHCM AI Command Center
-- Migration 11: Building surveys and events tables
-- Replaces localStorage-based building history with server-side persistence.
-- Also stores CMS survey deficiency data.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Building surveys (CMS deficiencies + uploaded 2567s)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.building_surveys (
    survey_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id         UUID NOT NULL REFERENCES public.facilities(facility_id),
    survey_date         DATE NOT NULL,
    survey_type         TEXT NOT NULL DEFAULT 'standard'
        CHECK (survey_type IN ('standard', 'complaint', 'revisit', 'infection_control', 'life_safety', 'other')),
    source              TEXT NOT NULL DEFAULT 'cms'
        CHECK (source IN ('cms', 'uploaded_2567', 'manual')),
    total_deficiencies  INTEGER NOT NULL DEFAULT 0,
    scope_severity_max  TEXT,
    has_immediate_jeopardy BOOLEAN NOT NULL DEFAULT FALSE,
    has_substandard_care   BOOLEAN NOT NULL DEFAULT FALSE,
    deficiencies        JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- Each deficiency: { f_tag, scope_severity, description, category }
    cms_provider_id     TEXT,
    raw_data            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_building_survey
        UNIQUE (facility_id, survey_date, survey_type, source)
);

CREATE INDEX idx_building_surveys_facility
    ON public.building_surveys(facility_id, survey_date DESC);

ALTER TABLE public.building_surveys ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.building_surveys TO service_role;
GRANT SELECT, INSERT ON public.building_surveys TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Building events (operational timeline)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.building_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id         UUID NOT NULL REFERENCES public.facilities(facility_id),
    event_date          DATE NOT NULL,
    category            TEXT NOT NULL DEFAULT 'general'
        CHECK (category IN ('general', 'survey', 'staffing', 'clinical', 'regulatory', 'leadership', 'admissions', 'other')),
    title               TEXT NOT NULL,
    description         TEXT,
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_building_events_facility
    ON public.building_events(facility_id, event_date DESC);

ALTER TABLE public.building_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.building_events TO service_role;
GRANT SELECT, INSERT ON public.building_events TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Add CMS provider IDs to facilities
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.facilities
    ADD COLUMN IF NOT EXISTS cms_provider_id TEXT;

UPDATE public.facilities SET cms_provider_id = '045350' WHERE facility_code = 'arkadelphia';
UPDATE public.facilities SET cms_provider_id = '045437' WHERE facility_code = 'stonegate';
UPDATE public.facilities SET cms_provider_id = '045403' WHERE facility_code = 'glenwood';
UPDATE public.facilities SET cms_provider_id = '045176' WHERE facility_code = 'thewoods';
UPDATE public.facilities SET cms_provider_id = '045190' WHERE facility_code = 'crossett';
UPDATE public.facilities SET cms_provider_id = '366335' WHERE facility_code = 'marymount';
UPDATE public.facilities SET cms_provider_id = '395042' WHERE facility_code = 'erie';

COMMIT;
