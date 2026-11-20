// Mapa de Europa animado: un indicador para los 27 países de la UE, con reproductor (play, línea de tiempo,
// velocidad), «carrera de barras» sincronizada y la historia del país que se pulse.
import { series } from '../api.js';
import { COLORES, CONFIG, descargarCSV, dibujar, fechaTexto, fmt, layout, linea, tarjeta } from '../graficos.js';
import { avisar, sinMovimiento } from '../efectos.js';
import { NOTA_PREVISIONES, trazasPrevision } from '../previsiones.js';

// Eurostat usa códigos de 2 letras (Grecia = EL); el mapa de Plotly necesita ISO de 3 letras.
const ISO3 = {
  AT: 'AUT', BE: 'BEL', BG: 'BGR', CY: 'CYP', CZ: 'CZE', DE: 'DEU', DK: 'DNK', EE: 'EST', EL: 'GRC', ES: 'ESP',
  FI: 'FIN', FR: 'FRA', HR: 'HRV', HU: 'HUN', IE: 'IRL', IT: 'ITA', LT: 'LTU', LU: 'LUX', LV: 'LVA', MT: 'MLT',
  NL: 'NLD', PL: 'POL', PT: 'PRT', RO: 'ROU', SE: 'SWE', SI: 'SVN', SK: 'SVK',
};
const UE = Object.keys(ISO3);
const DE_ISO3 = Object.fromEntries(Object.entries(ISO3).map(([a, b]) => [b, a]));

// Escalas de color según cómo se lee cada indicador.
const ESCALAS = {
  cambio: ['#2563eb', '#60a5fa', '#94a3b8', '#fb923c', '#ea580c'],                       // baja (azul) · sube (naranja)
  nivel: ['#312e81', '#6d28d9', '#a855f7', '#ec4899', '#f59e0b', '#fde047'],             // solo intensidad
};

// Ficha de cada indicador: unidad, qué mide, cómo leerlo, colores y línea de referencia.
// `centro` centra la escala de color en ese valor (el objetivo o el cero) para que se lea a simple vista.
const FICHAS = {
  iapc_general: {
    unidad: '% de variación anual', corta: '%', escala: 'cambio', centro: 2, referencia: 2, refTexto: 'Objetivo del BCE (2 %)',
    que: 'Cuánto han subido los precios de consumo respecto al mismo mes del año anterior. Es el índice armonizado (IAPC), que se calcula igual en todos los países para poder compararlos.',
    leer: 'El objetivo del BCE es el 2 %. Gris = cerca del 2 %; naranja = por encima; azul = por debajo (los valores negativos indican que los precios bajan).',
  },
  iapc_subyacente: {
    unidad: '% de variación anual', corta: '%', escala: 'cambio', centro: 2, referencia: 2, refTexto: 'Objetivo del BCE (2 %)',
    que: 'Inflación sin energía ni alimentos (los precios más volátiles). Muestra la tendencia de fondo de los precios.',
    leer: 'Compárala con la inflación general para ver cuánto pesan la energía y los alimentos. Gris = cerca del 2 %; naranja = por encima; azul = por debajo.',
  },
  paro: {
    unidad: '% de la población activa', corta: '%', escala: 'nivel',
    que: 'Porcentaje de personas que buscan empleo y no lo encuentran sobre el total de la población activa (las que trabajan o buscan trabajo). Mensual y desestacionalizada.',
    leer: 'Tonos más intensos = tasa de paro más alta.',
  },
  paro_jovenes: {
    unidad: '% de los activos menores de 25 años', corta: '%', escala: 'nivel',
    que: 'Tasa de paro de los menores de 25 años: parados jóvenes sobre los jóvenes que trabajan o buscan trabajo (no sobre todos los jóvenes, porque muchos estudian).',
    leer: 'Tonos más intensos = tasa de paro juvenil más alta.',
  },
  precio_vivienda_indice: {
    unidad: 'índice (2015 = 100)', corta: '', escala: 'nivel', referencia: 100, refTexto: 'Precio de 2015 (= 100)',
    que: 'Evolución del precio de la vivienda (nueva y usada) tomando como referencia el año 2015. No son euros por metro cuadrado: es un índice.',
    leer: '100 = el precio de 2015. 150 significa que la vivienda cuesta un 50 % más que en 2015; 90, un 10 % menos. Sirve para comparar cuánto ha subido en cada país, no qué país es más caro.',
  },
  precio_vivienda_var: {
    unidad: '% de variación anual', corta: '%', escala: 'cambio', centro: 0, referencia: 0, refTexto: 'Sin cambios (0 %)',
    que: 'Cuánto ha cambiado el precio de la vivienda respecto al mismo trimestre del año anterior.',
    leer: 'Positivo (naranja) = la vivienda se encarece; negativo (azul) = se abarata.',
  },
  pib_var: {
    unidad: '% de variación interanual', corta: '%', escala: 'nivel', referencia: 0, refTexto: 'Crecimiento cero',
    que: 'Crecimiento de la economía: PIB en volumen (sin el efecto de los precios) respecto al mismo trimestre del año anterior.',
    leer: 'Valores negativos = la economía produce menos que un año antes. Dos trimestres seguidos de caída trimestral se suelen llamar recesión técnica.',
  },
  bono_10a: {
    unidad: '% anual (rentabilidad)', corta: '%', escala: 'nivel', dec: 2,
    que: 'Interés que paga cada Estado al pedir prestado a 10 años (rentabilidad de su bono, media del mes).',
    leer: 'Una rentabilidad más alta significa que el Estado paga más intereses por la deuda nueva. Estonia no emite bonos a 10 años, por eso no aparece.',
  },
  deuda_publica: {
    unidad: '% del PIB', corta: '%', escala: 'nivel', referencia: 60, refTexto: 'Límite de Maastricht (60 %)',
    que: 'Deuda bruta de todas las administraciones públicas (Estado, comunidades, ayuntamientos y Seguridad Social) dividida entre lo que produce el país en un año (PIB).',
    leer: 'La línea de referencia marca el 60 % del PIB, el límite de las reglas fiscales europeas (Tratado de Maastricht).',
  },
  saldo_publico: {
    unidad: '% del PIB', corta: '%', escala: 'nivel', centro: 0, referencia: -3, refTexto: 'Límite de déficit (−3 %)',
    que: 'Ingresos menos gastos de las administraciones públicas, en porcentaje del PIB. Negativo = déficit; positivo = superávit.',
    leer: 'Negativo = déficit (se gasta más de lo que se ingresa); positivo = superávit. Las reglas europeas fijan un déficit máximo del 3 % del PIB.',
  },
};
// Paro juvenil por nivel de estudios (trimestral, sin desestacionalizar)
const PARO_ESTUDIOS = (nivel, que) => ({
  unidad: '% de los activos de 15 a 24 años', corta: '%', escala: 'nivel',
  que: `Paro de los jóvenes de 15 a 24 años que tienen ${que}, sobre los que trabajan o buscan trabajo con ese nivel. Trimestral y sin desestacionalizar.`,
  leer: `Tonos más intensos = más paro. Compáralo con los otros niveles de estudios. Nivel: ${nivel}.`,
});
Object.assign(FICHAS, {
  paro_jovenes_estudios_bajos: PARO_ESTUDIOS('CINE 0-2', 'como mucho la ESO'),
  paro_jovenes_estudios_medios: PARO_ESTUDIOS('CINE 3-4', 'bachillerato o FP de grado medio'),
  paro_jovenes_estudios_superiores: PARO_ESTUDIOS('CINE 5-8', 'FP de grado superior o estudios universitarios'),
});

