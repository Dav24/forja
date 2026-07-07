# Ajustes de Cuenta y Personalización de Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perfil enriquecido (foto, racha, stats, objetivo activo) + área completa de Ajustes (cuenta, mi entrenamiento, notificaciones, idioma, suscripción, legal, soporte, eliminar cuenta) + verificación de correo en el registro.

**Architecture:** Stack anidado `app/(app)/settings/` (patrón `href: null` como `upgrade.tsx`), hooks nuevos (`useProfileStats`, `useAvatarUpload`), 2 migraciones (0007 prefs de notif, 0008 bucket avatars), 1 Edge Function nueva (`delete-account`, TDD con Deno) y modificación de `send-notifications` para respetar preferencias.

**Tech Stack:** Expo SDK 56 + Expo Router, NativeWind v4, TanStack Query v5, Supabase (DB/Auth/Storage/EFs Deno), Stripe API (cancelación).

**Spec:** `docs/superpowers/specs/2026-07-07-account-settings-design.md`

## Global Constraints

- **NativeWind v4:** estático → `className`; dinámico/colores del design system/fontFamily → `style`. Colores SIEMPRE desde `constants/colors.ts`.
- **Deps nativas SIEMPRE con `npx expo install`** (nunca npm/pnpm add).
- **Nunca funciones JS dentro de `useAnimatedStyle`** (regla Reanimated — crashea en runtime, tsc no lo ve).
- **Leer docs Expo SDK 56 versionadas** (https://docs.expo.dev/versions/v56.0.0/) antes de usar APIs de expo-image-picker/expo-image-manipulator — la API cambió vs versiones viejas (AGENTS.md).
- **Copy en español**, tono Forja. i18n llega en Paso 14 — strings hardcodeados como el resto de la app.
- **Supabase local debe estar corriendo:** `sg docker -c "supabase start"` desde `forja/`. Keys en `forja/.env.local`, secrets EF en `forja/supabase/.env`.
- **Tests de app:** el proyecto NO tiene runner JS para RN — la verificación de app es `npx tsc --noEmit` + verificación manual. TDD real aplica en las EFs (Deno, patrón `stripe-webhook/status.test.ts`).
- **Commit al final de cada tarea.** Trabajar en `master`.
- Rutas relativas al repo `forja/` salvo indicación.

---

### Task 1: Dependencias nativas + constantes de configuración

**Files:**
- Modify: `package.json` (vía expo install), `app.json`
- Create: `lib/config.ts`

**Interfaces:**
- Produces: `SUPPORT_EMAIL: string`, `PRIVACY_URL: string`, `TERMS_URL: string` desde `@/lib/config` (URLs vacías = fila legal oculta).

- [ ] **Step 1: Instalar dependencias nativas**

```bash
cd "/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja"
npx expo install expo-image-picker expo-image-manipulator expo-image expo-application
```

Expected: las 4 deps agregadas a `package.json` con versiones `~56.x`/compatibles SDK 56.

- [ ] **Step 2: Registrar plugin de permisos en app.json**

En `app.json`, dentro de `expo.plugins` (array existente), agregar:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "Forja usa tus fotos para que elijas tu foto de perfil."
  }
]
```

(En Expo Go el permiso lo gestiona la app contenedora; esto aplica al dev build futuro.)

- [ ] **Step 3: Crear lib/config.ts**

```ts
// Configuración externa de la app. URLs vacías = la UI oculta la fila correspondiente.
export const SUPPORT_EMAIL = 'dav.ro.re2@gmail.com'; // cambiar a soporte@forja.fit con el dominio
export const PRIVACY_URL = ''; // pendiente: dominio + textos legales
export const TERMS_URL = '';   // pendiente: dominio + textos legales
```

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json lib/config.ts
git commit -m "feat: deps para foto de perfil + constantes de config (soporte/legal)"
```

---

### Task 2: Migración 0007 — preferencias de notificaciones

**Files:**
- Create: `supabase/migrations/0007_notification_prefs.sql`
- Modify: `types/database.types.ts` (tipo de `profiles`)

**Interfaces:**
- Produces: columnas `profiles.notif_reminders` y `profiles.notif_updates` (boolean, default true); `get_notification_targets()` ahora devuelve ambas.

- [ ] **Step 1: Escribir la migración**

`supabase/migrations/0007_notification_prefs.sql`:

```sql
-- Preferencias de notificaciones push (2 grupos, no 5 toggles):
-- reminders = missed_workout + diet_alert | updates = progress_update + goal_milestone + plan_ready
ALTER TABLE profiles ADD COLUMN notif_reminders BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN notif_updates   BOOLEAN NOT NULL DEFAULT TRUE;

-- Redefinir para exponer las preferencias al worker de notificaciones.
DROP FUNCTION IF EXISTS get_notification_targets();
CREATE FUNCTION get_notification_targets()
RETURNS TABLE (
  user_id           UUID,
  expo_push_token   TEXT,
  plan              TEXT,
  sub_status        TEXT,
  current_period_end TIMESTAMPTZ,
  goal_type         TEXT,
  target_weight_kg  NUMERIC,
  target_date       DATE,
  last_activity     TIMESTAMPTZ,
  first_weight      NUMERIC,
  current_weight    NUMERIC,
  notif_reminders   BOOLEAN,
  notif_updates     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_body AS (
    SELECT DISTINCT ON (user_id) user_id, recorded_at AS last_body_at
    FROM body_data ORDER BY user_id, recorded_at DESC
  ),
  last_chat AS (
    SELECT user_id, MAX(date)::TIMESTAMPTZ AS last_chat_at
    FROM daily_message_count GROUP BY user_id
  ),
  first_weight AS (
    SELECT DISTINCT ON (user_id) user_id, weight_kg
    FROM body_data WHERE weight_kg IS NOT NULL ORDER BY user_id, recorded_at ASC
  ),
  latest_weight AS (
    SELECT DISTINCT ON (user_id) user_id, weight_kg
    FROM body_data WHERE weight_kg IS NOT NULL ORDER BY user_id, recorded_at DESC
  ),
  active_goal AS (
    SELECT DISTINCT ON (user_id) user_id, type, target_weight_kg, target_date
    FROM goals WHERE is_active = TRUE ORDER BY user_id, created_at DESC
  )
  SELECT
    p.id AS user_id,
    p.expo_push_token,
    COALESCE(s.plan, 'free') AS plan,
    COALESCE(s.status, 'active') AS sub_status,
    s.current_period_end,
    g.type AS goal_type,
    g.target_weight_kg,
    g.target_date,
    GREATEST(lb.last_body_at, lc.last_chat_at) AS last_activity,
    fw.weight_kg AS first_weight,
    lw.weight_kg AS current_weight,
    p.notif_reminders,
    p.notif_updates
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  LEFT JOIN active_goal g ON g.user_id = p.id
  LEFT JOIN last_body lb ON lb.user_id = p.id
  LEFT JOIN last_chat lc ON lc.user_id = p.id
  LEFT JOIN first_weight fw ON fw.user_id = p.id
  LEFT JOIN latest_weight lw ON lw.user_id = p.id
  WHERE p.expo_push_token IS NOT NULL
    AND (p.notif_reminders OR p.notif_updates);
$$;

REVOKE ALL ON FUNCTION get_notification_targets() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_notification_targets() TO service_role;
```

- [ ] **Step 2: Aplicar la migración**

```bash
sg docker -c "supabase migration up"
```

