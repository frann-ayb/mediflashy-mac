/**
 * Corta un apunte largo en bloques que entren en el contexto del modelo.
 *
 * Veinte páginas de apunte son unas 9.000 palabras: no entran en una sola pasada,
 * y aunque entraran, los modelos chicos pierden el hilo cuando se les da todo
 * junto y devuelven tarjetas que hablan sólo del principio. Se procesa bloque por
 * bloque y después se juntan las tarjetas.
 *
 * ---------------------------------------------------------------------------
 * En qué se diferencia de la versión de Convertexto
 * ---------------------------------------------------------------------------
 *
 * Allá la unidad mínima es el SEGMENTO de whisper, que trae marcas de tiempo y no
 * se puede partir sin romper el anclaje de las citas al audio. Acá la unidad
 * mínima es el PÁRRAFO, que es la unidad natural de un apunte y encima trae
 * información que un segmento de audio no tiene: un título, un ítem de lista o el
 * final de una idea ya vienen marcados por el salto de línea.
 *
 * El resto —tamaño objetivo, corte preferente en fin de frase, solapamiento— es
 * igual, y por los mismos motivos.
 */

/**
 * Español con el tokenizer de Qwen: alrededor de 3,5 caracteres por token.
 * Es una estimación conservadora a propósito — pasarse del contexto es un error
 * duro, y quedarse corto sólo cuesta una pasada más.
 */
const CHARS_PER_TOKEN = 3.5
/** Tamaño objetivo de cada bloque. ~4.200 caracteres ≈ página y media. */
/*
 * 1.200 y no 3.000.
 *
 * Con 3.000 tokens un bloque llega a ~1.700 palabras, así que un apunte de
 * 1.546 entraba entero en UNO. Medido: sobre ese apunte el modelo listaba 9
 * conceptos y salían 9 tarjetas, una cada 172 palabras. El problema no era
 * cuántas tarjetas se pedían sino que una sola pasada sobre 1.500 palabras ve
 * poco, y eso vale igual para las tarjetas que para los conceptos.
 *
 * Con 1.200 el mismo apunte se parte en dos o tres, cada pasada se concentra en
 * un tercio del texto, y el solapamiento —que ya existía— se encarga de que una
 * idea partida al medio aparezca entera en alguno.
 *
 * El costo es tiempo: más bloques son más llamadas al modelo.
 */
const TARGET_TOKENS = 1200
/** Cuánto se repite del bloque anterior. */
const OVERLAP_TOKENS = 200
/**
 * Cuánto se puede retroceder buscando un final de frase, en fracción del bloque.
 * Más que esto y los bloques quedarían demasiado desparejos.
 */
const BACKTRACK_RATIO = 0.15

const TARGET_CHARS = Math.round(TARGET_TOKENS * CHARS_PER_TOKEN)
const OVERLAP_CHARS = Math.round(OVERLAP_TOKENS * CHARS_PER_TOKEN)

/**
 * Un párrafo que se pasa solo del tamaño de un bloque se corta por oraciones.
 * Pasa de verdad: un PDF mal extraído puede devolver una página entera sin un
 * solo salto de línea.
 */
const MAX_PARRAFO_CHARS = TARGET_CHARS

export interface Chunk {
  index: number
  /** Los párrafos de este bloque, ya limpios. */
  paragraphs: string[]
  /** Los párrafos unidos, que es lo que se le manda al modelo. */
  text: string
}

