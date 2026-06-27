# Freemium Gates y Pantalla de Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full in-app monetization experience: contextual `UpgradeSheet`, reusable `PaywallBanner`, full `/upgrade` screen with tier comparison and promo code, and wire all existing gates to the new upgrade flow.

**Architecture:** Three new UI pieces (UpgradeSheet, PaywallBanner, upgrade screen) are created first; then five existing files are wired to them. `UpgradeSheet` wraps the existing `Sheet` design-system component with `forwardRef` so callers can open it via `sheetRef.current?.expand()`. Payment opens the external browser to `pay.forja.fit` via `Linking.openURL`. The `/upgrade` screen is a Tabs screen with `href: null` (hidden tab, no tab bar navigation, but routable via `router.push`).

**Tech Stack:** React Native + Expo SDK 56, Expo Router v4 (typedRoutes: true), NativeWind v4, `react-native-bottom-sheet` (via existing `Sheet` component), `expo-router` Linking

## Global Constraints

- Expo SDK 56 — do not use APIs not in https://docs.expo.dev/versions/v56.0.0/
- NativeWind v4 rule: static layout props → `className="..."`, colors/fontFamily/dynamic values → `style={{}}`
- TypeScript strict — no `any` except where explicitly permitted in this plan (sheet refs)
- Fonts available: `SpaceGrotesk-Regular`, `SpaceGrotesk-SemiBold`, `SpaceGrotesk-Bold`, `Inter-Regular`, `Inter-Medium`, `Inter-Bold`, `JetBrainsMono-Regular`, `JetBrainsMono-Medium` — only these
- Colors: always from `constants/colors.ts` (`colors.background`, `.surface`, `.primary`, `.primaryDim`, `.accent`, `.text`, `.textMuted`, `.border`, `.destructive`, `.warning`) — never hardcode hex
- `@/` maps to project root
- No test framework — TypeScript verification via `npx tsc --noEmit`; runtime via `npx expo start` and manual device/simulator testing
- typedRoutes is enabled — `router.push('/(app)/upgrade')` will type-check correctly once `upgrade.tsx` exists and Expo Router has regenerated types (happens on `npx expo start`)
- Prices: Premium mensual = `$179 MXN/mes`, anual = `$1,299 MXN/año`, `$108/mes` (40% off)
- Payment URL base: `https://pay.forja.fit` — query params: `plan=premium`, `billing=monthly|yearly`, `promo=CODE` (optional)
- Portal URL: `https://pay.forja.fit/portal`
- Copy rule: **wearable connection is FREE in all tiers** — no UI element should suggest connecting a device requires payment. What's premium is Memo's AI intelligence on top of wearable data.
- `useIsPremium()` from `hooks/useSubscription` — returns `boolean`
- `useSubscription()` from `hooks/useSubscription` — returns `{ data: { plan, status, current_period_end } | null | undefined }`
- `Sheet` component (`components/ui/Sheet.tsx`) uses `forwardRef<unknown, SheetProps>` — open with `(ref.current as any)?.expand()`, close with `(ref.current as any)?.close()`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/premium/UpgradeSheet.tsx` | Create (replace 0-byte placeholder) | Contextual bottom sheet with per-feature copy + CTA |
| `components/premium/PaywallBanner.tsx` | Create (replace 0-byte placeholder) | Inline banner for limit-reached states |
| `app/(app)/upgrade.tsx` | Create | Full upgrade screen: tier cards, billing toggle, promo code, CTA |
| `app/(app)/_layout.tsx` | Modify | Add hidden `upgrade` Tabs.Screen so `router.push('/(app)/upgrade')` resolves |
| `components/progress/WeightChart.tsx` | Modify | Tap on locked range → open UpgradeSheet |
| `components/progress/MeasurementForm.tsx` | Modify | Tap on locked field → open UpgradeSheet |
| `components/chat/MessageLimitBanner.tsx` | Modify | Premium button → navigate to `/upgrade` instead of `/profile` |
| `app/(app)/plans/meal/index.tsx` | Modify | Replace static "Regenerar requiere Premium" block with PaywallBanner |
| `app/(app)/profile.tsx` | Create (replace 0-byte placeholder) | Profile screen: avatar, plan badge, upgrade card (free users), sign out |

---

## Task 1: `UpgradeSheet` component

**Files:**
- Create: `components/premium/UpgradeSheet.tsx`

**Interfaces:**
- Consumes: `Sheet` from `components/ui/Sheet` (snapPoints, forwardRef pattern), `Button` from `components/ui/Button`, `colors` from `constants/colors`, `Ionicons` from `@expo/vector-icons`, `router` from `expo-router`, `Linking` from `react-native`
- Produces:
  ```ts
  export type UpgradeContext = 'chart_range' | 'body_composition' | 'meal_plan' | 'generic'
  export const UpgradeSheet: React.ForwardRefExoticComponent<UpgradeSheetProps & React.RefAttributes<unknown>>
  // Usage: const ref = useRef<any>(); ref.current?.expand()
  ```

- [ ] **Step 1: Write the component**

Create `components/premium/UpgradeSheet.tsx` with the exact content below:

```tsx
import { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';

export type UpgradeContext = 'chart_range' | 'body_composition' | 'meal_plan' | 'generic';

interface UpgradeSheetProps {
  context?: UpgradeContext;
}

const COPY: Record<UpgradeContext, { title: string; bullets: string[] }> = {
  chart_range: {
    title: 'Historial completo',
    bullets: [
      'Hasta 365 días de datos',
      'Rangos de 1 mes y 3 meses',
      'Tendencias de largo plazo',
    ],
  },
  body_composition: {
    title: 'Composición corporal',
    bullets: [
      '% de grasa corporal',
      'Masa muscular en kg',
      'Seguimiento completo de tu cuerpo',
    ],
  },
  meal_plan: {
    title: 'Planes ilimitados',
    bullets: [
      '10 planes al mes',
      'Actualiza según tu progreso',
      'Memo ajusta según tus datos reales',
    ],
  },
  generic: {
    title: 'Desbloquea Premium',
    bullets: [
      'Chat ilimitado con Memo',
      'Planes de entrenamiento ilimitados',
      'Memo analiza tus datos de actividad',
    ],
  },
};

export const UpgradeSheet = forwardRef<unknown, UpgradeSheetProps>(
  function UpgradeSheet({ context = 'generic' }, ref) {
    const { title, bullets } = COPY[context];

    function handleUpgrade() {
      Linking.openURL('https://pay.forja.fit?plan=premium&billing=yearly');
    }

    function handleSeeAll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref as any)?.current?.close?.();
      router.push('/(app)/upgrade' as never);
    }

    return (
      <Sheet ref={ref} snapPoints={['60%']}>
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="lock-closed" size={22} color={colors.accent} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
              {title}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {bullets.map((bullet, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text, flex: 1 }}>
                  {bullet}
                </Text>
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
            Desde $1,299/año
          </Text>

          <Button label="Hazte Premium →" onPress={handleUpgrade} />

          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.accent }}>
              Ver todos los beneficios ↗
            </Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  },
);
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | grep -E "UpgradeSheet|error" | head -20
```

Expected: no errors referencing `UpgradeSheet.tsx`. (Other pre-existing errors from placeholder files are acceptable.)

- [ ] **Step 3: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add components/premium/UpgradeSheet.tsx && git commit -m "feat: UpgradeSheet contextual bottom sheet component"
```

