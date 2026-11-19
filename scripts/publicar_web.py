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

import hashlib
import json
import re
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


IMPORTACION = re.compile(r"""(\bfrom\s+['"]|\bimport\s+['"])(\.{1,2}/[^'"?]+\.js)(['"])""")
RECURSO_HTML = re.compile(r"""((?:src|href)=")((?:js|css)/[^"?]+\.(?:js|css))(")""")


def versionar(carpeta: Path) -> str:
    """Añade ?v=<huella> a los scripts y estilos. Así, tras cada cambio de código, el navegador descarga
    todos los archivos nuevos a la vez y nunca mezcla uno viejo (en caché) con otro nuevo.
    La huella depende solo del código: si solo cambian los datos, la caché sigue sirviendo."""
    archivos = sorted(p for p in carpeta.rglob("*") if p.suffix in (".js", ".css", ".html"))
    huella = hashlib.sha256(b"".join(p.read_bytes() for p in archivos)).hexdigest()[:10]
    for p in archivos:
        texto = p.read_text(encoding="utf-8")
        if p.suffix == ".js":
            texto = IMPORTACION.sub(rf"\1\2?v={huella}\3", texto)
        elif p.suffix == ".html":
            texto = RECURSO_HTML.sub(rf"\1\2?v={huella}\3", texto)
        p.write_text(texto, encoding="utf-8")
    return huella


def generar(salida: Path = SALIDA) -> dict:
    if not storage.disponibles():
        raise SystemExit("La base de datos está vacía: ejecuta antes python scripts/actualizar_datos.py")
    if salida.exists():
        shutil.rmtree(salida)
    shutil.copytree(RAIZ / "web", salida)
    (salida / ".nojekyll").write_text("", encoding="utf-8")  # GitHub Pages: servir los archivos tal cual

    version = versionar(salida)
    generado = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for pagina in ("index.html", "embed.html"):  # la web y el gráfico para insertar leen los mismos JSON
        ruta = salida / pagina
        html = ruta.read_text(encoding="utf-8")
        html = html.replace("<head>", f'<head>\n    {META}\n    <meta name="observatorio-generado" content="{generado}" />', 1)
        ruta.write_text(html, encoding="utf-8")

    api = salida / "api"
    peso = escribir(api / "catalogo.json", servidor.api_catalogo({}))
    peso += escribir(api / "estado.json", servidor.api_estado({}))
    peso += escribir(api / "resumen.json", servidor.api_resumen({}))
    peso += escribir(api / "previsiones.json", servidor.api_previsiones({}))
    # El calendario se guarda entero desde hoy; la web descarta lo que ya haya pasado.
    peso += escribir(api / "calendario.json", servidor.api_calendario({}))
    indicadores = list(storage.disponibles())
    for ind in indicadores:
        peso += escribir(api / "series" / f"{ind}.json", servidor.api_series({"ids": ind})[ind])
    return {"carpeta": str(salida), "indicadores": len(indicadores), "megas": round(peso / 1e6, 2), "generado": generado, "version": version}


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
