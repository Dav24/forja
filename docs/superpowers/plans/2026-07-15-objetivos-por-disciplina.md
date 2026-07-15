# Objetivos concretos por disciplina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Vulcano reciba una meta concreta por disciplina (rama de orientación + texto libre) y un peso/fecha objetivo real, en vez de solo el tipo de objetivo genérico — reviviendo `goals.target_weight_kg`/`target_date` (existen pero nunca se llenan) y agregando una 9ª modalidad "Primeros pasos" para principiantes absolutos, con una validación que bloquea metas de peso no saludables.

**Architecture:** Migración única (`0014`) agrega 3 columnas a `goals` (`modality_orientation`, `modality_goal_notes`, `secondary_goal_notes`) y una 9ª modalidad al `CHECK` de `modality`. Dos componentes compartidos nuevos (`TargetWeightPicker`, `ModalityOrientationPicker`) se consumen tanto en el onboarding (pasos 1 y 2) como en Ajustes (`settings/training.tsx`), evitando duplicar la UI. Una función pura nueva (`lib/weightGoalSafety.ts`) calcula si una meta de peso es segura (ritmo máx. seguro por semana + coherencia de dirección) y se invoca en el paso 3 del onboarding (donde por fin se conoce el peso actual) y en `settings/training.tsx` (donde el peso actual ya está disponible desde el primer render). Los 3 generadores de IA (`generate-plan`, `generate-meal-plan`, `chat`) leen los campos nuevos de `goals` e inyectan contexto al prompt, con un guardrail de empatía cuando la modalidad es `first_steps`.

**Tech Stack:** React Native/Expo, Supabase (Postgres + Edge Functions Deno), TanStack Query v5, Zustand, react-i18next, `@react-native-community/datetimepicker` (dependencia nueva).

## Global Constraints

- Spec fuente: `docs/superpowers/specs/2026-07-15-objetivos-por-disciplina-design.md` — toda cifra/valor exacto de este plan viene de ahí.
- Colores/fuentes SIEMPRE vía `useTheme()` — cero hex nuevos. Componentes de UI nuevos reusan `Chip`/`Input`/`FieldLabel` ya existentes.
- Claves i18n nuevas siempre es+en (`npm run check-i18n`).
- 36 ids de rama namespaced `<modality>_<branch>` — lista completa y exacta en Task 1 (SQL) y Task 2 (constants + i18n). No inventar ids nuevos fuera de esa lista.
- Sanitización de texto libre (`modality_goal_notes`/`secondary_goal_notes`): `text.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '')` — mismo patrón que `supplementsOther` (Fase D). Se aplica una sola vez, al momento de guardar (onboarding paso 2 → store ya sanitizado; Ajustes → en `handleSave`).
- Validación de ritmo seguro (`lib/weightGoalSafety.ts`): `weight_loss` ≤ 1% del peso actual/semana, `muscle_gain` ≤ 0.5%/semana. Solo aplica a esos 2 `goalType` (NO `recomposition`). `target_date` mínimo permitido: hoy + 14 días.
- 9ª modalidad `first_steps` (icon `leaf-outline`, emoji `🌱`) — se agrega en 4 lugares: `constants/modalities.ts`, `goals_modality_check` (SQL), `MODALITY_LABELS` en `generate-plan/index.ts`, `MODALITY_LABELS` en `chat/index.ts`.
- `generate-meal-plan` no tiene su propio `MODALITY_LABELS` — no requiere ese cambio puntual, solo el resto de los campos nuevos.
- Commits en español, prefijo `feat(objetivos-disciplina):`. Rama `master`. Dir: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Docker vía `sg docker -c "..."`. Migraciones: `sg docker -c "supabase migration up"`. Tras tocar EFs existentes: `sg docker -c "docker restart supabase_edge_runtime_forja"`.
- Sin test runner client-side en este repo (confirmado: sin `jest.config`, sin script `test` en `package.json`) — la lógica pura de `lib/weightGoalSafety.ts` se verifica con `tsc` + traza manual de los casos (mismo criterio ya usado en el repo para lógica cliente sin test runner, ej. Task 5 de Fase C: "snap trazado a mano"). Las Edge Functions SÍ usan `deno test` cuando tienen lógica extraíble — ninguna task de este plan crea una EF nueva, así que no aplica aquí.

---

### Task 1: Migración `0014` — columnas de `goals` + 9ª modalidad en el CHECK

**Files:**
- Create: `supabase/migrations/0014_discipline_goals.sql`
- Modify: `types/database.types.ts` (regenerado, no editado a mano)

**Interfaces:**
- Produces: columnas `goals.modality_orientation text`, `goals.modality_goal_notes text`, `goals.secondary_goal_notes text`; `goals_modality_check` acepta `'first_steps'` además de las 8 existentes.

- [ ] **Step 1: Escribir la migración**

```sql
-- Objetivos concretos por disciplina: rama de orientación + texto libre,
-- y 9ª modalidad "Primeros pasos" para principiantes absolutos.

alter table goals add column modality_orientation text;
alter table goals add column modality_goal_notes text;
alter table goals add column secondary_goal_notes text;

alter table goals add constraint goals_modality_orientation_check check (
  modality_orientation is null or modality_orientation in (
    'gym_strength_hypertrophy','gym_strength_max_strength','gym_strength_competition_prep','gym_strength_maintenance',
    'functional_hyrox_prep','functional_wod_times','functional_general_conditioning','functional_variety_only',
    'endurance_first_5k','endurance_short_distance_time','endurance_half_full_marathon','endurance_general_cardio',
    'cycling_start_long_distance','cycling_speed_power','cycling_competition_gran_fondo','cycling_general_cardio',
    'swimming_nonstop','swimming_technique','swimming_distance_time','swimming_competition_triathlon',
    'home_calisthenics_basics','home_calisthenics_advanced_skills','home_calisthenics_weight_loss_no_equipment','home_calisthenics_stay_active',
    'mobility_general_flexibility','mobility_injury_rehab','mobility_pain_tension','mobility_complement',
    'ball_sports_performance','ball_sports_season_prep','ball_sports_fun_fitness','ball_sports_injury_recovery',
    'first_steps_never_trained','first_steps_event_date','first_steps_energy_health','first_steps_just_move'
  )
);

-- 9ª modalidad "Primeros pasos"
alter table goals drop constraint goals_modality_check;
alter table goals add constraint goals_modality_check check (
  modality is null or modality in (
    'gym_strength','functional','endurance','cycling',
    'swimming','home_calisthenics','mobility','ball_sports','first_steps'
  )
);
```

- [ ] **Step 2: Aplicar la migración**

Run: `sg docker -c "supabase migration up"`
Expected: `Applying migration 0014_discipline_goals.sql...` sin errores.

- [ ] **Step 3: Verificar los constraints en vivo**

Run:
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"insert into goals (user_id, type, fitness_level, mode, modality_orientation) select id, 'general_fitness', 'casual', 'flexible', 'not_a_real_branch' from profiles limit 1;\""
```
Expected: error de constraint (`goals_modality_orientation_check`).

Run:
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"insert into goals (user_id, type, fitness_level, mode, modality) select id, 'general_fitness', 'casual', 'flexible', 'first_steps' from profiles limit 1;\""
```
Expected: inserta sin error (confirma que `first_steps` ya es válido en `goals_modality_check`). Borrar la fila de prueba después: `sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"delete from goals where modality='first_steps' and modality_orientation is null and user_id = (select id from profiles limit 1);\""` (ajustar el `where` si hay más de una fila de prueba).

- [ ] **Step 4: Regenerar tipos TypeScript**

Run: `sg docker -c "supabase gen types typescript --local"` (redirigir la salida a `types/database.types.ts`)
Expected: el archivo regenerado incluye `modality_orientation`, `modality_goal_notes`, `secondary_goal_notes` en la tabla `goals`. Verificar con `grep -c "modality_orientation" types/database.types.ts` — debe ser `> 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0014_discipline_goals.sql types/database.types.ts
git commit -m "feat(objetivos-disciplina): migración 0014 — modality_orientation/notes + 9ª modalidad first_steps"
```

---

### Task 2: `constants/modalityGoals.ts` + 9ª modalidad en `constants/modalities.ts` + i18n

**Files:**
- Create: `constants/modalityGoals.ts`
- Modify: `constants/modalities.ts`
- Modify: `locales/es/onboarding.json`, `locales/en/onboarding.json`

**Interfaces:**
- Consumes: nada (constantes puras).
- Produces: `MODALITY_GOAL_BRANCHES: Record<ModalityId, { id: string; labelKey: string }[]>`, `ModalityId` gana `'first_steps'` — lo consumen Task 4 (`ModalityOrientationPicker`) y Tasks 7/8/11 (onboarding/settings/EFs).

- [ ] **Step 1: `constants/modalityGoals.ts`**

