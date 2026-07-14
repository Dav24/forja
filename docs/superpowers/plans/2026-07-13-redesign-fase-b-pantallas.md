# Rediseño Fase B: Pantallas core + pricing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las 6 pantallas core se ven como el prototipo v7 y el pricing $219/$1,579 queda aplicado en app, web y Stripe test.

**Architecture:** Restyle anclado al prototipo: **la fuente de verdad visual es `docs/superpowers/prototypes/forja-atletica.html`** (cada task nombra su sección `data-s="…"`/`data-p="…"`; el implementador la LEE y replica estructura/jerarquía con los tokens de `useTheme()` y la tipografía de Fase A). Regla de conservación: hooks, queries, navegación y lógica de datos NO cambian — solo presentación. Componentes nuevos (WeekRing, WeekBars) sí llevan código completo aquí.

**Tech Stack:** Fase A (useTheme/tokens, StaggerIn, PillTabBar, VulcanoAvatar v2, tipografía), react-native-svg + Reanimated (anillo), stripe CLI (prices test).

**Spec:** `docs/superpowers/specs/2026-07-13-redesign-fase-b-pantallas-design.md`

## Global Constraints

- Fuente visual: prototipo v7. Ante duda entre este plan y el prototipo, gana el prototipo.
- Conservación: NO cambiar hooks/queries/navegación/lógica; los textos existentes conservan su clave i18n; claves nuevas SOLO para copy nuevo (siempre es+en, `npm run check-i18n`).
- Colores/fonts SIEMPRE vía `useTheme()`/`typography` — cero hex nuevos salvo los 2 casos "siempre oscuro" (hero de Upgrade y card up-hero de Perfil) que van con comentario `// Siempre oscuro en ambos temas — decisión del prototipo v7`.
- Regla worklets: dentro de `useAnimatedStyle`/`useAnimatedProps` solo shared values capturados.
- Pricing: montos SOLO en `constants/pricing.ts` (app) — $219 / $1,579 / equivalente mensual $132.
- Commits en español `feat(fase-b):`. Rama master. Dir: `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja`.
- Gate por task: `npx tsc --noEmit` limpio (+ `check-i18n` si tocó locales).

---

### Task 1: Pricing end-to-end ($219 / $1,579)

**Files:**
- Modify: `constants/pricing.ts`
- Modify: `web/components/PricingSection.tsx:65`
- Modify: `web/.env.local` (gitignorado — se edita, NO se commitea)
- Stripe test: crear 2 prices vía CLI

**Interfaces:**
- Produces: `PRICE_MONTHLY='$219'`, `PRICE_YEARLY='$1,579'`, `PRICE_YEARLY_MONTHLY_EQUIVALENT='$132'` (Task 7 los consume). Env `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_YEARLY` con IDs nuevos.

- [ ] **Step 1: Actualizar `constants/pricing.ts`** — reemplazar los 3 montos:

```ts
export const PRICE_MONTHLY = '$219';
export const PRICE_YEARLY = '$1,579';
// $1,579 / 12 ≈ $131.6 → display redondeado
export const PRICE_YEARLY_MONTHLY_EQUIVALENT = '$132';
```

(`PRICE_FREE` y los derivados `_MXN` no cambian de forma.)

- [ ] **Step 2: Actualizar `web/components/PricingSection.tsx`** línea 65:

```ts
  const price = billing === 'monthly' ? '$219' : '$1,579';
```

(Revisar el resto del archivo por otros montos/copys con $179/$1,299 — p. ej. desglose de ahorro — y actualizarlos con la misma matemática: ahorro ≈40%.)

- [ ] **Step 3: Crear prices nuevos en Stripe test**

