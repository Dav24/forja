-- Incrementa el contador de mensajes diarios del usuario (upsert atómico)
CREATE OR REPLACE FUNCTION increment_daily_message_count(p_user_id UUID, p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO daily_message_count (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = daily_message_count.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Devuelve el conteo diario actual del usuario
CREATE OR REPLACE FUNCTION get_daily_message_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(count, 0)
  FROM daily_message_count
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
