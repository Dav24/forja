# Forja — Documentación Técnica del Proyecto

> App móvil de entrenamiento con coach IA personal.  
> Dominio: **forja.fit** · Empresa: **Physis Labs**  
> Última actualización: 2026-06-25

---

## Índice

1. [Visión y Producto](#1-visión-y-producto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura General](#3-arquitectura-general)
4. [Base de Datos — Esquema PostgreSQL](#4-base-de-datos--esquema-postgresql)
5. [Autenticación y Seguridad](#5-autenticación-y-seguridad)
6. [Backend — Supabase Edge Functions](#6-backend--supabase-edge-functions)
7. [Integración con IA — Claude (Anthropic)](#7-integración-con-ia--claude-anthropic)
8. [Integración de Pagos — Stripe](#8-integración-de-pagos--stripe)
9. [Frontend — Navegación y Rutas](#9-frontend--navegación-y-rutas)
10. [Frontend — Pantallas](#10-frontend--pantallas)
11. [Frontend — Componentes UI](#11-frontend--componentes-ui)
12. [State Management](#12-state-management)
13. [Hooks de Datos](#13-hooks-de-datos)
14. [Sistema de Diseño](#14-sistema-de-diseño)
15. [Internacionalización (i18n)](#15-internacionalización-i18n)
16. [Límites Free vs Premium](#16-límites-free-vs-premium)
17. [Notificaciones Push](#17-notificaciones-push)
18. [Load Testing](#18-load-testing)
19. [Variables de Entorno](#19-variables-de-entorno)
20. [Pasos de Construcción — Historial y Próximos](#20-pasos-de-construcción--historial-y-próximos)

---

## 1. Visión y Producto

**Forja** es una app móvil de entrenamiento personal potenciada por IA. El usuario tiene acceso a un coach virtual llamado **Memo el Forjador**, que responde preguntas de entrenamiento, nutrición deportiva y psicología básica del deporte. La IA genera planes de entrenamiento personalizados (y planes alimenticios en Premium) a partir del perfil, objetivos y datos corporales del usuario.

### Objetivos de negocio

- Monetización freemium: plan gratuito con límites, plan premium mensual/anual vía Stripe.
- Retención por personalización: la IA conoce el perfil del usuario y adapta todo a sus metas.
- Escalabilidad: arquitectura serverless (Supabase + Edge Functions) sin servidor dedicado.

### Qué puede hacer el usuario

| Feature | Free | Premium |
|---|---|---|
| Chat con coach IA (Memo) | 20 msg/día | Ilimitado |
| Plan de entrenamiento IA | 1/mes | Ilimitado |
| Modificaciones al plan | 3/mes | Ilimitadas |
| Plan alimenticio IA | ✗ | ✓ |
| Historial corporal | 14 días | Completo |
| Progreso y métricas | Básico | Completo |

---

## 2. Stack Tecnológico

### App móvil (cliente)

| Tecnología | Versión | Rol |
|---|---|---|
| React Native | 0.85.3 | Framework UI nativo |
| Expo | ~56.0.12 | Toolchain, builds, APIs nativas |
| Expo Router | ^56.2.11 | Navegación file-based (similar a Next.js) |
| TypeScript | ~6.0.3 | Tipado estático |
| NativeWind | ^4.2.6 | TailwindCSS para React Native |
| TailwindCSS | ^4.3.1 | Utilidades de estilos |
| Zustand | ^5.0.14 | State management global (stores) |
| TanStack React Query | ^5.101.1 | Cache de datos servidor + sincronización |
| Supabase JS | ^2.108.2 | Cliente DB + Auth + Storage |
| Shopify Skia | ^2.6.7 | Gráficas de progreso (canvas nativo) |
| React Native Reanimated | ^4.5.0 | Animaciones fluidas |
| React Native Bottom Sheet | ^1.0.3 | Sheets modales (paywall, upgrade) |
| i18next + react-i18next | ^26 / ^17 | Internacionalización |
| expo-notifications | ^56.0.18 | Push notifications |
| expo-secure-store | ^56.0.4 | Token JWT almacenado seguro |

### Backend (serverless)

| Tecnología | Rol |
|---|---|
| Supabase | BaaS: PostgreSQL + Auth + Storage + Edge Functions |
| Deno (runtime) | Runtime de las Edge Functions |
| PostgreSQL | Base de datos relacional con RLS |
| Anthropic API (Claude) | Modelos de IA para chat y generación de planes |
| Stripe | Pagos y suscripciones |

### Fuentes tipográficas

- **Space Grotesk** — títulos y headings
- **Inter** — cuerpo de texto, labels, botones
- **JetBrains Mono** — números (peso, streak, estadísticas)

---

## 3. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTE (React Native)                      │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Zustand │  │  React   │  │ Expo     │  │ NativeWind +   │  │
│  │  Stores  │  │  Query   │  │ Router   │  │ TailwindCSS    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────────────┘  │
│       └─────────────┴─────────────┘                              │
│                        │                                          │
└────────────────────────┼──────────────────────────────────────────┘
                         │ HTTPS / JWT
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                   │
│                                                                   │
│  ┌──────────────┐  ┌────────────────────────────────────────┐   │
│  │  Auth (JWT)  │  │           Edge Functions (Deno)         │   │
│  │  + RLS       │  │  ┌──────────┐  ┌──────────────────┐   │   │
│  └──────────────┘  │  │  /chat   │  │ /generate-plan   │   │   │
│                     │  └────┬─────┘  └────────┬─────────┘   │   │
│  ┌──────────────┐  │       │                  │              │   │
│  │  PostgreSQL  │  │  ┌────▼──────────────────▼──────────┐  │   │
│  │  (10 tablas) │◄─┼──│   Supabase DB Client (con JWT)   │  │   │
│  └──────────────┘  │  └─────────────────────────────────-┘  │   │
│                     └────────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                    ┌───────────────┴────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐         ┌─────────────────┐
          │ Anthropic API   │         │   Stripe API    │
          │ Claude Haiku    │         │   Webhooks      │
          │ Claude Sonnet   │         │   Subscriptions │
          └─────────────────┘         └─────────────────┘
```

### Flujo de datos principal

1. El usuario abre la app → Expo Router determina la ruta inicial.
2. `AuthGuard` en el root layout consulta la sesión de Supabase Auth.
3. Si hay sesión, lee el perfil (`profiles`) para saber si completó onboarding.
4. Redirige al flujo correcto: onboarding / pantalla principal.
5. Las pantallas usan hooks (`useProfile`, `useWorkoutPlan`, etc.) que van a React Query.
6. React Query hace llamadas directas a Supabase o invoca Edge Functions.
7. Las Edge Functions validan el JWT, verifican permisos y llaman a Anthropic/Stripe.

---

## 4. Base de Datos — Esquema PostgreSQL

Migraciones en `supabase/migrations/`.

### Tablas

#### `profiles`
Extiende `auth.users` de Supabase. Se crea automáticamente al registrarse vía trigger.

```sql
profiles (
  id            UUID PRIMARY KEY  -- FK a auth.users
  display_name  TEXT
  avatar_url    TEXT
  language      TEXT DEFAULT 'es-MX'
  onboarding_completed BOOLEAN DEFAULT FALSE
  expo_push_token TEXT             -- Token para push notifications
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ        -- Auto-actualizado por trigger
)
```

**Por qué**: Supabase no permite extender `auth.users` directamente. `profiles` es la extensión pública del usuario con datos de la app.

---

#### `body_data`
Historial de mediciones corporales. Cada registro es un snapshot en el tiempo.

```sql
body_data (
  id            UUID PRIMARY KEY
  user_id       UUID → profiles
  weight_kg     DECIMAL(5,2)
  height_cm     DECIMAL(5,2)
  age           INTEGER
  gender        TEXT  -- 'male' | 'female' | 'other' | 'prefer_not_to_say'
  activity_level TEXT -- 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  body_fat_pct  DECIMAL(4,2)
  muscle_mass_kg DECIMAL(5,2)
  bone_density  DECIMAL(4,3)
  recorded_at   TIMESTAMPTZ
)
-- Índice: (user_id, recorded_at DESC)
```

**Por qué historial en lugar de sobrescribir**: para mostrar gráficas de progreso en el tiempo (peso, grasa corporal, etc.).

---

#### `goals`
Objetivos de fitness activos del usuario. Puede haber varios pero solo uno activo (`is_active = true`).

```sql
goals (
  id            UUID PRIMARY KEY
  user_id       UUID → profiles
  type          TEXT  -- 'weight_loss' | 'muscle_gain' | 'recomposition' | 'powerlifting' | 'sport_specific' | 'general_fitness'
  target_weight_kg DECIMAL(5,2)
  target_date   DATE
  mode          TEXT  -- 'flexible' | 'strict'
  sport_type    TEXT  -- solo cuando type = 'sport_specific'
  fitness_level TEXT  -- 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite'
  is_active     BOOLEAN DEFAULT TRUE
  created_at    TIMESTAMPTZ
)
```

**Por qué**: la IA necesita el objetivo activo para personalizar tanto el chat como la generación de planes. El `fitness_level` determina la intensidad del plan generado.

---

#### `conversations`
Historial completo del chat con el coach IA. Cada mensaje (usuario y asistente) es una fila.

```sql
conversations (
  id         UUID PRIMARY KEY
  user_id    UUID → profiles
  role       TEXT  -- 'user' | 'assistant'
  content    TEXT
  model_used TEXT  -- 'claude-haiku-4-5-20251001'
  tokens_used INTEGER
  created_at TIMESTAMPTZ
)
-- Índice: (user_id, created_at DESC)
```

**Por qué separar en filas**: permite hacer queries de historial por fecha, calcular tokens consumidos, y en el futuro hacer análisis de conversaciones.

---

#### `daily_message_count`
Contador de mensajes enviados por día para el límite del plan free.

```sql
daily_message_count (
  id      UUID PRIMARY KEY
  user_id UUID → profiles
  date    DATE DEFAULT CURRENT_DATE
  count   INTEGER DEFAULT 0
  UNIQUE(user_id, date)
)
```

**Por qué una tabla separada**: el upsert atómico (`ON CONFLICT DO UPDATE SET count = count + 1`) garantiza que no haya race conditions en el conteo, incluso con múltiples requests concurrentes.

**Función auxiliar** (`0002_chat_helpers.sql`):
```sql
increment_daily_message_count(p_user_id, p_date)  -- upsert atómico
get_daily_message_count(p_user_id)                 -- lectura del conteo hoy
```

---

#### `workout_plans`
Planes de entrenamiento generados por IA. El schedule completo se guarda como JSONB.

```sql
workout_plans (
  id                UUID PRIMARY KEY
  user_id           UUID → profiles
  title             TEXT
  description       TEXT
  schedule          JSONB  -- array de 7 días con ejercicios detallados
  generated_by      TEXT DEFAULT 'claude-sonnet-4-6'
  is_active         BOOLEAN DEFAULT TRUE
  modifications_count INTEGER DEFAULT 0
  plan_month        DATE   -- DATE_TRUNC('month', now())
  created_at        TIMESTAMPTZ
)
```

**Estructura del JSONB `schedule`**:
```json
[
  {
    "day_number": 1,
    "day_name": "Lunes",
    "is_rest": false,
    "focus": "Push - Pecho, Hombros, Tríceps",
    "estimated_duration_minutes": 60,
    "exercises": [
      {
        "order": 1,
        "name": "Press de banca con barra",
        "muscle_group": "Pecho",
        "sets": 4,
        "reps": "8-10",
        "rest_seconds": 90,
        "technique_notes": "Control excéntrico de 2-3 segundos"
      }
    ]
  }
]
```

**Por qué JSONB para schedule**: la estructura del plan tiene profundidad variable (días, ejercicios, notas). JSONB permite guardarlo sin necesidad de tablas relacionales adicionales (`workout_days`, `exercises`), simplificando las queries y la lógica de actualización.

---

#### `meal_plans`
Planes alimenticios (Premium). Estructura similar a workout_plans.

```sql
meal_plans (
  id             UUID PRIMARY KEY
  user_id        UUID → profiles
  title          TEXT
  daily_calories INTEGER
  macros         JSONB  -- { protein_g, carbs_g, fat_g }
  meals          JSONB  -- comidas del día con ingredientes
  generated_by   TEXT DEFAULT 'claude-sonnet-4-6'
  is_active      BOOLEAN DEFAULT TRUE
  created_at     TIMESTAMPTZ
)
```

---

#### `subscriptions`
Estado de suscripción sincronizado desde Stripe. Un usuario tiene exactamente una fila.

```sql
subscriptions (
  id                     UUID PRIMARY KEY
  user_id                UUID → profiles UNIQUE
  stripe_customer_id     TEXT UNIQUE
  stripe_subscription_id TEXT UNIQUE
  plan                   TEXT  -- 'free' | 'premium'
  status                 TEXT  -- 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_end     TIMESTAMPTZ
  created_at             TIMESTAMPTZ
  updated_at             TIMESTAMPTZ
)
```

**Por qué**: la fuente de verdad de pagos es Stripe. Supabase solo guarda el estado actual para que el app pueda consultarlo sin ir a Stripe en cada request. El webhook de Stripe actualiza esta tabla en tiempo real.

---

#### `notifications`
Notificaciones push enviadas al usuario.

```sql
notifications (
  id      UUID PRIMARY KEY
  user_id UUID → profiles
  type    TEXT  -- 'missed_workout' | 'diet_alert' | 'progress_update' | 'goal_milestone' | 'plan_ready'
  title   TEXT
  body    TEXT
  read    BOOLEAN DEFAULT FALSE
  sent_at TIMESTAMPTZ
)
```

---

#### `async_jobs`
Tracking de jobs en background (generación de planes).

```sql
async_jobs (
  id           UUID PRIMARY KEY
  user_id      UUID → profiles
  type         TEXT  -- 'generate_workout_plan' | 'generate_meal_plan'
  status       TEXT  -- 'pending' | 'processing' | 'completed' | 'failed'
  result       JSONB -- { plan_id: UUID } cuando completed
  error        TEXT  -- mensaje de error cuando failed
  created_at   TIMESTAMPTZ
  completed_at TIMESTAMPTZ
)
```

**Por qué**: la generación de planes con Claude Sonnet puede tardar 5-15 segundos. El job permite al cliente hacer polling del estado sin bloquear la UI, y evita re-disparar la generación si ya hay una en curso.

### Triggers automáticos

```sql
-- Al crear usuario: crea perfil y suscripción free automáticamente
on_auth_user_created → handle_new_user()

-- Al actualizar: mantiene updated_at al día
profiles_updated_at → update_updated_at()
subscriptions_updated_at → update_updated_at()
```

### Row Level Security (RLS)

**Todas** las tablas tienen RLS habilitado. La política universal es:
```sql
USING (auth.uid() = user_id)
```
Esto garantiza que un usuario solo puede leer y escribir sus propios datos, incluso si hay un bug en el código del cliente.

---

## 5. Autenticación y Seguridad

### Flujo de autenticación

```
App abre
    │
    ▼
RootLayout: AuthGuard
    │
    ├── supabase.auth.getSession()  → obtiene sesión persistida en AsyncStorage
    │
    ├── onAuthStateChange()         → escucha cambios de sesión en tiempo real
    │
    └── Redirige según estado:
        ├── Sin sesión            → /(auth)/login
        ├── Sesión + sin onboarding → /(auth)/onboarding/step-1-goals
        └── Sesión + onboarding OK  → /(app)
```

### Almacenamiento del token

El JWT de Supabase se guarda en `AsyncStorage` (no en memoria) para persistir entre reinicios de la app. Esto lo configura `createClient` con `auth: { storage: AsyncStorage, persistSession: true }`.

### Autenticación en Edge Functions

Cada Edge Function recibe el header `Authorization: Bearer <jwt>` del cliente. La función crea un cliente Supabase **con ese JWT** (no con la service key), de modo que todas las queries a DB heredan el contexto de autenticación y las políticas RLS se aplican automáticamente.

```ts
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await supabase.auth.getUser(); // valida el JWT
```

**Por qué esto en lugar de la service key**: usar la service key en edge functions bypass RLS y es un riesgo de seguridad si hay un bug de autorización en el código.

### CORS

Las Edge Functions tienen CORS headers para aceptar requests del cliente móvil. En producción se debería restringir `Access-Control-Allow-Origin` al dominio de la app, pero durante desarrollo se usa `*`.

---

## 6. Backend — Supabase Edge Functions

Las funciones viven en `supabase/functions/` y corren en Deno. Se despliegan con `supabase functions deploy`.

### `/functions/chat` — Coach IA en tiempo real

**Propósito**: recibe un mensaje del usuario, valida límites, llama a Claude Haiku con streaming SSE y devuelve la respuesta en tiempo real.

**Flujo**:
1. Valida JWT → obtiene `user.id`
2. Verifica suscripción y conteo diario **en paralelo** (`Promise.all`)
3. Si free y conteo ≥ 20 → devuelve `429 daily_limit_reached`
4. Guarda el mensaje del usuario en `conversations`
5. Construye el array `messages` con los últimos 10 mensajes del historial (pasados desde el cliente)
6. Llama a Claude Haiku con `stream: true` y prompt caching en el system prompt
7. Hace proxy del SSE de Anthropic → cliente (re-emite cada `delta` de texto)
8. Al terminar el stream: guarda la respuesta del asistente + incrementa contador **en paralelo**

**Por qué streaming SSE**: la respuesta del coach aparece palabra por palabra en la UI, lo que da sensación de velocidad y naturalidad. Sin streaming el usuario esperaría varios segundos viendo nada.

**Por qué prompt caching**: el system prompt de Memo el Forjador tiene ~1500 tokens. Con `cache_control: { type: 'ephemeral' }`, Anthropic cachea el prompt hasta 5 minutos, reduciendo el costo de input tokens en ~90% para conversaciones frecuentes.

**Modelo**: `claude-haiku-4-5-20251001` — el más rápido y económico de la familia Claude. Ideal para chat en tiempo real.

---

### `/functions/generate-plan` — Generación de plan de entrenamiento

**Propósito**: genera un plan de entrenamiento semanal personalizado usando Claude Sonnet.

**Flujo**:
1. Valida JWT
2. Verifica suscripción + cuenta planes del mes + job activo **en paralelo**
3. Si free y ya tiene 1 plan este mes → `429 monthly_plan_limit_reached`
4. Si hay un job en proceso → `409 generation_in_progress`
5. Lee el objetivo activo y los datos corporales del usuario **en paralelo**
6. Crea un `async_job` con `status: 'processing'`
7. Construye el prompt detallado con `buildPlanPrompt()`
8. Llama a Claude Sonnet (sin streaming, espera la respuesta completa)
9. Parsea el JSON de la respuesta (con `regex` por si Claude agrega texto extra)
10. Desactiva el plan activo anterior, guarda el nuevo plan
11. Actualiza el `async_job` a `status: 'completed'`
12. Devuelve `{ job_id, plan_id, plan }`

**Modelo**: `claude-sonnet-4-6` — más inteligente que Haiku, ideal para razonamiento estructurado y generación de JSON complejo.

**Por qué async_job si la función es síncrona**: el job sirve para:
- Bloquear generaciones duplicadas (`409` si ya hay uno en proceso)
- Dar al cliente un ID de job para hacer polling si el request falla
- Guardar errores con contexto para debug

**Estructura del prompt**: `buildPlanPrompt()` inyecta todos los datos del usuario y especifica el formato JSON exacto que debe devolver Claude. El prompt termina con `"Responde ÚNICAMENTE con un objeto JSON válido"` para minimizar texto extra.

---

### `/functions/plan-worker` — Worker async

> **Estado**: archivo creado, implementación pendiente (Paso 8+).

Worker para procesamiento en background de generación de planes. Permitirá desacoplar el request HTTP de la ejecución larga cuando la generación de planes alimenticios se implemente.

---

### `/functions/stripe-webhook` — Webhooks de Stripe

> **Estado**: archivo creado, implementación pendiente (Paso 10).

**Propósito planificado**: recibir eventos de Stripe (`customer.subscription.updated`, `customer.subscription.deleted`, etc.) y sincronizar el estado en la tabla `subscriptions`.

**Diseño de seguridad**: validará la firma del webhook con `STRIPE_WEBHOOK_SECRET` antes de procesar cualquier evento. La tabla `subscriptions` en DB ya está preparada para recibir estos datos.

---

## 7. Integración con IA — Claude (Anthropic)

### Persona: Memo el Forjador

El system prompt define la personalidad y scope del coach:

- **Nombre**: Memo el Forjador
- **Idioma**: responde siempre en el idioma del usuario
- **Especialidad exclusiva**: entrenamiento, rutinas, nutrición deportiva, psicología básica del deporte
- **Fuera de scope**: cualquier otro tema (tecnología, política, finanzas, etc.) → respuesta estándar de redirección

El prompt incluye instrucciones explícitas para la **primera interacción** (recoge datos del usuario de forma conversacional) y para **límites de derivación** (si la situación emocional es compleja, deriva a un psicólogo).

### Modelos utilizados

| Uso | Modelo | Por qué |
|---|---|---|
| Chat en tiempo real | `claude-haiku-4-5-20251001` | Rápido, económico, suficiente para conversación |
| Generación de planes | `claude-sonnet-4-6` | Razonamiento estructurado, JSON complejo |

### Prompt Caching

El system prompt del chat usa `cache_control: { type: 'ephemeral' }`. Anthropic mantiene el cache hasta 5 minutos. Si el mismo system prompt se reutiliza dentro de esa ventana, solo se cobran los tokens de salida. Para un coach con alta frecuencia de uso, el ahorro es significativo.

### Contexto de conversación

La Edge Function de chat recibe el historial desde el cliente (últimos N mensajes). Usa los **últimos 10** para construir el contexto de Claude. Esto es un balance entre coherencia de conversación y costo de tokens.

El historial completo persiste en `conversations` en DB para referencia futura, pero la ventana de contexto enviada a la IA es de 10 mensajes.

---

## 8. Integración de Pagos — Stripe

> **Estado**: la integración de Stripe está diseñada y la tabla `subscriptions` está lista en DB. La implementación de `lib/stripe.ts` y `/functions/stripe-webhook` está pendiente (Paso 10).

### Flujo de suscripción (diseñado)

```
Usuario toca "Upgrade a Premium"
    │
    ▼
UpgradeSheet.tsx (componente bottom sheet)
    │
    ▼
lib/stripe.ts → inicia Stripe Checkout (web o nativo)  ← pendiente
    │
    ▼
Stripe procesa el pago
    │
    ▼
Stripe → Webhook → /functions/stripe-webhook           ← pendiente
    │
    ▼
Actualiza subscriptions (plan = 'premium', status = 'active')
    │
    ▼
Cliente: useSubscription() invalida cache → UI se actualiza
```

### Estado de la suscripción en la app

`useSubscription()` y `useIsPremium()` consultan la tabla `subscriptions` via React Query (cache 5 min). La verificación de premium es:

```ts
plan === 'premium' && status === 'active' && current_period_end > now()
```

La misma verificación ocurre en las Edge Functions para cada request, garantizando que los límites se apliquen server-side y no solo en el cliente.

---

## 9. Frontend — Navegación y Rutas

Expo Router usa **file-based routing** (igual que Next.js App Router). La estructura de carpetas define las rutas.

### Árbol de rutas

```
app/
├── _layout.tsx                    ← Root layout (fuentes, QueryClient, AuthGuard)
│
├── (auth)/                        ← Grupo sin tab navigation
│   ├── _layout.tsx                ← Stack navigator para auth
│   ├── login.tsx                  → /login
│   ├── register.tsx               → /register
│   ├── forgot-password.tsx        → /forgot-password
│   └── onboarding/
│       ├── _layout.tsx            ← Stack navigator para onboarding
│       ├── step-1-goals.tsx       → /onboarding/step-1-goals
│       ├── step-2-body.tsx        → /onboarding/step-2-body
│       └── step-3-level.tsx       → /onboarding/step-3-level
│
└── (app)/                         ← Grupo con tab navigation (requiere auth)
    ├── _layout.tsx                ← Tabs navigator (5 tabs)
    ├── index.tsx                  → / (Home — entrenamiento de hoy)
    ├── chat.tsx                   → /chat (Coach IA)
    ├── progress.tsx               → /progress (Progreso corporal)
    ├── profile.tsx                → /profile (Perfil y configuración)
    └── plans/
        ├── _layout.tsx            ← Stack navigator para planes
        ├── index.tsx              → /plans (Listado de planes)
        ├── workout/
        │   ├── index.tsx          → /plans/workout
        │   └── [id].tsx           → /plans/workout/:id (detalle)
        └── meal/
            ├── index.tsx          → /plans/meal
            └── [id].tsx           → /plans/meal/:id (detalle)
```

### Grupos de rutas `(auth)` y `(app)`

Los paréntesis en los nombres de carpeta crean **grupos** que no aparecen en la URL. Sirven para compartir un layout sin afectar la ruta.

### AuthGuard

`AuthGuard` es un componente que vive dentro del root layout y no renderiza nada (solo side effects). Escucha cambios de sesión y redirige:

```
Sin sesión      → /(auth)/login
Sesión + sin onboarding → /(auth)/onboarding/step-1-goals
Sesión + onboarding OK  → /(app)
```

**Por qué un componente separado y no lógica en el layout**: Expo Router requiere que el layout renderice `<Stack>` o `<Tabs>` directamente. La lógica de redirect debe estar en un componente hijo para no interferir con el render del navigator.

---

## 10. Frontend — Pantallas

### Home (`app/(app)/index.tsx`)
Pantalla de inicio del usuario autenticado. Muestra:
- Saludo con nombre + hora del día
- Streak de días consecutivos entrenando (badge con fuego)
- Entrenamiento de hoy (extraído del plan activo según el día de la semana)
- Stats rápidas: último peso registrado + objetivo activo
- CTA para abrir el chat con el coach

**Lógica de "entrenamiento de hoy"**: busca en `plan.schedule` (JSONB) el día cuyo `day_name` coincide con el nombre del día actual en español. Si no hay match (día de descanso), muestra "Día de descanso 💤".

### Chat (`app/(app)/chat.tsx`)
Pantalla del coach IA, completamente implementada.

- **Header**: muestra "Memo el Forjador" + "Tu coach de IA · Forja" en verde
- **Estado vacío** (`EmptyState`): cuando no hay mensajes, muestra emoji + texto de bienvenida invitando al usuario a contar su objetivo
- **Lista de mensajes** (`FlatList`): renderiza `ChatBubble` por cada mensaje. Auto-scroll al final cuando llegan mensajes nuevos (con delay de 50ms para respetar el layout) y durante streaming con `onContentSizeChange`
- **Teclado**: `KeyboardAvoidingView` con `behavior: 'padding'` en iOS y `'height'` en Android
- **Límite de mensajes**: `MessageLimitBanner` aparece cuando `dailyCount` está a 5 o menos del límite (aviso amarillo) o cuando `limitReached` es `true` (banner rojo con CTA a Premium)
- **Input**: `ChatInput` fijo al fondo, deshabilitado cuando `isLoading` o `limitReached`

### Plans (`app/(app)/plans/`)
Sección de planes de entrenamiento y alimentación. Incluye:
- Listado de planes disponibles
- Detalle de plan de entrenamiento: desglose por día y ejercicios
- Detalle de plan alimenticio (Premium): macros y comidas del día

### Progress (`app/(app)/progress.tsx`)
Pantalla de seguimiento corporal. Permite registrar mediciones (peso, grasa corporal, etc.) y muestra:
- Gráfica de evolución del peso (Skia)
- Formulario de nueva medición (`MeasurementForm`)
- Progreso hacia el objetivo (`GoalProgress`)

### Profile (`app/(app)/profile.tsx`)
Configuración del usuario: datos del perfil, suscripción, idioma, y opción de cerrar sesión.

### Onboarding (3 pasos)

**Paso 1 — Objetivos** (`step-1-goals.tsx`)
Selección del tipo de objetivo. Opciones: Bajar de peso, Ganar músculo, Recomposición, Powerlifting, Deporte específico, Fitness general. Se guarda en `useOnboardingStore`.

**Paso 2 — Datos corporales** (`step-2-body.tsx`)
Peso, altura, edad, género, nivel de actividad. Se guarda en `useOnboardingStore`.

**Paso 3 — Nivel y modalidad** (`step-3-level.tsx`)
Nivel de fitness (casual → élite) y modalidad (flexible / estricto). Al confirmar, guarda todo en Supabase: inserta en `goals`, `body_data`, y actualiza `profiles.onboarding_completed = true`.

---

## 11. Frontend — Componentes UI

### `components/ui/` — Primitivos reutilizables

| Componente | Propósito |
|---|---|
| `Button` | Botón con variantes (primary, outline, ghost) y estado de loading |
| `Card` | Contenedor con fondo `surface`, bordes redondeados y padding |
| `Input` | Campo de texto estilizado con soporte para dark theme |
| `Badge` | Etiqueta pequeña con variantes (primary, muted, warning) |
| `Avatar` | Imagen de perfil circular con fallback a iniciales |
| `ProgressBar` | Barra de progreso animada con porcentaje |
| `Sheet` | Bottom sheet wrapper sobre `react-native-bottom-sheet` |
| `Skeleton` | Placeholder animado para loading states |

### `components/chat/`

| Componente | Propósito |
|---|---|
| `ChatBubble` | Burbuja de mensaje (usuario o asistente) con estilos diferenciados |
| `ChatInput` | Input fijo al fondo con botón enviar y stop streaming |
| `MessageLimitBanner` | Banner que aparece cuando el usuario free alcanza el límite diario |
| `StreamingText` | Renderiza texto que llega fragmento a fragmento (cursor parpadeante) |

### `components/plans/`

| Componente | Propósito |
|---|---|
| `WorkoutPlanCard` | Card resumen de plan de entrenamiento |
| `ExerciseItem` | Fila de ejercicio con sets, reps, descanso y notas |
| `MealPlanCard` | Card resumen de plan alimenticio |
| `MacroBar` | Barra visual de distribución de macronutrientes |
| `PlanGenerating` | Pantalla de espera mientras se genera el plan (animación) |

### `components/premium/`

| Componente | Propósito |
|---|---|
| `PaywallBanner` | Banner contextual que aparece cuando el usuario free intenta acceder a una feature premium |
| `UpgradeSheet` | Bottom sheet con detalles del plan premium y botón de compra |

### `components/progress/`

| Componente | Propósito |
|---|---|
| `WeightChart` | Gráfica de evolución del peso usando Skia (canvas nativo) |
| `GoalProgress` | Visualización del progreso hacia el objetivo (peso actual vs meta) |
| `MeasurementForm` | Formulario para registrar nuevas mediciones corporales |

---

## 12. State Management

Zustand para estado global del cliente. React Query para estado de servidor (cache).

### Stores (Zustand)

#### `store/auth.store.ts`
```ts
{
  session: Session | null   // JWT de Supabase
  user: User | null         // datos del usuario de auth
  isLoading: boolean        // true mientras resuelve sesión inicial
  setSession(session)
  setIsLoading(isLoading)
}
```

**Por qué Zustand y no Context**: evita re-renders en componentes que no consumen el store. El acceso es directo sin providers adicionales.

#### `store/onboarding.store.ts`
```ts
{
  // Paso 1
  goalType: GoalType | null
  targetWeightKg: number | null
  // Paso 2
  weightKg, heightCm, age, gender, activityLevel
  // Paso 3
  fitnessLevel: FitnessLevel | null
  mode: 'flexible' | 'strict'
  // Actions
  setStep1(data), setStep2(data), setStep3(data), reset()
}
```

**Por qué store temporal**: el onboarding es un flujo multi-paso. El store acumula los datos de los 3 pasos antes de hacer el insert final a Supabase. Se resetea al completar.

#### `store/profile.store.ts`
```ts
{
  onboardingCompleted: boolean | null
  displayName: string | null
  setOnboardingCompleted(v), setDisplayName(v)
}
```

#### `store/subscription.store.ts`
Estado local de la suscripción para acceso síncrono sin async (complementa `useSubscription`).

### React Query

Usado para todos los datos que vienen de Supabase: planes, perfil, mediciones, etc. Configuración global:
```ts
defaultOptions: {
  queries: { staleTime: 5 * 60 * 1000, retry: 1 }
}
```

`staleTime: 5min` evita re-fetches innecesarios en navegación entre tabs. `retry: 1` reintenta una vez ante errores de red.

---

## 13. Hooks de Datos

Los hooks abstraen la lógica de fetching y mutación. Usan React Query internamente.

| Hook | Fuente | Propósito |
|---|---|---|
| `useProfile()` | Supabase `profiles` | Datos de perfil del usuario autenticado |
| `useActiveGoal()` | Supabase `goals` | Objetivo activo actual |
| `useActiveWorkoutPlan()` | Supabase `workout_plans` | Plan de entrenamiento activo |
| `useWorkoutPlans()` | Supabase `workout_plans` | Historial de todos los planes |
| `useDeactivateWorkoutPlan()` | Mutation | Desactiva un plan específico |
| `useMealPlan()` | Supabase `meal_plans` | Plan alimenticio activo (Premium) |
| `useLatestBodyData()` | Supabase `body_data` | Última medición corporal |
| `useBodyHistory()` | Supabase `body_data` | Historial para gráfica de progreso |
| `useStreak()` | Supabase / lógica local | Días consecutivos de entrenamiento |
| `useSubscription()` | Supabase `subscriptions` | Estado de suscripción |
| `useIsPremium()` | Derivado de useSubscription | Booleano: ¿es usuario premium? |
| `useAsyncJob(jobId)` | Supabase `async_jobs` | Polling del estado de un job en background |
| `useChat()` | Edge Function `/chat` | Streaming chat con el coach IA |

### `useChat` — Detalles de implementación

```ts
{
  messages: ChatMessage[]     // historial en memoria de la sesión
  isLoading: boolean          // true mientras espera respuesta o hace stream
  dailyCount: number          // contador de mensajes hoy
  limitReached: boolean       // true si el usuario free alcanzó el límite
  sendMessage(text)           // envía mensaje + inicia streaming
  stopStreaming()             // aborta el stream actual (AbortController)
  clearMessages()             // limpia el historial de pantalla
}
```

El hook usa un `AbortController` para permitir cancelar el stream si el usuario navega fuera del chat o toca "stop".

---

## 14. Sistema de Diseño

### Paleta de colores (`constants/colors.ts`)

```ts
{
  background:      '#0A0A0F',   // fondo principal (casi negro)
  surface:         '#13131C',   // cards, inputs
  surfaceElevated: '#1E1E2E',   // modales, sheets
  primary:         '#22C55E',   // verde — color de marca, CTAs
  primaryDim:      '#166534',   // verde oscuro — fondos de cards activas
  accent:          '#818CF8',   // índigo — elementos secundarios
  text:            '#F1F5F9',   // texto principal
  textMuted:       '#64748B',   // texto secundario, labels, placeholders
  border:          '#1E293B',   // bordes de cards e inputs
  destructive:     '#EF4444',   // rojo — acciones de borrado, errores
  warning:         '#F59E0B',   // ámbar — alertas, streak
  success:         '#22C55E',   // mismo que primary
}
```

**Filosofía**: dark theme profundo (no gris, sino casi negro con tinte azul). El verde primario da energía y vitalidad, coherente con el contexto de fitness. Todos los colores tienen suficiente contraste para cumplir WCAG AA.

### Tipografía (`constants/typography.ts`)

- `SpaceGrotesk-Regular / SemiBold / Bold` → headings y títulos de sección
- `Inter-Regular / Medium` → cuerpo, labels, botones
- `JetBrainsMono-Regular / Medium` → números (peso, streak, estadísticas)

**Por qué JetBrains Mono para números**: los números en fuente monoespaciada no "saltan" visualmente cuando cambian de dígitos (ej: "9" → "10"). Mejora la legibilidad en contextos de métricas.

### Clases NativeWind

El proyecto usa NativeWind v4 con TailwindCSS v4. Se configura en `global.css` y `metro.config.js`. Las clases de Tailwind se escriben directamente en el prop `className` de los componentes React Native.

Colores personalizados definidos en `global.css` y referenciables como `bg-background`, `text-text-muted`, `border-border`, etc.

---

## 15. Internacionalización (i18n)

Implementada con `i18next` + `react-i18next`. El idioma por defecto es `es-MX` (México).

### Estructura de archivos

```
locales/
├── es-MX/
│   ├── common.json      → textos generales (botones, errores comunes)
│   ├── onboarding.json  → textos del flujo de onboarding
│   ├── chat.json        → textos de la pantalla de chat
│   ├── plans.json       → textos de planes de entrenamiento y alimentación
│   └── progress.json    → textos de la pantalla de progreso
└── en/
    └── common.json      → textos en inglés (para expansión futura)
```

### Configuración (`lib/i18n.ts`)

Detecta el idioma del dispositivo con `expo-localization`. Cae a `es-MX` si el idioma detectado no tiene traducción disponible.

El idioma preferido del usuario se guarda en `profiles.language` para mantener consistencia entre dispositivos.

---

## 16. Límites Free vs Premium

Los límites se verifican en **dos lugares**:

1. **Cliente** (`lib/limits.ts`): para mostrar la UI correcta antes de llamar al servidor.
2. **Servidor** (Edge Functions): para garantizar los límites incluso si el cliente es modificado.

```ts
// lib/limits.ts
export const FREE_LIMITS = {
  MESSAGES_PER_DAY: 20,
  WORKOUT_PLANS_PER_MONTH: 1,
  WORKOUT_PLAN_MODIFICATIONS_PER_MONTH: 3,
  BODY_HISTORY_DAYS: 14,
}
```

### Cómo se aplica cada límite

| Límite | Verificación cliente | Verificación servidor |
|---|---|---|
| Mensajes/día | `useChat`: `limitReached` flag | Edge Function `/chat`: `get_daily_message_count()` |
| Planes/mes | `useIsPremium()` + conteo | Edge Function `/generate-plan`: count query |
| Historial corporal | `useBodyHistory`: limita el rango de fechas | Query con `LIMIT` o `WHERE recorded_at > now() - 14 days` |
| Plan alimenticio | `useIsPremium()` | Edge Function: check suscripción |

### UX de los límites

Cuando el usuario free llega a un límite:
- En el chat: aparece `MessageLimitBanner` con CTA a upgrade
- En otras features: aparece `PaywallBanner` o `UpgradeSheet` automáticamente

---

## 17. Notificaciones Push

> **Estado**: la infraestructura de DB está lista (`notifications` table + `expo_push_token` en `profiles`). La implementación de `lib/notifications.ts` está pendiente (Paso 11).

Diseñadas con `expo-notifications`. El token del dispositivo (`expo_push_token`) se guardará en `profiles` al iniciar sesión.

### Tipos de notificaciones

| Tipo | Cuándo |
|---|---|
| `missed_workout` | El usuario no registró actividad en un día de entrenamiento programado |
| `diet_alert` | Recordatorio de registro de comidas (Premium) |
| `progress_update` | Resumen semanal de progreso |
| `goal_milestone` | El usuario alcanza un hito (ej: primer kilo perdido) |
| `plan_ready` | El plan de entrenamiento o alimentación terminó de generarse |

Las notificaciones se guardan en la tabla `notifications` para poder mostrarlas en-app aunque el usuario no las vio como push.

---

## 18. Load Testing

Script de k6 en `load-tests/k6-chat-simulation.js` para simular múltiples usuarios enviando mensajes al chat simultáneamente.

**Propósito**: verificar que la Edge Function de chat escala bajo carga y que el sistema de rate limiting funciona correctamente con concurrencia.

---

## 19. Variables de Entorno

### Cliente (`.env.local` en `forja/`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

El prefijo `EXPO_PUBLIC_` es requerido por Expo para exponer variables al bundle del cliente.

### Servidor (`.env` en `forja/supabase/`)

```env
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Las variables de las Edge Functions se configuran con `supabase secrets set` y están disponibles vía `Deno.env.get()`.

---

## 20. Pasos de Construcción — Historial y Próximos

### Completados (Pasos 1–8)

| Paso | Descripción |
|---|---|
| 1 | **Scaffolding**: Expo + TypeScript + NativeWind + todas las deps, estructura de directorios, babel/metro/tailwind configurados |
| 2 | **Base de datos**: 10 tablas con RLS + triggers automáticos, tipos TypeScript generados, `lib/supabase.ts` con AsyncStorage |
| 3 | **Autenticación**: login, register, forgot-password, AuthGuard en root layout, Zustand auth store |
| 4 | **Onboarding**: 3 pasos (objetivo → cuerpo → nivel/modalidad), guarda en `goals` + `body_data`, marca `onboarding_completed = true` |
| 5 | **Design System**: Button, Card, Input, Badge, ProgressBar, Skeleton, Avatar, Sheet. Fuentes: Space Grotesk + Inter + JetBrains Mono |
| 6 | **Dashboard (Home)**: pantalla Home completa con datos reales, tab bar con Ionicons (5 tabs). Hooks: useProfile, useActiveGoal, useActiveWorkoutPlan, useLatestBodyData, useStreak, useSubscription, useAsyncJob |
| 7 | **Chat con IA (Memo el Forjador)**: Edge Function con streaming SSE, Claude Haiku + Prompt Caching, rate limit 20 msg/día. UI completa: ChatBubble, ChatInput, StreamingText, MessageLimitBanner, hook useChat, pantalla chat.tsx con auto-scroll. Integración Anthropic verificada end-to-end |
| 8 | **Planes de entrenamiento**: Edge Function `generate-plan` llama a Claude Sonnet sincrónicamente (sin QStash por ahora). Pantallas: hub de planes con mini-calendario + rutina del día, detalle del plan con días expandibles. Límite free: 1 plan/mes |

### Próximos (Pasos 9–15)

| Paso | Descripción |
|---|---|
| **9** | **Planes Alimenticios (Premium)** ← PRÓXIMO: Edge Function `generate-meal-plan`, formulario de intake, UI de meal plans con MacroBar. Tabla `meal_plans` ya existe en DB. Placeholder en `app/(app)/plans/meal/index.tsx` |
| 10 | **Seguimiento Corporal**: gráfica de peso con Skia, formulario de mediciones, GoalProgress |
| 11 | **Notificaciones Push**: integración completa con expo-notifications y `lib/notifications.ts` |
| 12 | **Freemium Gates y Upgrade**: PaywallBanner, UpgradeSheet, flujos de límite |
| 13 | **Web de Pagos**: Stripe Checkout en `pay.forja.fit`, deep link `forja://` de retorno, webhook |
| 14 | **i18n**: activar todas las traducciones, detección de idioma del dispositivo |
| 15 | **Load Testing + Deploy**: k6 completo, EAS Build, App Store + Play Store |

---

## Cómo agregar documentación nueva

Cada vez que se complete un paso o se agregue una feature al proyecto, actualizar este archivo:

1. **Nueva pantalla** → sección 10 (Frontend — Pantallas)
2. **Nuevo componente** → sección 11 (Componentes UI)
3. **Nueva tabla en DB** → sección 4 (Base de Datos)
4. **Nueva Edge Function** → sección 6 (Backend)
5. **Cambio en límites Free/Premium** → sección 16
6. **Nuevo paso completado** → sección 20 (mover de "próximos" a "completados")
7. **Nueva variable de entorno** → sección 19

---

*Documento vivo — se actualiza con cada iteración del proyecto.*
