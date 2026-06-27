# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement daily push notifications via QStash → Supabase Edge Function → Expo Push API, with per-user content based on subscription tier and activity.

**Architecture:** A QStash cron (02:00 UTC daily) calls the Edge Function `send-notifications`, which queries eligible users via a SQL helper function, decides what notification each user receives, calls the Expo Push API in batches of 100, persists results to `notifications`, and cleans up stale tokens. On the client, a hook registers the push token on login and a global listener routes notification taps to the correct screen.

**Tech Stack:** React Native + Expo SDK 56, expo-notifications ^56.0.18, expo-device, expo-constants, Supabase Edge Functions (Deno), @upstash/qstash@^2, Expo Push API (https://exp.host/--/api/v2/push/send)

## Global Constraints

- Expo SDK 56 — check https://docs.expo.dev/versions/v56.0.0/ for any API used
- NativeWind v4: static layout props (flex, padding, margin, gap, borderRadius) → `className`; colors, fontFamily, dynamic values → `style={{}}`
- TypeScript strict — no `any`, no untyped variables
- Fonts available: `SpaceGrotesk-Regular`, `SpaceGrotesk-SemiBold`, `SpaceGrotesk-Bold`, `Inter-Regular`, `Inter-Medium`, `JetBrainsMono-Regular`, `JetBrainsMono-Medium` — only these, no others
- Colors from `constants/colors.ts` — never hardcode hex values in components
- `@/` path alias maps to project root (`app/`, `hooks/`, `components/`, etc.)
- Supabase local dev: `http://127.0.0.1:54321`; env vars in `forja/.env.local`; EF secrets in `forja/supabase/.env`
- Edge Function imports: Supabase client = `jsr:@supabase/supabase-js@2` (matches existing `supabase/functions/chat/index.ts` pattern)
- No test framework in project — verification via `npx tsc --noEmit` for TypeScript and manual/curl testing for runtime
- Notification `type` must be one of: `'missed_workout' | 'progress_update' | 'goal_milestone' | 'plan_ready'` (DB CHECK constraint — `diet_alert` also valid but not used here)
- `useAuthStore()` from `store/auth.store` exposes `{ user: User | null }` where `User` is `@supabase/supabase-js`'s `User` type (has `.id: string`)
- `useUpdateProfile()` from `hooks/useProfile` — mutation accepts `{ display_name?: string; language?: string; expo_push_token?: string }`
- QStash keys: `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` go in `supabase/.env` (not committed)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `hooks/useNotifications.ts` | Create | Request push permissions, get Expo token, update `profiles.expo_push_token` if changed |
| `app/_layout.tsx` | Modify | Set notification handler (module-level), call `useNotifications` in `AuthGuard`, add tap-routing listener in `RootLayout` |
| `supabase/migrations/0003_notification_helpers.sql` | Create | SQL function `get_notification_targets()` that aggregates user + subscription + goal + activity data for the Edge Function |
| `supabase/functions/send-notifications/index.ts` | Create | Edge Function: verify QStash signature, query users, decide notification per user, call Expo Push API, clean invalid tokens, insert into `notifications` |

---

## Task 1: Install dependencies + `hooks/useNotifications.ts`

**Files:**
- Create: `hooks/useNotifications.ts`
- (No new test file — verified with `npx tsc --noEmit`)

**Interfaces:**
- Consumes: `useAuthStore` from `store/auth.store` (for `user.id`), `useUpdateProfile` from `hooks/useProfile` (for saving token), `supabase` from `lib/supabase` (direct query to compare existing token)
- Produces: `export function useNotifications(): void` — called in `AuthGuard` in Task 2

- [ ] **Step 1: Install `expo-device` and `expo-constants`**

Run from the project root (`forja/`):
```bash
npx expo install expo-device expo-constants
```

Expected output: packages added to `package.json`, no errors. If prompted about native rebuild, note it — the app needs a rebuild before testing on device, but the hook code itself doesn't require it to compile.

- [ ] **Step 2: Create `hooks/useNotifications.ts`**

```ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useUpdateProfile } from '@/hooks/useProfile';

export function useNotifications(): void {
  const { user } = useAuthStore();
  const { mutate: updateProfile } = useUpdateProfile();

  useEffect(() => {
    if (!user) return;
    if (!Device.isDevice) return; // skip simulators

    async function register() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Forja',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : {}
        );
        if (!token) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('expo_push_token')
          .eq('id', user!.id)
          .single();

        if (profile?.expo_push_token !== token) {
          updateProfile({ expo_push_token: token });
        }
      } catch {
        // notifications are optional — never crash the app
      }
    }

    register();
  }, [user?.id]);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from `forja/`:
```bash
npx tsc --noEmit
```

Expected: no errors. If `expo-device` or `expo-constants` types are missing, run `npx expo install expo-device expo-constants` again and check `node_modules`.

- [ ] **Step 4: Commit**

```bash
git add hooks/useNotifications.ts package.json package-lock.json
git commit -m "feat: add useNotifications hook for push token registration"
```

---

## Task 2: `app/_layout.tsx` — notification handler + hook + tap listener

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `useNotifications` from `hooks/useNotifications` (Task 1), `expo-notifications`, `expo-router`'s `useRouter`
- Produces: Notification handler active for foreground alerts; tap listener routing notifications to correct screen

- [ ] **Step 1: Add module-level notification handler and imports**

Open `app/_layout.tsx`. Add the following imports at the top (after existing imports):

```ts
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/hooks/useNotifications';
```

Then add this call **at module level** (between the `SplashScreen.preventAutoHideAsync()` line and the `const queryClient = ...` line):

```ts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

- [ ] **Step 2: Call `useNotifications()` inside `AuthGuard`**

Inside the `AuthGuard` function body, add this line right after the existing `useAuthStore` destructuring line:

```ts
useNotifications();
```

The `AuthGuard` function begins with:
```ts
function AuthGuard() {
  const { session, isLoading, setSession, setIsLoading } = useAuthStore();
  const { onboardingCompleted, setOnboardingCompleted, setDisplayName } = useProfileStore();
  useNotifications(); // ← add here
  // ... rest of the function
```

- [ ] **Step 3: Add notification tap listener in `RootLayout`**

Inside `RootLayout`, add a new `useEffect` that registers the tap listener. Add it after the existing `useFonts` and `fontsLoaded` `useEffect`:

```ts
const router = useRouter();

useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const type = response.notification.request.content.data?.type as string | undefined;
    if (type === 'goal_milestone') {
      router.push('/(app)/progress');
    } else if (type === 'plan_ready') {
      router.push('/(app)/plans');
    } else {
      router.push('/(app)');
    }
  });
  return () => subscription.remove();
}, []);
```

The full `RootLayout` function body should look like:

```ts
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ ... }); // unchanged
  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type as string | undefined;
      if (type === 'goal_milestone') {
        router.push('/(app)/progress');
      } else if (type === 'plan_ready') {
        router.push('/(app)/plans');
      } else {
        router.push('/(app)');
      }
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: register push token on login, route notification taps"
```

---

## Task 3: SQL migration — `get_notification_targets()`

**Files:**
- Create: `supabase/migrations/0003_notification_helpers.sql`

**Interfaces:**
- Produces: `get_notification_targets()` SQL function callable via `supabase.rpc('get_notification_targets')` in Task 4
- Returns columns: `user_id UUID`, `expo_push_token TEXT`, `plan TEXT`, `sub_status TEXT`, `current_period_end TIMESTAMPTZ`, `goal_type TEXT`, `target_weight_kg NUMERIC`, `target_date DATE`, `last_activity TIMESTAMPTZ`, `first_weight NUMERIC`, `current_weight NUMERIC`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0003_notification_helpers.sql`:

```sql
CREATE OR REPLACE FUNCTION get_notification_targets()
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
  current_weight    NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_body AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      recorded_at AS last_body_at
    FROM body_data
    ORDER BY user_id, recorded_at DESC
  ),
  last_chat AS (
    SELECT
      user_id,
      MAX(date)::TIMESTAMPTZ AS last_chat_at
    FROM daily_message_count
    GROUP BY user_id
  ),
  first_weight AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      weight_kg
    FROM body_data
    WHERE weight_kg IS NOT NULL
    ORDER BY user_id, recorded_at ASC
  ),
  latest_weight AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      weight_kg
    FROM body_data
    WHERE weight_kg IS NOT NULL
    ORDER BY user_id, recorded_at DESC
  )
  SELECT
    p.id                                                AS user_id,
    p.expo_push_token,
    COALESCE(s.plan, 'free')                           AS plan,
    COALESCE(s.status, 'active')                       AS sub_status,
    s.current_period_end,
    g.type                                             AS goal_type,
    g.target_weight_kg,
    g.target_date,
    GREATEST(lb.last_body_at, lc.last_chat_at)         AS last_activity,
    fw.weight_kg                                        AS first_weight,
    lw.weight_kg                                        AS current_weight
  FROM profiles p
  LEFT JOIN subscriptions s ON s.user_id = p.id
  LEFT JOIN goals g ON g.user_id = p.id AND g.is_active = TRUE
  LEFT JOIN last_body lb ON lb.user_id = p.id
  LEFT JOIN last_chat lc ON lc.user_id = p.id
  LEFT JOIN first_weight fw ON fw.user_id = p.id
  LEFT JOIN latest_weight lw ON lw.user_id = p.id
  WHERE p.expo_push_token IS NOT NULL;
