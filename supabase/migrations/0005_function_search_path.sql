-- Hardening: funciones SECURITY DEFINER deben fijar search_path y calificar tablas.
-- Misma clase de bug que rompió handle_new_user() en el signup (0001, corregido).
-- Estas funcionan hoy vía RPC porque PostgREST incluye public en el search_path,
-- pero sin el fix son frágiles y vulnerables a search_path hijacking.

CREATE OR REPLACE FUNCTION increment_daily_message_count(p_user_id UUID, p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_message_count (user_id, date, count)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET count = daily_message_count.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_daily_message_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(count, 0)
  FROM public.daily_message_count
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
