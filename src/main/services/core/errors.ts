/**
 * Error con un mensaje ya escrito para el usuario final (en español, sin jerga
 * técnica). Todo lo que se muestre en la UI debe pasar por acá; los detalles
 * técnicos van al log.
 */
export class AppError extends Error {
  /** `true` si el error es una cancelación pedida por el usuario. */
  readonly canceled: boolean
  /** `true` si tiene sentido ofrecer un botón de "Reintentar". */
  readonly retryable: boolean

  constructor(message: string, options: { cause?: unknown; canceled?: boolean; retryable?: boolean } = {}) {
    super(message)
    this.name = 'AppError'
    this.canceled = options.canceled ?? false
    this.retryable = options.retryable ?? false
    if (options.cause !== undefined) this.cause = options.cause
  }
}

/** Mensaje presentable para cualquier valor lanzado. */
export function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code
    switch (code) {
      case 'ENOENT':
        return 'No se encontró el archivo o la carpeta indicada.'
      case 'EACCES':
      case 'EPERM':
        return 'No hay permisos suficientes para leer o escribir en esa ubicación.'
      case 'ENOSPC':
        return 'No queda espacio en disco.'
      case 'EBUSY':
        return 'El archivo está siendo usado por otro programa.'
      case 'ENAMETOOLONG':
        return 'La ruta del archivo es demasiado larga.'
      default:
        return `Ocurrió un problema inesperado: ${err.message}`
    }
  }
  return 'Ocurrió un problema inesperado.'
}

export function isCanceled(err: unknown): boolean {
  return err instanceof AppError && err.canceled
}
