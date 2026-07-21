import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { BODY_AREAS, INJURY_SEVERITIES, type BodyArea, type InjurySeverity } from '@/constants/health';
import { useInjuries, useAddInjury, useRemoveInjury } from '@/hooks/useInjuries';
import { useIsPremium } from '@/hooks/useSubscription';
import { useActiveGoal } from '@/hooks/useProfile';
import { useActiveWorkoutPlan, useGeneratePlan } from '@/hooks/useWorkoutPlan';
import { PlanGenerating } from '@/components/plans/PlanGenerating';
import type { ModalityId } from '@/constants/modalities';

export default function InjuriesScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { data: injuries } = useInjuries();
  const { mutate: addInjury, isPending: adding } = useAddInjury();
  const { mutate: removeInjury } = useRemoveInjury();

  const isPremium = useIsPremium();
  const { data: activePlan, refetch: refetchPlan } = useActiveWorkoutPlan();
  // workout_plans NO tiene columna `modality` — vive en goals.modality.
  const { data: activeGoal } = useActiveGoal();
  const { generating, generate } = useGeneratePlan(refetchPlan);
  const [regenerating, setRegenerating] = useState(false);

  const [bodyArea, setBodyArea] = useState<BodyArea | null>(null);
  const [severity, setSeverity] = useState<InjurySeverity | null>(null);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  async function maybeAutoRegenerate() {
    if (!isPremium || !activePlan || !activeGoal?.modality) return;
    const planIdBefore = activePlan.id;
    setRegenerating(true);
    try {
      await generate({
        modality: activeGoal.modality as ModalityId,
        days_per_week: activePlan.days_per_week ?? 3,
        minutes_per_session: activePlan.minutes_per_session ?? 60,
        equipment: activePlan.equipment ?? 'gym con máquinas y pesas libres',
      });
      // generate() nunca lanza ni señala fallo — todos sus caminos de error
      // (sin créditos, generación en curso, red) muestran su propio Alert
      // interno y resuelven normalmente. La única forma confiable de saber
      // si en verdad se creó un plan nuevo es comparar el id del plan activo
      // antes/después (refetch propio, no el closure de `activePlan`, que
      // no se actualiza dentro de esta misma ejecución síncrona).
      const { data: freshPlan } = await refetchPlan();
      if (freshPlan?.id && freshPlan.id !== planIdBefore) {
        Alert.alert(t('health.autoRegenDoneTitle'), t('health.autoRegenDoneWorkoutBody'));
      }
    } catch {
      // generate() ya tuvo éxito (o mostró su propio Alert de error) antes de
      // llegar aquí — un fallo de refetchPlan() es solo el paso de verificación
      // que no se pudo completar, no un fallo de generación. No hay nada nuevo
      // y significativo que decirle al usuario más allá de lo que ya vio, así
      // que se traga en silencio (mismo criterio que generate-meal-plan/conditions.tsx).
    } finally {
      setRegenerating(false);
    }
  }

  function handleAdd() {
    if (!bodyArea || !severity) return;
    addInjury(
      { body_area: bodyArea, severity, notes },
      {
        onSuccess: async () => {
          setBodyArea(null);
          setSeverity(null);
          setNotes('');
          setDirty(false);
          await maybeAutoRegenerate();
        },
      },
    );
  }

  function handleRemove(id: string) {
    removeInjury({ id }, { onSuccess: () => { maybeAutoRegenerate(); } });
  }

  function handleBack() {
    if (dirty) {
      Alert.alert(t('health.discardTitle'), t('health.discardBody'), [
        { text: t('health.discardCancel'), style: 'cancel' },
        { text: t('health.discardConfirm'), style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }
    router.back();
  }

  if (generating || regenerating) {
    return <PlanGenerating />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.injuriesButtonTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginBottom: 20 }}>
          {t('health.injuriesSubtitle')}
        </Text>

        {(injuries ?? []).map((inj) => (
          <View key={inj.id} className="flex-row items-center justify-between p-3 mb-2 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <View className="flex-1">
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                {t(BODY_AREAS.find((a) => a.value === inj.body_area)?.labelKey ?? '')}
              </Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                {t(INJURY_SEVERITIES.find((s) => s.value === inj.severity)?.labelKey ?? '')}
                {inj.notes ? ` — ${inj.notes}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(inj.id)} hitSlop={12}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}

        <FieldLabel first>{t('health.addInjuryTitle')}</FieldLabel>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {BODY_AREAS.map((a) => (
            <Chip
              key={a.value}
              label={t(a.labelKey)}
              selected={bodyArea === a.value}
              onPress={() => { setBodyArea(a.value); setDirty(true); }}
            />
          ))}
        </View>
        {bodyArea ? (
          <View className="gap-2 mb-3">
            {INJURY_SEVERITIES.map((s) => {
              const isSelected = severity === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => { setSeverity(s.value); setDirty(true); }}
                  className={`p-3 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                >
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: isSelected ? colors.primary : colors.text }}>{t(s.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {bodyArea && severity ? (
          <View className="flex-row gap-2 items-start mb-2">
            <View className="flex-1">
              <Input placeholder={t('health.notesPlaceholder')} value={notes} onChangeText={(v) => { setNotes(v); setDirty(true); }} />
            </View>
            <Button label={t('health.addButton')} size="sm" variant="secondary" loading={adding} onPress={handleAdd} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
