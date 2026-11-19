"""Calendario de próximas publicaciones: INE (archivo iCalendar oficial) y decisiones de tipos del BCE.

INE: https://www.ine.es/dynt3/Calendario/calendario.ics  (todas sus publicaciones; nos quedamos con las del panel)
BCE: página oficial de reuniones del Consejo de Gobierno; la decisión de tipos es el día 2 de cada reunión
     de política monetaria, con rueda de prensa (comunicado a las 14:15, hora de Fráncfort).
"""
from __future__ import annotations

import html
import re

from .base import ErrorFuente, descargar

URL_INE = "https://www.ine.es/dynt3/Calendario/calendario.ics"
URL_BCE = "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html"

# (patrón del título del INE, nombre corto, página del panel). El orden importa: el primero que encaje.
# (El IPCA sale el mismo día y a la misma hora que el IPC, así que no se repite.)
PUBLICACIONES_INE = [
    (r"^Índice de Precios de Consumo\. Avance", "IPC adelantado", "inflacion"),
    (r"^Índice de Precios de Consumo\. (Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)",
     "IPC", "inflacion"),
    (r"^Encuesta de [Pp]oblación [Aa]ctiva\. (Trimestre|T\d)", "EPA (paro y empleo)", "laboral"),
    (r"^Contabilidad Nacional Trimestral de España\. Trimestre", "PIB trimestral", "mapa/pib_var"),
    (r"^Índice de Precios de Vivienda\. Trimestre", "Precio de la vivienda", "vivienda"),
    (r"^Encuesta Trimestral de Coste Laboral\. Trimestre", "Coste laboral y salarios", "vivienda"),
]
EXCLUIR = re.compile(r"Ponderaciones|Medias anuales|Decil|Experimental", re.I)


def _fecha_ics(linea: str) -> tuple[str, str | None]:
    """'DTSTART;TZID=Europe/Madrid:20261127T090000' → ('2026-11-27', '09:00')."""
    valor = linea.split(":", 1)[1].strip()
    fecha = f"{valor[:4]}-{valor[4:6]}-{valor[6:8]}"
    hora = f"{valor[9:11]}:{valor[11:13]}" if len(valor) >= 13 and valor[8] == "T" else None
    return fecha, hora


def leer_ics_ine(texto: str) -> list[dict]:
    """Eventos del calendario del INE que corresponden a los indicadores del panel."""
    texto = re.sub(r"\r?\n[ \t]", "", texto)  # en iCalendar, una línea larga sigue en la siguiente con un espacio
    eventos = []
    for bloque in re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", texto, re.S):
        resumen = re.search(r"^SUMMARY[^:]*:(.*)$", bloque, re.M)
        inicio = re.search(r"^DTSTART[^\n]*$", bloque, re.M)
        if not resumen or not inicio:
            continue
        titulo = resumen.group(1).strip().replace("\\,", ",")
        if EXCLUIR.search(titulo):
            continue
        for patron, corto, pagina in PUBLICACIONES_INE:
            if re.search(patron, titulo):
                fecha, hora = _fecha_ics(inicio.group(0))
                periodo = re.split(r"\.\s+", titulo)[-1]
                eventos.append({"fecha": fecha, "hora": hora, "fuente": "INE", "titulo": corto, "periodo": periodo,
                                "detalle": titulo, "pagina": pagina, "url": "https://www.ine.es/dynt3/Calendario/calenHTML.htm"})
                break
    return eventos


def leer_pagina_bce(texto: str) -> list[dict]:
    """Días de decisión de política monetaria del BCE (día 2 de cada reunión, con rueda de prensa)."""
    texto = re.sub(r"<script.*?</script>", "", texto, flags=re.S)
    lineas = [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "\n", texto)).split("\n") if l.strip()]
    eventos = []
    for i, linea in enumerate(lineas[:-1]):
        m = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", linea)
        if m and re.search(r"monetary policy meeting.*Day 2.*press conference", lineas[i + 1], re.I):
            dia, mes, anio = m.groups()
            eventos.append({"fecha": f"{anio}-{mes}-{dia}", "hora": "14:15", "fuente": "BCE", "titulo": "Decisión de tipos del BCE",
                            "periodo": "Reunión de política monetaria", "detalle": lineas[i + 1], "pagina": "monetaria", "url": URL_BCE})
    return eventos


def descargar_calendario() -> list[dict]:
    """Descarga y une los dos calendarios. Si una fuente falla, se devuelve lo que haya de la otra."""
    eventos, errores = [], []
    for nombre, url, lector in (("INE", URL_INE, leer_ics_ine), ("BCE", URL_BCE, leer_pagina_bce)):
        try:
            eventos += lector(descargar(url).decode("utf-8", errors="replace"))
        except (ErrorFuente, OSError) as e:
            errores.append(f"{nombre}: {e}")
    if not eventos and errores:
        raise ErrorFuente("No se pudo descargar el calendario: " + "; ".join(errores))
    vistos, unicos = set(), []
    for e in sorted(eventos, key=lambda e: (e["fecha"], e["hora"] or "", e["titulo"])):
        clave = (e["fecha"], e["titulo"], e["periodo"])
        if clave not in vistos:
            vistos.add(clave)
            unicos.append(e)
    return unicos
