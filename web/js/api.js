// Llamadas al servidor de Python.
//
// Versión pública (GitHub Pages): no hay servidor, así que los datos se leen de archivos JSON
// generados cada día por scripts/publicar_web.py. Se reconoce por <meta name="observatorio-modo" content="estatico">.

export const ESTATICO = document.querySelector('meta[name="observatorio-modo"]')?.content === 'estatico';
export const REPOSITORIO = 'https://github.com/osquihdts-design/observatorio-economico';

async function respuesta(r) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j;
}

const SOLO_LOCAL = 'Esta función necesita el servidor de Python: descarga el proyecto y ábrelo en tu ordenador.';

// ---------------------------------------------------------------- Versión estática
const cache = new Map();
function leerJSON(ruta) {
  if (!cache.has(ruta)) {
    cache.set(ruta, fetch(ruta).then((r) => {
      if (!r.ok) throw new Error(`No se encontró ${ruta}`);
      return r.json();
    }).catch((e) => { cache.delete(ruta); throw e; }));
  }
  return cache.get(ruta);
}

async function seriesEstaticas(ids, { paises = null, desde = null, hasta = null }) {
  const resultado = {};
  await Promise.all(ids.map(async (id) => {
    const todas = await leerJSON(`api/series/${id}.json`).catch(() => ({}));
    const salida = {};
    for (const [pais, puntos] of Object.entries(todas)) {
      if (paises && !paises.includes(pais)) continue;
      const filtrados = puntos.filter(([f]) => (!desde || f >= desde) && (!hasta || f <= hasta));
      if (filtrados.length) salida[pais] = filtrados;
    }
    resultado[id] = salida;
  }));
  return resultado;
}

/** Nube de puntos X–Y con una recta MCO por periodo (lo mismo que /api/lab/dispersion, para niveles). */
async function dispersionEstatica(c) {
  const datos = await seriesEstaticas([c.x.indicador, c.y.indicador], { paises: [c.x.pais, c.y.pais], desde: c.desde, hasta: c.hasta });
  const sx = new Map(datos[c.x.indicador]?.[c.x.pais] || []);
  const sy = new Map(datos[c.y.indicador]?.[c.y.pais] || []);
  const fechas = [...sx.keys()].filter((f) => sy.has(f)).sort();
  const periodos = c.periodos || [{ nombre: 'Todo', desde: '0000', hasta: '9999' }];
  const puntos = [], rectas = [];
  for (const p of periodos) {
    const fs = fechas.filter((f) => p.desde <= f && f <= p.hasta);
    const xs = fs.map((f) => sx.get(f)), ys = fs.map((f) => sy.get(f));
    fs.forEach((f, i) => puntos.push([f, xs[i], ys[i], p.nombre]));
    if (fs.length < 8 || new Set(xs).size < 2) continue;
    const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let sxy = 0, sxx = 0, syy = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
    const pendiente = sxy / sxx;
    rectas.push({ periodo: p.nombre, constante: my - pendiente * mx, pendiente, r2: syy ? (sxy * sxy) / (sxx * syy) : 0,
      n, x_min: Math.min(...xs), x_max: Math.max(...xs) });
  }
  return { x: c.x.indicador, y: c.y.indicador, puntos, rectas };
}

// ---------------------------------------------------------------- API
export const get = (ruta) => (ESTATICO ? leerJSON(`api/${ruta}.json`) : fetch(`/api/${ruta}`).then(respuesta));

export function post(ruta, cuerpo) {
  if (ESTATICO) {
    if (ruta === 'lab/dispersion') return dispersionEstatica(cuerpo);
    return Promise.reject(new Error(SOLO_LOCAL));
  }
  return fetch(`/api/${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) }).then(respuesta);
}

/** Pide varias series: devuelve {indicador: {país: [[fecha, valor], …]}} */
export function series(ids, { paises = null, desde = null, hasta = null } = {}) {
  if (ESTATICO) return seriesEstaticas(ids, { paises, desde, hasta });
  const q = new URLSearchParams({ ids: ids.join(',') });
  if (paises) q.set('paises', paises.join(','));
  if (desde) q.set('desde', desde);
  if (hasta) q.set('hasta', hasta);
  return get(`series?${q}`);
}

/** Descarga un archivo generado por el servidor (por ejemplo, el Excel del laboratorio). */
export async function descargarArchivo(ruta, cuerpo, nombre) {
  if (ESTATICO) throw new Error(SOLO_LOCAL);
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
