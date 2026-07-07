# Multi-modalidad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer las 8 modalidades de entrenamiento en onboarding y generador de planes para que Forja sirva más allá del gym.

**Architecture:** Catálogo compartido en `constants/modalities.ts`; la modalidad vive en `goals` (principal + secundarias, migración 0006); el onboarding gana un paso 2; el Alert del generador se reemplaza por un bottom sheet de 4 campos; las EFs `generate-plan` y `chat` reciben/inyectan la modalidad en sus prompts. El schema JSON del plan NO cambia.

**Tech Stack:** React Native + Expo Router + NativeWind v4 + Zustand + @gorhom/bottom-sheet, Supabase (Postgres + Edge Functions Deno), Claude Sonnet.

**Spec:** `docs/superpowers/specs/2026-07-07-multi-modalidad-design.md`

## Global Constraints

- NativeWind v4: estilos estáticos en `className`, valores dinámicos/colores del design system/fontFamily en `style` (regla en TODOS los componentes).
- No hay framework de tests en la app RN: la verificación por task es `npx tsc --noEmit` (desde `forja/`) + verificación E2E real de las EFs vía curl (Tasks 5-7).
- Supabase local debe estar corriendo (`sg docker -c "supabase start"` desde `forja/`). Las EFs se sirven con hot-reload (`supabase functions serve --env-file supabase/.env`).
- Los 8 ids de modalidad (exactos, en todos los archivos): `gym_strength`, `functional`, `endurance`, `cycling`, `swimming`, `home_calisthenics`, `mobility`, `ball_sports`.
- Commits en español con convención `tipo(scope): descripción` y trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Directorio raíz de trabajo: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Usuario de prueba local: `test-planfix@forja.test` / `Test1234!` (uid `c37f9116-b0a4-4b41-b536-cb2e1ac63723`). ANON_KEY local (demo): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`.

---

### Task 1: Catálogo de modalidades

**Files:**
- Create: `constants/modalities.ts`

**Interfaces:**
- Produces: `type ModalityId` (unión de los 8 ids), `interface Modality { id: ModalityId; label: string; icon: string; description: string; equipmentPresets: string[] }`, `const MODALITIES: Modality[]`, `const MODALITY_LABELS: Record<ModalityId, string>`. Tasks 3 y 4 los importan desde `@/constants/modalities`.

- [ ] **Step 1: Crear `constants/modalities.ts`**

```typescript
export type ModalityId =
  | 'gym_strength'
  | 'functional'
  | 'endurance'
  | 'cycling'
  | 'swimming'
  | 'home_calisthenics'
  | 'mobility'
  | 'ball_sports';

export interface Modality {
  id: ModalityId;
  label: string;
  icon: string;
  description: string;
  equipmentPresets: string[];
}

export const MODALITIES: Modality[] = [
  {
    id: 'gym_strength',
    label: 'Fuerza / Gym',
    icon: '🏋️',
    description: 'Pesas, máquinas y fuerza en el gimnasio',
    equipmentPresets: ['Gimnasio completo', 'Gimnasio básico'],
  },
  {
    id: 'functional',
    label: 'Funcional / CrossFit / HIIT',
    icon: '⚡',
    description: 'Circuitos, WODs e intervalos de alta intensidad',
    equipmentPresets: ['Box completo', 'Kettlebells y cuerdas', 'Sin equipo'],
  },
  {
    id: 'endurance',
    label: 'Cardio de resistencia',
    icon: '🏃',
    description: 'Correr, caminar o caminadora',
    equipmentPresets: ['Aire libre', 'Caminadora'],
  },
  {
    id: 'cycling',
    label: 'Ciclismo / Spinning',
    icon: '🚴',
    description: 'Ruta, bici fija o rodillo',
    equipmentPresets: ['Bici de ruta', 'Bici fija / spinning', 'Rodillo'],
  },
  {
    id: 'swimming',
    label: 'Natación',
    icon: '🏊',
    description: 'Entrenamiento en alberca',
    equipmentPresets: ['Alberca corta (25m)', 'Alberca larga (50m)'],
  },
  {
    id: 'home_calisthenics',
    label: 'En casa / Calistenia',
    icon: '🏠',
    description: 'Peso corporal y equipo mínimo en casa',
    equipmentPresets: ['Sin equipo', 'Bandas', 'Mancuernas', 'Barra de dominadas'],
  },
  {
    id: 'mobility',
    label: 'Yoga / Pilates / Movilidad',
    icon: '🧘',
    description: 'Flexibilidad, control y movilidad',
    equipmentPresets: ['Tapete', 'Tapete y bloques'],
  },
  {
    id: 'ball_sports',
    label: 'Deportes con balón',
    icon: '⚽',
    description: 'Fútbol, básquet, tenis y más',
    equipmentPresets: ['Cancha y balón'],
  },
];

