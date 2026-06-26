# Body Tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la pantalla de Progreso con registro de medidas corporales (Bottom Sheet, una vez/día), gráfica de peso con Skia, card de meta y gates de freemium.

**Architecture:** Cuatro componentes independientes ensamblados en `progress.tsx` (tab existente). Los hooks (`useBodyTracking`, `useProfile`) ya existen y no se modifican, salvo añadir `useFirstBodyData` a `useBodyTracking.ts`. No hay migraciones ni Edge Functions nuevas — todo va directo a Supabase con RLS.

**Tech Stack:** React Native + Expo SDK 56, @shopify/react-native-skia ^2.6.7, NativeWind v4 (estáticos `className`, dinámicos `style`), TanStack Query v5, react-native-bottom-sheet, Supabase.

## Global Constraints

- Fuentes siempre en `style` (nunca en `className`): `SpaceGrotesk-Bold`, `SpaceGrotesk-SemiBold`, `Inter-Bold`, `Inter-Medium`, `Inter-Regular`, `JetBrainsMono-Medium`
- Colores del design system en `style`: importar desde `@/constants/colors`
- NativeWind v4: clases estáticas → `className`, valores calculados/dinámicos → `style`
- `useIsPremium()` de `@/hooks/useSubscription` para gates
- Directorio de trabajo: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja/`

---

## File Map

| Archivo | Acción |
|---|---|
| `hooks/useBodyTracking.ts` | Modificar — añadir `useFirstBodyData` |
| `components/progress/MeasurementForm.tsx` | Reemplazar placeholder |
| `components/progress/GoalProgress.tsx` | Reemplazar placeholder |
| `components/progress/WeightChart.tsx` | Reemplazar placeholder |
| `app/(app)/progress.tsx` | Reemplazar placeholder |

---

## Task 1: MeasurementForm component

**Files:**
- Modify: `components/progress/MeasurementForm.tsx` (actualmente 1 línea vacía)

**Interfaces:**
- Produces: `MeasurementForm({ initialValues?, isUpdate?, onSuccess })` — usado en Task 4

- [ ] **Step 1: Reemplazar el placeholder**

```tsx
import { useState } from 'react';
import { View, Text } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLogBodyData } from '@/hooks/useBodyTracking';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

interface MeasurementFormProps {
  initialValues?: {
    weight_kg?: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
  };
  isUpdate?: boolean;
  onSuccess: () => void;
}

