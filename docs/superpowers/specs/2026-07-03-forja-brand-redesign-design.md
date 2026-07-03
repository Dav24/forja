# Forja — Rediseño de Marca e Identidad Visual

> Spec de diseño · 2026-07-03
> Estado: validado con el usuario (sesión de brainstorming con companion visual)
> Alcance elegido: **rediseño profundo total** (identidad + tokens + componentes + todas las pantallas)

## 1. Problema

La app funciona (Pasos 1–12 completados) pero el diseño se siente genérico y sin vida: paleta "dark + verde salud" indistinguible de cualquier app fitness, cero motion, contenido de planes en monoespaciada plana, y la metáfora más poderosa de la marca —la forja— completamente desaprovechada.

## 2. Decisiones de identidad (validadas)

### 2.1 Personalidad de marca
Forja de herrero **cálida y atlética**: el fuego y el oficio de forjar cuerpos, sin agresividad que espante a principiantes. El herrero forja tanto a novatos ("forjar nuevos miembros del deporte") como a veteranos ("elevarlos al máximo nivel competitivo"). La intensidad del tono **se adapta al nivel del usuario**.

### 2.2 El coach: Vulcano (antes "Memo el Forjador")
- **Nombre:** Vulcano — dios romano de la forja. Mentor legendario, no gymrat.
- **Voz:** maestro herrero que ha forjado a miles. Cálido y paciente con `fitness_level` casual/intermediate; directo y exigente con advanced/elite. Se implementa en el system prompt de la EF `chat` usando el `fitness_level` del goal activo (ya disponible en el contexto de usuario que construye la EF).
- **Presencia visual dosificada** (NO en toda la app): (1) presentación del coach en onboarding, (2) avatar del chat, (3) estados vacíos clave, (4) celebraciones.
- **Renombrar en todas partes:** system prompt de `supabase/functions/chat/index.ts`, strings de UI, `forja-docs.md`.

### 2.3 Logo (dirección elegida: wordmark con brasa)
- **Wordmark:** FORJA en Space Grotesk Bold (tracking amplio), con la **"O" reemplazada por una brasa encendida**: círculo con gradiente radial `#FDE68A → #F97316 → #EA580C` con glow, centro oscuro `#0C0A09` (carbón dentro de la brasa).
- **Ícono de app:** la brasa sola sobre fondo carbón `#0C0A09`.
- **Splash:** wordmark completo sobre carbón; al abrir, la brasa "enciende" (animación de glow in).
- Implementar como componente SVG reutilizable (`components/brand/ForjaWordmark.tsx`, `components/brand/Ember.tsx`) + assets PNG para `app.json` (icon, splash, adaptive-icon).

## 3. Paleta de tokens (validada)

Reemplaza por completo los valores de `constants/colors.ts`, `tailwind.config.js` y `global.css`. Migración de frío (slate/azulado) a cálido (stone/carbón).

| Token | Antes | Después | Uso |
|---|---|---|---|
| `background` | `#0A0A0F` | `#0C0A09` | Fondo de pantallas (carbón cálido) |
| `surface` | `#13131C` | `#1C1917` | Cards, paneles |
| `surfaceElevated` | `#1E1E2E` | `#292524` | Sheets, modals |
| `border` | `#1E293B` | `#292524` | Bordes, separadores |
| `primary` | `#22C55E` | `#F97316` | Botones, acentos (brasa) |
| `primaryBright` | — (nuevo) | `#FBBF24` | Extremo claro del gradiente, números stats |
| `primaryDim` | `#166534` | `#7C2D12` | Superficies tintadas, chips activos, burbujas usuario |
| `accent` | `#818CF8` | `#FBBF24` | Momentos de Vulcano/IA (ámbar) |
| `text` | `#F1F5F9` | `#FAFAF9` | Texto principal (blanco cálido) |
| `textMuted` | `#64748B` | `#A8A29E` | Texto secundario (piedra cálida) |
| `destructive` | `#EF4444` | `#EF4444` | Sin cambio |
| `warning` | `#F59E0B` | `#F59E0B` | Sin cambio |
| `success` | `#22C55E` | `#22C55E` | El verde sobrevive SOLO aquí |

**Gradientes de marca** (nuevos, en `constants/colors.ts`):
- `emberGradient`: `['#FBBF24', '#F97316']` (135°) — CTAs primarios, badge Premium, momentos épicos. Usar `expo-linear-gradient`.
- `flameGradient`: `['#EA580C', '#F97316', '#FDE68A']` (vertical) — llama de streak, gráfica de peso.
- **Sombra de fuego** para CTAs primarios: `shadowColor: '#F97316', shadowOpacity: 0.35, shadowRadius: 22, elevation: 8`.

