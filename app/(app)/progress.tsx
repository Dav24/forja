import { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GoalProgress } from '@/components/progress/GoalProgress';
import { WeightChart } from '@/components/progress/WeightChart';
import { MeasurementForm } from '@/components/progress/MeasurementForm';
import { Sheet } from '@/components/ui/Sheet';
import { StatCard } from '@/components/ui/StatCard';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { useBodyHistory, useLatestBodyData } from '@/hooks/useBodyTracking';
import { useTheme } from '@/lib/theme';
import { useHideNavOnScroll, useNavClearance } from '@/lib/scrollNav';
import { formatDate } from '@/lib/formatDate';

export default function ProgressScreen() {
  const { t } = useTranslation('progress');
  const { colors } = useTheme();
  const sheetRef = useRef<any>(null);
  const { data: history } = useBodyHistory();
  const { data: latestBodyData } = useLatestBodyData();
  const navScroll = useHideNavOnScroll();
  const navClearance = useNavClearance();

  const isToday = !!latestBodyData?.recorded_at &&
    new Date(latestBodyData.recorded_at).toDateString() === new Date().toDateString();

  const recentRecords = (history ?? [])
    .filter((r): r is typeof r & { weight_kg: number } => r.weight_kg != null)
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
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        {...navScroll}
      >
        {/* Header */}
        <StaggerIn index={0}>
        <View className="mb-5">
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text }}>
            {t('title')}
          </Text>
          {latestBodyData?.weight_kg && (
            <Text
              className="mt-0.5 text-sm"
              style={{ fontFamily: 'Inter-Regular', color: colors.textMuted }}
            >
              {t('lastRecord', { weight: latestBodyData.weight_kg.toFixed(1) })}
            </Text>
          )}
        </View>
        </StaggerIn>

        {/* Stat cards */}
        <StaggerIn index={1}>
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

        {/* Meta + gráfica */}
        <StaggerIn index={2}>
        <GoalProgress />

        <View className="h-4" />

        <WeightChart data={chartData} />
        </StaggerIn>

        <View className="h-4" />

        {/* Últimos registros */}
        <StaggerIn index={3}>
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

      {/* FAB */}
      <TouchableOpacity
        onPress={handleOpenSheet}
        activeOpacity={0.8}
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{
          position: 'absolute',
          bottom: navClearance + 4,
          right: 24,
          backgroundColor: colors.primary,
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
          existingId={isToday ? latestBodyData?.id ?? undefined : undefined}
          onSuccess={handleFormSuccess}
        />
      </Sheet>
    </SafeAreaView>
  );
}
