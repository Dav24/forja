import { ReactNode, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

interface Props {
  index?: number; // posición en la secuencia (delay = index * 50ms)
  children: ReactNode;
}

// Entrada escalonada al enfocar el tab. Con reduced-motion, aparece directo.
export function StaggerIn({ index = 0, children }: Props) {
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  useFocusEffect(useCallback(() => { setCycle((c) => c + 1); }, []));
  if (reduced) return <>{children}</>;
  return (
    <Animated.View key={cycle} entering={FadeInUp.duration(450).delay(index * 50)}>
      {children}
    </Animated.View>
  );
}
