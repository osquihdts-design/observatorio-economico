// Ayudas para gráficos (Plotly): colores según el tema, líneas de neón, cruz de datos,
// transiciones suaves, «dibujado» al aparecer, tarjetas con descarga y visor a pantalla completa.
import { guardarBlob } from './api.js';
import { explicacion } from './academico.js';
import { sinMovimiento } from './efectos.js';

const oscuro = () => document.documentElement.dataset.tema !== 'claro';

// Colores por país. Se rellenan según el tema (ver aplicarTema).
const PAISES_CLARO = { ES: '#C8102E', EA: '#003399', UE: '#6D28D9', DE: '#2E3440', FR: '#4C78A8', IT: '#2A9D8F', PT: '#E9C46A' };
const PAISES_OSCURO = { ES: '#ff3b5c', EA: '#5b8cff', UE: '#c084fc', DE: '#cbd5e1', FR: '#38bdf8', IT: '#2dd4bf', PT: '#fbbf24' };
export const COLORES = { ...PAISES_OSCURO };
export const PALETA = ['#003399', '#C8102E', '#2A9D8F', '#E9A23B', '#4C78A8', '#6C757D', '#8E44AD'];

// En el tema oscuro, los colores pensados para fondo blanco se cambian por versiones luminosas.
const EQUIVALENTES_OSCURO = {
  '#C8102E': '#ff3b5c', '#003399': '#5b8cff', '#2E3440': '#cbd5e1', '#1f2937': '#cbd5e1', '#1b1f24': '#e8eef8',
  '#4C78A8': '#38bdf8', '#2A9D8F': '#2dd4bf', '#E9A23B': '#fbbf24', '#E9C46A': '#fbbf24', '#6C757D': '#94a3b8',
  '#9AA0A6': '#94a3b8', '#C5CBD3': '#334155', '#8E44AD': '#c084fc',
  'rgba(0,51,153,0.07)': 'rgba(91,140,255,0.10)', 'rgba(0,51,153,0.08)': 'rgba(91,140,255,0.12)',
  'rgba(0,51,153,0.65)': 'rgba(91,140,255,0.75)', 'rgba(0,51,153,0.7)': 'rgba(91,140,255,0.75)',
  'rgba(200,16,46,0.7)': 'rgba(255,59,92,0.8)', 'rgba(200,16,46,0.25)': 'rgba(255,59,92,0.3)',
  'rgba(26,127,75,0.25)': 'rgba(52,211,153,0.28)',
};
export const tono = (c) => (oscuro() && typeof c === 'string' && EQUIVALENTES_OSCURO[c]) || c;

