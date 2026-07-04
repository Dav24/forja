# Paso 13 — Web de Pagos (pay.forja.fit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web de pagos con Stripe Checkout (local, modo test) + webhook en Supabase que activa Premium + cambios mínimos en la app para cerrar el círculo app→web→Stripe→DB→app.

**Architecture:** Next.js delgado en `web/` (landing + success + portal + 2 API routes) sin credenciales de Supabase; la única pieza que escribe en la DB es la Edge Function `stripe-webhook` con la service role key. La página de tarjeta siempre es Stripe Checkout hosted.

**Tech Stack:** Next.js (App Router, TS, Tailwind v4), stripe (Node SDK), lucide-react, Vitest (web), Supabase Edge Functions (Deno) + `deno test`, Stripe CLI.

**Spec:** `docs/superpowers/specs/2026-07-03-payments-web-design.md` — leerlo antes de empezar cualquier task.

## Global Constraints

- Package manager: **pnpm** en todos los proyectos. En `forja/` (app Expo) las deps nativas van con `npx expo install`; en este plan la app NO recibe deps nuevas.
- Nombres de planes **solo visibles**: Free = "Aprendiz", pago = "Maestro Forjador". La DB sigue con `plan IN ('free','premium')`. Los identificadores internos (`isPremium`, `lib/limits.ts`) NO cambian.
- Precios: **$179 MXN/mes · $1,299 MXN/año** (unit_amount Stripe: 17900 y 129900, currency `mxn`).
- **REGLA CRÍTICA DE COPY:** la conexión de pulsera/reloj es GRATIS en todos los planes; lo premium es la IA de Vulcano sobre esos datos.
- Features V1.5 (fotos de comida IA, análisis de técnica, coaching en tiempo real) se muestran SOLO como "En camino", nunca como disponibles.
- Web: íconos SVG de **lucide-react**, nunca emojis como íconos (🔥 solo en copy); contraste ≥4.5:1 sobre carbón; `cursor-pointer` en clickeables; `prefers-reduced-motion` desactiva partículas; idioma es-MX; mobile-first (375/768/1024/1440).
- Paleta brasa (de `constants/colors.ts`): carbón `#0C0A09`, surface `#1C1917`, elevated/border `#292524`, naranja `#F97316`, ámbar `#FBBF24`, dim `#7C2D12`, texto `#FAFAF9`, muted `#A8A29E`. Tipos: Bebas Neue (display) + Inter (texto).
- App (React Native): estilos estáticos → `className`, valores dinámicos/colores del design system/fontFamily → `style` (regla NativeWind del proyecto).
- **Reanimated:** nunca llamar funciones JS dentro de `useAnimatedStyle` — calcular fuera y capturar el valor.
- Stripe **solo modo test** en este paso. Nada de llaves live.
- En la app no hay infra de tests (deuda conocida): las tareas de app se verifican con `npx tsc --noEmit` + verificación manual guiada. En `web/` y en la EF sí hay TDD (Vitest / `deno test`).
- Commits frecuentes, mensajes en el estilo del repo (`feat:`, `fix:`, `docs:`), rama `master`.

---

## File Structure

```
web/                                    ← NUEVO proyecto Next.js
  app/layout.tsx                        ← fonts + shell oscuro
  app/globals.css                       ← tokens de marca + animaciones ember
  app/page.tsx                          ← landing (server component, lee searchParams)
  app/success/page.tsx                  ← éxito + deep link forja://success
  app/portal/page.tsx                   ← redirige al Stripe Customer Portal
  app/api/checkout/route.ts             ← crea Checkout Session
  app/api/portal/route.ts               ← crea Billing Portal Session
  lib/stripe.ts                         ← cliente Stripe singleton
  lib/checkout.ts                       ← lógica pura testeable (uid, price, promo, session)
  lib/checkout.test.ts                  ← Vitest
  components/EmberField.tsx             ← partículas de brasa CSS
  components/Wordmark.tsx               ← FORJA con la O en brasa
  components/PricingSection.tsx         ← toggle + cards + CTA + promo (client)
  components/ComparisonTable.tsx        ← tabla de features
  components/Faq.tsx                    ← FAQ
supabase/functions/stripe-webhook/
  index.ts                              ← handler (reemplaza placeholder vacío)
  status.ts                             ← mapStripeStatus (puro, testeable)
  status.test.ts                        ← deno test
supabase/config.toml                    ← + [functions.stripe-webhook] verify_jwt=false
lib/payments.ts                         ← (app) buildPaymentURL/buildPortalURL con uid
app/(app)/upgrade.tsx                   ← sin Pro, renombres, uid
app/(app)/success.tsx                   ← NUEVA ruta para forja://success
app/(app)/_layout.tsx                   ← + Tabs.Screen success href:null
app/(app)/profile.tsx                   ← renombres de badges/copy
components/premium/UpgradeSheet.tsx     ← uid + renombres
app/_layout.tsx                         ← AppState → invalidate subscription
.env.local                              ← + EXPO_PUBLIC_PAYMENTS_URL
```

---

### Task 1: Scaffold de `web/` con marca Forja

**Files:**
- Create: `web/` (create-next-app), `web/app/globals.css`, `web/app/layout.tsx`
- Modify: `web/package.json` (deps + script test)

**Interfaces:**
- Produces: tokens Tailwind `bg-carbon`, `bg-surface`, `bg-elevated`, `text-foreground`, `text-muted`, `text-ember`, `text-amber-bright`, `border-subtle`, `font-display`, `font-sans`; clase `.ember-glow`; keyframes `rise`. Todos los componentes de Tasks 3-5 los consumen.

- [ ] **Step 1: Crear el proyecto**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
pnpm create next-app@latest web --typescript --app --tailwind --no-src-dir --eslint --import-alias "@/*" --no-turbopack
cd web
pnpm add stripe lucide-react
pnpm add -D vitest
```

- [ ] **Step 2: Script de test en `web/package.json`**

Añadir a `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 3: Tokens de marca en `web/app/globals.css`** (reemplazar el contenido generado)

