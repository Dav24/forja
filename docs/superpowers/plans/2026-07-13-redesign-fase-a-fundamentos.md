# Rediseño Fase A: Fundamentos visuales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de temas (claro/oscuro/sistema) + navbar pill + transiciones + VulcanoAvatar v2 + CelebrationOverlay — la app queda themeable con navbar y motion nuevos, sin restyle de pantallas (eso es Fase B).

**Architecture:** Doble vía de theming: (1) los ~112 usos de clases Tailwind con color (`bg-surface`, `border-border`…) se vuelven temáticos re-mapeando `tailwind.config.js` a CSS variables y aplicando `vars()` de NativeWind en un View raíz que pinta el `ThemeProvider`; (2) los usos por `style` (44 archivos con `import { colors }`) migran a `useTheme()`. La navbar es un `tabBar` custom de expo-router; la visibilidad al scrollear viaja por un contexto con shared value de Reanimated.

**Tech Stack:** NativeWind v4 (`vars()`), Reanimated 4.3, expo-blur (se instala), react-native-svg 15, AsyncStorage, expo-router v4.

**Spec:** `docs/superpowers/specs/2026-07-13-redesign-fase-a-fundamentos-design.md` (tokens congelados en §2.1)

## Global Constraints

- Tokens EXACTOS de la tabla §2.1 de la spec (dark "La Fragua" / light "Fragua de día") — no inventar valores.
- Tema local al dispositivo: AsyncStorage key `forja.theme`, default `system`. SIN migración de DB.
- Regla worklets: NUNCA llamar `useTheme()` ni funciones JS dentro de `useAnimatedStyle` — capturar el color en una const fuera.
- Regla NativeWind del proyecto: fontFamily y colores dinámicos en `style`; las clases de color de Tailwind quedan permitidas porque ahora son temáticas por vars().
- Android sin blur (fondo `glass` semi-opaco); blur solo iOS.
- Claves i18n nuevas siempre en es Y en (`npm run check-i18n`).
- Deps nativas SIEMPRE con `npx expo install` (nunca npm install directo).
- Commits en español, convención `feat:`/`chore:`. Trabajar en `master`. Directorio: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Gate final de migración: `grep -rn "from '@/constants/colors'" app components hooks lib store` → 0 resultados.
- Los tests Deno existentes (16) no se tocan y deben seguir verdes.

---

### Task 1: Tokens, tailwind vars y ThemeProvider

**Files:**
- Create: `constants/themes.ts`
- Create: `lib/theme.tsx`
- Modify: `tailwind.config.js` (bloque colors)
- Modify: `app/_layout.tsx`
- Modify: `constants/colors.ts` (deprecar re-exportando el tema oscuro)
- Run: `npx expo install expo-blur` (dep para Task 5, se instala aquí para un solo lockfile churn)

**Interfaces:**
- Produces: `themes.dark`/`themes.light` (tipo `Theme`), `type ThemeName = 'light' | 'dark'`, `type ThemePref = ThemeName | 'system'`; hook `useTheme(): { colors: Theme; resolved: ThemeName; pref: ThemePref; setPref: (p: ThemePref) => void }`; `<ThemeProvider>` que además aplica `vars()` y pinta fondo/StatusBar/SystemUI.

- [ ] **Step 1: Instalar expo-blur**

Run: `npx expo install expo-blur`
Expected: agrega `expo-blur` a package.json sin errores de peer deps.

- [ ] **Step 2: Crear `constants/themes.ts`**

