# Forja Brand Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el rediseño de marca del spec `docs/superpowers/specs/2026-07-03-forja-brand-redesign-design.md`: paleta brasa, wordmark FORJA, coach Vulcano, tipografía display Bebas Neue, componentes con motion y rediseño de las 11 pantallas.

**Architecture:** Token-first — la Fase 1 cambia los design tokens (colors.ts / tailwind.config.js) y re-skinea automáticamente todo lo que los consume. Las fases siguientes construyen los componentes de marca nuevos (Ember, StreakFlame, StatCard, SparkBurst) y luego los inyectan pantalla por pantalla. El backend solo se toca en la última fase (system prompt del chat).

**Tech Stack:** React Native + Expo SDK 56 (Expo Go), NativeWind v4, Reanimated 4.3.1, react-native-svg 15.15.4, expo-linear-gradient (nuevo), @expo-google-fonts/bebas-neue (nuevo), TypeScript strict.

## Global Constraints

- **Deps nativas SIEMPRE con `npx expo install <pkg>`** — nunca `pnpm add` directo (incidente de versiones con Expo Go, 2026-07-02)
- **NativeWind v4:** estáticos en `className`; valores dinámicos, colores del design system y `fontFamily` SIEMPRE en `style`
- **Sin test infra en el proyecto** — el gate por task es: `npx tsc --noEmit` limpio + verificación visual en Expo Go (`pnpm start`)
- **Máx 300 líneas por componente** — extraer sub-componentes si crece
- **Compatible con Expo Go** — solo módulos del catálogo Expo SDK 56
- **Strings en es-MX hardcodeados** (i18n es Paso 14) — escribirlos fáciles de extraer
- **El verde `#22C55E` solo puede aparecer como `success`** — nunca como acento general
- **Gradiente ember solo en 1-2 elementos por pantalla** (CTA principal, llama) — el fuego se dosifica
- **Commit al final de cada task** con mensaje convencional (`feat:`, `refactor:`)
- Git remotes: push manual del usuario (`git push github master && git push gitlab master`) — los tasks solo commitean local

---

## Fase 1 — Fundación: tokens y fuentes

### Task 1: Instalar dependencias nuevas

**Files:**
- Modify: `package.json` (vía CLI, no editar a mano)

**Interfaces:**
- Produces: módulos `expo-linear-gradient` y `@expo-google-fonts/bebas-neue` disponibles para import

- [ ] **Step 1: Instalar con expo install**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
npx expo install expo-linear-gradient @expo-google-fonts/bebas-neue
```

- [ ] **Step 2: Verificar versiones compatibles**

Run: `npx expo install --check`
Expected: `Dependencies are up to date`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat: add expo-linear-gradient and bebas neue font deps"
```

### Task 2: Nuevos design tokens (paleta brasa)

**Files:**
- Modify: `constants/colors.ts` (reemplazo completo)
- Modify: `tailwind.config.js` (bloque colors)
- Modify: `constants/typography.ts` (agregar display font)

**Interfaces:**
- Produces: `colors` (mismos keys + `primaryBright`), `gradients.ember: readonly ['#FBBF24','#F97316']`, `gradients.flame: readonly ['#EA580C','#F97316','#FDE68A']`, `fireShadow` (ViewStyle), clase Tailwind `primary-bright`, `typography.fonts.display === 'BebasNeue'`
- Consumes: nada

- [ ] **Step 1: Reemplazar `constants/colors.ts` completo**

```typescript
export const colors = {
  background: '#0C0A09',
  surface: '#1C1917',
  surfaceElevated: '#292524',
  primary: '#F97316',
  primaryBright: '#FBBF24',
  primaryDim: '#7C2D12',
  accent: '#FBBF24',
  text: '#FAFAF9',
  textMuted: '#A8A29E',
  border: '#292524',
  destructive: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
} as const;

// Gradientes de marca — usar con expo-linear-gradient
export const gradients = {
  ember: ['#FBBF24', '#F97316'] as const,
  flame: ['#EA580C', '#F97316', '#FDE68A'] as const,
} as const;

// Sombra de fuego para CTAs primarios (dosificar: 1-2 por pantalla)
export const fireShadow = {
  shadowColor: '#F97316',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 22,
  elevation: 8,
} as const;
```

- [ ] **Step 2: Actualizar el bloque `colors` de `tailwind.config.js`**

```javascript
      colors: {
        background: "#0C0A09",
        surface: "#1C1917",
        "surface-elevated": "#292524",
        primary: "#F97316",
        "primary-bright": "#FBBF24",
        "primary-dim": "#7C2D12",
        accent: "#FBBF24",
        text: "#FAFAF9",
        "text-muted": "#A8A29E",
        border: "#292524",
        destructive: "#EF4444",
        warning: "#F59E0B",
        success: "#22C55E",
      },
```

- [ ] **Step 3: Agregar display a `constants/typography.ts`**

En `fonts`, agregar la key `display`:

```typescript
  fonts: {
    display: 'BebasNeue',
    heading: 'SpaceGrotesk',
    body: 'Inter',
    mono: 'JetBrainsMono',
  },
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `pnpm start` y abrir en Expo Go — toda la app debe verse cálida (carbón/naranja) en vez de fría (azul/verde). Los hardcodes viejos que queden (`#166534`, `#22C55E` fuera de success) se corrigen en sus tasks de pantalla.

- [ ] **Step 5: Commit**

```bash
git add constants/colors.ts tailwind.config.js constants/typography.ts
git commit -m "feat: ember palette design tokens (brasa over carbon)"
```

### Task 3: Cargar Bebas Neue

**Files:**
- Modify: `app/_layout.tsx` (bloque useFonts, ~línea 112)

**Interfaces:**
- Produces: fontFamily `'BebasNeue-Regular'` disponible globalmente

- [ ] **Step 1: Agregar import y font**

Import junto a las otras fuentes:

```typescript
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
```

