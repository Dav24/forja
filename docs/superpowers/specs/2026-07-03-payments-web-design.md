# Paso 13 — Web de Pagos (pay.forja.fit) — Diseño

**Fecha:** 2026-07-03
**Estado:** Aprobado por el usuario (diseño validado sección por sección)

## Contexto y decisiones estratégicas

Forja vende Premium fuera de las tiendas para maximizar margen en validación. Durante el
brainstorming se tomaron estas decisiones que gobiernan el diseño:

1. **Estrategia híbrida de pagos.** La web se construye ahora como funnel de
   marketing/email/venta directa y para probar el flujo Stripe→Premium completo. Antes de
   subir a las tiendas (Paso 15), la app usará IAP nativo (comisión real: 15%, no 30% —
   Apple Small Business Program y Google Play <$1M/año). En México ambas tiendas prohíben
   linkear a pagos externos para bienes digitales; el link actual a pay.forja.fit deberá
   ocultarse/reemplazarse por IAP en los builds de tienda. Ver memoria
   `project_payments.md`.
2. **Identidad del usuario: `uid` en la URL.** La app añade su `user_id` de Supabase como
   query param. Viaja a Stripe como metadata y el webhook activa Premium a ese usuario.
   Manipular el uid solo lograría pagarle Premium a otra persona — daño nulo.
3. **Visitantes sin `uid` (orgánicos/marketing):** la landing muestra precios igual, pero
   el CTA cambia a "Descarga Forja y empieza gratis" (links a App Store / Google Play).
   El pago siempre nace en la app. Sin registro web, sin pagos huérfanos.
4. **Un solo plan de pago.** El tier Pro desaparece. Sus 3 features (fotos de comida con
   IA, análisis de técnica, coaching en tiempo real) NO existen aún (roadmap V1.5): se
   muestran dentro del plan de pago como sub-sección "En camino 🔥", nunca como
   disponibles.
5. **Nombres de planes:** Free = **Aprendiz**, pago = **Maestro Forjador**. Son solo
   nombres visibles; internamente la DB sigue con `plan IN ('free','premium')` — sin
   migración.
6. **Precio fundador:** $179 MXN/mes · $1,299 MXN/año (se mantiene pese a absorber Pro).
   Se subirá cuando las features V1.5 existan, respetando el precio a los primeros
   suscriptores.
7. **Entregable del paso:** flujo completo funcionando **en local con Stripe modo test**
   (tarjetas de prueba + `stripe listen`). Deploy real a Vercel + dominio + Stripe live
   queda para el Paso 15.

## Arquitectura elegida

**Opción A: Next.js delgado + webhook en Supabase.** (Se descartaron: B, todo en Next.js
con service role key en Vercel; C, Stripe Payment Links, poco flexible para promos/futuro.)

- `web/` — Next.js (App Router, Tailwind, TypeScript): landing + success + portal + una
  API route de checkout y una de portal. **La web no tiene credenciales de Supabase.**
- `supabase/functions/stripe-webhook/` — Edge Function (el placeholder vacío existente):
  única pieza que escribe en la DB, con la service role key que ya vive en Supabase.
- La página de tarjeta siempre es **Stripe Checkout hosted** — nunca tocamos datos de
  tarjeta (PCI resuelto por Stripe).

### Flujo de datos

```
App (upgrade.tsx / UpgradeSheet)
  │ Linking.openURL("$PAYMENTS_URL?plan=premium&billing=yearly&uid=<user_id>[&promo=CODE]")
  ▼
Web pay.forja.fit (Next.js)
  │ Landing de precios → botón "Convertirme en Maestro"
  │ POST /api/checkout → crea Stripe Checkout Session
  ▼
Stripe Checkout (hosted)
  │ pago exitoso
  ├────────────► /success → deep link forja://success de vuelta a la app
  ▼
Stripe webhook ──► Supabase EF stripe-webhook ──► tabla subscriptions
  ▼
App: refetch de useSubscription (deep link + AppState foreground) → gates se abren
```

**Principio:** la verdad siempre viene del webhook, nunca de la página de éxito. `/success`
es solo UX; si el usuario cierra el navegador, Premium ya quedó activo igual.

## La web (`web/`)

Proyecto Next.js independiente. Tokens de marca portados de `constants/colors.ts` y
`global.css`: carbón #0C0A09, naranja #F97316, ámbar #FBBF24, Bebas Neue (display) +
Inter (texto). Idioma: es-MX únicamente (i18n es Paso 14).

### Páginas

**`/` — Landing de precios** (estructura: hero → toggle → cards → tabla comparativa → FAQ
→ CTA final; patrón "Pricing-Focused Landing" de ui-ux-pro-max):

1. **Hero corto:** wordmark FORJA (brasa en la "O", mismo asset del rediseño), headline
   Bebas gigante ("FORJA TU MEJOR VERSIÓN"), fondo carbón con brasas flotantes animadas
   (partículas CSS sutiles, versión web de SparkBurst) y glow radial naranja desde abajo.
