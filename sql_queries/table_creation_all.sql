-- Drop existing tables in reverse order of dependency if re-running
DROP TABLE IF EXISTS public.user_metric_scores CASCADE;
DROP TABLE IF EXISTS public.user_kc_scores CASCADE;
DROP TABLE IF EXISTS public.option_kc_effects CASCADE;
DROP TABLE IF EXISTS public.options CASCADE;
DROP TABLE IF EXISTS public.decision_point_focused_kcs CASCADE;
DROP TABLE IF EXISTS public.decision_points CASCADE;
DROP TABLE IF EXISTS public.scenario_targeted_kcs CASCADE;
DROP TABLE IF EXISTS public.scenarios CASCADE;
DROP TABLE IF EXISTS public.goal_kcs CASCADE;
DROP TABLE IF EXISTS public.kc_metric_effects CASCADE;
DROP TABLE IF EXISTS public.kcs CASCADE;
DROP TABLE IF EXISTS public.metrics CASCADE;
-- Keep users and user_goals, but they will be altered or referenced.
-- DROP TABLE IF EXISTS public.user_goals CASCADE; -- Careful, existing data
-- DROP TABLE IF EXISTS public.goals CASCADE; -- Careful, existing data
-- DROP TABLE IF EXISTS public.users CASCADE; -- Careful, existing data


