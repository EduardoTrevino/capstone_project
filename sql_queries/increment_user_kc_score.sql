CREATE OR REPLACE FUNCTION increment_user_kc_score(
    p_user_id UUID,
    p_kc_id INTEGER,
    p_increment_value INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_kc_scores (user_id, kc_id, current_score, last_updated_at)
    VALUES (p_user_id, p_kc_id, p_increment_value, NOW())
    ON CONFLICT (user_id, kc_id)
    DO UPDATE SET
        current_score = public.user_kc_scores.current_score + p_increment_value,
        last_updated_at = NOW();
END;
$$ LANGUAGE plpgsql;