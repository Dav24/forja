-- Paquetes de créditos consumibles: ledger transaccional, no contador simple,
-- para auditoría/soporte a futuro. Ver docs/superpowers/specs/2026-07-19-paquetes-de-creditos.md

CREATE TABLE credit_ledger (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount                    INTEGER NOT NULL CHECK (amount != 0),
  type                      TEXT NOT NULL CHECK (type IN ('purchase', 'consumption', 'refund', 'grant')),
  related_job_id            UUID REFERENCES async_jobs(id) ON DELETE SET NULL,
  stripe_payment_intent_id  TEXT UNIQUE,
  metadata                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- Desviación deliberada del patrón "FOR ALL" que usa el resto del esquema:
-- este es un ledger de valor, no un dato del usuario. 0004_grants.sql ya da
-- INSERT/UPDATE/DELETE amplios a `authenticated`; sin restringir esto, un
-- usuario podría insertarse créditos directo vía PostgREST. Solo lectura
-- propia (un INSERT/UPDATE/DELETE directo vía PostgREST viola esta policy
-- de RLS y Postgres responde "new row violates row-level security policy");
-- toda escritura pasa por las RPCs SECURITY DEFINER de abajo o por el
-- webhook (service-role, bypassea RLS).
CREATE POLICY "users_read_own_credits" ON credit_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Devuelve el saldo actual del usuario (suma de amount en el ledger).
-- Sigue siendo callable por `authenticated` (el cliente RN la usa para el
-- badge de saldo) — por eso SÍ necesita su propio guard de auth.uid().
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'get_credit_balance: solo puedes consultar tu propio saldo';
  END IF;
  RETURN (
    SELECT COALESCE(SUM(amount), 0)::INTEGER
    FROM public.credit_ledger
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Descuenta 1 crédito de forma atómica. pg_advisory_xact_lock por usuario
-- porque no hay una fila de balance que lockear con FOR UPDATE (es un
-- ledger, no un contador) — se libera solo al terminar la transacción.
-- Devuelve el saldo nuevo, o -1 si no había saldo suficiente (no inserta
-- nada en ese caso). Este lock es lo único que cierra la carrera entre
-- generate-plan y generate-meal-plan compitiendo por el mismo pool.
--
-- SIN guard de auth.uid(): la seguridad la da el REVOKE de abajo, no un
-- chequeo en el cuerpo. Un guard de auth.uid()=p_user_id sería insuficiente
-- de todas formas — el usuario comparte el mismo JWT que la Edge Function
-- usa para llamarla, así que "restringir a auth.uid() propio" no distingue
-- "la Edge Function actuando por el usuario" de "el usuario llamando
-- directo por PostgREST". Por eso esta función y grant_credit solo son
-- invocables por las Edge Functions vía su cliente de SERVICE ROLE — ver
-- Tasks 4 y 5.
CREATE OR REPLACE FUNCTION consume_credit(p_user_id UUID, p_action TEXT, p_related_job_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.credit_ledger
  WHERE user_id = p_user_id;

  IF v_balance < 1 THEN
    RETURN -1;
  END IF;

  INSERT INTO public.credit_ledger (user_id, amount, type, related_job_id, metadata)
  VALUES (p_user_id, -1, 'consumption', p_related_job_id, jsonb_build_object('action', p_action));

  RETURN v_balance - 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION consume_credit(UUID, TEXT, UUID) FROM PUBLIC, authenticated;

-- Único punto de escritura de créditos positivos (compras del webhook,
-- reembolsos de generación fallida). ON CONFLICT en stripe_payment_intent_id
-- hace que un reintento del webhook de Stripe sea no-op seguro en vez de
-- duplicar el crédito (solo aplica cuando ese id no es null: los reembolsos
-- internos no lo llevan). Mismo motivo que consume_credit para no llevar
-- guard de auth.uid(): la protección real es el REVOKE de abajo — solo
-- llamable vía el cliente de service role de las Edge Functions (Tasks 4/5)
-- o del webhook de Stripe.
CREATE OR REPLACE FUNCTION grant_credit(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_related_job_id UUID DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  INSERT INTO public.credit_ledger (user_id, amount, type, related_job_id, stripe_payment_intent_id)
  VALUES (p_user_id, p_amount, p_type, p_related_job_id, p_stripe_payment_intent_id)
  ON CONFLICT (stripe_payment_intent_id) DO NOTHING;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.credit_ledger
  WHERE user_id = p_user_id;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION grant_credit(UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC, authenticated;