Expected: `Applying migration 0007_notification_prefs.sql...` sin errores.

- [ ] **Step 3: Verificar columnas vía REST**

```bash
source .env.local 2>/dev/null; ANON="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-$(grep SUPABASE_ANON .env.local | cut -d= -f2)}"
curl -s "http://127.0.0.1:54321/rest/v1/profiles?select=notif_reminders,notif_updates&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Expected: `[]` o `[{"notif_reminders":true,"notif_updates":true}]` — sin error de "column does not exist".

- [ ] **Step 4: Actualizar types/database.types.ts**

Localizar el tipo de `profiles` (`grep -n "notif\|avatar_url" types/database.types.ts`) y agregar en `Row`, `Insert` y `Update` de `profiles`:

```ts
notif_reminders: boolean
notif_updates: boolean
```

(en `Insert`/`Update` como opcionales: `notif_reminders?: boolean`). Verificar con `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_notification_prefs.sql types/database.types.ts
git commit -m "feat: preferencias de notificaciones en profiles + RPC actualizada"
```

---

### Task 3: send-notifications respeta las preferencias (TDD)

**Files:**
- Create: `supabase/functions/send-notifications/prefs.ts`
- Test: `supabase/functions/send-notifications/prefs.test.ts`
- Modify: `supabase/functions/send-notifications/index.ts`

**Interfaces:**
- Consumes: columnas `notif_reminders`/`notif_updates` del RPC (Task 2).
- Produces: `passesPrefs(type: NotifType, prefs: { notif_reminders: boolean; notif_updates: boolean }): boolean`.

- [ ] **Step 1: Escribir el test que falla**

`supabase/functions/send-notifications/prefs.test.ts`:

```ts
import { assertEquals } from 'jsr:@std/assert';
import { passesPrefs } from './prefs.ts';

Deno.test('reminders controla missed_workout y diet_alert', () => {
  const on = { notif_reminders: true, notif_updates: false };
  const off = { notif_reminders: false, notif_updates: true };
  assertEquals(passesPrefs('missed_workout', on), true);
  assertEquals(passesPrefs('diet_alert', on), true);
  assertEquals(passesPrefs('missed_workout', off), false);
  assertEquals(passesPrefs('diet_alert', off), false);
});

Deno.test('updates controla progress_update, goal_milestone y plan_ready', () => {
  const on = { notif_reminders: false, notif_updates: true };
  const off = { notif_reminders: true, notif_updates: false };
  assertEquals(passesPrefs('progress_update', on), true);
  assertEquals(passesPrefs('goal_milestone', on), true);
  assertEquals(passesPrefs('plan_ready', on), true);
  assertEquals(passesPrefs('progress_update', off), false);
  assertEquals(passesPrefs('goal_milestone', off), false);
  assertEquals(passesPrefs('plan_ready', off), false);
});
```

- [ ] **Step 2: Correr el test — debe fallar**

```bash
cd supabase/functions && deno test send-notifications/prefs.test.ts
```

Expected: FAIL — `Module not found ... prefs.ts`.

- [ ] **Step 3: Implementar prefs.ts**

```ts
export type NotifType =
  | 'missed_workout'
  | 'diet_alert'
  | 'progress_update'
  | 'goal_milestone'
  | 'plan_ready';

export interface NotifPrefs {
  notif_reminders: boolean;
  notif_updates: boolean;
}

export function passesPrefs(type: NotifType, prefs: NotifPrefs): boolean {
  if (type === 'missed_workout' || type === 'diet_alert') return prefs.notif_reminders;
  return prefs.notif_updates;
}
```

- [ ] **Step 4: Correr el test — debe pasar**

```bash
cd supabase/functions && deno test send-notifications/prefs.test.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Cablear en index.ts**

En `supabase/functions/send-notifications/index.ts`:

a) Agregar al final de la interfaz `NotificationTarget` (línea ~15):

```ts
  notif_reminders: boolean;
  notif_updates: boolean;
```

b) Importar arriba: `import { passesPrefs } from './prefs.ts';`

c) En el loop de selección (línea ~188), cambiar:

```ts
  for (const target of targets) {
    const payload = decideNotification(target);
    if (payload) selected.push({ target, payload });
  }
```

por:

```ts
  for (const target of targets) {
    const payload = decideNotification(target);
    if (payload && passesPrefs(payload.type, target)) selected.push({ target, payload });
  }
```

- [ ] **Step 6: Correr TODOS los tests de functions**

```bash
cd supabase/functions && deno test .
```

Expected: todos PASS (incluye `stripe-webhook/status.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/send-notifications/
git commit -m "feat: send-notifications respeta preferencias del usuario (TDD)"
```

---

### Task 4: Migración 0008 — bucket avatars con RLS

**Files:**
- Create: `supabase/migrations/0008_avatars_bucket.sql`

**Interfaces:**
- Produces: bucket público `avatars`; el dueño escribe/borra solo `{uid}.jpg`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Bucket público para fotos de perfil. Lectura pública (no es dato sensible);
-- escritura solo del dueño sobre su propio archivo {uid}.jpg.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg');

CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg')
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg');

CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg');
```

- [ ] **Step 2: Aplicar y verificar**

```bash
sg docker -c "supabase migration up"
curl -s "http://127.0.0.1:54321/storage/v1/bucket/avatars" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" | head -c 200
```

Expected: JSON del bucket con `"public":true` (o aplicar y verificar que la migración corre sin error; el GET de bucket puede requerir service key — alternativa: `curl -s "http://127.0.0.1:54321/storage/v1/object/public/avatars/noexiste.jpg"` debe responder 404 de objeto, no de bucket).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_avatars_bucket.sql
git commit -m "feat: bucket avatars con RLS (lectura pública, escritura del dueño)"
```

---

### Task 5: Hooks — useProfileStats y useAvatarUpload

**Files:**
- Create: `hooks/useProfileStats.ts`, `hooks/useAvatarUpload.ts`
- Modify: `hooks/useProfile.ts` (ampliar tipo de updates)

**Interfaces:**
- Produces: `useProfileStats(): { data?: { plansGenerated: number; bodyRecords: number } }`; `useAvatarUpload(): { pickAndUpload: () => Promise<void>; uploading: boolean; error: string | null; permissionDenied: boolean }`.
- `useUpdateProfile` acepta ahora `avatar_url`, `notif_reminders`, `notif_updates`.

- [ ] **Step 1: Ampliar useUpdateProfile**

En `hooks/useProfile.ts`, cambiar el tipo del parámetro de `mutationFn`:

```ts
    mutationFn: async (updates: {
      display_name?: string;
      language?: string;
      expo_push_token?: string;
      avatar_url?: string;
      notif_reminders?: boolean;
      notif_updates?: boolean;
    }) => {
```

- [ ] **Step 2: Crear hooks/useProfileStats.ts**

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

async function countRows(table: 'workout_plans' | 'meal_plans' | 'body_data', userId: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export function useProfileStats() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['profile-stats', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [workouts, meals, bodyRecords] = await Promise.all([
        countRows('workout_plans', user!.id),
        countRows('meal_plans', user!.id),
        countRows('body_data', user!.id),
      ]);
      return { plansGenerated: workouts + meals, bodyRecords };
    },
  });
}
```

- [ ] **Step 3: Crear hooks/useAvatarUpload.ts**

> Verificar la API exacta de `expo-image-manipulator` en https://docs.expo.dev/versions/v56.0.0/sdk/imagemanipulator/ — SDK 56 usa la API de contexto (`ImageManipulator.manipulate`); si el docs muestra otra firma, adaptar este bloque a la firma documentada manteniendo el flujo (resize 512 → JPEG comprimido → base64).

```ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useAvatarUpload() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function pickAndUpload() {
    if (!user) return;
    setError(null);
    setPermissionDenied(false);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermissionDenied(true);
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (picked.canceled) return;

    setUploading(true);
    try {
      const ctx = ImageManipulator.manipulate(picked.assets[0].uri);
      ctx.resize({ width: 512, height: 512 });
      const rendered = await ctx.renderAsync();
      const saved = await rendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      });

      const bytes = Buffer.from(saved.base64!, 'base64');
      const path = `${user.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (profErr) throw profErr;

      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      setError('No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUpload, uploading, error, permissionDenied };
}
```

