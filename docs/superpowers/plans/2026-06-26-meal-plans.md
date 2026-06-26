# Meal Plans (Paso 9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar planes alimenticios premium generados por Claude Sonnet — Edge Function, hook, componentes MacroBar y MealPlanCard, y pantalla completa con form de intake y vista de 7 días.

**Architecture:** Edge Function `generate-meal-plan` sigue el mismo patrón síncrono de `generate-plan`: valida JWT + límites, lee perfil de DB, construye prompt, llama a Sonnet, parsea JSON, guarda en `meal_plans`. El cliente usa `useGenerateMealPlan` (useMutation) y `useActiveMealPlan` (useQuery) con el mismo patrón de `useWorkoutPlan`.

**Tech Stack:** Deno + Supabase Edge Functions, React Native + Expo Router, TanStack React Query v5, Zustand, NativeWind v4, TypeScript ~6.0.3, Claude Sonnet (`claude-sonnet-4-6`).

## Global Constraints

- Modelo IA: `claude-sonnet-4-6`, `max_tokens: 8192` (el plan de 7 días es verboso)
- Nunca usar service key en Edge Functions — siempre el JWT del cliente
- Free limit: `MEAL_PLANS_LIFETIME = 1` (cuenta total, no mensual)
- Premium limit: `MEAL_PLANS_PER_MONTH = 10` (mensual)
- El tipo de comida `async_jobs` ya tiene `'generate_meal_plan'` en el CHECK constraint del schema
- `meal_plans.meals` es JSONB — guarda el objeto completo del plan (incluyendo `days[]`)
- `meal_plans.macros` es JSONB — guarda `{ protein_g, carbs_g, fat_g }`
- `meal_plans.daily_calories` es columna INTEGER propia
- Verificación de tipos: `npx tsc --noEmit` desde `forja/` debe pasar sin errores
- Colores: proteína → `colors.primary` (#22C55E), carbs → `colors.accent` (#818CF8), grasa → `colors.warning` (#F59E0B)

---

## File Map

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modificar | `lib/limits.ts` | Agregar `MEAL_PLANS_LIFETIME` y exportar `PREMIUM_LIMITS` |
| Crear | `supabase/functions/generate-meal-plan/index.ts` | Edge Function completa |
| Implementar | `hooks/useMealPlan.ts` | `useActiveMealPlan` + `useGenerateMealPlan` |
| Implementar | `components/plans/MacroBar.tsx` | Barra visual de macros |
| Implementar | `components/plans/MealPlanCard.tsx` | Card colapsable por comida |
| Reemplazar | `app/(app)/plans/meal/index.tsx` | Pantalla principal (form + plan activo) |
| Implementar | `app/(app)/plans/meal/[id].tsx` | Redirect a index |
| Modificar | `app/(app)/plans/index.tsx` | Actualizar subtítulo del entry point |
| Actualizar | `forja-docs.md` | Documentar lo construido |

---

## Task 1: Límites y tipos

**Files:**
- Modify: `lib/limits.ts`

**Interfaces:**
- Produces: `FREE_LIMITS.MEAL_PLANS_LIFETIME: 1`, `PREMIUM_LIMITS.MEAL_PLANS_PER_MONTH: 10`

- [ ] **Step 1: Actualizar `lib/limits.ts`**

```ts
export const FREE_LIMITS = {
  MESSAGES_PER_DAY: 20,
  WORKOUT_PLANS_PER_MONTH: 1,
  WORKOUT_PLAN_MODIFICATIONS_PER_MONTH: 3,
  BODY_HISTORY_DAYS: 14,
  MEAL_PLANS_LIFETIME: 1,
} as const;

export const PREMIUM_LIMITS = {
  MEAL_PLANS_PER_MONTH: 10,
} as const;
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add lib/limits.ts
git commit -m "feat: add meal plan limits (free lifetime=1, premium 10/month)"
```

---

## Task 2: Edge Function `generate-meal-plan`

**Files:**
- Create: `supabase/functions/generate-meal-plan/index.ts`

**Interfaces:**
- Consumes: `FREE_LIMITS.MEAL_PLANS_LIFETIME`, `PREMIUM_LIMITS.MEAL_PLANS_PER_MONTH` (constantes numéricas hardcodeadas en la Edge Function — Deno no importa desde `lib/`)
- Produces: `POST /functions/v1/generate-meal-plan` → `{ job_id, status, plan_id, plan }`

- [ ] **Step 1: Crear `supabase/functions/generate-meal-plan/index.ts`**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const FREE_MEAL_PLAN_LIFETIME_LIMIT = 1;
const PREMIUM_MEAL_PLAN_MONTHLY_LIMIT = 10;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildMealPlanPrompt(userData: {
  goal_type: string;
  fitness_level: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: string | null;
  activity_level: string | null;
  allergies: string;
  diet_type: string;
  food_availability: string;
}): string {
  const goalMap: Record<string, string> = {
    weight_loss: 'pérdida de grasa',
    muscle_gain: 'ganancia muscular (hipertrofia)',
    recomposition: 'recomposición corporal',
    powerlifting: 'fuerza/powerlifting',
    sport_specific: 'rendimiento deportivo',
    general_fitness: 'salud y condición física general',
  };

  const availabilityMap: Record<string, string> = {
    'básica': 'ingredientes básicos y fáciles de conseguir (pollo, arroz, huevos, verduras comunes)',
    'media': 'variedad moderada de ingredientes (carnes diversas, legumbres, frutas variadas)',
    'amplia': 'acceso a ingredientes especializados (proteínas variadas, superfoods, productos importados)',
  };

  return `Eres un nutriólogo deportivo de élite. Genera un plan alimenticio semanal COMPLETO y DETALLADO de 7 días para el siguiente perfil. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones.

PERFIL DEL USUARIO:
- Objetivo: ${goalMap[userData.goal_type] ?? userData.goal_type}
- Nivel de fitness: ${userData.fitness_level}
${userData.weight_kg ? `- Peso: ${userData.weight_kg} kg` : ''}
${userData.height_cm ? `- Estatura: ${userData.height_cm} cm` : ''}
${userData.age ? `- Edad: ${userData.age} años` : ''}
${userData.gender ? `- Género: ${userData.gender}` : ''}
${userData.activity_level ? `- Nivel de actividad: ${userData.activity_level}` : ''}
- Alergias/intolerancias: ${userData.allergies || 'ninguna'}
- Tipo de dieta: ${userData.diet_type}
- Disponibilidad de alimentos: ${availabilityMap[userData.food_availability] ?? userData.food_availability}

IMPORTANTE: Los planes no sustituyen la valoración de un nutriólogo. No promuevas restricciones extremas ni conductas que pongan en riesgo la salud.

FORMATO JSON REQUERIDO (responde EXACTAMENTE así):
{
  "title": "Nombre del plan (ej: Plan Nutrición Hipertrofia — 2800 kcal)",
  "description": "Descripción breve del enfoque nutricional (2-3 oraciones)",
  "daily_calories": 2800,
  "macros": { "protein_g": 210, "carbs_g": 280, "fat_g": 80 },
  "days": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "total_calories": 2800,
      "meals": [
        {
          "meal_type": "Desayuno",
          "time_suggestion": "7:00–8:00",
          "name": "Avena proteica con fruta",
          "calories": 520,
          "protein_g": 35,
          "carbs_g": 65,
          "fat_g": 10,
          "ingredients": ["80g avena", "1 scoop proteína", "1 plátano", "200ml leche desnatada"]
        },
        { "meal_type": "Media mañana", "time_suggestion": "10:00–10:30", "name": "...", "calories": 250, "protein_g": 20, "carbs_g": 25, "fat_g": 8, "ingredients": ["..."] },
        { "meal_type": "Almuerzo", "time_suggestion": "13:00–14:00", "name": "...", "calories": 700, "protein_g": 55, "carbs_g": 80, "fat_g": 20, "ingredients": ["..."] },
        { "meal_type": "Merienda", "time_suggestion": "17:00–17:30", "name": "...", "calories": 300, "protein_g": 25, "carbs_g": 30, "fat_g": 8, "ingredients": ["..."] },
        { "meal_type": "Cena", "time_suggestion": "20:00–21:00", "name": "...", "calories": 600, "protein_g": 50, "carbs_g": 60, "fat_g": 15, "ingredients": ["..."] }
      ]
    }
  ]
}

Genera exactamente 7 días distintos con variedad. Cada día debe tener exactamente 5 comidas: Desayuno, Media mañana, Almuerzo, Merienda y Cena. Las calorías de las comidas deben sumar aproximadamente el total diario. Respeta las alergias e intolerancias indicadas.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const [subResult, totalPlansResult, activeJobResult] = await Promise.all([
      supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
      supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('async_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'generate_meal_plan')
        .in('status', ['pending', 'processing'])
        .limit(1)
        .maybeSingle(),
    ]);

    if (activeJobResult.data) {
      return new Response(
        JSON.stringify({ error: 'generation_in_progress', job_id: activeJobResult.data.id }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

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

    const body = await req.json();
    const { allergies = 'ninguna', diet_type = 'omnívoro', food_availability = 'media' } = body;

    const [goalResult, bodyResult] = await Promise.all([
      supabase.from('goals').select('type, fitness_level')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('body_data').select('weight_kg, height_cm, age, gender, activity_level')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!goalResult.data) {
      return new Response(
        JSON.stringify({ error: 'no_active_goal' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

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

    const prompt = buildMealPlanPrompt({
      goal_type: goalResult.data.type,
      fitness_level: goalResult.data.fitness_level,
      weight_kg: bodyResult.data?.weight_kg ? Number(bodyResult.data.weight_kg) : null,
      height_cm: bodyResult.data?.height_cm ? Number(bodyResult.data.height_cm) : null,
      age: bodyResult.data?.age ?? null,
      gender: bodyResult.data?.gender ?? null,
      activity_level: bodyResult.data?.activity_level ?? null,
      allergies,
      diet_type,
      food_availability,
    });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: `Anthropic error: ${anthropicRes.status}`, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'ai_error', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const aiResult = await anthropicRes.json();
    const rawContent = aiResult.content?.[0]?.text ?? '';

    let planData: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      planData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Error parsing plan JSON:', e, rawContent.slice(0, 500));
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: 'Invalid JSON from AI', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'invalid_ai_response', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('meal_plans')
      .update({ is_active: false })
      .eq('user_id', user.id).eq('is_active', true);

    const macros = (planData.macros ?? {}) as Record<string, number>;

    const { data: savedPlan, error: planError } = await supabase
      .from('meal_plans')
      .insert({
        user_id: user.id,
        title: String(planData.title ?? 'Mi Plan Alimenticio'),
        daily_calories: Number(planData.daily_calories ?? 0),
        macros,
        meals: planData,
        generated_by: 'claude-sonnet-4-6',
        is_active: true,
      })
      .select('id').single();

    if (planError || !savedPlan) {
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: 'DB insert failed', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'db_error', job_id: job.id }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('async_jobs')
      .update({ status: 'completed', result: { plan_id: savedPlan.id }, completed_at: new Date().toISOString() })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({ job_id: job.id, status: 'completed', plan_id: savedPlan.id, plan: planData }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-meal-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Desplegar la Edge Function en local**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && supabase functions serve generate-meal-plan --no-verify-jwt
```
Esperado: `Serving function generate-meal-plan` sin errores de sintaxis Deno.

Detener con Ctrl+C después de verificar que levanta sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/generate-meal-plan/index.ts
git commit -m "feat: add generate-meal-plan edge function (Claude Sonnet, 7-day JSON plan)"
```

---

## Task 3: Hook `useMealPlan`

**Files:**
- Implement: `hooks/useMealPlan.ts` (stub → completo)

**Interfaces:**
- Consumes: `supabase` client de `@/lib/supabase`, `useAuthStore` de `@/store/auth.store`
- Produces:
  - `useActiveMealPlan()` → `UseQueryResult<MealPlanRow | null>`
  - `useGenerateMealPlan()` → `UseMutationResult` que llama a `POST /functions/v1/generate-meal-plan`

- [ ] **Step 1: Implementar `hooks/useMealPlan.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useActiveMealPlan() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['meal_plan', 'active', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
  });
}

