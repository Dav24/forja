# Rediseño Fase A: Fundamentos visuales — Design Spec

**Fecha:** 2026-07-13
**Estado:** Aprobado en brainstorming
**Contexto:** Primera de 5 fases de implementación del rediseño congelado (`2026-07-12-redesign-premium-design.md` v7 + prototipo `docs/superpowers/prototypes/forja-atletica.html`). Orden aprobado: A fundamentos → B pantallas core → C entreno → D nutrición → E compartir.

## 1. Objetivo y alcance

Construir la infraestructura visual de la que dependen todas las fases: sistema de temas, navbar pill, sistema de transiciones, VulcanoAvatar v2 y celebraciones. **Al terminar, la app se ve casi igual (oscuro por default) pero ya es themeable, con navbar y transiciones nuevas** — el restyle pantalla por pantalla es Fase B.

- **Dentro:** tokens por tema + ThemeProvider + migración mecánica de TODOS los componentes, selector de tema funcional (ubicación provisional en Ajustes), navbar pill custom, transiciones de stack y tabs, `StaggerIn`, `CelebrationOverlay` (API, sin triggers de producto), VulcanoAvatar v2 SVG, escala tipográfica actualizada.
- **Fuera:** restyle visual de pantallas (B), pricing, fichas de ejercicio/ExerciseDB (C), meal/swap/onboarding (D), compartir (E), light-mode QA pantalla por pantalla (se hace en B junto al restyle — en A basta que el tema claro no rompa legibilidad básica).

## 2. Sistema de temas

### 2.1 Tokens (`constants/themes.ts`)

Dos temas con los valores CONGELADOS del prototipo (fuente de verdad: bloque `.fx-app` / `.fx-app[data-rt="light"]` de `forja-atletica.html`):

| Token | Oscuro (La Fragua) | Claro (Fragua de día) |
|---|---|---|
| background | #0C0A09 | #EFEAE3 |
| backgroundAlt | #12100E | #EAE4DB |
| surface | #1A1613 | #F7F3ED |
| surfaceElevated | #252019 | #FFFFFF |
| border | rgba(250,247,242,.09) | rgba(28,19,12,.10) |
| borderStrong | rgba(250,247,242,.16) | rgba(28,19,12,.18) |
| text | #FAF7F2 | #181310 |
| textMuted | #A89E92 | #6E6459 |
| textFaint | #6E655B | #9A8F83 |
| primary | #FF6B1A | #EA580C |
| primaryDeep | #F97316 | #C2410C |
| primaryText | #FF8A3D | #C2410C |
| primaryDim | #7C2D12 | #FFEDD5 |
| onPrimary | #140A04 | #FFF7F0 |
| accent | #FBBF24 | #D97706 |
| accentText | #FBBF24 | #92610A |
| chip | rgba(250,247,242,.06) | rgba(28,19,12,.05) |
| glass | rgba(18,15,13,.72) | rgba(247,243,237,.78) |
| glassBorder | rgba(250,247,242,.12) | rgba(28,19,12,.10) |
| ringTrack | rgba(250,247,242,.08) | rgba(28,19,12,.09) |
| success | #22C55E | #15803D |
| warning | #F59E0B | #B45309 |
| destructive | #EF4444 | #DC2626 |

