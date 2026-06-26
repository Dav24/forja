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
