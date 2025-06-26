-- 3. Recreate the function to accept a NUMERIC parameter instead of INTEGER
CREATE OR REPLACE FUNCTION increment_user_kc_score(
    p_user_id UUID,
    p_kc_id INTEGER,
    p_increment_value NUMERIC -- The key change is here: from INTEGER to NUMERIC
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