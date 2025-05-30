-- Update Goal 1: Break Even and Build Trust
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "operator": ">=", "value": 2000, "is_profit_proxy": true },
    { "metric_name": "Customer Satisfaction", "operator": ">=", "value": 50 },
    { "metric_name": "Reputation", "operator": ">=", "value": 3.0 }
]'::JSONB
WHERE name = 'Break Even and Build Trust';

-- Update Goal 2: Price with Purpose
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "operator": ">=", "value": 4000, "is_profit_proxy": true },
    { "metric_name": "Customer Satisfaction", "operator": ">=", "value": 60 }
]'::JSONB
WHERE name = 'Price with Purpose';

-- Update Goal 3: Lead the Team, Build the Dream
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Customer Satisfaction", "operator": ">=", "value": 70 },
    { "metric_name": "Ethical Decision Making", "operator": ">=", "value": 60 },
    { "metric_name": "Reputation", "operator": ">=", "value": 3.5 }
]'::JSONB
WHERE name = 'Lead the Team, Build the Dream';

-- Update Goal 4: Make the Ethical Call
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "operator": ">=", "value": 5000, "type": "increase", "is_profit_proxy": true },
    { "metric_name": "Ethical Decision Making", "operator": ">=", "value": 80 },
    { "metric_name": "Customer Satisfaction", "operator": ">=", "value": 50 }
]'::JSONB
WHERE name = 'Make the Ethical Call';

-- Update Goal 5: Innovate and Scale
UPDATE public.goals
SET win_conditions_structured = '[
    { "metric_name": "Revenue", "operator": ">=", "value": 2000, "type": "increase_from_new_bundle" },
    { "metric_name": "Reputation", "operator": ">=", "value": 4.0 },
    { "metric_name": "Customer Satisfaction", "operator": ">=", "value": 60 }
]'::JSONB
WHERE name = 'Innovate and Scale';

-- Verify the updates
SELECT name, win_conditions_structured FROM public.goals;