/** Ajusta los colores de los países al tema actual. */
export function aplicarTema() {
  Object.assign(COLORES, oscuro() ? PAISES_OSCURO : PAISES_CLARO);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function fechaTexto(f, frecuencia = 'M') {
  const [a, m] = f.split('-').map(Number);
  if (frecuencia === 'A') return String(a);
  return frecuencia === 'Q' ? `T${Math.floor((m - 1) / 3) + 1} ${a}` : `${MESES[m - 1]} ${a}`;
}

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export function layout(extra = {}) {
  const ink = css('--ink'), muted = css('--muted'), line = css('--line'), line2 = css('--line-2'), acento = css('--accent');
  const ejes = {
    gridcolor: line, linecolor: line2, zerolinecolor: line2, tickfont: { size: 11.5, color: muted, family: 'JetBrains Mono, monospace' },
    showspikes: true, spikemode: 'across', spikesnap: 'cursor', spikethickness: 1, spikedash: 'dot', spikecolor: acento,
  };
  return {
    margin: { l: 54, r: 18, t: 8, b: 36 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', size: 13, color: ink },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: css('--panel-solido'), bordercolor: acento, font: { size: 12.5, color: ink, family: 'Inter, sans-serif' } },
    legend: { orientation: 'h', y: -0.15, x: 0, font: { size: 12, color: muted } },
    separators: ',.',
    xaxis: { ...ejes },
    yaxis: { ...ejes, showspikes: false },
    ...extra,
  };
}

export const CONFIG = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', scale: 2 },
};

/** Cambia los colores al tema y añade un halo de neón a las líneas destacadas (tema oscuro). */
function prepararTrazas(trazas) {
  const salida = [];
  for (const t of trazas) {
    const copia = { ...t };
    if (t.line) copia.line = { ...t.line, color: tono(t.line.color) };
    if (t.marker) {
      copia.marker = { ...t.marker };
      copia.marker.color = Array.isArray(t.marker.color) ? t.marker.color.map(tono) : tono(t.marker.color);
    }
    if (t.fillcolor) copia.fillcolor = tono(t.fillcolor);
    const destacada = t.type === 'scatter' && (t.mode || '').includes('lines') && (t.line?.width ?? 2) >= 2.6 && !t.fill;
    if (destacada && oscuro()) {
      const grupo = t.legendgroup || t.name;
      copia.legendgroup = grupo;
      salida.push({ ...copia, line: { ...copia.line, width: (copia.line.width || 2.6) * 4, dash: 'solid' }, opacity: 0.16,
        hoverinfo: 'skip', hovertemplate: undefined, showlegend: false, name: `${t.name} (halo)`, legendgroup: grupo });
    }
    salida.push(copia);
  }
  return salida;
}

// ---------------------------------------------------------------- Recesiones y acontecimientos
// Recesiones de la zona euro según el comité de fechado del ciclo del CEPR-EABCN
// (picos 2008T1, 2011T3 y 2019T4; valles 2009T2, 2013T1 y 2020T2). Se sombrea del trimestre siguiente al pico hasta el valle.
export const RECESIONES = [
  { desde: '2008-04-01', hasta: '2009-06-30', nombre: 'Gran Recesión' },
  { desde: '2011-10-01', hasta: '2013-03-31', nombre: 'Crisis de la deuda' },
  { desde: '2020-01-01', hasta: '2020-06-30', nombre: 'COVID-19' },
];
export const EVENTOS = [
  { fecha: '2008-09-15', texto: 'Lehman' },                // quiebra de Lehman Brothers
  { fecha: '2012-07-26', texto: '«Whatever it takes»' },   // discurso de Draghi
  { fecha: '2015-03-09', texto: 'QE del BCE' },            // empiezan las compras de deuda pública
  { fecha: '2020-03-14', texto: 'COVID-19' },              // estado de alarma en España
  { fecha: '2022-02-24', texto: 'Ucrania' },               // invasión rusa
  { fecha: '2022-07-21', texto: 'BCE sube tipos' },        // primera subida desde 2011
];
let conEventos = true;
export const ponerEventos = (activo) => { conEventos = activo; };

/** Bandas de recesión y líneas de acontecimientos, solo dentro de las fechas que muestra el gráfico. */
function capaEventos(trazas) {
  const fechas = trazas.flatMap((t) => (Array.isArray(t.x) ? t.x : [])).filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x));
  if (!fechas.length) return [];
  let min = fechas[0], max = fechas[0];
  for (const f of fechas) { if (f < min) min = f; if (f > max) max = f; }
  const tenue = oscuro() ? 'rgba(148,163,184,0.10)' : 'rgba(100,116,139,0.10)';
  const texto = oscuro() ? '#8c99b0' : '#5b6474';
  const formas = [];
  for (const r of RECESIONES) {
    if (r.hasta < min || r.desde > max) continue;
    formas.push({ type: 'rect', xref: 'x', yref: 'paper', x0: r.desde < min ? min : r.desde, x1: r.hasta > max ? max : r.hasta, y0: 0, y1: 1,
      fillcolor: tenue, line: { width: 0 }, layer: 'below',
      label: { text: 'Recesión', textposition: 'bottom center', font: { size: 9.5, color: texto } } });
  }
  for (const e of EVENTOS) {
    if (e.fecha < min || e.fecha > max) continue;
    formas.push({ type: 'line', xref: 'x', yref: 'paper', x0: e.fecha, x1: e.fecha, y0: 0, y1: 1, layer: 'below',
      line: { color: oscuro() ? 'rgba(251,191,36,0.45)' : 'rgba(180,120,0,0.45)', width: 1, dash: 'dot' },
      label: { text: e.texto, textposition: 'end', textangle: -90, xanchor: 'right', font: { size: 9.5, color: texto } } });
  }
  return formas;
}

