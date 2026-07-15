# Rediseño Fase D: Nutrición (swap + disgustos + onboarding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persistir alergias/disgustos alimenticios, permitir swap de una comida individual con preview antes de confirmar, y agregar un paso 5 opcional de onboarding (trayectoria competitiva + suplementación) que alimenta ambos generadores de IA con un guardrail de seguridad explícito.

**Architecture:** Migración única (`0012`) que agrega dos tablas nuevas (`food_preferences`, `meal_swaps`) y tres columnas nuevas (`goals.athletic_background`, `profiles.supplements`, `profiles.supplements_other`). Una Edge Function nueva (`swap-meal`, con el mismo patrón `logic.ts`/`index.ts`/`logic.test.ts` que `translate-plan`) maneja preview (llama a Sonnet, no persiste) y accept (persiste, resetea el caché de traducciones, valida el límite semanal). Onboarding gana una pantalla 5 opcional; la responsabilidad de marcar `onboarding_completed` se mueve del paso 4 al paso 5 para que el usuario no sea expulsado del flujo antes de verla (ver Task 6, hallazgo de arquitectura).

**Tech Stack:** React Native/Expo, Supabase (Postgres+Edge Functions Deno), TanStack Query v5, Zustand, react-i18next.

## Global Constraints

- Spec fuente: `docs/superpowers/specs/2026-07-14-redesign-fase-d-nutricion-design.md` — toda cifra/valor exacto de este plan viene de ahí.
- Colores/fuentes SIEMPRE vía `useTheme()` — cero hex nuevos.
- Claves i18n nuevas siempre es+en (`npm run check-i18n`).
- Modelo de swap-meal preview: `claude-sonnet-4-6` (mismo modelo que `generate-meal-plan`, header `x-api-key` + `anthropic-version: 2023-06-01`).
- Identidad de la comida en swap: `day_number` se busca con `days.findIndex(d => d.day_number === dayNumber)` (nunca `days[dayNumber-1]`); `meal_index` es posición real de array, pasada por el cliente.
- Límites: `FREE_LIMITS.MEAL_SWAPS_PER_WEEK = 3` (ventana rodante de 7 días, no calendario), premium sin límite; `MEAL_SWAP_PREVIEW_ATTEMPTS_MAX = 3` por sesión de swap (aplica a ambos tiers, es control de costo de IA no gating de producto).
- `food_preferences`/`meal_swaps`: RLS sin política de `update` (food_preferences: cliente puede select/insert/delete; meal_swaps: cliente solo select, solo la EF con service role inserta).
- Commits en español `feat(fase-d):`. Rama master. Dir: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Docker vía `sg docker -c "..."`. Migraciones: `sg docker -c "supabase migration up"`. Tras tocar EFs: `sg docker -c "docker restart supabase_edge_runtime_forja"` (o `supabase stop && start` si es una EF nueva).

---

### Task 1: Migración 0012 — `food_preferences`, `meal_swaps`, columnas de onboarding

**Files:**
- Create: `supabase/migrations/0012_nutrition_preferences.sql`
- Modify: `types/database.types.ts` (regenerado, no editado a mano)

**Interfaces:**
- Produces: tablas `food_preferences(id, user_id, item, kind, created_at)` y `meal_swaps(id, user_id, meal_plan_id, day_number, meal_index, old_meal_name, new_meal_name, created_at)`; columnas `goals.athletic_background`, `profiles.supplements`, `profiles.supplements_other`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Fase D del rediseño: alergias/disgustos persistidos, swap de comida,
-- onboarding de trayectoria competitiva + suplementación.

create table food_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  item       text not null,
  kind       text not null check (kind in ('allergy', 'dislike')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, item)
);

create index food_preferences_user_idx on food_preferences(user_id);

alter table food_preferences enable row level security;

create policy "food_preferences_owner_select" on food_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "food_preferences_owner_insert" on food_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "food_preferences_owner_delete" on food_preferences
  for delete to authenticated using (user_id = auth.uid());

-- meal_swaps: auditoría + base del límite semanal. Sin política de
-- insert/update/delete para el cliente — solo la EF swap-meal (service role) escribe.
create table meal_swaps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  meal_plan_id  uuid not null references meal_plans(id) on delete cascade,
  day_number    int not null,
  meal_index    int not null,
  old_meal_name text not null,
  new_meal_name text not null,
  created_at    timestamptz not null default now()
);

create index meal_swaps_user_date_idx on meal_swaps(user_id, created_at desc);

alter table meal_swaps enable row level security;

create policy "meal_swaps_owner_select" on meal_swaps
  for select to authenticated using (user_id = auth.uid());

-- Onboarding: trayectoria competitiva + suplementación (paso 5, opcional).
alter table goals add column athletic_background text;
alter table goals add constraint goals_athletic_background_check check (
  athletic_background is null or athletic_background in ('none', 'amateur', 'high_performance', 'bodybuilding')
);

alter table profiles add column supplements text[] not null default '{}';
alter table profiles add column supplements_other text;
```

- [ ] **Step 2: Aplicar la migración**

Run: `sg docker -c "supabase migration up"`
Expected: `Applying migration 0012_nutrition_preferences.sql...` sin errores.

- [ ] **Step 3: Verificar RLS y constraints en vivo**

Run:
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"select tablename, policyname, cmd from pg_policies where tablename in ('food_preferences','meal_swaps') order by tablename, cmd;\""
```
Expected: 3 filas para `food_preferences` (`SELECT`, `INSERT`, `DELETE`), 1 fila para `meal_swaps` (`SELECT`), ninguna con `cmd = 'UPDATE'`.

Run:
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"insert into goals (user_id, type, fitness_level, mode, athletic_background) select id, 'general_fitness', 'casual', 'flexible', 'invalid_value' from profiles limit 1;\""
```
Expected: error de constraint check (`goals_athletic_background_check`) — confirma que el check rechaza valores fuera de la lista.

- [ ] **Step 4: Regenerar tipos TypeScript**

Run: `sg docker -c "supabase gen types typescript --local"` (redirigir la salida a `types/database.types.ts`)
Expected: el archivo regenerado incluye `food_preferences`, `meal_swaps`, y los campos nuevos de `goals`/`profiles`. Verificar con `grep -c "food_preferences\|meal_swaps" types/database.types.ts` — debe ser `> 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_nutrition_preferences.sql types/database.types.ts
git commit -m "feat(fase-d): migración 0012 — food_preferences, meal_swaps, columnas de onboarding"
```

---

### Task 2: Alergias/disgustos — hook + pantalla de gestión en Ajustes

**Files:**
- Create: `hooks/useFoodPreferences.ts`
- Create: `app/(app)/settings/food-preferences.tsx`
- Modify: `app/(app)/settings/index.tsx` (nueva `SettingsRow`)
- Modify: `locales/es/settings.json`, `locales/en/settings.json` (paridad)

**Interfaces:**
- Consumes: tabla `food_preferences` de Task 1.
- Produces: `useFoodPreferences()` → `{ data: { allergies: string[]; dislikes: string[] } | undefined, isLoading }`; `useAddFoodPreference()` → mutation `{ item: string; kind: 'allergy'|'dislike' }`; `useRemoveFoodPreference()` → mutation `{ id: string }`. Estos hooks los consume Task 3 (`generate-meal-plan` ya no depende de esto, lee directo de DB) y no se reusan en más tareas de este plan.

- [ ] **Step 1: Escribir el hook**

```typescript
// hooks/useFoodPreferences.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export type FoodPreferenceKind = 'allergy' | 'dislike';

export function useFoodPreferences() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['food_preferences', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_preferences')
        .select('id, item, kind')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      return {
        allergies: rows.filter((r) => r.kind === 'allergy').map((r) => ({ id: r.id, item: r.item })),
        dislikes: rows.filter((r) => r.kind === 'dislike').map((r) => ({ id: r.id, item: r.item })),
      };
    },
  });
}

export function useAddFoodPreference() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, kind }: { item: string; kind: FoodPreferenceKind }) => {
      const { error } = await supabase
        .from('food_preferences')
        .insert({ user_id: user!.id, item: item.trim(), kind });
      // Conflicto de unique(user_id, kind, item) = ya existe, no es un error visible.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food_preferences'] });
    },
  });
}

export function useRemoveFoodPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('food_preferences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food_preferences'] });
    },
  });
}
```

- [ ] **Step 2: Pantalla de gestión**

```tsx
// app/(app)/settings/food-preferences.tsx
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  useAddFoodPreference,
  useFoodPreferences,
  useRemoveFoodPreference,
  type FoodPreferenceKind,
} from '@/hooks/useFoodPreferences';

function PreferenceGroup({
  title, items, kind, onAdd, onRemove, adding,
}: {
  title: string;
  items: { id: string; item: string }[];
  kind: FoodPreferenceKind;
  onAdd: (item: string, kind: FoodPreferenceKind) => void;
  onRemove: (id: string) => void;
  adding: boolean;
}) {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const [text, setText] = useState('');

  function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed, kind);
    setText('');
  }

  return (
    <View className="mb-6 gap-3">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{title}</Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((it) => (
          <TouchableOpacity
            key={it.id}
            onPress={() => onRemove(it.id)}
            activeOpacity={0.7}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.text }}>{it.item}</Text>
            <Ionicons name="close" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
        {items.length === 0 ? (
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
            {t('foodPreferences.empty')}
          </Text>
        ) : null}
      </View>
      <View className="flex-row gap-2 items-start">
        <View className="flex-1">
          <Input placeholder={t('foodPreferences.addPlaceholder')} value={text} onChangeText={setText} />
        </View>
        <Button label={t('foodPreferences.add')} size="sm" variant="secondary" loading={adding} onPress={handleAdd} />
      </View>
    </View>
  );
}

