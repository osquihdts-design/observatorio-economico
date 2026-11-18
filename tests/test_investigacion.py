"""Centro de investigación: base de datos, buscador facetado, citas, fichas, Obsidian y API."""
import os
import tempfile
import time
from pathlib import Path

from src.research import almacen, citas, obsidian, semilla
from tests.base_temporal import ConBaseTemporal
from tests.test_api import ServidorDePrueba


class Almacen(ConBaseTemporal):
    def setUp(self):
        super().setUp()
        self.con = almacen.conectar()

    def tearDown(self):
        self.con.close()
        super().tearDown()

    def test_semilla_y_taxonomia(self):
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM inv_recursos").fetchone()[0], len(semilla.RECURSOS))
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM inv_fichas").fetchone()[0], len(semilla.FICHAS))
        organismos = {o["id"] for o in self.con.execute("SELECT id FROM inv_organismos")}
        self.assertTrue({"INE", "BDE", "CNMV", "BCE", "FMI", "BIS", "MOODYS", "PROPIO"} <= organismos)
        # La semilla solo se carga una vez: si se borra todo, no vuelve a aparecer.
        for r in list(self.con.execute("SELECT id FROM inv_recursos")):
            almacen.eliminar_recurso(self.con, r["id"])
        self.con.close()
        self.con = almacen.conectar()
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM inv_recursos").fetchone()[0], 0)

    def test_buscador_ignora_tildes_y_busca_por_prefijo(self):
        ids = [r["id"] for r in almacen.buscar(self.con, "euribor")["resultados"]]
        self.assertIn("euribor-12m", ids)
        self.assertEqual(ids[0], "euribor-12m")  # el título pesa más que el texto
        self.assertIn("marco-dcf", [r["id"] for r in almacen.buscar(self.con, "valoraci")["resultados"]])
        self.assertEqual(almacen.buscar(self.con, "zzzz")["total"], 0)

    def test_filtros_combinados_y_facetas(self):
        res = almacen.buscar(self.con, organismos=["INE", "BCE"])
        self.assertEqual({r["organismo"] for r in res["resultados"]}, {"INE", "BCE"})
        # La faceta de fuentes se cuenta sin su propio filtro (para ver qué saldría al marcar otra).
        self.assertGreater(res["facetas"]["organismo"].get("EUROSTAT", 0), 0)
        # Una categoría grande incluye sus subcategorías.
        macro = {r["id"] for r in almacen.buscar(self.con, categorias=["macro"])["resultados"]}
        self.assertIn("ipc-espana", macro)
        self.assertIn("marco-regla-taylor", macro)
        pred = almacen.buscar(self.con, naturalezas=["Predicción"], pilar="interno")
        self.assertEqual({r["tipo"] for r in pred["resultados"]}, {"prediccion"})
        fechas = almacen.buscar(self.con, desde="2026-11-10")
        self.assertTrue(all(r["fecha"] >= "2026-11-10" for r in fechas["resultados"]))
        etiquetas = almacen.buscar(self.con, etiquetas=["euribor", "hipotecas"])
        self.assertEqual({r["id"] for r in etiquetas["resultados"]}, {"euribor-12m", "transmision-euribor-hipotecas"})

    def test_dato_vivo_desde_la_serie(self):
        r = almacen.obtener_recurso(self.con, "paro-espana")
        self.assertIsNotNone(r["vivo"])
        self.assertEqual(r["vivo"]["date"], "2020-12-01")  # último dato de la base temporal
        self.assertTrue(r["citas"]["dato"].startswith("Tasa de paro, España:"))
        self.assertIn("(dic 2020)", r["citas"]["dato"])

    def test_citas(self):
        bce = almacen.obtener_recurso(self.con, "bce-proyecciones-sep-2026")
        self.assertTrue(bce["citas"]["apa"].startswith("Banco Central Europeo. (2026, 10 de septiembre). Proyecciones"))
        self.assertIn("[Proyecciones macroeconómicas]", bce["citas"]["apa"])
        self.assertIn("ecb.europa.eu", bce["citas"]["apa"])
        self.assertEqual(bce["citas"]["dato"], "BCE (septiembre de 2026), IAPC 2026, escenario base: 3,0 %")
        propio = almacen.obtener_recurso(self.con, "marco-dcf")
        self.assertEqual(propio["citas"]["apa"], "Elaboración propia. (2026). Marco teórico: valoración por descuento "
                         "de flujos de caja (DCF) [Documento de trabajo inédito].")
        self.assertTrue(propio["citas"]["nota"].startswith("Elaboración propia, «Marco teórico"))
        self.assertEqual(citas.fecha_larga("2026-10-09"), "9 de octubre de 2026")
        self.assertEqual(citas.numero(101.4), "101,4")
        self.assertEqual(citas.numero(1234.5), "1.234")

    def test_guardar_validar_y_vincular(self):
        rid = almacen.guardar_recurso(self.con, {"titulo": "Mi análisis de salarios", "tipo": "empirico",
                                                 "categorias": ["empleo"], "etiquetas": ["Salarios Reales", "salarios reales"]})
        r = almacen.obtener_recurso(self.con, rid)
        self.assertEqual((r["pilar"], r["organismo"]), ("interno", "PROPIO"))
        self.assertEqual(r["etiquetas"], ["salarios-reales"])  # normalizadas y sin repetir
        self.assertIn(rid, [x["id"] for x in almacen.buscar(self.con, "salarios")["resultados"]])
        self.assertNotEqual(almacen.guardar_recurso(self.con, {"titulo": "Mi análisis de salarios", "tipo": "teoria"}), rid)
        for malo in ({"titulo": "", "tipo": "teoria"}, {"titulo": "x", "tipo": "otro"}, {"titulo": "x", "tipo": "dato", "organismo": "NADIE"},
                     {"titulo": "x", "tipo": "teoria", "categorias": ["inventada"]}, {"titulo": "x", "tipo": "prediccion", "confianza": 9},
                     {"titulo": "x", "tipo": "teoria", "fecha": "ayer"}):
            with self.assertRaises(ValueError):
                almacen.guardar_recurso(self.con, malo)
        almacen.vincular(self.con, rid, "paro-espana", "usa_datos")
        self.assertEqual(almacen.obtener_recurso(self.con, "paro-espana")["vinculos"][-1]["sentido"], "entra")
        with self.assertRaises(ValueError):
            almacen.vincular(self.con, rid, rid, "usa_datos")
        almacen.eliminar_recurso(self.con, rid)
        self.assertNotIn(rid, [x["id"] for x in almacen.buscar(self.con, "salarios")["resultados"]])
        self.assertFalse(any(v["id"] == rid for v in almacen.obtener_recurso(self.con, "paro-espana")["vinculos"]))

    def test_fichas_en_tres_columnas(self):
        f = almacen.obtener_ficha(self.con, "energia-petroleo")
        self.assertEqual([r["id"] for r in f["datos"]], ["ipc-espana", "bono-10-espana"])
        self.assertEqual([r["id"] for r in f["teoria"]], ["marco-dcf"])
        self.assertEqual({r["id"] for r in f["predicciones"]}, {"bce-proyecciones-sep-2026", "prediccion-energia-2028"})
        almacen.quitar_de_ficha(self.con, "energia-petroleo", "marco-dcf")
        almacen.anadir_a_ficha(self.con, "energia-petroleo", "marco-regla-taylor")
        self.assertEqual([r["id"] for r in almacen.obtener_ficha(self.con, "energia-petroleo")["teoria"]], ["marco-regla-taylor"])

    def test_resumen_del_centro_de_mando(self):
        s = almacen.resumen(self.con)
        self.assertEqual(s["total"], len(semilla.RECURSOS))
        macro = next(c for c in s["categorias"] if c["id"] == "macro")
        self.assertEqual(macro["total"], macro["externos"] + macro["internos"])
        self.assertTrue(all(p["tipo"] in ("prediccion", "proyeccion") for p in s["predicciones"]))
        self.assertEqual(len(s["fichas"]), len(semilla.FICHAS))