Dentro del objeto de `useFonts`, agregar:

```typescript
    'BebasNeue-Regular': BebasNeue_400Regular,
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` — limpio. En Expo Go la app carga sin error de fuentes.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: load Bebas Neue display font"
```

---

## Fase 2 — Marca: Ember, Wordmark, assets

### Task 4: Componentes de marca `Ember` y `ForjaWordmark`

**Files:**
- Create: `components/brand/Ember.tsx`
- Create: `components/brand/ForjaWordmark.tsx`

**Interfaces:**
- Produces: `<Ember size={number} glow?: boolean />` y `<ForjaWordmark size?: 'sm' | 'lg' />` (sm=header 15px, lg=login/splash 44px)
- Consumes: `react-native-svg`, tokens de Task 2

- [ ] **Step 1: Crear `components/brand/Ember.tsx`**

```tsx
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface EmberProps {
  size: number;
  glow?: boolean;
}

// La brasa de la marca: la "O" de FORJA
export function Ember({ size, glow = false }: EmberProps) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <RadialGradient id="emberCoal" cx="0.5" cy="0.55" r="0.6">
          <Stop offset="0" stopColor="#FDE68A" />
          <Stop offset="0.55" stopColor="#F97316" />
          <Stop offset="1" stopColor="#EA580C" />
        </RadialGradient>
        <RadialGradient id="emberHalo" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0.6" stopColor="#F97316" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#F97316" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {glow && <Circle cx="22" cy="22" r="22" fill="url(#emberHalo)" />}
      <Circle cx="22" cy="22" r="16" fill="url(#emberCoal)" />
      <Circle cx="22" cy="22" r="7" fill="#0C0A09" />
    </Svg>
  );
}
```

- [ ] **Step 2: Crear `components/brand/ForjaWordmark.tsx`**

```tsx
import { Text, View } from 'react-native';
import { Ember } from './Ember';

interface ForjaWordmarkProps {
  size?: 'sm' | 'lg';
}

const SIZES = {
  sm: { font: 15, ember: 14, spacing: 1 },
  lg: { font: 44, ember: 40, spacing: 2.5 },
} as const;

export function ForjaWordmark({ size = 'sm' }: ForjaWordmarkProps) {
  const s = SIZES[size];
  return (
    <View className="flex-row items-center">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: '#FAFAF9' }}>F</Text>
      <View style={{ marginHorizontal: s.font * 0.06 }}>
        <Ember size={s.ember} glow={size === 'lg'} />
      </View>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: '#FAFAF9' }}>RJA</Text>
    </View>
  );
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` limpio.

- [ ] **Step 4: Commit**

```bash
git add components/brand/
git commit -m "feat: Ember and ForjaWordmark brand components"
```

### Task 5: Assets de app (ícono, splash) y app.json

**Files:**
- Create: `scripts/generate-brand-assets.mjs`
- Modify: `assets/icon.png`, `assets/splash-icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png` (regenerados)
- Modify: `app.json` (backgroundColor del splash/adaptive icon → `#0C0A09`)

**Interfaces:**
- Consumes: SVG de la brasa (mismo diseño que `Ember.tssx` — duplicado como string SVG en el script, aceptable porque el script es tooling one-shot)
- Produces: PNGs de marca en `assets/`

- [ ] **Step 1: Instalar sharp como dev dependency**

```bash
pnpm add -D sharp
```

(sharp es tooling de Node para el script, no módulo nativo de RN — no necesita `expo install`.)

- [ ] **Step 2: Crear `scripts/generate-brand-assets.mjs`**

```javascript
// Genera los assets de marca (ícono, splash, adaptive) desde SVG con sharp.
// Uso: node scripts/generate-brand-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const CARBON = '#0C0A09';

const emberSvg = (s, { halo = true, bg = null } = {}) => `
<svg width="${s}" height="${s}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="coal" cx="50%" cy="55%" r="60%">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="55%" stop-color="#F97316"/>
      <stop offset="100%" stop-color="#EA580C"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="60%" stop-color="#F97316" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${bg ? `<rect width="44" height="44" fill="${bg}"/>` : ''}
  ${halo ? '<circle cx="22" cy="22" r="21" fill="url(#halo)"/>' : ''}
  <circle cx="22" cy="22" r="13" fill="url(#coal)"/>
  <circle cx="22" cy="22" r="5.5" fill="${CARBON}"/>
</svg>`;

const monoSvg = (s) => `
<svg width="${s}" height="${s}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
  <circle cx="22" cy="22" r="13" fill="#FFFFFF"/>
  <circle cx="22" cy="22" r="5.5" fill="#000000"/>
</svg>`;

const solidSvg = (color) => `<svg width="108" height="108" xmlns="http://www.w3.org/2000/svg"><rect width="108" height="108" fill="${color}"/></svg>`;

mkdirSync('assets', { recursive: true });
const render = (svg, size, out) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(out).then(() => console.log('✓', out));

await render(emberSvg(1024, { bg: CARBON }), 1024, 'assets/icon.png');
await render(emberSvg(1024, { bg: null }), 1024, 'assets/splash-icon.png');
await render(emberSvg(1024, { halo: false }), 1024, 'assets/android-icon-foreground.png');
await render(solidSvg(CARBON), 1024, 'assets/android-icon-background.png');
await render(monoSvg(1024), 1024, 'assets/android-icon-monochrome.png');
```

- [ ] **Step 3: Ejecutar y verificar**

Run: `node scripts/generate-brand-assets.mjs`
Expected: 5 líneas `✓ assets/...`. Abrir los PNG para confirmar que la brasa se ve correcta.

- [ ] **Step 4: Actualizar `app.json`**

