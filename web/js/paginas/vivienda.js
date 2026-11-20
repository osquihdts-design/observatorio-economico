// Módulo 4: vivienda y salarios.
import { series } from '../api.js';
import { aTabla, COLORES, dibujar, linea, referencia, tarjeta, eje } from '../graficos.js';

/** Reescala una serie para que la media de 2015 valga 100. */
function base2015(puntos) {
  const valores = puntos.filter(([f]) => f.startsWith('2015')).map((p) => p[1]);
  if (!valores.length) return [];
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  return puntos.map(([f, v]) => [f, (v / media) * 100]);
}

/** Media móvil de los últimos n datos (quita la estacionalidad de las pagas extra). */
function mediaMovil(puntos, n) {
  return puntos.slice(n - 1).map((p, i) => [p[0], puntos.slice(i, i + n).reduce((a, q) => a + q[1], 0) / n]);
}

const enRango = (puntos, ctx) => puntos.filter(([f]) => (!ctx.desde || f >= ctx.desde) && (!ctx.hasta || f <= ctx.hasta));

export default {
  titulo: 'Vivienda y salarios',
  async render(nodo, ctx) {
    const [todo, europa] = await Promise.all([
      series(['ipv_general', 'ipv_nueva', 'ipv_segunda_mano', 'precio_vivienda_indice', 'etcl_coste_salarial'], { paises: ['ES'] }),
      series(['precio_vivienda_var'], { paises: ctx.paises, desde: ctx.desde, hasta: ctx.hasta }),
    ]);
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><span class="etiqueta">INE · Eurostat</span><h1>Vivienda y <span class="degradado">salarios</span></h1>
      <p>La evolución del precio de la vivienda en España según el INE y Eurostat, y si los salarios suben al mismo ritmo.</p></header>`;

    // 1. Índices de precios de vivienda (base 2015 = 100)
    const general = base2015(todo.ipv_general?.ES || []);
    const nueva = base2015(todo.ipv_nueva?.ES || []);
    const segunda = base2015(todo.ipv_segunda_mano?.ES || []);
    const eurostat = todo.precio_vivienda_indice?.ES || [];
    const t1 = tarjeta({ titulo: 'Precio de la vivienda en España', sub: 'Índices con base 2015 = 100.', fuente: 'INE (IPV1209, IPV1613, IPV1618) y Eurostat (prc_hpi_q)', clave: 'vivienda' });
    nodo.appendChild(t1.el);
    const series1 = { 'IPV general (INE)': enRango(general, ctx), 'Vivienda nueva (INE)': enRango(nueva, ctx), 'Segunda mano (INE)': enRango(segunda, ctx), 'Eurostat HPI': enRango(eurostat, ctx) };
    dibujar(t1.grafico, [
      linea('IPV general (INE)', series1['IPV general (INE)'], '#C8102E', { line: { width: 2.8 } }),
      linea('Vivienda nueva (INE)', series1['Vivienda nueva (INE)'], '#E9A23B'),
      linea('Segunda mano (INE)', series1['Segunda mano (INE)'], '#2A9D8F'),
      linea('Eurostat (índice armonizado)', series1['Eurostat HPI'], '#003399', { line: { dash: 'dot' } }),
    ], { ...referencia(100, 'Media de 2015'), yaxis: eje('Índice (2015 = 100)') });
    t1.setDatos(aTabla(series1));

    // 2. Índice de esfuerzo
    const salario = base2015(mediaMovil(todo.etcl_coste_salarial?.ES || [], 4));
    const mapaSalario = new Map(salario);
    const esfuerzo = general.filter(([f]) => mapaSalario.has(f)).map(([f, v]) => [f, (v / mapaSalario.get(f)) * 100]);
    const t2 = tarjeta({ titulo: 'Índice de esfuerzo: vivienda frente a salarios', sub: 'Por encima de 100, la vivienda se ha encarecido más que los salarios desde 2015.', fuente: 'INE (IPV1209 y ETCL1527, coste salarial por trabajador y mes)', clave: 'esfuerzo' });
    nodo.appendChild(t2.el);
    const s2 = { 'Precio vivienda (2015=100)': enRango(general, ctx), 'Salario (2015=100, media 4 trim.)': enRango(salario, ctx), 'Índice de esfuerzo': enRango(esfuerzo, ctx) };
    dibujar(t2.grafico, [
      linea('Precio de la vivienda', s2['Precio vivienda (2015=100)'], '#C8102E', { line: { width: 1.6, dash: 'dot' } }),
      linea('Salario', s2['Salario (2015=100, media 4 trim.)'], '#2A9D8F', { line: { width: 1.6, dash: 'dot' } }),
      linea('Índice de esfuerzo', s2['Índice de esfuerzo'], '#003399', { line: { width: 3 } }),
    ], { ...referencia(100, '2015 = 100'), yaxis: eje('Índice (2015 = 100)') });
    t2.setDatos(aTabla(s2));

    // 3. Comparativa europea
    const t3 = tarjeta({ titulo: 'Precio de la vivienda en Europa', sub: 'Variación anual en %.', fuente: 'Eurostat (prc_hpi_q)', alto: 'bajo' });
    nodo.appendChild(t3.el);
    const d = europa.precio_vivienda_var || {};
    const orden = ctx.paises.filter((p) => d[p]);
    dibujar(t3.grafico, orden.map((p) => linea(ctx.nombrePais(p), d[p], COLORES[p], { sufijo: ' %', line: { width: p === 'ES' || p === 'EA' ? 2.8 : 1.8 } })),
      { yaxis: eje('Variación anual (%)', ' %') });
    t3.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${ctx.nombrePais(p)} (%)`, d[p]]))));
  },
};
