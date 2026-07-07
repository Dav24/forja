# Spec: Ajustes de cuenta y personalización de perfil

**Fecha:** 2026-07-07
**Estado:** Aprobado por el usuario (diseño validado por secciones)
**Contexto:** Mini-paso previo al Paso 14 (i18n) — genera todos sus strings de UI antes de traducir. Sucede al mini-paso multi-modalidad (2026-07-07).

## 1. Objetivo

Hoy la pestaña Perfil es solo lectura (inicial, nombre, correo, badge de plan, cerrar sesión) y no existe ninguna área de configuración. Este mini-paso entrega:

1. **Perfil enriquecido**: identidad + progreso del usuario, con foto de perfil editable.
2. **Ajustes completos**: cuenta (foto/nombre/correo/contraseña/eliminar), mi entrenamiento (objetivo/nivel/modalidades/modo/datos básicos), notificaciones, idioma, suscripción, legal, soporte.
3. **Verificación de correo en el registro**: fin de los correos inventados (testeable local con Mailpit; producción espera dominio+SMTP).

**Fuera de alcance (decidido):** unidades kg/lb (transversal, va con/después de i18n), teaser de wearables (omitido), feedback vía PostHog (no está instalado; soporte por `mailto:`), edición de peso/grasa/músculo (ya existe en Progreso).

## 2. Navegación

Opción aprobada: **Perfil con identidad + engrane → Ajustes hub → subpantallas** (stack anidado con back nativo).

```
Tab Perfil (⚙️ en header)
  └─ /(app)/settings/            ← stack anidado, href:null en tab bar (patrón upgrade.tsx)
       ├─ index.tsx              Hub: filas agrupadas + cerrar sesión + versión
       ├─ account.tsx            Cuenta: foto, nombre, correo, contraseña, eliminar
       ├─ delete-account.tsx     Confirmación de borrado (escribir "ELIMINAR")
       ├─ training.tsx           Mi entrenamiento
       ├─ notifications.tsx      Toggles de notificaciones
       ├─ language.tsx           Idioma
       ├─ subscription.tsx       Plan + gestión Stripe
       └─ (legal/soporte: filas del hub que abren URL externa / mailto)
```

## 3. Pestaña Perfil (rediseño)

- **Header:** "Perfil" + ícono de engrane → `/(app)/settings`.
- **Identidad:** avatar 96px — muestra `profiles.avatar_url` con `expo-image` si existe, si no la inicial actual. Badge de cámara; **tocar el avatar lanza directo el flujo de foto** (mismo hook que en Ajustes → Cuenta). Nombre, correo, badge de plan (como hoy). Línea nueva: **"Forjador desde {mes año}"** (`profiles.created_at`).
- **Progreso:**
  - Racha con `StreakFlame` + `useStreak` (existentes, hoy solo en Home).
  - Fila de 3 `StatCard` (existentes) con datos reales: **Planes generados** (count `workout_plans` + `meal_plans`), **Registros corporales** (count `body_data`), **Días en Forja** (desde `created_at`). NO hay "entrenamientos completados" — no existe tabla que los registre hasta la fase 2 de multi-deporte (registro manual de actividades).
- **Objetivo activo:** tarjeta "🎯 {objetivo} · {nivel}" + chips de modalidades, chevron → `/settings/training`. Sin goal activo → CTA "Define tu objetivo".
- **Cierre:** card de upgrade (free) o renovación (premium), igual que hoy. **"Cerrar sesión" se muda al hub de Ajustes.**
- **Hook nuevo `useProfileStats`:** counts con `select('*', { count: 'exact', head: true })`.

## 4. Ajustes hub (`settings/index.tsx`)

Componente nuevo reutilizable **`SettingsRow`** (ícono, label, valor opcional, chevron | toggle | variante danger). Grupos:

