"""Indicadores anuales de Eurostat (jóvenes y tecnología) y agregado UE-27, con una respuesta grabada en formato JSON-stat."""
import json
import unittest
from datetime import date
from unittest import mock

from src import config
from src.connectors import eurostat_client

# Respuesta mínima con la forma real de la API: España, UE-27 y años sueltos.
RESPUESTA = {
    "id": ["freq", "unit", "geo", "time"], "size": [1, 1, 2, 3],
    "dimension": {
        "freq": {"category": {"index": {"A": 0}}}, "unit": {"category": {"index": {"PC": 0}}},
        "geo": {"category": {"index": {"ES": 0, "EU27_2020": 1}}},
        "time": {"category": {"index": {"2023": 0, "2024": 1, "2025": 2}}},
    },
    "value": {"0": 12.3, "1": 11.9, "2": 11.5, "3": 11.2, "4": 11.0, "5": 11.0},
    "status": {"2": "p"},
    "updated": "2026-10-30T23:00:00+0100",
}


class EurostatAnual(unittest.TestCase):
    def test_fechas_anuales(self):
        self.assertEqual(eurostat_client._fecha("2025"), date(2025, 1, 1))
        self.assertEqual(eurostat_client._desde("2000-01", "A"), "2000")

    def test_indicador_anual_con_ue27(self):
        ind = next(i for i in config.todos_los_indicadores() if i["id"] == "ninis")
        with mock.patch.object(eurostat_client, "descargar", return_value=json.dumps(RESPUESTA).encode()) as llamada:
            obs = eurostat_client.descargar_indicador(ind)
        self.assertIn(("geo", "EU27_2020"), llamada.call_args.args[1])  # se pide la UE-27
        self.assertIn(("sinceTimePeriod", "2000"), llamada.call_args.args[1])  # formato de año
        por_pais = {(o.country_code, o.date.year): o for o in obs}
        self.assertEqual(por_pais[("ES", 2025)].value, 11.5)
        self.assertEqual(por_pais[("ES", 2025)].status, "provisional")
        self.assertEqual(por_pais[("UE", 2025)].country_name, "Unión Europea (27)")
        self.assertEqual({o.frequency for o in obs}, {"A"})
