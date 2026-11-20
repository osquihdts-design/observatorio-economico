// Jóvenes, empleo y tecnología: situación laboral de los jóvenes, formación y llegada de la inteligencia artificial.
// Todos los datos son oficiales (Eurostat e INE) y se actualizan solos cuando se publica un dato nuevo.
import { series } from '../api.js';
import { aTabla, COLORES, dibujar, fechaTexto, fmt, linea, tarjeta, eje } from '../graficos.js';
import { markdown } from '../investigacion.js';

// Tarjetas: España frente a la referencia europea, sin valorar si la diferencia es buena o mala.
const TARJETAS = [
  { id: 'paro_jovenes', titulo: 'Paro juvenil (menores de 25)', ref: 'EA' },
  { id: 'ninis', titulo: 'Ni estudian ni trabajan (15-29)', ref: 'UE' },
  { id: 'empleo_jovenes', titulo: 'Jóvenes con empleo (15-24)', ref: 'UE' },
  { id: 'paro_jovenes_estudios_superiores', titulo: 'Paro juvenil con estudios superiores', ref: 'UE' },
  { id: 'salario_jovenes', titulo: 'Salario medio bruto (16-24)', ref: null },
  { id: 'ia_generativa_jovenes', titulo: 'Jóvenes que usan IA generativa', ref: 'UE' },
  { id: 'ia_generativa_trabajo', titulo: 'Jóvenes que usan IA para trabajar', ref: 'UE' },
  { id: 'empresas_ia', titulo: 'Empresas que usan IA', ref: 'UE' },
];
const ANUALES = ['ninis', 'empleo_jovenes', 'abandono_escolar', 'titulados_superiores', 'competencias_digitales_jovenes',
  'especialistas_tic', 'empresas_ia', 'ia_generativa_jovenes', 'ia_generativa_total', 'ia_generativa_trabajo',
  'salario_jovenes', 'salario_25_34', 'salario_medio'];
const ESTUDIOS = ['paro_jovenes_estudios_bajos', 'paro_jovenes_estudios_medios', 'paro_jovenes_estudios_superiores'];