export function useGenerateMealPlan() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      allergies: string;
      diet_type: string;
      food_availability: string;
    }) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw { status: res.status, ...data };
      return data as { job_id: string; status: string; plan_id: string; plan: unknown };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal_plan'] });
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add hooks/useMealPlan.ts
git commit -m "feat: add useMealPlan hook (useActiveMealPlan + useGenerateMealPlan)"
```

---

## Task 4: Componente `MacroBar`

**Files:**
- Implement: `components/plans/MacroBar.tsx` (stub → completo)

**Interfaces:**
- Produces: `<MacroBar protein_g={number} carbs_g={number} fat_g={number} compact?={boolean} />`

- [ ] **Step 1: Implementar `components/plans/MacroBar.tsx`**

```tsx
import { View, Text } from 'react-native';
import { colors } from '@/constants/colors';

interface MacroBarProps {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  compact?: boolean;
}

function MacroLabel({ color, label, grams, pct }: { color: string; label: string; grams: number; pct: number }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 10 }}>{label}</Text>
      <Text style={{ color: colors.text, fontFamily: 'JetBrainsMono-Medium', fontSize: 12 }}>{grams}g</Text>
      <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 10 }}>{pct}%</Text>
    </View>
  );
}

export function MacroBar({ protein_g, carbs_g, fat_g, compact = false }: MacroBarProps) {
  const total = protein_g + carbs_g + fat_g;
  if (total === 0) return null;

  const proteinPct = Math.round((protein_g / total) * 100);
  const carbsPct = Math.round((carbs_g / total) * 100);
  const fatPct = 100 - proteinPct - carbsPct;

  return (
    <View>
      <View style={{ flexDirection: 'row', borderRadius: 4, overflow: 'hidden', height: compact ? 6 : 10 }}>
        <View style={{ flex: proteinPct, backgroundColor: colors.primary }} />
        <View style={{ flex: carbsPct, backgroundColor: colors.accent }} />
        <View style={{ flex: fatPct, backgroundColor: colors.warning }} />
      </View>
      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <MacroLabel color={colors.primary} label="Proteína" grams={protein_g} pct={proteinPct} />
          <MacroLabel color={colors.accent} label="Carbs" grams={carbs_g} pct={carbsPct} />
          <MacroLabel color={colors.warning} label="Grasa" grams={fat_g} pct={fatPct} />
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/plans/MacroBar.tsx
git commit -m "feat: add MacroBar component (protein/carbs/fat visual bar)"
```

---

## Task 5: Componente `MealPlanCard`

**Files:**
- Implement: `components/plans/MealPlanCard.tsx` (stub → completo)

**Interfaces:**
- Consumes: `MacroBar` de `./MacroBar`
- Produces:
  ```ts
  export interface Meal {
    meal_type: string;
    time_suggestion: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    ingredients: string[];
  }
  export function MealPlanCard({ meal }: { meal: Meal }): JSX.Element
  ```

- [ ] **Step 1: Implementar `components/plans/MealPlanCard.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { MacroBar } from './MacroBar';

export interface Meal {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

export function MealPlanCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 11 }}>
              {meal.meal_type.toUpperCase()}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>·</Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 11 }}>
              {meal.time_suggestion}
            </Text>
          </View>
          <Text
            style={{ color: colors.text, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 15 }}
            numberOfLines={expanded ? undefined : 1}
          >
            {meal.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 12, marginTop: 2 }}>
            {meal.calories} kcal
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
          style={{ marginLeft: 8, marginTop: 2 }}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <MacroBar
          protein_g={meal.protein_g}
          carbs_g={meal.carbs_g}
          fat_g={meal.fat_g}
          compact={!expanded}
        />
      </View>

      {expanded && (
        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
            INGREDIENTES
          </Text>
          {meal.ingredients.map((ing, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
              <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13 }}>{ing}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add components/plans/MealPlanCard.tsx
git commit -m "feat: add MealPlanCard component (collapsible with MacroBar)"
```

---

## Task 6: Pantalla principal + rutas de meal

**Files:**
- Replace: `app/(app)/plans/meal/index.tsx`
- Implement: `app/(app)/plans/meal/[id].tsx` (stub → redirect)
- Modify: `app/(app)/plans/index.tsx` (solo el subtítulo del entry point)

**Interfaces:**
- Consumes:
  - `useActiveMealPlan()` de `@/hooks/useMealPlan`
  - `useGenerateMealPlan()` de `@/hooks/useMealPlan`
  - `useIsPremium()` de `@/hooks/useSubscription`
  - `MacroBar` de `@/components/plans/MacroBar`
  - `MealPlanCard, type Meal` de `@/components/plans/MealPlanCard`
  - `FREE_LIMITS` de `@/lib/limits`

- [ ] **Step 1: Reemplazar `app/(app)/plans/meal/index.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { useIsPremium } from '@/hooks/useSubscription';
import { MacroBar } from '@/components/plans/MacroBar';
import { MealPlanCard, type Meal } from '@/components/plans/MealPlanCard';

const ALLERGY_OPTIONS = ['Ninguna', 'Gluten', 'Lactosa', 'Frutos secos', 'Mariscos'];
const DIET_OPTIONS = ['Omnívoro', 'Vegetariano', 'Vegano', 'Sin gluten', 'Keto'];
const AVAILABILITY_OPTIONS = ['Básica', 'Media', 'Amplia'];

type MealDay = { day_number: number; day_name: string; total_calories: number; meals: Meal[] };
type MealPlanData = {
  title: string;
  description: string;
  daily_calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  days: MealDay[];
};

function ChipGroup({
  options, selected, onSelect, multi = false,
}: {
  options: string[]; selected: string[]; onSelect: (val: string) => void; multi?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              borderWidth: 1,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primaryDim : colors.surface,
            }}
          >
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: isSelected ? colors.primary : colors.textMuted }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MealPlansScreen() {
  const { data: activePlan, isLoading } = useActiveMealPlan();
  const { mutateAsync: generatePlan, isPending: generating } = useGenerateMealPlan();
  const isPremium = useIsPremium();

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(['Ninguna']);
  const [selectedDiet, setSelectedDiet] = useState<string[]>(['Omnívoro']);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>(['Media']);
  const [selectedDay, setSelectedDay] = useState(0);

  function toggleAllergy(val: string) {
    if (val === 'Ninguna') { setSelectedAllergies(['Ninguna']); return; }
    setSelectedAllergies(prev => {
      const without = prev.filter(v => v !== 'Ninguna');
      const next = without.includes(val) ? without.filter(v => v !== val) : [...without, val];
      return next.length === 0 ? ['Ninguna'] : next;
    });
  }

  async function handleGenerate() {
    const allergies = selectedAllergies.filter(v => v !== 'Ninguna').join(', ') || 'ninguna';
    const diet_type = (selectedDiet[0] ?? 'Omnívoro').toLowerCase();
    const food_availability = (selectedAvailability[0] ?? 'Media').toLowerCase();
    try {
      await generatePlan({ allergies, diet_type, food_availability });
      setSelectedDay(0);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.error === 'meal_plan_limit_reached') {
        Alert.alert(
          'Límite alcanzado',
          isPremium
            ? 'Has alcanzado el límite de 10 planes este mes.'
            : 'Ya usaste tu plan gratuito. Actualiza a Premium para regenerar cuando quieras.',
        );
      } else if (e?.error === 'generation_in_progress') {
        Alert.alert('En proceso', 'Ya hay un plan siendo generado. Espera un momento.');
      } else if (e?.error === 'no_active_goal') {
        Alert.alert('Sin objetivo', 'Completa tu perfil con un objetivo activo primero.');
      } else {
        Alert.alert('Error', 'No se pudo generar el plan. Intenta de nuevo.');
      }
    }
  }

  const planData = activePlan?.meals as MealPlanData | null;
  const days = planData?.days ?? [];
  const currentDay = days[selectedDay];

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
        gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 }}>
            Plan Alimenticio
          </Text>
          {activePlan && planData && (
            <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 12, marginTop: 1 }}>
              {activePlan.daily_calories} kcal · {planData.macros.protein_g}g proteína
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {activePlan && planData ? (
          <>
            {/* Macros diarios */}
            <View style={{
              backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
                PROMEDIOS DIARIOS
              </Text>
              <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, marginBottom: 12 }}>
                {planData.title}
              </Text>
              <MacroBar
                protein_g={planData.macros.protein_g}
                carbs_g={planData.macros.carbs_g}
                fat_g={planData.macros.fat_g}
              />
            </View>

            {/* Navegador de días */}
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}
            >
              {days.map((day, i) => (
                <TouchableOpacity
                  key={i} onPress={() => setSelectedDay(i)} activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                    borderColor: selectedDay === i ? colors.primary : colors.border,
                    backgroundColor: selectedDay === i ? colors.primaryDim : colors.surface,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Inter-Medium', fontSize: 13,
                    color: selectedDay === i ? colors.primary : colors.textMuted,
                  }}>
                    {day.day_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Comidas del día */}
            {currentDay && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 16 }}>
                    {currentDay.day_name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 13 }}>
                    {currentDay.total_calories} kcal
                  </Text>
                </View>
                {currentDay.meals.map((meal, i) => (
                  <MealPlanCard key={i} meal={meal} />
                ))}
              </>
            )}

            {/* Regenerar */}
            {isPremium ? (
              <TouchableOpacity
                onPress={handleGenerate} disabled={generating} activeOpacity={0.7}
                style={{
                  marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 8, opacity: generating ? 0.6 : 1,
                }}
              >
                {generating
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />}
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                  {generating ? 'Generando plan...' : 'Regenerar plan'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{
                marginTop: 16, backgroundColor: colors.accent + '15',
                borderWidth: 1, borderColor: colors.accent + '40',
                borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    Regenerar requiere Premium
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                    Actualiza para crear nuevos planes cuando quieras
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Estado sin plan */}
            <View style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 8 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.accent + '20',
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Ionicons name="nutrition-outline" size={28} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
                Tu plan alimenticio
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
                Generado con IA según tu objetivo, cuerpo y preferencias.
              </Text>
            </View>

            {/* Form */}
            <View style={{ gap: 20, marginBottom: 24 }}>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Alergias o intolerancias
                </Text>
                <ChipGroup options={ALLERGY_OPTIONS} selected={selectedAllergies} onSelect={toggleAllergy} multi />
              </View>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Tipo de dieta
                </Text>
                <ChipGroup options={DIET_OPTIONS} selected={selectedDiet} onSelect={(v) => setSelectedDiet([v])} />
              </View>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Disponibilidad de alimentos
                </Text>
                <ChipGroup options={AVAILABILITY_OPTIONS} selected={selectedAvailability} onSelect={(v) => setSelectedAvailability([v])} />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleGenerate} disabled={generating} activeOpacity={0.8}
              style={{
                backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                gap: 8, opacity: generating ? 0.7 : 1,
              }}
            >
              {generating
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Ionicons name="sparkles-outline" size={20} color={colors.background} />}
              <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 16 }}>
                {generating ? 'Generando tu plan...' : 'Generar mi plan'}
              </Text>
            </TouchableOpacity>

            {!isPremium && (
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                Plan gratuito: 1 generación de por vida · Premium: ilimitadas
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Implementar `app/(app)/plans/meal/[id].tsx`**

```tsx
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function MealPlanDetail() {
  useEffect(() => {
    router.replace('/(app)/plans/meal');
  }, []);
  return null;
}
```

- [ ] **Step 3: Actualizar subtítulo en `app/(app)/plans/index.tsx`**

Buscar la línea:
```tsx
<Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
  Premium · Próximamente
</Text>
```
Reemplazar por:
```tsx
<Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
  Nutrición personalizada con IA
</Text>
```

- [ ] **Step 4: Verificar tipos**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 5: Probar en Expo**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx expo start
```

Verificar manualmente:
1. Tab "Planes" → entry point "Plan Alimenticio" muestra subtítulo correcto
2. Entrar a "Plan Alimenticio" → aparece form con chips de alergias, dieta y disponibilidad
3. Seleccionar chips → se marcan/desmarcan correctamente ("Ninguna" se deselecciona al elegir otra alergia)
4. Botón "Generar mi plan" → muestra `ActivityIndicator` durante la llamada
5. Al completar → navega al estado con plan activo: MacroBar, navegador de días, MealPlanCards
6. Tocar un día → cambia las comidas mostradas
7. Tocar una MealPlanCard → se expande mostrando MacroBar completa e ingredientes
8. Usuario free → ve el banner "Regenerar requiere Premium" en lugar del botón

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/plans/meal/index.tsx" "app/(app)/plans/meal/[id].tsx" "app/(app)/plans/index.tsx"
git commit -m "feat: implement meal plans screen (intake form, 7-day view, MacroBar, MealPlanCard)"
```

---

## Task 7: Actualizar `forja-docs.md`

**Files:**
- Modify: `forja-docs.md`

- [ ] **Step 1: Actualizar sección §4 — agregar JSON schema de `meal_plans.meals`**

En la subsección `meal_plans`, después del bloque SQL, agregar:

```markdown
**Estructura del JSONB `meals`** (objeto completo del plan):
```json
{
  "title": "Plan Nutrición Hipertrofia — 2800 kcal",
  "description": "...",
  "daily_calories": 2800,
  "macros": { "protein_g": 210, "carbs_g": 280, "fat_g": 80 },
  "days": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "total_calories": 2800,
      "meals": [
        {
          "meal_type": "Desayuno",
          "time_suggestion": "7:00–8:00",
          "name": "Avena proteica con fruta",
          "calories": 520,
          "protein_g": 35,
          "carbs_g": 65,
          "fat_g": 10,
          "ingredients": ["80g avena", "1 scoop proteína"]
        }
      ]
    }
  ]
}
```
7 días, 5 comidas por día (Desayuno, Media mañana, Almuerzo, Merienda, Cena).
```

