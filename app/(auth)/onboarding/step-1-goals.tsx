import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/store/onboarding.store';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { GOALS, type GoalType } from '@/constants/goals';

export default function Step1Goals() {
  const [selected, setSelected] = useState<GoalType | null>(null);
  const { setStep1 } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!selected) return;
    setStep1({ goalType: selected });
    router.push('/(auth)/onboarding/step-2-modality');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 items-center mb-6">
          <VulcanoAvatar size={72} />
          <Text className="text-text mt-3 text-center" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20 }}>
            Soy Vulcano, forjador de atletas
          </Text>
          <Text className="text-text-muted text-sm text-center mt-1" style={{ fontFamily: 'Inter-Regular' }}>
            Cuéntame de ti y forjaremos tu plan a la medida.
          </Text>
        </View>

        <View className="pb-8">
          <Text className="text-text-muted text-sm font-medium mb-1">Paso 1 de 4</Text>
          <Text className="text-text font-bold text-3xl">¿Cuál es tu objetivo?</Text>
          <Text className="text-text-muted text-base mt-2">Tu coach se adapta a lo que quieres lograr.</Text>
        </View>

        <View className="gap-3">
          {GOALS.map((goal) => {
            const isSelected = selected === goal.type;
            return (
              <TouchableOpacity
                key={goal.type}
                onPress={() => setSelected(goal.type)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <Text className="text-3xl">{goal.icon}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold text-base ${isSelected ? 'text-primary' : 'text-text'}`}>
                      {goal.title}
                    </Text>
                    <Text className="text-text-muted text-sm mt-0.5">{goal.description}</Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background font-bold text-xs">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Botón fijo al fondo */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${selected ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text className={`font-bold text-base ${selected ? 'text-background' : 'text-text-muted'}`}>
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
