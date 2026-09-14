import type { Grade, SessionState, SessionSummary, StudyCard, StudyScope } from '@shared/types'
import { RITMO_SPECS } from '@shared/types'
import { findCard, getCarrera, getMateria, listMaterias, saveSchedule } from './deckStore'
import { cardsEnAlcance } from './searchIndex'
import { grade as calificar, isDue, madurez } from './scheduler'
import { append, nuevasHoy, repasosHoy } from './reviewLog'
import { AppError } from './core/errors'
import { logger } from './core/logger'

/**
 * Una sesión de estudio: qué tarjeta toca ahora y qué pasa cuando el usuario
 * aprieta uno de los tres botones.
 *
 * ---------------------------------------------------------------------------
 * Cómo se arma la cola
 * ---------------------------------------------------------------------------
 *
 * Dos montones: lo VENCIDO (tarjetas que ya vio y hoy toca repasar) y lo NUEVO
 * (tarjetas que nunca vio). Los dos se recortan con el tope diario de la materia y
 * después se intercalan.
 *
 * Se intercalan y no se ponen uno detrás del otro por una razón concreta: con los
 * repasos primero, alguien con 150 tarjetas vencidas y 20 minutos por día nunca
 * llega a las nuevas, y su mazo se congela — estudia todos los días y nunca
 * avanza. Con las nuevas primero pasa lo contrario: aprende cosas nuevas mientras
 * olvida las viejas, que es peor. Intercaladas, cada sesión avanza y consolida.
 *
 * ---------------------------------------------------------------------------
 * La tarjeta que se falla vuelve en la misma sesión
 * ---------------------------------------------------------------------------
 *
 * Cuando el usuario aprieta "No la sabía", FSRS la deja en estado de aprendizaje
 * con un vencimiento de minutos. Si la sesión terminara ahí, esa tarjeta recién
 * volvería mañana, y el usuario habría cerrado la app sin haberla acertado nunca —
 * que es exactamente lo contrario de lo que uno espera después de fallar algo.
 * Así que si vence dentro del horizonte de la sesión, se vuelve a meter en la
 * cola unos lugares más adelante.
 *
 * ---------------------------------------------------------------------------
 * El repaso libre
 * ---------------------------------------------------------------------------
 *
 * `scope.libre` arma una sesión con TODAS las tarjetas del alcance, vencidas o
 * no, sin topes. Es para el caso que el repaso espaciado no cubre y que en época
 * de finales es el más común: mañana rindo y quiero pasar las cien tarjetas de
 * esta materia ahora.
 *
 * **La regla, y no tiene excepciones: en libre no se escribe ningún `schedule`.**
 * Ni uno. Contestar acá no adelanta ni atrasa nada, no gradúa tarjetas, no gasta
 * el cupo del día y no hace que mañana aparezca algo que no correspondía. Los
 * tres botones siguen estando porque ordenan ESTA sesión —lo que se falla vuelve
 * unos lugares más adelante— y porque son lo que le dice al usuario cómo le fue.
 *
 * La alternativa que existía antes era reiniciar el progreso de cada tarjeta:
 * eso sí toca el algoritmo, y de la peor manera posible, porque tira el historial
 * de meses para poder repasar una tarde.
 */

/**
 * Qué se considera "todavía dentro de esta sesión".
 *
 * Veinte minutos es más o menos lo que dura una sesión de estudio real. Con un
 * horizonte más corto, una tarjeta fallada al principio no alcanza a volver; con
 * uno más largo, vuelven tarjetas que FSRS quería espaciar de verdad.
 */
const HORIZONTE_MS = 20 * 60 * 1000

/** Cuántas tarjetas más adelante se reinserta una fallada. */
const REINSERTAR_EN = 5

/**
 * Cuántas veces puede volver la MISMA tarjeta en una sesión.
 *
 * Sin este tope, alguien que aprieta "No la sabía" tres veces seguidas sobre una
 * tarjeta que no entiende no termina nunca la sesión: cada fallo la reprograma
 * para dentro de un minuto y la vuelve a meter en la cola. La sesión se convierte
 * en un bucle del que sólo se sale cerrando la app.
 *
 * A la cuarta vez la tarjeta se deja ir. Su estado ya quedó guardado, así que
 * vuelve mañana. Y si una tarjeta necesita más de cuatro intentos en una sentada,
 * el problema no se arregla insistiendo: está mal escrita o el usuario todavía no
 * estudió el tema.
 */
const MAX_REINTENTOS = 3

