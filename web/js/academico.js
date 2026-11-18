// Textos del «Modo explicación académica»: metodología, fórmula e interpretación de cada gráfico.

const TEXTOS = {
  kpi: {
    texto: `Cada tarjeta muestra el último dato publicado, su variación respecto al periodo anterior y la referencia de la zona euro.
      El color es contextual: verde si el cambio es favorable (baja el paro, sube el PIB, la inflación se acerca al 2 %) y rojo si es desfavorable.
      El euríbor y la vivienda se muestran en gris porque su subida no es buena ni mala en sí misma.`,
  },
  divergencia: {
    texto: `El diferencial es la resta entre el dato de España y el de la zona euro, en puntos porcentuales (pp).
      Un diferencial de inflación positivo y persistente indica pérdida de competitividad-precio de España dentro de la unión monetaria;
      uno de paro positivo indica un mercado laboral más débil que la media.`,
    formula: 'Diferencial<sub>t</sub> = X<sub>España, t</sub> − X<sub>zona euro, t</sub>',
  },
  ipc: {
    texto: `El IPC mide la variación de precios de una cesta de bienes y servicios representativa del consumo de los hogares (INE).
      La inflación subyacente excluye los alimentos no elaborados y los productos energéticos, que son muy volátiles, para ver la tendencia de fondo.
      La línea punteada marca el objetivo del BCE: una inflación del 2 % a medio plazo (estrategia de 2021, simétrica).`,
    formula: 'π<sub>t</sub> = (IPC<sub>t</sub> / IPC<sub>t−12</sub> − 1) × 100',
  },
  iapc: {
    texto: `El IAPC (Índice Armonizado de Precios de Consumo) usa la misma metodología en todos los países de la UE, por eso es el adecuado para comparar.
      Es el índice que el BCE vigila para su objetivo. Puede diferir algo del IPC del INE por la cobertura (por ejemplo, el tratamiento de algunos servicios).`,
  },
  poder: {
    texto: `Para saber cuánto dinero de hoy equivale a una cantidad del pasado se usa el índice general del IPC.
      La pérdida de poder adquisitivo indica qué parte de la cesta de consumo ya no se puede comprar con la misma cantidad nominal.`,
    formula: 'Equivalente = Cantidad × IPC<sub>final</sub> / IPC<sub>inicial</sub> &nbsp;·&nbsp; Pérdida = 1 − IPC<sub>inicial</sub> / IPC<sub>final</sub>',
  },
  paro: {
    texto: `Tasa de paro armonizada de Eurostat, mensual y desestacionalizada (se elimina el efecto de la temporada).
      Está basada en la definición de la OIT: personas sin empleo, disponibles y que buscan activamente trabajo, sobre la población activa.
      En España coincide en concepto con la EPA del INE, que es trimestral.`,
    formula: 'u<sub>t</sub> = Parados<sub>t</sub> / (Ocupados<sub>t</sub> + Parados<sub>t</sub>) × 100',
  },
  phillips: {
    texto: `La curva de Phillips relaciona inflación y desempleo: cuando el paro es bajo, las empresas compiten por trabajadores, suben los salarios y eso se traslada a precios.
      Cada punto es un mes. Se estima una recta por mínimos cuadrados en cada subperiodo; si las pendientes cambian mucho, hay un cambio estructural
      (por ejemplo, tras la COVID y la crisis energética la relación se volvió más empinada). Ojo: son correlaciones, no prueban causalidad.`,
    formula: 'π<sub>t</sub><sup>subyacente</sup> = α + β · u<sub>t</sub> + ε<sub>t</sub> &nbsp;(se espera β &lt; 0)',
  },
  corredor: {
    texto: `El BCE fija tres tipos oficiales. La facilidad marginal de crédito es el techo (lo que cobra por prestar a un día) y la facilidad de depósito el suelo
      (lo que paga por los depósitos). Desde 2015, con exceso de liquidez, el tipo de depósito es el que realmente guía los tipos del mercado interbancario.
      El euríbor a 12 meses refleja además lo que el mercado espera que hagan los tipos en el próximo año.`,
  },
  transmision: {
    texto: `La transmisión monetaria mide cómo los cambios del BCE llegan a la economía real. Aquí se ve el paso del euríbor (precio del dinero entre bancos)
      al tipo de las nuevas hipotecas (estadística MIR del BCE). En España predominan históricamente las hipotecas variables referenciadas al euríbor,
      por lo que la transmisión suele ser más rápida que en la media de la zona euro.`,
  },
  m3: {
    texto: `M3 es el agregado monetario amplio: efectivo, depósitos y otros instrumentos líquidos. Su crecimiento anticipa a veces la evolución de la inflación
      a medio plazo y refleja cómo responde el crédito a la política monetaria.`,
  },
  vivienda: {
    texto: `El Índice de Precios de Vivienda (IPV, INE) se basa en las compraventas notariales y distingue vivienda nueva y de segunda mano.
      Como la API del INE no indica su año base, aquí todos los índices se rebasan a la media de 2015 = 100 para compararlos con el índice de Eurostat (2015 = 100).`,
    formula: 'Índice<sub>t</sub><sup>(2015=100)</sup> = Índice<sub>t</sub> / media(Índice<sub>2015</sub>) × 100',
  },
  esfuerzo: {
    texto: `El índice de esfuerzo compara la evolución del precio de la vivienda con la del coste salarial por trabajador (ETCL, INE), ambos con base 2015 = 100.
      Como el salario trimestral tiene estacionalidad (pagas extra), se usa la media móvil de los últimos 4 trimestres.
      Si el índice sube por encima de 100, la vivienda se ha encarecido más rápido que los salarios: comprar exige más esfuerzo que en 2015.`,
    formula: 'Esfuerzo<sub>t</sub> = (IPV<sub>t</sub><sup>2015=100</sup> / Salario<sub>t</sub><sup>2015=100</sup>) × 100',
  },
  prima: {
    texto: `La prima de riesgo es lo que paga de más un Estado por financiarse respecto a Alemania, que se toma como referencia «sin riesgo» en la zona euro.
      Refleja la desconfianza de los inversores (riesgo de impago, deuda alta, inestabilidad política). En la crisis de deuda de julio de 2012 la prima española
      superó algún día los 600 puntos básicos (el gráfico usa medias mensuales, por eso su pico es algo menor); el anuncio del BCE de ese mismo mes
      («lo que haga falta») y sus compras de deuda la redujeron.`,
    formula: 'Prima<sub>t</sub> = (r<sub>España, t</sub><sup>10 años</sup> − r<sub>Alemania, t</sub><sup>10 años</sup>) × 100 &nbsp;[puntos básicos]',
  },
  bono: {
    texto: `Rentabilidad de la deuda pública a 10 años en el mercado secundario (la que se usa para el criterio de convergencia de Maastricht).
      Depende de los tipos del BCE, de las expectativas de inflación y del riesgo de cada país.`,
  },
  deuda: {
    texto: `Deuda bruta consolidada de todas las administraciones públicas (Estado, comunidades autónomas, ayuntamientos y Seguridad Social) en % del PIB.
      Las reglas fiscales europeas fijan una referencia del 60 %. Lo relevante para la sostenibilidad no es solo el nivel, sino la diferencia entre
      el tipo de interés que se paga y el crecimiento de la economía.`,
    formula: 'Δd<sub>t</sub> ≈ (r − g)/(1 + g) · d<sub>t−1</sub> − saldo primario<sub>t</sub>',
  },
  deficit: {
    texto: `Diferencia entre ingresos y gastos públicos en % del PIB. Negativo es déficit (el Estado gasta más de lo que ingresa y se endeuda),
      positivo es superávit. La referencia europea es no superar un déficit del 3 %. Aquí los datos trimestrales están corregidos de efectos
      estacionales y de calendario, para que los trimestres se puedan comparar entre sí.`,
  },
  hp: {
    texto: `El filtro de Hodrick-Prescott separa una serie en tendencia (movimiento de largo plazo) y ciclo (desviaciones transitorias).
      λ controla la suavidad: valores habituales son 1.600 para datos trimestrales y 14.400 para mensuales (regla de Ravn-Uhlig).
      Limitación conocida: en los extremos de la serie la tendencia es menos fiable (problema del punto final).`,
    formula: 'min<sub>τ</sub> Σ (y<sub>t</sub> − τ<sub>t</sub>)² + λ Σ [(τ<sub>t+1</sub> − τ<sub>t</sub>) − (τ<sub>t</sub> − τ<sub>t−1</sub>)]²',
  },
  ccf: {
    texto: `La correlación cruzada mide la correlación entre X hoy e Y dentro de k periodos. Un pico en k &gt; 0 indica que X se adelanta a Y.
      Las líneas discontinuas son la banda de significación al 95 % (±1,96/√n): las barras que la superan son estadísticamente distintas de cero.
      Con series no estacionarias las correlaciones salen artificialmente altas: conviene transformarlas antes (diferencias o tasas).`,
    formula: 'r(k) = corr(X<sub>t</sub>, Y<sub>t+k</sub>)',
  },
  ols: {
    texto: `Mínimos cuadrados ordinarios: elige los coeficientes que minimizan la suma de los residuos al cuadrado.
      Los errores robustos de Newey-West corrigen los errores estándar cuando hay heterocedasticidad y autocorrelación, muy habituales en series temporales.
      El test ADF comprueba si cada serie es estacionaria: si no lo son, la regresión puede ser espuria (relación aparente sin base real).
      Durbin-Watson cerca de 2 indica residuos sin autocorrelación; muy por debajo de 2, autocorrelación positiva.
      AIC y BIC sirven para comparar modelos: cuanto más bajos, mejor equilibrio entre ajuste y sencillez.`,
    formula: 'β̂ = (X′X)<sup>−1</sup>X′y &nbsp;·&nbsp; R² = 1 − SCR/SCT &nbsp;·&nbsp; DW = Σ(e<sub>t</sub> − e<sub>t−1</sub>)² / Σe<sub>t</sub>²',
  },
};

export function explicacion(clave) {
  const t = TEXTOS[clave];
  if (!t) return '';
  return `<details class="academico" open>
    <summary>Cómo se calcula y cómo interpretarlo</summary>
    <div class="texto">${t.formula ? `<div class="formula">${t.formula}</div>` : ''}<p>${t.texto}</p></div>
  </details>`;
}
