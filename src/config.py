"""Configuración: países, rutas y catálogo de indicadores con sus códigos oficiales.

Todos los códigos de serie se comprobaron en vivo contra las APIs el 16/11/2026.
Si una fuente cambia un código, solo hay que tocarlo aquí.
"""
from __future__ import annotations

from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CARPETA_DATOS = RAIZ / "data" / "processed"
BASE_DATOS = CARPETA_DATOS / "observatorio.sqlite"

FECHA_INICIO = "2000-01"  # se descarga todo desde el año 2000

# Países que se pueden comparar en la barra lateral. «EA» es la zona euro.
PAISES = {
    "ES": "España",
    "DE": "Alemania",
    "FR": "Francia",
    "IT": "Italia",
    "PT": "Portugal",
    "EA": "Zona euro",
}

# Los 27 países de la UE (códigos de Eurostat: Grecia es «EL»). De Eurostat se descargan
# todos, para el mapa de Europa y el laboratorio.
PAISES_UE = {
    "AT": "Austria", "BE": "Bélgica", "BG": "Bulgaria", "CY": "Chipre", "CZ": "Chequia", "DE": "Alemania",
    "DK": "Dinamarca", "EE": "Estonia", "EL": "Grecia", "ES": "España", "FI": "Finlandia", "FR": "Francia",
    "HR": "Croacia", "HU": "Hungría", "IE": "Irlanda", "IT": "Italia", "LT": "Lituania", "LU": "Luxemburgo",
    "LV": "Letonia", "MT": "Malta", "NL": "Países Bajos", "PL": "Polonia", "PT": "Portugal", "RO": "Rumanía",
    "SE": "Suecia", "SI": "Eslovenia", "SK": "Eslovaquia",
}

# Nombre de cualquier código que pueda aparecer en la base de datos.
NOMBRES = {**PAISES_UE, "EA": "Zona euro", "UE": "Unión Europea (27)"}

# Eurostat usa códigos distintos para la zona euro según la tabla y el año
# (en 2026 entró Bulgaria: EA20 → EA21). Se prueba en este orden y se usa el primero con datos.
ZONA_EURO_EUROSTAT = ["EA", "EA21", "EA20"]

# ----------------------------------------------------------------------------- Indicadores
# Campos comunes: id, nombre, unidad, frecuencia (M mensual, Q trimestral), fuente.

INE = [
    # Desde enero de 2026 el IPC usa la clasificación ECOICOP ver.2; estas series enlazan con la historia anterior.
    {"id": "ipc_general", "nombre": "IPC general (variación anual)", "unidad": "%", "frecuencia": "M", "serie": "IPC290750"},
    {"id": "ipc_general_indice", "nombre": "IPC general (índice)", "unidad": "índice", "frecuencia": "M", "serie": "IPC290751"},
    {"id": "ipc_subyacente", "nombre": "IPC subyacente (variación anual)", "unidad": "%", "frecuencia": "M", "serie": "IPC292510",
     "nota": "General sin alimentos no elaborados ni productos energéticos."},
    {"id": "epa_paro", "nombre": "Tasa de paro EPA", "unidad": "%", "frecuencia": "Q", "serie": "EPA423474",
     "nota": "Total nacional, ambos sexos, 16 y más años."},
    {"id": "epa_paro_jovenes", "nombre": "Tasa de paro EPA (menores de 25)", "unidad": "%", "frecuencia": "Q", "serie": "EPA452436"},
    # El INE no indica en la API el año base de estos índices: se etiquetan solo como «índice».
    {"id": "ipv_general", "nombre": "Precio de la vivienda: general (índice)", "unidad": "índice", "frecuencia": "Q", "serie": "IPV1209"},
    {"id": "ipv_nueva", "nombre": "Precio de la vivienda: nueva (índice)", "unidad": "índice", "frecuencia": "Q", "serie": "IPV1613"},
    {"id": "ipv_segunda_mano", "nombre": "Precio de la vivienda: segunda mano (índice)", "unidad": "índice", "frecuencia": "Q", "serie": "IPV1618"},
    {"id": "ipv_general_var", "nombre": "Precio de la vivienda: general (variación anual)", "unidad": "%", "frecuencia": "Q", "serie": "IPV1376"},
    {"id": "etcl_coste_salarial", "nombre": "Coste salarial por trabajador y mes", "unidad": "€", "frecuencia": "Q", "serie": "ETCL1527",
     "nota": "ETCL. Ambas jornadas, industria, construcción y servicios."},
]