```typescript
import type { ModalityId } from '@/constants/modalities';

export interface ModalityGoalBranch {
  id: string;
  labelKey: string;
}

export const MODALITY_GOAL_BRANCHES: Record<ModalityId, ModalityGoalBranch[]> = {
  gym_strength: [
    { id: 'gym_strength_hypertrophy', labelKey: 'onboarding:modalityGoals.gym_strength_hypertrophy' },
    { id: 'gym_strength_max_strength', labelKey: 'onboarding:modalityGoals.gym_strength_max_strength' },
    { id: 'gym_strength_competition_prep', labelKey: 'onboarding:modalityGoals.gym_strength_competition_prep' },
    { id: 'gym_strength_maintenance', labelKey: 'onboarding:modalityGoals.gym_strength_maintenance' },
  ],
  functional: [
    { id: 'functional_hyrox_prep', labelKey: 'onboarding:modalityGoals.functional_hyrox_prep' },
    { id: 'functional_wod_times', labelKey: 'onboarding:modalityGoals.functional_wod_times' },
    { id: 'functional_general_conditioning', labelKey: 'onboarding:modalityGoals.functional_general_conditioning' },
    { id: 'functional_variety_only', labelKey: 'onboarding:modalityGoals.functional_variety_only' },
  ],
  endurance: [
    { id: 'endurance_first_5k', labelKey: 'onboarding:modalityGoals.endurance_first_5k' },
    { id: 'endurance_short_distance_time', labelKey: 'onboarding:modalityGoals.endurance_short_distance_time' },
    { id: 'endurance_half_full_marathon', labelKey: 'onboarding:modalityGoals.endurance_half_full_marathon' },
    { id: 'endurance_general_cardio', labelKey: 'onboarding:modalityGoals.endurance_general_cardio' },
  ],
  cycling: [
    { id: 'cycling_start_long_distance', labelKey: 'onboarding:modalityGoals.cycling_start_long_distance' },
    { id: 'cycling_speed_power', labelKey: 'onboarding:modalityGoals.cycling_speed_power' },
    { id: 'cycling_competition_gran_fondo', labelKey: 'onboarding:modalityGoals.cycling_competition_gran_fondo' },
    { id: 'cycling_general_cardio', labelKey: 'onboarding:modalityGoals.cycling_general_cardio' },
  ],
  swimming: [
    { id: 'swimming_nonstop', labelKey: 'onboarding:modalityGoals.swimming_nonstop' },
    { id: 'swimming_technique', labelKey: 'onboarding:modalityGoals.swimming_technique' },
    { id: 'swimming_distance_time', labelKey: 'onboarding:modalityGoals.swimming_distance_time' },
    { id: 'swimming_competition_triathlon', labelKey: 'onboarding:modalityGoals.swimming_competition_triathlon' },
  ],
  home_calisthenics: [
    { id: 'home_calisthenics_basics', labelKey: 'onboarding:modalityGoals.home_calisthenics_basics' },
    { id: 'home_calisthenics_advanced_skills', labelKey: 'onboarding:modalityGoals.home_calisthenics_advanced_skills' },
    { id: 'home_calisthenics_weight_loss_no_equipment', labelKey: 'onboarding:modalityGoals.home_calisthenics_weight_loss_no_equipment' },
    { id: 'home_calisthenics_stay_active', labelKey: 'onboarding:modalityGoals.home_calisthenics_stay_active' },
  ],
  mobility: [
    { id: 'mobility_general_flexibility', labelKey: 'onboarding:modalityGoals.mobility_general_flexibility' },
    { id: 'mobility_injury_rehab', labelKey: 'onboarding:modalityGoals.mobility_injury_rehab' },
    { id: 'mobility_pain_tension', labelKey: 'onboarding:modalityGoals.mobility_pain_tension' },
    { id: 'mobility_complement', labelKey: 'onboarding:modalityGoals.mobility_complement' },
  ],
  ball_sports: [
    { id: 'ball_sports_performance', labelKey: 'onboarding:modalityGoals.ball_sports_performance' },
    { id: 'ball_sports_season_prep', labelKey: 'onboarding:modalityGoals.ball_sports_season_prep' },
    { id: 'ball_sports_fun_fitness', labelKey: 'onboarding:modalityGoals.ball_sports_fun_fitness' },
    { id: 'ball_sports_injury_recovery', labelKey: 'onboarding:modalityGoals.ball_sports_injury_recovery' },
  ],
  first_steps: [
    { id: 'first_steps_never_trained', labelKey: 'onboarding:modalityGoals.first_steps_never_trained' },
    { id: 'first_steps_event_date', labelKey: 'onboarding:modalityGoals.first_steps_event_date' },
    { id: 'first_steps_energy_health', labelKey: 'onboarding:modalityGoals.first_steps_energy_health' },
    { id: 'first_steps_just_move', labelKey: 'onboarding:modalityGoals.first_steps_just_move' },
  ],
};
```

- [ ] **Step 2: 9ª modalidad en `constants/modalities.ts`**

Cambiar la unión de tipo (línea 6-14):

```typescript
export type ModalityId =
  | 'gym_strength'
  | 'functional'
  | 'endurance'
  | 'cycling'
  | 'swimming'
  | 'home_calisthenics'
  | 'mobility'
  | 'ball_sports'
  | 'first_steps';
```

Agregar al final del array `MODALITIES` (después de la entrada `ball_sports`, antes del `];` de cierre):

```typescript
  {
    id: 'first_steps',
    labelKey: 'onboarding:modalities.first_steps.label',
    icon: '🌱',
    iconName: 'leaf-outline',
    descriptionKey: 'onboarding:modalities.first_steps.description',
    equipmentPresets: ['onboarding:modalities.first_steps.presets.0'],
  },
```

- [ ] **Step 3: Claves i18n — `locales/es/onboarding.json`**

Dentro de `"modalities": {...}`, agregar después de `"ball_sports": {...}`:

```json
    "first_steps": {
      "label": "Primeros pasos",
      "description": "Para quien nunca ha entrenado o quiere empezar con calma",
      "presets": ["Ninguno / lo que tengas en casa"]
    }
```

Agregar una nueva clave raíz `"modalityGoals"` (al mismo nivel que `"modalities"`), con las 36 entradas:

```json
  "modalityGoals": {
    "gym_strength_hypertrophy": "Hipertrofia / estética",
    "gym_strength_max_strength": "Fuerza máxima (PRs)",
    "gym_strength_competition_prep": "Prep. competencia (powerlifting/bodybuilding)",
    "gym_strength_maintenance": "Mantenimiento",
    "functional_hyrox_prep": "Prep. Hyrox / competencia funcional",
    "functional_wod_times": "Mejorar tiempos de WOD",
    "functional_general_conditioning": "Acondicionamiento general",
    "functional_variety_only": "Solo variedad",
    "endurance_first_5k": "Primeros 5K",
    "endurance_short_distance_time": "Bajar tiempo en 5K/10K",
    "endurance_half_full_marathon": "Medio maratón / maratón",
    "endurance_general_cardio": "Cardio general",
    "cycling_start_long_distance": "Empezar distancias largas",
    "cycling_speed_power": "Mejorar velocidad / potencia",
    "cycling_competition_gran_fondo": "Prep. competencia / gran fondo",
    "cycling_general_cardio": "Cardio general",
    "swimming_nonstop": "Nadar sin parar (ej. 25m)",
    "swimming_technique": "Corregir técnica",
    "swimming_distance_time": "Bajar tiempo en distancia",
    "swimming_competition_triathlon": "Prep. competencia / triatlón",
    "home_calisthenics_basics": "Lo básico (dominadas / lagartijas)",
    "home_calisthenics_advanced_skills": "Habilidades avanzadas (muscle-up, planche, front lever)",
    "home_calisthenics_weight_loss_no_equipment": "Perder peso sin equipo",
    "home_calisthenics_stay_active": "Mantenerse activo",
    "mobility_general_flexibility": "Flexibilidad general",
    "mobility_injury_rehab": "Rehabilitación de lesión",
    "mobility_pain_tension": "Reducir dolor / tensión específica",
    "mobility_complement": "Complemento de otro entreno",
    "ball_sports_performance": "Mejorar rendimiento en mi deporte",
    "ball_sports_season_prep": "Prep. física para temporada / torneo",
    "ball_sports_fun_fitness": "Diversión / mantenerme en forma",
    "ball_sports_injury_recovery": "Recuperación de lesión",
    "first_steps_never_trained": "Nunca he entrenado / voy con calma",
    "first_steps_event_date": "Tengo una fecha / evento en mente",
    "first_steps_energy_health": "Quiero más energía y salud",
    "first_steps_just_move": "Aún no sé, solo quiero moverme"
  },
```

- [ ] **Step 4: Claves i18n — `locales/en/onboarding.json`**

Mismo bloque en `"modalities.first_steps"`:

```json
    "first_steps": {
      "label": "First steps",
      "description": "For anyone who's never trained or wants to start slow",
      "presets": ["None / whatever you have at home"]
    }
```

Y `"modalityGoals"` completo en inglés:

