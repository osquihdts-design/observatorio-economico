"""Previsiones oficiales que se dibujan sobre los gráficos (medias anuales).

Se copian a mano de cada publicación (los organismos no las ofrecen en una API sencilla) y
se comprueban contra el documento original. Al salir una nueva edición, se añade aquí con su fecha:
la web muestra siempre la más reciente de cada organismo.

Cada previsión: organismo, título, fecha de publicación, enlace, país (código del panel) y
valores {indicador: {año: valor}}. Los indicadores son los del catálogo (src/config.py).
"""
from __future__ import annotations

PREVISIONES = [
    {
        "id": "bce-2026-09",
        "organismo": "BCE",
        "titulo": "Proyecciones macroeconómicas de los expertos del BCE (septiembre de 2026)",
        "fecha": "2026-09-10",
        "url": "https://www.ecb.europa.eu/press/projections/html/ecb.projections202609_ecbstaff~8e340fc69d.en.html",
        "pais": "EA",
        "valores": {
            "iapc_general": {2026: 3.0, 2027: 2.5, 2028: 2.1},
            "iapc_subyacente": {2026: 2.5, 2027: 2.6, 2028: 2.3},
            "pib_var": {2026: 0.9, 2027: 1.4, 2028: 1.5},
            "paro": {2026: 6.2, 2027: 6.1, 2028: 5.9},
        },
        "nota": "Escenario base. Fecha de corte de los supuestos técnicos: 19 de agosto de 2026.",
    },
    {
        "id": "bde-2026-10",
        "organismo": "Banco de España",
        "titulo": "Proyecciones macroeconómicas e informe trimestral de la economía española (tercer trimestre de 2026)",
        "fecha": "2026-10-09",
        "url": "https://www.bde.es/wbe/en/publicaciones/analisis-economico-investigacion/proyecciones-macro-informe-trimestral/"
               "proyecciones-e-informe-trimestral-de-la-economia-espanola-tercer-trimestre-2026.html",
        "pais": "ES",
        "valores": {
            "iapc_general": {2026: 3.9, 2027: 3.7},
            "iapc_subyacente": {2026: 3.4, 2027: 3.5},
            "pib_var": {2026: 2.6, 2027: 2.2},
            "paro": {2026: 10.0, 2027: 9.7},
        },
        "nota": "La tasa de paro prevista es la media anual de la EPA; el panel muestra la serie mensual armonizada de Eurostat, muy parecida.",
    },
]


def vigentes() -> list[dict]:
    """La previsión más reciente de cada organismo y país, con los años como texto (para JSON)."""
    ultimas: dict[tuple[str, str], dict] = {}
    for p in sorted(PREVISIONES, key=lambda p: p["fecha"]):
        ultimas[(p["organismo"], p["pais"])] = p
    return [{**p, "valores": {ind: {str(a): v for a, v in anios.items()} for ind, anios in p["valores"].items()}}
            for p in ultimas.values()]
