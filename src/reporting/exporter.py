"""Exportación académica: un Excel listo para el TFG y citas en formato APA 7.ª edición.

Pestañas del archivo:
  Datos_Limpios              las series ya transformadas y alineadas por fecha
  Metadatos_Fuentes          de dónde sale cada serie, con su cita APA
  Resultados_Regresion       la tabla econométrica completa y los diagnósticos
  Estadisticos_Descriptivos  media, desviación típica, mínimo, cuartiles y máximo
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from ..econometrics.dataset import Dataset, descriptivos
from ..econometrics.regression import ResultadoOLS
from . import xlsx

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

FUENTES = {
    "INE": "Instituto Nacional de Estadística",
    "EUROSTAT": "Eurostat",
    "BCE": "Banco Central Europeo",
}


def url_serie(fuente: str, codigo: str) -> str:
    if fuente == "INE":
        return f"https://www.ine.es/consul/serie.do?s={codigo}"
    if fuente == "EUROSTAT":
        tabla = codigo.split(" ")[0]
        return f"https://ec.europa.eu/eurostat/databrowser/view/{tabla}/default/table"
    if "/" not in codigo:
        return "https://data.ecb.europa.eu/"
    flujo, clave = codigo.split("/", 1)
    return f"https://data.ecb.europa.eu/data/datasets/{flujo}/{flujo}.{clave}"


def cita_apa(ficha: dict, consulta: date | None = None) -> str:
    """Cita de un conjunto de datos según APA 7.ª (versión en español).

    Autor. (Año). Título [Conjunto de datos]. Editor. Recuperado el D de mes de AAAA, de URL
    (Cuando el autor y el editor coinciden, el editor se omite.)
    """
    consulta = consulta or date.today()
    autor = FUENTES.get(ficha["source"], ficha["source"])
    codigo = ficha["series_code"].split(" ")[0]
    titulo = f"{ficha['indicator_name']}: {ficha['country_name']} (serie {codigo})"
    return (f"{autor}. ({consulta.year}). {titulo} [Conjunto de datos]. "
            f"Recuperado el {consulta.day} de {MESES[consulta.month - 1]} de {consulta.year}, "
            f"de {url_serie(ficha['source'], ficha['series_code'])}")


def _redondear(v: float, d: int = 4) -> float:
    return round(v, d) if isinstance(v, float) else v


def exportar_informe(ruta: Path, datos: Dataset, regresion: ResultadoOLS | None = None,
                     adf: dict[str, dict] | None = None, consulta: date | None = None) -> Path:
    """Genera el Excel completo. `adf` = {nombre de variable: resultado del test ADF}."""
    consulta = consulta or date.today()
    N, B = xlsx.NEGRITA, xlsx.TITULO

    # 1. Datos limpios
    nombres = list(datos.columnas)
    datos_limpios = [["Fecha", *nombres]]
    for i, f in enumerate(datos.fechas):
        datos_limpios.append([date.fromisoformat(f), *(datos.columnas[n][i] for n in nombres)])

    # 2. Metadatos y citas
    metadatos = [["Variable", "Indicador", "País", "Fuente", "Código de serie", "Unidad", "Frecuencia original",
                  "Transformación", "Actualizado en la fuente", "Cita APA 7.ª"]]
    for m in datos.metadatos:
        metadatos.append([m["nombre"], m["indicator_name"], m["country_name"], FUENTES.get(m["source"], m["source"]),
                          m["series_code"], m["unit"], {"M": "Mensual", "Q": "Trimestral"}.get(m["frequency"], m["frequency"]),
                          m["transformacion"], m["last_updated"][:10], cita_apa(m, consulta)])
    metadatos += [[], ["Frecuencia del análisis", "Trimestral (medias de cada trimestre)" if datos.frecuencia == "Q" else "Mensual"],
                  ["Periodo", f"{datos.fechas[0]} a {datos.fechas[-1]} ({len(datos.fechas)} observaciones)"],
                  ["Fecha de consulta", consulta]]

    # 3. Regresión
    hojas = [("Datos_Limpios", datos_limpios, {0: N}), ("Metadatos_Fuentes", metadatos, {0: N})]
    if regresion:
        r = regresion
        tabla = [[f"Regresión MCO · variable dependiente: {r.variable_y}"], [],
                 ["Variable", "Coeficiente", "Error estándar", "t", "p-valor", "IC 95 % inferior", "IC 95 % superior"]]
        estilos = {0: B, 2: N}
        for fila in r.tabla():
            tabla.append([fila["variable"], *(_redondear(fila[c]) for c in ("coeficiente", "error", "t", "p", "ic_bajo", "ic_alto"))])
        tabla += [[], ["Estadístico", "Valor"]]
        estilos[len(tabla) - 1] = N
        tabla += [["Observaciones", r.n], ["R²", _redondear(r.r2)], ["R² ajustado", _redondear(r.r2_ajustado)],
                  ["Estadístico F", _redondear(r.f)], ["p-valor de F", _redondear(r.f_p)],
                  ["AIC", _redondear(r.aic, 2)], ["BIC", _redondear(r.bic, 2)],
                  ["Durbin-Watson", _redondear(r.durbin_watson)], ["Log-verosimilitud", _redondear(r.log_verosimilitud, 2)],
                  ["Errores estándar", r.tipo_errores]]
        if adf:
            tabla += [[], ["Test de Dickey-Fuller aumentado (estacionariedad)"]]
            estilos[len(tabla) - 1] = N
            tabla.append(["Variable", "Estadístico", "p-valor", "Retardos", "Valor crítico 5 %", "¿Estacionaria?", "Conclusión"])
            estilos[len(tabla) - 1] = N
            for nombre, a in adf.items():
                estacionaria = {True: "Sí", False: "No"}.get(a["estacionaria"], "No calculado")
                tabla.append([nombre, _redondear(a["estadistico"]), _redondear(a["p_valor"]), a["retardos"],
                              _redondear(a["criticos"]["5%"]), estacionaria, a["conclusion"]])
        tabla += [[], ["Valores observados, ajustados y residuos"], ["Fecha", "Observado", "Ajustado", "Residuo"]]
        estilos[len(tabla) - 2] = N
        estilos[len(tabla) - 1] = N
        observados = [a + e for a, e in zip(r.ajustados, r.residuos)]
        for f, o, a, e in zip(r.fechas or [""] * r.n, observados, r.ajustados, r.residuos):
            tabla.append([date.fromisoformat(f) if f else None, o, a, e])
        hojas.append(("Resultados_Regresion", tabla, estilos))

    # 4. Descriptivos
    desc = [["Variable", "N", "Media", "Desviación típica", "Mínimo", "Percentil 25", "Mediana", "Percentil 75", "Máximo"]]
    for d in descriptivos(datos.columnas):
        desc.append([d["variable"], d["n"], *(_redondear(d[c]) for c in ("media", "desviacion", "minimo", "p25", "mediana", "p75", "maximo"))])
    hojas.append(("Estadisticos_Descriptivos", desc, {0: N}))

    return xlsx.escribir(ruta, hojas)
