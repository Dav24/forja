# Pulido: restyle auth/onboarding + vista de entrenamiento + integridad de exercise_logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Armonizar `app/(auth)/` (login/registro/onboarding) con el sistema de diseño ya construido en Fases A-D, y corregir la vista de entrenamiento para que un día se muestre en grande al tocarlo (en vez de expandirse en acordeón), con integridad de datos real en `exercise_logs` (sin duplicados, con aviso al registrar un día que no es hoy).

**Architecture:** Dos hilos independientes en código. Hilo 1: `constants/goals.ts`/`constants/modalities.ts` ganan un campo `iconName` (Ionicons); los 9 archivos de `app/(auth)/` migran de emojis/Tailwind genérico a `Ionicons` + la escala de `constants/typography.ts`. Hilo 2: migración `0013` agrega `log_date` + índice único + política RLS de `update` a `exercise_logs`; `useLogExerciseSets` pasa de `insert` a `upsert`; `app/(app)/plans/workout/[id].tsx` se divide en `[id]/index.tsx` (overview, sin acordeón) + `[id]/day/[dayNumber].tsx` (detalle nuevo, día gigante + `StaggerIn`); `ExerciseSheet` gana confirmación antes de guardar en un día no-actual.

**Tech Stack:** React Native/Expo, expo-router (file-based), Supabase (Postgres + RLS), TanStack Query v5, react-i18next, Reanimated (`StaggerIn`).

## Global Constraints

- Spec fuente: `docs/superpowers/specs/2026-07-15-auth-workout-polish-design.md` — toda cifra/valor exacto de este plan viene de ahí.
- Fuentes disponibles (verificadas contra `app/_layout.tsx`, únicas que existen — NUNCA usar una variante no listada aquí): `BebasNeue-Regular`, `SpaceGrotesk-Regular`, `SpaceGrotesk-SemiBold`, `SpaceGrotesk-Bold`, `Inter-Regular`, `Inter-Medium`, `JetBrainsMono-Regular`, `JetBrainsMono-Medium`. No existe `Inter-Bold`/`Inter-SemiBold`/`SpaceGrotesk-Medium` — usarlas causaría fallback silencioso a la fuente del sistema.
- Escala tipográfica: `import { typography } from '@/constants/typography'` → `typography.sizes.{display:40, screenTitle:34, h1:28, h2:22, h3:18, body:16, bodySmall:14, caption:12, stat:26}`.
- Íconos: `Ionicons` de `@expo/vector-icons` — todos los nombres usados en este plan (`flame-outline`, `trending-up-outline`, `sync-outline`, `barbell-outline`, `trophy-outline`, `sparkles-outline`, `shuffle-outline`, `lock-closed-outline`, `flash-outline`, `walk-outline`, `bicycle-outline`, `water-outline`, `home-outline`, `body-outline`, `football-outline`, `mail-outline`, `checkmark`, `checkmark-circle`, `chevron-forward`, `chevron-back`) están verificados contra el glyphmap instalado (`@expo/vector-icons@15.1.1`).
- Convención de estilo por rol de texto (aplica a todos los archivos de Hilo 1):
  - Headline de pantalla: `fontFamily:'BebasNeue-Regular', fontSize: typography.sizes.screenTitle`
  - "Paso X de Y" sobre el headline: `fontFamily:'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted`
  - Subtítulo bajo el headline: `fontFamily:'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted`
  - Label de sección/pregunta (p. ej. "¿Cuál es tu nivel actual?"): `fontFamily:'SpaceGrotesk-Bold', fontSize: 16` (mismo patrón que `SectionTitle` de `app/(app)/settings/training.tsx`)
  - Título de tarjeta seleccionable: `fontFamily:'Inter-Medium', fontSize: typography.sizes.body`
  - Descripción de tarjeta seleccionable: `fontFamily:'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted`
  - Labels de campos de formulario (`Input`/`TextInput` crudo): SIN CAMBIO — `components/ui/Input.tsx` ya usa Tailwind `text-text text-sm font-medium` sin fuente custom; ese es el estándar establecido en TODA la app (incluyendo pantallas ya rediseñadas), no una fuente pendiente de armonizar.
- `day_number` en `exercise_logs`/`workout_plans.schedule` usa 1=Lunes...7=Domingo; conversión a `Date.getDay()` (0=Domingo...6=Sábado): `const jsDay = day.day_number === 7 ? 0 : day.day_number;` (patrón ya existente, no reinventar).
- Migraciones: `sg docker -c "supabase migration up"` (nunca `db reset`). Commits en español `feat(pulido):`. Rama master. Dir: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.

---

### Task 1: `constants/goals.ts` + `constants/modalities.ts` ganan `iconName`

**Files:**
- Modify: `constants/goals.ts`
- Modify: `constants/modalities.ts`

**Interfaces:**
- Produces: `GOALS[].iconName`, `MODES[].iconName`, `MODALITIES[].iconName` (tipo `ComponentProps<typeof Ionicons>['name']`) — consumidos por Tasks 3 y 4. El campo `icon` (emoji) existente NO se toca (lo sigue usando `app/(app)/settings/training.tsx`, fuera de alcance).

- [ ] **Step 1: Reescribir `constants/goals.ts`**

```typescript
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type GoalType =
  | 'weight_loss' | 'muscle_gain' | 'recomposition'
  | 'powerlifting' | 'sport_specific' | 'general_fitness';

export const GOALS: { type: GoalType; icon: string; iconName: IoniconsName; titleKey: string; descriptionKey: string }[] = [
  { type: 'weight_loss',     icon: '🔥', iconName: 'flame-outline',       titleKey: 'onboarding:goals.weight_loss.title',     descriptionKey: 'onboarding:goals.weight_loss.description' },
  { type: 'muscle_gain',     icon: '💪', iconName: 'trending-up-outline', titleKey: 'onboarding:goals.muscle_gain.title',     descriptionKey: 'onboarding:goals.muscle_gain.description' },
  { type: 'recomposition',   icon: '⚡', iconName: 'sync-outline',        titleKey: 'onboarding:goals.recomposition.title',   descriptionKey: 'onboarding:goals.recomposition.description' },
  { type: 'powerlifting',    icon: '🏋️', iconName: 'barbell-outline',     titleKey: 'onboarding:goals.powerlifting.title',    descriptionKey: 'onboarding:goals.powerlifting.description' },
  { type: 'sport_specific',  icon: '🏃', iconName: 'trophy-outline',      titleKey: 'onboarding:goals.sport_specific.title',  descriptionKey: 'onboarding:goals.sport_specific.description' },
  { type: 'general_fitness', icon: '✨', iconName: 'sparkles-outline',    titleKey: 'onboarding:goals.general_fitness.title', descriptionKey: 'onboarding:goals.general_fitness.description' },
];

export type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';

export const FITNESS_LEVELS: { value: FitnessLevel; labelKey: string; descriptionKey: string }[] = [
  { value: 'casual',       labelKey: 'onboarding:levels.casual.label',       descriptionKey: 'onboarding:levels.casual.description' },
  { value: 'intermediate', labelKey: 'onboarding:levels.intermediate.label', descriptionKey: 'onboarding:levels.intermediate.description' },
  { value: 'intensive',    labelKey: 'onboarding:levels.intensive.label',    descriptionKey: 'onboarding:levels.intensive.description' },
  { value: 'advanced',     labelKey: 'onboarding:levels.advanced.label',     descriptionKey: 'onboarding:levels.advanced.description' },
  { value: 'elite',        labelKey: 'onboarding:levels.elite.label',        descriptionKey: 'onboarding:levels.elite.description' },
];

export type TrainingMode = 'flexible' | 'strict';

export const MODES: { value: TrainingMode; labelKey: string; descriptionKey: string; icon: string; iconName: IoniconsName }[] = [
  { value: 'flexible', icon: '🌊', iconName: 'shuffle-outline',     labelKey: 'onboarding:modes.flexible.label', descriptionKey: 'onboarding:modes.flexible.description' },
  { value: 'strict',   icon: '🎯', iconName: 'lock-closed-outline', labelKey: 'onboarding:modes.strict.label',  descriptionKey: 'onboarding:modes.strict.description' },
];

export type AthleticBackground = 'none' | 'amateur' | 'high_performance' | 'bodybuilding';

export const ATHLETIC_BACKGROUNDS: { value: AthleticBackground; labelKey: string }[] = [
  { value: 'none',             labelKey: 'onboarding:step5.background.none' },
  { value: 'amateur',          labelKey: 'onboarding:step5.background.amateur' },
  { value: 'high_performance', labelKey: 'onboarding:step5.background.highPerformance' },
  { value: 'bodybuilding',     labelKey: 'onboarding:step5.background.bodybuilding' },
];

export type SupplementCode = 'creatine' | 'protein' | 'caffeine_preworkout' | 'multivitamin' | 'omega3' | 'none';

export const SUPPLEMENTS: { value: SupplementCode; labelKey: string }[] = [
  { value: 'creatine',            labelKey: 'onboarding:step5.supplements.creatine' },
  { value: 'protein',             labelKey: 'onboarding:step5.supplements.protein' },
  { value: 'caffeine_preworkout', labelKey: 'onboarding:step5.supplements.caffeine' },
  { value: 'multivitamin',        labelKey: 'onboarding:step5.supplements.multivitamin' },
  { value: 'omega3',              labelKey: 'onboarding:step5.supplements.omega3' },
  { value: 'none',                labelKey: 'onboarding:step5.supplements.none' },
];
```