const PARA_TU_TRABAJO = `
### Preguntas de investigación que puedes contestar con estos datos

- ¿En qué se diferencia el **acceso al empleo** de los jóvenes españoles del de los europeos? (paro juvenil, tasa de empleo y ninis frente a la UE).
- ¿Cómo ha cambiado su **nivel de formación** en diez años y cómo se compara con la media europea? (titulados superiores, abandono escolar).
- ¿Qué **competencias digitales** tienen y cuánto empleo tecnológico hay? (competencias digitales, especialistas TIC).
- ¿Usan los jóvenes la IA **más que el resto de la población**? ¿Y para trabajar? (IA generativa por edad y uso profesional).
- ¿Avanzan las empresas españolas en IA **al mismo ritmo** que las europeas? (empresas que usan IA, 2021-2025).

### Cómo interpretarlos bien

- **Paro juvenil y tasa de empleo no son lo contrario.** El paro se calcula sobre quienes trabajan o buscan trabajo; la tasa de empleo, sobre *todos* los jóvenes (muchos estudian). Un país puede tener poco empleo juvenil simplemente porque sus jóvenes estudian más.
- **Los «ninis» completan al paro**: incluyen también a quienes no buscan empleo. La UE usa esta tasa en sus objetivos para 2030.
- **Salarios: son brutos y medios.** El INE da el salario *bruto* (antes de impuestos y cotizaciones) y lo calcula como el total del año entre 12. Para compararlo con un sueldo *neto* deseado, recuerda que el neto es bastante menor. Además, la media sube por unos pocos sueldos muy altos: el INE también publica la mediana y los deciles.
- **Paro por estudios: fuentes que no coinciden del todo.** Aquí se usa Eurostat (15 a 24 años, trimestral sin desestacionalizar); los informes del Ministerio de Trabajo usan la EPA con 16 a 24 años y su propia agrupación de estudios. Las cifras se parecen pero no son idénticas: cita siempre la fuente y el trimestre.
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
  const clase = 'neutro';
  const nombreRef = t.ref === 'EA' ? 'zona euro' : 'UE-27';
  const euros = info.unidad === '€';
  const u = euros ? ' €' : ' %';
  const dec = 1;
  const enMapa = info.paises.length > 20; // los salarios del INE solo son de España: sin mapa
  return `<a class="kpi" href="${enMapa ? `#/mapa/${t.id}` : '#/jovenes'}" title="${info.nombre}${enMapa ? ' — pulsa para verlo en el mapa de Europa' : ''}">
    <div class="nombre">${t.titulo}</div>
    <div class="valor"><span data-contar="${es[1]}" data-decimales="${dec}">${fmt(es[1], dec)}</span><small>${u}</small></div>
    <div class="linea">${dif == null ? '' : `<span class="delta ${clase}">${dif > 0 ? '+' : dif < 0 ? '−' : ''}${fmt(Math.abs(dif), 1)} pp</span>`}
      <span>España · ${fechaTexto(es[0], info.frecuencia)}</span></div>
    ${ref ? `<div class="ref">${nombreRef}: <strong>${fmt(ref[1], 1)} %</strong></div>` : euros ? '<div class="ref">Antes de impuestos · INE (EPA)</div>' : ''}
  </a>`;
}

export default {
  titulo: 'Jóvenes, empleo y tecnología',
  async render(nodo, ctx) {
    // Comparación: España, la UE-27 y los países elegidos en la barra lateral (sin la zona euro, que no está en estas tablas anuales).
    const paises = [...new Set(['ES', 'UE', ...ctx.paises.filter((p) => p !== 'EA')])];
    const [anuales, mensual, estudios] = await Promise.all([
      series(ANUALES, { paises, desde: '2006-01-01' }),
      series(['paro_jovenes'], { paises: ctx.paises, desde: ctx.desde, hasta: ctx.hasta }),
      series(ESTUDIOS, { paises: ['ES', 'UE'], desde: '2014-01-01' }),
    ]);
    if (!ctx.vigente()) return;
    const datos = { ...anuales, ...mensual, ...estudios };
    nodo.className = 'rejilla';
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Eurostat e INE · encuestas de población activa, educación y uso de las TIC</span>
        <h1>Jóvenes, empleo y <span class="degradado">tecnología</span></h1>
        <p>Situación laboral de los jóvenes, su formación y competencias digitales, y el uso de la inteligencia artificial por los
        jóvenes y por las empresas. Datos oficiales de Eurostat y del INE, comparando España con la Unión Europea,
        que se actualizan solos cada vez que se publica un dato nuevo.</p></header>
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
      const t = tarjeta({ titulo, sub: `${info.unidad}. ${sub}`, fuente: `${info.fuente === 'INE' ? 'INE' : 'Eurostat'} (${info.nombre})` });
      contenedor.appendChild(t.el);
      const anual = info.frecuencia === 'A';
      // Datos anuales: eje con años enteros y sin las líneas de acontecimientos (son para datos mensuales).
      const anios = new Set(orden.flatMap((p) => d[p].map((x) => x[0].slice(0, 4))));
      const ejeAnual = anual ? { eventos: false, xaxis: { tickformat: '%Y', ...(anios.size <= 8 ? { dtick: 'M12' } : {}) } } : {};
      dibujar(t.grafico, orden.map((p) => linea(nombre(p), d[p], COLORES[p] || '#6C757D',
        { sufijo: ' %', line: { width: anchoDe(p), dash: p === 'UE' || p === 'EA' ? 'dot' : 'solid' },
          extra: anual ? { mode: 'lines+markers', hovertemplate: `%{y:.1f} %<extra>${nombre(p)} · %{x|%Y}</extra>` } : {} })),
      { yaxis: eje(info.unidad === '%' ? '% de la población activa menor de 25 años' : info.unidad.charAt(0).toUpperCase() + info.unidad.slice(1), ' %'), ...ejeAnual, ...extra });
      t.setDatos(aTabla(Object.fromEntries(orden.map((p) => [`${nombre(p)} (%)`, d[p]]))));
      return t;
    };
    const fila = (clase = 'dos') => { const f = document.createElement('div'); f.className = `rejilla ${clase}`; nodo.appendChild(f); return f; };


    // Paro según los estudios y salarios por edad: lo que más se relaciona con las expectativas laborales.
    function estudiosYSalarios() {
      const f = fila();
      const niveles = [['paro_jovenes_estudios_bajos', 'Hasta la ESO', '#C8102E'], ['paro_jovenes_estudios_medios', 'Bachillerato o FP media', '#E9A23B'],
        ['paro_jovenes_estudios_superiores', 'FP superior o universidad', '#2A9D8F']];
      const hay = niveles.filter(([id]) => datos[id]?.ES?.length);
      if (hay.length) {
        const t = tarjeta({ titulo: 'Paro juvenil según el nivel de estudios (15-24)',
          sub: '% de los activos de 15 a 24 años. Trimestral y sin desestacionalizar. Línea continua: España · punteada: UE-27.',
          fuente: 'Eurostat (lfsq_urgaed)' });
        f.appendChild(t.el);
        const trazas = [];
        for (const [id, texto, color] of hay) {
          trazas.push(linea(`España · ${texto}`, datos[id].ES, color, { sufijo: ' %', line: { width: 2.6 }, extra: { legendgroup: id } }));
          if (datos[id].UE?.length) {
            trazas.push(linea(`UE-27 · ${texto}`, datos[id].UE, color, { sufijo: ' %', line: { width: 1.4, dash: 'dot' }, extra: { legendgroup: id, showlegend: false } }));
          }
        }
        dibujar(t.grafico, trazas, { yaxis: eje('% de los activos de 15 a 24 años', ' %', { rangemode: 'tozero' }) });
        t.setDatos(aTabla(Object.fromEntries(hay.flatMap(([id, texto]) => [[`España · ${texto} (%)`, datos[id].ES], [`UE-27 · ${texto} (%)`, datos[id].UE || []]]))));
      }
      const salarios = [['salario_jovenes', 'De 16 a 24 años', '#C8102E'], ['salario_25_34', 'De 25 a 34 años', '#E9A23B'], ['salario_medio', 'Todas las edades', '#003399']]
        .filter(([id]) => datos[id]?.ES?.length);
      if (salarios.length) {
        const t = tarjeta({ titulo: 'Salario medio bruto mensual según la edad',
          sub: 'Euros al mes, antes de impuestos y cotizaciones (el sueldo neto es menor). Total del año entre 12, con las pagas extra prorrateadas.',
          fuente: 'INE, Encuesta de Población Activa (decil de salarios del empleo principal)' });
        f.appendChild(t.el);
        dibujar(t.grafico, salarios.map(([id, texto, color]) => linea(texto, datos[id].ES, color,
          { sufijo: ' €', line: { width: id === 'salario_jovenes' ? 2.8 : 2 },
            extra: { mode: 'lines+markers', hovertemplate: `%{y:,.0f} €<extra>${texto} · %{x|%Y}</extra>` } })),
        { eventos: false, xaxis: { tickformat: '%Y' }, yaxis: eje('Euros brutos al mes', ' €', { rangemode: 'tozero' }) });
        t.setDatos(aTabla(Object.fromEntries(salarios.map(([id, texto]) => [`${texto} (€ brutos/mes)`, datos[id].ES]))));
      }
    }

    // 1. Situación laboral
    grafico('paro_jovenes', 'Paro de los menores de 25 años', 'Mensual y desestacionalizado. Es el dato más reciente que hay.');
    const f1 = fila();
    grafico('ninis', 'Jóvenes que ni estudian ni trabajan (15-29)', 'Incluye a quienes ya no buscan empleo.', f1);
    grafico('empleo_jovenes', 'Jóvenes con empleo (15-24)', 'Sobre todos los jóvenes, estudien o no.', f1);
    estudiosYSalarios();

    // 2. Formación
    nodo.insertAdjacentHTML('beforeend', '<h2 class="titulo-bloque">2. Formación y competencias digitales</h2>');
    const f2 = fila();
    grafico('titulados_superiores', 'Jóvenes con estudios superiores (25-34)', 'FP superior, grado, máster o doctorado.', f2);
    grafico('abandono_escolar', 'Abandono temprano de la educación (18-24)', 'Como mucho la ESO y sin seguir estudiando.', f2);
    grafico('competencias_digitales_jovenes', 'Jóvenes con competencias digitales al menos básicas (16-24)', 'Información, comunicación, creación de contenidos, seguridad y resolución de problemas.');

    // 3. Inteligencia artificial
    nodo.insertAdjacentHTML('beforeend', '<h2 class="titulo-bloque">3. Inteligencia artificial: uso y adopción</h2>');
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
      })), { barmode: 'group', hovermode: 'closest', yaxis: eje('% de cada grupo de población', ' %', { rangemode: 'tozero' }), eventos: false });
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
