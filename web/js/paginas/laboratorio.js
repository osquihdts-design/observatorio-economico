// Módulo 5: laboratorio econométrico (filtro HP, correlación cruzada y regresión MCO con exportación para el TFG).
import { descargarArchivo, post } from '../api.js';
import { dibujar, fmt, layout, tarjeta } from '../graficos.js';
import { explicacion } from '../academico.js';
import { aviso } from '../ui.js';

const FUENTE = { INE: 'INE', EUROSTAT: 'Eurostat', BCE: 'BCE' };

/** Selector de variable: indicador + país + transformación. */
function selectorVariable(ctx, inicial) {
  const el = document.createElement('span');
  el.className = 'variable';
  const grupos = ['INE', 'EUROSTAT', 'BCE'].map((f) => `<optgroup label="${FUENTE[f]}">${ctx.catalogo.indicadores
    .filter((i) => i.fuente === f && i.paises.length)
    .map((i) => `<option value="${i.id}">${i.nombre}</option>`).join('')}</optgroup>`).join('');
  el.innerHTML = `<select data-campo="indicador" aria-label="Indicador">${grupos}</select>
    <select data-campo="pais" aria-label="País"></select>
    <select data-campo="transformacion" aria-label="Transformación">${Object.entries(ctx.catalogo.transformaciones)
      .map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>`;
  const [ind, pais, trans] = el.querySelectorAll('select');
  const actualizarPaises = (preferido) => {
    const disponibles = ctx.indicador(ind.value).paises;
    pais.innerHTML = disponibles.map((c) => `<option value="${c}">${ctx.nombrePais(c)}</option>`).join('');
    pais.value = disponibles.includes(preferido) ? preferido : disponibles[0];
  };
  ind.value = inicial.indicador;
  actualizarPaises(inicial.pais);
  trans.value = inicial.transformacion || 'niveles';
  ind.addEventListener('change', () => actualizarPaises(pais.value));
  return { el, valor: () => ({ indicador: ind.value, pais: pais.value, transformacion: trans.value }) };
}

function boton(texto, primario = false) {
  const b = document.createElement('button');
  b.className = `btn${primario ? ' primario' : ''}`;
  b.textContent = texto;
  return b;
}

async function conEspera(b, tarea) {
  const texto = b.textContent;
  b.disabled = true;
  b.textContent = 'Calculando…';
  try {
    aviso('');
    await tarea();
  } catch (err) {
    aviso(err.message);
  } finally {
    b.disabled = false;
    b.textContent = texto;
  }
}

const estrellas = (p) => (p < 0.01 ? '***' : p < 0.05 ? '**' : p < 0.1 ? '*' : '');

// ---------------------------------------------------------------- Filtro HP
function seccionHP(ctx) {
  const t = tarjeta({ titulo: 'Descomposición de series: filtro Hodrick-Prescott', sub: 'Separa la tendencia de largo plazo del componente cíclico.', clave: 'hp' });
  const form = document.createElement('div');
  form.className = 'form';
  const variable = selectorVariable(ctx, { indicador: 'paro', pais: 'ES' });
  const etiqueta = document.createElement('label');
  etiqueta.innerHTML = 'λ (vacío = automático)<input type="number" min="0" step="100" placeholder="auto">';
  const b = boton('Calcular', true);
  form.append(variable.el, etiqueta, b);
  t.el.insertBefore(form, t.grafico);
  const ciclo = document.createElement('div');
  ciclo.className = 'grafico bajo';
  t.el.insertBefore(ciclo, t.grafico.nextSibling);

  const calcular = () => conEspera(b, async () => {
    const lam = etiqueta.querySelector('input').value;
    const r = await post('lab/hp', { ...variable.valor(), lambda: lam || null, desde: ctx.desde, hasta: ctx.hasta });
    dibujar(t.grafico, [
      { x: r.fechas, y: r.valores, name: 'Serie', type: 'scatter', mode: 'lines', line: { color: '#9AA0A6', width: 1.6 } },
      { x: r.fechas, y: r.tendencia, name: `Tendencia (λ = ${fmt(r.lambda, 0)})`, type: 'scatter', mode: 'lines', line: { color: '#003399', width: 2.8 } },
    ]);
    dibujar(ciclo, [{
      x: r.fechas, y: r.ciclo, name: 'Ciclo', type: 'bar',
      marker: { color: r.ciclo.map((v) => (v >= 0 ? 'rgba(200,16,46,0.7)' : 'rgba(0,51,153,0.7)')) },
      hovertemplate: '%{y:.2f}<extra>Ciclo</extra>',
    }], { showlegend: false, yaxis: { title: { text: 'Ciclo (serie − tendencia)', font: { size: 12 } } } });
    t.setDatos({ cabeceras: ['Fecha', r.nombre, 'Tendencia', 'Ciclo'], filas: r.fechas.map((f, i) => [f, r.valores[i], r.tendencia[i], r.ciclo[i]]) });
  });
  b.addEventListener('click', calcular);
  return { el: t.el, calcular };
}

