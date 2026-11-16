"""Series temporales: transformaciones, filtro Hodrick-Prescott y test de Dickey-Fuller aumentado.

Una serie es un diccionario ordenado {fecha "AAAA-MM-DD": valor}.
"""
from __future__ import annotations

import math
from statistics import mean

from .algebra import resolver_banda
from .distribuciones import normal_cdf
from .regression import ols

Serie = dict[str, float]

TRANSFORMACIONES = {
    "niveles": "Niveles",
    "diferencia": "Primera diferencia (Δ)",
    "log": "Logaritmo (ln)",
    "dlog": "Diferencia del logaritmo (Δln)",
    "interanual": "Tasa interanual (%)",
}


# ----------------------------------------------------------------------------- Frecuencias

def a_trimestral(serie: Serie) -> Serie:
    """Media de cada trimestre. La fecha es el primer día del trimestre."""
    grupos: dict[str, list[float]] = {}
    for fecha, v in serie.items():
        anio, mes = int(fecha[:4]), int(fecha[5:7])
        grupos.setdefault(f"{anio}-{(mes - 1) // 3 * 3 + 1:02d}-01", []).append(v)
    return {f: mean(v) for f, v in sorted(grupos.items())}


def periodos_por_anio(frecuencia: str) -> int:
    return {"M": 12, "Q": 4, "A": 1}[frecuencia]


def _anterior(fecha: str, meses: int) -> str:
    anio, mes = int(fecha[:4]), int(fecha[5:7])
    total = anio * 12 + (mes - 1) - meses
    return f"{total // 12}-{total % 12 + 1:02d}-01"


# ----------------------------------------------------------------------------- Transformaciones

def transformar(serie: Serie, tipo: str, frecuencia: str) -> Serie:
    """Aplica una transformación. Se compara con el periodo anterior por fecha (no por posición),
    así un hueco en los datos nunca mezcla periodos que no son consecutivos."""
    paso = 12 // periodos_por_anio(frecuencia)  # meses entre dos datos seguidos
    if tipo == "niveles":
        return dict(serie)
    if tipo == "log":
        if any(v <= 0 for v in serie.values()):
            raise ValueError("No se puede tomar el logaritmo: la serie tiene valores cero o negativos.")
        return {f: math.log(v) for f, v in serie.items()}
    if tipo == "diferencia":
        return {f: v - serie[_anterior(f, paso)] for f, v in serie.items() if _anterior(f, paso) in serie}
    if tipo == "dlog":
        return transformar(transformar(serie, "log", frecuencia), "diferencia", frecuencia)
    if tipo == "interanual":
        resultado = {}
        for f, v in serie.items():
            previo = serie.get(_anterior(f, 12))
            if previo:
                resultado[f] = (v / previo - 1.0) * 100.0
        return resultado
    raise ValueError(f"Transformación desconocida: {tipo}")


# ----------------------------------------------------------------------------- Filtro HP

LAMBDA_HP = {"M": 14400, "Q": 1600, "A": 100}


def filtro_hp(valores: list[float], lam: float) -> tuple[list[float], list[float]]:
    """Filtro de Hodrick-Prescott: separa tendencia y ciclo.

    La tendencia τ minimiza  Σ(y − τ)² + λ·Σ(Δ²τ)²,  lo que equivale a resolver
    (I + λ·D'D)·τ = y,  con D la matriz de segundas diferencias. Devuelve (tendencia, ciclo).
    """
    n = len(valores)
    if n < 4:
        raise ValueError("El filtro HP necesita al menos 4 datos.")
    # Coeficientes de D'D: diagonal 1,5,6,…,6,5,1 · primera banda −2,−4,…,−4,−2 · segunda banda 1.
    diag = [6.0] * n
    diag[0] = diag[-1] = 1.0
    diag[1] = diag[-2] = 5.0
    banda1 = [-4.0] * (n - 1)
    banda1[0] = banda1[-1] = -2.0
    filas = []
    for i in range(n):
        fila = {i: 1.0 + lam * diag[i]}
        if i + 1 < n:
            fila[i + 1] = lam * banda1[i]
        if i - 1 >= 0:
            fila[i - 1] = lam * banda1[i - 1]
        if i + 2 < n:
            fila[i + 2] = lam
        if i - 2 >= 0:
            fila[i - 2] = lam
        filas.append(fila)
    tendencia = resolver_banda(filas, valores, ancho=2)
    ciclo = [y - t for y, t in zip(valores, tendencia)]
    return tendencia, ciclo


