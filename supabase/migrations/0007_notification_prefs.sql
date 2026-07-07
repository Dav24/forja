-- Preferencias de notificaciones push (2 grupos, no 5 toggles):
-- reminders = missed_workout + diet_alert | updates = progress_update + goal_milestone + plan_ready
ALTER TABLE profiles ADD COLUMN notif_reminders BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN notif_updates   BOOLEAN NOT NULL DEFAULT TRUE;

-- Redefinir para exponer las preferencias al worker de notificaciones.
DROP FUNCTION IF EXISTS get_notification_targets();
CREATE FUNCTION get_notification_targets()
RETURNS TABLE (
  user_id           UUID,
  expo_push_token   TEXT,
  plan              TEXT,
  sub_status        TEXT,
  current_period_end TIMESTAMPTZ,
  goal_type         TEXT,
  target_weight_kg  NUMERIC,
  target_date       DATE,
  last_activity     TIMESTAMPTZ,
  first_weight      NUMERIC,
  current_weight    NUMERIC,
  notif_reminders   BOOLEAN,
  notif_updates     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_body AS (
    SELECT DISTINCT ON (user_id) user_id, recorded_at AS last_body_at
    FROM body_data ORDER BY user_id, recorded_at DESC
  ),
  last_chat AS (
    SELECT user_id, MAX(date)::TIMESTAMPTZ AS last_chat_at
    FROM daily_message_count GROUP BY user_id
  ),
  first_weight AS (
    SELECT DISTINCT ON (user_id) user_id, weight_kg
    FROM body_data WHERE weight_kg IS NOT NULL ORDER BY user_id, recorded_at ASC
  ),
  latest_weight AS (
    SELECT DISTINCT ON (user_id) user_id, weight_kg
    FROM body_data WHERE weight_kg IS NOT NULL ORDER BY user_id, recorded_at DESC
  ),
  active_goal AS (
    SELECT DISTINCT ON (user_id) user_id, type, target_weight_kg, target_date
    FROM goals WHERE is_active = TRUE ORDER BY user_id, created_at DESC
  )
  SELECT
    p.id AS user_id,
    p.expo_push_token,
    COALESCE(s.plan, 'free') AS plan,
    COALESCE(s.status, 'active') AS sub_status,
    s.current_period_end,
    g.type AS goal_type,
    g.target_weight_kg,
    g.target_date,
    GREATEST(lb.last_body_at, lc.last_chat_at) AS last_activity,
    fw.weight_kg AS first_weight,
    lw.weight_kg AS current_weight,
    p.notif_reminders,
    p.notif_updates
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  LEFT JOIN active_goal g ON g.user_id = p.id
  LEFT JOIN last_body lb ON lb.user_id = p.id
  LEFT JOIN last_chat lc ON lc.user_id = p.id
  LEFT JOIN first_weight fw ON fw.user_id = p.id
  LEFT JOIN latest_weight lw ON lw.user_id = p.id
  WHERE p.expo_push_token IS NOT NULL
    AND (p.notif_reminders OR p.notif_updates);
$$;

-- 0004 dio EXECUTE a authenticated por DEFAULT PRIVILEGES; esta función es
-- SECURITY DEFINER y expone datos de todos los usuarios: solo service_role.
REVOKE ALL ON FUNCTION get_notification_targets() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_notification_targets() FROM authenticated;
GRANT EXECUTE ON FUNCTION get_notification_targets() TO service_role;
