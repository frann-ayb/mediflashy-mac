import { app } from 'electron'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Arnés del generador.
 *
 * Corre en dos modos:
 *
 *   node scripts/run-qa.mjs generacion             # sin modelo: la parte pura
 *   node scripts/run-qa.mjs generacion -- --real   # con el modelo de verdad
 *
 * Sin `--real` se prueba lo que no necesita IA y es donde vive la seguridad del
 * producto: el anclaje de citas, que es lo que descarta las tarjetas inventadas.
 *
 * Con `--real` se descarga el modelo si falta (1,3 GB), se genera de un texto real
 * y se verifica lo que sólo se puede verificar contra un modelo: que la gramática
 * devuelva JSON válido, que las tarjetas estén respaldadas por el texto, que no
 * salgan repetidas, y —lo más importante— QUE EL MINI-PROMPT NO APAREZCA EN EL LOG.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-qa-'))
app.setPath('userData', raiz)

const REAL = process.argv.includes('--real')

/* eslint-disable @typescript-eslint/no-var-requires */
const anchor = require('../src/main/services/core/anchor') as typeof import('../src/main/services/core/anchor')
const { chunkText, cardsPerChunk } = require('../src/main/services/core/chunker') as typeof import('../src/main/services/core/chunker')
const { logger } = require('../src/main/services/core/logger') as typeof import('../src/main/services/core/logger')

let fallas = 0
let pruebas = 0

function ok(condicion: boolean, que: string, detalle = ''): void {
  pruebas++
  if (condicion) console.log(`  ✓ ${que}`)
  else {
    fallas++
    console.error(`  ✗ ${que}${detalle ? ` — ${detalle}` : ''}`)
  }
}

const seccion = (t: string): void => console.log(`\n${t}`)

const FUENTE = [
  'La prescripción adquisitiva es el modo de adquirir el dominio de una cosa por la posesión continuada durante el tiempo que fija la ley.',
  'Requiere posesión ostensible, continua y no interrumpida. La buena fe unida al justo título reduce el plazo a diez años para los inmuebles.',
  'El plazo ordinario para inmuebles es de veinte años cuando falta el justo título, y se cuenta desde que se inició la posesión efectiva.',
  'La sentencia que declara la prescripción es declarativa y no constitutiva: reconoce un derecho que ya existía por el transcurso del tiempo.'
].join('\n\n')

/* ------------------------------- parte pura -------------------------------- */