- [ ] **Step 2: Reescribir `constants/modalities.ts`**

```typescript
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export type ModalityId =
  | 'gym_strength'
  | 'functional'
  | 'endurance'
  | 'cycling'
  | 'swimming'
  | 'home_calisthenics'
  | 'mobility'
  | 'ball_sports';

export interface Modality {
  id: ModalityId;
  labelKey: string;
  icon: string;
  iconName: IoniconsName;
  descriptionKey: string;
  /** Claves i18n (onboarding:modalities.<id>.presets.<n>) — resolver con t() */
  equipmentPresets: string[];
}

export const MODALITIES: Modality[] = [
  {
    id: 'gym_strength',
    labelKey: 'onboarding:modalities.gym_strength.label',
    icon: '🏋️',
    iconName: 'barbell-outline',
    descriptionKey: 'onboarding:modalities.gym_strength.description',
    equipmentPresets: ['onboarding:modalities.gym_strength.presets.0', 'onboarding:modalities.gym_strength.presets.1'],
  },
  {
    id: 'functional',
    labelKey: 'onboarding:modalities.functional.label',
    icon: '⚡',
    iconName: 'flash-outline',
    descriptionKey: 'onboarding:modalities.functional.description',
    equipmentPresets: ['onboarding:modalities.functional.presets.0', 'onboarding:modalities.functional.presets.1', 'onboarding:modalities.functional.presets.2'],
  },
  {
    id: 'endurance',
    labelKey: 'onboarding:modalities.endurance.label',
    icon: '🏃',
    iconName: 'walk-outline',
    descriptionKey: 'onboarding:modalities.endurance.description',
    equipmentPresets: ['onboarding:modalities.endurance.presets.0', 'onboarding:modalities.endurance.presets.1'],
  },
  {
    id: 'cycling',
    labelKey: 'onboarding:modalities.cycling.label',
    icon: '🚴',
    iconName: 'bicycle-outline',
    descriptionKey: 'onboarding:modalities.cycling.description',
    equipmentPresets: ['onboarding:modalities.cycling.presets.0', 'onboarding:modalities.cycling.presets.1', 'onboarding:modalities.cycling.presets.2'],
  },
  {
    id: 'swimming',
    labelKey: 'onboarding:modalities.swimming.label',
    icon: '🏊',
    iconName: 'water-outline',
    descriptionKey: 'onboarding:modalities.swimming.description',
    equipmentPresets: ['onboarding:modalities.swimming.presets.0', 'onboarding:modalities.swimming.presets.1'],
  },
  {
    id: 'home_calisthenics',
    labelKey: 'onboarding:modalities.home_calisthenics.label',
    icon: '🏠',
    iconName: 'home-outline',
    descriptionKey: 'onboarding:modalities.home_calisthenics.description',
    equipmentPresets: ['onboarding:modalities.home_calisthenics.presets.0', 'onboarding:modalities.home_calisthenics.presets.1', 'onboarding:modalities.home_calisthenics.presets.2', 'onboarding:modalities.home_calisthenics.presets.3'],
  },
  {
    id: 'mobility',
    labelKey: 'onboarding:modalities.mobility.label',
    icon: '🧘',
    iconName: 'body-outline',
    descriptionKey: 'onboarding:modalities.mobility.description',
    equipmentPresets: ['onboarding:modalities.mobility.presets.0', 'onboarding:modalities.mobility.presets.1'],
  },
  {
    id: 'ball_sports',
    labelKey: 'onboarding:modalities.ball_sports.label',
    icon: '⚽',
    iconName: 'football-outline',
    descriptionKey: 'onboarding:modalities.ball_sports.description',
    equipmentPresets: ['onboarding:modalities.ball_sports.presets.0'],
  },
];
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio (nadie más usa `iconName` todavía, así que no debería haber ningún error nuevo; `icon` sigue intacto para `training.tsx`).

- [ ] **Step 4: Commit**

```bash
git add constants/goals.ts constants/modalities.ts
git commit -m "feat(pulido): iconName (Ionicons) en GOALS/MODES/MODALITIES, sin tocar icon (emoji)"
```

---

### Task 2: Restyle `login.tsx`, `register.tsx`, `forgot-password.tsx`

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(auth)/register.tsx`
- Modify: `app/(auth)/forgot-password.tsx`

**Interfaces:**
- Consumes: ninguna de Task 1 (estos 3 archivos no usan GOALS/MODES/MODALITIES).

- [ ] **Step 1: Reescribir `app/(auth)/login.tsx`**

```tsx
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForjaWordmark } from '@/components/brand/ForjaWordmark';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

export default function LoginScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(t('login.errors.missingFields.title'), t('login.errors.missingFields.body'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          t('login.confirmEmail.title'),
          t('login.confirmEmail.body'),
          [
            { text: t('login.confirmEmail.cancel'), style: 'cancel' },
            {
              text: t('login.confirmEmail.resend'),
              onPress: async () => {
                const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email });
                Alert.alert(
                  resendErr ? t('login.confirmEmail.resendError.title') : t('login.confirmEmail.resendSuccess.title'),
                  resendErr ? t('login.confirmEmail.resendError.body') : t('login.confirmEmail.resendSuccess.body')
                );
              },
            },
          ]
        );
      } else {
        Alert.alert(t('login.errors.signInFailed.title'), error.message);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-12">
          <View className="mb-12">
            <Animated.View entering={FadeIn.duration(700)} className="items-center mb-2">
              <ForjaWordmark size="lg" />
            </Animated.View>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
              {t('tagline')}
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label={t('login.emailLabel')}
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label={t('login.passwordLabel')}
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity className="self-end">
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.accent }}>
                  {t('login.forgotPassword')}
                </Text>
              </TouchableOpacity>
            </Link>

            <Button label={t('login.submit')} loading={loading} onPress={handleLogin} className="mt-2" />
          </View>

          <View className="flex-row justify-center mt-8">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
              {t('login.noAccount')}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary, marginLeft: 4 }}>
                  {t('login.createAccount')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Reescribir `app/(auth)/register.tsx`**

```tsx
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ForjaWordmark } from '@/components/brand/ForjaWordmark';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

