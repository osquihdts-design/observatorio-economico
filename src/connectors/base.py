"""Piezas comunes a todos los conectores: el formato de cada dato y las descargas HTTP."""
from __future__ import annotations

import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone

USER_AGENT = "observatorio-economico/1.0 (Python urllib)"


@dataclass(frozen=True)
class Observacion:
    """Un dato. Todas las fuentes se convierten a este mismo esquema.

    date          primer día del periodo (mes o trimestre)
    frequency     M (mensual), Q (trimestral) o A (anual)
    status        estado del dato en la fuente (p. ej. «provisional»), si lo indica
    series_code   código exacto de la serie en la fuente, para poder citarla
    last_updated  cuándo actualizó la fuente esa serie (o cuándo se descargó)
    """

    date: date
    indicator_id: str
    indicator_name: str
    country_code: str
    country_name: str
    value: float
    unit: str
    frequency: str
    source: str
    series_code: str
    status: str | None
    last_updated: datetime

    def como_dict(self) -> dict:
        d = asdict(self)
        d["date"] = self.date.isoformat()
        d["last_updated"] = self.last_updated.isoformat(timespec="seconds")
        return d


class ErrorFuente(Exception):
    """La fuente no respondió o devolvió algo inesperado."""


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def primer_dia(anio: int, mes: int) -> date:
    return date(anio, mes, 1)


def descargar(url: str, params: list[tuple[str, str]] | None = None, intentos: int = 3, timeout: int = 90) -> bytes:
    """GET con reintentos: si falla por la red o por un error del servidor (5xx), espera y lo repite."""
    completa = url + ("?" + urllib.parse.urlencode(params) if params else "")
    peticion = urllib.request.Request(completa, headers={"User-Agent": USER_AGENT})
    ultimo_error: Exception | None = None
    for intento in range(intentos):
        try:
            with urllib.request.urlopen(peticion, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500:  # 4xx: la petición está mal, repetirla no sirve
                detalle = e.read()[:300].decode("utf-8", "replace")
                raise ErrorFuente(f"HTTP {e.code} en {completa}: {detalle}") from e
            ultimo_error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            ultimo_error = e
        time.sleep(2 ** intento)
    raise ErrorFuente(f"Sin respuesta de {completa}: {ultimo_error}")
