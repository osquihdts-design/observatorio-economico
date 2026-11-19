// Jóvenes, empleo y tecnología: situación laboral de los jóvenes, formación y llegada de la inteligencia artificial.
// Todos los datos son oficiales (Eurostat) y se actualizan solos cuando Eurostat publica un año nuevo.
import { series } from '../api.js';
import { aTabla, COLORES, dibujar, fechaTexto, fmt, linea, tarjeta } from '../graficos.js';
import { markdown } from '../investigacion.js';

// sentido: 1 = más es mejor · -1 = más es peor · 0 = neutro
const TARJETAS = [
  { id: 'paro_jovenes', titulo: 'Paro juvenil (menores de 25)', sentido: -1, ref: 'EA' },
  { id: 'ninis', titulo: 'Ni estudian ni trabajan (15-29)', sentido: -1, ref: 'UE' },
  { id: 'empleo_jovenes', titulo: 'Jóvenes con empleo (15-24)', sentido: 1, ref: 'UE' },
  { id: 'ia_generativa_jovenes', titulo: 'Jóvenes que usan IA generativa', sentido: 0, ref: 'UE' },
  { id: 'ia_generativa_trabajo', titulo: 'Jóvenes que usan IA para trabajar', sentido: 0, ref: 'UE' },
  { id: 'empresas_ia', titulo: 'Empresas que usan IA', sentido: 0, ref: 'UE' },
];
const ANUALES = ['ninis', 'empleo_jovenes', 'abandono_escolar', 'titulados_superiores', 'competencias_digitales_jovenes',
  'especialistas_tic', 'empresas_ia', 'ia_generativa_jovenes', 'ia_generativa_total', 'ia_generativa_trabajo'];

const PARA_TU_TRABAJO = `
### Preguntas de investigación que puedes contestar con estos datos

- ¿Tienen los jóvenes españoles **peor acceso al empleo** que los europeos? (paro juvenil, tasa de empleo y ninis frente a la UE).
- ¿Están **mejor formados** que hace diez años y que la media europea? (titulados superiores, abandono escolar).
- ¿Están **preparados para un mercado laboral digital**? (competencias digitales, especialistas TIC).
- ¿Usan los jóvenes la IA **más que el resto de la población**? ¿Y para trabajar? (IA generativa por edad y uso profesional).
- ¿Avanzan las empresas españolas en IA **al mismo ritmo** que las europeas? (empresas que usan IA, 2021-2025).

### Cómo interpretarlos bien

- **Paro juvenil y tasa de empleo no son lo contrario.** El paro se calcula sobre quienes trabajan o buscan trabajo; la tasa de empleo, sobre *todos* los jóvenes (muchos estudian). Un país puede tener poco empleo juvenil simplemente porque sus jóvenes estudian más.
- **Los «ninis» son el mejor indicador de exclusión**: incluyen a quienes ya no buscan empleo.
- **IA generativa: solo hay un año (2025).** Sirve para comparar países y edades, todavía no para ver tendencias.
- **Estos datos miden comportamientos, no opiniones.** Para la *perspectiva* de los jóvenes (miedo a perder el empleo por la IA, expectativas, satisfacción) necesitas encuestas de opinión. Combinar ambas cosas es lo que da fuerza a un trabajo de Sociología.

### Fuentes oficiales para la perspectiva subjetiva (complementarias)

- **Injuve** — *Informe Juventud en España*, la gran encuesta periódica sobre los jóvenes españoles: https://www.injuve.es
- **CIS** — barómetros y estudios con preguntas sobre empleo, tecnología e inteligencia artificial: https://www.cis.es
- **Eurobarómetro** — encuestas de la Comisión Europea, incluidas las dedicadas a la juventud y a la digitalización: https://europa.eu/eurobarometer
- **Consejo de la Juventud de España** — *Observatorio de Emancipación* (empleo, salarios y vivienda de los jóvenes): https://www.cje.org

### Cómo citar

Cada gráfico tiene un botón «Datos» con el código de la tabla de Eurostat. Ejemplo de cita APA:

> Eurostat. (2026). *Young people neither in employment nor in education and training (NEET)* (edat_lfse_20) [Conjunto de datos]. https://ec.europa.eu/eurostat/databrowser/view/edat_lfse_20/default/table

El [informe en PDF](#/informe) incluye una sección de jóvenes y tecnología con la bibliografía completa, y la [guía de indicadores](#/guias/que-indicador) te ayuda a elegir qué usar.
`;

