# Paquetes de créditos consumibles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un usuario gratis que agotó su cuota mensual/lifetime de generación de planes (entreno o comida) compre un paquete de créditos consumibles de una sola vez, sin suscribirse a premium, y que ese crédito se cobre de forma segura (sin doble gasto, con reembolso automático si la generación falla).

**Architecture:** Ledger transaccional en Postgres (`credit_ledger`) con RPCs `SECURITY DEFINER` para leer/consumir/otorgar saldo de forma atómica (lock advisory por usuario). `generate-plan` y `generate-meal-plan` ganan un tercer camino de gating (además de "premium ilimitado" y "free dentro de cuota"): "free sobre cuota con crédito" — consume el crédito antes de llamar a la IA y lo reembolsa si la generación falla en cualquier punto. La compra reutiliza el patrón Stripe-web existente (checkout `mode:'payment'` en vez de `'subscription'`, misma ruta de `Linking.openURL` desde la app, sin IAP nativo).

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), Next.js/Stripe (`web/`), Expo/React Native + TanStack Query (app), Vitest (tests de `web/`), `Deno.test`/`jsr:@std/assert` (tests de Edge Functions).

## Global Constraints

- Créditos unificados: un solo saldo, gastable en `generate-plan` y `generate-meal-plan` únicamente. `chat/index.ts` no se toca.
- Ledger transaccional (`credit_ledger`), no un contador simple.
- Cobro por reserva-y-reembolso: el crédito se descuenta ANTES de llamar a Anthropic, se reembolsa si la generación falla después.
- Sin IAP nativo — reutilizar el patrón Stripe-web (`Linking.openURL`) igual que la suscripción premium hoy.
- `credit_ledger` usa RLS de solo-lectura para el dueño (`FOR SELECT USING (auth.uid() = user_id)`), SIN policy de escritura — desviación deliberada del patrón `FOR ALL` que usa el resto del esquema, porque es un ledger de valor, no un dato de usuario.
- `consume_credit`/`grant_credit` son invocables SOLO por el cliente de service role (`REVOKE EXECUTE ... FROM authenticated` en la migración) — nunca por el cliente con el JWT del usuario. Motivo: un usuario comparte el mismo JWT que la Edge Function reenvía, así que cualquier RPC alcanzable con ese JWT es alcanzable directo por PostgREST; solo el service role distingue "la Edge Function actuando en nombre del usuario" de "el usuario llamando directo". `generate-plan`/`generate-meal-plan` (Tasks 4/5) deben crear e usar un cliente de service role (mismo patrón que el `cleanupClient` que ya existe en `generate-meal-plan/index.ts`) para TODAS las llamadas a estas dos RPCs. `get_credit_balance` es la excepción: se queda callable por `authenticated` (el badge de saldo en el cliente RN la necesita) y por eso lleva su propio guard de `auth.uid() = p_user_id`.
- Mantener la duplicación de código entre `generate-plan/index.ts` y `generate-meal-plan/index.ts` (no extraer un módulo compartido) — consistente con cómo ya están escritos hoy.
- Toda cadena de texto nueva visible al usuario necesita clave en `locales/es/*.json` Y `locales/en/*.json` (namespace parity forzada por `scripts/check-i18n.mjs`). No usar plurales de i18next.
- Seguir el patrón de testing ya establecido en este repo: lógica con ramas de decisión reales se extrae a un módulo pequeño con `Deno.test`/`jsr:@std/assert` (Edge Functions) o Vitest (`web/`) — ver `supabase/functions/swap-meal/logic.ts`+`logic.test.ts`, `supabase/functions/stripe-webhook/status.ts`+`status.test.ts`, `web/lib/checkout.ts`+`checkout.test.ts`. El código dentro de `Deno.serve(...)` en sí y los componentes de página no se testean directo en este repo — se verifican manualmente (curl / E2E).

## File Structure

- `supabase/migrations/0015_credit_ledger.sql` — tabla `credit_ledger`, RLS, RPCs `get_credit_balance`/`consume_credit`/`grant_credit`.
- `supabase/functions/generate-plan/credits.ts` (+ `credits.test.ts`) — decisión pura de gating (premium/cuota/saldo → acción).
- `supabase/functions/generate-meal-plan/credits.ts` (+ `credits.test.ts`) — misma lógica, duplicada por archivo.
- `supabase/functions/generate-plan/index.ts` — wiring del tercer camino de gating + consumo + reembolso.
- `supabase/functions/generate-meal-plan/index.ts` — ídem.
- `supabase/functions/stripe-webhook/packs.ts` (+ `packs.test.ts`) — mapa packId→cantidad de créditos.
- `supabase/functions/stripe-webhook/index.ts` — nueva rama `mode:'payment'` en `checkout.session.completed`.
- `web/lib/checkout.ts` (+ `checkout.test.ts`) — `createCreditPackCheckoutSession`, `packPriceIdFor`.
- `web/app/api/checkout/route.ts` — acepta `kind:'credit_pack'`.
- `constants/pricing.ts` — constantes de precio del paquete (app RN).
- `web/components/CreditPackSection.tsx` + `web/app/credits/page.tsx` — página web nueva de compra.
- `lib/payments.ts` — `buildCreditPackURL`.
- `hooks/useCreditBalance.ts` — hook nuevo, saldo del usuario.
- `hooks/useWorkoutPlan.ts` — nuevo branch de error `no_credits_remaining`.
- `app/(app)/plans/meal/index.tsx` + `locales/{es,en}/plans.json` — ídem para plan de comida.
- `app/(app)/profile.tsx` + `locales/{es,en}/profile.json` — badge de saldo de créditos.

---

### Task 1: Migración `0015_credit_ledger.sql` — tabla, RLS, RPCs

**Files:**
- Create: `supabase/migrations/0015_credit_ledger.sql`
- Modify: `types/database.types.ts` (regenerar, no a mano — ver Step 4)

**Interfaces:**
- Produces: RPCs `get_credit_balance(p_user_id uuid) → integer`, `consume_credit(p_user_id uuid, p_action text, p_related_job_id uuid) → integer` (-1 = sin saldo), `grant_credit(p_user_id uuid, p_amount integer, p_type text, p_related_job_id uuid default null, p_stripe_payment_intent_id text default null) → integer`. Tabla `credit_ledger(id, user_id, amount, type, related_job_id, stripe_payment_intent_id, metadata, created_at)`.

No hay test runner para migraciones SQL en este repo — la verificación es manual contra Supabase local.

- [ ] **Step 1: Escribir la migración**

```sql
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
-- propia; toda escritura pasa por las RPCs SECURITY DEFINER de abajo o por
-- el webhook (service-role, bypassea RLS).
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
```

- [ ] **Step 2: Aplicar localmente**

Run: `cd "forja" && supabase db reset`
Expected: la migración `0015_credit_ledger.sql` corre sin error junto con las 14 anteriores.

- [ ] **Step 3: Verificar las RPCs manualmente (como service role — sesión psql normal, sin JWT)**

Run (psql local, o SQL editor de Studio — usar un `user_id` real de `profiles` en tu DB local):

