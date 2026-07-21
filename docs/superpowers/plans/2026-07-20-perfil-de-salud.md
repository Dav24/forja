# Perfil de salud (lesiones + condiciones médicas/alimenticias) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar lesiones (con severidad) y condiciones médicas/alimenticias del usuario en onboarding y Ajustes, y que `generate-plan`, `generate-meal-plan` y el chat de Vulcano las respeten — con un filtro determinista de ejercicios para lesiones severas, aviso único para usuarios free, y auto-regeneración de plan para usuarios premium.

**Architecture:** Dos tablas nuevas (`injuries` con `severity`, `medical_conditions` sin `severity`) con RLS estándar. `generate-plan` amplía su lectura de `exercise_catalog` para incluir `primary_muscle`/`movement_pattern` y filtra el catálogo ANTES de construir el prompt cuando hay una lesión `severa_estructural` mapeable — así Claude no puede elegir el ejercicio excluido. Lesiones leves y condiciones médicas van solo por prompt, mismo framing de seguridad que ya usan alergias hoy. `workout_plans`/`meal_plans` ganan columnas para persistir los últimos parámetros de generación usados, necesarias para que la auto-regeneración premium no tenga que volver a preguntar nada.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), Expo/React Native + TanStack Query, react-i18next.

## Global Constraints

- Toda cadena de texto nueva visible al usuario necesita clave en `locales/es/*.json` Y `locales/en/*.json` (namespace parity forzada por `scripts/check-i18n.mjs`). Nunca usar plurales de i18next.
- `notes` (texto libre) en `injuries`/`medical_conditions` se sanea igual que `modality_goal_notes`: `.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '')`.
- Ningún prompt nuevo debe pedirle a Claude "evaluar" o "diagnosticar" — solo tratar la lesión/condición como restricción dada a respetar (regla no negociable del blueprint: nunca dar diagnósticos médicos, siempre derivar a un profesional).
- No se restringe `diet_type` mecánicamente en la UI por condición médica — decisión explícita del spec.
- El chat de Vulcano gana visibilidad de `injuries`+`medical_conditions`, pero NO gana contexto del plan de comida activo ni de ejercicios día-por-día — eso queda fuera de este plan (hilo futuro propio).
- Mantener la duplicación de patrones entre `generate-plan/index.ts` y `generate-meal-plan/index.ts` (no extraer módulo compartido) — consistente con cómo ya están escritos.
- **Advertencia de entorno:** `exercise_catalog` está vacío en la base local hoy (0 filas) — el script `scripts/import-exercise-catalog.mjs` nunca se corrió contra este entorno. La Task 9 (filtro determinista) no se puede verificar end-to-end sin correrlo primero; ver nota en esa tarea.

## File Structure

- `supabase/migrations/0016_health_profile.sql` — tablas `injuries`/`medical_conditions`, columnas nuevas en `profiles`/`workout_plans`/`meal_plans`.
- `constants/health.ts` — `BODY_AREAS`, `INJURY_SEVERITIES`, `MEDICAL_CONDITIONS` (definiciones compartidas onboarding+ajustes).
- `hooks/useInjuries.ts` — CRUD de `injuries`.
- `hooks/useMedicalConditions.ts` — CRUD de `medical_conditions`.
- `app/(auth)/onboarding/step-6-health.tsx` — nuevo step opcional de onboarding.
- `app/(auth)/onboarding/_layout.tsx` — agrega el step al array `STEPS`.
- `app/(auth)/onboarding/step-{1,2,3,4,5}-*.tsx` — bump de `total: 5` → `total: 6` en el string de progreso.
- `app/(app)/settings/index.tsx` — reemplaza la fila "Alimentación" por "Lesiones y limitaciones alimenticias".
- `app/(app)/settings/health/index.tsx` — hub nuevo con 2 botones.
- `app/(app)/settings/health/injuries.tsx` — editor de lesiones.
- `app/(app)/settings/health/conditions.tsx` — editor fusionado (alergias/dislikes existentes + condiciones médicas nuevas), reemplaza `food-preferences.tsx`.
- `app/(app)/settings/food-preferences.tsx` — se elimina (su contenido se movió a `health/conditions.tsx`).
- `supabase/functions/generate-plan/index.ts` — lee `injuries`, filtro determinista de severidad, persiste parámetros de generación.
- `supabase/functions/generate-meal-plan/index.ts` — lee `medical_conditions`, persiste parámetros de generación.
- `supabase/functions/chat/index.ts` — agrega `injuries`+`medical_conditions` al `userContextBlock`.
- `hooks/useWorkoutPlan.ts` / `hooks/useMealPlan.ts` — aviso único free + disparo de auto-regeneración premium.
- `locales/{es,en}/{onboarding,settings}.json` — strings nuevas.

---

### Task 1: Migración `0016_health_profile.sql`

**Files:**
- Create: `supabase/migrations/0016_health_profile.sql`
- Modify: `types/database.types.ts` (regenerar, no a mano)

**Interfaces:**
- Produces: tablas `injuries(id, user_id, body_area, severity, notes, created_at)`, `medical_conditions(id, user_id, condition, notes, created_at)`; columnas `profiles.seen_health_profile_hint_workout`, `profiles.seen_health_profile_hint_meal`; columnas `workout_plans.days_per_week`, `workout_plans.minutes_per_session`, `workout_plans.equipment`; columnas `meal_plans.diet_type`, `meal_plans.food_availability`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Perfil de salud: lesiones (con severidad, para filtro determinista de
-- ejercicios) y condiciones médicas/alimenticias (solo-prompt).
-- Ver docs/superpowers/specs/2026-07-20-perfil-de-salud-design.md

create table injuries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  body_area  text not null check (body_area in (
    'rodilla', 'hombro', 'espalda_baja', 'cadera', 'tobillo', 'muñeca', 'cuello', 'otro'
  )),
  severity   text not null check (severity in ('leve_moderada', 'severa_estructural')),
  notes      text,
  created_at timestamptz not null default now()
);

create index injuries_user_idx on injuries(user_id);

alter table injuries enable row level security;

create policy "injuries_owner_select" on injuries
  for select to authenticated using (user_id = auth.uid());
create policy "injuries_owner_insert" on injuries
  for insert to authenticated with check (user_id = auth.uid());
create policy "injuries_owner_delete" on injuries
  for delete to authenticated using (user_id = auth.uid());

create table medical_conditions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  condition  text not null check (condition in (
    'diabetes', 'hipertension', 'bypass_gastrico', 'embarazo', 'enfermedad_renal', 'otro'
  )),
  notes      text,
  created_at timestamptz not null default now()
);

create index medical_conditions_user_idx on medical_conditions(user_id);

alter table medical_conditions enable row level security;

create policy "medical_conditions_owner_select" on medical_conditions
  for select to authenticated using (user_id = auth.uid());
create policy "medical_conditions_owner_insert" on medical_conditions
  for insert to authenticated with check (user_id = auth.uid());
create policy "medical_conditions_owner_delete" on medical_conditions
  for delete to authenticated using (user_id = auth.uid());

-- Aviso único a usuarios free la primera vez que generan cada tipo de plan
-- ("podrás modificar esto en Ajustes para tu próximo plan").
alter table profiles add column seen_health_profile_hint_workout boolean not null default false;
alter table profiles add column seen_health_profile_hint_meal boolean not null default false;

-- Ninguna de las dos tablas persistía los parámetros de generación — hacen
-- falta para que la auto-regeneración premium (al editar el perfil de
-- salud) reutilice los últimos valores sin volver a preguntar nada.
alter table workout_plans add column days_per_week int;
alter table workout_plans add column minutes_per_session int;
alter table workout_plans add column equipment text;

alter table meal_plans add column diet_type text;
alter table meal_plans add column food_availability text;
```

- [ ] **Step 2: Aplicar localmente**

Run: `cd "forja" && supabase db reset`
Expected: la migración `0016_health_profile.sql` corre sin error junto con las 15 anteriores.

- [ ] **Step 3: Verificar RLS manualmente**

Run (psql local, con un `user_id` real de `profiles`):
```sql
select policyname, cmd from pg_policies where tablename in ('injuries', 'medical_conditions');
-- expect: 3 filas por tabla (select/insert/delete), todas owner-scoped

