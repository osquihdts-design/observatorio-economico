"""Servidor del panel: sirve la página web (carpeta web/) y los datos en /api/...

Uso:
    python servidor.py            → abre el panel en el navegador
    python servidor.py --sin-abrir → solo arranca el servidor
"""
from __future__ import annotations

import csv
import io
import json
import socket
import sys
import time
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import analisis
import datos

WEB = Path(__file__).parent / "web"
PUERTO = 8501


def _filtrar(serie: datos.Serie, paises: list[str] | None, desde: str) -> datos.Serie:
    nombres = None if paises is None else {datos.PAISES.get(p, p) for p in paises}
    return {
        pais: [p for p in puntos if p[0] >= desde]
        for pais, puntos in serie.items()
        if nombres is None or pais in nombres
    }


def _variable(clave: str, pais: str) -> tuple[dict[str, float], str]:
    """Serie trimestral de un indicador para un país (o de la zona euro si es un tipo de interés)."""
    if clave == "paro_var":
        base, _ = _variable("paro", pais)
        return analisis.variacion_anual(base), "Cambio del paro"
    serie, _, _ = datos.obtener(clave)
    info = datos.INDICADORES[clave]
    puntos = next(iter(serie.values())) if info.get("zona") else serie.get(pais, [])
    return analisis.trimestral(puntos), info["nombre"]


class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, *args):  # sin mensajes por cada petición
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _responder(self, cuerpo: bytes, tipo: str, estado: int = 200, extra: dict | None = None):
        self.send_response(estado)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, obj, estado: int = 200):
        self._responder(json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", estado)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
        try:
            ruta = url.path.removeprefix("/api/")
            if ruta == "meta":
                self._json(self.meta())
            elif ruta == "datos":
                self._json(self.datos(q))
            elif ruta == "resumen":
                self._json(self.resumen())
            elif ruta == "analisis":
                self._json(self.analisis(q))
            elif ruta == "csv":
                self.csv(q)
            elif ruta == "actualizar":
                datos.borrar_cache()
                self._json({"ok": True})
            else:
                self._json({"error": "No existe"}, 404)
        except Exception as e:  # sin internet y sin datos guardados, por ejemplo
            self._json({"error": f"No se pudieron obtener los datos: {e}"}, 502)

    # --------------------------------------------------------------- Rutas

    def meta(self):
        indicadores = {
            k: {c: v for c, v in info.items() if c != "descargar"} for k, info in datos.INDICADORES.items()
        }
        return {"indicadores": indicadores, "paises": datos.PAISES}

    def datos(self, q):
        clave = q["id"]
        serie, hora, antiguo = datos.obtener(clave)
        paises = None if datos.INDICADORES[clave].get("zona") else q.get("paises", "ES").split(",")
        return {
            "series": _filtrar(serie, paises, q.get("desde", "2000") + "-01-01"),
            "actualizado": time.strftime("%d/%m/%Y %H:%M", time.localtime(hora)),
            "antiguo": antiguo,
        }

    def resumen(self):
        """Último dato y el anterior de cada indicador, para España (o la zona euro)."""
        tarjetas = []
        for clave, info in datos.INDICADORES.items():
            serie, _, _ = datos.obtener(clave)
            puntos = next(iter(serie.values())) if info.get("zona") else serie.get("España", [])
            if len(puntos) < 2:
                continue
            tarjetas.append({
                "id": clave,
                "nombre": info["nombre"],
                "unidad": info["unidad"],
                "fecha": puntos[-1][0],
                "valor": puntos[-1][1],
                "anterior": puntos[-2][1],
                "frecuencia": info["frecuencia"],
                "zona": bool(info.get("zona")),
            })
        return {"tarjetas": tarjetas}

    def analisis(self, q):
        pais = datos.PAISES.get(q.get("pais", "ES"), "España")
        x, nombre_x = _variable(q.get("x", "paro"), pais)
        y, nombre_y = _variable(q.get("y", "inflacion"), pais)
        resultado = analisis.regresion(
            x, y, int(q.get("retardo", 0)), nombre_x, nombre_y, desde=q.get("desde", "2000")
        )
        resultado.update({"pais": pais, "nombre_x": nombre_x, "nombre_y": nombre_y})
        return resultado

    def csv(self, q):
        """Tabla para Excel en español: separador «;» y coma decimal."""
        clave = q["id"]
        info = datos.INDICADORES[clave]
        serie, _, _ = datos.obtener(clave)
        paises = None if info.get("zona") else q.get("paises", "ES").split(",")
        serie = _filtrar(serie, paises, q.get("desde", "2000") + "-01-01")
        fechas = sorted({p[0] for puntos in serie.values() for p in puntos})
        columnas = sorted(serie)
        valores = {pais: dict(map(tuple, puntos)) for pais, puntos in serie.items()}
        salida = io.StringIO()
        w = csv.writer(salida, delimiter=";", lineterminator="\r\n")
        w.writerow(["Fecha"] + [f"{c} ({info['unidad']})" for c in columnas])
        for f in fechas:
            w.writerow([f[:7]] + [str(valores[c][f]).replace(".", ",") if f in valores[c] else "" for c in columnas])
        cuerpo = ("﻿" + salida.getvalue()).encode("utf-8")
        self._responder(cuerpo, "text/csv; charset=utf-8", extra={
            "Content-Disposition": f'attachment; filename="{clave}.csv"',
        })


def _puerto_libre(inicio: int) -> int:
    for p in range(inicio, inicio + 20):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return inicio


def main():
    puerto = _puerto_libre(PUERTO)
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), Manejador)
    direccion = f"http://localhost:{puerto}"
    print(f"Panel económico funcionando en {direccion}  (Ctrl+C para parar)")
    if "--sin-abrir" not in sys.argv:
        webbrowser.open(direccion)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nPanel detenido.")


if __name__ == "__main__":
    main()