En `expo.android.adaptiveIcon.backgroundColor` y en el plugin `expo-splash-screen` (si tiene config de `backgroundColor`), usar `#0C0A09`. Si `expo.icon` o `expo.splash` referencian otros archivos, apuntarlos a `assets/icon.png` / `assets/splash-icon.png` con `backgroundColor: "#0C0A09"`.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-brand-assets.mjs assets/ app.json package.json pnpm-lock.yaml
git commit -m "feat: ember brand assets (icon, splash, adaptive)"
```

### Task 6: Login y Register con wordmark

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/register.tsx`

**Interfaces:**
- Consumes: `<ForjaWordmark size="lg" />` (Task 4)

- [ ] **Step 1: Reemplazar el título/logo actual de ambas pantallas**

Leer cada archivo; donde hoy está el título de la app (Text "Forja" o similar en el header del form), colocar:

```tsx
<View className="items-center mb-2">
  <ForjaWordmark size="lg" />
</View>
```

con `import { ForjaWordmark } from '@/components/brand/ForjaWordmark';`. El subtítulo bajo el wordmark (si existe) cambia a: `Fórjate. Un día a la vez.` en Inter, `text-text-muted`.

**Encendido de la brasa (spec §6.4):** envolver el wordmark en un `Animated.View` con entrada:

```tsx
import Animated, { FadeIn } from 'react-native-reanimated';

<Animated.View entering={FadeIn.duration(700)} className="items-center mb-2">
  <ForjaWordmark size="lg" />
</Animated.View>
```

(el glow del Ember `lg` + el fade-in dan el efecto de encendido sin código extra).

- [ ] **Step 2: Sanear colores hardcodeados**

Buscar en ambos archivos hex viejos (`#0A0A0F`, `#22C55E`, `#64748B`, `#1E293B`, `#13131C`) y reemplazarlos por el token equivalente de `colors` (import de `@/constants/colors`). Los `className` con tokens (bg-background, text-text...) ya migran solos.

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` + visual: login muestra el wordmark con la brasa.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login.tsx" "app/(auth)/register.tsx"
git commit -m "feat: login/register with FORJA wordmark"
```

---

## Fase 3 — Componentes con vida

### Task 7: Button con gradiente ember y física de spring

**Files:**
- Modify: `components/ui/Button.tsx` (reemplazo completo)

**Interfaces:**
- Produces: misma API pública (`variant`, `size`, `loading`, `label`, extends PressableProps) — los consumidores no cambian
- Consumes: `gradients.ember`, `fireShadow`, `colors` (Task 2); `expo-linear-gradient` (Task 1)

- [ ] **Step 1: Reemplazar `components/ui/Button.tsx` completo**

```tsx
import { ActivityIndicator, Pressable, PressableProps, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fireShadow, gradients } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const sizeStyles: Record<Size, { container: string; text: string; radius: number }> = {
  sm: { container: 'h-10 px-4 rounded-xl', text: 'text-sm', radius: 12 },
  md: { container: 'h-14 px-5 rounded-xl', text: 'text-base', radius: 12 },
  lg: { container: 'h-16 px-6 rounded-2xl', text: 'text-lg', radius: 16 },
};

const flatVariants: Record<Exclude<Variant, 'primary'>, { container: string; text: string; indicator: string }> = {
  secondary: { container: 'bg-surface border border-primary', text: 'text-primary', indicator: colors.primary },
  ghost: { container: 'bg-transparent', text: 'text-text-muted', indicator: colors.text },
  destructive: { container: 'bg-destructive', text: 'text-white', indicator: '#ffffff' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 400 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); };

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        disabled={isDisabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className={className}
        style={[pressStyle, isDisabled ? { opacity: 0.5 } : fireShadow]}
        {...props}
      >
        <LinearGradient
          colors={gradients.ember}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: s.radius }}
        >
          <View className={`${s.container} items-center justify-center flex-row gap-2`}>
            {loading
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Text className={`${s.text} font-bold`} style={{ color: colors.background }}>{label}</Text>
            }
          </View>
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  const v = flatVariants[variant];
  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      className={`${v.container} ${s.container} items-center justify-center flex-row gap-2 ${isDisabled ? 'opacity-50' : ''} ${className}`}
      style={pressStyle}
      {...props}
    >
      {loading
        ? <ActivityIndicator color={v.indicator} size="small" />
        : <Text className={`${v.text} ${s.text} font-bold`}>{label}</Text>
      }
    </AnimatedPressable>
  );
}
```

Nota: el cambio de `TouchableOpacityProps` → `PressableProps` es compatible con los usos existentes (`onPress`, `disabled`); si `tsc` marca algún uso con prop exclusiva de TouchableOpacity (p. ej. `activeOpacity`), eliminar esa prop en el call site.

- [ ] **Step 2: Verificar** — `npx tsc --noEmit`; en Expo Go los botones primarios tienen gradiente + se encogen al presionar.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx
git commit -m "feat: ember gradient button with spring press physics"
```

### Task 8: Badge premium + retoken

**Files:**
- Modify: `components/ui/Badge.tsx`

**Interfaces:**
- Produces: nueva variante `premium` (gradiente + ⚒). API existente intacta.

- [ ] **Step 1: Actualizar variantes**

Agregar `'premium'` al union `BadgeVariant`. Reemplazar los hex hardcodeados fríos de los estilos: `accent` pasa a `{ container: 'bg-[#451a03] border border-accent', text: 'text-accent' }`. Agregar al render un branch para premium:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '@/constants/colors';

// dentro de Badge, antes del return normal:
if (variant === 'premium') {
  return (
    <LinearGradient
      colors={gradients.ember}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 9999, alignSelf: 'flex-start' }}
    >
      <View className={`rounded-full px-3 py-1 flex-row items-center gap-1 ${className}`}>
        <Text className="text-xs font-bold" style={{ color: '#0C0A09' }}>⚒ {label}</Text>
      </View>
    </LinearGradient>
  );
}
```

- [ ] **Step 2: Verificar + Commit**

`npx tsc --noEmit` limpio.

```bash
git add components/ui/Badge.tsx
git commit -m "feat: premium badge variant with ember gradient and hammer"
```