```json
  "modalityGoals": {
    "gym_strength_hypertrophy": "Hypertrophy / aesthetics",
    "gym_strength_max_strength": "Max strength (PRs)",
    "gym_strength_competition_prep": "Competition prep (powerlifting/bodybuilding)",
    "gym_strength_maintenance": "Maintenance",
    "functional_hyrox_prep": "Hyrox / functional competition prep",
    "functional_wod_times": "Improve WOD times",
    "functional_general_conditioning": "General conditioning",
    "functional_variety_only": "Just variety",
    "endurance_first_5k": "First 5K",
    "endurance_short_distance_time": "Faster 5K/10K time",
    "endurance_half_full_marathon": "Half marathon / marathon",
    "endurance_general_cardio": "General cardio",
    "cycling_start_long_distance": "Starting long distances",
    "cycling_speed_power": "Improve speed / power",
    "cycling_competition_gran_fondo": "Competition / gran fondo prep",
    "cycling_general_cardio": "General cardio",
    "swimming_nonstop": "Swim nonstop (e.g. 25m)",
    "swimming_technique": "Fix technique",
    "swimming_distance_time": "Faster distance time",
    "swimming_competition_triathlon": "Competition / triathlon prep",
    "home_calisthenics_basics": "The basics (pull-ups / push-ups)",
    "home_calisthenics_advanced_skills": "Advanced skills (muscle-up, planche, front lever)",
    "home_calisthenics_weight_loss_no_equipment": "Lose weight with no equipment",
    "home_calisthenics_stay_active": "Stay active",
    "mobility_general_flexibility": "General flexibility",
    "mobility_injury_rehab": "Injury rehab",
    "mobility_pain_tension": "Reduce specific pain / tension",
    "mobility_complement": "Complement to other training",
    "ball_sports_performance": "Improve performance in my sport",
    "ball_sports_season_prep": "Physical prep for season / tournament",
    "ball_sports_fun_fitness": "Fun / staying fit",
    "ball_sports_injury_recovery": "Injury recovery",
    "first_steps_never_trained": "Never trained / taking it easy",
    "first_steps_event_date": "I have a date / event in mind",
    "first_steps_energy_health": "I want more energy and health",
    "first_steps_just_move": "Not sure yet, just want to move"
  },
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 6: Commit**

```bash
git add constants/modalityGoals.ts constants/modalities.ts locales/es/onboarding.json locales/en/onboarding.json
git commit -m "feat(objetivos-disciplina): constants/modalityGoals.ts + 9ª modalidad first_steps + i18n"
```

---

### Task 3: `lib/weightGoalSafety.ts` — validación de ritmo seguro + helpers de fecha

**Files:**
- Create: `lib/weightGoalSafety.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `checkWeightGoalSafety(input): WeightGoalCheckResult`, `addCalendarMonths(date, months): Date`, `toISODateString(date): string`, `MIN_TARGET_DATE_DAYS_AHEAD = 14` — consumidos por Task 4 (`TargetWeightPicker`), Task 9 (`step-3-body.tsx`) y Task 11 (`settings/training.tsx`).

- [ ] **Step 1: Implementar**

```typescript
// lib/weightGoalSafety.ts
export type GoalTypeForWeight = 'weight_loss' | 'muscle_gain';

export interface WeightGoalCheckInput {
  goalType: GoalTypeForWeight;
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string; // YYYY-MM-DD
  today?: Date; // inyectable para trazas manuales
}

export interface WeightGoalCheckResult {
  valid: boolean;
  reasonKey?: 'wrongDirection' | 'unsafeRate';
  rateKgPerWeek?: number;
  maxSafeRateKgPerWeek?: number;
}

const MAX_WEEKLY_RATE_PCT: Record<GoalTypeForWeight, number> = {
  weight_loss: 0.01,
  muscle_gain: 0.005,
};

const DIRECTION_MARGIN_KG = 0.1;

export function checkWeightGoalSafety(input: WeightGoalCheckInput): WeightGoalCheckResult {
  const { goalType, currentWeightKg, targetWeightKg, targetDate } = input;
  const today = input.today ?? new Date();

  if (goalType === 'weight_loss' && targetWeightKg >= currentWeightKg - DIRECTION_MARGIN_KG) {
    return { valid: false, reasonKey: 'wrongDirection' };
  }
  if (goalType === 'muscle_gain' && targetWeightKg <= currentWeightKg + DIRECTION_MARGIN_KG) {
    return { valid: false, reasonKey: 'wrongDirection' };
  }

  const target = new Date(targetDate);
  const daysUntil = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
  const weeksUntil = Math.max(1, daysUntil / 7);

  const rateKgPerWeek = Math.abs(targetWeightKg - currentWeightKg) / weeksUntil;
  const maxSafeRateKgPerWeek = currentWeightKg * MAX_WEEKLY_RATE_PCT[goalType];

  if (rateKgPerWeek > maxSafeRateKgPerWeek) {
    return { valid: false, reasonKey: 'unsafeRate', rateKgPerWeek, maxSafeRateKgPerWeek };
  }

  return { valid: true };
}

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function toISODateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const MIN_TARGET_DATE_DAYS_AHEAD = 14;
```

- [ ] **Step 2: Verificar con `tsc` + traza manual de 4 escenarios**

Run: `npx tsc --noEmit`
Expected: limpio.

Trazar a mano contra el código (sin test runner client-side en este repo, mismo criterio que otra lógica pura sin tests, ej. Fase C Task 5):

1. `{ goalType:'weight_loss', currentWeightKg:80, targetWeightKg:75, targetDate: hoy+4 semanas }` → `rateKgPerWeek = 5/4 = 1.25`, `maxSafeRateKgPerWeek = 80*0.01 = 0.8` → `1.25 > 0.8` → `{ valid:false, reasonKey:'unsafeRate' }`. Confirma el caso "bajar 5kg en ~1 mes" del pedido original queda bloqueado.
2. `{ goalType:'weight_loss', currentWeightKg:80, targetWeightKg:78, targetDate: hoy+8 semanas }` → `rateKgPerWeek = 2/8 = 0.25 ≤ 0.8` → `{ valid:true }`.
3. `{ goalType:'weight_loss', currentWeightKg:70, targetWeightKg:75, targetDate: cualquiera }` → meta mayor al peso actual con `goalType='weight_loss'` → `{ valid:false, reasonKey:'wrongDirection' }` (rechazado ANTES de calcular ritmo).
4. `{ goalType:'muscle_gain', currentWeightKg:70, targetWeightKg:73, targetDate: hoy+12 semanas }` → `rateKgPerWeek = 3/12 = 0.25`, `maxSafeRateKgPerWeek = 70*0.005 = 0.35` → `0.25 ≤ 0.35` → `{ valid:true }`.

Confirmar cada resultado leyendo el código línea por línea contra estos 4 casos antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add lib/weightGoalSafety.ts
git commit -m "feat(objetivos-disciplina): lib/weightGoalSafety.ts — ritmo seguro + helpers de fecha"
```

---

### Task 4: Dependencia `@react-native-community/datetimepicker` + `components/goals/TargetWeightPicker.tsx`

**Files:**
- Modify: `package.json`, `package-lock.json` (vía `expo install`)
- Create: `components/goals/TargetWeightPicker.tsx`
- Modify: `locales/es/common.json`, `locales/en/common.json`

**Interfaces:**
- Consumes: `addCalendarMonths`, `toISODateString`, `MIN_TARGET_DATE_DAYS_AHEAD` de `lib/weightGoalSafety.ts` (Task 3); `Input`, `Chip` de `components/ui/`.
- Produces: `<TargetWeightPicker weightValue, onChangeWeight, targetDate, onChangeTargetDate />` — lo consumen Task 7 (`step-1-goals.tsx`) y Task 11 (`settings/training.tsx`).

- [ ] **Step 1: Instalar la dependencia**

Run: `npx expo install @react-native-community/datetimepicker`
Expected: agrega la entrada a `package.json` con la versión compatible con Expo SDK 56.

- [ ] **Step 2: Claves i18n — `locales/es/common.json`**

Agregar clave raíz `"targetWeight"`:

```json
  "targetWeight": {
    "weightLabel": "Peso objetivo (kg)",
    "weightPlaceholder": "Ej: 75",
    "periodLabel": "¿Para cuándo?",
    "oneMonth": "1 mes",
    "threeMonths": "3 meses",
    "sixMonths": "6 meses",
    "customDate": "Fecha específica"
  },
```

- [ ] **Step 3: Claves i18n — `locales/en/common.json`**

```json
  "targetWeight": {
    "weightLabel": "Target weight (kg)",
    "weightPlaceholder": "E.g: 75",
    "periodLabel": "By when?",
    "oneMonth": "1 month",
    "threeMonths": "3 months",
    "sixMonths": "6 months",
    "customDate": "Specific date"
  },
```

- [ ] **Step 4: Implementar el componente**

```tsx
// components/goals/TargetWeightPicker.tsx
import { useState } from 'react';
import { View, Text } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { useTheme } from '@/lib/theme';
import { addCalendarMonths, toISODateString, MIN_TARGET_DATE_DAYS_AHEAD } from '@/lib/weightGoalSafety';

interface TargetWeightPickerProps {
  weightValue: string;
  onChangeWeight: (value: string) => void;
  targetDate: string | null;
  onChangeTargetDate: (value: string | null) => void;
}

const PERIOD_OPTIONS = [
  { months: 1, key: 'oneMonth' as const },
  { months: 3, key: 'threeMonths' as const },
  { months: 6, key: 'sixMonths' as const },
];

