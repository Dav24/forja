import { forwardRef, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Stepper } from '@/components/ui/Stepper';
import { useTheme } from '@/lib/theme';
import { useExerciseCatalogEntry } from '@/hooks/useExerciseCatalog';
import { useExerciseProgression, useLogExerciseSets } from '@/hooks/useExerciseLogs';

interface ScheduleExercise {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
}

interface ExerciseSheetProps {
  exercise: ScheduleExercise | null;
  workoutPlanId: string;
  dayNumber: number;
  exerciseIndex: number;
}

type RegisterKind = 'kg' | 'bodyweight' | 'none';

function registerKind(equipment: string | undefined, movementPattern: string | undefined): RegisterKind {
  if (!equipment) return 'none';
  if (movementPattern === 'Mobility' || movementPattern === 'Stretch') return 'none';
  if (equipment === 'Bodyweight') return 'bodyweight';
  return 'kg';
}

function Sparkline({ points }: { points: number[] }) {
  const { colors } = useTheme();
  const w = 260;
  const h = 46;
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const coords = points.map((v, i) => {
    const x = 6 + i * ((w - 12) / (points.length - 1));
    const y = max === min ? h / 2 : h - 8 - ((v - min) / (max - min)) * (h - 16);
    return { x, y };
  });
  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];
  return (
    <Svg width={w} height={h}>
      <Path d={path} stroke={colors.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.primary} />
    </Svg>
  );
}

export const ExerciseSheet = forwardRef<BottomSheet, ExerciseSheetProps>(function ExerciseSheet(
  { exercise, workoutPlanId, dayNumber, exerciseIndex },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation('plans');
  const slug = exercise?.exercise_slug ?? null;
  const { data: catalogEntry } = useExerciseCatalogEntry(slug);
  const { data: progression } = useExerciseProgression(slug);
  const { mutateAsync: logSets, isPending } = useLogExerciseSets();
  const [saved, setSaved] = useState(false);

  const player = useVideoPlayer(catalogEntry?.video_url ?? null, (p) => {
    p.loop = true;
    p.play();
  });

  const kind = registerKind(catalogEntry?.equipment, catalogEntry?.movement_pattern);
  const numSets = exercise?.sets ?? 0;
  const [values, setValues] = useState<{ kg: number; reps: number; lastre: number }[]>([]);

  useEffect(() => {
    setValues([]);
    setSaved(false);
  }, [dayNumber, exerciseIndex]);

  const rows = useMemo(() => {
    if (values.length === numSets) return values;
    const lastKg = progression?.[progression.length - 1]?.kg ?? 20;
    const lastReps = progression?.[progression.length - 1]?.reps ?? 10;
    const lastLastre = progression?.[progression.length - 1]?.bodyweight_lastre_kg ?? 0;
    return Array.from({ length: numSets }, () => ({ kg: lastKg, reps: lastReps, lastre: lastLastre }));
  }, [values, numSets, progression]);

  if (!exercise) return <Sheet ref={ref} snapPoints={['1%']}>{null}</Sheet>;

  const sparklinePoints = (progression ?? [])
    .map((p) => (kind === 'kg' ? p.kg : kind === 'bodyweight' ? p.reps : null))
    .filter((v): v is number => v != null);

  function todayLogDate(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async function handleSave() {
    await logSets({
      workoutPlanId,
      dayNumber,
      exerciseOrder: exercise!.order,
      exerciseSlug: slug,
      logDate: todayLogDate(),
      sets: rows.map((r, i) => ({
        setNumber: i + 1,
        kg: kind === 'kg' ? r.kg : undefined,
        reps: kind !== 'none' ? r.reps : undefined,
        bodyweightLastreKg: kind === 'bodyweight' ? r.lastre : undefined,
      })),
    });
    setSaved(true);
  }

  return (
    <Sheet ref={ref} snapPoints={['85%']} scrollable>
      <View style={{ paddingTop: 8 }}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 25, color: colors.text }}>
          {catalogEntry?.name_es ?? exercise.name}
        </Text>
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.textFaint, marginTop: 4 }}>
          {exercise.sets}×{exercise.reps} · {exercise.rest_seconds}s
        </Text>

        {slug ? (
          <View style={{ borderRadius: 18, overflow: 'hidden', marginTop: 14, height: 210, backgroundColor: colors.backgroundAlt }}>
            {catalogEntry ? (
              <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
            ) : (
              <Image source={{ uri: undefined }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
            <Text
              style={{
                position: 'absolute', top: 10, left: 12,
                fontSize: 9.5, letterSpacing: 1.4, color: colors.textFaint,
                fontFamily: 'SpaceGrotesk-Bold', textTransform: 'uppercase',
              }}
            >
              {t('exerciseSheet.demoTag')}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12.5, marginTop: 14 }}>
            {t('exerciseSheet.noVideoNote')}
          </Text>
        )}

        {(catalogEntry?.instructions_es ?? (exercise.technique_notes ? [exercise.technique_notes] : [])).map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 9, marginTop: 8 }}>
            <Text style={{ color: colors.primary }}>✓</Text>
            <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Regular', fontSize: 12.5, lineHeight: 18 }}>{step}</Text>
          </View>
        ))}

        {kind === 'none' ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 16 }}>
            {t('exerciseSheet.noLogNote')}
          </Text>
        ) : (
          <>
            <Text style={{ fontSize: 10, letterSpacing: 1.2, color: colors.textFaint, marginTop: 18, fontFamily: 'SpaceGrotesk-Bold' }}>
              {kind === 'bodyweight' ? t('exerciseSheet.logTitleBodyweight') : t('exerciseSheet.logTitle')}
            </Text>
            {rows.map((row, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ width: 30, color: colors.textFaint, fontFamily: 'JetBrainsMono-Medium', fontSize: 11 }}>
                  {t('exerciseSheet.set', { n: i + 1 })}
                </Text>
                {kind === 'kg' ? (
                  <Stepper
                    value={row.kg} step={2.5} decimals={1} unit={t('exerciseSheet.kg')}
                    onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], kg: v }; return next; })}
                  />
                ) : (
                  <Stepper
                    value={row.lastre} step={2.5} decimals={1} unit={t('exerciseSheet.lastre')}
                    onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], lastre: v }; return next; })}
                  />
                )}
                <Stepper
                  value={row.reps} step={1} decimals={0} unit={t('exerciseSheet.reps')}
                  onChange={(v) => setValues((prev) => { const next = [...rows]; next[i] = { ...next[i], reps: v }; return next; })}
                />
              </View>
            ))}
            {sparklinePoints.length >= 2 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 10, letterSpacing: 1.2, color: colors.textFaint, marginBottom: 6, fontFamily: 'SpaceGrotesk-Bold' }}>
                  {t('exerciseSheet.progressionLabel')}
                </Text>
                <Sparkline points={sparklinePoints} />
              </View>
            ) : null}
            <View
              onTouchEnd={handleSave}
              style={{
                marginTop: 16, backgroundColor: colors.primary, borderRadius: 14,
                paddingVertical: 13, alignItems: 'center', opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={{ color: colors.onPrimary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5 }}>
                  {saved ? t('exerciseSheet.saved') : t('exerciseSheet.save')}
                </Text>
              )}
            </View>
          </>
        )}
      </View>
    </Sheet>
  );
});
