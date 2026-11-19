"""Genera la versión pública de la web (sin servidor) para GitHub Pages.

Copia la carpeta web/ y guarda como archivos JSON lo que normalmente responde la API:
catálogo, estado de las fuentes, resumen y una serie por indicador. La web detecta que es la
versión pública por la etiqueta <meta name="observatorio-modo" content="estatico">.

El centro de investigación NO se publica (es personal): solo los datos económicos oficiales.

Uso:
    python scripts/actualizar_datos.py     (primero, para tener datos)
    python scripts/publicar_web.py         → crea la carpeta _site/
    python scripts/publicar_web.py --ver   → además la abre en http://localhost:8600 para probarla
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import servidor  # noqa: E402  (reutiliza las mismas funciones que la API)
from src.etl import storage  # noqa: E402

SALIDA = RAIZ / "_site"
META = '<meta name="observatorio-modo" content="estatico" />'


def escribir(ruta: Path, datos) -> int:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(servidor._limpiar(datos), ensure_ascii=False, separators=(",", ":"))
    ruta.write_text(texto, encoding="utf-8")
    return len(texto.encode("utf-8"))


def generar(salida: Path = SALIDA) -> dict:
    if not storage.disponibles():
        raise SystemExit("La base de datos está vacía: ejecuta antes python scripts/actualizar_datos.py")
    if salida.exists():
        shutil.rmtree(salida)
    shutil.copytree(RAIZ / "web", salida)
    (salida / ".nojekyll").write_text("", encoding="utf-8")  # GitHub Pages: servir los archivos tal cual

    indice = salida / "index.html"
    html = indice.read_text(encoding="utf-8")
    generado = datetime.now(timezone.utc).isoformat(timespec="seconds")
    html = html.replace("<head>", f'<head>\n    {META}\n    <meta name="observatorio-generado" content="{generado}" />', 1)
    indice.write_text(html, encoding="utf-8")

    api = salida / "api"
    peso = escribir(api / "catalogo.json", servidor.api_catalogo({}))
    peso += escribir(api / "estado.json", servidor.api_estado({}))
    peso += escribir(api / "resumen.json", servidor.api_resumen({}))
    indicadores = list(storage.disponibles())
    for ind in indicadores:
        peso += escribir(api / "series" / f"{ind}.json", servidor.api_series({"ids": ind})[ind])
    return {"carpeta": str(salida), "indicadores": len(indicadores), "megas": round(peso / 1e6, 2), "generado": generado}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    r = generar()
    print(f"Web pública generada en {r['carpeta']}: {r['indicadores']} indicadores, {r['megas']} MB de datos.")
    if "--ver" in sys.argv:
        import functools
        from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
        manejador = functools.partial(SimpleHTTPRequestHandler, directory=r["carpeta"])
        print("Abriendo http://localhost:8600  (Ctrl+C para parar)")
        ThreadingHTTPServer(("127.0.0.1", 8600), manejador).serve_forever()


if __name__ == "__main__":
    main()