export function dibujar(div, trazas, extra = {}) {
  const base = layout();
  const yaDibujado = Array.isArray(div.data) && div.data.length > 0;
  const { eventos = true, ...resto } = extra; // eventos: false para gráficos pequeños o sin fechas
  extra = resto;
  const capa = {
    ...base, ...extra,
    xaxis: { ...base.xaxis, ...(extra.xaxis || {}) },
    yaxis: { ...base.yaxis, ...(extra.yaxis || {}) },
  };
  for (const clave of Object.keys(extra)) {
    if (/^yaxis\d$/.test(clave)) capa[clave] = { ...base.yaxis, ...extra[clave] };
  }
  if (capa.shapes) capa.shapes = capa.shapes.map((s) => ({ ...s, line: { ...s.line, color: tono(s.line?.color) } }));
  // Van después de las formas propias del gráfico, para no cambiar su posición (shapes[0]…).
  if (eventos && conEventos) capa.shapes = [...(capa.shapes || []), ...capaEventos(trazas)];
  if (yaDibujado && !sinMovimiento) capa.transition = { duration: 550, easing: 'cubic-in-out' };
  const promesa = Plotly.react(div, prepararTrazas(trazas), capa, CONFIG);
  if (!yaDibujado && !sinMovimiento) {
    div.classList.add('revelar');
    setTimeout(() => div.classList.remove('revelar'), 1700);
  }
  return promesa;
}

/** Eje vertical con su magnitud escrita: título (qué se mide y en qué unidad) y unidad en cada número.
 *  Ejemplo: eje('Variación anual (%)', ' %') · eje('Euros al mes', ' €') · eje('Índice (2015 = 100)') */
export function eje(titulo, sufijo = '', extra = {}) {
  return { title: { text: titulo, font: { size: 12 } }, ticksuffix: sufijo, ...extra };
}

/** Traza de línea a partir de [[fecha, valor], …] */
export function linea(nombre, puntos, color, opciones = {}) {
  return {
    x: puntos.map((p) => p[0]),
    y: puntos.map((p) => p[1]),
    name: nombre,
    type: 'scatter',
    mode: 'lines',
    line: { color, width: 2.2, ...(opciones.line || {}) },
    hovertemplate: `%{y:.2f}${opciones.sufijo ?? ''}<extra>${nombre}</extra>`,
    ...opciones.extra,
  };
}

/** Línea horizontal de referencia (por ejemplo, el objetivo de inflación del 2 %).
 *  Sin `texto` no se pone etiqueta (útil cuando las líneas pasan justo por ahí y el subtítulo ya lo explica). */
export function referencia(y, texto = '', color = '#6C757D') {
  const c = tono(color);
  return {
    shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { dash: 'dot', color: c, width: 1.5 } }],
    annotations: texto ? [{ xref: 'paper', x: 1, y, text: texto, showarrow: false, xanchor: 'right', yanchor: 'bottom',
      bgcolor: css('--panel-solido'), borderpad: 3, font: { size: 11.5, color: c } }] : [],
  };
}

