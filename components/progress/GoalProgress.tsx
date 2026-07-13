import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { useActiveGoal } from '@/hooks/useProfile';
import { useLatestBodyData, useFirstBodyData } from '@/hooks/useBodyTracking';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

export function GoalProgress() {
  const { colors } = useTheme();
  const { t } = useTranslation('progress');
  const { data: goal } = useActiveGoal();
  const { data: latest } = useLatestBodyData();
  const { data: first } = useFirstBodyData();

  if (!goal) {
    return (
      <View
        className="rounded-2xl p-4 border flex-row items-center gap-3"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      >
        <Ionicons name="flag-outline" size={20} color={colors.textMuted} />
        <Text className="flex-1" style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>
          {t('goal.noGoalPrompt')}
        </Text>
      </View>
    );
  }

  const goalLabel = t(`goal.labels.${goal.type}`, { defaultValue: goal.type });
  const showWeightProgress =
    (goal.type === 'weight_loss' || goal.type === 'muscle_gain') &&
    goal.target_weight_kg != null;

  const startWeight: number | null = first?.weight_kg ?? null;
  const currentWeight: number | null = latest?.weight_kg ?? null;

  let progressPct = 0;
  if (showWeightProgress && startWeight != null && currentWeight != null && goal.target_weight_kg != null) {
    const totalChange = Math.abs(startWeight - goal.target_weight_kg);
    // Positive when moving in the correct direction for the goal type
    const signedChange = goal.type === 'weight_loss'
      ? startWeight - currentWeight   // positive when losing (correct direction)
      : currentWeight - startWeight;  // positive when gaining (correct direction)
    progressPct = totalChange > 0 ? Math.min(Math.max((signedChange / totalChange) * 100, 0), 100) : 0;
  }

  const daysLeft = goal.target_date
    ? Math.max(0, Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <View
      className="rounded-2xl p-4 border"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <Text style={{ fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 }}>
          {t('goal.activeLabel')}
        </Text>
        <Badge label={goalLabel} variant="primary" />
      </View>

      {showWeightProgress && currentWeight != null ? (
        <>
          <View className="flex-row items-baseline gap-1.5 mb-2.5">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.stat, color: colors.text }}>
              {currentWeight.toFixed(1)}
            </Text>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.textMuted }}>
              {t('goal.currentSuffix')}
            </Text>
            <View className="flex-1" />
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
              {t('goal.targetLabel', { value: goal.target_weight_kg!.toFixed(1) })}
            </Text>
          </View>

          <ProgressBar value={progressPct} />

          <View className="flex-row justify-between mt-2">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.primary }}>
              {progressPct >= 100 ? t('goal.goalReached') : t('goal.percentComplete', { pct: progressPct.toFixed(0) })}
            </Text>
            {daysLeft !== null && (
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                {daysLeft > 0 ? t('goal.daysLeftRestantes', { count: daysLeft }) : daysLeft === 0 ? t('goal.daysLeftToday') : t('goal.daysLeftPast')}
              </Text>
            )}
          </View>
        </>
      ) : (
        <View className="gap-1.5">
          {!latest ? (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              {t('goal.firstMeasurementPrompt')}
            </Text>
          ) : (
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
                {currentWeight != null ? t('goal.weightRecorded', { weight: currentWeight.toFixed(1) }) : t('goal.measurementRecorded')}
              </Text>
            </View>
          )}
          {daysLeft !== null && (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
              {daysLeft > 0 ? t('goal.daysToGoal', { count: daysLeft }) : t('goal.daysLeftPast')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
