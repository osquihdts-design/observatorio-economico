# Observatorio económico

Panel con datos económicos oficiales que se actualizan solos: inflación, paro, paro
juvenil, crecimiento del PIB, precio de la vivienda, euríbor y tipo del BCE, para
España y otros 12 países y zonas de Europa. Incluye un análisis de regresión para
ver si dos indicadores se mueven juntos.

Hecho **solo con Python estándar**: no hay que instalar ninguna librería.

## Cómo abrirlo

- **Doble clic en `abrir-panel.bat`.** Se abre solo en el navegador.
- O desde una terminal en esta carpeta: `python servidor.py`

Se ve en http://localhost:8501. Para cerrarlo, cierra la ventana negra (o `Ctrl+C`).

## Qué hay

- **Tarjetas de arriba:** el último dato de España (y de la zona euro en los tipos de interés), con la flecha del cambio respecto al dato anterior. Clic en una tarjeta para ver su gráfico.
- **Pestañas:** un gráfico por indicador. Elige los países y desde qué año.
  - «Descargar para Excel» guarda la tabla (se abre bien en Excel en español).
  - «Guardar imagen» guarda el gráfico en PNG, listo para un trabajo o presentación.
- **Análisis:** elige dos indicadores y un país, y calcula una regresión lineal con datos trimestrales: correlación (r), R², pendiente y una explicación en palabras. Hay ejemplos de clase listos: curva de Phillips, ley de Okun, euríbor y vivienda, política monetaria.
  - El «retardo» compara una variable con la otra unos trimestres después (los efectos económicos tardan).

## De dónde salen los datos

- **Eurostat** (inflación IPCA, paro, PIB, vivienda): https://ec.europa.eu/eurostat
- **Banco Central Europeo** (euríbor, tipo de depósito): https://data.ecb.europa.eu

Se descargan la primera vez y se guardan 12 horas en la carpeta `.cache`. Sin internet,
el panel usa los últimos datos guardados. «Actualizar datos» fuerza una descarga nueva.

## Archivos

- `datos.py` — descarga y guarda los datos (cada indicador está explicado ahí).
- `analisis.py` — estadística: medias trimestrales y regresión lineal.
- `servidor.py` — el servidor que une los datos con la página web.
- `web/` — la página: `index.html`, `style.css` y `app.js` (gráficos con Plotly).
