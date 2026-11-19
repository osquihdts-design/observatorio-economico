"""Calendario de publicaciones (INE y BCE) y previsiones oficiales, con respuestas grabadas en el formato real."""
import unittest

from src import config, previsiones
from src.connectors import calendario
from src.etl import storage
from tests.base_temporal import ConBaseTemporal
from tests.test_api import ServidorDePrueba

# Fragmento del archivo iCalendar del INE (las líneas largas siguen en la siguiente con un espacio).
ICS_INE = """BEGIN:VCALENDAR\r
VERSION:2.0\r
BEGIN:VEVENT\r
UID:1@tempus.ine.es\r
DTSTART;TZID=Europe/Madrid:20261127T090000\r
SUMMARY:Índice de Precios de Consumo. Avance. Noviembre 2026\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20261215T090000\r
SUMMARY:Índice de Precios de Consumo. Noviembre 2026\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20261215T090000\r
SUMMARY:Índices de Precios de Consumo Armonizado. Noviembre 2026\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20261223T090000\r
SUMMARY:Contabilidad Nacional Trimestral de España. Trimes\r
 tre 3/2026\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20270128T090000\r
SUMMARY:Encuesta de Población Activa. Trimestre 4/2026\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20260210T090000\r
SUMMARY:Índices de Comercio al por menor. Ponderaciones. Año 2025\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/Madrid:20261125T090000\r
SUMMARY:Encuesta de población activa. Decil de salarios del empleo principal. Año 2025\r
END:VEVENT\r
END:VCALENDAR\r
"""

# Fragmento de la página de reuniones del BCE.
HTML_BCE = """<dl><dt>16/12/2026</dt><dd>Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 1)</dd>
<dt>17/12/2026</dt><dd>Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2), followed by press conference</dd>
<dt>24/02/2027</dt><dd>Governing Council of the ECB: non-monetary policy meeting (virtual)</dd>
<dt>04/02/2027</dt><dd>Governing Council of the ECB: monetary policy meeting in Frankfurt (Day 2), followed by press conference</dd>
<script>var x = "01/01/2030";</script></dl>"""


class Calendario(unittest.TestCase):
    def test_ine(self):
        ev = calendario.leer_ics_ine(ICS_INE)
        self.assertEqual([(e["fecha"], e["titulo"], e["periodo"]) for e in ev], [
            ("2026-11-27", "IPC adelantado", "Noviembre 2026"),
            ("2026-12-15", "IPC", "Noviembre 2026"),
            ("2026-12-23", "PIB trimestral", "Trimestre 3/2026"),  # la línea partida se une
            ("2027-01-28", "EPA (paro y empleo)", "Trimestre 4/2026"),
        ])  # sin IPCA (mismo día que el IPC), ponderaciones ni deciles
        self.assertEqual(ev[0]["hora"], "09:00")
        self.assertEqual(ev[3]["pagina"], "laboral")

    def test_bce(self):
        ev = calendario.leer_pagina_bce(HTML_BCE)
        self.assertEqual([e["fecha"] for e in ev], ["2026-12-17", "2027-02-04"])  # solo el día 2, con rueda de prensa
        self.assertEqual({e["hora"] for e in ev}, {"14:15"})


class CalendarioGuardado(ConBaseTemporal):
    def test_guardar_y_leer(self):
        eventos = calendario.leer_ics_ine(ICS_INE) + calendario.leer_pagina_bce(HTML_BCE)
        self.assertEqual(storage.guardar_calendario(eventos), 6)
        self.assertEqual([e["fecha"] for e in storage.leer_calendario("2026-12-16")], ["2026-12-17", "2026-12-23", "2027-01-28", "2027-02-04"])
        storage.guardar_calendario(eventos[:1])  # cada descarga sustituye a la anterior
        self.assertEqual(len(storage.leer_calendario("2000-01-01")), 1)


class Previsiones(unittest.TestCase):
    def test_estructura(self):
        indicadores = {i["id"] for i in config.todos_los_indicadores()}
        for p in previsiones.PREVISIONES:
            self.assertTrue(set(p["valores"]) <= indicadores, p["id"])
            self.assertTrue(p["url"].startswith("https://"))
            self.assertRegex(p["fecha"], r"^\d{4}-\d{2}-\d{2}$")

    def test_vigentes_una_por_organismo_y_anios_como_texto(self):
        v = previsiones.vigentes()
        self.assertEqual(len(v), len({(p["organismo"], p["pais"]) for p in previsiones.PREVISIONES}))
        bce = next(p for p in v if p["organismo"] == "BCE")
        self.assertEqual(bce["valores"]["iapc_general"], {"2026": 3.0, "2027": 2.5, "2028": 2.1})


class APICalendario(ServidorDePrueba):
    def test_previsiones_y_calendario(self):
        self.assertEqual(len(self.get("/api/previsiones")["previsiones"]), len(previsiones.vigentes()))
        storage.guardar_calendario(calendario.leer_pagina_bce(HTML_BCE))
        self.assertEqual([e["fecha"] for e in self.get("/api/calendario?desde=2027-01-01")["eventos"]], ["2027-02-04"])