```sql
select grant_credit('00000000-0000-0000-0000-000000000001'::uuid, 3, 'grant');
-- expect: 3
select get_credit_balance('00000000-0000-0000-0000-000000000001'::uuid);
-- expect: 3
select consume_credit('00000000-0000-0000-0000-000000000001'::uuid, 'generate_workout_plan', null);
-- expect: 2
select consume_credit('00000000-0000-0000-0000-000000000001'::uuid, 'generate_workout_plan', null);
select consume_credit('00000000-0000-0000-0000-000000000001'::uuid, 'generate_workout_plan', null);
-- expect: 1, luego 0
select consume_credit('00000000-0000-0000-0000-000000000001'::uuid, 'generate_workout_plan', null);
-- expect: -1 (sin saldo, y NO debe haber insertado fila nueva — confirmar con select count(*) from credit_ledger where user_id = '...')
select grant_credit('00000000-0000-0000-0000-000000000001'::uuid, 5, 'purchase', null, 'pi_test_123');
select grant_credit('00000000-0000-0000-0000-000000000001'::uuid, 5, 'purchase', null, 'pi_test_123');
-- el segundo grant_credit con el MISMO stripe_payment_intent_id no debe duplicar:
-- select get_credit_balance(...) debe dar el mismo resultado que tras el primero, no el doble
```

- [ ] **Step 4: Verificar que RLS bloquea escritura directa Y que consume_credit/grant_credit no son invocables por un usuario autenticado**

RLS en la tabla:
```sql
select policyname, cmd from pg_policies where tablename = 'credit_ledger';
```
Expected: exactamente una fila, `cmd = 'SELECT'`. Ninguna policy de INSERT/UPDATE/DELETE — combinado con `0004_grants.sql` (que da grants amplios a `authenticated`), esto significa que un usuario autenticado que intente `insert into credit_ledger` vía PostgREST recibe `permission denied`.

Permisos de ejecución de las RPCs (simula el rol `authenticated`, que es el que PostgREST usa para requests con JWT de usuario):
```sql
set role authenticated;
select consume_credit('00000000-0000-0000-0000-000000000001'::uuid, 'x', null);
-- expect: ERROR: permission denied for function consume_credit
select grant_credit('00000000-0000-0000-0000-000000000001'::uuid, 1, 'refund');
-- expect: ERROR: permission denied for function grant_credit
select get_credit_balance('00000000-0000-0000-0000-000000000001'::uuid);
-- expect: funciona (sigue siendo callable por authenticated) — pero pasar OTRO user_id distinto al propio auth.uid() debe lanzar la excepción del guard
reset role;
```

- [ ] **Step 5: Regenerar tipos TypeScript**

