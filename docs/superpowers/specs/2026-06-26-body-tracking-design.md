# Spec: Paso 10 — Seguimiento Corporal

**Fecha:** 2026-06-26  
**Proyecto:** Forja  
**Estado:** Aprobado

---

## Objetivo

Implementar la pantalla de Progreso (`/(app)/progress`) con registro de medidas corporales, gráfica de peso y card de progreso hacia la meta. Sin nuevas migraciones ni Edge Functions — todo va directo a Supabase desde el cliente vía RLS.

---

## Pantalla: `app/(app)/progress.tsx`

Layout: `ScrollView` vertical con 3 secciones apiladas + FAB flotante.

**Secciones (de arriba a abajo):**
1. `GoalProgress` — card de progreso hacia meta de peso
2. `WeightChart` — gráfica Skia con selector de rango
3. Lista de últimos 5 registros — fecha + peso, orden descendente

**FAB:** Botón `+` flotante sobre el scroll (absolute, bottom-right). Al presionar abre una `Sheet` con `MeasurementForm` adentro.

**Lógica "una vez al día":** Al abrir la Sheet se compara `latestBodyData.recorded_at` con la fecha actual (mismo día local). Si coincide, los campos se pre-llenan con los valores actuales y el botón dice "Actualizar". En ambos casos se inserta un nuevo registro — `useLatestBodyData` siempre trae el más reciente por `ORDER BY recorded_at DESC`.

---

## Componente: `GoalProgress.tsx`

**Props:** ninguna (consume hooks internamente)  
**Hooks:** `useActiveGoal()`, `useLatestBodyData()`, `useBodyHistory()`

**Lógica:**
- Peso inicial = primer registro de `body_data` del usuario (ordenar ASC, limit 1)
- Progreso (%) = `(pesoInicial - pesoActual) / (pesoInicial - goal.target_weight_kg) * 100`
  - Para `weight_loss`: mayor peso inicial → menor peso actual = avance positivo
  - Para `muscle_gain`: menor peso inicial → mayor peso actual = avance positivo
  - Para otros tipos de meta: no se muestra la card de progreso de peso (solo el tipo de objetivo activo)
- Días restantes = `differenceInDays(goal.target_date, new Date())`

**Muestra:**
- Peso actual (grande), peso meta (pequeño debajo)
- `ProgressBar` del design system con el % calculado
- Texto: "X días para tu meta" o "Meta alcanzada 🎯" si % >= 100
- Badge con tipo de meta (ej. "Pérdida de peso")

**Estados vacíos:**
- Sin registros de peso: "Registra tu primera medida para ver tu avance"
- Sin meta activa: "Define tu meta en Perfil para ver tu progreso"

---

## Componente: `WeightChart.tsx`

**Props:**
```ts
interface WeightChartProps {
  data: { recorded_at: string; weight_kg: number }[];
}
```

**Implementación:** `@shopify/react-native-skia` — Canvas con Path para línea y área rellena.

**Visual:**
- Línea suave (`cubicTo` o interpolación lineal con puntos cercanos)
- Área rellena: gradiente vertical de `#22C55E` (alpha 0.3) a transparente
- Eje X: fechas abreviadas (lun 23, mar 24...) — máx 7 etiquetas visibles
- Eje Y: rango dinámico = `[min - 1, max + 1]` kg, 5 ticks
- Color línea: `colors.primary` (#22C55E), grosor 2px
- Dots en cada punto de datos: círculo relleno de 4px

**Selector de rango** (encima del canvas, tabs de texto):
- Free: `[2 sem*]  [1 mes 🔒]  [3 mes 🔒]` — bloqueados con Badge "Premium"
- Premium: `[2 sem]  [1 mes]  [3 mes]`
- Tap en rango bloqueado → Sheet de upgrade (componente existente en `components/premium/`)
- El filtrado de fechas se hace en cliente sobre los datos ya recibidos del hook (el hook trae hasta 365 días para premium, 14 para free)

**Estado vacío:** Si `data.length < 2`, mostrar icono + "Registra tu peso para ver tu progreso aquí".

**Error:** Si el query falla, texto con botón "Reintentar" (llama a `refetch()`).

---

## Componente: `MeasurementForm.tsx`

**Props:**
```ts
interface MeasurementFormProps {
  initialValues?: { weight_kg?: number; body_fat_pct?: number; muscle_mass_kg?: number };
  isUpdate?: boolean;
  onSuccess: () => void;
}
```

**Campos:**
| Campo | Tipo | Free | Premium | Obligatorio |
|---|---|---|---|---|
| `weight_kg` | Input numérico (kg) | ✅ | ✅ | Sí |
| `body_fat_pct` | Input numérico (%) | 🔒 | ✅ | No |
| `muscle_mass_kg` | Input numérico (kg) | 🔒 | ✅ | No |

- Campos bloqueados en free: `Input` deshabilitado + Badge "Premium" a la derecha del label
- Validación: `weight_kg` debe ser número positivo entre 20 y 300
- `body_fat_pct` entre 2 y 60, `muscle_mass_kg` entre 10 y 150

**Botón:** "Registrar" (isUpdate=false) / "Actualizar" (isUpdate=true) — usa `useLogBodyData()`. Al éxito llama `onSuccess()`.

**Feedback de error:** Texto rojo inline bajo el botón si la mutation falla.

---

## Freemium gates

| Feature | Free | Premium |
|---|---|---|
| Registro de peso | ✅ Ilimitado | ✅ Ilimitado |
| Campos composición (grasa/músculo) | 🔒 | ✅ |
| Historial en gráfica | 14 días | 365 días |
| Selector de rango 1 mes / 3 mes | 🔒 | ✅ |

---

## Datos y hooks

**Hooks existentes (no se modifican):**
- `useLatestBodyData()` — último registro, usado en `GoalProgress` y para pre-llenar Sheet
- `useBodyHistory()` — historial completo según plan, usado en `WeightChart`
- `useLogBodyData()` — mutation insert, usado en `MeasurementForm`
- `useActiveGoal()` — meta activa del usuario, usado en `GoalProgress`
- `useIsPremium()` — determina gates en toda la pantalla

**Sin nuevas migraciones:** Tabla `body_data` ya tiene todos los campos necesarios.  
**Sin Edge Functions:** Insert directo con RLS.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `app/(app)/progress.tsx` | Reemplazar placeholder — pantalla principal |
| `components/progress/GoalProgress.tsx` | Reemplazar placeholder |
| `components/progress/WeightChart.tsx` | Reemplazar placeholder |
| `components/progress/MeasurementForm.tsx` | Reemplazar placeholder |

No se crean archivos nuevos. No se modifican migraciones ni Edge Functions.

---

## Criterios de éxito

1. Usuario puede registrar peso desde la Sheet — una vez por día
2. Gráfica muestra evolución del peso con área rellena verde
3. Card de meta muestra porcentaje de avance y días restantes
4. Free users ven 14 días de historial; selector de rango bloqueado para rangos mayores
5. Campos de composición corporal bloqueados visualmente para free users
6. Estados vacíos y de error correctamente manejados en todos los componentes
