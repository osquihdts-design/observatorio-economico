// Portada: héroe con el radar de posición europea, tarjetas con los últimos datos (con números que cuentan),
// divergencia España–zona euro y una tabla de todos los indicadores que se puede ordenar y filtrar.
import { get, series } from '../api.js';
import { COLORES, descargarCSV, dibujar, fechaTexto, fmt, layout, sparkline, tarjeta, tono } from '../graficos.js';
import { explicacion } from '../academico.js';

// sentido: 1 = que suba es bueno · -1 = que suba es malo · 0 = neutro · 'objetivo' = mejor cuanto más cerca del 2 %
const KPIS = [
  { id: 'ipc_general', pais: 'ES', titulo: 'Inflación (IPC)', ref: { id: 'iapc_general', pais: 'EA', texto: 'Zona euro (IAPC)' }, sentido: 'objetivo', pagina: 'inflacion' },
  { id: 'paro', pais: 'ES', titulo: 'Tasa de paro', ref: { id: 'paro', pais: 'EA', texto: 'Zona euro' }, sentido: -1, pagina: 'laboral' },
  { id: 'pib_var', pais: 'ES', titulo: 'Crecimiento del PIB', ref: { id: 'pib_var', pais: 'EA', texto: 'Zona euro' }, sentido: 1, pagina: 'mapa/pib_var' },
  { id: 'euribor_12m', pais: 'EA', titulo: 'Euríbor 12 meses', ref: { id: 'bce_deposito', pais: 'EA', texto: 'Tipo BCE' }, sentido: 0, pagina: 'monetaria' },
  { id: 'ipv_general_var', pais: 'ES', titulo: 'Precio de la vivienda', ref: { id: 'precio_vivienda_var', pais: 'EA', texto: 'Zona euro' }, sentido: 0, pagina: 'vivienda' },
];

// Ejes del radar: cuanto más lejos del centro, mejor posición entre los 27 países de la UE.
const RADAR = [
  { id: 'iapc_general', eje: 'Inflación', mejor: (v) => -Math.abs(v - 2) },
  { id: 'paro', eje: 'Paro', mejor: (v) => -v },
  { id: 'paro_jovenes', eje: 'Paro juvenil', mejor: (v) => -v },
  { id: 'pib_var', eje: 'Crecimiento', mejor: (v) => v },
  { id: 'saldo_publico', eje: 'Saldo público', mejor: (v) => v },
  { id: 'deuda_publica', eje: 'Deuda', mejor: (v) => -v },
  { id: 'bono_10a', eje: 'Coste de la deuda', mejor: (v) => -v },
];

function claseDelta(k, actual, anterior) {
  const d = actual - anterior;
  if (Math.abs(d) < 0.005 || k.sentido === 0) return 'neutro';
  if (k.sentido === 'objetivo') return Math.abs(actual - 2) < Math.abs(anterior - 2) ? 'bueno' : 'malo';
  return d * k.sentido > 0 ? 'bueno' : 'malo';
}

function tarjetaKpi(k, datos, ctx) {
  const info = ctx.indicador(k.id);
  const s = datos[k.id]?.[k.pais] || [];
  if (s.length < 2) return `<div class="kpi"><div class="nombre">${k.titulo}</div><div class="valor">—</div></div>`;
  const [fecha, actual] = s[s.length - 1];
  const anterior = s[s.length - 2][1];
  const ref = (datos[k.ref.id]?.[k.ref.pais] || []).at(-1);
  const decimales = k.id.includes('euribor') ? 2 : 1;
  const flecha = actual > anterior ? '▲' : actual < anterior ? '▼' : '=';
  return `<a class="kpi" href="#/${k.pagina}" title="${info.nombre}${info.nota ? ` · ${info.nota}` : ''} — pulsa para ver el detalle">
    <div class="nombre">${k.titulo} · ${ctx.nombrePais(k.pais)}</div>
    <div class="valor"><span data-contar="${actual}" data-decimales="${decimales}">${fmt(actual, decimales)}</span><small> %</small></div>
    <div class="linea"><span class="delta ${claseDelta(k, actual, anterior)}">${flecha} ${fmt(Math.abs(actual - anterior), decimales)} pp</span>
      <span>${fechaTexto(fecha, info.frecuencia)} · ${info.fuente === 'EUROSTAT' ? 'Eurostat' : info.fuente}</span></div>
    ${ref ? `<div class="ref">${k.ref.texto}: <strong>${fmt(ref[1], decimales)} %</strong> (${fechaTexto(ref[0], ctx.indicador(k.ref.id).frecuencia)})</div>` : ''}
    ${sparkline(s.slice(-24).map((p) => p[1]), COLORES[k.pais])}
  </a>`;
}

