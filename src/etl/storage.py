"""Almacenamiento en SQLite (viene incluido en Python) en data/processed/observatorio.sqlite.

Tablas:
  observaciones   todos los datos, con el esquema común (una fila por indicador, país y fecha)
  sincronizaciones  registro de cada actualización por fuente, para el semáforo de estado
"""
from __future__ import annotations

import csv
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from .. import config
from ..connectors.base import Observacion

COLUMNAS = [
    "date", "indicator_id", "indicator_name", "country_code", "country_name", "value",
    "unit", "frequency", "source", "series_code", "status", "last_updated",
]

ESQUEMA = """
CREATE TABLE IF NOT EXISTS observaciones (
    date           TEXT NOT NULL,
    indicator_id   TEXT NOT NULL,
    indicator_name TEXT NOT NULL,
    country_code   TEXT NOT NULL,
    country_name   TEXT NOT NULL,
    value          REAL NOT NULL,
    unit           TEXT NOT NULL,
    frequency      TEXT NOT NULL,
    source         TEXT NOT NULL,
    series_code    TEXT NOT NULL,
    status         TEXT,
    last_updated   TEXT NOT NULL,
    PRIMARY KEY (indicator_id, country_code, date)
);
CREATE INDEX IF NOT EXISTS idx_obs_fuente ON observaciones (source);
CREATE TABLE IF NOT EXISTS sincronizaciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    started     TEXT NOT NULL,
    finished    TEXT NOT NULL,
    ok          INTEGER NOT NULL,
    indicators_ok    INTEGER NOT NULL,
    indicators_total INTEGER NOT NULL,
    rows        INTEGER NOT NULL,
    errors      TEXT
);
CREATE TABLE IF NOT EXISTS calendario (
    fecha   TEXT NOT NULL,
    hora    TEXT,
    fuente  TEXT NOT NULL,
    titulo  TEXT NOT NULL,
    periodo TEXT NOT NULL,
    detalle TEXT,
    pagina  TEXT,
    url     TEXT,
    PRIMARY KEY (fecha, titulo, periodo)
);
"""


def conectar(ruta: Path | None = None) -> sqlite3.Connection:
    """Abre la base de datos. Sin `ruta`, usa la de config.BASE_DATOS (leída en el momento,
    así los tests pueden apuntar a una base temporal)."""
    ruta = Path(ruta or config.BASE_DATOS)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(ruta)
    con.row_factory = sqlite3.Row
    con.executescript(ESQUEMA)
    return con


def guardar(observaciones: list[Observacion], ruta: Path | None = None) -> int:
    """Inserta o actualiza (si ya existía ese indicador-país-fecha). Devuelve cuántas filas."""
    filas = [tuple(o.como_dict()[c] for c in COLUMNAS) for o in observaciones]
    marcas = ", ".join("?" * len(COLUMNAS))
    with closing(conectar(ruta)) as con, con:
        con.executemany(f"INSERT OR REPLACE INTO observaciones ({', '.join(COLUMNAS)}) VALUES ({marcas})", filas)
    return len(filas)


def registrar_sincronizacion(fuente: str, inicio: datetime, ok: int, total: int, filas: int,
                             errores: list[str], ruta: Path | None = None) -> None:
    with closing(conectar(ruta)) as con, con:
        con.execute(
            "INSERT INTO sincronizaciones (source, started, finished, ok, indicators_ok, indicators_total, rows, errors) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (fuente, inicio.isoformat(timespec="seconds"), datetime.now(timezone.utc).isoformat(timespec="seconds"),
             int(ok == total), ok, total, filas, "\n".join(errores) or None),
        )


def leer(indicador: str | None = None, paises: list[str] | None = None, desde: str | None = None,
         ruta: Path | None = None) -> list[dict]:
    """Datos filtrados, ordenados por indicador, país y fecha."""
    condiciones, valores = [], []
    if indicador:
        condiciones.append("indicator_id = ?")
        valores.append(indicador)
    if paises:
        condiciones.append(f"country_code IN ({', '.join('?' * len(paises))})")
        valores += paises
    if desde:
        condiciones.append("date >= ?")
        valores.append(desde)
    donde = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    with closing(conectar(ruta)) as con:
        filas = con.execute(f"SELECT * FROM observaciones {donde} ORDER BY indicator_id, country_code, date", valores)
        return [dict(f) for f in filas]


