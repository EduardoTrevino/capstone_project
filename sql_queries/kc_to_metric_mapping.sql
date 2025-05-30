-- ========= KC METRIC EFFECTS MAPPINGS =========
-- This maps which KCs can affect which Metrics. The actual score impact comes from AI per option.
WITH mappings AS (
  SELECT 'KC6' AS kc_id_str, 'Revenue' AS metric_name -- Profit is calculated, Revenue is a direct metric.
  UNION ALL SELECT 'KC5', unnest(ARRAY['Reputation', 'Customer Satisfaction'])
  UNION ALL SELECT 'KC11a', unnest(ARRAY['Reputation', 'Customer Satisfaction', 'Revenue']) -- Finding segments can boost revenue
  UNION ALL SELECT 'KC7', unnest(ARRAY['Revenue', 'Customer Satisfaction', 'Reputation'])
  UNION ALL SELECT 'KC4', 'Revenue' -- Understanding costs affects profitability, shown via Revenue metric (less cost = more potential for net positive change in Revenue if prices constant)
  UNION ALL SELECT 'KC10', unnest(ARRAY['Customer Satisfaction', 'Revenue', 'Reputation'])
  UNION ALL SELECT 'KC3', unnest(ARRAY['Customer Satisfaction', 'Revenue']) -- Workforce balance affects costs (Revenue) and service quality (CS)
  UNION ALL SELECT 'KC13', unnest(ARRAY['Reputation', 'Ethical Decision Making', 'Customer Satisfaction']) -- Training impacts all three
  UNION ALL SELECT 'KC14', unnest(ARRAY['Revenue', 'Risk-Taking']) -- Delegation can free up for revenue-gen activities, or be risky if done poorly
  UNION ALL SELECT 'KC18', unnest(ARRAY['Ethical Decision Making', 'Reputation', 'Customer Satisfaction'])
  UNION ALL SELECT 'KC16', unnest(ARRAY['Risk-Taking', 'Revenue', 'Ethical Decision Making'])
  UNION ALL SELECT 'KC2', unnest(ARRAY['Revenue', 'Reputation']) -- Maintenance affects costs (Revenue) and reliability (Reputation)
  UNION ALL SELECT 'KC11', unnest(ARRAY['Reputation', 'Customer Satisfaction', 'Revenue']) -- New segments -> revenue
  UNION ALL SELECT 'KC19', unnest(ARRAY['Revenue', 'Risk-Taking', 'Customer Satisfaction']) -- Creative solutions can improve all
  UNION ALL SELECT 'KC20', unnest(ARRAY['Reputation', 'Revenue', 'Customer Satisfaction'])
)
INSERT INTO public.kc_metric_effects (kc_id, metric_id)
SELECT k.id, m.id
FROM mappings map
JOIN public.kcs k ON k.kc_identifier = map.kc_id_str
JOIN public.metrics m ON m.name = map.metric_name
ON CONFLICT (kc_id, metric_id) DO NOTHING;