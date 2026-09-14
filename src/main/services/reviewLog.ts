import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Grade } from '@shared/types'
import { dataRoot } from './core/paths'
import { shredFile } from './core/fsutil'
import { logger } from './core/logger'

/**
 * El historial de repasos: qué se contestó, cuándo y cómo.
 *
 * ---------------------------------------------------------------------------
 * Por qué append-only y en su propio archivo
 * ---------------------------------------------------------------------------
 *
 * El estado ACTUAL de una tarjeta (cuándo vence, su estabilidad) vive adentro de
 * la tarjeta, en el archivo de su unidad. Acá está el historial, que es otra cosa
 * y se comporta distinto: sólo crece, se escribe una línea por respuesta, y nunca
 * se modifica una línea ya escrita.
 *
 * Meterlo adentro de la unidad significaría reescribir el archivo entero de la
 * unidad en cada respuesta —y una sesión de estudio son varias respuestas por
 * minuto— sólo para agregar 60 bytes al final. Con un JSONL aparte, escribir una
 * respuesta es un `appendFileSync` de una línea.
 *
 * Que sea append-only también es lo que lo hace confiable: un archivo al que sólo
 * se le agrega al final no se puede corromper a la mitad. Si un corte de luz
 * trunca la última línea, se pierde esa línea y nada más — por eso el lector
 * descarta las líneas que no parsean en vez de tirar el archivo entero.
 *
 * ---------------------------------------------------------------------------
 * Qué pasa con las tarjetas borradas
 * ---------------------------------------------------------------------------
 *
 * Sus líneas quedan huérfanas. Las métricas las ignoran porque se calculan sobre
 * las tarjetas vivas, y compactar en cada borrado rompería la propiedad de
 * append-only que hace que esto sea seguro. Se compacta cada tanto, cuando el
 * archivo se pasa de tamaño, y ahí sí se reescribe entero.
 */

interface Entrada {
  /** cardId */
  c: string
  /** materiaId al momento del repaso. Sirve para el tope diario por materia. */
  m: string
  /** epoch ms */
  t: number
  /** calificación */
  g: Grade
  /** `1` si era la primera vez que el usuario veía la tarjeta. */
  n?: 1
  /**
   * `1` si vino de un repaso libre.
   *
   * Estas líneas se guardan pero NO participan de nada que decida cuándo vuelve
   * una tarjeta: no gastan el cupo diario (`nuevasHoy`, `repasosHoy`) ni entran
   * en la retención. Si entraran en el cupo, pasar una unidad entera antes de un
   * final dejaría al usuario sin tarjetas al día siguiente — o sea, el repaso
   * libre castigaría por estudiar de más, que es exactamente lo contrario de
   * para lo que existe.
   *
   * Sí cuentan para la racha y para "repasos hoy", porque esas dos miden
   * esfuerzo y el esfuerzo fue real.
   */
  p?: 1
}

const archivo = (): string => join(dataRoot(), 'repasos.jsonl')

/** A partir de acá se compacta al arrancar. ~250.000 repasos. */
const MAX_BYTES = 16 * 1024 * 1024

let entradas: Entrada[] = []
let cargado = false

/**
 * El día no cambia a medianoche, sino a las 4 de la mañana.
 *
 * Es la misma convención que usa Anki y no es un capricho: quien estudia hasta la
 * 1:30 de la madrugada está terminando el día anterior, no empezando uno nuevo. Con
 * el corte a medianoche, esa persona gasta su cupo de tarjetas nuevas dos veces en
 * una sola noche y al día siguiente no le queda nada, y encima le corta la racha
 * un día que sí estudió.
 */
const HORA_CORTE = 4

/** Índice del día al que pertenece un instante. Días consecutivos difieren en 1. */
export function diaDe(ms: number): number {
  const d = new Date(ms)
  d.setHours(d.getHours() - HORA_CORTE)
  // Se normaliza a medianoche local antes de dividir para que el cambio de horario
  // de verano no corra el índice medio día.
  d.setHours(0, 0, 0, 0)
  return Math.round(d.getTime() / 86_400_000)
}