`gradients` (ember/flame) y `fireShadow` también van por tema (fireShadow claro: color #EA580C, opacidad .30). Tipo `Theme` exportado; `type ThemeName = 'light' | 'dark'`.

### 2.2 ThemeProvider (`lib/theme.tsx`)

- Context con `{ colors, resolved: ThemeName, pref: 'light'|'dark'|'system', setPref }`; hook `useTheme()`.
- Persistencia en AsyncStorage (`forja.theme`), patrón idéntico a `lib/i18n.ts` (no bloquea primer render; default `system`).
- Modo sistema: `Appearance.getColorScheme()` + listener `Appearance.addChangeListener`.
- **Local al dispositivo** (decisión aprobada): NO se sincroniza a `profiles` — sin migración de DB en esta fase.
- Efectos colaterales al resolver tema: `SystemUI.setBackgroundColorAsync(colors.background)` (hoy hardcodeado carbón en `app/_layout.tsx`) y `StatusBar` style (`light`/`dark`). El `backgroundColor` de `app.json` (splash/cold-load) queda carbón — el splash es dark siempre, decisión consciente.

### 2.3 Migración mecánica

- Todos los componentes/pantallas pasan de `import { colors } from '@/constants/colors'` a `const { colors } = useTheme()`. Sin cambios de layout ni de valores de diseño más allá del mapeo de tokens (los tokens oscuros nuevos son ligeramente más cálidos que los actuales — ese microajuste global SÍ entra, es parte del congelado).
- `constants/colors.ts` queda como re-export del tema oscuro marcado `@deprecated` SOLO para los casos no-reactivos que se listen durante el plan (p. ej. constantes de navegación estáticas); meta: 0 imports en `app/` y `components/`.
- **Gate verificable:** `grep -rn "from '@/constants/colors'" app components hooks` → 0 resultados (excepciones listadas y justificadas en el plan).
- Regla worklets vigente: los colores usados dentro de `useAnimatedStyle` se capturan FUERA (nunca llamar `useTheme()` ni funciones JS dentro del worklet).
- Selector de tema: fila "Apariencia" (Claro/Sistema/Oscuro segmentado) en el hub de Ajustes existente, con claves i18n es+en nuevas (`settings:appearance.*`). Ubicación/estética final llega en Fase B.

## 3. Navbar pill (`components/nav/PillTabBar.tsx`)

- Custom `tabBar` en `app/(app)/_layout.tsx` (prop de Tabs de expo-router). Pill flotante centrada, 5 botones.
- Íconos duotono nuevos (`components/nav/TabIcons.tsx`, react-native-svg, 2 capas con opacidades) — reemplazan Ionicons SOLO en la tab bar.
- Activo: color primaryText + chip de fondo + punto ámbar con glow + label visible (animación de ancho con Reanimated); inactivos solo ícono. Labels desde las claves i18n de nav existentes.
- Material: iOS `expo-blur` (BlurView) + glassBorder; **Android: fondo `glass` semi-opaco sin blur** (decisión aprobada — blur Android caro/inconsistente; re-evaluar con dev build).
- Hide-on-scroll: contexto `lib/scrollNav.tsx` que expone un `onScroll` helper; las pantallas con scroll lo conectan a su ScrollView/FlatList; la pill se traslada fuera (translateY con spring) al bajar >umbral y regresa al subir. Reglas: nunca esconderse con teclado abierto arriba (tabBarHideOnKeyboard actual se conserva) y siempre visible al cambiar de tab.
- Se respeta el safe area inset inferior.

## 4. Transiciones

- **Push lateral con parallax:** stacks anidados existentes (p. ej. `plans/`) configuran `animation: 'slide_from_right'` + `gestureEnabled: true` (iOS trae parallax y gesto de retorno nativos; Android usa la animación equivalente del native stack). No se re-arquitecta el routing en esta fase; solo se configuran las opciones en los layouts existentes (creando `_layout.tsx` de stack donde falte).
- **Tabs:** `StaggerIn` (`components/ui/StaggerIn.tsx`): wrapper que anima a sus hijos con FadeInUp escalonado (delay por índice, duración/curva del prototipo) al montar/enfocar (`useFocusEffect`). En A se aplica al contenido raíz de las 5 pantallas de tabs (sin tocar su layout interno).
- **`CelebrationOverlay`** (`components/ui/CelebrationOverlay.tsx` + provider en `lib/celebration.tsx`): API `celebrate({ title, subtitle, streak })` → overlay a pantalla con radial ember, título Bebas con pop, chispas (partículas Reanimated) y racha. Sin triggers de producto en A (se cablean en C); para el E2E se agrega un trigger `__DEV__` temporal en Ajustes ("Probar celebración").
- `useReducedMotion` de Reanimated: con reduced-motion activo, stagger y chispas se desactivan (aparición directa).

## 5. VulcanoAvatar v2 y tipografía

- `components/VulcanoAvatar.tsx`: reemplaza el 🔥 por el personaje SVG del prototipo (react-native-svg — verificar dep instalada con `npx expo install` si falta): busto duotono con ojos de brasa. Props `{ size, state: 'neutral' | 'forge' | 'celebrate' }`, misma interfaz pública actual + prop state nueva. Las ilustraciones IA finales lo sustituirán 1:1.
- `constants/typography.ts`: escala del prototipo — display 40 (saludo Home), títulos de pantalla Bebas 34, headers de card 22-26, `stat` Mono 22-26. Solo valores; la aplicación por pantalla es Fase B (en A solo se actualiza la constante y lo que ya la consume).

## 6. Verificación

- `npx tsc --noEmit` + `npm run check-i18n` limpios; gate de migración (grep §2.3) en 0.
- Tests Deno existentes intactos (16/16 — esta fase no toca EFs).
- **E2E humano (Expo Go):** (1) selector Claro/Oscuro/Sistema cambia TODA la app en vivo y persiste tras reiniciar; (2) modo sistema reacciona al cambiar el tema del teléfono; (3) navbar pill: activo con glow+label, se esconde al scrollear hacia abajo y regresa al subir, no estorba con teclado; (4) push a detalle de plan con gesto de retorno fluido; (5) tabs entran con stagger; (6) "Probar celebración" muestra el overlay con chispas; (7) pasada rápida de legibilidad en tema claro (sin QA fino — eso es B).

## 7. Riesgos

- **Migración masiva de colors → regresiones visuales puntuales:** mitigación: A no cambia layouts, el diff por componente es mecánico; el E2E incluye pasada visual por las 5 tabs en oscuro.
- **Blur/perf en Android:** decisión ya tomada (sin blur en Android V1).
- **Tokens oscuros ligeramente más cálidos** que los actuales: cambio global intencional (congelado); si algo se ve mal, se ajusta el token, no el componente.
- **Worklets:** capturar colores fuera de `useAnimatedStyle` (regla del proyecto, crashea en runtime sin aviso de tsc).
- **Stacks anidados de expo-router:** la config de animación puede requerir crear `_layout.tsx` nuevos; riesgo de tocar el backBehavior conocido de tabs ocultos (lección Ajustes de cuenta: navegación explícita, no `router.back()` ciego).
