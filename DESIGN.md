---
name: Forja
description: Entrenador personal con IA — la fragua atlética, no el gym genérico
colors:
  carbon-base: "#0C0A09"
  carbon-alt: "#12100E"
  surface: "#1A1613"
  surface-elevated: "#252019"
  ember-primary: "#FF6B1A"
  ember-deep: "#F97316"
  ember-text: "#FF8A3D"
  ember-dim: "#7C2D12"
  amber-accent: "#FBBF24"
  paper-text: "#FAF7F2"
  text-muted: "#A89E92"
  text-faint: "#6E655B"
  success: "#22C55E"
  warning: "#F59E0B"
  destructive: "#EF4444"
typography:
  display:
    fontFamily: "BebasNeue-Regular, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.5px"
  headline:
    fontFamily: "SpaceGrotesk-Bold, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "SpaceGrotesk-SemiBold, sans-serif"
    fontSize: "18px"
    fontWeight: 600
  body:
    fontFamily: "Inter-Regular, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter-Medium, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  mono:
    fontFamily: "JetBrainsMono-Medium, monospace"
    fontSize: "13px"
    fontWeight: 500
rounded:
  chip: "9999px"
  button-sm: "12px"
  button-md: "12px"
  button-lg: "16px"
  card: "16px"
  input: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ember-primary}"
    textColor: "{colors.carbon-base}"
    rounded: "{rounded.button-md}"
    padding: "16px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ember-primary}"
    rounded: "{rounded.button-md}"
    padding: "16px 20px"
  chip-selected:
    backgroundColor: "{colors.ember-dim}"
    textColor: "{colors.ember-primary}"
    rounded: "{rounded.chip}"
    padding: "8px 16px"
  chip-unselected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.chip}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: Forja Atlética

## 1. Overview

**Creative North Star: "La Fragua" (The Forge)**

Forja no es una app de fitness genérica con iconos redondeados y pastel — es una fragua: calor, disciplina, oficio. Cada pantalla debería sentir la misma tensión entre estructura editorial (tipografía Bebas Neue gigante, datos en Mono, jerarquía agresiva estilo Nike/Adidas) y momentos de brasa (gradiente ember, "fire shadow" bajo los CTAs, ámbar como acento de calor) reservados para lo que el usuario se ganó: completar un entreno, una racha, un plan recién forjado.

El sistema rechaza explícitamente dos polos: el **clínico** (Whoop — fro, dashboard de biomarcadores sin alma) y el **gamificado infantil** (Duolingo — mascotas, puntos, lenguaje juguetón). El coach Vulcano habla como entrenador real, nunca como "la IA" ni como el logo de la marca.

**Key Characteristics:**
- Tipografía como jerarquía principal; el color refuerza, no reemplaza.
- Profundidad por capas (surface → surfaceElevated) y borde sutil, no por sombra genérica.
- Glassmorphism reservado a overlays flotantes (navbar, sheets) — nunca en cards de contenido.
- Iconografía 100% SVG duotono (Ionicons) — cero emoji en UI de producto.
- Motion siempre fluido (springs sin bounce); el "jugo" expresivo se reserva a momentos ganados.

## 2. Colors

Paleta "brasa": carbón oscuro de base, con naranja ember como protagonista y ámbar como acento de calor secundario. Verde reservado exclusivamente a éxito/confirmación, nunca decorativo.