insert into injuries (user_id, body_area, severity, notes) values
  ('<user_id_real>', 'rodilla', 'severa_estructural', 'ruptura de ligamento cruzado, 2024');
select * from injuries where user_id = '<user_id_real>';
-- expect: la fila insertada

set role authenticated;
set request.jwt.claim.sub = '<otro_user_id>';
select * from injuries where user_id = '<user_id_real>';
-- expect: 0 filas (RLS bloquea leer lesiones de otro usuario)
reset role;
```

- [ ] **Step 4: Regenerar tipos TypeScript**

Run: `cd "forja" && supabase gen types typescript --local > types/database.types.ts`
Expected: el diff agrega `injuries`, `medical_conditions` a `Tables`, y las columnas nuevas a `profiles`/`workout_plans`/`meal_plans`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_health_profile.sql types/database.types.ts
git commit -m "feat(salud): migración injuries + medical_conditions + columnas de persistencia"
```

---

### Task 2: `constants/health.ts` — definiciones compartidas

**Files:**
- Create: `constants/health.ts`
- Test: ninguno (solo constantes de datos, mismo patrón que `constants/goals.ts`)

**Interfaces:**
- Consumes: ninguno.
- Produces: `BodyArea`, `InjurySeverity`, `MedicalConditionCode` (tipos); `BODY_AREAS`, `INJURY_SEVERITIES`, `MEDICAL_CONDITIONS` (arrays `{ value, labelKey }`), consumidos por Task 5 (onboarding), Task 7 (editor de lesiones), Task 8 (editor de condiciones).

- [ ] **Step 1: Escribir el archivo**

```typescript
export type BodyArea =
  | 'rodilla' | 'hombro' | 'espalda_baja' | 'cadera' | 'tobillo' | 'muñeca' | 'cuello' | 'otro';

export const BODY_AREAS: { value: BodyArea; labelKey: string }[] = [
  { value: 'rodilla',      labelKey: 'health:bodyAreas.rodilla' },
  { value: 'hombro',       labelKey: 'health:bodyAreas.hombro' },
  { value: 'espalda_baja', labelKey: 'health:bodyAreas.espaldaBaja' },
  { value: 'cadera',       labelKey: 'health:bodyAreas.cadera' },
  { value: 'tobillo',      labelKey: 'health:bodyAreas.tobillo' },
  { value: 'muñeca',       labelKey: 'health:bodyAreas.muneca' },
  { value: 'cuello',       labelKey: 'health:bodyAreas.cuello' },
  { value: 'otro',         labelKey: 'health:bodyAreas.otro' },
];

export type InjurySeverity = 'leve_moderada' | 'severa_estructural';

export const INJURY_SEVERITIES: { value: InjurySeverity; labelKey: string; descriptionKey: string }[] = [
  { value: 'leve_moderada',     labelKey: 'health:severities.leveModerada.label',     descriptionKey: 'health:severities.leveModerada.description' },
  { value: 'severa_estructural', labelKey: 'health:severities.severaEstructural.label', descriptionKey: 'health:severities.severaEstructural.description' },
];

export type MedicalConditionCode =
  | 'diabetes' | 'hipertension' | 'bypass_gastrico' | 'embarazo' | 'enfermedad_renal' | 'otro';

export const MEDICAL_CONDITIONS: { value: MedicalConditionCode; labelKey: string }[] = [
  { value: 'diabetes',         labelKey: 'health:conditions.diabetes' },
  { value: 'hipertension',     labelKey: 'health:conditions.hipertension' },
  { value: 'bypass_gastrico',  labelKey: 'health:conditions.bypassGastrico' },
  { value: 'embarazo',         labelKey: 'health:conditions.embarazo' },
  { value: 'enfermedad_renal', labelKey: 'health:conditions.enfermedadRenal' },
  { value: 'otro',             labelKey: 'health:conditions.otro' },
];
```

- [ ] **Step 2: Crear el namespace i18n `health` (es + en)**

Create `locales/es/health.json`:
```json
{
  "bodyAreas": {
    "rodilla": "Rodilla",
    "hombro": "Hombro",
    "espaldaBaja": "Espalda baja",
    "cadera": "Cadera",
    "tobillo": "Tobillo",
    "muneca": "Muñeca",
    "cuello": "Cuello",
    "otro": "Otra zona"
  },
  "severities": {
    "leveModerada": {
      "label": "Leve o moderada",
      "description": "Ej. esguince grado 1-2, tendinitis, en recuperación"
    },
    "severaEstructural": {
      "label": "Severa o estructural",
      "description": "Ej. ruptura de ligamento, fractura, discapacidad permanente"
    }
  },
  "conditions": {
    "diabetes": "Diabetes",
    "hipertension": "Hipertensión",
    "bypassGastrico": "Bypass gástrico",
    "embarazo": "Embarazo",
    "enfermedadRenal": "Enfermedad renal",
    "otro": "Otra condición"
  }
}
```

Create `locales/en/health.json`:
```json
{
  "bodyAreas": {
    "rodilla": "Knee",
    "hombro": "Shoulder",
    "espaldaBaja": "Lower back",
    "cadera": "Hip",
    "tobillo": "Ankle",
    "muneca": "Wrist",
    "cuello": "Neck",
    "otro": "Other area"
  },
  "severities": {
    "leveModerada": {
      "label": "Mild or moderate",
      "description": "E.g. grade 1-2 sprain, tendinitis, currently recovering"
    },
    "severaEstructural": {
      "label": "Severe or structural",
      "description": "E.g. torn ligament, fracture, permanent disability"
    }
  },
  "conditions": {
    "diabetes": "Diabetes",
    "hipertension": "Hypertension",
    "bypassGastrico": "Gastric bypass",
    "embarazo": "Pregnancy",
    "enfermedadRenal": "Kidney disease",
    "otro": "Other condition"
  }
}
```

- [ ] **Step 3: Registrar el namespace `health` en la config de i18n**

Run: `grep -n "onboarding.json\|ns:" lib/i18n.ts`
Localiza dónde se importan/registran los namespaces existentes (`onboarding`, `settings`, etc.) y agrega `health` siguiendo el mismo patrón (import de `locales/es/health.json`+`locales/en/health.json`, entrada en el objeto `resources` y en el array `ns`).

- [ ] **Step 4: Verificar paridad i18n**

Run: `node scripts/check-i18n.mjs`
Expected: sin errores de claves faltantes entre `es`/`en` para el namespace `health`.

- [ ] **Step 5: Commit**

```bash
git add constants/health.ts locales/es/health.json locales/en/health.json lib/i18n.ts
git commit -m "feat(salud): constantes y namespace i18n de perfil de salud"
```

---

### Task 3: `hooks/useInjuries.ts`

**Files:**
- Create: `hooks/useInjuries.ts`

**Interfaces:**
- Consumes: tabla `injuries` (Task 1), tipo `BodyArea`/`InjurySeverity` (Task 2).
- Produces: `useInjuries()` → `{ data: { id, body_area, severity, notes }[] }`; `useAddInjury()` → `mutate({ body_area, severity, notes })`; `useRemoveInjury()` → `mutate({ id })`.

- [ ] **Step 1: Escribir el hook**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import type { BodyArea, InjurySeverity } from '@/constants/health';

export interface Injury {
  id: string;
  body_area: BodyArea;
  severity: InjurySeverity;
  notes: string | null;
}

export function useInjuries() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['injuries', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injuries')
        .select('id, body_area, severity, notes')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Injury[];
    },
  });
}

export function useAddInjury() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body_area, severity, notes }: { body_area: BodyArea; severity: InjurySeverity; notes: string }) => {
      const sanitizedNotes = notes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      const { error } = await supabase
        .from('injuries')
        .insert({ user_id: user!.id, body_area, severity, notes: sanitizedNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injuries'] });
    },
  });
}

