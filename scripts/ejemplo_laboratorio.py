"""Ejemplo del laboratorio econométrico con datos reales de la base de datos:

1. Curva de Phillips en España: inflación subyacente frente a paro (MCO con errores Newey-West).
2. Test ADF de estacionariedad de cada variable.
3. Filtro HP del paro: tendencia y ciclo.
4. Correlación cruzada: ¿cuántos meses tarda el tipo del BCE en relacionarse con la inflación?
5. Exporta todo a un Excel para el TFG.

Uso:  python scripts/ejemplo_laboratorio.py   (antes: python scripts/actualizar_datos.py)
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src import config  # noqa: E402
from src.econometrics.correlations import correlacion_cruzada  # noqa: E402
from src.econometrics.dataset import Variable, cargar, preparar  # noqa: E402
from src.econometrics.regression import ols  # noqa: E402
from src.econometrics.time_series import LAMBDA_HP, adf, filtro_hp  # noqa: E402
from src.reporting.exporter import exportar_informe  # noqa: E402


def coma(v: float, d: int = 3) -> str:
    return f"{v:.{d}f}".replace(".", ",")


def main() -> None:
    # 1. Regresión
    y_var = Variable("iapc_subyacente", "ES")
    x_var = Variable("paro", "ES")
    datos = preparar([y_var, x_var], desde="2002-01-01")
    nombre_y, nombre_x = datos.columnas
    r = ols(datos.columnas[nombre_y], {nombre_x: datos.columnas[nombre_x]}, variable_y=nombre_y,
            robustos=True, fechas=datos.fechas)
    periodos = "trimestres" if datos.frecuencia == "Q" else "meses"
    print(f"CURVA DE PHILLIPS · {len(datos.fechas)} {periodos} ({datos.fechas[0]} a {datos.fechas[-1]})")
    print(f"{'':48} {'Coef.':>8} {'Error':>8} {'t':>7} {'p':>7}")
    for f in r.tabla():
        print(f"{f['variable'][:48]:48} {coma(f['coeficiente']):>8} {coma(f['error']):>8} {coma(f['t'], 2):>7} {coma(f['p']):>7}")
    print(f"R² = {coma(r.r2)} · R² ajustado = {coma(r.r2_ajustado)} · F = {coma(r.f, 2)} (p = {coma(r.f_p, 4)})")
    print(f"AIC = {coma(r.aic, 1)} · BIC = {coma(r.bic, 1)} · Durbin-Watson = {coma(r.durbin_watson)} · errores {r.tipo_errores}")

    # 2. Estacionariedad
    print("\nTEST ADF (H0: raíz unitaria)")
    pruebas = {}
    for nombre, valores in datos.columnas.items():
        a = adf(valores)
        pruebas[nombre] = a
        print(f"  {nombre[:55]:55} τ = {coma(a['estadistico'], 2):>6}  p = {coma(a['p_valor']):>6}  "
              f"→ {'estacionaria' if a['estacionaria'] else 'NO estacionaria'}")

    # 3. Filtro HP
    serie_paro, _ = cargar("paro", "ES")
    fechas_paro = sorted(serie_paro)
    tendencia, ciclo = filtro_hp([serie_paro[f] for f in fechas_paro], LAMBDA_HP["M"])
    print(f"\nFILTRO HP del paro mensual (λ = {LAMBDA_HP['M']}): último dato {fechas_paro[-1]}: "
          f"paro {coma(serie_paro[fechas_paro[-1]], 1)} % = tendencia {coma(tendencia[-1], 2)} + ciclo {coma(ciclo[-1], 2)}")

    # 4. Correlación cruzada (mensual): tipo del BCE (x) frente a inflación de la zona euro (y)
    tipo, _ = cargar("bce_deposito", "EA")
    inflacion, _ = cargar("iapc_general", "EA")
    fechas = sorted(set(tipo) & set(inflacion))
    cc = correlacion_cruzada(tipo, inflacion, fechas, 24)
    adelantos = [c for c in cc if c["retardo"] > 0]
    mas_fuerte = max(adelantos, key=lambda c: abs(c["r"]))
    print("\nCORRELACIÓN CRUZADA tipo BCE → inflación zona euro (retardos de 1 a 24 meses)")
    k = mas_fuerte["retardo"]
    print(f"  La relación más fuerte es a {k} mes{'es' if k != 1 else ''}: r = {coma(mas_fuerte['r'])} "
          f"(banda 95 %: ±{coma(mas_fuerte['banda'])}, "
          f"{'significativa' if mas_fuerte['significativa'] else 'no significativa'})")
    print("  Recuerda: con series no estacionarias, mejor usar diferencias o tasas antes de interpretar.")

    # 5. Excel
    ruta = exportar_informe(config.CARPETA_DATOS / "ejemplo_curva_phillips.xlsx", datos, r, pruebas)
    print(f"\nExcel para el TFG: {ruta}")


if __name__ == "__main__":
    main()
