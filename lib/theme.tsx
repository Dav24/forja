import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vars } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { themes, type Theme, type ThemeName, type ThemePref } from '@/constants/themes';

export const THEME_STORAGE_KEY = 'forja.theme';

interface ThemeContextValue {
  colors: Theme;
  resolved: ThemeName;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: themes.dark,
  resolved: 'dark',
  pref: 'system',
  setPref: () => {},
});

function resolve(pref: ThemePref, system: ThemeName): ThemeName {
  return pref === 'system' ? system : pref;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [system, setSystem] = useState<ThemeName>(Appearance.getColorScheme() === 'light' ? 'light' : 'dark');

  // Rehidratar preferencia persistida (patrón de lib/i18n.ts: no bloquea el primer render)
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') setPrefState(stored);
      })
      .catch(() => {});
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(THEME_STORAGE_KEY, p).catch(() => {});
  }, []);

  const resolved = resolve(pref, system);
  const colors = themes[resolved];

  // Fondo de la ventana nativa sigue al tema (mata el flash del teclado en ambos temas)
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  const themeVars = useMemo(() => vars({
    '--color-background': colors.background,
    '--color-surface': colors.surface,
    '--color-surface-elevated': colors.surfaceElevated,
    '--color-primary': colors.primary,
    '--color-primary-dim': colors.primaryDim,
    '--color-accent': colors.accent,
    '--color-text': colors.text,
    '--color-text-muted': colors.textMuted,
    '--color-border': colors.border,
    '--color-destructive': colors.destructive,
    '--color-warning': colors.warning,
    '--color-success': colors.success,
  }), [resolved]);

  const value = useMemo(() => ({ colors, resolved, pref, setPref }), [resolved, pref, setPref]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <View style={[{ flex: 1, backgroundColor: colors.background }, themeVars]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