function ultimo(serie) { return serie?.length ? serie.at(-1) : null; }

function tarjetaDato(t, datos, ctx) {
  const info = ctx.indicador(t.id);
  const es = ultimo(datos[t.id]?.ES);
  const ref = ultimo(datos[t.id]?.[t.ref]);
  if (!info || !es) return '';
  const dif = ref ? es[1] - ref[1] : null;
  const clase = dif == null || Math.abs(dif) < 0.05 || t.sentido === 0 ? 'neutro' : (dif * t.sentido > 0 ? 'bueno' : 'malo');
  const nombreRef = t.ref === 'EA' ? 'zona euro' : 'UE-27';
  return `<a class="kpi" href="#/mapa/${t.id}" title="${info.nombre} — pulsa para verlo en el mapa de Europa">
    <div class="nombre">${t.titulo}</div>
    <div class="valor"><span data-contar="${es[1]}" data-decimales="1">${fmt(es[1], 1)}</span><small> %</small></div>
    <div class="linea">${dif == null ? '' : `<span class="delta ${clase}">${dif > 0 ? '+' : dif < 0 ? '−' : ''}${fmt(Math.abs(dif), 1)} pp</span>`}
      <span>España · ${fechaTexto(es[0], info.frecuencia)}</span></div>
    ${ref ? `<div class="ref">${nombreRef}: <strong>${fmt(ref[1], 1)} %</strong></div>` : ''}
  </a>`;
}

