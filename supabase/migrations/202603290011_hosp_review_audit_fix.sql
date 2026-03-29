-- ============================================================================
-- Fix hospitalization_reviews audit fields
-- ============================================================================
-- Split reviewed_by into submitted_by (who entered the case) and
-- reviewed_by (who confirmed/overrode the AI classification).
-- Add reviewed_at timestamp.

ALTER TABLE public.hospitalization_reviews
    ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Migrate existing data: reviewed_by was actually submitted_by
UPDATE public.hospitalization_reviews
SET submitted_by = reviewed_by
WHERE submitted_by IS NULL AND reviewed_by IS NOT NULL;

-- Clear reviewed_by where no final determination exists
UPDATE public.hospitalization_reviews
SET reviewed_by = NULL
WHERE final_avoidability IS NULL;