// Jóvenes, empleo y tecnología (anuales; referencia: UE-27)
Object.assign(FICHAS, {
  ninis: {
    unidad: '% de los jóvenes de 15 a 29 años', corta: '%', escala: 'nivel',
    que: 'Jóvenes que no tienen empleo y no estudian ni se forman (tasa «NEET»). A diferencia de la tasa de paro, incluye también a quienes no buscan trabajo.',
    leer: 'La meta de la UE para 2030 es bajar del 9 %.',
  },
  empleo_jovenes: {
    unidad: '% de la población de 15 a 24 años', corta: '%', escala: 'nivel',
    que: 'Jóvenes con empleo sobre todos los jóvenes de esa edad, estudien o no.',
    leer: 'Un valor bajo puede deberse a que muchos jóvenes estudian, no solo al paro: compáralo con la tasa de jóvenes que ni estudian ni trabajan.',
  },
  abandono_escolar: {
    unidad: '% de los jóvenes de 18 a 24 años', corta: '%', escala: 'nivel', referencia: 9, refTexto: 'Meta UE 2030 (9 %)',
    que: 'Jóvenes que dejaron de estudiar con, como mucho, la ESO, y no siguen formándose.',
    leer: 'La meta europea para 2030 es bajar del 9 %.',
  },
  titulados_superiores: {
    unidad: '% de la población de 25 a 34 años', corta: '%', escala: 'nivel', referencia: 45, refTexto: 'Meta UE 2030 (45 %)',
    que: 'Jóvenes adultos con FP de grado superior, grado universitario, máster o doctorado.',
    leer: 'La meta europea para 2030 es llegar al 45 %.',
  },
  competencias_digitales_jovenes: {
    unidad: '% de los jóvenes de 16 a 24 años', corta: '%', escala: 'nivel',
    que: 'Jóvenes con competencias digitales al menos básicas en las cinco áreas que mide la UE: información, comunicación, creación de contenidos, seguridad y resolución de problemas.',
    leer: 'Mide competencias básicas, no especializadas. Eurostat lo mide cada dos años.',
  },
  especialistas_tic: {
    unidad: '% del empleo total', corta: '%', escala: 'nivel',
    que: 'Personas ocupadas como especialistas en tecnologías de la información y la comunicación (programación, sistemas, redes, datos…).',
    leer: 'La UE se ha fijado como objetivo llegar a 20 millones de especialistas TIC en 2030.',
  },
  empresas_ia: {
    unidad: '% de las empresas de 10 o más empleados', corta: '%', escala: 'nivel',
    que: 'Empresas que usan al menos una tecnología de inteligencia artificial (análisis de textos, reconocimiento de voz o imágenes, aprendizaje automático, IA generativa…).',
    leer: 'Cuenta cualquier uso de una tecnología de IA, sea cual sea su intensidad.',
  },
  ia_generativa_jovenes: {
    unidad: '% de los jóvenes de 16 a 24 años', corta: '%', escala: 'nivel',
    que: 'Jóvenes que usaron herramientas de IA generativa (ChatGPT, Gemini, Copilot…) en los últimos 3 meses. Eurostat lo pregunta desde 2025.',
    leer: 'Solo hay un año de datos (2025): permite comparar países y edades, todavía no ver la evolución.',
  },
  ia_generativa_total: {
    unidad: '% de la población de 16 a 74 años', corta: '%', escala: 'nivel',
    que: 'Personas que usaron IA generativa en los últimos 3 meses. Eurostat lo pregunta desde 2025.',
    leer: 'Compáralo con el de los jóvenes para ver la brecha generacional.',
  },
  ia_generativa_trabajo: {
    unidad: '% de los jóvenes de 16 a 24 años', corta: '%', escala: 'nivel',
    que: 'Jóvenes que usaron IA generativa con fines profesionales (en el trabajo) en los últimos 3 meses. Eurostat lo pregunta desde 2025.',
    leer: 'Mide cuánto ha entrado la IA en el trabajo de los jóvenes, no en el ocio o los estudios.',
  },
});
const FRECUENCIA = { M: 'Mensual', Q: 'Trimestral', A: 'Anual' };