---

## Task 2: `PaywallBanner` component

**Files:**
- Create: `components/premium/PaywallBanner.tsx`

**Interfaces:**
- Consumes: `colors` from `constants/colors`, `Ionicons` from `@expo/vector-icons`
- Produces:
  ```ts
  interface PaywallBannerProps {
    message: string;
    ctaLabel?: string;   // default: 'Hazte Premium'
    onPress: () => void;
  }
  export function PaywallBanner(props: PaywallBannerProps): JSX.Element
  ```

- [ ] **Step 1: Write the component**

Create `components/premium/PaywallBanner.tsx` with the exact content below:

```tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface PaywallBannerProps {
  message: string;
  ctaLabel?: string;
  onPress: () => void;
}

export function PaywallBanner({ message, ctaLabel = 'Hazte Premium', onPress }: PaywallBannerProps) {
  return (
    <View
      style={{
        backgroundColor: colors.accent + '1A',
        borderWidth: 1,
        borderColor: colors.accent + '40',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Ionicons name="flash-outline" size={18} color={colors.accent} />
      <Text
        style={{ flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}
      >
        {message}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: colors.accent,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 12 }}>
          {ctaLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | grep -E "PaywallBanner|error" | head -20
```

Expected: no errors referencing `PaywallBanner.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add components/premium/PaywallBanner.tsx && git commit -m "feat: PaywallBanner reusable inline paywall banner"
```

