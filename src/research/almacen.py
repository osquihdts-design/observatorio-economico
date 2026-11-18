"""Base de datos del centro de investigación (en la misma SQLite que los datos del panel).

Tablas (todas empiezan por inv_):
  inv_organismos         fuentes: INE, BCE, FMI, Bloomberg… y «Elaboración propia»
  inv_categorias         árbol de dos niveles (Macroeconomía → Inflación…)
  inv_recursos           cada pieza de información, externa (dato, informe, proyección) o propia (teoría, análisis, predicción)
  inv_recurso_categoria  categorías de cada recurso (varias)
  inv_etiquetas          etiquetas libres de cada recurso
  inv_vinculos           relaciones entre recursos («usa datos de», «se basa en»…)
  inv_fichas             temas de investigación (el «workspace»)
  inv_ficha_recurso      qué recursos forman cada ficha
  inv_ajustes            ajustes sencillos (p. ej. la carpeta de Obsidian)
  inv_busqueda           índice de texto completo (FTS5) que ignora tildes y mayúsculas
"""
from __future__ import annotations

import re
import sqlite3
import threading
import unicodedata
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from .. import config
from ..etl import storage
from . import citas, taxonomia

ESQUEMA = """
CREATE TABLE IF NOT EXISTS inv_organismos (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, siglas TEXT NOT NULL, ambito TEXT NOT NULL, url TEXT
);
CREATE TABLE IF NOT EXISTS inv_categorias (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, padre TEXT REFERENCES inv_categorias(id), orden INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS inv_recursos (
    id               TEXT PRIMARY KEY,
    pilar            TEXT NOT NULL CHECK (pilar IN ('externo', 'interno')),
    tipo             TEXT NOT NULL,
    titulo           TEXT NOT NULL,
    resumen          TEXT NOT NULL DEFAULT '',
    contenido        TEXT NOT NULL DEFAULT '',
    organismo        TEXT NOT NULL REFERENCES inv_organismos(id),
    autores          TEXT,
    url              TEXT,
    fecha            TEXT,
    fecha_consulta   TEXT,
    dato_valor       REAL,
    dato_unidad      TEXT,
    dato_periodo     TEXT,
    notas_extraccion TEXT,
    indicador        TEXT,
    pais             TEXT,
    horizonte        TEXT,
    confianza        INTEGER CHECK (confianza IS NULL OR confianza BETWEEN 1 AND 5),
    estado           TEXT NOT NULL DEFAULT 'activo',
    creado           TEXT NOT NULL,
    modificado       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_recursos_tipo ON inv_recursos (tipo);
CREATE TABLE IF NOT EXISTS inv_recurso_categoria (
    recurso TEXT NOT NULL REFERENCES inv_recursos(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL REFERENCES inv_categorias(id),
    PRIMARY KEY (recurso, categoria)
);
CREATE TABLE IF NOT EXISTS inv_etiquetas (
    recurso TEXT NOT NULL REFERENCES inv_recursos(id) ON DELETE CASCADE,
    etiqueta TEXT NOT NULL,
    PRIMARY KEY (recurso, etiqueta)
);
CREATE TABLE IF NOT EXISTS inv_vinculos (
    origen TEXT NOT NULL REFERENCES inv_recursos(id) ON DELETE CASCADE,
    destino TEXT NOT NULL REFERENCES inv_recursos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    PRIMARY KEY (origen, destino, tipo)
);
CREATE TABLE IF NOT EXISTS inv_fichas (
    id TEXT PRIMARY KEY, titulo TEXT NOT NULL, pregunta TEXT NOT NULL DEFAULT '', descripcion TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL, modificado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inv_ficha_recurso (
    ficha TEXT NOT NULL REFERENCES inv_fichas(id) ON DELETE CASCADE,
    recurso TEXT NOT NULL REFERENCES inv_recursos(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ficha, recurso)
);
CREATE TABLE IF NOT EXISTS inv_ajustes (clave TEXT PRIMARY KEY, valor TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS inv_busqueda USING fts5(
    id UNINDEXED, titulo, resumen, contenido, etiquetas, tokenize = 'unicode61 remove_diacritics 2'
);
"""

CAMPOS = ["tipo", "titulo", "resumen", "contenido", "organismo", "autores", "url", "fecha", "fecha_consulta",
          "dato_valor", "dato_unidad", "dato_periodo", "notas_extraccion", "indicador", "pais", "horizonte",
          "confianza", "estado"]


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn").lower()