# ----------------------------------------------------------------------------- Dickey-Fuller aumentado

# Valores críticos de MacKinnon (2010), modelo con constante y sin tendencia:
#   c(T) = b∞ + b1/T + b2/T²
_CRITICOS_C = {"1%": (-3.43035, -6.5393, -16.786), "5%": (-2.86154, -2.8903, -4.234), "10%": (-2.56677, -1.5384, -2.809)}

# Aproximación de MacKinnon (1994) para el p-valor (constante, una variable).
_TAU_MAX, _TAU_MIN, _TAU_STAR = 2.74, -18.86, -1.61
_P_PEQUENO = (2.1659, 1.4412, 0.038269)
_P_GRANDE = (1.7339, 0.093202, -0.012745, -0.000010368)


def _p_valor_mackinnon(tau: float) -> float:
    if tau > _TAU_MAX:
        return 1.0
    if tau < _TAU_MIN:
        return 0.0
    coef = _P_PEQUENO if tau <= _TAU_STAR else _P_GRANDE
    return normal_cdf(sum(c * tau ** i for i, c in enumerate(coef)))


def adf(valores: list[float], max_retardos: int | None = None) -> dict:
    """Test de Dickey-Fuller aumentado (con constante). Hipótesis nula: la serie tiene raíz unitaria
    (NO es estacionaria). Si el p-valor < 0,05 se rechaza: la serie se puede considerar estacionaria.

    Regresión:  Δy_t = α + β·y_{t−1} + Σ γ_i·Δy_{t−i} + ε_t.  El estadístico es el t de β.
    El número de retardos se elige con el criterio AIC, como hace statsmodels.
    """
    y = list(map(float, valores))
    n = len(y)
    if max_retardos is None:
        max_retardos = int(12 * (n / 100) ** 0.25)
    max_retardos = max(0, min(max_retardos, n // 2 - 3))
    dy = [y[i] - y[i - 1] for i in range(1, n)]  # dy[i-1] = Δy_i

    def regresion(p: int, inicio: int):
        # t va de `inicio` a n-1 (índices de y); necesita Δy_t, y_{t-1} y Δy_{t-1..t-p}
        filas_t = range(inicio, n)
        objetivo = [dy[t - 1] for t in filas_t]
        x = {"y(t-1)": [y[t - 1] for t in filas_t]}
        for i in range(1, p + 1):
            x[f"Δy(t-{i})"] = [dy[t - 1 - i] for t in filas_t]
        return ols(objetivo, x, variable_y="Δy")

    # Selección de retardos con la misma muestra para todos (la más corta), y estimación final con la muestra completa.
    inicio_comun = max_retardos + 1
    mejor = min(range(max_retardos + 1), key=lambda p: regresion(p, inicio_comun).aic)
    final = regresion(mejor, mejor + 1)
    tau = final.t[1]
    t_obs = final.n
    criticos = {nivel: b + b1 / t_obs + b2 / t_obs ** 2 for nivel, (b, b1, b2) in _CRITICOS_C.items()}
    p = _p_valor_mackinnon(tau)
    estacionaria = p < 0.05
    return {
        "estadistico": tau,
        "p_valor": p,
        "retardos": mejor,
        "n": t_obs,
        "criticos": criticos,
        "estacionaria": estacionaria,
        "conclusion": (
            "Se rechaza la raíz unitaria: la serie se puede considerar estacionaria (al 5 %)."
            if estacionaria else
            "No se rechaza la raíz unitaria: la serie NO es estacionaria. Cuidado con las regresiones espurias: "
            "prueba con primeras diferencias o tasas interanuales."
        ),
    }