- [ ] **Step 4: Verificar y commitear**

```bash
npx tsc --noEmit
git add hooks/useProfileStats.ts hooks/useAvatarUpload.ts hooks/useProfile.ts
git commit -m "feat: hooks useProfileStats y useAvatarUpload"
```

---

### Task 6: Constantes compartidas de objetivo/nivel/modo (refactor DRY)

**Files:**
- Create: `constants/goals.ts`
- Modify: `app/(auth)/onboarding/step-1-goals.tsx`, `app/(auth)/onboarding/step-4-level.tsx`

**Interfaces:**
- Produces: `GOALS`, `FITNESS_LEVELS`, `MODES` + tipos `GoalType`, `FitnessLevel`, `TrainingMode` desde `@/constants/goals` (los consume Task 10 training.tsx).

- [ ] **Step 1: Crear constants/goals.ts**

Mover las definiciones EXACTAS que hoy viven inline (copiar de `step-1-goals.tsx` líneas 8-18 y `step-4-level.tsx` líneas 12-26, sin cambiar labels ni descripciones):

```ts
export type GoalType =
  | 'weight_loss' | 'muscle_gain' | 'recomposition'
  | 'powerlifting' | 'sport_specific' | 'general_fitness';

export const GOALS: { type: GoalType; icon: string; title: string; description: string }[] = [
  { type: 'weight_loss',     icon: '🔥', title: 'Bajar de peso',      description: 'Perder grasa y mejorar composición corporal' },
  { type: 'muscle_gain',     icon: '💪', title: 'Ganar músculo',       description: 'Aumentar masa muscular y fuerza' },
  { type: 'recomposition',   icon: '⚡', title: 'Recomposición',       description: 'Perder grasa y ganar músculo simultáneamente' },
  { type: 'powerlifting',    icon: '🏋️', title: 'Powerlifting',        description: 'Maximizar fuerza en sentadilla, press y peso muerto' },
  { type: 'sport_specific',  icon: '🏃', title: 'Deporte específico',  description: 'Rendimiento para tu deporte o disciplina' },
  { type: 'general_fitness', icon: '✨', title: 'Fitness general',     description: 'Mejorar salud, energía y bienestar general' },
];

export type FitnessLevel = 'casual' | 'intermediate' | 'intensive' | 'advanced' | 'elite';

export const FITNESS_LEVELS: { value: FitnessLevel; label: string; description: string }[] = [
  { value: 'casual',       label: 'Casual',     description: 'Entreno esporádicamente o soy principiante' },
  { value: 'intermediate', label: 'Intermedio', description: 'Entreno regularmente desde hace meses' },
  { value: 'intensive',    label: 'Intensivo',  description: 'Entreno con seriedad, varias veces a la semana' },
  { value: 'advanced',     label: 'Avanzado',   description: 'Años de entrenamiento consistente' },
  { value: 'elite',        label: 'Élite',      description: 'Atleta competitivo o de alto rendimiento' },
];

export type TrainingMode = 'flexible' | 'strict';

export const MODES: { value: TrainingMode; label: string; description: string; icon: string }[] = [
  { value: 'flexible', icon: '🌊', label: 'Flexible', description: 'Me adapto cuando la vida se complica. Prefiero consistencia a perfección.' },
  { value: 'strict',   icon: '🎯', label: 'Estricto', description: 'Me comprometo al 100%. Sin excusas, sin saltarme sesiones.' },
];
```

- [ ] **Step 2: Actualizar los dos pasos de onboarding para importar**

En `step-1-goals.tsx`: borrar el type `GoalType` y el array `GOALS` locales; agregar `import { GOALS, type GoalType } from '@/constants/goals';`.

En `step-4-level.tsx`: borrar `FitnessLevel`, `Mode`, `FITNESS_LEVELS`, `MODES` locales; agregar `import { FITNESS_LEVELS, MODES, type FitnessLevel, type TrainingMode } from '@/constants/goals';` y renombrar los usos de `Mode` → `TrainingMode`.

- [ ] **Step 3: Verificar y commitear**

```bash
npx tsc --noEmit
git add constants/goals.ts "app/(auth)/onboarding/step-1-goals.tsx" "app/(auth)/onboarding/step-4-level.tsx"
git commit -m "refactor: objetivos/niveles/modos a constants compartidas"
```

---

### Task 7: SettingsRow + stack de Ajustes + hub

**Files:**
- Create: `components/settings/SettingsRow.tsx`, `app/(app)/settings/_layout.tsx`, `app/(app)/settings/index.tsx`
- Modify: `app/(app)/_layout.tsx` (registrar `settings` con `href: null`)

**Interfaces:**
- Produces: `SettingsRow({ icon, label, value?, onPress?, danger?, rightElement? })`; rutas `/(app)/settings`, `/(app)/settings/account`, `/(app)/settings/training`, `/(app)/settings/notifications`, `/(app)/settings/language`, `/(app)/settings/subscription`, `/(app)/settings/delete-account`.
- Consumes: `SUPPORT_EMAIL`, `PRIVACY_URL`, `TERMS_URL` (Task 1).

- [ ] **Step 1: Crear components/settings/SettingsRow.tsx**

```tsx
import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: ReactNode; // p.ej. un Switch — reemplaza al chevron
}

export function SettingsRow({ icon, label, value, onPress, danger, rightElement }: SettingsRowProps) {
  const tint = danger ? colors.destructive : colors.textMuted;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 px-4 py-3.5 bg-surface"
    >
      <Ionicons name={icon} size={20} color={danger ? colors.destructive : colors.primary} />
      <Text
        className="flex-1"
        style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: danger ? colors.destructive : colors.text }}
      >
        {label}
      </Text>
      {value ? (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>{value}</Text>
      ) : null}
      {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={tint} /> : null)}
    </TouchableOpacity>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      {title ? (
        <Text
          className="px-4 mb-2"
          style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View className="rounded-2xl overflow-hidden border border-border">{children}</View>
    </View>
  );
}
```

- [ ] **Step 2: Crear app/(app)/settings/_layout.tsx**

```tsx
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Registrar en el tab bar**

En `app/(app)/_layout.tsx`, junto a los `Tabs.Screen` de `upgrade`/`success`:

```tsx
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
```

- [ ] **Step 4: Crear app/(app)/settings/index.tsx (hub)**

```tsx
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';
import { useSubscription, useIsPremium } from '@/hooks/useSubscription';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { colors } from '@/constants/colors';

