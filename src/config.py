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

# Países comparables. «EA» es la zona euro.
PAISES = {
    "ES": "España",
    "DE": "Alemania",
    "FR": "Francia",
    "IT": "Italia",
    "PT": "Portugal",
    "EA": "Zona euro",
}

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
]

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
