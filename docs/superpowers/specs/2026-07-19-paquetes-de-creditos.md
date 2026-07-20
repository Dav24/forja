# Paquetes de créditos consumibles — spec

## Problema

Los usuarios gratis de Forja cuestan ~$0.25 USD en tokens de IA por ciclo (generación de plan de entreno + plan de comida + chat), y hoy no hay forma de monetizar eso hasta que el usuario se vuelve premium. Se investigaron alternativas (ver memoria de la sesión de brainstorming) y se descartaron ads (no encaja con el tono de la app) y las palancas que dependen de audiencia/ventas (B2B2C wellness, retos patrocinados, afiliados) por prematuras dado que la app no tiene tracción todavía. La palanca elegida para implementar ahora: **paquetes de créditos consumibles**, de compra única, sin depender de nadie externo.

## Decisiones de producto (cerradas)

1. **Créditos unificados**: un solo saldo, no pools separados por tipo de acción.
2. **Alcance**: solo `generate-plan` y `generate-meal-plan` consumen créditos. El chat con Vulcano no cambia — ya corre en Haiku con prompt caching, costo marginal bajo, y su límite diario actual (20 msg/día gratis) se queda igual.
3. **Ledger transaccional**: tabla con una fila por compra/consumo/reembolso (no un contador simple), para auditoría y soporte a futuro.
4. **Cobro por reserva-y-reembolso**: el crédito se descuenta justo antes de llamar a la IA (con lock que cierra el riesgo de doble gasto entre `generate-plan` y `generate-meal-plan` compitiendo por el mismo pool), y se reembolsa automáticamente si la generación falla en cualquier punto posterior.
5. **Sin IAP nativo**: se reutiliza el patrón actual de Stripe web (`pay.forja.fit` vía `Linking.openURL`), igual que la suscripción premium hoy — la migración a IAP nativo sigue pospuesta hasta antes de subir a tiendas (ver memoria `project-payments`).

## Hallazgos de exploración de código (confirmados, no hipótesis)

- No existe ningún concepto de crédito/cuota dedicada hoy. Los límites actuales (chat 20 msg/día, 1 plan de entreno/mes, 1 plan de comida de por vida, todos gratis) se calculan contando filas existentes (`workout_plans`, `meal_plans`, `daily_message_count`) filtradas por `subscriptions.plan/status`.
- Gating actual: `generate-plan/index.ts:269` (`!isPremium && plansThisMonth >= 1` → 429 `monthly_plan_limit_reached`), `generate-meal-plan/index.ts:225-248` (lifetime=1 gratis / 10 mes premium → 429 `meal_plan_limit_reached`). Ambos bloquean también generación concurrente vía `async_jobs` en curso, por tipo (`generate_workout_plan` / `generate_meal_plan`), no por pool compartido.
- Modelo/costo: `generate-plan` y `generate-meal-plan` usan `claude-sonnet-4-6` con `max_tokens` 16000/8192 respectivamente (caro); `chat` usa `claude-haiku-4-5-20251001` con 1024 tokens y prompt caching (barato) — por eso queda fuera del alcance.
- Checkout Stripe hoy: `web/lib/checkout.ts` `createCheckoutSession` — solo `mode:'subscription'`. Webhook `supabase/functions/stripe-webhook/index.ts:61` — guard `if (session.mode !== 'subscription' || !session.subscription) break;`. El query param `plan=` que arma `lib/payments.ts` `buildPaymentURL` **no se lee en ningún lado server-side hoy** (vestigial) — no hay mecanismo de "rutear por tipo de plan" que extender, por eso el checkout de créditos usa una ruta web nueva (`web/app/credits`) en vez de sobrecargar `web/app/page.tsx`.
- RLS: todas las tablas de usuario en `0001_initial_schema.sql` usan el patrón `FOR ALL USING (auth.uid() = user_id)`. Ese patrón es incorrecto para un ledger de valor — `0004_grants.sql` ya da INSERT/UPDATE/DELETE amplios a `authenticated`, así que sin restringir la policy un usuario podría insertarse créditos directo vía PostgREST.
- Patrón de testing establecido en este repo para lógica con dependencias externas: extraer a un módulo `logic.ts` (o nombre específico) con funciones puras o con dependencias inyectadas por interfaz, testeado con `Deno.test`/`jsr:@std/assert` (ver `supabase/functions/swap-meal/logic.ts` + `logic.test.ts`, `stripe-webhook/status.ts` + `status.test.ts`). El código dentro de `Deno.serve(...)` en sí no se testea directo — se le hacen pruebas de integración manuales.
- `generate-plan/index.ts` y `generate-meal-plan/index.ts` ya toleran duplicación considerable entre sí (labels de modalidad, guardrail de "primeros pasos", chequeo de subscripción) — no existe `supabase/functions/_shared/`. Mantener esa duplicación para el nuevo gating, no extraer un módulo compartido entre ambas funciones.

## Riesgos identificados

- **Carrera entre `generate-plan` y `generate-meal-plan` compitiendo por el mismo pool de créditos**: el guard de `async_jobs` en curso es por tipo de acción, no protege el pool compartido. Se cierra con `pg_advisory_xact_lock` por usuario dentro de la RPC `consume_credit`, ejecutado ANTES de llamar a Anthropic (no después de generar).
- `translate-plan`/`swap-meal` (Edge Functions existentes) podrían tener su propio costo de IA no cubierto por este alcance — fuera de este spec, reconsiderar después si el costo real lo justifica.
- `plan-worker.ts` es un stub dormido para procesamiento async vía QStash (Paso 15, no activo hoy) — cuando se active, la lógica de consumo/reembolso tendrá que moverse o duplicarse ahí.

Ver plan de implementación: `docs/superpowers/plans/2026-07-19-paquetes-de-creditos.md`.