2. **Toggle mensual/anual** sobre los cards, con ahorro anual visible ("2 meses gratis ·
   ahorra 40%"). Default: anual.
3. **Cards de planes:**
   - **Aprendiz** (gris carbón neutro): chat con Vulcano (20 msgs/día), 1 plan de
     entrenamiento/mes, 1 plan alimenticio, seguimiento corporal, conexión de
     pulsera/reloj. **REGLA CRÍTICA DE COPY:** la conexión de wearables es GRATIS en
     todos los planes; lo premium es la IA de Vulcano sobre esos datos.
   - **Maestro Forjador** (destacado: borde gradiente naranja→ámbar, glow ámbar suave,
     badge "RECOMENDADO", elevación visual): todo ilimitado, composición corporal, rangos
     completos de gráficas, 10 planes alimenticios/mes + sub-sección "En camino 🔥" con
     las 3 features V1.5.
   - **Con `uid`:** CTA "Convertirme en Maestro" → POST /api/checkout → redirect a Stripe.
   - **Sin `uid`:** CTA "Descarga Forja y empieza gratis" → badges App Store/Google Play.
4. **Tabla comparativa** de features (filas alternadas sutiles, checks naranjas vs guiones
   grises).
5. **FAQ corto** (3-4: ¿cómo se activa en la app?, ¿puedo cancelar?, métodos de pago,
   ¿tienes un código?).
6. **CTA final** + sticky CTA en la nav al hacer scroll.
7. **Campo promo** colapsado ("¿Tienes un código?"), prellenado si vino `&promo=` en la URL.

**`/success` — Éxito:** "El acero está forjado — Ya eres Maestro Forjador", botón grande
"Volver a Forja" que abre `forja://success` + intento automático a los 3s. Nota: "Tu
Premium ya está activo; si la app no abre, entra manualmente". No verifica la sesión — el
webhook es la fuente de verdad.

**`/portal` — Gestión:** página mínima que llama a POST /api/portal con el `uid` de la URL
y redirige a la sesión del **Stripe Customer Portal** (cancelar, cambiar tarjeta,
facturas — todo lo hace Stripe).

**Sin login, sin cuentas, sin historial** — la web no tiene sesión propia (YAGNI).

### Dirección visual (de ui-ux-pro-max, adaptada a la marca fija)

- Profundidad: gradiente vertical carbón→negro con ruido sutil, glows ámbar posicionales
  detrás de elementos clave, secciones con 48px+ de separación, display 32px+.
- Hover de cards: transición de borde/sombra 150–300ms, **sin scale** que mueva layout.
- Íconos SVG de **Lucide** — nada de emojis como íconos (el 🔥 solo en copy).
- Contraste mínimo 4.5:1 sobre carbón, `cursor-pointer` en clickeables, focus visible,
  `prefers-reduced-motion` desactiva las brasas.
- Mobile-first real (la mayoría llega desde el teléfono): responsive 375/768/1024/1440,
  sin scroll horizontal.

## Stripe (modo test)

- Producto **"Forja — Maestro Forjador"** con 2 precios recurrentes: $179 MXN/mes y
  $1,299 MXN/año. IDs en env (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`), nunca
  hardcodeados.
- **Promotion codes** (creados en dashboard cuando se necesiten): descuentos parciales,
  100% con duración limitada o forever (para influencers/códigos de creador), límite de
  redenciones y stats por código. Con 100% de descuento el checkout no pide tarjeta
  (`payment_method_collection: 'if_required'`).

### API route `web/app/api/checkout/route.ts`

POST `{ billing: 'monthly'|'yearly', uid: string, promo?: string }`:

- Valida `uid` con formato UUID (400 si no).
- Crea Checkout Session:
  - `mode: 'subscription'`, `line_items: [price según billing]`
  - `client_reference_id: uid` y `metadata.user_id: uid`
  - `subscription_data.metadata.user_id: uid` — los eventos futuros de la suscripción
    (renovación, cancelación) traen siempre el usuario sin búsquedas extra
  - `allow_promotion_codes: true`; si vino `promo`, se resuelve
    (`promotionCodes.list({ code })`) y se pre-aplica vía `discounts`. Código inexistente
    NO bloquea: checkout normal y el usuario puede teclear otro.
  - `payment_method_collection: 'if_required'`
  - `success_url: <origin>/success?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url: <origin>/?plan=...&billing=...&uid=...[&promo=...]` (regresa a la landing
    con estado intacto)
- Responde `{ url }` → el cliente redirige a Stripe.

### API route `web/app/api/portal/route.ts`

POST `{ uid }`: busca el customer **directamente en Stripe** por metadata
(`customers.search({ query: "metadata['user_id']:'<uid>'" })`), crea Billing Portal
Session con `return_url` a la landing, responde `{ url }`. Si no hay customer → mensaje
"No encontramos una suscripción activa". La web nunca toca Supabase.

## Edge Function `supabase/functions/stripe-webhook/`

- `verify_jwt = false` en `supabase/config.toml` (Stripe no manda JWT). La seguridad es la
  **verificación de firma** (`constructEventAsync` con `STRIPE_WEBHOOK_SECRET`).
- Cliente Supabase con **service role key** (env que ya vive en Supabase), escribe en
  `subscriptions` (única fila por `user_id`, upsert por esa unique key).

| Evento | Acción |
|---|---|
| `checkout.session.completed` | Upsert: `plan='premium'`, `status='active'`, `stripe_customer_id`, `stripe_subscription_id`, `current_period_end` (del subscription recuperado) |
| `customer.subscription.updated` | Sincroniza `status` (map a `active`/`past_due`/`canceled`/`trialing`/`incomplete`) y `current_period_end` |
| `customer.subscription.deleted` | `plan='free'`, `status='canceled'` — vuelve a Aprendiz |

- `user_id` sale de `session.metadata.user_id` o `subscription.metadata.user_id`; fallback:
  lookup por `stripe_subscription_id`.
- Idempotente por diseño (upserts) — los reintentos de Stripe son inofensivos.
- Firma inválida → 400. Evento sin `user_id` → log de error + 200 (bug nuestro; no
  queremos reintentos infinitos de Stripe). Otros eventos no manejados → 200 silencioso.
- En `checkout.session.completed`, actualizar el **customer** de Stripe con
  `metadata.user_id` (`customers.update`) — el checkout solo marca la *suscripción*, no el
  customer, y esta metadata es la que habilita la búsqueda de `/api/portal`.

## Cambios en la app (mínimos para cerrar el círculo)

1. **`app/(app)/upgrade.tsx`:** eliminar card Pro; renombrar planes a Aprendiz / Maestro
   Forjador; features V1.5 al card de Maestro como "En camino" (no disponibles);
   `buildPaymentURL` añade `&uid=${user.id}`; link de portal → `/portal?uid=...`.
2. **`components/premium/UpgradeSheet.tsx`:** URL con `uid` (y billing/plan como hoy).
3. **`app/(app)/success.tsx`** (los grupos no agregan segmento, así que responde a
   `forja://success`; con `href: null` en el tab bar, igual que `upgrade`): invalida el
   query de `useSubscription`, celebración con SparkBurst ("¡Ya eres Maestro Forjador!"),
   redirect a Home.
4. **Refetch al foreground:** listener de `AppState` que invalida `useSubscription` cuando
   la app vuelve a activo — cubre al usuario que regresa sin tocar el deep link.
5. **`EXPO_PUBLIC_PAYMENTS_URL`** (default `https://pay.forja.fit`) reemplaza las URLs
   hardcodeadas — permite apuntar a `localhost:3000` en pruebas end-to-end.
6. **Textos de plan** en `profile.tsx` (badge) y donde aparezca "Premium"/"Free" visible:
   renombrar a Maestro Forjador / Aprendiz. Los identificadores internos (`plan`,
   `isPremium`, `lib/limits.ts`) NO cambian.

## Manejo de errores

- `/api/checkout`: uid inválido → 400; error de Stripe → 502; la landing muestra "No
  pudimos iniciar el pago, intenta de nuevo" junto al CTA (error cerca del problema,
  botón deshabilitado durante el request).
- Promo inexistente → checkout sin prellenar (no bloquea).
- `/api/portal` sin customer → mensaje claro en la página.
- Webhook: ver tabla arriba (400 firma, 200+log para bugs de metadata).
- `/success` si la app no abre el deep link → instrucción manual visible.

## Variables de entorno

| Dónde | Variable | Uso |
|---|---|---|
| `web/.env.local` | `STRIPE_SECRET_KEY` (test) | checkout + portal |
| `web/.env.local` | `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | precios |
| `web/.env.local` | `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` | CTAs sin uid (placeholder por ahora) |
| `supabase/.env` | `STRIPE_SECRET_KEY` (test) | retrieve de subscription en webhook |
| `supabase/.env` | `STRIPE_WEBHOOK_SECRET` | verificación de firma |
| `forja/.env.local` | `EXPO_PUBLIC_PAYMENTS_URL` | base URL de la web desde la app |

## Testing (todo local, Stripe test)

- `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`.
- Flujos a verificar:
  1. Pago mensual y anual con `4242 4242 4242 4242` → fila en `subscriptions` correcta →
     gates premium abiertos en la app.
  2. Cupón 100% → checkout sin tarjeta → Premium activo.
  3. Cancelar a mitad del checkout → regresa a la landing con estado intacto.
  4. Cancelar suscripción desde el dashboard → webhook → usuario vuelve a Aprendiz.
  5. Viaje completo con el teléfono: app → web (localhost via IP local) → Stripe → webhook
     → deep link `forja://success` → gates abiertos sin reiniciar la app.
  6. Landing sin `uid` → CTAs de descarga; con `&promo=` → código prellenado.
- Verificación visual responsive (375/768/1024/1440) y `prefers-reduced-motion`.

## Fuera de alcance (explícito)

- Deploy a Vercel, DNS pay.forja.fit, Stripe live y webhook endpoint productivo → Paso 15.
- IAP nativo (Apple/Google) → antes del submit a tiendas, paso propio.
- Compra web para visitantes sin cuenta ("pagar con email y reclamar") → descartado.
- i18n de la web → junto con Paso 14 si se decide.
- Tier Pro → eliminado del producto por ahora.
