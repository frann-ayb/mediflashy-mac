/**
 * El bucle de la cola de generación.
 *
 * Vive acá y no adentro del componente por una razón concreta: es la única parte
 * de la vista que puede perder el trabajo del usuario. Si el bucle se corta en el
 * archivo 8 de 12, o pierde las tarjetas de los 7 anteriores, o procesa las
 * respuestas fuera de orden, el comprador pierde dos horas de generación y no hay
 * forma de recuperarlas. Sacado del componente se puede probar de verdad —con
 * fallas, con cancelaciones, con archivos vacíos— sin abrir una ventana.
 *
 * No importa nada de React ni de `window`: recibe las dos operaciones y avisa por
 * callbacks. Eso es lo que lo hace probable.
 */

export interface ResultadoArchivo {
  estado: 'listo' | 'error'
  cards: number
  detalle?: string
}

export interface GanchosCola {
  /** Antes de empezar con el archivo `i`. */
  alEmpezar: (i: number) => void
  /** Cuando el archivo `i` terminó, bien o mal. */
  alTerminar: (i: number, r: ResultadoArchivo) => void
  /** Se consulta entre paso y paso. Si da true, la cola corta acá. */
  cancelado: () => boolean
}

export interface OperacionesCola<C> {
  leer: (ruta: string) => Promise<{ data: { texto: string } | null; error: string | null }>
  generar: (texto: string) => Promise<{ data: { cards: C[]; descartadas: number } | null; error: string | null }>
}

export interface SalidaCola<C> {
  cards: C[]
  descartadas: number
  /** Cuántos archivos se procesaron de verdad, para poder decirlo. */
  hechos: number
  fallados: number
  /** true si se cortó por cancelación y quedaron archivos sin tocar. */
  cortada: boolean
}

/**
 * Procesa las rutas una atrás de la otra y devuelve todo junto.
 *
 * Tres garantías que las pruebas verifican:
 *
 * 1. **Un archivo que falla no corta la cola.** Un PDF escaneado en la posición 3
 *    no puede tirar abajo los otros nueve.
 * 2. **Cancelar no tira lo ya generado.** Si cancelás en el octavo de doce, salen
 *    las tarjetas de los siete que terminaron.
 * 3. **El orden se respeta.** Las tarjetas salen en el orden de los archivos, no
 *    en el orden en que el motor fue contestando.
 */
export async function procesarCola<C>(
  rutas: string[],
  ops: OperacionesCola<C>,
  ganchos: GanchosCola
): Promise<SalidaCola<C>> {
  const cards: C[] = []
  let descartadas = 0
  let hechos = 0
  let fallados = 0
  let cortada = false

  for (let i = 0; i < rutas.length; i++) {
    if (ganchos.cancelado()) {
      cortada = true
      break
    }
    ganchos.alEmpezar(i)

    const leido = await ops.leer(rutas[i])
    if (ganchos.cancelado()) {
      cortada = true
      break
    }
    if (leido.error !== null || leido.data === null) {
      fallados++
      ganchos.alTerminar(i, { estado: 'error', cards: 0, detalle: leido.error ?? 'No se pudo leer el archivo' })
      continue
    }

    const salida = await ops.generar(leido.data.texto)
    if (ganchos.cancelado()) {
      cortada = true
      break
    }
    if (salida.error !== null || salida.data === null) {
      fallados++
      ganchos.alTerminar(i, { estado: 'error', cards: 0, detalle: salida.error ?? 'No se pudieron generar tarjetas' })
      continue
    }

    cards.push(...salida.data.cards)
    descartadas += salida.data.descartadas
    hechos++
    ganchos.alTerminar(i, { estado: 'listo', cards: salida.data.cards.length })
  }

  return { cards, descartadas, hechos, fallados, cortada }
}

/**
 * Saca las tarjetas repetidas exactas entre archivos.
 *
 * Dos apuntes de la misma unidad se pisan: el resumen y el capítulo entero dicen
 * las mismas tres definiciones. El generador ya deduplica dentro de un archivo, y
 * `saveCards` vuelve a filtrar por trigramas al guardar —ese es el filtro de
 * verdad—, pero sin esto el usuario tendría que leer y aprobar diez tarjetas
 * idénticas que después se descartan solas.
 *
 * Acá se sacan ÚNICAMENTE las exactamente iguales. Es el caso común, y es el
 * único criterio que se puede aplacar sin duplicar la lógica del guardado: una
 * segunda regla de similitud que con el tiempo diverja de la de `deckStore` sería
 * peor que no tener ninguna.
 */
export function sinRepetidas<C extends { frente: string }>(cards: C[]): C[] {
  const vistas = new Set<string>()
  const salida: C[] = []
  for (const c of cards) {
    const clave = c.frente.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (vistas.has(clave)) continue
    vistas.add(clave)
    salida.push(c)
  }
  return salida
}
