import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { AppError } from '../core/errors'

/**
 * Extracción de texto de un .pptx (filminas de clase).
 *
 * ---------------------------------------------------------------------------
 * Por qué a mano y no con una librería
 * ---------------------------------------------------------------------------
 *
 * Un .pptx es un ZIP con un XML por filmina en `ppt/slides/slideN.xml`, y el texto
 * está en elementos `<a:t>`. Eso es todo lo que hace falta. Las librerías de pptx
 * que hay dan vuelta el mundo para reconstruir formas, animaciones y posiciones —
 * cosas que acá no se usan— y pesan bastante más que las treinta líneas de abajo.
 * `fflate` (MIT, ~30 KB, JS puro) descomprime, y el resto es un regex sobre XML.
 *
 * Parsear XML con un regex es normalmente una mala idea. Acá es aceptable y vale
 * la pena decir por qué: no se está entendiendo la estructura del documento, sólo
 * cosechando el contenido de un tipo de elemento que no anida elementos adentro.
 * Un `<a:t>` contiene texto y nada más — es la hoja del árbol.
 *
 * ---------------------------------------------------------------------------
 * Lo que hay que esperar de las filminas
 * ---------------------------------------------------------------------------
 *
 * Poco texto y muy telegráfico: títulos, viñetas de cuatro palabras, flechas. Es
 * material del que un modelo chico saca tarjetas flojas, porque las filminas son
 * el apoyo de una explicación hablada y no la explicación. Por eso el despachador
 * avisa cuando el promedio de palabras por filmina es bajo.
 */

/** El orden importa: slide2 va antes que slide10, y el orden alfabético no lo respeta. */
function numeroDeFilmina(nombre: string): number {
  const m = /slide(\d+)\.xml$/.exec(nombre)
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER
}

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'"
}

function desescapar(xml: string): string {
  return xml
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
}

export interface PptxExtraction {
  /** Un párrafo por filmina, con su título adelante. */
  parrafos: string[]
  filminas: number
}

export function extractPptx(path: string): PptxExtraction {
  let archivos: Record<string, Uint8Array>
  try {
    archivos = unzipSync(new Uint8Array(readFileSync(path)))
  } catch (err) {
    throw new AppError('No se pudo abrir la presentación. Puede estar dañada o no ser realmente un .pptx.', { cause: err })
  }

  const nombres = Object.keys(archivos)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => numeroDeFilmina(a) - numeroDeFilmina(b))

  if (nombres.length === 0) {
    throw new AppError('Esa presentación no tiene filminas con texto. Si el contenido son imágenes, copiá el texto a mano y pegalo.')
  }

  const decoder = new TextDecoder('utf-8')
  const parrafos: string[] = []

  for (const nombre of nombres) {
    const xml = decoder.decode(archivos[nombre])

    // `<a:p>` es un párrafo de la filmina y `<a:t>` cada corrida de texto adentro.
    // Se junta por párrafo para no pegar el título con la primera viñeta.
    const bloques: string[] = []
    for (const p of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
      const texto = (p.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((t) => desescapar(t.replace(/<a:t\b[^>]*>/, '').replace(/<\/a:t>/, '')))
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
      if (texto.length > 0) bloques.push(texto)
    }

    if (bloques.length === 0) continue
    // Las viñetas de una filmina son una sola idea repartida en renglones: se
    // juntan con " · " para que el modelo las vea como un bloque y no como cinco
    // fragmentos sueltos de tres palabras.
    parrafos.push(bloques.join(' · '))
  }

  return { parrafos, filminas: nombres.length }
}
