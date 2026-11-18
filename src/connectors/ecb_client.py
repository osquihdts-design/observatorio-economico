"""Conector del Banco Central Europeo (ECB Data Portal, API SDMX 2.1, formato CSV).

Se usa «csvdata» porque es ligero y fácil de leer con el módulo csv de Python.
Fechas SDMX: «2026-10» (mensual) o «2026-11-16» (diaria).
"""
from __future__ import annotations

import csv
import io
from datetime import date

from .. import config
from .base import ErrorFuente, Observacion, ahora, descargar

URL = "https://data-api.ecb.europa.eu/service/data/{}"


def _leer(clave: str, desde: str) -> tuple[list[tuple[str, float]], str]:
    """Devuelve [(periodo, valor), ...] y el título oficial de la serie."""
    texto = descargar(URL.format(clave), [("format", "csvdata"), ("startPeriod", desde)]).decode("utf-8")
    filas = list(csv.DictReader(io.StringIO(texto)))
    if not filas:
        raise ErrorFuente(f"BCE: la serie {clave} no devolvió datos")
    titulo = filas[0].get("TITLE", "")
    return [(f["TIME_PERIOD"], float(f["OBS_VALUE"])) for f in filas if f.get("OBS_VALUE")], titulo


def descargar_indicador(ind: dict, desde: str = config.FECHA_INICIO) -> list[Observacion]:
    momento = ahora()
    observaciones = []
    for pais, clave in ind["series"].items():
        datos, _ = _leer(clave, desde)
        por_mes: dict[date, float] = {}
        for periodo, valor in sorted(datos):
            anio, mes = periodo.split("-")[:2]
            # Series diarias: al ir en orden, cada mes se queda con su último valor.
            por_mes[date(int(anio), int(mes), 1)] = valor
        observaciones += [
            Observacion(
                date=fecha, indicator_id=ind["id"], indicator_name=ind["nombre"],
                country_code=pais, country_name=config.NOMBRES[pais], value=valor, unit=ind["unidad"],
                frequency=ind["frecuencia"], source="BCE", series_code=clave, status=None, last_updated=momento,
            )
            for fecha, valor in por_mes.items()
        ]
    return observaciones
