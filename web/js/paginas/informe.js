// Informe en PDF: portada, resumen, comentario automático de cada indicador, gráficos y bibliografía en APA.
// Se genera en el navegador y se guarda con «Imprimir → Guardar como PDF» (no hace falta instalar nada).
import { series } from '../api.js';
import { avisar } from '../efectos.js';
import { fechaTexto, fmt } from '../graficos.js';
import { cargarPrevisiones } from '../previsiones.js';
import { esc } from '../investigacion.js';
import { CITA_WEB } from './sobre.js';

// Colores pensados para papel (siempre claros, aunque la web esté en tema oscuro).
const COLOR_PAPEL = { ES: '#C8102E', EA: '#003399', UE: '#6D28D9', DE: '#2E3440', FR: '#4C78A8', IT: '#2A9D8F', PT: '#E9A23B' };
const EXTRA = ['#8E44AD', '#6C757D', '#16A085', '#D35400'];
const AUTORES = { INE: 'Instituto Nacional de Estadística', EUROSTAT: 'Eurostat', BCE: 'Banco Central Europeo' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const SECCIONES = [
  { id: 'inflacion', titulo: 'Inflación', indicadores: ['iapc_general', 'iapc_subyacente'] },
  { id: 'empleo', titulo: 'Mercado laboral', indicadores: ['paro', 'paro_jovenes'] },
  { id: 'jovenes', titulo: 'Jóvenes, empleo y tecnología', indicadores: ['ninis', 'empleo_jovenes', 'competencias_digitales_jovenes', 'ia_generativa_jovenes', 'empresas_ia'] },
  { id: 'crecimiento', titulo: 'Crecimiento económico', indicadores: ['pib_var'] },
  { id: 'tipos', titulo: 'Tipos de interés y financiación', indicadores: ['bce_deposito', 'euribor_12m', 'tipo_hipotecas'] },
  { id: 'vivienda', titulo: 'Vivienda', indicadores: ['precio_vivienda_var'] },
  { id: 'publicas', titulo: 'Finanzas públicas', indicadores: ['deuda_publica', 'saldo_publico', 'bono_10a'] },
];

// ---------------------------------------------------------------- Citas APA de las series (como en el Excel del laboratorio)
function urlSerie(fuente, codigo) {
  if (fuente === 'INE') return `https://www.ine.es/consul/serie.do?s=${codigo}`;
  if (fuente === 'EUROSTAT') return `https://ec.europa.eu/eurostat/databrowser/view/${codigo.split(' ')[0]}/default/table`;
  if (!codigo.includes('/')) return 'https://data.ecb.europa.eu/';
  const [flujo, clave] = codigo.split('/', 2);
  return `https://data.ecb.europa.eu/data/datasets/${flujo}/${flujo}.${clave}`;
}
function citaSerie(fila) {
  const hoy = new Date();
  const codigo = fila.codigo.split(' ')[0];
  return `${AUTORES[fila.fuente] || fila.fuente}. (${hoy.getFullYear()}). ${fila.nombre}: ${fila.pais_nombre} (serie ${codigo}) [Conjunto de datos]. `
    + `Recuperado el ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}, de ${urlSerie(fila.fuente, fila.codigo)}`;
}
function citaPrevision(p) {
  const [a, m, d] = p.fecha.split('-');
  return `${p.organismo === 'BCE' ? 'Banco Central Europeo' : p.organismo}. (${a}, ${Number(d)} de ${MESES[Number(m) - 1]}). ${p.titulo} [Proyecciones macroeconómicas]. ${p.url}`;
}

// ---------------------------------------------------------------- Comentario automático de un indicador
const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto'];
/** '2026-10-01' → «octubre de 2026» · trimestral → «tercer trimestre de 2026» */
function cuandoLargo(fecha, frecuencia) {
  const [a, m] = fecha.split('-').map(Number);
  if (frecuencia === 'A') return String(a);
  return frecuencia === 'Q' ? `${ORDINAL[Math.floor((m - 1) / 3)]} trimestre de ${a}` : `${MESES[m - 1]} de ${a}`;
}
// «de octubre de 2026» / «del tercer trimestre de 2026» · «en octubre…» / «en el tercer trimestre…»
const deFecha = (f, fr) => (fr === 'Q' ? `del ${cuandoLargo(f, fr)}` : `de ${cuandoLargo(f, fr)}`);
const enFecha = (f, fr) => (fr === 'Q' ? `en el ${cuandoLargo(f, fr)}` : `en ${cuandoLargo(f, fr)}`);
/** «a, b y c» */
const enumerar = (lista) => (lista.length < 2 ? lista.join('') : `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}`);
const numero = (v, d) => `${v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;

function comentario(info, datos, nombreBase, previsiones) {
  const nombrePais = (p) => (p === 'EA' ? 'la zona euro' : nombreBase(p)); // «en la zona euro», no «en Zona euro»
  const dec = /bono|euribor|bce|hipotecas/.test(info.id) ? 2 : 1;
  const pct = info.unidad.startsWith('%');
  const u = pct ? (info.unidad === '%' ? ' %' : ` ${info.unidad}`) : ` ${info.unidad}`;
  const val = (v) => `${numero(v, dec)}${u}`;
  const pp = pct ? 'puntos porcentuales' : 'puntos';
  const nombreCorto = info.nombre.replace(/\s*\([^)]*\)/g, ''); // sin «(variación anual)» ni «(desestacionalizada)»
  const principal = datos.ES?.length ? 'ES' : Object.keys(datos)[0];
  const s = datos[principal];
  if (!s?.length) return { texto: '', clave: null };
  const [fu, vu] = s.at(-1);
  const frases = [];
  // Último dato y comparación con el mismo periodo del año anterior.
  const anterior = s.find(([f]) => f === `${Number(fu.slice(0, 4)) - 1}${fu.slice(4)}`);
  let frase = `Según el último dato, ${deFecha(fu, info.frecuencia)}, el indicador «${nombreCorto}» se situó en ${nombrePais(principal)} en el <strong>${val(vu)}</strong>`;
  if (anterior) {
    const dif = vu - anterior[1];
    frase += Math.abs(dif) < 0.05 ? `, prácticamente igual que un año antes (${val(anterior[1])})`
      : `, ${fmt(Math.abs(dif), dec)} ${pp} ${dif > 0 ? 'más' : 'menos'} que un año antes (${val(anterior[1])})`;
  }
  frases.push(`${frase}.`);
  // Referencia europea: la zona euro o, en los indicadores anuales que no la tienen, la UE-27.
  const ref = datos.EA?.length ? 'EA' : datos.UE?.length ? 'UE' : null;
  if (ref && principal !== ref) {
    const ea = datos[ref].filter(([f]) => f <= fu).at(-1);
    if (ea) {
      const dif = vu - ea[1];
      frases.push(`En ${ref === 'EA' ? 'la zona euro' : 'la Unión Europea'} fue del ${val(ea[1])}, de modo que ${nombreBase(principal)} queda `
        + `${Math.abs(dif) < 0.05 ? 'prácticamente en el mismo nivel' : `${fmt(Math.abs(dif), dec)} ${pp} ${dif > 0 ? 'por encima' : 'por debajo'}`}.`);
    }
  }
  const otros = Object.keys(datos).filter((p) => !['ES', 'EA', 'UE'].includes(p) && datos[p].length);
  if (otros.length > 1) {
    const ult = otros.map((p) => [p, datos[p].at(-1)[1]]).sort((a, b) => b[1] - a[1]);
    frases.push(`Entre los demás países comparados, el valor más alto corresponde a ${nombrePais(ult[0][0])} (${val(ult[0][1])}) y el más bajo, a ${nombrePais(ult.at(-1)[0])} (${val(ult.at(-1)[1])}).`);
  }
  if (s.length > 4) {
    let min = s[0], max = s[0];
    for (const p of s) { if (p[1] < min[1]) min = p; if (p[1] > max[1]) max = p; }
    frases.push(`En el periodo analizado osciló entre un mínimo de ${val(min[1])} (${cuandoLargo(min[0], info.frecuencia)}) y un máximo de ${val(max[1])} (${cuandoLargo(max[0], info.frecuencia)}).`);
  }
  for (const p of previsiones.filter((x) => x.valores[info.id] && datos[x.pais])) {
    const anios = Object.entries(p.valores[info.id]).sort();
    frases.push(`${p.organismo === 'BCE' ? 'El BCE' : `El ${p.organismo}`} prevé para ${nombrePais(p.pais)} una media anual de ${enumerar(anios.map(([a, v]) => `${numero(v, 1)}${u} en ${a}`))}.`);
  }
  return { texto: frases.join(' '), clave: `${nombreCorto} (${nombreBase(principal)}): ${val(vu)} ${enFecha(fu, info.frecuencia)}` };
}

// ---------------------------------------------------------------- Gráfico como imagen (para que se imprima igual en cualquier navegador)
async function imagen(info, datos, nombrePais, previsiones) {
  const paises = Object.keys(datos).filter((p) => datos[p].length);
  const pct = info.unidad.startsWith('%');
  const trazas = paises.map((p, i) => ({
    x: datos[p].map((x) => x[0]), y: datos[p].map((x) => x[1]), type: 'scatter', mode: 'lines', name: nombrePais(p),
    line: { color: COLOR_PAPEL[p] || EXTRA[i % EXTRA.length], width: p === 'ES' ? 2.6 : 1.8 },
  }));
  for (const p of previsiones.filter((x) => x.valores[info.id] && paises.includes(x.pais))) {
    const anios = Object.keys(p.valores[info.id]).sort();
    trazas.push({ x: anios.map((a) => `${a}-07-01`), y: anios.map((a) => p.valores[info.id][a]), type: 'scatter', mode: 'lines+markers',
      name: `Previsión ${p.organismo}`, line: { color: COLOR_PAPEL[p.pais], dash: 'dot', width: 1.5 },
      marker: { symbol: 'diamond-open', size: 8, color: COLOR_PAPEL[p.pais] } });
  }
  const ejes = { gridcolor: '#e5e7eb', linecolor: '#9ca3af', zerolinecolor: '#9ca3af', tickfont: { size: 12, color: '#374151' } };
  return Plotly.toImage({
    data: trazas,
    layout: {
      width: 1000, height: 420, paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff', separators: ',.',
      font: { family: 'Inter, Arial, sans-serif', size: 13, color: '#111827' },
      margin: { l: 56, r: 16, t: 10, b: 40 }, showlegend: true,
      legend: { orientation: 'h', y: -0.14, x: 0, font: { size: 12 } },
      xaxis: ejes, yaxis: { ...ejes, ticksuffix: pct ? ' %' : '' },
    },
  }, { format: 'png', width: 1000, height: 420, scale: 2 });
}

export default {
  titulo: 'Informe en PDF',
  render(nodo, ctx) {
    nodo.className = 'rejilla';
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Para trabajos e informes · CC BY 4.0</span>
        <h1>Informe en <span class="degradado">PDF</span></h1>
        <p>Genera un informe con los últimos datos: resumen, comentario de cada indicador, gráficos y bibliografía en formato APA.
        Usa los países y el periodo elegidos en la barra lateral.</p></header>
      <section class="card">
        <form class="form informe-form">
          <label style="flex:1;min-width:260px">Título<input type="text" name="titulo" value="La economía española frente a la zona euro"></label>
          <label style="min-width:200px">Autor (opcional)<input type="text" name="autor" placeholder="Tu nombre"></label>
        </form>
        <div class="secciones-informe">${SECCIONES.map((s) => `<label class="check"><input type="checkbox" value="${s.id}" checked>${s.titulo}</label>`).join('')}</div>
        <div class="acciones-informe">
          <button class="btn primario" data-generar>Generar el informe</button>
          <button class="btn" data-pdf disabled>⬇ Descargar PDF</button>
          <span class="sub">Al descargar, elige «Guardar como PDF» como impresora.</span>
        </div>
      </section>
      <div class="documento-caja"><article class="documento" data-documento>
        <p class="vacio-informe">Elige las secciones y pulsa «Generar el informe». Tarda unos segundos.</p>
      </article></div>`;

    const form = nodo.querySelector('.informe-form');
    const doc = nodo.querySelector('[data-documento]');
    const botonPdf = nodo.querySelector('[data-pdf]');

    async function generar() {
      const elegidas = SECCIONES.filter((s) => nodo.querySelector(`.secciones-informe input[value="${s.id}"]`).checked);
      if (!elegidas.length) { avisar('Elige al menos una sección', 'error'); return; }
      const boton = nodo.querySelector('[data-generar]');
      boton.disabled = true; boton.textContent = 'Generando…';
      doc.innerHTML = '<div class="carga"><div class="esqueleto e1"></div><div class="esqueleto e2"></div></div>';
      try {
        const ids = elegidas.flatMap((s) => s.indicadores).filter((id) => ctx.indicador(id));
        const paises = [...ctx.paises.slice(0, 6), 'UE'];
        const [datos, previsiones] = await Promise.all([series(ids, { paises, desde: ctx.desde, hasta: ctx.hasta }), cargarPrevisiones()]);
        const usadas = new Map();
        const resumen = [];
        let figura = 0;
        const secciones = [];
        for (const s of elegidas) {
          const bloques = [];
          for (const id of s.indicadores) {
            const info = ctx.indicador(id);
            const d = Object.fromEntries(Object.entries(datos[id] || {}).filter(([, v]) => v.length));
            if (!info || !Object.keys(d).length) continue;
            const { texto, clave } = comentario(info, d, ctx.nombrePais, previsiones);
            if (clave) resumen.push(clave);
            const png = await imagen(info, d, ctx.nombrePais, previsiones);
            figura += 1;
            for (const p of Object.keys(d)) {
              const fila = (ctx.resumen || []).find((r) => r.indicador === id && r.pais === p);
              if (fila) usadas.set(`${id}|${p}`, citaSerie(fila));
            }
            for (const p of previsiones.filter((x) => x.valores[id] && d[x.pais])) usadas.set(p.id, citaPrevision(p));
            bloques.push(`<h3>${esc(info.nombre)}</h3><p>${texto}</p>
              <figure><img src="${png}" alt="Gráfico: ${esc(info.nombre)}"><figcaption><b>Figura ${figura}.</b> ${esc(info.nombre)} (${esc(info.unidad)}).
              Fuente: elaboración propia con datos de ${info.fuente === 'EUROSTAT' ? 'Eurostat' : info.fuente === 'BCE' ? 'estadísticas del BCE' : 'el INE'}${previsiones.some((x) => x.valores[id]) ? ' y previsiones oficiales' : ''}.</figcaption></figure>`);
          }
          if (bloques.length) secciones.push(`<section class="seccion"><h2>${secciones.length + 2}. ${s.titulo}</h2>${bloques.join('')}</section>`);
        }
        const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        const periodo = `${ctx.desde ? fechaTexto(ctx.desde) : 'enero 2000'} – ${ctx.hasta ? fechaTexto(ctx.hasta) : 'último dato'}`;
        const bibliografia = [...new Set([...usadas.values(), CITA_WEB])].sort((a, b) => a.localeCompare(b, 'es'));
        doc.innerHTML = `
          <header class="portada-informe">
            <p class="marca">Observatorio económico</p>
            <h1>${esc(form.titulo.value || 'Informe económico')}</h1>
            <p>${form.autor.value ? `${esc(form.autor.value)} · ` : ''}${hoy}</p>
            <p class="meta-informe">Periodo: ${periodo} · Países: ${paises.map(ctx.nombrePais).join(', ')}</p>
          </header>
          <section class="seccion"><h2>1. Resumen</h2>
            <p>Este informe resume la situación reciente de la economía española en comparación con la zona euro, con datos oficiales del
            Instituto Nacional de Estadística (INE), Eurostat y el Banco Central Europeo (BCE). Los últimos datos disponibles son:</p>
            <ul>${resumen.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></section>
          ${secciones.join('')}
          <section class="seccion"><h2>${secciones.length + 2}. Nota metodológica</h2>
            <p>Los datos se descargan directamente de las fuentes oficiales. Las tasas son variaciones anuales salvo que se indique otra cosa.
            Los tipos del BCE y el euríbor son el último valor de cada mes. Las previsiones son medias anuales publicadas por el BCE (zona euro) y el
            Banco de España (España). Los comentarios se generan automáticamente a partir de los datos y conviene revisarlos.</p></section>
          <section class="seccion bibliografia"><h2>Referencias</h2>${bibliografia.map((c) => `<p>${esc(c)}</p>`).join('')}</section>
          <footer class="pie-informe">Elaborado con el Observatorio económico (CC BY 4.0). Los organismos citados no respaldan este informe.</footer>`;
        botonPdf.disabled = false;
        avisar(`Informe listo: ${figura} gráficos y ${bibliografia.length} referencias ✓`, 'ok');
      } catch (err) {
        doc.innerHTML = `<div class="alerta">No se pudo generar el informe: ${esc(err.message)}</div>`;
      }
      boton.disabled = false; boton.textContent = 'Generar el informe';
    }

    function descargarPdf() {
      // Se copia el informe a una capa propia y se imprime solo esa capa (ver @media print en el CSS).
      const zona = document.createElement('div');
      zona.id = 'zona-impresion';
      zona.innerHTML = `<article class="documento">${doc.innerHTML}</article>`;
      document.body.appendChild(zona);
      const tituloAntes = document.title;
      document.title = form.titulo.value || 'Informe económico';
      const limpiar = () => { zona.remove(); document.title = tituloAntes; removeEventListener('afterprint', limpiar); };
      addEventListener('afterprint', limpiar);
      setTimeout(() => window.print(), 50);
    }

    nodo.querySelector('[data-generar]').addEventListener('click', generar);
    botonPdf.addEventListener('click', descargarPdf);
  },
};
