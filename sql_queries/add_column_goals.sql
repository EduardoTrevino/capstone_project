-- Step 1: Add the new JSONB column
ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS win_conditions_structured JSONB;

-- Step 2: (Optional) Drop the old text-based column if you're fully migrating
-- ALTER TABLE public.goals
-- DROP COLUMN IF EXISTS win_conditions_description;
-- If you keep win_conditions_description, make sure your route.ts reads from win_conditions_structured.