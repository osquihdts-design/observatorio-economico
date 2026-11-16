"""Regresión lineal por mínimos cuadrados ordinarios (MCO / OLS) con diagnósticos.

    y = b0 + b1·x1 + b2·x2 + … + error

Calcula lo mismo que la tabla de resultados de un programa de econometría: coeficientes,
errores estándar (clásicos o robustos HAC de Newey-West), estadísticos t, p-valores,
intervalos de confianza, R², R² ajustado, estadístico F, AIC, BIC y Durbin-Watson.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import algebra as al
from .distribuciones import f_p_valor, t_critico, t_p_valor


@dataclass
class ResultadoOLS:
    variable_y: str
    nombres: list[str]               # nombres de los coeficientes («Constante», x1, x2…)
    coeficientes: list[float]
    errores: list[float]             # errores estándar
    t: list[float]
    p: list[float]
    ic_bajo: list[float]             # intervalo de confianza al 95 %
    ic_alto: list[float]
    n: int
    k: int                           # nº de coeficientes (incluida la constante)
    r2: float
    r2_ajustado: float
    f: float
    f_p: float
    aic: float
    bic: float
    durbin_watson: float
    sigma: float                     # desviación típica de los residuos
    log_verosimilitud: float
    tipo_errores: str                # «clásicos» o «HAC (Newey-West, L retardos)»
    ajustados: list[float]
    residuos: list[float]
    fechas: list[str] = field(default_factory=list)

    def tabla(self) -> list[dict]:
        return [
            {"variable": n, "coeficiente": b, "error": e, "t": t, "p": p, "ic_bajo": lo, "ic_alto": hi}
            for n, b, e, t, p, lo, hi in zip(self.nombres, self.coeficientes, self.errores, self.t, self.p, self.ic_bajo, self.ic_alto)
        ]


def retardos_newey_west(n: int) -> int:
    """Regla habitual de Newey y West (1994): L = parte entera de 4·(n/100)^(2/9)."""
    return int(math.floor(4 * (n / 100) ** (2 / 9)))


def _covarianza_hac(x: al.Matriz, u: list[float], xtx_inv: al.Matriz, retardos: int) -> al.Matriz:
    """Matriz de covarianzas robusta a heterocedasticidad y autocorrelación (Newey-West, núcleo de Bartlett)."""
    n, k = len(x), len(x[0])
    s = [[0.0] * k for _ in range(k)]
    for t in range(n):
        ut2 = u[t] * u[t]
        for i in range(k):
            for j in range(k):
                s[i][j] += ut2 * x[t][i] * x[t][j]
    for l in range(1, retardos + 1):
        w = 1.0 - l / (retardos + 1.0)
        for t in range(l, n):
            uu = w * u[t] * u[t - l]
            for i in range(k):
                for j in range(k):
                    s[i][j] += uu * (x[t][i] * x[t - l][j] + x[t - l][i] * x[t][j])
    cov = al.producto(al.producto(xtx_inv, s), xtx_inv)
    correccion = n / (n - k)  # corrección de muestras pequeñas (como statsmodels por defecto)
    return [[v * correccion for v in fila] for fila in cov]


def ols(y: list[float], x: dict[str, list[float]], variable_y: str = "y", constante: bool = True,
        robustos: bool = False, retardos: int | None = None, fechas: list[str] | None = None) -> ResultadoOLS:
    """Regresión de `y` sobre las columnas de `x` (un diccionario {nombre: valores})."""
    n = len(y)
    nombres = (["Constante"] if constante else []) + list(x)
    columnas = ([[1.0] * n] if constante else []) + [list(map(float, v)) for v in x.values()]
    if any(len(c) != n for c in columnas):
        raise ValueError("Todas las variables deben tener el mismo número de datos.")
    k = len(columnas)
    if n <= k + 1:
        raise ValueError(f"Hacen falta más datos que variables: hay {n} observaciones y {k} coeficientes.")

    xm = al.transpuesta(columnas)                    # n filas × k columnas
    xt = columnas                                    # k × n
    xtx_inv = al.inversa(al.producto(xt, xm))
    coef = al.por_vector(xtx_inv, [sum(a * b for a, b in zip(col, y)) for col in xt])
    ajustados = al.por_vector(xm, coef)
    residuos = [a - b for a, b in zip(y, ajustados)]

    scr = sum(e * e for e in residuos)               # suma de cuadrados de los residuos
    media = sum(y) / n
    sct = sum((v - media) ** 2 for v in y) if constante else sum(v * v for v in y)
    r2 = 1.0 - scr / sct if sct > 0 else 0.0
    gl = n - k
    r2_aj = 1.0 - (1.0 - r2) * (n - (1 if constante else 0)) / gl
    sigma2 = scr / gl

    if robustos:
        l = retardos_newey_west(n) if retardos is None else retardos
        cov = _covarianza_hac(xm, residuos, xtx_inv, l)
        tipo = f"HAC Newey-West ({l} retardo{'s' if l != 1 else ''})"
    else:
        cov = [[v * sigma2 for v in fila] for fila in xtx_inv]
        tipo = "clásicos"

    errores = [math.sqrt(max(cov[i][i], 0.0)) for i in range(k)]
    t = [b / e if e > 0 else math.inf for b, e in zip(coef, errores)]
    p = [t_p_valor(v, gl) for v in t]
    tc = t_critico(gl, 0.05)

    # F: contraste de que todas las pendientes son cero (Wald, válido también con errores HAC).
    pendientes = list(range(1 if constante else 0, k))
    q = len(pendientes)
    if q:
        sub = [[cov[i][j] for j in pendientes] for i in pendientes]
        bq = [coef[i] for i in pendientes]
        f = sum(a * b for a, b in zip(bq, al.por_vector(al.inversa(sub), bq))) / q
        f_p = f_p_valor(f, q, gl)
    else:
        f, f_p = math.nan, math.nan

    log_v = -n / 2 * (math.log(2 * math.pi) + math.log(scr / n) + 1)
    dw = sum((residuos[i] - residuos[i - 1]) ** 2 for i in range(1, n)) / scr if scr > 0 else math.nan

    return ResultadoOLS(
        variable_y=variable_y, nombres=nombres, coeficientes=coef, errores=errores, t=t, p=p,
        ic_bajo=[b - tc * e for b, e in zip(coef, errores)], ic_alto=[b + tc * e for b, e in zip(coef, errores)],
        n=n, k=k, r2=r2, r2_ajustado=r2_aj, f=f, f_p=f_p,
        aic=-2 * log_v + 2 * k, bic=-2 * log_v + k * math.log(n),
        durbin_watson=dw, sigma=math.sqrt(sigma2), log_verosimilitud=log_v, tipo_errores=tipo,
        ajustados=ajustados, residuos=residuos, fechas=fechas or [],
    )
