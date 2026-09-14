import { AppError } from '../core/errors'
import { logger } from '../core/logger'

/**
 * Extracción de texto de un .docx.
 *
 * Es el formato MÁS confiable de los cuatro, y por lejos. Un .docx es XML
 * estructurado: los párrafos están marcados como párrafos, las listas como listas
 * y las tablas como tablas. No hay que adivinar el orden de lectura como en un
 * PDF — ya viene dado.
 *
 * Se usa `mammoth` en vez de parsear el XML a mano (que sería posible con el mismo
 * `fflate` que usa el .pptx) porque el .docx tiene bastante más superficie: notas
 * al pie, numeración automática de listas, tablas anidadas, campos, y texto dentro
 * de cuadros. mammoth ya resolvió todo eso, es BSD-2 y no trae binarios nativos.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DocxExtraction {
  parrafos: string[]
}

export async function extractDocx(path: string): Promise<DocxExtraction> {
  let mammoth: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mammoth = require('mammoth')
  } catch (err) {
    throw new AppError('No se pudo cargar el lector de Word. Reinstalá la app desde el instalador original.', { cause: err })
  }

  let resultado: any
  try {
    resultado = await mammoth.extractRawText({ path })
  } catch (err) {
    const detalle = err instanceof Error ? err.message : ''
    // El .doc viejo (binario, anterior a Office 2007) NO es un .docx y mammoth no
    // lo lee. Vale la pena distinguirlo porque el usuario ve un ícono de Word en
    // los dos casos y no tiene por qué saber la diferencia.
    if (/end of central directory|zip/i.test(detalle)) {
      throw new AppError(
        'Ese archivo parece ser un .doc del Word viejo, no un .docx. Abrilo en Word, usá "Guardar como" y elegí "Documento de Word (.docx)".'
      )
    }
    throw new AppError('No se pudo leer el documento de Word. Puede estar dañado.', { cause: err })
  }

  // mammoth avisa de lo que no supo convertir (imágenes, estilos raros). No es un
  // error para el usuario —el texto salió igual— pero sirve en el log si alguna vez
  // reporta que le faltó una parte del apunte.
  const mensajes: any[] = Array.isArray(resultado?.messages) ? resultado.messages : []
  if (mensajes.length > 0) {
    logger.info('ingesta', `El .docx se leyó con ${mensajes.length} aviso(s) de conversión.`)
  }

  const parrafos = String(resultado?.value ?? '')
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)

  return { parrafos }
}