function probarAnclaje(): void {
  seccion('El anclaje de citas: la defensa contra las tarjetas inventadas')

  const plano = anchor.flatten(FUENTE)

  ok(anchor.isGrounded('posesión continuada durante el tiempo que fija la ley', plano), 'una cita literal ancla')
  ok(anchor.quoteScore('posesión continuada durante el tiempo que fija la ley', plano) === 1, 'y con puntaje máximo')

  ok(anchor.isGrounded('posesion continuada durante el tiempo que fija la ley', plano), 'una cita sin tildes ancla igual')
  ok(anchor.isGrounded('Posesión Continuada Durante El Tiempo Que Fija La Ley.', plano), 'y con otra capitalización y puntuación')

  // Una palabra pegada al final no rompe nada: el prefijo sigue siendo literal.
  ok(
    anchor.isGrounded('Requiere posesión ostensible, continua y no interrumpida siempre', plano),
    'una cita con una palabra de más al final sigue anclando'
  )

  // Palabras metidas EN EL MEDIO sí la rompen, y eso es lo buscado: al modelo se le
  // pidió copiar textual, así que si reescribe por adentro no estaba copiando. El
  // costo es descartar alguna tarjeta buena; el beneficio es no dejar pasar una
  // inventada, y en un mazo de estudio ese cambio conviene siempre.
  ok(
    !anchor.isGrounded('requiere una posesión bastante ostensible, continua y jamás interrumpida', plano),
    'una cita reescrita por adentro NO ancla, aunque suene parecida'
  )

  // Lo que tiene que RECHAZAR. Éstas son alucinaciones típicas de un modelo chico:
  // suenan al texto, usan su vocabulario, y dicen algo que el texto no dice.
  ok(!anchor.isGrounded('el plazo ordinario para muebles es de treinta años', plano), 'una cita inventada NO ancla')
  ok(!anchor.isGrounded('la prescripción adquisitiva requiere inscripción registral previa', plano), 'aunque use el vocabulario del texto')
  ok(!anchor.isGrounded('el usufructo se extingue por el no uso durante diez años', plano), 'y una de otro tema tampoco')
  ok(!anchor.isGrounded('', plano), 'una cita vacía no ancla')
  ok(!anchor.isGrounded('la', plano), 'ni una sola palabra suelta, aunque esté en el texto')
  ok(!anchor.isGrounded('el plazo ordinario', plano), 'ni tres palabras, que podrían coincidir de casualidad')
  ok(anchor.isGrounded('el plazo ordinario para inmuebles', plano), 'cuatro sí, que es el piso')

  // El caso que justifica el umbral difuso: el modelo parafrasea un poco.
  const parafraseada = 'la sentencia que declara la prescripción es declarativa y no constitutiva'
  ok(anchor.isGrounded(parafraseada, plano), 'una cita casi literal ancla')

  seccion('La normalización que comparte con el buscador')
  ok(anchor.normalize('Información') === 'informacion', 'saca las tildes')
  ok(anchor.normalize('AÑO') === 'ano', 'baja a minúscula y colapsa la ñ')
  ok(anchor.normalize('  hola,   mundo!  ') === 'hola mundo', 'limpia puntuación y espacios')
}