function load(): void {
  entradas = []
  const file = archivo()
  try {
    if (existsSync(file)) {
      const texto = readFileSync(file, 'utf8')
      for (const linea of texto.split('\n')) {
        if (linea.length === 0) continue
        try {
          const e = JSON.parse(linea) as Entrada
          if (typeof e?.c === 'string' && typeof e?.t === 'number') entradas.push(e)
        } catch {
          // Línea truncada por un cierre abrupto. Es exactamente el caso que el
          // formato append-only está pensado para sobrevivir: se pierde una
          // respuesta y el resto del historial queda intacto.
        }
      }
    }
  } catch (err) {
    logger.error('repasos', 'No se pudo leer el historial de repasos; las métricas arrancan vacías.', err)
  }
  cargado = true
}

function asegurarCargado(): void {
  if (!cargado) load()
}

/** Se llama al arrancar. Compacta si el archivo se fue de tamaño. */
export function init(vivos: () => Set<string>): void {
  load()
  try {
    const file = archivo()
    if (existsSync(file) && statSync(file).size > MAX_BYTES) compact(vivos())
  } catch {
    /* si no se puede medir, no se compacta y listo */
  }
  logger.info('repasos', `Historial cargado: ${entradas.length} repaso(s).`)
}

export function append(
  cardId: string,
  materiaId: string,
  g: Grade,
  esNueva: boolean,
  practica = false,
  now = Date.now()
): void {
  asegurarCargado()
  // En práctica nunca se marca `n`: una tarjeta nueva vista en un repaso libre no
  // gastó cupo, así que tampoco puede figurar como estrenada.
  const e: Entrada = practica
    ? { c: cardId, m: materiaId, t: now, g, p: 1 as const }
    : { c: cardId, m: materiaId, t: now, g, ...(esNueva ? { n: 1 as const } : {}) }
  entradas.push(e)
  try {
    appendFileSync(archivo(), `${JSON.stringify(e)}\n`, 'utf8')
  } catch (err) {
    // El repaso ya se aplicó a la tarjeta, que es lo que importa para que el
    // usuario no la vuelva a ver mañana. Perder la línea del historial degrada
    // las métricas, no el estudio: no vale la pena romperle la sesión por esto.
    logger.warn('repasos', 'No se pudo escribir el historial de repasos.', err)
  }
}

/**
 * Reescribe el archivo dejando sólo los repasos de tarjetas que todavía existen.
 *
 * Se llama al arrancar si el archivo creció mucho, y después de borrar una materia
 * entera —que es cuando de golpe quedan miles de líneas huérfanas—. No se llama en
 * cada borrado de una tarjeta suelta: reescribir varios MB para sacar tres líneas
 * es peor negocio que dejarlas ahí, y las métricas ya las ignoran.
 */
