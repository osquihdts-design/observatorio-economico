// Sobre el proyecto: quién lo hace, de dónde salen los datos, cómo se elaboran, licencias, cómo citar y registro de cambios.
import { get, REPOSITORIO } from '../api.js';
import { fmt } from '../graficos.js';
import { copiar, markdown } from '../investigacion.js';

export const WEB_PUBLICA = 'https://osquihdts-design.github.io/observatorio-economico/';
const ANIO = new Date().getFullYear();
export const CITA_WEB = `Observatorio económico. (${ANIO}). Observatorio económico: España frente a Europa [Aplicación web]. ${WEB_PUBLICA}`;

const FUENTES = [
  ['Instituto Nacional de Estadística (INE)', 'IPC, IPC subyacente, EPA, precio de la vivienda, coste laboral',
    'API JSON Tempus3', 'CC BY 4.0, citando la fuente', 'https://ine.es/dyngs/AYU/es/index.htm?cid=125'],
  ['Eurostat', 'IAPC, paro armonizado, PIB, vivienda, bono a 10 años, deuda y saldo públicos (27 países)',
    'API de difusión (JSON-stat 2.0)', 'Reutilización libre citando la fuente (CC BY 4.0)', 'https://ec.europa.eu/eurostat/help/copyright-notice'],
  ['Banco Central Europeo (BCE)', 'Tipos oficiales, euríbor, tipo de las hipotecas, M3',
    'ECB Data Portal (CSV)', 'Reutilización libre citando «Fuente: estadísticas del BCE»', 'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html'],
];

const CAMBIOS = [
  ['2026-11-20', 'Comprobación diaria de los datos con las fuentes oficiales, ejes con su unidad en todos los gráficos y enfoque descriptivo: colores y textos sin juicios de valor.'],
  ['2026-11-20', 'Salario medio bruto de los jóvenes por edad (INE) y paro juvenil según el nivel de estudios (Eurostat).'],
  ['2026-11-19', 'Página «Jóvenes, empleo y tecnología»: ninis, empleo juvenil, formación, competencias digitales e inteligencia artificial (Eurostat), con la UE-27 como referencia.'],
  ['2026-11-19', 'Guías para trabajos, informe en PDF, gráficos para insertar y página «Sobre el proyecto»; licencia CC BY 4.0.'],
  ['2026-11-19', 'Previsiones oficiales del BCE y del Banco de España en los gráficos; calendario de próximos datos.'],
  ['2026-11-19', 'Enlaces que guardan la vista para compartir; bandas de recesión y acontecimientos; mapa con vistas de comparación y tabla.'],
  ['2026-11-19', 'Ficha de cada indicador del mapa (unidades, cómo leerlo y referencias).'],
  ['2026-11-19', 'Versión pública en GitHub Pages, actualizada cada día.'],
  ['2026-11-18', 'Centro de investigación con citas y sincronización con Obsidian (solo en la versión de escritorio).'],
  ['2026-11-18', 'Mapa animado de los 27 países, radar de posición europea, paleta de comandos y nuevo diseño.'],
  ['2026-11-18', 'Página de finanzas públicas: prima de riesgo, bono a 10 años, deuda y déficit.'],
  ['2026-11-16', 'Laboratorio econométrico (MCO con Newey-West, ADF, filtro HP, correlación cruzada) y exportación a Excel con citas APA.'],
  ['2026-11-16', 'Primera versión: datos del INE, Eurostat y BCE con 23 indicadores.'],
];