def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes(texto)).strip("-")[:60] or "recurso"


# ----------------------------------------------------------------------------- Conexión y semilla

_candado = threading.Lock()  # el servidor atiende varias peticiones a la vez: la preparación se hace de una en una
_preparadas: set[str] = set()


def conectar(ruta: Path | None = None, sembrar: bool = True) -> sqlite3.Connection:
    """Abre la base, crea las tablas y carga la taxonomía. La primera vez añade los ejemplos."""
    con = storage.conectar(ruta)
    con.execute("PRAGMA foreign_keys = ON")
    clave = f"{Path(ruta or config.BASE_DATOS).resolve()}|{sembrar}"
    if clave in _preparadas:
        return con
    with _candado:
        if clave not in _preparadas:
            _preparar(con, sembrar)
            _preparadas.add(clave)
    return con


def _preparar(con, sembrar: bool) -> None:
    con.executescript(ESQUEMA)
    con.executemany("INSERT OR REPLACE INTO inv_organismos VALUES (?, ?, ?, ?, ?)", taxonomia.ORGANISMOS)
    filas, orden = [], 0
    for gid, gnombre, hijas in taxonomia.CATEGORIAS:
        filas.append((gid, gnombre, None, orden)); orden += 1
        for hid, hnombre in hijas:
            filas.append((hid, hnombre, gid, orden)); orden += 1
    con.executemany("INSERT OR REPLACE INTO inv_categorias VALUES (?, ?, ?, ?)", filas)
    con.commit()
    if sembrar and leer_ajuste(con, "semilla") is None:
        from . import semilla  # aquí para evitar la importación circular
        semilla.cargar(con)
        guardar_ajuste(con, "semilla", ahora())


def leer_ajuste(con, clave: str, defecto: str | None = None) -> str | None:
    fila = con.execute("SELECT valor FROM inv_ajustes WHERE clave = ?", (clave,)).fetchone()
    return fila["valor"] if fila else defecto


def guardar_ajuste(con, clave: str, valor: str) -> None:
    with con:
        con.execute("INSERT OR REPLACE INTO inv_ajustes VALUES (?, ?)", (clave, valor))


# ----------------------------------------------------------------------------- Recursos

def _validar(d: dict) -> None:
    if not str(d.get("titulo") or "").strip():
        raise ValueError("El recurso necesita un título.")
    if d.get("tipo") not in taxonomia.TIPOS:
        raise ValueError(f"Tipo de recurso desconocido: {d.get('tipo')}")
    organismos = {o[0] for o in taxonomia.ORGANISMOS}
    if d.get("organismo") not in organismos:
        raise ValueError(f"Fuente desconocida: {d.get('organismo')}")
    categorias = taxonomia.categoria_padre()
    malas = [c for c in d.get("categorias", []) if c not in categorias]
    if malas:
        raise ValueError(f"Categorías desconocidas: {', '.join(malas)}")
    if d.get("estado", "activo") not in taxonomia.ESTADOS:
        raise ValueError(f"Estado desconocido: {d.get('estado')}")
    if d.get("confianza") not in (None, "") and not 1 <= int(d["confianza"]) <= 5:
        raise ValueError("La confianza va de 1 a 5.")
    if d.get("fecha") and not re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", d["fecha"]):
        raise ValueError("La fecha debe tener el formato AAAA-MM-DD.")


def _indexar(con, rid: str) -> None:
    r = con.execute("SELECT titulo, resumen, contenido FROM inv_recursos WHERE id = ?", (rid,)).fetchone()
    etiquetas = " ".join(e["etiqueta"] for e in con.execute("SELECT etiqueta FROM inv_etiquetas WHERE recurso = ?", (rid,)))
    con.execute("DELETE FROM inv_busqueda WHERE id = ?", (rid,))
    if r:
        con.execute("INSERT INTO inv_busqueda (id, titulo, resumen, contenido, etiquetas) VALUES (?, ?, ?, ?, ?)",
                    (rid, r["titulo"], r["resumen"], r["contenido"], etiquetas))


