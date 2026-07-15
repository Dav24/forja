# Objetivos concretos por disciplina — Design Spec

**Fecha:** 2026-07-15
**Estado:** Aprobado en brainstorming
**Contexto:** Iniciativa nueva surgida de feedback real del usuario compartiendo la app con familiares de varias disciplinas (natación media-alta, híbrido calistenia+natación+balón, prep. fisicoculturismo amateur, 3 casuales de gym): ninguno puede fijar una meta medible real. La app solo pregunta el tipo de objetivo genérico (bajar de peso/ganar músculo/etc.) y la disciplina, nunca un número o hito concreto. El diseño de fondo se acordó en un brainstorming previo (ver memoria de sesión); esta spec lo formaliza y agrega, tras exploración de código adicional, el manejo de metas de peso no saludables que no estaba en el diseño original.

## 1. Objetivo y alcance

- **Dentro:**
  1. Árbol de "rama de orientación" + texto libre por disciplina principal (2 niveles), para que el usuario le dé a Vulcano una meta concreta en sus propias palabras.
  2. Revivir `goals.target_weight_kg`/`target_date` (existen desde el schema inicial, los consume `GoalProgress.tsx`/`profile.tsx`/`app/(app)/index.tsx`/la notificación `goal_milestone`, pero ningún flujo los escribe — siempre `null`).
  3. Validación de seguridad contra metas de peso poco realistas o dañinas (ej. "bajar 5kg para mañana").
  4. 9ª modalidad nueva `first_steps` ("Primeros pasos") para principiantes absolutos o expectativas poco realistas, con guardrail de empatía en los prompts de IA.
  5. Edición posterior completa en `settings/training.tsx`.
  6. Consumo por `generate-plan`, `generate-meal-plan` y `chat`.
- **Fuera:**
  - Rediseño visual de pantallas de carga/transiciones (pendiente aparte, explícitamente pospuesto por el usuario).
  - Selector de rama en `GeneratePlanSheet` (generación ad-hoc) — la rama vive en el perfil (`goals`), no se re-pregunta por generación individual.
  - Backfill para usuarios existentes — quedan en `null`, mismo criterio que `athletic_background` en Fase D.
  - Guardrail completo de seguridad de suplementos extendido a `chat` (Fase D lo dejó fuera explícitamente); esta spec solo agrega a `chat` el guardrail de empatía de `first_steps`, no reabre esa decisión.

## 2. Datos

### 2.1 Migración `0014`

```sql
-- Objetivos concretos por disciplina
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

No hay política RLS nueva — estas columnas viven en `goals`, que ya tiene sus políticas de owner select/insert/update. `modality_orientation` valida contra la lista completa de 36 ids namespaced por modalidad (`<modality>_<rama>`), pero **no** valida que la rama pertenezca a la `modality` de esa fila — esa coherencia la garantiza el cliente al filtrar los chips por la modalidad ya elegida. Riesgo de incoherencia cruzada aceptado, misma clase que `sport_type` hoy (texto libre sin relación forzada con `modality`).

`modality_goal_notes`/`secondary_goal_notes` son texto libre, saneado igual que `supplements_other` (Fase D): `trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '')`.

### 2.2 `constants/modalityGoals.ts` (nuevo)

Mismo patrón que `constants/goals.ts`/`modalities.ts`: un mapa de `ModalityId` → lista de ramas, cada una con `id` namespaced y `labelKey` en el namespace `onboarding:` (consistente con que `GOALS`/`MODALITIES` ya usan claves cross-namespace resueltas por componentes fuera de `onboarding`, ej. `settings/training.tsx` ya hace `t(g.titleKey)` con claves `onboarding:goals....`).

```ts
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

Claves i18n (es/en, 36 pares) se escriben durante implementación siguiendo las descripciones ya acordadas en el brainstorming original (memoria `goal_branches_feature.md` tiene el texto en español de cada rama).

### 2.3 9ª modalidad en `constants/modalities.ts`

```ts
{
  id: 'first_steps',
  labelKey: 'onboarding:modalities.first_steps.label',
  icon: '🌱',
  iconName: 'leaf-outline',
  descriptionKey: 'onboarding:modalities.first_steps.description',
  equipmentPresets: ['onboarding:modalities.first_steps.presets.0'], // "Ninguno / lo que tengas en casa"
}
```