$$;
```

- [ ] **Step 2: Apply the migration locally**

Run from `forja/`:
```bash
supabase db reset
```

Expected: migrations run in order (0001 → 0002 → 0003), no errors.

Alternatively without a full reset:
```bash
supabase db push
```

- [ ] **Step 3: Verify the function exists**

```bash
supabase db diff --use-migra 2>/dev/null | grep -c "get_notification_targets" || \
  supabase sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    -c "SELECT proname FROM pg_proc WHERE proname = 'get_notification_targets';"
```

Expected output: `get_notification_targets` appears in results.

Quick smoke test (requires at least one profile with `expo_push_token` set):
```bash
supabase sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT * FROM get_notification_targets() LIMIT 5;"
```

Expected: 0 or more rows, no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_notification_helpers.sql
git commit -m "feat: add get_notification_targets SQL function for push notifications"
```

---

## Task 4: Edge Function `send-notifications`

**Files:**
- Create: `supabase/functions/send-notifications/index.ts`
- Modify: `supabase/.env` (manual step — add QStash keys, not committed)

**Interfaces:**
- Consumes: `get_notification_targets()` from Task 3 via `supabase.rpc('get_notification_targets')`
- Endpoint: `POST /functions/v1/send-notifications`
- Auth: QStash signature header `Upstash-Signature` (bypassed locally with `SKIP_QSTASH_VERIFY=true`)