### Primary
- **Ember Primary** (#FF6B1A): CTA principal, estado seleccionado de chips, foco de atención. Siempre con "fire shadow" (glow naranja difuso) cuando es un botón, nunca plano.
- **Ember Deep** (#F97316): extremo del gradiente ember en botones/badges premium; también base del naranja en tema claro.
- **Ember Text** (#FF8A3D): variante de `ember-primary` para texto sobre fondo oscuro donde se necesita algo más suave que el CTA sólido.
- **Ember Dim** (#7C2D12): fondo de chip seleccionado y de card de plan activo — el ember "atenuado", nunca el ember puro como fondo de superficie grande.

### Secondary
- **Amber Accent** (#FBBF24): color de familia de la nutrición (todo lo relacionado a plan alimenticio usa ámbar donde entrenamiento usa naranja), extremo cálido del gradiente ember, badges de warning.

### Neutral
- **Carbon Base** (#0C0A09): fondo de pantalla — la fragua misma, no un gris de sistema.
- **Carbon Alt** (#12100E): variante de fondo para separar secciones sutilmente.
- **Surface** (#1A1613): superficie de card por defecto.
- **Surface Elevated** (#252019): superficie de card "levantada" (plan activo, elementos jerárquicamente por encima).
- **Paper Text** (#FAF7F2): texto principal — nunca blanco puro, papel cálido sobre carbón.
- **Text Muted** (#A89E92) / **Text Faint** (#6E655B): jerarquía secundaria/terciaria de texto.

### Named Rules
**The Ember-Is-Rare Rule.** El naranja ember pleno (`#FF6B1A`/`#F97316`) vive en CTAs, estados seleccionados y momentos ganados — nunca como fondo de superficie grande ni como color de texto de cuerpo. Si el ember aparece en más del ~15% de una pantalla en reposo, se diluyó su significado.

**The Warm-Neutral-With-Intent Rule.** El carbón/papel de esta app NO es el "cream/sand AI-default" — es una decisión de marca explícita (la fragua). No aclarar hacia blanco puro ni gris frío de sistema; el tema claro (`#EFEAE3` fondo) sigue siendo cálido a propósito, nunca un simple invert del oscuro.

## 3. Typography

**Display Font:** Bebas Neue (condensada, mayúsculas, sin fallback real — es la firma tipográfica del display)
**Body Font:** Inter (con SpaceGrotesk para sub-encabezados de sección)
**Label/Mono Font:** JetBrains Mono — exclusivo para datos numéricos (kg, reps, kcal, series)

**Character:** Bebas Neue da la voz "editorial-atlética" (Nike/Adidas) en títulos grandes; Inter/SpaceGrotesk cargan el peso legible del cuerpo y sub-encabezados sin competir con el display. JetBrains Mono marca visualmente "esto es un dato medido", nunca se usa para prosa.

### Hierarchy
- **Display** (400, 40px, mayúsculas, letter-spacing 0.5px): número de día gigante, título de pantalla en headers push (`training.title`, `meal.title`), saludo del Home.
- **Headline** (700, 28px): focus/statement bajo el número de día, títulos de sección grandes (empty states).
- **Title** (600, 18px): sub-encabezados de sección dentro de una pantalla (`SectionTitle`).
- **Body** (400, 16px): texto de cuerpo, inputs, descripciones — máx ~70ch en párrafos largos.
- **Label** (500, 12px, a veces uppercase con tracking en eyebrows de card): metadatos, captions, badges.
- **Mono** (500, 13px): cualquier cifra medida (kg, reps, kcal, macros, día/hora).

### Named Rules
**The No-Prose-In-Mono Rule.** JetBrains Mono es exclusivo de datos numéricos medibles. Nunca se usa para un título, un botón o una oración — su aparición es la señal visual de "esto es un número real", y perdería el significado si se usara decorativamente.

## 4. Elevation

Sistema de capas tonales, no de sombra genérica. La profundidad se construye con `surface` → `surfaceElevated` (un tono más claro/cálido) más borde sutil (`border`/`borderStrong`, alpha sobre el texto principal), no con `box-shadow` difuso estilo Material. La única sombra real del sistema es el **fire shadow**: un glow de color (no gris) reservado a los CTAs primarios, que es identidad de marca, no elevación funcional.

### Shadow Vocabulary
- **Fire Shadow** (`shadowColor: #F97316` oscuro / `#EA580C` claro, `shadowOpacity: 0.3-0.35`, `shadowRadius: 20-22`, `elevation: 6-8`): exclusivo de botones primarios y momentos de CTA — nunca en cards.

### Named Rules
**The Tonal-Not-Gray Rule.** Cuando algo necesita "levantarse" visualmente, sube de `surface` a `surfaceElevated` (un paso de temperatura/luminosidad dentro de la misma paleta cálida), no se le agrega una sombra gris genérica.

## 5. Components

### Buttons
- **Shape:** `rounded-xl` (12px) en sm/md, `rounded-2xl` (16px) en lg.
- **Primary:** gradiente ember (`gradientsByTheme.ember`) de esquina a esquina + fire shadow; texto en `carbon-base` sobre el gradiente, nunca blanco.
- **Secondary:** `surface` con borde `ember-primary`, texto ember.
- **Ghost:** transparente, texto `text-muted` — para acciones de bajo compromiso ("generar otro", "omitir").
- **Destructive:** fondo `destructive` sólido, texto blanco (única excepción a "nunca blanco puro", porque es alerta de sistema, no marca).
- Todos los botones tienen micro-interacción de escala (spring a 0.97 en press-in) — nunca un estado estático sin feedback táctil.

### Chips
- **Style:** `rounded-full`, borde 1px, fondo `surface`/texto `paper-text` en reposo; fondo `ember-dim`/borde `ember-primary`/texto `ember-primary` cuando seleccionado.
- **Icon variant:** ícono Ionicons 14px a la izquierda del label cuando la opción representa una categoría con identidad visual propia (objetivo, modalidad, modo) — nunca cuando es un valor numérico/genérico puro (días, minutos, dieta).

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px).
- **Background:** `surface` por defecto, `surfaceElevated` cuando la card es la protagonista de la pantalla (plan activo, hero).
- **Shadow Strategy:** ninguna — ver Elevation, la card sube de tono, no gana sombra.
- **Border:** 1px `border` (alpha sobre texto), `primaryDim` en la card héroe activa para insinuar el ember sin usarlo pleno.
- **Internal Padding:** 16-17px.

### Inputs / Fields
- **Style:** `surface` de fondo, borde `border` (1px), `rounded-xl` (12px), altura fija 56px (h-14).
- **Focus:** hoy sin tratamiento de foco dedicado — oportunidad de mejora, no lo inventes sin confirmar con el usuario.
- **Error:** borde `destructive`, mensaje en `destructive` 12px debajo del campo.

### Badges
- **Style:** `rounded-full`, texto 12px semibold. Variante `premium` usa el gradiente ember completo + ícono de yunque (⚒) + texto en `carbon-base` fijo (no varía por tema, siempre debe leerse cálido sobre el degradado).

### Navigation
- Navbar pill flotante con glass (blur) sobre contenido — el único lugar autorizado para glassmorphism decorativo. Ícono activo con "ember glow" (punto ámbar + glow naranja).

### StaggerIn (signature component)
Entrada escalonada (`opacity` + `translateY`) al enfocar un tab, sin remount — usada en listas/secciones de pantallas principales (hub de Planes, filas de ejercicio) para dar sensación de "revelado", no de carga estática. Respeta `useReducedMotion()` (fallback instantáneo, sin animación).

## 6. Do's and Don'ts

### Do:
- **Do** usar `useTheme()`/tokens de `constants/themes.ts` para todo color — nunca hardcodear un hex en un componente.
- **Do** reservar el ember pleno (`#FF6B1A`) a CTAs y estados seleccionados; el resto de la pantalla vive en carbón/papel/muted.
- **Do** dar a cada pantalla al menos un elemento de profundidad de capa (card elevada, ícono en círculo con tinte, badge) — una pantalla que es solo texto + chips en fila plana no está terminada, aunque tenga los íconos correctos.
- **Do** usar JetBrains Mono para toda cifra medida (kg, reps, kcal, macros).
- **Do** respetar `useReducedMotion()` en cualquier animación nueva.

### Don't:
- **Don't** usar emoji como iconografía de producto — siempre Ionicons duotono.
- **Don't** usar glassmorphism decorativo fuera de overlays flotantes (navbar, sheets) — nunca en una card de contenido.
- **Don't** diseñar como Whoop (clínico/frío) ni como Duolingo (gamificación infantil, mascotas tiernas, puntos juguetones).
- **Don't** agregar sombra gris genérica tipo Material — la elevación de este sistema es tonal (surface → surfaceElevated) más el fire shadow de marca, nada intermedio.
- **Don't** dejar una pantalla de formulario/ajustes como una lista plana de "título de sección + fila de chips" repetida sin ningún elemento jerárquico (card, ícono, badge) — es la forma más común en que esta app cae en "se ve como cualquier app" (visto en `training.tsx`, `meal/index.tsx` antes de pulir).
