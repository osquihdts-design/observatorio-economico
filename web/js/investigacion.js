// Piezas comunes del centro de investigación: llamadas a la API, Markdown, citas al portapapeles,
// el cajón lateral con el detalle de un recurso y el editor de recursos.
import { get, post } from './api.js';
import { avisar } from './efectos.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- Datos
let taxonomia = null;
export async function cargarTaxonomia(forzar = false) {
  if (!taxonomia || forzar) taxonomia = await get('inv/taxonomia');
  return taxonomia;
}
export const tax = () => taxonomia;

export function nombreCategoria(id) {
  for (const g of taxonomia?.categorias || []) {
    if (g.id === id) return g.nombre;
    const h = g.hijas.find((x) => x.id === id);
    if (h) return h.nombre;
  }
  return id;
}

// Color e icono de cada tipo de recurso (el pilar se distingue por la forma: ● externo, ◆ propio).
export const TIPO_ESTILO = {
  dato: { color: '#38bdf8', icono: '●' },
  informe: { color: '#60a5fa', icono: '●' },
  proyeccion: { color: '#fbbf24', icono: '●' },
  teoria: { color: '#a78bfa', icono: '◆' },
  empirico: { color: '#2dd4bf', icono: '◆' },
  prediccion: { color: '#f472b6', icono: '◆' },
};
export const insignia = (r) => {
  const e = TIPO_ESTILO[r.tipo] || {};
  return `<span class="insignia" style="--c:${e.color}">${e.icono} ${esc(r.tipo_nombre || taxonomia?.tipos?.[r.tipo]?.nombre || r.tipo)}</span>`;
};
export const chipFuente = (r) => `<span class="chip-fuente amb-${r.organismo_info?.ambito || ''}" title="${esc(r.organismo_info?.nombre)}">${esc(r.organismo_info?.siglas || r.organismo)}</span>`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fecha(f) {
  if (!f) return '';
  const [a, m, d] = f.split('-');
  if (!m) return a;
  return d ? `${Number(d)} ${MESES[m - 1]} ${a}` : `${MESES[m - 1]} ${a}`;
}

/** Valor que se enseña de un recurso: el dato vivo de la serie (datos oficiales) o el dato guardado. */
const numero = (v) => v.toLocaleString('es-ES', { minimumFractionDigits: Math.abs(v) >= 1000 ? 0 : 1, maximumFractionDigits: 2 });
export function periodo(f, frecuencia) {
  const [a, m] = f.split('-').map(Number);
  return frecuencia === 'Q' ? `T${Math.floor((m - 1) / 3) + 1} ${a}` : `${MESES[m - 1]} ${a}`;
}
export function valorClave(r) {
  if (r.tipo === 'dato' && r.vivo) {
    const u = r.vivo.unit?.startsWith('%') ? ' %' : ` ${r.vivo.unit || ''}`;
    return { valor: `${numero(r.vivo.value)}${u}`, nota: `${periodo(r.vivo.date, r.vivo.frequency)} · en vivo`, vivo: true };
  }
  if (r.dato_valor == null) return null;
  const u = r.dato_unidad?.startsWith('%') ? ' %' : ` ${r.dato_unidad || ''}`;
  return { valor: `${numero(r.dato_valor)}${u}`, nota: r.dato_periodo || '', vivo: false };
}

export function confianza(n) {
  if (!n) return '';
  return `<span class="confianza" title="Confianza ${n} de 5">${'●'.repeat(n)}<i>${'●'.repeat(5 - n)}</i></span>`;
}

// ---------------------------------------------------------------- Markdown mínimo (sin librerías)
function enLinea(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(\S(?:[^*]*?\S)?)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}

