// Estructura general: barra lateral, ticker, reloj, tema, paleta de comandos, atajos y navegación con transiciones.
import { get, post } from './api.js';
import { aplicarTema, cerrarVisor, COLORES, fmt } from './graficos.js';
import { avisar, contar, iniciarFondo, iniciarTarjetas, revelar, transicion } from './efectos.js';
import { iniciarAtajos, iniciarPaleta } from './paleta.js';
import { aviso } from './ui.js';
import portada from './paginas/portada.js';
import mapa from './paginas/mapa.js';
import inflacion from './paginas/inflacion.js';
import laboral from './paginas/laboral.js';
import monetaria from './paginas/monetaria.js';
import vivienda from './paginas/vivienda.js';
import finanzas from './paginas/finanzas.js';
import laboratorio from './paginas/laboratorio.js';
import centro from './paginas/centro.js';
import biblioteca from './paginas/biblioteca.js';
import fichas from './paginas/fichas.js';
import { cargarTaxonomia, editarRecurso, tax } from './investigacion.js';

const PAGINAS = { portada, mapa, inflacion, laboral, monetaria, vivienda, finanzas, laboratorio, investigacion: centro, biblioteca, fichas };
const ORDEN = Object.keys(PAGINAS);
const ICONOS = { portada: '◈', mapa: '🗺', inflacion: '%', laboral: '⚒', monetaria: '€', vivienda: '⌂', finanzas: '⚖', laboratorio: '∑',
  investigacion: '◎', biblioteca: '▤', fichas: '◧' };
const TECLA = (i) => (i < 9 ? `Tecla ${i + 1}` : i === 9 ? 'Tecla 0' : '');
const FIJOS = ['ES', 'EA'];

// Página donde se explica cada indicador (para la paleta de comandos y el ticker).
const PAGINA_DE = (id) => (/^(ipc|iapc)/.test(id) ? 'inflacion'
  : /paro/.test(id) ? 'laboral'
    : /^(bce|euribor|tipo_hipotecas|m3)/.test(id) ? 'monetaria'
      : /^(ipv|precio_vivienda|etcl)/.test(id) ? 'vivienda'
        : /^(bono|deuda|saldo)/.test(id) ? 'finanzas'
          : id === 'pib_var' ? 'mapa' : 'laboratorio');

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
let resumen = [];
let paginaActual = 'portada';

// ---------------------------------------------------------------- Tema
function ponerTema(tema, repintar = true) {
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]').content = tema === 'claro' ? '#f3f5f9' : '#05080f';
  $('#tema-claro').checked = tema === 'claro';
  aplicarTema();
  guardar('tema', tema);
  if (repintar && catalogo) { pintarPaises(); pintar(); }
}
const alternarTema = () => ponerTema(document.documentElement.dataset.tema === 'claro' ? 'oscuro' : 'claro');
$('#tema-claro').addEventListener('change', (e) => ponerTema(e.target.checked ? 'claro' : 'oscuro'));

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
function ponerRango(r) {
  estado.rango = r;
  guardar('rango', r);
  aplicarRango();
  pintar();
}

$('#rango').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rango]');
  if (b) ponerRango(b.dataset.rango);
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
function alternarPais(c) {
  if (FIJOS.includes(c)) return;
  estado.paises = estado.paises.includes(c) ? estado.paises.filter((p) => p !== c) : [...estado.paises, c];
  guardar('paises', estado.paises);
  pintarPaises();
  pintar();
}
$('#paises').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pais]');
  if (b && !b.disabled) alternarPais(b.dataset.pais);
});

// ---------------------------------------------------------------- Estado de las fuentes y actualización
const TEXTO_FUENTE = { INE: 'INE', EUROSTAT: 'Eurostat', BCE: 'Banco Central Europeo' };

