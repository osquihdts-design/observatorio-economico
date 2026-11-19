"""Generación de la web pública (GitHub Pages) sobre una base de datos temporal."""
import json
import re
import sys
import tempfile
from pathlib import Path

from tests.base_temporal import ConBaseTemporal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import publicar_web  # noqa: E402


class WebPublica(ConBaseTemporal):
    def test_generar(self):
        with tempfile.TemporaryDirectory() as carpeta:
            salida = Path(carpeta) / "_site"
            r = publicar_web.generar(salida)
            # Datos como JSON
            for nombre in ("catalogo", "estado", "resumen", "previsiones", "calendario"):
                self.assertTrue((salida / "api" / f"{nombre}.json").exists(), nombre)
            serie = json.loads((salida / "api" / "series" / "paro.json").read_text(encoding="utf-8"))
            self.assertEqual(set(serie), {"ES", "EA"})
            # Las dos páginas saben que son la versión pública
            for pagina in ("index.html", "embed.html"):
                self.assertIn(publicar_web.META, (salida / pagina).read_text(encoding="utf-8"), pagina)
            # Todos los imports y estilos llevan la misma versión
            app = (salida / "js" / "app.js").read_text(encoding="utf-8")
            importaciones = re.findall(r"from '(\./[^']+)'", app)
            self.assertTrue(importaciones)
            self.assertTrue(all(i.endswith(f"?v={r['version']}") for i in importaciones), importaciones)
            self.assertIn(f'href="css/style.css?v={r["version"]}"', (salida / "index.html").read_text(encoding="utf-8"))
            self.assertIn(f'src="js/embed.js?v={r["version"]}"', (salida / "embed.html").read_text(encoding="utf-8"))
            # El centro de investigación no se publica: no hay datos suyos en la web
            self.assertFalse(any("inv" in p.name for p in (salida / "api").iterdir()))