Run: `cd "forja" && supabase gen types typescript --local > types/database.types.ts`
Expected: el diff de `types/database.types.ts` agrega `credit_ledger` a `Tables` y `get_credit_balance`/`consume_credit`/`grant_credit` a `Functions`. (Si el comando exacto difiere en este entorno — proyecto remoto vs local — usar el que ya se usó para las migraciones anteriores; no hay script `gen:types` en `package.json`, es manual.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0015_credit_ledger.sql types/database.types.ts
git commit -m "feat(creditos): migración credit_ledger + RPCs get/consume/grant_credit"
```

---

### Task 2: `generate-plan/credits.ts` — decisión pura de gating

**Files:**
- Create: `supabase/functions/generate-plan/credits.ts`
- Test: `supabase/functions/generate-plan/credits.test.ts`

**Interfaces:**
- Produces: `decideCreditGate(input: { isPremium: boolean; quotaExceeded: boolean; creditBalance: number }): 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked'` — usado por Task 4.

- [ ] **Step 1: Escribir el test (falla primero)**

```ts
// supabase/functions/generate-plan/credits.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { decideCreditGate } from './credits.ts';

Deno.test('premium: siempre unlimited sin importar cuota o saldo', () => {
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: true, creditBalance: 0 }), 'unlimited');
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: false, creditBalance: 0 }), 'unlimited');
});

Deno.test('free dentro de cuota: within_quota, no toca créditos', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 0 }), 'within_quota');
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 5 }), 'within_quota');
});

Deno.test('free sobre cuota con saldo: needs_credit', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 1 }), 'needs_credit');
});

Deno.test('free sobre cuota sin saldo: blocked', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 0 }), 'blocked');
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `deno test --config supabase/functions/deno.json supabase/functions/generate-plan/credits.test.ts`
Expected: FAIL — `Module not found './credits.ts'`.

- [ ] **Step 3: Implementación mínima**

```ts
// supabase/functions/generate-plan/credits.ts
export type CreditGateDecision = 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked';

export function decideCreditGate(input: {
  isPremium: boolean;
  quotaExceeded: boolean;
  creditBalance: number;
}): CreditGateDecision {
  if (input.isPremium) return 'unlimited';
  if (!input.quotaExceeded) return 'within_quota';
  if (input.creditBalance > 0) return 'needs_credit';
  return 'blocked';
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `deno test --config supabase/functions/deno.json supabase/functions/generate-plan/credits.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-plan/credits.ts supabase/functions/generate-plan/credits.test.ts
git commit -m "feat(creditos): decideCreditGate para generate-plan"
```

---

### Task 3: `generate-meal-plan/credits.ts` — misma lógica, archivo propio

**Files:**
- Create: `supabase/functions/generate-meal-plan/credits.ts`
- Test: `supabase/functions/generate-meal-plan/credits.test.ts`

**Interfaces:**
- Produces: mismo `decideCreditGate` que Task 2, duplicado (no compartido — ver Global Constraints). Usado por Task 5.

- [ ] **Step 1: Escribir el test (falla primero)** — idéntico al de Task 2, cambiando el import:

```ts
// supabase/functions/generate-meal-plan/credits.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { decideCreditGate } from './credits.ts';

Deno.test('premium: siempre unlimited sin importar cuota o saldo', () => {
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: true, creditBalance: 0 }), 'unlimited');
  assertEquals(decideCreditGate({ isPremium: true, quotaExceeded: false, creditBalance: 0 }), 'unlimited');
});

Deno.test('free dentro de cuota: within_quota, no toca créditos', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 0 }), 'within_quota');
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: false, creditBalance: 5 }), 'within_quota');
});

Deno.test('free sobre cuota con saldo: needs_credit', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 1 }), 'needs_credit');
});

Deno.test('free sobre cuota sin saldo: blocked', () => {
  assertEquals(decideCreditGate({ isPremium: false, quotaExceeded: true, creditBalance: 0 }), 'blocked');
});
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `deno test --config supabase/functions/deno.json supabase/functions/generate-meal-plan/credits.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementación mínima** (idéntica a Task 2):

```ts
// supabase/functions/generate-meal-plan/credits.ts
export type CreditGateDecision = 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked';

export function decideCreditGate(input: {
  isPremium: boolean;
  quotaExceeded: boolean;
  creditBalance: number;
}): CreditGateDecision {
  if (input.isPremium) return 'unlimited';
  if (!input.quotaExceeded) return 'within_quota';
  if (input.creditBalance > 0) return 'needs_credit';
  return 'blocked';
}
```

- [ ] **Step 4: Correr y confirmar que pasa**

Run: `deno test --config supabase/functions/deno.json supabase/functions/generate-meal-plan/credits.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-meal-plan/credits.ts supabase/functions/generate-meal-plan/credits.test.ts
git commit -m "feat(creditos): decideCreditGate para generate-meal-plan"
```

---

### Task 4: Wiring en `generate-plan/index.ts`

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts:204-274` (hoisting + gating), `:339-347` (consumo), `:395-406,411-424,426-445,485-496` (reembolso en fallos), `:517-523` (reembolso en catch externo)

**Interfaces:**
- Consumes: `decideCreditGate` de Task 2 (`./credits.ts`); RPCs `get_credit_balance`, `consume_credit`, `grant_credit` de Task 1.

**IMPORTANTE — cliente de service role obligatorio para `consume_credit`/`grant_credit`:** esas dos RPCs tienen `REVOKE EXECUTE ... FROM authenticated` en la migración (Task 1) — el cliente `supabase` normal (con el JWT del usuario) NO puede llamarlas, recibirá `permission denied`. TODAS las llamadas a `consume_credit` y `grant_credit` en este archivo deben usar el `serviceClient` creado en el Step 1. `get_credit_balance` SÍ sigue siendo callable por el cliente `supabase` normal (se queda con su propio guard de `auth.uid()`), así que esa llamada no cambia.

No hay test automatizado para el handler `Deno.serve` en sí (consistente con que `generate-plan/index.ts` no tiene `index.test.ts` hoy) — verificación manual al final del task.

- [ ] **Step 1: Import + hoisting de variables antes del `try`**

En `supabase/functions/generate-plan/index.ts`, agregar el import junto a los existentes (línea 1):

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decideCreditGate } from './credits.ts';
```

Localizar `Deno.serve(async (req) => {` (línea 204) y el `try {` que le sigue (línea 213). Las variables `job`/`user` se declaran DENTRO del `try` con `const`, así que no son visibles en el `catch` externo (línea 517) — igual que `generate-meal-plan/index.ts` ya resuelve esto con su `let jobId` hoisted. Insertar entre el `Deno.serve(async (req) => {` y el `try {`:

```ts
Deno.serve(async (req) => {
  let creditUsed = false;
  let jobId: string | null = null;
  let userId: string | null = null;
  // consume_credit/grant_credit revocan EXECUTE a `authenticated` (Task 1) —
  // solo el service role puede llamarlas. Se crea una vez aquí, fuera del
  // try, así también queda disponible en el catch externo (Step 6) sin
  // necesidad de un cliente de cleanup aparte.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
```

- [ ] **Step 2: Guardar `userId` justo después del chequeo de auth**

Localizar (línea ~228-234):
```ts
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
```
Reemplazar por:
```ts
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    userId = user.id;
```

- [ ] **Step 3: Reemplazar el bloqueo duro por la decisión de crédito**

Localizar (línea 269-274):
```ts
    if (!isPremium && plansThisMonth >= 1) {
      return new Response(
        JSON.stringify({ error: 'monthly_plan_limit_reached', plans_count: plansThisMonth }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```
Reemplazar por:
```ts
    const quotaExceeded = !isPremium && plansThisMonth >= 1;
    let creditBalance = 0;
    if (quotaExceeded) {
      const { data: balanceData } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
      creditBalance = balanceData ?? 0;
    }
    const creditGate = decideCreditGate({ isPremium, quotaExceeded, creditBalance });
    if (creditGate === 'blocked') {
      return new Response(
        JSON.stringify({ error: 'no_credits_remaining', plans_count: plansThisMonth, credit_balance: creditBalance }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```

- [ ] **Step 4: Consumir el crédito justo después de crear el `async_job`, antes de llamar a Anthropic**

Localizar el bloque de creación del job (línea ~330-347):
```ts
    const { data: job, error: jobError } = await supabase
      .from('async_jobs')
      .insert({
        user_id: user.id,
        type: 'generate_workout_plan',
        status: 'processing',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Error creando async_job:', jobError);
      return new Response(
        JSON.stringify({ error: 'internal_error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```
Agregar justo después (antes de `const prompt = buildPlanPrompt(...)`):
```ts
    jobId = job.id;

    if (creditGate === 'needs_credit') {
      const { data: remaining, error: consumeErr } = await serviceClient.rpc('consume_credit', {
        p_user_id: user.id,
        p_action: 'generate_workout_plan',
        p_related_job_id: job.id,
      });
      if (consumeErr || remaining == null || remaining < 0) {
        await supabase
          .from('async_jobs')
          .update({ status: 'failed', error: 'no_credits_remaining', completed_at: new Date().toISOString() })
          .eq('id', job.id);
        return new Response(
          JSON.stringify({ error: 'no_credits_remaining', job_id: job.id }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      creditUsed = true;
    }
```

- [ ] **Step 5: Reembolsar en cada uno de los 4 puntos de falla existentes**

Hay 4 bloques que marcan `async_jobs` como `failed` (errores de Anthropic ~línea 398-401, truncamiento por `max_tokens` ~línea 415-418, JSON inválido ~línea 436-439, fallo de insert en DB ~línea 487-490). En **cada uno** de esos 4 bloques, agregar la misma línea justo después del `.update({ status: 'failed', ... })` y antes del `return`. Por ejemplo, para el de Anthropic (línea ~398-406):

```ts
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: `Anthropic error: ${anthropicRes.status}`, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }

      return new Response(
        JSON.stringify({ error: 'ai_error', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```

Repetir el mismo `if (creditUsed) { await serviceClient.rpc('grant_credit', ...); }` (con `job.id` en `p_related_job_id`) en los otros 3 bloques (truncamiento, JSON inválido, fallo de insert), cada uno justo después de su `.update({ status: 'failed', ... })` y antes del `return`. Nota: `grant_credit` valida server-side que `p_related_job_id` referencie un `async_jobs` con `status='failed'` del mismo usuario (guard agregado en Task 1 tras revisión de seguridad) — por eso el `.update({status:'failed',...})` de `async_jobs` SIEMPRE debe ejecutarse Y completarse (await) antes de la llamada a `grant_credit`, nunca después ni en paralelo, o el refund será rechazado.

- [ ] **Step 6: Reembolsar también en el `catch` externo**

Localizar (línea 517-523):
```ts
  } catch (err) {
    console.error('generate-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
```
Reemplazar por (reutiliza el `serviceClient` ya creado en Step 1 — no hace falta crear un cliente de cleanup aparte, a diferencia del patrón viejo de `generate-meal-plan`):
```ts
  } catch (err) {
    console.error('generate-plan error:', err);
    if (creditUsed && jobId && userId) {
      await serviceClient
        .rpc('grant_credit', { p_user_id: userId, p_amount: 1, p_type: 'refund', p_related_job_id: jobId })
        .then(() => {}, () => {}); // no propagar error del cleanup, mismo patrón que generate-meal-plan
    }
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
```

**Nota sobre `p_related_job_id` en el catch externo:** si la excepción ocurre ANTES de que `async_jobs.status` se haya marcado `failed` (por ejemplo, un error inesperado entre el consumo del crédito y el primer punto de falla nombrado), `grant_credit` rechazará el reembolso porque el guard exige `status='failed'`. Esto es un caso borde aceptado — el crédito quedaría consumido sin reembolso automático en ese escenario específico (excepción no prevista fuera de los 4 puntos de falla ya mapeados). Documentarlo como riesgo residual menor en el reporte del task, no bloquea el task.

- [ ] **Step 7: Type-check y verificación manual**

Run: `deno check --config supabase/functions/deno.json supabase/functions/generate-plan/index.ts`
Expected: sin errores.

Con Supabase local corriendo y un usuario de prueba con cuota mensual agotada (`plansThisMonth >= 1`) y 0 créditos:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-plan" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"days_per_week":3,"minutes_per_session":45,"equipment":"ninguno"}'
```
Expected: `429 {"error":"no_credits_remaining", ...}`.

Otorgar 1 crédito (`select grant_credit('<uid>'::uuid, 1, 'grant');` en psql) y repetir la misma llamada.
Expected: `200`, plan generado, y `select get_credit_balance('<uid>'::uuid);` da `0`.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/generate-plan/index.ts
git commit -m "feat(creditos): generate-plan consume/reembolsa créditos cuando la cuota gratis se agota"
```

---

### Task 5: Wiring en `generate-meal-plan/index.ts`

**Files:**
- Modify: `supabase/functions/generate-meal-plan/index.ts:173-248` (hoisting + gating), `:282-294` (consumo), `:334-344,357-366,388-396` (reembolso en fallos), `:406-418` (reembolso en catch externo, ya existe `cleanupClient`)

**Interfaces:**
- Consumes: `decideCreditGate` de Task 3 (`./credits.ts`); RPCs de Task 1.

**IMPORTANTE — cliente de service role obligatorio para `consume_credit`/`grant_credit`:** igual que en Task 4, esas dos RPCs tienen `REVOKE EXECUTE ... FROM authenticated` — el cliente `supabase` normal no puede llamarlas. `get_credit_balance` sí sigue siendo callable por `supabase` normal.

- [ ] **Step 1: Import + hoisting**

Agregar import junto a los existentes:
```ts
import { decideCreditGate } from './credits.ts';
```

Localizar (línea 173-184):
```ts
Deno.serve(async (req) => {
  ...
  let jobId: string | null = null;

  try {
```
Agregar `creditUsed`, `userId` y el `serviceClient` hoisted junto al `jobId` ya existente (este `serviceClient` reemplaza al `cleanupClient` que hoy se crea de forma ad-hoc solo dentro del `catch` — ver Step 6):
```ts
Deno.serve(async (req) => {
  ...
  let jobId: string | null = null;
  let creditUsed = false;
  let userId: string | null = null;
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
```
(Mantener el resto del contenido entre `Deno.serve(async (req) => {` y `let jobId` intacto — solo agregar las líneas nuevas después de `let jobId: string | null = null;`. `createClient` ya está importado en este archivo — verifícalo, si no está agrégalo igual que en Task 4 Step 1.)

- [ ] **Step 2: Guardar `userId` tras el chequeo de auth**

Localizar (línea ~198-203):
```ts
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
```
Agregar justo después:
```ts
    userId = user.id;
```

- [ ] **Step 3: Reestructurar el gating para computar `quotaExceeded` y consultar crédito**

Localizar (línea 225-248):
```ts
    const isPremium = subResult.data?.status === 'active' && subResult.data?.plan !== 'free';
    const totalPlans = totalPlansResult.count ?? 0;

    if (isPremium) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: monthlyCount } = await supabase
        .from('meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());
      if ((monthlyCount ?? 0) >= PREMIUM_MEAL_PLAN_MONTHLY_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'meal_plan_limit_reached', count: monthlyCount }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
    } else if (totalPlans >= FREE_MEAL_PLAN_LIFETIME_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'meal_plan_limit_reached', count: totalPlans }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```
Reemplazar por (el bloque `if (isPremium)` con su cap mensual de 10 se queda EXACTAMENTE igual — premium tiene un límite real y no es candidato a créditos; solo cambia la rama `else`):
```ts
    const isPremium = subResult.data?.status === 'active' && subResult.data?.plan !== 'free';
    const totalPlans = totalPlansResult.count ?? 0;

    let quotaExceeded = false;
    if (isPremium) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: monthlyCount } = await supabase
        .from('meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());
      if ((monthlyCount ?? 0) >= PREMIUM_MEAL_PLAN_MONTHLY_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'meal_plan_limit_reached', count: monthlyCount }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
    } else {
      quotaExceeded = totalPlans >= FREE_MEAL_PLAN_LIFETIME_LIMIT;
    }

    let creditBalance = 0;
    if (quotaExceeded) {
      const { data: balanceData } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
      creditBalance = balanceData ?? 0;
    }
    const creditGate = decideCreditGate({ isPremium, quotaExceeded, creditBalance });
    if (creditGate === 'blocked') {
      return new Response(
        JSON.stringify({ error: 'no_credits_remaining', count: totalPlans, credit_balance: creditBalance }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```

- [ ] **Step 4: Consumir el crédito tras crear el `async_job`**

Localizar (línea ~282-294):
```ts
    const { data: job, error: jobError } = await supabase
      .from('async_jobs')
      .insert({ user_id: user.id, type: 'generate_meal_plan', status: 'processing' })
      .select('id').single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'internal_error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    jobId = job.id;
```
Agregar justo después de `jobId = job.id;`:
```ts

    if (creditGate === 'needs_credit') {
      const { data: remaining, error: consumeErr } = await serviceClient.rpc('consume_credit', {
        p_user_id: user.id,
        p_action: 'generate_meal_plan',
        p_related_job_id: job.id,
      });
      if (consumeErr || remaining == null || remaining < 0) {
        await supabase
          .from('async_jobs')
          .update({ status: 'failed', error: 'no_credits_remaining', completed_at: new Date().toISOString() })
          .eq('id', job.id);
        return new Response(
          JSON.stringify({ error: 'no_credits_remaining', job_id: job.id }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      creditUsed = true;
    }
```

- [ ] **Step 5: Reembolsar en los 3 puntos de falla existentes**

En los 3 bloques que marcan `async_jobs` como `failed` dentro del `try` (error de Anthropic ~línea 337-343, JSON inválido ~línea 359-365, fallo de insert ~línea 389-395), agregar `if (creditUsed) { await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id }); }` justo después del `.update({ status: 'failed', ... })` y antes del `return`. Ejemplo para el de Anthropic:

```ts
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: `Anthropic error: ${anthropicRes.status}`, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }
      return new Response(
        JSON.stringify({ error: 'ai_error', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
```

(Recordar, igual que en Task 4: `grant_credit` valida que `p_related_job_id` apunte a un `async_jobs` ya en `status='failed'` del mismo usuario — el `.update(...)` debe completarse con `await` antes de llamar a `grant_credit`, como ya está en el orden de arriba.)

- [ ] **Step 6: Reembolsar en el `catch` externo (reutiliza el `serviceClient` hoisted)**

Localizar (línea ~406-418):
```ts
  } catch (err) {
    console.error('generate-meal-plan error:', err);
    if (jobId) {
      const cleanupClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await cleanupClient
        .from('async_jobs')
        .update({ status: 'failed', error: 'unexpected_error', completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .catch(() => {}); // no propagar error del cleanup
    }
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
```
Reemplazar por (usa el `serviceClient` hoisted en Step 1 en vez de crear un `cleanupClient` nuevo aquí — ya no hace falta, es el mismo cliente):
```ts
  } catch (err) {
    console.error('generate-meal-plan error:', err);
    if (jobId) {
      await serviceClient
        .from('async_jobs')
        .update({ status: 'failed', error: 'unexpected_error', completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .catch(() => {}); // no propagar error del cleanup
      if (creditUsed && userId) {
        await serviceClient
          .rpc('grant_credit', { p_user_id: userId, p_amount: 1, p_type: 'refund', p_related_job_id: jobId })
          .then(() => {}, () => {});
      }
    }
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
```

- [ ] **Step 7: Type-check y verificación manual**

Run: `deno check --config supabase/functions/deno.json supabase/functions/generate-meal-plan/index.ts`
Expected: sin errores.

Repetir la misma verificación manual del Task 4 (Step 7) pero contra `/functions/v1/generate-meal-plan`, con un usuario que ya tenga su plan gratuito de por vida usado.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/generate-meal-plan/index.ts
git commit -m "feat(creditos): generate-meal-plan consume/reembolsa créditos cuando la cuota gratis se agota"
```

---

### Task 6: `stripe-webhook/packs.ts` — mapa de paquetes

**Files:**
- Create: `supabase/functions/stripe-webhook/packs.ts`
- Test: `supabase/functions/stripe-webhook/packs.test.ts`

**Interfaces:**
- Produces: `creditAmountForPack(packId: string | undefined | null): number | null`. Usado por Task 7.

- [ ] **Step 1: Escribir el test (falla primero)**

```ts
// supabase/functions/stripe-webhook/packs.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { creditAmountForPack } from './packs.ts';

Deno.test('creditAmountForPack devuelve la cantidad para un pack conocido', () => {
  assertEquals(creditAmountForPack('pack_3'), 3);
});

Deno.test('creditAmountForPack devuelve null para un pack desconocido', () => {
  assertEquals(creditAmountForPack('pack_inventado'), null);
});

Deno.test('creditAmountForPack devuelve null si no viene packId', () => {
  assertEquals(creditAmountForPack(undefined), null);
  assertEquals(creditAmountForPack(null), null);
});
```

- [ ] **Step 2: Correr y confirmar que falla**

Run: `deno test --config supabase/functions/deno.json supabase/functions/stripe-webhook/packs.test.ts`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementación mínima**

```ts
// supabase/functions/stripe-webhook/packs.ts
export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  pack_3: 3,
};

export function creditAmountForPack(packId: string | undefined | null): number | null {
  if (!packId) return null;
  return CREDIT_PACK_AMOUNTS[packId] ?? null;
}
```

- [ ] **Step 4: Correr y confirmar que pasa**

Run: `deno test --config supabase/functions/deno.json supabase/functions/stripe-webhook/packs.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stripe-webhook/packs.ts supabase/functions/stripe-webhook/packs.test.ts
git commit -m "feat(creditos): creditAmountForPack en stripe-webhook"
```

---

### Task 7: Wiring en `stripe-webhook/index.ts`

**Files:**
- Modify: `supabase/functions/stripe-webhook/index.ts:1-3` (import), `:53-83` (rama `checkout.session.completed`)

**Interfaces:**
- Consumes: `creditAmountForPack` de Task 6; RPC `grant_credit` de Task 1.

- [ ] **Step 1: Import**

Localizar (línea 1-3):
```ts
import Stripe from 'npm:stripe@18';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapStripeStatus } from './status.ts';
```
Agregar:
```ts
import Stripe from 'npm:stripe@18';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapStripeStatus } from './status.ts';
import { creditAmountForPack } from './packs.ts';
```

- [ ] **Step 2: Rama `mode:'payment'` en `checkout.session.completed`**

Localizar (línea 53-83):
```ts
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        if (!userId) {
          // Bug nuestro: log + 200 para que Stripe no reintente infinito
          console.error('webhook: checkout.session.completed sin user_id', session.id);
          break;
        }
        if (session.mode !== 'subscription' || !session.subscription) break;
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'premium',
            status: mapStripeStatus(sub.status),
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subId,
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        // metadata.user_id en el CUSTOMER: el checkout solo marca la subscription,
        // y /api/portal busca por customer metadata
        await stripe.customers.update(session.customer as string, {
          metadata: { user_id: userId },
        });
        break;
      }