class Obsidian(ConBaseTemporal):
    def setUp(self):
        super().setUp()
        self.con = almacen.conectar()
        self._boveda = tempfile.TemporaryDirectory()
        self.boveda = Path(self._boveda.name)
        (self.boveda / ".obsidian").mkdir()

    def tearDown(self):
        self.con.close()
        self._boveda.cleanup()
        super().tearDown()

    def nota(self, rid):
        return next(p for p in self.boveda.rglob("*.md") if obsidian.leer_nota(p.read_text(encoding="utf-8"))[0].get("id") == rid)

    def tocar(self, ruta, texto):
        ruta.write_text(texto, encoding="utf-8")
        futuro = time.time() + 5  # la nota es «más reciente» que el recurso del panel
        os.utime(ruta, (futuro, futuro))

    def test_yaml_ida_y_vuelta(self):
        props = {"id": "a", "titulo": 'Con "comillas": y dos puntos', "tags": ["x", "y"], "confianza": 3, "vacio": None}
        leido, cuerpo = obsidian.leer_nota(obsidian.a_yaml(props) + "\ncuerpo")
        self.assertEqual(leido, {"id": "a", "titulo": 'Con "comillas": y dos puntos', "tags": ["x", "y"], "confianza": 3})
        self.assertEqual(cuerpo, "cuerpo")
        self.assertEqual(obsidian.leer_nota("---\ntags: [a, b]\n---\n")[0]["tags"], ["a", "b"])
        self.assertEqual(obsidian.nombre_archivo("Marco: ¿qué es?"), "Marco ¿qué es.md")

    def test_exportar(self):
        inf = obsidian.sincronizar(self.con, self.boveda)
        self.assertEqual(inf["notas"], len(semilla.RECURSOS) + len(semilla.FICHAS))
        self.assertTrue((self.boveda / "Observatorio" / "Observatorio.base").exists())
        props, cuerpo = obsidian.leer_nota(self.nota("prediccion-euribor-2027").read_text(encoding="utf-8"))
        self.assertEqual(props["tipo"], "Predicción propia")
        self.assertEqual(props["confianza"], 3)
        self.assertIn("[[Marco teórico la regla de Taylor]]", cuerpo)
        # Una segunda sincronización sin cambios no reescribe nada.
        self.assertEqual(obsidian.sincronizar(self.con, self.boveda)["escritas"], 0)

    def test_editar_en_obsidian_vuelve_al_panel(self):
        obsidian.sincronizar(self.con, self.boveda)
        ruta = self.nota("marco-regla-taylor")
        texto = ruta.read_text(encoding="utf-8").replace("Regla sencilla", "Regla muy sencilla").replace("  - \"regla-de-taylor\"", "  - \"nueva\"")
        self.tocar(ruta, texto)
        inf = obsidian.sincronizar(self.con, self.boveda)
        self.assertEqual(inf["actualizadas"], [ruta.stem])
        r = almacen.obtener_recurso(self.con, "marco-regla-taylor")
        self.assertTrue(r["resumen"].startswith("Regla muy sencilla"))
        self.assertEqual(r["titulo"], "Marco teórico: la regla de Taylor")  # los «:» se conservan
        self.assertIn("nueva", r["etiquetas"])

    def test_nota_nueva_y_renombrar(self):
        obsidian.sincronizar(self.con, self.boveda)
        nueva = self.boveda / "Observatorio" / "Análisis propios" / "Idea sobre vivienda.md"
        self.tocar(nueva, "Los precios suben más que los salarios.")
        inf = obsidian.sincronizar(self.con, self.boveda)
        self.assertEqual(inf["nuevas"], ["Idea sobre vivienda"])
        r = almacen.obtener_recurso(self.con, "idea-sobre-vivienda")
        self.assertEqual((r["tipo"], r["contenido"]), ("teoria", "Los precios suben más que los salarios."))
        self.assertEqual(obsidian.leer_nota(nueva.read_text(encoding="utf-8"))[0]["id"], "idea-sobre-vivienda")  # se completó en su sitio
        # Si el título cambia en el panel, la nota se renombra.
        datos = {k: r[k] for k in almacen.CAMPOS}
        time.sleep(0.01)
        almacen.guardar_recurso(self.con, {**datos, "id": r["id"], "titulo": "Vivienda y salarios"})
        obsidian.sincronizar(self.con, self.boveda)
        self.assertFalse(nueva.exists())
        self.assertTrue((nueva.parent / "Vivienda y salarios.md").exists())

    def test_nota_de_recurso_borrado_no_resucita(self):
        obsidian.sincronizar(self.con, self.boveda)
        ruta = self.nota("paro-espana")
        almacen.eliminar_recurso(self.con, "paro-espana")
        self.tocar(ruta, ruta.read_text(encoding="utf-8"))
        inf = obsidian.sincronizar(self.con, self.boveda)
        self.assertEqual(inf["huerfanas"], [ruta.stem])
        with self.assertRaises(ValueError):
            almacen.obtener_recurso(self.con, "paro-espana")


