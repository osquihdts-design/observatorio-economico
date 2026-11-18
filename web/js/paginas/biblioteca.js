// Biblioteca: buscador instantáneo con filtros combinables (fuente, tipo, categoría, fechas, etiquetas).
import { get } from '../api.js';
import {
  abrirRecurso, activarCitas, botonCita, cargarTaxonomia, chipFuente, editarRecurso, esc, fecha, insignia, nombreCategoria, valorClave,
} from '../investigacion.js';

const VACIO = { q: '', pilar: '', naturalezas: [], tipos: [], ambitos: [], organismos: [], categorias: [], etiquetas: [], desde: '', hasta: '' };
const NATURALEZAS = ['Dato bruto', 'Teoría', 'Análisis', 'Predicción'];
let filtros = { ...VACIO };
let atajo = null;

function leerGuardados() {
  try {
    const pendientes = JSON.parse(sessionStorage.getItem('inv:filtros') || 'null');
    sessionStorage.removeItem('inv:filtros');
    if (pendientes) return { ...VACIO, ...pendientes };
    return { ...VACIO, ...JSON.parse(sessionStorage.getItem('inv:biblioteca') || '{}') };
  } catch { return { ...VACIO }; }
}
const guardar = () => { try { sessionStorage.setItem('inv:biblioteca', JSON.stringify(filtros)); } catch { /* sin almacenamiento */ } };

function consulta() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (Array.isArray(v) ? v.length : v) p.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  return p.toString();
}

const marcado = (lista, v) => lista.includes(v);
function opcion(grupo, valor, texto, n, extra = '') {
  const on = marcado(filtros[grupo], valor);
  return `<label class="faceta-op ${on ? 'on' : ''} ${!n && !on ? 'cero' : ''}" ${extra}>
    <input type="checkbox" data-grupo="${grupo}" value="${esc(valor)}" ${on ? 'checked' : ''}><span>${texto}</span><i>${n || 0}</i></label>`;
}