```ts
// Tokens del rediseño "Forja Atlética" — valores CONGELADOS del prototipo
// (docs/superpowers/prototypes/forja-atletica.html). Cambios de color se hacen
// AQUÍ (en el token), nunca en el componente.
export type ThemeName = 'light' | 'dark';
export type ThemePref = ThemeName | 'system';

const dark = {
  background: '#0C0A09',
  backgroundAlt: '#12100E',
  surface: '#1A1613',
  surfaceElevated: '#252019',
  border: 'rgba(250,247,242,0.09)',
  borderStrong: 'rgba(250,247,242,0.16)',
  text: '#FAF7F2',
  textMuted: '#A89E92',
  textFaint: '#6E655B',
  primary: '#FF6B1A',
  primaryDeep: '#F97316',
  primaryText: '#FF8A3D',
  primaryDim: '#7C2D12',
  onPrimary: '#140A04',
  accent: '#FBBF24',
  accentText: '#FBBF24',
  chip: 'rgba(250,247,242,0.06)',
  glass: 'rgba(18,15,13,0.72)',
  glassBorder: 'rgba(250,247,242,0.12)',
  ringTrack: 'rgba(250,247,242,0.08)',
  success: '#22C55E',
  warning: '#F59E0B',
  destructive: '#EF4444',
} as const;

const light: typeof dark = {
  background: '#EFEAE3',
  backgroundAlt: '#EAE4DB',
  surface: '#F7F3ED',
  surfaceElevated: '#FFFFFF',
  border: 'rgba(28,19,12,0.10)',
  borderStrong: 'rgba(28,19,12,0.18)',
  text: '#181310',
  textMuted: '#6E6459',
  textFaint: '#9A8F83',
  primary: '#EA580C',
  primaryDeep: '#C2410C',
  primaryText: '#C2410C',
  primaryDim: '#FFEDD5',
  onPrimary: '#FFF7F0',
  accent: '#D97706',
  accentText: '#92610A',
  chip: 'rgba(28,19,12,0.05)',
  glass: 'rgba(247,243,237,0.78)',
  glassBorder: 'rgba(28,19,12,0.10)',
  ringTrack: 'rgba(28,19,12,0.09)',
  success: '#15803D',
  warning: '#B45309',
  destructive: '#DC2626',
};

export type Theme = typeof dark;
export const themes: Record<ThemeName, Theme> = { dark, light };

export const gradientsByTheme: Record<ThemeName, { ember: readonly [string, string]; flame: readonly [string, string, string] }> = {
  dark: { ember: ['#FBBF24', '#FF6B1A'], flame: ['#EA580C', '#FF6B1A', '#FDE68A'] },
  light: { ember: ['#D97706', '#EA580C'], flame: ['#C2410C', '#EA580C', '#FBBF24'] },
};

export const fireShadowByTheme: Record<ThemeName, object> = {
  dark: { shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 22, elevation: 8 },
  light: { shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 20, elevation: 6 },
};
```

- [ ] **Step 3: Re-mapear `tailwind.config.js` a CSS variables**

Reemplazar el bloque `colors:` completo por:

```js
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        primary: "var(--color-primary)",
        "primary-bright": "var(--color-accent)",
        "primary-dim": "var(--color-primary-dim)",
        accent: "var(--color-accent)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
        destructive: "var(--color-destructive)",
        warning: "var(--color-warning)",
        success: "var(--color-success)",
      },
```

(Los nombres de clase existentes NO cambian — `bg-surface` etc. siguen funcionando, ahora temáticos. `primary-bright` mapea a accent porque en los tokens nuevos son el mismo ámbar.)

- [ ] **Step 4: Crear `lib/theme.tsx`**

```tsx
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
```

- [ ] **Step 5: Cablear en `app/_layout.tsx`**

1. Agregar import: `import { ThemeProvider } from '@/lib/theme';` y QUITAR `import { StatusBar } from 'expo-status-bar';` y `import { colors } from '@/constants/colors';`.
2. Eliminar la llamada module-level `SystemUI.setBackgroundColorAsync(colors.background);` y su comentario (el Provider lo hace ahora; conservar el import de `expo-system-ui` solo si otro código del archivo lo usa — si no, quitarlo).
3. En el return de `RootLayout`, quitar `<StatusBar style="light" />` y envolver:

```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 6: Deprecar `constants/colors.ts`**

Reemplazar el contenido COMPLETO del archivo por:

```ts
/** @deprecated Fase A del rediseño: usar `useTheme()` de '@/lib/theme'.
 * Este re-export estático (tema oscuro) existe solo para código no-reactivo
 * y se elimina al final de la migración. */
import { themes, gradientsByTheme, fireShadowByTheme } from '@/constants/themes';

export const colors = themes.dark;
export const gradients = gradientsByTheme.dark;
export const fireShadow = fireShadowByTheme.dark;
```

- [ ] **Step 7: Verificar tipos y arranque**

Run: `npx tsc --noEmit`
Expected: sin errores. (La app compila; los 44 archivos siguen usando el re-export deprecado — se migran en Tasks 3-4.)

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml constants/themes.ts lib/theme.tsx tailwind.config.js app/_layout.tsx constants/colors.ts
git commit -m "feat(fase-a): tokens por tema, ThemeProvider con vars() de NativeWind y tailwind temático"
```

---

### Task 2: Selector de Apariencia en Ajustes

**Files:**
- Modify: `app/(app)/settings/index.tsx`
- Modify: `locales/es/settings.json`, `locales/en/settings.json`

**Interfaces:**
- Consumes: `useTheme()` (Task 1: `{ pref, setPref }` con `ThemePref = 'light' | 'dark' | 'system'`).

- [ ] **Step 1: Claves i18n**

En `locales/es/settings.json`, dentro del objeto `hub` agregar:

```json
    "rowAppearance": "Apariencia",
```

y como clave top-level del archivo (junto a `hub`):

```json
  "appearance": {
    "light": "Claro",
    "system": "Sistema",
    "dark": "Oscuro"
  },
```

En `locales/en/settings.json`, mismas posiciones:

```json
    "rowAppearance": "Appearance",
```

```json
  "appearance": {
    "light": "Light",
    "system": "System",
    "dark": "Dark"
  },
```

