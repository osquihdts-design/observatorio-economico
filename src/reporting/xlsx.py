"""Escritor mínimo de archivos Excel (.xlsx) con Python estándar.

Un .xlsx es un ZIP con varios XML dentro (formato Office Open XML). Aquí se generan los
imprescindibles: libro, hojas, estilos (negrita para cabeceras, formato de fecha y de número).
"""
from __future__ import annotations

import zipfile
from datetime import date, datetime
from pathlib import Path
from xml.sax.saxutils import escape

Celda = str | int | float | date | None
# Estilos (índices en styles.xml): 0 normal · 1 negrita · 2 fecha · 3 número 4 decimales · 4 título
NORMAL, NEGRITA, FECHA, NUMERO, TITULO = 0, 1, 2, 3, 4

ESTILOS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="0.0000"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEFF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""


def _columna(i: int) -> str:
    """0 → A, 25 → Z, 26 → AA…"""
    letras = ""
    i += 1
    while i:
        i, resto = divmod(i - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def _serial_excel(d: date) -> int:
    """Excel guarda las fechas como días desde el 30/12/1899."""
    return (d - date(1899, 12, 30)).days


def _celda(ref: str, valor: Celda, estilo: int | None) -> str:
    if valor is None or valor == "":
        return ""
    if isinstance(valor, datetime):
        valor = valor.date()
    if isinstance(valor, date):
        return f'<c r="{ref}" s="{FECHA if estilo is None else estilo}"><v>{_serial_excel(valor)}</v></c>'
    if isinstance(valor, bool):
        valor = "Sí" if valor else "No"
    if isinstance(valor, (int, float)):
        if valor != valor or valor in (float("inf"), float("-inf")):  # NaN o infinito
            return f'<c r="{ref}" t="inlineStr"><is><t>—</t></is></c>'
        s = f' s="{estilo}"' if estilo is not None else ""
        return f'<c r="{ref}"{s}><v>{valor!r}</v></c>'
    s = f' s="{estilo}"' if estilo is not None else ""
    return f'<c r="{ref}" t="inlineStr"{s}><is><t xml:space="preserve">{escape(str(valor))}</t></is></c>'


def _hoja(filas: list[list[Celda]], estilos_fila: dict[int, int], anchos: list[float]) -> str:
    cols = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{w:.1f}" customWidth="1"/>' for i, w in enumerate(anchos))
    cuerpo = []
    for r, fila in enumerate(filas):
        estilo = estilos_fila.get(r)
        celdas = "".join(_celda(f"{_columna(c)}{r + 1}", v, estilo) for c, v in enumerate(fila))
        cuerpo.append(f'<row r="{r + 1}">{celdas}</row>')
    congelar = ('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
                '</sheetView></sheetViews>') if estilos_fila.get(0) == NEGRITA else ""
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'{congelar}<cols>{cols}</cols><sheetData>{"".join(cuerpo)}</sheetData></worksheet>')


def _ancho(filas: list[list[Celda]], col: int) -> float:
    largo = max((len(str(f[col])) for f in filas if col < len(f) and f[col] is not None), default=8)
    return min(max(largo + 2, 10), 70)


def escribir(ruta: Path, hojas: list[tuple[str, list[list[Celda]], dict[int, int]]]) -> Path:
    """Crea el .xlsx. `hojas` = [(nombre, filas, {nº de fila: estilo}), …]."""
    ruta = Path(ruta)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    nombres = [n[:31] for n, _, _ in hojas]  # Excel admite 31 caracteres por nombre de hoja
    with zipfile.ZipFile(ruta, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   + "".join(f'<Override PartName="/xl/worksheets/sheet{i + 1}.xml" '
                             'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                             for i in range(len(hojas)))
                   + "</Types>")
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                   "</Relationships>")
        z.writestr("xl/workbook.xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                   + "".join(f'<sheet name="{escape(n)}" sheetId="{i + 1}" r:id="rId{i + 1}"/>' for i, n in enumerate(nombres))
                   + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + "".join(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
                             f'Target="worksheets/sheet{i + 1}.xml"/>' for i in range(len(hojas)))
                   + f'<Relationship Id="rId{len(hojas) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                   "</Relationships>")
        z.writestr("xl/styles.xml", ESTILOS)
        for i, (_, filas, estilos) in enumerate(hojas):
            ncols = max((len(f) for f in filas), default=1)
            z.writestr(f"xl/worksheets/sheet{i + 1}.xml", _hoja(filas, estilos, [_ancho(filas, c) for c in range(ncols)]))
    return ruta
