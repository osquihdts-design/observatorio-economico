// Panel económico: pide los datos al servidor de Python (/api/...) y dibuja los gráficos.

const COLORES = {
  España: '#c8102e', Alemania: '#1f2937', Francia: '#2563eb', Italia: '#16a34a', Portugal: '#9333ea',
  'Países Bajos': '#f97316', Bélgica: '#ca8a04', Irlanda: '#0d9488', Grecia: '#0284c7', Austria: '#be185d',
  Polonia: '#78716c', Suecia: '#0891b2', 'Unión Europea': '#6366f1',
  'Euríbor 12 meses': '#2563eb', 'Tipo del BCE': '#c8102e',
};
const PESTANAS = [
  ['inflacion', 'Inflación'], ['paro', 'Paro'], ['paro_jovenes', 'Paro juvenil'], ['pib', 'PIB'],
  ['vivienda', 'Vivienda'], ['tipos', 'Tipos de interés'], ['analisis', 'Análisis'],
];
const VARIABLES = [
  ['inflacion', 'Inflación'], ['paro', 'Paro'], ['paro_var', 'Cambio del paro (puntos en un año)'],
  ['paro_jovenes', 'Paro juvenil'], ['pib', 'Crecimiento del PIB'], ['vivienda', 'Precio de la vivienda'],
  ['euribor', 'Euríbor 12 meses'], ['tipo_bce', 'Tipo del BCE'],
];
const PRESETS = [
  { nombre: 'Curva de Phillips', desc: 'Paro → inflación', x: 'paro', y: 'inflacion', lag: 0 },
  { nombre: 'Ley de Okun', desc: 'PIB → cambio del paro', x: 'pib', y: 'paro_var', lag: 0 },
  { nombre: 'Hipotecas y vivienda', desc: 'Euríbor → precio vivienda (1 año después)', x: 'euribor', y: 'vivienda', lag: 4 },
  { nombre: 'Política monetaria', desc: 'Tipo BCE → inflación (1 año después)', x: 'tipo_bce', y: 'inflacion', lag: 4 },
];

const estado = {
  paises: ['ES', 'DE', 'FR', 'IT', 'EU27_2020'],
  desde: '2015',
  pestana: 'inflacion',
  analisis: { pais: 'ES', x: 'paro', y: 'inflacion', lag: 0 },
};
let meta = null;

const $ = (s) => document.querySelector(s);
const fmt = (v, d = 1) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(f, frecuencia) {
  const [a, m] = f.split('-').map(Number);
  return frecuencia === 'trimestral' ? `T${Math.floor((m - 1) / 3) + 1} ${a}` : `${MESES[m - 1]} ${a}`;
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

async function api(ruta) {
  const r = await fetch(ruta);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Error al obtener los datos');
  return j;
}

function aviso(texto) {
  const a = $('#alert');
  a.textContent = texto || '';
  a.hidden = !texto;
}

function layoutBase(extra = {}) {
  const ink = css('--ink'), muted = css('--muted'), line = css('--line');
  return {
    margin: { l: 50, r: 20, t: 10, b: 40 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', color: ink, size: 13 },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: css('--card'), bordercolor: line, font: { color: ink } },
    legend: { orientation: 'h', y: -0.12, font: { color: muted } },
    xaxis: { gridcolor: line, linecolor: line, zeroline: false },
    yaxis: { gridcolor: line, linecolor: line, zerolinecolor: muted, ticksuffix: '' },
    separators: ',.',
    ...extra,
  };
}
const CONFIG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] };