export default function SettingsScreen() {
  const isPremium = useIsPremium();
  useSubscription(); // precalienta la query para la subpantalla

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Ajustes
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <SettingsGroup title="Cuenta">
          <SettingsRow icon="person-outline" label="Cuenta" onPress={() => router.push('/(app)/settings/account' as never)} />
          <SettingsRow icon="barbell-outline" label="Mi entrenamiento" onPress={() => router.push('/(app)/settings/training' as never)} />
        </SettingsGroup>

        <SettingsGroup title="Preferencias">
          <SettingsRow icon="notifications-outline" label="Notificaciones" onPress={() => router.push('/(app)/settings/notifications' as never)} />
          <SettingsRow icon="globe-outline" label="Idioma" value="Español" onPress={() => router.push('/(app)/settings/language' as never)} />
        </SettingsGroup>

        <SettingsGroup title="Suscripción">
          <SettingsRow
            icon="diamond-outline"
            label="Suscripción"
            value={isPremium ? 'Maestro Forjador' : 'Aprendiz'}
            onPress={() => router.push('/(app)/settings/subscription' as never)}
          />
        </SettingsGroup>

        {(PRIVACY_URL || TERMS_URL) ? (
          <SettingsGroup title="Legal">
            {PRIVACY_URL ? (
              <SettingsRow icon="shield-checkmark-outline" label="Política de privacidad" onPress={() => Linking.openURL(PRIVACY_URL)} />
            ) : null}
            {TERMS_URL ? (
              <SettingsRow icon="document-text-outline" label="Términos y condiciones" onPress={() => Linking.openURL(TERMS_URL)} />
            ) : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Soporte">
          <SettingsRow
            icon="mail-outline"
            label="Contactar soporte"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Forja`)}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label="Cerrar sesión" danger onPress={() => supabase.auth.signOut()} />
        </SettingsGroup>

        <Text className="text-center mt-2" style={{ fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textMuted }}>
          Forja v{Application.nativeApplicationVersion ?? '?'} ({Application.nativeBuildVersion ?? '?'})
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Nota: en Expo Go la versión mostrada es la de Expo Go (limitación conocida); en build propio es la de Forja.

- [ ] **Step 5: Verificar y commitear**

```bash
npx tsc --noEmit
git add components/settings/ "app/(app)/settings/" "app/(app)/_layout.tsx"
git commit -m "feat: hub de Ajustes con SettingsRow y stack anidado"
```

---

### Task 8: Perfil rediseñado

**Files:**
- Modify: `app/(app)/profile.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `useProfileStats`, `useAvatarUpload` (Task 5), `StreakFlame` (`components/home/StreakFlame.tsx`, props `{ streak, compact? }`), `useStreak`, `StatCard` (`{ value, label, suffix? }`), `useActiveGoal` (de `@/hooks/useProfile`), `MODALITIES` (`@/constants/modalities`), `GOALS`/`FITNESS_LEVELS` (`@/constants/goals`).

- [ ] **Step 1: Reescribir profile.tsx**

Estructura completa (mantener la card de upgrade/renovación EXACTA del archivo actual — copiarla tal cual; aquí se abrevia solo esa card con el marcador «(card actual sin cambios)» porque se conserva línea por línea):

```tsx
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useStreak } from '@/hooks/useStreak';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { StreakFlame } from '@/components/home/StreakFlame';
import { MODALITIES } from '@/constants/modalities';
import { GOALS, FITNESS_LEVELS } from '@/constants/goals';
import { colors } from '@/constants/colors';

function memberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return `Forjador desde ${label}`;
}

function daysInForja(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: stats } = useProfileStats();
  const { data: streak } = useStreak();
  const { pickAndUpload, uploading, error: avatarError } = useAvatarUpload();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();
  const goalMeta = GOALS.find((g) => g.type === goal?.type);
  const levelMeta = FITNESS_LEVELS.find((l) => l.value === goal?.fitness_level);
  const modalityIds = goal ? [goal.modality, ...(goal.secondary_modalities ?? [])].filter(Boolean) : [];

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header con engrane */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Perfil
        </Text>
        <TouchableOpacity onPress={() => router.push('/(app)/settings' as never)} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
        <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 20 }}>
          {/* Identidad */}
          <View className="items-center gap-3">
            <TouchableOpacity onPress={pickAndUpload} disabled={uploading} activeOpacity={0.8}>
              <View
                style={{
                  width: 96, height: 96, borderRadius: 48,
                  backgroundColor: colors.primaryDim,
                  alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 96, height: 96 }} contentFit="cover" />
                ) : (
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 36, color: colors.primary }}>{initial}</Text>
                )}
              </View>
              <View
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1, borderColor: colors.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={15} color={colors.primary} />
              </View>
            </TouchableOpacity>
            {avatarError ? (
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{avatarError}</Text>
            ) : null}
            <View className="items-center gap-1.5">
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>{displayName}</Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>{user?.email}</Text>
              {isPremium ? <Badge label="MAESTRO FORJADOR" variant="premium" /> : <Badge label="APRENDIZ" variant="muted" />}
              {memberSince(profile?.created_at) ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                  {memberSince(profile?.created_at)}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Racha */}
          <View className="items-center">
            <StreakFlame streak={streak ?? 0} />
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <StatCard value={stats?.plansGenerated ?? 0} label="Planes" />
            <StatCard value={stats?.bodyRecords ?? 0} label="Registros" />
            <StatCard value={daysInForja(profile?.created_at)} label="Días en Forja" />
          </View>

          {/* Objetivo activo */}
          {goal && goalMeta ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/training' as never)}
              activeOpacity={0.7}
              className="bg-surface border border-border rounded-2xl p-4 gap-2"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-xl">{goalMeta.icon}</Text>
                <Text className="flex-1" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
                  {goalMeta.title}{levelMeta ? ` · ${levelMeta.label}` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <View className="flex-row flex-wrap gap-2">
                {modalityIds.map((id) => {
                  const m = MODALITIES.find((mod) => mod.id === id);
                  if (!m) return null;
                  return (
                    <View key={id} className="bg-primary-dim rounded-full px-3 py-1">
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.primary }}>
                        {m.icon} {m.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/training' as never)}
              activeOpacity={0.7}
              className="bg-surface border border-border rounded-2xl p-4 flex-row items-center gap-3"
            >
              <Text className="text-xl">🎯</Text>
              <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                Define tu objetivo
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Upgrade (free) — (card actual sin cambios, copiar del profile.tsx original líneas 91-125) */}
          {/* Renovación (premium) — (card actual sin cambios, copiar del profile.tsx original líneas 128-153, usa periodEnd) */}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

IMPORTANTE: al reescribir, copiar literal los bloques de upgrade card y renewal info del `profile.tsx` actual (los marcados arriba). El botón "Cerrar sesión" y su `handleSignOut` se ELIMINAN de esta pantalla (viven en Ajustes desde Task 7).

- [ ] **Step 2: Verificar tipos de useActiveGoal**

`useActiveGoal` devuelve la fila completa de `goals` — confirmar que `types/database.types.ts` incluye `modality` y `secondary_modalities` (agregados en el mini-paso multi-modalidad): `grep -n "secondary_modalities" types/database.types.ts`. Si no existen, agregarlos al tipo de `goals` (`modality: string | null`, `secondary_modalities: string[]`).

- [ ] **Step 3: Verificar y commitear**

```bash
npx tsc --noEmit
git add "app/(app)/profile.tsx" types/database.types.ts
git commit -m "feat: perfil rediseñado — avatar editable, racha, stats y objetivo activo"
```

---

### Task 9: Pantalla Cuenta (nombre, correo, contraseña, foto)

**Files:**
- Create: `app/(app)/settings/account.tsx`

**Interfaces:**
- Consumes: `useAvatarUpload`, `useUpdateProfile`, `SettingsGroup`/`SettingsRow`, `Input`, `Button`.
- Produces: navegación a `/(app)/settings/delete-account` (Task 11).

- [ ] **Step 1: Crear account.tsx**

```tsx
import { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya está en uso.';
  if (m.includes('password should be')) return 'Contraseña muy corta. Usa al menos 8 caracteres.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.';
  return 'Algo salió mal. Intenta de nuevo.';
}

export default function AccountScreen() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { pickAndUpload, uploading, error: avatarError, permissionDenied } = useAvatarUpload();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [passStatus, setPassStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [passError, setPassError] = useState<string | null>(null);

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingName(true);
    updateProfile.mutate(
      { display_name: trimmed },
      {
        onSettled: () => setSavingName(false),
        onError: () => Alert.alert('Error', 'No se pudo guardar el nombre.'),
      }
    );
  }

  async function handleChangeEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setEmailError('Escribe un correo válido.');
      return;
    }
    setEmailError(null);
    setEmailStatus('saving');
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setEmailError(friendlyAuthError(error.message));
      setEmailStatus('idle');
    } else {
      setEmailStatus('sent');
    }
  }

  async function handleChangePassword() {
    if (pass1.length < 8) {
      setPassError('Usa al menos 8 caracteres.');
      return;
    }
    if (pass1 !== pass2) {
      setPassError('Las contraseñas no coinciden.');
      return;
    }
    setPassError(null);
    setPassStatus('saving');
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    if (error) {
      setPassError(friendlyAuthError(error.message));
      setPassStatus('idle');
    } else {
      setPass1('');
      setPass2('');
      setPassStatus('done');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Cuenta
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SettingsGroup title="Foto de perfil">
          <SettingsRow
            icon="camera-outline"
            label={uploading ? 'Subiendo...' : 'Cambiar foto de perfil'}
            onPress={uploading ? undefined : pickAndUpload}
          />
        </SettingsGroup>
        {permissionDenied ? (
          <Text className="px-4 -mt-4 mb-6" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.warning }}>
            Permiso denegado. Actívalo en los ajustes del teléfono.
          </Text>
        ) : null}
        {avatarError ? (
          <Text className="px-4 -mt-4 mb-6" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>
            {avatarError}
          </Text>
        ) : null}

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>NOMBRE</Text>
          <Input placeholder="Tu nombre" value={name} onChangeText={setName} autoCapitalize="words" />
          <Button label="Guardar nombre" size="sm" variant="secondary" loading={savingName} onPress={handleSaveName} />
        </View>

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>CORREO</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>{user?.email}</Text>
          {emailStatus === 'sent' ? (
            <View className="bg-surface border border-border rounded-xl p-3">
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.success }}>
                Te enviamos un enlace de confirmación a ambos correos. El cambio se aplica al confirmar los dos.
              </Text>
            </View>
          ) : (
            <>
              <Input
                placeholder="nuevo@correo.com"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {emailError ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{emailError}</Text>
              ) : null}
              <Button label="Cambiar correo" size="sm" variant="secondary" loading={emailStatus === 'saving'} onPress={handleChangeEmail} />
            </>
          )}
        </View>

        <View className="mb-6 gap-3">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}>CONTRASEÑA</Text>
          {passStatus === 'done' ? (
            <View className="bg-surface border border-border rounded-xl p-3">
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.success }}>Contraseña actualizada ✓</Text>
            </View>
          ) : (
            <>
              <Input placeholder="Nueva contraseña (mín. 8)" value={pass1} onChangeText={setPass1} secureTextEntry autoComplete="new-password" />
              <Input placeholder="Confirmar contraseña" value={pass2} onChangeText={setPass2} secureTextEntry autoComplete="new-password" />
              {passError ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{passError}</Text>
              ) : null}
              <Button label="Cambiar contraseña" size="sm" variant="secondary" loading={passStatus === 'saving'} onPress={handleChangePassword} />
            </>
          )}
        </View>

        <SettingsGroup title="Zona de peligro">
          <SettingsRow
            icon="trash-outline"
            label="Eliminar cuenta"
            danger
            onPress={() => router.push('/(app)/settings/delete-account' as never)}
          />
        </SettingsGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar y commitear**

