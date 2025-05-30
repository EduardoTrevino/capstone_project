-- ========= METRICS DEFINITIONS =========
INSERT INTO public.metrics (name, description, data_type, min_value, max_value, initial_value) VALUES
('Revenue', 'Financial Performance of the business a monetary value can go up or down', 'TIMESERIES_NUMERIC', NULL, NULL, 0),
('Customer Satisfaction', 'How the people you are serving feel', 'PERCENTAGE', 0, 100, 50),
('Reputation', 'How you are perceived as a business / brand, your image', 'RATING_5_STARS', 0, 5, 2.5),
('Ethical Decision Making', 'How ethical (positive) or non-ethical (negative) your decisions are', 'PERCENTAGE', 0, 100, 50),
('Risk-Taking', 'This is how risky your decisions are', 'PERCENTAGE', 0, 100, 20) -- Initial: Safe
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  data_type = EXCLUDED.data_type,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  initial_value = EXCLUDED.initial_value;