const METODO = `
### Cómo se elaboran los datos

- **Enfoque descriptivo:** el panel muestra los datos sin calificarlos. Los colores indican si un valor es más alto o más bajo, nunca si es «bueno» o «malo», y las únicas líneas de referencia son objetivos oficiales (el 2 % del BCE, los límites fiscales de la UE o las metas europeas para 2030).
- **Sin retoques:** los valores son los publicados por cada organismo. El panel solo los reorganiza en un formato común (fecha, indicador, país, valor, unidad, fuente y código de la serie).
- **Inflación de Eurostat:** en 2026 Eurostat pasó a la nueva clasificación de consumo ECOICOP 2. Para tener una serie continua se unen la tabla antigua (\`prc_hicp_manr\`, hasta diciembre de 2025) y la nueva (\`prc_hicp_minr\`, desde enero de 2026).
- **Tipos del BCE y euríbor:** el BCE publica datos diarios. El panel toma el **último valor de cada mes** (elaboración propia).
- **Índices del INE:** en algunos gráficos se cambia la base a 2015 = 100 para comparar con Eurostat (elaboración propia).
- **Mapa:** si un país todavía no ha publicado el último periodo, se muestra su dato anterior (como mucho 12 periodos atrás) y se indica en cursiva.
- **Recesiones:** son las fechadas por el comité del CEPR-EABCN para la zona euro (2008-2009, 2011-2013 y 2020).
- **Previsiones:** se copian a mano de las publicaciones del BCE y del Banco de España, con su fecha y enlace, y se actualizan cuando sale una edición nueva.

### Cada cuánto se actualiza

Todos los días a las **07:30 UTC** (08:30 en invierno y 09:30 en verano, hora peninsular), un proceso automático en GitHub descarga los datos de las tres fuentes, pasa los tests y vuelve a publicar la web. Si alguna fuente falla ese día, se publica con lo que haya y queda registrado. El calendario de la portada indica cuándo sale cada dato nuevo.
`;