function cuando(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    sondeo = setTimeout(seguirActualizacion, 400);
  } else if (sondeo !== null) {
    sondeo = null;
    if (a.errores.length) avisar(`Actualización con avisos: ${a.errores.join(' · ')}`, 'error', 8000);
    else avisar('Datos actualizados desde INE, Eurostat y BCE ✓', 'ok');
    aviso('');
    catalogo = await get('catalogo');
    await cargarTicker();
    pintar();
  }
}

async function actualizar() {
  if ($('#btn-actualizar').disabled) return;
  await post('actualizar', {});
  avisar('Descargando datos oficiales…', 'info', 2500);
  sondeo = 0;
  seguirActualizacion();
}
$('#btn-actualizar').addEventListener('click', actualizar);

// ---------------------------------------------------------------- Modo académico
const academico = $('#academico');
academico.checked = leer('academico', false);
document.body.classList.toggle('modo-academico', academico.checked);
function ponerAcademico(activo) {
  academico.checked = activo;
  document.body.classList.toggle('modo-academico', activo);
  guardar('academico', activo);
  avisar(activo ? 'Modo explicación académica activado' : 'Modo explicación académica desactivado', 'info', 2200);
}
academico.addEventListener('change', () => ponerAcademico(academico.checked));

// ---------------------------------------------------------------- Ticker y reloj
// sentido: -1 = subir es malo (rojo), 1 = subir es bueno (verde), 0 = neutro
const TICKER = [
  ['ipc_general', 'ES', 'IPC', 0], ['ipc_subyacente', 'ES', 'IPC subyacente', 0], ['paro', 'ES', 'Paro', -1],
  ['paro_jovenes', 'ES', 'Paro juvenil', -1], ['pib_var', 'ES', 'PIB', 1], ['euribor_12m', 'EA', 'Euríbor', 0],
  ['bce_deposito', 'EA', 'Tipo BCE', 0], ['tipo_hipotecas', 'ES', 'Hipotecas', 0], ['ipv_general_var', 'ES', 'Vivienda', 0],
  ['bono_10a', 'ES', 'Bono 10a', 0], ['deuda_publica', 'ES', 'Deuda/PIB', -1], ['saldo_publico', 'ES', 'Saldo público', 1],
  ['iapc_general', 'EA', 'IAPC zona euro', 0], ['paro', 'EA', 'Paro zona euro', -1], ['m3_var', 'EA', 'M3', 0],
];

async function cargarTicker() {
  resumen = (await get('resumen')).filas;
  const indice = new Map(resumen.map((f) => [`${f.indicador}|${f.pais}`, f]));
  const items = TICKER.map(([id, pais, nombre, sentido]) => {
    const f = indice.get(`${id}|${pais}`);
    if (!f) return '';
    const d = f.anterior == null ? 0 : f.valor - f.anterior;
    const flecha = Math.abs(d) < 0.005 ? '■' : d > 0 ? '▲' : '▼';
    const clase = Math.abs(d) < 0.005 ? 'igual' : sentido === 0 ? (d > 0 ? 'neutro-sube' : 'neutro-baja')
      : (d > 0) === (sentido > 0) ? 'baja' : 'sube';
    return `<a class="tick" href="#/${PAGINA_DE(id)}">${nombre}${pais === 'EA' && !nombre.includes('zona') ? ' (UEM)' : ''}
      <b>${fmt(f.valor, f.unidad === '%' && /euribor|bce|bono|hipotecas/.test(id) ? 2 : 1)}${f.unidad.startsWith('%') ? '%' : ''}</b>
      <span class="${clase}">${flecha} ${fmt(Math.abs(d), 2)}</span></a>`;
  }).join('');
  $('#ticker-pista').innerHTML = items + items; // dos veces para que el desfile no tenga cortes
}

function reloj() {
  const ahora = new Date();
  $('#reloj').textContent = `${ahora.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()} · ${ahora.toLocaleTimeString('es-ES')}`;
}
setInterval(reloj, 1000);
reloj();

