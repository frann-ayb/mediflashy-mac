import { freemem, totalmem } from 'node:os'
import type { EstadoMemoria, NivelMemoria } from '@shared/types'

/**
 * Cuánta memoria hay libre, y si alcanza para generar.
 *
 * POR QUÉ EXISTE
 * --------------
 * Generar tarjetas necesita unos 2,3 GB: 1,9 del motor de IA y 0,4 de la propia
 * app. Medido, no estimado. El chequeo que ya había mira la memoria INSTALADA y
 * pide 4 GB, así que en una máquina de 4 GB pasa —y después la generación se
 * arrastra durante media hora porque el sistema empieza a usar el disco como
 * memoria, o mata algo.
 *
 * Lo que le pasa al comprador no es un error: es una app que parece colgada, sin
 * nada en pantalla que lo explique. Este módulo existe para que pueda VERLO
 * antes, y para poder decírselo con una frase en vez de con un cartel de error.
 *
 * NO BLOQUEA NADA. Sólo informa. La decisión sigue siendo suya.
 */

/* Vive en el core porque el servidor lo necesita para decidir cuántos bloques
   atiende a la vez, y el core no puede depender de este archivo. */
export { MEMORIA_PARA_GENERAR } from './core/llamaServer'
import { MEMORIA_PARA_GENERAR } from './core/llamaServer'

/**
 * Los cortes.
 *
 * `holgado`  — entra la generación y todavía sobra para el navegador abierto.
 * `justo`    — entra, pero sin aire. Va a andar, quizá más lento.
 * `escaso`   — no entra: el sistema va a paginar y la generación se va a arrastrar.
 *
 * El corte de `justo` es lo que hace falta más un 30 % de aire. El de `escaso`,
 * lo que hace falta pelado: por debajo de eso ya no es "lento", es "no entra".
 */
const HOLGADO = MEMORIA_PARA_GENERAR * 1.3
const JUSTO = MEMORIA_PARA_GENERAR

export function nivelDeMemoria(libre: number): NivelMemoria {
  if (libre >= HOLGADO) return 'holgado'
  if (libre >= JUSTO) return 'justo'
  return 'escaso'
}

export function leerMemoria(): EstadoMemoria {
  const total = totalmem()
  const libre = freemem()
  return {
    totalBytes: total,
    libreBytes: libre,
    nivel: nivelDeMemoria(libre),
    /* Cuánto necesita una generación, para que la interfaz pueda decir "hacen
       falta 2,3 GB y hay 1,1" en vez de un color y nada más. */
    necesarioBytes: MEMORIA_PARA_GENERAR
  }
}