```bash
npx tsc --noEmit
git add "app/(app)/settings/account.tsx"
git commit -m "feat: pantalla Cuenta — foto, nombre, correo y contraseña"
```

---

### Task 10: EF delete-account (TDD)

**Files:**
- Create: `supabase/functions/delete-account/logic.ts`, `supabase/functions/delete-account/index.ts`
- Test: `supabase/functions/delete-account/logic.test.ts`

**Interfaces:**
- Produces: endpoint POST `/functions/v1/delete-account` (JWT requerido) → `{ ok: true }` | error 4xx/5xx. `deleteAccount(deps: DeleteDeps, uid: string): Promise<void>`.
- Env requerida: `STRIPE_SECRET_KEY` en `supabase/.env` (verificar con `grep STRIPE_SECRET_KEY supabase/.env`; si falta, copiar la key de test del dashboard de Stripe / misma cuenta `acct_1TpMcOK3706kh3Wn`).

- [ ] **Step 1: Escribir tests que fallan**

`supabase/functions/delete-account/logic.test.ts`:

```ts
import { assertEquals, assertRejects } from 'jsr:@std/assert';
import { deleteAccount, type DeleteDeps } from './logic.ts';

function makeDeps(overrides: Partial<DeleteDeps> = {}) {
  const calls: string[] = [];
  const deps: DeleteDeps = {
    getSubscription: async () => null,
    cancelStripeSubscription: async () => { calls.push('cancel'); },
    removeAvatar: async () => { calls.push('avatar'); },
    deleteUser: async () => { calls.push('delete'); },
    ...overrides,
  };
  return { deps, calls };
}

Deno.test('sin suscripción: borra avatar y usuario, no llama a Stripe', async () => {
  const { deps, calls } = makeDeps();
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['avatar', 'delete']);
});

Deno.test('con suscripción activa en Stripe: cancela ANTES de borrar', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_123', status: 'active' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['cancel', 'avatar', 'delete']);
});

Deno.test('suscripción cancelada sin id activo: no llama a Stripe', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: null, status: 'canceled' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls, ['avatar', 'delete']);
});

Deno.test('si Stripe falla, NO borra al usuario', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_123', status: 'active' }),
    cancelStripeSubscription: async () => { throw new Error('stripe down'); },
  });
  await assertRejects(() => deleteAccount(deps, 'uid-1'));
  assertEquals(calls.includes('delete'), false);
});

Deno.test('status past_due también cancela en Stripe', async () => {
  const { deps, calls } = makeDeps({
    getSubscription: async () => ({ stripe_subscription_id: 'sub_9', status: 'past_due' }),
  });
  await deleteAccount(deps, 'uid-1');
  assertEquals(calls[0], 'cancel');
});
```

- [ ] **Step 2: Correr — debe fallar**

```bash
cd supabase/functions && deno test delete-account/
```

Expected: FAIL — `Module not found ... logic.ts`.

- [ ] **Step 3: Implementar logic.ts**

