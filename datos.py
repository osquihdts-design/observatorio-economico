"""Descarga de datos económicos oficiales: Eurostat y Banco Central Europeo (BCE).

Solo usa Python estándar (sin librerías externas). Cada serie se devuelve como un
diccionario  {nombre del país: [[fecha, valor], ...]}  con fechas «AAAA-MM-DD».

Los datos se guardan en la carpeta .cache durante 12 horas: así la web va rápida
y, si no hay internet, se usan los últimos datos descargados.
"""
from __future__ import annotations

import csv
import io
import json
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

EUROSTAT = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{}"
BCE = "https://data-api.ecb.europa.eu/service/data/{}"
DESDE = "2000-01"  # se descarga todo desde el año 2000; luego se filtra en la web
CACHE = Path(__file__).parent / ".cache"
CADUCIDAD = 12 * 3600  # segundos

PAISES = {
    "ES": "España",
    "DE": "Alemania",
    "FR": "Francia",
    "IT": "Italia",
    "PT": "Portugal",
    "NL": "Países Bajos",
    "BE": "Bélgica",
    "IE": "Irlanda",
    "EL": "Grecia",
    "AT": "Austria",
    "PL": "Polonia",
    "SE": "Suecia",
    "EU27_2020": "Unión Europea",
}

Serie = dict[str, list[list]]


# ----------------------------------------------------------------------------- Descargas

def _descargar(url: str, params: list[tuple[str, str]]) -> bytes:
    completa = url + "?" + urllib.parse.urlencode(params)
    peticion = urllib.request.Request(completa, headers={"User-Agent": "panel-economico/1.0"})
    with urllib.request.urlopen(peticion, timeout=90) as r:
        return r.read()


def _fecha(periodo: str) -> str:
    """'2026-10' → '2026-10-01';  '2026-Q3' → '2026-07-01' (primer mes del trimestre)."""
    if "-Q" in periodo:
        anio, q = periodo.split("-Q")
        return f"{anio}-{(int(q) - 1) * 3 + 1:02d}-01"
    return periodo + "-01" if len(periodo) == 7 else periodo