/** Ficha por defecto para un indicador nuevo que aún no tenga la suya. */
function fichaDe(info) {
  const porcentaje = info.unidad.startsWith('%');
  return FICHAS[info.id] || { unidad: info.unidad, corta: porcentaje ? '%' : '', escala: 'nivel', que: info.nota || info.nombre, leer: '' };
}
const VELOCIDADES = { '0,5×': 900, '1×': 420, '2×': 200, '4×': 90 };

let limpiar = null; // se llama al salir de la página: para la animación y quita los atajos

function percentil(ordenados, p) {
  if (!ordenados.length) return 0;
  const i = (ordenados.length - 1) * p;
  const a = Math.floor(i), b = Math.ceil(i);
  return ordenados[a] + (ordenados[b] - ordenados[a]) * (i - a);
}

function hexARgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function colorEn(escala, t) {
  const k = Math.max(0, Math.min(1, t)) * (escala.length - 1);
  const i = Math.min(escala.length - 2, Math.floor(k));
  const a = hexARgb(escala[i]), b = hexARgb(escala[i + 1]);
  const f = k - i;
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(',')})`;
}

/** Para cada fecha, el último valor conocido de cada país (como mucho 12 periodos atrás, para no inventar). */
function tablaPorFecha(datos, fechas, maxEdad = 12) {
  const tabla = fechas.map(() => ({}));
  for (const [pais, puntos] of Object.entries(datos)) {
    const m = new Map(puntos);
    let ultimo = null, edad = 0;
    fechas.forEach((f, i) => {
      if (m.has(f)) { ultimo = m.get(f); edad = 0; } else edad += 1;
      if (ultimo != null && edad <= maxEdad) tabla[i][pais] = { v: ultimo, estimado: edad > 0 };
    });
  }
  return tabla;
}

export default {
  titulo: 'Mapa de Europa',
  salir() { limpiar?.(); limpiar = null; },
  async render(nodo, ctx) {
    const europeos = ctx.catalogo.indicadores.filter((i) => i.paises.length > 20);
    if (!europeos.length) {
      nodo.innerHTML = '<div class="alerta">Todavía no hay datos de los 27 países. Pulsa «Actualizar datos ahora».</div>';
      return;
    }
    const id = europeos.some((i) => i.id === ctx.parametro) ? ctx.parametro : (europeos.find((i) => i.id === 'paro') || europeos[0]).id;
    const info = ctx.indicador(id);
    const datos = (await series([id], { paises: [...UE, 'EA', 'UE'], desde: '2000-01-01' }))[id] || {};
    // Referencia europea: la zona euro si la tabla la tiene; si no (indicadores anuales de jóvenes y tecnología), la UE-27.
    const REF = datos.EA?.length ? 'EA' : datos.UE?.length ? 'UE' : null;
    const nombreRef = REF === 'UE' ? 'Unión Europea (27)' : 'Zona euro';
    if (!ctx.vigente()) return;

    const fechas = [...new Set(Object.values(datos).flatMap((s) => s.map((p) => p[0])))].sort();
    const tabla = tablaPorFecha(datos, fechas, info.frecuencia === 'A' ? 1 : 12);
    const todos = UE.flatMap((p) => (datos[p] || []).map((x) => x[1])).sort((a, b) => a - b);
    const ficha = fichaDe(info);
    let zmin = percentil(todos, 0.02), zmax = percentil(todos, 0.98);
    if (ficha.centro != null) { // escala simétrica alrededor del objetivo o del cero
      const d = Math.max(ficha.centro - zmin, zmax - ficha.centro);
      zmin = ficha.centro - d; zmax = ficha.centro + d;
    }
    const escala = ESCALAS[ficha.escala];
    const sufijo = ficha.corta ? ` ${ficha.corta}` : '';
    const dec = ficha.dec ?? 1;
    // En los índices base 2015 = 100 se traduce a «cuánto ha cambiado desde 2015», que se entiende mejor.
    const esIndice2015 = ficha.escala === 'nivel' && ficha.referencia === 100;
    const conUnidad = (v) => `${fmt(v, dec)}${sufijo}${esIndice2015 ? ` (${v >= 100 ? '+' : '−'}${fmt(Math.abs(v - 100), 0)} % desde 2015)` : ''}`;

    // Por defecto, el último periodo en el que al menos 20 países tienen dato.
    let indice = fechas.length - 1;
    while (indice > 0 && UE.filter((p) => tabla[indice][p]).length < 20) indice -= 1;
    let foco = 'ES';
    let reproduciendo = false;
    let reloj = null;
    let pausa = VELOCIDADES['1×'];
    // Vista: mapa con clasificación · dos mapas para comparar fechas · tabla.
    let vista = 'mapa';
    // Fecha de comparación por defecto: el mismo periodo cinco años antes.
    let indice2 = Math.max(0, indice - (info.frecuencia === 'Q' ? 20 : 60));

    // Lo que trae el enlace compartido: fecha (f), país elegido (c), vista (v) y fecha de comparación (f2).
    const enlace = ctx.consulta || {};
    if (fechas.includes(enlace.f)) indice = fechas.indexOf(enlace.f);
    if (fechas.includes(enlace.f2)) indice2 = fechas.indexOf(enlace.f2);
    if (UE.includes(enlace.c)) foco = enlace.c;
    if (['comparar', 'tabla'].includes(enlace.v)) vista = enlace.v;
    const cambioUnidad = ficha.corta === '%' ? 'p. p.' : 'puntos'; // la diferencia entre dos porcentajes son puntos porcentuales

    const anioAntes = (i) => { // índice del mismo periodo un año antes
      const [a, resto] = [Number(fechas[i].slice(0, 4)), fechas[i].slice(4)];
      return fechas.indexOf(`${a - 1}${resto}`);
    };
    const opcionesFecha = (sel) => fechas.map((f, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${fechaTexto(f, info.frecuencia)}</option>`).reverse().join('');

    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Unión Europea · 27 países</span>
        <h1><span class="degradado">Mapa de Europa</span></h1>
        <p>Elige un indicador y pulsa ▶ para ver cómo ha cambiado en cada país desde el año 2000. Pulsa un país del mapa
        o de la clasificación para ver su historia. Atajos: <kbd>Espacio</kbd> reproducir · <kbd>←</kbd> <kbd>→</kbd> moverse en el tiempo.</p></header>
      <section class="card">
        <div class="mapa-controles">
          <select data-indicador aria-label="Indicador">${europeos.map((i) => `<option value="${i.id}" ${i.id === id ? 'selected' : ''}>${i.nombre}</option>`).join('')}</select>
          <div class="vistas-mapa" role="tablist" aria-label="Vista">
            ${[['mapa', '🗺 Mapa'], ['comparar', '◫ Comparar dos fechas'], ['tabla', '▤ Tabla']].map(([v, n]) =>
              `<button role="tab" data-vista="${v}" class="${v === vista ? 'on' : ''}" aria-selected="${v === vista}">${n}</button>`).join('')}
          </div>
          <span class="leyenda-mapa" data-resumen></span>
        </div>
        <div class="ficha-indicador">
          <div class="ficha-chips">
            <span><b>Unidad</b>${ficha.unidad}</span>
            <span><b>Frecuencia</b>${FRECUENCIA[info.frecuencia] || info.frecuencia}</span>
            <span><b>Fuente</b>Eurostat</span>
            ${ficha.referencia != null ? `<span class="ref"><b>Referencia</b>${ficha.refTexto}</span>` : ''}
          </div>
          <p><b>Qué mide.</b> ${ficha.que}</p>
          ${ficha.leer ? `<p><b>Cómo leerlo.</b> ${ficha.leer}</p>` : ''}
        </div>
        <div class="reproductor">
          <button class="boton-play" data-play aria-label="Reproducir"></button>
          <div class="fecha-grande" data-fecha></div>
          <input class="linea-tiempo" type="range" min="0" max="${fechas.length - 1}" value="${indice}" aria-label="Fecha">
          <div class="velocidad">${Object.keys(VELOCIDADES).map((v) => `<button data-vel="${v}" class="${v === '1×' ? 'on' : ''}">${v}</button>`).join('')}</div>
        </div>
        <div class="mapa-layout" data-vista="${vista}" style="margin-top:14px">
          <div class="panel-mapa"><p class="titulo-mapa" data-titulo-a></p><div class="mapa" data-mapa></div></div>
          <div class="panel-carrera"><p class="carrera-titulo">Clasificación de mayor a menor · en ${ficha.unidad}</p><div class="carrera" data-carrera></div></div>
          <div class="panel-mapa2"><p class="titulo-mapa">Comparar con <select data-f2 aria-label="Fecha de comparación">${opcionesFecha(indice2)}</select></p><div class="mapa" data-mapa2></div></div>
          <div class="panel-tabla"><div class="tabla-wrap"><table class="tabla-mapa"><thead></thead><tbody></tbody></table></div></div>
        </div>
        <div class="cambios-mapa" data-cambios></div>
        <p class="fuente-nota">Fuente: Eurostat (${info.nombre}). Los colores son fijos para todo el periodo, para que se puedan comparar los años.
          Si un país aún no ha publicado el último dato, se muestra el anterior (en cursiva).</p>
      </section>`;

    const $ = (s) => nodo.querySelector(s);
    const divMapa = $('[data-mapa]');
    const carrera = $('[data-carrera]');
    const deslizador = $('.linea-tiempo');
    const botonPlay = $('[data-play]');

    // Filas de la carrera de barras: se crean una vez y luego solo se mueven.
    const filas = {};
    for (const p of UE) {
      const f = document.createElement('div');
      f.className = `carrera-fila${p === 'ES' ? ' es' : ''}`;
      f.dataset.pais = p;
      f.innerHTML = `<span class="pos"></span><span class="nom">${ctx.nombrePais(p)}</span><span class="pista"><i class="barra-c"></i></span><span class="val"></span>`;
      carrera.appendChild(f);
      filas[p] = f;
    }
    const lo = Math.min(0, zmin), hi = Math.max(0, zmax);
    const alto = 20.4;
    // Línea de referencia vertical en la clasificación (objetivo del 2 %, límite del 60 %…).
    // Las pistas empiezan a 130 px (posición + nombre + huecos) y miden el ancho total menos 192 px.
    if (ficha.referencia != null && ficha.referencia > lo && ficha.referencia < hi) {
      const k = (ficha.referencia - lo) / (hi - lo);
      carrera.insertAdjacentHTML('afterbegin', `<div class="ref-carrera" style="left:calc(130px + (100% - 192px) * ${k.toFixed(4)})"
        title="${ficha.refTexto}"><span>${ficha.refTexto}</span></div>`);
    }

    function pintarCarrera(fila) {
      const orden = UE.filter((p) => fila[p]).sort((a, b) => fila[b].v - fila[a].v);
      const sin = UE.filter((p) => !fila[p]);
      [...orden, ...sin].forEach((p, i) => {
        const f = filas[p];
        const d = fila[p];
        f.style.transform = `translateY(${i * alto}px)`;
        f.style.opacity = d ? '1' : '0.3';
        f.classList.toggle('foco', p === foco && p !== 'ES');
        f.querySelector('.pos').textContent = d ? i + 1 : '–';
        const barra = f.querySelector('.barra-c');
        if (d) {
          const v = Math.max(lo, Math.min(hi, d.v));
          barra.style.left = `${((Math.min(0, v) - lo) / (hi - lo)) * 100}%`;
          barra.style.width = `${Math.max(0.8, (Math.abs(v) / (hi - lo)) * 100)}%`;
          barra.style.background = colorEn(escala, (d.v - zmin) / (zmax - zmin || 1));
          const val = f.querySelector('.val');
          val.textContent = fmt(d.v, dec);
          val.style.fontStyle = d.estimado ? 'italic' : 'normal';
        } else {
          barra.style.width = '0';
          f.querySelector('.val').textContent = '—';
        }
      });
      return orden;
    }

    function trazaMapa(fila) {
      const paises = UE.filter((p) => fila[p]);
      return {
        type: 'choropleth', locationmode: 'ISO-3',
        locations: paises.map((p) => ISO3[p]),
        z: paises.map((p) => fila[p].v),
        customdata: paises.map((p) => [ctx.nombrePais(p), fila[p].estimado ? '<br><i>último dato disponible</i>' : '']),
        hovertemplate: `<b>%{customdata[0]}</b><br>%{z:,.${dec}f}${sufijo} <span style="opacity:.7">· ${ficha.unidad}</span>%{customdata[1]}<extra></extra>`,
        zmin, zmax, zauto: false,
        colorscale: escala.map((c, i) => [i / (escala.length - 1), c]),
        marker: { line: { color: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#05080f', width: 0.8 } },
        colorbar: { thickness: 10, len: 0.7, x: 0.98, outlinewidth: 0, ticksuffix: sufijo, tickfont: { size: 11 },
          title: { text: ficha.unidad.replace(/ \(/, '<br>('), side: 'top', font: { size: 11 } } },
      };
    }

    function actualizarTextos(orden, fila) {
      const fecha = fechas[indice];
      $('[data-fecha]').textContent = fechaTexto(fecha, info.frecuencia);
      const puesto = orden.indexOf('ES') + 1;
      const media = orden.length ? orden.reduce((s, p) => s + fila[p].v, 0) / orden.length : null;
      const ea = (datos[REF] || []).filter((x) => x[0] <= fecha).at(-1);
      // Si Eurostat publica el dato oficial de la UE-27, se usa ese (ponderado) en vez de la media simple de los 27.
      const ueOficial = REF !== 'UE' ? (datos.UE || []).find((x) => x[0] === fecha) : null;
      const elegido = foco !== 'ES' && fila[foco] ? ` · <span>${ctx.nombrePais(foco)}: <strong>${conUnidad(fila[foco].v)}</strong></span>` : '';
      $('[data-resumen]').innerHTML = `${puesto ? `<span>España: <strong>${conUnidad(fila.ES.v)}</strong> · <strong>${puesto}.º</strong> más alto de ${orden.length}</span>` : ''}
        ${ueOficial ? `<span title="Dato oficial de Eurostat para el conjunto de la UE (ponderado por población)">Unión Europea (27): <strong>${conUnidad(ueOficial[1])}</strong></span>`
          : media != null ? `<span title="Media de los países con dato, sin ponderar por tamaño">Media simple de la UE: <strong>${conUnidad(media)}</strong></span>` : ''}
        ${ea ? `<span>${nombreRef}: <strong>${conUnidad(ea[1])}</strong></span>` : ''}${elegido}`;
    }

    const capaGeo = () => ({
      ...layout(), margin: { l: 0, r: 0, t: 0, b: 0 }, hovermode: 'closest',
      geo: {
        scope: 'europe', projection: { type: 'mercator' }, resolution: 50,
        lonaxis: { range: [-24, 42] }, lataxis: { range: [34, 70.5] },
        bgcolor: 'rgba(0,0,0,0)', showframe: false, showcoastlines: false,
        showland: true, landcolor: getComputedStyle(document.documentElement).getPropertyValue('--panel-2').trim() || '#111827',
        showcountries: true, countrycolor: getComputedStyle(document.documentElement).getPropertyValue('--line-2').trim() || '#334155',
        showocean: false, showlakes: false,
      },
    });
    const divMapa2 = $('[data-mapa2]');
    const conSigno = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), dec)}`;

    // ---- Segundo mapa (comparar dos fechas): misma escala de colores que el primero.
    let clicMapa2 = false;
    async function pintarMapa2() {
      const t = trazaMapa(tabla[indice2]);
      await Plotly.react(divMapa2, [t], capaGeo(), { ...CONFIG, scrollZoom: false });
      if (!clicMapa2) { clicMapa2 = true; divMapa2.on('plotly_click', (ev) => enfocar(DE_ISO3[ev.points?.[0]?.location])); }
    }

    /** Resumen de cambios entre las dos fechas: España, la mayor subida y la mayor bajada. */
    function pintarCambios() {
      const caja = $('[data-cambios]');
      if (vista !== 'comparar') { caja.innerHTML = ''; return; }
      const a = tabla[indice], b = tabla[indice2];
      const fa = fechaTexto(fechas[indice], info.frecuencia), fb = fechaTexto(fechas[indice2], info.frecuencia);
      const cambios = UE.filter((p) => a[p] && b[p]).map((p) => [p, a[p].v - b[p].v]).sort((x, y) => y[1] - x[1]);
      if (!cambios.length) { caja.innerHTML = '<p class="sub">No hay países con dato en las dos fechas.</p>'; return; }
      const es = cambios.find(([p]) => p === 'ES');
      const [subeP, subeV] = cambios[0];
      const [bajaP, bajaV] = cambios.at(-1);
      caja.innerHTML = `<b>Entre ${fb} y ${fa}</b>
        ${es ? `<span>España: <strong>${conSigno(es[1])} ${cambioUnidad}</strong> (de ${fmt(b.ES.v, dec)} a ${fmt(a.ES.v, dec)})</span>` : ''}
        <span>Mayor subida: <strong>${ctx.nombrePais(subeP)} ${conSigno(subeV)}</strong></span>
        <span>Mayor bajada: <strong>${ctx.nombrePais(bajaP)} ${conSigno(bajaV)}</strong></span>`;
      $('[data-titulo-a]').innerHTML = `<b>${fa}</b>`;
    }

    // ---- Tabla de todos los países (se puede ordenar pulsando las columnas)
    let ordenTabla = { col: 'valor', dir: -1 };
    function pintarTabla() {
      if (vista !== 'tabla') return;
      const a = tabla[indice];
      const ia = anioAntes(indice);
      const antes = ia >= 0 ? tabla[ia] : {};
      const b = tabla[indice2];
      const fb = fechaTexto(fechas[indice2], info.frecuencia);
      const ranking = UE.filter((p) => a[p]).sort((x, y) => a[y].v - a[x].v);
      const filasT = UE.map((p) => ({
        p, nombre: ctx.nombrePais(p), puesto: ranking.indexOf(p) + 1 || null, valor: a[p]?.v ?? null, estimado: a[p]?.estimado,
        anio: a[p] && antes[p] ? a[p].v - antes[p].v : null, comp: a[p] && b[p] ? a[p].v - b[p].v : null,
      }));
      const { col, dir } = ordenTabla;
      filasT.sort((x, y) => (x[col] == null) - (y[col] == null) || (typeof x[col] === 'string' ? x[col].localeCompare(y[col], 'es') : x[col] - y[col]) * dir);
      const cols = [['puesto', '#'], ['nombre', 'País'], ['valor', `Valor (${ficha.unidad})`], ['anio', `Cambio en un año (${cambioUnidad})`], ['comp', `Cambio desde ${fb} (${cambioUnidad})`]];
      $('.tabla-mapa thead').innerHTML = `<tr>${cols.map(([k, n]) => `<th data-orden="${k}" class="${k === 'nombre' ? '' : 'num'} ${k === col ? (dir > 0 ? 'asc' : 'desc') : ''}">${n}</th>`).join('')}</tr>`;
      const celdaCambio = (v) => (v == null ? '—' : `<span class="${Math.abs(v) < 1e-9 ? '' : v > 0 ? 'sube-t' : 'baja-t'}">${conSigno(v)}</span>`);
      $('.tabla-mapa tbody').innerHTML = filasT.map((f) => `<tr data-pais="${f.p}" class="${f.p === 'ES' ? 'fila-es' : ''} ${f.p === foco && f.p !== 'ES' ? 'fila-foco' : ''}">
        <td class="num">${f.puesto ?? '—'}</td><td>${f.nombre}</td>
        <td class="num"><strong${f.estimado ? ' title="Último dato disponible" style="font-style:italic"' : ''}>${f.valor == null ? '—' : fmt(f.valor, dec)}</strong></td>
        <td class="num">${celdaCambio(f.anio)}</td><td class="num">${celdaCambio(f.comp)}</td></tr>`).join('');
    }

    /** Guarda en el enlace la fecha, el país, la vista y la fecha de comparación (para compartir esta vista exacta). */
    function guardarVista() {
      ctx.fijarConsulta?.({ f: fechas[indice], c: foco !== 'ES' ? foco : '', v: vista !== 'mapa' ? vista : '', f2: vista !== 'mapa' ? fechas[indice2] : '' });
    }

    let primera = true;
    function mostrar(i) {
      indice = Math.max(0, Math.min(fechas.length - 1, i));
      deslizador.value = indice;
      const fila = tabla[indice];
      const orden = pintarCarrera(fila);
      actualizarTextos(orden, fila);
      pintarCambios();
      pintarTabla();
      if (!reproduciendo) guardarVista();
      const t = trazaMapa(fila);
      if (primera) {
        primera = false;
        return Plotly.newPlot(divMapa, [t], capaGeo(), { ...CONFIG, scrollZoom: false });
      }
      return Plotly.restyle(divMapa, { locations: [t.locations], z: [t.z], customdata: [t.customdata] }, [0]);
    }

    function ponerVista(v) {
      vista = v;
      $('.mapa-layout').dataset.vista = v;
      nodo.querySelectorAll('[data-vista]').forEach((b) => { if (b.tagName === 'BUTTON') { b.classList.toggle('on', b.dataset.vista === v); b.setAttribute('aria-selected', b.dataset.vista === v); } });
      if (divMapa.data) Plotly.restyle(divMapa, { showscale: v !== 'comparar' }, [0]); // en la comparación, una sola leyenda (la de la derecha)
      // Plotly solo puede reajustar el tamaño de un gráfico que ya está en pantalla.
      const ajustar = (div) => { if (div.data && div.offsetParent) Plotly.Plots.resize(div).catch(() => {}); };
      if (v === 'comparar') pintarMapa2().then(() => ajustar(divMapa2));
      requestAnimationFrame(() => ajustar(divMapa));
      if (v !== 'comparar') $('[data-titulo-a]').innerHTML = '';
      pintarCambios();
      pintarTabla();
      guardarVista();
    }

    const ICONO_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
    const ICONO_PAUSA = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    function pintarBoton() {
      botonPlay.innerHTML = reproduciendo ? ICONO_PAUSA : ICONO_PLAY;
      botonPlay.setAttribute('aria-label', reproduciendo ? 'Pausar' : 'Reproducir');
    }
    function parar() {
      const estaba = reproduciendo;
      reproduciendo = false; clearTimeout(reloj); pintarBoton();
      if (estaba) guardarVista(); // durante la animación no se toca el enlace; al parar, sí
    }
    function paso() {
      if (!reproduciendo) return;
      if (indice >= fechas.length - 1) { parar(); return; }
      mostrar(indice + 1);
      reloj = setTimeout(paso, pausa);
    }
    function reproducir() {
      if (reproduciendo) { parar(); return; }
      reproduciendo = true;
      pintarBoton();
      // Si estaba al final, empieza desde el primer periodo con suficientes países.
      if (indice >= fechas.length - 1) {
        const inicio = tabla.findIndex((f) => Object.keys(f).filter((p) => p !== 'EA').length >= 15);
        mostrar(Math.max(0, inicio));
      }
      reloj = setTimeout(paso, sinMovimiento ? 0 : pausa);
    }

    botonPlay.addEventListener('click', reproducir);
    deslizador.addEventListener('input', () => { parar(); mostrar(Number(deslizador.value)); });
    $('.velocidad').addEventListener('click', (e) => {
      const b = e.target.closest('[data-vel]');
      if (!b) return;
      pausa = VELOCIDADES[b.dataset.vel];
      nodo.querySelectorAll('[data-vel]').forEach((x) => x.classList.toggle('on', x === b));
    });
    // Al cambiar de indicador se conserva la vista (mapa, comparar o tabla).
    $('[data-indicador]').addEventListener('change', (e) => { location.hash = `#/mapa/${e.target.value}${vista !== 'mapa' ? `?v=${vista}` : ''}`; });
    $('.vistas-mapa').addEventListener('click', (e) => {
      const b = e.target.closest('[data-vista]');
      if (b && b.dataset.vista !== vista) ponerVista(b.dataset.vista);
    });
    $('[data-f2]').addEventListener('change', (e) => {
      indice2 = Number(e.target.value);
      pintarMapa2();
      pintarCambios();
      pintarTabla();
      guardarVista();
    });
    $('.tabla-mapa').addEventListener('click', (e) => {
      const th = e.target.closest('[data-orden]');
      if (th) {
        const col = th.dataset.orden;
        ordenTabla = { col, dir: ordenTabla.col === col ? -ordenTabla.dir : (col === 'nombre' || col === 'puesto' ? 1 : -1) };
        pintarTabla();
        return;
      }
      const fila = e.target.closest('[data-pais]');
      if (fila) enfocar(fila.dataset.pais);
    });

    // ---- Historia del país elegido
    const hist = tarjeta({
      titulo: 'Historia del país elegido',
      sub: 'Pulsa un país en el mapa o en la clasificación. Siempre se compara con España y con Europa (zona euro o UE-27).',
      fuente: `Eurostat (${info.nombre})`,
    });
    hist.grafico.style.height = '340px';

    async function pintarHistoria() {
      const trazas = [];
      const nombres = {};
      const fuera = [];
      if (foco !== 'ES' && datos[foco]) {
        trazas.push(linea(ctx.nombrePais(foco), datos[foco], getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00e5ff', { sufijo, line: { width: 2.8 } }));
        nombres[ctx.nombrePais(foco)] = datos[foco];
      }
      if (datos.ES) { trazas.push(linea('España', datos.ES, COLORES.ES, { sufijo, line: { width: foco === 'ES' ? 2.8 : 2.2 } })); nombres.España = datos.ES; }
      if (REF) { trazas.push(linea(nombreRef, datos[REF], COLORES[REF], { sufijo, line: { dash: 'dot' } })); nombres[nombreRef] = datos[REF]; }
      hist.el.querySelector('h2').textContent = foco === 'ES' ? 'Historia: España frente a la zona euro' : `Historia: ${ctx.nombrePais(foco)} frente a España`;
      const marca = fechas[indice];
      const base = layout();
      const shapes = [{ type: 'line', xref: 'x', yref: 'paper', x0: marca, x1: marca, y0: 0, y1: 1, line: { color: getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#a855f7', width: 1, dash: 'dot' } }];
      const annotations = [];
      if (ficha.referencia != null) {
        shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: ficha.referencia, y1: ficha.referencia, line: { color: '#94a3b8', width: 1.2, dash: 'dash' } });
        annotations.push({ xref: 'paper', x: 0, y: ficha.referencia, text: ficha.refTexto, showarrow: false, xanchor: 'left', yanchor: 'bottom', font: { size: 11, color: '#94a3b8' } });
      }
      const previstas = await trazasPrevision(id, ['ES', 'EA', foco], sufijo);
      hist.el.querySelector('.sub').textContent = `Pulsa un país en el mapa o en la clasificación. Siempre se compara con España y con Europa (zona euro o UE-27).${previstas.length ? ` ${NOTA_PREVISIONES}` : ''}`;
      dibujar(hist.grafico, [...trazas, ...previstas], {
        shapes, annotations,
        yaxis: { ...base.yaxis, title: { text: ficha.unidad, font: { size: 12 } }, ticksuffix: sufijo },
      });
      const t = Object.fromEntries(Object.entries(nombres));
      const cab = ['Fecha', ...Object.keys(t)];
      const mapas = Object.values(t).map((s) => new Map(s));
      const fs = [...new Set(Object.values(t).flatMap((s) => s.map((p) => p[0])))].sort();
      hist.setDatos({ cabeceras: cab, filas: fs.map((f) => [f, ...mapas.map((m) => m.get(f) ?? '')]) });
    }

    function enfocar(p) {
      if (!p || !UE.includes(p)) return;
      foco = p;
      mostrar(indice);
      pintarHistoria();
      if (p !== 'ES') avisar(`${ctx.nombrePais(p)}: comparando con España`, 'info', 1800);
    }
    carrera.addEventListener('click', (e) => enfocar(e.target.closest('[data-pais]')?.dataset.pais));

    // ---- Tabla del periodo con descarga
    const descargar = document.createElement('button');
    descargar.className = 'btn';
    descargar.textContent = 'Descargar el periodo (CSV)';
    descargar.style.marginTop = '10px';
    descargar.addEventListener('click', () => {
      const fila = tabla[indice];
      descargarCSV(`${id}_${fechas[indice]}.csv`, ['País', 'Código', `Valor (${ficha.unidad})`, 'Fecha', 'Último dato disponible'],
        UE.filter((p) => fila[p]).sort((a, b) => fila[b].v - fila[a].v).map((p) => [ctx.nombrePais(p), p, fila[p].v, fechas[indice], fila[p].estimado ? 'sí' : 'no']));
    });
    carrera.parentElement.appendChild(descargar);

    nodo.appendChild(hist.el);
    nodo.classList.add('rejilla');

    pintarBoton();
    await mostrar(indice);
    divMapa.on('plotly_click', (ev) => enfocar(DE_ISO3[ev.points?.[0]?.location]));
    if (vista !== 'mapa') ponerVista(vista); // el enlace pedía otra vista
    pintarHistoria();

    // Al moverse en el tiempo, la marca vertical del gráfico de historia sigue a la fecha.
    const moverMarca = () => {
      if (!hist.grafico.layout) return;
      Plotly.relayout(hist.grafico, { 'shapes[0].x0': fechas[indice], 'shapes[0].x1': fechas[indice] }); // la 0 es la marca de la fecha
    };
    deslizador.addEventListener('change', moverMarca);
    let ultimaMarca = 0;
    const observarMarca = setInterval(() => { if (ultimaMarca !== indice) { ultimaMarca = indice; moverMarca(); } }, 300);

    const teclas = (e) => {
      if (e.target.closest?.('input, textarea, select, button') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); reproducir(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); parar(); mostrar(indice + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); parar(); mostrar(indice - 1); }
    };
    document.addEventListener('keydown', teclas);
    limpiar = () => { parar(); clearInterval(observarMarca); document.removeEventListener('keydown', teclas); };
  },
};