---

## Task 3: `/upgrade` screen + `_layout.tsx` hidden tab

**Files:**
- Create: `app/(app)/upgrade.tsx`
- Modify: `app/(app)/_layout.tsx` (add 1 hidden Tabs.Screen)

**Interfaces:**
- Consumes: `Button` from `components/ui/Button`, `Badge` from `components/ui/Badge`, `Input` from `components/ui/Input`, `useIsPremium` + `useSubscription` from `hooks/useSubscription`, `colors` from `constants/colors`, `Ionicons`, `router` from `expo-router`, `Linking` from `react-native`, `SafeAreaView` from `react-native-safe-area-context`
- Produces: route `/(app)/upgrade` — accessible via `router.push('/(app)/upgrade' as never)` from any screen

- [ ] **Step 1: Add hidden `upgrade` screen to `_layout.tsx`**

Current last line before `</Tabs>` in `app/(app)/_layout.tsx`:

```tsx
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
    </Tabs>
```

Replace with:

```tsx
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="upgrade"
        options={{ href: null }}
      />
    </Tabs>
```

- [ ] **Step 2: Create `app/(app)/upgrade.tsx`**

Create the file with the exact content below:

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { colors } from '@/constants/colors';

type Billing = 'monthly' | 'yearly';

const FREE_FEATURES = [
  '20 mensajes al día con Memo',
  '1 plan de entrenamiento al mes',
  '1 plan alimenticio (de por vida)',
  '14 días de historial corporal',
];

const PREMIUM_FEATURES = [
  'Chat ilimitado con Memo',
  'Planes de entrenamiento ilimitados',
  '10 planes alimenticios al mes',
  '365 días de historial corporal',
  'Composición corporal (% grasa, músculo)',
  'Memo analiza tus datos de actividad',
];

const PRO_FEATURES = [
  'Todo lo de Premium',
  'Fotos de comida con análisis IA',
  'Análisis de técnica de ejercicio',
  'Coaching en tiempo real',
];

function buildPaymentURL(billing: Billing, promoCode: string): string {
  let url = 'https://pay.forja.fit?plan=premium&billing=' + billing;
  if (promoCode.trim()) {
    url += '&promo=' + encodeURIComponent(promoCode.trim().toUpperCase());
  }
  return url;
}