```css
@import "tailwindcss";

@theme {
  --color-carbon: #0C0A09;
  --color-surface: #1C1917;
  --color-elevated: #292524;
  --color-ember: #F97316;
  --color-amber-bright: #FBBF24;
  --color-ember-dim: #7C2D12;
  --color-foreground: #FAFAF9;
  --color-muted: #A8A29E;
  --color-subtle: #292524;
  --font-display: var(--font-bebas);
  --font-sans: var(--font-inter);
}

body {
  background: linear-gradient(180deg, #0c0a09 0%, #000000 100%);
  color: var(--color-foreground);
  min-height: 100dvh;
}

/* Glow ámbar posicional para elementos clave */
.ember-glow {
  box-shadow: 0 0 60px -12px rgba(249, 115, 22, 0.45);
}

/* Brasas flotantes */
@keyframes rise {
  0%   { transform: translateY(0) scale(1); opacity: 0; }
  10%  { opacity: 0.8; }
  100% { transform: translateY(-90vh) scale(0.4); opacity: 0; }
}
.ember-particle {
  position: absolute;
  bottom: -10px;
  border-radius: 9999px;
  animation: rise linear infinite;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .ember-particle { animation: none; display: none; }
}
```

- [ ] **Step 4: Fonts y shell en `web/app/layout.tsx`** (reemplazar)

```tsx
import type { Metadata } from 'next';
import { Bebas_Neue, Inter } from 'next/font/google';
import './globals.css';

const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], variable: '--font-bebas' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Forja — Hazte Maestro Forjador',
  description: 'Tu entrenador personal con IA. Planes de entrenamiento y nutrición forjados para ti.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${bebas.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verificar que arranca**

Run: `pnpm dev` (dentro de `web/`), abrir `http://localhost:3000`.
Expected: página default de Next sobre fondo carbón oscuro, sin errores en consola. Ctrl+C.

- [ ] **Step 6: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
git add web
git commit -m "feat(web): scaffold Next.js de pay.forja.fit con tokens de marca brasa"
```

---

### Task 2: Lógica de checkout con TDD + API route

**Files:**
- Create: `web/lib/stripe.ts`, `web/lib/checkout.ts`, `web/app/api/checkout/route.ts`
- Test: `web/lib/checkout.test.ts`

**Interfaces:**
- Produces:
  - `isValidUid(uid: unknown): uid is string`
  - `priceIdFor(billing: 'monthly' | 'yearly'): string` (lanza si falta env)
  - `resolvePromo(stripe, code: string): Promise<string | null>` (id del promotion code o null)
  - `createCheckoutSession(stripe, origin: string, p: { billing: 'monthly'|'yearly'; uid: string; promo?: string }): Promise<{ url: string }>`
  - `POST /api/checkout` con body `{ billing, uid, promo? }` → `200 {url}` | `400 {error}` | `502 {error:'stripe_error'}`. Lo consume `PricingSection` (Task 3).

- [ ] **Step 1: Escribir los tests que fallan** — `web/lib/checkout.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { isValidUid, priceIdFor, resolvePromo, createCheckoutSession } from './checkout';

const UID = '123e4567-e89b-42d3-a456-426614174000';

function fakeStripe(overrides: Record<string, unknown> = {}) {
  return {
    promotionCodes: { list: vi.fn().mockResolvedValue({ data: [{ id: 'promo_123' }] }) },
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/x' }) },
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('isValidUid', () => {
  it('acepta un UUID válido', () => expect(isValidUid(UID)).toBe(true));
  it('rechaza basura', () => {
    expect(isValidUid('DROP TABLE')).toBe(false);
    expect(isValidUid(undefined)).toBe(false);
    expect(isValidUid(42)).toBe(false);
  });
});

describe('priceIdFor', () => {
  it('devuelve el env correcto por billing', () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    process.env.STRIPE_PRICE_YEARLY = 'price_y';
    expect(priceIdFor('monthly')).toBe('price_m');
    expect(priceIdFor('yearly')).toBe('price_y');
  });
  it('lanza si falta el env', () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    expect(() => priceIdFor('monthly')).toThrow();
  });
});

describe('resolvePromo', () => {
  it('devuelve el id cuando el código existe', async () => {
    expect(await resolvePromo(fakeStripe(), 'VULCANO20')).toBe('promo_123');
  });
  it('devuelve null cuando no existe (no bloquea)', async () => {
    const s = fakeStripe({ promotionCodes: { list: vi.fn().mockResolvedValue({ data: [] }) } });
    expect(await resolvePromo(s, 'NADA')).toBeNull();
  });
});

