"""Descarga todos los datos de INE, Eurostat y BCE, los guarda y enseña un resumen.

Uso (desde la carpeta del proyecto):
    python scripts/actualizar_datos.py
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # para que se vean bien las tildes en Windows

from src import config  # noqa: E402
from src.etl import pipeline, storage  # noqa: E402


def barra(hechos: int, total: int, nombre: str) -> None:
    llenos = int(30 * hechos / total)
    print(f"\r[{'#' * llenos}{'.' * (30 - llenos)}] {hechos}/{total} {nombre[:45]:<45}", end="", flush=True)


def main() -> int:
    print("Descargando datos oficiales…")
    t0 = time.time()
    resultado = pipeline.ejecutar(progreso=barra)
    print(f"\nTerminado en {time.time() - t0:.1f} s\n")

    for fuente, estado in storage.estado_fuentes().items():
        icono = {"verde": "🟢", "ambar": "🟠", "rojo": "🔴"}[estado["semaforo"]]
        print(f"{icono} {fuente:<9} {estado['mensaje']}  ({resultado.filas[fuente]} datos)")
        for error in resultado.errores.get(fuente, []):
            print(f"     ✗ {error}")
    if isinstance(resultado.calendario, int):
        print(f"📅 Calendario: {resultado.calendario} publicaciones de INE y BCE")
    else:
        print(f"🟠 {resultado.calendario}")

    print(f"\n{'Fuente':<9} {'Indicador':<24} {'País':<4} {'Datos':>6}  {'Desde':<10}  {'Hasta':<10}  Último")
    for r in storage.resumen():
        print(f"{r['source']:<9} {r['indicator_id']:<24} {r['country_code']:<4} {r['n']:>6}  {r['primera']:<10}  "
              f"{r['ultima']:<10}  {r['ultimo_valor']:.2f} {r['unit']}")

    csv = storage.exportar_csv()
    print(f"\nBase de datos: {config.BASE_DATOS}\nCopia en CSV:  {csv}")
    return 0 if not any(resultado.errores.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