export default function FoodPreferencesScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data } = useFoodPreferences();
  const { mutate: addPreference, isPending: adding } = useAddFoodPreference();
  const { mutate: removePreference } = useRemoveFoodPreference();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('foodPreferences.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('foodPreferences.subtitle')}
        </Text>
        <PreferenceGroup
          title={t('foodPreferences.allergiesTitle')}
          items={data?.allergies ?? []}
          kind="allergy"
          onAdd={(item, kind) => addPreference({ item, kind })}
          onRemove={(id) => removePreference({ id })}
          adding={adding}
        />
        <PreferenceGroup
          title={t('foodPreferences.dislikesTitle')}
          items={data?.dislikes ?? []}
          kind="dislike"
          onAdd={(item, kind) => addPreference({ item, kind })}
          onRemove={(id) => removePreference({ id })}
          adding={adding}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Fila nueva en el hub de Ajustes**

En `app/(app)/settings/index.tsx`, dentro del grupo `groupAccount` (línea ~36-39), agregar la fila después de `rowTraining`:

```tsx
        <SettingsGroup title={t('hub.groupAccount')}>
          <SettingsRow icon="person-outline" label={t('hub.rowAccount')} onPress={() => router.push('/(app)/settings/account' as never)} />
          <SettingsRow icon="barbell-outline" label={t('hub.rowTraining')} onPress={() => router.push('/(app)/settings/training' as never)} />
          <SettingsRow icon="nutrition-outline" label={t('hub.rowFoodPreferences')} onPress={() => router.push('/(app)/settings/food-preferences' as never)} />
        </SettingsGroup>
```

- [ ] **Step 4: Claves i18n (es+en)**

En `locales/es/settings.json`, agregar al nivel raíz junto a `"training": {...}`:

```json
  "foodPreferences": {
    "title": "Alergias y disgustos",
    "subtitle": "Se usan para generar y ajustar tus planes alimenticios — nunca se sugiere algo de tu lista de alergias.",
    "allergiesTitle": "Alergias e intolerancias",
    "dislikesTitle": "No me gusta",
    "empty": "Ninguno agregado",
    "addPlaceholder": "Ej: gluten, camarones...",
    "add": "Agregar"
  },
```

Y agregar `"rowFoodPreferences": "Alergias y disgustos"` dentro de `"hub": {...}` junto a `"rowTraining"`.

En `locales/en/settings.json`, el mismo bloque en inglés:

```json
  "foodPreferences": {
    "title": "Allergies & dislikes",
    "subtitle": "Used to generate and adjust your meal plans — anything on your allergy list is never suggested.",
    "allergiesTitle": "Allergies & intolerances",
    "dislikesTitle": "Dislikes",
    "empty": "None added",
    "addPlaceholder": "E.g: gluten, shrimp...",
    "add": "Add"
  },
```

Y `"rowFoodPreferences": "Allergies & dislikes"` dentro de `"hub": {...}`.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 6: Commit**

```bash
git add hooks/useFoodPreferences.ts "app/(app)/settings/food-preferences.tsx" "app/(app)/settings/index.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(fase-d): hook y pantalla de gestión de alergias/disgustos persistidos"
```

---

### Task 3: `generate-meal-plan` lee `food_preferences` — quitar el formulario transitorio

**Files:**
- Modify: `supabase/functions/generate-meal-plan/index.ts`
- Modify: `app/(app)/plans/meal/index.tsx`
- Modify: `hooks/useMealPlan.ts`
- Modify: `constants/mealOptions.ts`
- Modify: `locales/es/plans.json`, `locales/en/plans.json`

**Interfaces:**
- Consumes: tabla `food_preferences` (Task 1).
- Produces: `useGenerateMealPlan()` ya no acepta `allergies` en su parámetro (firma reducida a `{ diet_type: string; food_availability: string }`) — esto lo consumirá cualquier futura pantalla que dispare generación de plan; no hay otro caller hoy además de `meal/index.tsx`.

- [ ] **Step 1: `generate-meal-plan/index.ts` — leer food_preferences en vez de `allergies` del body**

Reemplazar la desestructuración del body (línea 180) y el bloque de sanitización de alergias (línea 183):

```typescript
    const { diet_type: rawDiet = 'omnívoro', food_availability: rawAvailability = 'media' } = body;

    const diet_type = VALID_DIETS.includes(String(rawDiet).toLowerCase()) ? String(rawDiet).toLowerCase() : 'omnívoro';
    const food_availability = VALID_AVAILABILITY.includes(String(rawAvailability).toLowerCase()) ? String(rawAvailability).toLowerCase() : 'media';
```

Agregar la lectura de `food_preferences` al `Promise.all` existente (línea 187-194), que pasa de 3 a 4 queries:

```typescript
    const [goalResult, bodyResult, profileResult, foodPrefResult] = await Promise.all([
      supabase.from('goals').select('type, fitness_level')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('body_data').select('weight_kg, height_cm, age, gender, activity_level')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('language').eq('id', user.id).maybeSingle(),
      supabase.from('food_preferences').select('item, kind').eq('user_id', user.id),
    ]);

    const allergyItems = (foodPrefResult.data ?? []).filter((r) => r.kind === 'allergy').map((r) => r.item);
    const dislikeItems = (foodPrefResult.data ?? []).filter((r) => r.kind === 'dislike').map((r) => r.item);
```

- [ ] **Step 2: `buildMealPlanPrompt` — nueva forma del parámetro de alergias + disgustos**

Cambiar la firma de `buildMealPlanPrompt` (línea 12-24): reemplazar `allergies: string;` por `allergies: string[]; dislikes: string[];`. Cambiar la línea del prompt (línea 50):

```typescript
- Alergias/intolerancias (NUNCA sugerir): ${userData.allergies.join(', ') || 'ninguna'}
- Disgustos declarados (evitar si es posible, no es riesgo de seguridad): ${userData.dislikes.join(', ') || 'ninguno'}
```

Y en el refuerzo final del prompt (línea 95), cambiar `Respeta las alergias e intolerancias indicadas.` por `Respeta ESTRICTAMENTE las alergias indicadas — es una regla de seguridad, no una preferencia. Evita los disgustos declarados salvo que sea imposible por las demás restricciones.`

- [ ] **Step 3: Actualizar la llamada a `buildMealPlanPrompt`**

En la construcción del prompt (línea 219-231), reemplazar `allergies,` por:

```typescript
      allergies: allergyItems,
      dislikes: dislikeItems,
```

- [ ] **Step 4: `hooks/useMealPlan.ts` — quitar `allergies` de la firma de `useGenerateMealPlan`**

```typescript
export function useGenerateMealPlan() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
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

- [ ] **Step 5: `app/(app)/plans/meal/index.tsx` — quitar el formulario de alergias**

Quitar el import de `ALLERGY_NONE, ALLERGY_OPTIONS` (línea 19-20, dejar solo `AVAILABILITY_OPTIONS, DIET_OPTIONS, type MealOption`). Quitar el estado `selectedAllergies` y la función `toggleAllergy` (líneas 80, 86-93). En `handleGenerate` (línea 95-118), quitar la línea de `allergies` y el envío a `generatePlan`:

```typescript
  async function handleGenerate() {
    const diet_type = (selectedDiet[0] ?? DIET_OPTIONS[0].value).toLowerCase();
    const food_availability = (selectedAvailability[0] ?? AVAILABILITY_OPTIONS[1].value).toLowerCase();
    try {
      await generatePlan({ diet_type, food_availability });
      setSelectedDay(0);
    } catch (err: unknown) {
```

(el resto del `catch` queda igual). Quitar el bloque JSX del formulario de alergias (líneas 290-295, el primer `<View>` dentro de `{/* Form */}`), dejando `dietLabel`/`availabilityLabel` como los primeros dos campos.

- [ ] **Step 6: `constants/mealOptions.ts` — quitar `ALLERGY_NONE`/`ALLERGY_OPTIONS`**

Dejar solo `MealOption`, `DIET_OPTIONS`, `AVAILABILITY_OPTIONS` (quitar las líneas 10-18).

- [ ] **Step 7: Limpiar claves i18n huérfanas**

En `locales/es/plans.json` y `locales/en/plans.json`, dentro de `"form": {...}`, quitar `"allergiesLabel"` y el objeto `"allergies": {...}` completo (dejando `dietLabel`, `availabilityLabel`, `diet`, `availability`).

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios (el uso de `t('meal.form.allergiesLabel')` ya no existe en ningún archivo).

Run (curl E2E con un usuario de prueba que tenga `food_preferences` insertadas manualmente):
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"select id from auth.users limit 1;\""
```
Insertar una alergia de prueba para ese `user_id` vía SQL, generar un plan con el flujo normal de la app, y confirmar en los logs de la EF (`sg docker -c "docker logs supabase_edge_runtime_forja --tail 50"`) que el prompt enviado a Anthropic incluye esa alergia. Borrar la fila de prueba al terminar.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/generate-meal-plan/index.ts "app/(app)/plans/meal/index.tsx" hooks/useMealPlan.ts constants/mealOptions.ts locales/es/plans.json locales/en/plans.json
git commit -m "feat(fase-d): generate-meal-plan lee food_preferences persistidas, quita el formulario transitorio de alergias"
```

Tras este commit: `sg docker -c "docker restart supabase_edge_runtime_forja"`.

---

### Task 4: Edge Function `swap-meal` (preview + accept)

**Files:**
- Create: `supabase/functions/swap-meal/logic.ts`
- Create: `supabase/functions/swap-meal/logic.test.ts`
- Create: `supabase/functions/swap-meal/index.ts`

**Interfaces:**
- Consumes: `meal_plans.meals` (JSONB, forma `{title,description,daily_calories,macros,days:[{day_number,day_name,total_calories,meals:[...]}]}`), tabla `food_preferences`, tabla `meal_swaps`, tabla `subscriptions`.
- Produces: HTTP `POST /functions/v1/swap-meal` con body `{ action: 'preview'|'accept', meal_plan_id, day_number, meal_index, attempt_number?, candidate? }` — lo consume Task 5 (`hooks/useMealSwap.ts`).

- [ ] **Step 1: Escribir los tests (fallando)**

```typescript
// supabase/functions/swap-meal/logic.test.ts
import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import {
  applySwap,
  InvalidCandidateError,
  locateMeal,
  MealNotFoundError,
  PlanNotFoundError,
  SwapLimitReachedError,
  swapMealAccept,
  swapMealPreview,
  TooManyAttemptsError,
  validateCandidate,
  type Json,
} from './logic.ts';

const samplePlanMeals: Json = {
  title: 'Plan Hipertrofia',
  days: [
    {
      day_number: 1,
      day_name: 'Lunes',
      total_calories: 2800,
      meals: [
        { meal_type: 'Desayuno', time_suggestion: '7:00', name: 'Avena', calories: 500, protein_g: 30, carbs_g: 60, fat_g: 10, ingredients: ['avena', 'leche'] },
        { meal_type: 'Almuerzo', time_suggestion: '13:00', name: 'Pollo con arroz', calories: 700, protein_g: 50, carbs_g: 80, fat_g: 15, ingredients: ['pollo', 'arroz'] },
      ],
    },
    {
      day_number: 2,
      day_name: 'Martes',
      total_calories: 2800,
      meals: [
        { meal_type: 'Desayuno', time_suggestion: '7:00', name: 'Huevos', calories: 450, protein_g: 32, carbs_g: 20, fat_g: 25, ingredients: ['huevo'] },
      ],
    },
  ],
};

const validCandidate = {
  meal_type: 'Desayuno',
  time_suggestion: '7:30',
  name: 'Yogur con granola',
  calories: 480,
  protein_g: 28,
  carbs_g: 55,
  fat_g: 12,
  ingredients: ['yogur griego', 'granola', 'miel'],
};

Deno.test('validateCandidate acepta forma correcta', () => {
  const result = validateCandidate(validCandidate);
  assertEquals(result.name, 'Yogur con granola');
});

Deno.test('validateCandidate rechaza calories <= 0', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, calories: 0 }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza ingredients vacío', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, ingredients: [] }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza protein_g negativo', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, protein_g: -1 }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza name vacío', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, name: '' }), InvalidCandidateError);
});

