// Paleta de comandos (Ctrl+K o /) y atajos de teclado.
// La paleta busca entre páginas, indicadores, países, periodos y acciones, sin importar tildes ni mayúsculas.

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Puntuación sencilla: coincidencia al principio > dentro de una palabra > letras en orden. */
function puntuar(texto, consulta) {
  if (!consulta) return 1;
  const t = normalizar(texto), q = normalizar(consulta);
  const i = t.indexOf(q);
  if (i === 0) return 100;
  if (i > 0) return t[i - 1] === ' ' ? 80 : 60;
  let j = 0;
  for (const c of t) if (c === q[j]) j += 1;
  return j === q.length ? 20 : 0;
}

function resaltar(texto, consulta) {
  if (!consulta) return texto;
  const i = normalizar(texto).indexOf(normalizar(consulta));
  if (i < 0) return texto;
  return `${texto.slice(0, i)}<mark>${texto.slice(i, i + consulta.length)}</mark>${texto.slice(i + consulta.length)}`;
}

export function iniciarPaleta(obtenerComandos) {
  const capa = document.getElementById('paleta');
  const entrada = document.getElementById('paleta-texto');
  const lista = document.getElementById('paleta-lista');
  let visibles = [];
  let activa = 0;
  let anterior = null;

  function pintar() {
    const q = entrada.value.trim();
    visibles = obtenerComandos()
      // Con varias palabras, todas deben aparecer (en el título o en las claves); manda la peor coincidencia.
      .map((c) => ({ ...c, nota: Math.min(...(q.split(/\s+/).filter(Boolean).length ? q.split(/\s+/).filter(Boolean) : [''])
        .map((w) => Math.max(puntuar(c.titulo, w), puntuar(c.claves || '', w) * 0.8, puntuar(`${c.titulo} ${c.claves || ''}`, w) * 0.5))) }))
      .filter((c) => c.nota > 0)
      .sort((a, b) => b.nota - a.nota || a.orden - b.orden)
      .slice(0, 40);
    activa = Math.min(activa, Math.max(0, visibles.length - 1));
    lista.innerHTML = visibles.length
      ? visibles.map((c, i) => `<li role="option" data-i="${i}" class="${i === activa ? 'activa' : ''}" aria-selected="${i === activa}">
          <span class="ico">${c.icono}</span>
          <span class="txt">${resaltar(c.titulo, q)}${c.detalle ? `<small>${c.detalle}</small>` : ''}</span>
          <span class="tipo">${c.tipo}</span></li>`).join('')
      : '<li class="vacio">Nada coincide. Prueba con «paro», «mapa» o «tema».</li>';
    lista.querySelector('.activa')?.scrollIntoView({ block: 'nearest' });
  }

  function ejecutar(i) {
    const c = visibles[i];
    if (!c) return;
    cerrar();
    c.accion();
  }

  function abrir() {
    anterior = document.activeElement;
    capa.hidden = false;
    entrada.value = '';
    activa = 0;
    pintar();
    entrada.focus();
  }

  function cerrar() {
    capa.hidden = true;
    anterior?.focus?.();
  }

  entrada.addEventListener('input', () => { activa = 0; pintar(); });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { activa = (activa + 1) % Math.max(1, visibles.length); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { activa = (activa - 1 + visibles.length) % Math.max(1, visibles.length); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { ejecutar(activa); e.preventDefault(); }
    else if (e.key === 'Escape') { cerrar(); e.preventDefault(); }
  });
  lista.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) ejecutar(Number(li.dataset.i));
  });
  lista.addEventListener('mousemove', (e) => {
    const li = e.target.closest('[data-i]');
    if (li && Number(li.dataset.i) !== activa) { activa = Number(li.dataset.i); pintar(); }
  });
  capa.addEventListener('click', (e) => { if (e.target === capa) cerrar(); });

  return { abrir, cerrar };
}

/** Atajos de teclado globales. `acciones` = {paleta, pagina(n), academico, tema, actualizar, ayuda, cerrar}. */
export function iniciarAtajos(acciones) {
  document.addEventListener('keydown', (e) => {
    const escribiendo = e.target.closest?.('input, textarea, select, [contenteditable]');
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); acciones.paleta(); return; }
    if (e.key === 'Escape') { acciones.cerrar(); return; }
    if (escribiendo || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); acciones.paleta(); }
    else if (/^[0-9]$/.test(e.key)) acciones.pagina(e.key === '0' ? 9 : Number(e.key) - 1);
    else if (e.key.toLowerCase() === 'a') acciones.academico();
    else if (e.key.toLowerCase() === 't') acciones.tema();
    else if (e.key.toLowerCase() === 'u') acciones.actualizar();
    else if (e.key === '?') acciones.ayuda();
  });
}
