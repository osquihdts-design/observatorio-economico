# Observatorio económico

Panel interactivo de datos económicos oficiales de **España frente a Europa**, con un
**laboratorio econométrico** pensado para trabajos de clase y el TFG.

**🌐 Versión pública: <https://osquihdts-design.github.io/observatorio-economico/>** — se actualiza sola cada mañana
con GitHub Actions (`scripts/publicar_web.py` guarda los datos como JSON). Incluye todas las páginas de datos y el
mapa; el laboratorio econométrico y el centro de investigación solo están en la versión que se ejecuta en tu ordenador.

- Datos reales del **INE**, **Eurostat** y el **Banco Central Europeo**, descargados de sus APIs públicas (sin claves ni registro).
- 42 indicadores: inflación, paro, PIB, vivienda, salarios, tipos de interés, hipotecas, dinero, prima de riesgo, deuda y déficit públicos, y jóvenes, empleo e inteligencia artificial.
- Comparación con Alemania, Francia, Italia, Portugal y la zona euro, y **mapa animado de los 27 países de la UE**.
- Interfaz futurista e interactiva: tema oscuro/claro, fondo de partículas que reacciona al ratón, ticker de datos en vivo, paleta de comandos (`Ctrl+K`), atajos de teclado, gráficos a pantalla completa con zoom y transiciones animadas.
- **Centro de investigación**: biblioteca de fuentes oficiales y análisis propios con buscador facetado, fichas de investigación en pantalla dividida, citas APA al portapapeles y sincronización con **Obsidian**.
- Regresiones, test de estacionariedad, filtro Hodrick-Prescott y correlaciones con retardos, con exportación a Excel y citas en formato APA.
- Hecho **solo con Python estándar**: no hay que instalar ninguna librería.

---

## Índice