export function markdown(texto) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  const html = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i += 1; continue; }
    if (/^ {4}|^\t/.test(l)) {
      const bloque = [];
      while (i < lineas.length && (/^ {4}|^\t/.test(lineas[i]) || !lineas[i].trim())) { bloque.push(lineas[i].replace(/^ {4}|^\t/, '')); i += 1; }
      html.push(`<pre class="formula">${esc(bloque.join('\n').trim())}</pre>`);
      continue;
    }
    if (/^\|/.test(l)) {
      const filas = [];
      while (i < lineas.length && /^\|/.test(lineas[i])) { filas.push(lineas[i]); i += 1; }
      const celdas = (f) => f.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const cuerpo = filas.filter((f) => !/^\|[\s:-]+\|/.test(f) || /[a-z0-9]/i.test(f.replace(/[|\s:-]/g, '')));
      const [cab, ...resto] = cuerpo;
      html.push(`<div class="tabla-wrap"><table class="tabla-md"><thead><tr>${celdas(cab).map((c) => `<th>${enLinea(c)}</th>`).join('')}</tr></thead>
        <tbody>${resto.map((f) => `<tr>${celdas(f).map((c, j) => `<td class="${j && /^[−\-+]?[\d.,]+\s*%?$/.test(c) ? 'num' : ''}">${enLinea(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { html.push(`<h${h[1].length + 2}>${enLinea(h[2])}</h${h[1].length + 2}>`); i += 1; continue; }
    if (/^>/.test(l)) {
      const bloque = [];
      while (i < lineas.length && /^>/.test(lineas[i])) { bloque.push(lineas[i].replace(/^>\s?/, '')); i += 1; }
      html.push(`<blockquote>${markdown(bloque.join('\n'))}</blockquote>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordenada = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lineas.length && /^\s*([-*]|\d+\.)\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i += 1; }
      html.push(`<${ordenada ? 'ol' : 'ul'}>${items.map((x) => `<li>${enLinea(x)}</li>`).join('')}</${ordenada ? 'ol' : 'ul'}>`);
      continue;
    }
    const parrafo = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,4}\s|>|\||\s*([-*]|\d+\.)\s+| {4})/.test(lineas[i])) { parrafo.push(lineas[i]); i += 1; }
    html.push(`<p>${enLinea(parrafo.join(' '))}</p>`);
  }
  return html.join('');
}

// ---------------------------------------------------------------- Citas al portapapeles
export async function copiar(texto, que = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: texto });
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
  avisar(`${que} al portapapeles ✓`, 'ok', 2200);
}

/** Botón «Citar» con menú: APA, nota al pie o dato + fuente. */
export function botonCita(r, extra = '') {
  return `<div class="citar ${extra}" data-citar="${esc(r.id)}">
    <button class="btn-citar" type="button" title="Copiar la referencia">❝ Citar</button>
    <div class="menu-citar" role="menu">
      <button data-forma="apa" type="button"><b>APA 7.ª</b><small>${esc(r.citas.apa.slice(0, 90))}…</small></button>
      <button data-forma="nota" type="button"><b>Nota al pie</b><small>${esc(r.citas.nota.slice(0, 90))}…</small></button>
      ${r.citas.dato ? `<button data-forma="completa" type="button"><b>Dato + fuente</b><small>${esc(r.citas.dato.slice(0, 90))}</small></button>` : ''}
    </div></div>`;
}

const NOMBRES_FORMA = { apa: 'Cita APA', nota: 'Nota al pie', completa: 'Dato con su fuente' };
/** Activa todos los botones «Citar» dentro de `raiz`. `buscar(id)` devuelve el recurso. */
export function activarCitas(raiz, buscar) {
  raiz.buscarCita = buscar;
  if (raiz.dataset.citas) return; // ya activado (el cajón se reutiliza)
  raiz.dataset.citas = '1';
  raiz.addEventListener('click', (e) => {
    const caja = e.target.closest('[data-citar]');
    if (!caja) return;
    e.stopPropagation();
    const forma = e.target.closest('[data-forma]')?.dataset.forma;
    if (forma) {
      const r = raiz.buscarCita(caja.dataset.citar);
      if (r) copiar(r.citas[forma], NOMBRES_FORMA[forma]);
      caja.classList.remove('abierto');
      return;
    }
    if (e.target.closest('.btn-citar')) {
      const abierto = caja.classList.contains('abierto');
      raiz.querySelectorAll('.citar.abierto').forEach((c) => c.classList.remove('abierto'));
      caja.classList.toggle('abierto', !abierto);
    }
  });
  document.addEventListener('click', () => raiz.querySelectorAll('.citar.abierto').forEach((c) => c.classList.remove('abierto')));
}