export default function UpgradeScreen() {
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();
  const [billing, setBilling] = useState<Billing>('yearly');
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);

  const price = billing === 'monthly' ? '$179 MXN/mes' : '$1,299 MXN/año';
  const ctaLabel = billing === 'monthly' ? 'Continuar — $179/mes' : 'Continuar — $1,299/año';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Navbar */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
          Planes
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: 28, gap: 8 }}>
          <Ionicons name="flash" size={40} color={colors.accent} />
          <Text
            style={{
              fontFamily: 'SpaceGrotesk-Bold',
              fontSize: 28,
              color: colors.text,
              letterSpacing: -0.5,
            }}
          >
            FORJA PRO
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 16,
              color: colors.textMuted,
              textAlign: 'center',
            }}
          >
            Entrena con inteligencia
          </Text>
        </View>

        {/* Billing toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 4,
            marginBottom: 8,
          }}
        >
          {(['monthly', 'yearly'] as const).map((b) => (
            <TouchableOpacity
              key={b}
              onPress={() => setBilling(b)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: billing === b ? colors.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter-Bold',
                  fontSize: 14,
                  color: billing === b ? colors.background : colors.textMuted,
                }}
              >
                {b === 'monthly' ? 'Mensual' : 'Anual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 20, justifyContent: 'center', marginBottom: 12 }}>
          {billing === 'yearly' && (
            <Text
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 13,
                color: colors.primary,
                textAlign: 'center',
              }}
            >
              Ahorras 40% con el plan anual
            </Text>
          )}
        </View>

        {/* Free tier card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: 0.7,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
              Free
            </Text>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
                $0
              </Text>
              {!isPremium && <Badge label="Actual" variant="muted" />}
            </View>
          </View>
          {FREE_FEATURES.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                {f}
              </Text>
            </View>
          ))}
        </View>

        {/* Premium tier card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 2,
            borderColor: colors.primary,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
                ⚡ Premium
              </Text>
              <Badge label="Recomendado" variant="primary" />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text
                style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.primary }}
              >
                {price}
              </Text>
              {billing === 'yearly' && (
                <Text
                  style={{
                    fontFamily: 'Inter-Regular',
                    fontSize: 11,
                    color: colors.textMuted,
                  }}
                >
                  $108/mes — 40% off
                </Text>
              )}
              {isPremium && <Badge label="✓ Activo" variant="accent" />}
            </View>
          </View>
          {PREMIUM_FEATURES.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text }}>
                {f}
              </Text>
            </View>
          ))}
        </View>

        {/* Pro tier card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.textMuted,
            opacity: 0.6,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, color: colors.text }}>
              🔥 Pro
            </Text>
            <Badge label="Próximamente" variant="muted" />
          </View>
          {PRO_FEATURES.map((f, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
            >
              <Ionicons name="checkmark" size={14} color={colors.textMuted} />
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
                {f}
              </Text>
            </View>
          ))}
        </View>

        {/* Promo code */}
        <TouchableOpacity
          onPress={() => setPromoOpen((v) => !v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', marginBottom: 12 }}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted }}>
            ¿Tienes un código? {promoOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {promoOpen && (
          <Input
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="FORJA2024"
            autoCapitalize="characters"
            style={{ marginBottom: 20 }}
          />
        )}

        {/* CTA */}
        {isPremium ? (
          <View style={{ gap: 12 }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text
                style={{ fontFamily: 'Inter-Bold', fontSize: 16, color: colors.primary }}
              >
                Ya eres Premium
              </Text>
            </View>
            <Button
              variant="secondary"
              label="Gestionar suscripción"
              onPress={() => Linking.openURL('https://pay.forja.fit/portal')}
            />
          </View>
        ) : (
          <Button
            label={ctaLabel}
            onPress={() => Linking.openURL(buildPaymentURL(billing, promoCode))}
          />
        )}

        {/* Legal footer */}
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 12,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 16,
          }}
        >
          Cancela cuando quieras · Procesado de forma segura con Stripe
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | grep -E "upgrade|_layout|error TS" | head -30
```

Expected: no new errors in `upgrade.tsx` or `_layout.tsx`. (If `router.push('/(app)/upgrade' as never)` causes a type error in UpgradeSheet.tsx, change the call to use `as never` cast — which is already in the Task 1 code.)

- [ ] **Step 4: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add "app/(app)/upgrade.tsx" "app/(app)/_layout.tsx" && git commit -m "feat: /upgrade screen with tier comparison, billing toggle, promo code"
```

---

## Task 4: Wire existing gates

**Files:**
- Modify: `components/progress/WeightChart.tsx`
- Modify: `components/progress/MeasurementForm.tsx`
- Modify: `components/chat/MessageLimitBanner.tsx`
- Modify: `app/(app)/plans/meal/index.tsx`

**Interfaces:**
- Consumes: `UpgradeSheet` from `components/premium/UpgradeSheet` (Tasks 1), `PaywallBanner` from `components/premium/PaywallBanner` (Task 2), route `/(app)/upgrade` (Task 3)

- [ ] **Step 1: Wire `WeightChart.tsx`**

The file is at `components/progress/WeightChart.tsx`.

Add `useRef` import and `UpgradeSheet` import at the top:

```tsx
import { useMemo, useState, useRef } from 'react';
// ... existing imports ...
import { UpgradeSheet } from '@/components/premium/UpgradeSheet';
```

Inside `WeightChart` function, after `const [range, setRange] = useState<RangeKey>('2w');`, add:

```tsx
  const upgradeSheetRef = useRef<any>(null);
```

Change the locked range button `onPress` from:

```tsx
                onPress={() => !locked && setRange(key)}
```

to:

```tsx
                onPress={() => {
                  if (locked) {
                    upgradeSheetRef.current?.expand();
                  } else {
                    setRange(key);
                  }
                }}
```

At the end of the outer `View` (the return's root View), before the closing `</View>`, add:

```tsx
      <UpgradeSheet ref={upgradeSheetRef} context="chart_range" />
```

- [ ] **Step 2: Wire `MeasurementForm.tsx`**

The file is at `components/progress/MeasurementForm.tsx`.

Add `useRef` import and `UpgradeSheet` import:

```tsx
import { useState, useRef } from 'react';
// ... existing imports ...
import { TouchableOpacity } from 'react-native';
import { UpgradeSheet } from '@/components/premium/UpgradeSheet';
```

Note: `TouchableOpacity` should be added to the existing `react-native` import line.

Inside `MeasurementForm` function, after the `const isPending` line, add:

```tsx
  const upgradeSheetRef = useRef<any>(null);
```

Replace the body fat input group (lines 85–99 in the current file) with:

```tsx
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Grasa corporal (%)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (!isPremium) upgradeSheetRef.current?.expand(); }}
        >
          <Input
            value={bodyFatPct}
            onChangeText={setBodyFatPct}
            placeholder="18.5"
            keyboardType="decimal-pad"
            editable={isPremium}
            style={{ opacity: isPremium ? 1 : 0.4 }}
          />
        </TouchableOpacity>
      </View>
```

Replace the muscle mass input group (lines 101–116 in the current file) with:

```tsx
      <View className="gap-1.5">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
            Masa muscular (kg)
          </Text>
          {!isPremium && <Badge label="Premium" variant="accent" />}
        </View>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { if (!isPremium) upgradeSheetRef.current?.expand(); }}
        >
          <Input
            value={muscleMassKg}
            onChangeText={setMuscleMassKg}
            placeholder="35.0"
            keyboardType="decimal-pad"
            editable={isPremium}
            style={{ opacity: isPremium ? 1 : 0.4 }}
          />
        </TouchableOpacity>
      </View>
```

After the existing `<Button ... />` at the end of the return's `<View className="gap-4">`, add:

```tsx
      <UpgradeSheet ref={upgradeSheetRef} context="body_composition" />
```

- [ ] **Step 3: Fix `MessageLimitBanner.tsx`**

In `components/chat/MessageLimitBanner.tsx`, change the premium button `onPress`:

From:
```tsx
          onPress={() => router.push('/(app)/profile')}
```

To:
```tsx
          onPress={() => router.push('/(app)/upgrade' as never)}
```

- [ ] **Step 4: Wire meal plan paywall in `meal/index.tsx`**

In `app/(app)/plans/meal/index.tsx`, add `PaywallBanner` import:

```tsx
import { PaywallBanner } from '@/components/premium/PaywallBanner';
```

Replace the free-user static info block (currently inside the `{activePlan && planData ? (` branch, at the end when `!isPremium`):

Current code to replace (the entire `else` View with lock icon):
```tsx
            ) : (
              <View style={{
                marginTop: 16, backgroundColor: colors.accent + '15',
                borderWidth: 1, borderColor: colors.accent + '40',
                borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              }}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    Regenerar requiere Premium
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                    Actualiza para crear nuevos planes cuando quieras
                  </Text>
                </View>
              </View>
            )}
```

Replace with:
```tsx
            ) : (
              <View style={{ marginTop: 16 }}>
                <PaywallBanner
                  message="Actualiza para crear nuevos planes cuando quieras"
                  onPress={() => router.push('/(app)/upgrade' as never)}
                />
              </View>
            )}
```

- [ ] **Step 5: TypeScript check**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | grep -E "WeightChart|MeasurementForm|MessageLimitBanner|meal/index|error TS" | head -30
```

Expected: no new errors in the four modified files.

- [ ] **Step 6: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add components/progress/WeightChart.tsx components/progress/MeasurementForm.tsx components/chat/MessageLimitBanner.tsx "app/(app)/plans/meal/index.tsx" && git commit -m "feat: wire upgrade gates to UpgradeSheet and PaywallBanner"
```

---

## Task 5: Profile screen

**Files:**
- Create: `app/(app)/profile.tsx` (replace 0-byte placeholder)

**Interfaces:**
- Consumes: `useProfile` from `hooks/useProfile`, `useIsPremium` + `useSubscription` from `hooks/useSubscription`, `useAuthStore` from `store/auth.store`, `supabase` from `lib/supabase`, `Button` from `components/ui/Button`, `Badge` from `components/ui/Badge`, `colors` from `constants/colors`, route `/(app)/upgrade` (Task 3)
- Produces: profile tab screen with avatar, plan badge, upgrade card (free users), sign-out

- [ ] **Step 1: Create `app/(app)/profile.tsx`**

```tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfile } from '@/hooks/useProfile';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { colors } from '@/constants/colors';

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const displayName =
    profile?.display_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, color: colors.text }}>
          Perfil
        </Text>
      </View>

      <View style={{ flex: 1, padding: 20, gap: 20 }}>
        {/* Avatar + name + plan badge */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primaryDim,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: colors.primary }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text
              style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}
            >
              {displayName}
            </Text>
            <Text
              style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}
            >
              {user?.email}
            </Text>
            {isPremium ? (
              <Badge label="⚡ Premium activo" variant="accent" />
            ) : (
              <Badge label="Plan Free" variant="muted" />
            )}
          </View>
        </View>

        {/* Upgrade card — free users only */}
        {!isPremium && (
          <View
            style={{
              backgroundColor: colors.accent + '15',
              borderWidth: 1,
              borderColor: colors.accent + '40',
              borderRadius: 16,
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="flash" size={22} color={colors.accent} />
              <Text
                style={{
                  fontFamily: 'SpaceGrotesk-Bold',
                  fontSize: 16,
                  color: colors.text,
                  flex: 1,
                }}
              >
                Desbloquea todo el potencial de Memo
              </Text>
            </View>
            <Text
              style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}
            >
              Chat ilimitado, planes sin restricciones y seguimiento completo de tu cuerpo.
            </Text>
            <Button
              label="Hazte Premium"
              onPress={() => router.push('/(app)/upgrade' as never)}
            />
          </View>
        )}

        {/* Renewal info — premium users only */}
        {isPremium && periodEnd && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text
              style={{
                fontFamily: 'Inter-Regular',
                fontSize: 13,
                color: colors.textMuted,
                flex: 1,
              }}
            >
              Tu suscripción se renueva el {periodEnd}
            </Text>
          </View>
        )}
      </View>

      {/* Sign out */}
      <View style={{ padding: 20 }}>
        <Button variant="ghost" label="Cerrar sesión" onPress={handleSignOut} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx tsc --noEmit 2>&1 | grep -E "profile|error TS" | head -20
```

Expected: no errors in `profile.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && git add "app/(app)/profile.tsx" && git commit -m "feat: profile screen with plan badge and upgrade card"
```

---

## Manual Verification Checklist

After all tasks are complete, start the dev server and verify:

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja" && npx expo start --clear
```

- [ ] **Upgrade screen:** Navigate to Profile tab → tap "Hazte Premium" → `/upgrade` opens with 3 tier cards
- [ ] **Billing toggle:** Tap "Mensual" → price on Premium card changes to `$179 MXN/mes`; tap "Anual" → `$1,299 MXN/año` with savings text
- [ ] **Promo code:** Tap "¿Tienes un código?" → text field appears; type code → "Continuar" button appends `?promo=CODE` to URL
- [ ] **CTA:** Tap "Continuar — $1,299/año" → device browser opens to `pay.forja.fit`
- [ ] **WeightChart:** Tap "1 mes" or "3 mes" range button (locked) → `UpgradeSheet` opens with "Historial completo" title and 3 bullets
- [ ] **UpgradeSheet CTA:** Tap "Hazte Premium →" → browser opens; tap "Ver todos los beneficios" → `/upgrade` opens
- [ ] **MeasurementForm:** Tap on grasa/músculo field (locked) → `UpgradeSheet` opens with "Composición corporal" title
- [ ] **Chat limit:** Reach 20 messages → `MessageLimitBanner` shows; tap "Premium" → `/upgrade` opens
- [ ] **Meal plan:** User who used their free plan → PaywallBanner with "Hazte Premium" CTA visible instead of old static text
- [ ] **Profile — free user:** Avatar with initial, "Plan Free" badge, upgrade card with "Hazte Premium" button
- [ ] **Profile — premium user:** "⚡ Premium activo" badge, renewal date, no upgrade card, sign out works
- [ ] **Pro card:** Visible but dimmed, "Próximamente" badge, no interactive CTA
