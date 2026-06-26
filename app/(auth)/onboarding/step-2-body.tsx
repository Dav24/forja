import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/store/onboarding.store';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male',              label: 'Hombre' },
  { value: 'female',            label: 'Mujer' },
  { value: 'other',             label: 'Otro' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary',  label: 'Sedentario',   description: 'Poco o nada de ejercicio' },
  { value: 'light',      label: 'Ligero',        description: '1-3 días/semana' },
  { value: 'moderate',   label: 'Moderado',      description: '3-5 días/semana' },
  { value: 'active',     label: 'Activo',        description: '6-7 días/semana' },
  { value: 'very_active',label: 'Muy activo',    description: 'Dos veces al día o trabajo físico' },
];

export default function Step2Body() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const { setStep2 } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!weight || !height || !age || !gender || !activityLevel) {
      Alert.alert('Campos requeridos', 'Completa todos los campos para continuar.');
      return;
    }
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (isNaN(w) || w < 20 || w > 300) { Alert.alert('Peso inválido', 'Ingresa un peso entre 20 y 300 kg.'); return; }
    if (isNaN(h) || h < 100 || h > 250) { Alert.alert('Altura inválida', 'Ingresa una altura entre 100 y 250 cm.'); return; }
    if (isNaN(a) || a < 12 || a > 100) { Alert.alert('Edad inválida', 'Ingresa una edad entre 12 y 100 años.'); return; }

    setStep2({ weightKg: w, heightCm: h, age: a, gender, activityLevel });
    router.push('/(auth)/onboarding/step-3-level');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="pt-6 pb-8">
          <Text className="text-text-muted text-sm font-medium mb-1">Paso 2 de 3</Text>
          <Text className="text-text font-bold text-3xl">Tu cuerpo</Text>
          <Text className="text-text-muted text-base mt-2">Para que tu coach calcule tu plan correctamente.</Text>
        </View>

        {/* Peso y altura en fila */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">Peso (kg)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder="70"
              placeholderTextColor="#64748B"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">Altura (cm)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder="175"
              placeholderTextColor="#64748B"
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Edad */}
        <View className="mb-6">
          <Text className="text-text text-sm font-medium mb-2">Edad</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
            placeholder="25"
            placeholderTextColor="#64748B"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />
        </View>

        {/* Género */}
        <View className="mb-6">
          <Text className="text-text text-sm font-medium mb-3">Género</Text>
          <View className="flex-row flex-wrap gap-2">
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                onPress={() => setGender(g.value)}
                className={`px-4 h-10 rounded-full border items-center justify-center ${gender === g.value ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text className={`text-sm font-medium ${gender === g.value ? 'text-primary' : 'text-text'}`}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nivel de actividad */}
        <View className="mb-6">
          <Text className="text-text text-sm font-medium mb-3">Nivel de actividad actual</Text>
          <View className="gap-2">
            {ACTIVITY_LEVELS.map((level) => {
              const isSelected = activityLevel === level.value;
              return (
                <TouchableOpacity
                  key={level.value}
                  onPress={() => setActivityLevel(level.value)}
                  className={`p-3 rounded-xl border flex-row items-center gap-3 ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
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
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="bg-primary rounded-xl h-14 items-center justify-center"
          onPress={handleContinue}
        >
          <Text className="text-background font-bold text-base">Continuar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
