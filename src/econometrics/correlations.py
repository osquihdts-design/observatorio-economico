"""Correlaciones: matriz de Pearson y correlación cruzada con retardos (lead-lag)."""
from __future__ import annotations

import math
from statistics import correlation


def matriz_correlaciones(variables: dict[str, list[float]]) -> dict[str, dict[str, float]]:
    nombres = list(variables)
    return {a: {b: (1.0 if a == b else correlation(variables[a], variables[b])) for b in nombres} for a in nombres}


def correlacion_cruzada(x: dict[str, float], y: dict[str, float], fechas_x_a_y: list[str],
                        max_retardo: int) -> list[dict]:
    """Correlación entre x(t) e y(t+k) para k = −max_retardo … +max_retardo.

    `fechas_x_a_y` es la lista ordenada y sin huecos de fechas comunes del calendario.
    k > 0: x se adelanta a y (x hoy se relaciona con y dentro de k periodos).
    k < 0: y se adelanta a x.
    La banda de significación al 95 % es ±1,96/√n (aproximación habitual).
    """
    resultado = []
    for k in range(-max_retardo, max_retardo + 1):
        pares = []
        for i, f in enumerate(fechas_x_a_y):
            j = i + k
            if 0 <= j < len(fechas_x_a_y) and f in x and fechas_x_a_y[j] in y:
                pares.append((x[f], y[fechas_x_a_y[j]]))
        if len(pares) < 8:
            continue
        xs, ys = zip(*pares)
        if len(set(xs)) < 2 or len(set(ys)) < 2:
            continue
        r = correlation(xs, ys)
        banda = 1.96 / math.sqrt(len(pares))
        resultado.append({"retardo": k, "r": r, "n": len(pares), "banda": banda, "significativa": abs(r) > banda})
    return resultado
