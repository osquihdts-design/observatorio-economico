"""Prepara los datos para el análisis: carga de la base de datos, transforma y alinea por fechas."""
from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean, median, quantiles, stdev

from ..etl import storage
from .time_series import TRANSFORMACIONES, a_trimestral, transformar


@dataclass(frozen=True)
class Variable:
    indicador: str
    pais: str
    transformacion: str = "niveles"


@dataclass
class Dataset:
    frecuencia: str                      # «M» o «Q»
    fechas: list[str]                    # fechas comunes a todas las variables
    columnas: dict[str, list[float]]     # nombre → valores (alineados con `fechas`)
    metadatos: list[dict] = field(default_factory=list)


def cargar(indicador: str, pais: str) -> tuple[dict[str, float], dict]:
    """Serie de la base de datos y su ficha (nombre, unidad, fuente, código…)."""
    filas = storage.leer(indicador=indicador, paises=[pais])
    if not filas:
        raise ValueError(f"No hay datos de «{indicador}» para {pais}. ¿Has ejecutado la actualización de datos?")
    ficha = {c: filas[-1][c] for c in ("indicator_id", "indicator_name", "country_code", "country_name",
                                       "unit", "frequency", "source", "series_code", "last_updated")}
    return {f["date"]: f["value"] for f in filas}, ficha


def nombre_variable(ficha: dict, transformacion: str) -> str:
    base = f"{ficha['indicator_name']} · {ficha['country_name']}"
    return base if transformacion == "niveles" else f"{base} [{TRANSFORMACIONES[transformacion]}]"


def preparar(variables: list[Variable], desde: str | None = None, hasta: str | None = None) -> Dataset:
    """Junta varias series en una tabla con fechas comunes.

    Si alguna es trimestral, todas se pasan a trimestral (media de cada trimestre)
    ANTES de transformarlas. Luego se aplican las transformaciones y se quedan solo
    las fechas en las que todas tienen dato.
    """
    cargadas = [(v, *cargar(v.indicador, v.pais)) for v in variables]
    frecuencia = "Q" if any(f["frequency"] == "Q" for _, _, f in cargadas) else "M"
    columnas_por_fecha: dict[str, dict[str, float]] = {}
    metadatos = []
    for var, serie, ficha in cargadas:
        if frecuencia == "Q" and ficha["frequency"] == "M":
            serie = a_trimestral(serie)
        serie = transformar(serie, var.transformacion, frecuencia)
        nombre = nombre_variable(ficha, var.transformacion)
        columnas_por_fecha[nombre] = serie
        metadatos.append({**ficha, "nombre": nombre, "transformacion": TRANSFORMACIONES[var.transformacion]})

    comunes = set.intersection(*(set(s) for s in columnas_por_fecha.values()))
    fechas = sorted(f for f in comunes if (not desde or f >= desde) and (not hasta or f <= hasta))
    if len(fechas) < 8:
        raise ValueError(f"Solo hay {len(fechas)} fechas con datos en todas las variables: hacen falta al menos 8.")
    columnas = {n: [s[f] for f in fechas] for n, s in columnas_por_fecha.items()}
    return Dataset(frecuencia=frecuencia, fechas=fechas, columnas=columnas, metadatos=metadatos)


def descriptivos(columnas: dict[str, list[float]]) -> list[dict]:
    resultado = []
    for nombre, v in columnas.items():
        q1, _, q3 = quantiles(v, n=4)
        resultado.append({
            "variable": nombre, "n": len(v), "media": mean(v), "desviacion": stdev(v),
            "minimo": min(v), "p25": q1, "mediana": median(v), "p75": q3, "maximo": max(v),
        })
    return resultado