- [ ] **Step 2: Verificar paridad**

Run: `npm run check-i18n`
Expected: `check-i18n: OK`

- [ ] **Step 3: Agregar el segmentado al hub**

En `app/(app)/settings/index.tsx`:

1. Imports nuevos: `import { useTheme } from '@/lib/theme';` y agregar `type ThemePref` → `import type { ThemePref } from '@/constants/themes';`
2. Dentro del componente: `const { colors, pref, setPref } = useTheme();` (y este archivo ya migra: QUITAR `import { colors } from '@/constants/colors';`).
3. Agregar este componente local ANTES de `export default`:

```tsx
function ThemeSegment() {
  const { t } = useTranslation('settings');
  const { colors, pref, setPref } = useTheme();
  const options: { key: ThemePref; label: string }[] = [
    { key: 'light', label: t('appearance.light') },
    { key: 'system', label: t('appearance.system') },
    { key: 'dark', label: t('appearance.dark') },
  ];
  return (
    <View
      className="flex-row"
      style={{ backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 }}
    >
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={() => setPref(o.key)}
          activeOpacity={0.7}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 9,
            alignItems: 'center',
            backgroundColor: pref === o.key ? colors.surfaceElevated : 'transparent',
          }}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12.5, color: pref === o.key ? colors.text : colors.textMuted }}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

4. En el grupo `hub.groupPreferences`, DESPUÉS de la fila de Idioma, agregar:

```tsx
          <View className="px-4 py-3.5 bg-surface">
            <Text className="mb-2.5" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.text }}>
              {t('hub.rowAppearance')}
            </Text>
            <ThemeSegment />
          </View>
```

- [ ] **Step 4: Verificar en vivo**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: limpios. Verificación manual mínima (si hay simulador/Expo corriendo): cambiar a Claro → fondo y textos de TODA la app cambian (las clases tailwind ya son temáticas por Task 1); persiste tras recargar.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/settings/index.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(fase-a): selector de apariencia claro/sistema/oscuro en ajustes"
```

---

### Task 3: Migración a useTheme — lote components/

**Files (Modify — los 20 de components/ que importan colors, EXCEPTO `components/chat/VulcanoAvatar.tsx` que la Task 7 reescribe):**
`components/chat/ChatBubble.tsx`, `components/chat/ChatInput.tsx`, `components/chat/MessageLimitBanner.tsx`, `components/chat/StreamingText.tsx`, `components/home/StreakFlame.tsx`, `components/plans/MacroBar.tsx`, `components/plans/MealPlanCard.tsx`, `components/plans/PlanGenerating.tsx`, `components/premium/PaywallBanner.tsx`, `components/premium/UpgradeSheet.tsx`, `components/progress/GoalProgress.tsx`, `components/progress/MeasurementForm.tsx`, `components/progress/WeightChart.tsx`, `components/settings/SettingsRow.tsx`, `components/ui/Badge.tsx`, `components/ui/Button.tsx`, `components/ui/Input.tsx`, `components/ui/ProgressBar.tsx`, `components/ui/Sheet.tsx`, `components/ui/StatCard.tsx`

**Interfaces:**
- Consumes: `useTheme()` de `@/lib/theme` (Task 1).

- [ ] **Step 1: Aplicar el patrón mecánico a cada archivo**

Para CADA archivo de la lista:
1. Reemplazar `import { colors } from '@/constants/colors';` por `import { useTheme } from '@/lib/theme';` (si además importa `gradients`/`fireShadow`, importar `gradientsByTheme`/`fireShadowByTheme` de `@/constants/themes` y derivar con `resolved`).
2. En el CUERPO de cada componente del archivo (primera línea): `const { colors } = useTheme();` (con gradients: `const { colors, resolved } = useTheme(); const gradients = gradientsByTheme[resolved];`).
3. Si el archivo tiene funciones/módulos NO-componente que usan colors (constantes module-level), convertirlas en funciones que reciben `colors: Theme` o moverlas dentro del componente.
4. No cambiar NINGÚN valor visual ni layout.

**Patrón OBLIGATORIO para los archivos con worklets** (`Button.tsx`, `ProgressBar.tsx`, `StreakFlame.tsx` — regla del proyecto, crashea en runtime si se viola):

```tsx
const { colors } = useTheme();
const glowColor = colors.primary; // capturar FUERA del worklet
const animatedStyle = useAnimatedStyle(() => ({
  shadowColor: glowColor, // dentro del worklet SOLO la variable capturada
}));
```

(`Skeleton.tsx` y `SparkBurst.tsx` tienen worklets pero NO importan colors — verificar que siga así y no tocarlos.)

- [ ] **Step 2: Gate del lote**

