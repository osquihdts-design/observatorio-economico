"""Comprueba que los datos del panel coinciden con los de las fuentes oficiales.

Para cada indicador pide a la API oficial (INE, Eurostat o BCE) solo el último dato publicado,
con una consulta propia y más sencilla que la del conector, y lo compara con lo guardado en el panel:

  ✔ coincide         mismo periodo y mismo valor (diferencia ≤ 0,01 por redondeo)
  ↻ dato nuevo       la fuente ya tiene un periodo más reciente (se cargará en la próxima actualización)
  ✘ no coincide      mismo periodo con distinto valor (o el dato falta): hay que revisarlo

Guarda el resultado en data/processed/verificacion.json (la web lo muestra en «Sobre el proyecto»).

Uso:
    python scripts/verificar_datos.py
"""
from __future__ import annotations

import csv
import io
import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from src import config  # noqa: E402
from src.etl import storage  # noqa: E402

AGENTE = {"User-Agent": "observatorio-economico/verificacion (Python urllib)"}
TOLERANCIA = 0.011


def pedir(url: str, params: list[tuple[str, str]]) -> bytes:
    completa = url + "?" + urllib.parse.urlencode(params)
    for intento in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(completa, headers=AGENTE), timeout=60) as r:
                return r.read()
        except Exception:
            if intento == 2:
                raise
            time.sleep(2 * (intento + 1))
    raise RuntimeError("inalcanzable")


# ----------------------------------------------------------------------------- Último dato oficial de cada fuente