def guardar_recurso(con, d: dict) -> str:
    """Crea (sin «id» o con uno nuevo) o actualiza un recurso. Devuelve su id."""
    d = {k: (v.strip() if isinstance(v, str) else v) for k, v in d.items()}
    d.setdefault("organismo", "PROPIO")
    d.setdefault("estado", "activo")
    for k in ("resumen", "contenido"):
        d[k] = d.get(k) or ""
    _validar(d)
    for k in ("dato_valor", "confianza"):
        if d.get(k) in ("", None):
            d[k] = None
    d["confianza"] = int(d["confianza"]) if d.get("confianza") is not None else None
    d["dato_valor"] = float(d["dato_valor"]) if d.get("dato_valor") is not None else None
    pilar = taxonomia.TIPOS[d["tipo"]]["pilar"]
    rid = d.get("id")
    existe = rid and con.execute("SELECT 1 FROM inv_recursos WHERE id = ?", (rid,)).fetchone()
    with con:
        if existe:
            con.execute(f"UPDATE inv_recursos SET pilar = ?, {', '.join(f'{c} = ?' for c in CAMPOS)}, modificado = ? WHERE id = ?",
                        [pilar, *[d.get(c) for c in CAMPOS], ahora(), rid])
        else:
            base = rid or slug(d["titulo"])
            rid, n = base, 2
            while con.execute("SELECT 1 FROM inv_recursos WHERE id = ?", (rid,)).fetchone():
                rid, n = f"{base}-{n}", n + 1
            marca = d.get("creado") or ahora()
            con.execute(f"INSERT INTO inv_recursos (id, pilar, {', '.join(CAMPOS)}, creado, modificado) "
                        f"VALUES (?, ?, {', '.join('?' * len(CAMPOS))}, ?, ?)",
                        [rid, pilar, *[d.get(c) for c in CAMPOS], marca, d.get("modificado") or marca])
        if "categorias" in d:
            con.execute("DELETE FROM inv_recurso_categoria WHERE recurso = ?", (rid,))
            con.executemany("INSERT INTO inv_recurso_categoria VALUES (?, ?)", [(rid, c) for c in dict.fromkeys(d["categorias"])])
        if "etiquetas" in d:
            con.execute("DELETE FROM inv_etiquetas WHERE recurso = ?", (rid,))
            etiquetas = {sin_tildes(e).strip().replace(" ", "-") for e in d["etiquetas"] if str(e).strip()}
            con.executemany("INSERT INTO inv_etiquetas VALUES (?, ?)", [(rid, e) for e in sorted(etiquetas)])
        _indexar(con, rid)
    return rid


def eliminar_recurso(con, rid: str) -> None:
    with con:
        con.execute("DELETE FROM inv_recursos WHERE id = ?", (rid,))
        con.execute("DELETE FROM inv_busqueda WHERE id = ?", (rid,))


def vincular(con, origen: str, destino: str, tipo: str) -> None:
    if tipo not in taxonomia.VINCULOS:
        raise ValueError(f"Tipo de vínculo desconocido: {tipo}")
    if origen == destino:
        raise ValueError("Un recurso no se puede vincular consigo mismo.")
    with con:
        con.execute("INSERT OR IGNORE INTO inv_vinculos VALUES (?, ?, ?)", (origen, destino, tipo))


def desvincular(con, origen: str, destino: str, tipo: str) -> None:
    with con:
        con.execute("DELETE FROM inv_vinculos WHERE origen = ? AND destino = ? AND tipo = ?", (origen, destino, tipo))


def dato_vivo(con, indicador: str | None, pais: str | None) -> dict | None:
    """Último valor de una serie del panel, para que los datos oficiales nunca se queden viejos."""
    if not indicador:
        return None
    fila = con.execute(
        "SELECT * FROM observaciones WHERE indicator_id = ? AND country_code = ? ORDER BY date DESC LIMIT 1",
        (indicador, pais or "ES")).fetchone()
    return dict(fila) if fila else None


def _organismos(con) -> dict[str, dict]:
    return {o["id"]: dict(o) for o in con.execute("SELECT * FROM inv_organismos")}


def _completar(con, r: dict, orgs: dict) -> dict:
    """Añade al recurso su organismo, el dato vivo y las citas listas para copiar."""
    r["organismo_info"] = orgs.get(r["organismo"])
    r["tipo_nombre"] = taxonomia.TIPOS[r["tipo"]]["nombre"]
    r["naturaleza"] = taxonomia.TIPOS[r["tipo"]]["naturaleza"]
    r["vivo"] = dato_vivo(con, r.get("indicador"), r.get("pais"))
    r["citas"] = citas.citas(r)
    return r