Run: `grep -rln "from '@/constants/colors'" components`
Expected: SOLO `components/chat/VulcanoAvatar.tsx` (se reescribe en Task 7).

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add components
git commit -m "feat(fase-a): componentes migrados a useTheme (colores reactivos al tema)"
```

---

### Task 4: Migración a useTheme — lote app/

**Files (Modify — los de app/ que importan colors, EXCEPTO `app/_layout.tsx` (hecho en T1), `app/(app)/settings/index.tsx` (hecho en T2) y `app/(app)/_layout.tsx` (la Task 5 lo reescribe)):**
`app/(app)/chat.tsx`, `app/(app)/index.tsx`, `app/(app)/plans/index.tsx`, `app/(app)/plans/_layout.tsx`, `app/(app)/plans/meal/index.tsx`, `app/(app)/plans/workout/[id].tsx`, `app/(app)/plans/workout/index.tsx`, `app/(app)/profile.tsx`, `app/(app)/progress.tsx`, `app/(app)/settings/account.tsx`, `app/(app)/settings/delete-account.tsx`, `app/(app)/settings/language.tsx`, `app/(app)/settings/notifications.tsx`, `app/(app)/settings/subscription.tsx`, `app/(app)/settings/training.tsx`, `app/(app)/success.tsx`, `app/(app)/upgrade.tsx`, `app/(auth)/forgot-password.tsx`, `app/(auth)/onboarding/step-3-body.tsx`, `app/(auth)/onboarding/step-4-level.tsx`

**Interfaces:**
- Consumes: `useTheme()` (Task 1).

- [ ] **Step 1: Aplicar el mismo patrón de la Task 3 a cada archivo**

Mismas 4 reglas mecánicas. Caso especial `app/(app)/plans/_layout.tsx` (usa colors en `screenOptions` de un componente — es componente, aplica el patrón normal):

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function PlansLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    />
  );
}
```

(Nota: este archivo ya queda ADEMÁS con `gestureEnabled: true` — es parte de transiciones, se aprovecha el toque.)

- [ ] **Step 2: Gate global de migración**

Run: `grep -rn "from '@/constants/colors'" app components hooks lib store`
Expected: SOLO 2 resultados: `app/(app)/_layout.tsx` (T5) y `components/chat/VulcanoAvatar.tsx` (T7).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(fase-a): pantallas migradas a useTheme"
```

---

### Task 5: Navbar pill (TabIcons + scrollNav + PillTabBar)

**Files:**
- Create: `components/nav/TabIcons.tsx`
- Create: `lib/scrollNav.tsx`
- Create: `components/nav/PillTabBar.tsx`
- Modify: `app/(app)/_layout.tsx` (reescritura del Tabs)
- Modify: `app/_layout.tsx` (montar `NavVisibilityProvider`)
- Modify: `app/(app)/index.tsx`, `app/(app)/plans/index.tsx`, `app/(app)/progress.tsx`, `app/(app)/profile.tsx` (conectar onScroll — chat NO: su FlatList es de mensajes y el input necesita la barra quieta)

**Interfaces:**
- Consumes: `useTheme()` (T1).
- Produces: `useHideNavOnScroll(): { onScroll: (e) => void; scrollEventThrottle: 16 }` y `useNavVisibility(): SharedValue<number>` (0 visible, 1 oculta) desde `lib/scrollNav.tsx`; `<PillTabBar {...props} />` compatible con la prop `tabBar` de Tabs.

- [ ] **Step 1: Crear `components/nav/TabIcons.tsx`** (duotono: capa base opacidad 0.35 + capa frontal; paths portados del prototipo)

```tsx
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'coach' | 'plans' | 'progress' | 'profile';

interface Props { name: TabIconName; color: string; size?: number }

