-- ========= GOALS DEFINITIONS =========
INSERT INTO public.goals (name, description, target_kcs_description, win_conditions_description) VALUES
(
    'Break Even and Build Trust',
    'Get your drone business off the ground! Your first challenge is to achieve a profit of at least ₹2,000. While doing so, ensure your customers are happy (satisfaction > 50%) and that your good service earns you at least one referral (tracked via reputation).',
    'Focuses on understanding basic finances (profit calculation), building initial customer trust, and recognizing early customer segments.',
    'Profit >= ₹2000 AND Customer Satisfaction >= 50% AND Reputation >= 3.0 stars.'
),
(
    'Price with Purpose',
    'The market is changing! Adjust your pricing to stay competitive and fair. Aim for a profit of ₹4,000 while keeping customer satisfaction above 60%. This will require understanding your costs and local needs.',
    'Focuses on applying pricing strategies, differentiating costs, and adapting services.',
    'Profit >= ₹4000 AND Customer Satisfaction >= 60%.'
),
(
    'Lead the Team, Build the Dream',
    'Time to expand! Hire your first employee. Your goal is to maintain high team morale (above 70%) and ensure all customer services are delivered on time for a week, showcasing good workforce balance.',
    'Focuses on balancing workforce with demand, investing in training, and effective delegation.',
    'Customer Satisfaction >= 70% AND Ethical Decision Making >= 60% AND Reputation >= 3.5 stars.' -- Morale tied to Ethical DM & Reputation
),
(
    'Make the Ethical Call',
    'Growth brings new challenges. Increase your profit by ₹5,000, but it’s crucial to maintain a high ethical standing (above 80%) and avoid losing customers due to unethical practices like misinformation.',
    'Focuses on navigating ethical dilemmas, calculated risk-taking related to business practices, and evaluating maintenance investments that impact service/safety.',
    'Profit increase of ₹5000 AND Ethical Decision Making >= 80% AND Customer Satisfaction >= 50%.'
),
(
    'Innovate and Scale',
    'Look to the future! Identify a new customer group and develop a creative bundled drone service. This new offering should add ₹2,000 in revenue and boost your reputation for innovation.',
    'Focuses on identifying new customer segments, creative problem solving for service offerings, and matching drone capabilities to diverse needs.',
    'Revenue increase of ₹2000 from new bundle AND Reputation >= 4.0 stars AND Customer Satisfaction >= 60%.'
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  target_kcs_description = EXCLUDED.target_kcs_description,
  win_conditions_description = EXCLUDED.win_conditions_description;