```bash
PRODUCT=$(stripe prices retrieve price_1TpT9bK3706kh3Wno1HjLqRK | python3 -c "import sys,json;print(json.load(sys.stdin)['product'])")
stripe prices create --product "$PRODUCT" --currency mxn --unit-amount 21900 -d "recurring[interval]=month" --nickname "Maestro mensual 219"
stripe prices create --product "$PRODUCT" --currency mxn --unit-amount 157900 -d "recurring[interval]=year" --nickname "Maestro anual 1579"
```

Guardar los 2 IDs devueltos. (Los prices viejos NO se borran. Si el CLI pide login/expiró la key: STATUS BLOCKED con el error — no improvisar.)

- [ ] **Step 4: Actualizar `web/.env.local`** con los IDs nuevos en `STRIPE_PRICE_MONTHLY` y `STRIPE_PRICE_YEARLY`.

- [ ] **Step 5: Verificar**

```bash
stripe prices retrieve <ID_MENSUAL> | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['unit_amount'],d['currency'],d['recurring']['interval'])"
stripe prices retrieve <ID_ANUAL>  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['unit_amount'],d['currency'],d['recurring']['interval'])"
grep -rn "179\|1,299\|1299" constants web/components locales | grep -v node_modules
```

Expected: `21900 mxn month` / `157900 mxn year`; el grep sin hits de montos viejos (ojo: `1799`≠ y números de otras cosas no cuentan — revisar hits a mano).

- [ ] **Step 6: Commit** (`web/.env.local` queda fuera — documentar los IDs nuevos en el reporte):

```bash
git add constants/pricing.ts web/components/PricingSection.tsx
git commit -m "feat(fase-b): pricing $219/$1,579 en app y web + prices nuevos de Stripe test"
```

---

### Task 2: Home restyle (hero radial + anillo)

**Files:**
- Create: `lib/weekProgress.ts`
- Create: `components/home/WeekRing.tsx`
- Modify: `app/(app)/index.tsx`
- Prototipo: sección `<section class="screen" data-s="home">` + CSS `.hero`, `.ringwrap`, `.bento`, `.streak`

**Interfaces:**
- Produces: `weekProgress(schedule: { day_number: number; is_rest: boolean }[], todayJsDay: number): { done: number; total: number }` — días de entrenamiento del plan YA transcurridos esta semana (inclusive hoy) vs totales. `<WeekRing progress={0..1} size={196}>{children}</WeekRing>` — anillo con gradiente ámbar→ember, track `ringTrack`, dibuja animado al montar; children van al centro.

- [ ] **Step 1: Crear `lib/weekProgress.ts`** (helper puro — en Fase C se cambia por sesiones reales):

```ts
// Progreso semanal aproximado (Fase B): días de ENTRENAMIENTO del plan ya
// transcurridos esta semana / totales. day_number 1=Lun … 7=Dom (JS: 0=Dom).
// Fase C lo sustituye por sesiones completadas reales.
export function weekProgress(
  schedule: { day_number: number; is_rest: boolean }[],
  todayJsDay: number,
): { done: number; total: number } {
  const train = schedule.filter((d) => !d.is_rest);
  const total = train.length;
  const todayNumber = todayJsDay === 0 ? 7 : todayJsDay;
  const done = train.filter((d) => d.day_number <= todayNumber).length;
  return { done, total };
}
```

- [ ] **Step 2: Crear `components/home/WeekRing.tsx`**:

```tsx
import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props { progress: number; size?: number; children?: ReactNode }

// Anillo de progreso semanal del hero (prototipo v7, .ringwrap): track sutil +
// arco con gradiente ámbar→ember que se dibuja al montar.
export function WeekRing({ progress, size = 196, children }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const strokeWidth = 11;
  const r = (size - strokeWidth * 2) / 2 + strokeWidth / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = useSharedValue(circumference);

  useEffect(() => {
    const target = circumference * (1 - clamped);
    if (reduced) { offset.value = target; return; }
    offset.value = circumference;
    offset.value = withDelay(250, withTiming(target, { duration: 1300 }));
  }, [clamped, circumference, reduced, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="emberRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ringTrack} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#emberRing)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none"
          strokeDasharray={`${circumference}`} animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 3: Restyle de `app/(app)/index.tsx`** — LEE la pantalla actual completa Y la sección `data-s="home"` del prototipo. Reestructura la presentación para igualar el prototipo, conservando TODOS los hooks/datos actuales. Checklist de elementos (de arriba a abajo, cada uno en su `StaggerIn` — la pantalla ya los usa):
  1. Fila superior: eyebrow fecha (día semana + día + mes abreviado, con el locale/formatDate ya usados en el proyecto) + saludo `HOY SE FORJA,` / `{nombre}` en Bebas `typography.sizes.display` (40), nombre en `colors.primaryText`; a la derecha chip de racha (StreakFlame existente en tamaño chip + número Mono en `accentText`) — conservar la clave i18n del saludo actual si existe; si el copy actual difiere, crear clave nueva es+en.
  2. Hero card: borderRadius 26, fondo `surface` + gradiente radial ember arriba (usar `expo-linear-gradient` si ya está en deps — está (`gradients` de marca lo usan); aproximar el radial del prototipo con un LinearGradient vertical de `colors.primary` al 15-28% de opacidad hacia transparente, altura ~55% top, o `borderColor` `line`): eyebrow centrado "Semana de forja · {done} de {total}", `<WeekRing progress={done/total}>` con centro = eyebrow `Día {n} · {focus corto}` en `primaryText` + focus Bebas 27 en 2 líneas + meta mono 10 (`{k} ejercicios · ~{min} min`); CTA `btn` estilo fire (gradiente `gradientsByTheme[resolved].ember` + `fireShadowByTheme[resolved]`, texto `onPrimary` SpaceGrotesk-Bold) "EMPEZAR SESIÓN" → misma navegación actual al plan/día. Estados sin plan/descanso: conservar los actuales con la piel nueva (hero muestra estado vacío/descanso en el centro del anillo con progress igual).
  3. Bento 2 col (gap 12): card peso (eyebrow "Peso actual" 10px + valor Mono 26 con unidad pequeña + delta verde Mono 11.5 con ↓/↑, datos del hook existente) + card siguiente comida (eyebrow + nombre Inter-Medium 13.5 + hora·kcal mono 11 desde el meal plan activo; sin meal plan → CTA corto a Planes). Claves i18n nuevas si el copy no existe.
  4. Card "Vulcano te espera": `<VulcanoAvatar size={40} />` + título SpaceGrotesk 13.5 + quote muted 12 + chevron → navega al tab Coach (navegación con el patrón del proyecto). Clave i18n nueva es+en para título y quote.
  Elimina de la pantalla lo que el prototipo ya no muestra (p. ej. secciones/copys viejos) SOLO si su dato no aparece en otro lado del nuevo layout; ante duda, consérvalo abajo del bento.

- [ ] **Step 4: Verificar** — `npx tsc --noEmit && npm run check-i18n` limpios.

- [ ] **Step 5: Commit** — `git add lib/weekProgress.ts components/home/WeekRing.tsx "app/(app)/index.tsx" locales && git commit -m "feat(fase-b): home con hero radial, anillo semanal y bento"`

---

### Task 3: Coach restyle (editorial)

**Files:**
- Modify: `app/(app)/chat.tsx` (header), `components/chat/ChatBubble.tsx`
- Modify: `locales/es/chat.json`, `locales/en/chat.json` (clave nueva de estado)
- Prototipo: `data-s="coach"` + CSS `.coach-hd`, `.m-user`, `.m-vul`, `.typing`

- [ ] **Step 1: Header** en `chat.tsx`: `<VulcanoAvatar size={46} />` + columna: "Vulcano" SpaceGrotesk-Bold 15.5 + fila estado: dot 6px `colors.primary` con shadow ember + texto 11.5 `primaryText` con clave nueva `chat.statusForge` (es: "En la fragua" / en: "At the forge"). Border-bottom `line`. Conservar el StaggerIn del header.
- [ ] **Step 2: Burbujas** en `ChatBubble.tsx`: usuario = fondo `surfaceElevated`, borde `line`, radios 20/20/5/20, padding 11/15, Inter 14; Vulcano = SIN contenedor (texto directo `colors.text` Inter 14.5 lineHeight ~23, maxWidth 88%). Indicador "escribiendo" (si existe en el flujo actual — localizarlo): 3 puntos 5px `colors.primary` con animación de opacidad (Reanimated, worklet solo con shared value, o conservar el indicador actual re-tokenizado si ya anima). Timestamps: mono 10.5 `textFaint`.
- [ ] **Step 3: Verificar y commit** — `npx tsc --noEmit && npm run check-i18n`; `git add "app/(app)/chat.tsx" components/chat/ChatBubble.tsx locales && git commit -m "feat(fase-b): coach editorial — vulcano sin caja y header en la fragua"`

---

### Task 4: Planes hub restyle (card héroe + WeekBars)

**Files:**
- Create: `components/plans/WeekBars.tsx`
- Modify: `app/(app)/plans/index.tsx`
- Prototipo: `data-s="plans"` + CSS `.weekbar`, `.wday`, `.plan-row`, `.macro`

**Interfaces:**
- Produces: `<WeekBars schedule={WorkoutDay[]} todayJsDay={number} />` — 7 columnas con barra de intensidad + inicial del día.

- [ ] **Step 1: Crear `components/plans/WeekBars.tsx`**:

```tsx
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