### Task 9: ProgressBar de metal caliente + Skeleton shimmer

**Files:**
- Modify: `components/ui/ProgressBar.tsx`
- Modify: `components/ui/Skeleton.tsx`

**Interfaces:**
- Produces: mismas APIs. ProgressBar ignora su prop `color` default vieja: default pasa a gradiente ember.

- [ ] **Step 1: ProgressBar — reemplazar el fill por gradiente con glow**

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { gradients } from '@/constants/colors';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(value, 0), 100), { duration: 600 });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View className={`h-2.5 bg-surface-elevated rounded-full overflow-hidden ${className}`}>
      <Animated.View
        style={[
          { height: '100%', borderRadius: 9999, shadowColor: '#FBBF24', shadowOpacity: 0.5, shadowRadius: 12, elevation: 4 },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[gradients.ember[1], gradients.ember[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 9999 }}
        />
      </Animated.View>
    </View>
  );
}
```

Si `tsc` marca call sites pasando `color`, eliminar esa prop en el call site (el gradiente es el nuevo default único).

- [ ] **Step 2: Skeleton — shimmer cálido**

En `components/ui/Skeleton.tsx`, cambiar la animación de opacidad plana por interpolación de color cálido:

```tsx
import { useEffect } from 'react';
import { ViewProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className = '', style, ...props }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#1C1917', '#292524']),
  }));

  return (
    <Animated.View
      style={[animatedStyle, style]}
      className={`rounded-xl ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Verificar + Commit**

```bash
git add components/ui/ProgressBar.tsx components/ui/Skeleton.tsx
git commit -m "feat: heating-metal progress bar and warm shimmer skeleton"
```

### Task 10: StatCard + CountUpText

**Files:**
- Create: `components/ui/CountUpText.tsx`
- Create: `components/ui/StatCard.tsx`

**Interfaces:**
- Produces: `<CountUpText value={number} decimals?: number, style?: TextStyle />` (anima de 0 al valor al montar, 700ms — spec §6.2) y `<StatCard value={string | number} label={string} suffix?: string />` — número mono ámbar + label tracking amplio. StatCard usa CountUpText cuando `value` es number; si es string ('—') lo muestra estático.

- [ ] **Step 1: Crear `components/ui/CountUpText.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import Animated, { Easing, runOnJS, useSharedValue, withTiming, useAnimatedReaction } from 'react-native-reanimated';

interface CountUpTextProps {
  value: number;
  decimals?: number;
  style?: TextStyle;
}

// Números que cuentan hacia arriba al aparecer (spec §6.2)
export function CountUpText({ value, decimals = 0, style }: CountUpTextProps) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value]);

  useAnimatedReaction(
    () => progress.value * value,
    (current) => runOnJS(setDisplay)(current.toFixed(decimals)),
  );

  return <Text style={style}>{display}</Text>;
}
```

- [ ] **Step 2: Crear `components/ui/StatCard.tsx`**

```tsx
import { Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { CountUpText } from './CountUpText';

interface StatCardProps {
  value: string | number;
  label: string;
  suffix?: string;
  decimals?: number;
}

export function StatCard({ value, label, suffix, decimals = 0 }: StatCardProps) {
  const numberStyle = { fontFamily: 'JetBrainsMono-Medium', fontSize: 22, color: colors.primaryBright } as const;
  return (
    <View className="flex-1 bg-surface border border-border rounded-2xl px-3 py-3 items-center">
      <View className="flex-row items-baseline">
        {typeof value === 'number'
          ? <CountUpText value={value} decimals={decimals} style={numberStyle} />
          : <Text style={numberStyle}>{value}</Text>
        }
        {suffix ? <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.textMuted }}>{suffix}</Text> : null}
      </View>
      <Text
        className="mt-1"
        style={{ fontFamily: 'Inter-Medium', fontSize: 9, letterSpacing: 1.2, color: colors.textMuted }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
```

- [ ] **Step 3: Verificar + Commit**

```bash
git add components/ui/StatCard.tsx components/ui/CountUpText.tsx
git commit -m "feat: StatCard with count-up amber metrics"
```

### Task 11: StreakFlame

**Files:**
- Create: `components/home/StreakFlame.tsx`

**Interfaces:**
- Produces: `<StreakFlame streak={number} compact?: boolean />` — compact = pill de header (Home); no-compact = card
- Consumes: `react-native-svg`, Reanimated

- [ ] **Step 1: Crear el componente**

```tsx
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors } from '@/constants/colors';

interface StreakFlameProps {
  streak: number;
  compact?: boolean;
}

// Tamaño de llama por racha (spec §5): 1-6 / 7-29 / 30+
function flameScale(streak: number): number {
  if (streak >= 30) return 1.25;
  if (streak >= 7) return 1.1;
  return 1;
}

function Flame({ size, dead }: { size: number; dead: boolean }) {
  return (
    <Svg width={size} height={size * 1.18} viewBox="0 0 34 40">
      <Defs>
        <SvgGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#EA580C" />
          <Stop offset="0.6" stopColor="#F97316" />
          <Stop offset="1" stopColor="#FDE68A" />
        </SvgGradient>
      </Defs>
      <Path
        d="M17 2 Q24 12 27 20 Q30 28 25 33 Q21 38 17 38 Q13 38 9 33 Q4 28 7 20 Q10 12 17 2 Z"
        fill={dead ? '#57534E' : 'url(#flameGrad)'}
      />
      {!dead && (
        <Path d="M17 16 Q20 21 21 25 Q22 30 17 33 Q12 30 13 25 Q14 21 17 16 Z" fill="#FDE68A" />
      )}
    </Svg>
  );
}

export function StreakFlame({ streak, compact = false }: StreakFlameProps) {
  const dead = streak === 0;
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (dead) return;
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700 }),
        withTiming(0.97, { duration: 500 }),
        withTiming(1.03, { duration: 600 }),
      ),
      -1,
      true,
    );
  }, [dead]);

  const flickerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flicker.value * flameScale(streak) }],
  }));

  if (compact) {
    return (
      <View className="flex-row items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
        <Animated.View style={flickerStyle}>
          <Flame size={14} dead={dead} />
        </Animated.View>
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 14, color: dead ? colors.textMuted : colors.primaryBright }}>
          {streak}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface border border-border rounded-2xl px-4 py-3 items-center gap-0.5">
      <Animated.View style={flickerStyle}>
        <Flame size={28} dead={dead} />
      </Animated.View>
      <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 20, color: dead ? colors.textMuted : colors.primaryBright }}>
        {streak}
      </Text>
      <Text className="text-text-muted text-xs">{dead ? 'reaviva tu racha' : 'días'}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verificar + Commit**

