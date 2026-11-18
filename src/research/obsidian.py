"""Sincronización con una bóveda de Obsidian (que no es más que una carpeta de notas Markdown).

Exportar: cada recurso pasa a ser una nota en <bóveda>/Observatorio/, con sus propiedades (fuente, tipo,
categorías, fecha, cita APA…) y enlaces [[…]] a los recursos relacionados, para que el grafo de Obsidian
muestre la investigación. También se crean una nota por ficha, una nota de inicio y una vista de Bases.

Importar: si editas una nota en Obsidian (o creas una nueva dentro de «Observatorio/Análisis propios»),
al sincronizar se guarda en el panel. Gana la versión más reciente: si la nota se modificó después que el
recurso del panel, manda la nota; si no, el panel la sobrescribe al exportar.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

from . import almacen, taxonomia

CARPETA = "Observatorio"
EXTERNOS = "Fuentes secundarias"
INTERNOS = "Análisis propios"
FICHAS = "Fichas"
MARCA = "%% ↓ Generado por el Observatorio económico: lo que escribas debajo de esta línea se sobrescribe %%"
BOVEDA_POR_DEFECTO = Path.home() / "Downloads" / "mybrain" / "My brain"


def boveda(con) -> Path:
    return Path(almacen.leer_ajuste(con, "boveda") or os.environ.get("OBSERVATORIO_BOVEDA") or BOVEDA_POR_DEFECTO)


def estado(con) -> dict:
    ruta = boveda(con)
    return {"ruta": str(ruta), "existe": ruta.is_dir(), "es_boveda": (ruta / ".obsidian").is_dir(),
            "ultima": almacen.leer_ajuste(con, "obsidian_ultima"), "resumen": almacen.leer_ajuste(con, "obsidian_resumen")}


# ----------------------------------------------------------------------------- YAML mínimo (propiedades de Obsidian)

def _valor_yaml(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return json.dumps(str(v), ensure_ascii=False)


def a_yaml(props: dict) -> str:
    lineas = ["---"]
    for k, v in props.items():
        if v is None or v == "" or v == []:
            continue
        if isinstance(v, list):
            lineas.append(f"{k}:")
            lineas += [f"  - {_valor_yaml(x)}" for x in v]
        else:
            lineas.append(f"{k}: {_valor_yaml(v)}")
    lineas.append("---")
    return "\n".join(lineas)


def _leer_valor(texto: str):
    t = texto.strip()
    if not t:
        return None
    if t.startswith('"'):
        try:
            return json.loads(t)
        except ValueError:
            return t.strip('"')
    if t.startswith("'") and t.endswith("'"):
        return t[1:-1].replace("''", "'")
    if t.startswith("[") and t.endswith("]"):
        return [x for x in (_leer_valor(p) for p in t[1:-1].split(",")) if x is not None]
    if re.fullmatch(r"-?\d+", t):
        return int(t)
    if re.fullmatch(r"-?\d+\.\d+", t):
        return float(t)
    return t


def leer_nota(texto: str) -> tuple[dict, str]:
    """Separa las propiedades (frontmatter) del cuerpo de la nota."""
    texto = texto.replace("\r\n", "\n").lstrip("﻿")
    if not texto.startswith("---\n"):
        return {}, texto
    fin = texto.find("\n---", 4)
    if fin < 0:
        return {}, texto
    props, clave = {}, None
    for linea in texto[4:fin].split("\n"):
        m = re.match(r"^([A-Za-z0-9_áéíóúñ-]+):\s*(.*)$", linea)
        if m:
            clave = m.group(1)
            props[clave] = _leer_valor(m.group(2))
        elif clave and re.match(r"^\s+-\s*", linea):
            if not isinstance(props.get(clave), list):
                props[clave] = []
            valor = _leer_valor(re.sub(r"^\s+-\s*", "", linea))
            if valor is not None:
                props[clave].append(valor)
    cuerpo = texto[fin + 4:]
    return props, cuerpo[1:] if cuerpo.startswith("\n") else cuerpo


def nombre_archivo(titulo: str) -> str:
    limpio = re.sub(r'[\\/:*?"<>|#^\[\]]', "", titulo).strip().rstrip(".")
    return (limpio[:120] or "Sin título") + ".md"


# ----------------------------------------------------------------------------- Exportar

def _notas_existentes(raiz: Path) -> dict[str, Path]:
    """{id del recurso o de la ficha: ruta}, buscando en toda la bóveda (por si el usuario movió la nota)."""
    rutas = {}
    for ruta in raiz.rglob("*.md"):
        if ".obsidian" in ruta.parts or ".trash" in ruta.parts:
            continue
        try:
            props, _ = leer_nota(ruta.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError):
            continue
        if props.get("observatorio") and props.get("id"):
            rutas[f"{props['observatorio']}:{props['id']}"] = ruta
    return rutas


def _escribir(ruta: Path, texto: str) -> bool:
    """Escribe solo si cambia (para no tocar la fecha de las notas sin necesidad)."""
    if ruta.exists() and ruta.read_text(encoding="utf-8") == texto:
        return False
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(texto, encoding="utf-8", newline="\n")
    return True


def _nota_recurso(r: dict, titulos: dict[str, str], fichas: list[dict]) -> str:
    nombres = taxonomia.nombres_categorias()
    props = {
        "observatorio": "recurso",
        "id": r["id"],
        "titulo": r["titulo"],
        "tipo": taxonomia.TIPOS[r["tipo"]]["nombre"],
        "pilar": "Fuente secundaria" if r["pilar"] == "externo" else "Producción propia",
        "fuente": r["organismo_info"]["nombre"],
        "categorias": [nombres[c] for c in r["categorias"]],
        "tags": r["etiquetas"],
        "fecha": r.get("fecha"),
        "url": r.get("url"),
        "dato": r["citas"]["dato"],
        "estado": taxonomia.ESTADOS.get(r["estado"], r["estado"]),
        "horizonte": r.get("horizonte"),
        "confianza": r.get("confianza"),
        "fichas": [f"[[{titulos['ficha:' + f['id']]}]]" for f in fichas],
        "cita": r["citas"]["apa"],
        "actualizado": r["modificado"],
    }
    partes = [a_yaml(props), ""]
    if r["resumen"]:
        partes += ["> [!abstract] Resumen", *[f"> {l}" if l else ">" for l in r["resumen"].split("\n")], ""]
    if r["contenido"]:
        partes += [r["contenido"].rstrip(), ""]
    partes += [MARCA, ""]
    if r["citas"]["dato"]:
        partes += ["## Dato clave", "", f"**{r['citas']['dato']}**", ""]
        if r.get("notas_extraccion"):
            partes += [f"*Notas de extracción:* {r['notas_extraccion']}", ""]
    if r["vinculos"]:
        partes += ["## Vínculos", ""]
        for v in r["vinculos"]:
            verbo = taxonomia.VINCULOS[v["tipo"]]
            enlace = f"[[{titulos.get('recurso:' + v['id'], v['titulo'])}]]"
            partes.append(f"- {verbo.capitalize()} {enlace}" if v["sentido"] == "sale" else f"- {enlace} {verbo} esta nota")
        partes.append("")
    partes += ["## Cómo citarlo", "", f"> {r['citas']['apa']}", ""]
    return "\n".join(partes)


def _nota_ficha(f: dict, titulos: dict[str, str]) -> str:
    def lista(recursos):
        return [f"- [[{titulos['recurso:' + r['id']]}]] · {r['tipo_nombre']}" + (f" — {r['citas']['dato']}" if r["citas"]["dato"] else "")
                for r in recursos] or ["- (ninguno todavía)"]
    props = {"observatorio": "ficha", "id": f["id"], "pregunta": f["pregunta"], "tags": ["ficha-de-investigacion"],
             "actualizado": f["modificado"]}
    return "\n".join([
        a_yaml(props), "",
        f"> [!question] {f['pregunta']}" if f["pregunta"] else "", "",
        f["descripcion"], "", MARCA, "",
        "## Datos oficiales", "", *lista(f["datos"]), "",
        "## Desarrollo teórico y análisis", "", *lista(f["teoria"]), "",
        "## Predicciones y conclusiones", "", *lista(f["predicciones"]), "",
    ])


BASE = """filters:
  and:
    - file.inFolder("Observatorio")
    - 'observatorio == "recurso"'