export default {
  titulo: 'Jóvenes, empleo y tecnología',
  async render(nodo, ctx) {
    // Comparación: España, la UE-27 y los países elegidos en la barra lateral (sin la zona euro, que no está en estas tablas anuales).
    const paises = [...new Set(['ES', 'UE', ...ctx.paises.filter((p) => p !== 'EA')])];
    const [anuales, mensual] = await Promise.all([
      series(ANUALES, { paises, desde: '2010-01-01' }),
      series(['paro_jovenes'], { paises: ctx.paises, desde: ctx.desde, hasta: ctx.hasta }),
    ]);
    if (!ctx.vigente()) return;
    const datos = { ...anuales, ...mensual };
    nodo.className = 'rejilla';
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Eurostat · encuestas de población activa, educación y uso de las TIC</span>
        <h1>Jóvenes, empleo y <span class="degradado">tecnología</span></h1>
        <p>¿Cómo les va a los jóvenes en el mercado laboral, están preparados para una economía digital y cuánto ha entrado ya la
        inteligencia artificial en sus vidas y en las empresas? Datos oficiales de Eurostat, comparando España con la Unión Europea,
        que se actualizan solos cada vez que se publica un año nuevo.</p></header>
      <div class="kpis kpis-jovenes">${TARJETAS.map((t) => tarjetaDato(t, datos, ctx)).join('')}</div>
      <p class="fuente-nota">pp = puntos porcentuales de diferencia entre España y la referencia europea. Pulsa una tarjeta para ver los 27 países en el mapa.</p>
      <h2 class="titulo-bloque">1. La situación laboral de los jóvenes</h2>`;

    const nombre = (p) => ctx.nombrePais(p);
    const anchoDe = (p) => (p === 'ES' || p === 'UE' || p === 'EA' ? 2.8 : 1.8);
    const grafico = (id, titulo, sub, contenedor = nodo, extra = {}) => {
      const info = ctx.indicador(id);
      const d = datos[id] || {};
      const orden = Object.keys(d).filter((p) => d[p]?.length).sort((a, b) => (a === 'ES' ? -1 : b === 'ES' ? 1 : 0));
      if (!info || !orden.length) return null;
      const t = tarjeta({ titulo, sub: `${info.unidad}. ${sub}`, fuente: `Eurostat (${info.nombre})` });
      contenedor.appendChild(t.el);
      const anual = info.frecuencia === 'A';
      // Datos anuales: eje con años enteros y sin las líneas de acontecimientos (son para datos mensuales).
      const anios = new Set(orden.flatMap((p) => d[p].map((x) => x[0].slice(0, 4))));
      const ejeAnual = anual ? { eventos: false, xaxis: { tickformat: '%Y', ...(anios.size <= 8 ? { dtick: 'M12' } : {}) } } : {};
      dibujar(t.grafico, orden.map((p) => linea(nombre(p), d[p], COLORES[p] || '#6C757D',
        { sufijo: ' %', line: { width: anchoDe(p), dash: p === 'UE' || p === 'EA' ? 'dot' : 'solid' },
          extra: anual ? { mode: 'lines+markers', hovertemplate: `%{y:.1f} %<extra>${nombre(p)} · %{x|%Y}</extra>` } : {} })),
      { yaxis: { ticksuffix: ' %' }, ...ejeAnual, ...extra });
      t.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${nombre(p)} (%)`, d[p]]))));
      return t;
    };
    const fila = (clase = 'dos') => { const f = document.createElement('div'); f.className = `rejilla ${clase}`; nodo.appendChild(f); return f; };

    // 1. Situación laboral
    grafico('paro_jovenes', 'Paro de los menores de 25 años', 'Mensual y desestacionalizado. Es el dato más reciente que hay.');
    const f1 = fila();
    grafico('ninis', 'Jóvenes que ni estudian ni trabajan (15-29)', 'Incluye a quienes ya no buscan empleo.', f1);
    grafico('empleo_jovenes', 'Jóvenes con empleo (15-24)', 'Sobre todos los jóvenes, estudien o no.', f1);

    // 2. Formación
    nodo.insertAdjacentHTML('beforeend', '<h2 class="titulo-bloque">2. Formación: ¿preparados para un mercado laboral tecnológico?</h2>');
    const f2 = fila();
    grafico('titulados_superiores', 'Jóvenes con estudios superiores (25-34)', 'FP superior, grado, máster o doctorado.', f2);
    grafico('abandono_escolar', 'Abandono temprano de la educación (18-24)', 'Como mucho la ESO y sin seguir estudiando.', f2);
    grafico('competencias_digitales_jovenes', 'Jóvenes con competencias digitales al menos básicas (16-24)', 'Información, comunicación, creación de contenidos, seguridad y resolución de problemas.');

    // 3. Inteligencia artificial
    nodo.insertAdjacentHTML('beforeend', '<h2 class="titulo-bloque">3. La inteligencia artificial ya está aquí</h2>');
    const ia = ['ia_generativa_jovenes', 'ia_generativa_trabajo', 'ia_generativa_total'].map((id) => ctx.indicador(id)).filter(Boolean);
    const paisesIA = paises.filter((p) => ia.some((i) => datos[i.id]?.[p]?.length));
    if (ia.length && paisesIA.length) {
      const t = tarjeta({ titulo: 'Uso de la IA generativa por edad y para trabajar (2025)',
        sub: 'Han usado herramientas como ChatGPT, Gemini o Copilot en los últimos 3 meses. Eurostat lo pregunta desde 2025.',
        fuente: 'Eurostat (isoc_ai_iaiu)' });
      nodo.appendChild(t.el);
      const colores = ['#C8102E', '#E9A23B', '#4C78A8'];
      const etiquetas = ['Jóvenes (16-24)', 'Jóvenes, para trabajar', 'Toda la población (16-74)'];
      dibujar(t.grafico, ia.map((i, k) => ({
        type: 'bar', name: etiquetas[k], x: paisesIA.map(nombre), y: paisesIA.map((p) => ultimo(datos[i.id]?.[p])?.[1] ?? null),
        marker: { color: colores[k] }, hovertemplate: `%{y:.1f} %<extra>${etiquetas[k]}</extra>`,
        text: paisesIA.map((p) => { const v = ultimo(datos[i.id]?.[p]); return v ? `${fmt(v[1], 0)}` : ''; }), textposition: 'outside',
      })), { barmode: 'group', hovermode: 'closest', yaxis: { ticksuffix: ' %', rangemode: 'tozero' }, eventos: false });
      t.setDatos({ cabeceras: ['País', ...etiquetas.map((e) => `${e} (%)`)], filas: paisesIA.map((p) => [nombre(p), ...ia.map((i) => ultimo(datos[i.id]?.[p])?.[1] ?? '')]) });
    }
    const f3 = fila();
    grafico('empresas_ia', 'Empresas que usan inteligencia artificial', 'Empresas de 10 o más empleados.', f3);
    grafico('especialistas_tic', 'Especialistas en tecnologías de la información', 'Programación, sistemas, redes, datos…', f3);

    // 4. Para tu trabajo
    const trabajo = document.createElement('section');
    trabajo.className = 'card texto-largo md';
    trabajo.innerHTML = `<h2>4. Para tu trabajo o investigación</h2>${markdown(PARA_TU_TRABAJO)}`;
    nodo.appendChild(trabajo);
  },
};