```bash
git add components/home/StreakFlame.tsx
git commit -m "feat: animated streak flame with size tiers and dead-ember state"
```

### Task 12: SparkBurst (celebraciones)

**Files:**
- Create: `components/effects/SparkBurst.tsx`

**Interfaces:**
- Produces: `<SparkBurst trigger={boolean} onDone?: () => void />` — al pasar trigger a true dispara 14 chispas y llama onDone al terminar (~900ms). Overlay absoluto centrado, no captura toques.

- [ ] **Step 1: Crear el componente**

```tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const SPARK_COUNT = 14;
const COLORS = ['#FDE68A', '#FBBF24', '#F97316', '#EA580C'];
const DURATION = 900;

interface SparkBurstProps {
  trigger: boolean;
  onDone?: () => void;
}

function Spark({ index, progress }: { index: number; progress: Animated.SharedValue<number> }) {
  const angle = (index / SPARK_COUNT) * Math.PI * 2 + (index % 3) * 0.2;
  const distance = 70 + (index % 4) * 22;
  const size = 4 + (index % 3) * 2;
  const color = COLORS[index % COLORS.length];

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value + 30 * progress.value * progress.value },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function SparkBurst({ trigger, onDone }: SparkBurstProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [trigger]);

  if (!trigger) return null;

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      {Array.from({ length: SPARK_COUNT }, (_, i) => (
        <Spark key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Verificar + Commit**

```bash
git add components/effects/SparkBurst.tsx
git commit -m "feat: SparkBurst celebration particle effect"
```

---

## Fase 4 — Pantallas core

### Task 13: Home rediseñado

**Files:**
- Modify: `app/(app)/index.tsx` (reestructura del header + hero + stats; la lógica de datos NO cambia)

**Interfaces:**
- Consumes: `ForjaWordmark` (sm), `StreakFlame` (compact), `StatCard`, `Button`, tipos `ScheduleDay` ya existentes en el archivo
- Referencia visual: mockup "DESPUÉS" de `home-rediseno.html`

- [ ] **Step 1: Header de marca**

Reemplazar el bloque actual de saludo+streak-box (View `px-5 mb-6 flex-row...` con el 🔥) por:

```tsx
      {/* Header de marca */}
      <View className="px-5 mb-4 flex-row items-center justify-between">
        <ForjaWordmark size="sm" />
        <StreakFlame streak={streak} compact />
      </View>

      {/* Saludo + hero editorial */}
      <View className="px-5 mb-4">
        <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter-Regular' }}>
          {getGreeting()}, {profile?.display_name ?? 'atleta'}
        </Text>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 34, lineHeight: 38, color: colors.text, letterSpacing: 1 }}>
          {heroLine1}
        </Text>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 34, lineHeight: 38, color: colors.primary, letterSpacing: 1 }}>
          {heroLine2}
        </Text>
      </View>
```

con la lógica del hero antes del return:

```tsx
  const heroLine1 = !plan ? 'AÚN NO FORJAMOS' : todayWorkout && !todayWorkout.is_rest ? 'HOY SE FORJA' : 'HOY: DESCANSO';
  const heroLine2 = !plan ? 'TU PLAN' : todayWorkout && !todayWorkout.is_rest ? (todayWorkout.focus ?? 'ENTRENAMIENTO').toUpperCase() : 'Y RECUPERACIÓN';
```

Imports nuevos: `ForjaWordmark`, `StreakFlame`, `StatCard`, `colors` ya está.

- [ ] **Step 2: Card del día con patrón editorial**

Dentro de la card del plan (rama `todayWorkout && !todayWorkout.is_rest`), reemplazar el contenido por el patrón A+C: header `DÍA {day_number} · {focus}` en Bebas 19px color primary + duración; filas de ejercicio con numeración Bebas gris `#57534E` (min-width 20), nombre Inter 600, chip mono `bg-surface-elevated` texto `primary-bright` con `{sets}×{reps}`:

```tsx
<View className="flex-row items-center gap-2.5 py-2 border-b border-border">
  <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 16, color: '#57534E', minWidth: 22 }}>
    {String(ex.order ?? i + 1).padStart(2, '0')}
  </Text>
  <Text className="flex-1 text-text text-sm" style={{ fontFamily: 'Inter-Medium' }}>{ex.name}</Text>
</View>
```

(agregar `order?: number` al tipo del ejercicio en `ScheduleDay` si no está). Máximo 3 filas + "+N ejercicios más →".

- [ ] **Step 3: Stats como StatCards**

Reemplazar la sección STATS (dos Cards) por:

```tsx
      <View className="px-5 mb-4 flex-row gap-2.5">
        <StatCard value={bodyData?.weight_kg ?? '—'} decimals={1} suffix=" kg" label="Actual" />
        <StatCard value={goal?.target_weight_kg ?? '—'} decimals={1} suffix=" kg" label="Meta" />
        <StatCard value={goalProgressPct ?? '—'} suffix="%" label="Progreso" />
      </View>
```

(pasar numbers activa el count-up de CountUpText automáticamente).

