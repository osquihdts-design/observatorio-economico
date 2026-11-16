// Portada ejecutiva: tarjetas con los últimos datos, divergencia España–zona euro y tabla resumen.
import { get, series } from '../api.js';
import { COLORES, descargarCSV, dibujar, fechaTexto, fmt, layout, sparkline, tarjeta } from '../graficos.js';
import { explicacion } from '../academico.js';

// sentido: 1 = que suba es bueno · -1 = que suba es malo · 0 = neutro · 'objetivo' = mejor cuanto más cerca del 2 %
const KPIS = [
  { id: 'ipc_general', pais: 'ES', titulo: 'Inflación (IPC)', ref: { id: 'iapc_general', pais: 'EA', texto: 'Zona euro (IAPC)' }, sentido: 'objetivo' },
  { id: 'paro', pais: 'ES', titulo: 'Tasa de paro', ref: { id: 'paro', pais: 'EA', texto: 'Zona euro' }, sentido: -1 },
  { id: 'pib_var', pais: 'ES', titulo: 'Crecimiento del PIB', ref: { id: 'pib_var', pais: 'EA', texto: 'Zona euro' }, sentido: 1 },
  { id: 'euribor_12m', pais: 'EA', titulo: 'Euríbor 12 meses', ref: { id: 'bce_deposito', pais: 'EA', texto: 'Tipo BCE' }, sentido: 0 },
  { id: 'ipv_general_var', pais: 'ES', titulo: 'Precio de la vivienda', ref: { id: 'precio_vivienda_var', pais: 'EA', texto: 'Zona euro' }, sentido: 0 },
];

function claseDelta(k, actual, anterior) {
  const d = actual - anterior;
  if (Math.abs(d) < 0.005 || k.sentido === 0) return 'neutro';
  if (k.sentido === 'objetivo') return Math.abs(actual - 2) < Math.abs(anterior - 2) ? 'bueno' : 'malo';
  return d * k.sentido > 0 ? 'bueno' : 'malo';
}

function tarjetaKpi(k, datos, ctx) {
  const info = ctx.indicador(k.id);
  const s = datos[k.id]?.[k.pais] || [];
  if (s.length < 2) return `<div class="kpi"><div class="nombre">${k.titulo}</div><div class="valor">—</div></div>`;
  const [fecha, actual] = s[s.length - 1];
  const anterior = s[s.length - 2][1];
  const ref = (datos[k.ref.id]?.[k.ref.pais] || []).at(-1);
  const decimales = info.unidad === '%' && k.id.includes('euribor') ? 2 : 1;
  const flecha = actual > anterior ? '▲' : actual < anterior ? '▼' : '=';
  return `<div class="kpi" title="${info.nombre}${info.nota ? ` · ${info.nota}` : ''}">
    <div class="nombre">${k.titulo} · ${ctx.nombrePais(k.pais)}</div>
    <div class="valor">${fmt(actual, decimales)}<small> %</small></div>
    <div class="linea"><span class="delta ${claseDelta(k, actual, anterior)}">${flecha} ${fmt(Math.abs(actual - anterior), decimales)} pp</span>
      <span>${fechaTexto(fecha, info.frecuencia)} · ${info.fuente === 'EUROSTAT' ? 'Eurostat' : info.fuente}</span></div>
    ${ref ? `<div class="ref">${k.ref.texto}: <strong>${fmt(ref[1], decimales)} %</strong> (${fechaTexto(ref[0], ctx.indicador(k.ref.id).frecuencia)})</div>` : ''}
    ${sparkline(s.slice(-24).map((p) => p[1]), COLORES[k.pais])}
  </div>`;
}

function diferencial(a, b) {
  const mb = new Map(b);
  return a.filter(([f]) => mb.has(f)).map(([f, v]) => [f, v - mb.get(f)]);
}

function trazasDiferencial(nombre, puntos, eje) {
  // Dos áreas: positiva en rojo (España peor) y negativa en verde (España mejor).
  const x = puntos.map((p) => p[0]);
  return [
    { x, y: puntos.map((p) => Math.max(p[1], 0)), type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { width: 0 }, fillcolor: 'rgba(200,16,46,0.25)', hoverinfo: 'skip', showlegend: false, xaxis: 'x', yaxis: eje },
    { x, y: puntos.map((p) => Math.min(p[1], 0)), type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { width: 0 }, fillcolor: 'rgba(26,127,75,0.25)', hoverinfo: 'skip', showlegend: false, xaxis: 'x', yaxis: eje },
    { x, y: puntos.map((p) => p[1]), type: 'scatter', mode: 'lines', name: nombre, line: { color: '#1b1f24', width: 1.6 }, xaxis: 'x', yaxis: eje, hovertemplate: `%{y:+.2f} pp<extra>${nombre}</extra>` },
  ];
}

