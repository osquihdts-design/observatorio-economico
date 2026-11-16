"""Conectores con respuestas grabadas (mismo formato que las APIs reales): no necesitan internet."""
import json
import unittest
from datetime import date
from unittest import mock

from src.connectors import ecb_client, eurostat_client, ine_client
from src.connectors.base import ErrorFuente

# ----------------------------------------------------------------------------- Respuestas grabadas

INE_RESPUESTA = {
    "COD": "IPC290750",
    "Nombre": "Nacional. Índice general. Variación anual.",
    "Data": [
        {"Fecha": "2026-08-01T00:00:00.000+02:00", "TipoDato": {"Nombre": "Definitivo", "Codigo": "D"}, "Anyo": 2026, "Valor": 4.3},
        {"Fecha": "2026-09-01T00:00:00.000+02:00", "TipoDato": {"Nombre": "Provisional", "Codigo": "P"}, "Anyo": 2026, "Valor": 4.9},
        {"Fecha": "2026-10-01T00:00:00.000+02:00", "Anyo": 2026, "Valor": 9.9, "Secreto": True},
        {"Fecha": "2026-11-01T00:00:00.000+01:00", "Anyo": 2026, "Valor": None},
    ],
}


def jsonstat(geos, tiempos, valores, estados=None, extra_dims=("freq", "unit")):
    """Construye una respuesta JSON-stat 2.0 como la de Eurostat."""
    ids = [*extra_dims, "geo", "time"]
    dimension = {d: {"category": {"index": {"X": 0}}} for d in extra_dims}
    dimension["geo"] = {"category": {"index": {g: i for i, g in enumerate(geos)}}}
    dimension["time"] = {"category": {"index": {t: i for i, t in enumerate(tiempos)}}}
    return {"id": ids, "size": [1] * len(extra_dims) + [len(geos), len(tiempos)], "dimension": dimension,
            "value": valores, "status": estados or {}, "updated": "2026-11-10T23:00:00+0100"}


# Tabla vieja: la zona euro solo aparece como EA21; trae un dato de 2026 que debe ignorarse.
EUROSTAT_VIEJA = jsonstat(["EA21", "ES"], ["2025-11", "2025-12", "2026-01"],
                          {"0": 2.1, "1": 2.0, "2": 9.0, "3": 3.0, "4": 3.1, "5": 9.0}, {"4": "p"})
# Tabla nueva: la zona euro aparece como EA y como EA21 → se usa «EA», el primero de la lista.
EUROSTAT_NUEVA = jsonstat(["EA", "EA21", "ES"], ["2026-01", "2026-02"],
                          {"0": 2.2, "1": 2.3, "2": 7.0, "3": 7.0, "4": 3.2, "5": 3.3})

BCE_CSV = """KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE
FM.D.U2.EUR.4F.KR.DFR.LEV,D,2026-01-05,2.00,Deposit facility
FM.D.U2.EUR.4F.KR.DFR.LEV,D,2026-01-30,2.00,Deposit facility
FM.D.U2.EUR.4F.KR.DFR.LEV,D,2026-02-02,2.00,Deposit facility
FM.D.U2.EUR.4F.KR.DFR.LEV,D,2026-02-27,2.25,Deposit facility
FM.D.U2.EUR.4F.KR.DFR.LEV,D,2026-03-02,,Deposit facility
"""


class INE(unittest.TestCase):
    IND = {"id": "ipc_general", "nombre": "IPC general", "unidad": "%", "frecuencia": "M", "serie": "IPC290750"}

    def test_descarga(self):
        with mock.patch.object(ine_client, "descargar", return_value=json.dumps(INE_RESPUESTA).encode()) as d:
            obs = ine_client.descargar_indicador(self.IND, desde="2026-01")
        url, params = d.call_args.args
        self.assertTrue(url.endswith("DATOS_SERIE/IPC290750"))
        self.assertIn(("det", "2"), params)
        self.assertIn(("tip", "AM"), params)
        self.assertIn(("date", "20260101:"), params)
        # Se saltan el dato secreto y el vacío.
        self.assertEqual([(o.date, o.value, o.status) for o in obs],
                         [(date(2026, 8, 1), 4.3, "definitivo"), (date(2026, 9, 1), 4.9, "provisional")])
        self.assertEqual({o.country_code for o in obs}, {"ES"})
        self.assertEqual(obs[0].source, "INE")

    def test_fecha_en_milisegundos(self):
        # 1 de agosto de 2026 a medianoche de Madrid = 31 de julio a las 22:00 UTC
        self.assertEqual(ine_client._fecha(1785535200000), date(2026, 8, 1))
        self.assertEqual(ine_client._fecha("2026-07-01T00:00:00.000+02:00"), date(2026, 7, 1))

    def test_respuesta_vacia(self):
        with mock.patch.object(ine_client, "descargar", return_value=json.dumps({"COD": "X", "Data": []}).encode()):
            with self.assertRaises(ErrorFuente):
                ine_client.descargar_indicador(self.IND)