```
Reemplazar por:
```ts
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        if (!userId) {
          // Bug nuestro: log + 200 para que Stripe no reintente infinito
          console.error('webhook: checkout.session.completed sin user_id', session.id);
          break;
        }

        if (session.mode === 'payment') {
          const amount = creditAmountForPack(session.metadata?.credit_pack);
          if (!amount) {
            console.error('webhook: credit_pack desconocido en checkout.session.completed', session.id, session.metadata?.credit_pack);
            break;
          }
          const { error: creditError } = await supabase.rpc('grant_credit', {
            p_user_id: userId,
            p_amount: amount,
            p_type: 'purchase',
            p_stripe_payment_intent_id: session.payment_intent as string,
          });
          if (creditError) throw creditError;
          break;
        }

        if (session.mode !== 'subscription' || !session.subscription) break;
        const subId = session.subscription as string;
        const sub = await stripe.subscriptions.retrieve(subId);
        const { error } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan: 'premium',
            status: mapStripeStatus(sub.status),
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subId,
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
        if (error) throw error;
        // metadata.user_id en el CUSTOMER: el checkout solo marca la subscription,
        // y /api/portal busca por customer metadata
        await stripe.customers.update(session.customer as string, {
          metadata: { user_id: userId },
        });
        break;
      }
