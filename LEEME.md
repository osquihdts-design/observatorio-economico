# Observatorio económico

Panel de datos económicos oficiales de **España frente a Europa**, con un laboratorio
econométrico para trabajos y el TFG. Datos del **INE**, **Eurostat** y el **Banco Central
Europeo**, actualizados desde sus APIs públicas.

Hecho **solo con Python estándar** (sin numpy, pandas ni Streamlit, que este Windows bloquea)
y gráficos interactivos con Plotly.

## Cómo abrirlo

- **Doble clic en `abrir-panel.bat`.** Se abre solo en el navegador.
- O desde una terminal en esta carpeta: `python servidor.py`

Se ve en http://localhost:8501. La primera vez descarga los datos (unos 10 segundos).
Para cerrarlo, cierra la ventana negra (o `Ctrl+C`).

## Qué hay

**Barra lateral**
- Periodo: 1, 3, 5 o 10 años, máximo o fechas a medida. Se aplica a todas las páginas.
- Países: España y zona euro siempre; añade Alemania, Francia, Italia o Portugal.
- Estado de las fuentes con semáforo (verde, ámbar o rojo) y «Actualizar datos ahora» con barra de progreso.
- **Modo explicación académica:** bajo cada gráfico, cómo se calcula, su fórmula y cómo interpretarlo.

**Páginas**
1. **Portada:** cinco tarjetas con el último dato (color según si el cambio es bueno o malo), minigráfico
   y referencia de la zona euro; divergencia España–zona euro en inflación y paro; tabla con todos los indicadores.
2. **Inflación y precios:** IPC general y subyacente con el objetivo del BCE, comparativa europea (IAPC)
   y calculadora de poder adquisitivo entre dos fechas.
3. **Mercado laboral:** paro general y juvenil por países y curva de Phillips con una recta por subperiodo
   (antes de la COVID, COVID, ciclo restrictivo del BCE y bajadas de tipos).
4. **Política monetaria:** corredor de tipos del BCE con el euríbor, transmisión a las hipotecas
   (España frente a zona euro) y crecimiento de M3.
5. **Vivienda y salarios:** índices de precio de vivienda (INE y Eurostat, base 2015) e índice de esfuerzo
   vivienda/salarios.
6. **Laboratorio econométrico:** regresión MCO con varias variables y transformaciones, errores Newey-West,
   test ADF con aviso de regresión espuria, gráfico de observados/predichos y residuos, citas APA y
   **exportación a Excel para el TFG**; filtro Hodrick-Prescott; correlación cruzada con retardos.

Cada gráfico tiene botones para descargar sus datos (CSV para Excel) y guardarlo como imagen.

## Actualizar los datos sin abrir la web

```
python scripts/actualizar_datos.py
```

Guarda todo en `data/processed/observatorio.sqlite` (más una copia `observaciones.csv`).

## Indicadores

- **INE:** IPC general (índice y variación) y subyacente, paro EPA (total y menores de 25),
  precio de la vivienda (general, nueva y segunda mano) y coste salarial (ETCL).
- **Eurostat** (España, Alemania, Francia, Italia, Portugal y zona euro): inflación IAPC general y
  subyacente, paro y paro juvenil, precio de la vivienda y PIB.
- **BCE:** tipos oficiales (depósito, refinanciación y marginal), euríbor a 12 meses, tipo de las
  nuevas hipotecas (España y zona euro) y crecimiento de M3.

Los códigos exactos de cada serie están en `src/config.py`.

## Ejemplo de laboratorio desde la terminal

```
python scripts/ejemplo_laboratorio.py
```

Curva de Phillips en España, test ADF, filtro HP, retardos del tipo del BCE y Excel final en
`data/processed/ejemplo_curva_phillips.xlsx`.

## Tests

```
python -m unittest -v
```

Comprueban que la regresión reproduce los resultados publicados del cuarteto de Anscombe, que los
p-valores coinciden con las tablas de la t y la F, que el p-valor del ADF da 1 %, 5 % y 10 % en los
valores críticos de MacKinnon, las propiedades del filtro HP y que el Excel es un archivo válido.

## Archivos

- `servidor.py` — servidor web y API (`/api/...`).
- `web/` — la página: `index.html`, `css/style.css` y `js/` (`app.js` estructura, `graficos.js`,
  `academico.js` textos del modo académico, y una página por archivo en `js/paginas/`).
- `src/config.py` — catálogo de indicadores con sus códigos oficiales.
- `src/connectors/` — un conector por fuente (INE, Eurostat, BCE) y piezas comunes.
- `src/etl/` — base de datos SQLite (`storage.py`) y descarga en paralelo (`pipeline.py`).
- `src/econometrics/` — matrices, distribuciones, series temporales (transformaciones, HP, ADF),
  regresión (MCO y Newey-West), correlaciones y preparación de datos.
- `src/reporting/` — creación de Excel y citas APA.
- `scripts/` — actualizar datos y ejemplo de laboratorio.
- `tests/` — comprobaciones automáticas.
