import { cpus } from 'node:os'

/**
 * Lo que el motor de IA necesita saber del sistema operativo.
 *
 * En Convertexto estas dos cosas viven adentro de `whisper.ts`, y `llamaServer.ts`
 * las importa de ahí. Acá no hay whisper: si se copiara el acople tal cual,
 * Flashcards arrastraría el motor de transcripción entero —con su parseo de JSON,
 * sus timeouts y sus mensajes de error sobre audio— para usar doce líneas.
 *
 * Están en un módulo propio porque no son de whisper ni de llama: son del sistema.
 */

/**
 * Cuántos núcleos usa el motor.
 *
 * Se deja siempre uno libre: con todos tomados, la ventana de la app se pone
 * pegajosa mientras genera y el usuario cree que se colgó. El techo de 8 no es
 * arbitrario — arriba de ahí llama.cpp deja de escalar en CPU y los hilos de más
 * sólo compiten por el ancho de banda de memoria.
 */
export function threadCount(): number {
  const total = cpus().length || 4
  return Math.max(2, Math.min(8, total - 1))
}

/**
 * Códigos con los que el cargador de Windows aborta un proceso antes de que
 * llegue a ejecutarse: falta una DLL, está corrupta o no es del bitness correcto.
 * Se listan en su forma sin signo y con signo porque Node informa una u otra
 * según el caso.
 */
export const WINDOWS_LOADER_FAILURES = new Set([
  0xc0000135, 0xc0000135 - 0x100000000, // DLL no encontrada
  0xc000007b, 0xc000007b - 0x100000000, // formato de imagen inválido
  0xc000012f, 0xc000012f - 0x100000000, // imagen dañada
  0xc0000139, 0xc0000139 - 0x100000000, // punto de entrada no encontrado
  0xc0000142, 0xc0000142 - 0x100000000 // fallo al inicializar una DLL
])
