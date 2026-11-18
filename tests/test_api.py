"""La API del servidor, de punta a punta, sobre una base de datos temporal."""
import io
import json
import threading
import urllib.error
import urllib.request
import zipfile

import servidor
from tests.base_temporal import ConBaseTemporal


class ServidorDePrueba(ConBaseTemporal):
    """Arranca el servidor en un puerto libre sobre la base temporal (sin tests propios: se hereda)."""

    def setUp(self):
        super().setUp()
        self.srv = servidor.ThreadingHTTPServer(("127.0.0.1", 0), servidor.Manejador)
        self.base = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()
        super().tearDown()

    def get(self, ruta):
        with urllib.request.urlopen(self.base + ruta, timeout=30) as r:
            return json.loads(r.read())

    def post(self, ruta, cuerpo, crudo=False):
        req = urllib.request.Request(self.base + ruta, data=json.dumps(cuerpo).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return (r.headers["Content-Type"], r.read()) if crudo else json.loads(r.read())

    def error(self, metodo, ruta, cuerpo=None):
        with self.assertRaises(urllib.error.HTTPError) as e:
            self.post(ruta, cuerpo) if metodo == "POST" else self.get(ruta)
        with e.exception as respuesta:
            return respuesta.code, json.loads(respuesta.read())


class API(ServidorDePrueba):
    def test_pagina_principal(self):
        with urllib.request.urlopen(self.base + "/", timeout=30) as r:
            self.assertIn("Observatorio económico", r.read().decode("utf-8"))

    def test_catalogo_y_series(self):
        cat = self.get("/api/catalogo")
        paro = next(i for i in cat["indicadores"] if i["id"] == "paro")
        self.assertEqual(paro["paises"], ["EA", "ES"])
        s = self.get("/api/series?ids=paro,bce_deposito&paises=ES,EA&desde=2020-07-01&hasta=2020-09-01")
        self.assertEqual(len(s["paro"]["ES"]), 3)
        self.assertEqual(list(s["bce_deposito"]), ["EA"])

    def test_estado_y_resumen(self):
        e = self.get("/api/estado")
        self.assertFalse(e["vacia"])
        self.assertEqual(e["fuentes"]["BCE"]["semaforo"] in ("verde", "ambar"), True)
        fila = next(f for f in self.get("/api/resumen")["filas"] if f["indicador"] == "paro" and f["pais"] == "ES")
        self.assertEqual(fila["fecha"], "2020-12-01")
        self.assertIsNotNone(fila["anterior"])

    def test_regresion(self):
        cuerpo = {"y": {"indicador": "iapc_subyacente", "pais": "ES"}, "xs": [{"indicador": "paro", "pais": "ES"}], "robustos": True}
        r = self.post("/api/lab/ols", cuerpo)
        self.assertEqual(r["n"], 132)
        self.assertEqual(len(r["tabla"]), 2)
        self.assertAlmostEqual(r["tabla"][1]["coeficiente"], -0.2, delta=0.02)  # así se construyeron los datos
        self.assertIn("HAC", r["tipo_errores"])
        self.assertEqual(len(r["adf"]), 2)
        self.assertEqual(len(r["citas"]), 2)

    def test_exportar_excel(self):
        cuerpo = {"y": {"indicador": "iapc_subyacente", "pais": "ES"}, "xs": [{"indicador": "paro", "pais": "ES"}]}
        tipo, contenido = self.post("/api/lab/exportar", cuerpo, crudo=True)
        self.assertIn("spreadsheetml", tipo)
        with zipfile.ZipFile(io.BytesIO(contenido)) as z:
            self.assertIn("Resultados_Regresion", z.read("xl/workbook.xml").decode())

    def test_hp_ccf_dispersion(self):
        hp = self.post("/api/lab/hp", {"indicador": "paro", "pais": "ES"})
        self.assertEqual(hp["lambda"], 14400)
        self.assertEqual(len(hp["tendencia"]), 132)
        cc = self.post("/api/lab/ccf", {"x": {"indicador": "paro", "pais": "ES"}, "y": {"indicador": "iapc_subyacente", "pais": "ES"}, "max_retardo": 6})
        self.assertEqual([c["retardo"] for c in cc["correlaciones"]], list(range(-6, 7)))
        d = self.post("/api/lab/dispersion", {"x": {"indicador": "paro", "pais": "ES"}, "y": {"indicador": "iapc_subyacente", "pais": "ES"},
                                              "periodos": [{"nombre": "A", "desde": "0000", "hasta": "2015-12-01"}, {"nombre": "B", "desde": "2016-01-01", "hasta": "9999"}]})
        self.assertEqual([r["periodo"] for r in d["rectas"]], ["A", "B"])

    def test_y_constante_da_mensaje_claro(self):
        # Desde 2016 el tipo de prueba vale siempre 0: no se puede explicar nada.
        codigo, cuerpo = self.error("POST", "/api/lab/ols", {
            "y": {"indicador": "bce_deposito", "pais": "EA"}, "xs": [{"indicador": "paro", "pais": "EA"}], "desde": "2016-01-01"})
        self.assertEqual(codigo, 400)
        self.assertIn("no cambia", cuerpo["error"])

    def test_adf_no_calculable(self):
        # Una serie constante no admite el test ADF: se devuelve «sin calcular» con la razón, sin romper nada.
        a = servidor._adf_seguro([0.0] * 50)
        self.assertIsNone(a["estacionaria"])
        self.assertIn("No se pudo calcular", a["conclusion"])

    def test_varias_x_y_fuentes_mezcladas(self):
        r = self.post("/api/lab/ols", {"y": {"indicador": "paro", "pais": "ES"},
                                       "xs": [{"indicador": "iapc_subyacente", "pais": "ES"}, {"indicador": "bce_deposito", "pais": "EA"}],
                                       "desde": "2014-01-01"})
        self.assertEqual(r["n"], 84)
        self.assertEqual(len(r["tabla"]), 3)
        self.assertEqual(len(r["adf"]), 3)
        self.assertEqual(len(r["citas"]), 3)

    def test_errores_claros(self):
        codigo, cuerpo = self.error("POST", "/api/lab/ols", {"y": {"indicador": "no_existe"}, "xs": []})
        self.assertEqual(codigo, 400)
        self.assertIn("desconocido", cuerpo["error"])
        codigo, cuerpo = self.error("POST", "/api/lab/ols", {"y": {"indicador": "paro", "pais": "ES"}, "xs": []})
        self.assertIn("al menos una", cuerpo["error"])
        codigo, _ = self.error("GET", "/api/no_existe")
        self.assertEqual(codigo, 404)


if __name__ == "__main__":
    import unittest
    unittest.main()
