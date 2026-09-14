/**
 * Verifica que una cita textual exista de verdad en el apunte.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto es lo que hace confiables a las tarjetas
 * ---------------------------------------------------------------------------
 *
 * Al modelo se le pide, junto a cada tarjeta, una CITA copiada literalmente del
 * fragmento del que salió. Después se busca esa cita en el texto original: si no
 * aparece por ningún lado, el modelo la inventó, y una tarjeta cuyo respaldo es
 * inventado es una tarjeta que le va a enseñar algo falso a alguien que está
 * estudiando para un final. Se descarta.
 *
 * Sin la cita habría que confiar en la palabra del modelo, y un modelo de 2B no es
 * confiable de palabra. Con la cita, cada tarjeta que sobrevive tiene un lugar
 * concreto del apunte donde está lo que dice.
 *
 * ---------------------------------------------------------------------------
 * En qué se diferencia de la versión de Convertexto
 * ---------------------------------------------------------------------------
 *
 * Allá el anclaje devuelve el MILISEGUNDO del audio en el que se dijo la frase,
 * porque el punto clave es un botón que mueve el reproductor. Acá no hay
 * reproductor ni línea de tiempo: la única pregunta es "¿esto está en el texto,
 * sí o no?". Toda la maquinaria de `fromMs`/`startMs` se fue; el algoritmo de
 * coincidencia —Dice sobre trigramas de palabras— es el mismo, que es la parte
 * que costó afinar.
 *
 * El resultado tampoco se guarda: el texto fuente se descarta al terminar de
 * generar, así que la cita cumple su función durante la generación y muere ahí.
 */

/** Coincidencia palabra por palabra: no hay nada que discutir. */
const SCORE_EXACTO = 1

/**
 * Por encima de esto, la cita se considera la misma frase.
 *
 * Elegido para tolerar lo que un modelo hace de verdad —cambiar un artículo,
 * agregar una palabra, comerse una preposición— y rechazar una frase reescrita.
 * Con Dice sobre trigramas, 0,62 en una cita de diez palabras significa que unos
 * dos tercios de sus trigramas están literalmente en el apunte.
 */
export const UMBRAL_ANCLAJE = 0.62

/** Segundo intento, con el prefijo de la cita, que suele estar más intacto. */
const UMBRAL_PREFIJO = 0.7
const PALABRAS_PREFIJO = 8

/** Cuántas ventanas candidatas se evalúan en detalle. */
const CANDIDATAS = 5

/**
 * Palabras mínimas para que una cita cuente como respaldo.
 *
 * Sin este piso, el control anti-alucinación tiene un agujero: una "cita" de una
 * sola palabra —"la", "el", "derecho"— aparece literalmente en cualquier texto, así
 * que ancla siempre, y una tarjeta completamente inventada pasaría el filtro
 * simplemente por venir acompañada de una cita degenerada.
 *
 * Al prompt se le piden entre 6 y 15 palabras. Cuatro es el piso a partir del cual
 * una secuencia deja de ser una coincidencia casual y empieza a ser evidencia de
 * que el modelo estaba mirando el texto. Lo encontró `qa/generacion.ts`.
 */
const MINIMO_PALABRAS_CITA = 4

/**
 * Normaliza para comparar: sin tildes, sin puntuación, sin mayúsculas.
 *
 * El apunte dice "prescripción" y el modelo puede devolver "prescripcion" o
 * "Prescripción,". Ninguna de esas diferencias significa nada para saber si es la
 * misma frase, y todas romperían una comparación literal.
 *
 * **La ñ también se colapsa a n**, porque NFD la descompone en `n` + tilde y la
 * tilde se va con el resto de los diacríticos. Es intencional: las dos frases que
 * se comparan pasan por acá, así que "año" y "ano" se emparejan entre sí pero
 * nunca con otra palabra distinta. Se gana robustez frente a un modelo que escribe
 * "anio" o "ano", y lo único que se pierde es la capacidad de distinguir dos
 * palabras que difieren SÓLO en la ñ — que además tendrían que estar rodeadas del
 * mismo contexto para llegar a confundirse.
 *
 * La misma función la usa el buscador de la biblioteca, por el mismo motivo: quien
 * escribe "informacion" tiene que encontrar "información".
 */