function diferencial(a, b) {
  const mb = new Map(b);
  return a.filter(([f]) => mb.has(f)).map(([f, v]) => [f, v - mb.get(f)]);
}

function trazasDiferencial(nombre, puntos, eje) {
  // Dos áreas: positiva en rojo (España peor) y negativa en verde (España mejor).
  const x = puntos.map((p) => p[0]);
  return [
    { x, y: puntos.map((p) => Math.max(p[1], 0)), type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { width: 0 }, fillcolor: 'rgba(200,16,46,0.25)', hoverinfo: 'skip', showlegend: false, xaxis: 'x', yaxis: eje },
    { x, y: puntos.map((p) => Math.min(p[1], 0)), type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { width: 0 }, fillcolor: 'rgba(26,127,75,0.25)', hoverinfo: 'skip', showlegend: false, xaxis: 'x', yaxis: eje },
    { x, y: puntos.map((p) => p[1]), type: 'scatter', mode: 'lines', name: nombre, line: { color: '#1b1f24', width: 1.6 }, xaxis: 'x', yaxis: eje, hovertemplate: `%{y:+.2f} pp<extra>${nombre}</extra>` },
  ];
}

/** Puntuación 0–100 de cada país en cada eje: % de los demás países de la UE a los que supera. */
function puntuaciones(resumen, nombres) {
  const ue = Object.keys(nombres).filter((c) => c !== 'EA' && c !== 'UE');
  const salida = {};
  for (const r of RADAR) {
    const filas = resumen.filter((f) => f.indicador === r.id && ue.includes(f.pais));
    if (filas.length < 15) continue;
    const valor = Object.fromEntries(filas.map((f) => [f.pais, r.mejor(f.valor)]));
    const posicion = (v) => (100 * filas.filter((f) => valor[f.pais] < v).length) / (filas.length - 1);
    salida[r.eje] = { valores: Object.fromEntries(filas.map((f) => [f.pais, posicion(valor[f.pais])])), n: filas.length,
      puesto: (c) => filas.filter((f) => valor[f.pais] > valor[c]).length + 1, ea: (() => {
        const ea = resumen.find((f) => f.indicador === r.id && f.pais === 'EA');
        return ea ? Math.min(100, posicion(r.mejor(ea.valor))) : null;
      })() };
  }
  return salida;
}

function radar(div, punt, ctx) {
  const ejes = Object.keys(punt);
  if (ejes.length < 3) { div.innerHTML = '<p class="sub">El radar necesita los datos europeos. Pulsa «Actualizar datos ahora».</p>'; return; }
  const cerrar = (a) => [...a, a[0]];
  const comparar = ctx.paises.filter((c) => c !== 'ES' && c !== 'EA');
  const traza = (nombre, valores, color, relleno) => ({
    type: 'scatterpolar', r: cerrar(valores), theta: cerrar(ejes), name: nombre, mode: 'lines+markers',
    line: { color, width: relleno ? 2.6 : 1.4, shape: 'spline', smoothing: 0.6 }, marker: { size: relleno ? 6 : 3, color },
    fill: relleno ? 'toself' : 'none', fillcolor: relleno ? `${color}33` : undefined,
    hovertemplate: `<b>${nombre}</b><br>%{theta}: mejor que el %{r:.0f} % de la UE<extra></extra>`,
  });
  const trazas = [
    ...comparar.map((c) => traza(ctx.nombrePais(c), ejes.map((e) => punt[e].valores[c] ?? null), tono(COLORES[c] || '#94a3b8'), false)),
    traza('Zona euro', ejes.map((e) => punt[e].ea), tono(COLORES.EA), false),
    traza('España', ejes.map((e) => punt[e].valores.ES ?? null), tono(COLORES.ES), true),
  ];
  const base = layout();
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  Plotly.newPlot(div, trazas, {
    ...base, margin: innerWidth < 600 ? { l: 70, r: 70, t: 24, b: 20 } : { l: 40, r: 40, t: 20, b: 20 }, hovermode: 'closest', showlegend: true,
    legend: { orientation: 'h', y: -0.06, x: 0.5, xanchor: 'center', font: { size: 11, color: css('--muted') } },
    polar: {
      bgcolor: 'rgba(0,0,0,0)',
      radialaxis: { range: [0, 100], tickvals: [25, 50, 75], ticksuffix: '', showticklabels: false, gridcolor: css('--line'), linecolor: 'rgba(0,0,0,0)' },
      angularaxis: { gridcolor: css('--line'), linecolor: css('--line-2'), tickfont: { size: 11, color: css('--muted') } },
    },
  }, { displayModeBar: false, responsive: true });
}