-- 1. Metrics Table
CREATE TABLE public.metrics (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  data_type TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (data_type IN ('PERCENTAGE', 'CURRENCY', 'RATING_5_STARS', 'TIMESERIES_NUMERIC')), -- For UI hints
  min_value NUMERIC NULL,
  max_value NUMERIC NULL,
  initial_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate Metrics (based on your definitions)
INSERT INTO public.metrics (name, description, data_type, min_value, max_value, initial_value) VALUES
('Revenue', 'Financial Performance of the business a monetary value can go up or down', 'TIMESERIES_NUMERIC', NULL, NULL, 0),
('Customer Satisfaction', 'How the people you are serving feel', 'PERCENTAGE', 0, 100, 50),
('Reputation', 'How you are perceived as a business / brand, your image', 'RATING_5_STARS', 0, 5, 2.5),
('Ethical Decision Making', 'How ethical (positive) or non-ethical (negative) your decisions are', 'PERCENTAGE', 0, 100, 50),
('Risk-Taking', 'This is how risky your decisions are', 'PERCENTAGE', 0, 100, 0) -- 0-33 Safe, 34-66 Calculated, 67-100 High
ON CONFLICT (name) DO NOTHING;


-- 2. Knowledge Components (KCs) Table
CREATE TABLE public.kcs (
  id SERIAL PRIMARY KEY,
  kc_identifier TEXT NOT NULL UNIQUE, -- e.g., "KC6", "KC11a". For AI.
  name TEXT NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate KCs (based on your list)
INSERT INTO public.kcs (kc_identifier, name, description) VALUES
('KC6', 'Calculate revenue, costs, and profit', 'Procedural'),
('KC5', 'Recognize how trust and reputation grow business', NULL),
('KC11a', 'Identify customer segment', NULL),
('KC7', 'Apply pricing strategies', NULL),
('KC4', 'Differentiate fixed vs. variable costs', NULL),
('KC10', 'Adapt services to match local needs', NULL),
('KC3', 'Balance workforce and demand', NULL),
('KC13', 'Invest in employee training', NULL),
('KC14', 'Delegate to focus on high-value work', NULL),
('KC18', 'Navigate ethical dilemmas', NULL),
('KC16', 'Practice calculated risk-taking', NULL),
('KC2', 'Evaluate product maintenance investments', NULL),
('KC11', 'Identify new customer segments', NULL), -- Different from KC11a
('KC19', 'Solve problems creatively', NULL),
('KC20', 'Match drone models to farm needs', NULL)
ON CONFLICT (kc_identifier) DO NOTHING;


-- 3. KC Metric Effects (Junction table: how KCs influence Metrics)
CREATE TABLE public.kc_metric_effects (
  id SERIAL PRIMARY KEY,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  metric_id INTEGER NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  -- effect_description TEXT NULL, -- e.g., "primary impact", "positive correlation"
  UNIQUE (kc_id, metric_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate KC Metric Effects based on your definitions
-- Example for KC6 affecting Reputation:
-- INSERT INTO public.kc_metric_effects (kc_id, metric_id) VALUES ((SELECT id FROM public.kcs WHERE kc_identifier = 'KC6'), (SELECT id FROM public.metrics WHERE name = 'Reputation'));
-- You'll need to run inserts for all mappings:
-- KC6 -> Reputation
-- KC5 -> Reputation, Customer Satisfaction
-- KC11a -> Reputation, Customer Satisfaction
-- KC7 -> Revenue, Customer Satisfaction, Reputation
-- KC4 -> Revenue
-- KC10 -> Customer Satisfaction, Revenue, Reputation
-- KC3 -> Customer Satisfaction
-- KC13 -> Reputation, Ethical decision making
-- KC14 -> Revenue, Risk-Taking
-- KC18 -> Ethical Decision-Making, Reputation, Customer Satisfaction
-- KC16 -> Risk-Taking, Revenue, Ethical Decision-Making
-- KC2 -> Revenue, Reputation
-- KC11 -> Reputation, Customer Satisfaction
-- KC19 -> Revenue, Risk-Taking
-- KC20 -> Reputation, Revenue, Customer Satisfaction
-- (This requires a script or manual entry using subqueries for IDs)


-- 4. Goals Table (Altered from your existing)
ALTER TABLE public.goals DROP COLUMN IF EXISTS "KCs"; -- Remove old text column
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS target_kcs_description TEXT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS win_conditions_description TEXT NULL;
-- Example: UPDATE public.goals SET description = 'Achieve your first ₹2,000 in profit while maintaining customer satisfaction above 50%.' WHERE name = 'Your Goal Name';


-- 5. Goal KCs (Junction table: KCs required for a goal)
CREATE TABLE public.goal_kcs (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  target_threshold INTEGER NULL, -- If a specific KC score is needed for this goal's KCs
  UNIQUE (goal_id, kc_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 6. Scenarios Table
CREATE TABLE public.scenarios (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_order INTEGER NOT NULL DEFAULT 1, -- e.g., 1, 2, 3 for the 3 attempts/narratives per goal
  narrative_context_text TEXT NOT NULL, -- The new overall narrative for this specific scenario instance
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (goal_id, scenario_order)
);


-- 7. Scenario Targeted KCs (KCs the scenario as a whole focuses on)
CREATE TABLE public.scenario_targeted_kcs (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  UNIQUE (scenario_id, kc_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 8. Decision Points Table
CREATE TABLE public.decision_points (
  id SERIAL PRIMARY KEY,
  scenario_id INTEGER NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  decision_order INTEGER NOT NULL, -- 1, 2, or 3 within the scenario
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scenario_id, decision_order)
);


-- 9. Decision Point Focused KCs (KCs this decision point is designed to assess/teach)
CREATE TABLE public.decision_point_focused_kcs (
  id SERIAL PRIMARY KEY,
  decision_point_id INTEGER NOT NULL REFERENCES public.decision_points(id) ON DELETE CASCADE,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  UNIQUE (decision_point_id, kc_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 10. Options Table (for Decision Points)
CREATE TABLE public.options (
  id SERIAL PRIMARY KEY,
  decision_point_id INTEGER NOT NULL REFERENCES public.decision_points(id) ON DELETE CASCADE,
  option_order INTEGER NOT NULL, -- 1 to 4 within the decision point
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (decision_point_id, option_order)
);


-- 11. Option KC Effects (Stores the KC scores for each option choice)
CREATE TABLE public.option_kc_effects (
  id SERIAL PRIMARY KEY,
  option_id INTEGER NOT NULL REFERENCES public.options(id) ON DELETE CASCADE,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  score_impact INTEGER NOT NULL, -- e.g., -2, -1, 0, 1, 2
  UNIQUE (option_id, kc_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 12. Users Table (Altered)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lives INTEGER NOT NULL DEFAULT 3;
-- Remove direct metric scores if they exist and will be replaced by user_metric_scores
ALTER TABLE public.users DROP COLUMN IF EXISTS cash;
ALTER TABLE public.users DROP COLUMN IF EXISTS workforce_management_score;
ALTER TABLE public.users DROP COLUMN IF EXISTS customer_satisfaction_score;


-- 13. User Metric Scores Table
CREATE TABLE public.user_metric_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  metric_id INTEGER NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
  current_value NUMERIC NOT NULL,
  -- For timeseries data like Revenue, we might need a different table or JSONB field to store historical values.
  -- For now, current_value stores the latest.
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, metric_id)
);

-- Initialize scores for existing users (example for one metric)
-- INSERT INTO public.user_metric_scores (user_id, metric_id, current_value)
-- SELECT u.id, m.id, m.initial_value
-- FROM public.users u, public.metrics m
-- ON CONFLICT (user_id, metric_id) DO NOTHING;
-- (You'll need to run this for all users and all metrics)


-- 14. User KC Scores Table (Optional, for direct tracking of KC proficiency)
CREATE TABLE public.user_kc_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kc_id INTEGER NOT NULL REFERENCES public.kcs(id) ON DELETE CASCADE,
  current_score INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, kc_id)
);


-- 15. User Goals Table (Altered)
ALTER TABLE public.user_goals ADD COLUMN IF NOT EXISTS attempts_for_current_goal_cycle INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_goals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed_needs_retry', 'pending_initial_scenario'));
-- The `dialogue_history` JSONB will store the AI-generated scenario structure for the current active scenario being played by the user for that goal attempt.
-- This history might need to be cleared or versioned when a new scenario (attempt) starts for the same goal.


-- Helper function to get kc_id from kc_identifier (useful for route.ts)
CREATE OR REPLACE FUNCTION get_kc_id_by_identifier(p_kc_identifier TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_kc_id INTEGER;
BEGIN
    SELECT id INTO v_kc_id FROM public.kcs WHERE kc_identifier = p_kc_identifier;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'KC identifier not found: %', p_kc_identifier;
    END IF;
    RETURN v_kc_id;
END;
$$ LANGUAGE plpgsql;