export function normalize(text: string): string {
  return (
    text
      .normalize('NFD')
      // Marcas diacríticas combinantes (U+0300–U+036F).
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export interface FlatText {
  /** Palabras normalizadas, en orden. */
  words: string[]
  /** Las palabras unidas por espacio, para la búsqueda literal. */
  joined: string
  /** `wordAt[k]` = índice de palabra que empieza en el carácter `k` de `joined`. */
  wordAt: Map<number, number>
  /** Índice invertido de trigramas de palabras → posiciones. */
  trigramas: Map<string, number[]>
}

/**
 * Prepara un texto para que se puedan buscar citas adentro.
 *
 * Se arma UNA vez por bloque y se reusa para todas las citas de ese bloque:
 * armarlo por cita sería cuadrático, y un bloque genera hasta ocho.
 */
export function flatten(text: string): FlatText {
  const words = normalize(text)
    .split(' ')
    .filter((w) => w.length > 0)

  const wordAt = new Map<number, number>()
  let pos = 0
  for (let i = 0; i < words.length; i++) {
    wordAt.set(pos, i)
    pos += words[i].length + 1
  }

  const trigramas = new Map<string, number[]>()
  for (let i = 0; i + 2 < words.length; i++) {
    const clave = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
    const lista = trigramas.get(clave)
    if (lista) lista.push(i)
    else trigramas.set(clave, [i])
  }

  return { words, joined: words.join(' '), wordAt, trigramas }
}

function trigramasDe(words: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i + 2 < words.length; i++) out.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`)
  return out
}

/**
 * Coeficiente de Dice entre dos conjuntos de trigramas.
 *
 * Se usa Dice y no una distancia de edición porque acá importa cuánto CONTENIDO
 * comparten las dos frases, no cuántas ediciones hay entre ellas. Una cita a la
 * que el modelo le agregó tres palabras al final tiene distancia de edición alta y
 * Dice alto, y es la misma frase.
 */
export function dice(a: string[], b: Set<string>): number {
  if (a.length === 0 || b.size === 0) return 0
  let comunes = 0
  for (const t of a) if (b.has(t)) comunes++
  return (2 * comunes) / (a.length + b.size)
}

function apareceLiteral(cita: string[], flat: FlatText): boolean {
  const aguja = cita.join(' ')
  if (aguja.length === 0) return false
  const at = flat.joined.indexOf(aguja)
  if (at < 0) return false
  // Sólo vale si cae en un borde de palabra: buscar "casa" no puede acertar dentro
  // de "casamiento".
  return flat.wordAt.has(at)
}

function buscarDifuso(cita: string[], flat: FlatText): number {
  const tri = trigramasDe(cita)
  if (tri.length === 0) return 0

  // Votos por ventana: cada trigrama de la cita apunta a dónde EMPEZARÍA la cita
  // si ese trigrama fuera el correcto.
  const votos = new Map<number, number>()
  for (let k = 0; k < tri.length; k++) {
    const posiciones = flat.trigramas.get(tri[k])
    if (!posiciones) continue
    for (const p of posiciones) {
      const inicio = p - k
      if (inicio < 0) continue
      votos.set(inicio, (votos.get(inicio) ?? 0) + 1)
    }
  }
  if (votos.size === 0) return 0

  const mejores = [...votos.entries()].sort((a, b) => b[1] - a[1]).slice(0, CANDIDATAS)

  let mejor = 0
  for (const [inicio] of mejores) {
    const ventana = flat.words.slice(inicio, inicio + cita.length)
    const score = dice(tri, new Set(trigramasDe(ventana)))
    if (score > mejor) mejor = score
  }
  return mejor
}

/**
 * Cuánto respalda el texto a esta cita. `0` es "no está en ningún lado".
 *
 * Tres intentos, del más barato al más caro:
 *
 *  1. Coincidencia literal. Cubre la gran mayoría de los casos y cuesta un
 *     `indexOf`.
 *  2. Difuso por trigramas, con umbral.
 *  3. Difuso sobre las primeras ocho palabras, con umbral más alto. Los modelos
 *     tienden a estirar la cita más allá de donde termina la frase; el principio
 *     casi siempre está intacto.
 */
export function quoteScore(cita: string, flat: FlatText, umbral = UMBRAL_ANCLAJE): number {
  const palabras = normalize(cita)
    .split(' ')
    .filter((w) => w.length > 0)
  if (palabras.length < MINIMO_PALABRAS_CITA || flat.words.length === 0) return 0

  if (apareceLiteral(palabras, flat)) return SCORE_EXACTO

  const difuso = buscarDifuso(palabras, flat)
  if (difuso >= umbral) return difuso

  if (palabras.length > PALABRAS_PREFIJO) {
    const prefijo = palabras.slice(0, PALABRAS_PREFIJO)
    if (apareceLiteral(prefijo, flat)) return SCORE_EXACTO

    const difusoPrefijo = buscarDifuso(prefijo, flat)
    if (difusoPrefijo >= UMBRAL_PREFIJO) return difusoPrefijo
  }

  return 0
}

/** Atajo legible para el generador: ¿esta cita está respaldada por el texto? */
export function isGrounded(cita: string, flat: FlatText): boolean {
  return quoteScore(cita, flat) > 0
}

/* ---------------------------- parecido entre frases ---------------------------- */


/**
 * Umbral de parecido literal, para el caso de contención.
 *
 * Sólo entra en juego cuando una pregunta menciona exactamente las mismas cosas
 * que la otra más alguna: ahí lo único que falta decidir es si lo que se agregó
 * cambia el concepto. Medido sobre pares reales, los que hay que conservar
 * ("¿qué es una variable?" contra "¿qué es una variable aleatoria discreta?")
 * quedan en 0,60-0,82 y los que hay que fusionar ("...modelo híbrido" contra
 * "...modelo híbrido en MongoDB") en 0,84-0,86. 0,83 parte esa banda sin
 * fusionar ninguno de los que hay que conservar.
 */
export const UMBRAL_DUPLICADO = 0.83

/**
 * Palabras que no dicen de qué trata la pregunta: artículos, preposiciones y el
 * andamiaje del interrogante. Se sacan antes de comparar de qué habla cada una.
 */
const PALABRAS_VACIAS = new Set(
  (
    'que es son un una unos unas el la los las de del en y o a al se cual cuales como ' +
    'cuando donde por para con sin sobre su sus lo le mas muy ser esta este estos estas ' +
    'eso ese esa the is are what which how of in to and or for an'
  ).split(' ')
)

/**
 * Plural a singular, a lo bruto. No es un lematizador: sólo empareja
 * "relaciones" con "relación" y "atributos" con "atributo", que es de lejos la
 * diferencia más común entre dos preguntas que son la misma.
 */
function raiz(palabra: string): string {
  if (palabra.length > 4 && palabra.endsWith('es')) return palabra.slice(0, -2)
  if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1)
  return palabra
}

/** De qué habla una pregunta: sus palabras con contenido, contadas. */
function bolsa(texto: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of normalize(texto).split(' ')) {
    if (!p || PALABRAS_VACIAS.has(p)) continue
    const r = raiz(p)
    m.set(r, (m.get(r) ?? 0) + 1)
  }
  return m
}

/** ¿Todo lo que menciona `a` lo menciona también `b`, con al menos la misma frecuencia? */
function contenida(a: Map<string, number>, b: Map<string, number>): boolean {
  for (const [p, n] of a) if ((b.get(p) ?? 0) < n) return false
  return true
}

/**
 * Huella de un frente: sus trigramas de CARACTERES más las palabras de las que habla.
 *
 * Los trigramas son de caracteres y no de palabras —a diferencia del anclaje de
 * citas— porque acá se comparan frases cortas, de cinco o seis palabras, donde
 * los trigramas de palabras serían tres o cuatro y una sola palabra distinta
 * hundiría el puntaje.
 */
export interface Huella {
  tri: Set<string>
  bolsa: Map<string, number>
}

export function fingerprint(texto: string): Huella {
  const s = ` ${normalize(texto)} `
  const tri = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) tri.add(s.slice(i, i + 3))
  return { tri, bolsa: bolsa(texto) }
}

/** Coeficiente de Dice entre dos huellas. 1 es idéntico. */
export function similarity(a: Huella, b: Huella): number {
  if (a.tri.size === 0 || b.tri.size === 0) return 0
  let comunes = 0
  for (const t of a.tri) if (b.tri.has(t)) comunes++
  return (2 * comunes) / (a.tri.size + b.tri.size)
}

/**
 * ¿Son la misma pregunta?
 *
 * El parecido literal solo no alcanza, y el motivo es que se equivoca justo
 * donde más caro sale. "¿Qué es una relación uno a uno?" y "¿qué es una
 * relación uno a muchos?" se parecen en 0,86 y son dos tarjetas distintas; lo
 * mismo "nominales" contra "ordinales", "vectores" contra "factores" y "Write
 * concern" contra "Read concern". Fusionarlas le borra al estudiante justo la
 * distinción que tiene que aprender.
 *
 * Así que primero se mira de qué habla cada una:
 *
 *  - si mencionan exactamente las mismas cosas, son la misma pregunta escrita
 *    de dos formas ("¿qué es una población?" / "¿qué es la población?");
 *  - si una menciona todo lo de la otra y algo más, decide el parecido literal;
 *  - si cada una menciona algo que la otra no, son distintas y punto.
 */
export function esLaMisma(a: Huella, b: Huella): boolean {
  const aVacia = a.bolsa.size === 0
  const bVacia = b.bolsa.size === 0
  if (aVacia || bVacia) return similarity(a, b) >= UMBRAL_DUPLICADO
  const aEnB = contenida(a.bolsa, b.bolsa)
  const bEnA = contenida(b.bolsa, a.bolsa)
  if (aEnB && bEnA) return true
  if (!aEnB && !bEnA) return false
  return similarity(a, b) >= UMBRAL_DUPLICADO
}

/** ¿Alguna de las huellas ya vistas es prácticamente ésta? */
export function isDuplicate(huella: Huella, vistas: Huella[]): boolean {
  return vistas.some((v) => esLaMisma(v, huella))
}
