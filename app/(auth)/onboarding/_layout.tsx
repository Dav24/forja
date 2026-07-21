import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ui/ProgressBar';

const STEPS = [
  '/(auth)/onboarding/step-1-goals',
  '/(auth)/onboarding/step-2-modality',
  '/(auth)/onboarding/step-3-body',
  '/(auth)/onboarding/step-4-level',
  '/(auth)/onboarding/step-5-athletic',
  '/(auth)/onboarding/step-6-health',
];

export default function OnboardingLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const currentStep = STEPS.findIndex((s) => s.includes(pathname.split('/').pop() ?? ''));
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Barra de progreso */}
      <View className="px-5 pt-4 pb-2">
        <ProgressBar value={progress} />
      </View>

      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}