// ---------------------------------------------------------------- Cajón lateral con el detalle
let cajon = null;
function crearCajon() {
  cajon = document.createElement('div');
  cajon.className = 'cajon-capa';
  cajon.hidden = true;
  cajon.innerHTML = '<aside class="cajon" role="dialog" aria-modal="true" aria-label="Detalle del recurso"></aside>';
  document.body.appendChild(cajon);
  cajon.addEventListener('click', (e) => { if (e.target === cajon) cerrarCajon(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !cajon.hidden) cerrarCajon(); });
}
export function cerrarCajon() {
  if (!cajon || cajon.hidden) return;
  cajon.classList.add('saliendo');
  setTimeout(() => { cajon.hidden = true; cajon.classList.remove('saliendo'); }, 220);
}

/** Abre el detalle de un recurso. `alCambiar` se llama si se edita o borra. */
export async function abrirRecurso(id, alCambiar = () => {}) {
  if (!cajon) crearCajon();
  const panel = cajon.querySelector('.cajon');
  panel.innerHTML = '<div class="carga"><div class="esqueleto e1"></div><div class="esqueleto e2"></div></div>';
  cajon.hidden = false;
  await cargarTaxonomia();
  const r = await get(`inv/recurso?id=${encodeURIComponent(id)}`);
  const v = valorClave(r);
  const vinculos = r.vinculos.map((x) => (x.sentido === 'sale'
    ? `<li><span class="verbo">→ ${esc(taxonomia.vinculos[x.tipo])}</span><a href="#" data-abrir="${esc(x.id)}">${esc(x.titulo)}</a>
        <button class="quitar" title="Quitar vínculo" data-desvincular="${esc(x.id)}|${x.tipo}">×</button></li>`
    : `<li><span class="verbo">←</span><a href="#" data-abrir="${esc(x.id)}">${esc(x.titulo)}</a><span class="verbo">${esc(taxonomia.vinculos[x.tipo])} este</span></li>`)).join('');
  panel.innerHTML = `
    <header class="cajon-cabeza">
      <div>${insignia(r)} ${chipFuente(r)} <span class="estado est-${r.estado}">${esc(taxonomia.estados[r.estado])}</span></div>
      <button class="btn-cerrar" data-cerrar aria-label="Cerrar">✕</button>
    </header>
    <h2>${esc(r.titulo)}</h2>
    <p class="meta">${r.organismo_info.nombre}${r.autores && r.autores !== r.organismo_info.nombre ? ` · ${esc(r.autores)}` : ''}${r.fecha ? ` · ${fecha(r.fecha)}` : ''}
      ${r.horizonte ? ` · horizonte ${esc(r.horizonte)}` : ''} ${confianza(r.confianza)}</p>
    ${v ? `<div class="dato-grande ${v.vivo ? 'vivo' : ''}"><strong>${esc(v.valor)}</strong><span>${esc(v.nota)}</span></div>` : ''}
    ${r.resumen ? `<p class="resumen">${esc(r.resumen)}</p>` : ''}
    <div class="cajon-acciones">
      ${botonCita(r)}
      ${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">Abrir la fuente ↗</a>` : ''}
      <button class="btn" data-editar>Editar</button>
      <button class="btn peligro" data-borrar>Borrar</button>
    </div>
    <div class="md">${markdown(r.contenido)}</div>
    ${r.notas_extraccion ? `<div class="notas-extraccion"><b>Notas de extracción</b><p>${esc(r.notas_extraccion)}</p></div>` : ''}
    <section class="cajon-bloque"><h3>Categorías y etiquetas</h3>
      <div class="chips">${r.categorias.map((c) => `<a class="chip-cat" href="#/biblioteca" data-ir-categoria="${c}">${esc(nombreCategoria(c))}</a>`).join('')}
      ${r.etiquetas.map((t) => `<span class="chip-tag">#${esc(t)}</span>`).join('')}</div></section>
    <section class="cajon-bloque"><h3>Vínculos</h3>
      ${vinculos ? `<ul class="vinculos">${vinculos}</ul>` : '<p class="sub">Sin vínculos todavía.</p>'}
      <form class="nuevo-vinculo">
        <select name="tipo">${Object.entries(taxonomia.vinculos).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>
        <select name="destino"><option value="">Elige un recurso…</option>${taxonomia.recursos.filter((x) => x.id !== r.id).map((x) => `<option value="${esc(x.id)}">${esc(x.titulo)}</option>`).join('')}</select>
        <button class="btn" type="submit">Vincular</button>
      </form></section>
    <section class="cajon-bloque"><h3>Fichas de investigación</h3>
      <div class="chips">${r.fichas.map((f) => `<a class="chip-cat" href="#/fichas/${esc(f.id)}">${esc(f.titulo)}</a>`).join('') || '<span class="sub">No está en ninguna ficha.</span>'}</div>
      <form class="nueva-ficha-recurso">
        <select name="ficha"><option value="">Añadir a una ficha…</option>${taxonomia.fichas.filter((f) => !r.fichas.some((x) => x.id === f.id)).map((f) => `<option value="${esc(f.id)}">${esc(f.titulo)}</option>`).join('')}</select>
        <button class="btn" type="submit">Añadir</button>
      </form></section>
    <section class="cajon-bloque cita-completa"><h3>Referencia APA</h3><p>${esc(r.citas.apa)}</p></section>`;

  activarCitas(panel, () => r);
  panel.querySelector('[data-cerrar]').addEventListener('click', cerrarCajon);
  panel.querySelectorAll('[data-abrir]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); abrirRecurso(a.dataset.abrir, alCambiar); }));
  panel.querySelectorAll('[data-ir-categoria]').forEach((a) => a.addEventListener('click', () => {
    try { sessionStorage.setItem('inv:filtros', JSON.stringify({ categorias: [a.dataset.irCategoria] })); } catch { /* sin almacenamiento */ }
    cerrarCajon();
  }));
  panel.querySelector('[data-editar]').addEventListener('click', () => editarRecurso(r, (nuevo) => { alCambiar(); abrirRecurso(nuevo.id, alCambiar); }));
  panel.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!confirm(`¿Borrar «${r.titulo}»? Se quitará también de sus fichas y vínculos.`)) return;
    await post('inv/recurso/eliminar', { id: r.id });
    await cargarTaxonomia(true);
    avisar('Recurso borrado', 'info');
    cerrarCajon();
    alCambiar();
  });
  panel.querySelectorAll('[data-desvincular]').forEach((b) => b.addEventListener('click', async () => {
    const [destino, tipo] = b.dataset.desvincular.split('|');
    await post('inv/desvincular', { origen: r.id, destino, tipo });
    abrirRecurso(r.id, alCambiar);
  }));
  panel.querySelector('.nuevo-vinculo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (!f.get('destino')) return;
    await post('inv/vincular', { origen: r.id, destino: f.get('destino'), tipo: f.get('tipo') });
    avisar('Vínculo creado ✓', 'ok', 1800);
    abrirRecurso(r.id, alCambiar);
  });
  panel.querySelector('.nueva-ficha-recurso').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ficha = new FormData(e.target).get('ficha');
    if (!ficha) return;
    await post('inv/ficha/anadir', { ficha, recurso: r.id });
    avisar('Añadido a la ficha ✓', 'ok', 1800);
    alCambiar();
    abrirRecurso(r.id, alCambiar);
  });
  panel.scrollTop = 0;
}

// ---------------------------------------------------------------- Editor (crear y editar)
export async function editarRecurso(r, alGuardar) {
  if (!cajon) crearCajon();
  await cargarTaxonomia();
  const t = taxonomia;
  const nuevo = !r;
  r = r || { tipo: 'teoria', organismo: 'PROPIO', estado: 'activo', categorias: [], etiquetas: [] };
  const panel = cajon.querySelector('.cajon');
  cajon.hidden = false;
  const opciones = (obj, actual) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.nombre)}</option>`).join('');
  const porAmbito = Object.entries(t.ambitos).map(([a, n]) => `<optgroup label="${esc(n)}">${t.organismos.filter((o) => o.ambito === a)
    .map((o) => `<option value="${o.id}" ${o.id === r.organismo ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</optgroup>`).join('');
  panel.innerHTML = `
    <header class="cajon-cabeza"><strong>${nuevo ? 'Nuevo recurso' : 'Editar recurso'}</strong><button class="btn-cerrar" data-cerrar aria-label="Cerrar">✕</button></header>
    <form class="editor">
      <label>Título<input type="text" name="titulo" required value="${esc(r.titulo)}"></label>
      <div class="dos">
        <label>Tipo<select name="tipo">${Object.entries(t.tipos).map(([k, v]) => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${esc(v.nombre)} (${v.pilar === 'externo' ? 'fuente secundaria' : 'propio'})</option>`).join('')}</select></label>
        <label>Fuente<select name="organismo">${porAmbito}</select></label>
      </div>
      <div class="dos">
        <label>Fecha<input type="text" name="fecha" placeholder="AAAA-MM-DD" value="${esc(r.fecha)}"></label>
        <label>Estado<select name="estado">${opciones(t.estados, r.estado)}</select></label>
      </div>
      <label>Resumen (una o dos frases)<textarea name="resumen" rows="2">${esc(r.resumen)}</textarea></label>
      <label>Contenido (Markdown: ## títulos, **negrita**, listas con -, tablas con |)<textarea name="contenido" rows="9">${esc(r.contenido)}</textarea></label>
      <label>Enlace a la fuente<input type="text" name="url" placeholder="https://…" value="${esc(r.url)}"></label>
      <fieldset><legend>Dato clave</legend>
        <div class="tres">
          <label>Valor<input type="number" step="any" name="dato_valor" value="${r.dato_valor ?? ''}"></label>
          <label>Unidad<input type="text" name="dato_unidad" placeholder="%" value="${esc(r.dato_unidad)}"></label>
          <label>Periodo o explicación<input type="text" name="dato_periodo" value="${esc(r.dato_periodo)}"></label>
        </div>
        <label>Notas de extracción<input type="text" name="notas_extraccion" value="${esc(r.notas_extraccion)}"></label>
      </fieldset>
      <fieldset class="solo-prediccion"><legend>Predicción</legend>
        <div class="dos">
          <label>Horizonte<input type="text" name="horizonte" placeholder="2027-12" value="${esc(r.horizonte)}"></label>
          <label>Confianza (1–5)<input type="number" min="1" max="5" name="confianza" value="${r.confianza ?? ''}"></label>
        </div>
      </fieldset>
      <fieldset><legend>Categorías</legend>
        <div class="arbol-cats">${t.categorias.map((g) => `<div><b>${esc(g.nombre)}</b>${g.hijas.map((h) => `<label class="check"><input type="checkbox" name="categorias" value="${h.id}" ${r.categorias.includes(h.id) ? 'checked' : ''}>${esc(h.nombre)}</label>`).join('')}</div>`).join('')}</div>
      </fieldset>
      <label>Etiquetas (separadas por comas)<input type="text" name="etiquetas" list="lista-etiquetas" value="${esc(r.etiquetas.join(', '))}"></label>
      <datalist id="lista-etiquetas">${t.etiquetas.map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
      <div class="editor-pie"><button class="btn" type="button" data-cerrar>Cancelar</button><button class="btn primario" type="submit">Guardar</button></div>
    </form>`;
  const form = panel.querySelector('form');
  const ajustar = () => { form.querySelector('.solo-prediccion').hidden = !['prediccion', 'proyeccion'].includes(form.tipo.value); };
  form.tipo.addEventListener('change', () => {
    if (t.tipos[form.tipo.value].pilar === 'interno') form.organismo.value = 'PROPIO';
    else if (form.organismo.value === 'PROPIO') form.organismo.value = 'INE';
    ajustar();
  });
  ajustar();
  panel.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarCajon));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const datos = Object.fromEntries([...f.entries()].filter(([k]) => k !== 'categorias'));
    datos.categorias = f.getAll('categorias');
    datos.etiquetas = String(f.get('etiquetas') || '').split(',').map((x) => x.trim()).filter(Boolean);
    for (const k of ['indicador', 'pais', 'autores', 'fecha_consulta']) if (r[k] != null) datos[k] = r[k];
    if (!nuevo) datos.id = r.id;
    try {
      const guardado = await post('inv/recurso', datos);
      await cargarTaxonomia(true);
      avisar(nuevo ? 'Recurso creado ✓' : 'Cambios guardados ✓', 'ok');
      alGuardar?.(guardado);
    } catch (err) {
      avisar(err.message, 'error', 6000);
    }
  });
  form.titulo.focus();
}