views:
  - type: table
    name: Todos los recursos
    order:
      - file.name
      - tipo
      - fuente
      - fecha
      - dato
      - estado
  - type: table
    name: Predicciones
    filters:
      or:
        - 'tipo == "Predicción propia"'
        - 'tipo == "Proyección oficial"'
    order:
      - file.name
      - horizonte
      - confianza
      - dato
      - estado
  - type: table
    name: Fuentes secundarias
    filters:
      and:
        - 'pilar == "Fuente secundaria"'
    order:
      - file.name
      - fuente
      - fecha
      - url
"""


def exportar(con, raiz: Path | None = None, rutas_nuevas: dict[str, Path] | None = None) -> dict:
    raiz = Path(raiz or boveda(con))
    if not raiz.is_dir():
        raise ValueError(f"No encuentro la carpeta de Obsidian: {raiz}")
    base = raiz / CARPETA
    existentes = {**_notas_existentes(raiz), **(rutas_nuevas or {})}
    recursos = [almacen.obtener_recurso(con, f["id"]) for f in con.execute("SELECT id FROM inv_recursos ORDER BY id")]
    fichas = [almacen.obtener_ficha(con, f["id"]) for f in almacen.listar_fichas(con)]

    rutas: dict[str, Path] = {}
    for r in recursos:
        clave = f"recurso:{r['id']}"
        destino = base / (EXTERNOS if r["pilar"] == "externo" else INTERNOS) / taxonomia.TIPOS[r["tipo"]]["nombre"]
        rutas[clave] = existentes.get(clave) or destino / nombre_archivo(r["titulo"])
    for f in fichas:
        clave = f"ficha:{f['id']}"
        rutas[clave] = existentes.get(clave) or base / FICHAS / nombre_archivo(f["titulo"])
    # Si el título cambió en el panel, la nota se renombra (Obsidian lo detecta solo).
    todos = {**{f"recurso:{r['id']}": r["titulo"] for r in recursos}, **{f"ficha:{f['id']}": f["titulo"] for f in fichas}}
    for clave, ruta in list(rutas.items()):
        nuevo = ruta.with_name(nombre_archivo(todos[clave]))
        if ruta.exists() and ruta.name != nuevo.name and not nuevo.exists():
            ruta.rename(nuevo)
            rutas[clave] = nuevo
    titulos = {k: p.stem for k, p in rutas.items()}

    escritas = 0
    fichas_de: dict[str, list] = {}
    for f in fichas:
        for r in f["datos"] + f["teoria"] + f["predicciones"]:
            fichas_de.setdefault(r["id"], []).append(f)
    for r in recursos:
        escritas += _escribir(rutas[f"recurso:{r['id']}"], _nota_recurso(r, titulos, fichas_de.get(r["id"], [])))
    for f in fichas:
        escritas += _escribir(rutas[f"ficha:{f['id']}"], _nota_ficha(f, titulos))

    inicio = ["# Observatorio económico", "",
              "Notas creadas por el centro de investigación del panel. Edita el resumen o el texto de cualquier nota y pulsa "
              "**Sincronizar con Obsidian** en el panel para guardar los cambios. Para añadir un análisis propio, crea una nota "
              f"en «{INTERNOS}».", "", "## Fichas de investigación", ""]
    inicio += [f"- [[{titulos['ficha:' + f['id']]}]] — {f['pregunta']}" for f in fichas]
    inicio += ["", "## Tabla de todos los recursos", "", "![[Observatorio.base]]", ""]
    escritas += _escribir(base / "Inicio.md", "\n".join(inicio))
    escritas += _escribir(base / "Observatorio.base", BASE)
    return {"notas": len(recursos) + len(fichas), "escritas": escritas, "carpeta": str(base)}


# ----------------------------------------------------------------------------- Importar

def _separar_cuerpo(cuerpo: str) -> tuple[str, str]:
    """(resumen, contenido) a partir del cuerpo de una nota."""
    cuerpo = cuerpo.split(MARCA)[0]
    lineas = cuerpo.strip("\n").split("\n")
    resumen = []
    if lineas and re.match(r"^>\s*\[!abstract\]", lineas[0]):
        i = 1
        while i < len(lineas) and lineas[i].startswith(">"):
            resumen.append(re.sub(r"^>\s?", "", lineas[i]))
            i += 1
        lineas = lineas[i:]
    return "\n".join(resumen).strip(), "\n".join(lineas).strip()


def _a_id(valor, tabla: dict[str, str]) -> str | None:
    """Acepta el id («teoria») o el nombre legible («Marco teórico»)."""
    if valor is None:
        return None
    if valor in tabla:
        return valor
    inverso = {almacen.sin_tildes(n): k for k, n in tabla.items()}
    return inverso.get(almacen.sin_tildes(str(valor)))


def _modificada(ruta: Path) -> str:
    return datetime.fromtimestamp(ruta.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")


def importar(con, raiz: Path | None = None) -> dict:
    raiz = Path(raiz or boveda(con))
    if not raiz.is_dir():
        raise ValueError(f"No encuentro la carpeta de Obsidian: {raiz}")
    tipos = {k: v["nombre"] for k, v in taxonomia.TIPOS.items()}
    estados = taxonomia.ESTADOS
    categorias = taxonomia.nombres_categorias()
    organismos = {o[0]: o[1] for o in taxonomia.ORGANISMOS}
    informe = {"nuevas": [], "actualizadas": [], "huerfanas": [], "errores": [], "rutas": {}}
    carpeta_internos = raiz / CARPETA / INTERNOS
    for ruta in sorted(raiz.rglob("*.md")):
        if ".obsidian" in ruta.parts or ".trash" in ruta.parts:
            continue
        try:
            props, cuerpo = leer_nota(ruta.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError) as e:
            informe["errores"].append(f"{ruta.name}: {e}")
            continue
        nueva_en_carpeta = not props.get("observatorio") and carpeta_internos in ruta.parents
        if props.get("observatorio") != "recurso" and not nueva_en_carpeta:
            continue
        resumen, contenido = _separar_cuerpo(cuerpo)
        # El nombre del archivo no admite «:» ni «?»: se usa la propiedad «titulo», salvo que se haya renombrado la nota.
        titulo = props.get("titulo")
        if not titulo or nombre_archivo(str(titulo))[:-3] != ruta.stem:
            titulo = ruta.stem
        datos = {
            "titulo": str(titulo), "resumen": resumen, "contenido": contenido,
            "tipo": _a_id(props.get("tipo"), tipos) or "teoria",
            "estado": _a_id(props.get("estado"), estados) or "activo",
        }
        for clave in ("fecha", "url", "horizonte"):
            if props.get(clave) is not None:
                datos[clave] = str(props[clave])
        if props.get("confianza") not in (None, ""):
            datos["confianza"] = props["confianza"]
        if isinstance(props.get("categorias"), list):
            datos["categorias"] = [c for c in (_a_id(x, categorias) for x in props["categorias"]) if c]
        if isinstance(props.get("tags"), list):
            datos["etiquetas"] = [str(t) for t in props["tags"]]
        try:
            rid = props.get("id")
            if rid:
                fila = con.execute("SELECT * FROM inv_recursos WHERE id = ?", (rid,)).fetchone()
                if not fila:
                    informe["huerfanas"].append(ruta.stem)  # se borró en el panel: no se resucita
                    continue
                actual = almacen.obtener_recurso(con, rid)
                if _modificada(ruta) <= actual["modificado"]:
                    continue  # el panel tiene la versión más reciente
                cambios = {k: v for k, v in datos.items()
                           if (sorted(v) if isinstance(v, list) else v) != (sorted(actual.get(k) or []) if isinstance(v, list) else actual.get(k))}
                if "confianza" in cambios and cambios["confianza"] == actual.get("confianza"):
                    cambios.pop("confianza")
                if cambios:
                    base = {k: actual[k] for k in almacen.CAMPOS}
                    almacen.guardar_recurso(con, {**base, **cambios, "id": rid})
                    informe["actualizadas"].append(ruta.stem)
            else:
                fuente = _a_id(props.get("fuente"), organismos) or "PROPIO"
                nuevo = almacen.guardar_recurso(con, {**datos, "organismo": fuente, "categorias": datos.get("categorias", []),
                                                      "etiquetas": datos.get("etiquetas", [])})
                informe["nuevas"].append(ruta.stem)
                informe["rutas"][f"recurso:{nuevo}"] = ruta  # al exportar, se completa en el mismo sitio
        except ValueError as e:
            informe["errores"].append(f"{ruta.name}: {e}")
    return informe


def sincronizar(con, raiz: Path | None = None) -> dict:
    """Primero importa lo editado en Obsidian; después exporta todo el panel a la bóveda."""
    raiz = Path(raiz or boveda(con))
    informe = importar(con, raiz)
    informe.update(exportar(con, raiz, informe.pop("rutas")))
    marca = almacen.ahora()
    almacen.guardar_ajuste(con, "obsidian_ultima", marca)
    almacen.guardar_ajuste(con, "obsidian_resumen", json.dumps(
        {k: (len(v) if isinstance(v, list) else v) for k, v in informe.items()}, ensure_ascii=False))
    return informe