export const MODALITY_LABELS: Record<ModalityId, string> = Object.fromEntries(
  MODALITIES.map((m) => [m.id, m.label]),
) as Record<ModalityId, string>;
```

- [ ] **Step 2: Verificar typecheck**

Run: `cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit`
Expected: exit 0, sin output.

- [ ] **Step 3: Commit**

```bash
git add constants/modalities.ts
git commit -m "feat(modalidad): catálogo de 8 modalidades de entrenamiento

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Migración 0006 y tipos de DB

**Files:**
- Create: `supabase/migrations/0006_goals_modality.sql`
- Modify: `types/database.types.ts` (bloque `goals`, ~línea 195)

**Interfaces:**
- Produces: columnas `goals.modality (text|null)` y `goals.secondary_modalities (text[], default '{}')`; tipos TS correspondientes en Row/Insert/Update de `goals`.

- [ ] **Step 1: Crear `supabase/migrations/0006_goals_modality.sql`**

```sql
-- Modalidad de entrenamiento del usuario (mini-paso multi-modalidad)
-- Principal define el plan generado; secundarias se integran cuando los días lo permiten.
alter table goals add column modality text;
alter table goals add column secondary_modalities text[] not null default '{}';

alter table goals add constraint goals_modality_check check (
  modality is null or modality in (
    'gym_strength','functional','endurance','cycling',
    'swimming','home_calisthenics','mobility','ball_sports'
  )
);

alter table goals add constraint goals_secondary_modalities_check check (
  coalesce(array_length(secondary_modalities, 1), 0) <= 2
);
```

- [ ] **Step 2: Aplicar la migración al stack local**

Run: `cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && sg docker -c "supabase migration up"`
Expected: `Applying migration 0006_goals_modality.sql...` sin errores.

- [ ] **Step 3: Verificar columnas**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d goals" | grep -E "modality|secondary"`
Expected: ambas columnas listadas (`modality | text` y `secondary_modalities | text[] ... default '{}'::text[]`).

- [ ] **Step 4: Actualizar tipos en `types/database.types.ts`**

En el bloque `goals` (~línea 195), agregar a `Row`:

```typescript
          modality: string | null
          secondary_modalities: string[]
```

y a `Insert` y `Update`:

```typescript
          modality?: string | null
          secondary_modalities?: string[]
```

(Respetar el orden alfabético/formato del resto de campos del bloque si lo hay.)

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_goals_modality.sql types/database.types.ts
git commit -m "feat(modalidad): migración 0006 — modality y secondary_modalities en goals

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Onboarding — paso 2 de 4

**Files:**
- Modify: `store/onboarding.store.ts`
- Create: `app/(auth)/onboarding/step-2-modality.tsx`
- Rename: `app/(auth)/onboarding/step-2-body.tsx` → `step-3-body.tsx`; `app/(auth)/onboarding/step-3-level.tsx` → `step-4-level.tsx`
- Modify: `app/(auth)/onboarding/step-1-goals.tsx:28,48` (push y copy), `step-3-body.tsx` (copy línea ~66 y push línea ~52), `step-4-level.tsx` (copy línea ~102, insert de goals líneas ~64-70)

