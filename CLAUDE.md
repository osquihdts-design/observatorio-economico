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

## Ideas siguientes
- Más indicadores (salarios, deuda pública, prima de riesgo, IPC por grupos, datos del INE por comunidades).
- Previsión sencilla (tendencia), exportar informe en PDF.