Deno.test('locateMeal encuentra el día por day_number, no por posición', () => {
  // day_number:2 está en la posición 1 del array — si locateMeal usara
  // days[dayNumber-1] esto fallaría igual (coincide por casualidad aquí),
  // así que se prueba también con un array reordenado.
  const reordered: Json = { days: [samplePlanMeals.days as Json[]][0].slice().reverse() as unknown as Json };
  const { meal } = locateMeal(reordered, 1, 0);
  assertEquals((meal as Json).name, 'Huevos');
});

Deno.test('locateMeal lanza MealNotFoundError con day_number inexistente', () => {
  assertThrows(() => locateMeal(samplePlanMeals, 99, 0), MealNotFoundError);
});

Deno.test('locateMeal lanza MealNotFoundError con meal_index fuera de rango', () => {
  assertThrows(() => locateMeal(samplePlanMeals, 1, 5), MealNotFoundError);
});

Deno.test('applySwap reemplaza solo la comida indicada, el resto intacto', () => {
  const result = applySwap(samplePlanMeals, 1, 0, validCandidate);
  const days = result.days as Json[];
  assertEquals((days[0].meals as Json[])[0].name, 'Yogur con granola');
  assertEquals((days[0].meals as Json[])[1].name, 'Pollo con arroz');
  assertEquals((days[1].meals as Json[])[0].name, 'Huevos');
});

Deno.test('swapMealPreview: happy path devuelve el candidato validado', async () => {
  const candidate = await swapMealPreview(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      loadFoodPreferences: async () => ({ allergies: ['gluten'], dislikes: [] }),
      callAI: async () => JSON.stringify(validCandidate),
    },
    { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
  );
  assertEquals(candidate.name, 'Yogur con granola');
});

Deno.test('swapMealPreview: rechaza attempt_number > 3', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => JSON.stringify(validCandidate),
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 4, language: 'es' },
    ),
    TooManyAttemptsError,
  );
});

Deno.test('swapMealPreview: plan inexistente lanza PlanNotFoundError', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => null,
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => JSON.stringify(validCandidate),
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
    ),
    PlanNotFoundError,
  );
});

Deno.test('swapMealPreview: respuesta de IA sin JSON lanza InvalidCandidateError', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => 'no soy json',
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
    ),
    InvalidCandidateError,
  );
});

Deno.test('swapMealAccept: happy path llama saveSwap con la forma correcta', async () => {
  let saved: Json | null = null;
  await swapMealAccept(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      countRecentSwaps: async () => 0,
      isPremium: async () => false,
      saveSwap: async (input) => { saved = input as unknown as Json; },
    },
    { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
  );
  assertEquals((saved as unknown as { oldMealName: string }).oldMealName, 'Avena');
  assertEquals((saved as unknown as { newMealName: string }).newMealName, 'Yogur con granola');
});

Deno.test('swapMealAccept: free en el límite semanal lanza SwapLimitReachedError', async () => {
  await assertRejects(
    () => swapMealAccept(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        countRecentSwaps: async () => 3,
        isPremium: async () => false,
        saveSwap: async () => {},
      },
      { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
    ),
    SwapLimitReachedError,
  );
});

Deno.test('swapMealAccept: premium en el límite semanal NO lanza (sin límite)', async () => {
  let called = false;
  await swapMealAccept(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      countRecentSwaps: async () => 50,
      isPremium: async () => true,
      saveSwap: async () => { called = true; },
    },
    { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
  );
  assertEquals(called, true);
});

Deno.test('swapMealAccept: candidato inválido lanza InvalidCandidateError sin llamar saveSwap', async () => {
  let called = false;
  await assertRejects(
    () => swapMealAccept(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        countRecentSwaps: async () => 0,
        isPremium: async () => false,
        saveSwap: async () => { called = true; },
      },
      { dayNumber: 1, mealIndex: 0, candidate: { ...validCandidate, calories: -5 } },
    ),
    InvalidCandidateError,
  );
  assertEquals(called, false);
});
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `cd supabase/functions && deno test swap-meal/logic.test.ts`
Expected: FAIL — `logic.ts` no existe.

- [ ] **Step 3: Implementar `logic.ts`**

```typescript
// supabase/functions/swap-meal/logic.ts
export type Json = Record<string, unknown>;

export class PlanNotFoundError extends Error {}
export class MealNotFoundError extends Error {}
export class InvalidCandidateError extends Error {}
export class SwapLimitReachedError extends Error {}
export class TooManyAttemptsError extends Error {}

export interface MealCandidate {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

const MAX_PREVIEW_ATTEMPTS = 3;
const FREE_WEEKLY_SWAP_LIMIT = 3;

export function validateCandidate(value: unknown): MealCandidate {
  if (typeof value !== 'object' || value === null) throw new InvalidCandidateError('candidate no es un objeto');
  const c = value as Record<string, unknown>;
  if (typeof c.meal_type !== 'string' || c.meal_type.length === 0) throw new InvalidCandidateError('meal_type inválido');
  if (typeof c.time_suggestion !== 'string' || c.time_suggestion.length === 0) throw new InvalidCandidateError('time_suggestion inválido');
  if (typeof c.name !== 'string' || c.name.length === 0) throw new InvalidCandidateError('name inválido');
  if (typeof c.calories !== 'number' || !(c.calories > 0)) throw new InvalidCandidateError('calories inválido');
  for (const f of ['protein_g', 'carbs_g', 'fat_g'] as const) {
    if (typeof c[f] !== 'number' || (c[f] as number) < 0) throw new InvalidCandidateError(`${f} inválido`);
  }
  if (
    !Array.isArray(c.ingredients) ||
    c.ingredients.length === 0 ||
    !c.ingredients.every((i) => typeof i === 'string' && i.length > 0)
  ) {
    throw new InvalidCandidateError('ingredients inválido');
  }
  return {
    meal_type: c.meal_type,
    time_suggestion: c.time_suggestion,
    name: c.name,
    calories: c.calories,
    protein_g: c.protein_g as number,
    carbs_g: c.carbs_g as number,
    fat_g: c.fat_g as number,
    ingredients: c.ingredients as string[],
  };
}

export function locateMeal(
  planMeals: Json,
  dayNumber: number,
  mealIndex: number,
): { dayIndex: number; meal: Json; day: Json } {
  const days = (planMeals.days ?? []) as Json[];
  const dayIndex = days.findIndex((d) => d.day_number === dayNumber);
  if (dayIndex === -1) throw new MealNotFoundError(`día ${dayNumber} no existe`);
  const meals = (days[dayIndex].meals ?? []) as Json[];
  if (mealIndex < 0 || mealIndex >= meals.length) throw new MealNotFoundError(`meal_index ${mealIndex} fuera de rango`);
  return { dayIndex, meal: meals[mealIndex], day: days[dayIndex] };
}

export function applySwap(planMeals: Json, dayNumber: number, mealIndex: number, candidate: MealCandidate): Json {
  const { dayIndex } = locateMeal(planMeals, dayNumber, mealIndex);
  const days = (planMeals.days ?? []) as Json[];
  const newDays = days.map((day, i) => {
    if (i !== dayIndex) return day;
    const meals = (day.meals ?? []) as Json[];
    const newMeals = meals.map((m, j) => (j === mealIndex ? { ...candidate } : m));
    return { ...day, meals: newMeals };
  });
  return { ...planMeals, days: newDays };
}

export function buildSwapPrompt(input: {
  currentMeal: Json;
  otherMeals: Json[];
  allergies: string[];
  dislikes: string[];
  language: 'es' | 'en';
}): string {
  const langLine = input.language === 'en'
    ? 'LANGUAGE: Write ALL text values in ENGLISH.'
    : 'IDIOMA: Escribe TODOS los valores de texto en español.';
  return `Eres un nutriólogo deportivo. El usuario quiere reemplazar UNA comida de su plan por otra con calorías equivalentes. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones.

