// Estructura general: barra lateral (periodo, países, estado de fuentes, modo académico) y navegación entre páginas.
import { get, post } from './api.js';
import { COLORES } from './graficos.js';
import { aviso } from './ui.js';
import portada from './paginas/portada.js';
import inflacion from './paginas/inflacion.js';
import laboral from './paginas/laboral.js';
import monetaria from './paginas/monetaria.js';
import vivienda from './paginas/vivienda.js';
import finanzas from './paginas/finanzas.js';
import laboratorio from './paginas/laboratorio.js';

const PAGINAS = { portada, inflacion, laboral, monetaria, vivienda, finanzas, laboratorio };
const FIJOS = ['ES', 'EA'];

const $ = (s) => document.querySelector(s);
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(`observatorio:${k}`)) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(`observatorio:${k}`, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

const estado = {
  rango: leer('rango', '10'),
  desde: null,
  hasta: null,
  paises: leer('paises', ['ES', 'EA', 'DE', 'FR']),
};
let catalogo = null;
let paginaActual = null;

// ---------------------------------------------------------------- Periodo
const mes = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function aplicarRango() {
  if (estado.rango !== 'custom') {
    const hoy = new Date();
    estado.hasta = null;
    estado.desde = estado.rango === 'max' ? null : `${hoy.getFullYear() - Number(estado.rango)}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
    $('#desde').value = estado.desde ? estado.desde.slice(0, 7) : '2000-01';
    $('#hasta').value = mes(hoy);
  }
  document.querySelectorAll('#rango button').forEach((b) => b.classList.toggle('on', b.dataset.rango === estado.rango));
}

$('#rango').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rango]');
  if (!b) return;
  estado.rango = b.dataset.rango;
  guardar('rango', estado.rango);
  aplicarRango();
  pintar();
});
for (const id of ['#desde', '#hasta']) {
  $(id).addEventListener('change', () => {
    estado.rango = 'custom';
    estado.desde = $('#desde').value ? `${$('#desde').value}-01` : null;
    estado.hasta = $('#hasta').value ? `${$('#hasta').value}-01` : null;
    aplicarRango();
    pintar();
  });
}

// ---------------------------------------------------------------- Países
function pintarPaises() {
  $('#paises').innerHTML = Object.entries(catalogo.paises).map(([c, n]) => {
    const on = estado.paises.includes(c);
    const fijo = FIJOS.includes(c);
    return `<button class="pais ${on ? 'on' : ''}" data-pais="${c}" style="color:${COLORES[c]}" ${fijo ? 'disabled title="Siempre visible"' : ''}>
      <i class="punto" style="background:${COLORES[c]}"></i><span>${n}</span></button>`;
  }).join('');
}
$('#paises').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pais]');
  if (!b || b.disabled) return;
  const c = b.dataset.pais;
  estado.paises = estado.paises.includes(c) ? estado.paises.filter((p) => p !== c) : [...estado.paises, c];
  guardar('paises', estado.paises);
  pintarPaises();
  pintar();
});

// ---------------------------------------------------------------- Estado de las fuentes y actualización
const TEXTO_FUENTE = { INE: 'INE', EUROSTAT: 'Eurostat', BCE: 'Banco Central Europeo' };

function cuando(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function pintarEstado() {
  const e = await get('estado');
  $('#fuentes').innerHTML = Object.entries(e.fuentes).map(([f, s]) => `
    <li title="${(s.errores || '').replace(/"/g, '&quot;')}"><i class="luz ${s.semaforo}"></i><strong>${TEXTO_FUENTE[f]}</strong>
    <small>${s.mensaje}${s.cuando ? ` · ${cuando(s.cuando)}` : ''}</small></li>`).join('');
  return e;
}

let sondeo = null;
async function seguirActualizacion() {
  const e = await pintarEstado();
  const a = e.actualizacion;
  const boton = $('#btn-actualizar');
  $('#progreso').hidden = !a.activa;
  boton.disabled = a.activa;
  boton.textContent = a.activa ? 'Actualizando…' : 'Actualizar datos ahora';
  if (a.activa) {
    $('#progreso-barra').style.width = `${a.total ? (100 * a.hechos) / a.total : 0}%`;
    $('#progreso-texto').textContent = `${a.hechos} de ${a.total} · ${a.nombre}`;
    sondeo = setTimeout(seguirActualizacion, 500);
  } else if (sondeo !== null) {
    sondeo = null;
    aviso(a.errores.length ? `Actualización terminada con avisos: ${a.errores.join(' · ')}` : '');
    catalogo = await get('catalogo');
    pintar();
  }
}

$('#btn-actualizar').addEventListener('click', async () => {
  await post('actualizar', {});
  sondeo = 0;
  seguirActualizacion();
});

// ---------------------------------------------------------------- Modo académico
const academico = $('#academico');
academico.checked = leer('academico', false);
document.body.classList.toggle('modo-academico', academico.checked);
academico.addEventListener('change', () => {
  document.body.classList.toggle('modo-academico', academico.checked);
  guardar('academico', academico.checked);
});

// ---------------------------------------------------------------- Páginas
let turno = 0;
async function pintar() {
  const nombre = (location.hash.replace('#/', '') || 'portada');
  const pagina = PAGINAS[nombre] || portada;
  paginaActual = nombre in PAGINAS ? nombre : 'portada';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === paginaActual));
  document.title = `${pagina.titulo} · Observatorio económico`;
  const contenedor = $('#pagina');
  const mio = ++turno;
  contenedor.innerHTML = '<p class="cargando">Cargando datos…</p>';
  const ctx = {
    desde: estado.desde,
    hasta: estado.hasta,
    paises: [...new Set([...FIJOS, ...estado.paises])],
    catalogo,
    indicador: (id) => catalogo.indicadores.find((i) => i.id === id),
    nombrePais: (c) => catalogo.paises[c] || c,
    vigente: () => mio === turno,  // para ignorar respuestas de una página que ya se ha dejado
  };
  try {
    const nodo = document.createElement('div');
    await pagina.render(nodo, ctx);
    if (mio === turno) contenedor.replaceChildren(nodo);
  } catch (err) {
    if (mio === turno) contenedor.innerHTML = `<div class="alerta">No se pudo cargar la página: ${err.message}</div>`;
  }
  // Plotly calcula el tamaño al dibujar: tras insertar la página, se ajusta al ancho real.
  if (mio === turno) contenedor.querySelectorAll('.js-plotly-plot').forEach((g) => Plotly.Plots.resize(g));
}

window.addEventListener('hashchange', pintar);

(async function inicio() {
  catalogo = await get('catalogo');
  aplicarRango();
  pintarPaises();
  const e = await pintarEstado();
  if (e.actualizacion.activa || e.vacia) {
    sondeo = 0;
    aviso(e.vacia ? 'Descargando los datos por primera vez. Tarda unos segundos…' : '');
    seguirActualizacion();
  }
  pintar();
})();