// ---------------------------------------------------------------- Paleta de comandos y atajos
function comandos() {
  const lista = [];
  let orden = 0;
  const add = (c) => lista.push({ orden: orden++, ...c });
  ORDEN.forEach((p, i) => add({ tipo: 'página', icono: ICONOS[p], titulo: PAGINAS[p].titulo, detalle: TECLA(i),
    claves: p, accion: () => { location.hash = `#/${p}`; } }));
  add({ tipo: 'investigación', icono: '+', titulo: 'Nuevo recurso de investigación', detalle: 'Dato, informe, teoría o predicción',
    claves: 'crear anadir recurso nota', accion: () => editarRecurso(null, (r) => { location.hash = `#/biblioteca/${r.id}`; }) });
  for (const f of tax()?.fichas || []) {
    add({ tipo: 'ficha', icono: '◧', titulo: f.titulo, detalle: 'Ficha de investigación', claves: `ficha ${f.id}`, accion: () => { location.hash = `#/fichas/${f.id}`; } });
  }
  for (const r of tax()?.recursos || []) {
    add({ tipo: 'recurso', icono: '▤', titulo: r.titulo, detalle: tax().tipos[r.tipo]?.nombre, claves: `recurso ${r.id}`,
      accion: () => { location.hash = `#/biblioteca/${r.id}`; } });
  }
  for (const ind of catalogo?.indicadores || []) {
    add({ tipo: 'indicador', icono: '↗', titulo: ind.nombre, detalle: `${ind.fuente === 'EUROSTAT' ? 'Eurostat' : ind.fuente} · ${PAGINAS[PAGINA_DE(ind.id)].titulo}`,
      claves: `${ind.id} ${ind.nota || ''}`, accion: () => { location.hash = `#/${PAGINA_DE(ind.id)}`; } });
    if (ind.paises.length > 20) {
      add({ tipo: 'mapa', icono: '🗺', titulo: `${ind.nombre} en el mapa de Europa`, detalle: 'Animación de los 27 países',
        claves: `mapa europa ${ind.id}`, accion: () => { location.hash = `#/mapa/${ind.id}`; } });
    }
  }
  for (const [c, n] of Object.entries(catalogo?.paises || {})) {
    if (FIJOS.includes(c)) continue;
    const on = estado.paises.includes(c);
    add({ tipo: 'país', icono: on ? '−' : '+', titulo: `${on ? 'Quitar' : 'Añadir'} ${n}`, detalle: 'Comparación en los gráficos', claves: `pais ${n}`, accion: () => alternarPais(c) });
  }
  for (const [r, n] of [['1', '1 año'], ['3', '3 años'], ['5', '5 años'], ['10', '10 años'], ['max', 'desde 2000']]) {
    add({ tipo: 'periodo', icono: '⏱', titulo: `Periodo: ${n}`, claves: 'periodo rango fechas', accion: () => ponerRango(r) });
  }
  add({ tipo: 'acción', icono: '◐', titulo: 'Cambiar tema claro / oscuro', detalle: 'Tecla T', claves: 'tema oscuro claro modo', accion: alternarTema });
  add({ tipo: 'acción', icono: '🎓', titulo: 'Modo explicación académica', detalle: 'Tecla A', claves: 'academico explicacion formulas', accion: () => ponerAcademico(!academico.checked) });
  add({ tipo: 'acción', icono: '⟳', titulo: 'Actualizar los datos ahora', detalle: 'Tecla U', claves: 'actualizar descargar datos', accion: actualizar });
  add({ tipo: 'acción', icono: '⌨', titulo: 'Ver atajos de teclado', detalle: 'Tecla ?', claves: 'atajos teclado ayuda', accion: abrirAyuda });
  add({ tipo: 'enlace', icono: '⧉', titulo: 'Abrir el código en GitHub', claves: 'github codigo repositorio',
    accion: () => window.open('https://github.com/osquihdts-design/observatorio-economico', '_blank', 'noopener') });
  return lista;
}

const paleta = iniciarPaleta(comandos);
$('#abrir-paleta').addEventListener('click', paleta.abrir);