COMIDA A REEMPLAZAR: ${JSON.stringify(input.currentMeal)}

OTRAS COMIDAS DEL MISMO DÍA (para mantener coherencia de estilo, no las repitas): ${JSON.stringify(input.otherMeals)}

- Alergias/intolerancias (NUNCA sugerir): ${input.allergies.join(', ') || 'ninguna'}
- Disgustos declarados (evitar si es posible): ${input.dislikes.join(', ') || 'ninguno'}
- Calorías objetivo: dentro de ±10% de ${(input.currentMeal as { calories?: number }).calories ?? 0} kcal.
- meal_type debe ser exactamente el mismo que la comida a reemplazar.
- El nombre y los ingredientes deben ser claramente distintos a la comida a reemplazar.

${langLine}

FORMATO JSON REQUERIDO (responde EXACTAMENTE así, un solo objeto de comida):
{ "meal_type": "...", "time_suggestion": "...", "name": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "ingredients": ["..."] }`;
}

export interface PreviewDeps {
  loadMealPlan(): Promise<{ meals: Json } | null>;
  loadFoodPreferences(): Promise<{ allergies: string[]; dislikes: string[] }>;
  callAI(prompt: string): Promise<string>;
}

export async function swapMealPreview(
  deps: PreviewDeps,
  input: { dayNumber: number; mealIndex: number; attemptNumber: number; language: 'es' | 'en' },
): Promise<MealCandidate> {
  if (input.attemptNumber > MAX_PREVIEW_ATTEMPTS) {
    throw new TooManyAttemptsError('máximo de intentos de preview alcanzado');
  }
  const plan = await deps.loadMealPlan();
  if (!plan) throw new PlanNotFoundError('plan no encontrado');
  const { meal: currentMeal, day } = locateMeal(plan.meals, input.dayNumber, input.mealIndex);
  const otherMeals = ((day.meals ?? []) as Json[]).filter((m) => m !== currentMeal);
  const { allergies, dislikes } = await deps.loadFoodPreferences();
  const prompt = buildSwapPrompt({ currentMeal, otherMeals, allergies, dislikes, language: input.language });
  const raw = await deps.callAI(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new InvalidCandidateError('sin JSON en la respuesta de la IA');
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new InvalidCandidateError('JSON inválido de la IA');
  }
  return validateCandidate(parsed);
}

export interface AcceptDeps {
  loadMealPlan(): Promise<{ meals: Json } | null>;
  countRecentSwaps(): Promise<number>;
  isPremium(): Promise<boolean>;
  saveSwap(input: {
    updatedMeals: Json;
    oldMealName: string;
    newMealName: string;
    dayNumber: number;
    mealIndex: number;
  }): Promise<void>;
}

export async function swapMealAccept(
  deps: AcceptDeps,
  input: { dayNumber: number; mealIndex: number; candidate: unknown },
): Promise<void> {
  const candidate = validateCandidate(input.candidate);
  const plan = await deps.loadMealPlan();
  if (!plan) throw new PlanNotFoundError('plan no encontrado');
  const { meal: currentMeal } = locateMeal(plan.meals, input.dayNumber, input.mealIndex);

  const premium = await deps.isPremium();
  if (!premium) {
    const recentCount = await deps.countRecentSwaps();
    if (recentCount >= FREE_WEEKLY_SWAP_LIMIT) throw new SwapLimitReachedError('límite semanal alcanzado');
  }

  const updatedMeals = applySwap(plan.meals, input.dayNumber, input.mealIndex, candidate);
  await deps.saveSwap({
    updatedMeals,
    oldMealName: String((currentMeal as { name?: unknown }).name ?? ''),
    newMealName: candidate.name,
    dayNumber: input.dayNumber,
    mealIndex: input.mealIndex,
  });
}
```

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `cd supabase/functions && deno test swap-meal/logic.test.ts`
Expected: `ok | 16 passed | 0 failed`.

- [ ] **Step 5: Implementar el wrapper HTTP**

```typescript
// supabase/functions/swap-meal/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  InvalidCandidateError,
  MealNotFoundError,
  PlanNotFoundError,
  SwapLimitReachedError,
  swapMealAccept,
  swapMealPreview,
  TooManyAttemptsError,
  type Json,
} from './logic.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'unauthorized' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json(401, { error: 'unauthorized' });

    const body = await req.json().catch(() => null);
    const action = body?.action;
    const mealPlanId = body?.meal_plan_id;
    const dayNumber = body?.day_number;
    const mealIndex = body?.meal_index;

    if (
      (action !== 'preview' && action !== 'accept') ||
      typeof mealPlanId !== 'string' || mealPlanId.length === 0 ||
      typeof dayNumber !== 'number' ||
      typeof mealIndex !== 'number'
    ) {
      return json(400, { error: 'invalid_request' });
    }

    const { data: profileData } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle();
    const language: 'es' | 'en' = profileData?.language === 'en' ? 'en' : 'es';

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const loadMealPlan = async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('meals')
        .eq('id', mealPlanId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data ? { meals: data.meals as Json } : null;
    };

    if (action === 'preview') {
      const attemptNumber = typeof body?.attempt_number === 'number' ? body.attempt_number : 1;
      const candidate = await swapMealPreview(
        {
          loadMealPlan,
          loadFoodPreferences: async () => {
            const { data } = await supabase.from('food_preferences').select('item, kind').eq('user_id', user.id);
            const rows = data ?? [];
            return {
              allergies: rows.filter((r) => r.kind === 'allergy').map((r) => r.item),
              dislikes: rows.filter((r) => r.kind === 'dislike').map((r) => r.item),
            };
          },
          callAI: async (prompt) => {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
              }),
            });
            if (!res.ok) {
              console.error('Anthropic error:', await res.text());
              throw new Error('ai_error');
            }
            const result = await res.json();
            if (result.stop_reason === 'max_tokens') throw new Error('ai_error');
            return result.content?.[0]?.text ?? '';
          },
        },
        { dayNumber, mealIndex, attemptNumber, language },
      );
      return json(200, { candidate });
    }

    // action === 'accept'
    await swapMealAccept(
      {
        loadMealPlan,
        countRecentSwaps: async () => {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from('meal_swaps')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo);
          return count ?? 0;
        },
        isPremium: async () => {
          const { data } = await supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle();
          return data?.status === 'active' && data?.plan !== 'free';
        },
        saveSwap: async ({ updatedMeals, oldMealName, newMealName, dayNumber: dn, mealIndex: mi }) => {
          const { error: updateError } = await admin
            .from('meal_plans')
            .update({ meals: updatedMeals, translations: {} })
            .eq('id', mealPlanId);
          if (updateError) throw updateError;
          const { error: insertError } = await admin.from('meal_swaps').insert({
            user_id: user.id,
            meal_plan_id: mealPlanId,
            day_number: dn,
            meal_index: mi,
            old_meal_name: oldMealName,
            new_meal_name: newMealName,
          });
          if (insertError) throw insertError;
        },
      },
      { dayNumber, mealIndex, candidate: body?.candidate },
    );
    return json(200, { success: true });
  } catch (err) {
    if (err instanceof PlanNotFoundError || err instanceof MealNotFoundError) return json(404, { error: 'not_found' });
    if (err instanceof InvalidCandidateError) return json(400, { error: 'invalid_candidate' });
    if (err instanceof TooManyAttemptsError) return json(429, { error: 'too_many_attempts' });
    if (err instanceof SwapLimitReachedError) return json(429, { error: 'meal_swap_limit_reached' });
    if (err instanceof Error && err.message === 'ai_error') return json(502, { error: 'ai_error' });
    console.error('swap-meal error:', err);
    return json(500, { error: 'internal_error' });
  }
});
```

- [ ] **Step 6: Reiniciar el runtime y verificar con curl**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja"` (EF nueva — si no responde tras el restart, usar `supabase stop && supabase start` según la nota operativa del proyecto).

Con un JWT real de un usuario de prueba con un plan alimenticio activo, y `plan_id`/`day_number`/`meal_index` reales de ese plan:

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/swap-meal \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"action":"preview","meal_plan_id":"<PLAN_ID>","day_number":1,"meal_index":0,"attempt_number":1}'
```
Expected: `200 { "candidate": { "meal_type": ..., "calories": ... } }`.

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/swap-meal \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"action":"accept","meal_plan_id":"<PLAN_ID>","day_number":1,"meal_index":0,"candidate":<CANDIDATO_DEL_PASO_ANTERIOR>}'
```
Expected: `200 { "success": true }`. Verificar en DB que `meal_plans.meals` cambió esa comida y `meal_plans.translations` quedó `{}`, y que se insertó una fila en `meal_swaps`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/swap-meal/
git commit -m "feat(fase-d): Edge Function swap-meal (preview + accept) con límite semanal y reset de traducciones"
```

---

### Task 5: UI de swap en el plan alimenticio

**Files:**
- Modify: `lib/limits.ts`
- Create: `hooks/useMealSwap.ts`
- Create: `components/plans/MealSwapSheet.tsx`
- Modify: `components/plans/MealPlanCard.tsx`
- Modify: `app/(app)/plans/meal/index.tsx`
- Modify: `locales/es/plans.json`, `locales/en/plans.json`

**Interfaces:**
- Consumes: EF `swap-meal` (Task 4).
- Produces: `MealPlanCard` gana prop `onPressSwap?: () => void` — consumida solo por `meal/index.tsx` en este plan.

- [ ] **Step 1: Constantes de límite**

En `lib/limits.ts`, agregar a `FREE_LIMITS`:

```typescript
export const FREE_LIMITS = {
  MESSAGES_PER_DAY: 20,
  WORKOUT_PLANS_PER_MONTH: 1,
  WORKOUT_PLAN_MODIFICATIONS_PER_MONTH: 3,
  BODY_HISTORY_DAYS: 14,
  MEAL_PLANS_LIFETIME: 1,
  MEAL_SWAPS_PER_WEEK: 3,
} as const;

