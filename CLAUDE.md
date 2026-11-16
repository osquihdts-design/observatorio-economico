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
- `python servidor.py` → http://localhost:8501 (o doble clic en `abrir-panel.bat`).
- `datos.py`: Eurostat (JSON-stat) y BCE (CSV). Formato interno: `{país: [[fecha "AAAA-MM-DD", valor], ...]}`. Caché en `.cache/` 12 h; sin internet usa la caché.
  - Inflación: en 2026 Eurostat migró el IPCA a ECOICOP 2 → se unen `prc_hicp_manr` (hasta 2025, `coicop=CP00`) y `prc_hicp_minr` (desde 2026, `coicop18=TOTAL`).
- `analisis.py`: todo a medias trimestrales; regresión con `statistics.linear_regression`.
- `web/`: HTML + JS sin compilar; gráficos con Plotly 2.35.2 desde jsDelivr.
- Prueba los cambios en el navegador. Si cambias Python, reinicia el servidor.

## Plan ampliado (especificación del usuario, por fases)
Versión adaptada a Python estándar: SQLite en vez de DuckDB/Parquet, filas con el esquema común en vez de DataFrames, servidor propio + Plotly en vez de Streamlit, econometría programada a mano en vez de statsmodels.
1. ✅ Fase 1: `src/config.py`, `src/connectors/{base,ine_client,eurostat_client,ecb_client}.py`, `src/etl/{storage,pipeline}.py`, `scripts/actualizar_datos.py`. 23 indicadores verificados en vivo.
   - Zona euro = `EA` (Eurostat: se prueba EA, EA21, EA20; une_rt_m solo tiene EA21). BCE `U2` → `EA`.
   - INE con `det=2&tip=AM` (fecha ISO y «TipoDato» por nombre). El INE no da el año base de los índices.
   - BCE: tipos diarios → último valor de cada mes. MRO = `MRR_RT` (continua desde 1999); MLF = `MLFR`.
2. Fase 2: econometría (filtro HP, correlación cruzada con retardos, OLS con varias X, Newey-West, ADF, Durbin-Watson, AIC/BIC) y exportador .xlsx (zipfile + XML).
3. Fase 3: interfaz multipágina (portada ejecutiva, inflación, mercado laboral, política monetaria, vivienda y salarios, laboratorio econométrico) leyendo de la base SQLite.
4. Fase 4: tests (unittest), GitHub Actions y README.
- La web actual (`servidor.py` + `datos.py`) sigue funcionando aparte hasta la fase 3.

## Ideas siguientes
- Más indicadores (salarios, deuda pública, prima de riesgo, IPC por grupos, datos del INE por comunidades).
- Previsión sencilla (tendencia), exportar informe en PDF.