export function useRemoveInjury() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('injuries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injuries'] });
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `hooks/useInjuries.ts`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useInjuries.ts
git commit -m "feat(salud): hook useInjuries (CRUD)"
```

---

### Task 4: `hooks/useMedicalConditions.ts`

**Files:**
- Create: `hooks/useMedicalConditions.ts`

**Interfaces:**
- Consumes: tabla `medical_conditions` (Task 1), tipo `MedicalConditionCode` (Task 2).
- Produces: `useMedicalConditions()` → `{ data: { id, condition, notes }[] }`; `useAddMedicalCondition()` → `mutate({ condition, notes })`; `useRemoveMedicalCondition()` → `mutate({ id })`. Mismas formas que `useInjuries` (Task 3) — el editor fusionado (Task 8) usa ambos hooks junto con `useFoodPreferences` existente.

- [ ] **Step 1: Escribir el hook**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import type { MedicalConditionCode } from '@/constants/health';

export interface MedicalCondition {
  id: string;
  condition: MedicalConditionCode;
  notes: string | null;
}

export function useMedicalConditions() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['medical_conditions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medical_conditions')
        .select('id, condition, notes')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MedicalCondition[];
    },
  });
}

export function useAddMedicalCondition() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ condition, notes }: { condition: MedicalConditionCode; notes: string }) => {
      const sanitizedNotes = notes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      const { error } = await supabase
        .from('medical_conditions')
        .insert({ user_id: user!.id, condition, notes: sanitizedNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical_conditions'] });
    },
  });
}

export function useRemoveMedicalCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('medical_conditions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical_conditions'] });
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add hooks/useMedicalConditions.ts
git commit -m "feat(salud): hook useMedicalConditions (CRUD)"
```

---

### Task 5: Onboarding — `step-6-health.tsx`

**Files:**
- Create: `app/(auth)/onboarding/step-6-health.tsx`
- Modify: `app/(auth)/onboarding/_layout.tsx` (agregar step a `STEPS`)
- Modify: `app/(auth)/onboarding/step-4-level.tsx` (navega a step-5, sin cambio de destino, solo bump de `total`)
- Modify: `app/(auth)/onboarding/step-5-athletic.tsx` (navega a step-6 en vez de terminar el onboarding directo)
- Modify: `app/(auth)/onboarding/step-{1,2,3}-*.tsx` (bump `total: 5` → `total: 6`)
- Modify: `locales/{es,en}/onboarding.json` (agrega `step6`)

**Interfaces:**
- Consumes: `useAddInjury`/`useAddMedicalCondition` (Tasks 3/4), `BODY_AREAS`/`INJURY_SEVERITIES`/`MEDICAL_CONDITIONS` (Task 2), `finishOnboarding()` pattern de `step-5-athletic.tsx`.
- Produces: ninguno consumido por tasks posteriores (es la hoja final del onboarding).

- [ ] **Step 1: Agregar el step al layout**

En `app/(auth)/onboarding/_layout.tsx`, modificar:
```typescript
const STEPS = [
  '/(auth)/onboarding/step-1-goals',
  '/(auth)/onboarding/step-2-modality',
  '/(auth)/onboarding/step-3-body',
  '/(auth)/onboarding/step-4-level',
  '/(auth)/onboarding/step-5-athletic',
  '/(auth)/onboarding/step-6-health',
];
```

- [ ] **Step 2: Bump de `total` en los 5 steps existentes**

En cada uno de `step-1-goals.tsx`, `step-2-modality.tsx`, `step-3-body.tsx`, `step-4-level.tsx`, `step-5-athletic.tsx`: buscar `t('layout.stepOf', { current: N, total: 5 })` y cambiar a `total: 6`.

Run: `grep -rn "total: 5" "app/(auth)/onboarding/"`
Expected: 5 coincidencias (una por step). Reemplazar cada una por `total: 6`.

- [ ] **Step 3: Cambiar destino de `step-5-athletic.tsx`**

En `step-5-athletic.tsx`, la función `finishOnboarding` hoy marca `onboarding_completed: true` y dispara `SparkBurst`. Ese comportamiento se mueve al nuevo `step-6-health.tsx` (última hoja real). Modificar `handleFinish` y `handleSkip` de `step-5-athletic.tsx`: en vez de llamar `finishOnboarding()`, navegar con `router.push('/(auth)/onboarding/step-6-health')` después de guardar sus propios datos (background/supplements). Eliminar la función `finishOnboarding` y el estado `celebrating`/`SparkBurst` de este archivo — se mueven íntegros al nuevo step.

```typescript
// step-5-athletic.tsx — reemplazar el cuerpo de handleFinish y handleSkip:
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
    router.push('/(auth)/onboarding/step-6-health');
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
  router.push('/(auth)/onboarding/step-6-health');
}
```

Eliminar del archivo: la función `finishOnboarding`, el estado `celebrating`, el import y uso de `SparkBurst`, y el import de `useProfileStore` (ya no se usa aquí — se mueve a step-6).

- [ ] **Step 4: Escribir `step-6-health.tsx`**

