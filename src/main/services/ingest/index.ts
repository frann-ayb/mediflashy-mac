import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, extname } from 'node:path'
import type { ExtractedDoc } from '@shared/types'
import { SUPPORTED_DOC_EXTENSIONS } from '@shared/types'
import { AppError } from '../core/errors'
import { logger, redactPath } from '../core/logger'
import { formatBytes } from '../core/fsutil'
import { wordCount } from '../core/chunker'
import { extractPdf } from './pdf'
import { extractDocx } from './docx'
import { extractPptx } from './pptx'

/**
 * De un archivo a texto revisable.
 *
 * ---------------------------------------------------------------------------
 * El texto no se guarda. Nunca.
 * ---------------------------------------------------------------------------
 *
 * Lo que sale de acá viaja al renderer, el usuario lo revisa, se manda a generar y
 * muere. No se escribe a disco en ningún paso — ni como cache, ni "por si el
 * usuario quiere generar más tarjetas después". Es una decisión del producto: el
 * apunte es del usuario y la app no se queda con una copia.
 *
 * La consecuencia práctica es que "generar más tarjetas de esta unidad" obliga a
 * volver a cargar el archivo. Está bien que sea así.
 *
 * Al log tampoco entra el contenido: sólo el tamaño, el formato y cuántas palabras
 * salieron. El nombre del archivo va redactado, porque "Final Anatomía - bolilla 7
 * (lo que toma Pérez).pdf" dice qué estudia el usuario, con quién y cuándo rinde.
 */

/** Más que esto no entra: un libro entero no es material para un mazo de tarjetas. */
const MAX_BYTES = 80 * 1024 * 1024
/** Con menos palabras que esto no hay nada que hacer. */
const MIN_PALABRAS = 30

/**
 * Debajo de este promedio de palabras por página, un PDF es casi seguro un
 * escaneo: páginas que son una imagen y traen, con suerte, un número de página
 * suelto en una capa de texto.
 */
const PALABRAS_POR_PAGINA_ESCANEADO = 15

/** Debajo de esto, una presentación es demasiado telegráfica para dar buenas tarjetas. */
const PALABRAS_POR_FILMINA_FLOJA = 12

const AVISO_PDF_COLUMNAS =
  'Este PDF está a dos columnas. La app las reordenó para que se lean bien, pero revisá el texto antes de generar: si ves frases mezcladas, conviene copiar el texto a mano y pegarlo.'

const AVISO_PPTX_FLOJO =
  'Las filminas tienen poco texto, que es lo normal: son el apoyo de una explicación hablada. Las tarjetas van a salir bastante básicas. Si tenés los apuntes de la clase, van a dar mejor resultado.'