class APIInvestigacion(ServidorDePrueba):
    def test_resumen_buscar_y_recurso(self):
        self.assertEqual(self.get("/api/inv/resumen")["total"], len(semilla.RECURSOS))
        res = self.get("/api/inv/buscar?q=petr%C3%B3leo&tipos=prediccion")
        self.assertEqual([r["id"] for r in res["resultados"]], ["prediccion-energia-2028"])
        self.assertIn("apa", self.get("/api/inv/recurso?id=marco-dcf")["citas"])
        self.assertEqual(self.error("GET", "/api/inv/recurso?id=no-existe")[0], 400)

    def test_crear_vincular_y_fichas(self):
        r = self.post("/api/inv/recurso", {"titulo": "Nota de prueba", "tipo": "teoria", "categorias": ["fiscal"], "etiquetas": ["prueba"]})
        self.assertEqual(r["organismo"], "PROPIO")
        r = self.post("/api/inv/vincular", {"origen": r["id"], "destino": "deuda-publica-espana", "tipo": "usa_datos"})
        self.assertEqual(r["vinculos"][0]["id"], "deuda-publica-espana")
        f = self.post("/api/inv/ficha", {"titulo": "Ficha de prueba", "pregunta": "¿?", "recursos": [r["id"], "ipc-espana"]})
        self.assertEqual((len(f["teoria"]), len(f["datos"])), (1, 1))
        f = self.post("/api/inv/ficha/quitar", {"ficha": f["id"], "recurso": "ipc-espana"})
        self.assertEqual(len(f["datos"]), 0)
        self.assertEqual(self.error("POST", "/api/inv/recurso", {"titulo": "x", "tipo": "nada"})[0], 400)

    def test_obsidian_por_la_api(self):
        with tempfile.TemporaryDirectory() as carpeta:
            self.assertEqual(self.post("/api/inv/obsidian/ruta", {"ruta": carpeta})["ruta"], carpeta)
            inf = self.post("/api/inv/obsidian/sincronizar", {})
            self.assertGreater(inf["escritas"], 0)
            self.assertTrue((Path(carpeta) / "Observatorio" / "Inicio.md").exists())
            self.assertIsNotNone(self.get("/api/inv/obsidian")["ultima"])
        self.assertEqual(self.error("POST", "/api/inv/obsidian/ruta", {"ruta": "C:/no/existe/nunca"})[0], 400)
