// Ayudas para gráficos (Plotly), formatos en español y tarjetas con descarga de datos.
import { guardarBlob } from './api.js';
import { explicacion } from './academico.js';

export const COLORES = { ES: '#C8102E', EA: '#003399', DE: '#2E3440', FR: '#4C78A8', IT: '#2A9D8F', PT: '#E9C46A' };
export const PALETA = ['#003399', '#C8102E', '#2A9D8F', '#E9A23B', '#4C78A8', '#6C757D', '#8E44AD'];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—'
  : v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }));

export function fechaTexto(f, frecuencia = 'M') {
  const [a, m] = f.split('-').map(Number);
  return frecuencia === 'Q' ? `T${Math.floor((m - 1) / 3) + 1} ${a}` : `${MESES[m - 1]} ${a}`;
}

export function layout(extra = {}) {
  const ejes = { gridcolor: '#E9ECEF', linecolor: '#CED4DA', zerolinecolor: '#ADB5BD', tickfont: { size: 12, color: '#5f6873' } };
  return {
    margin: { l: 52, r: 18, t: 8, b: 36 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', size: 13, color: '#1b1f24' },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: '#fff', bordercolor: '#CED4DA', font: { size: 12.5 } },
    legend: { orientation: 'h', y: -0.14, x: 0, font: { size: 12.5 } },
    separators: ',.',
    xaxis: { ...ejes },
    yaxis: { ...ejes },
    ...extra,
  };
}

export const CONFIG = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  toImageButtonOptions: { format: 'png', scale: 2 },
};

export function dibujar(div, trazas, extra = {}) {
  const base = layout();
  return Plotly.react(div, trazas, {
    ...base, ...extra,
    xaxis: { ...base.xaxis, ...(extra.xaxis || {}) },
    yaxis: { ...base.yaxis, ...(extra.yaxis || {}) },
  }, CONFIG);
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

/** Línea horizontal de referencia (por ejemplo, el objetivo de inflación del 2 %). */
export function referencia(y, texto, color = '#6C757D') {
  return {
    shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { dash: 'dot', color, width: 1.5 } }],
    annotations: [{ xref: 'paper', x: 1, y, text: texto, showarrow: false, xanchor: 'right', yanchor: 'bottom', bgcolor: 'rgba(255,255,255,0.85)', font: { size: 11.5, color } }],
  };
}

/** Minigráfico SVG para las tarjetas. */
export function sparkline(valores, color) {
  if (valores.length < 2) return '';
  const min = Math.min(...valores), max = Math.max(...valores);
  const rango = max - min || 1;
  const puntos = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${30 - ((v - min) / rango) * 26 - 2}`).join(' ');
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${puntos}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
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

/** Tarjeta con título, botones de «Datos» (CSV) e «Imagen» (PNG), gráfico y explicación académica. */
export function tarjeta({ titulo, sub = '', fuente = '', clave = null, alto = '' }) {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `
    <div class="card-head">
      <div><h2>${titulo}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>
      <div class="acciones"><button data-csv title="Descargar los datos para Excel">Datos</button><button data-png title="Guardar el gráfico como imagen">Imagen</button></div>
    </div>
    <div class="grafico ${alto}"></div>
    ${fuente ? `<p class="fuente-nota">Fuente: ${fuente}</p>` : ''}
    ${clave ? explicacion(clave) : ''}`;
  const grafico = el.querySelector('.grafico');
  let datos = null;
  el.querySelector('[data-csv]').addEventListener('click', () => {
    if (datos) descargarCSV(`${titulo.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '_')}.csv`, datos.cabeceras, datos.filas);
  });
  el.querySelector('[data-png]').addEventListener('click', () => {
    Plotly.downloadImage(grafico, { format: 'png', width: 1400, height: 700, filename: titulo.toLowerCase().replace(/\s+/g, '_') });
  });
  return { el, grafico, setDatos: (d) => { datos = d; } };
}
