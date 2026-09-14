import { app } from 'electron'
import { MAZOS_DE_REGALO } from '../src/main/services/mazosDeRegalo'

/**
 * La prueba de la FORMA de la tarjeta: la anti-lista y la medida.
 *
 * ---------------------------------------------------------------------------
 * La regla en la que coincidieron todos
 * ---------------------------------------------------------------------------
 *
 * De todo lo que se discutió al diseñar el mazo, hubo una sola regla en la que
 * coincidieron las cinco propuestas independientes Y los tres jueces: LA TARJETA
 * NO PUEDE SER UNA LISTA. Y el motivo no es estético, es mecánico.
 *
 * El estudiante califica la tarjeta ENTERA con tres botones. Si el dorso trae
 * cinco efectos adversos y se acuerda de cuatro, aprieta "más o menos". FSRS
 * entiende "a medio aprender" cuando la verdad es que sabe cuatro perfecto y hay
 * uno que no sabe. Esa tarjeta vuelve para siempre, le come el cupo diario a las
 * que sí necesita, y encima le enseña el NÚMERO: sabe que son cinco, recuerda
 * cuatro y se queda tranquilo — hasta que en el final le preguntan justo el
 * quinto.
 *
 * Ése es, textualmente, el momento en que se abandona un mazo. Y es la regla que
 * un escritor cansado rompe primero, por eso se verifica y no se recomienda.
 *
 * ---------------------------------------------------------------------------
 * Lo que esta prueba NO puede ver
 * ---------------------------------------------------------------------------
 *
 * Que la tarjeta sea CIERTA. Eso lo mira una persona. Acá se mide la forma, que
 * es lo único que una máquina puede medir sin mentir sobre lo que midió.
 */

/** Un frente más largo que esto ya no es una pregunta, es un enunciado. */
const MAX_FRENTE = 160

/** Cuatro renglones cortos entran cómodos. El quinto ya es otra tarjeta. */
const MAX_DORSO = 400
/** Con línea de fuente se permite un poco más: la fuente no es contenido a estudiar. */
const MAX_DORSO_CON_FUENTE = 450

/**
 * Frases que delatan una tarjeta que no se puede contestar o que no enseña.
 *
 * "etc." y "entre otros" son la lista disimulada: prometen que hay más y no lo
 * dicen, así que el que estudia nunca sabe si respondió bien. "Verdadero o
 * falso" y "todas las anteriores" son formatos de examen que en una flashcard no
 * exigen evocación: se aciertan por azar la mitad de las veces. "Ver la unidad"
 * señala afuera, y acá no hay afuera.
 */
const PROHIBIDAS: Array<{ patron: RegExp; porQue: string }> = [
  { patron: /\betc\.?\b/i, porQue: '"etc." es una lista disimulada: promete más y no lo dice, así que no hay forma de saber si se respondió bien.' },
  { patron: /\bentre otr[oa]s\b/i, porQue: '"entre otros" es lo mismo que "etc.": deja la respuesta abierta y la tarjeta incalificable.' },
  { patron: /verdadero o falso/i, porQue: 'Verdadero/falso se acierta por azar la mitad de las veces: no hay evocación.' },
  { patron: /todas las anteriores|ninguna de las anteriores/i, porQue: 'Es un formato de multiple choice y no tiene sentido en una tarjeta de dos caras.' },
  { patron: /ver (la|el) (unidad|tarjeta|capítulo|capitulo)/i, porQue: 'Señala afuera de la tarjeta, y la sesión baraja: no existe "la anterior".' }
]

/**
 * Cuenta los ítems enumerados de un dorso.
 *
 * Se mide POR RENGLÓN y no sobre el dorso entero, y la primera versión no lo
 * hacía: contaba todos los punto y coma del texto y marcaba como "lista de
 * cuatro ítems" a tarjetas perfectamente bien escritas. En español el punto y
 * coma une cláusulas de una misma idea —"la Kd sale de la ocupación del
 * receptor; la CE50 sale del sistema entero"— y el dorso está diseñado como
 * cuatro renglones con una idea cada uno, así que un punto y coma por renglón
 * es prosa normal, no enumeración.
 *
 * Lo que sí delata una lista es un renglón con tres o más separadores, o las
 * viñetas y la numeración explícitas.
 *
 * El tipo `descarte` queda exento del conteo por punto y coma: enumerar por qué
 * se caen los otros tres candidatos ES la forma de ese tipo de tarjeta.
 */