export default {
  titulo: 'Portada',
  async render(nodo, ctx) {
    const hace4 = `${new Date().getFullYear() - 4}-01-01`;
    const ids = [...new Set(KPIS.flatMap((k) => [k.id, k.ref.id]))];
    const [kpi, div, resumen] = await Promise.all([
      series(ids, { paises: ['ES', 'EA'], desde: hace4 }),
      series(['iapc_general', 'paro'], { paises: ['ES', 'EA'], desde: ctx.desde, hasta: ctx.hasta }),
      get('resumen'),
    ]);

    nodo.innerHTML = `
      <header class="cabecera"><h1>Portada ejecutiva</h1>
        <p>Los últimos datos de la economía española y su comparación con la zona euro, actualizados desde las fuentes oficiales.</p></header>
      <div class="kpis">${KPIS.map((k) => tarjetaKpi(k, kpi, ctx)).join('')}</div>
      ${explicacion('kpi')}`;

    // Divergencia España – zona euro
    const t = tarjeta({
      titulo: 'Divergencia macroeconómica: España frente a la zona euro',
      sub: 'Diferencial en puntos porcentuales. Rojo: España por encima (peor) · Verde: por debajo (mejor).',
      fuente: 'Eurostat (IAPC y tasa de paro armonizada, mensuales)', clave: 'divergencia', alto: '',
    });
    t.grafico.style.height = '460px';
    nodo.appendChild(t.el);
    const difInfl = diferencial(div.iapc_general?.ES || [], div.iapc_general?.EA || []);
    const difParo = diferencial(div.paro?.ES || [], div.paro?.EA || []);
    const base = layout();
    dibujar(t.grafico, [...trazasDiferencial('Diferencial de inflación', difInfl, 'y'), ...trazasDiferencial('Diferencial de paro', difParo, 'y2')], {
      yaxis: { ...base.yaxis, domain: [0.56, 1], title: { text: 'Inflación (pp)', font: { size: 12 } } },
      yaxis2: { ...base.yaxis, domain: [0, 0.44], anchor: 'x', title: { text: 'Paro (pp)', font: { size: 12 } } },
      showlegend: false,
      margin: { l: 60, r: 18, t: 8, b: 30 },
    });
    t.setDatos({
      cabeceras: ['Fecha', 'Diferencial inflación (pp)', 'Diferencial paro (pp)'],
      filas: [...new Set([...difInfl, ...difParo].map((p) => p[0]))].sort().map((f) => [
        f, new Map(difInfl).get(f) ?? '', new Map(difParo).get(f) ?? ''])
    });

    // Tabla resumen
    const filas = resumen.filas.filter((f) => ctx.paises.includes(f.pais));
    const tabla = document.createElement('section');
    tabla.className = 'card';
    tabla.innerHTML = `
      <div class="card-head"><div><h2>Todos los indicadores</h2><p class="sub">Último dato publicado de cada serie para los países seleccionados.</p></div>
        <div class="acciones"><button data-csv>Descargar</button></div></div>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Indicador</th><th>País</th><th class="num">Último</th><th class="num">Anterior</th><th>Periodo</th><th>Fuente</th><th>Serie</th><th>Actualizado</th></tr></thead>
        <tbody>${filas.map((f) => `<tr>
          <td>${f.nombre}</td><td>${f.pais_nombre}</td>
          <td class="num"><strong>${fmt(f.valor, f.unidad === '€' ? 0 : 2)}</strong> ${f.unidad === '%' ? '%' : f.unidad === '€' ? '€' : ''}</td>
          <td class="num">${f.anterior == null ? '—' : fmt(f.anterior, f.unidad === '€' ? 0 : 2)}</td>
          <td>${fechaTexto(f.fecha, f.frecuencia)}</td><td><span class="chip ${f.fuente}">${f.fuente === 'EUROSTAT' ? 'Eurostat' : f.fuente}</span></td>
          <td><code>${f.codigo}</code></td><td>${new Date(f.actualizado).toLocaleDateString('es-ES')}</td></tr>`).join('')}</tbody>
      </table></div>`;
    tabla.querySelector('[data-csv]').addEventListener('click', () => descargarCSV('resumen_indicadores.csv',
      ['Indicador', 'País', 'Último', 'Anterior', 'Fecha', 'Unidad', 'Fuente', 'Serie', 'Actualizado'],
      filas.map((f) => [f.nombre, f.pais_nombre, f.valor, f.anterior ?? '', f.fecha, f.unidad, f.fuente, f.codigo, f.actualizado])));
    nodo.appendChild(tabla);
    nodo.classList.add('rejilla');
  },
};
