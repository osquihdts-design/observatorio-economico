"""Conector del INE (API JSON Tempus3): https://servicios.ine.es/wstempus/js/ES/

Cada serie se pide con DATOS_SERIE/{código}?date=AAAAMMDD:&det=2&tip=AM
  det=2   incluye el detalle de cada dato (por ejemplo, si es definitivo o provisional)
  tip=AM  formato «amigable»: fechas ISO con zona horaria y nombres en vez de códigos

Sobre las fechas: en el formato normal, «Fecha» son milisegundos Unix de la medianoche de
Madrid, que en hora universal caen el día anterior (1 de agosto → 31 de julio a las 22:00).
Con tip=AM llega como texto («2026-07-01T00:00:00.000+02:00») y se toma el día tal cual.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone

from .. import config
from .base import ErrorFuente, Observacion, ahora, descargar

URL = "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{}"


def _fecha(valor) -> date:
    if isinstance(valor, str):  # «2026-07-01T00:00:00.000+02:00»: la fecha local de Madrid
        return date(int(valor[:4]), int(valor[5:7]), 1)
    # Por si llegara en milisegundos: +12 h evita el desfase de la medianoche de Madrid.
    dia = datetime.fromtimestamp(valor / 1000 + 12 * 3600, tz=timezone.utc).date()
    return date(dia.year, dia.month, 1)


def descargar_indicador(ind: dict, desde: str = config.FECHA_INICIO) -> list[Observacion]:
    codigo = ind["serie"]
    params = [("date", desde.replace("-", "") + "01:"), ("det", "2"), ("tip", "AM")]
    datos = json.loads(descargar(URL.format(codigo), params))
    if not isinstance(datos, dict) or "Data" not in datos:
        raise ErrorFuente(f"INE: respuesta inesperada para {codigo}")
    momento = ahora()
    observaciones = []
    for punto in datos["Data"]:
        if punto.get("Secreto") or punto.get("Valor") is None:
            continue  # datos ocultos por secreto estadístico o vacíos
        tipo = (punto.get("TipoDato") or {}).get("Nombre")
        observaciones.append(Observacion(
            date=_fecha(punto["Fecha"]),
            indicator_id=ind["id"],
            indicator_name=ind["nombre"],
            country_code="ES",
            country_name=config.PAISES["ES"],
            value=float(punto["Valor"]),
            unit=ind["unidad"],
            frequency=ind["frecuencia"],
            source="INE",
            series_code=codigo,
            status=tipo.lower() if tipo else None,
            last_updated=momento,
        ))
    if not observaciones:
        raise ErrorFuente(f"INE: la serie {codigo} no devolvió datos")
    return observaciones