class Eurostat(unittest.TestCase):
    IND = {"id": "iapc_general", "nombre": "IAPC", "unidad": "%", "frecuencia": "M", "tramos": [
        {"tabla": "prc_hicp_manr", "filtros": {"coicop": "CP00"}, "hasta": "2025-12"},
        {"tabla": "prc_hicp_minr", "filtros": {"coicop18": "TOTAL"}, "desde": "2026-01"},
    ]}

    def test_parser_jsonstat(self):
        datos, actualizado = eurostat_client.parsear_jsonstat(EUROSTAT_VIEJA)
        self.assertEqual(datos["ES"], [("2025-11", 3.0, None), ("2025-12", 3.1, "provisional"), ("2026-01", 9.0, None)])
        self.assertEqual(actualizado.year, 2026)

    def test_une_tablas_y_zona_euro(self):
        def falsa(url, params):
            return json.dumps(EUROSTAT_VIEJA if "manr" in url else EUROSTAT_NUEVA).encode()

        with mock.patch.object(eurostat_client, "descargar", side_effect=falsa):
            obs = eurostat_client.descargar_indicador(self.IND, desde="2025-11")
        por_pais = {}
        for o in obs:
            por_pais.setdefault(o.country_code, []).append((o.date.isoformat()[:7], o.value))
        self.assertEqual(por_pais["ES"], [("2025-11", 3.0), ("2025-12", 3.1), ("2026-01", 3.2), ("2026-02", 3.3)])
        self.assertEqual(por_pais["EA"], [("2025-11", 2.1), ("2025-12", 2.0), ("2026-01", 2.2), ("2026-02", 2.3)])
        self.assertNotIn(9.0, [v for s in por_pais.values() for _, v in s])  # el dato de 2026 de la tabla vieja se descarta
        self.assertNotIn(7.0, [v for s in por_pais.values() for _, v in s])  # EA21 de la tabla nueva no se usa

    def test_trimestres(self):
        self.assertEqual(eurostat_client._fecha("2026-Q3"), date(2026, 7, 1))
        self.assertEqual(eurostat_client._desde("2026-05", "Q"), "2026-Q2")


class BCE(unittest.TestCase):
    def test_diaria_a_mensual(self):
        ind = {"id": "bce_deposito", "nombre": "Depósito", "unidad": "%", "frecuencia": "M",
               "series": {"EA": "FM/D.U2.EUR.4F.KR.DFR.LEV"}}
        with mock.patch.object(ecb_client, "descargar", return_value=BCE_CSV.encode()):
            obs = ecb_client.descargar_indicador(ind)
        # Último valor de cada mes; la fila sin valor (marzo) se ignora.
        self.assertEqual([(o.date, o.value) for o in obs], [(date(2026, 1, 1), 2.0), (date(2026, 2, 1), 2.25)])
        self.assertEqual(obs[0].country_name, "Zona euro")

    def test_varios_paises(self):
        ind = {"id": "tipo_hipotecas", "nombre": "Hipotecas", "unidad": "%", "frecuencia": "M",
               "series": {"ES": "MIR/M.ES.X", "EA": "MIR/M.U2.X"}}
        csv_es = "TIME_PERIOD,OBS_VALUE\n2026-09,2.99\n"
        csv_ea = "TIME_PERIOD,OBS_VALUE\n2026-09,3.62\n"
        with mock.patch.object(ecb_client, "descargar", side_effect=lambda url, p: (csv_es if ".ES." in url else csv_ea).encode()):
            obs = ecb_client.descargar_indicador(ind)
        self.assertEqual(sorted((o.country_code, o.value) for o in obs), [("EA", 3.62), ("ES", 2.99)])


if __name__ == "__main__":
    unittest.main()