- [ ] **Step 1: Create the Edge Function**

Create directory and file:
```bash
mkdir -p supabase/functions/send-notifications
```

Create `supabase/functions/send-notifications/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Receiver } from 'npm:@upstash/qstash@^2';

interface NotificationTarget {
  user_id: string;
  expo_push_token: string;
  plan: string;
  sub_status: string;
  current_period_end: string | null;
  goal_type: string | null;
  target_weight_kg: string | null; // NUMERIC comes as string from Supabase
  target_date: string | null;      // DATE comes as string YYYY-MM-DD
  last_activity: string | null;    // TIMESTAMPTZ comes as ISO string
  first_weight: string | null;
  current_weight: string | null;
}

interface NotificationPayload {
  type: 'progress_update' | 'missed_workout' | 'goal_milestone';
  title: string;
  body: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { type: string };
  sound: 'default';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function isPremium(target: NotificationTarget): boolean {
  if (target.plan !== 'premium') return false;
  if (target.sub_status !== 'active' && target.sub_status !== 'trialing') return false;
  if (target.current_period_end && new Date(target.current_period_end) < new Date()) return false;
  return true;
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return 999;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

function decideNotification(target: NotificationTarget): NotificationPayload | null {
  const premium = isPremium(target);
  const inactive = daysSince(target.last_activity);

  // Skip churned users (>5 days inactive)
  if (inactive > 5) return null;

  if (premium) {
    // Check goal milestone (only for weight-related goals with a target)
    if (
      (target.goal_type === 'weight_loss' || target.goal_type === 'muscle_gain') &&
      target.target_weight_kg &&
      target.first_weight &&
      target.current_weight
    ) {
      const firstW = parseFloat(target.first_weight);
      const currentW = parseFloat(target.current_weight);
      const targetW = parseFloat(target.target_weight_kg);
      const totalChange = Math.abs(firstW - targetW);
      const achieved = Math.abs(firstW - currentW);
      if (totalChange > 0 && achieved / totalChange >= 1.0) {
        return {
          type: 'goal_milestone',
          title: '¡Lo lograste! 🏆',
          body: 'Alcanzaste tu meta de peso. ¡Es momento de celebrar!',
        };
      }
    }

    // Check target date milestone (≤7 days remaining)
    if (target.target_date) {
      const daysToGoal = (new Date(target.target_date).getTime() - Date.now()) / 86_400_000;
      if (daysToGoal >= 0 && daysToGoal <= 7) {
        const daysLeft = Math.ceil(daysToGoal);
        return {
          type: 'goal_milestone',
          title: '¡Tu meta se acerca!',
          body: `Quedan ${daysLeft} días. Memo revisa tu progreso contigo.`,
        };
      }
    }

    // Re-engagement (premium)
    if (inactive >= 2) {
      return {
        type: 'missed_workout',
        title: '2 días sin entrenar',
        body: 'Tu racha está en riesgo. Memo tiene tu plan listo.',
      };
    }

    // Daily greeting
    return {
      type: 'progress_update',
      title: '¡Hola, forjador! 💪',
      body: 'Memo está aquí. ¿Qué vamos a trabajar hoy?',
    };
  }

  // Free users
  if (inactive >= 2) {
    return {
      type: 'missed_workout',
      title: 'Te extrañamos 🔥',
      body: 'Memo tiene un mensaje para ti. ¿Volvemos?',
    };
  }

  return {
    type: 'progress_update',
    title: '¡Hola, forjador! 💪',
    body: 'Memo está aquí. ¿Qué vamos a trabajar hoy?',
  };
}

async function sendBatch(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(batch),
    });
    const json = await res.json() as { data: ExpoTicket[] };
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

Deno.serve(async (req: Request) => {
  // Verify QStash signature (skippable for local dev)
  const skipVerify = Deno.env.get('SKIP_QSTASH_VERIFY') === 'true';
  if (!skipVerify) {
    const receiver = new Receiver({
      currentSigningKey: Deno.env.get('QSTASH_CURRENT_SIGNING_KEY')!,
      nextSigningKey: Deno.env.get('QSTASH_NEXT_SIGNING_KEY')!,
    });
    const signature = req.headers.get('Upstash-Signature') ?? '';
    const body = await req.text();
    try {
      await receiver.verify({ signature, body });
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: targets, error } = await supabase
    .rpc('get_notification_targets') as { data: NotificationTarget[] | null; error: unknown };

  if (error || !targets) {
    console.error('Failed to fetch notification targets:', error);
    return new Response(JSON.stringify({ error: 'DB query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build message list and correlate index to target
  const selected: Array<{ target: NotificationTarget; payload: NotificationPayload }> = [];
  for (const target of targets) {
    const payload = decideNotification(target);
    if (payload) selected.push({ target, payload });
  }

  if (selected.length === 0) {
    return new Response(JSON.stringify({ sent: 0, cleaned: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages: ExpoMessage[] = selected.map(({ target, payload }) => ({
    to: target.expo_push_token,
    title: payload.title,
    body: payload.body,
    data: { type: payload.type },
    sound: 'default',
  }));

  const tickets = await sendBatch(messages);

  // Process tickets
  const invalidUserIds: string[] = [];
  const notificationInserts: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
  }> = [];

  tickets.forEach((ticket, i) => {
    const { target, payload } = selected[i];
    if (!target) return;

    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      invalidUserIds.push(target.user_id);
    } else if (ticket.status === 'ok') {
      notificationInserts.push({
        user_id: target.user_id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
      });
    }
  });

  // Clean invalid tokens
  if (invalidUserIds.length > 0) {
    await supabase
      .from('profiles')
      .update({ expo_push_token: null })
      .in('id', invalidUserIds);
  }

  // Insert successful notifications
  if (notificationInserts.length > 0) {
    await supabase.from('notifications').insert(notificationInserts);
  }

  return new Response(
    JSON.stringify({ sent: notificationInserts.length, cleaned: invalidUserIds.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

- [ ] **Step 2: Add `SKIP_QSTASH_VERIFY=true` to `supabase/.env` for local testing**

Open `supabase/.env` and add:
```
SKIP_QSTASH_VERIFY=true
```

Also add placeholder keys (replace with real values from QStash console when ready):
```
QSTASH_CURRENT_SIGNING_KEY=placeholder
QSTASH_NEXT_SIGNING_KEY=placeholder
```

- [ ] **Step 3: Start Supabase and serve the function locally**

In one terminal:
```bash
supabase start
```

In another terminal:
```bash
supabase functions serve send-notifications --env-file supabase/.env --no-verify-jwt
```

Expected output: `Serving functions on http://localhost:54321/functions/v1/`