# En 2026 Eurostat pasó el IAPC a la clasificación ECOICOP 2: los datos hasta 2025 están en
# prc_hicp_manr (dimensión «coicop») y desde 2026 en prc_hicp_minr (dimensión «coicop18»).
EUROSTAT = [
    {"id": "iapc_general", "nombre": "Inflación armonizada IAPC (variación anual)", "unidad": "%", "frecuencia": "M",
     "tramos": [
         {"tabla": "prc_hicp_manr", "filtros": {"unit": "RCH_A", "coicop": "CP00"}, "hasta": "2025-12"},
         {"tabla": "prc_hicp_minr", "filtros": {"unit": "RCH_A", "coicop18": "TOTAL"}, "desde": "2026-01"},
     ]},
    {"id": "iapc_subyacente", "nombre": "Inflación subyacente IAPC (variación anual)", "unidad": "%", "frecuencia": "M",
     "nota": "Sin energía ni alimentos (incluidos alcohol y tabaco).",
     "tramos": [
         {"tabla": "prc_hicp_manr", "filtros": {"unit": "RCH_A", "coicop": "TOT_X_NRG_FOOD"}, "hasta": "2025-12"},
         {"tabla": "prc_hicp_minr", "filtros": {"unit": "RCH_A", "coicop18": "TOT_X_NRG_FOOD"}, "desde": "2026-01"},
     ]},
    {"id": "paro", "nombre": "Tasa de paro (desestacionalizada)", "unidad": "%", "frecuencia": "M",
     "tramos": [{"tabla": "une_rt_m", "filtros": {"s_adj": "SA", "age": "TOTAL", "sex": "T", "unit": "PC_ACT"}}]},
    {"id": "paro_jovenes", "nombre": "Tasa de paro de menores de 25 (desestacionalizada)", "unidad": "%", "frecuencia": "M",
     "tramos": [{"tabla": "une_rt_m", "filtros": {"s_adj": "SA", "age": "Y_LT25", "sex": "T", "unit": "PC_ACT"}}]},
    {"id": "precio_vivienda_indice", "nombre": "Precio de la vivienda (índice)", "unidad": "índice 2015=100", "frecuencia": "Q",
     "tramos": [{"tabla": "prc_hpi_q", "filtros": {"purchase": "TOTAL", "unit": "I15_Q"}}]},
    {"id": "precio_vivienda_var", "nombre": "Precio de la vivienda (variación anual)", "unidad": "%", "frecuencia": "Q",
     "tramos": [{"tabla": "prc_hpi_q", "filtros": {"purchase": "TOTAL", "unit": "RCH_A"}}]},
    {"id": "pib_var", "nombre": "PIB real (variación interanual)", "unidad": "%", "frecuencia": "Q",
     "tramos": [{"tabla": "namq_10_gdp", "filtros": {"unit": "CLV_PCH_SM", "s_adj": "SCA", "na_item": "B1GQ"}}]},
    # Finanzas públicas
    {"id": "bono_10a", "nombre": "Rentabilidad del bono a 10 años", "unidad": "%", "frecuencia": "M",
     "nota": "Bono soberano a 10 años usado en el criterio de convergencia de Maastricht (media mensual).",
     "tramos": [{"tabla": "irt_lt_mcby_m", "filtros": {"int_rt": "MCBY"}}]},
    {"id": "deuda_publica", "nombre": "Deuda pública (% del PIB)", "unidad": "% del PIB", "frecuencia": "Q",
     "nota": "Deuda bruta consolidada de las administraciones públicas (definición de Maastricht).",
     "tramos": [{"tabla": "gov_10q_ggdebt", "filtros": {"unit": "PC_GDP", "sector": "S13", "na_item": "GD"}}]},
    {"id": "saldo_publico", "nombre": "Saldo público (% del PIB)", "unidad": "% del PIB", "frecuencia": "Q",
     "nota": "Capacidad (+) o necesidad (−) de financiación de las administraciones públicas: negativo = déficit. Corregido de estacionalidad y calendario.",
     "tramos": [{"tabla": "gov_10q_ggnfa", "filtros": {"unit": "PC_GDP", "sector": "S13", "na_item": "B9", "s_adj": "SCA"}}]},
    # Jóvenes, empleo y tecnología (anuales; la referencia europea es la UE-27, no la zona euro)
    {"id": "ninis", "nombre": "Jóvenes que ni estudian ni trabajan (15-29 años)", "unidad": "% de los jóvenes de 15 a 29 años", "frecuencia": "A",
     "nota": "Tasa NEET: no tienen empleo y no reciben educación ni formación (ni reglada ni no reglada).",
     "tramos": [{"tabla": "edat_lfse_20", "filtros": {"sex": "T", "age": "Y15-29", "training": "NO_FE_NO_NFE", "wstatus": "NEMP", "unit": "PC"}}]},
    {"id": "empleo_jovenes", "nombre": "Tasa de empleo de los jóvenes (15-24 años)", "unidad": "% de la población de 15 a 24 años", "frecuencia": "A",
     "nota": "Jóvenes con empleo sobre el total de jóvenes de esa edad (incluidos los que estudian).",
     "tramos": [{"tabla": "lfsi_emp_a", "filtros": {"sex": "T", "age": "Y15-24", "unit": "PC_POP", "indic_em": "EMP_LFS"}}]},
    {"id": "abandono_escolar", "nombre": "Abandono temprano de la educación (18-24 años)", "unidad": "% de los jóvenes de 18 a 24 años", "frecuencia": "A",
     "nota": "Jóvenes que solo tienen hasta la ESO y no siguen estudiando ni formándose.",
     "tramos": [{"tabla": "edat_lfse_14", "filtros": {"sex": "T", "age": "Y18-24", "wstatus": "POP", "unit": "PC"}}]},
    {"id": "titulados_superiores", "nombre": "Jóvenes con estudios superiores (25-34 años)", "unidad": "% de la población de 25 a 34 años", "frecuencia": "A",
     "nota": "Con formación profesional de grado superior, grado universitario, máster o doctorado (CINE 5-8).",
     "tramos": [{"tabla": "edat_lfse_03", "filtros": {"sex": "T", "age": "Y25-34", "isced11": "ED5-8", "unit": "PC"}}]},
    {"id": "competencias_digitales_jovenes", "nombre": "Jóvenes con competencias digitales básicas o superiores (16-24 años)",
     "unidad": "% de los jóvenes de 16 a 24 años", "frecuencia": "A",
     "tramos": [{"tabla": "isoc_sk_dskl_i21", "filtros": {"indic_is": "I_DSK2_BAB", "unit": "PC_IND", "ind_type": "Y16_24"}}]},
    {"id": "especialistas_tic", "nombre": "Especialistas en tecnologías de la información (TIC)", "unidad": "% del empleo total", "frecuencia": "A",
     "tramos": [{"tabla": "isoc_sks_itspt", "filtros": {"unit": "PC_EMP"}}]},
    {"id": "empresas_ia", "nombre": "Empresas que usan inteligencia artificial", "unidad": "% de las empresas de 10 o más empleados", "frecuencia": "A",
     "nota": "Usan al menos una tecnología de IA (análisis de textos, reconocimiento de voz o imágenes, aprendizaje automático, IA generativa…).",
     "tramos": [{"tabla": "isoc_eb_ai", "filtros": {"size_emp": "GE10", "unit": "PC_ENT", "indic_is": "E_AI_TANY", "nace_r2": "C10-S951_X_K"}}]},
    {"id": "ia_generativa_jovenes", "nombre": "Jóvenes que usan IA generativa (16-24 años)", "unidad": "% de los jóvenes de 16 a 24 años", "frecuencia": "A",
     "nota": "Han usado herramientas de IA generativa (ChatGPT, Gemini, Copilot…) en los últimos 3 meses. Se pregunta desde 2025.",
     "tramos": [{"tabla": "isoc_ai_iaiu", "filtros": {"ind_type": "Y16_24", "indic_is": "I_IUAI", "unit": "PC_IND"}}]},
    {"id": "ia_generativa_total", "nombre": "Población que usa IA generativa (16-74 años)", "unidad": "% de la población de 16 a 74 años", "frecuencia": "A",
     "nota": "Han usado herramientas de IA generativa en los últimos 3 meses. Se pregunta desde 2025.",
     "tramos": [{"tabla": "isoc_ai_iaiu", "filtros": {"ind_type": "IND_TOTAL", "indic_is": "I_IUAI", "unit": "PC_IND"}}]},
    {"id": "ia_generativa_trabajo", "nombre": "Jóvenes que usan IA generativa para trabajar (16-24 años)", "unidad": "% de los jóvenes de 16 a 24 años", "frecuencia": "A",
     "nota": "Han usado IA generativa con fines profesionales en los últimos 3 meses. Se pregunta desde 2025.",
     "tramos": [{"tabla": "isoc_ai_iaiu", "filtros": {"ind_type": "Y16_24", "indic_is": "I_IUAIWP", "unit": "PC_IND"}}]},
]

