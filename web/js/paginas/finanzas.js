// Módulo 6: finanzas públicas (prima de riesgo, deuda y déficit).
import { series } from '../api.js';
import { aTabla, COLORES, dibujar, linea, referencia, tarjeta, eje } from '../graficos.js';

/** Diferencial frente a Alemania en puntos básicos (1 punto porcentual = 100 pb). */
function primaFrente(pais, aleman) {
  const ref = new Map(aleman);
  return pais.filter(([f]) => ref.has(f)).map(([f, v]) => [f, Math.round((v - ref.get(f)) * 100)]);
}

/** Dibuja una serie por país seleccionado, con España y la zona euro más gruesas. */
function porPaises(t, datos, ctx, opciones = {}) {
  const orden = ctx.paises.filter((p) => datos[p]?.length);
  dibujar(t.grafico, orden.map((p) => linea(ctx.nombrePais(p), datos[p], COLORES[p],
    { sufijo: opciones.sufijo ?? '', line: { width: p === 'ES' || p === 'EA' ? 2.8 : 1.8 } })), opciones.layout || {});
  t.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${ctx.nombrePais(p)}${opciones.columna ?? ''}`, datos[p]]))));
}

export default {
  titulo: 'Finanzas públicas',
  async render(nodo, ctx) {
    const d = await series(['bono_10a', 'deuda_publica', 'saldo_publico'],
      { paises: [...new Set([...ctx.paises, 'DE'])], desde: ctx.desde, hasta: ctx.hasta });
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><span class="etiqueta">Eurostat</span><h1>Finanzas <span class="degradado">públicas</span></h1>
      <p>Lo que pagan los Estados por endeudarse, la prima de riesgo frente a Alemania, y cómo evolucionan la deuda y el déficit públicos
      respecto a las reglas fiscales europeas.</p></header>`;
    const bono = d.bono_10a || {};

    // 1. Prima de riesgo
    const aleman = bono.DE || [];
    const paisesPrima = ctx.paises.filter((p) => p !== 'DE' && bono[p]?.length);
    const primas = Object.fromEntries(paisesPrima.map((p) => [p, primaFrente(bono[p], aleman)]));
    const t1 = tarjeta({ titulo: 'Prima de riesgo frente a Alemania', sub: 'Diferencia de rentabilidad del bono a 10 años con el bono alemán, en puntos básicos (100 pb = 1 punto).', fuente: 'Eurostat (irt_lt_mcby_m), cálculo propio', clave: 'prima' });
    nodo.appendChild(t1.el);
    dibujar(t1.grafico, paisesPrima.map((p) => linea(ctx.nombrePais(p), primas[p], COLORES[p],
      { sufijo: ' pb', line: { width: p === 'ES' ? 3 : 1.8 } })), { yaxis: eje('Puntos básicos (100 pb = 1 punto porcentual)', ' pb') });
    t1.setDatos(aTabla(Object.fromEntries(paisesPrima.map((p) => [`${ctx.nombrePais(p)} (pb)`, primas[p]]))));

    // 2. Rentabilidad del bono a 10 años
    const t2 = tarjeta({ titulo: 'Rentabilidad del bono a 10 años', sub: 'Media mensual, en %.', fuente: 'Eurostat (irt_lt_mcby_m)', clave: 'bono', alto: 'bajo' });
    nodo.appendChild(t2.el);
    porPaises(t2, { ...bono, DE: ctx.paises.includes('DE') ? bono.DE : undefined }, ctx, { sufijo: ' %', columna: ' (%)', layout: { yaxis: eje('Rentabilidad (% anual)', ' %') } });

    const fila = document.createElement('div');
    fila.className = 'rejilla dos';
    nodo.appendChild(fila);

    // 3. Deuda pública
    const t3 = tarjeta({ titulo: 'Deuda pública', sub: '% del PIB. La línea punteada es el límite del 60 % del Tratado de Maastricht.', fuente: 'Eurostat (gov_10q_ggdebt)', clave: 'deuda', alto: 'bajo' });
    fila.appendChild(t3.el);
    porPaises(t3, d.deuda_publica || {}, ctx, { sufijo: ' %', columna: ' (% PIB)', layout: { ...referencia(60), yaxis: eje('% del PIB', ' %', { rangemode: 'tozero' }) } });

    // 4. Saldo público
    const t4 = tarjeta({ titulo: 'Déficit o superávit público', sub: '% del PIB (negativo = déficit). La línea punteada es el límite del −3 %.', fuente: 'Eurostat (gov_10q_ggnfa)', clave: 'deficit', alto: 'bajo' });
    fila.appendChild(t4.el);
    porPaises(t4, d.saldo_publico || {}, ctx, { sufijo: ' %', columna: ' (% PIB)', layout: { ...referencia(-3, '', '#C8102E'), yaxis: eje('% del PIB (negativo = déficit)', ' %') } });
  },
};
