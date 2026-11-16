"""Servidor del Observatorio económico.

Sirve la web (carpeta web/) y una API en /api/… que lee de la base de datos SQLite y usa
el motor econométrico de src/. Solo Python estándar.

Uso:
    python servidor.py              → abre el observatorio en el navegador
    python servidor.py --sin-abrir  → solo arranca el servidor
"""
from __future__ import annotations

import json
import math
import socket
import sys
import tempfile
import threading
import traceback
import urllib.parse
import webbrowser
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from src import config
from src.econometrics import correlations, regression, time_series
from src.econometrics.dataset import Variable, descriptivos, preparar
from src.etl import pipeline, storage
from src.reporting import exporter

WEB = Path(__file__).resolve().parent / "web"
PUERTO = 8501
CATALOGO = {i["id"]: i for i in config.todos_los_indicadores()}


# ----------------------------------------------------------------------------- Actualización en segundo plano

class Actualizacion:
    """Ejecuta la descarga de datos en otro hilo y guarda el progreso para la barra de la web."""

    def __init__(self):
        self._candado = threading.Lock()
        self.estado = {"activa": False, "hechos": 0, "total": 0, "nombre": "", "errores": [], "ultima": None}

    def iniciar(self) -> bool:
        with self._candado:
            if self.estado["activa"]:
                return False
            self.estado.update(activa=True, hechos=0, total=len(CATALOGO), nombre="Empezando…", errores=[])
        threading.Thread(target=self._ejecutar, daemon=True).start()
        return True

    def _progreso(self, hechos: int, total: int, nombre: str) -> None:
        self.estado.update(hechos=hechos, total=total, nombre=nombre)

    def _ejecutar(self) -> None:
        try:
            resultado = pipeline.ejecutar(progreso=self._progreso)
            self.estado["errores"] = [e for lista in resultado.errores.values() for e in lista]
        except Exception as e:  # p. ej. sin internet
            self.estado["errores"] = [str(e)]
        finally:
            self.estado.update(activa=False, ultima=datetime.now(timezone.utc).isoformat(timespec="seconds"))


ACTUALIZACION = Actualizacion()


# ----------------------------------------------------------------------------- Utilidades

