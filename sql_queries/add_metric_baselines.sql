ALTER TABLE public.user_goals
ADD COLUMN IF NOT EXISTS initial_metric_baselines JSONB;