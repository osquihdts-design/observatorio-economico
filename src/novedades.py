"""Novedades del día: qué datos oficiales nuevos han salido desde la última publicación de la web.

Cada día, al generar la web pública, se compara el resumen de hoy (último dato de cada indicador)
con el de la web ya publicada (el de ayer). Si un indicador tiene un periodo nuevo para España,
la zona euro o la UE, es una novedad. Con ellas se escribe una entrada al día como mucho en
`novedades.xml` (RSS), que un servicio de boletines puede enviar por correo a quien se suscriba.

Las entradas se limitan a describir el dato (valor, periodo y valor anterior), sin valorarlo.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from email.utils import format_datetime
from html import escape

PAISES_FOCO = ("ES", "EA", "UE")
# Los tipos oficiales del BCE se guardan como «último valor de cada mes»: un mes nuevo no es una
# publicación. Para ellos solo es novedad que el BCE cambie el tipo.
POR_CAMBIO = ("bce_deposito", "bce_refinanciacion", "bce_marginal")
FUENTES = {"EUROSTAT": "Eurostat", "INE": "INE", "BCE": "BCE"}
MAXIMO_ENTRADAS = 30
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def periodo_texto(fecha: str, frecuencia: str) -> str:
    """«2026-10-01» → «octubre de 2026» (mensual), «3.er trimestre de 2026» (trimestral) o «2025» (anual)."""
    anio, mes = int(fecha[:4]), int(fecha[5:7])
    if frecuencia == "A":
        return str(anio)
    if frecuencia == "Q":
        t = (mes - 1) // 3 + 1
        return f"{t}.{'er' if t in (1, 3) else 'º'} trimestre de {anio}"
    return f"{MESES[mes - 1]} de {anio}"


def numero(valor: float | None, unidad: str) -> str:
    if valor is None:
        return "—"
    # Euros sin decimales; el resto con uno, o con dos si el organismo los publica (tipos de interés).
    decimales = 0 if unidad == "€" else 2 if round(valor, 1) != round(valor, 2) else 1
    texto = f"{valor:,.{decimales}f}".replace(",", " ").replace(".", ",").replace(" ", ".")
    if unidad == "€":
        return f"{texto} €"
    if unidad.startswith("%"):
        return f"{texto} %"
    return texto


def detectar(hoy: list[dict], ayer: list[dict] | None) -> list[dict]:
    """Indicadores (de España, zona euro o UE) cuyo último periodo es posterior al de la web publicada.

    Si no hay resumen anterior (primera vez o sin conexión) no se devuelve nada: así nunca se manda
    un correo con datos que no son nuevos.
    """
    if not ayer:
        return []
    antes = {(f["indicador"], f["pais"]): f for f in ayer}

    def es_nueva(f):
        previa = antes.get((f["indicador"], f["pais"]))
        if f["pais"] not in PAISES_FOCO or previa is None:
            return False
        if f["indicador"] in POR_CAMBIO:
            return f["valor"] != previa["valor"]
        return f["fecha"] > previa["fecha"]

    nuevas = [dict(f, anterior=antes[(f["indicador"], f["pais"])]["valor"]) if f["indicador"] in POR_CAMBIO else f
              for f in hoy if es_nueva(f)]
    orden = {p: i for i, p in enumerate(PAISES_FOCO)}
    return sorted(nuevas, key=lambda f: (f["fuente"], f["nombre"], orden[f["pais"]]))


def entrada(novedades: list[dict], proximas: list[dict], dia: date, url_web: str) -> dict | None:
    """Entrada del día (una como mucho). None si no hay datos nuevos."""
    if not novedades:
        return None
    lineas = []
    for f in novedades:
        texto = (f"{f['nombre']} · {f['pais_nombre']} · {periodo_texto(f['fecha'], f.get('frecuencia', 'M'))}: "
                 f"{numero(f['valor'], f['unidad'])}")
        if f.get("anterior") is not None:
            texto += f" (periodo anterior: {numero(f['anterior'], f['unidad'])})"
        lineas.append(texto + f". Fuente: {FUENTES.get(f['fuente'].upper(), f['fuente'])}.")
    n = len(novedades)
    titulo = f"{n} dato{'s' if n > 1 else ''} oficial{'es' if n > 1 else ''} nuevo{'s' if n > 1 else ''} · {dia.day} de {MESES[dia.month - 1]} de {dia.year}"
    html = "<p>Datos publicados por el INE, Eurostat y el BCE desde la última actualización del Observatorio:</p><ul>"
    html += "".join(f"<li>{escape(l)}</li>" for l in lineas) + "</ul>"
    if proximas:
        html += "<p><strong>Próximas publicaciones</strong></p><ul>"
        html += "".join(f"<li>{escape(e['fecha'])} · {escape(e['fuente'])}: {escape(e['titulo'])} ({escape(e['periodo'])})</li>" for e in proximas[:5])
        html += "</ul>"
    html += f'<p><a href="{escape(url_web)}">Ver los gráficos en el Observatorio económico</a></p>'
    return {"id": dia.isoformat(), "titulo": titulo, "html": html, "texto": lineas, "datos": novedades,
            "fecha": datetime(dia.year, dia.month, dia.day, 8, 0, tzinfo=timezone.utc).isoformat()}


def sumar_del_dia(historial: list[dict], nuevas: list[dict], dia: date) -> list[dict]:
    """Si la web ya se publicó hoy, junta sus novedades con las nuevas (sin repetir): una entrada al día."""
    previa = next((e for e in historial if e.get("id") == dia.isoformat()), None)
    if not previa:
        return nuevas
    vistas = {(f["indicador"], f["pais"]): f for f in previa.get("datos", [])}
    vistas.update({(f["indicador"], f["pais"]): f for f in nuevas})
    orden = {p: i for i, p in enumerate(PAISES_FOCO)}
    return sorted(vistas.values(), key=lambda f: (f["fuente"], f["nombre"], orden.get(f["pais"], 9)))


def combinar(historial: list[dict], nueva: dict | None, maximo: int = MAXIMO_ENTRADAS) -> list[dict]:
    """Añade la entrada del día al historial. Una sola por día: si ya había una de hoy, se sustituye."""
    if nueva is None:
        return historial[:maximo]
    resto = [e for e in historial if e.get("id") != nueva["id"]]
    return [nueva, *resto][:maximo]


def rss(historial: list[dict], url_web: str) -> str:
    """Canal RSS 2.0 con las entradas (la más reciente primero)."""
    items = []
    for e in historial:
        cuando = format_datetime(datetime.fromisoformat(e["fecha"]))
        items.append(
            f"<item><title>{escape(e['titulo'])}</title><link>{escape(url_web)}</link>"
            f"<guid isPermaLink=\"false\">observatorio-{escape(e['id'])}</guid><pubDate>{cuando}</pubDate>"
            f"<description>{escape(e['html'])}</description></item>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
            "<title>Observatorio económico · novedades</title>"
            f"<link>{escape(url_web)}</link>"
            "<description>Datos oficiales nuevos del INE, Eurostat y el BCE (como mucho, un resumen al día).</description>"
            "<language>es-es</language>" + "".join(items) + "</channel></rss>\n")