def obtener_recurso(con, rid: str) -> dict:
    fila = con.execute("SELECT * FROM inv_recursos WHERE id = ?", (rid,)).fetchone()
    if not fila:
        raise ValueError(f"No existe el recurso «{rid}».")
    r = dict(fila)
    r["categorias"] = [c["categoria"] for c in con.execute("SELECT categoria FROM inv_recurso_categoria WHERE recurso = ?", (rid,))]
    r["etiquetas"] = [e["etiqueta"] for e in con.execute("SELECT etiqueta FROM inv_etiquetas WHERE recurso = ? ORDER BY 1", (rid,))]
    r["vinculos"] = [dict(v) for v in con.execute("""
        SELECT v.tipo, 'sale' AS sentido, r.id, r.titulo, r.tipo AS tipo_recurso FROM inv_vinculos v JOIN inv_recursos r ON r.id = v.destino WHERE v.origen = ?
        UNION ALL
        SELECT v.tipo, 'entra' AS sentido, r.id, r.titulo, r.tipo AS tipo_recurso FROM inv_vinculos v JOIN inv_recursos r ON r.id = v.origen WHERE v.destino = ?
        """, (rid, rid))]
    r["fichas"] = [dict(f) for f in con.execute(
        "SELECT f.id, f.titulo FROM inv_ficha_recurso fr JOIN inv_fichas f ON f.id = fr.ficha WHERE fr.recurso = ?", (rid,))]
    return _completar(con, r, _organismos(con))


# ----------------------------------------------------------------------------- Búsqueda facetada

def _consulta_fts(q: str) -> str:
    """«tipos interés» → "tipos"* AND "interes"*  (prefijos: encuentra mientras se escribe)."""
    palabras = re.findall(r"\w+", sin_tildes(q))
    return " AND ".join(f'"{p}"*' for p in palabras)


def buscar(con, q: str = "", organismos=(), tipos=(), naturalezas=(), categorias=(), etiquetas=(), ambitos=(),
           pilar: str | None = None, desde: str | None = None, hasta: str | None = None, limite: int = 200) -> dict:
    """Busca recursos y cuenta cuántos hay en cada valor de cada filtro (facetas).

    Cada faceta se cuenta con todos los demás filtros aplicados menos el suyo, para que se vea
    cuántos resultados saldrían al marcar otra opción.
    """
    orgs = _organismos(con)
    padre = taxonomia.categoria_padre()
    filas = [dict(f) for f in con.execute("SELECT * FROM inv_recursos")]
    cats: dict[str, set] = {}
    for c in con.execute("SELECT recurso, categoria FROM inv_recurso_categoria"):
        cats.setdefault(c["recurso"], set()).update({c["categoria"], padre[c["categoria"]]})
    tags: dict[str, set] = {}
    for e in con.execute("SELECT recurso, etiqueta FROM inv_etiquetas"):
        tags.setdefault(e["recurso"], set()).add(e["etiqueta"])

    rango: dict[str, float] = {}
    if q.strip() and _consulta_fts(q):
        for i, f in enumerate(con.execute("SELECT id FROM inv_busqueda WHERE inv_busqueda MATCH ? ORDER BY bm25(inv_busqueda, 0, 8, 4, 1, 6)",
                                          (_consulta_fts(q),))):
            rango[f["id"]] = i

    filtros = {
        "texto": lambda r: not q.strip() or r["id"] in rango,
        "organismo": lambda r: not organismos or r["organismo"] in organismos,
        "tipo": lambda r: not tipos or r["tipo"] in tipos,
        "naturaleza": lambda r: not naturalezas or taxonomia.TIPOS[r["tipo"]]["naturaleza"] in naturalezas,
        "categoria": lambda r: not categorias or bool(cats.get(r["id"], set()) & set(categorias)),
        "etiqueta": lambda r: not etiquetas or set(etiquetas) <= tags.get(r["id"], set()),
        "ambito": lambda r: not ambitos or orgs[r["organismo"]]["ambito"] in ambitos,
        "pilar": lambda r: not pilar or r["pilar"] == pilar,
        "fecha": lambda r: (not desde or (r["fecha"] or "") >= desde) and (not hasta or (r["fecha"] or "9999") <= hasta),
    }

    def pasa(r, sin=None):
        return all(f(r) for k, f in filtros.items() if k != sin)

    def contar(sin, clave):
        cuenta: dict[str, int] = {}
        for r in filas:
            if pasa(r, sin):
                for v in clave(r):
                    cuenta[v] = cuenta.get(v, 0) + 1
        return cuenta

    facetas = {
        "organismo": contar("organismo", lambda r: [r["organismo"]]),
        "ambito": contar("ambito", lambda r: [orgs[r["organismo"]]["ambito"]]),
        "tipo": contar("tipo", lambda r: [r["tipo"]]),
        "naturaleza": contar("naturaleza", lambda r: [taxonomia.TIPOS[r["tipo"]]["naturaleza"]]),
        "categoria": contar("categoria", lambda r: sorted(cats.get(r["id"], set()))),
        "etiqueta": contar("etiqueta", lambda r: sorted(tags.get(r["id"], set()))),
        "pilar": contar("pilar", lambda r: [r["pilar"]]),
    }
    resultado = [r for r in filas if pasa(r)]
    if rango:
        resultado.sort(key=lambda r: rango[r["id"]])
    else:
        resultado.sort(key=lambda r: (r["fecha"] or "", r["modificado"]), reverse=True)
    total = len(resultado)
    salida = []
    for r in resultado[:limite]:
        r["categorias"] = sorted(c for c in cats.get(r["id"], set()) if padre[c] != c)
        r["etiquetas"] = sorted(tags.get(r["id"], set()))
        r.pop("contenido", None)
        salida.append(_completar(con, r, orgs))
    return {"total": total, "resultados": salida, "facetas": facetas}