/** Minigráfico SVG para las tarjetas (con área degradada). */
export function sparkline(valores, color) {
  if (valores.length < 2) return '';
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * 100, 32 - ((v - min) / rango) * 28 - 2]);
  const linea = pts.map((p) => p.join(',')).join(' ');
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true" style="color:${color}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polygon class="area" points="0,34 ${linea} 100,34" fill="url(#${id})"/>
    <polyline points="${linea}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke" pathLength="400"/></svg>`;
}

export function descargarCSV(nombre, cabeceras, filas) {
  const celda = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`);
  const texto = [cabeceras.map(celda).join(';'), ...filas.map((f) => f.map(celda).join(';'))].join('\r\n');
  guardarBlob(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }), nombre);
}

/** Convierte {nombre: [[fecha, valor]…]} en filas de tabla con una columna por serie. */
export function aTabla(seriesPorNombre) {
  const nombres = Object.keys(seriesPorNombre);
  const mapas = nombres.map((n) => new Map(seriesPorNombre[n]));
  const fechas = [...new Set(nombres.flatMap((n) => seriesPorNombre[n].map((p) => p[0])))].sort();
  return { cabeceras: ['Fecha', ...nombres], filas: fechas.map((f) => [f, ...mapas.map((m) => m.get(f) ?? '')]) };
}

// ---------------------------------------------------------------- Visor a pantalla completa
let anteriorFoco = null;

export function abrirVisor(titulo, grafico) {
  if (!grafico?.data?.length) return;
  const capa = document.getElementById('visor');
  const destino = document.getElementById('visor-grafico');
  document.getElementById('visor-titulo').textContent = titulo;
  anteriorFoco = document.activeElement;
  capa.hidden = false;
  const lay = JSON.parse(JSON.stringify(grafico.layout));
  delete lay.width; delete lay.height; delete lay.transition;
  // Con fechas en el eje X, se añade la barra para moverse en el tiempo.
  const conFechas = grafico.data.some((t) => typeof t.x?.[0] === 'string' && /^\d{4}-\d{2}/.test(t.x[0]));
  if (conFechas && lay.xaxis) lay.xaxis.rangeslider = { visible: true, thickness: 0.07, bgcolor: 'rgba(0,0,0,0)', bordercolor: css('--line-2') };
  lay.margin = { ...(lay.margin || {}), t: 10 };
  Plotly.newPlot(destino, grafico.data, lay, { ...CONFIG, scrollZoom: true });
  document.getElementById('visor-cerrar').focus();
}

export function cerrarVisor() {
  const capa = document.getElementById('visor');
  if (capa.hidden) return;
  Plotly.purge(document.getElementById('visor-grafico'));
  capa.hidden = true;
  anteriorFoco?.focus?.();
}

/** Tarjeta con título, botones (ampliar, datos CSV, imagen PNG), gráfico y explicación académica. */
export function tarjeta({ titulo, sub = '', fuente = '', clave = null, alto = '' }) {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-head">
      <div><h2>${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      <div class="acciones">
        <button data-ampliar title="Ver a pantalla completa, con zoom y barra de tiempo">⤢ Ampliar</button>
        <button data-csv title="Descargar los datos para Excel">Datos</button>
        <button data-png title="Guardar el gráfico como imagen">Imagen</button>
      </div>
    </div>
    <div class="grafico ${alto}"></div>
    ${fuente ? `<p class="fuente-nota">Fuente: ${fuente}</p>` : ''}
    ${clave ? explicacion(clave) : ''}`;
  const grafico = el.querySelector('.grafico');
  let datos = null;
  el.querySelector('[data-ampliar]').addEventListener('click', () => abrirVisor(titulo, grafico));
  el.querySelector('[data-csv]').addEventListener('click', () => {
    if (datos) descargarCSV(`${titulo.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '_')}.csv`, datos.cabeceras, datos.filas);
  });
  el.querySelector('[data-png]').addEventListener('click', () => {
    Plotly.downloadImage(grafico, { format: 'png', width: 1600, height: 800, filename: titulo.toLowerCase().replace(/\s+/g, '_') });
  });
  return { el, grafico, setDatos: (d) => { datos = d; } };
}
