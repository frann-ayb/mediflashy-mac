import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade as FsrsGrade } from 'ts-fsrs'
import type { Grade, Schedule } from '@shared/types'

/**
 * Cuándo vuelve a aparecer cada tarjeta.
 *
 * ---------------------------------------------------------------------------
 * Por qué FSRS y no SM-2
 * ---------------------------------------------------------------------------
 *
 * SM-2 —el algoritmo clásico de SuperMemo, el que usó Anki durante veinte años—
 * son ochenta líneas y no tiene dependencias, que para este proyecto es un punto a
 * favor. Igual se eligió FSRS, y el motivo es que SM-2 programa de más: modela la
 * memoria con un solo número (el "factor de facilidad") y termina mostrando las
 * tarjetas bastante más seguido de lo necesario. Sobre un mazo de 300 tarjetas eso
 * son minutos por día de repaso que no hacían falta, todos los días. FSRS modela
 * estabilidad y dificultad por separado, está ajustado sobre millones de repasos
 * reales, y es lo que Anki usa hoy por defecto.
 *
 * `ts-fsrs` es TypeScript puro, MIT, sin binarios nativos. No rompe el
 * `npmRebuild: false` del empaquetado.
 *
 * ---------------------------------------------------------------------------
 * Tres botones, no cuatro
 * ---------------------------------------------------------------------------
 *
 * Anki muestra cuatro (Again / Hard / Good / Easy) y a mucha gente le cuesta
 * decidir entre Good y Easy, que es la peor forma de perder tiempo en una app de
 * repaso: el usuario piensa más en calificarse que en la tarjeta. Acá son tres, en
 * el idioma en que uno piensa después de intentar recordar algo:
 *
 *     No la sabía   ·   Más o menos   ·   La sabía
 *
 * `Easy` no se usa. La consecuencia real es que una tarjeta trivial tarda un par
 * de repasos más en llegar a intervalos largos que si el usuario hubiera podido
 * marcarla como muy fácil. Es un costo chico y consciente: a cambio, no hay una
 * sola decisión ambigua en la pantalla de estudio.
 */

/**
 * `enable_fuzz` reparte los vencimientos ±5 % alrededor del día calculado.
 *
 * Sin esto, las 300 tarjetas que se generan de un apunte de una sentada vencen
 * todas el mismo día, y vuelven a hacerlo en cada repaso siguiente: el usuario
 * alterna días con cero tarjetas y días con trescientas. Con fuzz, el mazo se
 * despareja solo y la carga diaria se aplana.
 */
const params = generatorParameters({ enable_fuzz: true })
const motor = fsrs(params)

/** A partir de acá una tarjeta se considera aprendida. Es el umbral de Anki. */
export const DIAS_MADURA = 21

/**
 * `FsrsGrade` es más angosto que `Rating`: excluye `Rating.Manual`, que es para
 * reprogramar una tarjeta a mano y no para calificarla. Tipar el mapa con el tipo
 * angosto hace que el compilador verifique que los tres botones caen en
 * calificaciones reales.
 */
const RATINGS: Record<Grade, FsrsGrade> = {
  no: Rating.Again,
  masomenos: Rating.Hard,
  si: Rating.Good
}

/** El estado de una tarjeta recién creada, que nadie vio todavía. */
export function emptySchedule(now = Date.now()): Schedule {
  return fromFsrs(createEmptyCard(new Date(now)))
}

/**
 * Convierte nuestro `Schedule` a lo que espera ts-fsrs.
 *
 * Se parte de `createEmptyCard()` y se pisan TODOS los campos de estado, uno por
 * uno. La base de la fábrica está para que un campo que ts-fsrs agregue en el
 * futuro llegue con un valor sensato en vez de `undefined`.
 *
 * OJO CON ESO ÚLTIMO: heredar el valor por defecto es correcto para un campo
 * nuevo que no existía cuando se guardaron los datos, y es un BUG si el campo
 * lleva estado. Pasó con `learning_steps`: al no copiarlo, cada tarjeta que se
 * guardaba y se releía volvía al paso 0 del aprendizaje, no se graduaba nunca, y
 * la app mostraba la misma tarjeta cada diez minutos de por vida. Lo encontró
 * `qa/scheduler.ts` midiendo los intervalos; leyendo el código no se veía.
 *
 * La regla, entonces: si ts-fsrs suma un campo, hay que MIRAR si es estado. Si lo
 * es, va en `Schedule` y se copia acá.
 */
function toFsrs(s: Schedule): FsrsCard {
  return {
    ...createEmptyCard(new Date(s.lastReview ?? s.due)),
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsedDays,
    scheduled_days: s.scheduledDays,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    // El `?? 0` cubre las tarjetas guardadas antes de que este campo existiera:
    // arrancan de nuevo el aprendizaje, que es molesto una vez y correcto.
    learning_steps: s.learningSteps ?? 0,
    last_review: s.lastReview === null ? undefined : new Date(s.lastReview)
  }
}

/**
 * Y de vuelta. Las fechas se guardan como epoch en ms porque esto viaja a JSON:
 * un `Date` serializado vuelve como string ISO, y el día que alguien se olvide de
 * rehidratarlo, FSRS recibe un string donde espera una fecha y programa el repaso
 * para 1970.
 */
function fromFsrs(c: FsrsCard): Schedule {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as 0 | 1 | 2 | 3,
    learningSteps: c.learning_steps ?? 0,
    lastReview: c.last_review ? c.last_review.getTime() : null
  }
}

/** Aplica una calificación y devuelve el nuevo estado de la tarjeta. */
export function grade(schedule: Schedule, g: Grade, now = Date.now()): Schedule {
  const { card } = motor.next(toFsrs(schedule), new Date(now), RATINGS[g])
  return fromFsrs(card)
}

export function isDue(schedule: Schedule, now = Date.now()): boolean {
  return schedule.due <= now
}

export type Madurez = 'nueva' | 'aprendiendo' | 'repasando' | 'aprendida'

/**
 * En qué etapa está una tarjeta, para las métricas y los filtros del buscador.
 *
 * El corte entre "repasando" y "aprendida" lo pone la ESTABILIDAD, no la cantidad
 * de repasos: una tarjeta que se acertó cinco veces seguidas con un día de
 * intervalo sabe mucho menos que una que se acertó dos veces con un mes de por
 * medio. La estabilidad es literalmente cuántos días aguanta el recuerdo, así que
 * es la medida honesta de "esto ya lo sé".
 */
export function madurez(schedule: Schedule): Madurez {
  if (schedule.state === State.New) return 'nueva'
  if (schedule.state === State.Learning || schedule.state === State.Relearning) return 'aprendiendo'
  return schedule.stability >= DIAS_MADURA ? 'aprendida' : 'repasando'
}

/**
 * Cuánto "sabe" el usuario una tarjeta, de 0 a 1.
 *
 * Es una rampa sobre la estabilidad y no un escalón por etapa: si fuera un
 * escalón, la barra de progreso de una unidad se quedaría clavada durante semanas
 * y después saltaría de golpe, y una barra que no se mueve mientras uno estudia
 * todos los días desmotiva. Con la rampa, cada repasado acertado la mueve un
 * poquito, que es lo que efectivamente pasó.
 */
export function fuerza(schedule: Schedule): number {
  if (schedule.state === State.New) return 0
  return Math.max(0, Math.min(1, schedule.stability / DIAS_MADURA))
}
