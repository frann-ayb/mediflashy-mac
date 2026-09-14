import type { FlashcardsApi } from '@shared/api'
import type { Result } from '@shared/types'

/**
 * Acceso a la API del preload. Si por algún motivo el puente no se cargó, en vez
 * de tirar "cannot read property of undefined" se devuelve un error legible que
 * la UI muestra en pantalla.
 */

const BRIDGE_MISSING =
  'No se pudo conectar con el motor de la app. Cerrala y volvé a abrirla; si sigue igual, reinstalala desde el instalador original.'

export function hasBridge(): boolean {
  return typeof window !== 'undefined' && typeof window.flashcards === 'object' && window.flashcards !== null
}

export function bridge(): FlashcardsApi | null {
  return hasBridge() ? window.flashcards : null
}

/** Desempaqueta un `Result<T>`; devuelve `null` en `data` si hubo error. */
export async function call<T>(fn: (api: FlashcardsApi) => Promise<Result<T>>): Promise<{ data: T | null; error: string | null }> {
  const api = bridge()
  if (!api) return { data: null, error: BRIDGE_MISSING }
  try {
    const result = await fn(api)
    if (result && result.ok) return { data: (result.data ?? null) as T | null, error: null }
    return { data: null, error: result?.error ?? 'Ocurrió un problema inesperado.' }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Ocurrió un problema inesperado.' }
  }
}

export function logToMain(level: 'info' | 'warn' | 'error', message: string): void {
  try {
    bridge()?.log(level, message)
  } catch {
    /* el log nunca debe romper la UI */
  }
}
