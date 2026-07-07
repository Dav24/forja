# Multi-modalidad de entrenamiento — Diseño

**Fecha:** 2026-07-07
**Estado:** Aprobado por David
**Contexto:** Mini-paso previo al Paso 14 (i18n). Forja hoy genera planes con sesgo de gym porque nunca pregunta cómo entrena el usuario: el onboarding solo pregunta objetivo, y el generador de planes es un `Alert` que solo pregunta días por semana. La EF `generate-plan` ya acepta `equipment`/`minutes_per_session`/`injuries` pero la app no los envía.

## Decisiones de producto (tomadas en conversación)

1. **Objetivo ≠ Modalidad.** El objetivo (bajar peso, músculo, etc.) se mantiene como está; la modalidad (cómo entrenas) es una dimensión nueva e independiente.
2. **Principal + secundarias.** El usuario elige 1 modalidad principal (define el plan generado) y 0-2 secundarias que el plan integra cuando los días lo permiten.
3. **Onboarding pasa de 3 a 4 pasos**, con la modalidad como paso 2.
4. **El generador pasa de Alert a bottom sheet** con 4 campos.
5. **Usuarios existentes** (sin modalidad) la configuran desde el propio sheet del generador, que la persiste al generar.

## Catálogo de modalidades (8)

| id | Label | Ejemplos de equipo (chips) |
|---|---|---|
| `gym_strength` | Fuerza / Gym | Gimnasio completo, Gimnasio básico |
| `functional` | Funcional / CrossFit / HIIT | Box completo, Kettlebells y cuerdas, Sin equipo |
| `endurance` | Cardio de resistencia (correr, caminar, caminadora) | Aire libre, Caminadora |
| `cycling` | Ciclismo / Spinning | Bici de ruta, Bici fija/spinning, Rodillo |
| `swimming` | Natación | Alberca corta (25m), Alberca larga (50m) |
| `home_calisthenics` | En casa / Calistenia | Sin equipo, Bandas, Mancuernas, Barra de dominadas |
| `mobility` | Yoga / Pilates / Movilidad | Tapete, Tapete y bloques |
| `ball_sports` | Deportes con balón | Cancha + balón (deporte en `sport_type`) |

Vive en `constants/modalities.ts`: `{ id, label, icon, equipmentPresets: string[] }[]` + tipo `ModalityId`.

## 1. Modelo de datos

**Migración `0006_goals_modality.sql`:**

```sql
alter table goals add column modality text;
alter table goals add column secondary_modalities text[] not null default '{}';
-- check: modality in (los 8 ids) or null; array_length(secondary_modalities,1) <= 2
```

- Ambos campos en la fila del goal activo. Nullable/default vacío → usuarios existentes no rompen nada.
- `sport_type` (ya existe) guarda el deporte concreto cuando `modality = 'ball_sports'` (texto libre: "fútbol", "básquet"...).
- Actualizar tipos TypeScript de la tabla si existen (`lib/` o donde estén los tipos generados).

## 2. Onboarding — paso 2 de 4

**Archivo nuevo:** `app/(auth)/onboarding/step-2-modality.tsx`
**Renombrados:** `step-2-body.tsx` → `step-3-body.tsx`, `step-3-level.tsx` → `step-4-level.tsx` (y las rutas/`router.push` que los referencian, incluido el guard de `_layout` si los menciona). El copy "Paso X de 3" pasa a "Paso X de 4" en los 4 archivos.

**UI (mismo patrón de cards del paso 1):**
- Título: "¿Cómo entrenas?" — subtítulo: "Tu disciplina principal define tu plan."
- Lista de 8 cards (ícono + label + ejemplos). Selección única = principal.
- Al haber principal, aparece sección "¿Combinas con algo más? (opcional)" — las otras 7 como chips multi-select, máximo 2.
- Si principal o secundaria incluye `ball_sports`: input corto "¿Qué deporte?" → `sportType`.
- Continuar deshabilitado sin principal.

**Store (`onboarding.store.ts`):** agrega `modality: ModalityId | null`, `secondaryModalities: ModalityId[]`, `sportType: string | null` y `setStep2Modality(...)`. El `reset` los limpia. El insert de `goals` (hoy en el paso final) incluye `modality`, `secondary_modalities` y `sport_type`.

