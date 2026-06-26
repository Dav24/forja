# Spec — Paso 9: Planes Alimenticios Premium

**Fecha:** 2026-06-26  
**Proyecto:** Forja (`forja.fit`)  
**Estado:** Aprobado — pendiente de implementación

---

## Contexto

El Paso 8 completó la generación de planes de entrenamiento con Claude Sonnet. El Paso 9 extiende ese mismo patrón al dominio nutricional: un plan alimenticio semanal de 7 días generado por IA, exclusivo para usuarios premium (con 1 generación gratuita de por vida para free).

La tabla `meal_plans` ya existe en DB. Los archivos `hooks/useMealPlan.ts`, `components/plans/MacroBar.tsx`, `components/plans/MealPlanCard.tsx` y `app/(app)/plans/meal/[id].tsx` existen como stubs vacíos.

---

## Arquitectura y flujo general

```
app/(app)/plans/meal/index.tsx
    │
    ├── Sin plan activo
    │     └── Form corto (alergias, dieta, disponibilidad)
    │           └── [ Generar mi plan ] → POST /functions/v1/generate-meal-plan
    │
    └── Con plan activo
          └── Macros diarios + navegador de días + 5x MealPlanCard
                └── [ Regenerar ] (premium) → mismo endpoint
```

**Flujo de la Edge Function:**
1. Valida JWT → `user.id`
2. Verifica en paralelo: suscripción + conteo de planes + job activo
3. Lee del body: `{ allergies, diet_type, food_availability }`
4. Lee de DB en paralelo: `goals` activo + `body_data` más reciente
5. Crea `async_job` (`type: 'generate_meal_plan'`, `status: 'processing'`)
6. Llama a Claude Sonnet (`claude-sonnet-4-6`) → responde solo JSON
7. Parsea con regex (mismo patrón que `generate-plan`)
8. Desactiva plan activo anterior → inserta nuevo en `meal_plans`
9. Actualiza job a `completed` con `result: { plan_id }`
10. Devuelve `{ job_id, status: 'completed', plan_id, plan }`

El mismo patrón síncrono de `generate-plan`: no usa QStash, espera la respuesta completa de Sonnet.

---

## JSON Schema — campo `meals` en `meal_plans`

```json
{
  "title": "Plan Nutrición Hipertrofia — 2800 kcal",
  "description": "Plan orientado a ganancia muscular con alto aporte proteico...",
  "daily_calories": 2800,
  "macros": {
    "protein_g": 210,
    "carbs_g": 280,
    "fat_g": 80
  },
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
        }
      ]
    }
  ]
}
```

- **7 días** distintos en `days[]`
- **5 comidas por día**: Desayuno, Media mañana, Almuerzo, Merienda, Cena
- `macros` del root = promedios diarios objetivo
- `macros` por comida = aproximados para orientación
- `daily_calories` e `macros` del root también se guardan como columnas propias en la tabla para queries rápidas

---

## Edge Function: `generate-meal-plan`

**Archivo:** `supabase/functions/generate-meal-plan/index.ts`

### Errores manejados

| HTTP | `error` | Condición |
|---|---|---|
| `401` | `unauthorized` | JWT ausente o inválido |
| `409` | `generation_in_progress` | Job activo en `async_jobs` |
| `422` | `no_active_goal` | Usuario sin objetivo en DB |
| `429` | `meal_plan_limit_reached` | Free ya tiene ≥ 1 plan; Premium ≥ 10 este mes |
| `502` | `ai_error` | Anthropic no responde OK |
| `502` | `invalid_ai_response` | JSON malformado en respuesta de Sonnet |
| `500` | `internal_error` | Error no controlado |

### Límites

```ts
// lib/limits.ts — agregar:
FREE_LIMITS.MEAL_PLANS_LIFETIME = 1
PREMIUM_LIMITS = { MEAL_PLANS_PER_MONTH: 10 }
```

- **Free**: cuenta total de planes del usuario (no por mes). Si `count >= 1` → bloquea.
- **Premium**: cuenta planes del mes actual. Si `count >= 10` → bloquea.

### Body del request

```ts
{
  allergies: string        // ej: "gluten, lactosa" o "ninguna"
  diet_type: string        // "omnívoro" | "vegetariano" | "vegano" | "sin gluten" | "keto"
  food_availability: string // "básica" | "media" | "amplia"
}
```

Los datos del perfil (peso, altura, edad, género, actividad, objetivo) se leen directamente de DB — no se repiten en el body.

