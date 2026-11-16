"""Conector de Eurostat (API de estadísticas, formato JSON-stat 2.0).

Cómo funciona JSON-stat: los valores vienen en un diccionario «value» cuyas claves son
posiciones de una tabla «aplanada». Con «id» (el orden de las dimensiones) y «size» (cuántas
categorías tiene cada una) se calcula a qué país, fecha, etc. corresponde cada posición,
igual que se calcula fila y columna a partir de la posición de una celda.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from .. import config
from .base import ErrorFuente, Observacion, ahora, descargar

URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{}"

# Marcas de estado de Eurostat que interesa conservar.
ESTADOS = {"p": "provisional", "e": "estimado", "b": "ruptura de serie", "u": "poco fiable", "d": "definición distinta"}


def parsear_jsonstat(j: dict) -> tuple[dict[str, list[tuple[str, float, str | None]]], datetime | None]:
    """JSON-stat 2.0 → {geo: [(periodo, valor, estado), ...]} y fecha de actualización de la tabla."""
    dims, tamanos = j["id"], j["size"]
    etiquetas = {}
    for d in dims:
        indice = j["dimension"][d]["category"]["index"]
        etiquetas[d] = sorted(indice, key=indice.get) if isinstance(indice, dict) else list(indice)
    # pasos[i] = cuántas posiciones avanza la lista al pasar a la siguiente categoría de la dimensión i
    pasos = [1] * len(dims)
    for i in range(len(dims) - 2, -1, -1):
        pasos[i] = pasos[i + 1] * tamanos[i + 1]
    i_geo, i_tiempo = dims.index("geo"), dims.index("time")
    estados = j.get("status") or {}

    resultado: dict[str, list] = {}
    for clave, valor in (j.get("value") or {}).items():
        if valor is None:
            continue
        n = int(clave)
        geo = etiquetas["geo"][(n // pasos[i_geo]) % tamanos[i_geo]]
        periodo = etiquetas["time"][(n // pasos[i_tiempo]) % tamanos[i_tiempo]]
        resultado.setdefault(geo, []).append((periodo, float(valor), ESTADOS.get(estados.get(clave))))

    actualizado = None
    if j.get("updated"):
        try:
            actualizado = datetime.fromisoformat(j["updated"].replace("Z", "+00:00"))
        except ValueError:
            pass
    return resultado, actualizado


def _fecha(periodo: str) -> date:
    """'2026-10' → 1 oct 2026;  '2026-Q3' → 1 jul 2026."""
    if "-Q" in periodo:
        anio, q = periodo.split("-Q")
        return date(int(anio), (int(q) - 1) * 3 + 1, 1)
    anio, mes = periodo.split("-")[:2]
    return date(int(anio), int(mes), 1)


def _desde(fecha: str, frecuencia: str) -> str:
    """Formato de fecha que espera Eurostat según la frecuencia."""
    if frecuencia == "Q":
        anio, mes = fecha.split("-")
        return f"{anio}-Q{(int(mes) - 1) // 3 + 1}"
    return fecha


def descargar_indicador(ind: dict, desde: str = config.FECHA_INICIO) -> list[Observacion]:
    paises = [p for p in config.PAISES if p != "EA"]
    puntos: dict[tuple[str, date], tuple[float, str | None, str]] = {}  # (país, fecha) → (valor, estado, tabla)
    actualizaciones = []

    for tramo in ind["tramos"]:
        inicio = max(desde, tramo.get("desde", desde))
        params = [("format", "JSON"), ("lang", "EN"), ("sinceTimePeriod", _desde(inicio, ind["frecuencia"]))]
        params += list(tramo["filtros"].items()) + [("geo", p) for p in paises + config.ZONA_EURO_EUROSTAT]
        datos, actualizado = parsear_jsonstat(json.loads(descargar(URL.format(tramo["tabla"]), params)))
        if actualizado:
            actualizaciones.append(actualizado)

        # Zona euro: el primer código de la lista que tenga datos en esta tabla.
        euro = next((g for g in config.ZONA_EURO_EUROSTAT if datos.get(g)), None)
        for geo, serie in datos.items():
            if geo in config.ZONA_EURO_EUROSTAT:
                if geo != euro:
                    continue
                pais = "EA"
            else:
                pais = geo
            for periodo, valor, estado in serie:
                if "hasta" in tramo and periodo > tramo["hasta"]:
                    continue
                puntos[(pais, _fecha(periodo))] = (valor, estado, f"{tramo['tabla']} ({geo})")

    if not puntos:
        raise ErrorFuente(f"Eurostat: sin datos para {ind['id']}")
    momento = max(actualizaciones) if actualizaciones else ahora()
    return [
        Observacion(
            date=fecha, indicator_id=ind["id"], indicator_name=ind["nombre"],
            country_code=pais, country_name=config.PAISES[pais], value=valor, unit=ind["unidad"],
            frequency=ind["frecuencia"], source="EUROSTAT", series_code=tabla, status=estado, last_updated=momento,
        )
        for (pais, fecha), (valor, estado, tabla) in sorted(puntos.items())
    ]