**Entradas de pantalla (spec §6.1):** envolver las 4 secciones principales (header, hero, card del día, stats+CTA) en `Animated.View` con `entering={FadeInUp.duration(250).delay(i * 60)}` (i = índice de sección), importando `Animated, { FadeInUp }` de reanimated.

con el cálculo (peso inicial no disponible en esta pantalla → usar aproximación con `useFirstBodyData` de `hooks/useBodyTracking.ts`):

```tsx
  const { data: firstBody } = useFirstBodyData();
  const goalProgressPct = (() => {
    const start = firstBody?.weight_kg;
    const current = bodyData?.weight_kg;
    const target = goal?.target_weight_kg;
    if (start == null || current == null || target == null || start === target) return null;
    const pct = Math.round(((current - start) / (target - start)) * 100);
    return Math.min(Math.max(pct, 0), 100);
  })();
```

- [ ] **Step 4: CTA Vulcano**

Reemplazar la card CTA verde del coach por:

```tsx
      <View className="px-5">
        <Button label="⚒️  Hablar con Vulcano" size="md" onPress={() => router.push('/(app)/chat')} />
      </View>
```

(el Button de Task 7 ya trae gradiente + fireShadow — cumple la regla de dosificación: único gradiente de la pantalla junto con la llama).

- [ ] **Step 5: Verificar**

`npx tsc --noEmit` limpio; visual contra el mockup: header wordmark+llama, hero Bebas 2 líneas, card editorial, 3 StatCards, CTA gradiente. Los 3 estados del hero (con entrenamiento / descanso / sin plan) se prueban creando/desactivando plan.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/index.tsx"
git commit -m "feat: redesigned home with editorial hero, streak flame and stat cards"
```

### Task 14: Chat de Vulcano (UI)

**Files:**
- Modify: `app/(app)/chat.tsx` (header)
- Modify: `components/chat/ChatBubble.tsx`
- Modify: `components/chat/ChatInput.tsx` (retoken de hex viejos)
- Modify: `components/chat/MessageLimitBanner.tsx` (retoken)
- Create: `components/chat/VulcanoAvatar.tsx`

**Interfaces:**
- Produces: `<VulcanoAvatar size={number} />` — placeholder hasta tener ilustraciones (spec §7)

- [ ] **Step 1: Crear `components/chat/VulcanoAvatar.tsx`**

```tsx
import { Text, View } from 'react-native';
import { colors } from '@/constants/colors';

// Placeholder del avatar de Vulcano — se reemplaza por ilustración (spec §7)
export function VulcanoAvatar({ size }: { size: number }) {
  return (
    <View
      className="items-center justify-center bg-surface-elevated"
      style={{ width: size, height: size, borderRadius: size * 0.33, borderWidth: 1.5, borderColor: colors.primary }}
    >
      <Text style={{ fontSize: size * 0.5 }}>🔥</Text>
    </View>
  );
}
```

- [ ] **Step 2: Header del chat**

En `app/(app)/chat.tsx`, en el header de la pantalla, mostrar:

```tsx
<View className="flex-row items-center gap-3">
  <VulcanoAvatar size={38} />
  <View>
    <Text className="text-text font-bold text-base" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>Vulcano</Text>
    <Text className="text-text-muted text-xs">El Forjador · tu coach</Text>
  </View>
</View>
```

Reemplazar cualquier mención "Memo" en esta pantalla por "Vulcano". El indicador de escritura (si existe string "está escribiendo") cambia a `Vulcano está forjando tu respuesta…`.

- [ ] **Step 3: ChatBubble**

Burbuja del assistant: `bg-surface` con `borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)'` (style) + `<VulcanoAvatar size={30} />` a la izquierda alineado abajo. Burbuja del user: `bg-primary-dim` (token ya actualizado). Sanear hex viejos.

- [ ] **Step 4: Retoken de ChatInput y MessageLimitBanner**

Buscar hex fríos (`#22C55E`, `#64748B`, `#1E293B`, `#818CF8`) y reemplazar por tokens de `colors`. Cualquier string "Memo" → "Vulcano".

- [ ] **Step 5: Verificar + Commit**

`npx tsc --noEmit`; visual: header con avatar, burbujas nuevas.

```bash
git add "app/(app)/chat.tsx" components/chat/
git commit -m "feat: Vulcano chat UI with avatar and ember bubbles"
```

### Task 15: Detalle de plan de entrenamiento (patrón A+C completo)

**Files:**
- Modify: `app/(app)/plans/workout/[id].tsx`

**Interfaces:**
- Consumes: `StatCard` (Task 10); tipos `WorkoutDay` existentes en el archivo

- [ ] **Step 1: Header del plan**

Título del plan en Bebas 30px `colors.text`; debajo `weekly_schedule_summary` en Inter `text-muted`. Fila de 3 StatCards con datos derivados del schedule ya presente en el archivo (`trainDays`, `restDays`):

```tsx
<View className="flex-row gap-2.5 my-4">
  <StatCard value={String(trainDays.length)} label="Días de forja" />
  <StatCard value={String(restDays.length)} label="Descanso" />
  <StatCard value={String(plan.duration_weeks ?? 8)} label="Semanas" />
</View>
```

(si `duration_weeks` no está en el tipo local del plan, agregarlo opcional).

- [ ] **Step 2: Headers de día expandibles**

En el map de `schedule`, el header de cada día pasa a: `DÍA {day_number} · {focus}` en Bebas 19px (`color: day.is_rest ? colors.textMuted : colors.primary`); días de descanso muestran `DÍA {n} · DESCANSO` con icono luna existente.

- [ ] **Step 3: Filas de ejercicio editorial**

Dentro del día expandido, cada ejercicio usa el patrón de Task 13 Step 2 (numeración Bebas + nombre Inter 600 + chips mono `{sets}×{reps}` y `{rest_seconds}s` en `bg-surface-elevated` texto `primary-bright`). `technique_notes` debajo en Inter 12 itálica `text-muted`. Eliminar cualquier bloque de texto del plan en JetBrainsMono.

