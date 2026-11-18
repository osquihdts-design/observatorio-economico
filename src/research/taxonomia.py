"""Taxonomía fija del centro de investigación: organismos (fuentes), categorías temáticas y tipos de recurso."""
from __future__ import annotations

# (id, nombre, siglas, ámbito, web)
ORGANISMOS = [
    # Organismos nacionales (España)
    ("INE", "Instituto Nacional de Estadística", "INE", "nacional", "https://www.ine.es"),
    ("BDE", "Banco de España", "BdE", "nacional", "https://www.bde.es"),
    ("CNMV", "Comisión Nacional del Mercado de Valores", "CNMV", "nacional", "https://www.cnmv.es"),
    ("MINECO", "Ministerio de Economía, Comercio y Empresa", "Mineco", "nacional", "https://portal.mineco.gob.es"),
    ("SEGSOC", "Seguridad Social", "Seg. Social", "nacional", "https://www.seg-social.es"),
    ("SEPE", "Servicio Público de Empleo Estatal", "SEPE", "nacional", "https://www.sepe.es"),
    # Organismos europeos
    ("EUROSTAT", "Eurostat", "Eurostat", "europeo", "https://ec.europa.eu/eurostat"),
    ("BCE", "Banco Central Europeo", "BCE", "europeo", "https://www.ecb.europa.eu"),
    ("CE", "Comisión Europea", "CE", "europeo", "https://commission.europa.eu"),
    # Organismos internacionales
    ("FMI", "Fondo Monetario Internacional", "FMI", "internacional", "https://www.imf.org"),
    ("BM", "Banco Mundial", "BM", "internacional", "https://www.worldbank.org"),
    ("OCDE", "Organización para la Cooperación y el Desarrollo Económicos", "OCDE", "internacional", "https://www.oecd.org"),
    ("FED", "Reserva Federal de Estados Unidos", "Fed", "internacional", "https://www.federalreserve.gov"),
    ("BIS", "Banco de Pagos Internacionales", "BIS", "internacional", "https://www.bis.org"),
    ("OMC", "Organización Mundial del Comercio", "OMC", "internacional", "https://www.wto.org"),
    # Mercados e instituciones privadas
    ("BLOOMBERG", "Bloomberg", "Bloomberg", "privado", "https://www.bloomberg.com"),
    ("REUTERS", "Reuters", "Reuters", "privado", "https://www.reuters.com"),
    ("YAHOO", "Yahoo Finance", "Yahoo Finance", "privado", "https://finance.yahoo.com"),
    ("BLACKROCK", "BlackRock", "BlackRock", "privado", "https://www.blackrock.com"),
    ("VANGUARD", "Vanguard", "Vanguard", "privado", "https://www.vanguard.com"),
    ("MOODYS", "Moody's", "Moody's", "privado", "https://www.moodys.com"),
    ("SP", "S&P Global Ratings", "S&P", "privado", "https://www.spglobal.com/ratings"),
    ("FITCH", "Fitch Ratings", "Fitch", "privado", "https://www.fitchratings.com"),
    # Producción propia
    ("PROPIO", "Elaboración propia", "Propio", "interno", ""),
]

AMBITOS = {
    "nacional": "Organismos nacionales (España)",
    "europeo": "Organismos europeos",
    "internacional": "Organismos internacionales",
    "privado": "Mercados e instituciones privadas",
    "interno": "Producción propia",
}

# Categorías temáticas: (id, nombre, [(id, nombre), …])
CATEGORIAS = [
    ("macro", "Macroeconomía", [
        ("pib", "PIB y actividad"), ("inflacion", "Inflación (IPC)"), ("empleo", "Empleo"),
        ("tipos", "Tipos de interés"), ("monetaria", "Política monetaria"), ("fiscal", "Política fiscal"),
    ]),
    ("mercados", "Mercados financieros", [
        ("renta_variable", "Renta variable"), ("renta_fija", "Renta fija"), ("divisas", "Divisas (Forex)"),
        ("materias_primas", "Materias primas"), ("cripto", "Criptoactivos"),
    ]),
    ("corporativas", "Finanzas corporativas", [
        ("valoracion", "Valoración de empresas"), ("mya", "Fusiones y adquisiciones (M&A)"),
        ("balances", "Balances"), ("ratios", "Ratios financieros"),
    ]),
    ("sectores", "Sectores estratégicos", [
        ("energia", "Energía"), ("tecnologia", "Tecnología"), ("banca", "Banca"),
        ("inmobiliario", "Inmobiliario (Real Estate)"), ("salud", "Salud"),
    ]),
    ("riesgo", "Riesgo y regulación", [
        ("basilea", "Basilea"), ("esg", "ESG"), ("sistemico", "Riesgo sistémico"), ("geopolitica", "Geopolítica"),
    ]),
]

# Tipos de recurso por pilar. «naturaleza» es el filtro sencillo de la biblioteca.
TIPOS = {
    "dato": {"nombre": "Dato oficial", "pilar": "externo", "naturaleza": "Dato bruto"},
    "informe": {"nombre": "Informe o publicación", "pilar": "externo", "naturaleza": "Dato bruto"},
    "proyeccion": {"nombre": "Proyección oficial", "pilar": "externo", "naturaleza": "Predicción"},
    "teoria": {"nombre": "Marco teórico", "pilar": "interno", "naturaleza": "Teoría"},
    "empirico": {"nombre": "Análisis empírico", "pilar": "interno", "naturaleza": "Análisis"},
    "prediccion": {"nombre": "Predicción propia", "pilar": "interno", "naturaleza": "Predicción"},
}

VINCULOS = {
    "usa_datos": "usa datos de",
    "se_basa_en": "se basa en",
    "actualiza": "actualiza",
    "contradice": "contradice",
    "complementa": "complementa",
}

ESTADOS = {"activo": "Activo", "borrador": "Borrador", "cumplida": "Cumplida", "fallida": "Fallida", "archivado": "Archivado"}


def categoria_padre() -> dict[str, str]:
    """{subcategoría: categoría grande} (las grandes apuntan a sí mismas)."""
    padre = {}
    for gid, _, hijas in CATEGORIAS:
        padre[gid] = gid
        for hid, _ in hijas:
            padre[hid] = gid
    return padre


def nombres_categorias() -> dict[str, str]:
    nombres = {}
    for gid, gnombre, hijas in CATEGORIAS:
        nombres[gid] = gnombre
        nombres.update(dict(hijas))
    return nombres