```

- [ ] **Step 3: Type-check**

Run: `deno check --config supabase/functions/deno.json supabase/functions/stripe-webhook/index.ts`
Expected: sin errores. (La verificación end-to-end con Stripe real queda para después de Task 11, ver Verificación final del plan.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/stripe-webhook/index.ts
git commit -m "feat(creditos): webhook acredita créditos en compras one-time (mode:payment)"
```

---

### Task 8: `web/lib/checkout.ts` — sesión de compra one-time

**Files:**
- Modify: `web/lib/checkout.ts`
- Test: `web/lib/checkout.test.ts`

**Interfaces:**
- Produces: `packPriceIdFor(packId: string): string`, `createCreditPackCheckoutSession(stripe, origin, { packId, uid }): Promise<{ url: string }>`. Usado por Task 9.

- [ ] **Step 1: Escribir los tests (fallan primero)**

Agregar al final de `web/lib/checkout.test.ts` (después del `describe('createCheckoutSession', ...)` existente), y agregar `createCreditPackCheckoutSession, packPriceIdFor` al import de la línea 2:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  isValidUid,
  priceIdFor,
  resolvePromo,
  createCheckoutSession,
  createCreditPackCheckoutSession,
  packPriceIdFor,
  requestOrigin,
} from './checkout';
```

```ts
describe('packPriceIdFor', () => {
  it('arma el nombre de env por packId', () => {
    process.env.STRIPE_PRICE_CREDIT_PACK_3 = 'price_pack3';
    expect(packPriceIdFor('pack_3')).toBe('price_pack3');
  });
  it('lanza si falta el env', () => {
    delete process.env.STRIPE_PRICE_CREDIT_PACK_3;
    expect(() => packPriceIdFor('pack_3')).toThrow();
  });
});

describe('createCreditPackCheckoutSession', () => {
  it('arma la sesión one-time con metadata y URLs correctas', async () => {
    process.env.STRIPE_PRICE_CREDIT_PACK_3 = 'price_pack3';
    const s = fakeStripe();
    const { url } = await createCreditPackCheckoutSession(s, 'http://localhost:3000', {
      packId: 'pack_3',
      uid: UID,
    });
    expect(url).toBe('https://checkout.stripe.com/x');
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.mode).toBe('payment');
    expect(arg.line_items).toEqual([{ price: 'price_pack3', quantity: 1 }]);
    expect(arg.client_reference_id).toBe(UID);
    expect(arg.metadata.user_id).toBe(UID);
    expect(arg.metadata.credit_pack).toBe('pack_3');
    expect(arg.success_url).toBe('http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}');
    expect(arg.cancel_url).toContain(`uid=${UID}`);
  });
});
```

- [ ] **Step 2: Correr y confirmar que fallan**

Run: `cd web && npx vitest run lib/checkout.test.ts`
Expected: FAIL — `createCreditPackCheckoutSession`/`packPriceIdFor` no exportados.

- [ ] **Step 3: Implementación mínima**

Agregar al final de `web/lib/checkout.ts`:

```ts
export function packPriceIdFor(packId: string): string {
  const envKey = `STRIPE_PRICE_CREDIT_PACK_${packId.replace('pack_', '')}`;
  const id = process.env[envKey];
  if (!id) throw new Error(`Falta ${envKey}`);
  return id;
}