- [ ] **Step 4: Verificar + Commit**

```bash
git add "app/(app)/plans/workout/[id].tsx"
git commit -m "feat: premium editorial typography for workout plan detail"
```

### Task 16: Hub de planes

**Files:**
- Modify: `app/(app)/plans/index.tsx`

- [ ] **Step 1: Cards del hub**

Títulos de card en Bebas 22px; subtítulos Inter `text-muted`; card de meal plan para free lleva `<Badge label="PREMIUM" variant="premium" />` (Task 8). Sanear hex fríos por tokens.

- [ ] **Step 2: Verificar + Commit**

```bash
git add "app/(app)/plans/index.tsx"
git commit -m "feat: plans hub with display typography and premium badge"
```

---

## Fase 5 — Pantallas restantes

### Task 17: Onboarding con Vulcano

**Files:**
- Modify: `app/(auth)/onboarding/_layout.tsx` (progress bar de metal)
- Modify: `app/(auth)/onboarding/step-1-goals.tsx` (presentación de Vulcano)
- Modify: `app/(auth)/onboarding/step-3-level.tsx` (celebración al finalizar)

**Interfaces:**
- Consumes: `VulcanoAvatar` (Task 14), `SparkBurst` (Task 12), `ProgressBar` (Task 9)

- [ ] **Step 1: Progress del layout**

Si el layout usa un indicador propio, reemplazarlo por `<ProgressBar value={(step / 3) * 100} />` (metal calentándose).

- [ ] **Step 2: Presentación de Vulcano en step-1**

Encima del título del paso 1, agregar:

```tsx
<View className="items-center mb-6">
  <VulcanoAvatar size={72} />
  <Text className="text-text mt-3 text-center" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20 }}>
    Soy Vulcano, forjador de atletas
  </Text>
  <Text className="text-text-muted text-sm text-center mt-1" style={{ fontFamily: 'Inter-Regular' }}>
    Cuéntame de ti y forjaremos tu plan a la medida.
  </Text>
</View>
```

- [ ] **Step 3: Celebración en step-3**

En `handleFinish`, tras guardar con éxito y antes de `router.replace`, disparar SparkBurst: agregar estado `const [celebrating, setCelebrating] = useState(false)`; en el éxito: `setCelebrating(true)` y navegar en el `onDone`:

```tsx
<SparkBurst trigger={celebrating} onDone={() => router.replace('/(app)')} />
```

(quitar el `router.replace` directo del try). El copy del botón cambia a `Forjar mi plan 🔥`.

- [ ] **Step 4: Verificar + Commit**

```bash
git add "app/(auth)/onboarding/"
git commit -m "feat: Vulcano onboarding intro and spark celebration"
```

### Task 18: Progress con gráfica de fuego

**Files:**
- Modify: `components/progress/WeightChart.tsx`
- Modify: `components/progress/GoalProgress.tsx`
- Modify: `components/progress/MeasurementForm.tsx` (retoken)
- Modify: `app/(app)/progress.tsx`

- [ ] **Step 1: WeightChart — línea y área de fuego**

En los `Defs` existentes, cambiar el gradiente `weightGrad` a stops `#F97316` (0, opacity 0.3) → `#F97316` (1, opacity 0); el `stroke` del Path de línea pasa de `colors.primary` (ya es naranja por token) y agregar un segundo Path idéntico debajo con `strokeWidth={6}` y `strokeOpacity={0.25}` (efecto glow). Los `Circle` de puntos con `fill={colors.primaryBright}`.

- [ ] **Step 2: progress.tsx — StatCards arriba**

Bajo el header "Progreso", agregar fila de 3 StatCards (peso actual / grasa % / músculo kg desde `latestBodyData`, con '—' si null). Título de pantalla a Bebas 30px.

- [ ] **Step 3: GoalProgress + MeasurementForm retoken**

Sanear hex fríos por tokens; GoalProgress usa la nueva ProgressBar automáticamente.

- [ ] **Step 4: Verificar + Commit**

```bash
git add components/progress/ "app/(app)/progress.tsx"
git commit -m "feat: fire-gradient weight chart and stat cards in progress"
```

### Task 19: Meal plan

**Files:**
- Modify: `app/(app)/plans/meal/index.tsx`
- Modify: `components/plans/MealPlanCard.tsx`
- Modify: `components/plans/MacroBar.tsx`

- [ ] **Step 1: MacroBar** — colores: proteína `colors.primary`, carbs `colors.primaryBright`, grasa `#A8A29E`.
- [ ] **Step 2: MealPlanCard** — nombre de comida en Space Grotesk 600; calorías en chip mono `primary-bright`; retoken.
- [ ] **Step 3: meal/index.tsx** — título en Bebas; navegador de días como chips (`bg-primary-dim` activo); PaywallBanner con Badge premium; retoken.
- [ ] **Step 4: Verificar + Commit**

```bash
git add "app/(app)/plans/meal/" components/plans/MealPlanCard.tsx components/plans/MacroBar.tsx
git commit -m "feat: meal plan screens with ember identity"
```

### Task 20: Profile + Upgrade

**Files:**
- Modify: `app/(app)/profile.tsx`
- Modify: `app/(app)/upgrade.tsx`
- Modify: `components/premium/UpgradeSheet.tsx`, `components/premium/PaywallBanner.tsx` (retoken + Badge premium)

- [ ] **Step 1: Profile** — badge de plan: `<Badge label="PREMIUM" variant="premium" />` si premium, `muted` "FREE" si no; retoken de hex fríos.
- [ ] **Step 2: Upgrade** — card del plan anual envuelta en `LinearGradient` ember de 2px de padding (borde incandescente) con `<Badge label="MEJOR VALOR" variant="premium" />`; checkmarks de features en `colors.accent`; títulos en Bebas. **Regla de copy del Paso 12 se mantiene:** conexión pulsera/reloj es GRATIS — lo premium es la IA sobre esos datos.
- [ ] **Step 3: UpgradeSheet + PaywallBanner** — retoken; icono candado a `colors.accent`.
- [ ] **Step 4: Verificar + Commit**

