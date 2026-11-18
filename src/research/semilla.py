"""Ejemplos con los que arranca el centro de investigación.

Los datos oficiales están enlazados a las series del panel (su valor se actualiza solo).
Las proyecciones del BCE y del Banco de España se copiaron de sus publicaciones oficiales
(consultadas el 18 de noviembre de 2026). Las predicciones «propias» son ejemplos ilustrativos
para enseñar cómo funciona la herramienta: no son previsiones reales ni recomendaciones de inversión.
"""
from __future__ import annotations

from . import almacen

CONSULTA = "2026-11-18"

RECURSOS = [
    # ------------------------------------------------------------------ Fuentes secundarias: datos oficiales
    dict(id="ipc-espana", tipo="dato", organismo="INE", titulo="IPC general de España (variación anual)",
         resumen="Tasa de variación anual del Índice de Precios de Consumo. Es la medida oficial de la inflación en España.",
         contenido="Serie mensual del INE (base 2021). El panel la descarga de la API Tempus3 y este recurso muestra "
                   "siempre el último dato publicado.\n\nPara comparar con otros países de la zona euro, usa el IAPC (Eurostat), "
                   "que sigue una metodología armonizada.",
         url="https://www.ine.es/consul/serie.do?s=IPC290750", indicador="ipc_general", pais="ES", fecha_consulta=CONSULTA,
         notas_extraccion="API Tempus3 del INE (det=2&tip=AM). Dato provisional el mes de publicación; el INE puede revisarlo.",
         categorias=["inflacion"], etiquetas=["ipc", "precios", "espana"]),
    dict(id="paro-espana", tipo="dato", organismo="EUROSTAT", titulo="Tasa de paro de España (desestacionalizada)",
         resumen="Tasa de paro mensual armonizada de Eurostat, comparable entre países de la UE.",
         contenido="Eurostat estima el paro mensual a partir de la EPA y de los registros. No coincide exactamente con la "
                   "EPA trimestral del INE, pero permite comparar España con el resto de Europa.",
         url="https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table", indicador="paro", pais="ES",
         fecha_consulta=CONSULTA, notas_extraccion="Tabla une_rt_m, s_adj=SA, age=TOTAL, sex=T, unit=PC_ACT.",
         categorias=["empleo"], etiquetas=["paro", "mercado-laboral", "espana"]),
    dict(id="euribor-12m", tipo="dato", organismo="BCE", titulo="Euríbor a 12 meses (media mensual)",
         resumen="Tipo de interés al que los bancos se prestan dinero a un año. Es la referencia de la mayoría de hipotecas variables en España.",
         contenido="El panel toma la serie diaria del BCE y se queda con el valor de cada mes.",
         url="https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA", indicador="euribor_12m", pais="EA",
         fecha_consulta=CONSULTA, notas_extraccion="ECB Data Portal, flujo FM, CSV.",
         categorias=["tipos", "monetaria", "inmobiliario"], etiquetas=["euribor", "hipotecas", "tipos-de-interes"]),
    dict(id="deuda-publica-espana", tipo="dato", organismo="EUROSTAT", titulo="Deuda pública de España (% del PIB)",
         resumen="Deuda bruta de las Administraciones Públicas según el Protocolo de Déficit Excesivo (criterio de Maastricht).",
         url="https://ec.europa.eu/eurostat/databrowser/view/gov_10q_ggdebt/default/table", indicador="deuda_publica", pais="ES",
         fecha_consulta=CONSULTA, notas_extraccion="Tabla gov_10q_ggdebt, sector S13, na_item GD, unit PC_GDP. Trimestral.",
         categorias=["fiscal", "sistemico"], etiquetas=["deuda", "maastricht", "espana"]),
    dict(id="bono-10-espana", tipo="dato", organismo="EUROSTAT", titulo="Rentabilidad del bono español a 10 años",
         resumen="Rendimiento de la deuda pública a 10 años usado para el criterio de convergencia de Maastricht.",
         url="https://ec.europa.eu/eurostat/databrowser/view/irt_lt_mcby_m/default/table", indicador="bono_10a", pais="ES",
         fecha_consulta=CONSULTA, notas_extraccion="Tabla irt_lt_mcby_m (media mensual).",
         categorias=["renta_fija", "tipos"], etiquetas=["bono", "prima-de-riesgo", "espana"]),

    # ------------------------------------------------------------------ Fuentes secundarias: proyecciones oficiales
    dict(id="bce-proyecciones-sep-2026", tipo="proyeccion", organismo="BCE",
         titulo="Proyecciones macroeconómicas de los expertos del BCE para la zona del euro (septiembre de 2026)",
         autores="Banco Central Europeo", fecha="2026-09-10", url="https://www.ecb.europa.eu/press/projections/html/ecb.projections202609_ecbstaff~8e340fc69d.en.html",
         fecha_consulta=CONSULTA, dato_valor=3.0, dato_unidad="%", dato_periodo="IAPC 2026, escenario base",
         horizonte="2028", estado="activo",
         resumen="El escenario base sitúa la inflación de la zona euro en el 3,0 % en 2026, el 2,5 % en 2027 y el 2,1 % en 2028, "
                 "con un crecimiento del PIB del 0,9 %, 1,4 % y 1,5 %. El repunte se debe al encarecimiento de la energía por el conflicto en Oriente Próximo.",
         contenido="""## Escenario base (zona del euro)

| Variable | 2026 | 2027 | 2028 |
|---|---|---|---|
| Inflación IAPC (%) | 3,0 | 2,5 | 2,1 |
| IAPC sin energía ni alimentos (%) | 2,5 | 2,6 | 2,3 |
| PIB real (%) | 0,9 | 1,4 | 1,5 |
| Tasa de paro (%) | 6,2 | 6,1 | 5,9 |

## Supuestos técnicos (de mercado)

| Supuesto | 2026 | 2027 | 2028 |
|---|---|---|---|
| Euríbor a 3 meses (%) | 2,4 | 3,0 | 3,0 |
| Bono a 10 años (%) | 3,5 | 3,8 | 4,0 |
| Brent (dólares por barril) | 89,5 | 78,0 | 73,6 |

Fecha de corte de los supuestos técnicos: 19 de agosto de 2026. El BCE publica además escenarios adverso y severo
(en el severo, la inflación llegaría al 5,4 % en 2027).""",
         notas_extraccion="Tablas del documento en inglés; traducidas y redondeadas como en el original. Los tipos y el petróleo son supuestos (expectativas de mercado), no previsiones del BCE.",
         categorias=["inflacion", "pib", "empleo", "tipos", "monetaria", "materias_primas", "geopolitica"],
         etiquetas=["proyecciones", "zona-euro", "bce", "petroleo"]),
    dict(id="bde-proyecciones-oct-2026", tipo="proyeccion", organismo="BDE",
         titulo="Proyecciones macroeconómicas e informe trimestral de la economía española (tercer trimestre de 2026)",
         autores="Banco de España", fecha="2026-10-09",
         url="https://www.bde.es/wbe/en/publicaciones/analisis-economico-investigacion/proyecciones-macro-informe-trimestral/proyecciones-e-informe-trimestral-de-la-economia-espanola-tercer-trimestre-2026.html",
         fecha_consulta=CONSULTA, dato_valor=2.6, dato_unidad="%", dato_periodo="PIB de España en 2026", horizonte="2027",
         resumen="El Banco de España prevé que el PIB crezca un 2,6 % en 2026 y un 2,2 % en 2027, con una inflación (IAPC) del 3,9 % y 3,7 % y un paro del 10,0 % y 9,7 %.",
         contenido="""## Proyecciones para España

| Variable | 2026 | 2027 |
|---|---|---|
| PIB real (%) | 2,6 | 2,2 |
| Inflación IAPC (%) | 3,9 | 3,7 |
| IAPC sin energía ni alimentos (%) | 3,4 | 3,5 |
| Tasa de paro (% de la población activa, media anual) | 10,0 | 9,7 |

Fecha de cierre de las proyecciones: 2 de octubre de 2026. España crecería bastante más que la zona euro,
pero con una inflación más alta: el diferencial de precios respecto al conjunto del área se mantiene.""",
         notas_extraccion="Tabla del informe trimestral (versión en inglés de la web del Banco de España).",
         categorias=["pib", "inflacion", "empleo"], etiquetas=["proyecciones", "espana", "banco-de-espana"]),

    # ------------------------------------------------------------------ Producción propia: marco teórico
    dict(id="marco-dcf", tipo="teoria", organismo="PROPIO", titulo="Marco teórico: valoración por descuento de flujos de caja (DCF)",
         fecha="2026-11-01", estado="activo",
         resumen="El valor de una empresa es el valor actual de los flujos de caja libres que generará, descontados al coste medio ponderado del capital (WACC).",
         contenido="""## Idea central

Una empresa vale lo que vale el dinero que generará en el futuro, traído a hoy:

    Valor empresa = Σ FCF_t / (1 + WACC)^t  +  VT / (1 + WACC)^N

- **FCF** (flujo de caja libre) = EBIT × (1 − t) + amortizaciones − inversión (CAPEX) − aumento del fondo de maniobra.
- **WACC** = E/(D+E) · Ke + D/(D+E) · Kd · (1 − t).
- **Ke** con el CAPM: Ke = rf + β · (prima de mercado). El tipo sin riesgo (rf) suele ser el **bono a 10 años**.
- **Valor terminal** (Gordon): VT = FCF_{N+1} / (WACC − g), con g ≤ crecimiento nominal a largo plazo.

## Enlace con el panel

Si sube el bono a 10 años, sube rf → sube Ke y el WACC → baja el valor. Las proyecciones del BCE suponen un bono
al 3,5 %–4,0 % hasta 2028: es un buen punto de partida para el tipo sin riesgo.

## Errores frecuentes

1. Usar un g mayor que el crecimiento nominal de la economía.
2. Mezclar flujos nominales con tasas reales.
3. Sensibilidad: un punto de WACC puede cambiar el valor un 20–30 %. Haz siempre una tabla de sensibilidad WACC × g.

## Referencias

- Damodaran, A. (2012). *Investment valuation: Tools and techniques for determining the value of any asset* (3.ª ed.). Wiley.
- Koller, T., Goedhart, M. y Wessels, D. (2020). *Valuation: Measuring and managing the value of companies* (7.ª ed.). Wiley.""",
         categorias=["valoracion", "ratios", "renta_variable"], etiquetas=["dcf", "wacc", "capm", "valoracion"]),
    dict(id="marco-regla-taylor", tipo="teoria", organismo="PROPIO", titulo="Marco teórico: la regla de Taylor",
         fecha="2026-11-03",
         resumen="Regla sencilla que relaciona el tipo de interés del banco central con la inflación y la brecha de producción. Sirve para juzgar si la política monetaria es restrictiva o expansiva.",
         contenido="""## Fórmula

    i = r* + π + 0,5 · (π − π*) + 0,5 · (y − y*)

- **i**: tipo de interés nominal recomendado.
- **r***: tipo de interés real neutral (difícil de medir; en la zona euro suele estimarse entre 0 % y 1 %).
- **π**: inflación; **π***: objetivo (2 % en el BCE).
- **y − y***: brecha de producción (puede aproximarse con el ciclo del filtro HP del laboratorio).

## Cómo usarla con el panel

Con la inflación de la zona euro (IAPC) y el tipo de la facilidad de depósito del BCE se puede comparar el tipo
efectivo con el que «recomendaría» la regla. Si el tipo real está por debajo, la política es más expansiva que la regla.

## Referencia

- Taylor, J. B. (1993). Discretion versus policy rules in practice. *Carnegie-Rochester Conference Series on Public Policy, 39*, 195–214.""",
         categorias=["monetaria", "tipos", "inflacion"], etiquetas=["regla-de-taylor", "bce", "tipos-de-interes"]),
    dict(id="marco-curva-phillips", tipo="teoria", organismo="PROPIO", titulo="Marco teórico: la curva de Phillips",
         fecha="2026-10-20",
         resumen="Relación inversa entre paro e inflación a corto plazo. La página «Mercado laboral» del panel la estima para España por subperiodos.",
         contenido="""## Versión moderna (con expectativas)

    π_t = π^e_t − β · (u_t − u*) + ε_t

La relación se ha «aplanado» en muchas economías desde los años noventa (expectativas ancladas por los bancos centrales).
En 2021–2023 los choques de oferta (energía) hicieron subir la inflación sin que bajara mucho el paro.

## Referencia

- Phillips, A. W. (1958). The relation between unemployment and the rate of change of money wage rates in the United Kingdom, 1861–1957. *Economica, 25*(100), 283–299.""",
         categorias=["inflacion", "empleo"], etiquetas=["curva-de-phillips", "paro", "inflacion"]),

    # ------------------------------------------------------------------ Producción propia: análisis empírico
    dict(id="transmision-euribor-hipotecas", tipo="empirico", organismo="PROPIO", estado="borrador", fecha="2026-11-10",
         titulo="Análisis empírico: transmisión del euríbor a las nuevas hipotecas en España",
         resumen="Borrador de análisis: ¿cuánto y con qué retraso se traslada el euríbor al tipo de las nuevas hipotecas? Datos del BCE enlazados desde el panel.",
         contenido="""## Pregunta

¿Cuántos meses tarda en notarse un cambio del euríbor en el tipo de las nuevas hipotecas, y qué parte se traslada?

## Método (laboratorio del panel)

1. Variables: tipo de nuevas hipotecas a hogares (España) y euríbor a 12 meses, en primeras diferencias.
2. Correlación cruzada (pestaña «Correlación con retardos») para elegir el retardo.
3. Regresión MCO con errores Newey-West: Δhipotecas_t = α + Σ β_k · Δeuríbor_{t−k} + ε_t.
4. Traslado acumulado = Σ β_k.

## Estado

Borrador: pendiente de ejecutar la regresión y anotar los resultados. Exporta el Excel del laboratorio y pega aquí la tabla.""",
         indicador="tipo_hipotecas", pais="ES",
         categorias=["tipos", "inmobiliario", "banca"], etiquetas=["euribor", "hipotecas", "transmision-monetaria"]),

    # ------------------------------------------------------------------ Producción propia: predicciones
    dict(id="prediccion-energia-2028", tipo="prediccion", organismo="PROPIO", estado="activo", fecha="2026-11-15",
         titulo="Predicción propia: márgenes del sector eléctrico español ante la bajada del petróleo (2026–2028)",
         horizonte="2028-12", confianza=2, dato_valor=73.6, dato_unidad="$/barril", dato_periodo="Brent supuesto por el BCE para 2028",
         resumen="EJEMPLO ILUSTRATIVO (no es una recomendación de inversión). Si el Brent baja de 89,5 a 73,6 dólares como suponen los mercados, "
                 "la inflación energética se moderaría y la presión regulatoria sobre las eléctricas también.",
         contenido="""> **Ejemplo ilustrativo** para mostrar cómo se registra una predicción propia. No es una previsión real ni una recomendación de inversión.

## Tesis

1. **Supuesto de partida (BCE, septiembre de 2026):** Brent de 89,5 $ (2026) → 78,0 $ (2027) → 73,6 $ (2028).
2. Menos inflación energética → menos presión política para gravámenes extraordinarios al sector.
3. Mayor peso de las renovables en el mix → el precio mayorista depende menos del gas a medio plazo.

## Qué vigilar (indicadores de seguimiento)

- IPC de España (componente energético) en el panel.
- Bono a 10 años: si sube, encarece la financiación de las inversiones en redes (ver marco DCF).
- Escenario severo del BCE (inflación del 5,4 % en 2027): invalidaría la tesis.

## Criterio de acierto

La predicción se marcará como «cumplida» si en 2028 la inflación energética en España es inferior a la de 2026
y el tipo del bono a 10 años no supera el 4,5 %.""",
         categorias=["energia", "materias_primas", "geopolitica", "valoracion"], etiquetas=["energia", "petroleo", "utilities", "escenarios"]),
    dict(id="prediccion-euribor-2027", tipo="prediccion", organismo="PROPIO", estado="activo", fecha="2026-11-16",
         titulo="Predicción propia: el euríbor a 12 meses en diciembre de 2027",
         horizonte="2027-12", confianza=3, dato_valor=3.1, dato_unidad="%", dato_periodo="estimación propia, diciembre de 2027",
         resumen="EJEMPLO ILUSTRATIVO. Partiendo de los supuestos de mercado del BCE (euríbor a 3 meses del 3,0 % en 2027) y de una "
                 "prima histórica del plazo a 12 meses, se estima un euríbor a 12 meses en torno al 3,1 %.",
         contenido="""> **Ejemplo ilustrativo**: muestra cómo enlazar una predicción con su base teórica y sus datos.

## Razonamiento

1. Los supuestos técnicos del BCE (septiembre de 2026) sitúan el euríbor a 3 meses en el 3,0 % en 2027.
2. El euríbor a 12 meses suele cotizar unas décimas por encima del de 3 meses cuando se esperan subidas.
3. La regla de Taylor, con una inflación del 2,5 % en 2027, apunta a un tipo neutral‑restrictivo.

## Escenarios

| Escenario | Euríbor 12m dic‑2027 |
|---|---|
| Base | 3,1 % |
| Inflación persistente (escenario adverso del BCE) | 3,6 % |
| Desaceleración fuerte | 2,4 % |

Comparar con el dato real del panel cuando llegue diciembre de 2027.""",
         indicador="euribor_12m", pais="EA",
         categorias=["tipos", "monetaria"], etiquetas=["euribor", "escenarios", "tipos-de-interes"]),
]

