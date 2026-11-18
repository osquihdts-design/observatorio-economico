// Centro de mando de la investigación: volumen por categorías, últimas fuentes oficiales,
// predicciones activas, fichas y sincronización con Obsidian.
import { get, post } from '../api.js';
import { avisar } from '../efectos.js';
import {
  abrirRecurso, activarCitas, botonCita, cargarTaxonomia, chipFuente, confianza, editarRecurso, esc, fecha, insignia, valorClave,
} from '../investigacion.js';

const ICONOS = { macro: '◎', mercados: '⇅', corporativas: '▤', sectores: '⬡', riesgo: '⚠' };
const NOMBRE_FUENTE = { INE: 'INE', EUROSTAT: 'Eurostat', BCE: 'BCE' };

function irABiblioteca(filtros) {
  try { sessionStorage.setItem('inv:filtros', JSON.stringify(filtros)); } catch { /* sin almacenamiento */ }
  location.hash = '#/biblioteca';
}

function filaRecurso(r) {
  const v = valorClave(r);
  return `<li class="fila-recurso" data-abrir="${esc(r.id)}">
    <div class="fila-principal">${insignia(r)} ${chipFuente(r)}<b>${esc(r.titulo)}</b></div>
    <div class="fila-dato">${v ? `<strong class="${v.vivo ? 'vivo' : ''}">${esc(v.valor)}</strong><small>${esc(v.nota)}</small>` : `<small>${fecha(r.fecha)}</small>`}</div>
    ${botonCita(r, 'compacto')}
  </li>`;
}

function tarjetaPrediccion(r) {
  const v = valorClave(r);
  return `<article class="prediccion" data-abrir="${esc(r.id)}">
    <div class="prediccion-cabeza">${insignia(r)} ${r.horizonte ? `<span class="horizonte">→ ${esc(r.horizonte)}</span>` : ''}</div>
    <h4>${esc(r.titulo.replace(/^Predicción propia:\s*/i, ''))}</h4>
    ${v ? `<div class="prediccion-dato"><strong>${esc(v.valor)}</strong><small>${esc(v.nota)}</small></div>` : ''}
    <div class="prediccion-pie">${chipFuente(r)} ${confianza(r.confianza)} <span class="estado est-${r.estado}">${r.estado}</span></div>
  </article>`;
}