function chip(resumen, id, pais, texto, pagina, dec = 1) {
  const f = resumen.find((r) => r.indicador === id && r.pais === pais);
  if (!f) return '';
  return `<a class="chip-heroe" href="#/${pagina}">${texto} <b><span data-contar="${f.valor}" data-decimales="${dec}">${fmt(f.valor, dec)}</span> %</b></a>`;
}

// ---------------------------------------------------------------- Tabla ordenable y filtrable
function tablaIndicadores(filasTodas, ctx) {
  const sec = document.createElement('section');
  sec.className = 'card';
  const columnas = [
    ['nombre', 'Indicador'], ['pais_nombre', 'País'], ['valor', 'Último', 'num'], ['cambio', 'Cambio', 'num'],
    ['fecha', 'Periodo'], ['fuente', 'Fuente'], ['codigo', 'Serie'],
  ];
  let orden = { col: 'nombre', dir: 1 };
  sec.innerHTML = `
    <div class="card-head"><div><h2>Todos los indicadores</h2><p class="sub">Último dato de cada serie para los países seleccionados. Pulsa una columna para ordenar.</p></div>
      <div class="acciones"><button data-csv>Descargar</button></div></div>
    <div class="tabla-herramientas">
      <input type="search" placeholder="Filtrar: «paro», «Francia», «BCE»…" aria-label="Filtrar la tabla">
      <div class="segmented" data-fuente>${['Todas', 'INE', 'EUROSTAT', 'BCE'].map((f, i) => `<button data-f="${f}" class="${i ? '' : 'on'}">${f === 'EUROSTAT' ? 'Eurostat' : f}</button>`).join('')}</div>
      <span class="sub" data-cuenta></span>
    </div>
    <div class="tabla-wrap"><table>
      <thead><tr>${columnas.map(([k, n, c]) => `<th data-orden="${k}" class="${c || ''}">${n}</th>`).join('')}</tr></thead>
      <tbody></tbody></table></div>`;
  const filas = filasTodas.map((f) => ({ ...f, cambio: f.anterior == null ? null : f.valor - f.anterior }));
  const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let fuente = 'Todas';
  let visibles = filas;

  function pintar() {
    const q = sinTildes(sec.querySelector('input').value.trim());
    visibles = filas.filter((f) => (fuente === 'Todas' || f.fuente === fuente)
      && (!q || sinTildes(`${f.nombre} ${f.pais_nombre} ${f.fuente} ${f.codigo}`).includes(q)));
    visibles.sort((a, b) => {
      const x = a[orden.col], y = b[orden.col];
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * orden.dir;
    });
    sec.querySelectorAll('th').forEach((th) => { th.classList.toggle('asc', th.dataset.orden === orden.col && orden.dir > 0); th.classList.toggle('desc', th.dataset.orden === orden.col && orden.dir < 0); });
    sec.querySelector('[data-cuenta]').textContent = `${visibles.length} de ${filas.length}`;
    const d = (f) => (f.unidad === '€' ? 0 : 2);
    sec.querySelector('tbody').innerHTML = visibles.map((f) => `<tr>
      <td>${f.nombre}</td><td class="nw">${f.pais_nombre}</td>
      <td class="num"><strong>${fmt(f.valor, d(f))}</strong> ${f.unidad.startsWith('%') ? '%' : f.unidad === '€' ? '€' : ''}</td>
      <td class="num">${f.cambio == null ? '—' : `<span class="${Math.abs(f.cambio) < 0.005 ? '' : f.cambio > 0 ? 'sube-t' : 'baja-t'}">${f.cambio > 0 ? '+' : ''}${fmt(f.cambio, d(f))}</span>`}</td>
      <td class="nw">${fechaTexto(f.fecha, f.frecuencia)}</td><td><span class="chip ${f.fuente}">${f.fuente === 'EUROSTAT' ? 'Eurostat' : f.fuente}</span></td>
      <td><code>${f.codigo}</code></td></tr>`).join('') || '<tr><td colspan="7" class="sub">Nada coincide con el filtro.</td></tr>';
  }
  sec.querySelector('input').addEventListener('input', pintar);
  sec.querySelector('[data-fuente]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    fuente = b.dataset.f;
    sec.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
    pintar();
  });
  sec.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('[data-orden]');
    if (!th) return;
    orden = { col: th.dataset.orden, dir: orden.col === th.dataset.orden ? -orden.dir : (th.classList.contains('num') ? -1 : 1) };
    pintar();
  });
  sec.querySelector('[data-csv]').addEventListener('click', () => descargarCSV('resumen_indicadores.csv',
    ['Indicador', 'País', 'Último', 'Anterior', 'Fecha', 'Unidad', 'Fuente', 'Serie', 'Actualizado'],
    visibles.map((f) => [f.nombre, f.pais_nombre, f.valor, f.anterior ?? '', f.fecha, f.unidad, f.fuente, f.codigo, f.actualizado])));
  pintar();
  return sec;
}