**Interfaces:**
- Consumes: `ModalityId`, `MODALITIES` de `@/constants/modalities` (Task 1).
- Produces: store con `modality: ModalityId | null`, `secondaryModalities: ModalityId[]`, `sportType: string | null`, acción `setStep2Modality(data: { modality: ModalityId; secondaryModalities: ModalityId[]; sportType?: string | null })`. El insert de `goals` en step-4 incluye `modality`, `secondary_modalities`, `sport_type`.

- [ ] **Step 1: Ampliar `store/onboarding.store.ts`**

Agregar el import y campos (el archivo completo queda así — reemplazar el existente):

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
  // Actions
  setStep1: (data: { goalType: GoalType; targetWeightKg?: number | null }) => void;
  setStep2Modality: (data: { modality: ModalityId; secondaryModalities: ModalityId[]; sportType?: string | null }) => void;
  setStep2: (data: { weightKg: number; heightCm: number; age: number; gender: Gender; activityLevel: ActivityLevel }) => void;
  setStep3: (data: { fitnessLevel: FitnessLevel; mode: Mode }) => void;
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
  setStep1: (data) => set({ goalType: data.goalType, targetWeightKg: data.targetWeightKg ?? null }),
  setStep2Modality: (data) =>
    set({
      modality: data.modality,
      secondaryModalities: data.secondaryModalities,
      sportType: data.sportType ?? null,
    }),
  setStep2: (data) => set(data),
  setStep3: (data) => set(data),
  reset: () => set({
    goalType: null, targetWeightKg: null,
    modality: null, secondaryModalities: [], sportType: null,
    weightKg: null, heightCm: null, age: null, gender: null, activityLevel: null,
    fitnessLevel: null, mode: 'flexible',
  }),
}));
```

(Los nombres `setStep2`/`setStep3` se conservan para no tocar las pantallas renombradas por dentro.)

- [ ] **Step 2: Renombrar pantallas con git mv**

```bash
git mv "app/(auth)/onboarding/step-2-body.tsx" "app/(auth)/onboarding/step-3-body.tsx"
git mv "app/(auth)/onboarding/step-3-level.tsx" "app/(auth)/onboarding/step-4-level.tsx"
```

- [ ] **Step 3: Actualizar navegación y copy en las pantallas existentes**

1. `step-1-goals.tsx` línea 28: `router.push('/(auth)/onboarding/step-2-body')` → `router.push('/(auth)/onboarding/step-2-modality')`; línea 48: `Paso 1 de 3` → `Paso 1 de 4`.
2. `step-3-body.tsx` (ex step-2-body) línea ~52: `router.push('/(auth)/onboarding/step-3-level')` → `router.push('/(auth)/onboarding/step-4-level')`; línea ~66: `Paso 2 de 3` → `Paso 3 de 4`.
3. `step-4-level.tsx` (ex step-3-level) línea ~102: `Paso 3 de 3` → `Paso 4 de 4`.

- [ ] **Step 4: Incluir modalidad en el insert de goals de `step-4-level.tsx`**

En el handler de guardado (~línea 64), leer los campos nuevos del store y agregarlos al insert. El destructuring del store en ese archivo debe incluir `modality, secondaryModalities, sportType`. El insert queda:

```typescript
      const { error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
      });
```

- [ ] **Step 5: Crear `app/(auth)/onboarding/step-2-modality.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/store/onboarding.store';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Input } from '@/components/ui/Input';