export async function createCreditPackCheckoutSession(
  stripe: Stripe,
  origin: string,
  p: { packId: string; uid: string },
): Promise<{ url: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: packPriceIdFor(p.packId), quantity: 1 }],
    client_reference_id: p.uid,
    metadata: { user_id: p.uid, credit_pack: p.packId },
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/credits/?uid=${p.uid}`,
  });
  return { url: session.url! };
}
```

- [ ] **Step 4: Correr y confirmar que pasan**

Run: `cd web && npx vitest run lib/checkout.test.ts`
Expected: PASS, todos los tests (los 9 preexistentes + los 3 nuevos).

- [ ] **Step 5: Commit**

```bash
git add web/lib/checkout.ts web/lib/checkout.test.ts
git commit -m "feat(creditos): createCreditPackCheckoutSession en web/lib/checkout"
```

---

### Task 9: `web/app/api/checkout/route.ts` — aceptar `kind:'credit_pack'`

**Files:**
- Modify: `web/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `createCreditPackCheckoutSession`, `packPriceIdFor` (indirectamente) de Task 8.

Sin test previo para este archivo (no existe `route.test.ts` en el repo hoy) — verificación manual.

- [ ] **Step 1: Reescribir el handler**

Reemplazar el contenido completo de `web/app/api/checkout/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import {
  createCheckoutSession,
  createCreditPackCheckoutSession,
  isValidUid,
  requestOrigin,
  type Billing,
} from '@/lib/checkout';