**Regla de dosificación:** el gradiente completo solo en 1-2 elementos por pantalla (CTA principal, llama). El resto de la pantalla es carbón y piedra — el fuego brilla porque es escaso.

## 4. Tipografía (validada: combinación A+C)

Se mantiene el trío actual y se **agrega Bebas Neue** como display:

| Rol | Fuente | Uso |
|---|---|---|
| Display / headers de día | **Bebas Neue** (nueva, `@expo-google-fonts/bebas-neue`) | "HOY SE FORJA...", "DÍA 1 · PUSH", numeración editorial (01, 02…), títulos hero. Siempre MAYÚSCULAS, tracking 1-2px |
| Headings | Space Grotesk (700/600) | Títulos de cards, nombres de pantalla, wordmark |
| Body | Inter (400/500/600) | Texto general, nombres de ejercicios (600) |
| Datos | JetBrains Mono (500/700) | Números en stats cards y chips — nunca párrafos completos |

**Patrón "plan premium" (A+C combinado):**
- Header del día: `DÍA {n} · {FOCUS}` en Bebas Neue, focus en `primary`
- Tarjetas de stats del día (3 columnas): número grande mono `primaryBright` + label Inter 10px tracking amplio (EJERCICIOS / MINUTOS / SERIES)
- Filas de ejercicio: numeración Bebas gris `#57534E` + nombre Inter 600 + chips mono (`4×8-10`, `90s`) fondo `surfaceElevated` texto `primaryBright`
- **Eliminar el uso de JetBrains Mono para bloques de texto de planes** (era el problema de "se ve básico")

## 5. Componentes (validados)

- **Button** — primary: gradiente ember + sombra de fuego + texto `#0C0A09` bold; secondary: borde `primary`, texto `primary`, fondo `surface`; ghost sin cambios estructurales. **Feedback físico:** escala a 0.97 con spring de Reanimated al presionar.
- **StreakFlame** (nuevo, `components/home/StreakFlame.tsx`) — llama SVG con `flameGradient`, 3 tamaños según streak (1-6 / 7-29 / 30+ días), flameo continuo sutil con Reanimated (escala/opacidad), número en mono ámbar. Streak roto: brasa gris `#57534E` que "revive" al registrar actividad.
- **Badge** — variante `premium`: gradiente ember + martillo ⚒ + texto carbón; `primary`: fondo `primaryDim` texto `#FDBA74`; `success` conserva verde.
- **ProgressBar** — gradiente horizontal `#F97316 → #FBBF24` con glow ámbar (`shadowColor #FBBF24`), track `surfaceElevated`. Metáfora: metal calentándose.
- **Skeleton** — shimmer cálido (base `surface`, highlight `#292524`) en vez del pulso plano.
- **Card / Input / Sheet / Avatar** — re-tokenizados (los nuevos colores aplican solos); Sheet con handle ámbar.
- **StatCard** (nuevo, `components/ui/StatCard.tsx`) — número mono grande `primaryBright` + label tracking amplio. Reemplaza las stats del Home, progress y detalle de plan.

## 6. Motion (validado)

Librería: Reanimated (ya instalada). Duraciones 200-300ms, spring para táctil.
1. **Entrada de pantallas:** fade + slide-up 12px, 250ms
2. **Números que cuentan:** peso, streak y % animan de 0 al valor al aparecer (`useAnimatedProps` o contador JS)
3. **Chispas de celebración** (nuevo `components/effects/SparkBurst.tsx`): 12-16 partículas ámbar/naranja con física simple. Dispara en: plan generado, onboarding completado, streak milestone (7/30/100)
4. **Splash → login:** la brasa del wordmark enciende con glow-in
5. **Presión táctil:** escala 0.97 spring en todos los botones/cards presionables

## 7. Vulcano visual