| Grupo | Filas |
|---|---|
| Cuenta | Cuenta › |
| Entrenamiento | Mi entrenamiento › |
| Preferencias | Notificaciones › · Idioma (valor: "Español") › |
| Suscripción | Suscripción (valor: plan actual) › |
| Legal | Política de privacidad › · Términos y condiciones › (ver §8) |
| Soporte | Contactar soporte (mailto) |
| — | Cerrar sesión (danger) |
| Pie | Versión + build (`expo-application`) |

## 5. Cuenta (`settings/account.tsx`)

- **Foto:** mismo flujo compartido `useAvatarUpload` (ver §9 Storage).
- **Nombre:** input + guardar → `useUpdateProfile` (existente).
- **Correo:** muestra el actual; input de correo nuevo → `supabase.auth.updateUser({ email })`. Supabase usa *secure email change* (default): enlace de confirmación **a ambos correos**; la UI lo dice explícito ("Revisa ambas bandejas") y el correo mostrado no cambia hasta confirmar. Dev local: correos en Mailpit (`localhost:54324`).
- **Contraseña:** nueva + confirmar (misma validación mínima que el registro) → `supabase.auth.updateUser({ password })`. No pide la actual (opera sobre la sesión activa).
- **Zona de peligro:** fila roja "Eliminar cuenta" → `delete-account.tsx`: pantalla que explica qué se borra (todo, irreversible) y exige **escribir "ELIMINAR"** para habilitar el botón. Confirmar → EF `delete-account` (§9) → si 200: `signOut` local → login. Si error: cuenta intacta + mensaje.

## 6. Mi entrenamiento (`settings/training.tsx`)

- Edita: **objetivo** (6 tipos de `goals.type`), **nivel** (5 de `fitness_level`), **modo** (flexible/estricto), **modalidades** (las 8 del catálogo multi-modalidad, multi-selección, reusando los componentes de selección del onboarding) y **altura/edad/género**.
- **Guardar objetivo = INSERT de goal nuevo activo + desactivar el anterior** (no update en sitio): conserva historial usando el diseño `is_active` existente.
- **Altura/edad/género:** UPDATE sobre el último registro de `body_data` (son atributos, no mediciones); si no hay registro, INSERT. Peso/grasa/músculo siguen viviendo solo en Progreso.
- Aviso bajo el botón: *"Los cambios aplican a tu próximo plan generado"* — NO se regenera el plan automáticamente (costaría un crédito de IA no solicitado).
- Límite conocido heredado: `ball_sports` captura `sport_type` solo desde onboarding — esta pantalla lo corrige exponiendo el campo cuando la modalidad es deportes con balón.

## 7. Notificaciones e Idioma

- **Notificaciones (`settings/notifications.tsx`):** 2 toggles (no 5): **"Recordatorios de entrenamiento y dieta"** (`missed_workout`, `diet_alert`) y **"Progreso y planes"** (`progress_update`, `goal_milestone`, `plan_ready`). Persisten en `profiles.notif_reminders` / `notif_updates` (migración 0007). `get_notification_targets()` se actualiza para filtrar por ellas. Si el permiso del SO está denegado: banner con `Linking.openSettings()`.
- **Idioma (`settings/language.tsx`):** radio list — **Español** (activo, guarda `profiles.language`) y **English deshabilitado con "Próximamente"**; se habilita en el Paso 14 sin rediseño.

## 8. Suscripción, Legal y Soporte

- **Suscripción (`settings/subscription.tsx`):** plan actual + fecha de renovación (`useSubscription`). Free → botón a `/upgrade`. Premium → "Gestionar suscripción" abre Stripe Customer Portal (`lib/payments.ts:getPortalUrl`, existente). **No hay "Restaurar compra"** (no aplica: pago web, no IAP).
- **Legal:** constantes `PRIVACY_URL` / `TERMS_URL` en config. **Fila oculta si la URL está vacía** — cero callejones sin salida; conectar el documento real (cuando exista dominio+textos) es un cambio de una línea. Nota: la URL de privacidad es requisito de submission en App Store/Play — bloqueado por compra de dominio, no por esta app.
- **Soporte:** fila → `mailto:` a constante `SUPPORT_EMAIL` (valor inicial: `dav.ro.re2@gmail.com`; cambiar a `soporte@forja.fit` cuando exista el dominio).