# La Unión Europea (27) como referencia para los indicadores anuales que no tienen dato de la zona euro.
UE_EUROSTAT = "EU27_2020"

# BCE: los tipos oficiales son diarios (D); se guarda el último valor de cada mes.
BCE = [
    {"id": "bce_deposito", "nombre": "Tipo BCE: facilidad de depósito", "unidad": "%", "frecuencia": "M",
     "series": {"EA": "FM/D.U2.EUR.4F.KR.DFR.LEV"}},
    {"id": "bce_refinanciacion", "nombre": "Tipo BCE: operaciones principales de financiación", "unidad": "%", "frecuencia": "M",
     "nota": "Tipo mínimo de puja hasta octubre de 2008 y tipo fijo desde entonces (serie continua MRR_RT).",
     "series": {"EA": "FM/D.U2.EUR.4F.KR.MRR_RT.LEV"}},
    {"id": "bce_marginal", "nombre": "Tipo BCE: facilidad marginal de crédito", "unidad": "%", "frecuencia": "M",
     "series": {"EA": "FM/D.U2.EUR.4F.KR.MLFR.LEV"}},
    {"id": "euribor_12m", "nombre": "Euríbor a 12 meses (media mensual)", "unidad": "%", "frecuencia": "M",
     "series": {"EA": "FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA"}},
    {"id": "tipo_hipotecas", "nombre": "Tipo de interés de nuevas hipotecas a hogares", "unidad": "%", "frecuencia": "M",
     "nota": "Coste de los nuevos préstamos para compra de vivienda (estadística MIR del BCE).",
     "series": {"ES": "MIR/M.ES.B.A2C.AM.R.A.2250.EUR.N", "EA": "MIR/M.U2.B.A2C.AM.R.A.2250.EUR.N"}},
    {"id": "m3_var", "nombre": "Agregado monetario M3 (variación anual)", "unidad": "%", "frecuencia": "M",
     "series": {"EA": "BSI/M.U2.Y.V.M30.X.I.U2.2300.Z01.A"}},
]


def todos_los_indicadores() -> list[dict]:
    """Catálogo completo, con la fuente añadida a cada indicador."""
    return (
        [{**i, "fuente": "INE"} for i in INE]
        + [{**i, "fuente": "EUROSTAT"} for i in EUROSTAT]
        + [{**i, "fuente": "BCE"} for i in BCE]
    )
