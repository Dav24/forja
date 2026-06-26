import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = [
  '/(auth)/onboarding/step-1-goals',
  '/(auth)/onboarding/step-2-body',
  '/(auth)/onboarding/step-3-level',
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
        <View className="h-1 bg-surface-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          />
        </View>
      </View>

      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </View>
  );
}
