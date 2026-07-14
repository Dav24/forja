# Rediseño Fase B: Pantallas core + pricing — Design Spec

**Fecha:** 2026-07-13
**Estado:** Aprobado en brainstorming (diseño validado por el usuario)
**Contexto:** Segunda de 5 fases del rediseño congelado. **Fuente de verdad visual: el prototipo v7** (`docs/superpowers/prototypes/forja-atletica.html`) — esta spec mapea cada pantalla a su sección del prototipo; ante duda, gana el prototipo. Fundamentos disponibles (Fase A): `useTheme()`, tokens duales, `StaggerIn`, `PillTabBar`+`useNavClearance`/`useHideNavWhileFocused`, `CelebrationOverlay`, `VulcanoAvatar` v2, tipografía nueva (`display` 40, `screenTitle` 34, `stat` 26).

## 1. Objetivo y alcance

Que las pantallas core SE VEAN como el prototipo, y que el pricing nuevo ($219/$1,579) quede aplicado end-to-end en app, web y Stripe test.

- **Dentro:** restyle de Home, Coach, Planes (hub), Progreso, Perfil y Upgrade; pricing end-to-end; diferidos de Fase A que tocan pantallas (tokenizar hardcodes de Badge/ProgressBar/índices/llama, constantes compartidas de geometría de la pill, doc-rot §14, sliver iOS de pill oculta si el E2E de Fase A lo confirma); QA del tema claro pantalla por pantalla.
- **Fuera:** fichas de ejercicio/ExerciseDB/exercise_logs (Fase C), pantalla meal nueva/swap/dislikes/onboarding (D), compartir (E), detalle de workout (C — en B solo hereda tokens, sin restyle profundo).
- **Regla de conservación:** el restyle NO cambia lógica de datos, hooks, queries ni navegación — solo presentación. Los textos existentes conservan sus claves i18n; claves nuevas solo para copy nuevo del prototipo.

## 2. Mapeo pantalla → prototipo

1. **Home** (`app/(app)/index.tsx` ← sección `data-s="home"`): eyebrow de fecha, saludo display Bebas 40 dos líneas con nombre en `primaryText`, chip de racha con llama (StreakFlame existente adaptado a chip), **hero radial** (card con gradiente radial ember + **anillo SVG de progreso semanal** con gradiente ámbar→ember y centro con el entreno de hoy) + CTA fire shadow "EMPEZAR SESIÓN" (navega al detalle del plan, como hoy), bento 2 col (peso actual con delta verde + siguiente comida del meal plan activo), card "Vulcano te espera" con avatar y quote → navega a Coach. **Anillo en B:** progreso = días de entrenamiento del plan ya transcurridos esta semana / días de entrenamiento totales de la semana (datos del schedule existente; sesiones reales llegan en Fase C — dejar el cálculo en un helper puro `weekProgress(schedule, today)` para swap fácil).
2. **Coach** (`app/(app)/chat.tsx` ← `data-s="coach"`): header con `VulcanoAvatar` 46 + nombre SpaceGrotesk + estado "En la fragua" con dot ember (clave i18n nueva); burbujas: usuario = pill `surfaceElevated` radios 20/20/5/20, Vulcano = SIN caja (texto editorial `text` 14.5/1.62 con términos clave en `primaryText`); input pill flotante glass ya posicionado por Fase A. Estado "escribiendo" = 3 puntos ember (reemplaza el indicador actual si existe).
3. **Planes** (`app/(app)/plans/index.tsx` ← `data-s="plans"`): título screenTitle Bebas; card héroe del plan activo: chip "Plan activo" con dot, semana X/8 en mono, título Bebas 26 uppercase, descripción muted, **mini-calendario de 7 barras de intensidad** (done=`primaryDeep`, hoy=gradiente ámbar→ember con ring, resto=`primaryDim`/tema — componente nuevo `WeekBars`); card meal: eyebrow + kcal mono en `accentText` + título + `MacroBar` existente + leyenda mono de gramos; "Forjar un plan nuevo" como btn-ghost.
4. **Progreso** (`app/(app)/progress.tsx` ← `data-s="progress"`): header con título + peso actual mono 22 y delta verde a la derecha; pills de rango (activa rellena ember, bloqueadas con candado como hoy); **gráfica full-bleed sin card** (margen negativo, `WeightChart` de Skia conserva su lógica; ajustar contenedor/altura/colores a tokens y endpoint enfatizado si es viable sin reescribir el chart); fila de stats con borde arriba/abajo (Δ mes / IMC / racha en `accentText`); CTA "REGISTRAR MEDIDA" btn-ember (abre el Sheet existente); nota de composición corporal para free.
5. **Perfil** (`app/(app)/profile.tsx` ← `data-s="profile"`): avatar 64 radius 22 con gradiente ember e inicial Bebas, nombre SpaceGrotesk 19, **"título de forjador"** eyebrow en `accentText` mapeado por `fitness_level` (casual=Aprendiz de la forja, intermediate=Forjador, intensive=Forjador avanzado, advanced=Maestro del yunque, elite=Leyenda de la fragua — claves i18n es/en nuevas; premium muestra "Maestro Forjador" como override); card objetivo activo con barra de progreso gradiente; grupos de ajustes como listas limpias (SettingsRow ya themed); card upgrade oscura up-hero (siempre dark con texto claro, como el prototipo) para free.
6. **Upgrade** (`app/(app)/upgrade.tsx` ← pushpane `data-p="upgrade"`): bento grid — celda hero span-2 SIEMPRE oscura (gradiente radial ámbar sobre carbón, texto claro en ambos temas), precio Bebas 44 + badge "Ahorras 40%" + **toggle Mensual/Anual** (anual default); 4 celdas de features con check ember; celda span-2 de Vulcano con avatar `forge`; CTA "CONVERTIRME EN MAESTRO" btn-ember; legal Stripe. Los precios vienen SOLO de `constants/pricing.ts`.