export function TabIcon({ name, color, size = 21 }: Props) {
  const p = { width: size, height: size, viewBox: '0 0 19 19', fill: 'none' as const };
  switch (name) {
    case 'home':
      return (
        <Svg {...p}>
          <Path d="M3 8.2 9.5 3 16 8.2V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.2Z" fill={color} opacity={0.35} />
          <Path d="M9.5 1.6 1.8 7.8l1 1.2 6.7-5.4 6.7 5.4 1-1.2L9.5 1.6Z" fill={color} />
        </Svg>
      );
    case 'coach':
      return (
        <Svg {...p}>
          <Path d="M9.5 2.5c4 0 7 2.6 7 6s-3 6-7 6c-.8 0-1.6-.1-2.3-.3L3.5 16l.9-2.9c-1.2-1-1.9-2.5-1.9-4.6 0-3.4 3-6 7-6Z" fill={color} opacity={0.35} />
          <Path d="M9.7 5.4c.3 1.5 2 2.3 2.7 3.7a3.1 3.1 0 1 1-5.6.3c.5-1.4 1.2-1.7 1.4-2.8.6.4.9 1 1 1.7.5-.8.6-1.8.5-2.9Z" fill={color} />
        </Svg>
      );
    case 'plans':
      return (
        <Svg {...p}>
          <Rect x="5.4" y="4" width="8.2" height="11" rx="1.5" fill={color} opacity={0.35} />
          <Path d="M1.5 7.2h1.8v4.6H1.5V7.2Zm14.2 0h1.8v4.6h-1.8V7.2ZM4 5.6h1.9v7.8H4V5.6Zm9.1 0H15v7.8h-1.9V5.6ZM7 8.6h5v1.8H7V8.6Z" fill={color} />
        </Svg>
      );
    case 'progress':
      return (
        <Svg {...p}>
          <Path d="M2.5 12.5 7 8l3 3 6.5-6.5V16h-14v-3.5Z" fill={color} opacity={0.35} />
          <Path d="M2 11.6 6.9 6.7l3 3 5.6-5.6 1.1 1.1-6.7 6.7-3-3-3.8 3.8L2 11.6Z" fill={color} />
        </Svg>
      );
    case 'profile':
      return (
        <Svg {...p}>
          <Circle cx="9.5" cy="6.3" r="3.6" fill={color} opacity={0.35} />
          <Path d="M2.8 16.4c.7-3.1 3.5-4.9 6.7-4.9s6 1.8 6.7 4.9l-1.7.4c-.5-2.3-2.6-3.6-5-3.6s-4.5 1.3-5 3.6l-1.7-.4Z" fill={color} />
        </Svg>
      );
  }
}
```

- [ ] **Step 2: Crear `lib/scrollNav.tsx`**

```tsx
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
```

- [ ] **Step 3: Crear `components/nav/PillTabBar.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/lib/theme';
import { useNavVisibility } from '@/lib/scrollNav';
import { TabIcon, type TabIconName } from '@/components/nav/TabIcons';

const ICON_BY_ROUTE: Record<string, TabIconName> = {
  index: 'home',
  chat: 'coach',
  plans: 'plans',
  progress: 'progress',
  profile: 'profile',
};

export function PillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, resolved } = useTheme();
  const insets = useSafeAreaInsets();
  const hidden = useNavVisibility();
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Siempre visible al cambiar de tab
  useEffect(() => { hidden.value = 0; }, [state.index, hidden]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(hidden.value * 90, { damping: 18, stiffness: 180 }) }],
    opacity: withTiming(hidden.value ? 0 : 1, { duration: 200 }),
  }));

  if (keyboardUp) return null; // conserva el comportamiento tabBarHideOnKeyboard

  const visibleRoutes = state.routes.filter((r) => ICON_BY_ROUTE[r.name]);

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6, gap: 2 }}>
      {visibleRoutes.map((route) => {
        const focused = state.routes[state.index].key === route.key;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 10,
              paddingHorizontal: 13,
              borderRadius: 999,
              backgroundColor: focused ? colors.chip : 'transparent',
            }}
          >
            <TabIcon name={ICON_BY_ROUTE[route.name]} color={focused ? colors.primaryText : colors.textMuted} />
            {focused ? (
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 11.5, letterSpacing: 0.8, color: colors.primaryText }}>
                {label.toUpperCase()}
              </Text>
            ) : null}
            {focused ? (
              <View
                style={{
                  position: 'absolute', bottom: 4, alignSelf: 'center', left: '50%',
                  width: 4, height: 4, borderRadius: 99,
                  backgroundColor: colors.accent,
                  shadowColor: colors.primary, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          alignSelf: 'center',
          bottom: Math.max(insets.bottom, 12) + 10,
          borderRadius: 999,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.glassBorder,
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        },
        barStyle,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={40} tint={resolved === 'dark' ? 'dark' : 'light'} style={{ backgroundColor: colors.glass }}>
          {inner}
        </BlurView>
      ) : (
        // Android sin blur (decisión de spec): fondo glass semi-opaco
        <View style={{ backgroundColor: colors.glass }}>{inner}</View>
      )}
    </Animated.View>
  );
}
```

- [ ] **Step 4: Reescribir `app/(app)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSyncLanguage } from '@/hooks/useSyncLanguage';
import { PillTabBar } from '@/components/nav/PillTabBar';