- [ ] **Step 2: Actualizar §6 — agregar `generate-meal-plan`**

Agregar después de la sección `/functions/generate-plan`:

```markdown
### `/functions/generate-meal-plan` — Generación de plan alimenticio

**Propósito**: genera un plan alimenticio semanal de 7 días usando Claude Sonnet.

**Flujo**: idéntico a `generate-plan` (valida JWT → límites → lee perfil → async_job → Sonnet → parsea JSON → guarda → job completed). **Diferencia clave**: recibe `{ allergies, diet_type, food_availability }` en el body (datos del form corto no persistidos en DB).

**Límites**: Free = 1 plan de por vida (total); Premium = 10 planes/mes.

**Modelo**: `claude-sonnet-4-6`, `max_tokens: 8192`.
```

- [ ] **Step 3: Actualizar §10 — pantalla Meal Plans**

Reemplazar la línea placeholder de meal plans con la descripción real de la pantalla.

- [ ] **Step 4: Actualizar §11 — componentes MacroBar y MealPlanCard**

Cambiar los stubs en la tabla de `components/plans/` por descripciones reales.

- [ ] **Step 5: Actualizar §13 — hook useMealPlan**

Agregar `useActiveMealPlan` y `useGenerateMealPlan` a la tabla de hooks.

- [ ] **Step 6: Actualizar §16 — límites**

Agregar `MEAL_PLANS_LIFETIME: 1` (free) y `MEAL_PLANS_PER_MONTH: 10` (premium) a la tabla.

- [ ] **Step 7: Actualizar §20 — mover Paso 9 a completados**

Mover el Paso 9 de "Próximos" a "Completados" con descripción completa.

- [ ] **Step 8: Commit**

```bash
git add forja-docs.md
git commit -m "docs: update forja-docs with Paso 9 (meal plans) implementation details"
```
