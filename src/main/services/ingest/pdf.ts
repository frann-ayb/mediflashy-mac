import { readFileSync } from 'node:fs'
import { AppError } from '../core/errors'
import { logger } from '../core/logger'

/**
 * Extracción de texto de un PDF.
 *
 * ---------------------------------------------------------------------------
 * Por qué pdfjs-dist 3.11.174 y no la última
 * ---------------------------------------------------------------------------
 *
 * LA VERSIÓN ESTÁ CLAVADA A PROPÓSITO. No es que quedó vieja.
 *
 * A partir de la 4.x, pdfjs-dist es ESM puro: hasta el build "legacy" es un
 * `.mjs`. El proceso principal de esta app es CommonJS (`"type": "commonjs"` en
 * package.json, que es lo que Electron necesita sin meterse en el soporte
 * experimental de ESM en el main). Un `import()` dinámico de un paquete ESM
 * externalizado, compilado a CJS por rollup, termina en un
 * `Promise.resolve().then(() => require(...))` que explota en tiempo de ejecución
 * con ERR_REQUIRE_ESM — y explota en la app empaquetada, no en desarrollo, que es
 * la peor forma de encontrarlo.
 *
 * La 3.11.174 es la última que trae `legacy/build/pdf.js` en CommonJS de verdad.
 * Para lo que se usa acá —`getTextContent()`, que es API estable desde hace
 * años— no hay nada en las versiones nuevas que se esté perdiendo.
 *
 * Si algún día se sube: hay que verificar que la app EMPAQUETADA abra un PDF, no
 * alcanza con `npm run dev`.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto es lo más frágil de toda la app
 * ---------------------------------------------------------------------------
 *
 * Un PDF no guarda párrafos: guarda pedacitos de texto con una posición. Volver a
 * armar el orden de lectura es una heurística, siempre. Por eso el resultado NUNCA
 * va directo al modelo: se le muestra al usuario para que lo revise, y cuando la
 * heurística detecta que pisó terreno resbaladizo lo dice con un aviso.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Fragmento {
  str: string
  x: number
  y: number
  ancho: number
}

/** Dos fragmentos con menos de esta diferencia vertical están en el mismo renglón. */
const TOLERANCIA_RENGLON = 3

/**
 * Cuánto tiene que separarse verticalmente un renglón del anterior para que se
 * considere un párrafo nuevo, en múltiplos del interlineado típico de la página.
 */
const FACTOR_PARRAFO = 1.6

function cargarPdfjs(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('pdfjs-dist/legacy/build/pdf.js')
  } catch (err) {
    throw new AppError('No se pudo cargar el lector de PDF. Reinstalá la app desde el instalador original.', { cause: err })
  }
}

/**
 * ¿La página está a dos columnas?
 *
 * La señal es que casi ningún renglón cruza el centro. En un texto a una columna
 * la mayoría de los renglones arrancan a la izquierda y terminan pasado el medio;
 * en uno a dos columnas, cada renglón vive entero de un lado.
 *
 * Se pide además que haya renglones de los DOS lados: una página con una sola
 * columna angosta pegada a la izquierda (una portada, un índice) también tiene
 * pocos cruces del centro, y tratarla como dos columnas no la rompería pero sí
 * dispararía un aviso al pedo.
 */
function esDosColumnas(renglones: Fragmento[][], medio: number): boolean {
  if (renglones.length < 8) return false

  let cruzan = 0
  let izquierda = 0
  let derecha = 0

  for (const r of renglones) {
    const desde = Math.min(...r.map((f) => f.x))
    const hasta = Math.max(...r.map((f) => f.x + f.ancho))
    if (desde < medio && hasta > medio) cruzan++
    else if (hasta <= medio) izquierda++
    else derecha++
  }

  const total = renglones.length
  return cruzan / total < 0.15 && izquierda / total > 0.25 && derecha / total > 0.25
}

/** Agrupa fragmentos en renglones por su coordenada vertical. */
function agruparRenglones(frags: Fragmento[]): Fragmento[][] {
  const ordenados = [...frags].sort((a, b) => b.y - a.y || a.x - b.x)
  const renglones: Fragmento[][] = []

  for (const f of ordenados) {
    const ultimo = renglones[renglones.length - 1]
    if (ultimo && Math.abs(ultimo[0].y - f.y) <= TOLERANCIA_RENGLON) ultimo.push(f)
    else renglones.push([f])
  }

  for (const r of renglones) r.sort((a, b) => a.x - b.x)
  return renglones
}

