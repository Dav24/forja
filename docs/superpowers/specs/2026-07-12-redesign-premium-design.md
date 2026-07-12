# Rediseño premium "Forja Atlética" — Design Spec (fase prototipo)

**Fecha:** 2026-07-12
**Estado:** Aprobado en brainstorming (secciones A y B validadas por el usuario)
**Contexto:** El usuario inició un rediseño en Claude Design (proyecto "App entrenamiento personal", `Forja Redesign.dc.html`: 1a Refined vs 1b Bold + principios). Se decidió continuar la iteración aquí con prototipos HTML interactivos, porque permiten evaluar lo que el canvas estático no puede: transiciones, navbar vivo y micro-interacciones.

## 1. Objetivo y alcance

Definir y validar la dirección visual/UX premium de Forja mediante **un prototipo HTML navegable** (Artifact privado, marco de iPhone, transiciones reales) que el usuario itera desde su teléfono. **Esta spec cubre la fase de prototipo.** La implementación en React Native será un mini-paso posterior con su propia spec/plan cuando la dirección quede congelada.

- **Dentro:** 7 pantallas navegables (Home, Coach, Planes hub, Detalle workout, Progreso, Perfil, Upgrade), navbar nuevo, sistema de transiciones, momentos de celebración clave.
- **Fuera:** onboarding y pantallas de auth (fase 2 del prototipo), light mode (dark-only V1 — decisión razonada: marca carbón/brasa y referencias dark-first), implementación RN, ilustraciones finales de Vulcano (placeholder actual).

## 2. Calibración (respuestas del usuario)

- **Alcance:** todas las pantallas de una vez (prototipo navegable completo).
- **Dirección:** propuesta del diseñador — mezcla: estructura Refined (1a) + momentos Bold (1b) donde el impacto vale.
- **Referencias de "premium":** Strava, Runna, Adidas Club, Apple Fitness+, Nike Training Club. Explícitamente NO: clínico (Whoop) ni gamificado infantil (Duolingo).
- **Motion:** expresivo en momentos clave — transiciones fluidas siempre; "jugo" reservado a completar entreno, racha, plan nuevo, upgrade.

## 3. Lenguaje de diseño "Forja Atlética"

Hereda del canvas del usuario: coach SIN etiquetas "IA", íconos SVG duotono (fuera emojis), profundidad con capas/gradientes, paleta brasa refinada (naranja más saturado + ámbar).

- **Identidad:** paleta brasa se mantiene (carbón #0C0A09 base, naranja #F97316, ámbar #FBBF24; verde solo success). Bebas Neue display.
- **Tipografía protagonista** (Nike/Adidas): display más grande y con más aire; jerarquía agresiva; datos en JetBrains Mono grandes (Strava).
- **Profundidad:** cards con borde sutil + gradiente de superficie (no flat). **Glassmorphism SOLO en overlays** (navbar, sheets) — nunca en cards de contenido, para no pelear con legibilidad de datos.
- **Momentos Bold:** hero radial del Home, bento grid en Upgrade, celebraciones a pantalla. El resto, estructura Refined.

## 4. Navbar

Pill flotante con glassmorphism sobre el contenido: 5 íconos duotono, activo con "ember glow" (punto ámbar + glow naranja suave), label visible solo en el activo. Comportamiento: se compacta al hacer scroll hacia abajo, reaparece al subir. (Viable en RN: BlurView + Reanimated; costo de blur en Android a evaluar en implementación.)

## 5. Motion

- **Siempre:** push lateral con parallax al entrar a detalle (retorno = gesto invertido), fades escalonados al cambiar de tab, springs suaves sin bounce exagerado.
- **Momentos clave (jugo):** completar entreno, hito de racha, plan recién forjado, upgrade exitoso.
- Lenguaje de animación heredado del canvas: breathe, pulseGlow, shimmer, flicker, ringPulse.
- En implementación RN se respetará reduced-motion; shared elements y teclado perfecto requieren el dev build ya planeado.

## 6. Las 7 pantallas

1. **Home** — momento Bold principal: hero radial con el entreno de hoy (anillo de progreso semanal con lengua de fuego), saludo editorial gigante ("HOY SE FORJA, {nombre}"), racha compacta con llama viva arriba. Bento suave 2 columnas: stats (Mono grandes) + siguiente comida. CTA único con fire shadow.
2. **Coach** — Vulcano como entrenador real: header con avatar y estado ("En la fragua"), respuestas del coach sin caja (texto editorial sobre fondo), mensajes del usuario en pill carbón elevado, input flotante sobre el blur del navbar.
3. **Planes (hub)** — estilo Runna: plan activo como card héroe con mini-calendario gráfico (barras de intensidad), "hoy" resaltado con ember. Meal plan como segunda card con macros en barra. Generar nuevo = acción secundaria discreta.
4. **Detalle workout** — la transición estrella (Home → aquí): número del día gigante en Bebas, focus como statement, ejercicios en filas limpias con sets×reps en Mono, técnica plegable, progresión como banda destacada.
5. **Progreso** — Strava-style: gráfica de peso héroe full-bleed (sin caja), rangos en pills, stats del período en fila Mono, registro de medidas como sheet.
6. **Perfil** — avatar + racha + "título de forjador" por nivel, objetivo activo como card con progreso, ajustes como lista limpia con chevrons duotono.
7. **Upgrade** — bento grid Bold completo (pantalla de conversión): beneficios en celdas mixtas, anual destacado con ahorro, momento aspiracional, CTA con gradiente flame.

## 7. Mecánica de iteración

- Un solo prototipo HTML autocontenido (sin dependencias externas — CSP de Artifacts), marco de iPhone, navegación y transiciones funcionando al tacto.
- Publicado como **Artifact privado**; cada iteración redeploy al MISMO link.
- El usuario navega en su teléfono y da feedback por chat, pantalla por pantalla; textos en español con datos realistas de Forja (planes, macros, racha).
- Congelada la dirección → nueva spec de implementación RN (brainstorming corto + writing-plans + SDD), migrando componente por componente.

## 8. Criterio de éxito

El usuario navega el prototipo en su teléfono y aprueba: (a) el navbar, (b) al menos el 80% de las pantallas sin cambios mayores, (c) el lenguaje de transiciones. Eso congela la dirección y habilita la spec de implementación.

## 9. Riesgos conocidos

- **HTML ≠ RN:** el prototipo puede enseñar cosas caras de implementar (blur en Android, shared elements en Expo Go). Mitigación: cada patrón del prototipo se anota con su equivalente RN y costo en la spec de implementación.
- **Alcance "todas las pantallas":** iterar 7 pantallas a la vez puede dispersar el feedback. Mitigación: el link es uno solo, pero el feedback se procesa por pantalla, empezando por Home/navbar/transición.
- **Artifacts y motion:** los Artifacts corren con CSP estricta (todo inline) — las animaciones son CSS/JS puro, sin librerías externas.