Union type `ModalityId` gana `'first_steps'`.

### 2.4 Lugares con `first_steps` hardcodeado que hay que actualizar

No hay una fuente única de modalidades del lado de las EFs — cada una duplica su propio mapa (deuda preexistente, no se corrige en esta fase, solo se replica el patrón):
- `supabase/functions/generate-plan/index.ts`: `MODALITY_LABELS` (línea ~10) + el `CHECK` de SQL ya cubre `VALID_MODALITIES` porque se deriva de `Object.keys(MODALITY_LABELS)`.
- `supabase/functions/chat/index.ts`: `MODALITY_LABELS` (línea ~6).
- `goals_modality_check` en SQL (§2.1).

`generate-meal-plan` no tiene su propio mapa de modalidades — no requiere cambio en este punto.

## 3. Validación de metas de peso no saludables

Regla acordada explícitamente por el usuario: bloquear metas del tipo "bajar 5kg para mañana", no solo advertir.

**Restricción estructural:** el peso objetivo se captura en el paso 1 del onboarding; el peso actual no se captura hasta el paso 3. La validación de ritmo (que necesita ambos números) no puede vivir en el paso 1 — vive en el paso 3 (`handleContinue`), justo después de parsear el peso actual, antes de `setStep2(...)`. En Ajustes (`settings/training.tsx`) sí hay peso actual disponible desde el primer render (`useLatestBodyData`), así que ahí la validación corre en `handleSave` directamente.

**Regla de ritmo seguro** (guías estándar de cambio de peso saludable):
- `weight_loss`: cambio permitido ≤ 1% del peso actual por semana.
- `muscle_gain`: cambio permitido ≤ 0.5% del peso actual por semana (la ganancia muscular natural es más lenta que la pérdida de grasa).
- Cálculo: `weeksUntilTarget = max(1, diasHastaTargetDate / 7)`; `rateNeeded = abs(targetWeightKg - currentWeightKg) / weeksUntilTarget`; bloquea si `rateNeeded > currentWeightKg * (0.01 | 0.005)`.
- **Chequeo de coherencia de dirección:** si `weight_loss`, `targetWeightKg` debe ser `< currentWeightKg` (con margen de 0.1kg); si `muscle_gain`, `> currentWeightKg`. Evita el caso "quiero bajar de peso pero puse una meta más alta por error".
- Si falla cualquiera de los dos chequeos: `Alert` explicando el motivo concreto (no un "dato inválido" genérico) — ej. *"Bajar Xkg en Y semanas no es un ritmo saludable (máx. recomendado: Zkg/semana). Ajusta tu meta o el plazo."* No navega automáticamente; el usuario decide si vuelve al paso 1 (onboarding) o edita los campos en el mismo formulario (Ajustes).
- El picker de fecha ya limita el caso extremo desde la UI (`minimumDate = hoy + 14 días` en el modo "fecha específica"), como defensa adicional antes de llegar al cálculo de ritmo.

Esta validación es 100% client-side — los EFs no la revalidan server-side (mismo nivel de confianza que otros campos de perfil ya aceptados sin revalidación server-side, ej. `sport_type`).

## 4. Onboarding

### 4.1 Paso 1 — objetivo (`step-1-goals.tsx`)

Sin cambios en la lista `GOALS`. Si `selected` es `weight_loss` o `muscle_gain` (decisión explícita: `recomposition` queda fuera, coherente con que `GoalProgress.tsx` tampoco muestra barra de progreso para ese tipo), aparece una card inline (`surfaceElevated`, mismo patrón que las cards de auth del pulido reciente) con:
- `Input` numérico "Peso objetivo (kg)".
- Chips de plazo: **1 mes / 3 meses / 6 meses / Fecha específica**. Los 3 primeros calculan `target_date` sumando 1/3/6 **meses calendario** a hoy (no semanas fijas — para que la fecha caiga en el mismo día del mes, ej. `new Date` con `setMonth(getMonth()+n)`); "Fecha específica" abre `@react-native-community/datetimepicker` (nueva dependencia, se instala vía `npx expo install @react-native-community/datetimepicker`, compatible con Expo Go) con `minimumDate = hoy + 14 días`.
- Todo opcional — `handleContinue` sigue exigiendo solo `selected`, sin cambios.