interface Item {
  cardId: string
  unidadId: string
  materiaId: string
  frente: string
  dorso: string
  /** La cita. Viaja con la tarjeta para poder mostrarla al revelar. */
  fuente?: string
  unidadNombre: string
  materiaNombre: string
  esNueva: boolean
  /** Cuántas veces volvió a la cola en esta sesión. Ver `MAX_REINTENTOS`. */
  vueltas: number
}

interface Sesion {
  cola: Item[]
  hechas: number
  sabidas: number
  masOMenos: number
  noSabidas: number
  /** Cuántas quedaron afuera por el tope diario, para poder decirlo al cerrar. */
  pendientesPorTope: number
  /** Repaso libre: no se toca el calendario. Ver el encabezado del archivo. */
  libre: boolean
}

let actual: Sesion | null = null

/* --------------------------------- armado --------------------------------- */

/**
 * Intercala dos listas repartiendo la más corta a lo largo de la más larga.
 *
 * No es un zip: si hay 100 repasos y 20 nuevas, no se quiere "1 y 1" durante las
 * primeras 40 y después 60 repasos seguidos. Se quiere una nueva cada cinco
 * repasos, parejo hasta el final.
 */
function intercalar(largo: Item[], corto: Item[]): Item[] {
  if (corto.length === 0) return largo
  if (largo.length === 0) return corto

  const salida: Item[] = []
  const paso = largo.length / corto.length
  let siguiente = 0

  for (let i = 0; i < largo.length; i++) {
    salida.push(largo[i])
    while (siguiente < corto.length && i + 1 >= (siguiente + 1) * paso) {
      salida.push(corto[siguiente])
      siguiente++
    }
  }
  while (siguiente < corto.length) salida.push(corto[siguiente++])
  return salida
}

/**
 * Baraja de forma estable dentro de la sesión.
 *
 * Sin barajar, las tarjetas salen siempre en el orden en que se generaron, y el
 * usuario termina memorizando la SECUENCIA en vez del contenido: reconoce la
 * tarjeta por venir después de otra, y en el examen no la reconoce. Es el efecto
 * de orden, y es real.
 */
function barajar<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function start(scope: StudyScope, now = Date.now()): SessionState {
  const hits = cardsEnAlcance(scope)
  if (hits.length === 0) throw new AppError('No hay tarjetas para estudiar acá todavía. Generá algunas o creá una a mano.')

  const libre = scope.libre === true

  const nuevas: Item[] = []
  const vencidas: Item[] = []
  const todas: Item[] = []

  for (const h of hits) {
    const item: Item = {
      cardId: h.card.id,
      unidadId: h.unidadId,
      materiaId: h.materiaId,
      frente: h.card.frente,
      dorso: h.card.dorso,
      fuente: h.card.fuente,
      unidadNombre: h.unidadNombre,
      materiaNombre: h.materiaNombre,
      esNueva: madurez(h.card.schedule) === 'nueva',
      vueltas: 0
    }
    if (libre) {
      todas.push(item)
      continue
    }
    if (item.esNueva) nuevas.push(item)
    else if (isDue(h.card.schedule, now)) vencidas.push(item)
  }

  /*
   * El repaso libre entra por acá y sale antes de los topes.
   *
   * No hay nada que filtrar —el usuario pidió TODO lo del alcance— ni cupo que
   * gastar. Sólo se baraja, por el mismo motivo de siempre: sin barajar se
   * memoriza el orden en vez del contenido, y en un repaso libre eso es todavía
   * más fácil porque son las mismas tarjetas que ya vio.
   */
  if (libre) {
    actual = {
      cola: barajar(todas),
      hechas: 0,
      sabidas: 0,
      masOMenos: 0,
      noSabidas: 0,
      pendientesPorTope: 0,
      libre: true
    }
    logger.info('estudio', `Repaso libre iniciado: ${todas.length} tarjeta(s). No se toca el calendario.`)
    return estado()
  }

  const { nuevasFinal, vencidasFinal, dejadas } = aplicarTopes(barajar(nuevas), barajar(vencidas), now)

  if (nuevasFinal.length === 0 && vencidasFinal.length === 0) {
    throw new AppError(
      dejadas > 0
        ? 'Por hoy ya está: llegaste al límite diario de esta materia. Podés subir el ritmo desde la materia, o hacer un repaso libre: pasás las tarjetas que quieras sin que cuenten para el día.'
        : 'No hay nada para repasar por ahora. Podés hacer un repaso libre para pasar igual las tarjetas de esta materia, sin que se altere el calendario.'
    )
  }

  actual = {
    cola: intercalar(vencidasFinal, nuevasFinal),
    hechas: 0,
    sabidas: 0,
    masOMenos: 0,
    noSabidas: 0,
    pendientesPorTope: dejadas,
    libre: false
  }

  logger.info('estudio', `Sesión iniciada: ${vencidasFinal.length} repaso(s) y ${nuevasFinal.length} nueva(s).`)
  return estado()
}