describe('createCheckoutSession', () => {
  it('arma la sesión con uid en las tres metadatas y URLs correctas', async () => {
    process.env.STRIPE_PRICE_YEARLY = 'price_y';
    const s = fakeStripe();
    const { url } = await createCheckoutSession(s, 'http://localhost:3000', {
      billing: 'yearly',
      uid: UID,
    });
    expect(url).toBe('https://checkout.stripe.com/x');
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.mode).toBe('subscription');
    expect(arg.line_items).toEqual([{ price: 'price_y', quantity: 1 }]);
    expect(arg.client_reference_id).toBe(UID);
    expect(arg.metadata.user_id).toBe(UID);
    expect(arg.subscription_data.metadata.user_id).toBe(UID);
    expect(arg.payment_method_collection).toBe('if_required');
    expect(arg.allow_promotion_codes).toBe(true);
    expect(arg.success_url).toBe('http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}');
    expect(arg.cancel_url).toContain(`uid=${UID}`);
  });
  it('pre-aplica el promo cuando existe (discounts sustituye allow_promotion_codes)', async () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    const s = fakeStripe();
    await createCheckoutSession(s, 'http://localhost:3000', {
      billing: 'monthly',
      uid: UID,
      promo: 'VULCANO20',
    });
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.discounts).toEqual([{ promotion_code: 'promo_123' }]);
    expect(arg.allow_promotion_codes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run (en `web/`): `pnpm test`
Expected: FAIL — `Cannot find module './checkout'`.

- [ ] **Step 3: Implementar `web/lib/checkout.ts`**

```ts
import type Stripe from 'stripe';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Billing = 'monthly' | 'yearly';

export function isValidUid(uid: unknown): uid is string {
  return typeof uid === 'string' && UUID_RE.test(uid);
}

export function priceIdFor(billing: Billing): string {
  const id =
    billing === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  if (!id) throw new Error(`Falta STRIPE_PRICE_${billing === 'monthly' ? 'MONTHLY' : 'YEARLY'}`);
  return id;
}

export async function resolvePromo(stripe: Stripe, code: string): Promise<string | null> {
  const found = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  return found.data[0]?.id ?? null;
}

export async function createCheckoutSession(
  stripe: Stripe,
  origin: string,
  p: { billing: Billing; uid: string; promo?: string },
): Promise<{ url: string }> {
  const promoId = p.promo ? await resolvePromo(stripe, p.promo) : null;
  const cancelParams = new URLSearchParams({ plan: 'premium', billing: p.billing, uid: p.uid });
  if (p.promo) cancelParams.set('promo', p.promo);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdFor(p.billing), quantity: 1 }],
    client_reference_id: p.uid,
    metadata: { user_id: p.uid },
    subscription_data: { metadata: { user_id: p.uid } },
    payment_method_collection: 'if_required',
    // Stripe no permite discounts + allow_promotion_codes juntos
    ...(promoId ? { discounts: [{ promotion_code: promoId }] } : { allow_promotion_codes: true }),
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?${cancelParams.toString()}`,
  });
  return { url: session.url! };
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm test`
Expected: PASS (8 tests).

- [ ] **Step 5: Cliente singleton `web/lib/stripe.ts`**

```ts
import Stripe from 'stripe';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}
```

- [ ] **Step 6: Route `web/app/api/checkout/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createCheckoutSession, isValidUid, type Billing } from '@/lib/checkout';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const billing = body?.billing as Billing;
  const uid = body?.uid;
  const promo = typeof body?.promo === 'string' ? body.promo.trim().toUpperCase() : undefined;

  if (!['monthly', 'yearly'].includes(billing) || !isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const { url } = await createCheckoutSession(getStripe(), req.nextUrl.origin, {
      billing,
      uid,
      promo: promo || undefined,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('checkout error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
```

- [ ] **Step 7: Verificar validación sin Stripe real**

Run: `pnpm dev` y en otra terminal:
`curl -s -X POST http://localhost:3000/api/checkout -H 'content-type: application/json' -d '{"billing":"yearly","uid":"nope"}'`
Expected: `{"error":"invalid_request"}`. Ctrl+C al dev server.

- [ ] **Step 8: Commit**

```bash
git add web/lib web/app/api/checkout
git commit -m "feat(web): API de checkout con Stripe Sessions, promos y validación de uid (TDD)"
```

---

### Task 3: Landing de precios

**Files:**
- Create: `web/components/EmberField.tsx`, `web/components/Wordmark.tsx`, `web/components/PricingSection.tsx`, `web/components/ComparisonTable.tsx`, `web/components/Faq.tsx`
- Modify: `web/app/page.tsx` (reemplazar el default)

**Interfaces:**
- Consumes: `POST /api/checkout` (Task 2), tokens CSS (Task 1).
- Produces: `<PricingSection uid={string|null} initialBilling={'monthly'|'yearly'} initialPromo={string} />` — la única pieza client-side con estado.

- [ ] **Step 1: `web/components/EmberField.tsx`** (decorativo, determinista para evitar hydration mismatch)

```tsx
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  size: 3 + (i % 3) * 2,
  duration: 9 + (i % 5) * 3,
  delay: (i * 1.7) % 12,
  color: ['#FDE68A', '#FBBF24', '#F97316'][i % 3],
}));

export function EmberField() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember-particle"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: e.color,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `web/components/Wordmark.tsx`**

```tsx
export function Wordmark({ className = 'text-4xl' }: { className?: string }) {
  return (
    <span className={`font-display tracking-wider ${className}`}>
      F
      <span className="bg-gradient-to-b from-amber-bright to-ember bg-clip-text text-transparent">
        O
      </span>
      RJA
    </span>
  );
}
```

- [ ] **Step 3: `web/components/PricingSection.tsx`** (client)

```tsx
'use client';

import { useState } from 'react';
import { Check, Minus, Flame, Loader2 } from 'lucide-react';

type Billing = 'monthly' | 'yearly';

const APRENDIZ = [
  '20 mensajes al día con Vulcano',
  '1 plan de entrenamiento al mes',
  '1 plan alimenticio',
  'Seguimiento corporal (14 días)',
  'Conexión de pulsera o reloj',
];

const MAESTRO = [
  'Chat ilimitado con Vulcano',
  'Planes de entrenamiento ilimitados',
  '10 planes alimenticios al mes',
  '365 días de historial corporal',
  'Composición corporal (% grasa, músculo)',
  'Vulcano analiza tus datos de actividad',
];

const EN_CAMINO = [
  'Fotos de comida con análisis IA',
  'Análisis de técnica de ejercicio',
  'Coaching en tiempo real',
];

export function PricingSection({
  uid,
  initialBilling,
  initialPromo,
}: {
  uid: string | null;
  initialBilling: Billing;
  initialPromo: string;
}) {
  const [billing, setBilling] = useState<Billing>(initialBilling);
  const [promo, setPromo] = useState(initialPromo);
  const [promoOpen, setPromoOpen] = useState(!!initialPromo);
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
        body: JSON.stringify({ billing, uid, promo: promo || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError('No pudimos iniciar el pago, intenta de nuevo.');
      setLoading(false);
    }
  }

  const price = billing === 'monthly' ? '$179' : '$1,299';
  const period = billing === 'monthly' ? '/mes' : '/año';

  return (
    <section id="planes" className="mx-auto w-full max-w-4xl px-4">
      {/* Toggle */}
      <div className="mx-auto mb-2 flex w-fit rounded-xl bg-surface p-1">
        {(['monthly', 'yearly'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBilling(b)}
            className={`cursor-pointer rounded-lg px-6 py-2 text-sm font-semibold transition-colors duration-200 ${
              billing === b ? 'bg-ember text-carbon' : 'text-muted hover:text-foreground'
            }`}
          >
            {b === 'monthly' ? 'Mensual' : 'Anual'}
          </button>
        ))}
      </div>
      <p className="mb-8 h-5 text-center text-sm text-amber-bright">
        {billing === 'yearly' ? '2 meses gratis · ahorra 40%' : ''}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Aprendiz */}
        <div className="rounded-2xl border border-subtle bg-surface/70 p-6">
          <h3 className="font-display text-3xl">Aprendiz</h3>
          <p className="mb-6 mt-2 text-2xl font-bold">
            $0 <span className="text-sm font-normal text-muted">para siempre</span>
          </p>
          <ul className="space-y-3">
            {APRENDIZ.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Maestro Forjador */}
        <div className="ember-glow relative rounded-2xl bg-gradient-to-br from-amber-bright to-ember p-[2px]">
          <span className="absolute -top-3 left-6 rounded-full bg-ember px-3 py-1 text-xs font-bold tracking-wide text-carbon">
            RECOMENDADO
          </span>
          <div className="h-full rounded-[14px] bg-surface p-6">
            <h3 className="font-display text-3xl">Maestro Forjador</h3>
            <p className="mb-1 mt-2 text-2xl font-bold text-ember">
              {price} <span className="text-sm font-normal text-muted">MXN{period}</span>
            </p>
            <p className="mb-5 h-4 text-xs text-muted">
              {billing === 'yearly' ? 'Equivale a $108/mes' : ''}
            </p>
            <ul className="space-y-3">
              {MAESTRO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-bright" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-bright">
              <Flame className="h-3.5 w-3.5" aria-hidden /> EN CAMINO
            </p>
            <ul className="space-y-2">
              {EN_CAMINO.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted">
                  <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>

            {uid ? (
              <>
                <button
                  onClick={startCheckout}
                  disabled={loading}
                  className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-ember py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Convertirme en Maestro
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-center text-sm text-red-400">
                    {error}
                  </p>
                )}
                <button
                  onClick={() => setPromoOpen((v) => !v)}
                  className="mt-4 w-full cursor-pointer text-center text-sm text-muted transition-colors duration-200 hover:text-foreground"
                >
                  ¿Tienes un código?
                </button>
                {promoOpen && (
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value.toUpperCase())}
                    placeholder="CODIGO"
                    aria-label="Código promocional"
                    className="mt-2 w-full rounded-lg border border-subtle bg-carbon px-3 py-2 text-sm uppercase placeholder:text-muted focus:border-ember focus:outline-none"
                  />
                )}
              </>
            ) : (
              <div className="mt-6 space-y-2">
                <a
                  href={process.env.NEXT_PUBLIC_APP_STORE_URL ?? '#'}
                  className="block w-full cursor-pointer rounded-xl bg-ember py-3.5 text-center font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright"
                >
                  Descarga Forja y empieza gratis
                </a>
                <p className="text-center text-xs text-muted">iOS y Android</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `web/components/ComparisonTable.tsx`**

```tsx
import { Check, Minus } from 'lucide-react';

const ROWS: [string, string | boolean, string | boolean][] = [
  ['Chat con Vulcano', '20 msgs/día', 'Ilimitado'],
  ['Planes de entrenamiento', '1 al mes', 'Ilimitados'],
  ['Planes alimenticios', '1', '10 al mes'],
  ['Historial corporal', '14 días', '365 días'],
  ['Conexión pulsera/reloj', true, true],
  ['Composición corporal (% grasa, músculo)', false, true],
  ['IA de Vulcano sobre tus datos de actividad', false, true],
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto h-4 w-4 text-amber-bright" aria-label="Incluido" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted" aria-label="No incluido" />;
  return <span>{v}</span>;
}

export function ComparisonTable() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4">
      <h2 className="mb-6 text-center font-display text-4xl">Compara los planes</h2>
      <div className="overflow-x-auto rounded-2xl border border-subtle">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-surface text-left">
              <th className="p-4 font-semibold"> </th>
              <th className="p-4 text-center font-display text-lg font-normal">Aprendiz</th>
              <th className="p-4 text-center font-display text-lg font-normal text-ember">
                Maestro Forjador
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, free, paid], i) => (
              <tr key={label} className={i % 2 ? 'bg-surface/50' : ''}>
                <td className="p-4">{label}</td>
                <td className="p-4 text-center text-muted"><Cell v={free} /></td>
                <td className="p-4 text-center"><Cell v={paid} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `web/components/Faq.tsx`**

```tsx
const FAQS = [
  {
    q: '¿Cómo se activa en la app?',
    a: 'Automático. Al completar el pago, tu cuenta se convierte en Maestro Forjador en segundos. Solo vuelve a la app.',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí, desde "Gestionar suscripción" en tu perfil. Conservas Maestro Forjador hasta el final del periodo que ya pagaste.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Tarjetas de crédito y débito (Visa, Mastercard, Amex), procesadas de forma segura por Stripe. Nunca vemos tu tarjeta.',
  },
  {
    q: 'Tengo un código, ¿dónde lo pongo?',
    a: 'Toca "¿Tienes un código?" bajo el botón de pago, o escríbelo directo en la pantalla de pago de Stripe.',
  },
];

export function Faq() {
  return (
    <section className="mx-auto w-full max-w-2xl px-4">
      <h2 className="mb-6 text-center font-display text-4xl">Preguntas frecuentes</h2>
      <div className="space-y-3">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group rounded-xl border border-subtle bg-surface/70 p-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: `web/app/page.tsx`** (reemplazar)

```tsx
import { EmberField } from '@/components/EmberField';
import { Wordmark } from '@/components/Wordmark';
import { PricingSection } from '@/components/PricingSection';
import { ComparisonTable } from '@/components/ComparisonTable';
import { Faq } from '@/components/Faq';
import { isValidUid } from '@/lib/checkout';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; billing?: string; promo?: string }>;
}) {
  const params = await searchParams;
  const uid = isValidUid(params.uid) ? params.uid : null;
  const initialBilling = params.billing === 'monthly' ? 'monthly' : 'yearly';
  const initialPromo = (params.promo ?? '').toUpperCase().slice(0, 40);

  return (
    <main className="flex flex-col gap-20 pb-24">
      {/* Hero */}
      <header className="relative overflow-hidden pb-10 pt-16 text-center">
        <EmberField />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(ellipse_at_bottom,rgba(249,115,22,0.22),transparent_65%)]"
        />
        <div className="relative">
          <Wordmark className="text-3xl" />
          <h1 className="mx-auto mt-8 max-w-3xl px-4 font-display text-6xl leading-none md:text-8xl">
            FORJA TU MEJOR VERSIÓN
          </h1>
          <p className="mx-auto mt-4 max-w-xl px-4 text-muted">
            Tu entrenador con IA: rutinas, nutrición y seguimiento, forjados para ti por Vulcano.
          </p>
        </div>
      </header>

      <PricingSection uid={uid} initialBilling={initialBilling} initialPromo={initialPromo} />
      <ComparisonTable />
      <Faq />

      <footer className="px-4 text-center text-xs text-muted">
        Cancela cuando quieras · Pago procesado de forma segura con Stripe
      </footer>
    </main>
  );
}
```

- [ ] **Step 7: Verificación manual**

Run: `pnpm dev` y revisar en el navegador:
1. `http://localhost:3000` → CTA "Descarga Forja y empieza gratis" (sin uid).
2. `http://localhost:3000/?uid=123e4567-e89b-42d3-a456-426614174000&billing=monthly&promo=HOLA` → CTA "Convertirme en Maestro", toggle en Mensual, campo promo abierto con "HOLA".
3. DevTools responsive 375px: sin scroll horizontal, tabla scrollea dentro de su contenedor.
4. Botón de pago con el server de Stripe sin configurar → muestra "No pudimos iniciar el pago…" (error 502 esperado).
Expected: los 4 puntos se cumplen.

- [ ] **Step 8: Commit**

```bash
git add web/components web/app/page.tsx
git commit -m "feat(web): landing de precios Aprendiz/Maestro Forjador con brasas y tabla comparativa"
```

---

### Task 4: Página `/success`

**Files:**
- Create: `web/app/success/page.tsx`

**Interfaces:**
- Consumes: deep link `forja://success` (lo maneja la app en Task 8).

- [ ] **Step 1: Crear `web/app/success/page.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { Flame } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

const DEEP_LINK = 'forja://success';

export default function Success() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.href = DEEP_LINK;
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark className="text-2xl" />
      <Flame className="ember-glow h-16 w-16 rounded-full p-3 text-ember" aria-hidden />
      <h1 className="font-display text-6xl leading-none">EL ACERO ESTÁ FORJADO</h1>
      <p className="max-w-md text-muted">
        Ya eres <strong className="text-amber-bright">Maestro Forjador</strong>. Tu Premium está
        activo — vuelve a la app y forja.
      </p>
      <a
        href={DEEP_LINK}
        className="cursor-pointer rounded-xl bg-ember px-8 py-3.5 font-bold text-carbon transition-colors duration-200 hover:bg-amber-bright"
      >
        Volver a Forja
      </a>
      <p className="text-xs text-muted">Si la app no abre sola, ábrela manualmente — tu plan ya está activo.</p>
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `pnpm dev`, abrir `http://localhost:3000/success`.
Expected: página renderiza; a los 3s el navegador intenta abrir `forja://success` (en desktop mostrará que no hay app — correcto).

- [ ] **Step 3: Commit**

```bash
git add web/app/success
git commit -m "feat(web): página de éxito con deep link de regreso a la app"
```

---

### Task 5: Portal de gestión (`/portal` + `/api/portal`)

**Files:**
- Create: `web/app/api/portal/route.ts`, `web/app/portal/page.tsx`

**Interfaces:**
- Consumes: `getStripe()` (Task 2); customers de Stripe con `metadata.user_id` (lo garantiza el webhook, Task 6).
- Produces: `POST /api/portal` body `{ uid }` → `200 {url}` | `400` | `404 {error:'no_subscription'}` | `502`.

- [ ] **Step 1: `web/app/api/portal/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { isValidUid } from '@/lib/checkout';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const uid = body?.uid;
  if (!isValidUid(uid)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  try {
    const stripe = getStripe();
    const found = await stripe.customers.search({
      query: `metadata['user_id']:'${uid}'`,
      limit: 1,
    });
    const customer = found.data[0];
    if (!customer) {
      return NextResponse.json({ error: 'no_subscription' }, { status: 404 });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: req.nextUrl.origin,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err);
    return NextResponse.json({ error: 'stripe_error' }, { status: 502 });
  }
}
```

- [ ] **Step 2: `web/app/portal/page.tsx`**

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';

function PortalRedirect() {
  const uid = useSearchParams().get('uid');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setError('Falta información de tu cuenta. Abre esta página desde la app.');
      return;
    }
    fetch('/api/portal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uid }),
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error('No encontramos una suscripción activa para tu cuenta.');
        if (!res.ok) throw new Error('No pudimos abrir el portal, intenta de nuevo.');
        const { url } = await res.json();
        window.location.href = url;
      })
      .catch((e: Error) => setError(e.message));
  }, [uid]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark className="text-2xl" />
      {error ? (
        <p role="alert" className="max-w-md text-muted">{error}</p>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-ember" aria-hidden />
          <p className="text-muted">Abriendo tu portal de suscripción…</p>
        </>
      )}
    </main>
  );
}

export default function Portal() {
  return (
    <Suspense>
      <PortalRedirect />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verificar sin uid**

Run: `pnpm dev`, abrir `http://localhost:3000/portal`.
Expected: mensaje "Falta información de tu cuenta…". (El flujo completo se prueba en Task 9 con Stripe test.)

- [ ] **Step 4: Commit**

```bash
git add web/app/portal web/app/api/portal
git commit -m "feat(web): portal de gestión vía Stripe Customer Portal buscando por metadata uid"
```

---

### Task 6: Edge Function `stripe-webhook`

**Files:**
- Create: `supabase/functions/stripe-webhook/status.ts`, `supabase/functions/stripe-webhook/status.test.ts`
- Modify: `supabase/functions/stripe-webhook/index.ts` (está VACÍO — llenarlo), `supabase/config.toml` (añadir sección al final)

**Interfaces:**
- Consumes: eventos de Stripe con `metadata.user_id` (Task 2 los siembra); tabla `subscriptions` (unique `user_id`).
- Produces: `mapStripeStatus(s: string): 'active'|'canceled'|'past_due'|'trialing'|'incomplete'`; endpoint `POST /functions/v1/stripe-webhook`; customers de Stripe con `metadata.user_id` (los consume Task 5).

- [ ] **Step 1: Test que falla** — `supabase/functions/stripe-webhook/status.test.ts`

```ts
import { assertEquals } from 'jsr:@std/assert';
import { mapStripeStatus } from './status.ts';

Deno.test('mapea estados de Stripe al CHECK de la tabla subscriptions', () => {
  assertEquals(mapStripeStatus('active'), 'active');
  assertEquals(mapStripeStatus('trialing'), 'trialing');
  assertEquals(mapStripeStatus('past_due'), 'past_due');
  assertEquals(mapStripeStatus('unpaid'), 'past_due');
  assertEquals(mapStripeStatus('canceled'), 'canceled');
  assertEquals(mapStripeStatus('incomplete'), 'incomplete');
  assertEquals(mapStripeStatus('incomplete_expired'), 'incomplete');
  assertEquals(mapStripeStatus('algo_nuevo_de_stripe'), 'incomplete');
});
```

- [ ] **Step 2: Verificar que falla**

Run: `cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && deno test supabase/functions/stripe-webhook/status.test.ts`
Expected: FAIL — `Module not found ... status.ts`.

- [ ] **Step 3: Implementar `status.ts`**

```ts
// El CHECK de subscriptions solo admite estos 5 valores (migración 0001)
type DbStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

export function mapStripeStatus(s: string): DbStatus {
  switch (s) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    default:
      return 'incomplete';
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `deno test supabase/functions/stripe-webhook/status.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implementar `supabase/functions/stripe-webhook/index.ts`**

```ts
import Stripe from 'npm:stripe@18';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mapStripeStatus } from './status.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// En API versions nuevas current_period_end vive en el item; en viejas, en la subscription
function periodEnd(sub: Stripe.Subscription): string | null {
  const ts =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

async function userIdForSub(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (!data) console.error('webhook: sin user_id para subscription', sub.id);
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('webhook: firma inválida', err);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id ?? session.client_reference_id;
        if (!userId) {
          // Bug nuestro: log + 200 para que Stripe no reintente infinito
          console.error('webhook: checkout.session.completed sin user_id', session.id);
          break;
        }
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
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForSub(sub);
        if (!userId) break;
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: mapStripeStatus(sub.status),
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        if (error) throw error;
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdForSub(sub);
        if (!userId) break;
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan: 'free',
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        if (error) throw error;
        break;
      }
      // Otros eventos: 200 silencioso
    }
  } catch (err) {
    // Error transitorio (DB caída, etc.): 500 para que Stripe reintente
    console.error('webhook: error manejando', event.type, err);
    return new Response('handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 6: Deshabilitar JWT para esta función** — añadir al final de `supabase/config.toml`:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

(Stripe no manda JWT de Supabase; la seguridad es la verificación de firma.)

- [ ] **Step 7: Añadir secrets a `supabase/.env`** (junto a la ANTHROPIC_API_KEY existente; los valores reales se obtienen en Task 9)

```bash
STRIPE_SECRET_KEY=sk_test_PENDIENTE
STRIPE_WEBHOOK_SECRET=whsec_PENDIENTE
```

- [ ] **Step 8: Verificar que la función arranca**

Run: `sg docker -c "supabase functions serve stripe-webhook --env-file supabase/.env"` y en otra terminal:
`curl -s -X POST http://127.0.0.1:54321/functions/v1/stripe-webhook -d '{}'`
Expected: `missing signature` (status 400) — la función corre y rechaza sin firma. Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/stripe-webhook supabase/config.toml
git commit -m "feat(supabase): webhook de Stripe que activa/sincroniza suscripciones (TDD en status map)"
```

---

### Task 7: App — `lib/payments.ts` + rework de `upgrade.tsx`

**Files:**
- Create: `lib/payments.ts`
- Modify: `app/(app)/upgrade.tsx`, `.env.local` (raíz de forja)

**Interfaces:**
- Consumes: `useAuthStore` (`user.id`), `useIsPremium()`.
- Produces: `buildPaymentURL(uid: string, billing: 'monthly'|'yearly', promoCode?: string): string` y `buildPortalURL(uid: string): string` — Task 8 (UpgradeSheet) las consume.

- [ ] **Step 1: Crear `lib/payments.ts`**

```ts
export type Billing = 'monthly' | 'yearly';

const PAYMENTS_URL = process.env.EXPO_PUBLIC_PAYMENTS_URL ?? 'https://pay.forja.fit';

export function buildPaymentURL(uid: string, billing: Billing, promoCode = ''): string {
  let url = `${PAYMENTS_URL}/?plan=premium&billing=${billing}&uid=${uid}`;
  const promo = promoCode.trim();
  if (promo) url += '&promo=' + encodeURIComponent(promo.toUpperCase());
  return url;
}

export function buildPortalURL(uid: string): string {
  return `${PAYMENTS_URL}/portal?uid=${uid}`;
}
```

- [ ] **Step 2: Añadir a `.env.local` de forja** (dejar el default de producción comentado como referencia)

```bash
# Web de pagos — en pruebas E2E apuntar a la IP local del dev server de Next
EXPO_PUBLIC_PAYMENTS_URL=https://pay.forja.fit
```

- [ ] **Step 3: Rework de `app/(app)/upgrade.tsx`**

Cambios exactos sobre el archivo actual:

3a. Imports: eliminar la función local `buildPaymentURL` (líneas 39-45) y el array `PRO_FEATURES` (líneas 32-37). Añadir:

```ts
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL, buildPortalURL } from '@/lib/payments';
```

3b. Renombrar arrays de features (reemplazan a los actuales `FREE_FEATURES`/`PREMIUM_FEATURES`; se añade `COMING_FEATURES`):

```ts
const APRENDIZ_FEATURES = [
  '20 mensajes al día con Vulcano',
  '1 plan de entrenamiento al mes',
  '1 plan alimenticio (de por vida)',
  '14 días de historial corporal',
  'Conexión de pulsera o reloj',
];

const MAESTRO_FEATURES = [
  'Chat ilimitado con Vulcano',
  'Planes de entrenamiento ilimitados',
  '10 planes alimenticios al mes',
  '365 días de historial corporal',
  'Composición corporal (% grasa, músculo)',
  'Vulcano analiza tus datos de actividad',
];

const COMING_FEATURES = [
  'Fotos de comida con análisis IA',
  'Análisis de técnica de ejercicio',
  'Coaching en tiempo real',
];
```

3c. En el componente, obtener el uid:

```ts
const userId = useAuthStore((s) => s.user?.id);
```

3d. Hero: `FORJA PRO` → `MAESTRO FORJADOR`; subtítulo `Entrena con inteligencia` → `Forja tu mejor versión`.

3e. Card free: título `Free` → `Aprendiz`; loop sobre `APRENDIZ_FEATURES`.

3f. Card premium: título `⚡ PREMIUM` → `MAESTRO FORJADOR` (sin emoji); loop sobre `MAESTRO_FEATURES`; **dentro del mismo card**, después del loop de features, añadir la sub-sección En camino:

```tsx
<Text
  style={{
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  }}
>
  EN CAMINO 🔥
</Text>
{COMING_FEATURES.map((f, i) => (
  <View
    key={i}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
  >
    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
    <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
      {f}
    </Text>
  </View>
))}
```

3g. **Eliminar el card Pro completo** (el `<View>` con comentario `{/* Pro tier card */}`, líneas 267-303).

3h. CTA section: `Ya eres Premium` → `Ya eres Maestro Forjador`; los dos `Linking.openURL`:

```tsx
onPress={() => userId && Linking.openURL(buildPortalURL(userId))}
```

```tsx
onPress={() => userId && Linking.openURL(buildPaymentURL(userId, billing, promoCode))}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en Expo Go**

Run: `pnpm start --clear`, abrir Perfil → upgrade.
Expected: hero "MAESTRO FORJADOR", cards Aprendiz/Maestro Forjador, sección "EN CAMINO 🔥" dentro del card de pago, NO existe card Pro, y al tocar el CTA el navegador abre `https://pay.forja.fit/?plan=premium&billing=yearly&uid=<uuid-real>`.

- [ ] **Step 6: Commit**

```bash
git add lib/payments.ts "app/(app)/upgrade.tsx" .env.local 2>/dev/null || git add lib/payments.ts "app/(app)/upgrade.tsx"
git commit -m "feat(app): upgrade renovado — Aprendiz/Maestro Forjador, sin tier Pro, uid en URLs de pago"
```

(Nota: si `.env.local` está en `.gitignore`, el `2>/dev/null ||` lo salta — verificar con `git check-ignore .env.local`.)

---

### Task 8: App — UpgradeSheet, profile y pantalla de éxito + refetch

**Files:**
- Modify: `components/premium/UpgradeSheet.tsx`, `app/(app)/profile.tsx`, `app/(app)/_layout.tsx`, `app/_layout.tsx`
- Create: `app/(app)/success.tsx`

**Interfaces:**
- Consumes: `buildPaymentURL` (Task 7), `SparkBurst` (`{ trigger: boolean; onDone?: () => void }`), `queryClient` (const de módulo en `app/_layout.tsx:51`), queryKey `['subscription', user.id]` (invalidar por prefijo `['subscription']`).

- [ ] **Step 1: `components/premium/UpgradeSheet.tsx`**

Añadir imports:

```ts
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL } from '@/lib/payments';
```

Dentro del componente, y reemplazar `handleUpgrade`:

```ts
const userId = useAuthStore((s) => s.user?.id);

function handleUpgrade() {
  if (userId) Linking.openURL(buildPaymentURL(userId, 'yearly'));
}
```

Renombres de copy: título de `generic`: `'Desbloquea Premium'` → `'Conviértete en Maestro'`; label del botón: `"Hazte Premium →"` → `"Hazte Maestro →"`.

- [ ] **Step 2: `app/(app)/profile.tsx`** — renombres visibles

- `<Badge label="PREMIUM" variant="premium" />` → `<Badge label="MAESTRO FORJADOR" variant="premium" />`
- `<Badge label="FREE" variant="muted" />` → `<Badge label="APRENDIZ" variant="muted" />`
- `label="Hazte Premium"` → `label="Hazte Maestro"`

- [ ] **Step 3: Crear `app/(app)/success.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';

export default function SuccessScreen() {
  const queryClient = useQueryClient();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    setBurst(true);
  }, [queryClient]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <SparkBurst trigger={burst} onDone={() => setBurst(false)} />
        <Text
          style={{
            fontFamily: 'BebasNeue-Regular',
            fontSize: 40,
            color: colors.text,
            letterSpacing: 1,
            textAlign: 'center',
          }}
        >
          EL ACERO ESTÁ FORJADO
        </Text>
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          Ya eres Maestro Forjador. Vulcano te espera.
        </Text>
        <Button label="Empezar a forjar" onPress={() => router.replace('/(app)')} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Registrar la ruta oculta en `app/(app)/_layout.tsx`** — junto al screen de upgrade:

```tsx
<Tabs.Screen
  name="success"
  options={{ href: null }}
/>
```

- [ ] **Step 5: Refetch al volver a foreground en `app/_layout.tsx`**

Añadir `AppState` al import de `react-native` existente, y dentro del componente raíz (el que tiene acceso al `queryClient` de módulo):

```tsx
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    }
  });
  return () => sub.remove();
}, []);
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Verificación manual en Expo Go**

