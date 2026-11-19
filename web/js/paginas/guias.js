// Guías prácticas para usar los datos en trabajos de clase, informes y el TFG.
import { markdown } from '../investigacion.js';

export const GUIAS = [
  {
    id: 'analizar-inflacion',
    titulo: 'Cómo analizar la inflación para un trabajo de Macroeconomía',
    resumen: 'Qué medida usar, qué gráficos hacer, cómo relacionarla con la política monetaria y qué errores evitar.',
    nivel: 'Grado · Macroeconomía', minutos: 8,
    texto: `
### 1. Elige bien la medida

| Medida | Qué es | Cuándo usarla |
|---|---|---|
| **IPC** (INE) | Índice de Precios de Consumo de España | Para hablar solo de España: es la cifra que dan las noticias |
| **IAPC** (Eurostat) | Índice armonizado: igual metodología en toda la UE | Para **comparar** España con otros países o con la zona euro |
| **Subyacente** | Sin energía ni alimentos | Para ver la **tendencia de fondo**, sin los vaivenes del petróleo |

> Usa siempre la **tasa de variación anual** (este mes frente al mismo mes del año anterior). La mensual tiene mucha estacionalidad (rebajas, turismo) y confunde.

### 2. Los cuatro gráficos que no pueden faltar

1. **General frente a subyacente** desde 2000 ([Inflación y precios](#/inflacion), periodo «Máx.»). Explica las diferencias: cuando la general está muy por encima, el motivo suele ser la energía.
2. **España frente a la zona euro** con el IAPC. Comenta el **diferencial**: si es positivo y duradero, España pierde competitividad frente a sus socios (la portada lo dibuja).
3. **Inflación frente a tipos del BCE** ([Política monetaria](#/monetaria)): fíjate en el retraso con que el BCE reaccionó en 2022 y en cuánto tardó en bajar la inflación después.
4. **El mapa de Europa** ([Mapa](#/mapa/iapc_general)) para mostrar en qué países fue más intensa. La vista «Comparar dos fechas» es muy visual para una presentación.

Activa en la barra lateral «Recesiones y acontecimientos» y «Previsiones oficiales»: añaden contexto (COVID-19, invasión de Ucrania, primera subida del BCE) y las proyecciones del BCE y del Banco de España.

### 3. Relaciónalo con la teoría

- **Objetivo del BCE:** inflación del 2 % a medio plazo, simétrico (preocupa tanto quedarse por debajo como pasarse).
- **Regla de Taylor:** compara el tipo de la facilidad de depósito con lo que «recomendaría» la regla con la inflación de ese momento. En 2022 el tipo real (tipo menos inflación) fue muy negativo.
- **Curva de Phillips:** en [Mercado laboral](#/laboral) tienes la relación entre paro e inflación por subperiodos; verás que cambia mucho según la época.
- **Poder adquisitivo:** con la calculadora de [Inflación y precios](#/inflacion) puedes decir, por ejemplo, cuánto dinero de 2015 equivale a hoy.

### 4. Estructura recomendada

1. Introducción y pregunta (por ejemplo, «¿Por qué la inflación de España fue distinta a la de la zona euro entre 2021 y 2024?»).
2. Marco teórico (objetivo del BCE, causas de oferta y de demanda).
3. Datos y fuentes (IPC del INE, IAPC de Eurostat, tipos del BCE), con su cita.
4. Análisis con los gráficos.
5. Perspectivas: qué prevén el BCE y el Banco de España.
6. Conclusiones y bibliografía (el [informe en PDF](#/informe) te la genera).

### 5. Errores frecuentes

- Decir que «los precios bajan» cuando la inflación baja: si pasa del 5 % al 3 %, los precios **siguen subiendo**, solo que más despacio.
- Mezclar IPC e IAPC en la misma comparación entre países.
- Olvidar el **efecto base**: una caída fuerte de la tasa puede deberse a que hace un año hubo una subida muy grande.
- No citar la fuente ni la fecha del último dato: la inflación se revisa y cambia cada mes.
`,
  },
  {
    id: 'regresion-tfg',
    titulo: 'Cómo hacer una regresión para tu TFG paso a paso',
    resumen: 'De la pregunta a la tabla de resultados: estacionariedad, MCO con errores robustos, interpretación y diagnóstico.',
    nivel: 'TFG · Econometría', minutos: 12,
    texto: `
> El laboratorio econométrico funciona en la **versión de escritorio** (gratuita): descárgala desde GitHub y ejecuta \`python servidor.py\`. Aquí tienes el método completo.

### Paso 1. Una pregunta concreta

Mal: «estudiar el paro». Bien: «¿Cuánto se traslada una subida del euríbor al tipo de las nuevas hipotecas, y con cuántos meses de retraso?». La pregunta decide la variable dependiente (Y) y las explicativas (X).

### Paso 2. Elige y mira los datos

En el [Laboratorio](#/laboratorio) elige Y y las X, el país y el periodo. Antes de estimar nada, **dibuja las series**: ¿hay saltos raros, cambios de base, la COVID-19? Anota la frecuencia: si mezclas datos mensuales y trimestrales, el panel pasa todo a trimestral.

### Paso 3. Comprueba la estacionariedad (test ADF)

Muchas series económicas (precios, PIB, deuda) tienen **tendencia**. Si haces una regresión entre dos series con tendencia, te puede salir una relación «significativa» que no existe: es la **regresión espuria**.

| Resultado del ADF | Qué significa | Qué hacer |
|---|---|---|
| p-valor < 0,05 | Estacionaria | Puedes usarla en niveles |
| p-valor ≥ 0,05 | Tiene raíz unitaria | Usa **primeras diferencias (Δ)** o la **tasa interanual** |

El laboratorio te avisa automáticamente si alguna variable no es estacionaria.

### Paso 4. Estima por MCO con errores robustos

Marca **errores Newey-West (HAC)**: en series temporales los residuos suelen estar autocorrelacionados y los errores clásicos exageran la significación. El número de retardos se elige solo (L = ⌊4(n/100)^(2/9)⌋).

### Paso 5. Interpreta bien

- **Coeficiente:** cuánto cambia Y cuando X sube una unidad, manteniendo constante lo demás. Si usas diferencias, habla de **cambios**: «cuando el euríbor sube 1 punto, el tipo de las hipotecas sube 0,7 puntos».
- **p-valor < 0,05:** el efecto es estadísticamente distinto de cero al 5 %. No dice si es grande ni si es causal.
- **R²:** proporción de la variación de Y que explica el modelo. En diferencias es normal que sea bajo; no es un defecto.
- **Intervalo de confianza al 95 %:** el rango de valores plausibles del coeficiente. Es lo más informativo para el lector.

### Paso 6. Diagnóstico y robustez

- **Durbin-Watson** cerca de 2: bien. Por debajo de 1: autocorrelación fuerte (los errores Newey-West ayudan, pero revisa el modelo).
- **Gráfico de residuos:** busca patrones o rachas (por ejemplo, durante la COVID-19).
- **Robustez:** repite la estimación en otro periodo (antes y después de 2020) y con otra medida de la variable. Si el resultado aguanta, es mucho más creíble.

### Paso 7. Exporta y cita

El botón «Exportar a Excel» genera una hoja con los datos limpios, la tabla de la regresión, los estadísticos descriptivos y la **cita APA de cada serie**. Copia la tabla al TFG con este formato:

| Variable | Coeficiente | Error estándar (HAC) | p-valor |
|---|---|---|---|
| Constante | … | … | … |
| Δ Euríbor (t−1) | … | … | … |

y añade debajo: n, R² ajustado, tipo de errores y periodo muestral.

### Cuidado con

- **Correlación no es causalidad:** que dos variables se muevan juntas no prueba que una cause la otra. Explica el mecanismo económico.
- **Pocas observaciones:** con menos de 30 los resultados son poco fiables (el laboratorio te avisa).
- **Variables omitidas:** si falta un factor importante, los coeficientes estarán sesgados. Justifica qué controles incluyes.
`,
  },
  {
    id: 'que-indicador',
    titulo: 'Qué indicador usar para cada pregunta',
    resumen: 'Una tabla rápida: pregunta de investigación → indicador → dónde encontrarlo en el panel.',
    nivel: 'Todos los niveles', minutos: 4,
    texto: `
| Si quieres saber… | Usa | Dónde |
|---|---|---|
| Cuánto suben los precios en España | IPC general (variación anual) | [Inflación](#/inflacion) |
| La tendencia de fondo de los precios | IPC o IAPC subyacente | [Inflación](#/inflacion) |
| Si España tiene más inflación que Europa | IAPC de España y de la zona euro | [Inflación](#/inflacion) · [Mapa](#/mapa/iapc_general) |
| Cuánto vale hoy el dinero de otro año | Índice del IPC (calculadora) | [Inflación](#/inflacion) |
| Cómo va el empleo | Tasa de paro armonizada (Eurostat, mensual y comparable entre países) | [Mercado laboral](#/laboral) |
| La situación de los jóvenes | Paro de menores de 25 años | [Mercado laboral](#/laboral) · [Mapa](#/mapa/paro_jovenes) |
| Cuántos jóvenes están descolgados | Jóvenes que ni estudian ni trabajan (tasa NEET) | [Jóvenes y tecnología](#/jovenes) · [Mapa](#/mapa/ninis) |
| Si los jóvenes están preparados para la economía digital | Competencias digitales (16-24) y estudios superiores (25-34) | [Jóvenes y tecnología](#/jovenes) |
| Cuánto usan los jóvenes la inteligencia artificial | Uso de IA generativa por edad y para trabajar (desde 2025) | [Jóvenes y tecnología](#/jovenes) · [Mapa](#/mapa/ia_generativa_jovenes) |
| Cuánto ha entrado la IA en las empresas | Empresas que usan inteligencia artificial | [Jóvenes y tecnología](#/jovenes) · [Mapa](#/mapa/empresas_ia) |
| Si la economía crece | PIB real, variación interanual | [Mapa](#/mapa/pib_var) |
| Si el BCE sube o baja tipos | Tipo de la facilidad de depósito | [Política monetaria](#/monetaria) |
| Cuánto cuesta una hipoteca | Euríbor a 12 meses y tipo de las nuevas hipotecas | [Política monetaria](#/monetaria) |
| Si la vivienda es más cara | Índice de precios de vivienda (INE) | [Vivienda](#/vivienda) |
| Si la vivienda es más asequible | Precio de la vivienda frente al coste salarial (índice de esfuerzo) | [Vivienda](#/vivienda) |
| Cuánto paga España por endeudarse | Rentabilidad del bono a 10 años y prima de riesgo | [Finanzas públicas](#/finanzas) |
| Si las cuentas públicas cuadran | Saldo público (% del PIB) | [Finanzas públicas](#/finanzas) · [Mapa](#/mapa/saldo_publico) |
| Cuánto debe el Estado | Deuda pública (% del PIB) | [Finanzas públicas](#/finanzas) · [Mapa](#/mapa/deuda_publica) |
| Qué esperan los expertos | Previsiones del BCE y del Banco de España | Activa «Previsiones oficiales» |

### Tres consejos

1. **Compara siempre con algo:** con la zona euro, con otro país o con el pasado. Un dato aislado («el paro es del 10 %») dice poco.
2. **Fíjate en la unidad:** no es lo mismo un % de variación, un % del PIB o un índice (2015 = 100). El mapa la indica en cada indicador.
3. **Indica la fecha del dato:** la economía cambia cada mes; «último dato disponible: septiembre de 2026» da rigor al trabajo.
`,
  },
];

