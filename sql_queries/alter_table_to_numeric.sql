-- 1. Change the user_kc_scores table to accept decimal scores
ALTER TABLE public.user_kc_scores
ALTER COLUMN current_score TYPE NUMERIC,
ALTER COLUMN current_score SET DEFAULT 0.0;

-- 2. (Proactive Fix) Change the option_kc_effects table to also accept decimal scores
-- This ensures consistency for when you implement granular scenario saving.
ALTER TABLE public.option_kc_effects
ALTER COLUMN score_impact TYPE NUMERIC;