def resumen(ruta: Path | None = None) -> list[dict]:
    """Una fila por indicador y país: nº de datos, primera y última fecha y último valor."""
    consulta = """
        SELECT o.source, o.indicator_id, o.indicator_name, o.country_code, o.unit, o.frequency,
               COUNT(*) AS n, MIN(o.date) AS primera, MAX(o.date) AS ultima,
               (SELECT value FROM observaciones u WHERE u.indicator_id = o.indicator_id
                  AND u.country_code = o.country_code ORDER BY date DESC LIMIT 1) AS ultimo_valor
        FROM observaciones o
        GROUP BY o.indicator_id, o.country_code
        ORDER BY o.source, o.indicator_id, o.country_code
    """
    with closing(conectar(ruta)) as con:
        return [dict(f) for f in con.execute(consulta)]


def ultimos_valores(cuantos: int = 2, ruta: Path | None = None) -> list[dict]:
    """Los `cuantos` datos más recientes de cada indicador y país (para tarjetas y tablas resumen)."""
    consulta = """
        SELECT * FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY indicator_id, country_code ORDER BY date DESC) AS orden
            FROM observaciones
        ) WHERE orden <= ? ORDER BY source, indicator_id, country_code, orden
    """
    with closing(conectar(ruta)) as con:
        return [dict(f) for f in con.execute(consulta, (cuantos,))]


def disponibles(ruta: Path | None = None) -> dict[str, list[str]]:
    """Qué países tiene cada indicador: {indicador: [países]}."""
    with closing(conectar(ruta)) as con:
        resultado: dict[str, list[str]] = {}
        for f in con.execute("SELECT DISTINCT indicator_id, country_code FROM observaciones ORDER BY 1, 2"):
            resultado.setdefault(f["indicator_id"], []).append(f["country_code"])
        return resultado


def estado_fuentes(ruta: Path | None = None, horas_fresco: float = 24) -> dict[str, dict]:
    """Semáforo por fuente a partir de su última sincronización.

    verde: todo bien y hace menos de `horas_fresco` horas
    ámbar: algún indicador falló, o los datos son más antiguos
    rojo:  la última actualización falló entera (o nunca se ha hecho)
    """
    estados = {}
    with closing(conectar(ruta)) as con:
        for fuente in ("INE", "EUROSTAT", "BCE"):
            fila = con.execute(
                "SELECT * FROM sincronizaciones WHERE source = ? ORDER BY id DESC LIMIT 1", (fuente,)
            ).fetchone()
            if not fila:
                estados[fuente] = {"semaforo": "rojo", "mensaje": "Nunca se ha descargado", "cuando": None}
                continue
            fin = datetime.fromisoformat(fila["finished"])
            horas = (datetime.now(timezone.utc) - fin).total_seconds() / 3600
            if fila["indicators_ok"] == 0:
                semaforo, mensaje = "rojo", "La última actualización falló"
            elif not fila["ok"]:
                semaforo, mensaje = "ambar", f"{fila['indicators_ok']} de {fila['indicators_total']} indicadores actualizados"
            elif horas > horas_fresco:
                semaforo, mensaje = "ambar", f"Datos de hace {horas:.0f} horas"
            else:
                semaforo, mensaje = "verde", "Actualizado"
            estados[fuente] = {"semaforo": semaforo, "mensaje": mensaje, "cuando": fila["finished"], "errores": fila["errors"]}
    return estados


CAMPOS_CALENDARIO = ["fecha", "hora", "fuente", "titulo", "periodo", "detalle", "pagina", "url"]


def guardar_calendario(eventos: list[dict], ruta: Path | None = None) -> int:
    """Sustituye el calendario de próximas publicaciones por el recién descargado."""
    with closing(conectar(ruta)) as con, con:
        con.execute("DELETE FROM calendario")
        con.executemany(f"INSERT OR REPLACE INTO calendario VALUES ({', '.join('?' * len(CAMPOS_CALENDARIO))})",
                        [tuple(e.get(c) for c in CAMPOS_CALENDARIO) for e in eventos])
    return len(eventos)


def leer_calendario(desde: str, ruta: Path | None = None) -> list[dict]:
    """Publicaciones a partir de una fecha (AAAA-MM-DD), por orden."""
    with closing(conectar(ruta)) as con:
        return [dict(f) for f in con.execute("SELECT * FROM calendario WHERE fecha >= ? ORDER BY fecha, hora, titulo", (desde,))]


def exportar_csv(destino: Path | None = None, ruta: Path | None = None) -> Path:
    """Copia completa en CSV (separador «;» y coma decimal, para Excel en español)."""
    filas = leer(ruta=ruta)
    destino = Path(destino or config.CARPETA_DATOS / "observaciones.csv")
    destino.parent.mkdir(parents=True, exist_ok=True)
    with destino.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLUMNAS)
        for fila in filas:
            w.writerow([str(fila[c]).replace(".", ",") if c == "value" else ("" if fila[c] is None else fila[c]) for c in COLUMNAS])
    return destino