export default {
  titulo: 'Guías',
  render(nodo, ctx) {
    nodo.className = 'rejilla';
    const guia = GUIAS.find((g) => g.id === ctx.parametro);
    if (guia) {
      const i = GUIAS.indexOf(guia);
      const siguiente = GUIAS[(i + 1) % GUIAS.length];
      nodo.innerHTML = `
        <header class="cabecera"><span class="etiqueta"><a href="#/guias">Guías</a> · ${guia.nivel} · ${guia.minutos} min de lectura</span>
          <h1><span class="degradado">${guia.titulo}</span></h1><p>${guia.resumen}</p></header>
        <article class="card texto-largo md guia">${markdown(guia.texto)}</article>
        <a class="card siguiente-guia" href="#/guias/${siguiente.id}"><small>Siguiente guía</small><strong>${siguiente.titulo} →</strong></a>`;
      return;
    }
    nodo.innerHTML = `
      <header class="cabecera"><span class="etiqueta">Aprender a usar los datos</span>
        <h1><span class="degradado">Guías</span> para trabajos y TFG</h1>
        <p>Cómo pasar de los datos a un buen trabajo: qué indicador elegir, cómo analizarlo y cómo citarlo.
        Puedes usarlas y compartirlas libremente (licencia CC BY 4.0).</p></header>
      <div class="guias-grid">${GUIAS.map((g) => `
        <a class="guia-tarjeta" href="#/guias/${g.id}">
          <span class="etiqueta">${g.nivel} · ${g.minutos} min</span>
          <strong>${g.titulo}</strong><p>${g.resumen}</p><em>Leer la guía →</em>
        </a>`).join('')}</div>
      <section class="card texto-largo">
        <h2>Más herramientas para tu trabajo</h2>
        <ul>
          <li><a href="#/informe">Informe en PDF</a>: gráficos, comentario automático de los datos y bibliografía en APA.</li>
          <li><a href="#/insertar">Insertar gráficos</a> en tu blog, apuntes o web.</li>
          <li><a href="#/sobre">Cómo citar el observatorio</a> y las fuentes originales.</li>
        </ul>
      </section>`;
  },
};