function probarTroceado(): void {
  seccion('Frentes que no son una tarjeta')

{
  const gen = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
  const meta = gen.hablaDelApunte

  // Éste salió de una corrida real: el modelo convirtió en tarjeta una
  // instrucción del propio prompt.
  ok(meta('¿Qué es un hecho o proceso en este fragmento?'), 'descarta el que pregunta por "este fragmento"')
  ok(meta('Según el texto, ¿qué plazo corre?'), 'descarta el que arranca con "según el texto"')
  ok(meta('¿Cuál es el término o nombre propio que define la herencia?'), 'descarta el que repite la consigna del prompt')
  ok(meta('¿Qué es una subconsulta?') === false, 'y deja pasar una pregunta normal')
  ok(meta('¿Qué dice la ley sobre el texto ordenado?') === false, 'sin descartar cualquier pregunta que diga "texto"')
}

seccion('El dorso tiene que contestar algo')

{
  const gen = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
  const vacia = gen.dorsoSinRespuesta

  /* Los tres de acá salieron de corridas reales. Los dos primeros vienen de un
     apunte de R donde los ejemplos de código son capturas de pantalla: el texto
     dice "Ejemplo:" y abajo hay una imagen, así que la respuesta no existe. */
  ok(vacia('Para acceder a un elemento del vector:', '¿Cómo se accede a un elemento de un vector en R?'),
    'descarta el dorso que termina en dos puntos y no dice nada más')
  ok(vacia('Para acceder a un elemento por nombre:', '¿Cómo se accede a un elemento por nombre en una lista?'),
    'y el otro que dejó la captura afuera')
  ok(vacia('El esquema cambie en el tiempo.',
    '¿Qué criterio de selección indica que se deben elegir bases de datos no relacionales cuando el esquema cambie en el tiempo?'),
    'descarta el dorso que está entero adentro del frente')

  /* Y acá el otro lado: las de definición → nombre son tarjetas BUENAS, que es
     lo que pide el tipo mixto. Un dorso corto no las delata. */
  ok(vacia('Es la escala nominal.',
    '¿Qué tipo de escala de medición es la más básica, sirviendo solo para identificar o clasificar elementos sin orden?') === false,
    'pero deja pasar "es la escala nominal", que es una tarjeta de definición a nombre')
  ok(vacia('Son variables cualitativas ordinales.',
    '¿Qué tipo de variables implica que sus categorías implican un orden natural?') === false,
    'y "son variables cualitativas ordinales"')
  ok(vacia('Bases de datos de columnas',
    '¿Qué tipo de base de datos se caracteriza por almacenar los datos en tablas donde cada columna guarda un conjunto de valores correspondientes a una fila lógica?') === false,
    'y la que contesta con el nombre del tipo')
  ok(vacia('Una consulta anidada dentro de otra, útil para filtrar datos.', '¿Qué es una subconsulta?') === false,
    'sin tocar una tarjeta normal')
  ok(
    vacia(
      'En la captura se ve la interfaz que provee MongoDB Compass, con los clústers a la izquierda.',
      '¿Cómo se organizan los nodos simples en MongoDB Compass?'
    ),
    'descarta el dorso que manda a mirar una captura que la tarjeta no tiene'
  )
  ok(
    vacia('Una imagen del estado de la base en un momento dado.', '¿Qué es una captura de MongoDB?') === false,
    'pero no la tarjeta que habla DE una captura'
  )
  ok(vacia('', '¿Qué es una subconsulta?'), 'y un dorso vacío se va')
}

seccion('El eco del título, que se le saca al dorso')

{
  const gen = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
  const eco = gen.sacarEcoDelFrente

  // Los casos salieron de una corrida real sobre apuntes de Bases de Datos.
  ok(
    eco('Subconsultas: Serán las consultas anidadas dentro de otra consulta principal.', '¿Qué es una subconsulta?')
      === 'Serán las consultas anidadas dentro de otra consulta principal.',
    'saca el título repetido, aunque venga en plural y el frente en singular'
  )
  ok(
    eco('Manipulación de Datos: Las operaciones que podemos realizar son creación, modificación y eliminación.', '¿Qué es una manipulación de datos?')
      === 'Las operaciones que podemos realizar son creación, modificación y eliminación.',
    'y cuando el título son varias palabras'
  )
  ok(
    eco('MongoDB: es una base de datos orientada a documentos muy usada.', '¿Qué motor de base de datos no relacional se usa?')
      === 'MongoDB: es una base de datos orientada a documentos muy usada.',
    'pero NO toca el dorso cuando el prefijo ES la respuesta'
  )
  ok(
    eco('Son consultas anidadas dentro de otra.', '¿Qué es una subconsulta?')
      === 'Son consultas anidadas dentro de otra.',
    'y un dorso sin dos puntos queda igual'
  )
  ok(
    eco('Ventajas: sí.', '¿Qué ventajas tiene?') === 'Ventajas: sí.',
    'tampoco corta si lo que queda es demasiado corto para ser una respuesta'
  )
}


seccion('Cuántas tarjetas se piden por bloque')

  const bloques = chunkText(FUENTE)
  ok(bloques.length >= 1, 'el texto de prueba da al menos un bloque')

  const corto = chunkText('Una idea. Otra idea. Y una tercera idea que cierra el asunto de forma completa.')[0]
  if (corto) {
    ok(cardsPerChunk(corto, 'normal') <= 3, 'un bloque corto pide pocas tarjetas', String(cardsPerChunk(corto, 'normal')))
    /* En un bloque de catorce palabras la densidad NO tiene que cambiar nada:
       de ahí no salen cuatro tarjetas buenas, y pedirlas es invitar al modelo a
       inventar. Las dos caen al piso de 2. Antes la densidad baja pedía 1 y la
       alta 4 sobre el mismo texto, que era pedirle a un párrafo lo que no
       tiene. El knob se prueba donde significa algo, unas líneas más abajo. */
    ok(cardsPerChunk(corto, 'alta') === cardsPerChunk(corto, 'baja'),
      'en un bloque muy corto la densidad no cambia nada: las dos piden el mínimo',
      String(cardsPerChunk(corto, 'baja')))
  }

  const medio = chunkText(FUENTE)[0]
  if (medio) {
    ok(cardsPerChunk(medio, 'alta') > cardsPerChunk(medio, 'baja'),
      'en un bloque de tamaño real, la densidad alta pide más que la baja',
      `${cardsPerChunk(medio, 'baja')} contra ${cardsPerChunk(medio, 'alta')}`)
  }

  const largo = chunkText(Array.from({ length: 120 }, () => FUENTE).join('\n\n'))[0]
  ok(cardsPerChunk(largo, 'normal') === 8, 'un bloque largo pide el máximo del esquema', String(cardsPerChunk(largo, 'normal')))
  ok(cardsPerChunk(largo, 'alta') === 8, 'y la densidad alta no puede pasarse de ese máximo')
}

