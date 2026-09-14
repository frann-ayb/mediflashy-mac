import { app } from 'electron'
import { MAZOS_DE_REGALO } from '../src/main/services/mazosDeRegalo'
import { TIPOS_TARJETA, type TipoTarjeta } from '@shared/types'

/**
 * La prueba que impide que el mazo se degrade a una lista de fichas técnicas.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe, que es lo único que hay que entender de este archivo
 * ---------------------------------------------------------------------------
 *
 * Un mazo de farmacología se echa a perder siempre de la misma manera, y no por
 * falta de ganas: se llena de ÁTOMOS. El átomo —"¿qué canal bloquea la
 * amiodarona?"— es el tipo más barato de escribir, el que sale solo cuando uno
 * está cansado, y el único que un modelo de lenguaje produce a mansalva sin que
 * se lo pidan. También es exactamente el tipo que el mazo gratis de Anki ya
 * tiene, en inglés y con más volumen. O sea: si el mazo deriva a puro átomo, lo
 * que queda es AnKing traducido, y eso se copia en un fin de semana.
 *
 * Lo que diferencia son los tipos que NO salen por accidente: la INVERSA (del
 * rasgo al fármaco, que es la dirección en que pregunta el examen argentino y
 * que nadie estudia), el CONTRASTE (el par confundible, que es de dónde el
 * profesor saca los distractores) y el DESCARTE (cuatro candidatos y una
 * condición, que es la forma literal del Examen Único).
 *
 * Con 407 unidades escritas a lo largo de meses, la disciplina humana no
 * escala: la unidad 300 va a ser una lista de fichas técnicas si nada lo
 * impide. Esto es lo que lo impide.
 *
 * ---------------------------------------------------------------------------
 * Por qué los topes son por UNIDAD y no del mazo entero
 * ---------------------------------------------------------------------------
 *
 * Un promedio global se cumple con unidades excelentes compensando unidades
 * malas, y el que estudia no estudia el promedio: estudia SU unidad. Si la de
 * antibióticos quedó 90 % átomo, a esa persona no la salva que la de
 * anticoagulantes esté bien.
 *
 * Las unidades muy chicas (menos de 12 tarjetas) quedan exentas: con 8 tarjetas,
 * un tipo de más o de menos mueve el porcentaje 12 puntos y el tope mediría
 * ruido en vez de calidad.
 */

/** Debajo de esto, los porcentajes son ruido y no se mide. */
const MINIMO_PARA_MEDIR = 12

interface Tope {
  tipo: TipoTarjeta
  /** Máximo permitido, en porcentaje de la unidad. `null` si no tiene techo. */
  max: number | null
  /** Mínimo exigido. `null` si no tiene piso. */
  min: number | null
  porQue: string
}

/**
 * Los topes. Cada uno tiene un motivo y ninguno es una preferencia estética.
 */
const TOPES: Tope[] = [
  {
    tipo: 'atomo',
    max: 25,
    min: null,
    porQue:
      'Es el techo que importa. El átomo es el tipo más barato y el único que el mazo gratis ya tiene bien surtido: sin tope, la unidad termina siendo la ficha técnica del fármaco partida en pedacitos.'
  },
  {
    tipo: 'inversa',
    max: null,
    min: 12,
    porQue:
      'Es la dirección en que pregunta el examen —"paciente con hipoacusia y creatinina en ascenso, ¿qué le estaban dando?"— y la que nadie estudia. Saber que la amiodarona da fibrosis pulmonar no habilita a contestar qué causó ESTA fibrosis: son dos caminos de memoria distintos.'
  },
  {
    tipo: 'contraste',
    max: null,
    min: 10,
    porQue:
      'El error que se repite camada tras camada no es no saber: es mezclar. Y la interferencia entre dos fármacos parecidos no se arregla estudiándolos mejor por separado, se arregla haciéndolos chocar a propósito.'
  },
  {
    tipo: 'calculo',
    max: 8,
    min: null,
    porQue: 'Es el tipo con más riesgo de dosis y el que más cansa de a muchas seguidas. Ocho por ciento de una unidad ya son dos tarjetas de cálculo.'
  },
  {
    tipo: 'bandera',
    max: 5,
    min: null,
    porQue: 'Si todo es bandera roja, ninguna lo es. El criterio de entrada es "esto mata o discapacita en horas", no "esto es importante".'
  },
  {
    tipo: 'trampa',
    max: 10,
    min: null,
    porQue:
      'El tope llegó tarde y por eso está acá: después de partir los dorsos largos, "trampa" saltó del 2 % de diseño al 26 %. La causa es previsible — toda advertencia que estaba enterrada al final de un dorso se convirtió en tarjeta propia y se etiquetó "trampa"— y el resultado es falso: una trampa de verdad es lo que la mayoría de la clase contesta mal CON SEGURIDAD, y no existen ochenta de ésas en ocho unidades. La mayoría son contrastes o cadenas mal rotuladas, y el rótulo importa porque es lo que va a leer el que estudia y lo que decide la mezcla.'
  },
  {
    tipo: 'anclaje',
    max: 5,
    min: null,
    porQue: 'Es la definición textual que se toma de memoria. Necesaria, pero es lo más parecido a un diccionario que tiene el mazo.'
  }
]

