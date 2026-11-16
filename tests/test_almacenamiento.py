"""Base de datos SQLite y preparación de datos para el análisis."""
import sqlite3
from contextlib import closing
from datetime import date

from src.econometrics.dataset import Variable, descriptivos, preparar
from src.etl import storage
from tests.base_temporal import MOMENTO, ConBaseTemporal, _obs


class Almacenamiento(ConBaseTemporal):
    def test_leer_con_filtros(self):
        filas = storage.leer(indicador="paro", paises=["ES"], desde="2020-01-01")
        self.assertEqual(len(filas), 12)
        self.assertEqual({f["country_code"] for f in filas}, {"ES"})
        self.assertEqual(filas[0]["date"], "2020-01-01")

    def test_guardar_reemplaza_el_mismo_dato(self):
        antes = len(storage.leer(indicador="paro"))
        storage.guardar([_obs("paro", "Tasa de paro", "ES", date(2020, 12, 1), 99.0)])
        filas = storage.leer(indicador="paro", paises=["ES"], desde="2020-12-01")
        self.assertEqual(len(storage.leer(indicador="paro")), antes)
        self.assertEqual(filas[0]["value"], 99.0)

    def test_ultimos_y_disponibles(self):
        ultimos = [f for f in storage.ultimos_valores(2) if f["indicator_id"] == "paro" and f["country_code"] == "ES"]
        self.assertEqual([f["date"] for f in ultimos], ["2020-12-01", "2020-11-01"])
        self.assertEqual(storage.disponibles()["paro"], ["EA", "ES"])
        self.assertEqual(storage.disponibles()["pib_var"], ["ES"])

    def test_semaforo(self):
        self.assertEqual(storage.estado_fuentes(horas_fresco=10_000_000)["INE"]["semaforo"], "verde")
        self.assertEqual(storage.estado_fuentes(horas_fresco=0)["INE"]["semaforo"], "ambar")  # datos «antiguos»
        storage.registrar_sincronizacion("EUROSTAT", MOMENTO, 5, 7, 100, ["a: error", "b: error"])
        storage.registrar_sincronizacion("BCE", MOMENTO, 0, 6, 0, ["sin conexión"])
        estado = storage.estado_fuentes(horas_fresco=10_000_000)
        self.assertEqual(estado["EUROSTAT"]["semaforo"], "ambar")
        self.assertIn("5 de 7", estado["EUROSTAT"]["mensaje"])
        self.assertEqual(estado["BCE"]["semaforo"], "rojo")

    def test_sin_sincronizaciones_es_rojo(self):
        with closing(sqlite3.connect(self.ruta)) as con, con:
            con.execute("DELETE FROM sincronizaciones")
        self.assertEqual(storage.estado_fuentes()["INE"]["semaforo"], "rojo")

    def test_csv_para_excel(self):
        ruta = storage.exportar_csv()
        texto = ruta.read_text("utf-8-sig").splitlines()
        self.assertTrue(texto[0].startswith("date;indicator_id;"))
        self.assertRegex(texto[1], r";\d+,\d+;")  # coma decimal


class Preparacion(ConBaseTemporal):
    def test_mezcla_mensual_y_trimestral(self):
        datos = preparar([Variable("pib_var", "ES"), Variable("paro", "ES")])
        self.assertEqual(datos.frecuencia, "Q")
        self.assertEqual(len(datos.fechas), 44)
        paro_mensual = [f["value"] for f in storage.leer(indicador="paro", paises=["ES"])][:3]
        self.assertAlmostEqual(datos.columnas[list(datos.columnas)[1]][0], sum(paro_mensual) / 3)

    def test_transformaciones_y_fechas(self):
        datos = preparar([Variable("paro", "ES", "diferencia"), Variable("paro", "EA", "interanual")], desde="2015-01-01")
        self.assertEqual(datos.fechas[0], "2015-01-01")
        self.assertEqual(len(datos.fechas), 72)
        self.assertIn("Primera diferencia", list(datos.columnas)[0])

    def test_pocos_datos(self):
        with self.assertRaises(ValueError):
            preparar([Variable("paro", "ES")], desde="2020-08-01")

    def test_indicador_sin_datos(self):
        with self.assertRaises(ValueError):
            preparar([Variable("ipc_general", "ES")])

    def test_descriptivos(self):
        d = descriptivos({"x": [1.0, 2.0, 3.0, 4.0, 5.0]})[0]
        self.assertEqual((d["n"], d["media"], d["mediana"], d["minimo"], d["maximo"]), (5, 3.0, 3.0, 1.0, 5.0))
        self.assertAlmostEqual(d["desviacion"], 1.5811, places=4)


if __name__ == "__main__":
    import unittest
    unittest.main()