### Prompt

Instruye a Claude Sonnet a actuar como nutriólogo deportivo. Inyecta todos los datos del perfil + los 3 campos del form. Solicita JSON exacto con la estructura del schema. Incluye cláusula de seguridad: no promover restricciones extremas, siempre aclarar que no sustituye valoración médica.

---

## Frontend

### `hooks/useMealPlan.ts`

```ts
useActiveMealPlan()       // query: plan activo del usuario
useGenerateMealPlan()     // mutation: llama a generate-meal-plan
```

Patrón idéntico a `useWorkoutPlan` / `useDeactivateWorkoutPlan`.

---

### `components/plans/MacroBar.tsx`

Barra horizontal dividida en 3 segmentos con ancho proporcional a los gramos:
- Proteína → `colors.primary` (verde)
- Carbohidratos → `colors.accent` (índigo)
- Grasa → `colors.warning` (ámbar)

Props: `protein_g`, `carbs_g`, `fat_g`. Muestra gramos y porcentaje debajo de cada segmento. Variante `compact` para usar dentro de `MealPlanCard`.

---

### `components/plans/MealPlanCard.tsx`

Card para una comida individual. Colapsable (toca para expandir ingredientes).

**Contraído:** tipo de comida + nombre + calorías + MacroBar compact  
**Expandido:** agrega lista de ingredientes

---

### `app/(app)/plans/meal/index.tsx` — reemplaza el placeholder

**Estado sin plan activo:**
- Header con título y subtítulo
- Form corto con 3 campos tipo chip-toggle:
  - Alergias/intolerancias: `Ninguna`, `Gluten`, `Lactosa`, `Frutos secos`, `Mariscos`
  - Tipo de dieta: `Omnívoro`, `Vegetariano`, `Vegano`, `Sin gluten`, `Keto`
  - Disponibilidad de alimentos: `Básica`, `Media`, `Amplia`
- Botón "Generar mi plan" (deshabilitado durante generación, muestra `ActivityIndicator`)
- Manejo de error `meal_plan_limit_reached` → muestra `PaywallBanner`

**Estado con plan activo:**
- Header: título del plan + calorías diarias
- `MacroBar` con promedios diarios (proteína / carbs / grasa)
- Navegador horizontal de días (scroll, día actual seleccionado por defecto)
- Lista de 5 `MealPlanCard` para el día seleccionado
- Botón "Regenerar plan" solo visible para premium (`useIsPremium()`); si es free muestra `PaywallBanner`

**Manejo de errores inline** (igual que plans/index.tsx):
- `generation_in_progress` → Alert "Ya hay un plan siendo generado"
- Error de red → Alert genérico

---

### `app/(app)/plans/meal/[id].tsx`

Por ahora: redirige a `/(app)/plans/meal` al montar. El historial de planes es funcionalidad futura.

---

### Cambio en `app/(app)/plans/index.tsx`

El entry point "Planes Alimenticios · Premium · Próximamente" cambia solo el subtítulo: pasa de `"Premium · Próximamente"` a `"Nutrición personalizada con IA"`. La navegación a `/(app)/plans/meal` ya existe.

---

## Archivos a crear / modificar

| Acción | Archivo |
|---|---|
| Crear | `supabase/functions/generate-meal-plan/index.ts` |
| Implementar | `hooks/useMealPlan.ts` (stub → completo) |
| Implementar | `components/plans/MacroBar.tsx` (stub → completo) |
| Implementar | `components/plans/MealPlanCard.tsx` (stub → completo) |
| Reemplazar | `app/(app)/plans/meal/index.tsx` (placeholder → funcional) |
| Implementar | `app/(app)/plans/meal/[id].tsx` (stub → redirect) |
| Modificar | `lib/limits.ts` (agregar `MEAL_PLANS_LIFETIME` y `PREMIUM_LIMITS`) |
| Modificar | `app/(app)/plans/index.tsx` (actualizar subtítulo del entry point) |
| Actualizar | `forja-docs.md` (secciones §4, §6, §10, §11, §13, §16, §20) |

---

## Lo que NO entra en este paso

- Persistencia de preferencias nutricionales en DB (alergias, dieta, disponibilidad quedan solo en estado local)
- Historial de planes alimenticios anteriores (la ruta `[id].tsx` hace redirect por ahora)
- Integración con Stripe (los gates de premium muestran `PaywallBanner` pero el upgrade real es Paso 13)
- Notificaciones push de "plan listo"