1. [Inicio rápido](#inicio-rápido)
2. [Qué incluye](#qué-incluye)
3. [Fuentes y series](#fuentes-y-series)
4. [Laboratorio econométrico](#laboratorio-econométrico)
5. [Centro de investigación](#centro-de-investigación)
6. [Cómo está construido](#cómo-está-construido)
7. [Tests](#tests)
8. [Actualización automática con GitHub Actions](#actualización-automática-con-github-actions)
9. [Decisiones técnicas y limitaciones](#decisiones-técnicas-y-limitaciones)
10. [Uso de los datos y cómo citarlos](#uso-de-los-datos-y-cómo-citarlos)

---

## Inicio rápido

**Requisito:** Python 3.12 o superior. Nada más.

```
python servidor.py
```

En Windows también vale con **doble clic en `abrir-panel.bat`**. Se abre el navegador en
<http://localhost:8501>. La primera vez se descargan los datos (unos 10 segundos); después
se actualizan con el botón **«Actualizar datos ahora»** de la barra lateral.

Para parar el servidor: `Ctrl+C` en la terminal (o cerrar la ventana negra).

Otros comandos útiles:

| Comando | Qué hace |
|---|---|
| `python scripts/actualizar_datos.py` | Descarga todos los datos sin abrir la web y muestra un resumen por fuente. |
| `python scripts/verificar_datos.py` | Comprueba el último dato de cada indicador contra la API oficial (consulta independiente) y guarda el resultado en `data/processed/verificacion.json`. |
| `python scripts/ejemplo_laboratorio.py` | Ejemplo completo de análisis con datos reales y Excel final. |
| `python -m unittest -v` | Ejecuta los 77 tests. |

---

## Qué incluye

### Barra lateral

- **Periodo:** 1, 3, 5 o 10 años, máximo o fechas a medida. Se aplica a todas las páginas.
- **Países:** España y zona euro siempre visibles; se pueden añadir Alemania, Francia, Italia y Portugal.
- **Estado de las fuentes:** semáforo por fuente (verde: al día · ámbar: falló algún indicador o datos de más de 24 h · rojo: falló la descarga) con la hora de la última sincronización.
- **Actualizar datos ahora**, con barra de progreso real.
- **Modo explicación académica:** muestra bajo cada gráfico la metodología, la fórmula y cómo interpretarlo.
- **Tema claro / oscuro** (el oscuro es el de por defecto).

### Interacción

- **Paleta de comandos** (`Ctrl+K` o `/`): busca páginas, indicadores, países, periodos y acciones sin importar tildes.
- **Atajos:** `1`–`9` y `0` cambian de página · `T` tema · `A` modo académico · `U` actualizar datos · `L` copiar enlace · `?` lista de atajos · `Esc` cerrar.
- **Enlaces para compartir:** la dirección guarda lo que estás viendo (página, países, periodo y, en el mapa, indicador, fecha, país elegido y vista),
  por ejemplo `#/mapa/paro?p=DE&r=10&v=comparar&f=2026-09-01&f2=2013-04-01`. El botón **Compartir** (o `L`) la copia; desde tu ordenador
  copia la de la web pública, para que le sirva a cualquiera.
- **Recesiones y acontecimientos** en todos los gráficos de series: bandas grises con las recesiones de la zona euro según el comité de
  fechado del CEPR-EABCN (2008T2–2009T2, 2011T4–2013T1 y 2020T1–2020T2) y líneas en fechas clave (Lehman, «Whatever it takes», QE del BCE,
  COVID-19, invasión de Ucrania, primera subida de tipos de 2022). Se pueden ocultar desde la barra lateral.
- **Previsiones oficiales sobre los gráficos** (rombos con línea punteada, media anual): proyecciones del BCE para la zona euro
  (septiembre de 2026) y del Banco de España para España (octubre de 2026) de inflación, inflación subyacente, PIB y paro.
  Están en [`src/previsiones.py`](src/previsiones.py) con su enlace; al salir una edición nueva se añade allí. Se pueden ocultar.
- **Próximos datos** en la portada: calendario de publicaciones del INE (IPC, IPC adelantado, PIB trimestral, EPA, vivienda,
  coste laboral) y decisiones de tipos del BCE, descargado cada día de sus calendarios oficiales, con enlace para
  suscribirse al calendario del INE en el móvil.
- **Ticker** con el último dato y la variación de 15 indicadores clave; cada elemento lleva a su página.
- **⤢ Ampliar** en cada gráfico: pantalla completa con zoom (rueda del ratón) y barra para moverse en el tiempo.
- Animaciones (números que cuentan, líneas que se dibujan, tarjetas con inclinación 3D). Se desactivan si el sistema pide «reducir movimiento».

### Páginas

| Página | Contenido |
|---|---|
| **Portada** | Radar de posición europea (en qué lugar queda España entre los 27 en inflación, paro, crecimiento, deuda, déficit y coste de la deuda) · 5 tarjetas (inflación, paro, PIB, euríbor, vivienda) con último dato, variación con color contextual y minigráfico · divergencia España–zona euro · tabla de todos los indicadores que se puede ordenar y filtrar. |
| **Mapa de Europa** | Mapa de coropletas de los 27 países para cualquier indicador europeo, con reproductor (▶, línea de tiempo y velocidad) desde el año 2000, carrera de barras sincronizada, puesto de España e historia del país que se pulse. Ficha de cada indicador (unidad, qué mide, cómo leerlo y línea de referencia). Tres vistas: **mapa**, **comparar dos fechas** (dos mapas con la misma escala y resumen de cambios) y **tabla** ordenable con el cambio en un año y desde la fecha de comparación. Atajos: `Espacio`, `←` `→`. |
| **Jóvenes, empleo y tecnología** | Paro juvenil (también según el nivel de estudios), salario medio bruto mensual por edad (INE), jóvenes que ni estudian ni trabajan, tasa de empleo juvenil, abandono escolar, estudios superiores, competencias digitales, especialistas TIC, empresas que usan IA y uso de IA generativa por edad y para trabajar (Eurostat, anual, con la UE-27 como referencia). Incluye preguntas de investigación, cómo interpretar los datos y fuentes de opinión complementarias (Injuve, CIS, Eurobarómetro). |
| **Inflación y precios** | IPC general y subyacente (INE) frente al objetivo del 2 % del BCE · comparativa europea del IAPC · calculadora de poder adquisitivo entre dos fechas. |
| **Mercado laboral** | Paro general y juvenil por países · curva de Phillips empírica con una recta por subperiodo (antes de la COVID, COVID, ciclo restrictivo del BCE y bajadas de tipos). |
| **Política monetaria** | Corredor de tipos del BCE con el euríbor · transmisión del euríbor a las nuevas hipotecas en España y la zona euro · crecimiento de M3. |
| **Vivienda y salarios** | Precio de la vivienda (INE: general, nueva y segunda mano; Eurostat), base 2015 = 100 · índice de esfuerzo vivienda/salarios · comparativa europea. |
| **Finanzas públicas** | Prima de riesgo frente a Alemania (puntos básicos) · rentabilidad del bono a 10 años · deuda pública y déficit en % del PIB frente a los límites europeos (60 % y −3 %). |
| **Laboratorio econométrico** | Regresión MCO, test ADF, filtro HP y correlación cruzada (ver abajo). |

Cada gráfico tiene botones para **descargar sus datos** (CSV listo para Excel en español) y **guardarlo como imagen**.

---

## Fuentes y series

Todos los códigos se comprobaron en vivo contra las APIs. Están en [`src/config.py`](src/config.py).

### INE · API JSON Tempus3

| Indicador | Serie | Frecuencia |
|---|---|---|
| IPC general, variación anual | `IPC290750` | Mensual |
| IPC general, índice | `IPC290751` | Mensual |
| IPC subyacente (sin alimentos no elaborados ni energía), variación anual | `IPC292510` | Mensual |
| Tasa de paro EPA (total nacional, ambos sexos, 16 y más años) | `EPA423474` | Trimestral |
| Tasa de paro EPA, menores de 25 años | `EPA452436` | Trimestral |
| Índice de Precios de Vivienda: general, nueva y segunda mano | `IPV1209`, `IPV1613`, `IPV1618` | Trimestral |
| Índice de Precios de Vivienda: general, variación anual | `IPV1376` | Trimestral |
| ETCL: coste salarial total por trabajador y mes | `ETCL1527` | Trimestral |

### Eurostat · API de estadísticas (JSON-stat 2.0)

España, Alemania, Francia, Italia, Portugal y zona euro.

| Indicador | Tabla y filtros |
|---|---|
| Inflación IAPC general | `prc_hicp_manr` (`coicop=CP00`, hasta 2025) + `prc_hicp_minr` (`coicop18=TOTAL`, desde 2026) |
| Inflación IAPC subyacente | Igual, con `TOT_X_NRG_FOOD` |
| Tasa de paro y paro juvenil | `une_rt_m` (`s_adj=SA`, `age=TOTAL` / `Y_LT25`, `sex=T`, `unit=PC_ACT`) |
| Precio de la vivienda | `prc_hpi_q` (`purchase=TOTAL`, `unit=I15_Q` y `RCH_A`) |
| PIB real, variación interanual | `namq_10_gdp` (`na_item=B1GQ`, `s_adj=SCA`, `unit=CLV_PCH_SM`) |
| Rentabilidad del bono a 10 años (mensual) | `irt_lt_mcby_m` (`int_rt=MCBY`) · la prima de riesgo se calcula como diferencia con Alemania |
| Deuda pública, % del PIB (trimestral) | `gov_10q_ggdebt` (`unit=PC_GDP`, `sector=S13`, `na_item=GD`) |
| Saldo público, % del PIB (trimestral) | `gov_10q_ggnfa` (`unit=PC_GDP`, `sector=S13`, `na_item=B9`, `s_adj=SCA`) |

### Banco Central Europeo · ECB Data Portal (SDMX 2.1, CSV)

| Indicador | Serie |
|---|---|
| Facilidad de depósito | `FM/D.U2.EUR.4F.KR.DFR.LEV` |
| Operaciones principales de financiación | `FM/D.U2.EUR.4F.KR.MRR_RT.LEV` |
| Facilidad marginal de crédito | `FM/D.U2.EUR.4F.KR.MLFR.LEV` |
| Euríbor a 12 meses (media mensual) | `FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA` |
| Tipo de las nuevas hipotecas a hogares (España / zona euro) | `MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N` / `MIR/M.U2.B.A2C.AM.R.A.2250.EUR.N` |
| M3, variación anual | `BSI/M.U2.Y.V.M30.X.I.U2.2300.Z01.A` |

### Detalles que conviene saber

- **IAPC en 2026:** Eurostat pasó el IAPC a la clasificación ECOICOP 2 y movió los datos a `prc_hicp_minr`. Se unen la tabla histórica y la nueva para tener una serie continua.
- **Zona euro:** con la entrada de Bulgaria en 2026 el código pasó de `EA20` a `EA21`, y algunas tablas solo tienen uno de ellos. Se prueba `EA`, `EA21` y `EA20` y se usa el primero con datos. En la base de datos la zona euro es siempre `EA`.
- **Fechas del INE:** se piden con `tip=AM`, que las da como texto con zona horaria. La marca en milisegundos corresponde a la medianoche de Madrid y, convertida tal cual a UTC, cae el día anterior.
- **Tipos del BCE:** son diarios; se guarda el último valor de cada mes. La serie de operaciones principales usa `MRR_RT` porque es continua desde 1999 (`MRR_FR` solo empieza en 2008).
- **Índices del INE:** la API no indica su año base, así que en la web se rebasan a 2015 = 100.
- **Estado del dato:** se guarda si es definitivo o provisional (INE) y las marcas de Eurostat (provisional, estimado, ruptura de serie…).

---

## Laboratorio econométrico

| Herramienta | Detalle |
|---|---|
| **Transformaciones** | Niveles, primera diferencia (Δ), logaritmo (ln), Δln y tasa interanual. Se calculan por fecha, así un hueco en los datos nunca mezcla periodos no consecutivos. |
| **Frecuencias mixtas** | Si una variable es trimestral, todas pasan a medias trimestrales antes de transformarse. |
| **Regresión MCO** | Una o varias X. Coeficientes, errores estándar clásicos o **HAC de Newey-West** (núcleo de Bartlett, L = ⌊4(n/100)^(2/9)⌋, corrección n/(n−k)), t, p-valores, IC 95 %, R², R² ajustado, F (Wald), AIC, BIC, log-verosimilitud y Durbin-Watson. |
| **Diagnóstico automático** | Test **ADF** de cada variable (retardos por AIC, p-valor de MacKinnon 1994, críticos de MacKinnon 2010) con aviso de regresión espuria; aviso si Durbin-Watson < 1 o hay menos de 30 observaciones; gráficos de observados/predichos y residuos. |
| **Filtro Hodrick-Prescott** | λ = 14.400 (mensual) o 1.600 (trimestral), o el que se elija. Resuelto como sistema pentadiagonal, con coste lineal. |
| **Correlación cruzada** | r(k) = corr(X<sub>t</sub>, Y<sub>t+k</sub>) para k = −24…+24, con bandas de significación al 95 % (±1,96/√n). |
| **Exportación para el TFG** | Excel con las pestañas `Datos_Limpios`, `Metadatos_Fuentes` (con la cita APA 7.ª de cada serie), `Resultados_Regresion` y `Estadisticos_Descriptivos`. |

---

## Centro de investigación

Un centro de mando para la investigación propia, separado de los datos del panel pero enlazado con ellos.

**Dos pilares y una taxonomía común.**

| Pilar | Tipos de recurso | Fuentes |
|---|---|---|
| **Fuentes secundarias** | Dato oficial · Informe o publicación · Proyección oficial | Nacionales (INE, Banco de España, CNMV, Ministerio de Economía, Seguridad Social, SEPE) · Europeas (Eurostat, BCE, Comisión Europea) · Internacionales (FMI, Banco Mundial, OCDE, Fed, BIS, OMC) · Privadas (Bloomberg, Reuters, Yahoo Finance, BlackRock, Vanguard, Moody's, S&P, Fitch) |
| **Producción propia** | Marco teórico · Análisis empírico · Predicción propia | Elaboración propia |

Cada recurso se clasifica en una o varias **categorías temáticas** (Macroeconomía, Mercados financieros,
Finanzas corporativas, Sectores estratégicos, Riesgo y regulación, cada una con sus subcategorías), lleva
**etiquetas** libres y se puede **vincular** con otros («usa datos de», «se basa en», «actualiza»,
«contradice», «complementa»). Un dato oficial puede enlazarse a una serie del panel: entonces muestra
siempre el último valor publicado.

**Páginas.**

| Página | Contenido |
|---|---|
| **Centro de mando** (tecla `9`) | Buscador, volumen de recursos por categoría, últimas fuentes oficiales con su dato en vivo, predicciones activas, fichas y sincronización con Obsidian. |
| **Biblioteca de fuentes** (tecla `0`) | Búsqueda instantánea (texto completo, sin importar tildes) con filtros combinables por origen, tipo de contenido, tipo de recurso, fuente, categoría, fechas y etiquetas; cada filtro dice cuántos resultados daría. Detalle en un panel lateral, editor de recursos (`N`) y vínculos. |
| **Fichas de investigación** | Cada ficha responde a una pregunta y reúne, en pantalla dividida (pestañas en el móvil), los **datos oficiales**, el **desarrollo teórico** y las **predicciones y conclusiones**, con minigráficos de las series y la predicción dibujada sobre el dato real. «Copiar bibliografía» copia todas las referencias APA ordenadas. |

**Citas al portapapeles.** Cada recurso tiene un botón **❝ Citar** con tres formatos: **APA 7.ª**, **nota al pie**
y **dato + fuente** (por ejemplo, «IPC general (variación anual), España: 4,9 % (oct 2026). Fuente: Instituto
Nacional de Estadística. (2026)…»), listos para pegar en Word.

**Obsidian.** El botón **Sincronizar con Obsidian** escribe cada recurso como una nota en
`<tu bóveda>/Observatorio/` con sus propiedades (tipo, fuente, categorías, etiquetas, fecha, dato, cita), enlaces
`[[…]]` entre recursos relacionados (para verlos en el grafo), una nota por ficha, una nota de inicio y una vista
de **Bases** (`Observatorio.base`) con tablas de recursos, predicciones y fuentes. Funciona en los dos sentidos:
si editas el resumen, el texto, las etiquetas o las propiedades de una nota en Obsidian, o creas una nota nueva
dentro de `Observatorio/Análisis propios`, al sincronizar se guarda en el panel (gana la versión más reciente).
La carpeta de la bóveda se elige en el propio centro de mando.

**Ejemplos incluidos.** La primera vez se cargan 13 recursos y 3 fichas: datos oficiales enlazados a las series
del panel (IPC, paro, euríbor, deuda y bono a 10 años), las proyecciones del BCE de septiembre de 2026 y del
Banco de España de octubre de 2026 (cifras copiadas de sus publicaciones), marcos teóricos (DCF, regla de Taylor,
curva de Phillips) y dos predicciones propias marcadas como **ejemplos ilustrativos** (no son previsiones reales
ni recomendaciones de inversión).

---

## Cómo está construido

```
servidor.py                 Servidor web y API (/api/...)
abrir-panel.bat             Doble clic para abrir en Windows
web/                        La web (HTML, CSS y JavaScript sin compilar; gráficos con Plotly)
  js/app.js                 Barra lateral, navegación y actualización
  js/paginas/*.js           Una página por archivo
  js/academico.js           Textos del modo explicación académica
  js/investigacion.js       Piezas del centro de investigación (citas, panel lateral, editor, Markdown)
src/
  config.py                 Catálogo de indicadores y códigos oficiales
  connectors/               INE, Eurostat y BCE → un mismo esquema de datos
  etl/storage.py            Base de datos SQLite (data/processed/observatorio.sqlite)
  etl/pipeline.py           Descarga en paralelo y registro del estado de cada fuente
  econometrics/             Matrices, distribuciones, series temporales, regresión, correlaciones
  reporting/                Creación de Excel (.xlsx) y citas APA
  research/                 Centro de investigación: taxonomía, base de datos y buscador, citas, ejemplos y Obsidian
scripts/                    Actualizar datos y ejemplo de laboratorio
tests/                      77 tests automáticos
.github/workflows/          Tests y actualización diaria en GitHub Actions
```

**Esquema común de los datos.** Cada dato, venga de donde venga, se guarda con: `date`, `indicator_id`,
`indicator_name`, `country_code`, `country_name`, `value`, `unit`, `frequency` (M/Q), `source`
(INE/EUROSTAT/BCE), `series_code`, `status` y `last_updated`.

**API del servidor.**

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/api/catalogo` | Indicadores, países disponibles y transformaciones |
| GET | `/api/series?ids=…&paises=…&desde=…&hasta=…` | Series filtradas |
| GET | `/api/estado` | Semáforo de fuentes y progreso de la actualización |
| GET | `/api/resumen` | Último y penúltimo dato de cada serie |
| GET | `/api/previsiones` | Previsiones oficiales vigentes (la más reciente de cada organismo) |
| GET | `/api/calendario?desde=…` | Próximas publicaciones del INE y decisiones del BCE |
| POST | `/api/actualizar` | Lanza la descarga en segundo plano |
| POST | `/api/lab/ols`, `/api/lab/hp`, `/api/lab/ccf`, `/api/lab/dispersion` | Cálculos del laboratorio |
| POST | `/api/lab/exportar` | Excel de la regresión |
| GET | `/api/inv/resumen`, `/api/inv/taxonomia`, `/api/inv/fichas` | Centro de mando, taxonomía y fichas |
| GET | `/api/inv/buscar?q=…&organismos=…&tipos=…&naturalezas=…&categorias=…&etiquetas=…&ambitos=…&pilar=…&desde=…&hasta=…` | Resultados y recuentos por filtro |
| GET | `/api/inv/recurso?id=…`, `/api/inv/ficha?id=…` | Un recurso (con citas y vínculos) o una ficha (en tres columnas) |
| POST | `/api/inv/recurso`, `/api/inv/recurso/eliminar`, `/api/inv/vincular`, `/api/inv/desvincular` | Crear, editar, borrar y vincular recursos |
| POST | `/api/inv/ficha`, `/api/inv/ficha/anadir`, `/api/inv/ficha/quitar`, `/api/inv/ficha/eliminar` | Gestionar fichas |
| GET/POST | `/api/inv/obsidian`, `/api/inv/obsidian/ruta`, `/api/inv/obsidian/sincronizar` | Estado, carpeta y sincronización con Obsidian |

---

## Tests

```
python -m unittest -v
```

77 tests que no necesitan internet:

- **Exactitud econométrica:** la regresión reproduce los resultados publicados del **cuarteto de Anscombe**
  (coeficientes, errores, t, p, R², F, AIC y BIC); los p-valores coinciden con las **tablas de la t y la F**;
  el p-valor del ADF da 1 %, 5 % y 10 % en los **valores críticos de MacKinnon**; el ADF distingue un paseo
  aleatorio de ruido blanco; Newey-West sin retardos coincide con la fórmula cerrada de White; el filtro HP
  conserva las rectas y su ciclo suma cero.
- **Conectores:** con respuestas grabadas en el formato real de cada API (unión de tablas del IAPC,
  elección del código de la zona euro, fechas del INE, datos secretos o vacíos, series diarias del BCE).
- **Base de datos y preparación:** filtros, actualización de datos repetidos, semáforo, mezcla de frecuencias.
- **API de punta a punta:** sobre una base de datos temporal, incluidos los mensajes de error.
- **Excel y citas:** el .xlsx es válido y la cita APA tiene el formato correcto.
- **Centro de investigación:** buscador (tildes, prefijos, relevancia), filtros combinados y recuentos, citas APA y notas al pie, validación, vínculos, fichas, y la sincronización con Obsidian en los dos sentidos (propiedades, notas nuevas, renombrados y recursos borrados) sobre una bóveda temporal.
- **Catálogo:** identificadores únicos, campos obligatorios y tramos de Eurostat sin solapes (útil al añadir series).

---

## Actualización automática con GitHub Actions

Si se sube el proyecto a GitHub, hay dos automatizaciones preparadas en `.github/workflows/`:

- **`tests.yml`:** ejecuta los tests en cada cambio, en Linux y Windows.
- **`update_data.yml`:** cada día a las 07:30 UTC (y cuando se lance a mano desde la pestaña *Actions*)
  ejecuta los tests, descarga todos los datos y el ejemplo de laboratorio, y deja la base de datos, el CSV
  y el Excel como archivo descargable (*Artifacts*) durante 30 días. Si alguna fuente falla, la ejecución
  sale en rojo para avisar.

Los datos no se guardan en el repositorio (`data/processed/` está en `.gitignore`): se regeneran siempre desde las fuentes.

---

## Decisiones técnicas y limitaciones

- **Boletín de novedades:** al generar la web, `scripts/publicar_web.py` compara el último dato de cada indicador (España, zona euro y UE) con la web ya publicada y escribe `novedades.xml` (RSS) y `api/novedades.json`: una entrada al día como mucho, solo si hay datos nuevos. Los correos los envía gratis un programa de Google Apps Script ([`boletin/Codigo.gs`](boletin/Codigo.gs)) desde una cuenta de Gmail, con los suscriptores en una hoja de Google, doble confirmación y baja con un clic (límite de Google: 100 destinatarios al día). Cómo activarlo: [`boletin/COMO-ACTIVARLO.md`](boletin/COMO-ACTIVARLO.md); la URL de la aplicación va en `web/js/boletin.js` (`BOLETIN_URL`).

- **Enfoque descriptivo:** los gráficos y textos no califican los datos. Los colores solo indican «más alto / más bajo» (o «por encima / por debajo» de un objetivo oficial, como el 2 % del BCE), nunca «bueno / malo». Todos los ejes llevan título con su unidad (%, €, puntos básicos, índice 2015 = 100).
- **Verificación diaria:** después de descargar, `scripts/verificar_datos.py` compara el último valor de cada indicador con la fuente oficial; el resultado se ve en la página «Sobre el proyecto».

- **Solo biblioteca estándar.** El ordenador donde se desarrolló tiene *Smart App Control* de Windows,
  que bloquea las librerías con código compilado sin firmar (numpy, pandas, pyarrow…). Por eso no se usan
  pandas, DuckDB, Parquet, Streamlit ni statsmodels: hay equivalentes propios (SQLite, servidor `http.server`,
  álgebra y estadística programadas a mano y validadas con los tests).
- **El servidor es local** (`127.0.0.1`): no está pensado para publicarse en internet tal cual.
- **Bandas de la correlación cruzada:** usan la aproximación ±1,96/√n, que supone ruido blanco; con series
  muy persistentes conviene transformarlas antes (diferencias o tasas).
- **Precisión de las distribuciones:** p-valores con unas 10 cifras significativas, de sobra para contrastes.
- **Gráficos:** Plotly se carga desde jsDelivr, así que la web necesita conexión a internet para mostrar los gráficos
  (los datos ya descargados sí funcionan sin conexión).

---

## Uso de los datos y cómo citarlos

**Licencia:** los textos, gráficos, guías y datos elaborados se publican con licencia
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.es) (detalles en [`LICENCIA.md`](LICENCIA.md)).
Los datos pertenecen a sus organismos: el [INE](https://ine.es/dyngs/AYU/es/index.htm?cid=125) (CC BY 4.0),
[Eurostat](https://ec.europa.eu/eurostat/help/copyright-notice) y el
[BCE](https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html)
permiten reutilizarlos citando la fuente e indicando si se han transformado. Ninguno de ellos respalda este proyecto.

**Cita de la web (APA 7.ª):**

> Observatorio económico. (2026). *Observatorio económico: España frente a Europa* [Aplicación web].
> https://osquihdts-design.github.io/observatorio-economico/

**Herramientas para trabajos** (también en la web pública):

- **Guías** (`#/guias`): cómo analizar la inflación para un trabajo, cómo hacer una regresión para el TFG y qué indicador usar para cada pregunta.
- **Informe en PDF** (`#/informe`): portada, resumen, comentario automático de cada indicador, gráficos y bibliografía en APA;
  se guarda con «Imprimir → Guardar como PDF».
- **Insertar gráficos** (`#/insertar`): genera el código `<iframe>` de `embed.html?i=paro&p=ES,EA&d=2015&t=claro&prev=1`
  (indicador, países, desde, tema, previsiones), que se actualiza solo cada día.
- **Sobre el proyecto** (`#/sobre`): fuentes, metodología, licencia, cómo citar y registro de cambios.

La pestaña `Metadatos_Fuentes` del Excel exportado incluye la cita APA 7.ª de cada serie usada, por ejemplo:

> Instituto Nacional de Estadística. (2026). IPC general (variación anual): España (serie IPC290750)
> [Conjunto de datos]. Recuperado el 16 de noviembre de 2026, de https://www.ine.es/consul/serie.do?s=IPC290750