seccion('Cuándo dos preguntas son la misma, y cuándo no')

{
  /* Los pares de acá salieron de corridas reales sobre los apuntes de prueba, y
     están puestos porque el parecido literal solo NO los separa: los de las dos
     listas conviven entre 0,79 y 0,91 de Dice. Fusionar los de la primera lista
     le borra al estudiante justo la distinción que tiene que estudiar —nominal
     contra ordinal, uno a uno contra uno a muchos, Write contra Read— así que si
     alguien vuelve a bajar el umbral, esto tiene que ponerse en rojo. */
  const misma = (a: string, b: string): boolean =>
    anchor.isDuplicate(anchor.fingerprint(a), [anchor.fingerprint(b)])

  const DISTINTAS: Array<[string, string]> = [
    ['¿Qué es una relación muchos a muchos?', '¿Qué es una relación uno a muchos?'],
    ['¿Qué es una relación uno a uno?', '¿Qué es una relación uno a muchos?'],
    ['¿Qué caracteriza a las bases de datos de columnas?', '¿Qué caracteriza a las bases de datos de grafos?'],
    ['¿Qué son los vectores en R?', '¿Qué son los factores en R?'],
    ['¿Qué son las variables nominales?', '¿Qué son las variables ordinales?'],
    ['¿Qué es un Write concern en MongoDB?', '¿Qué es un Read concern en MongoDB?'],
    ['¿Qué es la validez interna?', '¿Qué es la validez externa?'],
    ['¿Qué es una variable?', '¿Qué es una variable aleatoria discreta?'],
    ['¿Qué es la media?', '¿Qué es la media geométrica?'],
    ['¿Qué es el error?', '¿Qué es el error de tipo II?']
  ]
  for (const [a, b] of DISTINTAS) {
    ok(misma(a, b) === false, `conserva las dos: ${a.slice(0, 34)}… / ${b.slice(0, 34)}…`)
  }

  const IGUALES: Array<[string, string]> = [
    ['¿Qué es un Read concern en MongoDB?', '¿Qué es el Read concern en MongoDB?'],
    ['¿Qué es una población?', '¿Qué es la población?'],
    ['¿Qué son los atributos?', '¿Qué es un atributo?'],
    ['¿Qué es un modelo híbrido en MongoDB?', '¿Qué es un modelo híbrido?'],
    ['¿Qué es la prescripción adquisitiva?', '¿Qué es la prescripción adquisitiva de dominio?'],
    ['¿Cómo se modelan las relaciones uno a muchos?', '¿Cómo se modelan las relaciones uno a muchos usando referencias?']
  ]
  for (const [a, b] of IGUALES) {
    ok(misma(a, b), `fusiona: ${a.slice(0, 34)}… / ${b.slice(0, 34)}…`)
  }

  ok(misma('¿Qué es la ósmosis?', '¿Qué es la osmosis?'), 'los acentos no hacen dos tarjetas')
  ok(
    misma('¿Qué es lo que es?', '¿Qué es lo que es?'),
    'dos frentes iguales hechos sólo de palabras vacías igual se fusionan'
  )
  ok(misma('¿?', '¿?') === false, 'y un frente sin una sola letra no rompe la comparación')
}

/* ------------------------------- con modelo -------------------------------- */

const SECRETO = 'ENFOQUE-SECRETO-QUE-NO-DEBE-LOGUEARSE-98765'

