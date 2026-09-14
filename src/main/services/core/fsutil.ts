import { closeSync, existsSync, fsyncSync, openSync, rmSync, statSync, statfsSync, writeSync } from 'node:fs'
import { join, parse } from 'node:path'
import { logger } from './logger'

/** Nombres reservados por Windows: no pueden usarse ni con extensión. */
const WINDOWS_RESERVED = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`)
])

/** Caracteres que Windows rechaza en un nombre de archivo. */
const ILLEGAL = /[<>:"/\\|?*]/g

function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 32 && code !== 127
    })
    .join('')
}

/**
 * Convierte el nombre de un archivo de entrada en un nombre de salida seguro.
 * Acentos, ñ, espacios, guiones y paréntesis se conservan tal cual: sólo se
 * reemplaza lo que el sistema de archivos rechaza.
 */
export function safeBaseName(inputName: string, maxLength = 120): string {
  let base = stripControlChars(parse(inputName).name)
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Windows no admite punto ni espacio al final del nombre.
    .replace(/[. ]+$/g, '')

  if (base.length === 0) base = 'transcripcion'
  if (WINDOWS_RESERVED.has(base.toLowerCase())) base = `${base}_`

  if (base.length > maxLength) base = base.slice(0, maxLength).replace(/[. ]+$/g, '')
  return base.length > 0 ? base : 'transcripcion'
}

/**
 * Limpia un nombre que TIPEÓ el usuario (renombrar una grabación).
 *
 * No es lo mismo que `safeBaseName`, y la diferencia importa: aquella función
 * recibe el nombre de un archivo que ya existe y usa `path.parse()` para separar
 * la extensión, con lo cual trata `/` y `\` como separadores de carpeta y se
 * queda sólo con el último tramo. Con texto libre eso destruye el nombre:
 * "Reunión con Ñandú: parte 1/2" terminaba siendo "2".
 *
 * Acá `/` y `\` son caracteres inválidos como cualquier otro —se reemplazan por
 * un espacio— y no se busca ninguna extensión: el nombre es todo lo que el
 * usuario escribió. Acentos, ñ, espacios y paréntesis se conservan tal cual.
 */
export function safeDisplayName(input: string, maxLength = 120): string {
  let base = stripControlChars(typeof input === 'string' ? input : '')
    .replace(ILLEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Windows no admite punto ni espacio al final del nombre.
    .replace(/[. ]+$/g, '')

  if (base.length === 0) base = 'Grabacion'
  if (WINDOWS_RESERVED.has(base.toLowerCase())) base = `${base}_`
  if (base.length > maxLength) base = base.slice(0, maxLength).replace(/[. ]+$/g, '')
  return base.length > 0 ? base : 'Grabacion'
}

/**
 * Devuelve una ruta libre dentro de `dir`. Si `base.ext` ya existe, prueba
 * `base (2).ext`, `base (3).ext`, … para no sobrescribir nada del usuario.
 */
export function uniqueOutputPath(dir: string, base: string, ext: string): string {
  const extension = ext.startsWith('.') ? ext : `.${ext}`

  // Windows corta las rutas en 260 caracteres si no está habilitado el soporte
  // de rutas largas: recortamos el nombre para dejar margen al sufijo.
  const budget = 250 - dir.length - extension.length - 8
  let name = base
  if (budget > 8 && name.length > budget) name = name.slice(0, budget).replace(/[. ]+$/g, '')
  if (name.length === 0) name = 'transcripcion'

  const first = join(dir, `${name}${extension}`)
  if (!existsSync(first)) return first

  for (let i = 2; i < 10000; i++) {
    const candidate = join(dir, `${name} (${i})${extension}`)
    if (!existsSync(candidate)) return candidate
  }
  // Caso extremo prácticamente inalcanzable: sufijo con marca de tiempo.
  return join(dir, `${name} (${Date.now()})${extension}`)
}

/** Bloque de ceros reutilizado por `shredFile`. 1 MB es un buen compromiso. */
const ZEROS = Buffer.alloc(1024 * 1024)

/**
 * Borra un archivo sobrescribiéndolo antes con ceros.
 *
 * Los archivos intermedios son el audio completo del usuario (WAV) y su
 * transcripción (JSON). Un `unlink` a secas sólo suelta la entrada de directorio
 * y deja el contenido recuperable con herramientas de recuperación comunes.
 *
 * Alcance honesto: sobre SSD con wear leveling, o sobre sistemas de archivos con
 * copia en escritura o snapshots, la sobrescritura no garantiza que no quede una
 * copia física del bloque original. Sube bastante el listón, no lo vuelve
 * imposible. La defensa real es que estos archivos duran lo que dura la
 * transcripción.
 */
export function shredFile(file: string): void {
  try {
    if (!existsSync(file)) return
    const size = statSync(file).size
    if (size > 0) {
      const fd = openSync(file, 'r+')
      try {
        let written = 0
        while (written < size) {
          const length = Math.min(ZEROS.length, size - written)
          writeSync(fd, ZEROS, 0, length, written)
          written += length
        }
        fsyncSync(fd)
      } finally {
        closeSync(fd)
      }
    }
  } catch {
    // Si el archivo está tomado por otro proceso no se puede sobrescribir; se
    // intenta borrarlo igual y, si tampoco se puede, lo limpia el próximo arranque.
  }
  try {
    rmSync(file, { force: true })
  } catch {
    /* se limpia al próximo arranque */
  }
}

export interface DiskSpace {
  availableBytes: number
  known: boolean
}

/** Espacio libre en el volumen que contiene `dir`. */
export function freeSpace(dir: string): DiskSpace {
  try {
    const stats = statfsSync(dir)
    return { availableBytes: Number(stats.bsize) * Number(stats.bavail), known: true }
  } catch (err) {
    logger.warn('fsutil', `No pude medir el espacio libre en ${dir}.`, err)
    return { availableBytes: Number.POSITIVE_INFINITY, known: false }
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
