import type { EstadoFiltro, Flashcard, SearchHit, SearchQuery, SearchResult } from '@shared/types'
import { normalize } from './core/anchor'
import { allUnidades, getCarrera, getMateria, storeVersion } from './deckStore'
import { isDue, madurez, type Madurez } from './scheduler'

/**
 * El buscador de la biblioteca.
 *
 * ---------------------------------------------------------------------------
 * Por qué un índice en memoria y no SQLite
 * ---------------------------------------------------------------------------
 *
 * SQLite con FTS5 sería lo obvio, y se descartó por una razón de empaquetado, no
 * de gusto: `better-sqlite3` es un módulo nativo, y este proyecto mantiene
 * `npmRebuild: false` justamente para que electron-builder no pida herramientas de
 * compilación ni haya que compilar por arquitectura en las dos plataformas. El
 * `node:sqlite` de Node 22 es experimental y Electron no garantiza exponerlo.
 *
 * Con 15.000 tarjetas el índice son unos pocos MB y se recorre entero en menos de
 * 10 ms, que es menos que el tiempo entre dos teclas. El día que eso deje de ser
 * cierto —cientos de miles de tarjetas— habrá que volver acá, y hasta entonces
 * meter una dependencia nativa sería pagar el precio sin cobrar el beneficio.
 *
 * ---------------------------------------------------------------------------
 * Reconstrucción perezosa
 * ---------------------------------------------------------------------------
 *
 * No hay invalidación fina. El índice guarda con qué `storeVersion()` se armó y se
 * rehace entero cuando ese número cambió. Rehacerlo cuesta ~30 ms y pasa como
 * mucho una vez por búsqueda; la alternativa —parchear el índice en cada
 * operación de escritura— tiene una forma de fallar que no se nota: alguien
 * agrega una operación nueva, se olvida de avisarle al índice, y el buscador
 * empieza a devolver tarjetas que ya no existen. Eso lo descubre un usuario, no
 * una prueba.
 */

interface Entrada {
  card: Flashcard
  unidadId: string
  unidadNombre: string
  materiaId: string
  materiaNombre: string
  carreraId: string
  carreraNombre: string
  /** Frente + dorso normalizados: sin tildes, sin puntuación, en minúscula. */
  texto: string
  /** Nombre de la unidad y de la materia, normalizados. Se busca ahí también. */
  contexto: string
}

let entradas: Entrada[] = []
let construidoEn = -1

/**
 * La normalización es la misma que usa el anclaje de citas, y comparte el motivo:
 * quien escribe "informacion" tiene que encontrar "información", y quien escribe
 * "ANATOMIA" tiene que encontrar "Anatomía". Sin esto el buscador se siente roto
 * en español, y es de las cosas que se descubren tarde porque quien programa
 * suele probar con palabras sin tilde.
 */
function build(): void {
  const out: Entrada[] = []
  for (const u of allUnidades()) {
    const materia = getMateria(u.materiaId)
    const materiaNombre = materia?.nombre ?? 'Sin materia'
    const carrera = materia ? getCarrera(materia.carreraId) : null
    const carreraNombre = carrera?.nombre ?? 'Sin carrera'
    // La carrera entra al contexto buscable: "farmacologia enfermeria" tiene que
    // encontrar algo, y el estudiante piensa en esos terminos antes que en el
    // nombre exacto de la unidad.
    const contexto = normalize(`${u.nombre} ${materiaNombre} ${carreraNombre}`)
    for (const card of u.tarjetas) {
      out.push({
        card,
        unidadId: u.id,
        unidadNombre: u.nombre,
        materiaId: u.materiaId,
        materiaNombre,
        carreraId: materia?.carreraId ?? '',
        carreraNombre,
        texto: normalize(`${card.frente} ${card.dorso}`),
        contexto
      })
    }
  }
  entradas = out
  construidoEn = storeVersion()
}

function asegurarFresco(): void {
  if (construidoEn !== storeVersion()) build()
}

/**
 * Los filtros de la interfaz están en plural ("nuevas") y `madurez()` devuelve el
 * singular ("nueva"). Se mapea explícitamente en vez de comparar los strings
 * directamente.
 *
 * No es purismo: comparar `madurez(...) === filtro` COMPILA —los dos son strings—
 * y funciona para "aprendiendo" y "repasando", que se escriben igual en los dos
 * lados. Falla en silencio sólo para "nuevas" y "aprendidas", que devolverían
 * siempre cero resultados sin ningún error. Es exactamente la clase de bug que no
 * se ve leyendo el código y sí se ve en una prueba.
 */