VINCULOS = [
    ("prediccion-energia-2028", "bce-proyecciones-sep-2026", "usa_datos"),
    ("prediccion-energia-2028", "marco-dcf", "se_basa_en"),
    ("prediccion-energia-2028", "ipc-espana", "usa_datos"),
    ("prediccion-euribor-2027", "bce-proyecciones-sep-2026", "usa_datos"),
    ("prediccion-euribor-2027", "euribor-12m", "usa_datos"),
    ("prediccion-euribor-2027", "marco-regla-taylor", "se_basa_en"),
    ("transmision-euribor-hipotecas", "euribor-12m", "usa_datos"),
    ("marco-dcf", "bono-10-espana", "usa_datos"),
    ("marco-curva-phillips", "paro-espana", "usa_datos"),
    ("marco-curva-phillips", "ipc-espana", "usa_datos"),
    ("bde-proyecciones-oct-2026", "bce-proyecciones-sep-2026", "complementa"),
]

FICHAS = [
    dict(id="inflacion-tipos-espana", titulo="Inflación y tipos de interés en España, 2026–2028",
         pregunta="¿Bajará la inflación española al 2 % antes de 2028 y qué implica para el euríbor y las hipotecas?",
         descripcion="Reúne los datos oficiales de precios y tipos, la teoría sobre política monetaria y las proyecciones del BCE, del Banco de España y propias.",
         recursos=["ipc-espana", "euribor-12m", "paro-espana", "marco-regla-taylor", "marco-curva-phillips",
                   "transmision-euribor-hipotecas", "bce-proyecciones-sep-2026", "bde-proyecciones-oct-2026", "prediccion-euribor-2027"]),
    dict(id="energia-petroleo", titulo="Sector energético y shock del petróleo",
         pregunta="¿Cómo afecta la caída prevista del petróleo a la inflación y a la valoración de las eléctricas?",
         descripcion="Cruza los supuestos de petróleo del BCE con el IPC y un marco de valoración DCF.",
         recursos=["ipc-espana", "bono-10-espana", "marco-dcf", "bce-proyecciones-sep-2026", "prediccion-energia-2028"]),
    dict(id="sostenibilidad-deuda", titulo="Sostenibilidad de la deuda pública española",
         pregunta="¿Puede España reducir su deuda si el bono a 10 años se acerca al 4 %?",
         descripcion="Ficha en construcción: deuda, coste de financiación y crecimiento previsto.",
         recursos=["deuda-publica-espana", "bono-10-espana", "bde-proyecciones-oct-2026"]),
]


def cargar(con) -> None:
    for r in RECURSOS:
        almacen.guardar_recurso(con, dict(r))
    for v in VINCULOS:
        almacen.vincular(con, *v)
    for f in FICHAS:
        almacen.guardar_ficha(con, dict(f))
