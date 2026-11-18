# Observatorio económico

Panel de datos económicos para un estudiante de Economía (su primer proyecto en Python).

## Sobre el usuario
- Estudiante de Economía, principiante en programación. Explícale en español y sin jerga; enséñale Python poco a poco.
- Prefiere terminar las cosas bien hechas y limpias.

## Restricción importante
- Este Windows tiene **Smart App Control**: bloquea las DLL sin firmar (numpy, pandas, pyarrow… y los Python que descarga uv).
  Por eso el proyecto usa **solo la biblioteca estándar de Python** (urllib, json, csv, statistics, http.server). No añadas dependencias con código compilado.
- Python: `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` (instalado con winget, firmado).

## Técnica
- `python servidor.py` → http://localhost:8501 (o doble clic en `abrir-panel.bat`). Si la base está vacía, descarga los datos al arrancar.
- Datos: `src/` (conectores → SQLite en `data/processed/`). Inflación Eurostat: en 2026 se migró a ECOICOP 2 → se unen `prc_hicp_manr` (hasta 2025) y `prc_hicp_minr` (desde 2026).
- `web/`: HTML + JS sin compilar; gráficos con Plotly 2.35.2 desde jsDelivr.
- Prueba los cambios en el navegador. Si cambias Python, reinicia el servidor. `python -m unittest` debe pasar.

## Plan ampliado (especificación del usuario, por fases)
Versión adaptada a Python estándar: SQLite en vez de DuckDB/Parquet, filas con el esquema común en vez de DataFrames, servidor propio + Plotly en vez de Streamlit, econometría programada a mano en vez de statsmodels.
1. ✅ Fase 1: `src/config.py`, `src/connectors/{base,ine_client,eurostat_client,ecb_client}.py`, `src/etl/{storage,pipeline}.py`, `scripts/actualizar_datos.py`. 23 indicadores verificados en vivo.
   - Zona euro = `EA` (Eurostat: se prueba EA, EA21, EA20; une_rt_m solo tiene EA21). BCE `U2` → `EA`.
   - INE con `det=2&tip=AM` (fecha ISO y «TipoDato» por nombre). El INE no da el año base de los índices.
   - BCE: tipos diarios → último valor de cada mes. MRO = `MRR_RT` (continua desde 1999); MLF = `MLFR`.
2. ✅ Fase 2: `src/econometrics/` (algebra, distribuciones, time_series, regression, correlations, dataset) y `src/reporting/` (xlsx, exporter). 18 tests en `tests/` (`python -m unittest -v`), validados con Anscombe, tablas t/F y críticos de MacKinnon.
   - HAC Newey-West con núcleo de Bartlett, L = ⌊4(n/100)^(2/9)⌋ y corrección n/(n−k) (como statsmodels). F de Wald con la matriz elegida.
   - ADF con constante, retardos por AIC sobre muestra común y reestimación (como statsmodels); p-valor MacKinnon 1994, críticos MacKinnon 2010.
   - `dataset.preparar`: si alguna variable es trimestral, todo pasa a medias trimestrales antes de transformar.
3. ✅ Fase 3: `servidor.py` (API sobre SQLite + actualización en segundo plano con progreso) y `web/` (SPA con módulos ES sin compilar: `js/app.js`, `js/paginas/*.js`, `js/academico.js`, `js/graficos.js`).
   - API GET: catalogo, series, estado, resumen · POST: actualizar, lab/hp, lab/ccf, lab/ols, lab/dispersion, lab/exportar (xlsx).
   - Colores fijos por país (ES #C8102E, EA #003399…). Índices INE se rebasan a 2015 = 100 en el cliente (la API del INE no da la base).
   - El panel del navegador de Claude suele estar oculto: verificar con JS (datos, errores) además de capturas.
4. ✅ Fase 4: 48 tests (`tests/`: econometría, conectores con respuestas grabadas, almacenamiento, API de punta a punta sobre base temporal con `tests/base_temporal.py`), `.github/workflows/` (tests en Linux y Windows; actualización diaria que publica los datos como artifact) y `README.md`.
   - `storage` lee `config.BASE_DATOS` en cada llamada (no como valor por defecto) para que los tests usen una base temporal.

5. ✅ Diseño revisado con capturas reales (Playwright) y página «Finanzas públicas» (`web/js/paginas/finanzas.js`): prima de riesgo (bono 10 años `irt_lt_mcby_m` frente a DE, en pb), deuda (`gov_10q_ggdebt`) y saldo público (`gov_10q_ggnfa`, `s_adj=SCA`: SA solo existe para Francia). 26 indicadores, 52 tests.

6. ✅ Rediseño futurista: tema oscuro por defecto (`data-tema`), `web/js/efectos.js` (partículas, foco e inclinación de tarjetas, apariciones, contadores, avisos, transiciones), `web/js/paleta.js` (Ctrl+K y atajos), visor a pantalla completa, ticker y reloj. Página `mapa.js` (coropletas UE-27 animadas + carrera de barras) y portada con radar de posición europea.
   - Eurostat descarga los 27 países (`config.PAISES_UE`, Grecia = `EL`); `config.NOMBRES` da el nombre de cualquier código. `PAISES` sigue siendo la lista corta de la barra lateral.
   - Colores de Plotly según el tema con `graficos.tono()`: las páginas usan los colores institucionales y se traducen solos en oscuro.
   - Con Playwright, las tarjetas `.revelable` solo aparecen al entrar en pantalla: para capturas de página completa, añade antes la clase `visible`.

## Publicación
- Repositorio público: https://github.com/osquihdts-design/observatorio-economico (rama `main`). Commits con el email noreply de GitHub.
- GitHub Actions: `tests.yml` y `update_data.yml` (diaria 07:30 UTC, datos como artifact). Acciones en v7 (Node 24).

## Ideas siguientes
- Más indicadores (salarios, deuda pública, prima de riesgo, IPC por grupos, datos del INE por comunidades).
- Previsión sencilla (tendencia), exportar informe en PDF.
