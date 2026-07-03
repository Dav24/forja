import { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { GoalProgress } from '@/components/progress/GoalProgress';
import { WeightChart } from '@/components/progress/WeightChart';
import { MeasurementForm } from '@/components/progress/MeasurementForm';
import { Sheet } from '@/components/ui/Sheet';
import { StatCard } from '@/components/ui/StatCard';
import { useBodyHistory, useLatestBodyData } from '@/hooks/useBodyTracking';
import { colors } from '@/constants/colors';

export default function ProgressScreen() {
  const sheetRef = useRef<any>(null);
  const { data: history } = useBodyHistory();
  const { data: latestBodyData } = useLatestBodyData();

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
      <Animated.View entering={FadeInUp.duration(250)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-5">
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text }}>
            Progreso
          </Text>
          {latestBodyData?.weight_kg && (
            <Text
              className="mt-0.5 text-sm"
              style={{ fontFamily: 'Inter-Regular', color: colors.textMuted }}
            >
              Último registro: {latestBodyData.weight_kg.toFixed(1)} kg
            </Text>
          )}
        </View>

        {/* Stat cards */}
        <View className="flex-row gap-3 mb-4">
          <StatCard
            value={latestBodyData?.weight_kg ?? '—'}
            label="Peso"
            suffix=" kg"
            decimals={1}
          />
          <StatCard
            value={latestBodyData?.body_fat_pct ?? '—'}
            label="Grasa"
            suffix="%"
            decimals={1}
          />
          <StatCard
            value={latestBodyData?.muscle_mass_kg ?? '—'}
            label="Músculo"
            suffix=" kg"
            decimals={1}
          />
        </View>

        {/* Meta */}
        <GoalProgress />

        <View className="h-4" />

        {/* Gráfica */}
        <WeightChart data={chartData} />

        <View className="h-4" />

        {/* Últimos registros */}
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
      </Animated.View>

      {/* FAB */}
      <TouchableOpacity
        onPress={handleOpenSheet}
        activeOpacity={0.8}
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{
          position: 'absolute',
          bottom: 24,
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
