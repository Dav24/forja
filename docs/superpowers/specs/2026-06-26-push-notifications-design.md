# Spec: Paso 11 — Notificaciones Push

**Fecha:** 2026-06-26  
**Proyecto:** Forja  
**Estado:** Aprobado

---

## Objetivo

Implementar notificaciones push diarias enviadas desde Supabase Edge Function, disparadas por QStash. Todos los usuarios (free y premium) reciben notificaciones, diferenciadas por contenido y tipos disponibles. Objetivo: retención y conversión.

---

## Arquitectura

```
QStash (cron 02:00 UTC diario = 20:00 México)
  → POST /functions/v1/send-notifications
      → verifica firma QStash
      → consulta DB (usuarios con token + su plan + actividad)
      → decide qué notificación enviar por usuario
      → llama Expo Push API (batch de hasta 100)
      → inserta en tabla notifications
      → limpia tokens inválidos (DeviceNotRegistered)
```

**Sin nueva migración:** `notifications` y `profiles.expo_push_token` ya existen en `0001_initial_schema.sql`.

---

## Lógica de notificaciones

Un usuario recibe **máximo 1 notificación por día**. Prioridad descendente:

| Prioridad | Condición | Tipo | Free | Premium |
|---|---|---|---|---|
| 1 | Meta alcanzada (progreso ≥ 100%) o target_date ≤ 7 días | `goal_milestone` | ❌ | ✅ |
| 2 | Sin actividad 2–5 días (sin body_data NI chat en ese rango) | `missed_workout` | ✅ (texto genérico) | ✅ (texto específico) |
| 3 | Activo últimos 7 días | `progress_update` (saludo Memo) | ✅ | ✅ |
| — | Inactivo > 5 días (churned) | — ninguna — | skip | skip |

**Definición de "activo":** tiene al menos un `body_data` o un mensaje en `chat_messages` en los últimos N días.

---

## Textos de notificaciones

| Tipo | Título | Cuerpo |
|---|---|---|
| `progress_update` (saludo diario, todos) | "¡Hola, forjador! 💪" | "Memo está aquí. ¿Qué vamos a trabajar hoy?" |
| `missed_workout` (re-engagement, free) | "Te extrañamos 🔥" | "Memo tiene un mensaje para ti. ¿Volvemos?" |
| `missed_workout` (re-engagement, premium) | "2 días sin entrenar" | "Tu racha está en riesgo. Memo tiene tu plan listo." |
| `goal_milestone` (meta cerca, ≤7 días) | "¡Tu meta se acerca!" | "Quedan X días. Memo revisa tu progreso contigo." |
| `goal_milestone` (meta alcanzada) | "¡Lo lograste! 🏆" | "Alcanzaste tu meta de peso. ¡Es momento de celebrar!" |

---

## Sección 1: Cliente — `hooks/useNotifications.ts`

Hook nuevo. Se llama desde `AuthGuard` en `app/_layout.tsx` una vez que `session` está disponible.

**Responsabilidades:**
- Solicitar permisos con `Notifications.requestPermissionsAsync()`
- Si concedidos: obtener token con `Notifications.getExpoPushTokenAsync({ projectId })`
- Comparar con `profiles.expo_push_token` actual — UPDATE solo si cambió
- Salir silenciosamente si permisos denegados o si corre en simulador (detectar con `Device.isDevice` de `expo-device`)

**Firma del hook:**
```ts
export function useNotifications(): void
// Sin retorno — efectos de fondo únicamente
```

**Cuándo se ejecuta:** `useEffect` con dependencia en `session?.user.id` — solo se dispara cuando el usuario inicia sesión.

---

## Sección 2: Cliente — listener global de notificaciones

En `app/_layout.tsx`, dentro de `RootLayout`, agregar un listener con `Notifications.addNotificationResponseReceivedListener`. Navega según `notification.request.content.data.type`:

| `data.type` | Destino |
|---|---|
| `progress_update` / `missed_workout` | `/(app)` (Home) |
| `goal_milestone` | `/(app)/progress` |
| `plan_ready` | `/(app)/plans` |
| cualquier otro | `/(app)` |

El listener se registra una sola vez y se limpia en el return del `useEffect`.

---

## Sección 3: Edge Function `send-notifications`

**Archivo:** `supabase/functions/send-notifications/index.ts`

### 3.1 Verificación de firma QStash

```ts
import { Receiver } from 'npm:@upstash/qstash@^2'

const receiver = new Receiver({
  currentSigningKey: Deno.env.get('QSTASH_CURRENT_SIGNING_KEY')!,
  nextSigningKey: Deno.env.get('QSTASH_NEXT_SIGNING_KEY')!,
})
// Si falla → Response 401
```

