import { useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { GoalProgress } from '@/components/progress/GoalProgress';
import { WeightChart } from '@/components/progress/WeightChart';
import { MeasurementForm } from '@/components/progress/MeasurementForm';
import { Sheet } from '@/components/ui/Sheet';
import { StatCard } from '@/components/ui/StatCard';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { Button } from '@/components/ui/Button';
import { useBodyHistory, useLatestBodyData } from '@/hooks/useBodyTracking';
import { useStreak } from '@/hooks/useStreak';
import { useIsPremium } from '@/hooks/useSubscription';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { useHideNavOnScroll } from '@/lib/scrollNav';
import { formatDate } from '@/lib/formatDate';

// Delta honesto: compara solo si hay ≥2 registros reales dentro de la
// ventana pedida — nunca inventa "esta semana"/"este mes" sin datos
// (mismo criterio que el fix de home.tsx: nunca prometer un timeframe que
// los datos no respaldan).
function windowDelta(history: { recorded_at: string; weight_kg: number }[], days: number): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const inWindow = history.filter((r) => new Date(r.recorded_at) >= cutoff);
  if (inWindow.length < 2) return null;
  return inWindow[inWindow.length - 1].weight_kg - inWindow[0].weight_kg;
}

export default function ProgressScreen() {
  const { t } = useTranslation('progress');
  const { colors } = useTheme();
  const sheetRef = useRef<any>(null);
  const { data: history } = useBodyHistory();
  const { data: latestBodyData } = useLatestBodyData();
  const { data: streak = 0 } = useStreak();
  const isPremium = useIsPremium();
  const navScroll = useHideNavOnScroll();

  const isToday = !!latestBodyData?.recorded_at &&
    new Date(latestBodyData.recorded_at).toDateString() === new Date().toDateString();

  const validHistory = (history ?? [])
    .filter((r): r is typeof r & { weight_kg: number } => r.weight_kg != null);

  const recentRecords = validHistory.slice(-5).reverse();
  const chartData = validHistory.map((r) => ({ recorded_at: r.recorded_at, weight_kg: r.weight_kg }));

  const weekDelta = windowDelta(validHistory, 7);
  const monthDelta = windowDelta(validHistory, 30);

  // Presentación: IMC calculado inline a partir de datos ya fetcheados por
  // los hooks de esta pantalla (body_data trae height_cm en el registro más
  // reciente que lo tenga — no todos los logs lo piden). Si no hay altura
  // conocida en la ventana ya cargada, se omite la columna.
  const heightCm = latestBodyData?.height_cm
    ?? [...(history ?? [])].reverse().find((r) => r.height_cm != null)?.height_cm
    ?? null;
  const bmi = heightCm && latestBodyData?.weight_kg
    ? latestBodyData.weight_kg / (heightCm / 100) ** 2
    : null;

  function handleOpenSheet() {
    sheetRef.current?.expand();
  }

  function handleFormSuccess() {
    sheetRef.current?.close();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        {...navScroll}
      >
        {/* Header: título + peso actual */}
        <StaggerIn index={0}>
        <View className="flex-row justify-between items-center">
          <Text className="uppercase" style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, letterSpacing: 1 }}>
            {t('title')}
          </Text>
          {latestBodyData?.weight_kg != null && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 22, color: colors.text }}>
                {latestBodyData.weight_kg.toFixed(1)}
                <Text style={{ fontSize: 12, color: colors.textMuted }}> kg</Text>
              </Text>
              {weekDelta != null && (
                <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11.5, color: colors.success, marginTop: 2 }}>
                  {t('headerWeightDelta', { arrow: weekDelta <= 0 ? '↓' : '↑', value: Math.abs(weekDelta).toFixed(1) })}
                </Text>
              )}
            </View>
          )}
        </View>
        </StaggerIn>

        {/* Gráfica protagonista — full-bleed (bleed del padding real del scroll, 16px) */}
        <StaggerIn index={1}>
        <View style={{ marginHorizontal: -16, marginTop: 4 }}>
          <WeightChart data={chartData} />
        </View>

        {/* Stats en fila */}
        <View
          className="flex-row"
          style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 14, marginTop: 4 }}
        >
          {monthDelta != null && (
            <View className="flex-1 items-center">
              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 16, color: monthDelta <= 0 ? colors.success : colors.text }}>
                {monthDelta <= 0 ? '' : '+'}{monthDelta.toFixed(1)}
                <Text style={{ fontSize: 11 }}> kg</Text>
              </Text>
              <Text
                className="uppercase mt-1"
                style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, letterSpacing: 1.4, color: colors.textFaint }}
              >
                {t('monthDelta')}
              </Text>
            </View>
          )}
          {bmi != null && (
            <View className="flex-1 items-center">
              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 16, color: colors.text }}>
                {bmi.toFixed(1)}
              </Text>
              <Text
                className="uppercase mt-1"
                style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, letterSpacing: 1.4, color: colors.textFaint }}
              >
                {t('bmi')}
              </Text>
            </View>
          )}
          <View className="flex-1 items-center">
            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 16, color: colors.accentText }}>
              {streak}
            </Text>
            <Text
              className="uppercase mt-1"
              style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 10, letterSpacing: 1.4, color: colors.textFaint }}
            >
              {t('streak')}
            </Text>
          </View>
        </View>

        {/* CTA — registrar medida (reemplaza al FAB, mismo Sheet) */}
        <View style={{ marginTop: 16 }}>
          <Button label={t('logMeasurement')} onPress={handleOpenSheet} />
        </View>

        {!isPremium && (
          <Text
            className="text-center"
            style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textMuted, marginTop: 10 }}
          >
            {t('compositionNote')}
          </Text>
        )}
        </StaggerIn>

        <View className="h-4" />

        {/* Stat cards detallados */}
        <StaggerIn index={2}>
        <View className="flex-row gap-3 mb-4">
          <StatCard
            value={latestBodyData?.weight_kg ?? '—'}
            label={t('stats.weight')}
            suffix=" kg"
            decimals={1}
          />
          <StatCard
            value={latestBodyData?.body_fat_pct ?? '—'}
            label={t('stats.fat')}
            suffix="%"
            decimals={1}
          />
          <StatCard
            value={latestBodyData?.muscle_mass_kg ?? '—'}
            label={t('stats.muscle')}
            suffix=" kg"
            decimals={1}
          />
        </View>
        </StaggerIn>

        {/* Meta */}
        <StaggerIn index={3}>
        <GoalProgress />
        </StaggerIn>

        <View className="h-4" />

        {/* Últimos registros */}
        <StaggerIn index={4}>
        {recentRecords.length > 0 && (
          <View
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View
              className="px-4 py-3 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <Text
                className="text-[13px] tracking-[0.5px]"
                style={{ fontFamily: 'SpaceGrotesk-Bold', color: colors.textMuted }}
              >
                {t('recentRecords.title')}
              </Text>
            </View>
            {recentRecords.map((record, i) => {
              const dateStr = formatDate(record.recorded_at, { day: 'numeric', month: 'short' });
              const isLast = i === recentRecords.length - 1;
              return (
                <View
                  key={record.id}
                  className="flex-row justify-between items-center px-4 py-3"
                  style={{
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ fontFamily: 'Inter-Regular', color: colors.textMuted }}
                  >
                    {dateStr}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Text
                      className="text-sm"
                      style={{ fontFamily: 'JetBrainsMono-Medium', color: colors.text }}
                    >
                      {record.weight_kg.toFixed(1)} kg
                    </Text>
                    {record.body_fat_pct && (
                      <Text
                        className="text-xs"
                        style={{ fontFamily: 'JetBrainsMono-Medium', color: colors.textMuted }}
                      >
                        {t('recentRecords.fatSuffix', { pct: record.body_fat_pct.toFixed(1) })}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        </StaggerIn>
      </ScrollView>

      {/* Bottom Sheet */}
      <Sheet ref={sheetRef} snapPoints={['75%']}>
        <MeasurementForm
          initialValues={isToday ? {
            weight_kg: latestBodyData?.weight_kg ?? undefined,
            body_fat_pct: latestBodyData?.body_fat_pct ?? undefined,
            muscle_mass_kg: latestBodyData?.muscle_mass_kg ?? undefined,
          } : undefined}
          isUpdate={isToday}
          existingId={isToday ? latestBodyData?.id ?? undefined : undefined}
          onSuccess={handleFormSuccess}
        />
      </Sheet>
    </SafeAreaView>
  );
}