const VALID_PACKS = ['pack_3'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const uid = body?.uid;
  if (!isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const origin = requestOrigin(req.headers, req.nextUrl.origin);

  if (body?.kind === 'credit_pack') {
    const packId = body?.packId;
    if (!VALID_PACKS.includes(packId)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    try {
      const { url } = await createCreditPackCheckoutSession(getStripe(), origin, { packId, uid });
      return NextResponse.json({ url });
    } catch (err) {
      console.error('checkout error:', err);
      return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
    }
  }

  const billing = body?.billing as Billing;
  const promo = typeof body?.promo === 'string' ? body.promo.trim().toUpperCase() : undefined;
  if (!['monthly', 'yearly'].includes(billing)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const { url } = await createCheckoutSession(getStripe(), origin, { billing, uid, promo: promo || undefined });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('checkout error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual**

Con `web` corriendo local (`npm run dev`) y `STRIPE_PRICE_CREDIT_PACK_3` seteado en `.env.local`:
```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "content-type: application/json" \
  -d '{"kind":"credit_pack","packId":"pack_3","uid":"<uuid-de-prueba>"}'
```
Expected: `{"url": "https://checkout.stripe.com/..."}`. Y que la llamada existente sin `kind` (`{"billing":"monthly","uid":"..."}`) sigue funcionando igual que antes (retrocompatibilidad).

- [ ] **Step 4: Commit**

```bash
git add web/app/api/checkout/route.ts
git commit -m "feat(creditos): /api/checkout acepta kind:credit_pack"
```

---

### Task 10: `constants/pricing.ts` — precio del paquete (app RN)

**Files:**
- Modify: `constants/pricing.ts`

- [ ] **Step 1: Agregar las constantes**

Agregar al final de `constants/pricing.ts` (después de `PRICE_YEARLY_MONTHLY_EQUIVALENT`):

```ts
// Paquete de créditos consumibles — compra única, sin suscripción.
// Precio placeholder, ajustar antes de lanzar.
export const CREDIT_PACK_ID = 'pack_3';
export const CREDIT_PACK_SIZE = 3;
export const CREDIT_PACK_PRICE = '$99';
export const CREDIT_PACK_PRICE_MXN = `${CREDIT_PACK_PRICE} MXN`;
```

- [ ] **Step 2: Commit**

```bash
git add constants/pricing.ts
git commit -m "feat(creditos): constantes de precio del paquete de créditos"
```

---

### Task 11: Página web de compra de créditos

**Files:**
- Create: `web/components/CreditPackSection.tsx`
- Create: `web/app/credits/page.tsx`

**Interfaces:**
- Consumes: `POST /api/checkout` con `{ kind:'credit_pack', packId, uid }` de Task 9.

Sin test — ni `page.tsx` ni `PricingSection.tsx` (su equivalente existente) tienen test en este repo; solo `lib/*.ts` se testea en `web/`.

- [ ] **Step 1: Crear el componente**

```tsx
// web/components/CreditPackSection.tsx
'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';

const CREDIT_PACK_ID = 'pack_3';
const CREDIT_PACK_SIZE = 3;
const CREDIT_PACK_PRICE = '$99';

export function CreditPackSection({ uid }: { uid: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'credit_pack', packId: CREDIT_PACK_ID, uid }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      if (!url) throw new Error('missing url');
      window.location.href = url;
    } catch {
      setError('No pudimos iniciar el pago, intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-4">
      <div className="rounded-2xl border border-subtle bg-surface/70 p-6 text-center">
        <Zap className="mx-auto h-8 w-8 text-amber-bright" aria-hidden />
        <h3 className="mt-3 font-display text-3xl">+{CREDIT_PACK_SIZE} planes extra</h3>
        <p className="mb-6 mt-2 text-2xl font-bold text-ember">
          {CREDIT_PACK_PRICE} <span className="text-sm font-normal text-muted">MXN</span>
        </p>
        <p className="mb-6 text-sm text-muted">
          Sin suscripción. Úsalos cuando quieras en planes de entreno o de alimentación.
        </p>
        {uid ? (
          <>
            <button
              onClick={startCheckout}
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ember py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Comprar créditos
            </button>
            {error && (
              <p role="alert" className="mt-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Abre este link desde la app para comprar.</p>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Crear la página**

```tsx
// web/app/credits/page.tsx
import { EmberField } from '@/components/EmberField';
import { Wordmark } from '@/components/Wordmark';
import { CreditPackSection } from '@/components/CreditPackSection';
import { isValidUid } from '@/lib/checkout';

export default async function Credits({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string }>;
}) {
  const params = await searchParams;
  const uid = isValidUid(params.uid) ? params.uid : null;

  return (
    <main className="flex flex-col gap-12 pb-24">
      <header className="relative overflow-hidden pb-6 pt-16 text-center">
        <EmberField />
        <div className="relative">
          <Wordmark className="text-3xl" />
          <h1 className="mx-auto mt-8 max-w-2xl px-4 font-display text-5xl leading-none md:text-6xl">
            CRÉDITOS EXTRA
          </h1>
          <p className="mx-auto mt-4 max-w-xl px-4 text-muted">
            Ya usaste tu plan gratuito de este mes. Compra créditos extra sin suscribirte.
          </p>
        </div>
      </header>

      <CreditPackSection uid={uid} />

      <footer className="px-4 text-center text-xs text-muted">
        Pago procesado de forma segura con Stripe
      </footer>
    </main>
  );
}
```

- [ ] **Step 3: Verificación manual**

Run: `cd web && npm run dev`, abrir `http://localhost:3000/credits/?uid=<uuid-de-prueba>`.
Expected: la página carga, muestra el precio, y el botón "Comprar créditos" redirige a un checkout de Stripe (test mode) con `mode:'payment'`.

- [ ] **Step 4: Commit**

```bash
git add web/components/CreditPackSection.tsx web/app/credits/page.tsx
git commit -m "feat(creditos): página web de compra de paquete de créditos"
```

---

### Task 12: `lib/payments.ts` — URL de compra desde la app

**Files:**
- Modify: `lib/payments.ts`

- [ ] **Step 1: Agregar `buildCreditPackURL`**

Agregar al final de `lib/payments.ts`:

```ts
export function buildCreditPackURL(uid: string): string {
  return `${PAYMENTS_URL}/credits/?uid=${uid}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/payments.ts
git commit -m "feat(creditos): buildCreditPackURL"
```

---

### Task 13: `hooks/useCreditBalance.ts` — saldo del usuario

**Files:**
- Create: `hooks/useCreditBalance.ts`

**Interfaces:**
- Consumes: RPC `get_credit_balance` de Task 1 (requiere `types/database.types.ts` regenerado en Task 1 Step 5 para tipar sin `as any`).
- Produces: `useCreditBalance(): UseQueryResult<number>`. Usado por Task 16.

Sin test — `useSubscription.ts` (el hook que este mirrorea) tampoco tiene test en este repo.

- [ ] **Step 1: Crear el hook**

```ts
// hooks/useCreditBalance.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useCreditBalance() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['credit_balance', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: user!.id });
      if (error) throw error;
      return data ?? 0;
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores (si falla con "get_credit_balance no existe en Database", confirmar que Task 1 Step 5 se corrió).

- [ ] **Step 3: Commit**

```bash
git add hooks/useCreditBalance.ts
git commit -m "feat(creditos): hook useCreditBalance"
```

---

### Task 14: `hooks/useWorkoutPlan.ts` — error `no_credits_remaining`

**Files:**
- Modify: `hooks/useWorkoutPlan.ts:1-2` (imports), `:92-101` (manejo de error)

**Interfaces:**
- Consumes: `buildCreditPackURL` de Task 12.

- [ ] **Step 1: Imports**

Localizar (línea 1-3):
```ts
import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
```
Reemplazar por:
```ts
import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { buildCreditPackURL } from '@/lib/payments';
```

- [ ] **Step 2: Nuevo branch de error**

Localizar (línea 92-101):
```ts
      if (!res.ok) {
        if (data.error === 'monthly_plan_limit_reached') {
          Alert.alert('Límite alcanzado', 'En el plan free puedes generar 1 plan por mes. Actualiza a premium para generar más.');
        } else if (data.error === 'generation_in_progress') {
          Alert.alert('En proceso', 'Ya hay un plan siendo generado. Espera un momento.');
        } else {
          Alert.alert('Error', 'No se pudo generar el plan. Intenta de nuevo.');
        }
        return;
      }
```
Reemplazar por (mantiene los strings hardcoded en español del resto del archivo — no se introduce i18n aquí, consistente con que este hook no lo usa hoy):
```ts
      if (!res.ok) {
        if (data.error === 'monthly_plan_limit_reached') {
          Alert.alert('Límite alcanzado', 'En el plan free puedes generar 1 plan por mes. Actualiza a premium para generar más.');
        } else if (data.error === 'no_credits_remaining') {
          Alert.alert(
            'Sin créditos',
            'Ya usaste tu plan gratuito de este mes. Compra créditos extra para generar otro.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Comprar créditos', onPress: () => Linking.openURL(buildCreditPackURL(session.user.id)) },
            ],
          );
        } else if (data.error === 'generation_in_progress') {
          Alert.alert('En proceso', 'Ya hay un plan siendo generado. Espera un momento.');
        } else {
          Alert.alert('Error', 'No se pudo generar el plan. Intenta de nuevo.');
        }
        return;
      }
```

- [ ] **Step 3: Type-check**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación manual (Expo Go)**

Con un usuario free sin cuota ni créditos, tocar "Generar plan" → Alert "Sin créditos" con botón "Comprar créditos" → tocarlo abre el navegador en `/credits/?uid=...`.

- [ ] **Step 5: Commit**

```bash
git add hooks/useWorkoutPlan.ts
git commit -m "feat(creditos): useWorkoutPlan maneja no_credits_remaining"
```

---

### Task 15: Plan de comida — error `no_credits_remaining` + i18n

**Files:**
- Modify: `locales/es/plans.json` (namespace `meal.alerts`), `locales/en/plans.json` (ídem)
- Modify: `app/(app)/plans/meal/index.tsx:1-30` (imports + auth), `:85-106` (`handleGenerate`)

**Interfaces:**
- Consumes: `buildCreditPackURL` de Task 12.

- [ ] **Step 1: Claves i18n — español**

En `locales/es/plans.json`, dentro de `meal.alerts` (línea 55-62), agregar tras `"errorBody"`:

```json
    "alerts": {
      "limitTitle": "Límite alcanzado",
      "limitPremium": "Has alcanzado el límite de 10 planes este mes.",
      "limitFree": "Ya usaste tu plan gratuito. Actualiza a Premium para regenerar cuando quieras.",
      "inProgressTitle": "En proceso",
      "inProgressBody": "Ya hay un plan siendo generado. Espera un momento.",
      "noGoalTitle": "Sin objetivo",
      "noGoalBody": "Completa tu perfil con un objetivo activo primero.",
      "errorBody": "No se pudo generar el plan. Intenta de nuevo.",
      "noCreditsTitle": "Sin créditos",
      "noCreditsBody": "Ya usaste tu plan gratuito. Compra créditos extra para generar otro.",
      "noCreditsCancel": "Cancelar",
      "noCreditsCta": "Comprar créditos"
    },
```

- [ ] **Step 2: Claves i18n — inglés**

En `locales/en/plans.json`, dentro de `meal.alerts`, agregar tras `"errorBody"`:

```json
    "alerts": {
      "limitTitle": "Limit reached",
      "limitPremium": "You've reached the limit of 10 plans this month.",
      "limitFree": "You've already used your free plan. Upgrade to Premium to regenerate whenever you want.",
      "inProgressTitle": "In progress",
      "inProgressBody": "A plan is already being generated. Hang on a moment.",
      "noGoalTitle": "No goal",
      "noGoalBody": "Complete your profile with an active goal first.",
      "errorBody": "The plan couldn't be generated. Try again.",
      "noCreditsTitle": "No credits left",
      "noCreditsBody": "You've already used your free plan. Buy extra credits to generate another one.",
      "noCreditsCancel": "Cancel",
      "noCreditsCta": "Buy credits"
    },
```

- [ ] **Step 3: Verificar namespace parity**

Run: `npm run check-i18n`
Expected: sin errores.

- [ ] **Step 4: Imports en el screen**

Localizar (línea 1-14, imports de `app/(app)/plans/meal/index.tsx`):
```ts
import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '@/lib/theme';
import { gradientsByTheme, amberShadowByTheme } from '@/constants/themes';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { useIsPremium } from '@/hooks/useSubscription';
```
Reemplazar las líneas 2 y 14 (y agregar 2 imports nuevos):
```ts
import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '@/lib/theme';
import { gradientsByTheme, amberShadowByTheme } from '@/constants/themes';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { useIsPremium } from '@/hooks/useSubscription';
import { useAuthStore } from '@/store/auth.store';
import { buildCreditPackURL } from '@/lib/payments';
```

- [ ] **Step 5: Leer el usuario dentro del componente**

Localizar (línea 68-70):
```ts
  const { data: activePlan, isLoading } = useActiveMealPlan();
  const { mutateAsync: generatePlan, isPending: generating } = useGenerateMealPlan();
  const isPremium = useIsPremium();
```
Agregar tras esas líneas:
```ts
  const { user } = useAuthStore();
```

- [ ] **Step 6: Nuevo branch en `handleGenerate`**

Localizar (línea 91-105):
```ts
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.error === 'meal_plan_limit_reached') {
        Alert.alert(
          t('meal.alerts.limitTitle'),
          isPremium ? t('meal.alerts.limitPremium') : t('meal.alerts.limitFree'),
        );
      } else if (e?.error === 'generation_in_progress') {
        Alert.alert(t('meal.alerts.inProgressTitle'), t('meal.alerts.inProgressBody'));
      } else if (e?.error === 'no_active_goal') {
        Alert.alert(t('meal.alerts.noGoalTitle'), t('meal.alerts.noGoalBody'));
      } else {
        Alert.alert(t('common:error'), t('meal.alerts.errorBody'));
      }
    }
```
Reemplazar por:
```ts
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.error === 'meal_plan_limit_reached') {
        Alert.alert(
          t('meal.alerts.limitTitle'),
          isPremium ? t('meal.alerts.limitPremium') : t('meal.alerts.limitFree'),
        );
      } else if (e?.error === 'no_credits_remaining') {
        Alert.alert(
          t('meal.alerts.noCreditsTitle'),
          t('meal.alerts.noCreditsBody'),
          [
            { text: t('meal.alerts.noCreditsCancel'), style: 'cancel' },
            { text: t('meal.alerts.noCreditsCta'), onPress: () => user && Linking.openURL(buildCreditPackURL(user.id)) },
          ],
        );
      } else if (e?.error === 'generation_in_progress') {
        Alert.alert(t('meal.alerts.inProgressTitle'), t('meal.alerts.inProgressBody'));
      } else if (e?.error === 'no_active_goal') {
        Alert.alert(t('meal.alerts.noGoalTitle'), t('meal.alerts.noGoalBody'));
      } else {
        Alert.alert(t('common:error'), t('meal.alerts.errorBody'));
      }
    }
```

- [ ] **Step 7: Type-check**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Verificación manual (Expo Go)**

Con un usuario free sin plan de comida disponible ni créditos, tocar "Generar" → Alert "Sin créditos" con CTA que abre `/credits/?uid=...`. Repetir con `EXPO_PUBLIC_LANGUAGE`/perfil en inglés → strings en inglés.

- [ ] **Step 9: Commit**

```bash
git add locales/es/plans.json locales/en/plans.json "app/(app)/plans/meal/index.tsx"
git commit -m "feat(creditos): plan de comida maneja no_credits_remaining"
```

---

### Task 16: Badge de saldo de créditos en el perfil

**Files:**
- Modify: `locales/es/profile.json`, `locales/en/profile.json`
- Modify: `app/(app)/profile.tsx` (import + uso del hook + render del badge, cerca de línea 184)

**Interfaces:**
- Consumes: `useCreditBalance` de Task 13.

- [ ] **Step 1: Clave i18n — español**

En `locales/es/profile.json`, agregar tras `"freeBadge": "APRENDIZ",` (línea 6):
```json
  "freeBadge": "APRENDIZ",
  "creditsBadge": "{{count}} CRÉDITOS",
```

- [ ] **Step 2: Clave i18n — inglés**

En `locales/en/profile.json`, agregar tras `"freeBadge": "APPRENTICE",` (línea 6):
```json
  "freeBadge": "APPRENTICE",
  "creditsBadge": "{{count}} CREDITS",
```

- [ ] **Step 3: Verificar namespace parity**

Run: `npm run check-i18n`
Expected: sin errores.

- [ ] **Step 4: Import + hook en `profile.tsx`**

Agregar el import junto a los demás hooks (buscar la línea que importa `useIsPremium`/`useSubscription` y agregar debajo):
```ts
import { useCreditBalance } from '@/hooks/useCreditBalance';
```
Dentro del componente, junto a donde ya se lee `isPremium`, agregar:
```ts
  const { data: creditBalance } = useCreditBalance();
```

- [ ] **Step 5: Render del badge**

Localizar (línea 184):
```tsx
              {isPremium ? <Badge label={t('premiumBadge')} variant="premium" /> : <Badge label={t('freeBadge')} variant="muted" />}
```
Reemplazar por:
```tsx
              {isPremium ? <Badge label={t('premiumBadge')} variant="premium" /> : <Badge label={t('freeBadge')} variant="muted" />}
              {!isPremium && creditBalance ? (
                <Badge label={t('creditsBadge', { count: creditBalance })} variant="muted" />
              ) : null}
```

- [ ] **Step 6: Type-check**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificación manual (Expo Go)**

Usuario free con saldo > 0 → ve el badge "N CRÉDITOS" junto al badge "APRENDIZ" en su perfil. Usuario free con saldo 0 → no ve el badge extra. Usuario premium → nunca ve el badge (aunque tuviera saldo residual de antes de subir a premium).

- [ ] **Step 8: Commit**

```bash
git add locales/es/profile.json locales/en/profile.json "app/(app)/profile.tsx"
git commit -m "feat(creditos): badge de saldo de créditos en el perfil"
```

---

## Verificación end-to-end final (tras completar todos los tasks)

1. `supabase db reset` local + confirmar `credit_ledger` con RLS activo (Task 1).
2. Usuario de prueba en 0 créditos y cuota agotada → `generate-plan` y `generate-meal-plan` devuelven `no_credits_remaining` sin llamar a Anthropic.
3. `grant_credit` manual (o compra real de prueba) da 1 crédito → repetir la llamada → genera y el saldo baja a 0 (`credit_ledger` tiene la fila `consumption`).
4. Forzar una falla de generación con saldo en 1 (ej. `ANTHROPIC_API_KEY` inválida temporalmente) → confirmar refund (`type='refund'` en el ledger, saldo vuelve a 1).
5. Disparar `generate-plan` y `generate-meal-plan` casi simultáneos con exactamente 1 crédito → solo una progresa, la otra recibe `no_credits_remaining` sin gastar IA (verifica el lock advisory de `consume_credit`).
6. Compra real de paquete de créditos con tarjeta de prueba de Stripe, end-to-end: `web/credits` → checkout → webhook → saldo actualizado. Reenviar el mismo evento de webhook (Stripe CLI `stripe events resend <id>`) y confirmar que NO duplica el crédito (idempotencia por `stripe_payment_intent_id`).
7. E2E humano en Expo Go: usuario gratis agota cuota → ve el Alert/CTA de "comprar créditos" (workout y meal) → completa la compra → puede generar de nuevo → badge de créditos en perfil refleja el saldo correcto → sube a premium con saldo residual → el badge de créditos desaparece.