/**
 * Une renglones en párrafos.
 *
 * El corte lo da el salto vertical: si entre dos renglones hay bastante más
 * espacio que el interlineado normal de la página, empezó un párrafo. El
 * interlineado se mide de la propia página en vez de usar un número fijo, porque
 * un apunte a doble espacio y una filmina tienen interlineados muy distintos y un
 * umbral fijo acertaría en uno y fallaría en el otro.
 */
function armarParrafos(renglones: Fragmento[][]): string[] {
  if (renglones.length === 0) return []

  const saltos: number[] = []
  for (let i = 1; i < renglones.length; i++) {
    const d = renglones[i - 1][0].y - renglones[i][0].y
    if (d > 0) saltos.push(d)
  }
  saltos.sort((a, b) => a - b)
  const interlineado = saltos.length > 0 ? saltos[Math.floor(saltos.length / 2)] : 0

  const parrafos: string[] = []
  let actual: string[] = []

  const cerrar = (): void => {
    if (actual.length === 0) return
    parrafos.push(
      actual
        .join(' ')
        // Palabra cortada a fin de renglón: "consti- tución" vuelve a ser una.
        .replace(/(\p{Ll})-\s+(\p{Ll})/gu, '$1$2')
        .replace(/\s+/g, ' ')
        .trim()
    )
    actual = []
  }

  for (let i = 0; i < renglones.length; i++) {
    const texto = renglones[i]
      .map((f) => f.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (texto.length === 0) continue

    if (i > 0 && interlineado > 0) {
      const salto = renglones[i - 1][0].y - renglones[i][0].y
      if (salto > interlineado * FACTOR_PARRAFO) cerrar()
    }
    actual.push(texto)
  }
  cerrar()

  return parrafos
}

export interface PdfExtraction {
  parrafos: string[]
  paginas: number
  dosColumnas: boolean
}

export async function extractPdf(path: string): Promise<PdfExtraction> {
  const pdfjs = cargarPdfjs()

  let doc: any
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(readFileSync(path)),
      // Sin worker: en el proceso principal no hay Web Workers, y para extraer
      // texto no hace falta paralelizar nada.
      useWorkerFetch: false,
      isEvalSupported: false,
      // No se renderiza nada, así que cargar las fuentes sería trabajo tirado.
      disableFontFace: true,
      // Silencia los avisos de pdfjs sobre PDFs mal formados. Son ruido: el
      // usuario no puede hacer nada con "TT: undefined function 32".
      verbosity: 0
    }).promise
  } catch (err) {
    const detalle = err instanceof Error ? err.message : ''
    if (/password/i.test(detalle)) {
      throw new AppError('Ese PDF está protegido con contraseña y no se puede leer. Abrilo, guardalo sin contraseña y probá de nuevo.')
    }
    throw new AppError('No se pudo abrir el PDF. Puede estar dañado o no ser realmente un PDF.', { cause: err })
  }

  const parrafos: string[] = []
  const paginas = doc.numPages
  let dosColumnas = false

  try {
    for (let p = 1; p <= paginas; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()

      const frags: Fragmento[] = content.items
        .filter((it: any) => typeof it.str === 'string' && it.str.trim().length > 0)
        .map((it: any) => ({
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          ancho: it.width ?? 0
        }))

      page.cleanup()
      if (frags.length === 0) continue

      const renglones = agruparRenglones(frags)
      const medio = (Math.min(...frags.map((f) => f.x)) + Math.max(...frags.map((f) => f.x + f.ancho))) / 2

      if (esDosColumnas(renglones, medio)) {
        dosColumnas = true
        // Columna izquierda entera y después la derecha. Sin esto, el orden de
        // lectura sale intercalado renglón a renglón y el modelo recibe una
        // ensalada de la que genera tarjetas sin sentido.
        const derechaDe = (r: Fragmento[]): boolean => Math.max(...r.map((f) => f.x + f.ancho)) > medio
        parrafos.push(...armarParrafos(renglones.filter((r) => !derechaDe(r))))
        parrafos.push(...armarParrafos(renglones.filter(derechaDe)))
      } else {
        parrafos.push(...armarParrafos(renglones))
      }
    }
  } catch (err) {
    // Una página rota no tiene por qué tirar abajo el apunte entero: se devuelve
    // lo que se alcanzó a leer y el usuario decide si le alcanza.
    logger.warn('ingesta', 'Una página del PDF no se pudo leer; se sigue con el resto.', err)
  } finally {
    try {
      await doc.destroy()
    } catch {
      /* nada que hacer */
    }
  }

  return { parrafos, paginas, dosColumnas }
}