# ----------------------------------------------------------------------------- Fichas de investigación

def guardar_ficha(con, d: dict) -> str:
    if not str(d.get("titulo") or "").strip():
        raise ValueError("La ficha necesita un título.")
    fid = d.get("id")
    with con:
        if fid and con.execute("SELECT 1 FROM inv_fichas WHERE id = ?", (fid,)).fetchone():
            con.execute("UPDATE inv_fichas SET titulo = ?, pregunta = ?, descripcion = ?, modificado = ? WHERE id = ?",
                        (d["titulo"].strip(), d.get("pregunta", ""), d.get("descripcion", ""), ahora(), fid))
        else:
            base = fid or slug(d["titulo"])
            fid, n = base, 2
            while con.execute("SELECT 1 FROM inv_fichas WHERE id = ?", (fid,)).fetchone():
                fid, n = f"{base}-{n}", n + 1
            con.execute("INSERT INTO inv_fichas VALUES (?, ?, ?, ?, ?, ?)",
                        (fid, d["titulo"].strip(), d.get("pregunta", ""), d.get("descripcion", ""), ahora(), ahora()))
        if "recursos" in d:
            con.execute("DELETE FROM inv_ficha_recurso WHERE ficha = ?", (fid,))
            con.executemany("INSERT INTO inv_ficha_recurso VALUES (?, ?, ?)", [(fid, r, i) for i, r in enumerate(dict.fromkeys(d["recursos"]))])
    return fid


def anadir_a_ficha(con, fid: str, rid: str) -> None:
    with con:
        orden = con.execute("SELECT COALESCE(MAX(orden), -1) + 1 FROM inv_ficha_recurso WHERE ficha = ?", (fid,)).fetchone()[0]
        con.execute("INSERT OR IGNORE INTO inv_ficha_recurso VALUES (?, ?, ?)", (fid, rid, orden))
        con.execute("UPDATE inv_fichas SET modificado = ? WHERE id = ?", (ahora(), fid))


def quitar_de_ficha(con, fid: str, rid: str) -> None:
    with con:
        con.execute("DELETE FROM inv_ficha_recurso WHERE ficha = ? AND recurso = ?", (fid, rid))


def eliminar_ficha(con, fid: str) -> None:
    with con:
        con.execute("DELETE FROM inv_fichas WHERE id = ?", (fid,))


def listar_fichas(con) -> list[dict]:
    return [dict(f) for f in con.execute("""
        SELECT f.*, COUNT(fr.recurso) AS n,
               SUM(r.pilar = 'externo') AS n_datos, SUM(r.tipo IN ('teoria', 'empirico')) AS n_teoria,
               SUM(r.tipo IN ('prediccion', 'proyeccion')) AS n_predicciones
        FROM inv_fichas f LEFT JOIN inv_ficha_recurso fr ON fr.ficha = f.id LEFT JOIN inv_recursos r ON r.id = fr.recurso
        GROUP BY f.id ORDER BY f.modificado DESC""")]


