"""Base de datos temporal con datos inventados (deterministas) para los tests."""
import math
import random
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest import mock

from src import config
from src.connectors.base import Observacion
from src.etl import storage

MOMENTO = datetime(2026, 11, 16, 10, 0, tzinfo=timezone.utc)


def _obs(indicador, nombre, pais, fecha, valor, frecuencia="M", fuente="EUROSTAT", unidad="%"):
    return Observacion(date=fecha, indicator_id=indicador, indicator_name=nombre, country_code=pais,
                       country_name=config.NOMBRES[pais], value=valor, unit=unidad, frequency=frecuencia,
                       source=fuente, series_code=f"prueba_{indicador}", status=None, last_updated=MOMENTO)


def datos_de_prueba() -> list[Observacion]:
    rng = random.Random(2026)  # «aleatorio» pero siempre igual: los tests dan siempre el mismo resultado
    obs = []
    for i in range(132):  # 2010-01 a 2020-12
        f = date(2010 + i // 12, i % 12 + 1, 1)
        for pais, nivel in (("ES", 15.0), ("EA", 9.0)):
            paro = nivel + 3 * math.sin(i / 20) + rng.gauss(0, 0.2)
            obs.append(_obs("paro", "Tasa de paro", pais, f, paro))
            obs.append(_obs("iapc_subyacente", "Inflación subyacente", pais, f, 4.0 - 0.2 * paro + rng.gauss(0, 0.1)))
        obs.append(_obs("bce_deposito", "Tipo BCE: facilidad de depósito", "EA", f, max(0.0, 1.0 - i / 60), fuente="BCE"))
    for q in range(44):  # 2010-T1 a 2020-T4
        f = date(2010 + q // 4, (q % 4) * 3 + 1, 1)
        obs.append(_obs("pib_var", "PIB real (variación interanual)", "ES", f, 1.5 + math.sin(q / 4), frecuencia="Q"))
    return obs


class ConBaseTemporal(unittest.TestCase):
    """Cada test usa su propia base de datos en una carpeta temporal."""

    def setUp(self):
        self._carpeta = tempfile.TemporaryDirectory()
        self.ruta = Path(self._carpeta.name) / "prueba.sqlite"
        self._parche = mock.patch.multiple(config, BASE_DATOS=self.ruta, CARPETA_DATOS=Path(self._carpeta.name))
        self._parche.start()
        storage.guardar(datos_de_prueba())
        for fuente in ("INE", "EUROSTAT", "BCE"):
            storage.registrar_sincronizacion(fuente, MOMENTO, 1, 1, 10, [])

    def tearDown(self):
        self._parche.stop()
        self._carpeta.cleanup()
