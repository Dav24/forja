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
-- Guard: si hay un JWT de usuario (auth.uid() no nulo), solo puede
-- consultar su propio saldo. Las llamadas service-role (auth.uid() nulo)
-- no están restringidas aquí, aunque en el plan actual esta función solo
-- la llaman clientes con sesión de usuario.
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  -- IS DISTINCT FROM (no !=) para que un p_user_id NULL también dispare la
  -- excepción en vez de colar silenciosamente (NULL != x es NULL, que un IF
  -- trata como falso).
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'No autorizado: solo puedes consultar tu propio saldo de créditos';
  END IF;

  RETURN COALESCE(
    (SELECT SUM(amount) FROM public.credit_ledger WHERE user_id = p_user_id),
    0
  )::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Descuenta 1 crédito de forma atómica. pg_advisory_xact_lock por usuario
-- porque no hay una fila de balance que lockear con FOR UPDATE (es un
-- ledger, no un contador) — se libera solo al terminar la transacción.
-- Devuelve el saldo nuevo, o -1 si no había saldo suficiente (no inserta
-- nada en ese caso). Este lock es lo único que cierra la carrera entre
-- generate-plan y generate-meal-plan compitiendo por el mismo pool.
--
-- A diferencia de get_credit_balance/grant_credit, esta guarda es
-- incondicional (rechaza también las llamadas service-role, auth.uid() nulo)
-- a propósito: en el plan actual consume_credit solo se invoca desde las
-- edge functions con la sesión propia del usuario (nunca desde el webhook
-- de Stripe con el cliente service-role), así que no existe un caso
-- legítimo de llamada sin JWT de usuario que deba permitirse aquí.
CREATE OR REPLACE FUNCTION consume_credit(p_user_id UUID, p_action TEXT, p_related_job_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- IS DISTINCT FROM (no !=) para que un p_user_id NULL también dispare la
  -- excepción en vez de colar silenciosamente.
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'No autorizado: solo puedes consumir créditos de tu propia cuenta';
  END IF;

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

-- Único punto de escritura de créditos positivos (compras del webhook,
-- reembolsos de generación fallida). ON CONFLICT en stripe_payment_intent_id
-- hace que un reintento del webhook de Stripe sea no-op seguro en vez de
-- duplicar el crédito (solo aplica cuando ese id no es null: los reembolsos
-- internos no lo llevan).
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
  -- auth.uid() NULL == llamada service-role (webhook de Stripe): confiable,
  -- puede otorgar cualquier monto/tipo a cualquier usuario. Si hay JWT de
  -- usuario, solo se permite el camino de reembolso de una generación
  -- fallida propia (1 crédito, type='refund', a sí mismo), y ese reembolso
  -- debe estar ligado a un job real, propio y fallido, que no haya sido
  -- reembolsado ya — de lo contrario un usuario podría acuñar créditos
  -- gratis llamando grant_credit(propio_id, 1, 'refund') en bucle sin
  -- job ni fallo real de por medio.
  IF auth.uid() IS NOT NULL THEN
    -- IS DISTINCT FROM (no !=) para que un p_type/p_amount/p_user_id NULL
    -- también dispare la excepción en vez de colar silenciosamente (NULL !=
    -- x es NULL, que un IF trata como falso).
    IF p_type IS DISTINCT FROM 'refund' OR p_amount IS DISTINCT FROM 1 OR p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'No autorizado: solo puedes otorgarte un reembolso de 1 crédito a tu propia cuenta';
    END IF;

    -- El reembolso debe referenciar un job propio que de verdad falló.
    IF p_related_job_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.async_jobs
      WHERE id = p_related_job_id
        AND user_id = auth.uid()
        AND status = 'failed'
    ) THEN
      RAISE EXCEPTION 'No autorizado: el reembolso debe referenciar un job fallido de tu propia cuenta';
    END IF;

    -- Ese mismo job no puede haber sido reembolsado ya (evita doble
    -- reembolso si la edge function reintenta la llamada RPC tras un
    -- corte de red).
    IF EXISTS (
      SELECT 1 FROM public.credit_ledger
      WHERE related_job_id = p_related_job_id
        AND type = 'refund'
    ) THEN
      RAISE EXCEPTION 'No autorizado: este job ya fue reembolsado';
    END IF;
  END IF;

  INSERT INTO public.credit_ledger (user_id, amount, type, related_job_id, stripe_payment_intent_id)
  VALUES (p_user_id, p_amount, p_type, p_related_job_id, p_stripe_payment_intent_id)
  ON CONFLICT (stripe_payment_intent_id) DO NOTHING;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.credit_ledger
  WHERE user_id = p_user_id;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