def _numero(v):
    """JSON no admite NaN ni infinito: se envían como null."""
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def _limpiar(obj):
    if isinstance(obj, dict):
        return {k: _limpiar(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_limpiar(v) for v in obj]
    return _numero(obj)


def _variable(d: dict) -> Variable:
    if d.get("indicador") not in CATALOGO:
        raise ValueError(f"Indicador desconocido: {d.get('indicador')}")
    if d.get("transformacion", "niveles") not in time_series.TRANSFORMACIONES:
        raise ValueError("Transformación desconocida")
    return Variable(d["indicador"], d.get("pais", "ES"), d.get("transformacion", "niveles"))


def _calendario(desde: str, hasta: str, frecuencia: str) -> list[str]:
    """Todas las fechas entre dos fechas, sin huecos (para la correlación cruzada)."""
    paso = 3 if frecuencia == "Q" else 1
    anio, mes = int(desde[:4]), int(desde[5:7])
    fechas = []
    while f"{anio}-{mes:02d}-01" <= hasta:
        fechas.append(f"{anio}-{mes:02d}-01")
        mes += paso
        if mes > 12:
            anio, mes = anio + 1, mes - 12
    return fechas


def _avisos(res, pruebas: dict) -> list[str]:
    avisos = []
    no_estacionarias = [n for n, a in pruebas.items() if not a["estacionaria"]]
    if no_estacionarias:
        avisos.append("Variables NO estacionarias según el test ADF: " + "; ".join(no_estacionarias)
                      + ". La regresión puede ser espuria: prueba con primeras diferencias o tasas interanuales.")
    if res.durbin_watson == res.durbin_watson and res.durbin_watson < 1.0:
        avisos.append(f"Durbin-Watson = {res.durbin_watson:.2f}: hay autocorrelación fuerte en los residuos. "
                      "Usa errores robustos (Newey-West) y desconfía de la significación con errores clásicos.")
    if res.n < 30:
        avisos.append(f"Solo hay {res.n} observaciones: los resultados son poco fiables.")
    return avisos


def _estimar(cuerpo: dict):
    y = _variable(cuerpo["y"])
    xs = [_variable(x) for x in cuerpo.get("xs", [])]
    if not xs:
        raise ValueError("Elige al menos una variable explicativa (X).")
    datos = preparar([y, *xs], desde=cuerpo.get("desde"), hasta=cuerpo.get("hasta"))
    nombres = list(datos.columnas)
    if len(set(nombres)) != len(nombres) or len(nombres) != len(xs) + 1:
        raise ValueError("Hay variables repetidas: cada variable solo puede aparecer una vez.")
    nombre_y, nombres_x = nombres[0], nombres[1:]
    retardos = cuerpo.get("retardos")
    res = regression.ols(
        datos.columnas[nombre_y], {n: datos.columnas[n] for n in nombres_x}, variable_y=nombre_y,
        robustos=bool(cuerpo.get("robustos", True)), retardos=int(retardos) if retardos not in (None, "") else None,
        fechas=datos.fechas,
    )
    pruebas = {n: time_series.adf(v) for n, v in datos.columnas.items()}
    return datos, res, pruebas


# ----------------------------------------------------------------------------- Rutas de la API

def api_catalogo(_q):
    disponibles = storage.disponibles()
    return {
        "indicadores": [
            {k: v for k, v in ind.items() if k in ("id", "nombre", "unidad", "frecuencia", "fuente", "nota")}
            | {"paises": disponibles.get(ind["id"], [])}
            for ind in CATALOGO.values()
        ],
        "paises": config.PAISES,
        "transformaciones": time_series.TRANSFORMACIONES,
        "lambda_hp": time_series.LAMBDA_HP,
    }


def api_series(q):
    ids = [i for i in q.get("ids", "").split(",") if i]
    paises = [p for p in q.get("paises", "").split(",") if p] or None
    resultado = {}
    for ind in ids:
        filas = storage.leer(indicador=ind, paises=paises, desde=q.get("desde") or None)
        hasta = q.get("hasta")
        series: dict[str, list] = {}
        for f in filas:
            if hasta and f["date"] > hasta:
                continue
            series.setdefault(f["country_code"], []).append([f["date"], f["value"]])
        resultado[ind] = series
    return resultado


def api_estado(_q):
    vacia = not storage.disponibles()
    return {"fuentes": storage.estado_fuentes(), "actualizacion": ACTUALIZACION.estado, "vacia": vacia}


def api_resumen(_q):
    filas = storage.ultimos_valores(2)
    resumen: dict[tuple, dict] = {}
    for f in filas:
        clave = (f["indicator_id"], f["country_code"])
        if f["orden"] == 1:
            resumen[clave] = {
                "indicador": f["indicator_id"], "nombre": f["indicator_name"], "pais": f["country_code"],
                "pais_nombre": f["country_name"], "valor": f["value"], "fecha": f["date"], "unidad": f["unit"],
                "frecuencia": f["frequency"], "fuente": f["source"], "codigo": f["series_code"],
                "actualizado": f["last_updated"], "estado": f["status"], "anterior": None,
            }
        elif clave in resumen:
            resumen[clave]["anterior"] = f["value"]
    return {"filas": list(resumen.values())}


def api_hp(c):
    var = _variable(c)
    datos = preparar([var], desde=c.get("desde"), hasta=c.get("hasta"))
    nombre = next(iter(datos.columnas))
    valores = datos.columnas[nombre]
    lam = float(c.get("lambda") or time_series.LAMBDA_HP[datos.frecuencia])
    tendencia, ciclo = time_series.filtro_hp(valores, lam)
    return {"nombre": nombre, "frecuencia": datos.frecuencia, "lambda": lam, "fechas": datos.fechas,
            "valores": valores, "tendencia": tendencia, "ciclo": ciclo}


def api_ccf(c):
    x, y = _variable(c["x"]), _variable(c["y"])
    datos = preparar([x, y], desde=c.get("desde"), hasta=c.get("hasta"))
    nx, ny = list(datos.columnas)
    serie_x = dict(zip(datos.fechas, datos.columnas[nx]))
    serie_y = dict(zip(datos.fechas, datos.columnas[ny]))
    calendario = _calendario(datos.fechas[0], datos.fechas[-1], datos.frecuencia)
    maximo = int(c.get("max_retardo") or (24 if datos.frecuencia == "M" else 8))
    return {"x": nx, "y": ny, "frecuencia": datos.frecuencia,
            "correlaciones": correlations.correlacion_cruzada(serie_x, serie_y, calendario, maximo)}


def api_ols(c):
    datos, res, pruebas = _estimar(c)
    return {
        "variable_y": res.variable_y, "tabla": res.tabla(), "n": res.n, "k": res.k, "r2": res.r2,
        "r2_ajustado": res.r2_ajustado, "f": res.f, "f_p": res.f_p, "aic": res.aic, "bic": res.bic,
        "durbin_watson": res.durbin_watson, "sigma": res.sigma, "tipo_errores": res.tipo_errores,
        "fechas": res.fechas, "ajustados": res.ajustados, "residuos": res.residuos,
        "observados": [a + e for a, e in zip(res.ajustados, res.residuos)],
        "adf": [{"variable": n, **a} for n, a in pruebas.items()],
        "descriptivos": descriptivos(datos.columnas), "frecuencia": datos.frecuencia,
        "avisos": _avisos(res, pruebas),
        "citas": [exporter.cita_apa(m) for m in datos.metadatos],
    }


def api_dispersion(c):
    """Nube de puntos X–Y coloreada por periodos, con una recta de regresión por periodo."""
    x, y = _variable(c["x"]), _variable(c["y"])
    datos = preparar([x, y], desde=c.get("desde"), hasta=c.get("hasta"))
    nx, ny = list(datos.columnas)
    periodos = c.get("periodos") or [{"nombre": "Todo", "desde": "0000", "hasta": "9999"}]
    puntos, rectas = [], []
    for p in periodos:
        idx = [i for i, f in enumerate(datos.fechas) if p["desde"] <= f <= p["hasta"]]
        xs = [datos.columnas[nx][i] for i in idx]
        ys = [datos.columnas[ny][i] for i in idx]
        puntos += [[datos.fechas[i], xs[j], ys[j], p["nombre"]] for j, i in enumerate(idx)]
        if len(idx) >= 8 and len(set(xs)) > 1:
            r = regression.ols(ys, {nx: xs})
            rectas.append({"periodo": p["nombre"], "constante": r.coeficientes[0], "pendiente": r.coeficientes[1],
                           "r2": r.r2, "p": r.p[1], "n": r.n, "x_min": min(xs), "x_max": max(xs)})
    return {"x": nx, "y": ny, "puntos": puntos, "rectas": rectas}


RUTAS_GET = {"catalogo": api_catalogo, "series": api_series, "estado": api_estado, "resumen": api_resumen}
RUTAS_POST = {"lab/hp": api_hp, "lab/ccf": api_ccf, "lab/ols": api_ols, "lab/dispersion": api_dispersion}


# ----------------------------------------------------------------------------- Servidor HTTP

class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _enviar(self, cuerpo: bytes, tipo: str, estado: int = 200, extra: dict | None = None):
        self.send_response(estado)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(cuerpo)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(cuerpo)

    def _json(self, obj, estado: int = 200):
        cuerpo = json.dumps(_limpiar(obj), ensure_ascii=False).encode("utf-8")
        self._enviar(cuerpo, "application/json; charset=utf-8", estado)

    def _error(self, e: Exception):
        if not isinstance(e, (ValueError, KeyError)):
            traceback.print_exc()
        self._json({"error": str(e) if isinstance(e, ValueError) else f"Error inesperado: {e}"}, 400)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if not url.path.startswith("/api/"):
            return super().do_GET()
        ruta = url.path.removeprefix("/api/")
        q = {k: v[0] for k, v in urllib.parse.parse_qs(url.query).items()}
        try:
            if ruta in RUTAS_GET:
                self._json(RUTAS_GET[ruta](q))
            else:
                self._json({"error": "Ruta desconocida"}, 404)
        except Exception as e:
            self._error(e)

    def do_POST(self):
        ruta = urllib.parse.urlparse(self.path).path.removeprefix("/api/")
        try:
            largo = int(self.headers.get("Content-Length") or 0)
            cuerpo = json.loads(self.rfile.read(largo) or b"{}")
            if ruta == "actualizar":
                self._json({"iniciada": ACTUALIZACION.iniciar()})
            elif ruta == "lab/exportar":
                datos, res, pruebas = _estimar(cuerpo)
                with tempfile.TemporaryDirectory() as carpeta:
                    archivo = exporter.exportar_informe(Path(carpeta) / "informe.xlsx", datos, res, pruebas)
                    contenido = archivo.read_bytes()
                self._enviar(contenido, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             extra={"Content-Disposition": 'attachment; filename="observatorio_regresion.xlsx"'})
            elif ruta in RUTAS_POST:
                self._json(RUTAS_POST[ruta](cuerpo))
            else:
                self._json({"error": "Ruta desconocida"}, 404)
        except Exception as e:
            self._error(e)


def _puerto_libre(inicio: int) -> int:
    for p in range(inicio, inicio + 20):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return inicio


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if not storage.disponibles():
        print("La base de datos está vacía: descargando los datos por primera vez…")
        ACTUALIZACION.iniciar()
    puerto = _puerto_libre(PUERTO)
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), Manejador)
    direccion = f"http://localhost:{puerto}"
    print(f"Observatorio económico en {direccion}  (Ctrl+C para parar)")
    if "--sin-abrir" not in sys.argv:
        webbrowser.open(direccion)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nObservatorio detenido.")


if __name__ == "__main__":
    main()
