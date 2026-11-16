"""Comprueba que el Excel generado es válido y que las citas tienen el formato APA."""
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from src.econometrics.dataset import Dataset
from src.econometrics.regression import ols
from src.reporting import xlsx
from src.reporting.exporter import cita_apa, exportar_informe

FICHA = {"indicator_id": "ipc_general", "indicator_name": "IPC general (variación anual)", "country_code": "ES",
         "country_name": "España", "unit": "%", "frequency": "M", "source": "INE", "series_code": "IPC290750",
         "last_updated": "2026-11-16T10:00:00+00:00", "nombre": "IPC", "transformacion": "Niveles"}


class Excel(unittest.TestCase):
    def test_xlsx_valido(self):
        with tempfile.TemporaryDirectory() as d:
            ruta = xlsx.escribir(Path(d) / "prueba.xlsx", [
                ("Hoja & <1>", [["Texto", "Número", "Fecha"], ["a & b", 1.5, date(2026, 1, 1)]], {0: xlsx.NEGRITA}),
            ])
            with zipfile.ZipFile(ruta) as z:
                for nombre in z.namelist():
                    if nombre.endswith((".xml", ".rels")):
                        ET.fromstring(z.read(nombre))  # falla si algún XML está mal formado
                hoja = z.read("xl/worksheets/sheet1.xml").decode()
                self.assertIn("a &amp; b", hoja)
                self.assertIn("<v>46023</v>", hoja)  # 1/1/2026 en número de serie de Excel

    def test_informe_completo(self):
        fechas = [f"20{10 + i // 4}-{(i % 4) * 3 + 1:02d}-01" for i in range(20)]
        datos = Dataset("Q", fechas, {"y": [float(i % 7) for i in range(20)], "x": [float(i % 5) for i in range(20)]},
                        [FICHA, {**FICHA, "nombre": "x"}])
        r = ols(datos.columnas["y"], {"x": datos.columnas["x"]}, fechas=fechas)
        with tempfile.TemporaryDirectory() as d:
            ruta = exportar_informe(Path(d) / "tfg.xlsx", datos, r, consulta=date(2026, 11, 16))
            with zipfile.ZipFile(ruta) as z:
                libro = z.read("xl/workbook.xml").decode()
            for hoja in ("Datos_Limpios", "Metadatos_Fuentes", "Resultados_Regresion", "Estadisticos_Descriptivos"):
                self.assertIn(hoja, libro)


class CitaAPA(unittest.TestCase):
    def test_formato(self):
        cita = cita_apa(FICHA, date(2026, 11, 16))
        self.assertEqual(
            cita,
            "Instituto Nacional de Estadística. (2026). IPC general (variación anual): España (serie IPC290750) "
            "[Conjunto de datos]. Recuperado el 16 de noviembre de 2026, de https://www.ine.es/consul/serie.do?s=IPC290750",
        )


if __name__ == "__main__":
    unittest.main()
