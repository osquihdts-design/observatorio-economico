// Previsiones oficiales (BCE, Banco de España…) dibujadas sobre los gráficos como rombos con línea punteada.
// Son medias anuales: se colocan a mitad de cada año (1 de julio) para que se lean junto a los datos mensuales.
import { get } from './api.js';
import { COLORES } from './graficos.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
let promesa = null;
let activas = true;

export const ponerPrevisiones = (v) => { activas = v; };
export const cargarPrevisiones = () => (promesa ||= get('previsiones').then((r) => r.previsiones || []).catch(() => []));

/** Trazas de las previsiones de un indicador para los países que se ven en el gráfico. */
export async function trazasPrevision(indicador, paises, sufijo = ' %') {
  if (!activas) return [];
  const lista = await cargarPrevisiones();
  return lista.filter((p) => p.valores[indicador] && paises.includes(p.pais)).map((p) => {
    const anios = Object.keys(p.valores[indicador]).sort();
    const [a, m] = p.fecha.split('-');
    const cuando = `${MESES[Number(m) - 1]} ${a}`;
    const color = COLORES[p.pais] || '#94a3b8';
    const nombre = `Previsión ${p.organismo} (${cuando})`;
    return {
      x: anios.map((anio) => `${anio}-07-01`),
      y: anios.map((anio) => p.valores[indicador][anio]),
      customdata: anios,
      type: 'scatter', mode: 'lines+markers', name: nombre,
      line: { color, width: 1.6, dash: 'dot' },
      marker: { symbol: 'diamond-open', size: 10, color, line: { width: 2, color } },
      hovertemplate: `%{y:.1f}${sufijo}<extra>${nombre} · media de %{customdata}</extra>`,
    };
  });
}

export const NOTA_PREVISIONES = 'Rombos: previsiones oficiales (media anual) del BCE para la zona euro y del Banco de España para España.';