export default function AppLayout() {
  const { t } = useTranslation('common');
  useSyncLanguage();

  return (
    <Tabs
      // Sin esto, back() desde un tab (p. ej. salir de Ajustes) cae al primer
      // tab (dashboard) en vez de regresar al tab desde el que se navegó (Perfil).
      backBehavior="history"
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="chat" options={{ title: t('tabs.coach') }} />
      <Tabs.Screen name="plans" options={{ title: t('tabs.plans') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      <Tabs.Screen name="upgrade" options={{ href: null }} />
      <Tabs.Screen name="success" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
```

(PillTabBar filtra por `ICON_BY_ROUTE`, así que upgrade/success/settings jamás aparecen en la pill.)

- [ ] **Step 5: Montar el provider en `app/_layout.tsx`**

Import: `import { NavVisibilityProvider } from '@/lib/scrollNav';` y envolver DENTRO de ThemeProvider:

```tsx
        <ThemeProvider>
          <NavVisibilityProvider>
            <AuthGuard />
            <Stack screenOptions={{ headerShown: false }} />
          </NavVisibilityProvider>
        </ThemeProvider>
```

- [ ] **Step 6: Conectar el scroll en las 4 pantallas**

En `app/(app)/index.tsx`, `app/(app)/plans/index.tsx`, `app/(app)/progress.tsx`, `app/(app)/profile.tsx`: agregar `import { useHideNavOnScroll } from '@/lib/scrollNav';`, dentro del componente `const navScroll = useHideNavOnScroll();` y en su ScrollView/FlatList raíz: `<ScrollView {...navScroll} ...>`. Además, en esas 4 pantallas, sumar espacio inferior para que el contenido no quede debajo de la pill: en el `contentContainerStyle` existente, subir el `paddingBottom` actual a `120` (si ya es ≥120, dejarlo).

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio. Manual (Expo Go): pill flotante con 5 tabs, activo con label+punto ámbar, se esconde al bajar y regresa al subir, desaparece con teclado, tabs ocultos no aparecen.

- [ ] **Step 8: Commit**

```bash
git add components/nav lib/scrollNav.tsx "app/(app)/_layout.tsx" app/_layout.tsx "app/(app)/index.tsx" "app/(app)/plans/index.tsx" "app/(app)/progress.tsx" "app/(app)/profile.tsx"
git commit -m "feat(fase-a): navbar pill flotante con hide-on-scroll y duotono"
```

---

### Task 6: Transiciones — stacks y StaggerIn

**Files:**
- Modify: `app/(app)/settings/_layout.tsx`
- Create: `components/ui/StaggerIn.tsx`
- Modify: `app/(app)/index.tsx`, `app/(app)/chat.tsx`, `app/(app)/plans/index.tsx`, `app/(app)/progress.tsx`, `app/(app)/profile.tsx` (envolver contenido raíz)

**Interfaces:**
- Produces: `<StaggerIn index={n}>` — anima FadeInUp con delay `index * 50ms` al enfocar la pantalla.

- [ ] **Step 1: Animación en settings stack**

`app/(app)/settings/_layout.tsx` — reemplazar el return por:

```tsx
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    />
  );
}
```

(El de plans ya quedó con animation+gesture en Task 4. `app/(auth)/onboarding/_layout.tsx` NO se toca — auth es fase 2.)

- [ ] **Step 2: Crear `components/ui/StaggerIn.tsx`**

```tsx
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
```

- [ ] **Step 3: Aplicar en las 5 pantallas de tabs**

En cada pantalla (`index`, `chat`, `plans/index`, `progress`, `profile`): import de StaggerIn y envolver los 2-4 bloques visuales de primer nivel de su ScrollView con `<StaggerIn index={0}>`, `<StaggerIn index={1}>`, etc. (header primero). En `plans/index.tsx` reemplaza al `Animated.View entering={FadeInUp}` existente (quitarlo para no duplicar animación). En `chat.tsx` SOLO el header (la lista de mensajes no se anima — regla del proyecto: el chat no tiene FadeInUp por el KAV).

- [ ] **Step 4: Verificar y commit**

Run: `npx tsc --noEmit`
Expected: limpio. Manual: cambiar tabs → el contenido entra escalonado; push a un plan → slide lateral con gesto de retorno.

```bash
git add components/ui/StaggerIn.tsx "app/(app)/settings/_layout.tsx" "app/(app)/index.tsx" "app/(app)/chat.tsx" "app/(app)/plans/index.tsx" "app/(app)/progress.tsx" "app/(app)/profile.tsx"
git commit -m "feat(fase-a): transiciones de stack con gesto y entrada escalonada de tabs"
```

---

### Task 7: CelebrationOverlay + VulcanoAvatar v2 + tipografía

**Files:**
- Create: `lib/celebration.tsx`
- Rewrite: `components/chat/VulcanoAvatar.tsx`
- Modify: `constants/typography.ts`
- Modify: `app/_layout.tsx` (montar CelebrationProvider)
- Modify: `app/(app)/settings/index.tsx` (trigger `__DEV__`)

**Interfaces:**
- Produces: `useCelebration(): { celebrate: (opts: { title: string; subtitle?: string; streak?: number }) => void }`; `<VulcanoAvatar size={number} state?: 'neutral' | 'forge' | 'celebrate' />` (state default `'neutral'` — los usos existentes no cambian).

- [ ] **Step 1: Crear `lib/celebration.tsx`**

```tsx
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

interface CelebrateOpts { title: string; subtitle?: string; streak?: number }
const CelebrationContext = createContext<{ celebrate: (o: CelebrateOpts) => void }>({ celebrate: () => {} });
export const useCelebration = () => useContext(CelebrationContext);

const SPARKS = 22;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<CelebrateOpts | null>(null);
  const celebrate = useCallback((o: CelebrateOpts) => setOpts(o), []);
  const value = useMemo(() => ({ celebrate }), [celebrate]);
  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {opts ? <CelebrationOverlay opts={opts} onClose={() => setOpts(null)} /> : null}
    </CelebrationContext.Provider>
  );
}