export function TargetWeightPicker({ weightValue, onChangeWeight, targetDate, onChangeTargetDate }: TargetWeightPickerProps) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const minimumDate = new Date(Date.now() + MIN_TARGET_DATE_DAYS_AHEAD * 86_400_000);

  function periodDate(months: number): string {
    return toISODateString(addCalendarMonths(new Date(), months));
  }

  const isCustomDate = !!targetDate && !PERIOD_OPTIONS.some((p) => targetDate === periodDate(p.months));
  const customLabel = isCustomDate && targetDate ? new Date(targetDate).toLocaleDateString() : t('targetWeight.customDate');

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && date) {
      onChangeTargetDate(toISODateString(date));
    }
  }

  return (
    <View className="gap-3">
      <Input
        label={t('targetWeight.weightLabel')}
        placeholder={t('targetWeight.weightPlaceholder')}
        value={weightValue}
        onChangeText={onChangeWeight}
        keyboardType="decimal-pad"
      />
      <View>
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.textMuted, marginBottom: 8 }}>
          {t('targetWeight.periodLabel')}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <Chip
              key={p.months}
              label={t(`targetWeight.${p.key}`)}
              selected={targetDate === periodDate(p.months)}
              onPress={() => onChangeTargetDate(periodDate(p.months))}
            />
          ))}
          <Chip label={customLabel} selected={isCustomDate} onPress={() => setShowPicker(true)} />
        </View>
      </View>
      {showPicker ? (
        <DateTimePicker
          value={targetDate ? new Date(targetDate) : minimumDate}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/goals/TargetWeightPicker.tsx locales/es/common.json locales/en/common.json
git commit -m "feat(objetivos-disciplina): componente compartido TargetWeightPicker + @react-native-community/datetimepicker"
```

---

### Task 5: `components/goals/ModalityOrientationPicker.tsx`

**Files:**
- Create: `components/goals/ModalityOrientationPicker.tsx`
- Modify: `locales/es/common.json`, `locales/en/common.json`

**Interfaces:**
- Consumes: `MODALITY_GOAL_BRANCHES` de `constants/modalityGoals.ts` (Task 2); `Input`, `Chip`, `FieldLabel` de `components/ui/`.
- Produces: `<ModalityOrientationPicker modality, orientation, onChangeOrientation, notes, onChangeNotes, showEditableHint? />` — lo consumen Task 8 (`step-2-modality.tsx`) y Task 11 (`settings/training.tsx`).

- [ ] **Step 1: Claves i18n — `locales/es/common.json`**

Agregar clave raíz `"modalityGoal"`:

```json
  "modalityGoal": {
    "label": "¿Qué buscas en esta disciplina?",
    "notesPlaceholder": "Cuéntale a Vulcano tu meta con tus palabras (marca actual, a qué le apuntas, fecha...)",
    "editableHint": "Podrás ajustar esto después en Ajustes → Mi entrenamiento."
  },
```

- [ ] **Step 2: Claves i18n — `locales/en/common.json`**

```json
  "modalityGoal": {
    "label": "What are you after in this discipline?",
    "notesPlaceholder": "Tell Vulcano your goal in your own words (current mark, what you're aiming for, a date...)",
    "editableHint": "You can adjust this later in Settings → My training."
  },
```

- [ ] **Step 3: Implementar el componente**

```tsx
// components/goals/ModalityOrientationPicker.tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { useTheme } from '@/lib/theme';
import { MODALITY_GOAL_BRANCHES } from '@/constants/modalityGoals';
import type { ModalityId } from '@/constants/modalities';

interface ModalityOrientationPickerProps {
  modality: ModalityId;
  orientation: string | null;
  onChangeOrientation: (id: string | null) => void;
  notes: string;
  onChangeNotes: (value: string) => void;
  showEditableHint?: boolean;
}

export function ModalityOrientationPicker({
  modality, orientation, onChangeOrientation, notes, onChangeNotes, showEditableHint = false,
}: ModalityOrientationPickerProps) {
  const { t } = useTranslation(['common', 'onboarding']);
  const { colors } = useTheme();
  const branches = MODALITY_GOAL_BRANCHES[modality];

  return (
    <View className="gap-3">
      <FieldLabel first>{t('common:modalityGoal.label')}</FieldLabel>
      <View className="flex-row flex-wrap gap-2">
        {branches.map((b) => (
          <Chip
            key={b.id}
            label={t(b.labelKey)}
            selected={orientation === b.id}
            onPress={() => onChangeOrientation(orientation === b.id ? null : b.id)}
          />
        ))}
      </View>
      <Input
        placeholder={t('common:modalityGoal.notesPlaceholder')}
        value={notes}
        onChangeText={onChangeNotes}
      />
      {showEditableHint ? (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textFaint }}>
          {t('common:modalityGoal.editableHint')}
        </Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios. `colors.textFaint` ya existe en `constants/themes.ts` (línea 16 dark `#6E655B`, línea 44 light `#9A8F83`), confirmado — no requiere ningún cambio ahí.

- [ ] **Step 5: Commit**

```bash
git add components/goals/ModalityOrientationPicker.tsx locales/es/common.json locales/en/common.json
git commit -m "feat(objetivos-disciplina): componente compartido ModalityOrientationPicker"
```

---

### Task 6: `store/onboarding.store.ts` — campos nuevos

**Files:**
- Modify: `store/onboarding.store.ts`

**Interfaces:**
- Produces: `targetDate`, `modalityOrientation`, `modalityGoalNotes`, `secondaryGoalNotes` en el store; `setStep1` gana `targetDate` opcional; `setStep2Modality` gana los 3 campos de disciplina opcionales — los consume Task 7, 8, 9, 10.

- [ ] **Step 1: Reescribir el store completo**

```typescript
// store/onboarding.store.ts
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
  targetDate: string | null;
  // Step 2 — modalidad
  modality: ModalityId | null;
  secondaryModalities: ModalityId[];
  sportType: string | null;
  modalityOrientation: string | null;
  modalityGoalNotes: string | null;
  secondaryGoalNotes: string | null;
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
  setStep1: (data: { goalType: GoalType; targetWeightKg?: number | null; targetDate?: string | null }) => void;
  setStep2Modality: (data: {
    modality: ModalityId;
    secondaryModalities: ModalityId[];
    sportType?: string | null;
    modalityOrientation?: string | null;
    modalityGoalNotes?: string | null;
    secondaryGoalNotes?: string | null;
  }) => void;
  setStep2: (data: { weightKg: number; heightCm: number; age: number; gender: Gender; activityLevel: ActivityLevel }) => void;
  setStep3: (data: { fitnessLevel: FitnessLevel; mode: Mode }) => void;
  setGoalId: (goalId: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  goalType: null,
  targetWeightKg: null,
  targetDate: null,
  modality: null,
  secondaryModalities: [],
  sportType: null,
  modalityOrientation: null,
  modalityGoalNotes: null,
  secondaryGoalNotes: null,
  weightKg: null,
  heightCm: null,
  age: null,
  gender: null,
  activityLevel: null,
  fitnessLevel: null,
  mode: 'flexible',
  goalId: null,
  setStep1: (data) => set({
    goalType: data.goalType,
    targetWeightKg: data.targetWeightKg ?? null,
    targetDate: data.targetDate ?? null,
  }),
  setStep2Modality: (data) =>
    set({
      modality: data.modality,
      secondaryModalities: data.secondaryModalities,
      sportType: data.sportType ?? null,
      modalityOrientation: data.modalityOrientation ?? null,
      modalityGoalNotes: data.modalityGoalNotes ?? null,
      secondaryGoalNotes: data.secondaryGoalNotes ?? null,
    }),
  setStep2: (data) => set(data),
  setStep3: (data) => set(data),
  setGoalId: (goalId) => set({ goalId }),
  reset: () => set({
    goalType: null, targetWeightKg: null, targetDate: null,
    modality: null, secondaryModalities: [], sportType: null,
    modalityOrientation: null, modalityGoalNotes: null, secondaryGoalNotes: null,
    weightKg: null, heightCm: null, age: null, gender: null, activityLevel: null,
    fitnessLevel: null, mode: 'flexible', goalId: null,
  }),
}));
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio (los callers existentes de `setStep1`/`setStep2Modality` con la firma vieja siguen compilando porque los campos nuevos son opcionales).

- [ ] **Step 3: Commit**

```bash
git add store/onboarding.store.ts
git commit -m "feat(objetivos-disciplina): onboarding.store.ts — targetDate + campos de disciplina"
```

---

### Task 7: `step-1-goals.tsx` — captura de peso objetivo + fecha

**Files:**
- Modify: `app/(auth)/onboarding/step-1-goals.tsx`

**Interfaces:**
- Consumes: `TargetWeightPicker` (Task 4), `setStep1` ampliado (Task 6).

- [ ] **Step 1: Agregar imports y estado local**

Después del import de `GOALS` (línea 11), agregar:

```typescript
import { TargetWeightPicker } from '@/components/goals/TargetWeightPicker';
```

Dentro del componente, después de `const [selected, setSelected] = useState<GoalType | null>(null);` (línea 16):

```typescript
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const showsWeightTarget = selected === 'weight_loss' || selected === 'muscle_gain';
```

- [ ] **Step 2: Actualizar `handleContinue`**

Reemplazar (línea 21-25):

```typescript
  function handleContinue() {
    if (!selected) return;
    const parsedTarget = showsWeightTarget && targetWeightInput.trim()
      ? Number(targetWeightInput.trim().replace(',', '.'))
      : null;
    setStep1({
      goalType: selected,
      targetWeightKg: parsedTarget !== null && Number.isFinite(parsedTarget) ? parsedTarget : null,
      targetDate: showsWeightTarget ? targetDate : null,
    });
    router.push('/(auth)/onboarding/step-2-modality');
  }
```

- [ ] **Step 3: Insertar el picker en el JSX**

Justo después del `</View>` que cierra `<View className="gap-3">{GOALS.map(...)}</View>` (línea 90) y antes del `</ScrollView>` (línea 91), agregar:

```tsx
        {showsWeightTarget && (
          <View className="mt-6">
            <TargetWeightPicker
              weightValue={targetWeightInput}
              onChangeWeight={setTargetWeightInput}
              targetDate={targetDate}
              onChangeTargetDate={setTargetDate}
            />
          </View>
        )}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/onboarding/step-1-goals.tsx"
git commit -m "feat(objetivos-disciplina): paso 1 del onboarding captura peso objetivo + fecha"
```

---

### Task 8: `step-2-modality.tsx` — rama de orientación + texto libre

**Files:**
- Modify: `app/(auth)/onboarding/step-2-modality.tsx`

**Interfaces:**
- Consumes: `ModalityOrientationPicker` (Task 5), `setStep2Modality` ampliado (Task 6).

- [ ] **Step 1: Agregar imports y estado local**

Después del import de `Input` (línea 11):

```typescript
import { ModalityOrientationPicker } from '@/components/goals/ModalityOrientationPicker';
```

Después de `const [sportType, setSportType] = useState('');` (línea 18):

```typescript
  const [orientation, setOrientation] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [secondaryNotes, setSecondaryNotes] = useState('');
```

- [ ] **Step 2: Resetear rama/notas al cambiar de principal**

Reemplazar `selectPrincipal` (línea 25-28):

```typescript
  function selectPrincipal(id: ModalityId) {
    setPrincipal(id);
    setSecondary((prev) => prev.filter((s) => s !== id));
    setOrientation(null);
    setNotes('');
  }
```

- [ ] **Step 3: Sanitizar y enviar al store en `handleContinue`**

Reemplazar (línea 38-46):

```typescript
  function handleContinue() {
    if (!principal) return;
    const sanitize = (v: string) => v.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
    setStep2Modality({
      modality: principal,
      secondaryModalities: secondary,
      sportType: needsSport && sportType.trim() ? sportType.trim() : null,
      modalityOrientation: orientation,
      modalityGoalNotes: notes.trim() ? sanitize(notes) : null,
      secondaryGoalNotes: secondary.length > 0 && secondaryNotes.trim() ? sanitize(secondaryNotes) : null,
    });
    router.push('/(auth)/onboarding/step-3-body');
  }
```

- [ ] **Step 4: Insertar el picker de rama tras elegir principal**

Justo después del `</View>` que cierra `<View className="gap-3">{MODALITIES.map(...)}</View>` (línea 101) y antes del bloque `{principal && (<View className="mt-8">...secondaryTitle...</View>)}` (línea 103), agregar:

```tsx
        {principal && (
          <View className="mt-6">
            <ModalityOrientationPicker
              modality={principal}
              orientation={orientation}
              onChangeOrientation={setOrientation}
              notes={notes}
              onChangeNotes={setNotes}
              showEditableHint
            />
          </View>
        )}
```

- [ ] **Step 5: Insertar el texto libre de secundarias**

Dentro del bloque `{principal && (<View className="mt-8">...` (línea 103-130), justo después del `</View>` que cierra `<View className="flex-row flex-wrap gap-2">{MODALITIES.filter(...).map(...)}</View>` (línea 128) y antes del `</View>` de cierre de todo el bloque (línea 129), agregar:

```tsx
            {secondary.length > 0 && (
              <View className="mt-4">
                <Input
                  placeholder={t('step2.secondaryNotesPlaceholder')}
                  value={secondaryNotes}
                  onChangeText={setSecondaryNotes}
                />
              </View>
            )}
```

- [ ] **Step 6: Clave i18n nueva — `locales/es/onboarding.json`**

Dentro de `"step2": {...}`, agregar junto a `"secondarySubtitle"`:

```json
    "secondaryNotesPlaceholder": "¿Algo que Vulcano deba saber de tus disciplinas secundarias? (opcional)",
```

- [ ] **Step 7: Clave i18n nueva — `locales/en/onboarding.json`**

```json
    "secondaryNotesPlaceholder": "Anything Vulcano should know about your secondary disciplines? (optional)",
```

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 9: Commit**

```bash
git add "app/(auth)/onboarding/step-2-modality.tsx" locales/es/onboarding.json locales/en/onboarding.json
git commit -m "feat(objetivos-disciplina): paso 2 del onboarding — rama de orientación + texto libre"
```

---

### Task 9: `step-3-body.tsx` — validación de ritmo seguro

**Files:**
- Modify: `app/(auth)/onboarding/step-3-body.tsx`
- Modify: `locales/es/onboarding.json`, `locales/en/onboarding.json`

**Interfaces:**
- Consumes: `checkWeightGoalSafety` de `lib/weightGoalSafety.ts` (Task 3), `useOnboardingStore` (`targetWeightKg`, `targetDate`, `goalType`).

- [ ] **Step 1: Agregar imports**

```typescript
import { useOnboardingStore } from '@/store/onboarding.store';
import { checkWeightGoalSafety } from '@/lib/weightGoalSafety';
```

(`useOnboardingStore` ya está importado en la línea 10 — solo agregar el import de `checkWeightGoalSafety` junto a él.)

- [ ] **Step 2: Leer `targetWeightKg`/`targetDate`/`goalType` del store**

Dentro del componente, junto a `const { setStep2 } = useOnboardingStore();` (línea 40):

```typescript
  const { setStep2, targetWeightKg, targetDate, goalType } = useOnboardingStore();
```

- [ ] **Step 3: Insertar la validación en `handleContinue`**

Reemplazar `handleContinue` (línea 44-58) agregando el chequeo justo después de validar `w`/`h`/`a` y antes de `setStep2(...)`:

```typescript
  function handleContinue() {
    if (!weight || !height || !age || !gender || !activityLevel) {
      Alert.alert(t('step3.errors.missingFields.title'), t('step3.errors.missingFields.body'));
      return;
    }
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (isNaN(w) || w < 20 || w > 300) { Alert.alert(t('step3.errors.invalidWeight.title'), t('step3.errors.invalidWeight.body')); return; }
    if (isNaN(h) || h < 100 || h > 250) { Alert.alert(t('step3.errors.invalidHeight.title'), t('step3.errors.invalidHeight.body')); return; }
    if (isNaN(a) || a < 12 || a > 100) { Alert.alert(t('step3.errors.invalidAge.title'), t('step3.errors.invalidAge.body')); return; }

    if (targetWeightKg != null && targetDate && (goalType === 'weight_loss' || goalType === 'muscle_gain')) {
      const check = checkWeightGoalSafety({
        goalType,
        currentWeightKg: w,
        targetWeightKg,
        targetDate,
      });
      if (!check.valid) {
        if (check.reasonKey === 'wrongDirection') {
          Alert.alert(t('step3.errors.wrongDirectionGoal.title'), t('step3.errors.wrongDirectionGoal.body'));
        } else {
          Alert.alert(
            t('step3.errors.unsafeGoalRate.title'),
            t('step3.errors.unsafeGoalRate.body', {
              rate: check.rateKgPerWeek?.toFixed(2),
              maxRate: check.maxSafeRateKgPerWeek?.toFixed(2),
            }),
          );
        }
        return;
      }
    }

    setStep2({ weightKg: w, heightCm: h, age: a, gender, activityLevel });
    router.push('/(auth)/onboarding/step-4-level');
  }
```

- [ ] **Step 4: Claves i18n nuevas — `locales/es/onboarding.json`**

Dentro de `"step3": { "errors": {...} }`, agregar junto a `"invalidAge"`:

```json
      "wrongDirectionGoal": {
        "title": "Tu meta y tu objetivo no coinciden",
        "body": "El peso objetivo que pusiste va en sentido contrario a tu objetivo. Vuelve al paso anterior y ajústalo."
      },
      "unsafeGoalRate": {
        "title": "Meta poco realista",
        "body": "Esa meta implicaría un ritmo de {{rate}}kg por semana — más de lo recomendado ({{maxRate}}kg/semana máx). Vuelve al paso anterior y ajusta tu meta de peso o el plazo."
      }
```

- [ ] **Step 5: Claves i18n nuevas — `locales/en/onboarding.json`**

```json
      "wrongDirectionGoal": {
        "title": "Your target and your goal don't match",
        "body": "The target weight you set goes against your goal's direction. Go back and adjust it."
      },
      "unsafeGoalRate": {
        "title": "Unrealistic target",
        "body": "That target implies a rate of {{rate}}kg per week — more than what's recommended ({{maxRate}}kg/week max). Go back and adjust your target weight or timeframe."
      }
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 7: Commit**

```bash
git add "app/(auth)/onboarding/step-3-body.tsx" locales/es/onboarding.json locales/en/onboarding.json
git commit -m "feat(objetivos-disciplina): paso 3 del onboarding valida ritmo seguro de la meta de peso"
```

---

### Task 10: `step-4-level.tsx` — persistir los campos nuevos en `goals`

**Files:**
- Modify: `app/(auth)/onboarding/step-4-level.tsx`

**Interfaces:**
- Consumes: `targetDate`, `modalityOrientation`, `modalityGoalNotes`, `secondaryGoalNotes` del store (Task 6).

- [ ] **Step 1: Leer los campos nuevos del store**

Reemplazar la desestructuración (línea 22):

```typescript
  const {
    user,
  } = useAuthStore();
  const {
    goalType, targetWeightKg, targetDate, modality, secondaryModalities, sportType,
    modalityOrientation, modalityGoalNotes, secondaryGoalNotes,
    weightKg, heightCm, age, gender, activityLevel, setGoalId,
  } = useOnboardingStore();
```

(Nota: `user` sigue viniendo de `useAuthStore()` como hoy — solo se reformatea la desestructuración de `useOnboardingStore()` para incluir los campos nuevos.)

- [ ] **Step 2: Agregar los campos al `insert`**

Reemplazar el `insert` a `goals` (línea 51-60):

```typescript
      const { data: newGoal, error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        target_date: targetDate ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
        modality_orientation: modalityOrientation ?? null,
        modality_goal_notes: modalityGoalNotes ?? null,
        secondary_goal_notes: secondaryGoalNotes ?? null,
      }).select('id').single();
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/onboarding/step-4-level.tsx"
git commit -m "feat(objetivos-disciplina): paso 4 del onboarding persiste target_date/modality_orientation/notes"
```

---

### Task 11: `settings/training.tsx` — edición posterior completa

**Files:**
- Modify: `app/(app)/settings/training.tsx`
- Modify: `locales/es/settings.json`, `locales/en/settings.json`

**Interfaces:**
- Consumes: `TargetWeightPicker` (Task 4), `ModalityOrientationPicker` (Task 5), `checkWeightGoalSafety` (Task 3).

- [ ] **Step 1: Agregar imports**

Después del import de `GroupCard` (línea 19):

```typescript
import { TargetWeightPicker } from '@/components/goals/TargetWeightPicker';
import { ModalityOrientationPicker } from '@/components/goals/ModalityOrientationPicker';
import { checkWeightGoalSafety, type GoalTypeForWeight } from '@/lib/weightGoalSafety';
```

- [ ] **Step 2: Estado local nuevo**

Después de `const [sportType, setSportType] = useState('');` (línea 45):

```typescript
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [modalityOrientation, setModalityOrientation] = useState<string | null>(null);
  const [modalityGoalNotes, setModalityGoalNotes] = useState('');
  const [secondaryGoalNotes, setSecondaryGoalNotes] = useState('');
```

- [ ] **Step 3: Precargar en el `useEffect` existente**

Dentro del `if (goal) { ... }` del `useEffect` (línea 58-66), agregar después de `setBackground(...)`:

```typescript
      setTargetWeightInput(goal.target_weight_kg != null ? String(goal.target_weight_kg) : '');
      setTargetDate(goal.target_date ?? null);
      setModalityOrientation(goal.modality_orientation ?? null);
      setModalityGoalNotes(goal.modality_goal_notes ?? '');
      setSecondaryGoalNotes(goal.secondary_goal_notes ?? '');
```

- [ ] **Step 4: Resetear `modality_orientation` al cambiar de disciplina principal**

Reemplazar el `onPress` del `Chip` de modalidad principal (línea 226-229):

```tsx
                  onPress={() => {
                    setModality(m.id);
                    setSecondary((prev) => prev.filter((s) => s !== m.id));
                    setModalityOrientation(null);
                  }}
```

- [ ] **Step 5: Validación de ritmo seguro en `handleSave`**

Dentro de `handleSave` (línea 98), justo después del bloque de validación de `heightNum`/`ageNum` (línea 104-107) y antes de `setSaving(true)` (línea 109), agregar:

`currentWeightKg` viene de `latestBody?.weight_kg` (el peso registrado más reciente, ya disponible vía `useLatestBodyData` en la línea 35, distinto de `heightNum`/`ageNum` que son otros campos del formulario). El chequeo de `latestBody?.weight_kg == null` va ANTES de construir `check`, no después — sin peso registrado no hay con qué calcular el ritmo:

```typescript
    const showsWeightTarget = goalType === 'weight_loss' || goalType === 'muscle_gain';
    const targetWeightNum = showsWeightTarget && targetWeightInput.trim()
      ? Number(targetWeightInput.trim().replace(',', '.'))
      : null;
    if (showsWeightTarget && targetWeightNum != null && targetDate) {
      if (latestBody?.weight_kg == null) {
        Alert.alert(t('training.noBodyDataTitle'), t('training.noBodyDataBody'));
        return;
      }
      const check = checkWeightGoalSafety({
        goalType: goalType as GoalTypeForWeight,
        currentWeightKg: Number(latestBody.weight_kg),
        targetWeightKg: targetWeightNum,
        targetDate,
      });
      if (!check.valid) {
        if (check.reasonKey === 'wrongDirection') {
          Alert.alert(t('training.wrongDirectionGoalTitle'), t('training.wrongDirectionGoalBody'));
        } else {
          Alert.alert(
            t('training.unsafeGoalRateTitle'),
            t('training.unsafeGoalRateBody', {
              rate: check.rateKgPerWeek?.toFixed(2),
              maxRate: check.maxSafeRateKgPerWeek?.toFixed(2),
            }),
          );
        }
        return;
      }
    }
```

- [ ] **Step 6: Sanitizar y agregar los campos al `insert`**

Reemplazar el `insert` a `goals` (línea 120-131):

```typescript
      const sanitize = (v: string) => v.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      const { error: goalErr } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightNum,
        target_date: showsWeightTarget ? targetDate : null,
        fitness_level: level,
        mode,
        modality,
        secondary_modalities: secondary,
        sport_type: needsSport && sportType.trim() ? sportType.trim() : null,
        athletic_background: background,
        modality_orientation: modalityOrientation,
        modality_goal_notes: modalityGoalNotes.trim() ? sanitize(modalityGoalNotes) : null,
        secondary_goal_notes: secondary.length > 0 && secondaryGoalNotes.trim() ? sanitize(secondaryGoalNotes) : null,
      });
```

- [ ] **Step 7: JSX — peso objetivo en la card "Perfil de entrenamiento"**

Dentro del `GroupCard title={t('training.groupProfileTitle')}` (línea 192-213), justo después del bloque de `MODES` (antes del `</GroupCard>` de cierre, línea 213), agregar:

```tsx
            {(goalType === 'weight_loss' || goalType === 'muscle_gain') && (
              <>
                <FieldLabel>{t('training.targetWeightSectionLabel')}</FieldLabel>
                <TargetWeightPicker
                  weightValue={targetWeightInput}
                  onChangeWeight={setTargetWeightInput}
                  targetDate={targetDate}
                  onChangeTargetDate={setTargetDate}
                />
              </>
            )}
```

- [ ] **Step 8: JSX — rama de orientación en la card "Disciplina"**

Dentro del `GroupCard title={t('training.groupDisciplineTitle')}` (línea 217-248), justo después del bloque `needsSport` (antes del `</GroupCard>` de cierre, línea 247), agregar:

```tsx
            {modality && (
              <View className="mt-4">
                <ModalityOrientationPicker
                  modality={modality}
                  orientation={modalityOrientation}
                  onChangeOrientation={setModalityOrientation}
                  notes={modalityGoalNotes}
                  onChangeNotes={setModalityGoalNotes}
                />
              </View>
            )}
            {secondary.length > 0 && (
              <View className="mt-4">
                <Input
                  placeholder={t('training.secondaryNotesPlaceholder')}
                  value={secondaryGoalNotes}
                  onChangeText={setSecondaryGoalNotes}
                />
              </View>
            )}
```

- [ ] **Step 9: Claves i18n nuevas — `locales/es/settings.json`**

Dentro de `"training": {...}`, agregar junto a `"groupBackgroundTitle"`:

```json
    "targetWeightSectionLabel": "Peso objetivo",
    "secondaryNotesPlaceholder": "¿Algo que Vulcano deba saber de tus disciplinas secundarias? (opcional)",
    "noBodyDataTitle": "Falta tu peso actual",
    "noBodyDataBody": "Registra tu peso al menos una vez (pestaña Progreso) antes de fijar un peso objetivo.",
    "wrongDirectionGoalTitle": "Tu meta y tu objetivo no coinciden",
    "wrongDirectionGoalBody": "El peso objetivo que pusiste va en sentido contrario a tu objetivo actual.",
    "unsafeGoalRateTitle": "Meta poco realista",
    "unsafeGoalRateBody": "Esa meta implicaría un ritmo de {{rate}}kg por semana — más de lo recomendado ({{maxRate}}kg/semana máx). Ajusta tu meta de peso o el plazo.",
```

- [ ] **Step 10: Claves i18n nuevas — `locales/en/settings.json`**

```json
    "targetWeightSectionLabel": "Target weight",
    "secondaryNotesPlaceholder": "Anything Vulcano should know about your secondary disciplines? (optional)",
    "noBodyDataTitle": "Missing your current weight",
    "noBodyDataBody": "Log your weight at least once (Progress tab) before setting a target weight.",
    "wrongDirectionGoalTitle": "Your target and your goal don't match",
    "wrongDirectionGoalBody": "The target weight you set goes against your current goal's direction.",
    "unsafeGoalRateTitle": "Unrealistic target",
    "unsafeGoalRateBody": "That target implies a rate of {{rate}}kg per week — more than what's recommended ({{maxRate}}kg/week max). Adjust your target weight or timeframe.",
```

- [ ] **Step 11: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 12: E2E manual con un usuario de prueba**

Con la app corriendo en Expo Go (`npm start`), entrar a Ajustes → Mi entrenamiento con un usuario cuyo `goalType` sea `weight_loss`: confirmar que aparece el `TargetWeightPicker` bajo Modo; poner un peso objetivo superior al peso actual y guardar → debe bloquear con el Alert de "Tu meta y tu objetivo no coinciden". Poner un peso objetivo razonable (ej. -2kg) con plazo "1 mes" → debe guardar sin error. Cambiar la disciplina principal → confirmar que la rama seleccionada se deselecciona visualmente antes de guardar.

- [ ] **Step 13: Commit**

```bash
git add "app/(app)/settings/training.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(objetivos-disciplina): Ajustes — edición de peso objetivo, rama de orientación y notas"
```

---

### Task 12: `generate-plan` — consumo de los campos nuevos + 9ª modalidad + guardrail `first_steps`

**Files:**
- Modify: `supabase/functions/generate-plan/index.ts`

**Interfaces:**
- Consumes: columnas nuevas de `goals` (Task 1).

- [ ] **Step 1: Agregar `first_steps` a `MODALITY_LABELS`**

Reemplazar (línea 10-19):

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
  first_steps: 'primeros pasos / sin experiencia previa',
};
```

- [ ] **Step 2: Mapa de labels de rama**

Después de `const VALID_MODALITIES = new Set(Object.keys(MODALITY_LABELS));` (línea 20), agregar:

```typescript
const MODALITY_GOAL_BRANCH_LABELS: Record<string, string> = {
  gym_strength_hypertrophy: 'hipertrofia / estética',
  gym_strength_max_strength: 'fuerza máxima (PRs)',
  gym_strength_competition_prep: 'prep. competencia (powerlifting/bodybuilding)',
  gym_strength_maintenance: 'mantenimiento',
  functional_hyrox_prep: 'prep. Hyrox / competencia funcional',
  functional_wod_times: 'mejorar tiempos de WOD',
  functional_general_conditioning: 'acondicionamiento general',
  functional_variety_only: 'solo variedad',
  endurance_first_5k: 'primeros 5K',
  endurance_short_distance_time: 'bajar tiempo en 5K/10K',
  endurance_half_full_marathon: 'medio maratón / maratón',
  endurance_general_cardio: 'cardio general',
  cycling_start_long_distance: 'empezar distancias largas',
  cycling_speed_power: 'mejorar velocidad / potencia',
  cycling_competition_gran_fondo: 'prep. competencia / gran fondo',
  cycling_general_cardio: 'cardio general',
  swimming_nonstop: 'nadar sin parar',
  swimming_technique: 'corregir técnica',
  swimming_distance_time: 'bajar tiempo en distancia',
  swimming_competition_triathlon: 'prep. competencia / triatlón',
  home_calisthenics_basics: 'lo básico (dominadas/lagartijas)',
  home_calisthenics_advanced_skills: 'habilidades avanzadas (muscle-up/planche/front lever)',
  home_calisthenics_weight_loss_no_equipment: 'perder peso sin equipo',
  home_calisthenics_stay_active: 'mantenerse activo',
  mobility_general_flexibility: 'flexibilidad general',
  mobility_injury_rehab: 'rehabilitación de lesión',
  mobility_pain_tension: 'reducir dolor/tensión específica',
  mobility_complement: 'complemento de otro entreno',
  ball_sports_performance: 'mejorar rendimiento en su deporte',
  ball_sports_season_prep: 'prep. física para temporada/torneo',
  ball_sports_fun_fitness: 'diversión / mantenerse en forma',
  ball_sports_injury_recovery: 'recuperación de lesión',
  first_steps_never_trained: 'nunca ha entrenado / va con calma',
  first_steps_event_date: 'tiene una fecha/evento en mente',
  first_steps_energy_health: 'quiere más energía y salud',
  first_steps_just_move: 'aún no sabe, solo quiere moverse',
};

const FIRST_STEPS_EMPATHY_GUARDRAIL = 'El usuario está en modalidad "Primeros pasos" — es su punto de partida en fitness o puede tener expectativas poco realistas. Corrige expectativas poco realistas CON EMPATÍA, prioriza adherencia y formación de hábito sobre intensidad, y encuadra esto como el inicio de un cambio de estilo de vida, no una rutina relámpago.';
```

- [ ] **Step 3: Ampliar `userData` de `buildPlanPrompt`**

En la interfaz de `buildPlanPrompt` (línea 22-42), agregar después de `supplementsOther: string | null;`:

```typescript
  targetWeightKg: number | null;
  targetDate: string | null;
  modalityOrientation: string | null;
  modalityGoalNotes: string | null;
  secondaryGoalNotes: string | null;
```

- [ ] **Step 4: Nuevas líneas del prompt**

Reemplazar la línea `${backgroundLine}${supplementsLine}` (línea 91) por:

```typescript
  const weightGoalLine = userData.targetWeightKg != null && userData.targetDate
    ? `- Meta de peso: ${userData.goal_type === 'weight_loss' ? 'bajar' : 'subir'} a ${userData.targetWeightKg}kg para ${userData.targetDate}\n`
    : '';
  const orientationLine = userData.modalityOrientation
    ? `- Objetivo específico en su disciplina principal (${MODALITY_GOAL_BRANCH_LABELS[userData.modalityOrientation] ?? userData.modalityOrientation}): ${userData.modalityGoalNotes ?? 'sin notas adicionales'}\n`
    : '';
  const secondaryNotesLine = userData.secondaryGoalNotes
    ? `- Disciplinas secundarias — notas del usuario: ${userData.secondaryGoalNotes}\n`
    : '';
  const firstStepsLine = userData.modality === 'first_steps' ? `${FIRST_STEPS_EMPATHY_GUARDRAIL}\n` : '';
```

Y en el template string, reemplazar `${backgroundLine}${supplementsLine}` por:

```
${backgroundLine}${supplementsLine}${weightGoalLine}${orientationLine}${secondaryNotesLine}${firstStepsLine}
```

- [ ] **Step 5: Ampliar el `select` de `goals`**

Reemplazar (línea 238-239):

```typescript
        .select('type, fitness_level, mode, sport_type, athletic_background, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes')
```

- [ ] **Step 6: Pasar los campos nuevos a `buildPlanPrompt`**

En la llamada a `buildPlanPrompt` (línea 292-312), agregar después de `supplementsOther: profileResult.data?.supplements_other ?? null,`:

```typescript
      targetWeightKg: goal.target_weight_kg != null ? Number(goal.target_weight_kg) : null,
      targetDate: goal.target_date ?? null,
      modalityOrientation: goal.modality_orientation ?? null,
      modalityGoalNotes: goal.modality_goal_notes ?? null,
      secondaryGoalNotes: goal.secondary_goal_notes ?? null,
```

- [ ] **Step 7: Verificar con `tsc` de Deno**

Run: `cd supabase/functions && deno check generate-plan/index.ts`
Expected: sin errores de tipos.

- [ ] **Step 8: Reiniciar el runtime y probar con curl**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja"`

Con un JWT real de un usuario de prueba con `goal.modality_orientation` seteado (insertarlo manualmente vía SQL si no hay uno de prueba a mano):

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/generate-plan \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"days_per_week":4,"minutes_per_session":60,"equipment":"gimnasio completo"}'
```
Expected: `200`, job creado. Confirmar en los logs de la EF (`sg docker -c "docker logs supabase_edge_runtime_forja --tail 80"`) que el prompt enviado a Anthropic incluye la línea de "Objetivo específico en su disciplina principal".

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/generate-plan/index.ts
git commit -m "feat(objetivos-disciplina): generate-plan lee meta de peso/rama de disciplina + guardrail first_steps"
```

---

### Task 13: `generate-meal-plan` — mismo tratamiento

**Files:**
- Modify: `supabase/functions/generate-meal-plan/index.ts`

**Interfaces:**
- Consumes: columnas nuevas de `goals` (Task 1).

- [ ] **Step 1: Mapa de labels de rama + guardrail**

Después de `const CORS_HEADERS = {...};` (línea 10), agregar (mismo contenido que Task 12 Step 2, duplicado — este archivo no comparte módulo con `generate-plan`):

```typescript
const MODALITY_GOAL_BRANCH_LABELS: Record<string, string> = {
  gym_strength_hypertrophy: 'hipertrofia / estética',
  gym_strength_max_strength: 'fuerza máxima (PRs)',
  gym_strength_competition_prep: 'prep. competencia (powerlifting/bodybuilding)',
  gym_strength_maintenance: 'mantenimiento',
  functional_hyrox_prep: 'prep. Hyrox / competencia funcional',
  functional_wod_times: 'mejorar tiempos de WOD',
  functional_general_conditioning: 'acondicionamiento general',
  functional_variety_only: 'solo variedad',
  endurance_first_5k: 'primeros 5K',
  endurance_short_distance_time: 'bajar tiempo en 5K/10K',
  endurance_half_full_marathon: 'medio maratón / maratón',
  endurance_general_cardio: 'cardio general',
  cycling_start_long_distance: 'empezar distancias largas',
  cycling_speed_power: 'mejorar velocidad / potencia',
  cycling_competition_gran_fondo: 'prep. competencia / gran fondo',
  cycling_general_cardio: 'cardio general',
  swimming_nonstop: 'nadar sin parar',
  swimming_technique: 'corregir técnica',
  swimming_distance_time: 'bajar tiempo en distancia',
  swimming_competition_triathlon: 'prep. competencia / triatlón',
  home_calisthenics_basics: 'lo básico (dominadas/lagartijas)',
  home_calisthenics_advanced_skills: 'habilidades avanzadas (muscle-up/planche/front lever)',
  home_calisthenics_weight_loss_no_equipment: 'perder peso sin equipo',
  home_calisthenics_stay_active: 'mantenerse activo',
  mobility_general_flexibility: 'flexibilidad general',
  mobility_injury_rehab: 'rehabilitación de lesión',
  mobility_pain_tension: 'reducir dolor/tensión específica',
  mobility_complement: 'complemento de otro entreno',
  ball_sports_performance: 'mejorar rendimiento en su deporte',
  ball_sports_season_prep: 'prep. física para temporada/torneo',
  ball_sports_fun_fitness: 'diversión / mantenerse en forma',
  ball_sports_injury_recovery: 'recuperación de lesión',
  first_steps_never_trained: 'nunca ha entrenado / va con calma',
  first_steps_event_date: 'tiene una fecha/evento en mente',
  first_steps_energy_health: 'quiere más energía y salud',
  first_steps_just_move: 'aún no sabe, solo quiere moverse',
};

const FIRST_STEPS_EMPATHY_GUARDRAIL = 'El usuario está en modalidad "Primeros pasos" — es su punto de partida en fitness o puede tener expectativas poco realistas. Corrige expectativas poco realistas CON EMPATÍA, prioriza adherencia y formación de hábito sobre intensidad, y encuadra esto como el inicio de un cambio de estilo de vida, no una dieta relámpago.';
```

- [ ] **Step 2: Ampliar `userData` de `buildMealPlanPrompt`**

En la interfaz (línea 12-27), agregar después de `supplementsOther: string | null;`:

```typescript
  targetWeightKg: number | null;
  targetDate: string | null;
  modalityOrientation: string | null;
  modalityGoalNotes: string | null;
  secondaryGoalNotes: string | null;
  modality: string | null;
```

(La interfaz ya tiene `goal_type: string;` desde antes — se reusa ese campo, no se agrega uno nuevo.)

- [ ] **Step 3: Nuevas líneas del prompt**

Reemplazar `${backgroundLine}${supplementsLine}` (línea 71) por:

```typescript
  const weightGoalLine = userData.targetWeightKg != null && userData.targetDate
    ? `- Meta de peso: ${userData.goal_type === 'weight_loss' ? 'bajar' : 'subir'} a ${userData.targetWeightKg}kg para ${userData.targetDate}\n`
    : '';
  const orientationLine = userData.modalityOrientation
    ? `- Objetivo específico en su disciplina principal (${MODALITY_GOAL_BRANCH_LABELS[userData.modalityOrientation] ?? userData.modalityOrientation}): ${userData.modalityGoalNotes ?? 'sin notas adicionales'}\n`
    : '';
  const secondaryNotesLine = userData.secondaryGoalNotes
    ? `- Disciplinas secundarias — notas del usuario: ${userData.secondaryGoalNotes}\n`
    : '';
  const firstStepsLine = userData.modality === 'first_steps' ? `${FIRST_STEPS_EMPATHY_GUARDRAIL}\n` : '';
```

Y en el template, reemplazar `${backgroundLine}${supplementsLine}` por `${backgroundLine}${supplementsLine}${weightGoalLine}${orientationLine}${secondaryNotesLine}${firstStepsLine}`.

- [ ] **Step 4: Ampliar el `select` de `goals`**

Reemplazar (línea 204):

```typescript
      supabase.from('goals').select('type, fitness_level, athletic_background, modality, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes')
```

- [ ] **Step 5: Pasar los campos nuevos a `buildMealPlanPrompt`**

En la llamada (línea 239-255), agregar después de `supplementsOther: profileResult.data?.supplements_other ?? null,`:

```typescript
      targetWeightKg: goalResult.data.target_weight_kg != null ? Number(goalResult.data.target_weight_kg) : null,
      targetDate: goalResult.data.target_date ?? null,
      modalityOrientation: goalResult.data.modality_orientation ?? null,
      modalityGoalNotes: goalResult.data.modality_goal_notes ?? null,
      secondaryGoalNotes: goalResult.data.secondary_goal_notes ?? null,
      modality: goalResult.data.modality ?? null,
```

(`goal_type: goalResult.data.type,` ya está en esta llamada desde antes — no se toca.)

- [ ] **Step 6: Verificar**

Run: `cd supabase/functions && deno check generate-meal-plan/index.ts`
Expected: sin errores.

- [ ] **Step 7: Reiniciar el runtime y probar con curl**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja"`

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/generate-meal-plan \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"diet_type":"omnívoro","food_availability":"media"}'
```
Expected: `200`. Confirmar en los logs que el prompt incluye la línea de meta de peso si el usuario de prueba tiene `target_weight_kg`/`target_date` seteados.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/generate-meal-plan/index.ts
git commit -m "feat(objetivos-disciplina): generate-meal-plan lee meta de peso/rama de disciplina + guardrail first_steps"
```

---

### Task 14: `chat` — contexto de meta + guardrail `first_steps`

**Files:**
- Modify: `supabase/functions/chat/index.ts`

**Interfaces:**
- Consumes: columnas nuevas de `goals` (Task 1).

- [ ] **Step 1: Agregar `first_steps` a `MODALITY_LABELS`**

Reemplazar (línea 6-15):

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
  first_steps: 'primeros pasos / sin experiencia previa',
};
```

- [ ] **Step 2: Mapa de labels de rama + guardrail**

Después de `MODALITY_LABELS` (justo antes de `const TONE_BY_LEVEL`, línea 17), agregar el mismo bloque `MODALITY_GOAL_BRANCH_LABELS`/`FIRST_STEPS_EMPATHY_GUARDRAIL` de Task 12 Step 2 (idéntico, tercera copia — mismo criterio de duplicación entre EFs ya aceptado en este proyecto).

- [ ] **Step 3: Ampliar el `select` de `goals`**

Reemplazar (línea 116):

```typescript
      supabase.from('goals').select('type, fitness_level, modality, secondary_modalities, sport_type, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
```

- [ ] **Step 4: Ampliar el tipo de `goalData` y agregar la línea de contexto**

Reemplazar (línea 149-159):

```typescript
    const goalData = goalResult.data as {
      fitness_level?: string;
      modality?: string | null;
      secondary_modalities?: string[];
      sport_type?: string | null;
      target_weight_kg?: number | string | null;
      target_date?: string | null;
      modality_orientation?: string | null;
      modality_goal_notes?: string | null;
      secondary_goal_notes?: string | null;
    } | null;
    const modalityLine = goalData?.modality
      ? `Disciplina principal del usuario: ${MODALITY_LABELS[goalData.modality] ?? goalData.modality}${
          goalData.secondary_modalities?.length ? ` (también hace: ${goalData.secondary_modalities.map((s) => MODALITY_LABELS[s] ?? s).join(', ')})` : ''
        }${goalData.sport_type ? ` — deporte: ${goalData.sport_type}` : ''}. Habla en el lenguaje de su disciplina.`
      : '';
    const goalDetailLine = [
      goalData?.target_weight_kg != null && goalData?.target_date
        ? `Meta de peso: ${goalData.target_weight_kg}kg para ${goalData.target_date}.`
        : '',
      goalData?.modality_orientation
        ? `Objetivo específico en su disciplina: ${MODALITY_GOAL_BRANCH_LABELS[goalData.modality_orientation] ?? goalData.modality_orientation}${goalData.modality_goal_notes ? ` — ${goalData.modality_goal_notes}` : ''}.`
        : '',
      goalData?.secondary_goal_notes ? `Notas de disciplinas secundarias: ${goalData.secondary_goal_notes}.` : '',
      goalData?.modality === 'first_steps' ? FIRST_STEPS_EMPATHY_GUARDRAIL : '',
    ].filter(Boolean).join(' ');
```

- [ ] **Step 5: Inyectar `goalDetailLine` en `userContextBlock`**

Reemplazar (línea 176-180):

```typescript
    const userContextBlock = `━━━ CONTEXTO DEL USUARIO ━━━
${TONE_BY_LEVEL[fitnessLevel] ?? TONE_BY_LEVEL.intermediate}
${modalityLine}
${goalDetailLine}

${planBlock}`;
```

- [ ] **Step 6: Verificar**

Run: `cd supabase/functions && deno check chat/index.ts`
Expected: sin errores.

- [ ] **Step 7: Reiniciar el runtime y probar con curl**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja"`

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/chat \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"message":"hola"}'
```
Expected: `200`, respuesta de Vulcano. Confirmar en logs que `userContextBlock` incluye la línea de meta si el usuario de prueba tiene `modality_orientation` seteado.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/chat/index.ts
git commit -m "feat(objetivos-disciplina): chat incluye meta de peso/rama de disciplina + guardrail first_steps"
```

---

### Task 15: Gates finales + documentación

**Files:**
- Modify: `forja-docs.md`

**Interfaces:** ninguna — task de cierre.

- [ ] **Step 1: Gates finales**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios (0 errores).

Run: `cd supabase/functions && deno check generate-plan/index.ts generate-meal-plan/index.ts chat/index.ts`
Expected: sin errores (no hay `logic.ts`/tests Deno nuevos en este plan — ninguna EF nueva se creó, solo se ampliaron 3 existentes con augmentos de prompt string, sin lógica extraíble que amerite su propio archivo de tests).

- [ ] **Step 2: Sección nueva en `forja-docs.md`**

Agregar al final del archivo (después de `## Pulido: restyle auth/onboarding...`):

```markdown

## Objetivos concretos por disciplina

Árbol de "rama de orientación" + texto libre por disciplina principal (36 ramas namespaced
`<modality>_<branch>` en `constants/modalityGoals.ts`, 4 por cada una de las 9 modalidades)
para que Vulcano reciba una meta concreta en vez de solo el tipo de objetivo genérico.
Revive `goals.target_weight_kg`/`target_date` — existían desde el schema inicial y ya los
consumía `GoalProgress.tsx`/`profile.tsx`/`app/(app)/index.tsx`, pero ningún flujo los
escribía. Nueva 9ª modalidad `first_steps` ("Primeros pasos") para principiantes absolutos,
con guardrail de empatía en los 3 generadores de IA. Validación de seguridad
(`lib/weightGoalSafety.ts`): metas de peso limitadas a un ritmo máximo (1%/semana pérdida,
0.5%/semana ganancia) más coherencia de dirección — se valida en el paso 3 del onboarding
(donde por fin se conoce el peso actual, ya que el objetivo se captura en el paso 1) y en
Ajustes (`settings/training.tsx`, donde el peso actual ya está disponible desde el primer
render). Dos componentes compartidos nuevos (`TargetWeightPicker`, `ModalityOrientationPicker`)
evitan duplicar la UI entre onboarding y Ajustes. Spec:
`docs/superpowers/specs/2026-07-15-objetivos-por-disciplina-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add forja-docs.md
git commit -m "feat(objetivos-disciplina): gates finales + documentación en forja-docs.md"
```

**Nota operativa para quien ejecute este plan (subagent-driven-development o executing-plans):** al terminar cada task, actualizar `.superpowers/sdd/progress.md` con una entrada nueva bajo una sección `## Objetivos concretos por disciplina` (crearla antes de la Task 1), siguiendo el mismo formato que `## Pulido: restyle auth/onboarding...` — una línea por task con el commit real, el veredicto de review, y cualquier hallazgo. Esa sección se escribe progresivamente durante la ejecución real (no se puede escribir de antemano en este plan, que aún no se ha ejecutado).
