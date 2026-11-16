"""Orquestador: descarga todos los indicadores, los guarda y registra cómo ha ido cada fuente.

Las descargas van en paralelo (varias a la vez) para tardar menos. Si un indicador falla,
los demás siguen: el error queda registrado y el semáforo de esa fuente se pone en ámbar.
"""
from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Callable

from .. import config
from ..connectors import ecb_client, eurostat_client, ine_client
from ..connectors.base import ahora
from . import storage

CONECTORES = {
    "INE": ine_client.descargar_indicador,
    "EUROSTAT": eurostat_client.descargar_indicador,
    "BCE": ecb_client.descargar_indicador,
}


@dataclass
class Resultado:
    filas: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    errores: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    correctos: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    totales: dict[str, int] = field(default_factory=lambda: defaultdict(int))


def ejecutar(fuentes: tuple[str, ...] = ("INE", "EUROSTAT", "BCE"),
             progreso: Callable[[int, int, str], None] | None = None,
             desde: str = config.FECHA_INICIO) -> Resultado:
    """Actualiza los datos. `progreso(hechos, total, nombre)` sirve para una barra de progreso."""
    indicadores = [i for i in config.todos_los_indicadores() if i["fuente"] in fuentes]
    resultado = Resultado()
    inicio = ahora()

    with ThreadPoolExecutor(max_workers=6) as pool:
        tareas = {pool.submit(CONECTORES[i["fuente"]], i, desde): i for i in indicadores}
        for hechos, tarea in enumerate(as_completed(tareas), start=1):
            ind = tareas[tarea]
            fuente = ind["fuente"]
            resultado.totales[fuente] += 1
            try:
                resultado.filas[fuente] += storage.guardar(tarea.result())
                resultado.correctos[fuente] += 1
            except Exception as e:  # se anota y se sigue con el resto
                resultado.errores[fuente].append(f"{ind['id']}: {e}")
            if progreso:
                progreso(hechos, len(indicadores), ind["nombre"])

    for fuente in fuentes:
        storage.registrar_sincronizacion(
            fuente, inicio, resultado.correctos[fuente], resultado.totales[fuente],
            resultado.filas[fuente], resultado.errores[fuente],
        )
    return resultado
