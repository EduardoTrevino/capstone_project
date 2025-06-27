-- Creates a table to log every user decision for detailed learning analytics.
CREATE TABLE public.historical_learning_analytics (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    goal_id BIGINT NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
    scenario_attempt_number INT NOT NULL,
    decision_number INT NOT NULL,
    decision_point_question TEXT,
    options_presented JSONB,
    chosen_option_index INT,
    chosen_option_text TEXT,
    kc_impacts_of_choice JSONB,
    kc_scores_after_decision JSONB,
    metric_values_after_decision JSONB,
    generated_narrative_steps JSONB,
    scenario_completed_on_this_turn BOOLEAN NOT NULL DEFAULT FALSE
);

-- Add comments to explain each column's purpose for future reference.
COMMENT ON TABLE public.historical_learning_analytics IS 'Logs every user decision and its immediate impact, providing a granular history of the learning journey.';
COMMENT ON COLUMN public.historical_learning_analytics.user_id IS 'The user who made the decision.';
COMMENT ON COLUMN public.historical_learning_analytics.goal_id IS 'The goal the user was pursuing during this decision.';
COMMENT ON COLUMN public.historical_learning_analytics.scenario_attempt_number IS 'Which attempt of the scenario for this goal (e.g., 1st, 2nd, 3rd try).';
COMMENT ON COLUMN public.historical_learning_analytics.decision_number IS 'The sequence number of the decision within the scenario (1, 2, or 3).';
COMMENT ON COLUMN public.historical_learning_analytics.decision_point_question IS 'The question text of the decision point the user faced.';
COMMENT ON COLUMN public.historical_learning_analytics.options_presented IS 'A JSON array of the 4 options presented to the user for this decision.';
COMMENT ON COLUMN public.historical_learning_analytics.chosen_option_index IS 'The 0-based index of the option the user selected.';
COMMENT ON COLUMN public.historical_learning_analytics.chosen_option_text IS 'The text of the option the user selected.';
COMMENT ON COLUMN public.historical_learning_analytics.kc_impacts_of_choice IS 'The JSON array of KC identifiers and score impacts from the chosen option.';
COMMENT ON COLUMN public.historical_learning_analytics.kc_scores_after_decision IS 'A JSONB snapshot of the user''s KC scores (e.g., {"KC1": 0.5, "KC5": -0.2}) after this decision was applied.';
COMMENT ON COLUMN public.historical_learning_analytics.metric_values_after_decision IS 'A JSONB snapshot of the user''s metric values (e.g., {"Revenue": 5000, "Reputation": 3.5}) after this decision was applied.';
COMMENT ON COLUMN public.historical_learning_analytics.generated_narrative_steps IS 'The JSON array of narrative steps returned by the AI in response to the user''s choice.';
COMMENT ON COLUMN public.historical_learning_analytics.scenario_completed_on_this_turn IS 'True if this decision was the last one, completing the scenario.';

-- Add indexes for faster querying on common lookup patterns.
CREATE INDEX idx_historical_learning_analytics_user_goal ON public.historical_learning_analytics (user_id, goal_id);