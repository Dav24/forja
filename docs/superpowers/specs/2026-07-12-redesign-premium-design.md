# Rediseño premium "Forja Atlética" — Design Spec (fase prototipo)

**Fecha:** 2026-07-12
**Estado:** Aprobado en brainstorming (secciones A y B validadas por el usuario)
**Contexto:** El usuario inició un rediseño en Claude Design (proyecto "App entrenamiento personal", `Forja Redesign.dc.html`: 1a Refined vs 1b Bold + principios). Se decidió continuar la iteración aquí con prototipos HTML interactivos, porque permiten evaluar lo que el canvas estático no puede: transiciones, navbar vivo y micro-interacciones.

## 1. Objetivo y alcance

Definir y validar la dirección visual/UX premium de Forja mediante **un prototipo HTML navegable** (Artifact privado, marco de iPhone, transiciones reales) que el usuario itera desde su teléfono. **Esta spec cubre la fase de prototipo.** La implementación en React Native será un mini-paso posterior con su propia spec/plan cuando la dirección quede congelada.

- **Dentro:** 7 pantallas navegables (Home, Coach, Planes hub, Detalle workout, Progreso, Perfil, Upgrade), navbar nuevo, sistema de transiciones, momentos de celebración clave, **sistema de temas (claro / oscuro / según sistema)** y **avatar-personaje de Vulcano** (dirección de diseño, no ilustración final).
- **Fuera:** onboarding y pantallas de auth (fase 2 del prototipo), implementación RN, ilustraciones IA finales de Vulcano (el avatar del prototipo define la dirección; las 4 ilustraciones siguen en pendientes del proyecto).

## 2. Calibración (respuestas del usuario)

- **Alcance:** todas las pantallas de una vez (prototipo navegable completo).
- **Dirección:** propuesta del diseñador — mezcla: estructura Refined (1a) + momentos Bold (1b) donde el impacto vale.
- **Referencias de "premium":** Strava, Runna, Adidas Club, Apple Fitness+, Nike Training Club. Explícitamente NO: clínico (Whoop) ni gamificado infantil (Duolingo).
- **Motion:** expresivo en momentos clave — transiciones fluidas siempre; "jugo" reservado a completar entreno, racha, plan nuevo, upgrade.

## 3. Lenguaje de diseño "Forja Atlética"

Hereda del canvas del usuario: coach SIN etiquetas "IA", íconos SVG duotono (fuera emojis), profundidad con capas/gradientes, paleta brasa refinada (naranja más saturado + ámbar).

