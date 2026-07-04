import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';

export default function SuccessScreen() {
  const queryClient = useQueryClient();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    setBurst(true);
  }, [queryClient]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <SparkBurst trigger={burst} onDone={() => setBurst(false)} />
        <Text
          style={{
            fontFamily: 'BebasNeue-Regular',
            fontSize: 40,
            color: colors.text,
            letterSpacing: 1,
            textAlign: 'center',
          }}
        >
          EL ACERO ESTÁ FORJADO
        </Text>
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          Ya eres Maestro Forjador. Vulcano te espera.
        </Text>
        <Button label="Empezar a forjar" onPress={() => router.replace('/(app)')} />
      </View>
    </SafeAreaView>
  );
}