def eurostat(ind: dict, geo: str) -> tuple[str, float] | None:
    tramo = ind["tramos"][-1]
    # Los últimos periodos de la tabla (el más reciente puede no tener aún dato de este país) y nos quedamos con el último que lo tenga.
    params = [("format", "JSON"), ("lang", "EN"), ("lastTimePeriod", "4"), ("geo", geo)] + list(tramo["filtros"].items())
    j = json.loads(pedir(f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{tramo['tabla']}", params))
    valores = j.get("value") or {}
    if not valores:
        return None
    indice = j["dimension"]["time"]["category"]["index"]
    periodos = sorted(indice, key=indice.get) if isinstance(indice, dict) else list(indice)
    # Con un solo país y filtros fijos, la posición del valor es la posición del periodo.
    ultimo = max(int(k) for k in valores)
    return periodos[ultimo % len(periodos)], float(valores[str(ultimo)])


def ine(ind: dict) -> tuple[str, float] | None:
    datos = json.loads(pedir(f"https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/{ind['serie']}", [("nult", "1")]))
    punto = (datos.get("Data") or [None])[-1]
    if not punto or punto.get("Valor") is None:
        return None
    fecha = datetime.fromtimestamp(punto["Fecha"] / 1000 + 12 * 3600, tz=timezone.utc)
    return f"{fecha.year}-{fecha.month:02d}", float(punto["Valor"])


def bce(clave: str) -> tuple[str, float] | None:
    texto = pedir(f"https://data-api.ecb.europa.eu/service/data/{clave}", [("format", "csvdata"), ("lastNObservations", "1")]).decode("utf-8")
    filas = [f for f in csv.DictReader(io.StringIO(texto)) if f.get("OBS_VALUE")]
    if not filas:
        return None
    return filas[-1]["TIME_PERIOD"], float(filas[-1]["OBS_VALUE"])


# ----------------------------------------------------------------------------- Comparación con el panel

def periodo_de_fecha(fecha: str, frecuencia: str) -> str:
    """'2026-07-01' → '2026-07' (M), '2026-Q3' (Q) o '2026' (A): el mismo formato que usa cada fuente."""
    anio, mes = fecha[:4], int(fecha[5:7])
    return anio if frecuencia == "A" else f"{anio}-Q{(mes - 1) // 3 + 1}" if frecuencia == "Q" else f"{anio}-{mes:02d}"


def normalizar(periodo: str, frecuencia: str) -> str:
    """Periodo de la fuente al formato de arriba (el INE da fechas; el BCE diario, días)."""
    if frecuencia == "Q" and "-Q" not in periodo and len(periodo) >= 7:
        return f"{periodo[:4]}-Q{(int(periodo[5:7]) - 1) // 3 + 1}"
    if frecuencia == "A":
        return periodo[:4]
    return periodo[:7]


def comprobar(ind: dict, pais: str, oficial: tuple[str, float] | None) -> dict:
    filas = storage.leer(indicador=ind["id"], paises=[pais])
    fila = {"indicador": ind["id"], "nombre": ind["nombre"], "pais": pais, "fuente": ind["fuente"], "unidad": ind["unidad"]}
    if not oficial:
        return {**fila, "estado": "sin_dato_oficial"}
    periodo_oficial = normalizar(oficial[0], ind["frecuencia"])
    fila.update(periodo_oficial=periodo_oficial, valor_oficial=oficial[1])
    if not filas:
        return {**fila, "estado": "no_coincide", "motivo": "el panel no tiene la serie"}
    por_periodo = {periodo_de_fecha(f["date"], ind["frecuencia"]): f["value"] for f in filas}
    ultimo_panel = periodo_de_fecha(filas[-1]["date"], ind["frecuencia"])
    fila.update(periodo_panel=ultimo_panel, valor_panel=filas[-1]["value"])
    if periodo_oficial in por_periodo:
        dif = abs(por_periodo[periodo_oficial] - oficial[1])
        return {**fila, "valor_panel": por_periodo[periodo_oficial], "periodo_panel": periodo_oficial,
                "estado": "coincide" if dif <= TOLERANCIA else "no_coincide", "diferencia": round(dif, 4)}
    if periodo_oficial > ultimo_panel:
        return {**fila, "estado": "dato_nuevo"}
    return {**fila, "estado": "no_coincide", "motivo": "el periodo oficial no está en el panel"}


def tareas():
    for ind in config.todos_los_indicadores():
        if ind["fuente"] == "INE":
            yield ind, "ES", lambda ind=ind: ine(ind)
        elif ind["fuente"] == "BCE":
            for pais, clave in ind["series"].items():
                yield ind, pais, lambda clave=clave: bce(clave)
        else:
            yield ind, "ES", lambda ind=ind: eurostat(ind, "ES")
            # Referencia europea: la zona euro (probando sus códigos) o la UE-27.
            def europa(ind=ind):
                for geo in config.ZONA_EURO_EUROSTAT:
                    r = eurostat(ind, geo)
                    if r:
                        return r
                return None
            panel_ea = storage.leer(indicador=ind["id"], paises=["EA"])
            if panel_ea:
                yield ind, "EA", europa
            else:
                yield ind, "UE", lambda ind=ind: eurostat(ind, config.UE_EUROSTAT)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    resultados = []
    for ind, pais, pedir_oficial in tareas():
        try:
            resultados.append(comprobar(ind, pais, pedir_oficial()))
        except Exception as e:  # la fuente no respondió: se anota sin dar el dato por malo
            resultados.append({"indicador": ind["id"], "nombre": ind["nombre"], "pais": pais, "fuente": ind["fuente"],
                               "estado": "error_fuente", "motivo": str(e)[:200]})
    iconos = {"coincide": "✔", "dato_nuevo": "↻", "no_coincide": "✘", "sin_dato_oficial": "·", "error_fuente": "?"}
    for r in resultados:
        detalle = (f"panel {r.get('periodo_panel', '—')} = {r.get('valor_panel', '—')} · oficial {r.get('periodo_oficial', '—')} = {r.get('valor_oficial', '—')}"
                   if r["estado"] != "error_fuente" else r.get("motivo", ""))
        print(f"{iconos[r['estado']]} {r['fuente']:<8} {r['indicador']:<34} {r['pais']:<3} {detalle}")
    cuenta = {e: sum(r["estado"] == e for r in resultados) for e in iconos}
    print(f"\n{cuenta['coincide']} coinciden · {cuenta['dato_nuevo']} con dato nuevo pendiente · "
          f"{cuenta['no_coincide']} no coinciden · {cuenta['error_fuente']} sin respuesta de la fuente")
    salida = config.CARPETA_DATOS / "verificacion.json"
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps({"fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"), "resumen": cuenta,
                                  "resultados": resultados}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Resultado guardado en {salida}")
    return 1 if cuenta["no_coincide"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
