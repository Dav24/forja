# Spec: Paso 12 — Freemium Gates y Pantalla de Upgrade

**Fecha:** 2026-06-27
**Proyecto:** Forja
**Estado:** Aprobado

---

## Objetivo

Implementar la experiencia completa de monetización in-app: pantalla de upgrade con comparativa de tiers, `UpgradeSheet` contextual para cada gate bloqueado, `PaywallBanner` reutilizable para límites alcanzados, y cableado de todos los gates existentes al nuevo flujo.

---

## Modelo de tiers

| Feature | Free | Premium | Pro (próximamente) |
|---|---|---|---|
| Chat con Memo | 20 msgs/día | Ilimitado | Ilimitado |
| Planes de entrenamiento | 1/mes | Ilimitados | Ilimitados |
| Planes alimenticios | 1 de por vida | 10/mes | Ilimitados |
| Historial corporal | 14 días | 365 días | 365 días |
| Composición corporal (% grasa, músculo) | 🔒 | ✅ | ✅ |
| Conexión pulsera / reloj | ✅ | ✅ | ✅ |
| Memo analiza workouts reales | 🔒 | ✅ | ✅ |
| Adherencia al plan de entrenamiento | 🔒 | ✅ | ✅ |
| Calibración calórica (quemado vs comido) | 🔒 | ✅ | ✅ |
| Fotos de comida (análisis IA) | 🔒 | 🔒 | ✅ |
| Análisis de técnica de ejercicio | 🔒 | 🔒 | ✅ |

**Precios:**
- Premium mensual: **$179 MXN/mes**
- Premium anual: **$1,299 MXN/año** (~$108/mes, ahorro 40%)
- Pro: próximamente (~$349 MXN/mes)

**Pago:** navegador externo → `https://pay.forja.fit` (Stripe). Sin WebView embebido. La app construye la URL con parámetros: `?plan=premium&billing=monthly|yearly&promo=CODIGO`.

**Nota de roadmap:** Native IAP (Apple In-App Purchase + Google Play Billing) está planeado para el futuro cuando el volumen lo justifique. No se implementa en este paso.

---

## Arquitectura

```
Gate bloqueado (WeightChart, MeasurementForm, meal plan)
  → usuario toca elemento bloqueado
    → abre UpgradeSheet (snap 60%)
      → "Ver todos los beneficios" → router.push('/(app)/upgrade')
      → "Hazte Premium" → Linking.openURL('https://pay.forja.fit?plan=premium&billing=yearly')

MessageLimitBanner (chat, límite alcanzado)
  → botón "Premium" → router.push('/(app)/upgrade')   [cambio: antes iba a /profile]

/(app)/profile
  → card "Hazte Premium" (si !isPremium) → router.push('/(app)/upgrade')

/(app)/upgrade
  → toggle mensual / anual (estado local)
  → comparativa Free · Premium · Pro
  → campo promo code (colapsable, estado local)
  → "Continuar con Premium" → Linking.openURL con plan + billing + promo
  → si isPremium: "Gestionar suscripción" → Linking.openURL('https://pay.forja.fit/portal')
```

---

## Archivos a crear / modificar

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `components/premium/UpgradeSheet.tsx` | Crear (reemplaza placeholder vacío) | Sheet contextual con bullets por feature |
| `components/premium/PaywallBanner.tsx` | Crear (reemplaza placeholder vacío) | Banner inline reutilizable para límites |
| `app/(app)/upgrade.tsx` | Crear | Pantalla completa de comparativa de tiers |
| `components/progress/WeightChart.tsx` | Modificar | Tap en rango bloqueado → abre UpgradeSheet |
| `components/progress/MeasurementForm.tsx` | Modificar | Tap en campo bloqueado → abre UpgradeSheet |
| `components/chat/MessageLimitBanner.tsx` | Modificar | Botón Premium → navega a /upgrade |
| `app/(app)/plans/meal/index.tsx` | Modificar | Botón "Regenerar" bloqueado → PaywallBanner + /upgrade |
| `app/(app)/profile.tsx` | Crear (reemplaza placeholder vacío 0 bytes) | Pantalla de perfil con card upgrade + datos básicos |

---

## Componente: `UpgradeSheet`