export const MEAL_SWAP_PREVIEW_ATTEMPTS_MAX = 3;
```

- [ ] **Step 2: Hook de swap**

```typescript
// hooks/useMealSwap.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export interface MealCandidate {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

function useSwapFetch() {
  const { session } = useAuthStore();
  return async (body: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/swap-meal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  };
}

export function useSwapMealPreview() {
  const swapFetch = useSwapFetch();
  return useMutation({
    mutationFn: async (params: { mealPlanId: string; dayNumber: number; mealIndex: number; attemptNumber: number }) => {
      const data = await swapFetch({
        action: 'preview',
        meal_plan_id: params.mealPlanId,
        day_number: params.dayNumber,
        meal_index: params.mealIndex,
        attempt_number: params.attemptNumber,
      });
      return data.candidate as MealCandidate;
    },
  });
}

export function useSwapMealAccept() {
  const swapFetch = useSwapFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { mealPlanId: string; dayNumber: number; mealIndex: number; candidate: MealCandidate }) => {
      await swapFetch({
        action: 'accept',
        meal_plan_id: params.mealPlanId,
        day_number: params.dayNumber,
        meal_index: params.mealIndex,
        candidate: params.candidate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal_plan'] });
      queryClient.invalidateQueries({ queryKey: ['meal_swaps_this_week'] });
    },
  });
}