## 3. Generador — `GeneratePlanSheet`

**Archivo nuevo:** `components/plans/GeneratePlanSheet.tsx` (usa el componente `Sheet` existente, patrón forwardRef como `UpgradeSheet`).

**Campos:**
1. **Modalidad** — chips de las 8; pre-seleccionada desde el goal activo (`useActiveGoal`). Editable (cambiarla aquí NO reescribe la secundaria del perfil, solo si el goal no tenía modalidad se persiste — ver flujo).
2. **Días por semana** — chips 3 / 4 / 5 / 6 (default 4).
3. **Minutos por sesión** — chips 30 / 45 / 60 / 90 (default 60).
4. **Equipo** — chips de `equipmentPresets` de la modalidad seleccionada + chip "Otro" que abre input de texto libre.

CTA: "Forjar mi plan". Sin campo de lesiones en el sheet (la EF ya lo acepta; queda fuera del alcance de esta UI — se puede decir en el chat).

**Hook `useGeneratePlan`:** `promptDaysAndGenerate(alertTitle)` se reemplaza por el sheet; `generate(...)` ahora envía `{ days_per_week, minutes_per_session, equipment, modality, secondary_modalities }`. Si el goal activo no tenía `modality`, el hook hace `update` a `goals` con la modalidad elegida antes de llamar la EF (así los usuarios existentes quedan configurados).

**Call sites del Alert actual (verificados):** `app/(app)/plans/workout/index.tsx` (empty state) y `app/(app)/plans/index.tsx` (hub de planes). Ambos pasan a abrir el sheet.

## 4. Edge Functions

**`generate-plan/index.ts`:**
- Acepta `modality` y `secondary_modalities` en el body (con allowlist de los 8 ids; inválido → ignorar, no 400).
- El prompt gana una sección de modalidad:
  - Principal define el TIPO de plan ("Genera un plan de {label de modalidad}...").
  - Secundarias: "integra {labels} en los días disponibles si days_per_week ≥ 4; si no, menciónalo en progression_notes".
  - `ball_sports` + `sport_type`: el plan se orienta a la preparación física de ese deporte.
- **El schema JSON de salida NO cambia.** Para modalidades no-fuerza, los campos se adaptan semánticamente y el prompt lo instruye con ejemplos: cardio → `name: "Intervalos 6×400m"`, `sets: 6`, `reps: "400m"`, `rest_seconds: 90`; natación → `reps: "100m"`; yoga → `name: "Secuencia saludo al sol"`, `reps: "5 rondas"`, `technique_notes` de respiración. Así la pantalla de detalle del plan y la DB no se tocan.
- Sin modalidad (null): comportamiento actual (plan general de fuerza/gym).

**`chat/index.ts`:** el `SELECT` de goals suma `modality, secondary_modalities, sport_type`; el bloque de contexto agrega una línea: "Modalidad principal: X (secundarias: Y, Z)". Nada más.

## 5. Errores y compatibilidad

- **Usuarios existentes:** columnas nullable/default → cero impacto hasta que generen plan nuevo, momento en que el sheet pide modalidad y la persiste.
- **EF con body inválido:** ids fuera del catálogo se descartan silenciosamente (la EF nunca truena por modalidad mala).
- **Onboarding a medias (usuarios en flight):** el flujo es lineal en memoria (Zustand), no hay estado persistido intermedio que migrar.
- **`equipment` llega texto libre a la EF** (como hoy) — los chips son solo UX.

## 6. Verificación

1. `tsc --noEmit` limpio (app).
2. E2E real de la EF con usuario de prueba en ≥3 modalidades: `endurance` (running), `home_calisthenics` y `gym_strength` con secundaria `endurance` — el JSON parsea, 7 días, contenido coherente con la modalidad.
3. Chat: preguntar "¿qué me toca hoy?" con plan de running activo → responde en términos de running.
4. Onboarding completo y sheet: pase visual en Expo Go (teléfono).

## Fuera de alcance (decidido)

- Registro de actividades (manual/GPS/wearables) — ver memoria `diseno-multideporte`.
- Edición de modalidad en la pestaña Perfil.
- Campo de lesiones en el sheet.
- Cambios al schema JSON del plan o a la pantalla de detalle.
