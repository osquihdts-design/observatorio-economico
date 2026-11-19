// Fichas de investigación: lista de temas y, al abrir uno, el «workspace» en tres columnas:
// datos oficiales · desarrollo teórico · predicciones y conclusiones.
import { get, post, series } from '../api.js';
import { avisar } from '../efectos.js';
import { dibujar, fechaTexto, sparkline, tono } from '../graficos.js';
import {
  abrirRecurso, activarCitas, botonCita, cargarTaxonomia, chipFuente, confianza, copiar, editarRecurso, esc, fecha, insignia,
  markdown, valorClave,
} from '../investigacion.js';

const COLUMNAS = [
  { clave: 'datos', titulo: 'Datos oficiales', icono: '●', sub: 'Fuentes secundarias con su enlace, fecha y notas de extracción' },
  { clave: 'teoria', titulo: 'Desarrollo teórico', icono: '◆', sub: 'Marco conceptual, modelos y análisis empíricos' },
  { clave: 'predicciones', titulo: 'Predicciones y conclusiones', icono: '➜', sub: 'Proyecciones oficiales y estimaciones propias' },
];

function tarjeta(r, historicos) {
  const v = valorClave(r);
  const serie = r.tipo === 'dato' && r.indicador ? historicos[`${r.indicador}|${r.pais || 'ES'}`] : null;
  const actualizado = r.vivo && r.tipo === 'dato' ? `Dato de ${fechaTexto(r.vivo.date, r.vivo.frequency)} · descargado ${new Date(r.vivo.last_updated).toLocaleDateString('es-ES')}`
    : r.fecha ? `Publicado ${fecha(r.fecha)}` : '';
  const conGrafico = r.tipo === 'prediccion' && r.indicador && r.dato_valor != null && r.horizonte;
  return `<article class="item-ficha" data-id="${esc(r.id)}">
    <div class="item-cabeza">${insignia(r)} ${chipFuente(r)} <button class="quitar" data-quitar="${esc(r.id)}" title="Quitar de la ficha">×</button></div>
    <h4 data-abrir="${esc(r.id)}">${esc(r.titulo)}</h4>
    ${v ? `<div class="item-dato ${v.vivo ? 'vivo' : ''}"><strong>${esc(v.valor)}</strong><small>${esc(v.nota)}</small></div>` : ''}
    ${serie && serie.length > 2 ? `<div class="item-spark">${sparkline(serie.slice(-60).map((p) => p[1]), tono('#38bdf8'))}</div>` : ''}
    ${conGrafico ? '<div class="item-grafico" data-grafico></div>' : ''}
    ${r.resumen ? `<p class="item-resumen">${esc(r.resumen)}</p>` : ''}
    ${r.tipo === 'prediccion' ? `<p class="item-meta">Horizonte ${esc(r.horizonte || '—')} · ${confianza(r.confianza)} · ${esc(r.estado)}</p>` : ''}
    ${actualizado ? `<p class="item-meta">${actualizado}</p>` : ''}
    ${r.notas_extraccion ? `<p class="item-notas"><b>Extracción:</b> ${esc(r.notas_extraccion)}</p>` : ''}
    ${r.contenido ? `<details class="item-md"><summary>Ver el desarrollo</summary><div class="md">${markdown(r.contenido)}</div></details>` : ''}
    <div class="item-pie">${botonCita(r)}${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">Fuente ↗</a>` : ''}</div>
  </article>`;
}

/** Gráfico pequeño: la serie real y una línea discontinua hasta el valor previsto en el horizonte. */
function graficoPrediccion(div, r, historico) {
  const puntos = (historico || []).slice(-48);
  if (!puntos.length) { div.remove(); return; }
  const [ultimaFecha, ultimoValor] = puntos.at(-1);
  const horizonte = /^\d{4}-\d{2}$/.test(r.horizonte) ? `${r.horizonte}-01` : `${String(r.horizonte).slice(0, 4)}-12-01`;
  dibujar(div, [
    { x: puntos.map((p) => p[0]), y: puntos.map((p) => p[1]), type: 'scatter', mode: 'lines', name: 'Dato real', line: { color: '#003399', width: 2 },
      hovertemplate: '%{y:.2f}<extra>Dato real</extra>' },
    { x: [ultimaFecha, horizonte], y: [ultimoValor, r.dato_valor], type: 'scatter', mode: 'lines+markers', name: 'Predicción',
      line: { color: '#C8102E', width: 2, dash: 'dash' }, marker: { size: [0, 9] }, hovertemplate: '%{y:.2f}<extra>Predicción</extra>' },
  ], { eventos: false, showlegend: false, margin: { l: 34, r: 8, t: 6, b: 24 }, hovermode: 'closest', xaxis: { tickfont: { size: 10 } }, yaxis: { tickfont: { size: 10 } } });
}

async function lista(nodo, ctx) {
  const { fichas } = await get('inv/fichas');
  if (!ctx.vigente()) return;
  nodo.innerHTML = `
    <header class="cabecera"><span class="etiqueta">Centro de investigación · fichas</span>
      <h1>Fichas de <span class="degradado">investigación</span></h1>
      <p>Una ficha reúne todo lo que tienes sobre una pregunta: los datos oficiales, la teoría y tus conclusiones, en pantalla dividida.</p></header>
    <section class="card">
      <form class="nueva-ficha">
        <input type="text" name="titulo" placeholder="Título de la nueva ficha (p. ej. «Salarios y productividad»)" required>
        <input type="text" name="pregunta" placeholder="Pregunta de investigación">
        <button class="btn primario" type="submit">+ Crear ficha</button>
      </form>
    </section>
    <div class="fichas-grid grande">${fichas.map((f) => `
      <a class="ficha-tarjeta" href="#/fichas/${esc(f.id)}">
        <b>${esc(f.titulo)}</b><p>${esc(f.pregunta)}</p>
        <span class="ficha-cuentas"><i class="c-dat">${f.n_datos || 0} datos</i><i class="c-teo">${f.n_teoria || 0} teoría</i><i class="c-pre">${f.n_predicciones || 0} predicciones</i></span>
        <small>Actualizada ${new Date(f.modificado).toLocaleDateString('es-ES')}</small>
      </a>`).join('')}</div>`;
  nodo.querySelector('.nueva-ficha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const f = await post('inv/ficha', { ...d, recursos: [] });
    avisar('Ficha creada ✓', 'ok');
    location.hash = `#/fichas/${f.id}`;
  });
}

