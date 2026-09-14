import { net } from 'electron'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, rmSync } from 'node:fs'
import { AppError } from './errors'

/**
 * Descarga de archivos grandes con reanudación, verificación y contrapresión.
 *
 * Viene de Convertexto sin un solo cambio, y eso es porque ya estaba bien hecho:
 * no sabe nada de modelos ni de niveles, sólo de URLs, bytes y archivos. Maneja
 * el 416, el servidor que ignora el `Range` y devuelve el archivo entero, la
 * contrapresión sobre el stream, y traduce los errores de red de Chromium a algo
 * que le sirva a una persona.
 *
 * Es de los archivos marcados como core en `sync-core.mjs`: si se toca acá, se
 * toca allá.
 */

/**
 * `net.IncomingMessage` es un `Readable` de Node en tiempo de ejecución (se
 * verificó: expone pause/resume/pipe), pero sus tipos publicados sólo declaran
 * el EventEmitter. Esta vista mínima permite aplicar contrapresión sin apagar el
 * chequeo de tipos en todo el bloque.
 */
interface FlowControl {
  pause: () => void
  resume: () => void
}

/** SHA-256 por streaming, cancelable. Un archivo de 2,7 GB no entra en memoria. */
export function sha256OfFile(file: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    const onAbort = (): void => {
      stream.destroy(new AppError('Cancelado.', { canceled: true }))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', (err) => {
      signal.removeEventListener('abort', onAbort)
      reject(err)
    })
    stream.on('end', () => {
      signal.removeEventListener('abort', onAbort)
      resolve(hash.digest('hex'))
    })
  })
}

/**
 * Traduce los errores de red de Chromium a algo que le sirva a una persona.
 *
 * `queEs` describe qué se estaba bajando. Acá hay una sola descarga posible, así
 * que el valor por defecto alcanza; el parámetro se conserva para que el archivo
 * siga siendo idéntico al de Convertexto, que sí tiene dos.
 */
export function networkErrorMessage(raw: string, queEs = 'el modelo'): string {
  const text = raw.toUpperCase()
  if (
    text.includes('NAME_NOT_RESOLVED') ||
    text.includes('INTERNET_DISCONNECTED') ||
    text.includes('NETWORK_CHANGED') ||
    text.includes('ADDRESS_UNREACHABLE') ||
    text.includes('ENOTFOUND') ||
    text.includes('CONNECTION_FAILED') ||
    text.includes('CONNECTION_REFUSED') ||
    text.includes('CONNECTION_RESET')
  ) {
    return `No hay conexión a internet. Hay que descargar ${queEs} una sola vez; después funciona sin conexión.`
  }
  if (text.includes('TIMED_OUT') || text.includes('ETIMEDOUT')) {
    return `La descarga de ${queEs} tardó demasiado. Revisá tu conexión y probá de nuevo.`
  }
  if (text.includes('PROXY')) {
    return 'No se pudo conectar a través del proxy de la red. Probá con otra conexión.'
  }
  return `No se pudo descargar ${queEs} (${raw}).`
}

export interface DownloadOptions {
  url: string
  /** Tamaño esperado, para cuando el servidor no manda content-length. */
  expectedBytes: number
  partFile: string
  /** Bytes ya descargados en `partFile`, para reanudar con Range. */
  alreadyHave: number
  signal: AbortSignal
  onChunk: (receivedTotal: number, totalBytes: number) => void
  /** Cómo nombrar lo que se descarga en los mensajes de error. */
  queEs?: string
}

/** Descarga con soporte de reanudación mediante cabecera Range. */
export function downloadWithResume({
  url,
  expectedBytes,
  partFile,
  alreadyHave,
  signal,
  onChunk,
  queEs = 'el modelo'
}: DownloadOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      fn()
    }

    // `net` usa la pila de red de Chromium: respeta el proxy del sistema, que
    // es lo que suele hacer fallar una descarga en redes corporativas.
    const request = net.request({ method: 'GET', url, useSessionCookies: false })
    if (alreadyHave > 0) request.setHeader('Range', `bytes=${alreadyHave}-`)

    const onAbort = (): void => {
      try {
        request.abort()
      } catch {
        /* ya terminó */
      }
    }
    signal.addEventListener('abort', onAbort, { once: true })

    request.on('response', (response) => {
      const code = response.statusCode
      const headers = response.headers

      if (code === 416) {
        // El .part ya tiene todo (o más de lo que el server ofrece): reintentamos limpio.
        response.on('data', () => undefined)
        response.on('end', () => {
          rmSync(partFile, { force: true })
          settle(() =>
            reject(
              new AppError('La descarga anterior quedó inconsistente. Volvé a intentarla: empieza de nuevo desde cero.', {
                retryable: true
              })
            )
          )
        })
        return
      }

      if (code !== 200 && code !== 206) {
        response.on('data', () => undefined)
        response.on('end', () =>
          settle(() =>
            reject(
              new AppError(
                `El servidor de modelos respondió con un error (HTTP ${code}). Probá de nuevo en unos minutos.`,
                { retryable: true }
              )
            )
          )
        )
        return
      }

      const resuming = code === 206
      const contentLengthHeader = headers['content-length']
      const contentLength = Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader ?? 0)
      const startAt = resuming ? alreadyHave : 0
      const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? startAt + contentLength : expectedBytes

      if (!resuming && alreadyHave > 0) {
        // El servidor ignoró el Range: arrancamos de cero.
        rmSync(partFile, { force: true })
      }

      const out = createWriteStream(partFile, { flags: resuming ? 'a' : 'w' })
      const flow = response as unknown as FlowControl
      let received = startAt

      out.on('error', (err) => settle(() => reject(err)))

      // Contrapresión: si el disco no sigue el ritmo de la red, se pausa la
      // lectura en lugar de acumular cientos de megas en memoria.
      response.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (!out.write(chunk)) flow.pause()
        onChunk(received, totalBytes)
      })
      out.on('drain', () => flow.resume())

      response.on('aborted', () => {
        out.end()
        settle(() =>
          reject(
            signal.aborted
              ? new AppError('Cancelado.', { canceled: true })
              : new AppError('La descarga se interrumpió. Volvé a intentarla: continúa desde donde quedó.', { retryable: true })
          )
        )
      })

      response.on('error', (err: Error) => {
        out.end()
        settle(() => reject(new AppError(networkErrorMessage(err.message, queEs), { retryable: true })))
      })

      response.on('end', () => {
        out.end(() => settle(resolve))
      })
    })

    request.on('error', (err) => {
      settle(() =>
        reject(
          signal.aborted
            ? new AppError('Cancelado.', { canceled: true })
            : new AppError(networkErrorMessage(err.message, queEs), { retryable: true })
        )
      )
    })

    request.on('abort', () => {
      settle(() =>
        reject(
          signal.aborted
            ? new AppError('Cancelado.', { canceled: true })
            : new AppError('La descarga se interrumpió.', { retryable: true })
        )
      )
    })

    request.end()
  })
}
