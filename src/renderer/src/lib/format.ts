/** Helpers de presentación. Todo en español, sin dependencias. */

/** Duración en palabras, para totales ("1 h 12 min"). */
export function formatDurationLong(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min'
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 1) return 'menos de 1 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = value < 10 ? value.toFixed(1) : String(Math.round(value))
  return `${text.replace('.', ',')} ${units[unit]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

/** Tiempo restante estimado de una descarga. */
export function formatEta(remainingBytes: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0 || remainingBytes <= 0) return ''
  const seconds = Math.round(remainingBytes / bytesPerSecond)
  if (seconds < 60) return `${seconds} s restantes`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min restantes`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min restantes`
}

/** Recorta el medio de un nombre largo para que nunca desborde su contenedor. */
export function truncateMiddle(text: string, max = 52): string {
  if (text.length <= max) return text
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`
}

/**
 * Concordancia de número, para no escribir "1 tarjetas".
 *
 * Parece un detalle y no lo es: un contador que dice "1 tarjetas" es lo primero
 * que delata que una app se armó apurada, y acá los contadores están en todas las
 * pantallas. El plural en español casi siempre es sumar "s", así que la función lo
 * asume y acepta la forma irregular cuando hace falta.
 *
 *   plural(1, 'tarjeta')            → "1 tarjeta"
 *   plural(3, 'tarjeta')            → "3 tarjetas"
 *   plural(2, 'unidad', 'unidades') → "2 unidades"
 */
export function plural(n: number, singular: string, formaPlural?: string): string {
  return `${n} ${n === 1 ? singular : (formaPlural ?? `${singular}s`)}`
}
