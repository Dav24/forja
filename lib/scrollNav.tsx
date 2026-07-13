import { createContext, ReactNode, useCallback, useContext, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 0 = navbar visible, 1 = oculta. La escribe el scroll de las pantallas,
// la lee PillTabBar para animarse.
const NavVisibilityContext = createContext<SharedValue<number> | null>(null);

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  return <NavVisibilityContext.Provider value={hidden}>{children}</NavVisibilityContext.Provider>;
}

export function useNavVisibility(): SharedValue<number> {
  const v = useContext(NavVisibilityContext);
  if (!v) throw new Error('useNavVisibility requiere NavVisibilityProvider');
  return v;
}

// Espacio libre que debe dejar cualquier contenido/FAB por encima de la pill:
// su offset inferior + su altura aprox. + un poco de aire.
export function useNavClearance(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 10 + 58 + 10;
}

// Oculta la pill mientras la pantalla que la llama está enfocada (pantallas
// empujadas tipo detalle: el prototipo congelado no muestra navbar ahí).
export function useHideNavWhileFocused() {
  const hidden = useNavVisibility();
  useFocusEffect(useCallback(() => {
    hidden.value = 1;
    return () => { hidden.value = 0; };
  }, [hidden]));
}

const THRESHOLD = 6;
const MIN_Y = 40;

export function useHideNavOnScroll() {
  const hidden = useNavVisibility();
  const lastY = useRef(0);
  return useMemo(() => ({
    scrollEventThrottle: 16 as const,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (y > lastY.current + THRESHOLD && y > MIN_Y) hidden.value = 1;
      else if (y < lastY.current - THRESHOLD) hidden.value = 0;
      lastY.current = y;
    },
  }), [hidden]);
}