function pintarFacetas(caja, f, t) {
  const bloques = [];
  bloques.push(`<div class="faceta"><h4>Origen</h4><div class="segmentado-inv">
    ${[['', 'Todo'], ['externo', 'Fuentes secundarias'], ['interno', 'Propios']].map(([v, n]) => `<button data-pilar="${v}" class="${filtros.pilar === v ? 'on' : ''}">${n}<small>${v ? f.pilar[v] || 0 : ''}</small></button>`).join('')}
  </div></div>`);
  bloques.push(`<div class="faceta"><h4>Tipo de contenido</h4>${NATURALEZAS.map((n) => opcion('naturalezas', n, n, f.naturaleza[n])).join('')}</div>`);
  bloques.push(`<div class="faceta"><h4>Tipo de recurso</h4>${Object.entries(t.tipos).map(([k, v]) => opcion('tipos', k, v.nombre, f.tipo[k])).join('')}</div>`);
  bloques.push(`<div class="faceta"><h4>Fuente</h4>${Object.entries(t.ambitos).map(([a, n]) => `
    <details ${filtros.ambitos.includes(a) || t.organismos.some((o) => o.ambito === a && filtros.organismos.includes(o.id)) || f.ambito[a] ? 'open' : ''}>
      <summary>${opcion('ambitos', a, n, f.ambito[a])}</summary>
      <div class="sub-opciones">${t.organismos.filter((o) => o.ambito === a).map((o) => opcion('organismos', o.id, o.siglas === o.nombre ? o.nombre : `${o.siglas} <small>${esc(o.nombre)}</small>`, f.organismo[o.id])).join('')}</div>
    </details>`).join('')}</div>`);
  bloques.push(`<div class="faceta"><h4>Categoría temática</h4>${t.categorias.map((g) => `
    <details ${f.categoria[g.id] ? 'open' : ''}>
      <summary>${opcion('categorias', g.id, g.nombre, f.categoria[g.id])}</summary>
      <div class="sub-opciones">${g.hijas.map((h) => opcion('categorias', h.id, h.nombre, f.categoria[h.id])).join('')}</div>
    </details>`).join('')}</div>`);
  bloques.push(`<div class="faceta"><h4>Fechas</h4><div class="fechas-faceta">
    <label>Desde<input type="text" data-fecha="desde" placeholder="2025" value="${esc(filtros.desde)}"></label>
    <label>Hasta<input type="text" data-fecha="hasta" placeholder="2026-12" value="${esc(filtros.hasta)}"></label></div></div>`);
  const etiquetas = Object.entries(f.etiqueta).sort((a, b) => b[1] - a[1]);
  const seleccionadas = filtros.etiquetas.filter((e) => !f.etiqueta[e]).map((e) => [e, 0]);
  bloques.push(`<div class="faceta"><h4>Etiquetas</h4><div class="nube">${[...seleccionadas, ...etiquetas].map(([e, n]) =>
    `<button data-etiqueta="${esc(e)}" class="${filtros.etiquetas.includes(e) ? 'on' : ''}">#${esc(e)} <i>${n}</i></button>`).join('')}</div></div>`);
  caja.innerHTML = bloques.join('');
}

function chipsActivos(t) {
  const chips = [];
  const quitar = (grupo, valor, texto) => chips.push(`<button class="chip-activo" data-quitar="${grupo}|${esc(valor)}">${texto} ✕</button>`);
  if (filtros.q) quitar('q', '', `«${esc(filtros.q)}»`);
  if (filtros.pilar) quitar('pilar', '', filtros.pilar === 'externo' ? 'Fuentes secundarias' : 'Propios');
  filtros.naturalezas.forEach((n) => quitar('naturalezas', n, n));
  filtros.tipos.forEach((n) => quitar('tipos', n, t.tipos[n].nombre));
  filtros.ambitos.forEach((n) => quitar('ambitos', n, t.ambitos[n]));
  filtros.organismos.forEach((n) => quitar('organismos', n, t.organismos.find((o) => o.id === n)?.siglas || n));
  filtros.categorias.forEach((n) => quitar('categorias', n, nombreCategoria(n)));
  filtros.etiquetas.forEach((n) => quitar('etiquetas', n, `#${n}`));
  if (filtros.desde) quitar('desde', '', `desde ${filtros.desde}`);
  if (filtros.hasta) quitar('hasta', '', `hasta ${filtros.hasta}`);
  return chips.join('');
}

function filaResultado(r) {
  const v = valorClave(r);
  return `<article class="resultado" data-abrir="${esc(r.id)}" tabindex="0">
    <div class="res-tipo">${insignia(r)}</div>
    <div class="res-cuerpo">
      <h3>${esc(r.titulo)}</h3>
      <p>${esc(r.resumen)}</p>
      <div class="res-meta">${chipFuente(r)}<span>${fecha(r.fecha) || 'sin fecha'}</span>
        ${r.categorias.slice(0, 4).map((c) => `<span class="chip-cat">${esc(nombreCategoria(c))}</span>`).join('')}
        ${r.etiquetas.slice(0, 3).map((e) => `<span class="chip-tag">#${esc(e)}</span>`).join('')}</div>
    </div>
    <div class="res-dato">${v ? `<strong class="${v.vivo ? 'vivo' : ''}">${esc(v.valor)}</strong><small>${esc(v.nota)}</small>` : ''}</div>
    <div class="res-acciones">${botonCita(r)}</div>
  </article>`;
}

export default {
  titulo: 'Biblioteca de fuentes',
  salir() { if (atajo) document.removeEventListener('keydown', atajo); atajo = null; },
  async render(nodo, ctx) {
    filtros = leerGuardados();
    const t = await cargarTaxonomia(true);
    if (!ctx.vigente()) return;
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Centro de investigación · biblioteca</span>
        <h1>Biblioteca de <span class="degradado">fuentes</span></h1>
        <p>Busca mientras escribes y combina filtros. Pulsa un resultado para ver el detalle, sus vínculos y copiar la cita.
        Atajo: <kbd>N</kbd> nuevo recurso.</p></header>
      <div class="biblioteca">
        <aside class="facetas card" aria-label="Filtros"></aside>
        <section class="card resultados-caja">
          <div class="barra-busqueda">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" placeholder="Buscar en títulos, resúmenes, textos y etiquetas…" value="${esc(filtros.q)}" aria-label="Buscar">
            <button class="btn primario" data-nuevo>+ Nuevo</button>
          </div>
          <div class="activos"></div>
          <div class="cuenta-resultados" aria-live="polite"></div>
          <div class="resultados"></div>
        </section>
      </div>`;
    const caja = nodo.querySelector('.facetas');
    const lista = nodo.querySelector('.resultados');
    const entrada = nodo.querySelector('.barra-busqueda input');
    let ultimos = new Map();
    let turno = 0;

    async function buscar() {
      guardar();
      const mio = ++turno;
      const res = await get(`inv/buscar?${consulta()}`);
      if (mio !== turno) return;
      ultimos = new Map(res.resultados.map((r) => [r.id, r]));
      pintarFacetas(caja, res.facetas, t);
      nodo.querySelector('.activos').innerHTML = chipsActivos(t) + (consulta() ? '<button class="limpiar" data-limpiar>Limpiar todo</button>' : '');
      nodo.querySelector('.cuenta-resultados').innerHTML = `<b>${res.total}</b> ${res.total === 1 ? 'recurso' : 'recursos'}${filtros.q ? ' · ordenados por relevancia' : ' · los más recientes primero'}`;
      lista.innerHTML = res.resultados.map(filaResultado).join('')
        || `<div class="vacio-inv"><b>Nada coincide.</b><p>Quita algún filtro o <button class="enlace" data-nuevo>crea un recurso nuevo</button>.</p></div>`;
      lista.querySelectorAll('.resultado').forEach((el, i) => { el.style.animationDelay = `${Math.min(i, 12) * 25}ms`; });
    }

    let espera = null;
    entrada.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { filtros.q = entrada.value.trim(); buscar(); }, 140); });
    caja.addEventListener('change', (e) => {
      const g = e.target.dataset.grupo;
      if (g) {
        filtros[g] = e.target.checked ? [...filtros[g], e.target.value] : filtros[g].filter((x) => x !== e.target.value);
        buscar();
      }
      const fe = e.target.dataset.fecha;
      if (fe) { filtros[fe] = e.target.value.trim(); buscar(); }
    });
    caja.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pilar]');
      if (p) { filtros.pilar = p.dataset.pilar; buscar(); }
      const et = e.target.closest('[data-etiqueta]');
      if (et) {
        const v = et.dataset.etiqueta;
        filtros.etiquetas = filtros.etiquetas.includes(v) ? filtros.etiquetas.filter((x) => x !== v) : [...filtros.etiquetas, v];
        buscar();
      }
      // Pulsar el texto del <summary> marca la casilla, no abre/cierra el grupo.
      if (e.target.closest('summary label') && !e.target.matches('input')) e.preventDefault();
      if (e.target.closest('summary label') && !e.target.matches('input')) e.target.closest('label').querySelector('input').click();
    });
    nodo.querySelector('.activos').addEventListener('click', (e) => {
      if (e.target.closest('[data-limpiar]')) { filtros = { ...VACIO }; entrada.value = ''; buscar(); return; }
      const q = e.target.closest('[data-quitar]');
      if (!q) return;
      const [g, v] = q.dataset.quitar.split('|');
      if (Array.isArray(filtros[g])) filtros[g] = filtros[g].filter((x) => x !== v);
      else filtros[g] = '';
      if (g === 'q') entrada.value = '';
      buscar();
    });
    const nuevo = () => editarRecurso(null, (r) => { buscar(); abrirRecurso(r.id, buscar); });
    nodo.addEventListener('click', (e) => { if (e.target.closest('[data-nuevo]')) nuevo(); });
    activarCitas(lista, (id) => ultimos.get(id));
    const abrir = (el) => abrirRecurso(el.dataset.abrir, buscar);
    lista.addEventListener('click', (e) => {
      const el = e.target.closest('[data-abrir]');
      if (el && !e.target.closest('[data-citar]')) abrir(el);
    });
    lista.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-abrir]')) abrir(e.target); });

    this.salir();
    atajo = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); nuevo(); }
    };
    document.addEventListener('keydown', atajo);

    await buscar();
    if (ctx.parametro) abrirRecurso(ctx.parametro, buscar);
  },
};