export default function Step2Modality() {
  const [principal, setPrincipal] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const { setStep2Modality } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const needsSport = principal === 'ball_sports' || secondary.includes('ball_sports');

  function selectPrincipal(id: ModalityId) {
    setPrincipal(id);
    setSecondary((prev) => prev.filter((s) => s !== id));
  }

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleContinue() {
    if (!principal) return;
    setStep2Modality({
      modality: principal,
      secondaryModalities: secondary,
      sportType: needsSport && sportType.trim() ? sportType.trim() : null,
    });
    router.push('/(auth)/onboarding/step-3-body');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text className="text-text-muted text-sm font-medium mb-1">Paso 2 de 4</Text>
          <Text className="text-text font-bold text-3xl">¿Cómo entrenas?</Text>
          <Text className="text-text-muted text-base mt-2">Tu disciplina principal define tu plan.</Text>
        </View>

        <View className="gap-3">
          {MODALITIES.map((m) => {
            const isSelected = principal === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => selectPrincipal(m.id)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <Text className="text-3xl">{m.icon}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold text-base ${isSelected ? 'text-primary' : 'text-text'}`}>
                      {m.label}
                    </Text>
                    <Text className="text-text-muted text-sm mt-0.5">{m.description}</Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background font-bold text-xs">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {principal && (
          <View className="mt-8">
            <Text className="text-text font-semibold text-lg">¿Combinas con algo más?</Text>
            <Text className="text-text-muted text-sm mt-1 mb-3">Opcional — hasta 2 disciplinas secundarias.</Text>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.filter((m) => m.id !== principal).map((m) => {
                const on = secondary.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleSecondary(m.id)}
                    className={`rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm ${on ? 'text-primary' : 'text-text'}`}>
                      {m.icon} {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {needsSport && (
          <View className="mt-6">
            <Text className="text-text font-semibold text-base mb-2">¿Qué deporte?</Text>
            <Input placeholder="Fútbol, básquet, tenis..." value={sportType} onChangeText={setSportType} />
          </View>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${principal ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!principal}
        >
          <Text className={`font-bold text-base ${principal ? 'text-background' : 'text-text-muted'}`}>
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

Nota: si el componente `Input` de `components/ui/Input.tsx` exige props distintas (revisar su firma), adaptar solo las props — no el diseño.

- [ ] **Step 6: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Si falla por la firma de `Input`, ajustar las props según `components/ui/Input.tsx` y re-correr.

- [ ] **Step 7: Commit**

```bash
git add store/onboarding.store.ts "app/(auth)/onboarding/"
git commit -m "feat(modalidad): onboarding 3→4 pasos con paso de modalidad

Paso 2 nuevo: principal obligatoria + hasta 2 secundarias + deporte
cuando aplica. El goal se guarda con modality/secondary_modalities/
sport_type.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: GeneratePlanSheet y hook

**Files:**
- Create: `components/plans/GeneratePlanSheet.tsx`
- Modify: `hooks/useWorkoutPlan.ts` (función `useGeneratePlan`, líneas 47-101)
- Modify: `app/(app)/plans/workout/index.tsx` (call site línea ~73)
- Modify: `app/(app)/plans/index.tsx` (call sites líneas ~190 y ~236)

**Interfaces:**
- Consumes: `MODALITIES`, `ModalityId` (Task 1); `useActiveGoal` de `@/hooks/useProfile`; componente `Sheet` de `@/components/ui/Sheet` (forwardRef a `BottomSheet`, prop `snapPoints`).
- Produces: `interface GeneratePlanParams { modality: ModalityId; days_per_week: number; minutes_per_session: number; equipment: string }` — **exportada desde `hooks/useWorkoutPlan.ts`** y importada por el sheet; `useGeneratePlan(refetch)` ahora retorna `{ generating, generate }` con `generate(params: GeneratePlanParams): Promise<void>` — **`promptDaysAndGenerate` desaparece**.

> Orden de implementación dentro de la task: primero el hook (Step 2 define el tipo), luego el sheet (Step 1 lo importa). Se listan en este orden por legibilidad del componente, pero al ejecutar conviene Step 2 → Step 1 → Step 3...

- [ ] **Step 1: Crear `components/plans/GeneratePlanSheet.tsx`**

```tsx
import { forwardRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { useActiveGoal } from '@/hooks/useProfile';
import type { GeneratePlanParams } from '@/hooks/useWorkoutPlan';

interface Props {
  onGenerate: (params: GeneratePlanParams) => void;
}

const DAYS = [3, 4, 5, 6];
const MINUTES = [30, 45, 60, 90];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
      activeOpacity={0.7}
    >
      <Text className={`text-sm ${on ? 'text-primary' : 'text-text'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export const GeneratePlanSheet = forwardRef<BottomSheet, Props>(function GeneratePlanSheet(
  { onGenerate },
  ref,
) {
  const { data: goal } = useActiveGoal();
  const [modality, setModality] = useState<ModalityId | null>(null);
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [customEquipment, setCustomEquipment] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Pre-cargar la modalidad del goal activo cuando llegue
  const goalModality = (goal as { modality?: string | null } | null)?.modality as ModalityId | undefined;
  useEffect(() => {
    if (goalModality && !modality) setModality(goalModality);
  }, [goalModality]);

  const presets = MODALITIES.find((m) => m.id === modality)?.equipmentPresets ?? [];
  const resolvedEquipment = showCustom ? customEquipment.trim() : (equipment ?? presets[0] ?? '');
  const canSubmit = !!modality && resolvedEquipment.length > 0;

  function selectModality(id: ModalityId) {
    setModality(id);
    setEquipment(null);
    setShowCustom(false);
    setCustomEquipment('');
  }

  return (
    <Sheet ref={ref} snapPoints={['85%']}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <Text className="text-text font-bold text-2xl mb-1">Forjar tu plan</Text>
        <Text className="text-text-muted text-sm mb-5">Dime cómo entrenas y lo armo a tu medida.</Text>

        <Text className="text-text font-semibold text-base mb-2">Disciplina</Text>
        <View className="flex-row flex-wrap gap-2 mb-5">
          {MODALITIES.map((m) => (
            <Chip key={m.id} label={`${m.icon} ${m.label}`} on={modality === m.id} onPress={() => selectModality(m.id)} />
          ))}
        </View>

        <Text className="text-text font-semibold text-base mb-2">Días por semana</Text>
        <View className="flex-row gap-2 mb-5">
          {DAYS.map((d) => (
            <Chip key={d} label={`${d}`} on={days === d} onPress={() => setDays(d)} />
          ))}
        </View>

        <Text className="text-text font-semibold text-base mb-2">Minutos por sesión</Text>
        <View className="flex-row gap-2 mb-5">
          {MINUTES.map((m) => (
            <Chip key={m} label={`${m}`} on={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>

        {modality && (
          <>
            <Text className="text-text font-semibold text-base mb-2">Equipo disponible</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {presets.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  on={!showCustom && (equipment ?? presets[0]) === p}
                  onPress={() => { setEquipment(p); setShowCustom(false); }}
                />
              ))}
              <Chip label="Otro…" on={showCustom} onPress={() => setShowCustom(true)} />
            </View>
            {showCustom && (
              <Input
                placeholder="Describe tu equipo"
                value={customEquipment}
                onChangeText={setCustomEquipment}
              />
            )}
          </>
        )}

        <View className="mt-6">
          <Button
            label="Forjar mi plan"
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            onPress={() =>
              modality &&
              onGenerate({
                modality,
                days_per_week: days,
                minutes_per_session: minutes,
                equipment: resolvedEquipment,
              })
            }
          />
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
});
```

Nota: verificar las props reales de `Button` (label/variant/size/disabled ya se usan así en `plans/workout/index.tsx`) y de `Input`; adaptar props sin cambiar el diseño.

- [ ] **Step 2: Reescribir `useGeneratePlan` en `hooks/useWorkoutPlan.ts`**

Reemplazar la función completa (líneas 47-101) por:

```typescript
import type { ModalityId } from '@/constants/modalities'; // agregar al bloque de imports del archivo

export interface GeneratePlanParams {
  modality: ModalityId;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string;
}

export function useGeneratePlan(refetch: () => Promise<unknown>) {
  const { session } = useAuthStore();
  const [generating, setGenerating] = useState(false);

  async function generate(params: GeneratePlanParams) {
    if (!session) return;
    setGenerating(true);
    try {
      // Persistir la modalidad en el goal activo si aún no tiene (usuarios
      // pre-multi-modalidad) y recoger las secundarias para la EF.
      const { data: goal } = await supabase
        .from('goals')
        .select('id, modality, secondary_modalities')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goal && !goal.modality) {
        await supabase.from('goals').update({ modality: params.modality }).eq('id', goal.id);
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          secondary_modalities: goal?.secondary_modalities ?? [],
        }),
      });

      const data = await res.json();

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

      await refetch();
      if (data.plan_id) {
        router.push(`/(app)/plans/workout/${data.plan_id}`);
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error de conexión. Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  }

  return { generating, generate };
}
```

- [ ] **Step 3: Actualizar `app/(app)/plans/workout/index.tsx`**

Cambios: importar `useRef` de react, `BottomSheet` type de `@gorhom/bottom-sheet` y `GeneratePlanSheet`; crear ref; el botón abre el sheet; renderizar el sheet al final del árbol.

```tsx
// imports nuevos
import { useEffect, useRef } from 'react';
import type BottomSheet from '@gorhom/bottom-sheet';
import { GeneratePlanSheet } from '@/components/plans/GeneratePlanSheet';

// dentro del componente
const sheetRef = useRef<BottomSheet>(null);
const { generating, generate } = useGeneratePlan(refetch);

// el Button del empty state:
onPress={() => sheetRef.current?.expand()}

// antes del cierre del SafeAreaView (después del View del empty state):
<GeneratePlanSheet
  ref={sheetRef}
  onGenerate={(params) => {
    sheetRef.current?.close();
    generate(params);
  }}
/>
```

- [ ] **Step 4: Actualizar `app/(app)/plans/index.tsx`**

Mismo patrón: reemplazar `promptDaysAndGenerate` por el sheet. Los dos `onPress={() => promptDaysAndGenerate('Generar Plan')}` (líneas ~190 y ~236) pasan a `onPress={() => sheetRef.current?.expand()}`; agregar el mismo ref + `<GeneratePlanSheet>` al final del árbol de la pantalla con el mismo `onGenerate` que en Step 3.

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. Errores esperables a corregir: firma real de `Sheet`/`Input`/`Button` — ajustar props según los componentes reales.

- [ ] **Step 6: Commit**

```bash
git add components/plans/GeneratePlanSheet.tsx hooks/useWorkoutPlan.ts "app/(app)/plans/workout/index.tsx" "app/(app)/plans/index.tsx"
git commit -m "feat(modalidad): GeneratePlanSheet reemplaza el Alert del generador

Modalidad (pre-cargada del goal), días, minutos y equipo por presets.
El hook persiste la modalidad en goals para usuarios existentes y
envía secondary_modalities a la EF.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: EF generate-plan con modalidad

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts` — firma de `buildPlanPrompt` (~línea 10), cuerpo del prompt (~líneas 42-95), destructuring del body (~líneas 172-178), armado de `userData` (donde se llama `buildPlanPrompt`).

**Interfaces:**
- Consumes: body `{ modality?: string, secondary_modalities?: string[] }` (Task 4 los envía).
- Produces: prompt con sección de disciplina; ids inválidos se ignoran (nunca 400 por modalidad).

- [ ] **Step 1: Agregar constantes de modalidad arriba de `buildPlanPrompt`**

```typescript
const MODALITY_LABELS: Record<string, string> = {
  gym_strength: 'fuerza en gimnasio (pesas y máquinas)',
  functional: 'entrenamiento funcional / CrossFit / HIIT',
  endurance: 'cardio de resistencia (correr, caminar, caminadora)',
  cycling: 'ciclismo / spinning',
  swimming: 'natación',
  home_calisthenics: 'entrenamiento en casa / calistenia',
  mobility: 'yoga / pilates / movilidad',
  ball_sports: 'preparación física para deporte con balón',
};
const VALID_MODALITIES = new Set(Object.keys(MODALITY_LABELS));
```

- [ ] **Step 2: Ampliar la firma de `buildPlanPrompt`**

Agregar al tipo de `userData`:

```typescript
  modality: string | null;
  secondary_modalities: string[];
```

- [ ] **Step 3: Insertar la sección de disciplina en el prompt**

Después de la línea `- Equipo disponible: ${userData.equipment}` agregar:

```typescript
${userData.modality ? `- Disciplina PRINCIPAL: ${MODALITY_LABELS[userData.modality]}` : ''}
${userData.secondary_modalities.length > 0 ? `- Disciplinas secundarias: ${userData.secondary_modalities.map((s) => MODALITY_LABELS[s]).join(', ')}` : ''}
```

Y antes de la línea final `Genera exactamente ${userData.days_per_week} días...` agregar el bloque de instrucciones:

```typescript
${userData.modality ? `INSTRUCCIONES DE DISCIPLINA:
- El plan es de ${MODALITY_LABELS[userData.modality]}: TODOS los días de entrenamiento se centran en esa disciplina.
- Adapta los campos del JSON semánticamente a la disciplina. Ejemplos: cardio → { "name": "Intervalos 6×400m", "sets": 6, "reps": "400m", "rest_seconds": 90 }; natación → { "name": "Series de crol", "sets": 8, "reps": "100m" }; yoga/movilidad → { "name": "Secuencia saludo al sol", "sets": 1, "reps": "5 rondas", "technique_notes": "Respiración ujjayi, un movimiento por respiración" }.
${userData.secondary_modalities.length > 0 ? `- Si days_per_week >= 4, dedica 1 día a cada disciplina secundaria; si no, intégralas en progression_notes como recomendación.` : ''}
${userData.modality === 'ball_sports' && userData.sport_type ? `- Orienta la preparación física al deporte: ${userData.sport_type}.` : ''}` : ''}
```

- [ ] **Step 4: Aceptar y sanear los campos en el handler**

El destructuring del body (~línea 172) queda:

```typescript
    const {
      days_per_week = 3,
      minutes_per_session = 60,
      equipment = 'gym con máquinas y pesas libres',
      injuries = '',
      modality = null,
      secondary_modalities = [],
    } = body;

    // Ids fuera del catálogo se descartan — la modalidad nunca tumba la generación
    const safeModality = typeof modality === 'string' && VALID_MODALITIES.has(modality) ? modality : null;
    const safeSecondary = Array.isArray(secondary_modalities)
      ? secondary_modalities.filter((s: unknown): s is string => typeof s === 'string' && VALID_MODALITIES.has(s)).slice(0, 2)
      : [];
```

Y donde se arma el objeto para `buildPlanPrompt`, agregar `modality: safeModality, secondary_modalities: safeSecondary`.

- [ ] **Step 5: Verificación E2E — plan de running**

Preparación (el usuario de prueba ya gastó su plan del mes — limpiar):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "delete from workout_plans where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723'; delete from async_jobs where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723'; update goals set modality=null, secondary_modalities='{}' where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723';"
```

Llamada (simula lo que enviará la app):

```bash
ANON_KEY="<ver Global Constraints>"
JWT=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{"email":"test-planfix@forja.test","password":"Test1234!"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
curl -s -X POST "http://127.0.0.1:54321/functions/v1/generate-plan" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"days_per_week":4,"minutes_per_session":45,"equipment":"aire libre","modality":"endurance","secondary_modalities":[]}' --max-time 300 -o /tmp/claude-1000/plan-endurance.json -w "http: %{http_code}\n"
python3 -c "
import json
p = json.load(open('/tmp/claude-1000/plan-endurance.json'))['plan']
assert len(p['schedule']) == 7, 'schedule debe tener 7 días'
print(p['title'])
for d in p['schedule'][:3]:
    print(d['day_name'], '—', d['focus'], '—', [e['name'] for e in d['exercises'][:2]])
"
```

Expected: `http: 200`, título y focus coherentes con running (intervalos, rodajes, tirada larga), NO ejercicios de pesas como focus principal.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/generate-plan/index.ts
git commit -m "feat(modalidad): generate-plan genera según disciplina principal y secundarias

Allowlist de 8 ids (inválidos se ignoran), ejemplos semánticos por
disciplina en el prompt, sin cambios al schema JSON.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: EF chat con modalidad

**Files:**
- Modify: `supabase/functions/chat/index.ts` — SELECT de goals (~línea 105) y bloque de contexto (~líneas 133-160).

**Interfaces:**
- Consumes: columnas `goals.modality`, `goals.secondary_modalities`, `goals.sport_type` (Task 2).
- Produces: línea de modalidad en el contexto de Vulcano.

- [ ] **Step 1: Ampliar el SELECT de goals**

Línea ~105: `select('type, fitness_level')` → `select('type, fitness_level, modality, secondary_modalities, sport_type')`.

- [ ] **Step 2: Agregar labels y línea de contexto**

Arriba del handler (junto a otras constantes) agregar el mismo `MODALITY_LABELS` de Task 5 Step 1. En la construcción del contexto, después del bloque de tono y antes de `${planBlock}`, agregar:

```typescript
    const goalData = goalResult.data as {
      fitness_level?: string;
      modality?: string | null;
      secondary_modalities?: string[];
      sport_type?: string | null;
    } | null;
    const modalityLine = goalData?.modality
      ? `Disciplina principal del usuario: ${MODALITY_LABELS[goalData.modality] ?? goalData.modality}${
          goalData.secondary_modalities?.length ? ` (también hace: ${goalData.secondary_modalities.map((s) => MODALITY_LABELS[s] ?? s).join(', ')})` : ''
        }${goalData.sport_type ? ` — deporte: ${goalData.sport_type}` : ''}. Habla en el lenguaje de su disciplina.`
      : '';
```

Y en el template del `userContextBlock`, intercalar `${modalityLine}` en su propia línea entre el tono y `${planBlock}`.

- [ ] **Step 3: Verificación E2E**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "update goals set modality='endurance' where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723' and is_active;"
# (mismo JWT que Task 5 Step 5)
curl -s -N -X POST "http://127.0.0.1:54321/functions/v1/chat" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" -d '{"message":"¿Cómo mejoro mi resistencia?"}' --max-time 60 | grep -o '"delta":"[^"]*"' | cut -d'"' -f4 | tr -d '\n' | head -c 400
```

Expected: respuesta en lenguaje de corredor (ritmo, rodajes, zonas, km) — no de gym.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/chat/index.ts
git commit -m "feat(modalidad): Vulcano conoce la disciplina del usuario

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación E2E de las 3 modalidades del spec

**Files:**
- Ninguno (solo verificación; si algo falla, arreglar en el archivo correspondiente y re-commitear con `fix(modalidad): ...`).

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Escenario `home_calisthenics`**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "delete from workout_plans where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723'; delete from async_jobs where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723';"
# mismo patrón de JWT; body:
# {"days_per_week":3,"minutes_per_session":30,"equipment":"sin equipo","modality":"home_calisthenics","secondary_modalities":[]}
```

Expected: 200; ejercicios de peso corporal (flexiones, sentadillas, planchas), nada que requiera máquinas.

- [ ] **Step 2: Escenario `gym_strength` + secundaria `endurance`**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "delete from workout_plans where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723'; delete from async_jobs where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723';"
# body: {"days_per_week":5,"minutes_per_session":60,"equipment":"gimnasio completo","modality":"gym_strength","secondary_modalities":["endurance"]}
```

Expected: 200; mayoría de días de fuerza + 1 día de cardio de resistencia en el schedule.

- [ ] **Step 3: Verificación final del repo**

Run: `npx tsc --noEmit && git status --short`
Expected: tsc exit 0; working tree limpio (todo commiteado).

- [ ] **Step 4: Restaurar el goal del usuario de prueba**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "update goals set modality='gym_strength' where user_id='c37f9116-b0a4-4b41-b536-cb2e1ac63723' and is_active;"
```

Expected: UPDATE 1. (El pase visual del onboarding y el sheet en Expo Go los hace David en el teléfono.)
