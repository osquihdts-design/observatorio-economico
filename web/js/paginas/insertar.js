// Generador de gráficos para insertar en otras webs (blogs, apuntes, Notion, Moodle…).
import { copiar, esc } from '../investigacion.js';
import { WEB_PUBLICA } from './sobre.js';

const PRINCIPALES = ['ES', 'EA', 'DE', 'FR', 'IT', 'PT'];

export default {
  titulo: 'Insertar gráficos',
  render(nodo, ctx) {
    nodo.className = 'rejilla';
    const indicadores = ctx.catalogo.indicadores.filter((i) => i.paises.length);
    const anioActual = new Date().getFullYear();
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Compartir · CC BY 4.0</span>
        <h1>Insertar <span class="degradado">gráficos</span> en tu web</h1>
        <p>Elige un indicador y copia el código: el gráfico se verá en tu blog, tus apuntes, Notion o el aula virtual, y se actualizará solo
        cada día con los datos oficiales. Puedes usarlo libremente citando la fuente (el propio gráfico lleva el enlace).</p></header>
      <section class="card">
        <form class="form insertar-form">
          <label>Indicador<select name="i">${indicadores.map((i) => `<option value="${i.id}" ${i.id === 'paro' ? 'selected' : ''}>${esc(i.nombre)}</option>`).join('')}</select></label>
          <label>Desde<select name="d">${Array.from({ length: anioActual - 1999 }, (_, k) => anioActual - k)
            .map((a) => `<option value="${a}" ${a === 2015 ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
          <label>Tema<select name="t"><option value="claro">Claro</option><option value="oscuro">Oscuro</option></select></label>
          <label>Alto (px)<input type="number" name="alto" value="420" min="260" max="900" step="20"></label>
          <label class="check"><input type="checkbox" name="prev" checked> Previsiones oficiales</label>
          <label class="check"><input type="checkbox" name="ev" checked> Recesiones y acontecimientos</label>
        </form>
        <div class="paises-insertar" data-paises></div>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>Vista previa</h2><p class="sub">Así se verá en tu web.</p></div>
          <div class="acciones"><a class="btn" data-abrir target="_blank" rel="noopener">Abrir en otra pestaña ↗</a></div></div>
        <iframe class="vista-insertar" title="Vista previa del gráfico" loading="lazy"></iframe>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>Código para pegar</h2><p class="sub">Pégalo en el editor HTML de tu web (en WordPress: bloque «HTML personalizado»).</p></div>
          <div class="acciones"><button class="btn primario" data-copiar>Copiar código</button></div></div>
        <textarea class="codigo-insertar" rows="4" readonly></textarea>
        <p class="fuente-nota">¿Solo quieres el enlace? <button class="enlace" data-copiar-enlace>Copiar el enlace al gráfico</button></p>
      </section>`;

    const form = nodo.querySelector('.insertar-form');
    const cajaPaises = nodo.querySelector('[data-paises]');
    let elegidos = ['ES', 'EA'];

    function pintarPaises() {
      const ind = indicadores.find((i) => i.id === form.i.value);
      const disponibles = [...PRINCIPALES.filter((p) => ind.paises.includes(p)), ...ind.paises.filter((p) => !PRINCIPALES.includes(p)).sort()];
      elegidos = elegidos.filter((p) => disponibles.includes(p));
      if (!elegidos.length) elegidos = [disponibles[0]];
      cajaPaises.innerHTML = `<span class="sub">Países (hasta 10):</span>${disponibles.map((p) => `<label class="check"><input type="checkbox" value="${p}" ${elegidos.includes(p) ? 'checked' : ''}>${esc(ctx.nombrePais(p))}</label>`).join('')}`;
    }

    function consulta() {
      const q = new URLSearchParams({ i: form.i.value, p: elegidos.join(','), d: form.d.value, t: form.t.value });
      if (form.prev.checked) q.set('prev', '1');
      if (!form.ev.checked) q.set('ev', '0');
      return q.toString().replace(/%2C/g, ',');
    }

    let espera = null;
    function actualizar() {
      const q = consulta();
      const alto = Math.max(260, Math.min(900, Number(form.alto.value) || 420));
      const nombre = form.i.selectedOptions[0].textContent;
      const url = `${WEB_PUBLICA}embed.html?${q}`;
      nodo.querySelector('.codigo-insertar').value =
        `<iframe src="${url}" width="100%" height="${alto}" style="border:0;max-width:900px" loading="lazy" title="${nombre.replace(/"/g, '&quot;')} · Observatorio económico"></iframe>`;
      nodo.querySelector('[data-abrir]').href = `embed.html?${q}`;
      const vista = nodo.querySelector('.vista-insertar');
      vista.style.height = `${alto}px`;
      clearTimeout(espera);
      espera = setTimeout(() => { vista.src = `embed.html?${q}`; }, 250); // la vista previa usa esta misma web (local o pública)
      nodo.querySelector('[data-copiar-enlace]').onclick = () => copiar(url, 'Enlace al gráfico');
    }

    form.addEventListener('change', (e) => { if (e.target.name === 'i') pintarPaises(); actualizar(); });
    form.addEventListener('input', (e) => { if (e.target.name === 'alto') actualizar(); });
    cajaPaises.addEventListener('change', (e) => {
      const v = e.target.value;
      if (e.target.checked && elegidos.length >= 10) { e.target.checked = false; return; }
      elegidos = e.target.checked ? [...elegidos, v] : elegidos.filter((p) => p !== v);
      if (!elegidos.length) { elegidos = [v]; e.target.checked = true; }
      actualizar();
    });
    nodo.querySelector('[data-copiar]').addEventListener('click', () => copiar(nodo.querySelector('.codigo-insertar').value, 'Código del gráfico'));
    pintarPaises();
    actualizar();
  },
};
