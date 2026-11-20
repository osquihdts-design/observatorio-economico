// Gráfico para insertar en otras webs (iframe). Parámetros de la dirección:
//   i = indicador (p. ej. paro)   p = países (ES,EA,DE)   d = desde (2015 o 2015-01)
//   t = tema (claro u oscuro)     prev = 1 para añadir las previsiones oficiales
import { get, series } from './api.js';
import { aplicarTema, COLORES, dibujar, fechaTexto, linea, PALETA } from './graficos.js';
import { trazasPrevision } from './previsiones.js';

const WEB = 'https://osquihdts-design.github.io/observatorio-economico/';
const FUENTES = { INE: 'INE', EUROSTAT: 'Eurostat', BCE: 'BCE' };
// Página del observatorio donde se explica cada indicador (para el enlace del pie).
const PAGINA = (id) => (/^(ipc|iapc)/.test(id) ? 'inflacion' : /^(ninis|empleo_jovenes|abandono|titulados|competencias|especialistas|empresas_ia|ia_|salario|paro_jovenes_estudios)/.test(id) ? 'jovenes' : /paro/.test(id) ? 'laboral'
  : /^(bce|euribor|tipo_hipotecas|m3)/.test(id) ? 'monetaria' : /^(ipv|precio_vivienda|etcl)/.test(id) ? 'vivienda'
    : /^(bono|deuda|saldo)/.test(id) ? 'finanzas' : `mapa/${id}`);

const q = new URLSearchParams(location.search);
document.documentElement.dataset.tema = q.get('t') === 'oscuro' ? 'oscuro' : 'claro';
aplicarTema();

const $ = (id) => document.getElementById(id);
const id = q.get('i') || 'paro';
const paises = (q.get('p') || 'ES,EA').split(',').filter(Boolean).slice(0, 10);
const d = q.get('d') || '';
const desde = /^\d{4}$/.test(d) ? `${d}-01-01` : /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : null;

try {
  const catalogo = await get('catalogo');
  const info = catalogo.indicadores.find((x) => x.id === id);
  if (!info) throw new Error(`No existe el indicador «${id}».`);
  const nombre = (c) => catalogo.nombres?.[c] || catalogo.paises?.[c] || c;
  const datos = (await series([id], { paises, desde }))[id] || {};
  const presentes = paises.filter((p) => datos[p]?.length);
  if (!presentes.length) throw new Error('No hay datos para esos países.');
  const porcentaje = info.unidad.startsWith('%');
  const sufijo = porcentaje ? ' %' : '';
  const trazas = presentes.map((p, i) => linea(nombre(p), datos[p], COLORES[p] || PALETA[i % PALETA.length],
    { sufijo, line: { width: p === 'ES' ? 2.8 : 2 } }));
  if (q.get('prev') === '1') trazas.push(...await trazasPrevision(id, presentes, sufijo));

  $('titulo').textContent = info.nombre;
  $('subtitulo').textContent = `${info.unidad}${info.nota ? ` · ${info.nota}` : ''}`;
  document.title = `${info.nombre} · Observatorio económico`;
  const enlace = `${WEB}#/${PAGINA(id)}?p=${presentes.filter((p) => !['ES', 'EA'].includes(p)).join(',')}&r=max`;
  const ultimo = presentes.map((p) => datos[p].at(-1)[0]).sort().at(-1);
  $('pie').innerHTML = `<span>Fuente: ${FUENTES[info.fuente] || info.fuente}. Último dato: ${fechaTexto(ultimo, info.frecuencia)}</span>
    <span><a href="${enlace}" target="_blank" rel="noopener">Observatorio económico ↗</a> · CC BY 4.0</span>`;
  await dibujar($('grafico'), trazas, {
    eventos: q.get('ev') !== '0',
    margin: { l: 46, r: 10, t: 6, b: 30 },
    legend: { orientation: 'h', y: -0.14, x: 0, font: { size: 11.5 } },
    yaxis: { ticksuffix: sufijo },
  });
  addEventListener('resize', () => Plotly.Plots.resize($('grafico')));
} catch (e) {
  $('titulo').textContent = 'No se pudo cargar el gráfico';
  $('grafico').innerHTML = `<p class="error">${e.message}</p>`;
  $('pie').innerHTML = `<a href="${WEB}" target="_blank" rel="noopener">Observatorio económico ↗</a>`;
}