// ---------------------------------------------------------------- Correlación cruzada
function seccionCCF(ctx) {
  const t = tarjeta({ titulo: 'Correlación cruzada con retardos (lead-lag)', sub: '¿Cuántos periodos tarda X en relacionarse con Y? Barras fuera de la banda = significativas al 95 %.', clave: 'ccf' });
  const form = document.createElement('div');
  form.className = 'form';
  const x = selectorVariable(ctx, { indicador: 'bce_deposito', pais: 'EA', transformacion: 'diferencia' });
  const y = selectorVariable(ctx, { indicador: 'iapc_general', pais: 'EA', transformacion: 'diferencia' });
  const lx = document.createElement('label'); lx.textContent = 'X (se adelanta)'; lx.appendChild(x.el);
  const ly = document.createElement('label'); ly.textContent = 'Y'; ly.appendChild(y.el);
  const lmax = document.createElement('label');
  lmax.innerHTML = 'Retardo máximo<input type="number" min="1" max="48" value="24">';
  const b = boton('Calcular', true);
  form.append(lx, ly, lmax, b);
  t.el.insertBefore(form, t.grafico);
  const texto = document.createElement('p');
  texto.className = 'resultado-texto';
  texto.hidden = true;
  t.el.insertBefore(texto, t.grafico);

  const calcular = () => conEspera(b, async () => {
    const r = await post('lab/ccf', { x: x.valor(), y: y.valor(), max_retardo: Number(lmax.querySelector('input').value) || null, desde: ctx.desde, hasta: ctx.hasta });
    const c = r.correlaciones;
    const periodo = r.frecuencia === 'Q' ? 'trimestre' : 'mes';
    const plural = (k) => `${Math.abs(k)} ${periodo}${Math.abs(k) === 1 ? '' : (periodo === 'mes' ? 'es' : 's')}`;
    const base = layout();
    dibujar(t.grafico, [
      { x: c.map((v) => v.retardo), y: c.map((v) => v.r), type: 'bar', name: 'Correlación',
        marker: { color: c.map((v) => (v.significativa ? '#003399' : '#C5CBD3')) },
        hovertemplate: 'k = %{x}<br>r = %{y:.3f}<extra></extra>' },
      { x: c.map((v) => v.retardo), y: c.map((v) => v.banda), type: 'scatter', mode: 'lines', name: 'Banda 95 %', line: { color: '#C8102E', dash: 'dash', width: 1.4 }, hoverinfo: 'skip' },
      { x: c.map((v) => v.retardo), y: c.map((v) => -v.banda), type: 'scatter', mode: 'lines', showlegend: false, line: { color: '#C8102E', dash: 'dash', width: 1.4 }, hoverinfo: 'skip' },
    ], {
      hovermode: 'closest',
      xaxis: { ...base.xaxis, title: { text: `Retardo k (${periodo}s). k > 0: X se adelanta a Y`, font: { size: 12 } } },
      yaxis: { ...base.yaxis, title: { text: 'r', font: { size: 12 } }, range: [-1, 1] },
    });
    const adelantos = c.filter((v) => v.retardo > 0);
    const mejor = adelantos.reduce((a, v) => (Math.abs(v.r) > Math.abs(a.r) ? v : a), adelantos[0]);
    texto.hidden = !mejor;
    if (mejor) {
      texto.innerHTML = `La relación más fuerte con X adelantado es a <strong>${plural(mejor.retardo)}</strong>: r = <strong>${fmt(mejor.r, 3)}</strong>
        (${mejor.significativa ? 'significativa' : 'no significativa'} al 95 %, banda ±${fmt(mejor.banda, 3)}).`;
    }
    t.setDatos({ cabeceras: ['Retardo', 'Correlación', 'Banda 95 %', 'Observaciones', 'Significativa'], filas: c.map((v) => [v.retardo, v.r, v.banda, v.n, v.significativa ? 'Sí' : 'No']) });
  });
  b.addEventListener('click', calcular);
  return { el: t.el, calcular };
}

