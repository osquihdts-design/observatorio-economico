# Observatorio económico

Panel interactivo de datos económicos oficiales de **España frente a Europa**, con un
**laboratorio econométrico** pensado para trabajos de clase y el TFG.

- Datos reales del **INE**, **Eurostat** y el **Banco Central Europeo**, descargados de sus APIs públicas (sin claves ni registro).
- 23 indicadores: inflación, paro, PIB, vivienda, salarios, tipos de interés, hipotecas y dinero.
- Comparación con Alemania, Francia, Italia, Portugal y la zona euro.
- Regresiones, test de estacionariedad, filtro Hodrick-Prescott y correlaciones con retardos, con exportación a Excel y citas en formato APA.
- Hecho **solo con Python estándar**: no hay que instalar ninguna librería.

---

## Índice

1. [Inicio rápido](#inicio-rápido)
2. [Qué incluye](#qué-incluye)
3. [Fuentes y series](#fuentes-y-series)
4. [Laboratorio econométrico](#laboratorio-econométrico)
5. [Cómo está construido](#cómo-está-construido)
6. [Tests](#tests)
7. [Actualización automática con GitHub Actions](#actualización-automática-con-github-actions)
8. [Decisiones técnicas y limitaciones](#decisiones-técnicas-y-limitaciones)
9. [Uso de los datos y cómo citarlos](#uso-de-los-datos-y-cómo-citarlos)

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
| `python scripts/ejemplo_laboratorio.py` | Ejemplo completo de análisis con datos reales y Excel final. |
| `python -m unittest -v` | Ejecuta los 48 tests. |

---

## Qué incluye

### Barra lateral

- **Periodo:** 1, 3, 5 o 10 años, máximo o fechas a medida. Se aplica a todas las páginas.
- **Países:** España y zona euro siempre visibles; se pueden añadir Alemania, Francia, Italia y Portugal.
- **Estado de las fuentes:** semáforo por fuente (verde: al día · ámbar: falló algún indicador o datos de más de 24 h · rojo: falló la descarga) con la hora de la última sincronización.
- **Actualizar datos ahora**, con barra de progreso real.
- **Modo explicación académica:** muestra bajo cada gráfico la metodología, la fórmula y cómo interpretarlo.

### Páginas

| Página | Contenido |
|---|---|
| **Portada** | 5 tarjetas (inflación, paro, PIB, euríbor, vivienda) con último dato, variación con color contextual, minigráfico y referencia de la zona euro · divergencia España–zona euro en inflación y paro · tabla de todos los indicadores. |
| **Inflación y precios** | IPC general y subyacente (INE) frente al objetivo del 2 % del BCE · comparativa europea del IAPC · calculadora de poder adquisitivo entre dos fechas. |
| **Mercado laboral** | Paro general y juvenil por países · curva de Phillips empírica con una recta por subperiodo (antes de la COVID, COVID, ciclo restrictivo del BCE y bajadas de tipos). |
| **Política monetaria** | Corredor de tipos del BCE con el euríbor · transmisión del euríbor a las nuevas hipotecas en España y la zona euro · crecimiento de M3. |
| **Vivienda y salarios** | Precio de la vivienda (INE: general, nueva y segunda mano; Eurostat), base 2015 = 100 · índice de esfuerzo vivienda/salarios · comparativa europea. |
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

## Cómo está construido

```
servidor.py                 Servidor web y API (/api/...)
abrir-panel.bat             Doble clic para abrir en Windows
web/                        La web (HTML, CSS y JavaScript sin compilar; gráficos con Plotly)
  js/app.js                 Barra lateral, navegación y actualización
  js/paginas/*.js           Una página por archivo
  js/academico.js           Textos del modo explicación académica
src/
  config.py                 Catálogo de indicadores y códigos oficiales
  connectors/               INE, Eurostat y BCE → un mismo esquema de datos
  etl/storage.py            Base de datos SQLite (data/processed/observatorio.sqlite)
  etl/pipeline.py           Descarga en paralelo y registro del estado de cada fuente
  econometrics/             Matrices, distribuciones, series temporales, regresión, correlaciones
  reporting/                Creación de Excel (.xlsx) y citas APA
scripts/                    Actualizar datos y ejemplo de laboratorio
tests/                      48 tests automáticos
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
| POST | `/api/actualizar` | Lanza la descarga en segundo plano |
| POST | `/api/lab/ols`, `/api/lab/hp`, `/api/lab/ccf`, `/api/lab/dispersion` | Cálculos del laboratorio |
| POST | `/api/lab/exportar` | Excel de la regresión |

---

## Tests

```
python -m unittest -v
```

48 tests que no necesitan internet:

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

Los datos pertenecen a sus organismos (INE, Eurostat y Banco Central Europeo), que permiten reutilizarlos
citando la fuente; conviene revisar las condiciones de cada uno antes de publicarlos.

La pestaña `Metadatos_Fuentes` del Excel exportado incluye la cita APA 7.ª de cada serie usada, por ejemplo:

> Instituto Nacional de Estadística. (2026). IPC general (variación anual): España (serie IPC290750)
> [Conjunto de datos]. Recuperado el 16 de noviembre de 2026, de https://www.ine.es/consul/serie.do?s=IPC290750