export function MeasurementForm({ initialValues, isUpdate = false, onSuccess }: MeasurementFormProps) {
  const isPremium = useIsPremium();
  const { mutate, isPending, error } = useLogBodyData();

  const [weightKg, setWeightKg] = useState(initialValues?.weight_kg?.toString() ?? '');
  const [bodyFatPct, setBodyFatPct] = useState(initialValues?.body_fat_pct?.toString() ?? '');
  const [muscleMassKg, setMuscleMassKg] = useState(initialValues?.muscle_mass_kg?.toString() ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  function validate(): string | null {
    const w = parseFloat(weightKg);
    if (!weightKg || isNaN(w) || w < 20 || w > 300) return 'El peso debe estar entre 20 y 300 kg';
    if (isPremium && bodyFatPct) {
      const bf = parseFloat(bodyFatPct);
      if (isNaN(bf) || bf < 2 || bf > 60) return 'La grasa corporal debe estar entre 2 y 60 %';
    }
    if (isPremium && muscleMassKg) {
      const mm = parseFloat(muscleMassKg);
      if (isNaN(mm) || mm < 10 || mm > 150) return 'La masa muscular debe estar entre 10 y 150 kg';
    }
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    const entry: { weight_kg: number; body_fat_pct?: number; muscle_mass_kg?: number } = {
      weight_kg: parseFloat(weightKg),
    };
    if (isPremium && bodyFatPct) entry.body_fat_pct = parseFloat(bodyFatPct);
    if (isPremium && muscleMassKg) entry.muscle_mass_kg = parseFloat(muscleMassKg);
    mutate(entry, { onSuccess });
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h3, color: colors.text }}>
        {isUpdate ? 'Actualizar medidas' : 'Registrar medidas'}
      </Text>

      <Input
        label="Peso (kg)"
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="70.5"
        keyboardType="decimal-pad"
      />

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Grasa corporal (%)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <Input
          value={bodyFatPct}
          onChangeText={setBodyFatPct}
          placeholder="18.5"
          keyboardType="decimal-pad"
          editable={isPremium}
          style={{ opacity: isPremium ? 1 : 0.4 }}
        />
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Masa muscular (kg)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <Input
          value={muscleMassKg}
          onChangeText={setMuscleMassKg}
          placeholder="35.0"
          keyboardType="decimal-pad"
          editable={isPremium}
          style={{ opacity: isPremium ? 1 : 0.4 }}
        />
      </View>

      {(validationError || error) && (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>
          {validationError ?? 'Error al guardar. Intenta de nuevo.'}
        </Text>
      )}

      <Button
        label={isUpdate ? 'Actualizar' : 'Registrar'}
        onPress={handleSubmit}
        loading={isPending}
        disabled={!weightKg}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | head -30
```

Expected: sin errores en `components/progress/MeasurementForm.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add components/progress/MeasurementForm.tsx && git commit -m "feat: MeasurementForm component con validación y gates premium"
```

---

## Task 2: useFirstBodyData + GoalProgress component

**Files:**
- Modify: `hooks/useBodyTracking.ts` — añadir `useFirstBodyData`
- Modify: `components/progress/GoalProgress.tsx` — reemplazar placeholder

**Interfaces:**
- Consumes: `useActiveGoal()` de `@/hooks/useProfile`, `useLatestBodyData()` y `useFirstBodyData()` de `@/hooks/useBodyTracking`
- Produces: `GoalProgress()` — componente sin props, usado en Task 4

- [ ] **Step 1: Añadir `useFirstBodyData` al hook existente**

Abrir `hooks/useBodyTracking.ts` y añadir al final del archivo (después de `useLogBodyData`):

```ts
export function useFirstBodyData() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['body_data', 'first', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_data')
        .select('weight_kg, recorded_at')
        .eq('user_id', user!.id)
        .order('recorded_at', { ascending: true })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
  });
}
```

- [ ] **Step 2: Reemplazar el placeholder de GoalProgress**

```tsx
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { useActiveGoal } from '@/hooks/useProfile';
import { useLatestBodyData, useFirstBodyData } from '@/hooks/useBodyTracking';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Pérdida de peso',
  muscle_gain: 'Ganancia muscular',
  recomposition: 'Recomposición corporal',
  powerlifting: 'Powerlifting',
  sport_specific: 'Deporte específico',
  general_fitness: 'Fitness general',
};

