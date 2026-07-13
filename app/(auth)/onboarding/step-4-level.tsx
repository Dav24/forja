import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { useTheme } from '@/lib/theme';
import { FITNESS_LEVELS, MODES, type FitnessLevel, type TrainingMode } from '@/constants/goals';

export default function Step3Level() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { goalType, targetWeightKg, modality, secondaryModalities, sportType, weightKg, heightCm, age, gender, activityLevel } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
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

      // Guardar goal
      const { error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
      });
      if (goalError) throw goalError;

      // Marcar onboarding como completado
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Disparar celebración; la navegación ocurre en onDone para evitar
      // que el AuthGuard redirija antes de que termine la animación.
      setCelebrating(true);
    } catch (err: unknown) {
      // Los errores de Supabase (PostgrestError) traen message pero no extienden Error
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
          <Text className="text-text-muted text-sm font-medium mb-1">{t('layout.stepOf', { current: 4, total: 4 })}</Text>
          <Text className="text-text font-bold text-3xl">{t('step4.title')}</Text>
          <Text className="text-text-muted text-base mt-2">{t('step4.subtitle')}</Text>
        </View>

        {/* Nivel de fitness */}
        <Text className="text-text font-semibold text-base mb-3">{t('step4.levelQuestion')}</Text>
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
                  <Text className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-text'}`}>
                    {t(level.labelKey)}
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">{t(level.descriptionKey)}</Text>
                </View>
                {isSelected && (
                  <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                    <Text className="text-background text-xs font-bold">✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Modo */}
        <Text className="text-text font-semibold text-base mb-3">{t('step4.modeQuestion')}</Text>
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
                  <Text className="text-2xl">{m.icon}</Text>
                  <Text className={`font-bold text-base ${isSelected ? 'text-primary' : 'text-text'}`}>
                    {t(m.labelKey)}
                  </Text>
                  {isSelected && (
                    <View className="ml-auto w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background text-xs font-bold">✓</Text>
                    </View>
                  )}
                </View>
                <Text className="text-text-muted text-sm">{t(m.descriptionKey)}</Text>
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
          disabled={loading || celebrating || !fitnessLevel || !mode}
        >
          {loading
            ? <ActivityIndicator color={colors.background} />
            : <Text className={`font-bold text-base ${fitnessLevel && mode ? 'text-background' : 'text-text-muted'}`}>
                {t('step4.finishButton')}
              </Text>
          }
        </TouchableOpacity>
      </View>

      <SparkBurst
        trigger={celebrating}
        onDone={() => {
          setOnboardingCompleted(true);
          router.replace('/(app)');
        }}
      />
    </View>
  );
}
