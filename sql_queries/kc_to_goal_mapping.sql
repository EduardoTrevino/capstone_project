-- ========= GOAL KCs MAPPINGS =========
-- Goal 1: Break Even and Build Trust
INSERT INTO public.goal_kcs (goal_id, kc_id)
SELECT g.id, k.id FROM public.goals g, public.kcs k
WHERE g.name = 'Break Even and Build Trust' AND k.kc_identifier IN ('KC6', 'KC5', 'KC11a')
ON CONFLICT (goal_id, kc_id) DO NOTHING;

-- Goal 2: Price with Purpose
INSERT INTO public.goal_kcs (goal_id, kc_id)
SELECT g.id, k.id FROM public.goals g, public.kcs k
WHERE g.name = 'Price with Purpose' AND k.kc_identifier IN ('KC7', 'KC4', 'KC10')
ON CONFLICT (goal_id, kc_id) DO NOTHING;

-- Goal 3: Lead the Team, Build the Dream
INSERT INTO public.goal_kcs (goal_id, kc_id)
SELECT g.id, k.id FROM public.goals g, public.kcs k
WHERE g.name = 'Lead the Team, Build the Dream' AND k.kc_identifier IN ('KC3', 'KC13', 'KC14')
ON CONFLICT (goal_id, kc_id) DO NOTHING;

-- Goal 4: Make the Ethical Call
INSERT INTO public.goal_kcs (goal_id, kc_id)
SELECT g.id, k.id FROM public.goals g, public.kcs k
WHERE g.name = 'Make the Ethical Call' AND k.kc_identifier IN ('KC18', 'KC16', 'KC2')
ON CONFLICT (goal_id, kc_id) DO NOTHING;

-- Goal 5: Innovate and Scale
INSERT INTO public.goal_kcs (goal_id, kc_id)
SELECT g.id, k.id FROM public.goals g, public.kcs k
WHERE g.name = 'Innovate and Scale' AND k.kc_identifier IN ('KC11', 'KC19', 'KC20')
ON CONFLICT (goal_id, kc_id) DO NOTHING;