def obtener_ficha(con, fid: str) -> dict:
    fila = con.execute("SELECT * FROM inv_fichas WHERE id = ?", (fid,)).fetchone()
    if not fila:
        raise ValueError(f"No existe la ficha «{fid}».")
    ficha = dict(fila)
    ids = [f["recurso"] for f in con.execute("SELECT recurso FROM inv_ficha_recurso WHERE ficha = ? ORDER BY orden", (fid,))]
    recursos = [obtener_recurso(con, i) for i in ids]
    # Tres columnas: datos oficiales · desarrollo teórico · predicciones y conclusiones
    ficha["datos"] = [r for r in recursos if r["tipo"] in ("dato", "informe")]
    ficha["teoria"] = [r for r in recursos if r["tipo"] in ("teoria", "empirico")]
    ficha["predicciones"] = [r for r in recursos if r["tipo"] in ("prediccion", "proyeccion")]
    return ficha


# ----------------------------------------------------------------------------- Panel de resumen

def resumen(con) -> dict:
    padre = taxonomia.categoria_padre()
    nombres = taxonomia.nombres_categorias()
    por_categoria: dict[str, dict] = {g: {"id": g, "nombre": n, "total": 0, "externos": 0, "internos": 0, "sub": {}}
                                      for g, n, _ in taxonomia.CATEGORIAS}
    vistos: dict[str, set] = {g: set() for g in por_categoria}
    for f in con.execute("SELECT rc.recurso, rc.categoria, r.pilar FROM inv_recurso_categoria rc JOIN inv_recursos r ON r.id = rc.recurso"):
        g = padre[f["categoria"]]
        if f["recurso"] not in vistos[g]:
            vistos[g].add(f["recurso"])
            por_categoria[g]["total"] += 1
            por_categoria[g]["externos" if f["pilar"] == "externo" else "internos"] += 1
        if f["categoria"] != g:
            sub = por_categoria[g]["sub"]
            sub[nombres[f["categoria"]]] = sub.get(nombres[f["categoria"]], 0) + 1
    tipos = {t: 0 for t in taxonomia.TIPOS}
    for f in con.execute("SELECT tipo, COUNT(*) AS n FROM inv_recursos GROUP BY tipo"):
        tipos[f["tipo"]] = f["n"]
    orgs = _organismos(con)
    # Últimas actualizaciones: para los datos enlazados cuenta la fecha del último dato publicado.
    externos = [_completar(con, dict(r), orgs) for r in con.execute("SELECT * FROM inv_recursos WHERE pilar = 'externo'")]
    ultimas = sorted(externos, key=lambda r: ((r["vivo"]["date"] if r["vivo"] else r["fecha"]) or "", r["modificado"]), reverse=True)[:7]
    predicciones = [_completar(con, dict(r), orgs) for r in con.execute(
        "SELECT * FROM inv_recursos WHERE tipo IN ('prediccion', 'proyeccion') AND estado IN ('activo', 'borrador') "
        "ORDER BY tipo = 'proyeccion', COALESCE(horizonte, '') LIMIT 8")]
    por_ambito = {a: 0 for a in taxonomia.AMBITOS}
    for f in con.execute("SELECT o.ambito, COUNT(*) AS n FROM inv_recursos r JOIN inv_organismos o ON o.id = r.organismo GROUP BY 1"):
        por_ambito[f["ambito"]] = f["n"]
    for r in ultimas + predicciones:
        r.pop("contenido", None)
    return {
        "total": sum(tipos.values()),
        "categorias": list(por_categoria.values()),
        "tipos": tipos,
        "ambitos": por_ambito,
        "ultimas": ultimas,
        "predicciones": predicciones,
        "fichas": listar_fichas(con),
        "fuentes_panel": storage.estado_fuentes(),
    }


def taxonomia_completa(con) -> dict:
    return {
        "organismos": [dict(o) for o in con.execute("SELECT * FROM inv_organismos")],
        "ambitos": taxonomia.AMBITOS,
        "categorias": [{"id": g, "nombre": n, "hijas": [{"id": h, "nombre": hn} for h, hn in hijas]} for g, n, hijas in taxonomia.CATEGORIAS],
        "tipos": taxonomia.TIPOS,
        "vinculos": taxonomia.VINCULOS,
        "estados": taxonomia.ESTADOS,
        "etiquetas": [e["etiqueta"] for e in con.execute("SELECT etiqueta FROM inv_etiquetas GROUP BY 1 ORDER BY COUNT(*) DESC, 1")],
        "recursos": [dict(r) for r in con.execute("SELECT id, titulo, tipo FROM inv_recursos ORDER BY titulo")],
        "fichas": [dict(f) for f in con.execute("SELECT id, titulo FROM inv_fichas ORDER BY titulo")],
    }


def abrir(ruta: Path | None = None):
    """Uso: with abrir() as con: … (cierra la conexión al terminar)."""
    return closing(conectar(ruta))