const MADUREZ_DE: Record<Exclude<EstadoFiltro, 'todas' | 'vencidas'>, Madurez> = {
  nuevas: 'nueva',
  aprendiendo: 'aprendiendo',
  repasando: 'repasando',
  aprendidas: 'aprendida'
}

function pasaEstado(card: Flashcard, filtro: EstadoFiltro, ahora: number): boolean {
  if (filtro === 'todas') return true
  // Una tarjeta nueva nunca cuenta como vencida: no se vio jamás, así que no hay
  // nada que recordar. Es el mismo criterio que usa `stats.dominioDe`.
  if (filtro === 'vencidas') return madurez(card.schedule) !== 'nueva' && isDue(card.schedule, ahora)
  return madurez(card.schedule) === MADUREZ_DE[filtro]
}

/**
 * Cuántos resultados se devuelven como máximo.
 *
 * Devolver 15.000 filas no le sirve a nadie: nadie revisa esa lista, y armar el
 * array cuesta memoria y tiempo de serialización hacia el renderer. `total` viaja
 * aparte para que la UI pueda decir "500 tarjetas, se muestran las primeras 200" —
 * que es información útil— en vez de mentir mostrando 200 como si fueran todas.
 */
const MAX_RESULTADOS = 200

export function search(query: SearchQuery): SearchResult {
  asegurarFresco()
  const ahora = Date.now()

  const términos = normalize(query.texto ?? '')
    .split(' ')
    .filter((t) => t.length > 0)
  const estado = query.estado ?? 'todas'

  const encontradas: SearchHit[] = []
  let total = 0

  for (const e of entradas) {
    if (query.carreraId && e.carreraId !== query.carreraId) continue
    if (query.materiaId && e.materiaId !== query.materiaId) continue
    if (query.unidadId && e.unidadId !== query.unidadId) continue
    if (!pasaEstado(e.card, estado, ahora)) continue

    // Todos los términos tienen que aparecer, en el texto o en el contexto. Es
    // un AND y no un OR a propósito: con OR, buscar "sistema nervioso" devuelve
    // todo lo que diga "sistema", y el resultado útil queda enterrado.
    if (términos.length > 0 && !términos.every((t) => e.texto.includes(t) || e.contexto.includes(t))) continue

    total++
    if (encontradas.length < MAX_RESULTADOS) {
      encontradas.push({
        card: e.card,
        unidadId: e.unidadId,
        unidadNombre: e.unidadNombre,
        materiaId: e.materiaId,
        materiaNombre: e.materiaNombre,
        carreraId: e.carreraId,
        carreraNombre: e.carreraNombre
      })
    }
  }

  return { hits: encontradas, total }
}

/**
 * Las tarjetas de un alcance, para armar una sesión de estudio.
 *
 * Vive acá y no en el planificador porque es exactamente el mismo recorrido
 * filtrado que hace el buscador, y tenerlo dos veces sería tener dos definiciones
 * de "las tarjetas de esta materia" que se pueden desincronizar.
 */
export function cardsEnAlcance(scope: {
  carreraId?: string | null
  materiaId?: string | null
  unidadId?: string | null
  cardIds?: string[] | null
}): SearchHit[] {
  asegurarFresco()

  if (scope.cardIds && scope.cardIds.length > 0) {
    const buscados = new Set(scope.cardIds)
    return entradas
      .filter((e) => buscados.has(e.card.id))
      .map((e) => ({
        card: e.card,
        unidadId: e.unidadId,
        unidadNombre: e.unidadNombre,
        materiaId: e.materiaId,
        materiaNombre: e.materiaNombre,
        carreraId: e.carreraId,
        carreraNombre: e.carreraNombre
      }))
  }

  return entradas
    .filter(
      (e) =>
        (!scope.unidadId || e.unidadId === scope.unidadId) &&
        (!scope.materiaId || e.materiaId === scope.materiaId) &&
        (!scope.carreraId || e.carreraId === scope.carreraId)
    )
    .map((e) => ({
      card: e.card,
      unidadId: e.unidadId,
      unidadNombre: e.unidadNombre,
      materiaId: e.materiaId,
      materiaNombre: e.materiaNombre,
      carreraId: e.carreraId,
      carreraNombre: e.carreraNombre
    }))
}