export default {
  titulo: 'Centro de mando',
  async render(nodo, ctx) {
    const [res] = await Promise.all([get('inv/resumen'), cargarTaxonomia(true)]);
    const obs = await get('inv/obsidian');
    if (!ctx.vigente()) return;
    const recursos = new Map([...res.ultimas, ...res.predicciones].map((r) => [r.id, r]));
    const externos = Object.entries(res.tipos).filter(([t]) => ['dato', 'informe', 'proyeccion'].includes(t)).reduce((s, [, n]) => s + n, 0);
    const activas = res.predicciones.filter((p) => p.tipo === 'prediccion').length;
    const maxCat = Math.max(1, ...res.categorias.map((c) => c.total));

    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Centro de investigación · fuentes oficiales + análisis propios</span>
        <h1>Centro de <span class="degradado">mando</span></h1>
        <p>Guarda, cruza y cita datos oficiales, marcos teóricos y predicciones propias. Todo se sincroniza con tu bóveda de Obsidian.</p></header>

      <form class="buscador-grande" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" name="q" placeholder="Busca en tu investigación: «euríbor», «DCF», «proyecciones BCE»…" aria-label="Buscar en la investigación">
        <button class="btn primario" type="submit">Buscar</button>
      </form>

      <div class="kpis kpis-inv">
        <div class="kpi"><div class="nombre">Recursos</div><div class="valor"><span data-contar="${res.total}">${res.total}</span></div><div class="linea">en ${res.categorias.filter((c) => c.total).length} categorías</div></div>
        <div class="kpi"><div class="nombre">Fuentes secundarias</div><div class="valor"><span data-contar="${externos}">${externos}</span></div><div class="linea">datos, informes y proyecciones</div></div>
        <div class="kpi"><div class="nombre">Producción propia</div><div class="valor"><span data-contar="${res.total - externos}">${res.total - externos}</span></div><div class="linea">teoría, análisis y predicciones</div></div>
        <div class="kpi"><div class="nombre">Predicciones activas</div><div class="valor"><span data-contar="${activas}">${activas}</span></div><div class="linea">con horizonte y criterio de acierto</div></div>
        <div class="kpi"><div class="nombre">Fichas</div><div class="valor"><span data-contar="${res.fichas.length}">${res.fichas.length}</span></div><div class="linea">temas de investigación</div></div>
      </div>

      <section class="card">
        <div class="card-head"><div><h2>Recursos por categoría</h2><p class="sub">Pulsa una categoría o subcategoría para verla en la biblioteca. Barra: azul = fuentes secundarias · violeta = producción propia.</p></div>
          <div class="acciones"><button data-nuevo>+ Nuevo recurso</button></div></div>
        <div class="categorias-grid">${res.categorias.map((c) => `
          <button class="cat-tarjeta" data-categoria="${c.id}">
            <span class="cat-icono">${ICONOS[c.id]}</span>
            <span class="cat-nombre">${esc(c.nombre)}</span>
            <span class="cat-total"><span data-contar="${c.total}">${c.total}</span></span>
            <span class="cat-barra"><i style="width:${(100 * c.externos) / maxCat}%"></i><i class="int" style="width:${(100 * c.internos) / maxCat}%"></i></span>
            <span class="cat-sub">${Object.entries(c.sub).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, k]) => `<em>${esc(n)} ${k}</em>`).join('') || '<em>Sin recursos todavía</em>'}</span>
          </button>`).join('')}</div>
      </section>

      <div class="dos-columnas">
        <section class="card">
          <div class="card-head"><div><h2>Últimas fuentes oficiales</h2><p class="sub">Los datos enlazados a una serie del panel muestran siempre el último valor publicado.</p></div></div>
          <ul class="lista-recursos">${res.ultimas.map(filaRecurso).join('')}</ul>
          <div class="semaforos">${Object.entries(res.fuentes_panel).map(([f, s]) => `<span><i class="luz ${s.semaforo}"></i>${NOMBRE_FUENTE[f]}: ${esc(s.mensaje)}</span>`).join('')}</div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Modelos predictivos y proyecciones</h2><p class="sub">Predicciones propias activas y proyecciones oficiales de referencia.</p></div></div>
          <div class="predicciones">${res.predicciones.map(tarjetaPrediccion).join('') || '<p class="sub">No hay predicciones activas.</p>'}</div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><div><h2>Fichas de investigación</h2><p class="sub">Cada ficha junta, en tres columnas, los datos oficiales, la teoría y las conclusiones sobre una pregunta.</p></div>
          <div class="acciones"><a class="btn" href="#/fichas">Ver todas</a></div></div>
        <div class="fichas-grid">${res.fichas.map((f) => `
          <a class="ficha-tarjeta" href="#/fichas/${esc(f.id)}">
            <b>${esc(f.titulo)}</b><p>${esc(f.pregunta)}</p>
            <span class="ficha-cuentas"><i class="c-dat">${f.n_datos || 0} datos</i><i class="c-teo">${f.n_teoria || 0} teoría</i><i class="c-pre">${f.n_predicciones || 0} predicciones</i></span>
          </a>`).join('')}</div>
      </section>

      <section class="card obsidian">
        <div class="card-head"><div><h2><span class="logo-obsidian">◆</span> Obsidian</h2>
          <p class="sub">Cada recurso se guarda como una nota en <code>${esc(obs.ruta)}\\Observatorio</code>, con propiedades, enlaces [[…]] y una tabla de Bases.
          Lo que edites allí vuelve al panel al sincronizar.</p></div>
          <div class="acciones"><button class="btn primario" data-sincronizar ${obs.existe ? '' : 'disabled'}>⟳ Sincronizar con Obsidian</button></div></div>
        <div class="obsidian-estado">
          <span><i class="luz ${obs.es_boveda ? 'verde' : obs.existe ? 'ambar' : 'rojo'}"></i>${obs.es_boveda ? 'Bóveda de Obsidian encontrada' : obs.existe ? 'La carpeta existe, pero no parece una bóveda (falta .obsidian)' : 'No encuentro la carpeta'}</span>
          <span data-ultima>${obs.ultima ? `Última sincronización: ${new Date(obs.ultima).toLocaleString('es-ES')}` : 'Todavía no se ha sincronizado'}</span>
        </div>
        <form class="ruta-obsidian"><input type="text" name="ruta" value="${esc(obs.ruta)}" aria-label="Carpeta de la bóveda"><button class="btn" type="submit">Cambiar carpeta</button></form>
      </section>`;

    activarCitas(nodo, (id) => recursos.get(id));
    nodo.querySelector('.buscador-grande').addEventListener('submit', (e) => {
      e.preventDefault();
      irABiblioteca({ q: new FormData(e.target).get('q') });
    });
    nodo.querySelectorAll('[data-categoria]').forEach((b) => b.addEventListener('click', () => irABiblioteca({ categorias: [b.dataset.categoria] })));
    nodo.querySelectorAll('[data-abrir]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('[data-citar]')) return;
      abrirRecurso(el.dataset.abrir, () => this.render(nodo, ctx));
    }));
    nodo.querySelector('[data-nuevo]').addEventListener('click', () => editarRecurso(null, (r) => { location.hash = `#/biblioteca/${r.id}`; }));
    nodo.querySelector('[data-sincronizar]').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true; b.textContent = 'Sincronizando…';
      try {
        const inf = await post('inv/obsidian/sincronizar', {});
        avisar(`Obsidian: ${inf.escritas} notas escritas · ${inf.nuevas.length} nuevas y ${inf.actualizadas.length} actualizadas desde Obsidian`, 'ok', 6000);
        if (inf.errores.length) avisar(`Avisos: ${inf.errores.join(' · ')}`, 'error', 9000);
        nodo.querySelector('[data-ultima]').textContent = `Última sincronización: ${new Date().toLocaleString('es-ES')}`;
      } catch (err) {
        avisar(err.message, 'error', 7000);
      }
      b.disabled = false; b.textContent = '⟳ Sincronizar con Obsidian';
    });
    nodo.querySelector('.ruta-obsidian').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await post('inv/obsidian/ruta', { ruta: new FormData(e.target).get('ruta') });
        avisar('Carpeta de Obsidian guardada ✓', 'ok');
        this.render(nodo, ctx);
      } catch (err) { avisar(err.message, 'error', 6000); }
    });
    nodo.classList.add('rejilla');
  },
};