interface Day { day_number: number; is_rest: boolean; estimated_duration_minutes?: number; exercises?: unknown[] }
interface Props { schedule: Day[]; todayJsDay: number }

// Mini-calendario del prototipo (.weekbar): 7 barras de intensidad; hoy con
// gradiente ámbar→ember y ring; días pasados de entrenamiento en primaryDeep.
export function WeekBars({ schedule, todayJsDay }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const todayNumber = todayJsDay === 0 ? 7 : todayJsDay;
  const byNumber = new Map(schedule.map((d) => [d.day_number, d]));
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const day = byNumber.get(n);
        const isRest = day?.is_rest ?? true;
        const isToday = n === todayNumber;
        const isPast = n < todayNumber;
        // intensidad ∝ nº de ejercicios (proxy de Fase B; logs reales en C)
        const intensity = isRest ? 0 : Math.min(1, ((day?.exercises?.length ?? 4) / 8));
        const h = 8 + intensity * 34;
        const jsDay = n === 7 ? 0 : n;
        return (
          <View key={n} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: '100%', height: 42, borderRadius: 8, overflow: 'hidden',
                justifyContent: 'flex-end', backgroundColor: colors.chip,
                borderWidth: isToday ? 1.5 : 0, borderColor: colors.primary,
              }}
            >
              {intensity > 0 ? (
                isToday ? (
                  <LinearGradient colors={[colors.accent, colors.primary]} style={{ height: h, borderRadius: 8 }} />
                ) : (
                  <View style={{ height: h, borderRadius: 8, backgroundColor: isPast ? colors.primaryDeep : colors.primaryDim, opacity: isPast ? 0.85 : 1 }} />
                )
              ) : null}
            </View>
            <Text style={{ fontFamily: isToday ? 'SpaceGrotesk-Bold' : 'Inter-Medium', fontSize: 10, letterSpacing: 0.5, color: isToday ? colors.primaryText : colors.textFaint }}>
              {t(`daysShort.${jsDay}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Restyle de `app/(app)/plans/index.tsx`** — LEE pantalla + sección `data-s="plans"`. Checklist: título "PLANES" Bebas `screenTitle` (34); card héroe (borde `primary` al ~30% vía `primaryDim`/opacity NO concatenando hex sobre rgba — usar `colors.primaryDim` o borderColor `colors.primary` con `borderWidth` fino): fila chip "Plan activo" (dot `primary` + texto `primaryText`) + "Semana X/8" mono `textFaint` (si el dato de semana actual no existe en los datos, omite la fila derecha — NO inventes datos); título del plan Bebas 26 uppercase; descripción muted 12.5; `<WeekBars schedule={schedule} todayJsDay={todayIndex} />` (reemplaza el mini-calendario actual de íconos); conservar el bloque "Entrenamiento de hoy" actual re-tokenizado; card meal: `plan-row` eyebrow "Plan alimenticio" + kcal mono `accentText`, nombre Inter-Medium 14.5, `MacroBar` existente, leyenda mono 10.5 con gramos; "Forjar un plan nuevo" como botón ghost (borde `borderStrong`, texto muted) conservando su handler/sheet actual; estado vacío actual con la piel nueva.
- [ ] **Step 3: Verificar y commit** — tsc+check-i18n; `git add components/plans/WeekBars.tsx "app/(app)/plans/index.tsx" locales && git commit -m "feat(fase-b): hub de planes con card héroe y barras semanales"`

---

### Task 5: Progreso restyle (gráfica full-bleed)

**Files:**
- Modify: `app/(app)/progress.tsx`; toque mínimo a `components/progress/WeightChart.tsx` (solo colores/contenedor)
- Prototipo: `data-s="progress"` + CSS `.range`, `.chart`, `.statrow`

- [ ] **Step 1: Restyle** — LEE pantalla + prototipo. Checklist: header fila: "PROGRESO" Bebas 34 + derecha peso actual mono 22 con unidad pequeña y delta verde mono 11.5; pills de rango (`.range`): activa fondo `primary` texto `onPrimary`, inactivas `chip`+borde `line` texto muted, las bloqueadas conservan su candado/gate actual (UpgradeSheet); gráfica FULL-BLEED: quitar la card contenedora, `marginHorizontal: -20` (o el padding real del scroll) y `WeightChart` ocupando el ancho; en `WeightChart.tsx` SOLO: colores a tokens si tiene hardcodes y, si expone props de estilo, línea `primary` con área degradada — NO reescribir la lógica Skia (si el full-bleed exige cirugía interna, deja la gráfica contenida con tokens y anótalo en el reporte como aceptado por spec §5); fila de stats (`.statrow`): borde arriba/abajo `line`, 3 columnas centradas (valor mono 16 + label eyebrow 10 `textFaint`): Δ del mes (verde si baja), IMC, racha (`accentText`); CTA "REGISTRAR MEDIDA" (clave existente) como btn fire → abre el Sheet actual; nota de composición corporal para free (clave existente) centrada muted 11. El FAB actual: si el CTA nuevo lo vuelve redundante, elimínalo (el CTA del flujo es el botón); si el FAB tenía otra función, consérvalo.
- [ ] **Step 2: Verificar y commit** — tsc+check-i18n; `git add "app/(app)/progress.tsx" components/progress/WeightChart.tsx && git commit -m "feat(fase-b): progreso con gráfica protagonista y stats en fila"`

---

### Task 6: Perfil restyle (identidad + título de forjador)

**Files:**
- Modify: `app/(app)/profile.tsx`
- Modify: `locales/es/profile.json`, `locales/en/profile.json`
- Prototipo: `data-s="profile"` + CSS `.avatar-d`, `.seg`, `.setrow`, `.pbar`, `.up-hero`

- [ ] **Step 1: Claves i18n nuevas** (`profile.json`, objeto top-level `forgerTitle`):

es: `{ "casual": "Aprendiz de la forja", "intermediate": "Forjador", "intensive": "Forjador avanzado", "advanced": "Maestro del yunque", "elite": "Leyenda de la fragua", "premium": "Maestro Forjador" }`
en: `{ "casual": "Forge apprentice", "intermediate": "Forger", "intensive": "Advanced forger", "advanced": "Master of the anvil", "elite": "Legend of the forge", "premium": "Master Forger" }`

- [ ] **Step 2: Restyle** — LEE pantalla + prototipo. Checklist: bloque identidad: avatar 64 borderRadius 22 con `LinearGradient` ember + inicial Bebas 32 `onPrimary` + `fireShadowByTheme[resolved]` (conservar el avatar-imagen actual si el usuario tiene foto — el gradiente es el fallback sin foto); nombre SpaceGrotesk-Bold 19; debajo eyebrow `accentText` con el título de forjador: `isPremium ? t('forgerTitle.premium') : t(\`forgerTitle.${fitness_level}\`, { defaultValue: t('forgerTitle.casual') })` usando el `fitness_level` del goal activo (hook existente); racha integrada como en el diseño actual re-tokenizada. Card objetivo: `plan-row` eyebrow "Objetivo activo" + meta mono derecha si existe el dato; nombre Inter-Medium 14.5; barra `.pbar` 6px con `LinearGradient` ámbar→ember y el % actual del hook existente + leyenda mono 10.5 `textFaint`. Grupos de ajustes: ya themed por SettingsRow — solo asegurar jerarquía/espaciados del prototipo. Card upgrade para free: estilo `.up-hero` SIEMPRE oscuro (fondo `#1B120A`→`#2A1A0E` gradiente + radial ámbar sutil, texto `#FAF7F2`, eyebrow `#C9B8A8`) con comentario de decisión; título "MAESTRO FORJADOR" Bebas 24; navega a upgrade como hoy. Premium: bloque de renovación actual re-tokenizado.
- [ ] **Step 3: Verificar y commit** — tsc+check-i18n; `git add "app/(app)/profile.tsx" locales && git commit -m "feat(fase-b): perfil con identidad de forjador y objetivo visual"`

---

### Task 7: Upgrade restyle (bento + toggle)

**Files:**
- Modify: `app/(app)/upgrade.tsx`
- Modify: `locales/es/plans.json`, `locales/en/plans.json` (CTA nuevo si no existe equivalente)
- Prototipo: pushpane `data-p="upgrade"` + CSS `.up-bento`, `.up-hero`, `.bill`, `.feat`, `.up-price`, `.save-badge`

**Interfaces:**
- Consumes: `PRICE_MONTHLY`/`PRICE_YEARLY`/`PRICE_YEARLY_MONTHLY_EQUIVALENT` de `constants/pricing.ts` (Task 1: $219/$1,579/$132).

- [ ] **Step 1: Restyle** — LEE pantalla + prototipo. Checklist: grid 2 col gap 11; celda hero span-2 SIEMPRE oscura (gradiente `#221610`→`#150E09` + radial ámbar ~25% top-right, texto claro, comentario de decisión): eyebrow "Plan premium" + "MAESTRO FORJADOR" Bebas 34 + precio Bebas 44 con unidad mono pequeña + badge verde "Ahorras 40%" (clave existente `yearlySavings` o nueva corta) + **toggle Mensual/Anual** (anual default, pill `.bill`: fondo blanco 7-12%, activo `primary` texto `onPrimary`) — el toggle actualiza precio/unidad y el CTA conserva la lógica actual de `Linking.openURL` con el billing seleccionado; 4 celdas feature (check SVG ember 15px + título SpaceGrotesk-Bold 12.5 + subtítulo): reutilizar los textos de las claves de features existentes (elegir las 4 principales del premium actual); celda span-2 Vulcano: `<VulcanoAvatar size={44} state="forge" />` + texto con `Vulcano analiza tus datos` en bold (clave de feature existente adaptada o nueva); CTA "CONVERTIRME EN MAESTRO" btn fire (clave nueva `upgrade.ctaBecome` es/en: "Convertirme en Maestro"/"Become a Master") manteniendo el flujo de pago actual; legal Stripe (clave existente) mono 10.5 centrado. Conservar: promo code, estado "ya eres premium", navegación — re-tokenizados.
- [ ] **Step 2: Verificar y commit** — tsc+check-i18n; `git add "app/(app)/upgrade.tsx" locales && git commit -m "feat(fase-b): upgrade en bento con toggle de facturación"`

---

### Task 8: Diferidos de Fase A + QA claro + docs + verificación final

**Files:**
- Modify: `components/ui/Badge.tsx`, `components/ui/ProgressBar.tsx`, `app/(app)/plans/workout/[id].tsx` (tokens), `components/home/StreakFlame.tsx` (si tiene `#FDE68A` → `gradientsByTheme[resolved].flame[2]`)
- Modify: `lib/scrollNav.tsx` + `components/nav/PillTabBar.tsx` (constantes compartidas)
- Modify: `forja-docs.md` (§14 nota + §23 nueva)

- [ ] **Step 1: Tokenizar hardcodes**: `Badge.tsx` — reemplazar `bg-[#451a03]`/`bg-[#450a0a]` (y similares) por `style` con fondos derivados de tokens (`colors.primaryDim` para accent-chip, tinte de `destructive` vía rgba literal POR TEMA agregando tokens `chipWarning`/`chipDanger` a `constants/themes.ts` si hace falta — dark: `rgba(69,26,3,1)`≈actual / light: tintes `#FEF3C7`/`#FEE2E2`); `ProgressBar.tsx` shadowColor `'#FBBF24'` → `colors.accent`; índices `'#57534E'` en `workout/[id].tsx` → `colors.textFaint`.
- [ ] **Step 2: Geometría compartida de la pill**: en `lib/scrollNav.tsx` exportar `export const PILL_HEIGHT = 58; export const PILL_BOTTOM_GAP = 10;` y reescribir `useNavClearance` con ellas; `PillTabBar` importa y usa las mismas (bottom = `Math.max(insets.bottom, 12) + PILL_BOTTOM_GAP`). Sin cambio visual.
- [ ] **Step 3: Docs**: en `forja-docs.md` §14, bajo el título de la paleta vieja agregar: `> ⚠️ Desactualizado desde la Fase A del rediseño: los tokens viven en constants/themes.ts (dos temas) — ver §22.`; agregar al final `## §23 Rediseño Fase B — pantallas core` (5-8 líneas: qué pantallas igualan al prototipo, WeekRing/WeekBars/weekProgress, pricing $219/$1,579 con prices test nuevos, hero de Upgrade y up-hero siempre oscuros por decisión).
- [ ] **Step 4: QA claro estático**: `grep -rnE "#[0-9A-Fa-f]{6}" app components --include="*.tsx" | grep -v "node_modules"` → revisar cada hit: solo deben quedar los literales documentados "siempre oscuro" y los de `constants/themes.ts`; cualquier otro se tokeniza.
- [ ] **Step 5: Verificación final**: `npx tsc --noEmit && npm run check-i18n && (cd supabase/functions && deno test translate-plan/logic.test.ts delete-account/logic.test.ts)` → limpio + 16/16; `grep -rn "179\|1,299" constants locales web/components | grep -v node_modules` → sin montos viejos.
- [ ] **Step 6: Commit**: `git add -A -- components app lib forja-docs.md constants && git commit -m "feat(fase-b): diferidos de fase A tokenizados, geometría de pill compartida y docs"`
- [ ] **Step 7: E2E humano (Expo Go, lo ejecuta el usuario)** — comparando contra el prototipo ⚒️ en oscuro Y claro: (1) Home: saludo/anillo animándose/bento/card Vulcano; anillo coherente con el plan; (2) Coach: Vulcano sin caja, header "En la fragua"; (3) Planes: card héroe con barras, hoy resaltado; (4) Progreso: gráfica protagonista, stats en fila; (5) Perfil: título de forjador según nivel, objetivo con barra; (6) Upgrade: bento, toggle cambia $219/$1,579, flujo de pago abre la web con montos nuevos; (7) pasada en claro de las 6.