export function esExtensionSoportada(path: string): boolean {
  const ext = extname(path).replace('.', '').toLowerCase()
  return (SUPPORTED_DOC_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Texto pegado a mano: el camino directo, y el que mejor funciona.
 *
 * No hay heurística de ningún tipo — lo que el usuario pegó es exactamente lo que
 * quiso pegar. Por eso la interfaz lo ofrece primero y le dice que da mejores
 * resultados: no es una consigna vacía, es que acá no hay nada que pueda salir
 * mal, y en un PDF sí.
 */
export function fromPastedText(texto: string): ExtractedDoc {
  const limpio = String(texto ?? '').trim()
  const palabras = wordCount(limpio)
  if (palabras < MIN_PALABRAS) {
    throw new AppError(`Hace falta un poco más de texto para armar tarjetas: pegá al menos ${MIN_PALABRAS} palabras.`)
  }
  return { texto: limpio, nombre: 'Texto pegado', palabras }
}

export async function extractDocument(path: string): Promise<ExtractedDoc> {
  if (!existsSync(path)) throw new AppError('No se encontró el archivo. Puede haberse movido o borrado.')

  const stats = statSync(path)
  if (stats.isDirectory()) throw new AppError('Eso es una carpeta, no un archivo.')
  if (stats.size === 0) throw new AppError('El archivo está vacío.')
  if (stats.size > MAX_BYTES) {
    throw new AppError(`El archivo pesa ${formatBytes(stats.size)} y el máximo es ${formatBytes(MAX_BYTES)}. Probá con una parte del material.`)
  }

  const ext = extname(path).replace('.', '').toLowerCase()
  const nombre = basename(path)
  logger.info('ingesta', `Leyendo ${redactPath(path)} (${ext}, ${formatBytes(stats.size)}).`)

  let parrafos: string[]
  let aviso: string | undefined

  switch (ext) {
    case 'txt':
    case 'md': {
      parrafos = leerTextoPlano(path)
      break
    }
    case 'docx': {
      parrafos = (await extractDocx(path)).parrafos
      break
    }
    case 'pptx': {
      const r = extractPptx(path)
      parrafos = r.parrafos
      if (r.filminas > 0 && wordCount(parrafos.join(' ')) / r.filminas < PALABRAS_POR_FILMINA_FLOJA) aviso = AVISO_PPTX_FLOJO
      break
    }
    case 'pdf': {
      const r = await extractPdf(path)
      parrafos = r.parrafos
      const palabras = wordCount(parrafos.join(' '))
      // El chequeo de escaneado va ANTES del de columnas: un PDF escaneado no
      // llega a la pantalla de revisión, así que avisarle de las columnas sería
      // hablar de un texto que no existe.
      if (r.paginas > 0 && palabras / r.paginas < PALABRAS_POR_PAGINA_ESCANEADO) throw errorEscaneado(r.paginas)
      if (r.dosColumnas) aviso = AVISO_PDF_COLUMNAS
      break
    }
    default:
      throw new AppError(
        `La app no sabe leer archivos ".${ext}". Puede abrir PDF, Word (.docx), PowerPoint (.pptx) y texto (.txt, .md). También podés copiar el texto y pegarlo.`
      )
  }

  const texto = parrafos.join('\n\n').trim()
  const palabras = wordCount(texto)

  if (palabras < MIN_PALABRAS) {
    throw new AppError(
      'Casi no se pudo sacar texto de este archivo. Si el contenido son imágenes o está escaneado, copiá el texto a mano y pegalo.'
    )
  }

  logger.info('ingesta', `Extraídas ${palabras} palabra(s) en ${parrafos.length} párrafo(s).`)
  return { texto, nombre, palabras, ...(aviso ? { aviso } : {}) }
}

/**
 * El mensaje del PDF escaneado.
 *
 * Se explica QUÉ pasó y no sólo que falló, porque para el usuario un PDF escaneado
 * y uno normal se ven exactamente igual: los dos abren en el visor y los dos
 * muestran texto. Sin la explicación, la conclusión razonable es "la app está
 * rota", y con ella es "ah, es una foto".
 *
 * No se hace OCR a propósito: sumaría unos 15 MB al instalador, tardaría minutos
 * por apunte y con letra manuscrita —que es la mitad de los apuntes escaneados de
 * la facultad— daría un texto lleno de errores del que saldrían tarjetas con
 * errores. Prometer poco y cumplirlo.
 */
function errorEscaneado(paginas: number): AppError {
  return new AppError(
    `Este PDF no tiene texto: sus ${paginas} página(s) son imágenes, como pasa cuando se escanea o se fotografía un apunte. ` +
      'La app no puede leer imágenes. Si tenés el texto en otro lado, copialo y pegalo.'
  )
}

/**
 * Texto plano. Se detecta el BOM de UTF-16, que es lo que deja el Bloc de notas de
 * Windows al guardar como "Unicode": leído como UTF-8 saldría un carácter nulo
 * entre cada letra y el resultado sería basura sin que nada falle.
 */
function leerTextoPlano(path: string): string[] {
  const buf = readFileSync(path)

  let texto: string
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) texto = buf.toString('utf16le', 2)
  else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) texto = buf.swap16().toString('utf16le', 2)
  else texto = buf.toString('utf8').replace(/^﻿/, '')

  return texto
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length > 0)
}