// ---------------------------------------------------------------- Próximos datos (calendario del INE y del BCE)
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function cuantoFalta(fecha) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(`${fecha}T00:00:00`) - hoy) / 86400000);
  return dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
}

function tarjetaCalendario(eventos) {
  const hoy = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local
  const proximos = eventos.filter((e) => e.fecha >= hoy).slice(0, 8);
  if (!proximos.length) return '';
  return `<section class="card calendario">
    <div class="card-head"><div><h2>Próximos datos</h2>
      <p class="sub">Cuándo publican el INE y el BCE los datos que sigue el panel (hora peninsular). Se actualiza cada día con sus calendarios oficiales.</p></div>
      <div class="acciones"><a class="btn" href="webcal://www.ine.es/dynt3/Calendario/calendario.ics" title="Suscribirse al calendario oficial del INE en tu móvil u ordenador">📅 Añadir el calendario del INE</a></div></div>
    <ol class="lista-calendario">${proximos.map((e) => {
      const d = new Date(`${e.fecha}T00:00:00`);
      return `<li class="${e.fuente === 'BCE' ? 'bce' : ''}">
        <a href="#/${e.pagina || 'portada'}">
          <span class="dia"><b>${d.getDate()}</b>${MES_CORTO[d.getMonth()]}</span>
          <span class="que"><strong>${e.titulo}</strong><small>${e.periodo}</small></span>
          <span class="cuando"><span class="chip ${e.fuente}">${e.fuente}</span><small>${DIA_SEMANA[d.getDay()]} · ${e.hora || ''} · ${cuantoFalta(e.fecha)}</small></span>
        </a></li>`;
    }).join('')}</ol>
  </section>`;
}

