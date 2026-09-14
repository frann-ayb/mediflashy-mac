import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, rmSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { createHash } from 'node:crypto'

const MAX_BYTES = 2 * 1024 * 1024
type Level = 'INFO' | 'WARN' | 'ERROR'

/* ------------------------------- redacción -------------------------------- */

/**
 * El nombre de un archivo es un dato del usuario, no un detalle técnico:
 * "Final Anatomía - bolilla 7 (lo que me tomó Pérez).pdf" dice qué estudia, con
 * quién y cuándo rinde. El log se guarda sin cifrar y, sobre todo, la ayuda le
 * pide al usuario que lo mande cuando algo falla. Así que al log no entran
 * nombres ni rutas.
 *
 * TAMPOCO ENTRA NADA DEL CONTENIDO: ni el texto del apunte, ni el frente o el
 * dorso de una tarjeta, ni el mini-prompt que el usuario escribe al generar. Eso
 * no lo puede garantizar este archivo —lo tiene que respetar quien loguea—, pero
 * queda dicho acá porque es donde alguien va a venir a buscar la regla.
 *
 * Se guarda una etiqueta derivada del nombre: es estable, así que sigue siendo
 * posible seguir un mismo archivo a lo largo de todas las líneas del log —que es
 * lo único que hace falta para diagnosticar—, pero no permite reconstruir el
 * nombre. La extensión se conserva porque sí es información técnica útil.
 *
 * Dónde va el límite: se redacta todo lo que elige el usuario (los apuntes que
 * carga). Las rutas propias de la app —modelos, userData— se loguean enteras: la
 * mitad de los problemas que se
 * diagnostican con este log son justamente de rutas y permisos, y lo único que
 * revelan es el nombre de la cuenta de Windows, que quien recibe el log ya
 * conoce porque el usuario le está escribiendo.
 */
export function redactPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '<vacío>'
  const tag = createHash('sha1').update(value).digest('hex').slice(0, 8)
  const ext = extname(value).toLowerCase()
  return ext ? `<archivo#${tag}>${ext}` : `<ruta#${tag}>`
}

/**
 * Reemplaza rutas de usuario dentro de un texto que no controlamos (típicamente
 * la salida de error de ffmpeg, que repite la ruta del archivo de entrada).
 * Se reemplaza también el nombre suelto, porque las herramientas suelen
 * mencionarlo sin la carpeta.
 */
export function scrub(text: string, ...paths: string[]): string {
  let out = text
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0) continue
    const masked = redactPath(path)
    out = out.split(path).join(masked)
    const name = basename(path)
    if (name.length > 3) out = out.split(name).join(masked)
  }
  return out
}

let logFile = ''
let ready = false
/** Mensajes emitidos antes de que el logger tuviera un archivo donde escribir. */
const pending: string[] = []

function stamp(): string {
  const d = new Date()
  const p = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(
    d.getSeconds()
  )}.${p(d.getMilliseconds(), 3)}`
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logFile)) return
    if (statSync(logFile).size < MAX_BYTES) return
    const previous = `${logFile}.1`
    if (existsSync(previous)) rmSync(previous, { force: true })
    renameSync(logFile, previous)
  } catch {
    /* si la rotación falla seguimos escribiendo en el archivo actual */
  }
}

function write(line: string): void {
  if (!ready) {
    pending.push(line)
    if (pending.length > 500) pending.shift()
    return
  }
  try {
    rotateIfNeeded()
    appendFileSync(logFile, line + '\n', 'utf8')
  } catch {
    /* nunca dejamos que el logging tire la app */
  }
}

/**
 * Representación textual del detalle que acompaña a una línea de log. Se expone
 * para poder pasarla por `scrub` antes de loguearla: el mensaje de un `Error`
 * suele arrastrar la ruta del archivo que lo provocó.
 */
export function describeError(extra: unknown): string {
  if (extra instanceof Error) {
    return `${extra.name}: ${extra.message}${extra.stack ? `\n${extra.stack}` : ''}`
  }
  if (typeof extra === 'string') return extra
  try {
    return JSON.stringify(extra) ?? String(extra)
  } catch {
    return String(extra)
  }
}

function format(level: Level, scope: string, message: string, extra?: unknown): string {
  let line = `${stamp()} [${level}] [${scope}] ${message}`
  if (extra !== undefined) line += ` | ${describeError(extra)}`
  return line
}

export const logger = {
  init(logsDir: string): void {
    try {
      mkdirSync(logsDir, { recursive: true })
      // El archivo lleva el nombre del producto. Se llamaba "flashcards.log",
      // heredado del árbol del que salió esta copia: el instructivo le pide al
      // comprador que adjunte "el archivo de registro" y le abre una carpeta
      // donde el único archivo dice el nombre de otra app.
      //
      // Y volvió a pasar: al copiar el árbol para Mediflashy quedó
      // "psicoflashy.log". Es el mismo error dos veces seguidas, y por eso el
      // nombre ya no se escribe suelto: sale de `app.getName()`, que es el
      // `productName` de electron-builder y la misma raíz de la que cuelga la
      // carpeta de datos que el instructivo le hace abrir.
      logFile = join(logsDir, `${app.getName().toLowerCase()}.log`)
      ready = true
      const buffered = pending.splice(0, pending.length)
      for (const line of buffered) write(line)
      write(format('INFO', 'logger', `--- Sesión iniciada (log: ${logFile}) ---`))
    } catch (err) {
      ready = false
      // Sin archivo de log queda al menos la consola; la app no se detiene por esto.
      console.error('No se pudo inicializar el log en disco:', err)
    }
  },

  get filePath(): string {
    return logFile
  },

  info(scope: string, message: string, extra?: unknown): void {
    const line = format('INFO', scope, message, extra)
    if (!process.env.FLASHCARDS_QUIET) console.log(line)
    write(line)
  },

  warn(scope: string, message: string, extra?: unknown): void {
    const line = format('WARN', scope, message, extra)
    console.warn(line)
    write(line)
  },

  error(scope: string, message: string, extra?: unknown): void {
    const line = format('ERROR', scope, message, extra)
    console.error(line)
    write(line)
  }
}