export function GoalProgress() {
  const { data: goal } = useActiveGoal();
  const { data: latest } = useLatestBodyData();
  const { data: first } = useFirstBodyData();

  if (!goal) {
    return (
      <View style={{
        backgroundColor: colors.surface, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: colors.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted, flex: 1 }}>
          Define tu meta en Perfil para ver tu progreso
        </Text>
      </View>
    );
  }

  const goalLabel = GOAL_LABELS[goal.type] ?? goal.type;
  const showWeightProgress =
    (goal.type === 'weight_loss' || goal.type === 'muscle_gain') &&
    goal.target_weight_kg != null;

  const startWeight: number | null = first?.weight_kg ?? null;
  const currentWeight: number | null = latest?.weight_kg ?? null;

  let progressPct = 0;
  if (showWeightProgress && startWeight != null && currentWeight != null && goal.target_weight_kg != null) {
    const totalChange = Math.abs(startWeight - goal.target_weight_kg);
    const achievedChange = Math.abs(startWeight - currentWeight);
    progressPct = totalChange > 0 ? Math.min((achievedChange / totalChange) * 100, 100) : 0;
  }

  const daysLeft = goal.target_date
    ? Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
          META ACTIVA
        </Text>
        <Badge label={goalLabel} variant="primary" />
      </View>

      {showWeightProgress && currentWeight != null ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.stat, color: colors.text }}>
              {currentWeight.toFixed(1)}
            </Text>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.textMuted }}>
              kg actuales
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
              Meta: {(goal.target_weight_kg as number).toFixed(1)} kg
            </Text>
          </View>

          <ProgressBar value={progressPct} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.primary }}>
              {progressPct >= 100 ? '¡Meta alcanzada!' : `${progressPct.toFixed(0)}% completado`}
            </Text>
            {daysLeft !== null && (
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                {daysLeft > 0 ? `${daysLeft} días restantes` : 'Fecha meta superada'}
              </Text>
            )}
          </View>
        </>
      ) : (
        <View style={{ gap: 6 }}>
          {!latest ? (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              Registra tu primera medida para ver tu avance
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
                {currentWeight?.toFixed(1)} kg registrados
              </Text>
            </View>
          )}
          {daysLeft !== null && (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
              {daysLeft > 0 ? `${daysLeft} días para tu meta` : 'Fecha meta superada'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | head -30
```

Expected: sin errores en los dos archivos modificados.

- [ ] **Step 4: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add hooks/useBodyTracking.ts components/progress/GoalProgress.tsx && git commit -m "feat: useFirstBodyData + GoalProgress con cálculo de % hacia meta"
```

---

## Task 3: WeightChart con Skia

**Files:**
- Modify: `components/progress/WeightChart.tsx` — reemplazar placeholder

**Interfaces:**
- Consumes: ningún hook (recibe `data` como prop)
- Produces: `WeightChart({ data: { recorded_at: string; weight_kg: number }[] })` — usado en Task 4

- [ ] **Step 1: Reemplazar el placeholder de WeightChart**

```tsx
import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, vec, Circle } from '@shopify/react-native-skia';
import { Ionicons } from '@expo/vector-icons';
import { useIsPremium } from '@/hooks/useSubscription';
import { colors } from '@/constants/colors';

const CHART_HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;
const PAD_H = 8;

interface DataPoint {
  recorded_at: string;
  weight_kg: number;
}

type RangeKey = '2w' | '1m' | '3m';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '2w', label: '2 sem', days: 14 },
  { key: '1m', label: '1 mes', days: 30 },
  { key: '3m', label: '3 mes', days: 90 },
];

function filterByDays(data: DataPoint[], days: number): DataPoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((d) => new Date(d.recorded_at) >= cutoff);
}

function toPoints(
  data: DataPoint[],
  chartW: number,
): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const drawW = chartW - PAD_H * 2;
  const drawH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  if (data.length === 1) {
    return [{ x: PAD_H + drawW / 2, y: PAD_TOP + drawH / 2 }];
  }

  const minW = Math.min(...data.map((d) => d.weight_kg));
  const maxW = Math.max(...data.map((d) => d.weight_kg));
  const wRange = maxW - minW || 1;
  const minT = new Date(data[0].recorded_at).getTime();
  const maxT = new Date(data[data.length - 1].recorded_at).getTime();
  const tRange = maxT - minT || 1;

  return data.map((d) => ({
    x: PAD_H + ((new Date(d.recorded_at).getTime() - minT) / tRange) * drawW,
    y: PAD_TOP + ((maxW - d.weight_kg) / wRange) * drawH,
  }));
}

function buildPaths(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return { linePath: null, areaPath: null };

  const linePath = Skia.Path.Make();
  const areaPath = Skia.Path.Make();

  linePath.moveTo(pts[0].x, pts[0].y);
  areaPath.moveTo(pts[0].x, CHART_HEIGHT - PAD_BOTTOM);
  areaPath.lineTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length; i++) {
    linePath.lineTo(pts[i].x, pts[i].y);
    areaPath.lineTo(pts[i].x, pts[i].y);
  }

  const last = pts[pts.length - 1];
  areaPath.lineTo(last.x, CHART_HEIGHT - PAD_BOTTOM);
  areaPath.close();

  return { linePath, areaPath };
}

interface WeightChartProps {
  data: DataPoint[];
}

export function WeightChart({ data }: WeightChartProps) {
  const isPremium = useIsPremium();
  const { width: screenW } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('2w');

  const chartW = screenW - 32;

  const validData = useMemo(
    () => data.filter((d) => d.weight_kg != null),
    [data],
  );

  const filtered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    return filterByDays(validData, r.days);
  }, [validData, range]);

  const points = useMemo(() => toPoints(filtered, chartW), [filtered, chartW]);
  const { linePath, areaPath } = useMemo(() => buildPaths(points), [points]);

  const xLabels = useMemo(() => {
    if (filtered.length < 2) return [];
    const step = Math.max(1, Math.floor((filtered.length - 1) / 4));
    const indices = new Set<number>([0]);
    for (let i = step; i < filtered.length - 1; i += step) indices.add(i);
    indices.add(filtered.length - 1);
    return [...indices].map((i) => {
      const d = new Date(filtered[i].recorded_at);
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, x: points[i]?.x ?? 0 };
    });
  }, [filtered, points]);

  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    }}>
      {/* Header + range selector */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
          PESO CORPORAL
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {RANGES.map(({ key, label, days }) => {
            const locked = !isPremium && days > 14;
            const active = range === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => !locked && setRange(key)}
                activeOpacity={locked ? 1 : 0.7}
                style={{
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primaryDim : 'transparent',
                  flexDirection: 'row', alignItems: 'center', gap: 3,
                }}
              >
                <Text style={{
                  fontFamily: 'Inter-Medium', fontSize: 11,
                  color: locked ? colors.textMuted : active ? colors.primary : colors.textMuted,
                }}>
                  {label}
                </Text>
                {locked && <Ionicons name="lock-closed" size={9} color={colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Chart or empty state */}
      {filtered.length < 2 ? (
        <View style={{ height: CHART_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Ionicons name="trending-up-outline" size={32} color={colors.textMuted} />
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
            Registra tu peso para ver tu progreso aquí
          </Text>
        </View>
      ) : (
        <>
          <Canvas style={{ width: chartW, height: CHART_HEIGHT }}>
            {areaPath && (
              <Path path={areaPath}>
                <LinearGradient
                  start={vec(0, PAD_TOP)}
                  end={vec(0, CHART_HEIGHT)}
                  colors={['rgba(34,197,94,0.25)', 'rgba(34,197,94,0)']}
                />
              </Path>
            )}
            {linePath && (
              <Path
                path={linePath}
                color={colors.primary}
                style="stroke"
                strokeWidth={2}
                strokeJoin="round"
                strokeCap="round"
              />
            )}
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={3} color={colors.primary} />
            ))}
          </Canvas>

          {/* X-axis labels */}
          <View style={{ height: 18, position: 'relative', marginTop: 2 }}>
            {xLabels.map(({ label, x }, i) => (
              <Text
                key={i}
                style={{
                  position: 'absolute',
                  left: x - 18,
                  width: 36,
                  textAlign: 'center',
                  fontFamily: 'Inter-Regular',
                  fontSize: 10,
                  color: colors.textMuted,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | head -30
```

Expected: sin errores en `components/progress/WeightChart.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add components/progress/WeightChart.tsx && git commit -m "feat: WeightChart con Skia — línea + área rellena + selector de rango"
```

---

## Task 4: progress.tsx — pantalla principal

**Files:**
- Modify: `app/(app)/progress.tsx` — reemplazar placeholder (actualmente 1 línea vacía)

**Interfaces:**
- Consumes:
  - `GoalProgress()` de `components/progress/GoalProgress`
  - `WeightChart({ data })` de `components/progress/WeightChart`
  - `MeasurementForm({ initialValues?, isUpdate?, onSuccess })` de `components/progress/MeasurementForm`
  - `useBodyHistory()` → `{ data: { recorded_at, weight_kg, body_fat_pct, muscle_mass_kg, id }[] }`
  - `useLatestBodyData()` → `{ data: { recorded_at, weight_kg, body_fat_pct, muscle_mass_kg } | null }`
  - `Sheet` (forwardRef, `ref.current?.expand()`, `ref.current?.close()`, prop `snapPoints`)

- [ ] **Step 1: Reemplazar el placeholder de progress.tsx**

```tsx
import { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoalProgress } from '@/components/progress/GoalProgress';
import { WeightChart } from '@/components/progress/WeightChart';
import { MeasurementForm } from '@/components/progress/MeasurementForm';
import { Sheet } from '@/components/ui/Sheet';
import { useBodyHistory, useLatestBodyData } from '@/hooks/useBodyTracking';
import { colors } from '@/constants/colors';
import { typography } from '@/constants/typography';

export default function ProgressScreen() {
  const sheetRef = useRef<any>(null);
  const { data: history } = useBodyHistory();
  const { data: latestBodyData } = useLatestBodyData();

  const isToday = !!latestBodyData?.recorded_at &&
    new Date(latestBodyData.recorded_at).toDateString() === new Date().toDateString();

  const recentRecords = (history ?? [])
    .filter((r) => r.weight_kg != null)
    .slice(-5)
    .reverse();

  const chartData = (history ?? [])
    .filter((r): r is typeof r & { weight_kg: number } => r.weight_kg != null)
    .map((r) => ({ recorded_at: r.recorded_at, weight_kg: r.weight_kg }));

  function handleOpenSheet() {
    sheetRef.current?.expand();
  }

  function handleFormSuccess() {
    sheetRef.current?.close();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h1, color: colors.text }}>
            Progreso
          </Text>
          {latestBodyData?.weight_kg && (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted, marginTop: 2 }}>
              Último registro: {latestBodyData.weight_kg.toFixed(1)} kg
            </Text>
          )}
        </View>

        {/* Meta */}
        <GoalProgress />

        <View style={{ height: 16 }} />

        {/* Gráfica */}
        <WeightChart data={chartData} />

        <View style={{ height: 16 }} />

        {/* Últimos registros */}
        {recentRecords.length > 0 && (
          <View style={{
            backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
            overflow: 'hidden',
          }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
                ÚLTIMAS MEDIDAS
              </Text>
            </View>
            {recentRecords.map((record, i) => {
              const date = new Date(record.recorded_at);
              const dateStr = date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
              const isLast = i === recentRecords.length - 1;
              return (
                <View
                  key={record.id}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>
                    {dateStr}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 14, color: colors.text }}>
                      {record.weight_kg?.toFixed(1)} kg
                    </Text>
                    {record.body_fat_pct && (
                      <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: colors.textMuted }}>
                        {record.body_fat_pct.toFixed(1)}% grasa
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={handleOpenSheet}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="add" size={28} color={colors.background} />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Sheet ref={sheetRef} snapPoints={['75%']}>
        <MeasurementForm
          initialValues={isToday ? {
            weight_kg: latestBodyData?.weight_kg ?? undefined,
            body_fat_pct: latestBodyData?.body_fat_pct ?? undefined,
            muscle_mass_kg: latestBodyData?.muscle_mass_kg ?? undefined,
          } : undefined}
          isUpdate={isToday}
          onSuccess={handleFormSuccess}
        />
      </Sheet>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | head -40
```

Expected: sin errores en ninguno de los 5 archivos tocados.

- [ ] **Step 3: Probar en simulador/dispositivo**

Iniciar Supabase local y el bundler:

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && sg docker -c "supabase start" 2>/dev/null; npx expo start
```

Verificar manualmente:
1. Tab "Progreso" carga sin errores
2. Botón `+` abre Bottom Sheet con el formulario
3. Ingresar un peso (ej. 75.5) y tocar "Registrar" — se cierra el Sheet
4. Volver a abrir Sheet — muestra valores pre-llenados y botón "Actualizar"
5. Con usuario free: campos de grasa/músculo deshabilitados con Badge "Premium"
6. La gráfica muestra el punto recién registrado (puede requerir 2+ registros)
7. Card de GoalProgress muestra % si hay meta de tipo weight_loss o muscle_gain

- [ ] **Step 4: Commit final**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add app/"(app)"/progress.tsx && git commit -m "feat: pantalla Progreso — Paso 10 completo (seguimiento corporal)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Formulario de registro: peso obligatorio, grasa/músculo premium
- ✅ Bottom Sheet al tocar `+`
- ✅ Una vez al día (pre-fill + "Actualizar")
- ✅ Gráfica Skia con línea + área rellena
- ✅ Historial free 14 días / premium 365 días (hook ya lo filtra en servidor)
- ✅ Selector de rango 2sem/1mes/3mes con lock en free
- ✅ Card de progreso hacia meta con `ProgressBar`
- ✅ Estados vacíos en todos los componentes
- ✅ Error inline en `MeasurementForm`

**Placeholder scan:** Sin TBDs. Todos los steps tienen código completo.

**Type consistency:**
- `MeasurementForm` exporta `MeasurementFormProps` con `onSuccess: () => void` — usado en Task 4
- `WeightChart` exporta `WeightChartProps` con `data: DataPoint[]` — usado en Task 4
- `GoalProgress` exporta sin props — usado en Task 4
- `useFirstBodyData()` devuelve `{ weight_kg: number; recorded_at: string } | null` — consumido en Task 2 como `first?.weight_kg`