```typescript
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
import { typography } from '@/constants/typography';
import { BODY_AREAS, INJURY_SEVERITIES, MEDICAL_CONDITIONS, type BodyArea, type InjurySeverity, type MedicalConditionCode } from '@/constants/health';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';

export default function Step6Health() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [bodyArea, setBodyArea] = useState<BodyArea | null>(null);
  const [severity, setSeverity] = useState<InjurySeverity | null>(null);
  const [injuryNotes, setInjuryNotes] = useState('');
  const [condition, setCondition] = useState<MedicalConditionCode | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { reset } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function finishOnboarding() {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id);
    if (error) throw error;
    setCelebrating(true);
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      if (bodyArea && severity) {
        const sanitized = injuryNotes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
        const { error } = await supabase.from('injuries').insert({
          user_id: user.id, body_area: bodyArea, severity, notes: sanitized || null,
        });
        if (error) throw error;
      }
      if (condition) {
        const sanitized = conditionNotes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
        const { error } = await supabase.from('medical_conditions').insert({
          user_id: user.id, condition, notes: sanitized || null,
        });
        if (error) throw error;
      }
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step6.errors.unknown');
      Alert.alert(t('step6.errors.saveFailed.title'), message);
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
          : t('step6.errors.unknown');
      Alert.alert(t('step6.errors.saveFailed.title'), message);
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
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('step6.eyebrow')}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step6.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step6.subtitle')}
          </Text>
        </View>

        <FieldLabel first>{t('step6.injuryQuestion')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {BODY_AREAS.map((a) => (
            <Chip key={a.value} label={t(a.labelKey)} selected={bodyArea === a.value} onPress={() => setBodyArea(bodyArea === a.value ? null : a.value)} />
          ))}
        </View>
        {bodyArea ? (
          <>
            <FieldLabel>{t('step6.severityQuestion')}</FieldLabel>
            <View className="gap-2 mb-4">
              {INJURY_SEVERITIES.map((s) => {
                const isSelected = severity === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    onPress={() => setSeverity(s.value)}
                    className={`p-4 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                  >
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                      {t(s.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {t(s.descriptionKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Input placeholder={t('step6.injuryNotesPlaceholder')} value={injuryNotes} onChangeText={setInjuryNotes} multiline />
          </>
        ) : null}

        <FieldLabel>{t('step6.conditionQuestion')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {MEDICAL_CONDITIONS.map((c) => (
            <Chip key={c.value} tint="accent" label={t(c.labelKey)} selected={condition === c.value} onPress={() => setCondition(condition === c.value ? null : c.value)} />
          ))}
        </View>
        {condition ? (
          <Input placeholder={t('step6.conditionNotesPlaceholder')} value={conditionNotes} onChangeText={setConditionNotes} multiline />
        ) : null}

        <View className="mt-6 p-3 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('step6.safetyNote')}
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
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
              {t('step6.finishButton')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading || celebrating} className="items-center py-2">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
            {t('step6.skipButton')}
          </Text>
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

- [ ] **Step 5: Agregar strings a `locales/es/onboarding.json`**

```json
"step6": {
  "eyebrow": "Último paso (opcional)",
  "title": "Tu perfil de salud",
  "subtitle": "Esto ayuda a Vulcano a evitar ejercicios o alimentos que no te convienen. Nunca reemplaza a un profesional de salud.",
  "injuryQuestion": "¿Tienes alguna lesión o limitación física?",
  "severityQuestion": "¿Qué tan seria es?",
  "injuryNotesPlaceholder": "Notas opcionales (ej. desde cuándo, qué te dijo el doctor)",
  "conditionQuestion": "¿Alguna condición médica que debamos considerar?",
  "conditionNotesPlaceholder": "Notas opcionales",
  "safetyNote": "Esto es solo contexto para tu coach — nunca sustituye una valoración médica o de un profesional de salud.",
  "finishButton": "Terminar",
  "skipButton": "Omitir por ahora",
  "errors": {
    "unknown": "Ocurrió un error inesperado",
    "saveFailed": { "title": "No se pudo guardar" }
  }
}
```

Agregar el mismo bloque (traducido) a `locales/en/onboarding.json` bajo `"step6"`.

- [ ] **Step 6: Verificar paridad i18n y tipos**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/onboarding/" locales/es/onboarding.json locales/en/onboarding.json
git commit -m "feat(salud): step 6 de onboarding (lesiones + condiciones médicas)"
```

---

### Task 6: Settings — hub "Lesiones y limitaciones alimenticias" + eliminar `food-preferences.tsx`

**Files:**
- Create: `app/(app)/settings/health/index.tsx`
- Modify: `app/(app)/settings/index.tsx` (reemplaza fila de Alimentación)
- Delete: `app/(app)/settings/food-preferences.tsx` (su contenido se mueve a Task 8)
- Modify: `locales/{es,en}/settings.json`

**Interfaces:**
- Consumes: `SettingsRow`/`SettingsGroup` (existente).
- Produces: rutas `/(app)/settings/health` (hub), que Tasks 7/8 completan con `/(app)/settings/health/injuries` y `/(app)/settings/health/conditions`.

- [ ] **Step 1: Reemplazar la fila en `settings/index.tsx`**

En `app/(app)/settings/index.tsx`, cambiar:
```typescript
<SettingsRow icon="nutrition-outline" label={t('hub.rowFoodPreferences')} onPress={() => router.push('/(app)/settings/food-preferences' as never)} />
```
por:
```typescript
<SettingsRow icon="medkit-outline" label={t('hub.rowHealthProfile')} onPress={() => router.push('/(app)/settings/health' as never)} />
```

- [ ] **Step 2: Escribir el hub `app/(app)/settings/health/index.tsx`**

```typescript
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';

export default function HealthHubScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.hubTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings/health/injuries' as never)}
          className="p-5 rounded-2xl border flex-row items-center gap-3"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Ionicons name="body-outline" size={22} color={colors.primary} />
          <View className="flex-1">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{t('health.injuriesButtonTitle')}</Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{t('health.injuriesButtonSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/settings/health/conditions' as never)}
          className="p-5 rounded-2xl border flex-row items-center gap-3"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Ionicons name="nutrition-outline" size={22} color={colors.accent} />
          <View className="flex-1">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{t('health.conditionsButtonTitle')}</Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{t('health.conditionsButtonSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Eliminar `food-preferences.tsx` standalone**

Run: `git rm "app/(app)/settings/food-preferences.tsx"`
(Su UI se recrea, fusionada con condiciones médicas, en Task 8 — `app/(app)/settings/health/conditions.tsx`.)

- [ ] **Step 4: Agregar strings a `locales/es/settings.json`**

```json
"hub": {
  "rowHealthProfile": "Lesiones y limitaciones alimenticias"
},
"health": {
  "hubTitle": "Perfil de salud",
  "injuriesButtonTitle": "Lesiones y problemas musculares",
  "injuriesButtonSubtitle": "Ajusta tu plan de entrenamiento según tus limitaciones físicas",
  "conditionsButtonTitle": "Alergias y limitaciones alimenticias/médicas",
  "conditionsButtonSubtitle": "Alergias, disgustos y condiciones médicas que afectan tu dieta"
}
```

Quitar la clave `hub.rowFoodPreferences` si ya no se usa en ningún otro lado (verificar con `grep -rn "rowFoodPreferences"`). Agregar el bloque equivalente (traducido) a `locales/en/settings.json`.

- [ ] **Step 5: Verificar paridad i18n, tipos y que no queden referencias rotas**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit && grep -rn "food-preferences" app/ components/`
Expected: i18n y tsc limpios; el grep no debe encontrar ninguna referencia de navegación a la ruta eliminada (fuera de este plan, que la reintroduce en Task 8 bajo `/health/conditions`).

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/settings/index.tsx" "app/(app)/settings/health/index.tsx" locales/es/settings.json locales/en/settings.json
git rm "app/(app)/settings/food-preferences.tsx"
git commit -m "feat(salud): hub de Ajustes 'Lesiones y limitaciones alimenticias'"
```

---

### Task 7: Settings — `health/injuries.tsx`

**Files:**
- Create: `app/(app)/settings/health/injuries.tsx`
- Modify: `locales/{es,en}/settings.json`

**Interfaces:**
- Consumes: `useInjuries`/`useAddInjury`/`useRemoveInjury` (Task 3), `BODY_AREAS`/`INJURY_SEVERITIES` (Task 2).
- Produces: dispara auto-regeneración premium al guardar — el hook de guardado expone un callback `onSaved()` que Task 13 conecta a `generate-plan`.

- [ ] **Step 1: Escribir la pantalla**

```typescript
import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { BODY_AREAS, INJURY_SEVERITIES, type BodyArea, type InjurySeverity } from '@/constants/health';
import { useInjuries, useAddInjury, useRemoveInjury } from '@/hooks/useInjuries';

export default function InjuriesScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data: injuries } = useInjuries();
  const { mutate: addInjury, isPending: adding } = useAddInjury();
  const { mutate: removeInjury } = useRemoveInjury();

  const [bodyArea, setBodyArea] = useState<BodyArea | null>(null);
  const [severity, setSeverity] = useState<InjurySeverity | null>(null);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  function handleAdd() {
    if (!bodyArea || !severity) return;
    addInjury(
      { body_area: bodyArea, severity, notes },
      {
        onSuccess: () => {
          setBodyArea(null);
          setSeverity(null);
          setNotes('');
          setDirty(false);
        },
      },
    );
  }

  function handleRemove(id: string) {
    removeInjury({ id });
  }

  function handleBack() {
    if (dirty) {
      Alert.alert(t('health.discardTitle'), t('health.discardBody'), [
        { text: t('health.discardCancel'), style: 'cancel' },
        { text: t('health.discardConfirm'), style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.injuriesButtonTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('health.injuriesSubtitle')}
        </Text>

        {(injuries ?? []).map((inj) => (
          <View key={inj.id} className="flex-row items-center justify-between p-3 mb-2 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                {t(`health:bodyAreas.${inj.body_area === 'espalda_baja' ? 'espaldaBaja' : inj.body_area === 'muñeca' ? 'muneca' : inj.body_area}`, { ns: 'health' })}
              </Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                {t(`health:severities.${inj.severity === 'leve_moderada' ? 'leveModerada' : 'severaEstructural'}.label`, { ns: 'health' })}
                {inj.notes ? ` — ${inj.notes}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(inj.id)} hitSlop={12}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        <FieldLabel first>{t('health.addInjuryTitle')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {BODY_AREAS.map((a) => (
            <Chip
              key={a.value}
              label={t(a.labelKey)}
              selected={bodyArea === a.value}
              onPress={() => { setBodyArea(a.value); setDirty(true); }}
            />
          ))}
        </View>
        {bodyArea ? (
          <View className="gap-2 mb-3">
            {INJURY_SEVERITIES.map((s) => {
              const isSelected = severity === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => { setSeverity(s.value); setDirty(true); }}
                  className={`p-3 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                >
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: isSelected ? colors.primary : colors.text }}>{t(s.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {bodyArea && severity ? (
          <View className="flex-row gap-2 items-start mb-2">
            <View className="flex-1">
              <Input placeholder={t('health.notesPlaceholder')} value={notes} onChangeText={(v) => { setNotes(v); setDirty(true); }} />
            </View>
            <Button label={t('health.addButton')} size="sm" variant="secondary" loading={adding} onPress={handleAdd} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Agregar strings a `locales/es/settings.json`**

```json
"health": {
  "injuriesSubtitle": "Ayuda a Vulcano a construir un plan de entrenamiento seguro para ti.",
  "addInjuryTitle": "Agregar lesión",
  "notesPlaceholder": "Notas opcionales",
  "addButton": "Agregar",
  "discardTitle": "¿Quieres descartar los cambios?",
  "discardBody": "Lo que no hayas guardado se perderá.",
  "discardCancel": "Seguir editando",
  "discardConfirm": "Descartar"
}
```

(Estas claves se agregan al bloque `"health"` ya creado en Task 6 Step 4, no lo reemplazan.) Agregar el equivalente en inglés a `locales/en/settings.json`.

- [ ] **Step 3: Verificar paridad i18n y tipos**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/settings/health/injuries.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(salud): pantalla de edición de lesiones en Ajustes"
```

---

### Task 8: Settings — `health/conditions.tsx` (fusiona alergias/dislikes + condiciones médicas)

**Files:**
- Create: `app/(app)/settings/health/conditions.tsx`
- Modify: `locales/{es,en}/settings.json`

**Interfaces:**
- Consumes: `useFoodPreferences`/`useAddFoodPreference`/`useRemoveFoodPreference` (existente, sin cambios), `useMedicalConditions`/`useAddMedicalCondition`/`useRemoveMedicalCondition` (Task 4), `MEDICAL_CONDITIONS` (Task 2), componente `PreferenceGroup` (se reutiliza tal cual desde el `food-preferences.tsx` eliminado en Task 6).

- [ ] **Step 1: Escribir la pantalla**

```typescript
import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { MEDICAL_CONDITIONS, type MedicalConditionCode } from '@/constants/health';
import {
  useAddFoodPreference, useFoodPreferences, useRemoveFoodPreference, type FoodPreferenceKind,
} from '@/hooks/useFoodPreferences';
import { useAddMedicalCondition, useMedicalConditions, useRemoveMedicalCondition } from '@/hooks/useMedicalConditions';

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

export default function ConditionsScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data: foodPrefs } = useFoodPreferences();
  const { mutate: addPreference, isPending: addingPref } = useAddFoodPreference();
  const { mutate: removePreference } = useRemoveFoodPreference();
  const { data: conditions } = useMedicalConditions();
  const { mutate: addCondition, isPending: addingCondition } = useAddMedicalCondition();
  const { mutate: removeCondition } = useRemoveMedicalCondition();

  const [selectedCondition, setSelectedCondition] = useState<MedicalConditionCode | null>(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  function handleAddCondition() {
    if (!selectedCondition) return;
    addCondition(
      { condition: selectedCondition, notes: conditionNotes },
      { onSuccess: () => { setSelectedCondition(null); setConditionNotes(''); setDirty(false); } },
    );
  }

  function handleBack() {
    if (dirty) {
      Alert.alert(t('health.discardTitle'), t('health.discardBody'), [
        { text: t('health.discardCancel'), style: 'cancel' },
        { text: t('health.discardConfirm'), style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.conditionsButtonTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('foodPreferences.subtitle')}
        </Text>
        <PreferenceGroup
          title={t('foodPreferences.allergiesTitle')}
          items={foodPrefs?.allergies ?? []}
          kind="allergy"
          onAdd={(item, kind) => { addPreference({ item, kind }); setDirty(true); }}
          onRemove={(id) => { removePreference({ id }); setDirty(true); }}
          adding={addingPref}
        />
        <PreferenceGroup
          title={t('foodPreferences.dislikesTitle')}
          items={foodPrefs?.dislikes ?? []}
          kind="dislike"
          onAdd={(item, kind) => { addPreference({ item, kind }); setDirty(true); }}
          onRemove={(id) => { removePreference({ id }); setDirty(true); }}
          adding={addingPref}
        />

        <FieldLabel>{t('health.conditionsSectionTitle')}</FieldLabel>
        {(conditions ?? []).map((c) => (
          <View key={c.id} className="flex-row items-center justify-between p-3 mb-2 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                {t(`health:conditions.${c.condition === 'bypass_gastrico' ? 'bypassGastrico' : c.condition === 'enfermedad_renal' ? 'enfermedadRenal' : c.condition}`, { ns: 'health' })}
              </Text>
              {c.notes ? <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>{c.notes}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => { removeCondition({ id: c.id }); setDirty(true); }} hitSlop={12}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {MEDICAL_CONDITIONS.map((c) => (
            <Chip key={c.value} tint="accent" label={t(c.labelKey)} selected={selectedCondition === c.value} onPress={() => { setSelectedCondition(c.value); setDirty(true); }} />
          ))}
        </View>
        {selectedCondition ? (
          <View className="flex-row gap-2 items-start">
            <View className="flex-1">
              <Input placeholder={t('health.notesPlaceholder')} value={conditionNotes} onChangeText={(v) => { setConditionNotes(v); setDirty(true); }} />
            </View>
            <Button label={t('health.addButton')} size="sm" variant="secondary" loading={addingCondition} onPress={handleAddCondition} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Agregar strings a `locales/es/settings.json`**

```json
"health": {
  "conditionsSectionTitle": "Condiciones médicas"
}
```

(Se agrega al bloque `"health"` existente.) Equivalente en inglés a `locales/en/settings.json`.

- [ ] **Step 3: Verificar paridad i18n y tipos**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 4: Verificación manual en Expo Go**

Navegar Ajustes → "Lesiones y limitaciones alimenticias" → "Alergias y limitaciones alimenticias/médicas": confirmar que las alergias/dislikes ya guardados antes (si el usuario de prueba tenía alguno) siguen apareciendo — no se perdió nada al mover la UI.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/settings/health/conditions.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(salud): pantalla fusionada de alergias + condiciones médicas"
```

---

### Task 9: `generate-plan/index.ts` — lesiones, filtro de severidad, persistencia de parámetros

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts`

**Interfaces:**
- Consumes: tabla `injuries` (Task 1).
- Produces: `workout_plans.days_per_week`/`minutes_per_session`/`equipment` poblados en cada insert — consumido por Task 13 (auto-regeneración).

**Nota de entorno:** `exercise_catalog` está vacío en la DB local (verificado: 0 filas). Antes de poder verificar el filtro end-to-end (Step 5), correr `node scripts/import-exercise-catalog.mjs` (requiere `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY` en el entorno — ver `supabase/.env`). Esto es preexistente, no causado por esta feature.

- [ ] **Step 1: Leer `injuries` y calcular el filtro de severidad**

En `generate-plan/index.ts`, después del bloque `Promise.all([goalResult, bodyResult, profileResult])` (línea ~314-331), agregar la lectura de `injuries` y el mapa de exclusión determinista (vocabulario real de `exercise_catalog`, verificado contra `assets-import/exercise-media/full-library-metadata/metadata.json`: `primary_muscle` ∈ {Back, Biceps, Calves, Chest, Core, Forearms, Glutes, Hamstrings, Quadriceps, Shoulders, Trapezius, Triceps}, `movement_pattern` ∈ {Carry, Core, Hinge, Hip Abduction, Isolation, Lunge, Mobility, Plyometric, Pull, Push, Rotation, Squat, Stretch}):

```typescript
// Justo antes del bloque `const { data: catalogRows } = ...` (línea 344):
const { data: injuryRows } = await supabase
  .from('injuries')
  .select('body_area, severity, notes')
  .eq('user_id', user.id);

const injuries = injuryRows ?? [];

// Mapa de exclusión determinista: solo zonas donde el vocabulario coarse
// de exercise_catalog permite una exclusión razonable. 'cuello' y 'otro'
// no tienen mapeo limpio — caen a solo-prompt igual que severidad leve.
const SEVERE_EXCLUSION_MAP: Record<string, { muscles?: string[]; patterns?: string[] }> = {
  rodilla: { patterns: ['Squat', 'Lunge', 'Plyometric'] },
  hombro: { muscles: ['Shoulders'] },
  espalda_baja: { patterns: ['Hinge'] },
  cadera: { patterns: ['Hinge', 'Squat', 'Lunge', 'Hip Abduction'] },
  tobillo: { patterns: ['Plyometric', 'Lunge'] },
  muñeca: { muscles: ['Forearms'] },
};

const severeInjuries = injuries.filter((i) => i.severity === 'severa_estructural' && SEVERE_EXCLUSION_MAP[i.body_area]);
const mildInjuries = injuries.filter((i) => i.severity === 'leve_moderada' || !SEVERE_EXCLUSION_MAP[i.body_area]);

const excludedMuscles = new Set(severeInjuries.flatMap((i) => SEVERE_EXCLUSION_MAP[i.body_area].muscles ?? []));
const excludedPatterns = new Set(severeInjuries.flatMap((i) => SEVERE_EXCLUSION_MAP[i.body_area].patterns ?? []));
```

- [ ] **Step 2: Ampliar el `select` de `exercise_catalog` y aplicar el filtro**

Reemplazar el bloque existente (línea ~344-349):
```typescript
const { data: catalogRows } = await supabase
  .from('exercise_catalog')
  .select('slug, name_es, name_en, equipment');
const catalogBlock = (catalogRows ?? [])
  .map((r) => `${r.slug}|${language === 'en' ? r.name_en : r.name_es}|${r.equipment}`)
  .join('\n');
```
por:
```typescript
const { data: allCatalogRows } = await supabase
  .from('exercise_catalog')
  .select('slug, name_es, name_en, equipment, primary_muscle, movement_pattern');

// Filtro determinista: excluye del catálogo (antes de armar el prompt) lo
// que Claude ni siquiera puede elegir. Ver docs/superpowers/specs/2026-07-20-perfil-de-salud-design.md.
const catalogRows = (excludedMuscles.size > 0 || excludedPatterns.size > 0)
  ? (allCatalogRows ?? []).filter((r) => !excludedMuscles.has(r.primary_muscle) && !excludedPatterns.has(r.movement_pattern))
  : (allCatalogRows ?? []);

const catalogBlock = catalogRows
  .map((r) => `${r.slug}|${language === 'en' ? r.name_en : r.name_es}|${r.equipment}`)
  .join('\n');
```

(La línea posterior `const validSlugs = new Set((catalogRows ?? []).map((r) => r.slug));` — línea ~502 — sigue funcionando sin cambios: `catalogRows` ahora ya viene filtrado.)

- [ ] **Step 3: Construir el texto de `injuries` para el prompt y actualizar `buildPlanPrompt`**

Antes de la llamada a `buildPlanPrompt` (línea ~391), reemplazar el `injuries` (que hoy siempre llega `''` del body del request — parámetro muerto) por texto construido desde las tablas:

```typescript
const injuriesText = [
  ...severeInjuries.map((i) => `${i.body_area} (lesión severa/estructural — YA EXCLUIDO del catálogo de ejercicios de la zona afectada): ${i.notes ?? 'sin notas adicionales'}`),
  ...mildInjuries.map((i) => `${i.body_area} (lesión leve/moderada — prioriza bajo impacto, evita movimientos pesados en esta zona): ${i.notes ?? 'sin notas adicionales'}`),
].join('; ');
```

Y en la llamada a `buildPlanPrompt` (línea ~391-417), cambiar `injuries,` (que refería al parámetro del body) por `injuries: injuriesText,`. Eliminar `injuries = ''` de la destructuración del `body` (línea ~303) — ya no se usa como input del cliente.

En `buildPlanPrompt`, agregar debajo de la línea `${userData.injuries ? ... }` (línea 148) una nota reforzando el guardrail cuando hay severidad severa sin mapeo limpio (`cuello`/`otro`):
```typescript
// Dentro de buildPlanPrompt, reemplazar la línea 148:
${userData.injuries ? `- Lesiones o limitaciones (RESPETAR, no evaluar ni diagnosticar): ${userData.injuries}` : ''}
```

- [ ] **Step 4: Persistir parámetros de generación al guardar el plan**

En el `insert` a `workout_plans` (línea ~522-534), agregar las 3 columnas nuevas:
```typescript
const { data: savedPlan, error: planError } = await supabase
  .from('workout_plans')
  .insert({
    user_id: user.id,
    title: String(planData.title ?? 'Mi Plan de Entrenamiento'),
    description: String(planData.description ?? ''),
    schedule: planData.schedule ?? [],
    generated_by: 'claude-sonnet-4-6',
    is_active: true,
    source_language: language,
    days_per_week,
    minutes_per_session,
    equipment,
  })
  .select('id')
  .single();
```

- [ ] **Step 5: Verificar tipos**

Run: `deno check --config supabase/functions/deno.json supabase/functions/generate-plan/index.ts`
Expected: sin errores de tipos.

- [ ] **Step 6: Verificar manualmente**

Requiere `exercise_catalog` poblado (ver nota de entorno arriba) y el stack Supabase local corriendo.

1. Insertar una lesión severa de rodilla vía SQL: `insert into injuries (user_id, body_area, severity) values ('<user_id>', 'rodilla', 'severa_estructural');`
2. Llamar `generate-plan` con curl (Authorization Bearer del JWT del usuario de prueba) y modalidad `gym_strength`.
3. Confirmar en la respuesta que ningún ejercicio del plan tiene `movement_pattern` de squat/lunge/plyometric — cruzar los `exercise_slug` devueltos contra `exercise_catalog` por psql: `select slug, movement_pattern from exercise_catalog where slug in (...);`
4. Confirmar en `workout_plans` que la fila nueva tiene `days_per_week`/`minutes_per_session`/`equipment` poblados (no NULL).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/generate-plan/index.ts
git commit -m "feat(salud): generate-plan respeta lesiones (filtro determinista + prompt) y persiste parámetros"
```

---

### Task 10: `generate-meal-plan/index.ts` — condiciones médicas + persistencia de parámetros

**Files:**
- Modify: `supabase/functions/generate-meal-plan/index.ts`

**Interfaces:**
- Consumes: tabla `medical_conditions` (Task 1).
- Produces: `meal_plans.diet_type`/`food_availability` poblados en cada insert — consumido por Task 13.

- [ ] **Step 1: Leer `medical_conditions` junto a `food_preferences`**

En el `Promise.all` existente (línea ~279-287), agregar la query de `medical_conditions`:
```typescript
const [goalResult, bodyResult, profileResult, foodPrefResult, medicalConditionsResult] = await Promise.all([
  supabase.from('goals').select('type, fitness_level, athletic_background, modality, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes')
    .eq('user_id', user.id).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  supabase.from('body_data').select('weight_kg, height_cm, age, gender, activity_level')
    .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
  supabase.from('profiles').select('language, supplements, supplements_other').eq('id', user.id).maybeSingle(),
  supabase.from('food_preferences').select('item, kind').eq('user_id', user.id),
  supabase.from('medical_conditions').select('condition, notes').eq('user_id', user.id),
]);

const conditionsText = (medicalConditionsResult.data ?? [])
  .map((c) => `${c.condition}${c.notes ? ` (${c.notes})` : ''}`)
  .join(', ');
```

- [ ] **Step 2: Agregar `medical_conditions` a `buildMealPlanPrompt`**

En la firma de `buildMealPlanPrompt` (línea ~54-76), agregar `medicalConditions: string;` al tipo de `userData`.

En el cuerpo de la función, después de la línea de alergias/dislikes (línea ~125-126), agregar:
```typescript
${userData.medicalConditions ? `- Condiciones médicas declaradas (RESPETAR, no evaluar ni diagnosticar — NUNCA sugerir alimentos o enfoques contraindicados para estas condiciones): ${userData.medicalConditions}` : ''}
```

En la llamada a `buildMealPlanPrompt` (línea ~334-356), agregar `medicalConditions: conditionsText,`.

- [ ] **Step 3: Persistir parámetros de generación al guardar el plan**

En el `insert` a `meal_plans` (línea ~418-430):
```typescript
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
    source_language: language,
    diet_type,
    food_availability,
  })
  .select('id').single();
```

- [ ] **Step 4: Verificar tipos**

Run: `deno check --config supabase/functions/deno.json supabase/functions/generate-meal-plan/index.ts`
Expected: sin errores de tipos.

- [ ] **Step 5: Verificar manualmente**

1. Insertar una condición vía SQL: `insert into medical_conditions (user_id, condition, notes) values ('<user_id>', 'bypass_gastrico', 'operado hace 1 año, porciones pequeñas');`
2. Llamar `generate-meal-plan` con curl.
3. Confirmar (leyendo la respuesta o el registro en `meal_plans`) que el plan generado tiene porciones/calorías por comida notablemente menores a un plan sin esa condición — verificación cualitativa, no automatizable.
4. Confirmar que la fila en `meal_plans` tiene `diet_type`/`food_availability` poblados.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-meal-plan/index.ts
git commit -m "feat(salud): generate-meal-plan respeta condiciones médicas y persiste parámetros"
```

---

### Task 11: `chat/index.ts` — visibilidad de lesiones y condiciones

**Files:**
- Modify: `supabase/functions/chat/index.ts`

**Interfaces:**
- Consumes: tablas `injuries`, `medical_conditions` (Task 1).

- [ ] **Step 1: Agregar las queries al `Promise.all` existente**

En el bloque de línea ~155-161, agregar:
```typescript
const [subResult, countResult, goalResult, planResult, profileResult, injuriesResult, conditionsResult] = await Promise.all([
  supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
  supabase.rpc('get_daily_message_count', { p_user_id: user.id }),
  supabase.from('goals').select('type, fitness_level, modality, secondary_modalities, sport_type, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  supabase.from('workout_plans').select('title, schedule').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  supabase.from('profiles').select('language').eq('id', user.id).maybeSingle(),
  supabase.from('injuries').select('body_area, severity, notes').eq('user_id', user.id),
  supabase.from('medical_conditions').select('condition, notes').eq('user_id', user.id),
]);
```

- [ ] **Step 2: Construir el bloque de salud y agregarlo a `userContextBlock`**

Después del bloque `goalDetailLine` (línea ~207-216), agregar:
```typescript
const injuriesLine = (injuriesResult.data ?? [])
  .map((i) => `${i.body_area} (${i.severity === 'severa_estructural' ? 'severa/estructural' : 'leve/moderada'})${i.notes ? ` — ${i.notes}` : ''}`)
  .join('; ');
const conditionsLine = (conditionsResult.data ?? [])
  .map((c) => `${c.condition}${c.notes ? ` (${c.notes})` : ''}`)
  .join(', ');
const healthBlock = (injuriesLine || conditionsLine)
  ? `PERFIL DE SALUD DEL USUARIO (RESPETAR como restricción, NUNCA evaluar, diagnosticar, ni sugerir tratamiento — ante cualquier duda médica real, deriva al médico):
${injuriesLine ? `Lesiones/limitaciones: ${injuriesLine}` : ''}
${conditionsLine ? `Condiciones médicas: ${conditionsLine}` : ''}`
  : '';
```

Y modificar la construcción de `userContextBlock` (línea ~233-238) para incluirlo:
```typescript
const userContextBlock = `━━━ CONTEXTO DEL USUARIO ━━━
${TONE_BY_LEVEL[fitnessLevel] ?? TONE_BY_LEVEL.intermediate}
${modalityLine}
${goalDetailLine}

${planBlock}
${healthBlock}`;
```

- [ ] **Step 3: Verificar tipos**

Run: `deno check --config supabase/functions/deno.json supabase/functions/chat/index.ts`
Expected: sin errores de tipos.

- [ ] **Step 4: Verificar manualmente**

Con el usuario de prueba con lesión/condición insertada (de Tasks 9/10), preguntarle al chat en la app "¿puedo hacer sentadillas?" o similar — confirmar que la respuesta menciona la lesión/condición y nunca diagnostica ni prescribe tratamiento.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/chat/index.ts
git commit -m "feat(salud): chat de Vulcano gana visibilidad de lesiones y condiciones médicas"
```

---

### Task 12: Aviso único free en primera generación de cada plan

**Files:**
- Modify: `hooks/useWorkoutPlan.ts`
- Modify: `hooks/useMealPlan.ts`
- Modify: `locales/{es,en}/plans.json`

**Interfaces:**
- Consumes: `profiles.seen_health_profile_hint_workout`/`..._meal` (Task 1), `useIsPremium` (existente).
- Produces: ninguno consumido por tasks posteriores.

- [ ] **Step 1: Agregar el aviso en `useGeneratePlan` (`useWorkoutPlan.ts`)**

Agregar el import al inicio del archivo (este hook no es un componente, así que usa `i18next` directo en vez de `useTranslation`):
```typescript
import i18next from 'i18next';
```

En el bloque de éxito de `generate()` (línea ~99-103 del archivo actual), después de `await refetch();`:
```typescript
await refetch();

// Aviso único a usuarios free — no se repite, controlado por profiles.seen_health_profile_hint_workout.
const { data: profileRow } = await supabase.from('profiles').select('seen_health_profile_hint_workout').eq('id', session.user.id).maybeSingle();
const { data: subRow } = await supabase.from('subscriptions').select('status, plan').eq('user_id', session.user.id).maybeSingle();
const isPremiumUser = subRow?.status === 'active' && subRow?.plan !== 'free';
if (!isPremiumUser && profileRow && !profileRow.seen_health_profile_hint_workout) {
  Alert.alert('', i18next.t('plans:workoutPlan.healthProfileHint'));
  await supabase.from('profiles').update({ seen_health_profile_hint_workout: true }).eq('id', session.user.id);
}

if (data.plan_id) {
  router.push(`/(app)/plans/workout/${data.plan_id}`);
}
```

- [ ] **Step 2: Agregar el aviso en `useGenerateMealPlan` (`useMealPlan.ts`)**

En el `onSuccess` de la mutation (línea ~38-40 del archivo actual):
```typescript
onSuccess: async () => {
  queryClient.invalidateQueries({ queryKey: ['meal_plan'] });

  const { data: profileRow } = await supabase.from('profiles').select('seen_health_profile_hint_meal').eq('id', session!.user.id).maybeSingle();
  const { data: subRow } = await supabase.from('subscriptions').select('status, plan').eq('user_id', session!.user.id).maybeSingle();
  const isPremiumUser = subRow?.status === 'active' && subRow?.plan !== 'free';
  if (!isPremiumUser && profileRow && !profileRow.seen_health_profile_hint_meal) {
    Alert.alert('', i18next.t('plans:mealPlan.healthProfileHint'));
    await supabase.from('profiles').update({ seen_health_profile_hint_meal: true }).eq('id', session!.user.id);
  }
},
```

Agregar los imports necesarios (`Alert` de `react-native`, `i18next` de `i18next`) al inicio del archivo.

- [ ] **Step 3: Agregar strings a `locales/es/plans.json`**

```json
"workoutPlan": {
  "healthProfileHint": "Plan creado. Podrás modificar tus lesiones en Ajustes para tu próximo plan de entrenamiento."
},
"mealPlan": {
  "healthProfileHint": "Plan creado. Podrás modificar tu perfil médico en Ajustes para tu próximo plan alimenticio."
}
```

(Fusionar con las claves `workoutPlan`/`mealPlan` existentes en ese archivo si ya existen esos objetos — no reemplazar el resto de su contenido.) Agregar el equivalente en inglés a `locales/en/plans.json`.

- [ ] **Step 4: Verificar paridad i18n y tipos**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 5: Verificar manualmente**

Con un usuario free de prueba (goal+onboarding completo, sin plan aún): generar plan de entrenamiento → confirmar que aparece el Alert. Generar un segundo plan (regenerar) → confirmar que el Alert YA NO aparece. Repetir para plan de comida.

- [ ] **Step 6: Commit**

```bash
git add hooks/useWorkoutPlan.ts hooks/useMealPlan.ts locales/es/plans.json locales/en/plans.json
git commit -m "feat(salud): aviso único free al generar cada plan por primera vez"
```

---

### Task 13: Auto-regeneración premium al editar perfil de salud

**Files:**
- Modify: `app/(app)/settings/health/injuries.tsx`
- Modify: `app/(app)/settings/health/conditions.tsx`
- Modify: `locales/{es,en}/settings.json`

**Interfaces:**
- Consumes: `useIsPremium` (existente), `useGeneratePlan`/`useActiveWorkoutPlan` (para leer `days_per_week`/`minutes_per_session`/`equipment` persistidos por Task 9), `useGenerateMealPlan`/`useActiveMealPlan` (para leer `diet_type`/`food_availability` persistidos por Task 10).

- [ ] **Step 1: Auto-regeneración en `injuries.tsx`**

Modificar `handleAdd` (y agregar el mismo comportamiento a `handleRemove`) para, si el usuario es premium, disparar `generate-plan` con los últimos parámetros del plan activo tras cualquier cambio guardado exitosamente:

```typescript
// Agregar imports:
import { useIsPremium } from '@/hooks/useSubscription';
import { useActiveGoal } from '@/hooks/useProfile';
import { useActiveWorkoutPlan, useGeneratePlan } from '@/hooks/useWorkoutPlan';
import type { ModalityId } from '@/constants/modalities';

// Dentro del componente, agregar:
const isPremium = useIsPremium();
const { data: activePlan, refetch: refetchPlan } = useActiveWorkoutPlan();
// workout_plans NO tiene columna `modality` (confirmado contra el schema) —
// vive en goals.modality, que ya trae useActiveGoal() con `select('*')`.
const { data: activeGoal } = useActiveGoal();
const { generating, generate } = useGeneratePlan(refetchPlan);
const [regenerating, setRegenerating] = useState(false);

async function maybeAutoRegenerate() {
  if (!isPremium || !activePlan || !activeGoal?.modality) return;
  setRegenerating(true);
  try {
    await generate({
      modality: activeGoal.modality as ModalityId,
      days_per_week: activePlan.days_per_week ?? 3,
      minutes_per_session: activePlan.minutes_per_session ?? 60,
      equipment: activePlan.equipment ?? 'gym con máquinas y pesas libres',
    });
    Alert.alert(t('health.autoRegenDoneTitle'), t('health.autoRegenDoneWorkoutBody'));
  } finally {
    setRegenerating(false);
  }
}

// Modificar handleAdd para llamar maybeAutoRegenerate() dentro de onSuccess:
function handleAdd() {
  if (!bodyArea || !severity) return;
  addInjury(
    { body_area: bodyArea, severity, notes },
    {
      onSuccess: async () => {
        setBodyArea(null);
        setSeverity(null);
        setNotes('');
        setDirty(false);
        await maybeAutoRegenerate();
      },
    },
  );
}

// Modificar handleRemove:
function handleRemove(id: string) {
  removeInjury({ id }, { onSuccess: () => { maybeAutoRegenerate(); } });
}
```

Mostrar el overlay de espera (reutilizando `PlanGenerating`) cuando `generating || regenerating` es verdadero — agregar antes del `return` principal:
```typescript
if (generating || regenerating) {
  return <PlanGenerating />;
}
```
(Import: `import { PlanGenerating } from '@/components/plans/PlanGenerating';`)

- [ ] **Step 2: Auto-regeneración en `conditions.tsx`**

Mismo patrón, pero con `useGenerateMealPlan`/`useActiveMealPlan`, disparado tanto en `handleAddCondition` como en los `onAdd`/`onRemove` de `PreferenceGroup` (alergias/dislikes):

```typescript
import { useIsPremium } from '@/hooks/useSubscription';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { PlanGenerating } from '@/components/plans/PlanGenerating';

const isPremium = useIsPremium();
const { data: activeMealPlan, refetch: refetchMealPlan } = useActiveMealPlan();
const generateMealPlan = useGenerateMealPlan();
const [regenerating, setRegenerating] = useState(false);

async function maybeAutoRegenerate() {
  if (!isPremium || !activeMealPlan) return;
  setRegenerating(true);
  try {
    await generateMealPlan.mutateAsync({
      diet_type: activeMealPlan.diet_type ?? 'omnívoro',
      food_availability: activeMealPlan.food_availability ?? 'media',
    });
    await refetchMealPlan();
    Alert.alert(t('health.autoRegenDoneTitle'), t('health.autoRegenDoneMealBody'));
  } finally {
    setRegenerating(false);
  }
}
```

Conectar `maybeAutoRegenerate()` en el `onSuccess` de `handleAddCondition`, y en los callbacks `onAdd`/`onRemove` pasados a `PreferenceGroup` (alergias/dislikes) — ya que Task 8 fusionó ambas en una sola pantalla, cualquier guardado en ella dispara la misma regeneración (decisión ya tomada en la spec). Mostrar `<PlanGenerating />` cuando `generateMealPlan.isPending || regenerating`.

- [ ] **Step 3: Agregar strings a `locales/es/settings.json`**

```json
"health": {
  "autoRegenDoneTitle": "¡Tu plan se actualizó!",
  "autoRegenDoneWorkoutBody": "Tu plan de entrenamiento se regeneró con tu perfil de salud actualizado.",
  "autoRegenDoneMealBody": "Tu plan alimenticio se regeneró con tu perfil de salud actualizado."
}
```

Equivalente en inglés a `locales/en/settings.json`.

- [ ] **Step 4: Verificar paridad i18n y tipos**

Run: `node scripts/check-i18n.mjs && cd "forja" && npx tsc --noEmit`
Expected: ambos limpios.

- [ ] **Step 5: Verificar manualmente**

Con un usuario premium de prueba con plan activo: agregar una lesión en Ajustes → confirmar overlay de espera → confirmar Alert de éxito → confirmar en `workout_plans` que hay una fila nueva `is_active=true` más reciente. Repetir para condiciones médicas/alergias → `meal_plans`.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/settings/health/injuries.tsx" "app/(app)/settings/health/conditions.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(salud): auto-regeneración premium al editar perfil de salud"
```

---

### Task 14: Review final de rama

**Files:** ninguno nuevo — revisión de todo lo cambiado en Tasks 1-13.

- [ ] **Step 1: Correr la suite completa**

Run: `cd "forja" && npx tsc --noEmit && node scripts/check-i18n.mjs`
Expected: ambos limpios sobre el diff completo de la rama.

- [ ] **Step 2: Revisión de rama completa**

Dispatch un reviewer (Opus, mismo patrón que `credit_packs_feature`/`goal_branches_feature`) sobre el diff completo `master...HEAD` de esta feature. Puntos de atención explícitos para el reviewer:
- Consistencia del guardrail "nunca diagnosticar" en los 3 puntos de contacto (`generate-plan`, `generate-meal-plan`, `chat`).
- Que el filtro determinista de Task 9 realmente excluya del `catalogBlock` antes de la llamada a Anthropic (no después).
- Que la auto-regeneración premium (Task 13) no pueda dispararse dos veces por un doble-tap (falta de guard de `isPending` en los botones de guardar).
- Que `food-preferences.tsx` (eliminado en Task 6) no deje ninguna referencia de navegación rota.

- [ ] **Step 3: Aplicar fixes de la revisión**

Corregir cualquier hallazgo crítico/importante en un commit nuevo. Documentar en `.superpowers/sdd/progress.md` sección "Perfil de salud" (mismo patrón que features anteriores).

- [ ] **Step 4: Actualizar memoria del proyecto**

Actualizar `health_profile_feature.md` (memoria) a estado "implementada, pendiente E2E humano" tras el merge — no antes.