## 3. Pricing end-to-end (decisión congelada: $219 MXN/mes, $1,579 MXN/año, ~40% ahorro, SIN tier Pro)

- `constants/pricing.ts`: única fuente de montos en la app — actualizar a 219/1,579 y recalcular el desglose anual mostrado.
- i18n: claves de upgrade que interpolan `{{price}}` reciben los montos nuevos vía pricing.ts (verificar que ninguna clave tenga monto hardcodeado; corregir si sí).
- `web/`: montos mostrados en la landing de precios alineados (localizar su fuente — constante o env — y actualizar).
- **Stripe TEST**: crear 2 prices nuevos vía `stripe` CLI sobre el producto existente (21900 mxn/month, 157900 mxn/year), actualizar los IDs donde el checkout los consume (`web/.env.local` o config del API route — descubrir al implementar) y verificar creando una sesión de checkout de prueba. Los prices viejos NO se borran (histórico). Prod = Paso 15.

## 4. Verificación

- `tsc --noEmit` + `check-i18n` limpios; tests Deno 16/16 intactos; grep de montos viejos (`179`, `1,299`/`1299`) sin hits en app/web fuera de históricos.
- Checkout de prueba en Stripe test crea sesión con el price nuevo (monto 21900/157900 verificado en la respuesta).
- **E2E humano (Expo Go):** cada pantalla comparada contra el prototipo (mismo artifact ⚒️ como referencia lado a lado), en oscuro Y claro; anillo del Home coherente con el plan; toggle de Upgrade cambia montos; flujo de upgrade abre la web con los montos nuevos.

## 5. Riesgos

- **Restyle ≠ refactor:** riesgo de romper lógica al mover JSX — mitigación: regla de conservación (§1) + reviews por task enfocadas en "misma data, nueva piel".
- **WeightChart (Skia):** tocar lo mínimo; si el full-bleed exige cirugía interna, se acepta versión contenida con tokens y se anota para pulir.
- **Celda hero de Upgrade y card up-hero de Perfil siempre oscuras:** requieren colores literales del prototipo (no tokens del tema activo) — documentar en el código por qué (decisión del prototipo, igual en ambos temas).
- **Stripe CLI:** la key de test expira ~oct 2026 (vigente); si el producto no se localiza por CLI, fallback: crear prices desde el dashboard y pasar los IDs manualmente.
