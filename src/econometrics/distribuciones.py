"""Distribuciones de probabilidad para calcular p-valores: normal, t de Student y F de Snedecor.

La t y la F se calculan con la función beta incompleta regularizada (fracción continua de
Lentz, como en «Numerical Recipes»). Precisión de unas 10 cifras: de sobra para p-valores.
"""
from __future__ import annotations

import math


def normal_cdf(x: float) -> float:
    """Probabilidad de que una normal estándar sea ≤ x."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _fraccion_beta(a: float, b: float, x: float) -> float:
    tiny, eps = 1e-300, 3e-14
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


def beta_regularizada(a: float, b: float, x: float) -> float:
    """I_x(a, b): función beta incompleta regularizada."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    ln_bt = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1.0 - x)
    bt = math.exp(ln_bt)
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * _fraccion_beta(a, b, x) / a
    return 1.0 - bt * _fraccion_beta(b, a, 1.0 - x) / b


def t_p_valor(t: float, gl: float) -> float:
    """p-valor bilateral de un estadístico t con `gl` grados de libertad."""
    if not math.isfinite(t):
        return 0.0
    return beta_regularizada(gl / 2.0, 0.5, gl / (gl + t * t))


def t_critico(gl: float, alfa: float = 0.05) -> float:
    """Valor t tal que P(|T| > t) = alfa (se busca por bisección)."""
    bajo, alto = 0.0, 1000.0
    for _ in range(200):
        medio = (bajo + alto) / 2
        if t_p_valor(medio, gl) > alfa:
            bajo = medio
        else:
            alto = medio
    return (bajo + alto) / 2


def f_p_valor(f: float, gl1: float, gl2: float) -> float:
    """p-valor (cola derecha) de un estadístico F."""
    if f <= 0.0:
        return 1.0
    if not math.isfinite(f):
        return 0.0
    return beta_regularizada(gl2 / 2.0, gl1 / 2.0, gl2 / (gl2 + gl1 * f))
