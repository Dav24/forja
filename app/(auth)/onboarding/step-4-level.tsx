import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { FITNESS_LEVELS, MODES, type FitnessLevel, type TrainingMode } from '@/constants/goals';

export default function Step3Level() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useAuthStore();
  const { goalType, targetWeightKg, targetDate, modality, secondaryModalities, sportType, modalityOrientation, modalityGoalNotes, secondaryGoalNotes, weightKg, heightCm, age, gender, activityLevel, setGoalId } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleFinish() {
    if (!fitnessLevel || !mode) {
      Alert.alert(t('step4.errors.missingSelection.title'), t('step4.errors.missingSelection.body'));
      return;
    }
    if (!user || !goalType || !weightKg || !heightCm || !age || !gender || !activityLevel) {
      Alert.alert(t('step4.errors.missingData.title'), t('step4.errors.missingData.body'));
      return;
    }

    setLoading(true);
    try {
      // Guardar body_data
      const { error: bodyError } = await supabase.from('body_data').insert({
        user_id: user.id,
        weight_kg: weightKg,
        height_cm: heightCm,
        age,
        gender,
        activity_level: activityLevel,
      });
      if (bodyError) throw bodyError;

      // Guardar goal — se captura el id: el paso 5 (opcional) lo usa para
      // agregar athletic_background sin crear un segundo goal duplicado.
      const { data: newGoal, error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        target_date: targetDate ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
        modality_orientation: modalityOrientation ?? null,
        modality_goal_notes: modalityGoalNotes ?? null,
        secondary_goal_notes: secondaryGoalNotes ?? null,
      }).select('id').single();
      if (goalError || !newGoal) throw goalError ?? new Error('goal insert sin id');

      setGoalId(newGoal.id);
      // onboarding_completed se marca en el paso 6 (opcional) — si se marca
      // antes, el AuthGuard expulsa a /(app) antes de que los pasos 5/6 rendericen
      // (ver app/_layout.tsx:113, redirige tan pronto onboardingCompleted=true
      // y la ruta activa sigue en el grupo (auth)).
      router.push('/(auth)/onboarding/step-5-athletic');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step4.errors.unknown');
      Alert.alert(t('step4.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 4, total: 6 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step4.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step4.subtitle')}
          </Text>
        </View>

        {/* Nivel de fitness */}
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step4.levelQuestion')}
        </Text>
        <View className="gap-2 mb-8">
          {FITNESS_LEVELS.map((level) => {
            const isSelected = fitnessLevel === level.value;
            return (
              <TouchableOpacity
                key={level.value}
                onPress={() => setFitnessLevel(level.value)}
                className={`p-4 rounded-xl border flex-row items-center gap-3 ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                    {t(level.labelKey)}
                  </Text>
                  <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                    {t(level.descriptionKey)}
                  </Text>
                </View>
                {isSelected && (
                  <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                    <Ionicons name="checkmark" size={12} color={colors.background} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Modo */}
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step4.modeQuestion')}
        </Text>
        <View className="gap-3">
          {MODES.map((m) => {
            const isSelected = mode === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => setMode(m.value)}
                className={`p-4 rounded-2xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <Ionicons name={m.iconName} size={20} color={isSelected ? colors.primary : colors.text} />
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                    {t(m.labelKey)}
                  </Text>
                  {isSelected && (
                    <View className="ml-auto w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={12} color={colors.background} />
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted }}>
                  {t(m.descriptionKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${fitnessLevel && mode ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleFinish}
          disabled={loading || !fitnessLevel || !mode}
        >
          {loading
            ? <ActivityIndicator color={colors.background} />
            : <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: fitnessLevel && mode ? colors.background : colors.textMuted }}>
                {t('step4.finishButton')}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}