function CelebrationOverlay({ opts, onClose }: { opts: CelebrateOpts; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const reduced = useReducedMotion();
  // Chispas: dirección aleatoria generada al montar (fuera de todo worklet)
  const sparks = useMemo(
    () => Array.from({ length: reduced ? 0 : SPARKS }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      dist: 90 + Math.random() * 130,
      delay: 200 + Math.random() * 350,
      amber: i % 3 !== 0,
    })),
    [reduced],
  );
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(250)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background + 'F2',
      }}
    >
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(s.delay).duration(80)}
          style={{
            position: 'absolute',
            width: 5, height: 5, borderRadius: 99,
            backgroundColor: s.amber ? colors.accent : colors.primary,
            transform: [
              { translateX: Math.cos(s.angle) * s.dist },
              { translateY: Math.sin(s.angle) * s.dist },
            ],
          }}
        />
      ))}
      <Animated.Text
        entering={reduced ? undefined : ZoomIn.springify().damping(12).delay(120)}
        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 48, color: colors.text, letterSpacing: 1 }}
      >
        {opts.title}
      </Animated.Text>
      {opts.subtitle ? (
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.accentText, marginTop: 6 }}>
          {opts.subtitle}
        </Text>
      ) : null}
      {typeof opts.streak === 'number' ? (
        <Animated.View entering={reduced ? undefined : ZoomIn.delay(400)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 30, color: colors.text }}>{opts.streak}</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>{t('streakDays')}</Text>
        </Animated.View>
      ) : null}
      <Pressable
        onPress={onClose}
        style={{ marginTop: 26, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 28 }}
      >
        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>{t('continue')}</Text>
      </Pressable>
    </Animated.View>
  );
}
```

Claves i18n nuevas en `locales/es/common.json`: `"streakDays": "días de racha"`, `"continue": "Seguir"`; en `locales/en/common.json`: `"streakDays": "day streak"`, `"continue": "Continue"` (verificar que `continue` no exista ya — si existe, reutilizar la existente y no duplicar).

- [ ] **Step 2: Montar el provider** en `app/_layout.tsx`, dentro de NavVisibilityProvider:

```tsx
          <NavVisibilityProvider>
            <CelebrationProvider>
              <AuthGuard />
              <Stack screenOptions={{ headerShown: false }} />
            </CelebrationProvider>
          </NavVisibilityProvider>
```

- [ ] **Step 3: Trigger `__DEV__`** — en `app/(app)/settings/index.tsx`, dentro del último `SettingsGroup` (el de signOut), ANTES de la fila de signOut:

```tsx
          {__DEV__ ? (
            <SettingsRow
              icon="sparkles-outline"
              label="Probar celebración (dev)"
              onPress={() => celebrate({ title: 'SESIÓN FORJADA', subtitle: 'Pull — Espalda y Bíceps · 60 min', streak: 13 })}
            />
          ) : null}
```

con `import { useCelebration } from '@/lib/celebration';` y `const { celebrate } = useCelebration();` en el componente. (Sin i18n: es solo dev.)

- [ ] **Step 4: Reescribir `components/chat/VulcanoAvatar.tsx`** (personaje del prototipo, misma interfaz + state)

```tsx
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

interface Props {
  size: number;
  state?: 'neutral' | 'forge' | 'celebrate';
}

