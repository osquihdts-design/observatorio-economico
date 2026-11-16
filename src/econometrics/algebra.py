"""Álgebra de matrices básica. Una matriz es una lista de filas: [[1, 2], [3, 4]]."""
from __future__ import annotations

Matriz = list[list[float]]


def transpuesta(a: Matriz) -> Matriz:
    return [list(col) for col in zip(*a)]


def producto(a: Matriz, b: Matriz) -> Matriz:
    bt = transpuesta(b)
    return [[sum(x * y for x, y in zip(fila, col)) for col in bt] for fila in a]


def por_vector(a: Matriz, v: list[float]) -> list[float]:
    return [sum(x * y for x, y in zip(fila, v)) for fila in a]


def inversa(a: Matriz) -> Matriz:
    """Inversa por eliminación de Gauss-Jordan con pivoteo parcial."""
    n = len(a)
    m = [list(map(float, fila)) + [1.0 if i == j else 0.0 for j in range(n)] for i, fila in enumerate(a)]
    escala = max((abs(x) for fila in a for x in fila), default=1.0) or 1.0
    for col in range(n):
        pivote = max(range(col, n), key=lambda f: abs(m[f][col]))
        if abs(m[pivote][col]) < 1e-12 * escala:
            raise ValueError("Matriz singular: alguna variable es combinación exacta de otras (colinealidad perfecta).")
        m[col], m[pivote] = m[pivote], m[col]
        p = m[col][col]
        m[col] = [x / p for x in m[col]]
        for f in range(n):
            if f != col and m[f][col] != 0.0:
                factor = m[f][col]
                m[f] = [x - factor * y for x, y in zip(m[f], m[col])]
    return [fila[n:] for fila in m]


def resolver_banda(filas: list[dict[int, float]], b: list[float], ancho: int) -> list[float]:
    """Resuelve A·x = b cuando A es una matriz de banda (simétrica y definida positiva).

    `filas[i]` es un diccionario {columna: valor} con los elementos no nulos de la fila i,
    todos a distancia ≤ `ancho` de la diagonal. Así el coste crece con n, no con n³:
    es lo que hace rápido el filtro Hodrick-Prescott (ancho = 2).
    """
    n = len(filas)
    a = [dict(f) for f in filas]
    b = list(map(float, b))
    # Eliminación hacia delante: la fila i solo afecta a las `ancho` filas siguientes.
    for i in range(n):
        pivote = a[i][i]
        for f in range(i + 1, min(n, i + ancho + 1)):
            factor = a[f].get(i, 0.0) / pivote
            if factor == 0.0:
                continue
            for c in range(i, min(n, i + ancho + 1)):
                a[f][c] = a[f].get(c, 0.0) - factor * a[i].get(c, 0.0)
            b[f] -= factor * b[i]
    # Sustitución hacia atrás.
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = b[i] - sum(a[i].get(c, 0.0) * x[c] for c in range(i + 1, min(n, i + ancho + 1)))
        x[i] = s / a[i][i]
    return x