// ---------------------------------------------------------------- Tarjetas de resumen
async function cargarResumen() {
  const { tarjetas } = await api('/api/resumen');
  $('#kpis').innerHTML = tarjetas.map((t) => {
    const d = t.valor - t.anterior;
    const clase = Math.abs(d) < (t.zona ? 0.005 : 0.05) ? 'flat' : d > 0 ? 'up' : 'down';
    const flecha = clase === 'flat' ? '=' : d > 0 ? '▲' : '▼';
    const destino = t.zona ? 'tipos' : t.id;
    return `<button class="kpi" data-tab="${destino}" title="Ver ${t.nombre}">
      <div class="k-name">${t.nombre}${t.zona ? ' · zona euro' : ' · España'}</div>
      <div class="k-value">${fmt(t.valor, t.zona ? 2 : 1)}<small>%</small></div>
      <div class="k-meta"><span class="delta ${clase}">${flecha} ${fmt(Math.abs(d), t.zona ? 2 : 1)}</span><span>${fechaCorta(t.fecha, t.frecuencia)}</span></div>
    </button>`;
  }).join('');
}
$('#kpis').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) mostrar(b.dataset.tab);
});

// ---------------------------------------------------------------- Controles
function pintarControles() {
  $('#countries').innerHTML = Object.entries(meta.paises).map(([cod, nombre]) => `
    <button class="chip ${estado.paises.includes(cod) ? 'on' : ''}" data-pais="${cod}" style="color:${COLORES[nombre]}">
      <span class="dot" style="background:${COLORES[nombre]}"></span><span style="color:var(--ink)">${nombre}</span>
    </button>`).join('');
  const anios = [2000, 2005, 2008, 2010, 2012, 2015, 2018, 2020, 2022, 2024];
  $('#since').innerHTML = anios.map((a) => `<option value="${a}" ${String(a) === estado.desde ? 'selected' : ''}>${a}</option>`).join('');
  $('#tabs').innerHTML = PESTANAS.map(([id, n]) => `<button class="tab ${id === estado.pestana ? 'on' : ''}" role="tab" data-tab="${id}">${n}</button>`).join('');
}

$('#countries').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pais]');
  if (!b) return;
  const cod = b.dataset.pais;
  estado.paises = estado.paises.includes(cod) ? estado.paises.filter((p) => p !== cod) : [...estado.paises, cod];
  if (!estado.paises.length) estado.paises = [cod];
  pintarControles();
  mostrar(estado.pestana);
});
$('#since').addEventListener('change', (e) => { estado.desde = e.target.value; mostrar(estado.pestana); });
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) mostrar(b.dataset.tab);
});

// ---------------------------------------------------------------- Gráfico de un indicador
async function mostrar(pestana) {
  estado.pestana = pestana;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === pestana));
  const esAnalisis = pestana === 'analisis';
  $('#view-chart').hidden = esAnalisis;
  $('#view-analysis').hidden = !esAnalisis;
  if (esAnalisis) return analizar();

  const claves = pestana === 'tipos' ? ['tipo_bce', 'euribor'] : [pestana];
  const info = meta.indicadores[claves[0]];
  $('#chart-title').textContent = pestana === 'tipos' ? 'Tipos de interés (zona euro)' : info.nombre;
  $('#chart-unit').textContent = `${info.unidad} · datos ${info.frecuencia}es`;
  $('#chart-explain').textContent = claves.map((c) => meta.indicadores[c].explicacion).join(' ');
  $('#chart-source').textContent = claves.map((c) => meta.indicadores[c].fuente).join(' · ');
  $('#chart-source').href = info.enlace;

  try {
    const respuestas = await Promise.all(claves.map((c) =>
      api(`/api/datos?id=${c}&paises=${estado.paises.join(',')}&desde=${estado.desde}`)));
    aviso(respuestas.some((r) => r.antiguo) ? 'No hay conexión con la fuente: se muestran los últimos datos guardados.' : '');
    $('#updated').textContent = `Datos descargados: ${respuestas[0].actualizado}`;
    const trazas = [];
    for (const [i, r] of respuestas.entries()) {
      for (const [pais, puntos] of Object.entries(r.series)) {
        trazas.push({
          x: puntos.map((p) => p[0]),
          y: puntos.map((p) => p[1]),
          name: pais,
          type: 'scatter',
          mode: 'lines',
          line: { color: COLORES[pais], width: pais === 'España' ? 3 : 2, shape: claves[i] === 'tipo_bce' ? 'hv' : 'linear' },
          hovertemplate: `%{y:.2f} ${info.unidad.startsWith('%') ? '%' : ''}`,
        });
      }
    }
    const formas = [];
    if (pestana === 'inflacion') {
      formas.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 2, y1: 2, line: { dash: 'dot', color: css('--muted'), width: 1.5 } });
    }
    const anotaciones = pestana === 'inflacion'
      ? [{ xref: 'paper', x: 1, y: 2, text: 'Objetivo del BCE: 2 %', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { size: 11, color: css('--muted') } }]
      : [];
    Plotly.react('chart', trazas, layoutBase({ shapes: formas, annotations: anotaciones, yaxis: { ...layoutBase().yaxis, ticksuffix: ' %' } }), CONFIG);

    const pedidos = pestana === 'tipos' ? [] : estado.paises.map((c) => meta.paises[c]);
    const faltan = pedidos.filter((p) => !respuestas[0].series[p]?.length);
    $('#missing').hidden = !faltan.length;
    $('#missing').textContent = faltan.length ? `Sin datos en la fuente para: ${faltan.join(', ')}.` : '';
  } catch (err) {
    aviso(err.message);
  }
}