`store/onboarding.store.ts` gana `targetDate: string | null` (ya tiene `targetWeightKg`); `setStep1` gana el parámetro opcional.

### 4.2 Paso 2 — modalidad (`step-2-modality.tsx`)

Tras elegir `principal`, debajo de la lista aparece:
- `FieldLabel` + fila de `Chip` con las 2-4 ramas de `MODALITY_GOAL_BRANCHES[principal]`.
- `Input` de texto libre corto para que el usuario le explique a Vulcano con sus palabras.
- Línea `text-faint` fija debajo: *"Podrás ajustar esto después en Ajustes → Mi entrenamiento."*

Tras elegir alguna `secondary`, aparece un único `Input` corto adicional para el texto libre combinado de las secundarias (sin chips de rama — las secundarias solo llevan texto libre, según diseño acordado).

Todo opcional — `handleContinue` sigue exigiendo solo `principal`. Si el usuario cambia de `principal` (`selectPrincipal`), la rama/texto local se resetean (mismo criterio que ya usa `selectPrincipal` para filtrar `secondary`).

`useOnboardingStore` gana `modalityOrientation: string | null`, `modalityGoalNotes: string | null`, `secondaryGoalNotes: string | null`; `setStep2Modality` los recibe opcionalmente.

### 4.3 Paso 3 — cuerpo (`step-3-body.tsx`)

Sin cambios de UI. La validación de §3 se agrega dentro de `handleContinue`, después de calcular `w` (peso actual parseado), antes de `setStep2({ weightKg: w, ... })`. Lee `targetWeightKg`/`targetDate`/`goalType` del store.

### 4.4 Paso 4 — nivel (`step-4-level.tsx`, `handleFinish`)

El `insert` a `goals` (línea ~51) gana los campos nuevos:
```ts
target_date: targetDate ?? null,
modality_orientation: modalityOrientation ?? null,
modality_goal_notes: modalityGoalNotes ?? null,
secondary_goal_notes: secondaryGoalNotes ?? null,
```
(`target_weight_kg` ya estaba en el insert, solo que siempre llegaba `null` porque nada lo poblaba).

### 4.5 `useOnboardingStore.reset()`

Gana los 4 campos nuevos en el objeto de reset, mismo criterio que el resto de campos del store.

## 5. Ajustes de cuenta (`settings/training.tsx`)

Reutiliza `Chip`/`FieldLabel`/`GroupCard` ya construidos (pulido reciente), sin componentes nuevos:

- Card **"Perfil de entrenamiento"** (`groupProfileTitle`): gana, tras el bloque de objetivo/nivel, un `Input` de peso objetivo + los mismos chips de plazo/fecha específica del paso 1 — condicionado a que `goalType` sea `weight_loss`/`muscle_gain`, igual que en onboarding.
- Card **"Disciplina"** (`groupDisciplineTitle`): gana, tras el selector de modalidad principal, los chips de rama filtrados por la `modality` actualmente seleccionada en el formulario + `Input` de texto libre principal, y tras las secundarias, el `Input` de texto libre combinado.
- Si el usuario cambia `modality` en este formulario, `modality_orientation` local se resetea a `null` (mismo criterio que el paso 2).
- El componente gana 5 `useState` nuevos (`targetWeightKg`, `targetDate`, `modalityOrientation`, `modalityGoalNotes`, `secondaryGoalNotes`), mismo patrón que los ya existentes (`heightCm`, `age`, etc.). El `useEffect` de precarga (línea ~56) los inicializa leyendo de `goal` junto con los campos que ya precarga hoy.
- `handleSave`: corre la validación de §3 usando `latestBody` (ya disponible) antes de construir el `insert`; si falla, `Alert` y no escribe. El `insert` a `goals` (línea ~120) gana los mismos 5 campos que el paso 4 del onboarding.

## 6. Consumo por IA

### 6.1 `generate-plan`