```bash
git add "app/(app)/profile.tsx" "app/(app)/upgrade.tsx" components/premium/
git commit -m "feat: profile and upgrade screens with ember identity"
```

### Task 21: PlanGenerating y empty states con Vulcano

**Files:**
- Modify: `components/plans/PlanGenerating.tsx`
- Modify: `app/(app)/plans/workout/index.tsx` (empty state)

- [ ] **Step 1: PlanGenerating**

Vulcano trabajando: `<VulcanoAvatar size={72} />` + texto `Vulcano está forjando tu plan…` (Space Grotesk 600) + subtexto Inter muted `El buen metal toma su tiempo. ~30 segundos.` + ProgressBar indeterminada (o la animación existente re-tokenizada).

- [ ] **Step 2: Empty state de workout**

Sin plan activo: `<VulcanoAvatar size={72} />` + `Aún no forjamos tu plan` (Bebas 26px) + `Cuéntame tu objetivo y lo forjamos juntos.` + Button primary `Forjar mi plan`.

- [ ] **Step 3: Verificar + Commit**

```bash
git add components/plans/PlanGenerating.tsx "app/(app)/plans/workout/index.tsx"
git commit -m "feat: Vulcano plan-generating state and empty states"
```

---

## Fase 6 — Vulcano backend y cierre

### Task 22: System prompt — rename + tono adaptativo

**Files:**
- Modify: `supabase/functions/chat/index.ts`

**Interfaces:**
- Consumes: `fitness_level` del goal activo (la EF ya construye el contexto de usuario con el goal)

- [ ] **Step 1: Rename en el system prompt**

Reemplazar toda referencia a "Memo" / "Memo el Forjador" por "Vulcano". La identidad abre con: `Eres Vulcano, el coach de la app Forja: un maestro herrero legendario que forja atletas. Hablas como mentor que ha forjado a miles — con calidez de fragua, no de vestidor de gym.`

- [ ] **Step 2: Tono adaptativo**

En la sección del prompt donde se inyecta el contexto del usuario, agregar (interpolando el nivel real):

```typescript
const TONE_BY_LEVEL: Record<string, string> = {
  casual: 'TONO: paciente y celebratorio. El usuario está empezando — celebra cada pequeño logro, explica los porqués, nunca uses jerga sin explicarla.',
  intermediate: 'TONO: motivador y didáctico. Reconoce su constancia y rétalo a subir un escalón.',
  intensive: 'TONO: directo y estructurado. El usuario entrena en serio — dale precisión técnica y exige consistencia.',
  advanced: 'TONO: exigente y técnico. Háblale de igual a igual, sin rodeos, con detalle fino de programación.',
  elite: 'TONO: forjador de campeones. Máxima exigencia y precisión. Cero complacencia, respeto total.',
};
```

y concatenar `TONE_BY_LEVEL[fitnessLevel] ?? TONE_BY_LEVEL.intermediate` al bloque de contexto del usuario (dentro del bloque con `cache_control` — el tono por usuario es estable, cachea bien).

**No tocar:** restricciones de seguridad (no trastornos alimenticios, no diagnósticos médicos), scope de temas, rate limits, Prompt Caching.

- [ ] **Step 3: Verificar**

Con Supabase local corriendo: `sg docker -c "supabase functions serve chat"` en background y mandar un mensaje desde la app (o curl con JWT del usuario de prueba): la respuesta debe firmar como Vulcano. Verificar en la respuesta de Anthropic que `cache_read_input_tokens > 0` en el segundo mensaje (caching intacto).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/chat/index.ts
git commit -m "feat: rename coach to Vulcano with fitness-level adaptive tone"
```

### Task 23: Cierre — barrido de hex fríos, docs y verificación final

**Files:**
- Modify: cualquier archivo con hex viejos restantes
- Modify: `forja-docs.md`
- Modify: `app/(app)/_layout.tsx` (tab bar retoken si tiene hex)

- [ ] **Step 1: Barrido final de la paleta vieja**

```bash
grep -rn "#0A0A0F\|#13131C\|#1E1E2E\|#166534\|#818CF8\|#64748B\|#1E293B\|#F1F5F9" app/ components/ --include="*.tsx" | grep -v node_modules
```

Expected: 0 resultados (excepto usos legítimos de `#22C55E` como success). Corregir lo que aparezca con tokens. Incluye: `components/ui/Sheet.tsx` — `backgroundStyle` a `colors.surfaceElevated` y `handleIndicatorStyle` a `colors.accent` (handle ámbar, spec §5).

**Entradas de pantalla restantes (spec §6.1):** agregar `entering={FadeInUp.duration(250)}` al contenedor principal de las pantallas que no lo recibieron en sus tasks (chat, plans hub, meal, progress, profile, upgrade).

- [ ] **Step 2: Barrido de "Memo"**

```bash
grep -rni "memo el forjador\|coach memo" app/ components/ supabase/ forja-docs.md --include="*.ts*" --include="*.md"
```

Expected: 0 resultados (cuidado: NO tocar `useMemo`/`memo` de React — el grep de arriba ya los excluye).

- [ ] **Step 3: Actualizar `forja-docs.md`**

Sección de design system: nueva paleta, Bebas Neue, Vulcano, componentes nuevos (Ember, ForjaWordmark, StreakFlame, StatCard, SparkBurst, VulcanoAvatar).

- [ ] **Step 4: Verificación final completa**

```bash
npx tsc --noEmit && npx expo install --check
```

Expected: limpio + "Dependencies are up to date". Recorrido visual completo en Expo Go: login → registro → onboarding (3 pasos + chispas) → home → chat → planes → detalle → meal → progress → profile → upgrade.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: brand redesign closeout — token sweep, docs, Vulcano rename"
```
