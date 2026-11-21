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

7. ✅ Centro de investigación (`src/research/`, `web/js/investigacion.js`, `web/js/paginas/{centro,biblioteca,fichas}.js`, `web/css/investigacion.css`): tablas `inv_*` en la misma SQLite (FTS5 con `remove_diacritics`), taxonomía fija en `taxonomia.py`, semilla con cifras reales (BCE sept. 2026, BdE oct. 2026) y predicciones propias marcadas como ejemplo. 68 tests.
   - Obsidian = carpeta de notas: `obsidian.sincronizar` importa primero (gana lo más reciente por fecha de modificación) y luego exporta a `<bóveda>/Observatorio/`. Bóveda del usuario: `C:\Users\osqui\Downloads\mybrain\My brain` (ajuste `boveda` en `inv_ajustes`). Los tests usan una bóveda temporal: nunca la real.
   - `almacen.conectar` prepara tablas y semilla una sola vez por proceso con un candado (el servidor es multihilo).

8. ✅ Mapa con ficha por indicador (`FICHAS` en `mapa.js`: unidad, qué mide, cómo leerlo, escala de color y referencia) y vistas mapa / comparar / tabla.
   Enlaces con estado: `#/pagina/param?p=…&r=…|d=…&h=…` + parámetros de página (`ctx.consulta`, `ctx.fijarConsulta`; el mapa usa f, c, v, f2). Botón Compartir (`L`): en local copia la URL pública.
   Recesiones CEPR-EABCN y eventos en `graficos.js` (`RECESIONES`, `EVENTOS`), añadidos por `dibujar` (opción `eventos: false` para quitarlos) e interruptor en la barra lateral.
9. ✅ Previsiones oficiales (`src/previsiones.py`, a mano y verificadas; `web/js/previsiones.js` las dibuja en IAPC, paro e historia del mapa) y calendario
   (`src/connectors/calendario.py`: ICS del INE `dynt3/Calendario/calendario.ics` + página de reuniones del BCE; tabla `calendario`, lo actualiza `pipeline.ejecutar`).
   El ICS de Eurostat (`cache/RELEASE_CALENDAR/calendar_EN.ics`) daba 404 en nov. 2026. 74 tests.
   - `publicar_web.py` añade `?v=<huella del código>` a todos los imports y estilos: evita mezclar módulos viejos (caché de Pages, 10 min) con nuevos.
10. ✅ Aprender y compartir: `paginas/{guias,informe,insertar,sobre}.js` (también en la web pública), `web/embed.html` + `js/embed.js` + `css/embed.css`
    (gráfico insertable: i, p, d, t, prev, ev), `css/aprender.css` (documento tipo papel e `@media print` con `#zona-impresion`), `LICENCIA.md` (CC BY 4.0 para contenidos;
    licencia del código pendiente de que el usuario la elija). Las guías usan `markdown()` de `investigacion.js` (admite enlaces `#/…`). 75 tests.
11. ✅ Jóvenes, empleo y tecnología (`paginas/jovenes.js`, para el TFG de Sociología del usuario): 10 indicadores anuales de Eurostat (edat_lfse_20, lfsi_emp_a, edat_lfse_14, edat_lfse_03, isoc_sk_dskl_i21, isoc_sks_itspt, isoc_eb_ai, isoc_ai_iaiu ×3). Frecuencia `A` en el conector y agregado `EU27_2020` guardado como `UE` en todas las tablas (el mapa muestra la cifra oficial de la UE si existe; si no, la media simple). `yth_empl_050` y `lfsa_etpga` daban 404 en nov. 2026. 77 tests.
12. ✅ Salarios por edad (INE EPA, tabla 66239: series EPA706586 16-24, EPA706597 25-34, EPA706575 total; anuales desde 2006) y paro juvenil por nivel de estudios (Eurostat `lfsq_urgaed`, 15-24, ED0-2 / ED3_4 / ED5-8, trimestral sin desestacionalizar). En la página de jóvenes. 42 indicadores.

13. ✅ Verificación y objetividad: `scripts/verificar_datos.py` (consulta independiente del último dato en INE/Eurostat/BCE; 66/66 coinciden el 20-11-2026) → `verificacion.json`, API `verificacion`, paso del workflow y tarjeta en `sobre.js`. `graficos.eje(titulo, sufijo)`: todos los ejes con título y unidad.
    - Enfoque descriptivo (decisión del usuario): nada de «mejor/peor» ni verde = bueno / rojo = malo. Escalas del mapa `nivel` y `cambio` (centrada en el objetivo); radar = percentil del valor bruto; deltas y ticker en colores neutros. No reintroducir juicios de valor.

14. ✅ Paleta «confianza y calma» (petición del usuario): azul institucional (claro #1f4f8f, oscuro #82aee6) + turquesa apagado; oscuro = azul noche #0f1621 (nunca negro puro ni neón). Tema por defecto = el del sistema (`prefers-color-scheme`). Fondo casi quieto (pocas partículas lentas, sin red que sigue al ratón, sin aurora animada), sin resplandores. Mapa: escala `nivel` en azules. Texto con contraste AA.

15. ✅ Boletín de novedades (sin inicio de sesión, decisión del usuario): `src/novedades.py` (detecta periodos nuevos de ES/EA/UE frente a `api/resumen.json` de la web publicada; tipos `bce_*` solo si cambian; una entrada al día con guid = fecha) → `_site/novedades.xml` + `api/novedades.json` (historial, 30 entradas). Banner `web/js/boletin.js` (`BOLETIN_URL` = aplicación web de Apps Script; vacío = solo RSS). Envío gratis con Gmail: `boletin/Codigo.gs` (hoja «Suscriptores», doble confirmación, baja que borra, máx. 30 confirmaciones/día, campo trampa `web`, envío diario 10-11 h Madrid si la entrada es de hoy o ayer; Buttondown se descartó por ser de pago) y guía `boletin/COMO-ACTIVARLO.md` (recomienda un Gmail solo para el proyecto), botón en la barra lateral, comando en Ctrl+K y nota de privacidad RGPD en `sobre.js` (`#/sobre?ir=privacidad`; `?ir=` lleva a cualquier sección con id). Los tests pasan `leer=` a `publicar_web.generar` para no usar la red.

## Publicación
- Repositorio público: https://github.com/osquihdts-design/observatorio-economico (rama `main`). Commits con el email noreply de GitHub.
- GitHub Actions: `tests.yml` y `update_data.yml` (diaria 07:30 UTC y en cada push a main: datos como artifact + web en GitHub Pages). Acciones en v7 (Node 24); Pages: configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5.
- Web pública: https://osquihdts-design.github.io/observatorio-economico/ — `scripts/publicar_web.py` genera `_site/` (web + JSON de catálogo, estado, resumen y series; `--ver` la sirve en :8600). `api.js` detecta `<meta name="observatorio-modo" content="estatico">`: sin POST (la curva de Phillips se calcula en JS), sin centro de investigación (es privado) ni botón de actualizar; el laboratorio muestra cómo usarlo en local.

## Ideas siguientes
- Más indicadores (salarios, deuda pública, prima de riesgo, IPC por grupos, datos del INE por comunidades).
- Previsión sencilla (tendencia), exportar informe en PDF.