export function isSentenceEnd(text: string): boolean {
  return /[.!?…:][""'”’)\]]?$/.test(text.trim())
}

/**
 * Parte un texto en párrafos utilizables.
 *
 * Tres cosas que no son cosméticas:
 *
 *  1. **Un párrafo es un bloque separado por línea en blanco**, no por salto de
 *     línea simple. Los PDF cortan cada renglón con `\n`, y tratarlos como
 *     párrafos dejaría fragmentos de seis palabras sin sujeto ni verbo.
 *  2. **Los renglones sueltos de adentro de un párrafo se unen con espacio**, y si
 *     el renglón anterior terminaba en guion se pega sin espacio: los PDF cortan
 *     palabras a fin de renglón ("consti-\ntución") y sin esto quedaría
 *     "consti tución", que el modelo copia tal cual a la tarjeta.
 *  3. **Se descartan los párrafos que son sólo un número de página o basura**
 *     — menos de tres palabras y sin letras.
 */
export function toParagraphs(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((bloque) =>
      bloque
        // Palabra cortada a fin de renglón: se reconstruye.
        .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
        .replace(/\s*\n\s*/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
    )
    .filter((p) => {
      if (p.length === 0) return false
      const palabras = p.split(' ').filter((w) => w.length > 0)
      // Números de página, encabezados sueltos, marcas de agua.
      return palabras.length >= 3 || /\p{L}{4,}/u.test(p)
    })
}

/** Corta un párrafo enorme por oraciones, sin pasarse de `MAX_PARRAFO_CHARS`. */
function partirLargo(parrafo: string): string[] {
  if (parrafo.length <= MAX_PARRAFO_CHARS) return [parrafo]

  const oraciones = parrafo.split(/(?<=[.!?…])\s+/)
  const salida: string[] = []
  let actual = ''

  for (const oracion of oraciones) {
    if (actual.length > 0 && actual.length + oracion.length + 1 > MAX_PARRAFO_CHARS) {
      salida.push(actual)
      actual = oracion
    } else {
      actual = actual.length > 0 ? `${actual} ${oracion}` : oracion
    }
  }
  if (actual.length > 0) salida.push(actual)

  // Una sola oración más larga que el bloque entero: se corta a lo bruto, porque
  // la alternativa es mandarle al modelo algo que no entra y que falle.
  return salida.flatMap((p) => (p.length <= MAX_PARRAFO_CHARS ? [p] : (p.match(new RegExp(`.{1,${MAX_PARRAFO_CHARS}}`, 'gs')) ?? [p])))
}

/**
 * Arma los bloques.
 *
 * Tres reglas, y ninguna es cosmética:
 *
 *  1. **Nunca se corta a mitad de un párrafo.** Un párrafo es una idea completa;
 *     partirlo produce tarjetas que preguntan por la mitad de algo.
 *  2. **Se prefiere cortar donde termina una frase.** Un bloque que arranca a
 *     mitad de una oración empieza sin sujeto, y el modelo genera tarjetas sobre
 *     lo que no entiende inventando.
 *  3. **Los bloques se solapan.** Una idea que quedó partida entre dos bloques
 *     aparece completa en al menos uno de los dos. El precio es que genera
 *     tarjetas repetidas, y por eso el generador deduplica después.
 */
export function chunkText(raw: string): Chunk[] {
  const parrafos = toParagraphs(raw).flatMap(partirLargo)
  if (parrafos.length === 0) return []

  const chunks: Chunk[] = []
  let inicio = 0

  while (inicio < parrafos.length) {
    let fin = inicio
    let chars = 0

    while (fin < parrafos.length && chars < TARGET_CHARS) {
      chars += parrafos[fin].length + 1
      fin++
    }

    // Retroceder hasta un final de frase, si hay uno cerca y no deja el bloque
    // demasiado corto.
    if (fin < parrafos.length) {
      const minimo = inicio + Math.max(1, Math.floor((fin - inicio) * (1 - BACKTRACK_RATIO)))
      for (let i = fin - 1; i >= minimo; i--) {
        if (isSentenceEnd(parrafos[i])) {
          fin = i + 1
          break
        }
      }
    }

    const trozo = parrafos.slice(inicio, fin)
    if (trozo.length === 0) break

    chunks.push({ index: chunks.length, paragraphs: trozo, text: trozo.join('\n\n') })

    if (fin >= parrafos.length) break

    // El siguiente bloque arranca un poco antes, repitiendo el final de éste.
    let solape = 0
    let nuevoInicio = fin
    while (nuevoInicio > inicio + 1 && solape < OVERLAP_CHARS) {
      nuevoInicio--
      solape += parrafos[nuevoInicio].length + 1
    }
    inicio = nuevoInicio
  }

  return chunks
}

/**
 * Cuántas tarjetas pedirle al modelo por bloque.
 *
 * Escala con el largo del bloque porque un bloque corto tiene dos conceptos y uno
 * largo tiene ocho. Pedir un número fijo obligaría al modelo a rellenar en los
 * cortos y a dejar cosas afuera en los largos — y rellenar es exactamente cómo
 * aparece una tarjeta inventada.
 *
 * El tope de 8 coincide con el `maxItems` del esquema a propósito: pedir más de lo
 * que la gramática deja pasar sería pedir algo que se va a truncar.
 */
export function cardsPerChunk(chunk: Chunk, densidad: 'baja' | 'normal' | 'alta'): number {
  const palabras = wordCount(chunk.text)
  /*
   * Una tarjeta cada ~85 palabras.
   *
   * La escalera de antes —2 hasta 300 palabras, 4 hasta 800, 6 hasta 1600— daba
   * saltos enormes entre tramos y, sobre todo, aplastaba los apuntes cortos:
   * medido sobre una unidad real de Bases de Datos, a cada actividad de 400 a
   * 750 palabras se le pedían 4 tarjetas y punto. Cuatro PDFs, 2.129 palabras,
   * 14 tarjetas: una unidad entera no llegaba ni a un mazo.
   *
   * 85 palabras por tarjeta es la densidad de un mazo hecho a mano sobre
   * apuntes: ni una tarjeta por párrafo, que repite, ni una por página, que no
   * sirve. Sobre los mismos cuatro PDFs pasa a pedir 4, 5, 7 y 8.
   *
   * El techo sigue siendo 8 porque es el `maxItems` del esquema: pedir más de
   * lo que la gramática puede devolver sólo confunde al modelo.
   */
  const base = Math.round(palabras / 85)
  const ajuste = densidad === 'baja' ? -2 : densidad === 'alta' ? 2 : 0
  return Math.max(2, Math.min(8, base + ajuste))
}

/** Cuenta las palabras de un texto, para decidir si vale la pena generar. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length
}