function itemsEnumerados(dorso: string, tipo: string): number {
  const renglones = dorso.split('\n')
  const porRenglon = tipo === 'descarte' ? 0 : Math.max(0, ...renglones.map((r) => (r.match(/;/g) ?? []).length))
  const vinetas = (dorso.match(/^\s*[-–—·•]\s+/gm) ?? []).length
  const numerados = (dorso.match(/(^|\s)\d\)\s/g) ?? []).length
  return Math.max(porRenglon, vinetas, numerados)
}

interface Falla {
  carrera: string
  unidad: string
  frente: string
  motivo: string
}

export function run(): void {
  const fallas: Falla[] = []
  let total = 0

  for (const mazo of MAZOS_DE_REGALO) {
    for (const t of mazo.tarjetas) {
      total++
      const add = (motivo: string): void => {
        fallas.push({ carrera: mazo.carrera, unidad: `${mazo.materia} · ${mazo.unidad}`, frente: t.frente, motivo })
      }

      /* ------------------------------- el frente ------------------------------ */

      if (t.frente.length > MAX_FRENTE) {
        add(`El frente mide ${t.frente.length} caracteres y el máximo es ${MAX_FRENTE}. Una pregunta que no se lee en voz alta en quince segundos se saltea.`)
      }

      const interrogaciones = (t.frente.match(/\?/g) ?? []).length
      if (interrogaciones > 1) {
        add(`El frente tiene ${interrogaciones} preguntas. Una tarjeta, una pregunta: con dos no hay botón honesto para el que sabe una sola.`)
      }

      // El plural del pedido de lista. "¿Cuáles son los efectos adversos...?"
      if (/¿\s*(cuáles|cuales)\s+son\b/i.test(t.frente) || /\bnombr[áa]\s+(las|los|tres|cuatro|cinco|\d)/i.test(t.frente)) {
        add('El frente pide una lista ("cuáles son", "nombrá los"). La lista no se puede calificar con tres botones: se parte en tarjetas de un ítem, o se convierte en inversas.')
      }

      /* -------------------------------- el dorso ------------------------------- */

      const tieneFuente = /fuente\s*:/i.test(t.dorso)
      const tope = tieneFuente ? MAX_DORSO_CON_FUENTE : MAX_DORSO
      if (t.dorso.length > tope) {
        add(`El dorso mide ${t.dorso.length} caracteres y el máximo es ${tope}. Si no entra, hay dos tarjetas adentro: partila.`)
      }

      const items = itemsEnumerados(t.dorso, t.tipo)
      if (items > 2) {
        add(`El dorso enumera ${items + 1} ítems. Con tres botones eso es incalificable: el que se acuerda de la mitad aprieta "más o menos" para siempre y la tarjeta no se aprende nunca.`)
      }

      /* Que el dorso no arranque repitiendo el frente: se come el único renglón
         que el que ya sabía la respuesta va a leer. */
      const primeras = t.dorso.trim().split(/\s+/).slice(0, 6).join(' ').toLowerCase()
      const frenteLimpio = t.frente.replace(/[¿?]/g, '').trim().toLowerCase()
      if (primeras.length > 12 && frenteLimpio.includes(primeras)) {
        add('El dorso arranca repitiendo el frente. El primer renglón es lo único que se lee siempre: tiene que ser la respuesta.')
      }

      /* ------------------------------ las dos caras ---------------------------- */

      for (const p of PROHIBIDAS) {
        if (p.patron.test(t.frente) || p.patron.test(t.dorso)) add(p.porQue)
      }
    }
  }

  console.log(`${total} tarjeta(s) revisada(s).`)

  if (fallas.length > 0) {
    console.error(`\n${fallas.length} tarjeta(s) mal formadas:\n`)
    for (const f of fallas.slice(0, 40)) {
      console.error(`  [${f.carrera} · ${f.unidad}]`)
      console.error(`    ${f.frente.slice(0, 110)}`)
      console.error(`    → ${f.motivo}\n`)
    }
    if (fallas.length > 40) console.error(`  … y ${fallas.length - 40} más.\n`)
    throw new Error(`${fallas.length} tarjeta(s) incumplen la forma.`)
  }

  console.log('OK: ninguna tarjeta-lista, ninguna fuera de medida.')
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