export function useSwapsUsedThisWeek() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['meal_swaps_this_week', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('meal_swaps')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('created_at', sevenDaysAgo);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
```

- [ ] **Step 3: Sheet de swap**

```tsx
// components/plans/MealSwapSheet.tsx
import { forwardRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MacroBar } from '@/components/plans/MacroBar';
import { useTheme } from '@/lib/theme';
import { MEAL_SWAP_PREVIEW_ATTEMPTS_MAX } from '@/lib/limits';
import { useSwapMealAccept, useSwapMealPreview, type MealCandidate } from '@/hooks/useMealSwap';

interface MealSwapSheetProps {
  mealPlanId: string;
  dayNumber: number;
  mealIndex: number;
  onDone: () => void;
}

export const MealSwapSheet = forwardRef<BottomSheet, MealSwapSheetProps>(function MealSwapSheet(
  { mealPlanId, dayNumber, mealIndex, onDone },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation('plans');
  const [attempt, setAttempt] = useState(0);
  const [candidate, setCandidate] = useState<MealCandidate | null>(null);
  const { mutateAsync: preview, isPending: previewing, error: previewError } = useSwapMealPreview();
  const { mutateAsync: accept, isPending: accepting } = useSwapMealAccept();

  async function requestPreview() {
    const nextAttempt = attempt + 1;
    setAttempt(nextAttempt);
    const result = await preview({ mealPlanId, dayNumber, mealIndex, attemptNumber: nextAttempt });
    setCandidate(result);
  }

  async function handleAccept() {
    if (!candidate) return;
    await accept({ mealPlanId, dayNumber, mealIndex, candidate });
    setAttempt(0);
    setCandidate(null);
    onDone();
  }

  function handleCancel() {
    setAttempt(0);
    setCandidate(null);
    onDone();
  }

  return (
    <Sheet ref={ref} snapPoints={['60%']} scrollable>
      <View style={{ paddingTop: 8 }}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 25, color: colors.text }}>
          {t('mealSwap.title')}
        </Text>

        {!candidate && !previewing ? (
          <TouchableOpacity
            onPress={requestPreview}
            style={{ marginTop: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>
              {t('mealSwap.propose')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {previewing ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}

        {previewError ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Inter-Regular', fontSize: 12.5, marginTop: 12 }}>
            {t('mealSwap.previewError')}
          </Text>
        ) : null}

        {candidate ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 16, color: colors.text }}>{candidate.name}</Text>
            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
              {candidate.calories} kcal
            </Text>
            <View style={{ marginTop: 10 }}>
              <MacroBar protein_g={candidate.protein_g} carbs_g={candidate.carbs_g} fat_g={candidate.fat_g} />
            </View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 11, color: colors.textMuted, marginTop: 14, marginBottom: 4 }}>
              {t('meal.card.ingredients')}
            </Text>
            {candidate.ingredients.map((ing, i) => (
              <Text key={i} style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}>• {ing}</Text>
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={accepting}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center', opacity: accepting ? 0.6 : 1 }}
              >
                {accepting ? <ActivityIndicator color={colors.onPrimary} /> : (
                  <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>{t('mealSwap.accept')}</Text>
                )}
              </TouchableOpacity>
              {attempt < MEAL_SWAP_PREVIEW_ATTEMPTS_MAX ? (
                <TouchableOpacity
                  onPress={requestPreview}
                  disabled={previewing}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 13.5 }}>{t('mealSwap.another')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {attempt >= MEAL_SWAP_PREVIEW_ATTEMPTS_MAX ? (
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                {t('mealSwap.attemptsExhausted')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity onPress={handleCancel} style={{ marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 13 }}>{t('mealSwap.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
});
```

- [ ] **Step 4: `MealPlanCard` gana el botón de swap**

En `components/plans/MealPlanCard.tsx`, agregar la prop y el botón. Cambiar la firma (línea 19) y agregar el ícono de swap junto al chevron (línea 57-62):

```tsx
export function MealPlanCard({ meal, onPressSwap }: { meal: Meal; onPressSwap?: () => void }) {
```

```tsx
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginTop: 2, gap: 10 }}>
          {onPressSwap ? (
            <TouchableOpacity onPress={onPressSwap} hitSlop={8}>
              <Ionicons name="swap-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>
```

(reemplaza el `<Ionicons name={expanded ...} .../>` suelto que hoy está ahí, envolviéndolo junto al nuevo botón en un `View` fila).

- [ ] **Step 5: Wiring en `meal/index.tsx`**

Agregar imports y estado:

```tsx
import { useRef, useState } from 'react';
import type BottomSheet from '@gorhom/bottom-sheet';
import { MealSwapSheet } from '@/components/plans/MealSwapSheet';
import { FREE_LIMITS } from '@/lib/limits';
import { useSwapsUsedThisWeek } from '@/hooks/useMealSwap';
```

(`useState` ya está importado; agregar `useRef` al mismo import). Dentro del componente, junto a `selectedDay`:

```tsx
  const swapSheetRef = useRef<BottomSheet>(null);
  const [activeSwap, setActiveSwap] = useState<{ dayNumber: number; mealIndex: number } | null>(null);
  const { data: swapsUsed } = useSwapsUsedThisWeek();
  const swapLimitReached = !isPremium && (swapsUsed ?? 0) >= FREE_LIMITS.MEAL_SWAPS_PER_WEEK;
```

Cambiar el render de las comidas del día (línea 236-238):

```tsx
                {currentDay.meals.map((meal, i) => (
                  <MealPlanCard
                    key={i}
                    meal={meal}
                    onPressSwap={swapLimitReached ? undefined : () => {
                      setActiveSwap({ dayNumber: currentDay.day_number, mealIndex: i });
                      swapSheetRef.current?.expand();
                    }}
                  />
                ))}
```

Montar el sheet antes de cerrar el `Animated.View` (después del `</ScrollView>`, dentro del mismo contenedor que lo envuelve):

```tsx
      {activePlan ? (
        <MealSwapSheet
          ref={swapSheetRef}
          mealPlanId={activePlan.id}
          dayNumber={activeSwap?.dayNumber ?? 0}
          mealIndex={activeSwap?.mealIndex ?? 0}
          onDone={() => {
            swapSheetRef.current?.close();
            setActiveSwap(null);
          }}
        />
      ) : null}
```

- [ ] **Step 6: Claves i18n (es+en)**

En `locales/es/plans.json`, agregar junto a `"card": {...}`:

```json
  "mealSwap": {
    "title": "Cambiar comida",
    "propose": "Proponer otra opción",
    "previewError": "No se pudo generar una propuesta. Intenta de nuevo.",
    "accept": "Aceptar",
    "another": "Otra opción",
    "attemptsExhausted": "Elige una de las opciones anteriores o cancela.",
    "cancel": "Cancelar"
  },
```

En `locales/en/plans.json`:

```json
  "mealSwap": {
    "title": "Swap meal",
    "propose": "Propose another option",
    "previewError": "Couldn't generate a proposal. Try again.",
    "accept": "Accept",
    "another": "Another option",
    "attemptsExhausted": "Pick one of the previous options or cancel.",
    "cancel": "Cancel"
  },
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 8: Commit**

```bash
git add lib/limits.ts hooks/useMealSwap.ts components/plans/MealSwapSheet.tsx components/plans/MealPlanCard.tsx "app/(app)/plans/meal/index.tsx" locales/es/plans.json locales/en/plans.json
git commit -m "feat(fase-d): UI de swap de comida con preview, límite semanal y sheet de confirmación"
```

---

### Task 6: Onboarding paso 5 — trayectoria competitiva + suplementación

**Files:**
- Create: `app/(auth)/onboarding/step-5-athletic.tsx`
- Modify: `app/(auth)/onboarding/step-4-level.tsx`
- Modify: `store/onboarding.store.ts`
- Modify: `constants/goals.ts`
- Modify: `locales/es/onboarding.json`, `locales/en/onboarding.json`

**Interfaces:**
- Consumes: columnas `goals.athletic_background`, `profiles.supplements`, `profiles.supplements_other` (Task 1).
- Produces: `ATHLETIC_BACKGROUNDS`, `SUPPLEMENTS` constantes exportadas de `constants/goals.ts`, reusadas por Task 7 (edición en Ajustes).

**Hallazgo de arquitectura (verificado leyendo `app/_layout.tsx:102-116`):** el `AuthGuard` redirige a `/(app)` en cuanto `onboardingCompleted === true` Y la ruta activa está en el grupo `(auth)` — es un `useEffect` reactivo al store, no una comprobación puntual. Si el paso 4 marca `onboarding_completed = true` y ENTONCES navega al paso 5 (que sigue dentro de `(auth)/onboarding/`), el guard expulsaría al usuario a `/(app)` antes de que el paso 5 renderice. Por eso el marcado de `onboarding_completed` (DB + store) y la celebración se MUEVEN del paso 4 al paso 5 — el paso 4 solo inserta sus filas y navega, sin completar el onboarding todavía.

- [ ] **Step 1: `constants/goals.ts` — nuevas constantes**

Agregar al final del archivo:

```typescript
export type AthleticBackground = 'none' | 'amateur' | 'high_performance' | 'bodybuilding';

export const ATHLETIC_BACKGROUNDS: { value: AthleticBackground; labelKey: string }[] = [
  { value: 'none',             labelKey: 'onboarding:step5.background.none' },
  { value: 'amateur',          labelKey: 'onboarding:step5.background.amateur' },
  { value: 'high_performance', labelKey: 'onboarding:step5.background.highPerformance' },
  { value: 'bodybuilding',     labelKey: 'onboarding:step5.background.bodybuilding' },
];

export type SupplementCode = 'creatine' | 'protein' | 'caffeine_preworkout' | 'multivitamin' | 'omega3' | 'none';

export const SUPPLEMENTS: { value: SupplementCode; labelKey: string }[] = [
  { value: 'creatine',            labelKey: 'onboarding:step5.supplements.creatine' },
  { value: 'protein',             labelKey: 'onboarding:step5.supplements.protein' },
  { value: 'caffeine_preworkout', labelKey: 'onboarding:step5.supplements.caffeine' },
  { value: 'multivitamin',        labelKey: 'onboarding:step5.supplements.multivitamin' },
  { value: 'omega3',              labelKey: 'onboarding:step5.supplements.omega3' },
  { value: 'none',                labelKey: 'onboarding:step5.supplements.none' },
];
```

- [ ] **Step 2: `store/onboarding.store.ts` — capturar el id del goal**

```typescript
import { create } from 'zustand';
import type { ModalityId } from '@/constants/modalities';

type GoalType = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'powerlifting' | 'sport_specific' | 'general_fitness';
type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';
type Mode = 'flexible' | 'strict';

interface OnboardingState {
  // Step 1
  goalType: GoalType | null;
  targetWeightKg: number | null;
  // Step 2 — modalidad
  modality: ModalityId | null;
  secondaryModalities: ModalityId[];
  sportType: string | null;
  // Step 3 — cuerpo
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: Gender | null;
  activityLevel: ActivityLevel | null;
  // Step 4 — nivel
  fitnessLevel: FitnessLevel | null;
  mode: Mode;
  // Step 4 → 5 — id del goal recién insertado, para que el paso 5 lo actualice
  goalId: string | null;
  // Actions
  setStep1: (data: { goalType: GoalType; targetWeightKg?: number | null }) => void;
  setStep2Modality: (data: { modality: ModalityId; secondaryModalities: ModalityId[]; sportType?: string | null }) => void;
  setStep2: (data: { weightKg: number; heightCm: number; age: number; gender: Gender; activityLevel: ActivityLevel }) => void;
  setStep3: (data: { fitnessLevel: FitnessLevel; mode: Mode }) => void;
  setGoalId: (goalId: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  goalType: null,
  targetWeightKg: null,
  modality: null,
  secondaryModalities: [],
  sportType: null,
  weightKg: null,
  heightCm: null,
  age: null,
  gender: null,
  activityLevel: null,
  fitnessLevel: null,
  mode: 'flexible',
  goalId: null,
  setStep1: (data) => set({ goalType: data.goalType, targetWeightKg: data.targetWeightKg ?? null }),
  setStep2Modality: (data) =>
    set({
      modality: data.modality,
      secondaryModalities: data.secondaryModalities,
      sportType: data.sportType ?? null,
    }),
  setStep2: (data) => set(data),
  setStep3: (data) => set(data),
  setGoalId: (goalId) => set({ goalId }),
  reset: () => set({
    goalType: null, targetWeightKg: null,
    modality: null, secondaryModalities: [], sportType: null,
    weightKg: null, heightCm: null, age: null, gender: null, activityLevel: null,
    fitnessLevel: null, mode: 'flexible', goalId: null,
  }),
}));
```

- [ ] **Step 3: `step-4-level.tsx` — ya no completa el onboarding, navega al paso 5**

Reemplazar `handleFinish` (líneas 28-84): el insert de `goals` gana `.select('id').single()`, se quita el `update` de `profiles.onboarding_completed` y el `setCelebrating(true)`, y en su lugar se guarda `goalId` en el store y se navega al paso 5.

```typescript
  async function handleFinish() {
    if (!fitnessLevel || !mode) {
      Alert.alert(t('step4.errors.missingSelection.title'), t('step4.errors.missingSelection.body'));
      return;
    }
    if (!user || !goalType || !weightKg || !heightCm || !age || !gender || !activityLevel) {
      Alert.alert(t('step4.errors.missingData.title'), t('step4.errors.missingData.body'));
      return;
    }

    setLoading(true);
    try {
      // Guardar body_data
      const { error: bodyError } = await supabase.from('body_data').insert({
        user_id: user.id,
        weight_kg: weightKg,
        height_cm: heightCm,
        age,
        gender,
        activity_level: activityLevel,
      });
      if (bodyError) throw bodyError;

      // Guardar goal — se captura el id: el paso 5 (opcional) lo usa para
      // agregar athletic_background sin crear un segundo goal duplicado.
      const { data: newGoal, error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
      }).select('id').single();
      if (goalError || !newGoal) throw goalError ?? new Error('goal insert sin id');

      setGoalId(newGoal.id);
      // onboarding_completed se marca en el paso 5 (opcional) — si se marca
      // aquí, el AuthGuard expulsa a /(app) antes de que el paso 5 renderice
      // (ver app/_layout.tsx:113, redirige tan pronto onboardingCompleted=true
      // y la ruta activa sigue en el grupo (auth)).
      router.push('/(auth)/onboarding/step-5-athletic');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step4.errors.unknown');
      Alert.alert(t('step4.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }
```

Quitar el estado `celebrating`/`setCelebrating` (línea 20, 161, 172-178) y el `<SparkBurst .../>` al final del componente (se mueve al paso 5). Quitar `useRouter`... no, `router` sigue usándose (`router.push`), mantener el import. Quitar el import de `useProfileStore`/`setOnboardingCompleted` (línea 9, 24) — ya no se usan en este archivo. Agregar el import de `useOnboardingStore`'s `setGoalId`:

```typescript
  const { goalType, targetWeightKg, modality, secondaryModalities, sportType, weightKg, heightCm, age, gender, activityLevel, setGoalId } = useOnboardingStore();
```

- [ ] **Step 4: Pantalla nueva `step-5-athletic.tsx`**

```tsx
// app/(auth)/onboarding/step-5-athletic.tsx
import { useState } from 'react';
import { Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { useTheme } from '@/lib/theme';
import { ATHLETIC_BACKGROUNDS, SUPPLEMENTS, type AthleticBackground, type SupplementCode } from '@/constants/goals';
import { Input } from '@/components/ui/Input';

export default function Step5Athletic() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [background, setBackground] = useState<AthleticBackground | null>(null);
  const [supplements, setSupplements] = useState<SupplementCode[]>([]);
  const [supplementsOther, setSupplementsOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { goalId, reset } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function toggleSupplement(value: SupplementCode) {
    setSupplements((prev) => {
      if (value === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((s) => s !== 'none');
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }

  async function finishOnboarding() {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id);
    if (error) throw error;
    setCelebrating(true);
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      if (goalId && background) {
        const { error: goalError } = await supabase.from('goals').update({ athletic_background: background }).eq('id', goalId);
        if (goalError) throw goalError;
      }
      const supplementsOtherTrimmed = supplementsOther.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      if (supplements.length > 0) {
        const { error: profileError } = await supabase.from('profiles').update({
          supplements,
          supplements_other: supplementsOtherTrimmed || null,
        }).eq('id', user.id);
        if (profileError) throw profileError;
      }
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text className="text-text-muted text-sm font-medium mb-1">{t('step5.eyebrow')}</Text>
          <Text className="text-text font-bold text-3xl">{t('step5.title')}</Text>
          <Text className="text-text-muted text-base mt-2">{t('step5.subtitle')}</Text>
        </View>

        <Text className="text-text font-semibold text-base mb-3">{t('step5.backgroundQuestion')}</Text>
        <View className="gap-2 mb-8">
          {ATHLETIC_BACKGROUNDS.map((b) => {
            const isSelected = background === b.value;
            return (
              <TouchableOpacity
                key={b.value}
                onPress={() => setBackground(b.value)}
                className={`p-4 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-text'}`}>{t(b.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-text font-semibold text-base mb-3">{t('step5.supplementsQuestion')}</Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {SUPPLEMENTS.map((s) => {
            const isSelected = supplements.includes(s.value);
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => toggleSupplement(s.value)}
                className={`rounded-full px-4 py-2 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={`text-sm ${isSelected ? 'text-primary' : 'text-text'}`}>{t(s.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!supplements.includes('none') ? (
          <Input
            placeholder={t('step5.otherPlaceholder')}
            value={supplementsOther}
            onChangeText={setSupplementsOther}
          />
        ) : null}

        <View className="mt-6 p-3 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('step5.safetyNote')}
          </Text>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border gap-2"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="rounded-xl h-14 items-center justify-center bg-primary"
          onPress={handleFinish}
          disabled={loading || celebrating}
        >
          {loading ? <ActivityIndicator color={colors.background} /> : (
            <Text className="font-bold text-base text-background">{t('step5.finishButton')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading || celebrating} className="items-center py-2">
          <Text className="text-text-muted text-sm font-medium">{t('step5.skipButton')}</Text>
        </TouchableOpacity>
      </View>

      <SparkBurst
        trigger={celebrating}
        onDone={() => {
          setOnboardingCompleted(true);
          reset();
          router.replace('/(app)');
        }}
      />
    </View>
  );
}
```

- [ ] **Step 5: Claves i18n (es+en)**

En `locales/es/onboarding.json`, agregar junto a `"step4": {...}`:

```json
  "step5": {
    "eyebrow": "Último paso (opcional)",
    "title": "Contexto extra para tu coach",
    "subtitle": "Esto es solo contexto para tu coach — nunca te recomendaremos ni indicaremos dosis de sustancias.",
    "backgroundQuestion": "¿Tienes trayectoria competitiva?",
    "background": {
      "none": "Nunca he competido",
      "amateur": "Amateur",
      "highPerformance": "Alto rendimiento",
      "bodybuilding": "Fisicoculturismo"
    },
    "supplementsQuestion": "¿Tomas algún suplemento?",
    "supplements": {
      "creatine": "Creatina",
      "protein": "Proteína",
      "caffeine": "Cafeína/pre-entreno",
      "multivitamin": "Multivitamínico",
      "omega3": "Omega-3",
      "none": "Ninguno"
    },
    "otherPlaceholder": "Otro (opcional)",
    "safetyNote": "Esto es solo contexto para tu coach — nunca te recomendaremos ni indicaremos dosis de sustancias.",
    "finishButton": "Forjar mi plan 🔥",
    "skipButton": "Omitir",
    "errors": {
      "saveFailed": { "title": "Error al guardar" },
      "unknown": "Error desconocido"
    }
  },
```

En `locales/en/onboarding.json`, el mismo bloque en inglés:

```json
  "step5": {
    "eyebrow": "Last step (optional)",
    "title": "Extra context for your coach",
    "subtitle": "This is just context for your coach — we'll never recommend or dose substances.",
    "backgroundQuestion": "Do you have a competitive background?",
    "background": {
      "none": "Never competed",
      "amateur": "Amateur",
      "highPerformance": "High performance",
      "bodybuilding": "Bodybuilding"
    },
    "supplementsQuestion": "Do you take any supplements?",
    "supplements": {
      "creatine": "Creatine",
      "protein": "Protein",
      "caffeine": "Caffeine/pre-workout",
      "multivitamin": "Multivitamin",
      "omega3": "Omega-3",
      "none": "None"
    },
    "otherPlaceholder": "Other (optional)",
    "safetyNote": "This is just context for your coach — we'll never recommend or dose substances.",
    "finishButton": "Forge my plan 🔥",
    "skipButton": "Skip",
    "errors": {
      "saveFailed": { "title": "Save failed" },
      "unknown": "Unknown error"
    }
  },
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/onboarding/step-5-athletic.tsx" "app/(auth)/onboarding/step-4-level.tsx" store/onboarding.store.ts constants/goals.ts locales/es/onboarding.json locales/en/onboarding.json
git commit -m "feat(fase-d): onboarding paso 5 opcional — trayectoria competitiva y suplementación"
```

---

### Task 7: Editar trayectoria/suplementos en Ajustes

**Files:**
- Modify: `app/(app)/settings/training.tsx`
- Modify: `hooks/useProfile.ts`
- Modify: `locales/es/settings.json`, `locales/en/settings.json`

**Interfaces:**
- Consumes: `ATHLETIC_BACKGROUNDS`, `SUPPLEMENTS` (Task 6).

- [ ] **Step 1: `hooks/useProfile.ts` — `useUpdateProfile` acepta `supplements`/`supplements_other`**

Ampliar el tipo de `updates` en `useUpdateProfile` (línea 47-53):

```typescript
    mutationFn: async (updates: {
      display_name?: string;
      language?: string;
      expo_push_token?: string;
      avatar_url?: string;
      notif_reminders?: boolean;
      notif_updates?: boolean;
      supplements?: string[];
      supplements_other?: string | null;
    }) => {
```

- [ ] **Step 2: `training.tsx` — agregar chips de trayectoria/suplementos al flujo existente**

Importar las constantes nuevas y el hook de perfil (línea 12 y 8-16 respectivamente):

```typescript
import { GOALS, FITNESS_LEVELS, MODES, ATHLETIC_BACKGROUNDS, SUPPLEMENTS, type GoalType, type FitnessLevel, type TrainingMode, type AthleticBackground, type SupplementCode } from '@/constants/goals';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
```

Agregar estado nuevo junto a los existentes (línea 55-65):

```typescript
  const [background, setBackground] = useState<AthleticBackground | null>(null);
  const [supplements, setSupplements] = useState<SupplementCode[]>([]);
  const [supplementsOther, setSupplementsOther] = useState('');
```

Agregar `const { data: profile } = useProfile();` y `const updateProfile = useUpdateProfile();` junto a las queries existentes (línea 51-53).

En el `useEffect` de precarga (línea 68-84), agregar:

```typescript
    if (goal) {
      setGoalType(goal.type as GoalType);
      setLevel(goal.fitness_level as FitnessLevel);
      setMode(goal.mode as TrainingMode);
      setModality((goal.modality as ModalityId) ?? null);
      setSecondary((goal.secondary_modalities as ModalityId[]) ?? []);
      setSportType(goal.sport_type ?? '');
      setBackground((goal.athletic_background as AthleticBackground) ?? null);
    }
    if (profile) {
      setSupplements((profile.supplements as SupplementCode[]) ?? []);
      setSupplementsOther(profile.supplements_other ?? '');
    }
```

(la condición del `useEffect` en la línea 69 gana `|| profile === undefined` al chequeo de `loaded`).

Agregar `toggleSupplement` junto a `toggleSecondary` (línea 89-95):

```typescript
  function toggleSupplement(value: SupplementCode) {
    setSupplements((prev) => {
      if (value === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((s) => s !== 'none');
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }
```

En `handleSave` (línea 97-166), agregar `athletic_background: background` al insert de `goals` (línea 119-129):

```typescript
      const { error: goalErr } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: goal?.target_weight_kg ?? null,
        target_date: goal?.target_date ?? null,
        fitness_level: level,
        mode,
        modality,
        secondary_modalities: secondary,
        sport_type: needsSport && sportType.trim() ? sportType.trim() : null,
        athletic_background: background,
      });
```

Y después del bloque de `body_data` (línea 138-150), antes del `queryClient.invalidateQueries`, agregar el update de perfil:

```typescript
      const supplementsOtherTrimmed = supplementsOther.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      await new Promise<void>((resolve, reject) => {
        updateProfile.mutate(
          { supplements, supplements_other: supplementsOtherTrimmed || null },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });
```

Agregar el JSX de las dos nuevas secciones antes de `<View className="mt-8 gap-2">` (línea 241):

```tsx
        <SectionTitle>{t('training.athleticBackground')}</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {ATHLETIC_BACKGROUNDS.map((b) => (
            <Chip key={b.value} selected={background === b.value} label={t(b.labelKey)} onPress={() => setBackground(b.value)} />
          ))}
        </View>

        <SectionTitle>{t('training.supplements')}</SectionTitle>
        <View className="flex-row flex-wrap gap-2 mb-2">
          {SUPPLEMENTS.map((s) => (
            <Chip key={s.value} selected={supplements.includes(s.value)} label={t(s.labelKey)} onPress={() => toggleSupplement(s.value)} />
          ))}
        </View>
        {!supplements.includes('none') ? (
          <Input placeholder={t('training.supplementsOtherPlaceholder')} value={supplementsOther} onChangeText={setSupplementsOther} />
        ) : null}
```

- [ ] **Step 3: Claves i18n (es+en)**

En `locales/es/settings.json`, dentro de `"training": {...}`, agregar:

```json
  "athleticBackground": "Trayectoria competitiva",
  "supplements": "Suplementación",
  "supplementsOtherPlaceholder": "Otro (opcional)",
```

En `locales/en/settings.json`:

```json
  "athleticBackground": "Competitive background",
  "supplements": "Supplements",
  "supplementsOtherPlaceholder": "Other (optional)",
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/settings/training.tsx" hooks/useProfile.ts locales/es/settings.json locales/en/settings.json
git commit -m "feat(fase-d): editar trayectoria competitiva y suplementación en Ajustes"
```

---

### Task 8: Guardrail de suplementos en `generate-plan` y `generate-meal-plan`

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts`
- Modify: `supabase/functions/generate-meal-plan/index.ts`

**Interfaces:**
- Consumes: `goals.athletic_background`, `profiles.supplements`, `profiles.supplements_other` (Task 1).

- [ ] **Step 1: `generate-plan/index.ts` — leer los campos nuevos**

Ampliar el `select` de `goals` (línea 220-228) y `profiles` (línea 236):

```typescript
      supabase
        .from('goals')
        .select('type, fitness_level, mode, sport_type, athletic_background')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('body_data')
        .select('weight_kg, height_cm, age, gender, activity_level')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('profiles').select('language, supplements, supplements_other').eq('id', user.id).maybeSingle(),
```

- [ ] **Step 2: `buildPlanPrompt` — nuevos parámetros y guardrail**

Ampliar la firma de `buildPlanPrompt` (línea 22-40), agregando después de `catalogBlock: string;`:

```typescript
  athleticBackground: string | null;
  supplements: string[];
  supplementsOther: string | null;
```

Agregar dos `const` NUEVAS dentro de `buildPlanPrompt`, junto a `goalMap`/`levelMap` (antes del `return` que arma el prompt, línea ~58 original) — se calculan una vez y se interpolan como variables simples, igual que el resto de líneas condicionales del prompt (`${userData.injuries ? ... : ''}`):

```typescript
  const backgroundMap: Record<string, string> = {
    amateur: 'competidor amateur',
    high_performance: 'competidor de alto rendimiento',
    bodybuilding: 'fisicoculturismo competitivo',
  };
  const backgroundLine = userData.athleticBackground && userData.athleticBackground !== 'none'
    ? `- Trayectoria competitiva declarada: ${backgroundMap[userData.athleticBackground] ?? userData.athleticBackground} — ajusta el volumen/periodización si es relevante (p.ej. fisicoculturismo puede justificar mayor volumen de aislamiento).\n`
    : '';
  const supplementsList = userData.supplements.filter((s) => s !== 'none');
  const supplementsLine = supplementsList.length > 0 || userData.supplementsOther
    ? `- Suplementación declarada (SOLO contexto): ${[...supplementsList, userData.supplementsOther].filter(Boolean).join(', ')}\nREGLA DE SEGURIDAD: el dato de suplementación es únicamente contexto (p.ej. no dupliques una recomendación de proteína si el usuario ya toma un shake). Bajo NINGUNA circunstancia recomiendes, apruebes, sugieras dosis, o valides el uso de sustancias o suplementos.\n`
    : '';
```

Y dentro del `return \`...\`` que arma el prompt, agregar `${backgroundLine}${supplementsLine}` como línea nueva justo después del bloque `PERFIL DEL USUARIO` (después de la línea con `injuries`, antes del bloque de idioma):

```typescript
${userData.injuries ? `- Lesiones o limitaciones: ${userData.injuries}` : ''}
${backgroundLine}${supplementsLine}
${userData.language === 'en'
```

- [ ] **Step 3: `generate-plan/index.ts` — pasar los campos nuevos a `buildPlanPrompt`**

En la construcción del prompt (línea 276-294), agregar tres campos al objeto:

```typescript
    const prompt = buildPlanPrompt({
      goal_type: goal.type,
      fitness_level: goal.fitness_level,
      sport_type: goal.sport_type,
      mode: goal.mode,
      weight_kg: body_data?.weight_kg ? Number(body_data.weight_kg) : null,
      height_cm: body_data?.height_cm ? Number(body_data.height_cm) : null,
      age: body_data?.age ?? null,
      gender: body_data?.gender ?? null,
      activity_level: body_data?.activity_level ?? null,
      days_per_week,
      minutes_per_session,
      equipment,
      injuries,
      modality: safeModality,
      secondary_modalities: safeSecondary,
      language,
      catalogBlock,
      athleticBackground: goal.athletic_background ?? null,
      supplements: (profileResult.data?.supplements as string[] | null) ?? [],
      supplementsOther: profileResult.data?.supplements_other ?? null,
    });
```

- [ ] **Step 4: `generate-meal-plan/index.ts` — mismos campos + mismo guardrail**

Ampliar el `select` de `goals` (ya modificado en Task 3 para leer `food_preferences` — agregar `athletic_background` a la misma query de `goals`):

```typescript
      supabase.from('goals').select('type, fitness_level, athletic_background')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
```

Ampliar el `select` de `profiles` en la misma query (ya existente):

```typescript
      supabase.from('profiles').select('language, supplements, supplements_other').eq('id', user.id).maybeSingle(),
```

Ampliar la firma de `buildMealPlanPrompt` (modificada en Task 3), agregando:

```typescript
  athleticBackground: string | null;
  supplements: string[];
  supplementsOther: string | null;
```

Agregar las mismas dos `const` que en Task 8 Step 2 (`backgroundMap`/`backgroundLine`/`supplementsLine` — idéntico código, `generate-meal-plan` no comparte módulos con `generate-plan`, cada EF es autocontenida como el resto del repo) dentro de `buildMealPlanPrompt`, antes de su `return`. Usar el mapeo de trayectoria orientado a nutrición en vez de entrenamiento:

```typescript
  const backgroundMap: Record<string, string> = {
    amateur: 'competidor amateur',
    high_performance: 'competidor de alto rendimiento',
    bodybuilding: 'fisicoculturismo competitivo',
  };
  const backgroundLine = userData.athleticBackground && userData.athleticBackground !== 'none'
    ? `- Trayectoria competitiva declarada: ${backgroundMap[userData.athleticBackground] ?? userData.athleticBackground} — ajusta el timing/cantidad de comidas si es relevante.\n`
    : '';
  const supplementsList = userData.supplements.filter((s) => s !== 'none');
  const supplementsLine = supplementsList.length > 0 || userData.supplementsOther
    ? `- Suplementación declarada (SOLO contexto): ${[...supplementsList, userData.supplementsOther].filter(Boolean).join(', ')}\nREGLA DE SEGURIDAD: el dato de suplementación es únicamente contexto (p.ej. no dupliques una recomendación de proteína si el usuario ya toma un shake). Bajo NINGUNA circunstancia recomiendes, apruebes, sugieras dosis, o valides el uso de sustancias o suplementos.\n`
    : '';
```

Agregar `${backgroundLine}${supplementsLine}` como línea nueva dentro del `return` del prompt, justo después de la línea de `Disponibilidad de alimentos` (después de la línea 52 original) y antes de `IMPORTANTE: Los planes no sustituyen...` (línea 54 original).

Actualizar la llamada a `buildMealPlanPrompt` (modificada en Task 3), agregando:

```typescript
      athleticBackground: goalResult.data.athletic_background ?? null,
      supplements: (profileResult.data?.supplements as string[] | null) ?? [],
      supplementsOther: profileResult.data?.supplements_other ?? null,
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio (los tipos de Deno EFs no corren bajo `tsc` del proyecto RN, pero el archivo debe seguir siendo TypeScript válido — revisar visualmente que no queden template literals rotos).

Run (curl E2E con un usuario de prueba que tenga `athletic_background`/`supplements` seteados vía Task 6 o 7):
```bash
sg docker -c "docker logs supabase_edge_runtime_forja --tail 80"
```
tras generar un plan de entrenamiento y uno alimenticio para ese usuario, confirmar visualmente en los logs (o agregando un `console.log(prompt.slice(0,2000))` temporal si no es visible) que el prompt incluye la línea de trayectoria/suplementos y el texto literal `REGLA DE SEGURIDAD`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-plan/index.ts supabase/functions/generate-meal-plan/index.ts
git commit -m "feat(fase-d): generate-plan y generate-meal-plan consumen trayectoria/suplementos con guardrail de seguridad"
```

Tras este commit: `sg docker -c "docker restart supabase_edge_runtime_forja"`.

---

### Task 9: Verificación final + docs + review de rama

**Files:**
- Modify: `forja-docs.md`

- [ ] **Step 1: Verificación estática completa**

Run: `npx tsc --noEmit && npm run check-i18n && (cd supabase/functions && deno test swap-meal/logic.test.ts translate-plan/logic.test.ts delete-account/logic.test.ts)`
Expected: tsc limpio, check-i18n OK, `32 passed | 0 failed` (16 de swap-meal + 11 de translate-plan + 5 de delete-account).

- [ ] **Step 2: Documentar** — agregar al final de `forja-docs.md`:

```markdown
## Fase D del rediseño — nutrición (swap, disgustos, onboarding)

Alergias y disgustos alimenticios persistidos en `food_preferences` (gestionados desde
Ajustes), reemplazando el formulario transitorio que el usuario tenía que re-teclear en
cada generación — `generate-meal-plan` los lee directo de la tabla. Swap de una comida
individual (`swap-meal`, acciones `preview`/`accept`): preview genera una propuesta con
Sonnet sin persistir (máx. 3 intentos por sesión, sin costo de límite); accept persiste
lo ya mostrado (sin nueva llamada a IA), valida el límite semanal (`meal_swaps`, 3/semana
free, ilimitado premium) y resetea `translations` a `{}` en la misma escritura — el
caché de traducciones no tiene forma de saber que cambió una comida, así que sin este
reset quedaría desincronizado. Identidad de la comida: `day_number` se busca con
`findIndex`, nunca por posición de array (mismo principio que `exerciseIndex` en Fase C).
Onboarding paso 5 opcional (trayectoria competitiva + suplementación declarada) — el
marcado de `onboarding_completed` se movió del paso 4 al paso 5 porque el `AuthGuard`
(`app/_layout.tsx`) expulsa a `/(app)` en cuanto ese flag es `true` mientras la ruta
activa sigue en `(auth)`. Ambos generadores de IA reciben la trayectoria/suplementos
declarados con un guardrail de seguridad explícito: es solo contexto, nunca se
recomienda ni dosifica. Spec: `docs/superpowers/specs/2026-07-14-redesign-fase-d-nutricion-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add forja-docs.md
git commit -m "docs: nutrición de la Fase D en forja-docs"
```

- [ ] **Step 4: E2E humano en Expo Go (lo ejecuta el usuario)**

1. Ajustes → Alergias y disgustos: agregar una alergia y un disgusto, cerrar la app, volver a abrir — siguen ahí. Generar un plan alimenticio nuevo → la alergia declarada nunca aparece en ninguna comida.
2. En el plan alimenticio, tocar el ícono de swap de una comida → "Proponer otra opción" → aparece una propuesta con calorías cercanas a la original → "Otra opción" un par de veces (máximo 3) → "Aceptar" → la comida cambia en la lista, el resto del día queda intacto.
3. Repetir el swap 3 veces en la semana (tier free) → al 4to intento de aceptar, mensaje de límite alcanzado.
4. Cambiar el idioma de la app después de un swap → el plan se re-traduce (no muestra la comida vieja cacheada).
5. Crear una cuenta nueva → completar onboarding pasos 1-4 → llega al paso 5 (no se salta directo a la app) → elegir trayectoria + un suplemento → Forjar → llega a la app con el plan generado.
6. Repetir con una cuenta nueva tocando "Omitir" en el paso 5 → llega a la app igual, sin trayectoria/suplementos declarados.
7. Ajustes → Mi entrenamiento: para una cuenta que omitió el paso 5, declarar trayectoria/suplementos ahí → guardar → generar un plan nuevo → confirmar (revisando logs si hace falta) que el prompt los incluye.

No commitear nada aquí; fallos se abren como fixes puntuales.