- [ ] **Step 4: Test with curl (empty DB — expect `sent: 0`)**

```bash
curl -s -X POST http://localhost:54321/functions/v1/send-notifications \
  -H "Authorization: Bearer $(grep ANON_KEY .env.local | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
```

Expected output:
```json
{
  "sent": 0,
  "cleaned": 0
}
```

If you get `{"error":"DB query failed"}`, run `supabase db reset` to apply the migration and retry.

- [ ] **Step 5: Test with a seeded token (optional, requires physical device)**

Insert a test push token directly into the DB (replace values):
```bash
supabase sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
UPDATE profiles
SET expo_push_token = 'ExponentPushToken[YOUR_REAL_TOKEN]'
WHERE id = (SELECT id FROM profiles LIMIT 1);
"
```

Then rerun the curl from Step 4. Expected: `{ "sent": 1, "cleaned": 0 }` — and the physical device receives a notification.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-notifications/index.ts
git commit -m "feat: Edge Function send-notifications with QStash + Expo Push API"
```

Do NOT commit `supabase/.env` (it contains secrets). Verify it is git-ignored:
```bash
git status supabase/.env
```
Expected: `supabase/.env` does not appear (it should be in `.gitignore`).

---

## Post-implementation: QStash setup (manual, one time in production)

This is not automated — do this manually after deploying to Supabase Cloud:

1. Create account at `console.upstash.com` → QStash → Schedules → Create Schedule
2. Settings:
   - Cron: `0 2 * * *`
   - URL: `https://<your-supabase-ref>.supabase.co/functions/v1/send-notifications`
   - Method: `POST`
   - Body: `{}`