export default {
  titulo: 'Portada',
  async render(nodo, ctx) {
    const hace4 = `${new Date().getFullYear() - 4}-01-01`;
    const ids = [...new Set(KPIS.flatMap((k) => [k.id, k.ref.id]))];
    const [kpi, div, cal] = await Promise.all([
      series(ids, { paises: ['ES', 'EA'], desde: hace4 }),
      series(['iapc_general', 'paro'], { paises: ['ES', 'EA'], desde: ctx.desde, hasta: ctx.hasta }),
      get('calendario').catch(() => ({ eventos: [] })),
    ]);
    const resumen = ctx.resumen || [];
    const punt = puntuaciones(resumen, ctx.catalogo.nombres || {});
    const ejes = Object.keys(punt);
    const mejor = ejes.length ? ejes.reduce((a, b) => ((punt[a].valores.ES ?? -1) >= (punt[b].valores.ES ?? -1) ? a : b)) : null;
    const peor = ejes.length ? ejes.reduce((a, b) => ((punt[a].valores.ES ?? 101) <= (punt[b].valores.ES ?? 101) ? a : b)) : null;
    const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    nodo.innerHTML = `
      <section class="heroe">
        <div>
          <span class="etiqueta">Observatorio económico · ${hoy}</span>
          <h1>España,<br><span class="degradado">en tiempo real</span></h1>
          <p>Inflación, empleo, tipos de interés, vivienda y finanzas públicas, descargados de INE, Eurostat y el BCE
          y comparados con los 27 países de la Unión Europea.
          ${mejor ? `Hoy, España destaca en <strong>${mejor.toLowerCase()}</strong> (puesto ${punt[mejor].puesto('ES')} de ${punt[mejor].n}) y queda peor en <strong>${peor.toLowerCase()}</strong> (puesto ${punt[peor].puesto('ES')} de ${punt[peor].n}).` : ''}</p>
          <div class="chips-heroe">
            ${chip(resumen, 'ipc_general', 'ES', 'IPC', 'inflacion')}
            ${chip(resumen, 'paro', 'ES', 'Paro', 'mapa/paro')}
            ${chip(resumen, 'pib_var', 'ES', 'PIB', 'mapa/pib_var')}
            ${chip(resumen, 'euribor_12m', 'EA', 'Euríbor', 'monetaria', 2)}
            ${chip(resumen, 'bono_10a', 'ES', 'Bono 10a', 'finanzas', 2)}
            <a class="chip-heroe destacado" href="#/mapa">Ver el mapa animado →</a>
          </div>
        </div>
        <div>
          <div class="heroe-radar" data-radar></div>
          <p class="fuente-nota" style="text-align:center;margin:2px 0 0">Radar de posición europea: cuanto más lejos del centro, mejor que más países de la UE.</p>
        </div>
      </section>
      <div class="kpis">${KPIS.map((k) => tarjetaKpi(k, kpi, ctx)).join('')}</div>
      ${explicacion('kpi')}
      ${tarjetaCalendario(cal.eventos || [])}`;
    radar(nodo.querySelector('[data-radar]'), punt, ctx);

    // Divergencia España – zona euro
    const t = tarjeta({
      titulo: 'Divergencia macroeconómica: España frente a la zona euro',
      sub: 'Diferencial en puntos porcentuales. Rojo: España por encima (peor) · Verde: por debajo (mejor).',
      fuente: 'Eurostat (IAPC y tasa de paro armonizada, mensuales)', clave: 'divergencia', alto: '',
    });
    t.grafico.style.height = '460px';
    nodo.appendChild(t.el);
    const difInfl = diferencial(div.iapc_general?.ES || [], div.iapc_general?.EA || []);
    const difParo = diferencial(div.paro?.ES || [], div.paro?.EA || []);
    const base = layout();
    dibujar(t.grafico, [...trazasDiferencial('Diferencial de inflación', difInfl, 'y'), ...trazasDiferencial('Diferencial de paro', difParo, 'y2')], {
      yaxis: { ...base.yaxis, domain: [0.56, 1], title: { text: 'Inflación (pp)', font: { size: 12 } } },
      yaxis2: { ...base.yaxis, domain: [0, 0.44], anchor: 'x', title: { text: 'Paro (pp)', font: { size: 12 } } },
      showlegend: false,
      margin: { l: 60, r: 18, t: 8, b: 30 },
    });
    t.setDatos({
      cabeceras: ['Fecha', 'Diferencial inflación (pp)', 'Diferencial paro (pp)'],
      filas: [...new Set([...difInfl, ...difParo].map((p) => p[0]))].sort().map((f) => [
        f, new Map(difInfl).get(f) ?? '', new Map(difParo).get(f) ?? '']),
    });

    nodo.appendChild(tablaIndicadores(resumen.filter((f) => ctx.paises.includes(f.pais)), ctx));
    nodo.classList.add('rejilla');
  },
};