def eurostat(tabla: str, filtros: dict[str, str], desde: str = DESDE) -> Serie:
    """Descarga una tabla de Eurostat (formato JSON-stat) para todos los países."""
    params = [("format", "JSON"), ("lang", "EN"), ("sinceTimePeriod", desde)]
    params += list(filtros.items()) + [("geo", p) for p in PAISES]
    j = json.loads(_descargar(EUROSTAT.format(tabla), params))

    # Los valores vienen en una lista «aplanada»: con el tamaño de cada dimensión se
    # calcula a qué país y a qué fecha corresponde cada posición.
    dims, tamanos = j["id"], j["size"]
    etiquetas = {}
    for d in dims:
        indice = j["dimension"][d]["category"]["index"]
        etiquetas[d] = sorted(indice, key=indice.get)
    pasos = [1] * len(dims)
    for i in range(len(dims) - 2, -1, -1):
        pasos[i] = pasos[i + 1] * tamanos[i + 1]
    i_geo, i_time = dims.index("geo"), dims.index("time")

    serie: Serie = {}
    for clave, valor in (j.get("value") or {}).items():
        n = int(clave)
        geo = etiquetas["geo"][(n // pasos[i_geo]) % tamanos[i_geo]]
        tiempo = etiquetas["time"][(n // pasos[i_time]) % tamanos[i_time]]
        serie.setdefault(PAISES.get(geo, geo), []).append([_fecha(tiempo), float(valor)])
    for puntos in serie.values():
        puntos.sort()
    return serie


def bce(clave: str, nombre: str, desde: str = DESDE, mensual: bool = False) -> Serie:
    """Descarga una serie del BCE. Con mensual=True se queda con el último dato de cada mes."""
    texto = _descargar(BCE.format(clave), [("format", "csvdata"), ("startPeriod", desde)]).decode("utf-8")
    puntos = {}
    for fila in csv.DictReader(io.StringIO(texto)):
        if not fila.get("OBS_VALUE"):
            continue
        fecha = _fecha(fila["TIME_PERIOD"])
        if mensual:
            fecha = fecha[:7] + "-01"  # al ir en orden, queda el último valor del mes
        puntos[fecha] = float(fila["OBS_VALUE"])
    return {nombre: sorted([f, v] for f, v in puntos.items())}


# ----------------------------------------------------------------------------- Indicadores

def _inflacion() -> Serie:
    # En 2026 Eurostat cambió la clasificación de precios y movió los datos a otra
    # tabla: se junta la histórica (hasta 2025) con la nueva (desde 2026).
    vieja = eurostat("prc_hicp_manr", {"unit": "RCH_A", "coicop": "CP00"})
    nueva = eurostat("prc_hicp_minr", {"unit": "RCH_A", "coicop18": "TOTAL"}, desde="2026-01")
    juntas: Serie = {}
    for pais in set(vieja) | set(nueva):
        puntos = {f: v for f, v in vieja.get(pais, []) if f < "2026-01-01"}
        puntos.update({f: v for f, v in nueva.get(pais, [])})
        juntas[pais] = sorted([f, v] for f, v in puntos.items())
    return juntas


INDICADORES = {
    "inflacion": {
        "nombre": "Inflación",
        "unidad": "% anual",
        "frecuencia": "mensual",
        "explicacion": "Cuánto han subido los precios respecto al mismo mes del año anterior (IPCA, el índice armonizado que permite comparar países). "
                       "El objetivo del Banco Central Europeo es que esté cerca del 2 %.",
        "fuente": "Eurostat · IPCA (prc_hicp_manr y prc_hicp_minr)",
        "enlace": "https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table",
        "descargar": _inflacion,
    },
    "paro": {
        "nombre": "Paro",
        "unidad": "% de la población activa",
        "frecuencia": "mensual",
        "explicacion": "Porcentaje de personas que quieren trabajar y no encuentran empleo. Está desestacionalizado: "
                       "se quita el efecto de temporadas como el verano o la Navidad para ver la tendencia real.",
        "fuente": "Eurostat · une_rt_m",
        "enlace": "https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table",
        "descargar": lambda: eurostat("une_rt_m", {"s_adj": "SA", "age": "TOTAL", "sex": "T", "unit": "PC_ACT"}),
    },
    "paro_jovenes": {
        "nombre": "Paro juvenil",
        "unidad": "% de activos menores de 25 años",
        "frecuencia": "mensual",
        "explicacion": "Tasa de paro de los menores de 25 años. Suele ser mucho más alta y sensible a las crisis que el paro general.",
        "fuente": "Eurostat · une_rt_m (menores de 25)",
        "enlace": "https://ec.europa.eu/eurostat/databrowser/view/une_rt_m/default/table",
        "descargar": lambda: eurostat("une_rt_m", {"s_adj": "SA", "age": "Y_LT25", "sex": "T", "unit": "PC_ACT"}),
    },
    "pib": {
        "nombre": "Crecimiento del PIB",
        "unidad": "% interanual",
        "frecuencia": "trimestral",
        "explicacion": "Cuánto ha crecido la economía (PIB real, sin el efecto de los precios) respecto al mismo trimestre del año anterior. "
                       "Valores negativos significan que la economía se ha reducido.",
        "fuente": "Eurostat · namq_10_gdp",
        "enlace": "https://ec.europa.eu/eurostat/databrowser/view/namq_10_gdp/default/table",
        "descargar": lambda: eurostat("namq_10_gdp", {"unit": "CLV_PCH_SM", "s_adj": "SCA", "na_item": "B1GQ"}, desde="2000-Q1"),
    },
    "vivienda": {
        "nombre": "Precio de la vivienda",
        "unidad": "% anual",
        "frecuencia": "trimestral",
        "explicacion": "Cuánto ha subido el precio de la vivienda (nueva y usada) respecto al mismo trimestre del año anterior.",
        "fuente": "Eurostat · prc_hpi_q",
        "enlace": "https://ec.europa.eu/eurostat/databrowser/view/prc_hpi_q/default/table",
        "descargar": lambda: eurostat("prc_hpi_q", {"purchase": "TOTAL", "unit": "RCH_A"}, desde="2000-Q1"),
    },
    "euribor": {
        "nombre": "Euríbor 12 meses",
        "unidad": "%",
        "frecuencia": "mensual",
        "zona": True,
        "explicacion": "El tipo al que se prestan dinero los bancos europeos a un año. Es la referencia de la mayoría de hipotecas variables en España: "
                       "si sube, sube la cuota de la hipoteca.",
        "fuente": "Banco Central Europeo · FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
        "enlace": "https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA",
        "descargar": lambda: bce("FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA", "Euríbor 12 meses"),
    },
    "tipo_bce": {
        "nombre": "Tipo del BCE",
        "unidad": "%",
        "frecuencia": "mensual",
        "zona": True,
        "explicacion": "Tipo de interés de la facilidad de depósito: lo que el BCE paga a los bancos por dejarle dinero. "
                       "Es la principal herramienta del BCE para frenar o animar la economía.",
        "fuente": "Banco Central Europeo · FM.D.U2.EUR.4F.KR.DFR.LEV",
        "enlace": "https://data.ecb.europa.eu/data/datasets/FM/FM.D.U2.EUR.4F.KR.DFR.LEV",
        "descargar": lambda: bce("FM/D.U2.EUR.4F.KR.DFR.LEV", "Tipo del BCE", mensual=True),
    },
}


# ----------------------------------------------------------------------------- Caché

_candados = {clave: threading.Lock() for clave in INDICADORES}


def obtener(clave: str) -> tuple[Serie, float, bool]:
    """Devuelve (serie, hora de descarga, antiguo).

    antiguo=True significa que no se pudo actualizar (p. ej. sin internet) y se
    muestran los últimos datos guardados.
    """
    archivo = CACHE / f"{clave}.json"
    with _candados[clave]:
        guardado = json.loads(archivo.read_text("utf-8")) if archivo.exists() else None
        if guardado and time.time() - guardado["hora"] < CADUCIDAD:
            return guardado["serie"], guardado["hora"], False
        try:
            serie = INDICADORES[clave]["descargar"]()
        except Exception:
            if guardado:
                return guardado["serie"], guardado["hora"], True
            raise
        CACHE.mkdir(exist_ok=True)
        hora = time.time()
        archivo.write_text(json.dumps({"hora": hora, "serie": serie}, ensure_ascii=False), "utf-8")
        return serie, hora, False


def borrar_cache() -> None:
    """Hace que la próxima vez se vuelvan a descargar todos los datos."""
    for archivo in CACHE.glob("*.json"):
        archivo.unlink()