/**
 * Recorta los dos montones según el ritmo de cada materia.
 *
 * Los topes son POR MATERIA porque el ritmo se configura por materia: alguien
 * puede estar cursando Anatomía a fondo y llevando Inglés al trote. Un tope global
 * mezclaría las dos y el usuario no entendería por qué se le cortan las tarjetas
 * de una materia que configuró en Intenso.
 *
 * Lo que ya estudió hoy cuenta: si abre la app tres veces en el día, el tope es del
 * día, no de cada sesión. Eso sale del historial, que es lo único que sabe qué pasó
 * en las sesiones anteriores.
 */
function aplicarTopes(
  nuevas: Item[],
  vencidas: Item[],
  now: number
): { nuevasFinal: Item[]; vencidasFinal: Item[]; dejadas: number } {
  const cupoNuevas = new Map<string, number>()
  const cupoRepasos = new Map<string, number>()

  /*
   * El cupo es POR CARRERA, no por materia. Ver `nuevasHoy` en reviewLog: con el
   * tope por materia, una carrera de diez materias en ritmo normal habilitaba
   * doscientas tarjetas nuevas por dia, que no es un tope.
   *
   * `materiasDe` se arma una vez y se reusa: resolverlo adentro del bucle seria
   * recorrer la lista de materias por cada tarjeta de la cola.
   */
  const carreraDe = new Map<string, string>()
  const materiasDe = new Map<string, Set<string>>()

  const resolverCarrera = (materiaId: string): string => {
    const cacheado = carreraDe.get(materiaId)
    if (cacheado !== undefined) return cacheado
    // Sin carrera (una materia huerfana que todavia no se rescato) la materia se
    // trata como su propia carrera: es mejor un tope de mas que ninguno.
    const carreraId = getMateria(materiaId)?.carreraId ?? materiaId
    carreraDe.set(materiaId, carreraId)
    let hermanas = materiasDe.get(carreraId)
    if (!hermanas) {
      hermanas = new Set(listMaterias(carreraId).map((m) => m.id))
      // La propia materia siempre entra, aunque `listMaterias` no la traiga.
      hermanas.add(materiaId)
      materiasDe.set(carreraId, hermanas)
    } else {
      hermanas.add(materiaId)
    }
    return carreraId
  }

  const cupoDe = (carreraId: string, mapa: Map<string, number>, tipo: 'nuevas' | 'repasos'): number => {
    const guardado = mapa.get(carreraId)
    if (guardado !== undefined) return guardado

    const carrera = getCarrera(carreraId)
    const spec = RITMO_SPECS[carrera?.ritmo ?? 'normal']
    const hermanas = materiasDe.get(carreraId) ?? new Set<string>()
    const restante =
      tipo === 'nuevas'
        ? spec.nuevasPorDia - nuevasHoy(hermanas, now)
        : spec.repasosPorDia - repasosHoy(hermanas, now)
    const valor = Math.max(0, restante)
    mapa.set(carreraId, valor)
    return valor
  }

  const recortar = (items: Item[], mapa: Map<string, number>, tipo: 'nuevas' | 'repasos'): Item[] => {
    const salida: Item[] = []
    for (const item of items) {
      const carreraId = resolverCarrera(item.materiaId)
      const cupo = cupoDe(carreraId, mapa, tipo)
      if (cupo <= 0) continue
      mapa.set(carreraId, cupo - 1)
      salida.push(item)
    }
    return salida
  }

  const nuevasFinal = recortar(nuevas, cupoNuevas, 'nuevas')
  const vencidasFinal = recortar(vencidas, cupoRepasos, 'repasos')
  const dejadas = nuevas.length - nuevasFinal.length + (vencidas.length - vencidasFinal.length)

  return { nuevasFinal, vencidasFinal, dejadas }
}

/* -------------------------------- durante --------------------------------- */

function aStudyCard(item: Item): StudyCard {
  return {
    id: item.cardId,
    frente: item.frente,
    dorso: item.dorso,
    fuente: item.fuente,
    unidadNombre: item.unidadNombre,
    materiaNombre: item.materiaNombre,
    esNueva: item.esNueva
  }
}