1. En el perfil: badge "APRENDIZ" (usuario free).
2. Abrir un gate premium (rango 1m en la gráfica) → sheet dice "Hazte Maestro →" y al tocarlo la URL lleva `uid`.
3. Con la app abierta: `npx uri-scheme open "forja://success" --android` (o abrir el link desde el navegador del teléfono) → pantalla "EL ACERO ESTÁ FORJADO" con chispas, botón regresa a Home.
Expected: los 3 puntos se cumplen.

- [ ] **Step 8: Commit**

```bash
git add components/premium/UpgradeSheet.tsx "app/(app)/profile.tsx" "app/(app)/success.tsx" "app/(app)/_layout.tsx" app/_layout.tsx
git commit -m "feat(app): pantalla de éxito con deep link, refetch en foreground y renombres Maestro/Aprendiz"
```

---

### Task 9: Setup de Stripe test + E2E completo + docs

**Files:**
- Modify: `web/.env.local` (crear), `supabase/.env` (valores reales), `forja-docs.md` (sección Paso 13)

**Interfaces:**
- Consumes: todo lo anterior. Requiere: cuenta Stripe (modo test basta, sin datos bancarios), Stripe CLI instalado (`stripe --version`; si falta: https://docs.stripe.com/stripe-cli), Supabase local corriendo.

- [ ] **Step 1: Login y crear producto/precios test**

```bash
stripe login   # abre el navegador, autorizar (modo test)
stripe products create --name "Forja — Maestro Forjador" \
  --description "Suscripción Maestro Forjador"
# con el id prod_XXX que devuelve:
stripe prices create --product prod_XXX --currency mxn --unit-amount 17900 \
  -d "recurring[interval]=month"
stripe prices create --product prod_XXX --currency mxn --unit-amount 129900 \
  -d "recurring[interval]=year"
```

Guardar los dos `price_...` ids.

- [ ] **Step 2: Crear un promotion code de prueba (caso influencer 100%)**

```bash
stripe coupons create --percent-off 100 --duration repeating --duration-in-months 3 \
  --name "Influencer 3 meses"
# con el id del cupón:
stripe promotion_codes create --coupon COUPON_ID --code VULCANO100
```

- [ ] **Step 3: Envs reales**

`web/.env.local`:

```bash
STRIPE_SECRET_KEY=sk_test_...        # de `stripe config --list` o dashboard test
STRIPE_PRICE_MONTHLY=price_...       # el de 17900
STRIPE_PRICE_YEARLY=price_...        # el de 129900
NEXT_PUBLIC_APP_STORE_URL=#
NEXT_PUBLIC_PLAY_STORE_URL=#
```

`supabase/.env`: reemplazar los `PENDIENTE` de Task 6 con el mismo `sk_test_...`; el `STRIPE_WEBHOOK_SECRET` sale del Step 4.

- [ ] **Step 4: Levantar los 3 procesos** (3 terminales)

```bash
# T1 — Supabase + función webhook
sg docker -c "supabase start"   # si no está corriendo
sg docker -c "supabase functions serve stripe-webhook --env-file supabase/.env"

# T2 — web
cd web && pnpm dev

# T3 — reenvío de webhooks
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
# imprime "whsec_..." → copiarlo a supabase/.env y reiniciar T1 (functions serve)
```

- [ ] **Step 5: Checklist E2E del spec** (usar un usuario real del Supabase local; obtener su uuid con: `sg docker -c "supabase db psql -c \"select id, email from auth.users limit 5\""` o desde Studio `http://127.0.0.1:54323`)

1. `http://localhost:3000/?uid=<uuid>&billing=monthly` → pagar con `4242 4242 4242 4242` (fecha futura, cvc 123, cualquier CP) → redirige a `/success` → verificar DB: `select plan, status, stripe_subscription_id, current_period_end from subscriptions where user_id='<uuid>'` → `premium/active` con datos de Stripe.
2. Repetir con billing anual y otro usuario → `premium/active`.
3. Cupón `VULCANO100` prellenado (`&promo=VULCANO100`) → total $0, sin pedir tarjeta → `premium/active`.
4. Cancelar a mitad del checkout (botón atrás de Stripe) → regresa a la landing con toggle/uid intactos.
5. `stripe subscriptions cancel <sub_id>` → webhook `customer.subscription.deleted` → DB: `plan='free', status='canceled'`.
6. Landing sin uid → CTA de descarga. `http://localhost:3000/portal?uid=<uuid-con-sub>` → redirige al Customer Portal de Stripe.
7. **Círculo completo con el teléfono:** poner `EXPO_PUBLIC_PAYMENTS_URL=http://<IP-local>:3000` en `.env.local` de forja, `pnpm start --clear`, tocar CTA en upgrade → pagar en el navegador del teléfono → botón "Volver a Forja" → pantalla de éxito → gates premium abiertos (rango 1m de la gráfica accesible) sin reiniciar la app.

Expected: los 7 puntos verificados. Anotar cualquier falla y corregir antes de continuar.

- [ ] **Step 6: Documentar en `forja-docs.md`**

Añadir sección "Paso 13 — Web de Pagos": arquitectura (web sin credenciales Supabase, webhook como única escritura), cómo levantar el entorno local (los 3 procesos del Step 4), envs necesarias, y el pendiente explícito para Paso 15 (deploy Vercel + dominio + Stripe live + endpoint de webhook productivo con `stripe webhook_endpoints create`).

- [ ] **Step 7: Commit final**

```bash
git add forja-docs.md
git commit -m "docs: Paso 13 completado — flujo de pagos E2E verificado en local con Stripe test"
```

---

## Self-Review (hecho al escribir el plan)

- **Spec coverage:** landing (T3), success (T4), portal (T5), checkout API (T2), webhook 3 eventos + customer metadata (T6), cambios app uid/renombres/success/AppState/env (T7-T8), promos incl. 100% (T2/T9), testing checklist completo (T9), envs (T6/T9). Deploy/IAP/i18n: fuera de alcance, correcto.
- **Placeholders:** los `sk_test_PENDIENTE` de Task 6 son deliberados (valores reales llegan en Task 9, documentado).
- **Consistencia de tipos:** `Billing` definido igual en `web/lib/checkout.ts` y `lib/payments.ts` (proyectos distintos, sin import cruzado posible); `buildPaymentURL(uid, billing, promoCode)` consistente entre T7 y T8; queryKey `['subscription']` como prefijo de `['subscription', user.id]` — `invalidateQueries` matchea por prefijo, correcto.