- **Identidad:** paleta brasa se mantiene (carbón #0C0A09 base, naranja #F97316, ámbar #FBBF24; verde solo success). Bebas Neue display.
- **Sistema de temas (decisión del usuario):** tres modos — claro, oscuro y "según el sistema" (predeterminado). Selector en Perfil. Tokens de color por tema, nunca hardcodes por componente. **Oscuro** = la fragua actual (carbón + brasa). **Claro** = "la fragua de día": base cálida clara tipo ceniza (no blanco puro ni crema genérica), texto en carbón, naranja brasa ajustado a versión más profunda para contraste accesible sobre claro; el ámbar pasa a acento secundario medido. Ambos temas con el mismo cuidado — nada de inversión ingenua. El prototipo incluye el toggle funcionando para evaluar los dos.
- **Vulcano avatar-personaje (decisión del usuario: personaje, NO logo):** el principio del canvas es "coach como entrenador real" — el logo de Forja en el chat haría sentir que habla la marca, no un entrenador. El prototipo define un avatar duotono de personaje (busto de herrero estilizado en SVG, acentos de brasa) con 2-3 estados: neutral, "en la fragua" (pensando/escribiendo) y celebrando. Es dirección de estilo: las 4 ilustraciones IA finales lo sustituirán 1:1 (mismos usos y tamaños).
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
4. **Detalle workout** — la transición estrella (Home → aquí): número del día gigante en Bebas, focus como statement, ejercicios en filas limpias con sets×reps en Mono, progresión como banda destacada. **Ficha de ejercicio (decisión del usuario, v2):** tocar un ejercicio abre una sheet con (a) **animación grande de cómo hacer el ejercicio** — en el prototipo es una figura estilizada de 2 poses como placeholder; la fuente real (pack licenciado tipo ExerciseDB/wger vs animaciones propias Lottie) se decide en la spec de implementación e implica un catálogo de ejercicios para mapear los nombres que genera la IA; (b) claves de técnica; (c) **registro de carga por serie** con steppers ±2.5 kg / ±1 rep **y valor tecleable con formato automático** (decisión del usuario: teclear "67" → se ajusta al múltiplo más cercano del incremento → "67.5"; "70" → "70.0"; en reps "10.7" → "11"; entrada inválida conserva el valor previo), referencia fantasma de la sesión anterior ("ant. 57.5×10") y mini-gráfica de progresión del ejercicio. **Métrica adaptativa por tipo de ejercicio** (resuelve la duda del usuario sobre calistenia/funcional): barra/mancuerna → kg; peso corporal → reps + lastre opcional; preparación/movilidad → sin registro (y en implementación, cardio → tiempo/distancia). El registro alimenta la progresión doble que el plan ya prescribe.
5. **Progreso** — Strava-style: gráfica de peso héroe full-bleed (sin caja), rangos en pills, stats del período en fila Mono, registro de medidas como sheet.
6. **Perfil** — avatar + racha + "título de forjador" por nivel, objetivo activo como card con progreso, ajustes como lista limpia con chevrons duotono. **Incluye el selector de tema (claro / oscuro / sistema).**
7. **Plan alimenticio** (push desde la card de Planes; agregado en v4 a pedido del usuario) — título editorial con acento ámbar (la nutrición usa ámbar como color de familia, el entrenamiento usa naranja), card héroe con objetivo diario y barra de macros, navegador de días en chips, 5 comidas como cards con hora/kcal/mini-barra de macros e **ingredientes expandibles** (acordeón); la comida próxima resaltada con chip "SIGUIENTE" y borde ember; regenerar como acción secundaria (gate Maestro).
8. **Upgrade** — bento grid Bold completo (pantalla de conversión): beneficios en celdas mixtas, anual destacado con ahorro, momento aspiracional, CTA con gradiente flame.

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
- **Contenido de animaciones de ejercicio — DECIDIDO (usuario, 2026-07-12): API ExerciseDB para TODOS los tiers.** Se evaluó y descartó diferenciar animación por tier (GIF free vs Lottie premium): rompe la regla de premium del proyecto (lo premium es la IA de Vulcano sobre los datos, no el contenido instructivo — regla del Paso 12), duplica el pipeline de contenido, y la técnica es seguridad básica. Si algún día se producen animaciones propias, se lanzan para todos como mejora de marca. Trabajo que implica (spec RN): `generate-plan` debe generar contra un catálogo mapeable ejercicio→ID de ExerciseDB (hoy la IA escribe nombres libres en español y la API está en inglés), caché de GIFs (no llamar a la API por render), y revisión de licencia/pricing del plan de la API antes de producción.
- **Registro de carga = feature de datos, no solo UI:** requiere tabla nueva (p. ej. `exercise_logs`: plan, día, ejercicio, serie, kg/reps/tiempo, fecha) y alimenta la gráfica de progresión por ejercicio. Fase RN.
- **Dos temas duplican el trabajo visual del prototipo.** Mitigación: paleta como custom properties por tema (token-level); los componentes solo consumen tokens, así el segundo tema es redefinir ~15 variables, no rediseñar pantallas. En RN ya existe el mismo patrón (tokens en `constants/colors.ts` / `global.css`), aunque la app actual es dark-only — la implementación RN del tema claro se dimensionará en la spec de implementación.