El `select` de `goals` (línea 239) gana `target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes`. Para resolver `modality_orientation` (un id como `gym_strength_hypertrophy`) a una frase legible en español dentro del prompt, el archivo gana un mapa `MODALITY_GOAL_BRANCH_LABELS: Record<string, string>` con las 36 entradas — mismo criterio de duplicación ya aceptado para `MODALITY_LABELS` (§2.4), no una fuente compartida nueva. `buildPlanPrompt` gana en su interfaz de `userData` los campos correspondientes y, en el prompt final, líneas nuevas (mismo patrón que `backgroundLine`/`supplementsLine`: se omiten por completo si no hay dato):
```
- Meta de peso: {weight_loss ? 'bajar' : 'subir'} a {target_weight_kg}kg para {target_date}
- Objetivo específico en su disciplina principal ({MODALITY_GOAL_BRANCH_LABELS[modality_orientation]}): {modality_goal_notes}
- Disciplinas secundarias — notas del usuario: {secondary_goal_notes}
```
Si `goal.modality === 'first_steps'`, se agrega el guardrail de empatía:
```
El usuario está en modalidad "Primeros pasos" — es su punto de partida en fitness o puede tener expectativas poco realistas. Corrige expectativas poco realistas CON EMPATÍA, prioriza adherencia y formación de hábito sobre intensidad, y encuadra esto como el inicio de un cambio de estilo de vida, no una dieta o rutina relámpago.
```

### 6.2 `generate-meal-plan`

Mismo tratamiento: el `select` (línea 204, hoy no pide ni `target_weight_kg` ni `target_date`) se amplía igual; el archivo gana su propia copia de `MODALITY_GOAL_BRANCH_LABELS` (no comparte módulo con `generate-plan`, mismo criterio de duplicación entre EFs ya existente); `buildMealPlanPrompt` gana las mismas líneas (la meta de peso afecta objetivo calórico, las notas de disciplina pueden afectar timing/tamaño de comidas); mismo guardrail de `first_steps`.

### 6.3 `chat`

Fase D dejó `chat/index.ts` deliberadamente fuera del guardrail de seguridad de suplementos ("si en el futuro necesita el mismo guardrail, es fase aparte") — esa decisión no se reabre aquí. Se amplía únicamente el `select` ya existente de `goals` (línea 116, ya trae `modality`/`secondary_modalities`/`sport_type`) con los 5 campos nuevos; el archivo ya tiene su propio `MODALITY_LABELS` (§2.4) y gana, igual que las otras 2 EFs, su propia copia de `MODALITY_GOAL_BRANCH_LABELS`; se agrega una línea de contexto equivalente a la de §6.1 al system prompt existente. El guardrail de empatía de `first_steps` **sí** se agrega en `chat` (a diferencia del guardrail de suplementos) porque aquí hay riesgo real de que Vulcano sea insensible con un principiante en una conversación libre, no solo en un plan generado una vez.

## 7. Errores y casos límite

- **Meta de ritmo inseguro:** bloqueada client-side (§3), nunca llega a la DB — sin revalidación server-side, mismo nivel de confianza que `sport_type`.
- **`goals.modality` distinto al elegido ad-hoc en `GeneratePlanSheet`:** caso raro, solo aplica a usuarios legacy sin `modality` (backfill en `useWorkoutPlan.ts:74`). `modality_orientation` podría describir una disciplina distinta a la que se genera en ese momento puntual. Riesgo aceptado, mismo nivel que ese path legacy preexistente — no se corrige en esta fase.
- **Cambiar `modality` principal en Ajustes:** resetea `modality_orientation` local a `null` (§5) — evita persistir una rama que ya no corresponde.
- **Todos los campos nuevos son nullable/opcionales:** usuarios existentes y quienes omiten todo quedan igual que hoy; ninguna sección de prompt nueva se agrega si los campos están vacíos (mismo criterio que `athletic_background`/`supplements` en Fase D).
- **`target_date` en el pasado tras seleccionarse con el picker "fecha específica":** prevenido por `minimumDate` en el picker nativo — no requiere validación adicional server-side.

## 8. Fuera de alcance / diferido

- `GeneratePlanSheet` no gana selector de rama (§1).
- Backfill de usuarios existentes (§1).
- Reapertura del guardrail completo de suplementos en `chat` (§6.3) — sigue fuera, decisión de Fase D.
- Rediseño visual de pantallas de carga/transiciones — hilo aparte, pospuesto explícitamente por el usuario.
- `types/database.types.ts` se regenera como parte de la migración (mismo patrón ya usado 3 veces en el repo), no requiere diseño adicional.