function abrirAyuda() { $('#ayuda').hidden = false; $('#ayuda [data-cerrar]').focus(); }
$('#abrir-ayuda').addEventListener('click', abrirAyuda);
$('#ayuda').addEventListener('click', (e) => { if (e.target.id === 'ayuda' || e.target.closest('[data-cerrar]')) $('#ayuda').hidden = true; });
$('#visor-cerrar').addEventListener('click', cerrarVisor);
$('#visor').addEventListener('click', (e) => { if (e.target.id === 'visor') cerrarVisor(); });

iniciarAtajos({
  paleta: paleta.abrir,
  pagina: (n) => { location.hash = `#/${ORDEN[n]}`; },
  academico: () => ponerAcademico(!academico.checked),
  tema: alternarTema,
  actualizar,
  ayuda: abrirAyuda,
  cerrar: () => { paleta.cerrar(); cerrarVisor(); $('#ayuda').hidden = true; document.body.classList.remove('menu-abierto'); },
});

$('#menu-movil').addEventListener('click', () => document.body.classList.toggle('menu-abierto'));

// ---------------------------------------------------------------- Páginas
const ESQUELETO = '<div class="carga"><div class="esqueleto e1"></div><div class="esqueleto e2"></div><div class="esqueleto e3"></div></div>';

let turno = 0;
async function pintar() {
  const [nombre, parametro] = location.hash.replace('#/', '').split('/');
  paginaActual = nombre in PAGINAS ? nombre : 'portada';
  const pagina = PAGINAS[paginaActual];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === paginaActual));
  document.title = `${pagina.titulo} · Observatorio económico`;
  document.body.classList.remove('menu-abierto');
  pagina.salir?.();
  const contenedor = $('#pagina');
  const mio = ++turno;
  if (!contenedor.querySelector('.carga')) contenedor.innerHTML = ESQUELETO;
  const ctx = {
    desde: estado.desde,
    hasta: estado.hasta,
    paises: [...new Set([...FIJOS, ...estado.paises])],
    catalogo,
    resumen,
    parametro,
    indicador: (id) => catalogo.indicadores.find((i) => i.id === id),
    nombrePais: (c) => catalogo.nombres?.[c] || catalogo.paises[c] || c,
    vigente: () => mio === turno,  // para ignorar respuestas de una página que ya se ha dejado
  };
  const nodo = document.createElement('div');
  try {
    await pagina.render(nodo, ctx);
  } catch (err) {
    nodo.innerHTML = `<div class="alerta">No se pudo cargar la página: ${err.message}</div>`;
  }
  if (mio !== turno) return;
  await transicion(contenedor, nodo);
  // Plotly calcula el tamaño al dibujar: tras insertar la página, se ajusta al ancho real.
  contenedor.querySelectorAll('.js-plotly-plot').forEach((g) => Plotly.Plots.resize(g));
  revelar(contenedor.querySelectorAll('.cabecera, .heroe, .kpi, .card'));
  contar(contenedor);
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

window.addEventListener('hashchange', pintar);

(async function inicio() {
  ponerTema(leer('tema', 'oscuro'), false);
  iniciarFondo();
  iniciarTarjetas();
  $('#pagina').innerHTML = ESQUELETO;
  catalogo = await get('catalogo');
  aplicarRango();
  pintarPaises();
  const e = await pintarEstado();
  if (e.actualizacion.activa || e.vacia) {
    sondeo = 0;
    aviso(e.vacia ? 'Descargando los datos por primera vez. Tarda unos segundos…' : '');
    seguirActualizacion();
  }
  await cargarTicker().catch(() => {});
  cargarTaxonomia().catch(() => {}); // para que la paleta encuentre recursos y fichas
  pintar();
  if (!leer('bienvenida', false)) {
    setTimeout(() => avisar('Consejo: pulsa Ctrl+K para buscar cualquier cosa, o ? para ver los atajos', 'info', 7000), 1500);
    guardar('bienvenida', true);
  }
})();
