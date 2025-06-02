CREATE TABLE public.user_metric_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    goal_id INT NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE, -- To scope history to a goal attempt cycle
    metric_id INT NOT NULL REFERENCES public.metrics(id) ON DELETE CASCADE,
    scenario_attempt_number INT NOT NULL,
    decision_number INT NOT NULL, -- 0 for initial state, 1 after 1st decision, etc.
    value NUMERIC NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Create indexes for faster querying
CREATE INDEX idx_user_metric_history_user_goal_metric ON public.user_metric_history(user_id, goal_id, metric_id);
CREATE INDEX idx_user_metric_history_timestamp ON public.user_metric_history(recorded_at);