```ts
export interface DeleteDeps {
  getSubscription(uid: string): Promise<{ stripe_subscription_id: string | null; status: string } | null>;
  cancelStripeSubscription(subscriptionId: string): Promise<void>;
  removeAvatar(uid: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
}

const CANCELABLE = ['active', 'trialing', 'past_due', 'incomplete'];

// Orden a prueba de fallos: Stripe → avatar → usuario.
// Si Stripe falla se aborta ANTES de tocar al usuario (nunca cuenta a medio borrar
// y nunca un borrado que deje a Stripe cobrando a un fantasma).
export async function deleteAccount(deps: DeleteDeps, uid: string): Promise<void> {
  const sub = await deps.getSubscription(uid);
  if (sub?.stripe_subscription_id && CANCELABLE.includes(sub.status)) {
    await deps.cancelStripeSubscription(sub.stripe_subscription_id);
  }
  await deps.removeAvatar(uid);
  await deps.deleteUser(uid);
}
```

- [ ] **Step 4: Correr — debe pasar**

```bash
cd supabase/functions && deno test delete-account/
```

Expected: `5 passed`.

- [ ] **Step 5: Implementar index.ts**

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { deleteAccount } from './logic.ts';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: authError } = await anon.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

  try {
    await deleteAccount(
      {
        getSubscription: async (uid) => {
          const { data, error } = await admin
            .from('subscriptions')
            .select('stripe_subscription_id, status')
            .eq('user_id', uid)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        cancelStripeSubscription: async (subId) => {
          if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            if (body?.error?.code === 'resource_missing') return; // ya no existe en Stripe: ok
            throw new Error(`Stripe cancel failed: ${res.status}`);
          }
        },
        removeAvatar: async (uid) => {
          // remove no falla si el objeto no existe; otros errores tampoco deben
          // bloquear el borrado de la cuenta (el bucket se limpia por mantenimiento)
          await admin.storage.from('avatars').remove([`${uid}.jpg`]).catch(() => {});
        },
        deleteUser: async (uid) => {
          const { error } = await admin.auth.admin.deleteUser(uid);
          if (error) throw error;
        },
      },
      user.id
    );
  } catch (err) {
    console.error('delete-account failed:', err);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la cuenta' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 6: Verificar STRIPE_SECRET_KEY y probar local**

```bash
grep -c "STRIPE_SECRET_KEY" supabase/.env || echo "FALTA — agregarla antes de continuar"
sg docker -c "supabase functions serve delete-account --env-file supabase/.env" &
sleep 3
curl -s -X POST "http://127.0.0.1:54321/functions/v1/delete-account" -H "Authorization: Bearer invalido" | head -c 100
```

Expected: `{"error":"Unauthorized"}` (la ruta responde y valida JWT). Matar el serve tras la prueba.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/delete-account/
git commit -m "feat: EF delete-account — cancela Stripe, limpia avatar y borra usuario (TDD 5/5)"
```

---

### Task 11: Pantalla de confirmación Eliminar cuenta

**Files:**
- Create: `app/(app)/settings/delete-account.tsx`

**Interfaces:**
- Consumes: EF `delete-account` vía `supabase.functions.invoke('delete-account')` (manda el JWT de la sesión automáticamente).

- [ ] **Step 1: Crear delete-account.tsx**

```tsx
import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

const CONFIRM_WORD = 'ELIMINAR';

export default function DeleteAccountScreen() {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = confirmText.trim().toUpperCase() === CONFIRM_WORD && !deleting;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error: fnError } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (fnError) {
      setError('No se pudo eliminar la cuenta. Intenta de nuevo o contacta soporte.');
      setDeleting(false);
      return;
    }
    // Cuenta borrada en el servidor: cerrar sesión local (el AuthGuard redirige a login)
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.destructive, letterSpacing: 1 }}>
          Eliminar cuenta
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View className="bg-surface border rounded-2xl p-4 gap-3" style={{ borderColor: colors.destructive + '60' }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="warning" size={20} color={colors.destructive} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
              Esto es irreversible
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted, lineHeight: 20 }}>
            Se borra TODO de forma permanente: tu perfil, planes de entrenamiento y alimentación,
            historial de chat con Vulcano, registros corporales, racha y foto de perfil.
            {'\n\n'}Si tienes una suscripción activa, se cancela en este momento (sin reembolso del
            periodo en curso).
          </Text>
        </View>

        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>
          Escribe <Text style={{ fontFamily: 'Inter-Medium', color: colors.destructive }}>{CONFIRM_WORD}</Text> para confirmar:
        </Text>
        <Input placeholder={CONFIRM_WORD} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />

        {error ? (
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.destructive }}>{error}</Text>
        ) : null}

        <Button
          label={deleting ? 'Eliminando...' : 'Eliminar mi cuenta para siempre'}
          variant="destructive"
          disabled={!enabled}
          loading={deleting}
          onPress={handleDelete}
        />
        <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verificar y commitear**

```bash
npx tsc --noEmit
git add "app/(app)/settings/delete-account.tsx"
git commit -m "feat: pantalla de confirmación para eliminar cuenta"
```

---

### Task 12: Pantalla Mi entrenamiento

**Files:**
- Create: `app/(app)/settings/training.tsx`

**Interfaces:**
- Consumes: `useActiveGoal` (`@/hooks/useProfile`), `GOALS`/`FITNESS_LEVELS`/`MODES` (`@/constants/goals`), `MODALITIES` (`@/constants/modalities`), `useLatestBodyData` (confirmar export: `grep -n "useLatestBodyData" hooks/*.ts` — vive en `hooks/useBodyTracking.ts`).
- Regla de guardado: goal nuevo (INSERT) + desactivar el anterior; altura/edad/género → UPDATE del último `body_data` (INSERT si no hay).

- [ ] **Step 1: Crear training.tsx**

