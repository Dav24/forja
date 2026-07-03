import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';

type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';
type Mode = 'flexible' | 'strict';

const FITNESS_LEVELS: { value: FitnessLevel; label: string; description: string }[] = [
  { value: 'casual',        label: 'Casual',        description: 'Entreno esporádicamente o soy principiante' },
  { value: 'intermediate',  label: 'Intermedio',    description: 'Entreno regularmente desde hace meses' },
  { value: 'intensive',     label: 'Intensivo',     description: 'Entreno con seriedad, varias veces a la semana' },
  { value: 'advanced',      label: 'Avanzado',      description: 'Años de entrenamiento consistente' },
  { value: 'elite',         label: 'Élite',         description: 'Atleta competitivo o de alto rendimiento' },
];

const MODES: { value: Mode; label: string; description: string; icon: string }[] = [
  { value: 'flexible', icon: '🌊', label: 'Flexible',  description: 'Me adapto cuando la vida se complica. Prefiero consistencia a perfección.' },
  { value: 'strict',   icon: '🎯', label: 'Estricto',  description: 'Me comprometo al 100%. Sin excusas, sin saltarme sesiones.' },
];

export default function Step3Level() {
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { goalType, targetWeightKg, weightKg, heightCm, age, gender, activityLevel } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleFinish() {
    if (!fitnessLevel || !mode) {
      Alert.alert('Selecciona ambas opciones', 'Elige tu nivel y modo de entrenamiento.');
      return;
    }
    if (!user || !goalType || !weightKg || !heightCm || !age || !gender || !activityLevel) {
      Alert.alert('Error', 'Faltan datos del paso anterior.');
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
          : 'Error desconocido';
      Alert.alert('Error al guardar', message);
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
          <Text className="text-text-muted text-sm font-medium mb-1">Paso 3 de 3</Text>
          <Text className="text-text font-bold text-3xl">Tu nivel y estilo</Text>
          <Text className="text-text-muted text-base mt-2">Último paso. Tu coach ajustará la intensidad a esto.</Text>
        </View>

        {/* Nivel de fitness */}
        <Text className="text-text font-semibold text-base mb-3">¿Cuál es tu nivel actual?</Text>
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
                    {level.label}
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">{level.description}</Text>
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
        <Text className="text-text font-semibold text-base mb-3">¿Cómo prefieres entrenar?</Text>
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
                    {m.label}
                  </Text>
                  {isSelected && (
                    <View className="ml-auto w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background text-xs font-bold">✓</Text>
                    </View>
                  )}
                </View>
                <Text className="text-text-muted text-sm">{m.description}</Text>
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
            ? <ActivityIndicator color="#0A0A0F" />
            : <Text className={`font-bold text-base ${fitnessLevel && mode ? 'text-background' : 'text-text-muted'}`}>
                Forjar mi plan 🔥
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