**Archivo:** `components/premium/UpgradeSheet.tsx`

**Props:**
```ts
type UpgradeContext = 'chart_range' | 'body_composition' | 'meal_plan' | 'generic'

interface UpgradeSheetProps {
  context?: UpgradeContext  // default: 'generic'
}

// Uso: const sheetRef = useRef<any>(); sheetRef.current?.expand()
// Se exporta con forwardRef para exponer ref al padre
```

**Snap points:** `['60%']`

**Contenido:**
- Handle bar
- Ícono 🔒 + título según context
- 3 bullets con checkmarks (copy específico por context)
- Precio ancla: "Desde $1,299/año"
- Botón primary "Hazte Premium →" → `Linking.openURL('https://pay.forja.fit?plan=premium&billing=yearly')`
- Link secundario "Ver todos los beneficios ↗" → `router.push('/(app)/upgrade')`

**Copy por context:**

| Context | Título | Bullets |
|---|---|---|
| `chart_range` | "Historial completo" | "Hasta 365 días de datos" · "Rangos de 1 mes y 3 meses" · "Tendencias de largo plazo" |
| `body_composition` | "Composición corporal" | "% de grasa corporal" · "Masa muscular en kg" · "Seguimiento completo de tu cuerpo" |
| `meal_plan` | "Planes ilimitados" | "10 planes al mes" · "Actualiza según tu progreso" · "Memo ajusta según tus datos reales" |
| `generic` | "Desbloquea Premium" | "Chat ilimitado con Memo" · "Planes de entrenamiento ilimitados" · "Análisis de workouts con tu pulsera" |

**Layout (NativeWind v4):**
- Contenedor: `className="flex-1 px-6 pt-4"` 
- Colores: `style={{ backgroundColor: colors.surface }}`
- Botón primary: usa componente `Button` del design system
- Precio y bullets: `style={{ color: colors.textMuted }}`

---

## Componente: `PaywallBanner`

**Archivo:** `components/premium/PaywallBanner.tsx`

**Props:**
```ts
interface PaywallBannerProps {
  message: string
  ctaLabel?: string    // default: "Hazte Premium"
  onPress: () => void
}
```

**Visual:** Fondo `colors.accent + '1A'`, borde `colors.accent + '40'`, borde radius 12, padding 12. Fila horizontal: ícono `⚡ (Ionicons flash-outline, color accent)` + texto flex + botón pequeño background accent.

Mismo patrón que `MessageLimitBanner` (que usa `colors.destructive`) para consistencia visual — solo difiere en el color de acento.

**Uso actual:** `app/(app)/plans/meal/index.tsx` donde hay texto de "Regenerar requiere Premium".

---

## Pantalla: `/(app)/upgrade`

**Archivo:** `app/(app)/upgrade.tsx`

**Estado local:**
```ts
const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly')
const [promoCode, setPromoCode] = useState('')
const [promoOpen, setPromoOpen] = useState(false)
```

**Secciones (ScrollView):**

### 1. Header
- Ícono ⚡ (40px, color accent)
- Título "FORJA PRO" — SpaceGrotesk-Bold, 28px
- Subtítulo "Entrena con inteligencia" — Inter-Regular, 16px, textMuted

### 2. Toggle billing
- Dos opciones: "Mensual" / "Anual" como segmented control
- Anual seleccionado por default
- Bajo el toggle si `billing === 'yearly'`: texto "Ahorras 40% con el plan anual" — color primary, Inter-Regular 13px

### 3. Cards de tiers

**Card Free** (atenuada, `opacity: 0.7`):
- Badge "Actual" si `!isPremium`, nada si `isPremium`
- Precio: "$0"
- 3 bullets de features free

**Card Premium** (destacada, borde `colors.primary`, background `colors.surface`):
- Badge "Recomendado" — variant accent
- Precio: `billing === 'monthly' ? '$179 MXN/mes' : '$1,299 MXN/año'`
- Si anual: subtexto "$108/mes — ahorro del 40%"
- 6 bullets de features premium (checkmarks en `colors.primary`)

