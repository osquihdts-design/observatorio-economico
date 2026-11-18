"""El catálogo de indicadores está bien formado (útil al añadir series nuevas)."""
import unittest

from src import config


class Catalogo(unittest.TestCase):
    def setUp(self):
        self.indicadores = config.todos_los_indicadores()

    def test_identificadores_unicos(self):
        ids = [i["id"] for i in self.indicadores]
        self.assertEqual(len(ids), len(set(ids)), "Hay indicadores con el mismo id")

    def test_campos_obligatorios(self):
        for i in self.indicadores:
            with self.subTest(indicador=i["id"]):
                for campo in ("id", "nombre", "unidad", "frecuencia", "fuente"):
                    self.assertTrue(i.get(campo), f"Falta «{campo}»")
                self.assertIn(i["frecuencia"], ("M", "Q"))
                self.assertIn(i["fuente"], ("INE", "EUROSTAT", "BCE"))

    def test_cada_fuente_sabe_donde_buscar(self):
        for i in self.indicadores:
            with self.subTest(indicador=i["id"]):
                if i["fuente"] == "INE":
                    self.assertRegex(i["serie"], r"^[A-Z]+\d+$")
                elif i["fuente"] == "EUROSTAT":
                    self.assertTrue(i["tramos"])
                    for tramo in i["tramos"]:
                        self.assertTrue(tramo["tabla"] and isinstance(tramo["filtros"], dict))
                else:
                    for pais, clave in i["series"].items():
                        self.assertIn(pais, config.PAISES)
                        self.assertIn("/", clave)

    def test_tramos_de_eurostat_no_se_solapan(self):
        for i in self.indicadores:
            tramos = i.get("tramos", [])
            for anterior, siguiente in zip(tramos, tramos[1:]):
                with self.subTest(indicador=i["id"]):
                    self.assertLess(anterior["hasta"], siguiente["desde"])


if __name__ == "__main__":
    unittest.main()
