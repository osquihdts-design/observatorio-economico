// Módulo 3: política monetaria y condiciones financieras.
import { series } from '../api.js';
import { aTabla, dibujar, linea, tarjeta, eje } from '../graficos.js';

export default {
  titulo: 'Política monetaria',
  async render(nodo, ctx) {
    const d = await series(['bce_deposito', 'bce_refinanciacion', 'bce_marginal', 'euribor_12m', 'tipo_hipotecas', 'm3_var'],
      { paises: ['ES', 'EA'], desde: ctx.desde, hasta: ctx.hasta });
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><span class="etiqueta">Banco Central Europeo</span><h1>Política monetaria y <span class="degradado">condiciones financieras</span></h1>
      <p>Los tipos de interés del Banco Central Europeo, cómo se trasladan al euríbor y a las hipotecas, y el crecimiento del dinero en la zona euro.</p></header>`;

    // 1. Corredor de tipos
    const t1 = tarjeta({ titulo: 'Corredor de tipos del BCE y euríbor', sub: 'El área sombreada va del tipo de depósito (suelo) a la facilidad marginal (techo).', fuente: 'BCE (FM: DFR, MRR_RT, MLFR y EURIBOR1YD_)', clave: 'corredor' });
    nodo.appendChild(t1.el);
    const dep = d.bce_deposito?.EA || [], mro = d.bce_refinanciacion?.EA || [], mlf = d.bce_marginal?.EA || [], eur = d.euribor_12m?.EA || [];
    const escalon = { line: { shape: 'hv', width: 1.8 } };
    dibujar(t1.grafico, [
      linea('Facilidad de depósito', dep, '#2A9D8F', { sufijo: ' %', ...escalon }),
      linea('Facilidad marginal de crédito', mlf, '#6C757D', { sufijo: ' %', ...escalon, extra: { fill: 'tonexty', fillcolor: 'rgba(0,51,153,0.07)' } }),
      linea('Operaciones principales', mro, '#003399', { sufijo: ' %', line: { shape: 'hv', width: 1.8, dash: 'dot' } }),
      linea('Euríbor 12 meses', eur, '#C8102E', { sufijo: ' %', line: { width: 2.6 } }),
    ], { yaxis: eje('Tipo de interés (% anual)', ' %') });
    t1.setDatos(aTabla({ 'Depósito (%)': dep, 'Refinanciación (%)': mro, 'Marginal (%)': mlf, 'Euríbor 12m (%)': eur }));

    // 2. Transmisión a hipotecas
    const t2 = tarjeta({ titulo: 'Transmisión: del euríbor a las hipotecas', sub: 'Tipo de interés de las nuevas hipotecas a hogares en España y en la zona euro.', fuente: 'BCE (MIR y FM)', clave: 'transmision' });
    nodo.appendChild(t2.el);
    const hes = d.tipo_hipotecas?.ES || [], hea = d.tipo_hipotecas?.EA || [];
    dibujar(t2.grafico, [
      linea('Euríbor 12 meses', eur, '#6C757D', { sufijo: ' %', line: { dash: 'dot' } }),
      linea('Hipotecas nuevas · España', hes, '#C8102E', { sufijo: ' %', line: { width: 2.6 } }),
      linea('Hipotecas nuevas · zona euro', hea, '#003399', { sufijo: ' %', line: { width: 2.6 } }),
    ], { yaxis: eje('Tipo de interés (% anual)', ' %') });
    t2.setDatos(aTabla({ 'Euríbor 12m (%)': eur, 'Hipotecas España (%)': hes, 'Hipotecas zona euro (%)': hea }));

    // 3. M3
    const t3 = tarjeta({ titulo: 'Crecimiento del dinero (M3)', sub: 'Variación anual del agregado monetario M3 de la zona euro, en %.', fuente: 'BCE (BSI.M.U2.Y.V.M30.X.I.U2.2300.Z01.A)', clave: 'm3', alto: 'bajo' });
    nodo.appendChild(t3.el);
    const m3 = d.m3_var?.EA || [];
    dibujar(t3.grafico, [{ ...linea('M3', m3, '#003399', { sufijo: ' %' }), fill: 'tozeroy', fillcolor: 'rgba(0,51,153,0.08)' }],
      { yaxis: eje('Variación anual (%)', ' %'), showlegend: false });
    t3.setDatos(aTabla({ 'M3 (% anual)': m3 }));
  },
};
