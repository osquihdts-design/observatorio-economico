"""Análisis estadístico sencillo con el módulo estándar «statistics» de Python.

Para comparar variables con frecuencias distintas (mensuales y trimestrales),
todo se pasa a medias trimestrales antes de calcular nada.
"""
from __future__ import annotations

from statistics import correlation, linear_regression, mean


def trimestral(puntos: list[list]) -> dict[str, float]:
    """[[fecha, valor], ...] → {'2024-T1': media del trimestre, ...}"""
    grupos: dict[str, list[float]] = {}
    for fecha, valor in puntos:
        anio, mes = int(fecha[:4]), int(fecha[5:7])
        grupos.setdefault(f"{anio}-T{(mes - 1) // 3 + 1}", []).append(valor)
    return {t: mean(v) for t, v in sorted(grupos.items())}


def _desplazar(trimestre: str, n: int) -> str:
    """'2024-T1' desplazado n trimestres hacia delante."""
    anio, q = int(trimestre[:4]), int(trimestre[-1])
    total = anio * 4 + (q - 1) + n
    return f"{total // 4}-T{total % 4 + 1}"


def variacion_anual(serie: dict[str, float]) -> dict[str, float]:
    """Cambio en puntos respecto al mismo trimestre del año anterior."""
    return {t: v - serie[_desplazar(t, -4)] for t, v in serie.items() if _desplazar(t, -4) in serie}


def coma(v: float) -> str:
    """Número con 2 decimales y coma decimal, como se escribe en español."""
    return f"{v:.2f}".replace(".", ",")


def _fuerza(r: float) -> str:
    a = abs(r)
    if a < 0.2:
        return "muy débil o inexistente"
    if a < 0.4:
        return "débil"
    if a < 0.7:
        return "moderada"
    return "fuerte"


def regresion(x: dict[str, float], y: dict[str, float], retardo: int = 0,
              nombre_x: str = "X", nombre_y: str = "Y", desde: str = "0000") -> dict:
    """Regresión lineal  Y(t) = a + b · X(t − retardo)  por mínimos cuadrados.

    Devuelve los puntos usados, la pendiente (b), la constante (a), la correlación (r),
    el R² y una explicación en palabras.
    """
    puntos = []
    for t, valor_y in y.items():
        t_x = _desplazar(t, -retardo)
        if t >= desde and t_x in x:
            puntos.append([t, x[t_x], valor_y])
    n = len(puntos)
    if n < 8:
        return {"puntos": puntos, "n": n, "error": "No hay suficientes datos en común para analizar (hacen falta al menos 8 trimestres)."}

    xs = [p[1] for p in puntos]
    ys = [p[2] for p in puntos]
    if len(set(xs)) < 2 or len(set(ys)) < 2:
        return {"puntos": puntos, "n": n, "error": "Una de las variables no cambia en este periodo, así que no se puede calcular la relación."}

    b, a = linear_regression(xs, ys)
    r = correlation(xs, ys)
    r2 = r * r
    sube = "subir" if b > 0 else "bajar"
    cuando = f", {retardo} trimestre{'s' if retardo != 1 else ''} después" if retardo else ""
    texto = (
        f"Cuando «{nombre_x}» aumenta 1 punto, «{nombre_y}» tiende a {sube} "
        f"{coma(abs(b))} puntos{cuando}. La relación es {_fuerza(r)} (r = {coma(r)}): "
        f"«{nombre_x}» explica el {r2 * 100:.0f} % de las variaciones de «{nombre_y}» (R²)."
    )
    return {
        "puntos": puntos,
        "n": n,
        "pendiente": b,
        "constante": a,
        "r": r,
        "r2": r2,
        "texto": texto,
        "aviso": "Que dos variables se muevan juntas no significa que una cause la otra: puede haber otros factores detrás.",
    }
