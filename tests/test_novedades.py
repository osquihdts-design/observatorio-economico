"""Novedades del día: detección de datos nuevos, una entrada al día como mucho y RSS válido."""
import unittest
import xml.etree.ElementTree as ET
from datetime import date

from src import novedades

WEB = "https://ejemplo.org/"


def fila(ind, pais, fecha, valor, anterior=None, unidad="%", frecuencia="M", fuente="INE"):
    return {"indicador": ind, "nombre": ind.upper(), "pais": pais, "pais_nombre": pais, "fecha": fecha, "valor": valor,
            "anterior": anterior, "unidad": unidad, "frecuencia": frecuencia, "fuente": fuente}


AYER = [fila("ipc", "ES", "2026-09-01", 4.7), fila("paro", "EA", "2026-08-01", 6.5), fila("paro", "DE", "2026-08-01", 3.9)]
HOY = [fila("ipc", "ES", "2026-10-01", 4.9, 4.7), fila("paro", "EA", "2026-08-01", 6.5),
       fila("paro", "DE", "2026-09-01", 4.0, 3.9), fila("nuevo", "ES", "2026-10-01", 1.0)]


class TestNovedades(unittest.TestCase):
    def test_solo_periodos_nuevos_de_los_paises_foco(self):
        nuevas = novedades.detectar(HOY, AYER)
        # Alemania no está entre los países del boletín; «nuevo» no existía ayer; el paro de la zona euro no cambió.
        self.assertEqual([(f["indicador"], f["pais"]) for f in nuevas], [("ipc", "ES")])

    def test_sin_resumen_anterior_no_hay_novedades(self):
        self.assertEqual(novedades.detectar(HOY, None), [])
        self.assertIsNone(novedades.entrada([], [], date(2026, 11, 20), WEB))

    def test_tipos_del_bce_solo_si_cambian(self):
        ayer = [fila("bce_deposito", "EA", "2026-10-01", 2.5, fuente="BCE")]
        self.assertEqual(novedades.detectar([fila("bce_deposito", "EA", "2026-11-01", 2.5, fuente="BCE")], ayer), [])
        cambio = novedades.detectar([fila("bce_deposito", "EA", "2026-11-01", 2.25, fuente="BCE")], ayer)
        self.assertEqual(cambio[0]["anterior"], 2.5)

    def test_texto_descriptivo(self):
        e = novedades.entrada(novedades.detectar(HOY, AYER), [], date(2026, 11, 20), WEB)
        self.assertEqual(e["id"], "2026-11-20")
        self.assertIn("IPC · ES · octubre de 2026: 4,9 % (periodo anterior: 4,7 %). Fuente: INE.", e["texto"])
        self.assertTrue(e["titulo"].startswith("1 dato oficial nuevo"))

    def test_formatos(self):
        self.assertEqual(novedades.periodo_texto("2026-07-01", "Q"), "3.er trimestre de 2026")
        self.assertEqual(novedades.periodo_texto("2025-01-01", "A"), "2025")
        self.assertEqual(novedades.numero(1234.4, "€"), "1.234 €")
        self.assertEqual(novedades.numero(2.15, "%"), "2,15 %")

    def test_una_entrada_al_dia(self):
        dia = date(2026, 11, 20)
        primera = novedades.entrada([fila("ipc", "ES", "2026-10-01", 4.9)], [], dia, WEB)
        historial = novedades.combinar([], primera)
        # Segunda publicación el mismo día con otro dato: se suman en la misma entrada.
        juntas = novedades.sumar_del_dia(historial, [fila("paro", "EA", "2026-09-01", 6.5)], dia)
        historial = novedades.combinar(historial, novedades.entrada(juntas, [], dia, WEB))
        self.assertEqual(len(historial), 1)
        self.assertEqual(len(historial[0]["datos"]), 2)
        # Un día sin novedades conserva el historial tal cual.
        self.assertEqual(novedades.combinar(historial, None), historial)

    def test_rss_valido(self):
        e = novedades.entrada(novedades.detectar(HOY, AYER), [{"fecha": "2026-11-27", "fuente": "INE", "titulo": "IPC & más", "periodo": "Nov"}],
                              date(2026, 11, 20), WEB)
        raiz = ET.fromstring(novedades.rss([e], WEB))
        items = raiz.findall("./channel/item")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].findtext("guid"), "observatorio-2026-11-20")
        self.assertIn("IPC &amp; más", items[0].findtext("description"))


if __name__ == "__main__":
    unittest.main()