async function workspace(nodo, ctx, id) {
  const [f, t] = await Promise.all([get(`inv/ficha?id=${encodeURIComponent(id)}`), cargarTaxonomia(true)]);
  if (!ctx.vigente()) return;
  const todos = [...f.datos, ...f.teoria, ...f.predicciones];
  const porId = new Map(todos.map((r) => [r.id, r]));
  // Series del panel para los minigráficos (datos enlazados y predicciones con serie).
  const enlazados = todos.filter((r) => r.indicador);
  const historicos = {};
  if (enlazados.length) {
    const desde = `${new Date().getFullYear() - 6}-01-01`;
    const grupos = {};
    enlazados.forEach((r) => { (grupos[r.pais || 'ES'] ||= new Set()).add(r.indicador); });
    for (const [pais, ids] of Object.entries(grupos)) {
      const s = await series([...ids], { paises: [pais], desde });
      for (const ind of ids) historicos[`${ind}|${pais}`] = s[ind]?.[pais] || [];
    }
  }
  if (!ctx.vigente()) return;
  let pestana = 'datos';

  nodo.innerHTML = `
    <header class="cabecera"><span class="etiqueta"><a href="#/fichas">Fichas de investigación</a> · ${todos.length} recursos</span>
      <h1><span class="degradado">${esc(f.titulo)}</span></h1>
      ${f.pregunta ? `<p class="pregunta">❓ ${esc(f.pregunta)}</p>` : ''}
      ${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ''}
    </header>
    <div class="ficha-barra card">
      <form class="anadir">
        <select name="recurso" aria-label="Añadir un recurso"><option value="">Añadir un recurso de la biblioteca…</option>
          ${t.recursos.filter((r) => !porId.has(r.id)).map((r) => `<option value="${esc(r.id)}">${esc(t.tipos[r.tipo].nombre)} · ${esc(r.titulo)}</option>`).join('')}</select>
        <button class="btn" type="submit">Añadir</button>
        <button class="btn" type="button" data-crear>+ Crear y añadir</button>
      </form>
      <div class="ficha-acciones">
        <button class="btn primario" data-bibliografia>❝ Copiar bibliografía (${todos.length})</button>
        <button class="btn" data-editar>Editar ficha</button>
        <button class="btn peligro" data-borrar>Borrar</button>
      </div>
    </div>
    <div class="pestanas" role="tablist">${COLUMNAS.map((c) => `<button role="tab" data-pestana="${c.clave}" class="${c.clave === pestana ? 'on' : ''}">${c.icono} ${c.titulo} <i>${f[c.clave].length}</i></button>`).join('')}</div>
    <div class="workspace" data-activa="${pestana}">${COLUMNAS.map((c) => `
      <section class="columna col-${c.clave}" data-col="${c.clave}">
        <header><h3>${c.icono} ${c.titulo} <i>${f[c.clave].length}</i></h3><p>${c.sub}</p></header>
        ${f[c.clave].map((r) => tarjeta(r, historicos)).join('') || '<p class="vacio-col">Todavía nada. Añade un recurso desde arriba.</p>'}
      </section>`).join('')}</div>`;

  nodo.querySelectorAll('.item-ficha').forEach((el) => {
    const r = porId.get(el.dataset.id);
    const g = el.querySelector('[data-grafico]');
    // Plotly necesita que el gráfico ya esté en pantalla para saber su ancho.
    let intentos = 0; // si se sale de la página antes de que aparezca, se deja de esperar
    const cuandoVisible = () => (g.isConnected && g.clientWidth ? graficoPrediccion(g, r, historicos[`${r.indicador}|${r.pais || 'ES'}`])
      : ++intentos < 300 && requestAnimationFrame(cuandoVisible));
    if (g) cuandoVisible();
  });
  activarCitas(nodo, (rid) => porId.get(rid));
  const recargar = () => workspace(nodo, ctx, id);
  nodo.onclick = async (e) => { // onclick (y no addEventListener) para no duplicarlo al recargar
    const a = e.target.closest('[data-abrir]');
    if (a) abrirRecurso(a.dataset.abrir, recargar);
    const q = e.target.closest('[data-quitar]');
    if (q) {
      await post('inv/ficha/quitar', { ficha: id, recurso: q.dataset.quitar });
      avisar('Quitado de la ficha', 'info', 1800);
      recargar();
    }
    const p = e.target.closest('[data-pestana]');
    if (p) {
      pestana = p.dataset.pestana;
      nodo.querySelector('.workspace').dataset.activa = pestana;
      nodo.querySelectorAll('[data-pestana]').forEach((b) => b.classList.toggle('on', b === p));
    }
  };
  nodo.querySelector('.anadir').addEventListener('submit', async (e) => {
    e.preventDefault();
    const recurso = new FormData(e.target).get('recurso');
    if (!recurso) return;
    await post('inv/ficha/anadir', { ficha: id, recurso });
    avisar('Añadido a la ficha ✓', 'ok', 1800);
    recargar();
  });
  nodo.querySelector('[data-crear]').addEventListener('click', () => editarRecurso(null, async (r) => {
    await post('inv/ficha/anadir', { ficha: id, recurso: r.id });
    recargar();
    abrirRecurso(r.id, recargar);
  }));
  nodo.querySelector('[data-bibliografia]').addEventListener('click', () => {
    const refs = [...new Set(todos.map((r) => r.citas.apa))].sort((a, b) => a.localeCompare(b, 'es'));
    copiar(`Referencias\n\n${refs.join('\n\n')}`, `Bibliografía (${refs.length} referencias)`);
  });
  nodo.querySelector('[data-editar]').addEventListener('click', async () => {
    const titulo = prompt('Título de la ficha', f.titulo);
    if (titulo == null) return;
    const pregunta = prompt('Pregunta de investigación', f.pregunta) ?? f.pregunta;
    const descripcion = prompt('Descripción', f.descripcion) ?? f.descripcion;
    await post('inv/ficha', { id, titulo, pregunta, descripcion });
    recargar();
  });
  nodo.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!confirm(`¿Borrar la ficha «${f.titulo}»? Los recursos no se borran, solo la ficha.`)) return;
    await post('inv/ficha/eliminar', { id });
    avisar('Ficha borrada', 'info');
    location.hash = '#/fichas';
  });
}

export default {
  titulo: 'Fichas de investigación',
  async render(nodo, ctx) {
    nodo.classList.add('rejilla');
    if (ctx.parametro) await workspace(nodo, ctx, decodeURIComponent(ctx.parametro));
    else await lista(nodo, ctx);
  },
};