**Card Pro** (`opacity: 0.6`, borde `colors.textMuted`):
- Badge "Próximamente" — variant neutral/gris
- Sin precio visible
- 3 bullets de features Pro (iconos en textMuted)
- Sin botón de acción — no interactuable

### 4. Campo promo code (colapsable)
- `TouchableOpacity` "¿Tienes un código? ▼" → toggle `promoOpen`
- Si `promoOpen`: `Input` del design system, placeholder "FORJA2024", `value={promoCode}`, `onChangeText={setPromoCode}`, autoCapitalize="characters"

### 5. CTA
- Si `!isPremium`:
  - `Button` label={`billing === 'monthly' ? 'Continuar — $179/mes' : 'Continuar — $1,299/año'`}
  - `onPress`: construye URL y abre browser:
    ```ts
    const url = new URL('https://pay.forja.fit');
    url.searchParams.set('plan', 'premium');
    url.searchParams.set('billing', billing);
    if (promoCode.trim()) url.searchParams.set('promo', promoCode.trim().toUpperCase());
    Linking.openURL(url.toString());
    ```
- Si `isPremium`:
  - Texto "Ya eres Premium ✓" en verde
  - Botón secundario "Gestionar suscripción" → `Linking.openURL('https://pay.forja.fit/portal')`

### 6. Footer legal
- Texto pequeño centrado: "Cancela cuando quieras · Procesado de forma segura con Stripe"
- `Inter-Regular`, 12px, `colors.textMuted`

---

## Gates a cablear

### `WeightChart.tsx`
- Agregar `useRef<any>` para `UpgradeSheet`
- El `TouchableOpacity` del rango bloqueado actualmente hace `onPress={() => !locked && setRange(key)}`
- Cambiar a: si `locked` → `sheetRef.current?.expand()`, si no → `setRange(key)`
- Renderizar `<UpgradeSheet ref={sheetRef} context="chart_range" />` al final del componente

### `MeasurementForm.tsx`
- Agregar `useRef<any>` para `UpgradeSheet`
- Los `Input` de grasa y músculo tienen `editable={isPremium}` — agregar `onPressIn={() => !isPremium && sheetRef.current?.expand()}`
- Renderizar `<UpgradeSheet ref={sheetRef} context="body_composition" />` al final

### `MessageLimitBanner.tsx`
- Cambiar `onPress={() => router.push('/(app)/profile')}` a `router.push('/(app)/upgrade')`

### `app/(app)/plans/meal/index.tsx`
- El botón "Regenerar requiere Premium" (actualmente disabled) → reemplazar con `<PaywallBanner message="Ya usaste tu plan gratuito" onPress={() => router.push('/(app)/upgrade')} />`
- El texto informativo de "Plan gratuito: 1 generación de por vida" puede permanecer como está

### `app/(app)/profile.tsx`
- Archivo actualmente vacío (0 bytes) — se crea desde cero en este paso
- Datos a mostrar: avatar (inicial del nombre), `display_name`, email del usuario, badge de plan actual
- Si `!isPremium`: card destacada al inicio con ícono ⚡, copy "Desbloquea todo el potencial de Memo", botón → `router.push('/(app)/upgrade')`
- Si `isPremium`: badge "✓ Premium activo" con `current_period_end` formateado, sin CTA de upgrade
- Botón "Cerrar sesión" al final (llama `supabase.auth.signOut()`)
- El resto del perfil (editar nombre, idioma, etc.) es future scope — no implementar en este paso

---

## Criterios de éxito

1. Tapping cualquier elemento bloqueado (gráfica, campos de composición) abre `UpgradeSheet` con bullets relevantes
2. `UpgradeSheet` abre el navegador externo a pay.forja.fit al presionar "Hazte Premium"
3. "Ver todos los beneficios" navega a `/(app)/upgrade`
4. Toggle mensual/anual cambia el precio visible sin llamadas de red
5. Campo promo code aparece y el código se incluye en la URL de pay.forja.fit
6. `MessageLimitBanner` navega a `/upgrade` en lugar de `/profile`
7. Pantalla de perfil muestra card de upgrade para usuarios free
8. La card Pro aparece atenuada y marcada como "Próximamente" sin acción
9. Usuario premium ve "Ya eres Premium ✓" y botón de gestión en lugar del CTA de upgrade
