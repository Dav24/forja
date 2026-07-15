# Product

## Register

product

## Users

Usuarios de fitness en México (validación B2C inicial, expansión internacional después) que quieren un entrenador personal con IA en el bolsillo: planes de entrenamiento y nutrición personalizados, seguimiento de progreso corporal, y (a futuro) corrección de técnica por cámara. Contexto de uso: mayormente en el gym/casa a media sesión (pantallas de "hoy toca esto" y registro de series) o en momentos de reflexión (progreso, ajustes, generación de plan nuevo) — sesiones cortas, una mano libre, necesitan lectura rápida y poca fricción para no romper el ritmo de entreno.

## Product Purpose

Forja es una app móvil de entrenador personal impulsado por IA (iOS/Android). El coach ("Vulcano") habla como un entrenador real, sin etiquetas de "IA" — genera rutinas y planes alimenticios a medida, registra el progreso corporal y de cargas, y guía al usuario con el mismo tono que un entrenador humano de confianza. Modelo freemium: valor gratis limitado, suscripción premium ("Maestro Forjador") vía web para evitar comisión de tiendas. Éxito = usuario activo que vuelve a diario a "forjar" su sesión, no solo abre la app una vez.

## Brand Personality

**"Forja Atlética"** — el gimnasio como fragua: forjar el propio cuerpo con disciplina, calor y orgullo de oficio. Tres palabras: **premium, ígneo, de oficio** (craft, no gadget).

Referencias explícitas (con lo específico que se toma de cada una): Strava (datos como protagonista, tipografía Mono grande, gráficas full-bleed sin caja), Runna (card héroe de plan activo con mini-calendario de intensidad), Adidas Club / Nike Training Club (tipografía display agresiva y con aire, jerarquía tipográfica por encima del color), Apple Fitness+ (pulcritud premium, transiciones fluidas y con propósito).

El coach Vulcano es un personaje (busto de herrero estilizado, duotono), no un logo ni un ícono de marca — el principio es "habla un entrenador, no la marca".

## Anti-references

- **Whoop**: demasiado clínico/frío — Forja no es un dashboard de biomarcadores, es un entrenador con carácter.
- **Duolingo**: gamificación infantil — sin mascotas tiernas, sin sistemas de puntos juguetones; los momentos de celebración son viscerales (fuego, forja), no lúdicos.
- Emojis como iconografía de producto (ya erradicados del código en el rediseño v7 — todo ícono es SVG duotono vía Ionicons).
- Glassmorphism decorativo en cards de contenido — reservado únicamente a overlays (navbar, sheets), nunca donde compite con la legibilidad de datos.
- Flat liso sin jerarquía: la app no es "otra app de fitness genérica" — cada pantalla debe sentir presión tipográfica y profundidad de capa, no una lista de filas idénticas.

## Design Principles

1. **El coach es una persona, no la marca.** Ningún copy ni ícono debe sentirse como "esto lo dice la IA" o "esto lo dice el logo" — siempre entrenador real.
2. **Los datos son el héroe.** Números grandes en Mono (JetBrains Mono), sin caja innecesaria alrededor — la cifra manda, el chrome se aparta.
3. **Tipografía por encima del color para jerarquía.** Bebas Neue display agresivo primero; el color (naranja/ámbar) refuerza, no reemplaza, la jerarquía tipográfica.
4. **Profundidad con capas, no con sombras genéricas.** Bordes sutiles + gradiente de superficie / tinte de color; glass solo en overlays flotantes.
5. **Motion con propósito, reservado para lo que importa.** Transiciones fluidas siempre (springs suaves, sin bounce), pero el "jugo" expresivo (fuego, flash, celebración) se reserva a momentos ganados: completar entreno, racha, plan nuevo forjado, upgrade.
6. **Consistencia entre pantallas nuevas y viejas.** Cuando una pantalla se ve "plana" comparada con el resto de la app, el problema casi nunca es el ícono — es la falta de los mismos patrones de profundidad/jerarquía que ya existen en otras pantallas (cards héroe, badges, iconos en círculo, StaggerIn) y que no se copiaron.

## Accessibility & Inclusion

Sin requisito formal de WCAG declarado por el usuario; estándar de facto ya en código: `useReducedMotion()` respetado en toda animación (`StaggerIn` y equivalentes), contraste verificado explícitamente al diseñar el tema claro ("naranja brasa ajustado a versión más profunda para contraste accesible sobre claro" — spec v7 §3), tokens de color nunca hardcodeados por componente (siempre vía `useTheme()`/`constants/themes.ts`) para que ambos temas mantengan el mismo nivel de cuidado.
