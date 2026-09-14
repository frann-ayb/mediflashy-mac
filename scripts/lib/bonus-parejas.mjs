/**
 * Bonus: las parejas de conceptos que se confunden.
 *
 * ---------------------------------------------------------------------------
 * De dónde sale este contenido
 * ---------------------------------------------------------------------------
 *
 * NO está escrito para el bonus: son tarjetas que ya viven adentro de la app,
 * en `mazosDeRegalo.ts`, extraídas con un script y ordenadas por materia. Ésa
 * es la garantía de calidad: pasaron por la misma revisión que las otras 1.507
 * y por el mismo control de duplicados.
 *
 * Se eligieron las que CONTRASTAN dos conceptos y no las que definen uno. En
 * Psicología media carrera son parejas que se parecen —represión y negación,
 * ilusión y alucinación, asimilación y acomodación— y lo que se falla en el
 * examen no es la definición suelta: es cuál era cuál.
 *
 * Si alguna cambia en la app, hay que volver a generar este archivo. El script
 * está en el historial del proyecto; el criterio es: frentes que contrastan,
 * de menos de 105 caracteres, 4 por materia, en orden de carrera.
 */

export const PAREJAS_POR_MATERIA = [
  {
    materia: 'Historia de la Psicología',
    parejas: [
      ['¿Cómo distingue Hume las impresiones de las ideas?', 'Las impresiones son percepciones vivas y directas (sensaciones, emociones); las ideas son sus copias más débiles en el recuerdo y la imaginación.'],
      ['¿En qué se diferencian refuerzo negativo y castigo?', 'El refuerzo negativo aumenta la conducta al retirar un estímulo aversivo; el castigo la disminuye, sea aplicando algo aversivo o quitando algo agradable.'],
      ['¿Qué distingue Leibniz entre percepción y apercepción?', 'Hay "pequeñas percepciones" inadvertidas; la apercepción es la percepción acompañada de conciencia. Suele leerse como antecedente de la idea de inconsciente.'],
      ['Represión y negación: ¿en qué se distinguen para Freud?', 'La represión expulsa el contenido de la conciencia; en la negación ("Die Verneinung") el contenido reprimido llega a la conciencia bajo forma negada: "no es mi madre".']
    ]
  },
  {
    materia: 'Psicoanálisis I — Freud',
    parejas: [
      ['Diferencia entre pulsión e instinto', 'Para Freud, el instinto es hereditario, fijo y con objeto predeterminado; la pulsión tiene empuje constante y objeto variable y contingente.'],
      ['Diferencia entre sugestión y psicoanálisis', 'Para Freud, la sugestión implanta ideas y refuerza la represión; el análisis usa la transferencia para levantar las represiones y hacer consciente lo inconsciente.'],
      ['Diferencia entre interpretación y construcción', 'Para Freud, la interpretación se dirige a un elemento aislado (un lapsus, un sueño); la construcción reconstruye un fragmento olvidado de la historia infantil.'],
      ['¿Qué diferencia al preconsciente del inconsciente?', 'Para Freud, lo preconsciente es latente y puede volverse consciente sin más; lo inconsciente está reprimido y solo accede venciendo la censura.']
    ]
  },
  {
    materia: 'Psicoanálisis II — Lacan y posfreudianos',
    parejas: [
      ['¿Cómo distingue Lacan necesidad, demanda y deseo?', 'La necesidad es orgánica; la demanda es lo que se articula al Otro y es siempre demanda de amor; el deseo es el resto que queda cuando se resta la necesidad a la demanda.'],
      ['¿Qué diferencia hay entre el moi y el je en Lacan?', 'El moi es el yo imaginario del narcisismo, formado en la imagen; el je es el sujeto del inconsciente, efecto del orden simbólico.'],
      ['¿Qué diferencia hay entre enunciado y enunciación?', 'El enunciado es lo dicho y la enunciación el acto de decir; para Lacan el sujeto del inconsciente aparece en la enunciación, por ejemplo en el lapsus.'],
      ['¿Cuáles son los tres registros que distingue Lacan?', 'Lo real, lo simbólico y lo imaginario (RSI): tres dimensiones heterogéneas y anudadas entre sí en las que se juega toda experiencia del sujeto.']
    ]
  },
  {
    materia: 'Psicología del Desarrollo',
    parejas: [
      ['¿Qué diferencia hay entre apego y dependencia?', 'Para Bowlby y Ainsworth, el apego es un vínculo selectivo con una figura específica que persiste toda la vida; la dependencia es una condición general de necesidad de otro, que disminuye con la edad.'],
      ['¿Cuál es la diferencia entre pubertad y adolescencia?', 'La pubertad es el proceso biológico de maduración sexual y de cambios corporales; la adolescencia es la construcción psicológica y sociohistórica que cada cultura hace de ese pasaje.'],
      ['¿Cuál es la diferencia entre asimilación y acomodación?', 'Para Piaget, en la asimilación el objeto se transforma para entrar en el esquema; en la acomodación es el esquema el que se transforma para ajustarse al objeto.'],
      ['¿En qué se diferencia el modelo de Erikson del de Freud?', 'Erikson desplaza el acento de lo psicosexual a lo psicosocial, le da al yo un papel autónomo y extiende el desarrollo a ocho etapas que cubren todo el ciclo vital, hasta la vejez.']
    ]
  },
  {
    materia: 'Psicología Cognitiva',
    parejas: [
      ['Umbral absoluto vs. umbral diferencial.', 'El absoluto es la intensidad mínima detectable de un estímulo; el diferencial es la mínima diferencia detectable entre dos estímulos (diferencia apenas perceptible).'],
      ['¿Qué distingue al Sistema 1 del Sistema 2?', 'Para Kahneman y los modelos de proceso dual, el Sistema 1 es rápido, automático, asociativo y sin esfuerzo; el Sistema 2, lento, deliberado, secuencial y costoso: no son zonas del cerebro.'],
      ['¿Qué distingue Saussure entre lengua y habla?', 'La lengua es el sistema social de signos, compartido y virtual; el habla es el uso individual y concreto que cada hablante hace de ese sistema.'],
      ['¿Qué distingue a la atención endógena de la exógena?', 'La endógena es voluntaria, arriba-abajo y relativamente lenta; la exógena es automática, capturada por un estímulo saliente, rápida y difícil de suprimir.']
    ]
  },
  {
    materia: 'Teorías del Aprendizaje',
    parejas: [
      ['¿Cómo se distinguen asimilación y acomodación?', 'En Piaget la asimilación adapta la realidad al esquema y la acomodación adapta el esquema a la realidad. Son inseparables en todo acto de conocimiento.'],
      ['¿Por qué Bandura distingue aprendizaje de ejecución?', 'Porque una conducta puede estar aprendida por observación y no manifestarse: la ejecución depende de los incentivos y las expectativas del momento.'],
      ['¿Qué diferencia hay entre castigo positivo y castigo negativo?', 'El positivo agrega un estímulo aversivo; el negativo retira uno agradable (costo de respuesta). Ambos buscan disminuir la conducta.'],
      ['¿Qué diferencia hay entre reforzamiento continuo e intermitente?', 'El continuo refuerza cada respuesta y acelera la adquisición; el intermitente refuerza algunas y hace la conducta mucho más resistente a la extinción.']
    ]
  },
  {
    materia: 'Bases Biológicas del Comportamiento',
    parejas: [
      ['Diferencia entre PEPS y PIPS', 'El potencial excitatorio postsináptico (PEPS) despolariza y acerca la neurona al umbral; el inhibitorio (PIPS) la hiperpolariza y la aleja del disparo.'],
      ['Diferencia entre agonista y antagonista', 'El agonista imita o potencia el efecto del neurotransmisor sobre el receptor; el antagonista lo ocupa o bloquea e impide su acción.'],
      ['Diferencia entre homeostasis y alostasis', 'La homeostasis mantiene constantes los parámetros vitales; la alostasis logra estabilidad cambiando esos puntos de ajuste según la demanda del ambiente.'],
      ['Diferencia entre afasia, apraxia y agnosia', 'Afasia: trastorno del lenguaje. Apraxia: no poder ejecutar movimientos aprendidos sin parálisis. Agnosia: no reconocer estímulos con los sentidos indemnes.']
    ]
  },
  {
    materia: 'Neuropsicología',
    parejas: [
      ['¿Cómo se diferencia una afasia de una disartria?', 'La afasia compromete el lenguaje en todas sus vías, incluidas la comprensión y la escritura; la disartria altera solo la articulación motora y deja el lenguaje intacto.'],
      ['¿Cómo se diferencia la apraxia ideomotora de la ideatoria?', 'Liepmann las separó: en la ideomotora falla el gesto a la orden pero el uso espontáneo se conserva; en la ideatoria se pierde el plan y falla la secuencia con objetos reales.'],
      ['¿Cómo se diferencia la heminegligencia de una hemianopsia?', 'La hemianopsia es un déficit del campo visual que el paciente conoce y compensa girando la cabeza; la negligencia es atencional y el paciente ignora que le falta un lado.'],
      ['¿Qué diferencia hay entre la vía visual ventral y la dorsal?', 'La ventral (occipitotemporal) reconoce qué es el objeto y su lesión da agnosia; la dorsal (occipitoparietal) ubica y guía la acción, y su lesión da ataxia óptica.']
    ]
  },
  {
    materia: 'Psicopatología',
    parejas: [
      ['¿Cómo se distingue una obsesión de un delirio?', 'La obsesión es egodistónica y el sujeto la reconoce como producto de su propia mente y la resiste; el delirio se sostiene con certeza y se vive como verdad sobre el mundo.'],
      ['¿Cuál es la diferencia entre escisión y represión?', 'En la teoría psicoanalítica, la represión expulsa un contenido de la conciencia; la escisión mantiene separadas representaciones contradictorias (todo bueno / todo malo) que coexisten sin integrarse.'],
      ['¿Cuál es la diferencia entre alucinación e ilusión?', 'La ilusión es la deformación de un objeto real efectivamente presente; la alucinación es una percepción sin objeto que percibir, vivida con la convicción de lo real.'],
      ['¿Qué distingue al trastorno bipolar I del bipolar II?', 'El bipolar I requiere al menos un episodio maníaco (puede no haber depresión); el bipolar II exige al menos un episodio hipomaníaco y uno depresivo mayor, y ningún episodio maníaco.']
    ]
  },
  {
    materia: 'Psicología Social',
    parejas: [
      ['¿Qué distingue conformidad, complacencia y obediencia?', 'La conformidad es el cambio ante la presión implícita del grupo; la complacencia, acceder a un pedido directo; la obediencia, acatar la orden de una autoridad.'],
      ['¿Qué distingue el sexismo hostil del sexismo benévolo?', 'Para Glick y Fiske, el hostil trata a las mujeres como rivales o inferiores; el benévolo las idealiza como frágiles y a proteger, y también sostiene la desigualdad.'],
      ['¿Qué diferencia hay entre actitudes explícitas e implícitas?', 'Las explícitas son evaluaciones conscientes que la persona declara; las implícitas son automáticas y se miden de forma indirecta, por ejemplo con el IAT de Greenwald.'],
      ['¿Cómo se distinguen estereotipo, prejuicio y discriminación?', 'El estereotipo es el componente cognitivo (creencias sobre el grupo), el prejuicio el afectivo (evaluación negativa) y la discriminación el conductual (trato desigual).']
    ]
  },
  {
    materia: 'Corrientes Psicoterapéuticas',
    parejas: [
      ['¿Qué es la diferenciación del self?', 'Para Bowen, la capacidad de distinguir lo intelectual de lo emocional y de sostener la propia posición sin fusionarse con la masa emocional familiar.'],
      ['¿Qué diferencia hay entre cambio 1 y cambio 2?', 'Para Watzlawick, el cambio 1 ocurre dentro del sistema sin modificarlo ("más de lo mismo"); el cambio 2 modifica las reglas del propio sistema.'],
      ['¿Qué distingue la terapia de Beck de la de Ellis?', 'Beck evalúa empíricamente los pensamientos distorsionados del paciente; Ellis debate filosóficamente creencias irracionales absolutistas del tipo "debo" o "tengo que".'],
      ['En ACT, ¿qué diferencia hay entre valores y metas?', 'Los valores son direcciones vitales elegidas que orientan la acción y nunca se completan; las metas son logros concretos que sí se alcanzan.']
    ]
  },
  {
    materia: 'Psicometría y Evaluación Psicológica',
    parejas: [
      ['¿Qué sostiene Thurstone frente al factor g?', 'Que la inteligencia se compone de aptitudes mentales primarias relativamente independientes: comprensión verbal, numérica, espacial, memoria, razonamiento, fluidez y velocidad perceptiva.'],
      ['¿Qué diferencia hay entre consulta y entrevista?', 'La consulta es el motivo por el que alguien acude; la entrevista es la técnica con que se lo aborda. Toda consulta se trabaja con entrevistas, pero no toda entrevista nace de una consulta.'],
      ['¿Qué es el funcionamiento diferencial del ítem (DIF)?', 'Que personas de distinto grupo (género, cultura) con el mismo nivel del rasgo tengan distinta probabilidad de acertar el ítem. Es un indicador de sesgo.'],
      ['¿Qué diferencia hay entre sensibilidad y especificidad?', 'La sensibilidad es la proporción de casos con el trastorno que el test detecta; la especificidad, la proporción de casos sanos que descarta correctamente.']
    ]
  },
  {
    materia: 'Métodos de Investigación y Estadística',
    parejas: [
      ['¿Qué diferencia hay entre población y muestra?', 'La población es el conjunto total de casos que cumplen los criterios del estudio; la muestra es el subconjunto de esa población sobre el que efectivamente se releva.'],
      ['¿Qué distingue una escala de intervalo de una de razón?', 'Las dos tienen unidades de igual tamaño, pero la de intervalo tiene cero arbitrario (temperatura en °C) y la de razón tiene cero absoluto, que habilita decir \'el doble\'.'],
      ['¿Qué diferencia hay entre un parámetro y un estadístico?', 'El parámetro es un valor de la población (μ, σ), en general desconocido; el estadístico es el valor calculado en la muestra y se usa para estimar el parámetro.'],
      ['¿Qué diferencia hay entre un efecto principal y una interacción?', 'El efecto principal es el efecto de una VI por sí sola sobre la VD; hay interacción cuando el efecto de una VI cambia según el nivel de la otra.']
    ]
  },
  {
    materia: 'Ética y Deontología Profesional',
    parejas: [
      ['¿Qué diferencia hay entre moral y ética?', 'La moral es el conjunto de normas y costumbres vigentes de hecho en una comunidad; la ética es la reflexión filosófica y crítica sobre esa moral y sus fundamentos.'],
      ['¿Qué diferencia hay entre diagnosticar y rotular?', 'El diagnóstico orienta una intervención y es revisable; el rótulo fija a la persona en una etiqueta, produce estigma y no autoriza a presumir riesgo ni incapacidad.'],
      ['¿Qué diferencia hay entre negligencia e imprudencia?', 'La negligencia es no hacer lo que se debía: omisión o descuido. La imprudencia es hacer de más: actuar temerariamente o sin los recaudos debidos.'],
      ['¿Qué diferencia hay entre beneficencia y no maleficencia?', 'La beneficencia manda hacer el bien y procurar el beneficio del otro; la no maleficencia, más básica y exigible a todos, sólo manda no dañar.']
    ]
  }
]

/** Cuántas parejas trae. Lo publica la portada del PDF. */
export const TOTAL_PAREJAS = 56