export default function RegisterScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) {
      Alert.alert(t('register.errors.missingFields.title'), t('register.errors.missingFields.body'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('register.errors.passwordTooShort.title'), t('register.errors.passwordTooShort.body'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: 'forja://' },
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('register.errors.signUpFailed.title'), error.message);
    } else if (!data.session) {
      // Confirmación por correo activada: no hay sesión hasta confirmar
      setSent(true);
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) Alert.alert(t('register.sent.resendError.title'), t('register.sent.resendError.body'));
    else Alert.alert(t('register.sent.resendSuccess.title'), t('register.sent.resendSuccess.body'));
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background justify-center px-5 gap-4">
        <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-outline" size={32} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, textAlign: 'center' }}>
          {t('register.sent.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center' }}>
          {t('register.sent.bodyPre')}{'\n'}
          <Text style={{ fontFamily: 'Inter-Medium', color: colors.text }}>{email}</Text>
          {'\n\n'}{t('register.sent.bodyPost')}
        </Text>
        <Button label={t('register.sent.resend')} variant="secondary" onPress={handleResend} className="mt-4" />
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity className="items-center py-3">
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary }}>
              {t('register.sent.goToLogin')}
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-12">
          <View className="mb-10">
            <Animated.View entering={FadeIn.duration(700)} className="items-center mb-2">
              <ForjaWordmark size="lg" />
            </Animated.View>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, textAlign: 'center', marginTop: 8 }}>
              {t('tagline')}
            </Text>
            <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginTop: 24 }}>
              {t('register.title')}
            </Text>
          </View>

          <View className="gap-4">
            <Input
              label={t('register.nameLabel')}
              placeholder={t('register.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Input
              label={t('register.emailLabel')}
              placeholder={t('register.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label={t('register.passwordLabel')}
              placeholder={t('register.passwordPlaceholder')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
            <Button label={t('register.submit')} loading={loading} onPress={handleRegister} className="mt-2" />
          </View>

          <View className="flex-row justify-center mt-8">
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
              {t('register.haveAccount')}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.primary, marginLeft: 4 }}>
                  {t('register.login')}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 3: Reescribir `app/(auth)/forgot-password.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (!email) {
      Alert.alert(t('forgotPassword.errors.missingEmail.title'), t('forgotPassword.errors.missingEmail.body'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'forja://reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert(t('forgotPassword.errors.resetFailed.title'), error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background justify-center px-5">
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
        </View>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginBottom: 8 }}>
          {t('forgotPassword.sent.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginBottom: 32 }}>
          {t('forgotPassword.sent.body', { email })}
        </Text>
        <Button label={t('forgotPassword.sent.backToLogin')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-5">
        <TouchableOpacity className="mb-8 self-start flex-row items-center gap-1.5" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.accent} />
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.accent }}>
            {t('forgotPassword.back')}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, marginBottom: 8 }}>
          {t('forgotPassword.title')}
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginBottom: 32 }}>
          {t('forgotPassword.body')}
        </Text>

        <View className="gap-4">
          <Input
            label={t('forgotPassword.emailLabel')}
            placeholder={t('forgotPassword.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button label={t('forgotPassword.submit')} loading={loading} onPress={handleReset} className="mt-2" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios (ninguna clave i18n nueva, solo se dejaron de usar `📬`/`✓` como texto literal).

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/login.tsx app/\(auth\)/register.tsx app/\(auth\)/forgot-password.tsx
git commit -m "feat(pulido): restyle login/registro/recuperar contraseña — Ionicons + tipografía premium"
```

---

### Task 3: Restyle `onboarding/_layout.tsx`, `step-1-goals.tsx`, `step-2-modality.tsx`

**Files:**
- Modify: `app/(auth)/onboarding/_layout.tsx`
- Modify: `app/(auth)/onboarding/step-1-goals.tsx`
- Modify: `app/(auth)/onboarding/step-2-modality.tsx`

**Interfaces:**
- Consumes: `GOALS[].iconName`, `MODALITIES[].iconName` (Task 1).

**Nota:** el `STEPS` array de `_layout.tsx` hoy solo tiene 4 entradas (falta `step-5-athletic`, agregado en Fase D) — la barra de progreso nunca llega a 100% en el paso 5. Este task lo corrige (diferido conocido desde el ledger de Fase D), y por eso los `total: 4` de `layout.stepOf` en los pasos 1-4 pasan a `total: 5`.

- [ ] **Step 1: `onboarding/_layout.tsx` — agregar step-5 al array de progreso**

```tsx
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
```

- [ ] **Step 2: Reescribir `app/(auth)/onboarding/step-1-goals.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { GOALS, type GoalType } from '@/constants/goals';

export default function Step1Goals() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [selected, setSelected] = useState<GoalType | null>(null);
  const { setStep1 } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!selected) return;
    setStep1({ goalType: selected });
    router.push('/(auth)/onboarding/step-2-modality');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 items-center mb-6">
          <VulcanoAvatar size={72} />
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text, textAlign: 'center', marginTop: 12 }}>
            {t('step1.vulcanoTitle')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
            {t('step1.vulcanoSubtitle')}
          </Text>
        </View>

        <View className="pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 1, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step1.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step1.subtitle')}
          </Text>
        </View>

        <View className="gap-3">
          {GOALS.map((goal) => {
            const isSelected = selected === goal.type;
            return (
              <TouchableOpacity
                key={goal.type}
                onPress={() => setSelected(goal.type)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={goal.iconName} size={22} color={isSelected ? colors.background : colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                      {t(goal.titleKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(goal.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={14} color={colors.background} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Botón fijo al fondo */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${selected ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: selected ? colors.background : colors.textMuted }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Reescribir `app/(auth)/onboarding/step-2-modality.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Input } from '@/components/ui/Input';

export default function Step2Modality() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [principal, setPrincipal] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const { setStep2Modality } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const needsSport = principal === 'ball_sports' || secondary.includes('ball_sports');

  function selectPrincipal(id: ModalityId) {
    setPrincipal(id);
    setSecondary((prev) => prev.filter((s) => s !== id));
  }

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleContinue() {
    if (!principal) return;
    setStep2Modality({
      modality: principal,
      secondaryModalities: secondary,
      sportType: needsSport && sportType.trim() ? sportType.trim() : null,
    });
    router.push('/(auth)/onboarding/step-3-body');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 2, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step2.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step2.subtitle')}
          </Text>
        </View>

        <View className="gap-3">
          {MODALITIES.map((m) => {
            const isSelected = principal === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => selectPrincipal(m.id)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={m.iconName} size={22} color={isSelected ? colors.background : colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                      {t(m.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(m.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={14} color={colors.background} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {principal && (
          <View className="mt-8">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
              {t('step2.secondaryTitle')}
            </Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>
              {t('step2.secondarySubtitle')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.filter((m) => m.id !== principal).map((m) => {
                const on = secondary.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleSecondary(m.id)}
                    className={`flex-row items-center gap-1.5 rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={m.iconName} size={14} color={on ? colors.primary : colors.textMuted} />
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: on ? colors.primary : colors.text }}>
                      {t(m.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {needsSport && (
          <View className="mt-6">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 8 }}>
              {t('step2.sportLabel')}
            </Text>
            <Input placeholder={t('step2.sportPlaceholder')} value={sportType} onChangeText={setSportType} />
          </View>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${principal ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!principal}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: principal ? colors.background : colors.textMuted }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/onboarding/_layout.tsx app/\(auth\)/onboarding/step-1-goals.tsx app/\(auth\)/onboarding/step-2-modality.tsx
git commit -m "feat(pulido): restyle onboarding pasos 1-2 + barra de progreso incluye paso 5"
```

---

### Task 4: Restyle `step-3-body.tsx`, `step-4-level.tsx`, `step-5-athletic.tsx`

**Files:**
- Modify: `app/(auth)/onboarding/step-3-body.tsx`
- Modify: `app/(auth)/onboarding/step-4-level.tsx`
- Modify: `app/(auth)/onboarding/step-5-athletic.tsx`

**Interfaces:**
- Consumes: `MODES[].iconName` (Task 1).

- [ ] **Step 1: Reescribir `app/(auth)/onboarding/step-3-body.tsx`**

```tsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const GENDERS: { value: Gender; labelKey: string }[] = [
  { value: 'male',              labelKey: 'step3.genders.male' },
  { value: 'female',            labelKey: 'step3.genders.female' },
  { value: 'other',             labelKey: 'step3.genders.other' },
  { value: 'prefer_not_to_say', labelKey: 'step3.genders.preferNotToSay' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; labelKey: string; descriptionKey: string }[] = [
  { value: 'sedentary',   labelKey: 'step3.activityLevels.sedentary.label',   descriptionKey: 'step3.activityLevels.sedentary.description' },
  { value: 'light',       labelKey: 'step3.activityLevels.light.label',       descriptionKey: 'step3.activityLevels.light.description' },
  { value: 'moderate',    labelKey: 'step3.activityLevels.moderate.label',    descriptionKey: 'step3.activityLevels.moderate.description' },
  { value: 'active',      labelKey: 'step3.activityLevels.active.label',      descriptionKey: 'step3.activityLevels.active.description' },
  { value: 'very_active', labelKey: 'step3.activityLevels.veryActive.label',  descriptionKey: 'step3.activityLevels.veryActive.description' },
];

export default function Step2Body() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const { setStep2 } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!weight || !height || !age || !gender || !activityLevel) {
      Alert.alert(t('step3.errors.missingFields.title'), t('step3.errors.missingFields.body'));
      return;
    }
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (isNaN(w) || w < 20 || w > 300) { Alert.alert(t('step3.errors.invalidWeight.title'), t('step3.errors.invalidWeight.body')); return; }
    if (isNaN(h) || h < 100 || h > 250) { Alert.alert(t('step3.errors.invalidHeight.title'), t('step3.errors.invalidHeight.body')); return; }
    if (isNaN(a) || a < 12 || a > 100) { Alert.alert(t('step3.errors.invalidAge.title'), t('step3.errors.invalidAge.body')); return; }

    setStep2({ weightKg: w, heightCm: h, age: a, gender, activityLevel });
    router.push('/(auth)/onboarding/step-4-level');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 3, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step3.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step3.subtitle')}
          </Text>
        </View>

        {/* Peso y altura en fila */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">{t('step3.weightLabel')}</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder={t('step3.weightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">{t('step3.heightLabel')}</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder={t('step3.heightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Edad */}
        <View className="mb-6">
          <Text className="text-text text-sm font-medium mb-2">{t('step3.ageLabel')}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
            placeholder={t('step3.agePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />
        </View>

        {/* Género */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
            {t('step3.genderLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                onPress={() => setGender(g.value)}
                className={`px-4 h-10 rounded-full border items-center justify-center ${gender === g.value ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: gender === g.value ? colors.primary : colors.text }}>
                  {t(g.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nivel de actividad */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
            {t('step3.activityLabel')}
          </Text>
          <View className="gap-2">
            {ACTIVITY_LEVELS.map((level) => {
              const isSelected = activityLevel === level.value;
              return (
                <TouchableOpacity
                  key={level.value}
                  onPress={() => setActivityLevel(level.value)}
                  className={`p-3 rounded-xl border flex-row items-center gap-3 ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                >
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                      {t(level.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(level.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={12} color={colors.background} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="bg-primary rounded-xl h-14 items-center justify-center"
          onPress={handleContinue}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Reescribir `app/(auth)/onboarding/step-4-level.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { FITNESS_LEVELS, MODES, type FitnessLevel, type TrainingMode } from '@/constants/goals';

export default function Step3Level() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useAuthStore();
  const { goalType, targetWeightKg, modality, secondaryModalities, sportType, weightKg, heightCm, age, gender, activityLevel, setGoalId } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  async function handleFinish() {
    if (!fitnessLevel || !mode) {
      Alert.alert(t('step4.errors.missingSelection.title'), t('step4.errors.missingSelection.body'));
      return;
    }
    if (!user || !goalType || !weightKg || !heightCm || !age || !gender || !activityLevel) {
      Alert.alert(t('step4.errors.missingData.title'), t('step4.errors.missingData.body'));
      return;
    }

    setLoading(true);
    try {
      // Guardar body_data
      const { error: bodyError } = await supabase.from('body_data').insert({
        user_id: user.id,
        weight_kg: weightKg,
        height_cm: heightCm,
        age,
        gender,
        activity_level: activityLevel,
      });
      if (bodyError) throw bodyError;

      // Guardar goal — se captura el id: el paso 5 (opcional) lo usa para
      // agregar athletic_background sin crear un segundo goal duplicado.
      const { data: newGoal, error: goalError } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: targetWeightKg ?? null,
        fitness_level: fitnessLevel,
        mode,
        modality,
        secondary_modalities: secondaryModalities,
        sport_type: sportType,
      }).select('id').single();
      if (goalError || !newGoal) throw goalError ?? new Error('goal insert sin id');

      setGoalId(newGoal.id);
      // onboarding_completed se marca en el paso 5 (opcional) — si se marca
      // aquí, el AuthGuard expulsa a /(app) antes de que el paso 5 renderice
      // (ver app/_layout.tsx:113, redirige tan pronto onboardingCompleted=true
      // y la ruta activa sigue en el grupo (auth)).
      router.push('/(auth)/onboarding/step-5-athletic');
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step4.errors.unknown');
      Alert.alert(t('step4.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 4, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step4.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step4.subtitle')}
          </Text>
        </View>

        {/* Nivel de fitness */}
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step4.levelQuestion')}
        </Text>
        <View className="gap-2 mb-8">
          {FITNESS_LEVELS.map((level) => {
            const isSelected = fitnessLevel === level.value;
            return (
              <TouchableOpacity
                key={level.value}
                onPress={() => setFitnessLevel(level.value)}
                className={`p-4 rounded-xl border flex-row items-center gap-3 ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <View className="flex-1">
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                    {t(level.labelKey)}
                  </Text>
                  <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                    {t(level.descriptionKey)}
                  </Text>
                </View>
                {isSelected && (
                  <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                    <Ionicons name="checkmark" size={12} color={colors.background} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Modo */}
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step4.modeQuestion')}
        </Text>
        <View className="gap-3">
          {MODES.map((m) => {
            const isSelected = mode === m.value;
            return (
              <TouchableOpacity
                key={m.value}
                onPress={() => setMode(m.value)}
                className={`p-4 rounded-2xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <View className="flex-row items-center gap-3 mb-2">
                  <Ionicons name={m.iconName} size={20} color={isSelected ? colors.primary : colors.text} />
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                    {t(m.labelKey)}
                  </Text>
                  {isSelected && (
                    <View className="ml-auto w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={12} color={colors.background} />
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted }}>
                  {t(m.descriptionKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${fitnessLevel && mode ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleFinish}
          disabled={loading || !fitnessLevel || !mode}
        >
          {loading
            ? <ActivityIndicator color={colors.background} />
            : <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: fitnessLevel && mode ? colors.background : colors.textMuted }}>
                {t('step4.finishButton')}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Reescribir `app/(auth)/onboarding/step-5-athletic.tsx`**

```tsx
import { useState } from 'react';
import { Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { ATHLETIC_BACKGROUNDS, SUPPLEMENTS, type AthleticBackground, type SupplementCode } from '@/constants/goals';
import { Input } from '@/components/ui/Input';

export default function Step5Athletic() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [background, setBackground] = useState<AthleticBackground | null>(null);
  const [supplements, setSupplements] = useState<SupplementCode[]>([]);
  const [supplementsOther, setSupplementsOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { goalId, reset } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function toggleSupplement(value: SupplementCode) {
    setSupplements((prev) => {
      if (value === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((s) => s !== 'none');
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }

  async function finishOnboarding() {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id);
    if (error) throw error;
    setCelebrating(true);
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      if (goalId && background) {
        const { error: goalError } = await supabase.from('goals').update({ athletic_background: background }).eq('id', goalId);
        if (goalError) throw goalError;
      }
      const supplementsOtherTrimmed = supplementsOther.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      if (supplements.length > 0) {
        const { error: profileError } = await supabase.from('profiles').update({
          supplements,
          supplements_other: supplementsOtherTrimmed || null,
        }).eq('id', user.id);
        if (profileError) throw profileError;
      }
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('step5.eyebrow')}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step5.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step5.subtitle')}
          </Text>
        </View>

        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step5.backgroundQuestion')}
        </Text>
        <View className="gap-2 mb-8">
          {ATHLETIC_BACKGROUNDS.map((b) => {
            const isSelected = background === b.value;
            return (
              <TouchableOpacity
                key={b.value}
                onPress={() => setBackground(b.value)}
                className={`p-4 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                  {t(b.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step5.supplementsQuestion')}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {SUPPLEMENTS.map((s) => {
            const isSelected = supplements.includes(s.value);
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => toggleSupplement(s.value)}
                className={`rounded-full px-4 py-2 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                  {t(s.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!supplements.includes('none') ? (
          <Input
            placeholder={t('step5.otherPlaceholder')}
            value={supplementsOther}
            onChangeText={setSupplementsOther}
          />
        ) : null}

        <View className="mt-6 p-3 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('step5.safetyNote')}
          </Text>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border gap-2"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="rounded-xl h-14 items-center justify-center bg-primary"
          onPress={handleFinish}
          disabled={loading || celebrating}
        >
          {loading ? <ActivityIndicator color={colors.background} /> : (
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
              {t('step5.finishButton')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading || celebrating} className="items-center py-2">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
            {t('step5.skipButton')}
          </Text>
        </TouchableOpacity>
      </View>

      <SparkBurst
        trigger={celebrating}
        onDone={() => {
          setOnboardingCompleted(true);
          reset();
          router.replace('/(app)');
        }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/onboarding/step-3-body.tsx app/\(auth\)/onboarding/step-4-level.tsx app/\(auth\)/onboarding/step-5-athletic.tsx
git commit -m "feat(pulido): restyle onboarding pasos 3-5 — tipografía premium + checkmarks Ionicons"
```

---

### Task 5: Migración `0013` — `log_date` + índice único + política UPDATE en `exercise_logs`

**Files:**
- Create: `supabase/migrations/0013_exercise_logs_identity.sql`

**Interfaces:**
- Produces: columna `exercise_logs.log_date date not null`, índice único `exercise_logs_identity_idx(user_id, workout_plan_id, day_number, exercise_order, set_number, log_date)`, política `exercise_logs_owner_update`. Consumido por Task 6 (`upsert` con `onConflict`).

**Nota importante (no está en la spec, encontrada al verificar el schema real antes de escribir este plan):** la migración `0011` solo otorgó políticas RLS de `select`/`insert` sobre `exercise_logs` — **no existe política de `update`**. Un `upsert` de Supabase se traduce a `INSERT ... ON CONFLICT DO UPDATE`, y la rama `DO UPDATE` requiere una política de `update` bajo RLS o Postgres rechaza la operación. Sin este paso, el `upsert` de Task 6 fallaría en cuanto intentara sobreescribir. Se agrega aquí.

- [ ] **Step 1: Escribir la migración**

```sql
-- Pulido: integridad de exercise_logs — sobreescribir en vez de duplicar,
-- sin destruir el historial de progresión entre semanas (day_number 1-7 se
-- repite cada semana; log_date es la fecha calendario real que desambigua
-- "el Martes de esta semana" de "el Martes de la semana pasada").

-- Deduplicar filas preexistentes ANTES de crear el índice único: como hasta
-- ahora no existía ningún constraint que lo impidiera, es posible que ya
-- haya duplicados de pruebas anteriores (Fase C). Se conserva solo la fila
-- con recorded_at más reciente por grupo — el resto se descarta.
delete from exercise_logs a using exercise_logs b
where a.user_id = b.user_id
  and a.workout_plan_id = b.workout_plan_id
  and a.day_number = b.day_number
  and a.exercise_order = b.exercise_order
  and a.set_number = b.set_number
  and a.recorded_at::date = b.recorded_at::date
  and a.recorded_at < b.recorded_at;

alter table exercise_logs add column log_date date not null default current_date;

-- Backfill: log_date = la fecha real en que se registró cada fila existente
-- (no la fecha de hoy) — evita que todo el historial preexistente colisione
-- bajo un mismo log_date al momento de correr esta migración.
update exercise_logs set log_date = recorded_at::date;

create unique index exercise_logs_identity_idx
  on exercise_logs(user_id, workout_plan_id, day_number, exercise_order, set_number, log_date);

-- Sin esta política, la rama "DO UPDATE" de un upsert falla bajo RLS: solo
-- había select/insert (migración 0011).
create policy "exercise_logs_owner_update" on exercise_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar la migración**

Run: `sg docker -c "supabase migration up"`
Expected: `Applying migration 0013_exercise_logs_identity.sql...` sin errores.

- [ ] **Step 3: Verificar en vivo**

Run:
```bash
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"select count(*) from exercise_logs;\""
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"select indexname from pg_indexes where tablename='exercise_logs' and indexname='exercise_logs_identity_idx';\""
sg docker -c "docker exec supabase_db_forja psql -U postgres -c \"select policyname, cmd from pg_policies where tablename='exercise_logs' order by cmd;\""
```
Expected: el conteo de filas es `<=` al conteo previo a la migración (el `delete` de deduplicación pudo haber reducido filas, nunca aumentarlas); `exercise_logs_identity_idx` existe; 4 políticas (`SELECT`, `INSERT`, `UPDATE`, y la que ya existía) — confirmar que ahora SÍ aparece una con `cmd = 'UPDATE'`.

- [ ] **Step 4: Regenerar tipos TypeScript**

Run: `sg docker -c "supabase gen types typescript --local"` (redirigir a `types/database.types.ts`)
Expected: `exercise_logs` incluye el campo `log_date: string` en Row/Insert/Update.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_exercise_logs_identity.sql types/database.types.ts
git commit -m "feat(pulido): migración 0013 — log_date + índice único + policy update en exercise_logs"
```

---

### Task 6: `useExerciseLogs.ts` — `insert` → `upsert` con `log_date`

**Files:**
- Modify: `hooks/useExerciseLogs.ts`
- Modify: `components/plans/ExerciseSheet.tsx`

**Interfaces:**
- Consumes: índice único `exercise_logs_identity_idx` (Task 5).
- Produces: `LogSetsInput` gana `logDate: string` (requerido) — consumido por Task 8 al agregar la confirmación `isToday` (Task 8 no cambia la forma de `LogSetsInput`, solo cuándo se llama).

- [ ] **Step 1: `hooks/useExerciseLogs.ts` — upsert**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export interface LogSetsInput {
  workoutPlanId: string;
  dayNumber: number;
  exerciseOrder: number;
  exerciseSlug: string | null;
  logDate: string; // 'YYYY-MM-DD', fecha calendario LOCAL de hoy (no la del día del plan)
  sets: { setNumber: number; kg?: number; reps?: number; bodyweightLastreKg?: number }[];
}

export function useLogExerciseSets() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogSetsInput) => {
      const recordedAt = new Date().toISOString();
      const rows = input.sets.map((s) => ({
        user_id: user!.id,
        workout_plan_id: input.workoutPlanId,
        day_number: input.dayNumber,
        exercise_order: input.exerciseOrder,
        exercise_slug: input.exerciseSlug,
        set_number: s.setNumber,
        kg: s.kg ?? null,
        reps: s.reps ?? null,
        bodyweight_lastre_kg: s.bodyweightLastreKg ?? null,
        log_date: input.logDate,
        recorded_at: recordedAt,
      }));
      const { error } = await supabase
        .from('exercise_logs')
        .upsert(rows, { onConflict: 'user_id,workout_plan_id,day_number,exercise_order,set_number,log_date' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.exerciseSlug) {
        queryClient.invalidateQueries({ queryKey: ['exercise_progression', variables.exerciseSlug] });
      }
    },
  });
}

export function useExerciseProgression(slug: string | null) {
  return useQuery({
    queryKey: ['exercise_progression', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('recorded_at, kg, reps, bodyweight_lastre_kg')
        .eq('exercise_slug', slug!)
        .order('recorded_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });
}
```

- [ ] **Step 2: `components/plans/ExerciseSheet.tsx` — calcular y enviar `logDate`**

Agregar una función `todayLogDate()` (antes de `handleSave`, dentro del componente) y usarla en `handleSave`:

```typescript
  function todayLogDate(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async function handleSave() {
    await logSets({
      workoutPlanId,
      dayNumber,
      exerciseOrder: exercise!.order,
      exerciseSlug: slug,
      logDate: todayLogDate(),
      sets: rows.map((r, i) => ({
        setNumber: i + 1,
        kg: kind === 'kg' ? r.kg : undefined,
        reps: kind !== 'none' ? r.reps : undefined,
        bodyweightLastreKg: kind === 'bodyweight' ? r.lastre : undefined,
      })),
    });
    setSaved(true);
  }
```

(el resto de `ExerciseSheet.tsx` queda intacto en este task — la confirmación `isToday` se agrega en Task 8, junto con la pantalla que la necesita).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio.

Run (curl E2E con un usuario de prueba real, JWT real — mismo patrón usado en Fases C/D):
```bash
sg docker -c "docker restart supabase_edge_runtime_forja"
```
Registrar series desde la app (o insertar directo vía `supabase.from('exercise_logs').upsert(...)` en un script de prueba) dos veces seguidas para el mismo `(user, plan, day, exercise, set, log_date)` — confirmar en DB que sigue existiendo UNA sola fila con `kg`/`reps` actualizados al segundo valor, no dos filas. Confirmar también que un tercer registro con `log_date` de OTRO día (simulando la semana siguiente) sí crea una fila nueva, no sobreescribe la anterior.

- [ ] **Step 4: Commit**

```bash
git add hooks/useExerciseLogs.ts components/plans/ExerciseSheet.tsx
git commit -m "feat(pulido): useLogExerciseSets usa upsert con log_date — sobreescribe el mismo día, preserva semanas anteriores"
```

---

### Task 7: Reestructura de rutas — `workout/[id].tsx` → `workout/[id]/index.tsx` (overview sin acordeón)

**Files:**
- Create: `app/(app)/plans/workout/[id]/index.tsx`
- Delete: `app/(app)/plans/workout/[id].tsx`

**Interfaces:**
- Produces: la URL resuelta sigue siendo `/plans/workout/:id` (expo-router resuelve `[id]/index.tsx` igual que `[id].tsx` — ningún caller externo cambia: `app/(app)/plans/index.tsx`, `app/(app)/index.tsx`, `hooks/useWorkoutPlan.ts` ya navegan por string interpolado, confirmado sin referencias a la ruta de archivo). Consumido por Task 8 (que agrega `day/[dayNumber].tsx` como hermano dentro de la misma carpeta `[id]/`).

- [ ] **Step 1: Crear `app/(app)/plans/workout/[id]/index.tsx`**

```tsx
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { StatCard } from '@/components/ui/StatCard';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';

type Exercise = {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
};

type WorkoutDay = {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus: string;
  estimated_duration_minutes: number;
  exercises: Exercise[];
};

type WorkoutPlan = {
  id: string;
  title: string;
  description: string;
  schedule: WorkoutDay[];
  weekly_schedule_summary?: string;
  duration_weeks?: number;
  progression_notes?: string;
  created_at: string;
};

type LocalizedWorkoutContent = {
  title: string;
  description: string;
  schedule: WorkoutDay[];
};

function getTodayDayIndex() {
  return new Date().getDay();
}

export default function WorkoutPlanOverviewScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const todayIndex = getTodayDayIndex();
  useHideNavWhileFocused();

  const { data: plan, isLoading } = useQuery<WorkoutPlan>({
    queryKey: ['workout_plan', id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as unknown as WorkoutPlan;
    },
  });

  const { content, isTranslating, error: translateError } = useLocalizedPlan<LocalizedWorkoutContent>(
    plan ?? null,
    'workout',
  );

  if (isLoading || (plan && isTranslating)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 12 }}>
            {isLoading ? t('workout.loading') : t('translating')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, textAlign: 'center' }}>
            {t('workout.notFound')}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 15 }}>{t('workout.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const view = content ?? { title: plan.title, description: plan.description, schedule: plan.schedule };
  const schedule: WorkoutDay[] = Array.isArray(view.schedule) ? view.schedule : [];
  const trainDays = schedule.filter((d) => !d.is_rest);
  const restDays = schedule.filter((d) => d.is_rest);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Nav bar — back button only */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Step 1: Plan title — Bebas 30px */}
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 0.5 }}>
          {view.title}
        </Text>

        {/* weekly_schedule_summary (fallback to description) */}
        {(plan.weekly_schedule_summary ?? view.description) ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {plan.weekly_schedule_summary ?? view.description}
          </Text>
        ) : null}

        {translateError ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            padding: 10,
            marginTop: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12 }}>
              {t('translateError')}
            </Text>
          </View>
        ) : null}

        {/* StatCards row */}
        <View className="flex-row gap-2.5 my-4">
          <StatCard value={String(trainDays.length)} label={t('workout.statForgeDays')} />
          <StatCard value={String(restDays.length)} label={t('workout.statRest')} />
          <StatCard value={String(plan.duration_weeks ?? 8)} label={t('workout.statWeeks')} />
        </View>

        {/* Progression notes */}
        {plan.progression_notes ? (
          <View style={{
            backgroundColor: colors.primaryDim + '30',
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.primary + '20',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, letterSpacing: 1 }}>
                {t('workout.progression')}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 }}>
              {plan.progression_notes}
            </Text>
          </View>
        ) : null}

        {/* Schedule list — overview, cada fila navega al detalle del día */}
        {schedule.map((day, index) => {
          const jsDay = day.day_number === 7 ? 0 : day.day_number;
          const isToday = jsDay === todayIndex;
          const dayLabel = t('workout.dayHeader', {
            number: day.day_number,
            focus: day.is_rest ? t('workout.restUpper') : (day.focus ?? '').toUpperCase(),
          });

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={day.is_rest ? 1 : 0.8}
              onPress={() => {
                if (!day.is_rest) router.push(`/(app)/plans/workout/${id}/day/${day.day_number}`);
              }}
              style={{
                backgroundColor: isToday ? colors.primaryDim + '40' : colors.surface,
                borderRadius: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: isToday ? colors.primary + '50' : colors.border,
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: day.is_rest
                    ? colors.surfaceElevated
                    : isToday
                    ? colors.primary
                    : colors.primaryDim + '60',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name={day.is_rest ? 'moon-outline' : 'barbell-outline'}
                    size={18}
                    color={day.is_rest ? colors.textMuted : isToday ? colors.background : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{
                      fontFamily: 'BebasNeue-Regular',
                      fontSize: typography.sizes.h2,
                      color: day.is_rest ? colors.textMuted : colors.primary,
                    }}>
                      {dayLabel}
                    </Text>
                    {isToday && (
                      <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: colors.background, fontFamily: 'SpaceGrotesk-Bold', fontSize: 10 }}>{t('workout.todayBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {!day.is_rest && (
                    <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                      {t('workout.exercisesMeta', {
                        n: day.exercises.length,
                        minutes: day.estimated_duration_minutes,
                      })}
                    </Text>
                  )}
                </View>
                {!day.is_rest && (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Borrar el archivo viejo**

```bash
git rm "app/(app)/plans/workout/[id].tsx"
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpio. Confirmar con `grep`:
```bash
grep -rn "plans/workout/\${" app/ hooks/
```
Expected: 4 coincidencias (`plans/index.tsx` ×2, `app/(app)/index.tsx` ×2, `hooks/useWorkoutPlan.ts` ×1 — en realidad 5 en total según lo verificado al escribir este plan), todas con el patrón `` `/(app)/plans/workout/${...}` `` sin `/index` explícito al final — ninguna necesita cambio porque expo-router resuelve `[id]/index.tsx` a la misma URL que `[id].tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/plans/workout/[id]/index.tsx"
git commit -m "feat(pulido): workout/[id] pasa a carpeta — overview sin acordeón, navega al detalle del día"
```

---

### Task 8: Pantalla de detalle `workout/[id]/day/[dayNumber].tsx` + confirmación `isToday` en `ExerciseSheet`

**Files:**
- Create: `app/(app)/plans/workout/[id]/day/[dayNumber].tsx`
- Modify: `components/plans/ExerciseSheet.tsx`
- Modify: `locales/es/plans.json`, `locales/en/plans.json`

**Interfaces:**
- Consumes: `LogSetsInput.logDate` (Task 6), estructura de carpeta `workout/[id]/` (Task 7).
- Produces: `ExerciseSheetProps` gana `isToday: boolean` (requerido) — el único caller de `ExerciseSheet` en todo el repo es este archivo nuevo, así que no hay otro sitio a actualizar.

- [ ] **Step 1: Claves i18n nuevas (es+en)**

En `locales/es/plans.json`, agregar dentro de `"workout": {...}` (junto a `"dayHeader"`):

```json
  "dayNumber": "DÍA {{number}}",
  "logConfirm": {
    "title": "¿Registrar en otro día?",
    "body": "Estás guardando series para un día distinto al de hoy. ¿Confirmas?",
    "cancel": "Cancelar",
    "confirm": "Confirmar"
  },
```

En `locales/en/plans.json`, dentro de `"workout": {...}`:

```json
  "dayNumber": "DAY {{number}}",
  "logConfirm": {
    "title": "Log for a different day?",
    "body": "You're saving sets for a day other than today. Confirm?",
    "cancel": "Cancel",
    "confirm": "Confirm"
  },
```

- [ ] **Step 2: Crear `app/(app)/plans/workout/[id]/day/[dayNumber].tsx`**

```tsx
import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
import { ExerciseSheet } from '@/components/plans/ExerciseSheet';

type Exercise = {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
};

type WorkoutDay = {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus: string;
  estimated_duration_minutes: number;
  exercises: Exercise[];
};

type WorkoutPlan = {
  id: string;
  title: string;
  description: string;
  schedule: WorkoutDay[];
  created_at: string;
};

type LocalizedWorkoutContent = {
  title: string;
  description: string;
  schedule: WorkoutDay[];
};

function getTodayDayIndex() {
  return new Date().getDay();
}

export default function WorkoutDayDetailScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { id, dayNumber } = useLocalSearchParams<{ id: string; dayNumber: string }>();
  const { user } = useAuthStore();
  const exerciseSheetRef = useRef<BottomSheet>(null);
  const [activeExercise, setActiveExercise] = useState<{ exercise: Exercise; exerciseIndex: number } | null>(null);
  useHideNavWhileFocused();

  const { data: plan, isLoading } = useQuery<WorkoutPlan>({
    queryKey: ['workout_plan', id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as unknown as WorkoutPlan;
    },
  });

  const { content, isTranslating } = useLocalizedPlan<LocalizedWorkoutContent>(plan ?? null, 'workout');

  if (isLoading || (plan && isTranslating)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const schedule: WorkoutDay[] = Array.isArray(content?.schedule) ? content!.schedule : (plan?.schedule ?? []);
  const day = schedule.find((d) => d.day_number === Number(dayNumber));

  if (!plan || !day) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, textAlign: 'center' }}>
            {t('workout.notFound')}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 15 }}>{t('workout.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const jsDay = day.day_number === 7 ? 0 : day.day_number;
  const isToday = jsDay === getTodayDayIndex();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.display, color: colors.primary, letterSpacing: 0.5 }}>
          {t('workout.dayNumber', { number: day.day_number })}
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h1, color: colors.text, marginTop: 2 }}>
          {(day.focus ?? '').toUpperCase()}
        </Text>
        {isToday && (
          <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 8 }}>
            <Text style={{ color: colors.background, fontFamily: 'SpaceGrotesk-Bold', fontSize: 10 }}>{t('workout.todayBadge')}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 20 }}>
          <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: colors.accent }}>
              {t('workout.exercisesMeta', { n: day.exercises.length, minutes: day.estimated_duration_minutes })}
            </Text>
          </View>
        </View>

        {day.exercises.map((ex, ei) => (
          <StaggerIn key={ei} index={ei}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setActiveExercise({ exercise: ex, exerciseIndex: ei });
                exerciseSheetRef.current?.expand();
              }}
            >
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: colors.border,
              }}>
                <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 16, color: colors.textFaint, minWidth: 22 }}>
                  {String(ex.order ?? ei + 1).padStart(2, '0')}
                </Text>
                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                  {ex.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.accent }}>
                      {ex.sets}×{ex.reps}
                    </Text>
                  </View>
                  {ex.rest_seconds ? (
                    <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.accent }}>
                        {ex.rest_seconds}s
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={10} color={colors.primary} style={{ marginLeft: 1 }} />
                  </View>
                </View>
              </View>
              {ex.technique_notes ? (
                <Text style={{
                  fontFamily: 'Inter-Regular', fontSize: 12, fontStyle: 'italic', color: colors.textMuted,
                  paddingTop: 4, paddingBottom: 2, paddingLeft: 32,
                }}>
                  {ex.technique_notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          </StaggerIn>
        ))}
      </ScrollView>

      <ExerciseSheet
        ref={exerciseSheetRef}
        exercise={activeExercise?.exercise ?? null}
        workoutPlanId={plan.id}
        dayNumber={day.day_number}
        exerciseIndex={activeExercise?.exerciseIndex ?? 0}
        isToday={isToday}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: `ExerciseSheet.tsx` — prop `isToday` + confirmación antes de guardar**

Cambiar la interfaz de props (agregar `isToday: boolean`) y la desestructuración:

```typescript
interface ExerciseSheetProps {
  exercise: ScheduleExercise | null;
  workoutPlanId: string;
  dayNumber: number;
  exerciseIndex: number;
  isToday: boolean;
}
```

```typescript
export const ExerciseSheet = forwardRef<BottomSheet, ExerciseSheetProps>(function ExerciseSheet(
  { exercise, workoutPlanId, dayNumber, exerciseIndex, isToday },
  ref,
) {
```

Agregar `Alert` al import de `react-native` (línea 2 actual pasa de `import { ActivityIndicator, Image, Text, View } from 'react-native';` a incluir `Alert`):

```typescript
import { ActivityIndicator, Alert, Image, Text, View } from 'react-native';
```

Reemplazar `handleSave` (la versión de Task 6, que ya calcula `logDate`) por una versión que separa el guardado real (`performSave`) del disparador (`handleSave`, que confirma si `!isToday`):

```typescript
  async function performSave() {
    await logSets({
      workoutPlanId,
      dayNumber,
      exerciseOrder: exercise!.order,
      exerciseSlug: slug,
      logDate: todayLogDate(),
      sets: rows.map((r, i) => ({
        setNumber: i + 1,
        kg: kind === 'kg' ? r.kg : undefined,
        reps: kind !== 'none' ? r.reps : undefined,
        bodyweightLastreKg: kind === 'bodyweight' ? r.lastre : undefined,
      })),
    });
    setSaved(true);
  }

  function handleSave() {
    if (!isToday) {
      Alert.alert(
        t('workout.logConfirm.title'),
        t('workout.logConfirm.body'),
        [
          { text: t('workout.logConfirm.cancel'), style: 'cancel' },
          { text: t('workout.logConfirm.confirm'), onPress: () => { void performSave(); } },
        ],
      );
      return;
    }
    void performSave();
  }
```

(`onTouchEnd={handleSave}` en el JSX del botón de guardar NO cambia — sigue apuntando a `handleSave`, que ahora es síncrono y decide internamente si confirma o guarda directo).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/plans/workout/[id]/day/[dayNumber].tsx" components/plans/ExerciseSheet.tsx locales/es/plans.json locales/en/plans.json
git commit -m "feat(pulido): pantalla de detalle del día (número gigante + StaggerIn) + confirmación al guardar en día no-actual"
```

---

### Task 9: Verificación final + docs + review de rama

**Files:**
- Modify: `forja-docs.md`

- [ ] **Step 1: Verificación estática completa**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos limpios. (No hay tests Deno en esta fase — ningún Edge Function fue tocado; el proyecto RN no tiene test runner configurado, mismo patrón que todas las fases anteriores de este rediseño.)

- [ ] **Step 2: Documentar** — agregar al final de `forja-docs.md`:

```markdown
## Pulido: restyle auth/onboarding + vista de entrenamiento + integridad de exercise_logs

`app/(auth)/` (login, registro, recuperar contraseña, 5 pasos de onboarding) migró de
emojis/Tailwind genérico al sistema de diseño de las Fases A-D: `Ionicons` en vez de
emojis (`GOALS`/`MODES`/`MODALITIES` ganaron `iconName` sin tocar el campo `icon` legado,
que sigue usando `settings/training.tsx`), y la escala de `constants/typography.ts` en
headlines/labels/tarjetas de selección. La barra de progreso del onboarding ahora
incluye el paso 5 (diferido de Fase D cerrado).

`app/(app)/plans/workout/[id].tsx` se dividió en `[id]/index.tsx` (overview de 7 días,
sin acordeón, tipografía elevada) y `[id]/day/[dayNumber].tsx` (detalle nuevo: número de
día gigante en Bebas, focus como statement, ejercicios con `StaggerIn` — fiel a la spec
v7 original). `exercise_logs` ganó `log_date` (migración `0013`) + índice único
`(user_id, workout_plan_id, day_number, exercise_order, set_number, log_date)` + policy
`update` (faltaba desde la migración `0011`) — `useLogExerciseSets` pasó de `insert` a
`upsert`: reabrir el mismo ejercicio el mismo día calendario sobreescribe en vez de
duplicar, y semanas distintas (mismo `day_number`, `log_date` distinto) preservan el
historial de progresión intacto. `ExerciseSheet` muestra una confirmación antes de
guardar en un día que no es el actual (`isToday`, calculado en la pantalla de detalle).
Spec: `docs/superpowers/specs/2026-07-15-auth-workout-polish-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add forja-docs.md
git commit -m "docs: pulido de auth/onboarding + vista de entrenamiento en forja-docs"
```

- [ ] **Step 4: E2E humano en Expo Go (lo ejecuta el usuario)**

1. Login/registro/onboarding completo (crear cuenta nueva) → confirmar visualmente que no queda ningún emoji, que los íconos de objetivo/modalidad/modo se ven coherentes con el resto de la app, y que la barra de progreso llega a 100% en el paso 5 (con o sin "Omitir").
2. Plan de entrenamiento → la lista de 7 días se ve con tipografía elevada, sin acordeón — tocar un día navega a una pantalla nueva con el número de día gigante.
3. En el detalle de un día, tocar un ejercicio → se abre la ficha igual que antes (sin cambios visuales en el sheet en sí).
4. Registrar series en el día de HOY → guarda directo, sin confirmación.
5. Navegar a un día que NO es hoy → registrar series → aparece la confirmación → cancelar (no se guarda) y luego confirmar (sí se guarda).
6. Reabrir el mismo ejercicio del mismo día (mismo momento) y volver a guardar con valores distintos → confirmar que solo hay UN registro (el más reciente), no dos.
7. Si es posible probar en dos sesiones con fechas distintas (o verificar directo en DB): confirmar que el registro de "hoy" no sobreescribió el de una semana anterior para el mismo `day_number`.

No commitear nada aquí; fallos se abren como fixes puntuales.