// ---------------------------------------------------------------- Regresión MCO
function seccionOLS(ctx) {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `<div class="card-head"><div><h2>Constructor de regresiones (MCO)</h2>
    <p class="sub">Elige la variable dependiente (Y) y una o varias explicativas (X). Si mezclas datos mensuales y trimestrales, todo se pasa a medias trimestrales.</p></div></div>`;
  const form = document.createElement('div');
  const y = selectorVariable(ctx, { indicador: 'iapc_subyacente', pais: 'ES', transformacion: 'diferencia' });
  const filaY = document.createElement('div');
  filaY.className = 'form';
  const ly = document.createElement('label'); ly.textContent = 'Variable dependiente (Y)'; ly.appendChild(y.el);
  filaY.appendChild(ly);
  const listaX = document.createElement('div');
  listaX.className = 'lista-x';
  const xs = [];
  const anadirX = (inicial) => {
    const s = selectorVariable(ctx, inicial);
    const fila = document.createElement('div');
    fila.className = 'fila';
    const quitar = Object.assign(document.createElement('button'), { className: 'quitar', title: 'Quitar variable', textContent: '×' });
    quitar.addEventListener('click', () => { xs.splice(xs.indexOf(s), 1); fila.remove(); });
    fila.append(Object.assign(document.createElement('strong'), { textContent: 'X', style: 'font-size:12px;color:var(--muted)' }), s.el, quitar);
    listaX.appendChild(fila);
    xs.push(s);
  };
  anadirX({ indicador: 'paro', pais: 'ES', transformacion: 'diferencia' });
  anadirX({ indicador: 'euribor_12m', pais: 'EA', transformacion: 'diferencia' });

  const opciones = document.createElement('div');
  opciones.className = 'form';
  const masX = boton('+ Añadir variable X');
  masX.addEventListener('click', () => anadirX({ indicador: 'pib_var', pais: 'ES' }));
  const robustos = document.createElement('label');
  robustos.className = 'check';
  robustos.innerHTML = '<input type="checkbox" checked> Errores robustos (Newey-West)';
  const retardos = document.createElement('label');
  retardos.innerHTML = 'Retardos HAC<input type="number" min="0" max="24" placeholder="auto">';
  const estimar = boton('Estimar', true);
  const exportar = boton('Exportar Excel (TFG)');
  opciones.append(masX, robustos, retardos, estimar, exportar);
  form.append(filaY, listaX, opciones);
  el.appendChild(form);

  const salida = document.createElement('div');
  el.appendChild(salida);
  el.insertAdjacentHTML('beforeend', explicacion('ols'));

  const cuerpo = () => ({
    y: y.valor(), xs: xs.map((s) => s.valor()),
    robustos: robustos.querySelector('input').checked,
    retardos: retardos.querySelector('input').value || null,
    desde: ctx.desde, hasta: ctx.hasta,
  });

  const calcular = () => conEspera(estimar, async () => {
    const r = await post('lab/ols', cuerpo());
    salida.innerHTML = `
      ${r.avisos.map((a) => `<div class="alerta">⚠ ${a}</div>`).join('')}
      <div class="stats">
        <div class="stat"><span>Observaciones</span><strong>${r.n}</strong></div>
        <div class="stat"><span>R²</span><strong>${fmt(r.r2, 3)}</strong></div>
        <div class="stat"><span>R² ajustado</span><strong>${fmt(r.r2_ajustado, 3)}</strong></div>
        <div class="stat"><span>F (p-valor)</span><strong>${fmt(r.f, 2)}</strong> <small>(${fmt(r.f_p, 4)})</small></div>
        <div class="stat"><span>AIC / BIC</span><strong>${fmt(r.aic, 1)}</strong> <small>/ ${fmt(r.bic, 1)}</small></div>
        <div class="stat"><span>Durbin-Watson</span><strong>${fmt(r.durbin_watson, 3)}</strong></div>
      </div>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Variable</th><th class="num">Coeficiente</th><th class="num">Error estándar</th><th class="num">t</th><th class="num">p-valor</th><th class="num">IC 95 %</th></tr></thead>
        <tbody>${r.tabla.map((f) => `<tr><td>${f.variable}</td><td class="num"><strong>${fmt(f.coeficiente, 4)}</strong> <span class="estrellas">${estrellas(f.p)}</span></td>
          <td class="num">${fmt(f.error, 4)}</td><td class="num">${fmt(f.t, 2)}</td><td class="num">${fmt(f.p, 4)}</td>
          <td class="num">[${fmt(f.ic_bajo, 3)}; ${fmt(f.ic_alto, 3)}]</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="fuente-nota">Variable dependiente: ${r.variable_y}. Errores estándar ${r.tipo_errores}. *** p &lt; 0,01 · ** p &lt; 0,05 · * p &lt; 0,1.
        Frecuencia ${r.frecuencia === 'Q' ? 'trimestral' : 'mensual'}, ${r.fechas[0]} a ${r.fechas.at(-1)}.</p>
      <h3 style="font-size:14px;margin:16px 0 6px">Test de Dickey-Fuller aumentado (estacionariedad)</h3>
      <div class="tabla-wrap"><table>
        <thead><tr><th>Variable</th><th class="num">Estadístico</th><th class="num">p-valor</th><th class="num">Retardos</th><th class="num">Crítico 5 %</th><th>Resultado</th></tr></thead>
        <tbody>${r.adf.map((a) => `<tr><td>${a.variable}</td><td class="num">${fmt(a.estadistico, 3)}</td><td class="num">${fmt(a.p_valor, 3)}</td>
          <td class="num">${a.retardos}</td><td class="num">${fmt(a.criticos['5%'], 3)}</td>
          <td>${a.estacionaria === true ? '<span class="chip" style="background:var(--good-soft);color:var(--good)">Estacionaria</span>'
            : a.estacionaria === false ? '<span class="chip" style="background:var(--bad-soft);color:var(--bad)">No estacionaria</span>'
              : `<span class="chip" title="${a.conclusion}">No calculado</span>`}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="rejilla dos" style="margin-top:14px">
        <div><h3 style="font-size:14px;margin:0 0 4px">Observados y predichos</h3><div class="grafico bajo" id="ols-ajuste"></div></div>
        <div><h3 style="font-size:14px;margin:0 0 4px">Residuos</h3><div class="grafico bajo" id="ols-residuos"></div></div>
      </div>
      <h3 style="font-size:14px;margin:16px 0 6px">Citas de las fuentes (APA 7.ª)</h3>
      <ol class="citas">${r.citas.map((c) => `<li>${c}</li>`).join('')}</ol>`;
    dibujar(salida.querySelector('#ols-ajuste'), [
      { x: r.fechas, y: r.observados, name: 'Observado', type: 'scatter', mode: 'lines', line: { color: '#1b1f24', width: 1.8 } },
      { x: r.fechas, y: r.ajustados, name: 'Predicho', type: 'scatter', mode: 'lines', line: { color: '#C8102E', width: 2.2 } },
    ]);
    dibujar(salida.querySelector('#ols-residuos'), [
      { x: r.fechas, y: r.residuos, name: 'Residuo', type: 'bar', marker: { color: 'rgba(0,51,153,0.65)' }, hovertemplate: '%{y:.3f}<extra></extra>' },
    ], { showlegend: false });
  });
  estimar.addEventListener('click', calcular);
  exportar.addEventListener('click', () => conEspera(exportar, () => descargarArchivo('lab/exportar', cuerpo(), 'observatorio_regresion.xlsx')));
  return { el, calcular };
}

export default {
  titulo: 'Laboratorio econométrico',
  async render(nodo, ctx) {
    nodo.className = 'rejilla';
    nodo.innerHTML = `<header class="cabecera"><h1>Laboratorio econométrico</h1>
      <p>Herramientas para trabajos y el TFG: descomposición de series, correlaciones con retardos y regresiones con diagnóstico automático.
      Usa el periodo elegido en la barra lateral. Todos los cálculos están programados en Python y comprobados con resultados de manual.</p></header>`;
    const secciones = [seccionOLS(ctx), seccionHP(ctx), seccionCCF(ctx)];
    for (const s of secciones) nodo.appendChild(s.el);
    await Promise.all(secciones.map((s) => s.calcular()));
  },
};