export function compact(vivos: Set<string>): void {
  asegurarCargado()
  const antes = entradas.length
  entradas = entradas.filter((e) => vivos.has(e.c))
  if (entradas.length === antes) return

  const file = archivo()
  const tmp = `${file}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, entradas.map((e) => JSON.stringify(e)).join('\n') + (entradas.length > 0 ? '\n' : ''), 'utf8')
    // El archivo viejo tiene contenido del usuario (qué estudió y cuándo), así que
    // se sobrescribe antes de que el rename lo tape.
    shredFile(file)
    renameSync(tmp, file)
    logger.info('repasos', `Historial compactado: ${antes - entradas.length} línea(s) de tarjetas borradas.`)
  } catch (err) {
    logger.warn('repasos', 'No se pudo compactar el historial.', err)
  }
}

/* -------------------------------- consultas ------------------------------- */

/**
 * Cuántas tarjetas NUEVAS vio hoy el usuario en esta materia.
 *
 * El repaso libre queda afuera (`e.p !== 1`). Ver el comentario de `p` en
 * `Entrada`: es lo que evita que estudiar de más deje sin tarjetas mañana.
 */
/**
 * Cuantas tarjetas NUEVAS se vieron hoy en un conjunto de materias.
 *
 * Recibe un conjunto y no un id porque el tope diario dejo de ser por materia y
 * paso a ser por CARRERA: el que cursa Farmacologia de Enfermeria tiene un cupo
 * de tarjetas nuevas para la carrera entera, no uno por cada una de sus materias.
 * Sumar los cupos por materia le daria, con diez materias en "normal", doscientas
 * tarjetas nuevas por dia — que no es un tope, es no tener tope.
 *
 * El historial sigue guardando `m` (la materia) y no la carrera, a proposito: la
 * materia de una tarjeta no cambia casi nunca, y la carrera de una materia si
 * puede cambiar. Guardar la carrera dejaria lineas de historial apuntando a una
 * carrera que ya no es la suya.
 */
export function nuevasHoy(materiaIds: Set<string>, now = Date.now()): number {
  asegurarCargado()
  const hoy = diaDe(now)
  return entradas.filter((e) => e.p !== 1 && e.n === 1 && materiaIds.has(e.m) && diaDe(e.t) === hoy).length
}

/** Cuántos repasos (no nuevas, no práctica) hizo hoy en esta materia. */
/** Repasos hechos hoy en un conjunto de materias. Ver `nuevasHoy`. */
export function repasosHoy(materiaIds: Set<string>, now = Date.now()): number {
  asegurarCargado()
  const hoy = diaDe(now)
  return entradas.filter((e) => e.p !== 1 && e.n !== 1 && materiaIds.has(e.m) && diaDe(e.t) === hoy).length
}

/** Todo lo que contestó hoy, en todas las materias. Para el panel de progreso. */
export function totalHoy(now = Date.now()): number {
  asegurarCargado()
  const hoy = diaDe(now)
  return entradas.filter((e) => diaDe(e.t) === hoy).length
}

/**
 * Retención real de los últimos N días: de lo que tenía que recordar, cuánto
 * recordó.
 *
 * **Las tarjetas nuevas no cuentan.** La primera vez que alguien ve una tarjeta no
 * la sabe, y eso no es una falla de memoria: es una tarjeta que todavía no
 * aprendió. Contarlas hundiría el número y lo volvería inútil — un usuario que
 * genera un mazo nuevo vería su "retención" desplomarse justo cuando está
 * haciendo lo correcto.
 *
 * "Más o menos" cuenta como acierto: la recordó, le costó. Eso es lo que ese botón
 * significa, y es lo que FSRS entiende por `Hard`.
 *
 * `null` si no hay suficientes datos para decir algo: un 100 % sacado de tres
 * repasos es peor que no mostrar nada.
 *
 * **El repaso libre tampoco cuenta.** Ahí el usuario pasa la misma tarjeta tres
 * veces en diez minutos: la segunda y la tercera las acierta porque acaba de ver
 * la respuesta, no porque las recuerde. Mezclarlas acá inflaría el número justo
 * cuando más se lo mira, la semana antes de un final.
 */
export function retencion(dias = 30, now = Date.now()): number | null {
  asegurarCargado()
  const desde = now - dias * 86_400_000
  const relevantes = entradas.filter((e) => e.t >= desde && e.n !== 1 && e.p !== 1)
  if (relevantes.length < 10) return null
  const aciertos = relevantes.filter((e) => e.g !== 'no').length
  return Math.round((aciertos / relevantes.length) * 100)
}

/**
 * Días seguidos estudiando.
 *
 * Cuenta hacia atrás desde hoy. Si hoy todavía no estudió, arranca desde ayer: a
 * las 10 de la mañana la racha de alguien que estudió catorce días seguidos no es
 * cero, y mostrarle cero mientras desayuna es la forma más rápida de que abandone.
 */
export function racha(now = Date.now()): number {
  asegurarCargado()
  if (entradas.length === 0) return 0

  const dias = new Set(entradas.map((e) => diaDe(e.t)))
  const hoy = diaDe(now)
  let cursor = dias.has(hoy) ? hoy : hoy - 1
  let total = 0
  while (dias.has(cursor)) {
    total++
    cursor--
  }
  return total
}
