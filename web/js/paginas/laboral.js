// Módulo 2: mercado laboral y curva de Phillips.
import { post, series } from '../api.js';
import { aTabla, COLORES, dibujar, fmt, layout, linea, tarjeta } from '../graficos.js';

// Subperiodos para ver cambios estructurales en la curva de Phillips.
const PERIODOS = [
  { nombre: 'Antes de la COVID', desde: '0000', hasta: '2020-02-01', color: '#4C78A8' },
  { nombre: 'COVID y reapertura', desde: '2020-03-01', hasta: '2022-06-01', color: '#9AA0A6' },
  { nombre: 'Ciclo restrictivo del BCE', desde: '2022-07-01', hasta: '2024-05-01', color: '#C8102E' },
  { nombre: 'Bajadas de tipos', desde: '2024-06-01', hasta: '9999', color: '#2A9D8F' },
];

export default {
  titulo: 'Mercado laboral',
  async render(nodo, ctx) {
    const datos = await series(['paro', 'paro_jovenes'], { paises: ctx.paises, desde: ctx.desde, hasta: ctx.hasta });
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><span class="etiqueta">INE · Eurostat</span><h1>Mercado <span class="degradado">laboral</span></h1>
      <p>Tasa de paro general y juvenil (menores de 25 años) armonizada por Eurostat, y la relación entre paro e inflación: la curva de Phillips.</p></header>`;

    const fila = document.createElement('div');
    fila.className = 'rejilla dos';
    nodo.appendChild(fila);
    for (const [id, titulo] of [['paro', 'Tasa de paro'], ['paro_jovenes', 'Paro juvenil (menores de 25)']]) {
      const t = tarjeta({ titulo, sub: '% de la población activa, desestacionalizada.', fuente: 'Eurostat (une_rt_m)', clave: 'paro', alto: 'bajo' });
      fila.appendChild(t.el);
      const d = datos[id] || {};
      const orden = ctx.paises.filter((p) => d[p]);
      dibujar(t.grafico, orden.map((p) => linea(ctx.nombrePais(p), d[p], COLORES[p], { sufijo: ' %', line: { width: p === 'ES' || p === 'EA' ? 2.8 : 1.8 } })),
        { yaxis: { ticksuffix: ' %', rangemode: 'tozero' } });
      t.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${ctx.nombrePais(p)} (%)`, d[p]]))));
    }

    // Curva de Phillips
    const t = tarjeta({ titulo: 'Curva de Phillips empírica', sub: 'Cada punto es un mes: tasa de paro (eje X) e inflación subyacente (eje Y), con una recta de regresión por subperiodo.', fuente: 'Eurostat (une_rt_m e IAPC subyacente)', clave: 'phillips' });
    t.grafico.style.height = '440px';
    const opciones = document.createElement('div');
    opciones.className = 'form';
    opciones.innerHTML = `<label>País<select>${ctx.catalogo.paises && Object.entries(ctx.catalogo.paises)
      .map(([c, n]) => `<option value="${c}" ${c === 'ES' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    t.el.insertBefore(opciones, t.grafico);
    const resumen = document.createElement('div');
    resumen.className = 'stats';
    t.el.insertBefore(resumen, t.grafico.nextSibling);
    nodo.appendChild(t.el);

    const pintarPhillips = async () => {
      const pais = opciones.querySelector('select').value;
      const r = await post('lab/dispersion', {
        x: { indicador: 'paro', pais }, y: { indicador: 'iapc_subyacente', pais },
        periodos: PERIODOS, desde: ctx.desde, hasta: ctx.hasta,
      });
      if (!ctx.vigente()) return;
      const trazas = [];
      for (const p of PERIODOS) {
        const pts = r.puntos.filter((q) => q[3] === p.nombre);
        if (!pts.length) continue;
        trazas.push({
          x: pts.map((q) => q[1]), y: pts.map((q) => q[2]), text: pts.map((q) => q[0].slice(0, 7)),
          mode: 'markers', type: 'scatter', name: p.nombre, marker: { color: p.color, size: 7, opacity: 0.8 },
          hovertemplate: '%{text}<br>Paro %{x:.1f} % · Inflación %{y:.1f} %<extra>' + p.nombre + '</extra>',
        });
        const recta = r.rectas.find((q) => q.periodo === p.nombre);
        if (recta) {
          trazas.push({
            x: [recta.x_min, recta.x_max], y: [recta.constante + recta.pendiente * recta.x_min, recta.constante + recta.pendiente * recta.x_max],
            mode: 'lines', type: 'scatter', showlegend: false, line: { color: p.color, width: 2.5 }, hoverinfo: 'skip',
          });
        }
      }
      const base = layout();
      dibujar(t.grafico, trazas, {
        hovermode: 'closest',
        xaxis: { ...base.xaxis, title: { text: 'Tasa de paro (%)', font: { size: 12 } }, ticksuffix: ' %' },
        yaxis: { ...base.yaxis, title: { text: 'Inflación subyacente (%)', font: { size: 12 } }, ticksuffix: ' %' },
      });
      resumen.innerHTML = r.rectas.map((q) => `<div class="stat"><span>${q.periodo} (${q.n} meses)</span>
        <strong>${fmt(q.pendiente, 2)}</strong> <small>pendiente · R² ${fmt(q.r2, 2)}</small></div>`).join('')
        || '<p class="sub">No hay suficientes datos en el periodo elegido.</p>';
      t.setDatos({ cabeceras: ['Fecha', 'Paro (%)', 'Inflación subyacente (%)', 'Subperiodo'], filas: r.puntos });
    };
    opciones.addEventListener('change', pintarPhillips);
    await pintarPhillips();
  },
};