// Avatar-personaje de Vulcano (dirección congelada del prototipo v7).
// Las 4 ilustraciones IA finales lo sustituirán 1:1 (mismos usos y tamaños).
export function VulcanoAvatar({ size, state = 'neutral' }: Props) {
  const { colors } = useTheme();
  const glow = state === 'celebrate' ? 1 : state === 'forge' ? 0.8 : 0.55;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Circle cx={32} cy={32} r={30} fill={colors.chip} stroke={colors.borderStrong} />
        {/* yelmo */}
        <Path d="M18 26c0-9 6-14 14-14s14 5 14 14v3H18v-3Z" fill={colors.textFaint} opacity={0.9} />
        <Path d="M30 8l2-4 2 4c1.8.4 3 1 4 2l-6 1-6-1c1-1 2.2-1.6 4-2Z" fill={colors.primary} opacity={glow} />
        {/* rostro abstracto */}
        <Path d="M20 29h24v7c0 5-3 8-6 9H26c-3-1-6-4-6-9v-7Z" fill={colors.surfaceElevated} stroke={colors.borderStrong} />
        {/* ojos de brasa */}
        <Rect x={24.5} y={32} width={6} height={2.6} rx={1.3} fill={colors.primary} opacity={glow} />
        <Rect x={33.5} y={32} width={6} height={2.6} rx={1.3} fill={colors.primary} opacity={glow} />
        {/* barba en cuña */}
        <Path d="M22 40h20l-4 10c-2 3-4 4-6 4s-4-1-6-4l-4-10Z" fill={colors.textFaint} />
        <Path d="M29 44h6l-1.6 5c-.6 1.4-1.4 2-2.4 2s-1.8-.6-2.4-2L29 44Z" fill={colors.primary} opacity={glow * 0.7} />
        {state === 'celebrate' ? (
          <>
            <Path d="M14 34c-4-3-6-8-5-13" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
            <Path d="M50 34c4-3 6-8 5-13" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
```

- [ ] **Step 5: Actualizar `constants/typography.ts`** — reemplazar `sizes` por:

```ts
  sizes: {
    display: 40,
    screenTitle: 34,
    h1: 28,
    h2: 22,
    h3: 18,
    body: 16,
    bodySmall: 14,
    caption: 12,
    stat: 26,
  },
```

(display 48→40 y stat 28→26 según prototipo; `screenTitle: 34` nuevo. La aplicación por pantalla llega en Fase B; si `tsc` revela usos de los valores cambiados, NO ajustar los consumidores — solo debe compilar.)

- [ ] **Step 6: Verificar y commit**

Run: `npx tsc --noEmit && npm run check-i18n && grep -rn "from '@/constants/colors'" app components hooks lib store`
Expected: tsc y check-i18n limpios; grep → 0 resultados (VulcanoAvatar era el último).

```bash
git add lib/celebration.tsx components/chat/VulcanoAvatar.tsx constants/typography.ts app/_layout.tsx "app/(app)/settings/index.tsx" locales/es/common.json locales/en/common.json
git commit -m "feat(fase-a): celebración global, Vulcano personaje v2 y escala tipográfica nueva"
```

---

### Task 8: Verificación final + docs

**Files:**
- Modify: `forja-docs.md` (sección nueva al final)

- [ ] **Step 1: Verificación estática completa**

Run: `npx tsc --noEmit && npm run check-i18n && (cd supabase/functions && deno test translate-plan/logic.test.ts delete-account/logic.test.ts) && grep -rn "from '@/constants/colors'" app components hooks lib store; echo "grep-exit:$?"`
Expected: tsc limpio, check-i18n OK, 16/16 tests, grep sin resultados (`grep-exit:1`).

- [ ] **Step 2: Documentar en `forja-docs.md`** — agregar al final:

```markdown
## Sistema de temas y fundamentos visuales (Rediseño Fase A)

Temas claro/oscuro/sistema: tokens en `constants/themes.ts` (valores congelados del
prototipo `docs/superpowers/prototypes/forja-atletica.html`), `ThemeProvider` en
`lib/theme.tsx` (AsyncStorage `forja.theme`, default system, local al dispositivo,
pinta SystemUI/StatusBar y aplica `vars()` de NativeWind — las clases tailwind de
color son temáticas). En componentes: `const { colors } = useTheme()`; NUNCA importar
`@/constants/colors` (deprecado) ni llamar useTheme dentro de un worklet (capturar el
color en una const fuera). Navbar: `components/nav/PillTabBar.tsx` (blur iOS, tintado
Android) + `lib/scrollNav.tsx` (hide-on-scroll; las pantallas conectan
`useHideNavOnScroll()` a su scroll). Transiciones: stacks con slide_from_right+gesto,
tabs con `StaggerIn`. Celebraciones: `useCelebration().celebrate({...})`
(`lib/celebration.tsx`); trigger de prueba en Ajustes solo `__DEV__`. Selector de tema
en Ajustes. Spec: `docs/superpowers/specs/2026-07-13-redesign-fase-a-fundamentos-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add forja-docs.md
git commit -m "docs: fundamentos visuales de la Fase A en forja-docs"
```

- [ ] **Step 4: E2E humano en Expo Go (checklist spec §6 — lo ejecuta el usuario)**

1. Ajustes → Apariencia: Claro/Oscuro/Sistema cambian TODA la app en vivo; persiste tras cerrar y reabrir.
2. Modo Sistema: cambiar el tema del teléfono → la app reacciona sola.
3. Navbar pill: activo con glow+label, se esconde al bajar y regresa al subir, desaparece con teclado, nunca tapa contenido (paddings).
4. Push a detalle de plan → slide lateral; retorno con gesto desde el borde.
5. Cambiar de tab → contenido entra escalonado.
6. Ajustes → "Probar celebración (dev)" → overlay con chispas y racha; cerrar con "Seguir".
7. Pasada rápida en tema claro por las 5 tabs: todo legible, sin blancos rotos (QA fino es Fase B).

No commitear nada aquí; fallos se abren como fixes puntuales.
