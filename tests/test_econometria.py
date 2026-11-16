"""Comprueba que los cálculos coinciden con valores conocidos de manuales y tablas estadísticas.

Ejecutar desde la carpeta del proyecto:  python -m unittest -v
"""
import math
import random
import unittest

from src.econometrics import algebra as al
from src.econometrics.correlations import correlacion_cruzada
from src.econometrics.distribuciones import f_p_valor, normal_cdf, t_critico, t_p_valor
from src.econometrics.regression import ols
from src.econometrics.time_series import _p_valor_mackinnon, adf, filtro_hp, transformar

# Cuarteto de Anscombe (conjunto I): resultados publicados en cualquier manual.
ANSCOMBE_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]
ANSCOMBE_Y = [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]


class Distribuciones(unittest.TestCase):
    def test_normal(self):
        self.assertAlmostEqual(normal_cdf(1.959964), 0.975, places=5)

    def test_t_de_student(self):
        self.assertAlmostEqual(t_p_valor(2.0, 10), 0.07339, places=4)   # tablas: p bilateral
        self.assertAlmostEqual(t_critico(10), 2.2281, places=3)
        self.assertAlmostEqual(t_critico(30), 2.0423, places=3)
        self.assertAlmostEqual(t_critico(10_000), 1.9602, places=3)     # se acerca a la normal

    def test_f_de_snedecor(self):
        self.assertAlmostEqual(f_p_valor(2.9223, 3, 30), 0.05, places=3)  # valor crítico F(3,30) al 5 %
        self.assertAlmostEqual(f_p_valor(4.9646, 1, 10), 0.05, places=3)


class Algebra(unittest.TestCase):
    def test_inversa(self):
        a = [[4.0, 7.0, 2.0], [3.0, 6.0, 1.0], [2.0, 5.0, 3.0]]
        identidad = al.producto(a, al.inversa(a))
        for i in range(3):
            for j in range(3):
                self.assertAlmostEqual(identidad[i][j], 1.0 if i == j else 0.0, places=10)

    def test_singular(self):
        with self.assertRaises(ValueError):
            al.inversa([[1.0, 2.0], [2.0, 4.0]])


class RegresionOLS(unittest.TestCase):
    def test_anscombe(self):
        r = ols(ANSCOMBE_Y, {"x": ANSCOMBE_X})
        self.assertAlmostEqual(r.coeficientes[0], 3.0001, places=3)
        self.assertAlmostEqual(r.coeficientes[1], 0.5001, places=3)
        self.assertAlmostEqual(r.errores[1], 0.1179, places=3)
        self.assertAlmostEqual(r.t[1], 4.241, places=2)
        self.assertAlmostEqual(r.p[1], 0.00217, places=4)
        self.assertAlmostEqual(r.r2, 0.6665, places=3)
        self.assertAlmostEqual(r.f, 17.99, places=1)
        self.assertAlmostEqual(r.log_verosimilitud, -16.841, places=2)
        self.assertAlmostEqual(r.aic, 37.68, places=1)
        self.assertAlmostEqual(r.bic, 38.48, places=1)

    def test_varias_variables(self):
        rng = random.Random(1)
        x1 = [rng.gauss(0, 1) for _ in range(200)]
        x2 = [rng.gauss(5, 2) for _ in range(200)]
        y = [2 + 3 * a - 1.5 * b + rng.gauss(0, 0.1) for a, b in zip(x1, x2)]
        r = ols(y, {"x1": x1, "x2": x2})
        for estimado, real in zip(r.coeficientes, [2, 3, -1.5]):
            self.assertAlmostEqual(estimado, real, delta=0.05)
        self.assertGreater(r.r2, 0.99)

    def test_hac_sin_retardos_es_white(self):
        """Con 0 retardos, Newey-West es la matriz de White (HC1). Se comprueba con la fórmula cerrada."""
        r = ols(ANSCOMBE_Y, {"x": ANSCOMBE_X}, robustos=True, retardos=0)
        n, media = len(ANSCOMBE_X), sum(ANSCOMBE_X) / len(ANSCOMBE_X)
        sxx = sum((x - media) ** 2 for x in ANSCOMBE_X)
        var_hc0 = sum((x - media) ** 2 * e ** 2 for x, e in zip(ANSCOMBE_X, r.residuos)) / sxx ** 2
        self.assertAlmostEqual(r.errores[1], math.sqrt(var_hc0 * n / (n - 2)), places=8)

    def test_durbin_watson(self):
        r = ols(ANSCOMBE_Y, {"x": ANSCOMBE_X})
        e = r.residuos
        esperado = sum((e[i] - e[i - 1]) ** 2 for i in range(1, len(e))) / sum(v * v for v in e)
        self.assertAlmostEqual(r.durbin_watson, esperado, places=10)


