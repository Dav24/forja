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
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
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
