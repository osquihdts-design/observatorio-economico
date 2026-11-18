"""Citas listas para pegar en un trabajo: APA 7.ª, nota al pie y el dato clave en una frase.

Si el recurso está enlazado a una serie del panel, el dato y la cita salen de la serie
(siempre el último valor publicado), con la misma cita APA que el Excel del laboratorio.
"""
from __future__ import annotations

from datetime import date

from ..reporting import exporter

MESES = exporter.MESES
CORCHETES = {
    "dato": "Conjunto de datos",
    "informe": "Informe",
    "proyeccion": "Proyecciones macroeconómicas",
    "teoria": "Documento de trabajo inédito",
    "empirico": "Documento de trabajo inédito",
    "prediccion": "Documento de trabajo inédito",
}
MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def fecha_larga(f: str | None) -> str:
    """'2026-10-09' → '9 de octubre de 2026' · '2026-10' → 'octubre de 2026' · '2026' → '2026'."""
    if not f:
        return "sin fecha"
    partes = f.split("-")
    if len(partes) == 3:
        return f"{int(partes[2])} de {MESES[int(partes[1]) - 1]} de {partes[0]}"
    if len(partes) == 2:
        return f"{MESES[int(partes[1]) - 1]} de {partes[0]}"
    return partes[0]


def numero(v: float, decimales: int | None = None) -> str:
    if decimales is None:
        decimales = 0 if abs(v) >= 1000 else 2 if abs(v) < 10 and round(v, 1) != v else 1
    texto = f"{v:,.{decimales}f}"
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def _unidad(u: str | None) -> str:
    if not u:
        return ""
    return " %" if u.startswith("%") else f" {u}"


def periodo_serie(fecha: str, frecuencia: str) -> str:
    a, m = int(fecha[:4]), int(fecha[5:7])
    return f"T{(m - 1) // 3 + 1} {a}" if frecuencia == "Q" else f"{MESES_CORTOS[m - 1]} {a}"


def dato_clave(r: dict) -> str | None:
    """«IPC general (variación anual), España: 4,9 % (oct 2026)»"""
    vivo = r.get("vivo") if r.get("tipo") == "dato" else None
    if vivo:
        return (f"{vivo['indicator_name']}, {vivo['country_name']}: {numero(vivo['value'], 1)}{_unidad(vivo['unit'])} "
                f"({periodo_serie(vivo['date'], vivo['frequency'])})")
    if r.get("dato_valor") is None:
        return None
    valor = f"{numero(r['dato_valor'])}{_unidad(r.get('dato_unidad'))}"
    if r.get("dato_periodo"):
        org = r.get("organismo_info") or {}
        quien = "Elaboración propia" if r.get("organismo") == "PROPIO" else org.get("siglas", "")
        fecha = f" ({fecha_larga(r['fecha'][:7])})" if r.get("fecha") and r.get("organismo") != "PROPIO" else ""
        return f"{quien}{fecha}, {r['dato_periodo']}: {valor}"
    return f"{r['titulo']}: {valor}"


def cita_apa(r: dict, consulta: date | None = None) -> str:
    vivo = r.get("vivo") if r.get("tipo") == "dato" else None
    if vivo:
        return exporter.cita_apa(vivo, consulta)
    org = r.get("organismo_info") or {}
    autor = r.get("autores") or (org.get("nombre") if r.get("organismo") != "PROPIO" else "Elaboración propia")
    anio = (r.get("fecha") or "")[:4] or "s. f."
    if r.get("fecha") and len(r["fecha"]) == 10 and r["tipo"] in ("informe", "proyeccion"):
        a, m, d = r["fecha"].split("-")
        anio = f"{a}, {int(d)} de {MESES[int(m) - 1]}"
    cita = f"{autor}. ({anio}). {r['titulo']} [{CORCHETES[r['tipo']]}]."
    if r.get("autores") and org.get("nombre") and r.get("organismo") != "PROPIO" and org["nombre"] != r["autores"]:
        cita += f" {org['nombre']}."
    if r.get("url"):
        if r["tipo"] == "dato" and r.get("fecha_consulta"):
            cita += f" Recuperado el {fecha_larga(r['fecha_consulta'])}, de {r['url']}"
        else:
            cita += f" {r['url']}"
    return cita


def nota_pie(r: dict) -> str:
    vivo = r.get("vivo") if r.get("tipo") == "dato" else None
    org = r.get("organismo_info") or {}
    if vivo:
        siglas = {"EUROSTAT": "Eurostat"}.get(vivo["source"], vivo["source"])
        url = exporter.url_serie(vivo["source"], vivo["series_code"])
        return (f"{siglas}, «{vivo['indicator_name']}: {vivo['country_name']}», serie {vivo['series_code'].split(' ')[0]}, "
                f"dato de {periodo_serie(vivo['date'], vivo['frequency'])}. Disponible en: {url}.")
    autor = r.get("autores") or (org.get("siglas") if r.get("organismo") != "PROPIO" else None) or "Elaboración propia"
    partes = [f"{autor}, «{r['titulo']}»", fecha_larga(r.get("fecha"))]
    if r.get("url"):
        partes.append(f"disponible en: {r['url']}")
    if r.get("fecha_consulta"):
        partes.append(f"consultado el {fecha_larga(r['fecha_consulta'])}")
    return ", ".join(partes) + "."


def citas(r: dict) -> dict:
    dato = dato_clave(r)
    apa = cita_apa(r)
    return {"apa": apa, "nota": nota_pie(r), "dato": dato,
            "completa": f"{dato}. Fuente: {apa}" if dato else apa}
