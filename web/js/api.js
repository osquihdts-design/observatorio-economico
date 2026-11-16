// Llamadas al servidor de Python.

async function respuesta(r) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

export const get = (ruta) => fetch(`/api/${ruta}`).then(respuesta);

export const post = (ruta, cuerpo) =>
  fetch(`/api/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(respuesta);

/** Pide varias series: devuelve {indicador: {país: [[fecha, valor], …]}} */
export function series(ids, { paises = null, desde = null, hasta = null } = {}) {
  const q = new URLSearchParams({ ids: ids.join(',') });
  if (paises) q.set('paises', paises.join(','));
  if (desde) q.set('desde', desde);
  if (hasta) q.set('hasta', hasta);
  return get(`series?${q}`);
}

/** Descarga un archivo generado por el servidor (por ejemplo, el Excel del laboratorio). */
export async function descargarArchivo(ruta, cuerpo, nombre) {
  const r = await fetch(`/api/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `Error ${r.status}`);
  }
  guardarBlob(await r.blob(), nombre);
}

export function guardarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