### 3.2 Consulta de usuarios elegibles

Con `SUPABASE_SERVICE_ROLE_KEY` (ya disponible en EFs como variable de entorno de Supabase):

```sql
SELECT
  p.id,
  p.expo_push_token,
  p.language,
  s.plan,
  g.type AS goal_type,
  g.target_weight_kg,
  g.target_date,
  MAX(bd.recorded_at) AS last_body_data,
  MAX(cm.created_at) AS last_chat
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
LEFT JOIN goals g ON g.user_id = p.id AND g.is_active = TRUE
LEFT JOIN body_data bd ON bd.user_id = p.id
LEFT JOIN chat_messages cm ON cm.session_id IN (
  SELECT id FROM chat_sessions WHERE user_id = p.id
)
WHERE p.expo_push_token IS NOT NULL
GROUP BY p.id, p.expo_push_token, p.language, s.plan, g.type, g.target_weight_kg, g.target_date
```

### 3.3 Lógica de decisión por usuario

```
isPremium = plan === 'premium'
lastActivity = MAX(last_body_data, last_chat)
daysSinceActive = NOW() - lastActivity (en días)

si isPremium:
  si goal alcanzada (progress ≥ 100%) O target_date ≤ 7 días → goal_milestone
  sino si daysSinceActive ∈ [2, 5] → missed_workout (premium)
  sino si daysSinceActive < 2 → progress_update
  sino → skip

si free:
  si daysSinceActive ∈ [2, 5] → missed_workout (free)
  sino si daysSinceActive < 2 → progress_update
  sino → skip
```

**Progreso de meta:** `|first_body_weight - current_weight| / |first_body_weight - target_weight_kg| × 100`  
Requiere subconsulta adicional para `first_body_weight` (MIN recorded_at por usuario).

### 3.4 Llamada a Expo Push API

```
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json

[
  {
    "to": "<ExponentPushToken[...]>",
    "title": "...",
    "body": "...",
    "data": { "type": "progress_update" },
    "sound": "default"
  },
  ...
]
```

- Batches de máximo 100 mensajes por request
- Parsear tickets de respuesta: `status === 'error'` y `details.error === 'DeviceNotRegistered'` → limpiar token

### 3.5 Limpieza de tokens inválidos

```sql
UPDATE profiles SET expo_push_token = NULL WHERE id IN (<ids con token inválido>)
```

### 3.6 Inserción en tabla notifications

Solo para tickets con `status === 'ok'`:
```sql
INSERT INTO notifications (user_id, type, title, body)
VALUES (...) -- batch insert
```

---

## Sección 4: Configuración QStash (manual, una vez en producción)

1. Crear cuenta en `console.upstash.com`
2. QStash → Schedules → Create:
   - Cron: `0 2 * * *`
   - URL: `https://<ref>.supabase.co/functions/v1/send-notifications`
   - Method: POST
   - Body: `{}` (vacío)
3. Copiar `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY`
4. Agregarlos a `supabase/.env`:
   ```
   QSTASH_CURRENT_SIGNING_KEY=<valor>
   QSTASH_NEXT_SIGNING_KEY=<valor>
   ```
5. Aplicar en Supabase Cloud: `supabase secrets set QSTASH_CURRENT_SIGNING_KEY=<valor> QSTASH_NEXT_SIGNING_KEY=<valor>`

**Para probar localmente sin QStash:** llamar directamente con curl pasando el header `Upstash-Signature` simulado, o temporalmente deshabilitar la verificación de firma con una variable de entorno `SKIP_QSTASH_VERIFY=true`.

---

## Secrets necesarios

| Variable | Fuente |
|---|---|
| `QSTASH_CURRENT_SIGNING_KEY` | Console QStash |
| `QSTASH_NEXT_SIGNING_KEY` | Console QStash |
| `SUPABASE_SERVICE_ROLE_KEY` | Automático en Edge Functions de Supabase |
| `SUPABASE_URL` | Automático en Edge Functions de Supabase |

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `hooks/useNotifications.ts` | Crear |
| `app/_layout.tsx` | Modificar — llamar `useNotifications` + listener de tap |
| `supabase/functions/send-notifications/index.ts` | Crear |
| `supabase/.env` | Modificar — añadir QStash keys (no se commitea) |

---

## Criterios de éxito

1. Al hacer login en dispositivo físico, la app solicita permisos de notificaciones
2. El token se guarda en `profiles.expo_push_token`
3. La Edge Function se puede invocar manualmente (curl) y envía notificaciones a dispositivos con token registrado
4. La lógica de prioridad respeta el tier (free vs premium)
5. Tokens inválidos se limpian automáticamente
6. QStash reintenta automáticamente si la EF falla