interface Falla {
  carrera: string
  materia: string
  unidad: string
  detalle: string
}

export function run(): void {
  /* Una entrada de MAZOS_DE_REGALO ES una unidad, así que agrupar es directo. */
  const fallas: Falla[] = []
  const globales = new Map<TipoTarjeta, number>()
  let medidas = 0
  let exentas = 0
  let totalTarjetas = 0

  for (const mazo of MAZOS_DE_REGALO) {
    const n = mazo.tarjetas.length
    totalTarjetas += n

    const cuenta = new Map<TipoTarjeta, number>()
    for (const t of mazo.tarjetas) {
      if (!TIPOS_TARJETA.includes(t.tipo)) {
        fallas.push({
          carrera: mazo.carrera,
          materia: mazo.materia,
          unidad: mazo.unidad,
          detalle: `Tarjeta con tipo desconocido: ${JSON.stringify(t.tipo)}. Frente: "${t.frente.slice(0, 70)}"`
        })
        continue
      }
      cuenta.set(t.tipo, (cuenta.get(t.tipo) ?? 0) + 1)
      globales.set(t.tipo, (globales.get(t.tipo) ?? 0) + 1)
    }

    if (n < MINIMO_PARA_MEDIR) {
      exentas++
      continue
    }
    medidas++

    for (const tope of TOPES) {
      const pct = Math.round(((cuenta.get(tope.tipo) ?? 0) / n) * 100)
      if (tope.max !== null && pct > tope.max) {
        fallas.push({
          carrera: mazo.carrera,
          materia: mazo.materia,
          unidad: mazo.unidad,
          detalle: `${pct} % de "${tope.tipo}" y el máximo es ${tope.max} %. ${tope.porQue}`
        })
      }
      if (tope.min !== null && pct < tope.min) {
        fallas.push({
          carrera: mazo.carrera,
          materia: mazo.materia,
          unidad: mazo.unidad,
          detalle: `${pct} % de "${tope.tipo}" y el mínimo es ${tope.min} %. ${tope.porQue}`
        })
      }
    }
  }

  console.log(`${MAZOS_DE_REGALO.length} unidad(es), ${totalTarjetas} tarjeta(s). Medidas: ${medidas}. Exentas por chicas: ${exentas}.`)

  if (totalTarjetas > 0) {
    console.log('\nMezcla del mazo entero:')
    for (const tipo of TIPOS_TARJETA) {
      const c = globales.get(tipo) ?? 0
      if (c === 0) continue
      console.log(`  ${String(Math.round((c / totalTarjetas) * 100)).padStart(3)} %  ${tipo} (${c})`)
    }
  }

  if (fallas.length > 0) {
    console.error(`\n${fallas.length} unidad(es) fuera de la mezcla:\n`)
    for (const f of fallas.slice(0, 40)) {
      console.error(`  [${f.carrera} · ${f.materia} · ${f.unidad}]`)
      console.error(`    ${f.detalle}\n`)
    }
    if (fallas.length > 40) console.error(`  … y ${fallas.length - 40} más.\n`)
    throw new Error(`${fallas.length} incumplimiento(s) de la mezcla de tipos.`)
  }

  console.log('\nOK: todas las unidades respetan la mezcla.')
}

/*
 * Se llama desde el nivel superior, y esto NO es un detalle de estilo.
 *
 * `scripts/run-qa.mjs` empaqueta este archivo y lo ejecuta con Electron como un
 * script suelto: NUNCA busca ni llama a una función exportada. Las tres primeras
 * versiones de este arnés sólo exportaban `run()` — se empaquetaban, corrían,
 * devolvían exit 0 y no comprobaban absolutamente nada. Un arnés que no corre es
 * peor que ninguno, porque da confianza falsa.
 *
 * `app.exit(1)` es lo que corta el build.
 */
app.whenReady().then(
  () => {
    try {
      run()
      app.exit(0)
    } catch (err) {
      console.error(`
❌ ${(err as Error).message}`)
      app.exit(1)
    }
  },
  (err) => {
    console.error('El arnés no pudo arrancar:', err)
    app.exit(1)
  }
)