$('#btn-csv').addEventListener('click', () => {
  const claves = estado.pestana === 'tipos' ? ['tipo_bce', 'euribor'] : [estado.pestana];
  for (const c of claves) window.open(`/api/csv?id=${c}&paises=${estado.paises.join(',')}&desde=${estado.desde}`, '_blank');
});
$('#btn-png').addEventListener('click', () => {
  const div = estado.pestana === 'analisis' ? 'a-scatter' : 'chart';
  Plotly.downloadImage(div, { format: 'png', width: 1400, height: 700, filename: `grafico-${estado.pestana}` });
});

// ---------------------------------------------------------------- Análisis
function pintarAnalisis() {
  const a = estado.analisis;
  $('#presets').innerHTML = PRESETS.map((p, i) => `<button class="preset" data-preset="${i}"><b>${p.nombre}</b><span>${p.desc}</span></button>`).join('');
  $('#a-country').innerHTML = Object.entries(meta.paises).map(([c, n]) => `<option value="${c}" ${c === a.pais ? 'selected' : ''}>${n}</option>`).join('');
  const opciones = (sel) => VARIABLES.map(([id, n]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${n}</option>`).join('');
  $('#a-x').innerHTML = opciones(a.x);
  $('#a-y').innerHTML = opciones(a.y);
  $('#a-lag').innerHTML = [0, 1, 2, 3, 4, 6, 8].map((n) => `<option value="${n}" ${n === a.lag ? 'selected' : ''}>${n === 0 ? 'Mismo trimestre' : `${n} trimestre${n > 1 ? 's' : ''} antes`}</option>`).join('');
}

$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const p = PRESETS[b.dataset.preset];
  Object.assign(estado.analisis, { x: p.x, y: p.y, lag: p.lag });
  pintarAnalisis();
  analizar();
});
for (const [id, campo] of [['#a-country', 'pais'], ['#a-x', 'x'], ['#a-y', 'y'], ['#a-lag', 'lag']]) {
  $(id).addEventListener('change', (e) => {
    estado.analisis[campo] = campo === 'lag' ? Number(e.target.value) : e.target.value;
    analizar();
  });
}

async function analizar() {
  const a = estado.analisis;
  try {
    const r = await api(`/api/analisis?pais=${a.pais}&x=${a.x}&y=${a.y}&retardo=${a.lag}&desde=${estado.desde}`);
    const titulo = `${r.nombre_y} frente a ${r.nombre_x.toLowerCase()} · ${r.pais}`;
    $('#a-scatter-title').textContent = titulo;
    if (r.error) {
      $('#a-stats').innerHTML = '';
      $('#a-text').textContent = r.error;
      Plotly.purge('a-scatter');
      Plotly.purge('a-time');
      $('#a-warning').textContent = '';
      return;
    }
    const stat = (n, v) => `<div class="stat"><div class="s-name">${n}</div><div class="s-value">${v}</div></div>`;
    $('#a-stats').innerHTML = stat('Correlación (r)', fmt(r.r, 2)) + stat('R²', fmt(r.r2, 2))
      + stat('Pendiente', fmt(r.pendiente, 2)) + stat('Trimestres', r.n);
    $('#a-text').textContent = r.texto;
    $('#a-warning').textContent = r.aviso;

    const xs = r.puntos.map((p) => p[1]);
    const ys = r.puntos.map((p) => p[2]);
    const min = Math.min(...xs), max = Math.max(...xs);
    const muted = css('--muted');
    Plotly.react('a-scatter', [
      {
        x: xs, y: ys, text: r.puntos.map((p) => p[0].replace('-T', ' T')), mode: 'markers', type: 'scatter', name: 'Trimestres',
        marker: { size: 8, color: r.puntos.map((_, i) => i), colorscale: 'Viridis', showscale: true, colorbar: { title: { text: 'Más reciente →', side: 'right' }, showticklabels: false, thickness: 10 } },
        hovertemplate: `%{text}<br>${r.nombre_x}: %{x:.2f}<br>${r.nombre_y}: %{y:.2f}<extra></extra>`,
      },
      {
        x: [min, max], y: [r.constante + r.pendiente * min, r.constante + r.pendiente * max], mode: 'lines', type: 'scatter',
        name: 'Recta de regresión', line: { color: '#c8102e', width: 2.5 }, hoverinfo: 'skip',
      },
    ], layoutBase({
      hovermode: 'closest', showlegend: false,
      xaxis: { ...layoutBase().xaxis, title: { text: `${r.nombre_x}${a.lag ? ` (${a.lag} trim. antes)` : ''}`, font: { color: muted, size: 12 } } },
      yaxis: { ...layoutBase().yaxis, title: { text: r.nombre_y, font: { color: muted, size: 12 } } },
      margin: { l: 55, r: 10, t: 10, b: 50 },
    }), CONFIG);

    const fechas = r.puntos.map((p) => p[0].replace('-T', ' T'));
    Plotly.react('a-time', [
      { x: fechas, y: xs, name: `${r.nombre_x}${a.lag ? ` (adelantado ${a.lag} trim.)` : ''}`, type: 'scatter', mode: 'lines', line: { color: '#2563eb', width: 2 } },
      { x: fechas, y: ys, name: r.nombre_y, type: 'scatter', mode: 'lines', yaxis: 'y2', line: { color: '#c8102e', width: 2 } },
    ], layoutBase({
      yaxis: { ...layoutBase().yaxis, title: { text: r.nombre_x, font: { color: '#2563eb', size: 12 } } },
      yaxis2: { overlaying: 'y', side: 'right', showgrid: false, title: { text: r.nombre_y, font: { color: '#c8102e', size: 12 } } },
      xaxis: { ...layoutBase().xaxis, nticks: 8 },
      margin: { l: 55, r: 55, t: 10, b: 40 },
      legend: { orientation: 'h', y: -0.18, font: { color: muted } },
    }), CONFIG);
  } catch (err) {
    aviso(err.message);
  }
}

// ---------------------------------------------------------------- Actualizar
$('#btn-refresh').addEventListener('click', async () => {
  const b = $('#btn-refresh');
  b.disabled = true;
  b.textContent = 'Descargando…';
  try {
    await api('/api/actualizar');
    await cargarResumen();
    await mostrar(estado.pestana);
  } catch (err) {
    aviso(err.message);
  } finally {
    b.disabled = false;
    b.textContent = 'Actualizar datos';
  }
});

// Si cambia el modo claro/oscuro del sistema, se redibujan los gráficos con los nuevos colores.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => mostrar(estado.pestana));

(async function inicio() {
  try {
    meta = await api('/api/meta');
    pintarControles();
    pintarAnalisis();
    await Promise.all([cargarResumen(), mostrar(estado.pestana)]);
  } catch (err) {
    aviso(`No se pudo arrancar el panel: ${err.message}`);
  }
})();