async function probarConModelo(): Promise<void> {
  const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
  const { startServer, stopServer } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')
  const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')

  seccion('Generación real con el modelo')

  const control = new AbortController()
  let ultimo = ''

  const modelo = await ensureGenModel({
    level: 'rapido',
    signal: control.signal,
    onProgress: (p) => {
      const linea = `    ${p.phase} ${p.percent}%`
      if (linea !== ultimo) {
        ultimo = linea
        process.stdout.write(`\r${linea}          `)
      }
    }
  })
  console.log('\n    modelo listo')

  await startServer(modelo, control.signal)
  try {
    const texto = Array.from({ length: 4 }, () => FUENTE).join('\n\n')
    const r = await generate({
      texto,
      options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad: 'normal' },
      miniPrompt: `${SECRETO}. Enfocate en los plazos.`,
      signal: control.signal,
      onProgress: (p) => process.stdout.write(`\r    ${p.message ?? ''} (${p.encontradas ?? 0} tarjetas)          `),
      seed: 12345
    })
    console.log('')

    ok(r.cards.length > 0, `salieron tarjetas`, `${r.cards.length} tarjeta(s), ${r.descartadas} descartada(s)`)
    ok(
      r.cards.every((c) => c.frente.length > 0 && c.dorso.length > 0),
      'ninguna vino con el frente o el dorso vacíos'
    )
    ok(r.cards.every((c) => c.frente.length <= 200 && c.dorso.length <= 400), 'ninguna se pasó de los límites del esquema')

    // El texto repite el mismo fragmento cuatro veces: sin deduplicación saldrían
    // las mismas tarjetas cuatro veces.
    const frentes = new Set(r.cards.map((c) => anchor.normalize(c.frente)))
    ok(frentes.size === r.cards.length, 'no hay dos tarjetas con el mismo frente', `${frentes.size} de ${r.cards.length} únicas`)

    // Cada tarjeta tiene que hablar de lo que dice el texto. No se puede exigir
    // literalidad en el dorso —el modelo reformula, y está bien que lo haga— pero
    // sí que sus palabras salgan del material.
    const plano = anchor.flatten(texto)
    const fundadas = r.cards.filter((c) => {
      const palabras = anchor
        .normalize(c.dorso)
        .split(' ')
        .filter((w) => w.length > 4)
      if (palabras.length === 0) return true
      return palabras.filter((w) => plano.joined.includes(w)).length / palabras.length > 0.5
    })
    ok(
      fundadas.length >= Math.ceil(r.cards.length * 0.8),
      'al menos el 80 % de las tarjetas usa vocabulario del texto',
      `${fundadas.length}/${r.cards.length}`
    )

    for (const c of r.cards.slice(0, 4)) console.log(`      · ${c.frente}  →  ${c.dorso.slice(0, 70)}…`)

    /* ---------------------- la prueba que más importa ---------------------- */

    seccion('El mini-prompt no queda en ningún lado')

    const log = readFileSync(logger.filePath, 'utf8')
    ok(!log.includes(SECRETO), 'no aparece en el archivo de registro')
    ok(log.includes('con preferencias'), 'aunque el log SÍ registra que había preferencias, y su largo')
    ok(!log.includes('Enfocate en los plazos'), 'ni siquiera un pedazo del texto que escribió el usuario')
  } finally {
    stopServer()
  }
}

/* ---------------------------------- correr --------------------------------- */

async function correr(): Promise<void> {
  logger.init(join(raiz, 'logs'))

  probarAnclaje()
  probarTroceado()

  if (REAL) {
    await probarConModelo()
  } else {
    seccion('Generación real')
    console.log('  (salteada — corré con `npm run qa:generacion-real` para probar el modelo de verdad)')
  }

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  app.exit(fallas === 0 ? 0 : 1)
}

app.whenReady().then(
  () => {
    correr().catch((err) => {
      console.error('\nEl arnés falló:', err)
      app.exit(1)
    })
  },
  (err) => {
    console.error('El arnés no pudo arrancar:', err)
    app.exit(1)
  }
)