function estado(): SessionState {
  if (!actual) return { pendientes: 0, nuevas: 0, repasos: 0, hechas: 0, actual: null, libre: false }
  return {
    pendientes: actual.cola.length,
    nuevas: actual.cola.filter((i) => i.esNueva).length,
    repasos: actual.cola.filter((i) => !i.esNueva).length,
    hechas: actual.hechas,
    actual: actual.cola.length > 0 ? aStudyCard(actual.cola[0]) : null,
    libre: actual.libre
  }
}

export function grade(g: Grade, now = Date.now()): SessionState {
  if (!actual || actual.cola.length === 0) throw new AppError('No hay ninguna sesión de estudio abierta.')

  const item = actual.cola.shift()!
  const encontrada = findCard(item.cardId)

  // La tarjeta pudo haberse borrado desde otra pantalla mientras la sesión estaba
  // abierta. No es un error: simplemente ya no está y se sigue con la siguiente.
  if (!encontrada) return estado()

  actual.hechas++
  if (g === 'si') actual.sabidas++
  else if (g === 'masomenos') actual.masOMenos++
  else actual.noSabidas++

  /*
   * Repaso libre: se anota que pasó, y NADA MÁS.
   *
   * No hay `calificar()` ni `saveSchedule()`. Ésta es la línea entera del
   * contrato del repaso libre, y por eso está sola y con un `return`: cualquier
   * cosa que se agregue debajo, del lado normal, no puede alcanzarla por
   * accidente. La entrada del historial va marcada como práctica y `reviewLog`
   * la excluye del cupo diario y de la retención.
   */
  if (actual.libre) {
    append(item.cardId, item.materiaId, g, false, true, now)
    if (g === 'no' && item.vueltas < MAX_REINTENTOS) {
      const posicion = Math.min(REINSERTAR_EN, actual.cola.length)
      actual.cola.splice(posicion, 0, { ...item, vueltas: item.vueltas + 1 })
    }
    return estado()
  }

  const antes = encontrada.card.schedule
  const despues = calificar(antes, g, now)

  saveSchedule(item.unidadId, item.cardId, despues)
  append(item.cardId, item.materiaId, g, item.esNueva, false, now)

  // Vuelve en esta misma sesión SÓLO si el usuario dijo que no la sabía.
  //
  // La condición natural sería "si FSRS la programó para dentro de un rato", pero
  // eso trae de vuelta también las que se acertaron: una tarjeta nueva contestada
  // bien queda en aprendizaje con vencimiento a diez minutos, o sea adentro del
  // horizonte. Anki hace exactamente eso y sus usuarios lo esperan; acá sería un
  // problema, porque alguien que abre la app por primera vez contesta bien una
  // tarjeta y la ve reaparecer a los treinta segundos concluye, con razón, que la
  // app está rota.
  //
  // "Más o menos" tampoco vuelve: es un acierto con esfuerzo, y FSRS ya responde
  // acortándole el próximo intervalo. Volver a preguntar lo mismo dentro de la
  // misma sesión no agrega nada que el espaciado no haga mejor.
  if (g === 'no' && despues.due - now <= HORIZONTE_MS && item.vueltas < MAX_REINTENTOS) {
    const posicion = Math.min(REINSERTAR_EN, actual.cola.length)
    // Vuelve marcada como repaso aunque haya entrado como nueva: ya la vio, y si
    // siguiera contando como nueva gastaría cupo del día dos veces.
    actual.cola.splice(posicion, 0, { ...item, esNueva: false, vueltas: item.vueltas + 1 })
  }

  return estado()
}

export function end(): SessionSummary {
  const s = actual
  actual = null
  if (!s) return { hechas: 0, sabidas: 0, masOMenos: 0, noSabidas: 0, pendientesPorTope: 0, libre: false }

  logger.info(
    'estudio',
    `${s.libre ? 'Repaso libre cerrado' : 'Sesión cerrada'}: ${s.hechas} tarjeta(s) — ${s.sabidas} sí, ${s.masOMenos} más o menos, ${s.noSabidas} no.`
  )
  return {
    hechas: s.hechas,
    sabidas: s.sabidas,
    masOMenos: s.masOMenos,
    noSabidas: s.noSabidas,
    pendientesPorTope: s.pendientesPorTope,
    libre: s.libre
  }
}

export function isActive(): boolean {
  return actual !== null
}