- **Estilo:** ilustración flat/geométrica con la paleta de la marca (carbón, piedra, fuego ámbar-naranja). Herrero corpulento y amable — barba, delantal, martillo; brasas en el fondo. NO foto-realista, NO cartoon infantil.
- **Assets necesarios (4 poses):** (1) saludo/presentación, (2) avatar busto (chat), (3) trabajando el metal (estados "generando..."), (4) celebrando con el martillo en alto.
- **Pipeline:** generar con IA de imágenes → limpiar fondo → exportar PNG @1x/2x/3x a `assets/vulcano/`. Placeholder temporal mientras tanto: avatar con 🔥 sobre gradiente (como el mockup).
- **Dónde aparece:** onboarding paso 1 (presentación "Soy Vulcano, forjador de atletas"), header/avatar del chat, empty states (sin plan: "Aún no forjamos tu plan. ¿Empezamos?"), pantalla `PlanGenerating` (Vulcano martillando + "Vulcano está forjando tu plan..."), celebraciones.

## 8. Rediseño por pantalla (validado con mockup del Home)

**Referencia visual:** mockup antes/después en `.superpowers/brainstorm/1842186-1783053720/content/home-rediseno.html`.

1. **Home** — header con wordmark FORJA + StreakFlame compacta; hero editorial Bebas "HOY SE FORJA / {FOCUS}" (o "HOY: DESCANSO Y RECUPERACIÓN" / "AÚN SIN PLAN" según estado); card del día con patrón plan-premium (3 ejercicios preview); 3 StatCards (kg actual / kg meta / % progreso); CTA gradiente "Hablar con Vulcano" con ⚒️.
2. **Onboarding (3 pasos)** — Vulcano da la bienvenida en paso 1; progress bar de metal calentándose entre pasos; opciones con selección `primaryDim` + borde `primary`; al finalizar SparkBurst + "Tu forja está lista".
3. **Login/Register** — wordmark FORJA grande con brasa que enciende al montar; inputs sobre `surface`; CTA gradiente.
4. **Chat** — header "Vulcano · El Forjador" con avatar; burbujas de Vulcano `surface` con borde `#F97316` sutil y avatar; usuario en `primaryDim`; typing indicator "Vulcano está forjando tu respuesta…"; MessageLimitBanner re-tokenizado.
5. **Plans hub** — cards grandes con headers Bebas y contadores mono; meal plan con paywall del mismo lenguaje (⚒ Premium).
6. **Workout detail (`[id].tsx`)** — patrón plan-premium completo: header Bebas del plan, stats del día (tarjetas C), días expandibles con filas editorial, notas de técnica en Inter itálica `textMuted`.
7. **Meal plan** — mismo patrón; MacroBar re-tokenizada (proteína `primary`, carbs `primaryBright`, grasa `#A8A29E`); navegador de días con chips.
8. **Progress** — WeightChart con línea `flameGradient` + área con glow; StatCards; historial re-tokenizado; FAB gradiente; MeasurementForm en Sheet renovado.
9. **Profile** — badge de plan con ⚒ si Premium; upgrade card con borde incandescente para free.
10. **Upgrade** — pricing cards: la recomendada (anual) con borde gradiente ember + badge "MEJOR VALOR"; features con ✓ ámbar.
11. **Empty/error states** — todos con Vulcano o la brasa, mensaje en voz de Vulcano, CTA claro.

## 9. Fuera de alcance

- i18n (los strings nuevos siguen hardcodeados es-MX hasta el Paso 14; escribirlos pensando en extraerse fácil)
- Cambios de lógica de negocio, hooks o Edge Functions (excepto: rename Memo→Vulcano + tono adaptativo en el system prompt del chat)
- Light mode
- Lottie / animaciones de ejercicios (V1.5)
- Rediseño de la web de pagos (Paso 13 usará esta identidad desde el inicio)

## 10. Restricciones técnicas

- **NativeWind v4:** estáticos en `className`, dinámicos/design-tokens/fontFamily en `style` (regla existente del proyecto)
- **Máx 300 líneas por componente** — extraer sub-componentes
- Nuevas dependencias: `@expo-google-fonts/bebas-neue`, `expo-linear-gradient` (instalar con `npx expo install` — regla del proyecto tras el incidente de versiones con Expo Go)
- Los cambios deben seguir funcionando en Expo Go (SDK 56) — nada de módulos nativos nuevos fuera del catálogo de Expo
- TypeScript strict: `tsc --noEmit` limpio al terminar cada fase

## 11. Criterio de éxito

Al abrir la app: se reconoce la marca (wordmark, brasa, fuego dosificado), el Home tiene un protagonista claro (el entrenamiento de hoy en Bebas), los planes se ven premium (jerarquía A+C), hay vida en cada interacción (spring táctil, llama, contadores, chispas en celebraciones) y Vulcano se siente un mentor presente pero no invasivo.
