import { createContext, ReactNode, useContext, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

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