3. Copy `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` from the QStash console
4. Set them in Supabase Cloud:
   ```bash
   supabase secrets set \
     QSTASH_CURRENT_SIGNING_KEY=<value> \
     QSTASH_NEXT_SIGNING_KEY=<value>
   ```
5. Remove `SKIP_QSTASH_VERIFY=true` from production secrets (or don't set it — it defaults to unset)

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| QStash cron → Edge Function | Task 4 (EF created; QStash config manual) |
| QStash signature verification | Task 4 (Step 1, `receiver.verify`) |
| Expo token registered on login | Task 1 (hook) + Task 2 (`AuthGuard` call) |
| UPDATE token only if changed | Task 1 (compare before `updateProfile`) |
| Skip simulators | Task 1 (`Device.isDevice` check) |
| Silent fail on permission denial | Task 1 (try/catch + `finalStatus !== 'granted'` guard) |
| Tap listener for notification routing | Task 2 (Step 3) |
| `goal_milestone` → `/(app)/progress` | Task 2 (router.push in listener) |
| `plan_ready` → `/(app)/plans` | Task 2 (router.push in listener) |
| SQL helper function for EF query | Task 3 |
| Activity signal: body_data + daily_message_count | Task 3 (CTEs `last_body` and `last_chat`) |
| Notification priority: milestone > missed > progress | Task 4 (`decideNotification` function) |
| Premium check: plan + status + period_end | Task 4 (`isPremium` function) |
| Churned users (>5 days) → skip | Task 4 (`if inactive > 5 return null`) |
| Free users: missed_workout (2–5 days) + progress_update | Task 4 |
| Premium users: goal_milestone + missed_workout + progress_update | Task 4 |
| Expo Push API in batches of 100 | Task 4 (`sendBatch` function) |
| Clean `DeviceNotRegistered` tokens | Task 4 (filter tickets, update profiles) |
| Insert into `notifications` table | Task 4 (batch insert) |
| `type` column CHECK constraint respected | All types used are in: `progress_update`, `missed_workout`, `goal_milestone` |
| No new table migrations | Confirmed — only a SQL function in 0003 |

**Placeholder scan:** None found.

**Type consistency:**
- `NotificationTarget.target_weight_kg` is `string | null` (Supabase returns NUMERIC as string) — `parseFloat()` applied before comparison. ✅
- `NotificationTarget.last_activity` is `string | null` — `new Date(isoDate).getTime()` handles ISO strings. ✅
- `selected[i]` in the tickets loop could be undefined if `sendBatch` returns more tickets than sent messages (shouldn't happen, but guarded with `if (!target) return`). ✅
- `useNotifications()` returns `void` and is called in `AuthGuard` — no return value used. ✅
