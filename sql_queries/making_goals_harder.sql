-- Assumes initial_metric_baselines in user_goals now stores the baseline from the start of the entire goal cycle.
-- Win condition type "change_from_baseline" will now use this initial_metric_baselines for cumulative checks.

-- Update Goal 1: Break Even and Build Trust
-- Target Revenue Increase (cumulative): ₹5,000 (aiming for ~2 attempts)
-- Absolute CS floor: 50%
-- Absolute Reputation floor: 3.0 stars
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "type": "change_from_baseline", "operator": ">=", "value": 5000, "is_profit_proxy": true },
    { "metric_name": "Customer Satisfaction", "type": "absolute", "operator": ">=", "value": 50 },
    { "metric_name": "Reputation", "type": "absolute", "operator": ">=", "value": 3.0 }
]'::JSONB
WHERE name = 'Break Even and Build Trust';

-- Update Goal 2: Price with Purpose
-- Target Revenue Increase (cumulative): ₹7,500 (aiming for ~2-3 attempts)
-- Absolute CS floor: 60%
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "type": "change_from_baseline", "operator": ">=", "value": 7500, "is_profit_proxy": true },
    { "metric_name": "Customer Satisfaction", "type": "absolute", "operator": ">=", "value": 60 }
]'::JSONB
WHERE name = 'Price with Purpose';

-- Update Goal 3: Lead the Team, Build the Dream
-- All conditions are absolute floors based on original goal structure.
-- Absolute CS floor: 70%
-- Absolute Ethical Decision Making floor: 60%
-- Absolute Reputation floor: 3.5 stars
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Customer Satisfaction", "type": "absolute", "operator": ">=", "value": 70 },
    { "metric_name": "Ethical Decision Making", "type": "absolute", "operator": ">=", "value": 60 },
    { "metric_name": "Reputation", "type": "absolute", "operator": ">=", "value": 3.5 }
]'::JSONB
WHERE name = 'Lead the Team, Build the Dream';

-- Update Goal 4: Make the Ethical Call
-- Target Revenue Increase (cumulative): ₹8,000 (aiming for ~3 attempts)
-- Absolute Ethical Decision Making floor: 80%
-- Absolute CS floor: 50%
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "type": "change_from_baseline", "operator": ">=", "value": 8000, "is_profit_proxy": true },
    { "metric_name": "Ethical Decision Making", "type": "absolute", "operator": ">=", "value": 80 },
    { "metric_name": "Customer Satisfaction", "type": "absolute", "operator": ">=", "value": 50 }
]'::JSONB
WHERE name = 'Make the Ethical Call';

-- Update Goal 5: Innovate and Scale
-- Target Revenue Increase (cumulative, e.g., from new bundle): ₹5,000 (aiming for ~2 attempts)
-- Absolute Reputation floor: 4.0 stars
-- Absolute CS floor: 60%
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "type": "change_from_baseline", "operator": ">=", "value": 5000 },
    { "metric_name": "Reputation", "type": "absolute", "operator": ">=", "value": 4.0 },
    { "metric_name": "Customer Satisfaction", "type": "absolute", "operator": ">=", "value": 60 }
]'::JSONB
WHERE name = 'Innovate and Scale';

-- Verify the updates
SELECT name, win_conditions_structured FROM public.goals;