```tsx
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useActiveGoal } from '@/hooks/useProfile';
import { useLatestBodyData } from '@/hooks/useBodyTracking';
import { GOALS, FITNESS_LEVELS, MODES, type GoalType, type FitnessLevel, type TrainingMode } from '@/constants/goals';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/constants/colors';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
  { value: 'other', label: 'Otro' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decir' },
];

function Chip({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`rounded-full px-4 py-2 border ${selected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
    >
      <Text className={`text-sm ${selected ? 'text-primary' : 'text-text'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="mb-3 mt-6" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
      {children}
    </Text>
  );
}

export default function TrainingScreen() {
  const { user } = useAuthStore();
  const { data: goal } = useActiveGoal();
  const { data: latestBody } = useLatestBodyData();
  const queryClient = useQueryClient();

  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [mode, setMode] = useState<TrainingMode | null>(null);
  const [modality, setModality] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Precargar valores actuales una sola vez
  useEffect(() => {
    if (loaded || goal === undefined || latestBody === undefined) return;
    if (goal) {
      setGoalType(goal.type as GoalType);
      setLevel(goal.fitness_level as FitnessLevel);
      setMode(goal.mode as TrainingMode);
      setModality((goal.modality as ModalityId) ?? null);
      setSecondary((goal.secondary_modalities as ModalityId[]) ?? []);
      setSportType(goal.sport_type ?? '');
    }
    if (latestBody) {
      if (latestBody.height_cm) setHeightCm(String(latestBody.height_cm));
      if (latestBody.age) setAge(String(latestBody.age));
      if (latestBody.gender) setGender(latestBody.gender as Gender);
    }
    setLoaded(true);
  }, [goal, latestBody, loaded]);

  const needsSport = modality === 'ball_sports' || secondary.includes('ball_sports');
  const valid = !!goalType && !!level && !!mode && !!modality;

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function handleSave() {
    if (!user || !valid) return;
    setSaving(true);
    try {
      // 1. Desactivar goal(s) activo(s) — conserva historial
      const { error: deactErr } = await supabase
        .from('goals')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (deactErr) throw deactErr;

      // 2. Insertar goal nuevo activo (conserva target del anterior si existía)
      const { error: goalErr } = await supabase.from('goals').insert({
        user_id: user.id,
        type: goalType,
        target_weight_kg: goal?.target_weight_kg ?? null,
        target_date: goal?.target_date ?? null,
        fitness_level: level,
        mode,
        modality,
        secondary_modalities: secondary,
        sport_type: needsSport && sportType.trim() ? sportType.trim() : null,
      });
      if (goalErr) throw goalErr;

      // 3. Atributos corporales: UPDATE del último registro (INSERT si no hay)
      const bodyPatch = {
        height_cm: heightCm ? parseFloat(heightCm) : null,
        age: age ? parseInt(age, 10) : null,
        gender,
      };
      if (latestBody?.id) {
        const { error: bodyErr } = await supabase.from('body_data').update(bodyPatch).eq('id', latestBody.id);
        if (bodyErr) throw bodyErr;
      } else if (bodyPatch.height_cm || bodyPatch.age || bodyPatch.gender) {
        const { error: bodyErr } = await supabase.from('body_data').insert({ user_id: user.id, ...bodyPatch });
        if (bodyErr) throw bodyErr;
      }

      queryClient.invalidateQueries({ queryKey: ['goal'] });
      queryClient.invalidateQueries({ queryKey: ['bodyData'] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats'] });
      Alert.alert('Guardado 🔥', 'Los cambios aplican a tu próximo plan generado.');
      router.back();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Error desconocido';
      Alert.alert('Error al guardar', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Mi entrenamiento
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Objetivo</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {GOALS.map((g) => (
            <Chip key={g.type} selected={goalType === g.type} label={`${g.icon} ${g.title}`} onPress={() => setGoalType(g.type)} />
          ))}
        </View>

        <SectionTitle>Nivel</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {FITNESS_LEVELS.map((l) => (
            <Chip key={l.value} selected={level === l.value} label={l.label} onPress={() => setLevel(l.value)} />
          ))}
        </View>

        <SectionTitle>Modo</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip key={m.value} selected={mode === m.value} label={`${m.icon} ${m.label}`} onPress={() => setMode(m.value)} />
          ))}
        </View>

        <SectionTitle>Disciplina principal</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODALITIES.map((m) => (
            <Chip
              key={m.id}
              selected={modality === m.id}
              label={`${m.icon} ${m.label}`}
              onPress={() => {
                setModality(m.id);
                setSecondary((prev) => prev.filter((s) => s !== m.id));
              }}
            />
          ))}
        </View>

        <SectionTitle>Disciplinas secundarias (hasta 2)</SectionTitle>
        <View className="flex-row flex-wrap gap-2">
          {MODALITIES.filter((m) => m.id !== modality).map((m) => (
            <Chip key={m.id} selected={secondary.includes(m.id)} label={`${m.icon} ${m.label}`} onPress={() => toggleSecondary(m.id)} />
          ))}
        </View>

        {needsSport ? (
          <View className="mt-4">
            <Text className="mb-2" style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>¿Qué deporte?</Text>
            <Input placeholder="Fútbol, básquet, tenis..." value={sportType} onChangeText={setSportType} />
          </View>
        ) : null}

        <SectionTitle>Datos básicos</SectionTitle>
        <View className="gap-3">
          <Input label="Altura (cm)" placeholder="170" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
          <Input label="Edad" placeholder="28" value={age} onChangeText={setAge} keyboardType="numeric" />
          <View className="flex-row flex-wrap gap-2">
            {GENDERS.map((g) => (
              <Chip key={g.value} selected={gender === g.value} label={g.label} onPress={() => setGender(g.value)} />
            ))}
          </View>
        </View>

        <View className="mt-8 gap-2">
          <Button label="Guardar cambios" loading={saving} disabled={!valid} onPress={handleSave} />
          <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            Los cambios aplican a tu próximo plan generado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Nota: verificar el nombre exacto y queryKey de `useLatestBodyData` en `hooks/useBodyTracking.ts` antes de escribir los `invalidateQueries` (usar los queryKeys reales del hook).

- [ ] **Step 2: Verificar y commitear**

```bash
npx tsc --noEmit
git add "app/(app)/settings/training.tsx"
git commit -m "feat: pantalla Mi entrenamiento — objetivo/nivel/modo/modalidades y datos básicos editables"
```

---

### Task 13: Pantallas Notificaciones, Idioma y Suscripción

**Files:**
- Create: `app/(app)/settings/notifications.tsx`, `app/(app)/settings/language.tsx`, `app/(app)/settings/subscription.tsx`

**Interfaces:**
- Consumes: `useProfile`/`useUpdateProfile` (con `notif_reminders`/`notif_updates` de Task 5), `useSubscription`/`useIsPremium`, `buildPortalURL` (`@/lib/payments`).

- [ ] **Step 1: Crear notifications.tsx**

```tsx
import { Linking, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const reminders = profile?.notif_reminders ?? true;
  const updates = profile?.notif_updates ?? true;

  const switchProps = {
    trackColor: { false: colors.border, true: colors.primaryDim },
    thumbColor: colors.primary,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Notificaciones
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <SettingsGroup title="Push">
          <SettingsRow
            icon="barbell-outline"
            label="Recordatorios de entrenamiento y dieta"
            rightElement={
              <Switch {...switchProps} value={reminders} onValueChange={(v) => updateProfile.mutate({ notif_reminders: v })} />
            }
          />
          <SettingsRow
            icon="trending-up-outline"
            label="Progreso y planes"
            rightElement={
              <Switch {...switchProps} value={updates} onValueChange={(v) => updateProfile.mutate({ notif_updates: v })} />
            }
          />
        </SettingsGroup>

        <Text className="px-1" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
          Si las notificaciones están apagadas a nivel del sistema, actívalas en los ajustes del teléfono.
        </Text>
        <TouchableOpacity onPress={() => Linking.openSettings()} className="mt-2 px-1">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primary }}>Abrir ajustes del teléfono</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Crear language.tsx**

```tsx
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';

export default function LanguageScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Idioma
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View className="rounded-2xl border border-primary bg-primary-dim px-4 py-3.5 flex-row items-center gap-3">
          <Text className="text-xl">🇲🇽</Text>
          <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.primary }}>Español</Text>
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        </View>
        <View className="rounded-2xl border border-border bg-surface px-4 py-3.5 flex-row items-center gap-3 opacity-50">
          <Text className="text-xl">🇺🇸</Text>
          <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.text }}>English</Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>Próximamente</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

(El selector se conecta a `profiles.language` + i18next en el Paso 14; hoy es informativo.)

- [ ] **Step 3: Crear subscription.tsx**

```tsx
import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buildPortalURL } from '@/lib/payments';
import { colors } from '@/constants/colors';

export default function SubscriptionScreen() {
  const { user } = useAuthStore();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Suscripción
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="bg-surface border border-border rounded-2xl p-4 items-center gap-3">
          {isPremium ? <Badge label="MAESTRO FORJADOR" variant="premium" /> : <Badge label="APRENDIZ" variant="muted" />}
          {isPremium && periodEnd ? (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              Se renueva el {periodEnd}
            </Text>
          ) : (
            <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              Plan gratuito: 1 plan de entrenamiento al mes, 20 mensajes al día con Vulcano.
            </Text>
          )}
        </View>

        {isPremium ? (
          <Button
            label="Gestionar suscripción"
            variant="secondary"
            onPress={() => user && Linking.openURL(buildPortalURL(user.id))}
          />
        ) : (
          <Button label="Hazte Maestro" onPress={() => router.push('/(app)/upgrade' as never)} />
        )}
        {isPremium ? (
          <Text className="text-center px-4" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            Cambia de plan, actualiza tu método de pago o cancela desde el portal seguro de Stripe.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Verificar y commitear**

```bash
npx tsc --noEmit
git add "app/(app)/settings/notifications.tsx" "app/(app)/settings/language.tsx" "app/(app)/settings/subscription.tsx"
git commit -m "feat: pantallas Notificaciones, Idioma y Suscripción"
```

---

### Task 14: Verificación de correo en el registro

**Files:**
- Modify: `supabase/config.toml`, `app/(auth)/register.tsx`, `app/(auth)/login.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signUp` con `emailRedirectTo`, `supabase.auth.resend`.

- [ ] **Step 1: Activar confirmaciones en config.toml**

En `[auth.email]`: cambiar `enable_confirmations = false` → `enable_confirmations = true`.
En `[auth]`: agregar `"forja://"` a `additional_redirect_urls`:

```toml
additional_redirect_urls = ["https://127.0.0.1:3000", "forja://"]
```

Reiniciar servicios: `sg docker -c "supabase stop" && sg docker -c "supabase start"`.

- [ ] **Step 2: Modificar register.tsx**

a) Agregar estado: `const [sent, setSent] = useState(false);`

b) Reemplazar el final de `handleRegister`:

```ts
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, emailRedirectTo: 'forja://' },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error al crear cuenta', error.message);
    } else if (!data.session) {
      // Confirmación por correo activada: no hay sesión hasta confirmar
      setSent(true);
    }
```

c) Agregar función de reenvío y render del estado `sent` (antes del `return` principal):

```tsx
  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) Alert.alert('Error', 'No se pudo reenviar. Espera un momento.');
    else Alert.alert('Enviado', 'Revisa tu bandeja de entrada (y spam).');
  }

  if (sent) {
    return (
      <View className="flex-1 bg-background justify-center px-5 gap-4">
        <Text className="text-center text-5xl">📬</Text>
        <Text className="text-text font-bold text-2xl text-center">Revisa tu correo</Text>
        <Text className="text-text-muted text-base text-center">
          Te enviamos un enlace de confirmación a{'\n'}
          <Text className="text-text font-semibold">{email}</Text>
          {'\n\n'}Confírmalo y vuelve aquí para iniciar sesión.
        </Text>
        <Button label="Reenviar correo" variant="secondary" onPress={handleResend} className="mt-4" />
        <Link href="/(auth)/login" asChild>
          <TouchableOpacity className="items-center py-3">
            <Text className="text-primary text-sm font-semibold">Ir a iniciar sesión</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }
```

- [ ] **Step 3: Modificar login.tsx — error amigable + reenvío**

Localizar el manejo de error del `signInWithPassword` (`grep -n "signInWithPassword" "app/(auth)/login.tsx"`) y reemplazar el `Alert.alert` de error por:

```ts
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        Alert.alert(
          'Confirma tu correo',
          'Tu cuenta existe pero falta confirmar el correo. ¿Te reenviamos el enlace?',
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Reenviar',
              onPress: async () => {
                const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email });
                Alert.alert(resendErr ? 'Error' : 'Enviado', resendErr ? 'No se pudo reenviar. Espera un momento.' : 'Revisa tu bandeja de entrada.');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error al iniciar sesión', error.message);
      }
    }
```

(Adaptar nombres de variables a los reales del archivo.)

- [ ] **Step 4: Verificar E2E local con Mailpit**

```bash
npx tsc --noEmit
```

Manual: crear cuenta nueva desde la app (o curl a `/auth/v1/signup`) → abrir http://127.0.0.1:54324 (Mailpit) → debe llegar "Confirm your signup". Intentar login sin confirmar → debe salir el Alert "Confirma tu correo". Click al enlace en Mailpit → login exitoso.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml "app/(auth)/register.tsx" "app/(auth)/login.tsx"
git commit -m "feat: verificación de correo en registro (local via Mailpit; prod espera dominio+SMTP)"
```

---

### Task 15: Cierre — typecheck, docs y checklist E2E

**Files:**
- Modify: `forja-docs.md` (nueva sección "Ajustes de cuenta")

- [ ] **Step 1: Typecheck completo + tests Deno completos**

```bash
npx tsc --noEmit
cd supabase/functions && deno test . && cd ../..
```

Expected: 0 errores TS; todos los tests Deno PASS.

- [ ] **Step 2: Documentar en forja-docs.md**

Agregar sección al final (antes de pendientes) con: mapa de rutas de settings, migraciones 0007/0008, EF `delete-account` (+ requisito `STRIPE_SECRET_KEY`), verificación de correo (flag `enable_confirmations`, Mailpit local, pendiente SMTP+dominio para prod), y el flujo de foto de perfil (bucket `avatars`).

- [ ] **Step 3: E2E manual guiado (con el usuario, app en Expo Go + Supabase local)**

Checklist a ejecutar y reportar:
1. Registro con correo nuevo → pantalla "Revisa tu correo" → confirmar vía Mailpit → login OK.
2. Perfil: se ve racha, stats, "Forjador desde", objetivo con chips.
3. Tocar avatar → elegir foto → recorte → se ve la foto (y persiste tras reiniciar app).
4. Ajustes → Cuenta: cambiar nombre (se refleja en Perfil), cambiar contraseña (re-login con la nueva), cambiar correo (llegan 2 correos en Mailpit, confirmar ambos, el correo cambia).
5. Mi entrenamiento: cambiar objetivo/modalidades → guardar → Perfil refleja el cambio; en DB hay un goal nuevo activo y el viejo `is_active=false`.
6. Notificaciones: apagar un toggle → persiste tras reiniciar; `get_notification_targets()` excluye/filtra según flags.
7. Suscripción: free muestra CTA a upgrade; premium muestra renovación + portal.
8. Eliminar cuenta (con un usuario de prueba desechable): escribir ELIMINAR → borra → login falla → `SELECT` a `profiles` del uid = 0 filas.
9. Cerrar sesión desde Ajustes funciona.

- [ ] **Step 4: Commit final**

```bash
git add forja-docs.md
git commit -m "docs: sección de ajustes de cuenta en forja-docs"
```

---

## Notas de riesgo conocidas

- **API de expo-image-manipulator/image-picker SDK 56:** verificada contra docs versionadas ANTES de implementar Task 5 (AGENTS.md). Si `ImageManipulator.manipulate` difiere, mantener el flujo y adaptar firmas.
- **`useLatestBodyData`:** confirmar export/queryKey reales en `hooks/useBodyTracking.ts` (Task 12).
- **Versión en Expo Go:** `expo-application` reporta la de Expo Go — correcta solo en build propio.
- **`supabase migration up` vs `db reset`:** usar `migration up` para no destruir el usuario de prueba local (`test-planfix@forja.test`).
- **Regla de generación:** cambiar objetivo NO regenera plan (costo IA); el copy lo dice.