## 9. Backend

### Storage — bucket `avatars` (migración 0008)
- Insert en `storage.buckets`: **lectura pública** (foto de perfil no es dato sensible), escritura/actualización/borrado solo del dueño sobre `{uid}.jpg` (políticas RLS en `storage.objects` comparando `auth.uid()` con el nombre del objeto).
- **Flujo de subida (`useAvatarUpload`):** `expo-image-picker` (instalar con `npx expo install` — regla del proyecto; compatible Expo Go) → recorte cuadrado nativo (`allowsEditing`) → `expo-image-manipulator`: redimensión 512×512 + compresión → `upload(..., { upsert: true })` → guarda URL pública con `?v={timestamp}` en `avatar_url` (revienta caché).

### EF `delete-account` (nueva)
1. Verifica JWT → uid.
2. Con service role, **en este orden** (falla ⇒ aborta, cuenta intacta):
   a. Si hay suscripción activa con `stripe_subscription_id` → **cancelar en Stripe** (sin esto, Stripe seguiría cobrando a una cuenta borrada).
   b. Borrar `avatars/{uid}.jpg` de Storage (ignorar "no existe").
   c. `auth.admin.deleteUser(uid)` → `ON DELETE CASCADE` limpia las 10 tablas.
3. Cliente: `signOut` **solo tras 200**.

### Verificación de correo en registro
- `config.toml`: `enable_confirmations = true` en `[auth.email]`.
- Registro: `signUp` con `emailRedirectTo` al deep link `forja://` (mismo mecanismo que el pago) — ya no devuelve sesión; la app muestra estado **"Revisa tu correo para confirmar"** con botón **"Reenviar correo"** (`supabase.auth.resend()`).
- Login con correo sin confirmar (`Email not confirmed`) → mensaje amigable + reenviar.
- Usuarios dev existentes ya cuentan como confirmados. **Producción**: requiere SMTP sobre dominio verificado — se activa cuando se compre el dominio; el flujo queda construido y probado local con Mailpit.

### Migración 0007
- `profiles.notif_reminders BOOLEAN NOT NULL DEFAULT TRUE`, `profiles.notif_updates BOOLEAN NOT NULL DEFAULT TRUE`.
- `get_notification_targets()` filtra por la columna correspondiente al tipo de notificación.

## 10. Manejo de errores (patrón uniforme)

- Permiso de galería denegado → banner con "Abrir ajustes del teléfono".
- Subida de foto: el avatar solo cambia tras éxito confirmado (nada optimista); error → mensaje inline, foto anterior intacta.
- Errores de Supabase auth mapeados a español amigable ("Ese correo ya está en uso", "Contraseña muy corta") — mismo patrón inline de las pantallas de auth existentes.
- Eliminar cuenta: error de la EF → cuenta intacta + mensaje; nunca `signOut` sin éxito confirmado.

## 11. Testing

- **TDD** en lo puro/testeable: `useProfileStats`, lógica de compresión/rutas del upload, EF `delete-account` (mocks de Stripe y admin API — mismo enfoque que el checkout web, 8/8).
- **E2E manual guiado:** registro nuevo con verificación vía Mailpit → foto → nombre → cambio de correo (doble confirmación) → contraseña → toggles persisten tras reinicio → eliminar cuenta → login falla y DB queda limpia (verificar cascade).
- `tsc --noEmit` limpio + verificación en Expo Go en teléfono.

## 12. Reglas del proyecto que aplican

- NativeWind v4: estático en `className`, dinámico/colores/fonts en `style`.
- Deps nativas SIEMPRE con `npx expo install` (expo-image-picker, expo-image-manipulator, expo-image, expo-application).
- Nunca funciones JS dentro de `useAnimatedStyle` (regla Reanimated).
- Copy: la conexión de wearables es gratis en todos los tiers (no aplica aún aquí — teaser omitido — pero rige para el futuro).
- Leer docs Expo SDK 56 versionadas antes de escribir código (AGENTS.md).