class SeriesTemporales(unittest.TestCase):
    def test_hp_conserva_rectas(self):
        recta = [1.5 * i + 10 for i in range(60)]
        tendencia, ciclo = filtro_hp(recta, 1600)
        for a, b in zip(tendencia, recta):
            self.assertAlmostEqual(a, b, places=6)

    def test_hp_propiedades(self):
        rng = random.Random(7)
        y = [math.sin(i / 5) * 3 + 0.2 * i + rng.gauss(0, 0.5) for i in range(120)]
        tendencia, ciclo = filtro_hp(y, 1600)
        self.assertAlmostEqual(sum(ciclo), 0.0, places=6)                              # el ciclo suma cero
        self.assertAlmostEqual(sum(i * c for i, c in enumerate(ciclo)), 0.0, places=4)  # y no tiene tendencia lineal
        sin_suavizar, _ = filtro_hp(y, 0)
        for a, b in zip(sin_suavizar, y):
            self.assertAlmostEqual(a, b, places=8)

    def test_mackinnon_coincide_con_criticos(self):
        # El p-valor en los valores críticos asintóticos debe ser 1 %, 5 % y 10 %.
        self.assertAlmostEqual(_p_valor_mackinnon(-3.43035), 0.01, delta=0.002)
        self.assertAlmostEqual(_p_valor_mackinnon(-2.86154), 0.05, delta=0.004)
        self.assertAlmostEqual(_p_valor_mackinnon(-2.56677), 0.10, delta=0.006)

    def test_adf_detecta_raiz_unitaria(self):
        rng = random.Random(42)
        paseo, ruido = [0.0], []
        for _ in range(300):
            paseo.append(paseo[-1] + rng.gauss(0, 1))
            ruido.append(rng.gauss(0, 1))
        self.assertFalse(adf(paseo)["estacionaria"])  # paseo aleatorio: no estacionario
        resultado = adf(ruido)
        self.assertTrue(resultado["estacionaria"])     # ruido blanco: estacionario
        self.assertLess(resultado["p_valor"], 0.01)

    def test_transformaciones(self):
        serie = {f"2020-{m:02d}-01": 100.0 + m for m in range(1, 13)}
        serie.update({f"2021-{m:02d}-01": 110.0 + m for m in range(1, 13)})
        interanual = transformar(serie, "interanual", "M")
        self.assertAlmostEqual(interanual["2021-01-01"], (111 / 101 - 1) * 100)
        self.assertNotIn("2020-12-01", interanual)
        del serie["2021-05-01"]  # hueco: la diferencia de junio no debe usar abril
        dif = transformar(serie, "diferencia", "M")
        self.assertNotIn("2021-06-01", dif)
        self.assertAlmostEqual(dif["2021-04-01"], 1.0)

    def test_correlacion_cruzada(self):
        rng = random.Random(3)
        fechas = [f"{2000 + i // 12}-{i % 12 + 1:02d}-01" for i in range(120)]
        base = [rng.gauss(0, 1) for _ in range(123)]
        x = dict(zip(fechas, base[3:]))
        y = dict(zip(fechas, base[:120]))  # y(t+3) = x(t): x se adelanta 3 meses
        mejor = max(correlacion_cruzada(y, x, fechas, 6), key=lambda c: c["r"])
        self.assertEqual(mejor["retardo"], -3)
        mejor = max(correlacion_cruzada(x, y, fechas, 6), key=lambda c: c["r"])
        self.assertEqual(mejor["retardo"], 3)
        self.assertTrue(mejor["significativa"])


if __name__ == "__main__":
    unittest.main()
