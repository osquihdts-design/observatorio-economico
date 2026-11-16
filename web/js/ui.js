// Pequeñas utilidades de interfaz compartidas por todas las páginas.

/** Muestra (o quita, si `texto` está vacío) el aviso de la parte superior. */
export function aviso(texto) {
  const el = document.querySelector('#aviso');
  el.textContent = texto || '';
  el.hidden = !texto;
}
