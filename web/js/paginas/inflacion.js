// Módulo 1: inflación y poder adquisitivo.
import { series } from '../api.js';
import { aTabla, COLORES, dibujar, fechaTexto, fmt, linea, referencia, tarjeta } from '../graficos.js';
import { explicacion } from '../academico.js';

export default {
  titulo: 'Inflación y precios',
  async render(nodo, ctx) {
    const [ine, europa, indice] = await Promise.all([
      series(['ipc_general', 'ipc_subyacente'], { paises: ['ES'], desde: ctx.desde, hasta: ctx.hasta }),
      series(['iapc_general', 'iapc_subyacente'], { paises: ctx.paises, desde: ctx.desde, hasta: ctx.hasta }),
      series(['ipc_general_indice'], { paises: ['ES'] }),
    ]);
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><h1>Inflación y poder adquisitivo</h1>
      <p>Cómo suben los precios en España (IPC del INE), cómo se compara con Europa (IAPC armonizado de Eurostat) y cuánto poder de compra se pierde con el tiempo.</p></header>`;

    // 1. IPC general frente a subyacente
    const t1 = tarjeta({ titulo: 'IPC general y subyacente en España', sub: 'Variación anual en %. La línea punteada es el objetivo del BCE.', fuente: 'INE (series IPC290750 e IPC292510)', clave: 'ipc' });
    nodo.appendChild(t1.el);
    const general = ine.ipc_general?.ES || [], subyacente = ine.ipc_subyacente?.ES || [];
    dibujar(t1.grafico, [
      linea('IPC general', general, '#C8102E', { sufijo: ' %' }),
      linea('IPC subyacente', subyacente, '#003399', { sufijo: ' %', line: { dash: 'dash' } }),
    ], { ...referencia(2, 'Objetivo BCE: 2 %'), yaxis: { ticksuffix: ' %' } });
    t1.setDatos(aTabla({ 'IPC general (%)': general, 'IPC subyacente (%)': subyacente }));

    // 2. Comparativa europea
    const t2 = tarjeta({ titulo: 'Inflación armonizada en Europa', sub: 'IAPC, variación anual en %.', fuente: 'Eurostat (prc_hicp_manr y prc_hicp_minr)', clave: 'iapc' });
    const selector = document.createElement('div');
    selector.className = 'form';
    selector.innerHTML = `<label>Mostrar<select id="tipo-iapc"><option value="iapc_general">Inflación general</option><option value="iapc_subyacente">Inflación subyacente</option></select></label>`;
    t2.el.insertBefore(selector, t2.grafico);
    nodo.appendChild(t2.el);
    const pintarEuropa = () => {
      const id = selector.querySelector('select').value;
      const datos = europa[id] || {};
      const orden = ctx.paises.filter((p) => datos[p]);
      dibujar(t2.grafico, orden.map((p) => linea(ctx.nombrePais(p), datos[p], COLORES[p], { sufijo: ' %', line: { width: p === 'ES' || p === 'EA' ? 2.8 : 1.8 } })),
        { ...referencia(2, 'Objetivo BCE: 2 %'), yaxis: { ticksuffix: ' %' } });
      t2.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${ctx.nombrePais(p)} (%)`, datos[p]]))));
    };
    selector.addEventListener('change', pintarEuropa);
    pintarEuropa();

    // 3. Calculadora de poder adquisitivo
    const puntos = indice.ipc_general_indice?.ES || [];
    const mapa = new Map(puntos);
    const primero = puntos[0]?.[0].slice(0, 7), ultimo = puntos.at(-1)?.[0].slice(0, 7);
    const calc = document.createElement('section');
    calc.className = 'card';
    calc.innerHTML = `<div class="card-head"><div><h2>Calculadora de poder adquisitivo</h2>
        <p class="sub">¿Cuánto vale hoy el dinero de una fecha pasada? Con el índice general del IPC del INE (serie IPC290751).</p></div></div>
      <div class="calc">
        <label>Cantidad (€)<input type="number" id="pa-cantidad" value="1000" min="0" step="100"></label>
        <label>Desde<input type="month" id="pa-desde" value="2015-01" min="${primero}" max="${ultimo}"></label>
        <label>Hasta<input type="month" id="pa-hasta" value="${ultimo}" min="${primero}" max="${ultimo}"></label>
      </div>
      <div class="calc-resultado" id="pa-resultado"></div>
      ${explicacion('poder')}`;
    nodo.appendChild(calc);
    const calcular = () => {
      const cantidad = Number(calc.querySelector('#pa-cantidad').value) || 0;
      const d = `${calc.querySelector('#pa-desde').value}-01`, h = `${calc.querySelector('#pa-hasta').value}-01`;
      const i0 = mapa.get(d), i1 = mapa.get(h);
      const salida = calc.querySelector('#pa-resultado');
      if (!i0 || !i1) {
        salida.textContent = `Elige meses entre ${fechaTexto(primero + '-01')} y ${fechaTexto(ultimo + '-01')}.`;
        return;
      }
      const equivalente = cantidad * (i1 / i0);
      const inflacion = (i1 / i0 - 1) * 100;
      const perdida = (1 - i0 / i1) * 100;
      const eur = (v) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
      salida.innerHTML = `<strong>${eur(cantidad)}</strong> de ${fechaTexto(d)} equivalen a <strong>${eur(equivalente)}</strong> de ${fechaTexto(h)}.<br>
        Los precios han subido un <strong>${fmt(inflacion)} %</strong>${perdida > 0
          ? `: con la misma cantidad hoy se compra un <strong>${fmt(perdida)} % menos</strong>.`
          : `: con la misma cantidad hoy se compra un <strong>${fmt(-perdida)} % más</strong>.`}`;
    };
    calc.addEventListener('input', calcular);
    calcular();
  },
};