export default {
  titulo: 'Sobre el proyecto',
  async render(nodo) {
    nodo.className = 'rejilla';
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Transparencia · fuentes · licencia</span>
        <h1>Sobre el <span class="degradado">proyecto</span></h1>
        <p>Un panel gratuito y abierto para seguir la economía española frente a Europa con datos oficiales, pensado para
        estudiantes, profesores y cualquiera que necesite datos fiables para un trabajo o un informe.</p></header>

      <section class="card texto-largo">
        <h2>Quién lo hace</h2>
        <p>Es el proyecto personal de un estudiante de Economía. No tiene publicidad ni recoge datos personales, y el código es abierto:
        cualquiera puede revisar cómo se descarga y calcula cada cifra en <a href="${REPOSITORIO}" target="_blank" rel="noopener">GitHub</a>.</p>
        <p>¿Has visto un error o echas en falta un indicador? Escríbelo en las
        <a href="${REPOSITORIO}/issues" target="_blank" rel="noopener">sugerencias del proyecto (GitHub)</a>.</p>
      </section>

      <section class="card">
        <h2>De dónde salen los datos</h2>
        <div class="tabla-wrap"><table>
          <thead><tr><th>Fuente</th><th>Qué se usa</th><th>Cómo se descarga</th><th>Condiciones de uso</th></tr></thead>
          <tbody>${FUENTES.map(([f, que, como, lic, url]) => `<tr><td><strong>${f}</strong></td><td>${que}</td><td>${como}</td>
            <td><a href="${url}" target="_blank" rel="noopener">${lic} ↗</a></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="fuente-nota">Ni el INE, ni Eurostat, ni el BCE participan en este proyecto ni lo respaldan, y no son responsables del uso que se hace aquí de sus datos.</p>
      </section>

      <section class="card texto-largo md">${markdown(METODO)}</section>

      <section class="card" id="verificacion"></section>

      <section class="card texto-largo">
        <h2>Cómo citarlo</h2>
        <p>Para citar la web en un trabajo (APA 7.ª):</p>
        <div class="cita-caja"><p>${CITA_WEB}</p><button class="btn" data-copiar-web>❝ Copiar</button></div>
        <p>Lo más riguroso es citar también la <strong>fuente original</strong> de cada dato. Cada gráfico tiene un botón «Datos» que
        incluye el código de la serie, y el <a href="#/informe">informe en PDF</a> añade la bibliografía completa en APA. Si transformas los datos
        (por ejemplo, calculando medias), indícalo: «Elaboración propia con datos del INE, Eurostat y el BCE».</p>
      </section>

      <section class="card texto-largo">
        <h2>Licencia</h2>
        <p>Los textos, gráficos y explicaciones de esta web se publican con licencia
        <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="noopener"><strong>Creative Commons Reconocimiento 4.0 (CC BY 4.0)</strong></a>:
        puedes copiarlos, adaptarlos y usarlos en trabajos, apuntes, artículos o presentaciones, también con fines comerciales,
        siempre que cites la fuente («Observatorio económico») con un enlace a la web e indiques si has hecho cambios.</p>
        <p>Los datos siguen siendo de sus organismos y se rigen por sus condiciones (tabla de arriba): básicamente, citar siempre la fuente original
        y avisar cuando se han transformado.</p>
      </section>

      <section class="card">
        <h2>Registro de cambios</h2>
        <ol class="registro">${CAMBIOS.map(([f, t]) => `<li><time>${new Date(`${f}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</time><span>${t}</span></li>`).join('')}</ol>
        <p class="fuente-nota">El historial completo, cambio a cambio, está en <a href="${REPOSITORIO}/commits/main" target="_blank" rel="noopener">GitHub</a>.</p>
      </section>`;
    nodo.querySelector('[data-copiar-web]').addEventListener('click', () => copiar(CITA_WEB, 'Cita de la web'));
    const caja = nodo.querySelector('#verificacion');
    const v = await get('verificacion').catch(() => ({}));
    if (!v.resultados?.length) {
      caja.innerHTML = '<h2>Comprobación con las fuentes oficiales</h2><p class="sub">Todavía no hay ninguna comprobación guardada.</p>';
    } else {
      const r = v.resumen, total = v.resultados.length;
      const fecha = new Date(v.fecha).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const ESTADOS = { coincide: 'Coincide', dato_nuevo: 'Hay un dato más reciente', no_coincide: 'No coincide', sin_dato_oficial: 'Sin dato oficial', error_fuente: 'Fuente no disponible' };
      const num = (x, u) => (x == null ? '—' : `${fmt(x, u === '€' ? 0 : 2)}${u === '€' ? ' €' : u?.startsWith('%') ? ' %' : ''}`);
      caja.innerHTML = `<h2>Comprobación con las fuentes oficiales</h2>
        <p class="sub">Cada día, después de descargar los datos, un programa independiente (<code>scripts/verificar_datos.py</code>) pide a cada organismo
        su último dato con una consulta propia y lo compara con el que muestra el panel.</p>
        <p style="font-size:1.05rem"><strong>${r.coincide} de ${total}</strong> datos coinciden con la fuente oficial${r.dato_nuevo ? ` · ${r.dato_nuevo} con un dato más reciente pendiente de descargar` : ''}${r.no_coincide ? ` · <strong>${r.no_coincide} no coinciden</strong>` : ''}${r.error_fuente ? ` · ${r.error_fuente} sin respuesta de la fuente` : ''}.
        <span class="fuente-nota">Última comprobación: ${fecha}.</span></p>
        <details><summary>Ver el detalle dato a dato</summary>
        <div class="tabla-wrap"><table>
          <thead><tr><th>Indicador</th><th>País</th><th>Fuente</th><th>Periodo</th><th>Panel</th><th>Fuente oficial</th><th>Resultado</th></tr></thead>
          <tbody>${v.resultados.map((x) => `<tr><td>${x.nombre}</td><td>${x.pais}</td><td>${x.fuente}</td><td>${x.periodo_oficial || x.periodo_panel || '—'}</td>
            <td>${num(x.valor_panel, x.unidad)}</td><td>${num(x.valor_oficial, x.unidad)}</td><td>${ESTADOS[x.estado] || x.estado}</td></tr>`).join('')}</tbody>
        </table></div></details>`;
    }
  },
};
