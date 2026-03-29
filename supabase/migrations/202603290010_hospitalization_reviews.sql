-- ============================================================================
-- Hospitalization Review Tool — anonymized case tracking
-- ============================================================================
-- PHI prohibited; server-side guardrails reject obvious identifiers.
-- Tracks de-identified hospitalization cases with
-- AI-assisted avoidability analysis and aggregate trends.

CREATE TABLE IF NOT EXISTS public.hospitalization_reviews (
    review_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id              UUID NOT NULL REFERENCES public.facilities(facility_id),
    review_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    transfer_date            DATE NOT NULL,
    transfer_time_category   TEXT NOT NULL DEFAULT 'business_hours'
                              CHECK (transfer_time_category IN ('business_hours', 'evening', 'night', 'weekend')),
    days_since_admission     INTEGER CHECK (days_since_admission >= 0),
    primary_diagnosis        TEXT NOT NULL,
    diagnosis_category       TEXT NOT NULL DEFAULT 'other'
                              CHECK (diagnosis_category IN (
                                'cardiac', 'respiratory', 'infection', 'fall',
                                'gi', 'neuro', 'dehydration', 'medication',
                                'wound', 'behavioral', 'other'
                              )),
    present_on_admission     BOOLEAN,
    physician_notified       BOOLEAN,
    condition_change_documented BOOLEAN,
    interact_tool_used       BOOLEAN,
    payer_type               TEXT CHECK (payer_type IN ('medicare', 'managed_care', 'medicaid', 'private', 'other')),
    readmission_flag         BOOLEAN DEFAULT FALSE,

    -- AI analysis
    ai_avoidability          TEXT CHECK (ai_avoidability IN ('avoidable', 'possibly_avoidable', 'unavoidable')),
    ai_analysis              TEXT,

    -- Reviewer determination (DON/Admin override)
    final_avoidability       TEXT CHECK (final_avoidability IN ('avoidable', 'possibly_avoidable', 'unavoidable')),
    override_reason          TEXT,

    -- Root cause and actions
    root_causes              JSONB DEFAULT '[]',
    qi_actions               JSONB DEFAULT '[]',
    prevention_notes         TEXT,

    -- Audit
    reviewed_by              UUID REFERENCES auth.users(id),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_hospitalization_reviews_updated_at
BEFORE UPDATE ON public.hospitalization_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_hosp_reviews_facility
    ON public.hospitalization_reviews(facility_id, transfer_date DESC);

CREATE INDEX idx_hosp_reviews_category
    ON public.hospitalization_reviews(diagnosis_category, transfer_date DESC);

CREATE INDEX idx_hosp_reviews_avoidability
    ON public.hospitalization_reviews(final_avoidability, transfer_date DESC)
    WHERE final_avoidability IS NOT NULL;

-- RLS
ALTER TABLE public.hospitalization_reviews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.hospitalization_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.hospitalization_reviews TO authenticated;

CREATE POLICY hosp_reviews_select
    ON public.hospitalization_reviews
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY hosp_reviews_insert
    ON public.hospitalization_reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY hosp_reviews_update
    ON public.hospitalization_reviews
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
