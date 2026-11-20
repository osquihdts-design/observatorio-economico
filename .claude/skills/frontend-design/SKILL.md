---
name: frontend-design
description: Guía de diseño de la web del Observatorio (web/: HTML, CSS y módulos JS sin compilar). Úsala siempre que crees o retoques una página, componente, estilo o gráfico de la interfaz, para que el resultado sea pulido, coherente con la paleta «confianza y calma» y accesible, sin la estética genérica de «hecho por IA».
---

# Guía de diseño de la interfaz

Rechaza la estética genérica de IA (degradados neón, brillos, todo animado, tarjetas idénticas
sin jerarquía). El objetivo es una herramienta de datos seria, como las de Eurostat o el BCE,
pero cuidada al detalle.

## Antes de nada: cómo está hecha esta web
- **CSS propio, sin Tailwind ni React.** Nada de clases utilitarias ni de compilar. Los estilos
  están en `web/css/style.css` (base y componentes), `investigacion.css`, `aprender.css` y
  `embed.css`. Reutiliza las clases que ya existen (`.btn`, `.segmented`, `.switch`, `.pais`,
  `.revelable`…) antes de crear otras.
- **Todo color, sombra y radio sale de las variables de `:root`** (`--bg`, `--panel`, `--ink`,
  `--muted`, `--accent`, `--line`, `--sombra`, `--radio`, `--suave`…), definidas para
  `[data-tema='oscuro']` y `[data-tema='claro']`. Nunca escribas un color en hexadecimal suelto
  en un componente: si falta un tono, añade la variable en los dos temas.
- **Gráficos:** Plotly mediante `web/js/graficos.js` (`dibujar`, `eje(titulo, sufijo)`,
  `tono()`). Los colores de país son fijos (ES #C8102E, EA #003399…) y `tono()` los adapta al
  tema oscuro. Todo eje lleva título y unidad.

## Directrices

### 1. Tipografía y jerarquía
- Ya hay pareja de fuentes: **Space Grotesk** (`--display`) para títulos, **Inter** para el
  texto y **JetBrains Mono** (`--mono`) para cifras, códigos y etiquetas pequeñas en versalitas.
  No añadas más familias.
- Escala clara con pesos distintos (500 / 600 / 700) y títulos con letra algo apretada
  (`letter-spacing: -0.02em`). Las cifras van con `font-variant-numeric: tabular-nums` (ya
  está en `:root`) para que las columnas cuadren.
- Texto secundario en `--muted` y terciario en `--tenue`. **El contraste mínimo es AA (4,5:1 en
  texto normal)**: es una decisión del proyecto y está por encima de «gris claro para que quede
  elegante». Los dos tonos pasan AA sobre `--bg`, `--bg-2` y `--panel-solido` en ambos temas
  (`--tenue`: #5f6b7a en claro, #808c9d en oscuro). Si inventas un tono, calcula antes su
  proporción de contraste sobre esos fondos.

### 2. Color y profundidad
- Paleta «confianza y calma»: azul institucional (claro #1f4f8f, oscuro #82aee6) y turquesa
  apagado de apoyo. El oscuro es azul noche (#0f1621), **nunca negro puro ni blanco puro de
  fondo**, sin neón y sin resplandores.
- Profundidad con capas sutiles: fondo `--bg`, tarjetas `--panel` con borde `--line` y
  `--sombra` suave. Un solo color de acento para la acción principal; el resto, neutros.
- **Enfoque descriptivo (decisión del usuario):** nada de verde = bueno / rojo = malo ni
  «mejor/peor». Las subidas y bajadas van en colores neutros; las escalas del mapa son de nivel
  (azules) o de cambio centrada en una referencia. No reintroduzcas juicios de valor con color.

### 3. Microinteracciones y pulido
- Todo elemento interactivo tiene estados hover, foco y pulsado, con transiciones cortas
  (0,15–0,25 s, curva `var(--suave)`) y animando solo propiedades concretas
  (`transition: border-color 0.2s, transform 0.2s`), mejor que `all`.
- Foco visible siempre: `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`
  ya es global; no lo quites con `outline: none` sin sustituto.
- Pulsado: `transform: scale(0.98)` como `.btn:active`. Elevación en hover discreta, como
  `.btn:hover` (`translateY(-1px)`, borde `--accent` y sombra `--brillo`), nunca saltos grandes.
- Calma ante todo: el fondo está casi quieto. No animes datos que el usuario lee (cifras de
  tablas, ejes), ni nada de alta frecuencia (atajos de teclado, cambio de pestaña). Respeta
  `@media (prefers-reduced-motion: reduce)` (al final de `style.css`): ya apaga todas las
  transiciones y animaciones CSS, pero lo que animes desde JavaScript debe consultar
  `sinMovimiento` (exportado por `efectos.js`) por su cuenta.

### 4. Composición
- Una página = un módulo en `web/js/paginas/<nombre>.js`; lo compartido va en módulos propios
  (`graficos.js`, `efectos.js`, `api.js`, `previsiones.js`…). No metas lógica de datos dentro de
  las plantillas HTML: primero obtén y prepara los datos, después pinta.
- Diseña los estados: cargando, vacío (sin datos o sin selección), error («No se pudo
  cargar…») y cargado. Comprueba también 375 px de ancho y ambos temas.
- Textos en español, sin jerga, con la fuente de los datos bajo cada gráfico.

## Comprobación
Antes de dar por terminado un cambio de diseño, sigue la skill `webapp-testing`: capturas en
claro y oscuro (cambiando el tema con la tecla `t`), a 375 px, y cero errores de consola.
