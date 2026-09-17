import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Carrera, Flashcard, Materia, Ritmo, TipoTarjeta, Unidad, UnidadFile } from '@shared/types'
import { RITMOS } from '@shared/types'
import { MAZOS_DE_REGALO } from './mazosDeRegalo'
import { dataRoot, unitsDir } from './core/paths'
import { safeDisplayName, shredFile } from './core/fsutil'
import { AppError } from './core/errors'
import { logger } from './core/logger'
import { fingerprint, isDuplicate } from './core/anchor'
import { emptySchedule } from './scheduler'

/**
 * Materias, unidades y tarjetas: dónde viven y cómo se tocan.
 *
 * ---------------------------------------------------------------------------
 * La forma en disco
 * ---------------------------------------------------------------------------
 *
 *   <dataRoot>/materias.json        índice liviano: id, nombre, orden, ritmo
 *   <dataRoot>/unidades/<id>.json   la unidad con TODAS sus tarjetas adentro
 *
 * Un archivo por unidad, y no uno solo con todo, porque una escritura toca sólo la
 * unidad que cambió: calificar una tarjeta reescribe ~80 KB en vez de los varios
 * MB que pesaría la biblioteca entera de alguien con 15.000 tarjetas. En una
 * sesión de estudio eso es una escritura por segundo, así que la diferencia se
 * siente.
 *
 * ---------------------------------------------------------------------------
 * Por qué los archivos se llaman por id y no por nombre
 * ---------------------------------------------------------------------------
 *
 * Es lo que hace posible todo lo demás, y conviene tenerlo claro porque parece un
 * detalle:
 *
 *  · **Renombrar es editar un campo**, no mover un archivo. Sin esto, cada
 *    renombre sería un `renameSync` con riesgo de colisión.
 *  · **Un nombre con `:`, `?`, `/` o un emoji no rompe nada.** "Anatomía I: cabeza
 *    y cuello" es un nombre de materia perfectamente razonable y un nombre de
 *    archivo ilegal en Windows.
 *  · **Editar una tarjeta no le hace perder su historial**, porque el id no
 *    depende de su contenido.
 *  · **Mover una unidad de materia es cambiar `materiaId`.**
 *
 * ---------------------------------------------------------------------------
 * Todo en memoria
 * ---------------------------------------------------------------------------
 *
 * La biblioteca entera se carga al arrancar y vive en RAM. Para 15.000 tarjetas
 * son unos 8 MB y unos 200 ms de arranque, contra la alternativa de leer el disco
 * en cada tecleo del buscador. El disco es el respaldo, no la fuente de verdad
 * durante la sesión.
 *
 * `version` sube en cada escritura y es lo que usa el índice de búsqueda para
 * saber que tiene que reconstruirse. Un contador es a prueba de errores de una
 * forma que la invalidación fina no: si alguien agrega una operación de escritura
 * nueva y se olvida de invalidar el índice, el buscador devuelve resultados
 * viejos y nadie se entera. Olvidarse de subir el contador es el mismo bug, pero
 * hay UN solo lugar donde puede pasar.
 */

/**
 * El índice liviano. Subió a `version: 2` cuando entró el nivel Carrera.
 *
 * Las carreras viven ACÁ adentro y no en un `carreras.json` aparte a propósito:
 * son cinco o diez filas de texto, y un archivo separado agrega un punto de
 * fallo —el caso "existe materias.json pero no carreras.json"— para ahorrar
 * bytes que no molestan a nadie. Un solo archivo se escribe atómicamente de una,
 * y no puede quedar a mitad de camino entre dos estados.
 *
 * La lectura de un archivo `version: 1` (el de Psicoflashy) NO es un error: se
 * migra en memoria metiendo todas las materias en una carrera creada al vuelo.
 * Ver `migrarDesdeV1()`.
 */
interface MateriasFile {
  version: 1 | 2
  carreras?: Carrera[]
  materias: Materia[]
}

const materiasFile = (): string => join(dataRoot(), 'materias.json')

let carreras: Carrera[] = []
let materias: Materia[] = []
/** unidadId → contenido completo del archivo. */
let unidades = new Map<string, UnidadFile>()
let cargado = false
let version = 0

/** Sube en cada escritura. Lo mira `searchIndex` para reconstruirse. */
export function storeVersion(): number {
  return version
}

/* ------------------------------ persistencia ------------------------------ */

/**
 * Escritura atómica: se escribe a un `.tmp` y se renombra encima.
 *
 * `rename` sobre el mismo volumen es atómico, así que un corte de luz a mitad deja
 * el archivo viejo intacto en vez de uno a medio escribir. Es el mismo patrón que
 * usa `config.ts`.
 *
 * El `.tmp` lleva el pid en el nombre para que dos procesos (la app y un arnés de
 * QA) no se pisen el temporal.
 */
function writeAtomic(file: string, contenido: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(contenido), 'utf8')
  renameSync(tmp, file)
}

function persistMaterias(): void {
  const payload: MateriasFile = { version: 2, carreras, materias }
  try {
    mkdirSync(dataRoot(), { recursive: true })
    writeAtomic(materiasFile(), payload)
  } catch (err) {
    throw new AppError('No se pudieron guardar los cambios. Revisá que haya espacio en disco y probá de nuevo.', { cause: err })
  }
}

function persistUnidad(u: UnidadFile): void {
  try {
    writeAtomic(join(unitsDir(), `${u.id}.json`), u)
  } catch (err) {
    throw new AppError('No se pudieron guardar los cambios de la unidad. Revisá que haya espacio en disco y probá de nuevo.', {
      cause: err
    })
  }
}

/** Marca que algo cambió. Va DESPUÉS de persistir, nunca antes. */
function touch(): void {
  version++
}

/* --------------------------------- carga --------------------------------- */

/**
 * Lee todo del disco. Se llama una vez, al arrancar.
 *
 * Un archivo ilegible NO detiene la carga: se loguea y se sigue con los demás. La
 * alternativa —tirar el arranque— convertiría un JSON corrupto en "la app no
 * abre", cuando lo correcto es que abra con 19 materias en vez de 20 y el usuario
 * pueda seguir estudiando mientras se ve qué pasó con la otra.
 */
export function load(): void {
  carreras = []
  materias = []
  unidades = new Map()

  try {
    const file = materiasFile()
    if (existsSync(file)) {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as MateriasFile
      if (Array.isArray(raw?.carreras)) carreras = raw.carreras.filter(esCarreraValida)
      if (Array.isArray(raw?.materias)) {
        // Se filtra por la forma NUEVA. Una materia de Psicoflashy no la pasa
        // —no tiene `carreraId`— y por eso la migración mira el crudo, no esto.
        materias = raw.materias.filter(esMateriaValida)
        if (materias.length === 0 && raw.materias.length > 0) migrarDesdeV1(raw.materias)
      }
    }
  } catch (err) {
    logger.error('datos', 'No se pudo leer el índice de materias; se arranca vacío.', err)
  }

  const dir = unitsDir()
  let leidas = 0
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      try {
        const u = JSON.parse(readFileSync(join(dir, entry.name), 'utf8')) as UnidadFile
        if (esUnidadValida(u)) {
          u.tarjetas = u.tarjetas.filter(esTarjetaValida)
          unidades.set(u.id, u)
          leidas++
        }
      } catch (err) {
        logger.error('datos', `La unidad ${entry.name} no se pudo leer y se saltea.`, err)
      }
    }
  } catch (err) {
    logger.warn('datos', 'No se pudo listar la carpeta de unidades.', err)
  }

  // Una unidad cuya materia ya no existe quedaría invisible para siempre: no
  // aparece en ninguna lista porque las listas se recorren por materia. Se
  // adopta en vez de borrarse — son tarjetas del usuario, y perderlas en
  // silencio por una inconsistencia nuestra sería mucho peor que una materia con
  // un nombre raro que puede renombrar.
  adoptarHuerfanas()

  cargado = true
  touch()
  logger.info(
    'datos',
    `Biblioteca cargada: ${carreras.length} carrera(s), ${materias.length} materia(s), ${leidas} unidad(es), ${contarTarjetas()} tarjeta(s).`
  )
}

function contarTarjetas(): number {
  let n = 0
  for (const u of unidades.values()) n += u.tarjetas.length
  return n
}

/**
 * Levanta un `materias.json` de Psicoflashy (version 1, sin carreras).
 *
 * No debería pasar nunca —Mediflashy tiene su propia carpeta de datos, que es
 * justamente de lo que se ocupa `APP_FOLDER` en paths.ts— pero cuesta veinte
 * líneas y cubre el caso de alguien que copió una carpeta de datos a mano, que
 * es exactamente lo que el anexo de requisitos le dice que haga para respaldar.
 *
 * Las materias viejas traen `ritmo` y no traen `carreraId`. Se les saca el
 * ritmo (ahora vive en la carrera, y se toma el de la primera materia como el
 * de la carrera nueva) y se las cuelga todas de una carrera llamada "Mi
 * carrera", que el usuario puede renombrar.
 */
function migrarDesdeV1(crudas: Array<Materia & { ritmo?: Ritmo }>): void {
  const validas = crudas.filter((m) => !!m && esTexto(m.id) && esTexto(m.nombre))
  if (validas.length === 0) return

  const carrera: Carrera = {
    id: randomUUID(),
    nombre: 'Mi carrera',
    orden: 0,
    createdAt: Date.now(),
    ritmo: (RITMOS as string[]).includes(validas[0].ritmo as string) ? (validas[0].ritmo as Ritmo) : 'normal'
  }
  carreras.push(carrera)
  materias = validas.map((m, i) => ({
    id: m.id,
    carreraId: carrera.id,
    nombre: m.nombre,
    orden: typeof m.orden === 'number' ? m.orden : i,
    createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now()
  }))
  persistMaterias()
  logger.warn('datos', `Se migró un índice de la versión anterior: ${materias.length} materia(s) quedaron en "Mi carrera".`)
}

/**
 * Rescata lo que quedó colgando, en los DOS niveles.
 *
 * Con un nivel más hay dos formas de quedar huérfano y las dos dejan contenido
 * invisible para siempre, porque todas las listas se recorren de arriba hacia
 * abajo: una materia cuya carrera no existe, y una unidad cuya materia no
 * existe. Se adoptan en vez de borrarse — son tarjetas del usuario.
 *
 * El orden importa: primero las materias, después las unidades. Al revés, una
 * unidad podría adoptarse a una materia que a su vez está por adoptarse, y
 * quedaría bien colgada de algo que también estaba roto.
 */
function adoptarHuerfanas(): void {
  const idsCarrera = new Set(carreras.map((c) => c.id))
  const materiasSueltas = materias.filter((m) => !idsCarrera.has(m.carreraId))
  if (materiasSueltas.length > 0) {
    const rescate: Carrera = {
      id: randomUUID(),
      nombre: 'Recuperadas',
      orden: carreras.length,
      createdAt: Date.now(),
      ritmo: 'normal'
    }
    carreras.push(rescate)
    for (const m of materiasSueltas) m.carreraId = rescate.id
    persistMaterias()
    logger.warn('datos', `${materiasSueltas.length} materia(s) sin carrera se movieron a "Recuperadas".`)
  }

  const idsMateria = new Set(materias.map((m) => m.id))
  const huerfanas = [...unidades.values()].filter((u) => !idsMateria.has(u.materiaId))
  if (huerfanas.length === 0) return

  const carreraDestino = carreras[0] ?? crearCarreraInterna('Recuperadas')
  const rescate: Materia = {
    id: randomUUID(),
    carreraId: carreraDestino.id,
    nombre: 'Recuperadas',
    orden: materias.length,
    createdAt: Date.now()
  }
  materias.push(rescate)
  for (const u of huerfanas) {
    u.materiaId = rescate.id
    persistUnidad(u)
  }
  persistMaterias()
  logger.warn('datos', `${huerfanas.length} unidad(es) sin materia se movieron a "Recuperadas".`)
}

/* ------------------------------ primera vez ------------------------------- */

/**
 * Carga los mazos de regalo, una sola vez, si la biblioteca está vacía.
 *
 * CUÁNDO NO HACE NADA, que es lo que más importa:
 *
 *  · si ya hay una materia, aunque sea una — nunca pisa nada de nadie;
 *  · si ya hay una unidad suelta, aunque no tenga materia — ese caso lo arregla
 *    `adoptarHuerfanas()`, y sembrar encima taparía el problema;
 *  · si el usuario borró los mazos de regalo y después borró todo lo suyo, va a
 *    volver a recibirlos. Es aceptable: la alternativa es guardar una marca de
 *    "ya sembré" en la configuración, y una marca que sobreviva al borrado de
 *    los datos es exactamente la clase de archivo escondido que este producto
 *    promete no dejar.
 *
 * Se llama al arrancar, después de `load()`. Devuelve cuántas tarjetas sembró,
 * que es 0 en todos los arranques salvo el primero.
 */
export function sembrarSiEstaVacio(): number {
  asegurarCargado()
  if (materias.length > 0 || unidades.size > 0) return 0

  let puestas = 0
  /* Fuera del `try` para poder contarlas en el log aunque algo falle a la mitad. */
  const yaCreada = new Map<string, string>()
  const carreraDe = new Map<string, string>()
  try {
    /*
     * Una materia se crea UNA vez, aunque tenga varias unidades.
     *
     * `MAZOS_DE_REGALO` es una lista plana de pares (materia, unidad): con catorce
     * materias de cinco unidades cada una son setenta entradas. Creando una materia
     * por entrada, el comprador abriría la app y encontraría "Psicoanálisis I"
     * catorce veces en la lista, cada una con una sola unidad adentro.
     *
     * No pasaba antes porque los cuatro mazos originales eran de cuatro materias
     * distintas, así que una materia por entrada daba el resultado correcto por
     * casualidad.
     */
    for (const mazo of MAZOS_DE_REGALO) {
      let carreraId = carreraDe.get(mazo.carrera)
      if (!carreraId) {
        carreraId = createCarrera(mazo.carrera).id
        carreraDe.set(mazo.carrera, carreraId)
      }
      /*
       * La clave de materia lleva la carrera adentro, y no es un detalle.
       *
       * "Farmacologia general" existe en casi todas las carreras y son mazos
       * DISTINTOS: el de Enfermeria tiene calculo de dosis y el de Medicina
       * tiene cinetica de orden cero. Con la clave solo por nombre, la segunda
       * carrera colgaria sus unidades de la materia de la primera, y el
       * estudiante de Enfermeria abriria su carrera y no veria nada.
       */
      const claveMateria = mazo.carrera + '\u0000' + mazo.materia
      let materiaId = yaCreada.get(claveMateria)
      if (!materiaId) {
        materiaId = createMateria(carreraId, mazo.materia).id
        yaCreada.set(claveMateria, materiaId)
      }
      const u = createUnidad(materiaId, mazo.unidad)
      // `saveCards` porque deduplica y respeta el tope por unidad; `createCard`
      // una por una haría 82 escrituras del mismo archivo en vez de una.
      const { guardadas } = saveCards(
        u.id,
        mazo.tarjetas.map((t) => ({ frente: t.frente, dorso: t.dorso, tipo: t.tipo, fuente: t.fuente }))
      )
      puestas += guardadas
    }
  } catch (err) {
    // Que la app abra igual. Un comprador con la biblioteca vacía tiene un
    // problema menor; uno con una app que no arranca tiene uno grave.
    logger.error('datos', `No pude sembrar los mazos de regalo: ${(err as Error).message}`)
    return puestas
  }

  logger.info(
    'datos',
    `Primer arranque: se cargaron ${puestas} tarjetas de regalo en ${carreraDe.size} carrera(s), ${yaCreada.size} materia(s) y ${MAZOS_DE_REGALO.length} unidad(es).`
  )
  return puestas
}

/**
 * Agrega las unidades de regalo que todavía no existen, sin tocar nada de lo
 * que ya hay.
 *
 * ---------------------------------------------------------------------------
 * Por qué hace falta además de `sembrarSiEstaVacio`
 * ---------------------------------------------------------------------------
 *
 * `sembrarSiEstaVacio` sólo corre en el arranque en el que la biblioteca está
 * en cero. Todos los demás arranques —que son casi todos, porque un comprador
 * actualiza la app mucho después de instalarla— esa función no hace nada. Si
 * mientras tanto el mazo de regalo creció (una materia nueva, o más unidades
 * dentro de una que ya existía, que es exactamente lo que pasó al agregar
 * fármacos en dos tandas), quien ya tenía la app instalada no lo recibe nunca:
 * se queda con la foto del día en que la abrió por primera vez.
 *
 * ---------------------------------------------------------------------------
 * LA REGLA, que es la misma de siempre pero unidad por unidad
 * ---------------------------------------------------------------------------
 *
 * Una unidad que ya existe —con ese nombre, en esa materia, en esa carrera—
 * NO SE TOCA. No se le agregan tarjetas, no se compara su contenido contra la
 * fuente, nada. El usuario puede haber editado esas tarjetas, y una corrección
 * futura al contenido de regalo no se le impone sola a quien ya la recibió:
 * eso es un problema distinto (y más difícil, porque ahí sí hay que decidir
 * qué hacer con una edición del usuario) que agregar una unidad que falta.
 *
 * ---------------------------------------------------------------------------
 * El límite que se acepta a propósito
 * ---------------------------------------------------------------------------
 *
 * Dos casos raros que se aceptan a propósito, los dos por el mismo motivo: la
 * materia y la unidad se identifican por NOMBRE, porque el modelo de datos no
 * guarda "esto lo creó la siembra" en ningún lado, y agregar ese campo ahora
 * pediría migrar instalaciones existentes sin ninguna forma de saber, en una
 * materia vieja, si la creó la app o el usuario.
 *
 *  1. Si alguien borra una unidad de regalo puntual —no la materia entera, una
 *     unidad suelta— y más adelante una actualización agrega OTRA unidad
 *     nueva a esa misma materia, la que se borró puede volver: esta función
 *     no tiene forma de distinguir "nunca la tuvo" de "la tuvo y la borró",
 *     porque la app promete no dejar ninguna marca escondida que sobreviva al
 *     borrado de datos (ver el comentario de `sembrarSiEstaVacio`). Es la
 *     misma aceptación que ya existe para la biblioteca entera, aplicada a
 *     una unidad.
 *
 *  2. Si el usuario ya tiene SU PROPIA materia con el mismo nombre que una
 *     materia de regalo que todavía no existía para él —caso de manual: crea
 *     "Fármacos" para sus apuntes, y más tarde el mazo de regalo estrena una
 *     materia con ese mismo nombre—, esta función la confunde con la de
 *     regalo y le agrega las unidades ahí adentro. No borra ni pisa nada
 *     suyo, sólo suma unidades que no pidió y que puede borrar una por una;
 *     es molesto, no destructivo, y a cambio el mazo de regalo crece para
 *     todo el mundo en vez de para nadie.
 *
 * Se llama en cada arranque, después de `sembrarSiEstaVacio()`: en el primer
 * arranque no encuentra nada para agregar (todo lo creó la otra), y en los
 * siguientes es la única de las dos que hace algo.
 */
export function sembrarContenidoNuevo(): number {
  asegurarCargado()

  const mismoNombre = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es')

  /*
   * `createCarrera`/`createMateria`/`createUnidad` pasan el nombre por
   * `safeDisplayName` antes de guardarlo, que reemplaza `<>:"/\|?*` por
   * espacios porque son inválidos en un nombre de archivo de Windows. Varias
   * materias y unidades de Farmacología llevan dos puntos en el nombre
   * ("Farmacología Cardiovascular: antihipertensivos"), así que lo que queda
   * GUARDADO no es igual, carácter por carácter, a `mazo.materia`.
   *
   * Sin pasar la fuente por el mismo filtro antes de comparar, esta función
   * nunca encontraba esas materias ya creadas y las volvía a crear en cada
   * arranque —duplicadas, con sus unidades adentro— en vez de reconocerlas
   * como ya sembradas. Se detectó escribiendo la prueba de abajo, antes de
   * que le pasara a un comprador de verdad.
   */
  const comoQuedaGuardado = (nombre: string): string => safeDisplayName(nombre, 120)

  let puestas = 0
  let unidadesNuevas = 0
  const materiasTocadas = new Set<string>()

  for (const mazo of MAZOS_DE_REGALO) {
    try {
      const nombreCarrera = comoQuedaGuardado(mazo.carrera)
      const nombreMateria = comoQuedaGuardado(mazo.materia)
      const nombreUnidad = comoQuedaGuardado(mazo.unidad)

      let carrera = carreras.find((c) => mismoNombre(c.nombre, nombreCarrera))
      if (!carrera) carrera = createCarrera(mazo.carrera)

      let materia = listMaterias(carrera.id).find((m) => mismoNombre(m.nombre, nombreMateria))
      if (!materia) materia = createMateria(carrera.id, mazo.materia)

      const yaExiste = listUnidades(materia.id).some((u) => mismoNombre(u.nombre, nombreUnidad))
      if (yaExiste) continue // la regla: no se toca

      const u = createUnidad(materia.id, mazo.unidad)
      const { guardadas } = saveCards(
        u.id,
        mazo.tarjetas.map((t) => ({ frente: t.frente, dorso: t.dorso, tipo: t.tipo, fuente: t.fuente }))
      )
      puestas += guardadas
      unidadesNuevas++
      materiasTocadas.add(`${mazo.carrera} / ${mazo.materia}`)
    } catch (err) {
      // Una unidad que no se pudo agregar no tiene que impedir que se agreguen
      // las demás, ni que la app termine de arrancar.
      logger.error('datos', `No pude agregar la unidad de regalo "${mazo.unidad}" (${mazo.materia}): ${(err as Error).message}`)
    }
  }

  if (unidadesNuevas > 0) {
    logger.info(
      'datos',
      `Contenido de regalo nuevo: se agregaron ${unidadesNuevas} unidad(es) con ${puestas} tarjeta(s) en ${materiasTocadas.size} materia(s) (${[...materiasTocadas].join(', ')}).`
    )
  }
  return puestas
}

/* ------------------------------- validación ------------------------------- */

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function esCarreraValida(c: unknown): c is Carrera {
  const o = c as Carrera
  return !!o && esTexto(o.id) && esTexto(o.nombre) && (RITMOS as string[]).includes(o.ritmo)
}

function esMateriaValida(m: unknown): m is Materia {
  const o = m as Materia
  return !!o && esTexto(o.id) && esTexto(o.nombre) && esTexto(o.carreraId)
}

function esUnidadValida(u: unknown): u is UnidadFile {
  const o = u as UnidadFile
  return !!o && esTexto(o.id) && esTexto(o.materiaId) && esTexto(o.nombre) && Array.isArray(o.tarjetas)
}

function esTarjetaValida(c: unknown): c is Flashcard {
  const o = c as Flashcard
  return !!o && esTexto(o.id) && esTexto(o.frente) && esTexto(o.dorso) && !!o.schedule && typeof o.schedule.due === 'number'
}

function asegurarCargado(): void {
  if (!cargado) load()
}

/* -------------------------------- lecturas -------------------------------- */

/**
 * Las materias, opcionalmente acotadas a una carrera.
 *
 * `carreraId` en `null` o `undefined` devuelve TODAS, que es lo que necesitan el
 * buscador global, la vista "Todas las carreras" y los arneses. Las pantallas
 * de una sola carrera pasan la carrera activa.
 *
 * `Materia.orden` es un número DENTRO de su carrera (0, 1, 2… arrancando de
 * cero en cada una; ver `createMateria`), no un orden global. Por eso, para
 * la lista de todas, no alcanza con ordenar por `(orden, nombre)` a secas: dos
 * materias que son la primera de su carrera empatan en `orden: 0`, y ahí el
 * desempate por nombre puede poner a cualquiera antes que a la que el usuario
 * ordenó a propósito como primera de la carrera que sí quiere ver primero. Por
 * eso primero se agrupa por el orden de la CARRERA (`Carrera.orden`, el mismo
 * que usa el selector) y recién dentro de cada carrera se aplica el orden de
 * la materia.
 */
export function listMaterias(carreraId?: string | null): Materia[] {
  asegurarCargado()
  if (carreraId) {
    return materias
      .filter((m) => m.carreraId === carreraId)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
  }
  const ordenDeCarrera = new Map(carreras.map((c) => [c.id, c.orden]))
  return [...materias].sort((a, b) => {
    const porCarrera = (ordenDeCarrera.get(a.carreraId) ?? 0) - (ordenDeCarrera.get(b.carreraId) ?? 0)
    return porCarrera || a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')
  })
}

/** La carrera de una materia, resolviendo el salto. `null` si algo quedo colgado. */
export function carreraDeMateria(materiaId: string): Carrera | null {
  const m = getMateria(materiaId)
  return m ? getCarrera(m.carreraId) : null
}

export function getMateria(id: string): Materia | null {
  asegurarCargado()
  return materias.find((m) => m.id === id) ?? null
}

export function listUnidades(materiaId: string): UnidadFile[] {
  asegurarCargado()
  return [...unidades.values()]
    .filter((u) => u.materiaId === materiaId)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

export function getUnidad(id: string): UnidadFile | null {
  asegurarCargado()
  return unidades.get(id) ?? null
}

/** Todas las unidades, para el buscador y las métricas. No se ordena: no hace falta. */
export function allUnidades(): UnidadFile[] {
  asegurarCargado()
  return [...unidades.values()]
}

export function listCards(unidadId: string): Flashcard[] {
  return exigirUnidad(unidadId).tarjetas
}

/* -------------------------------- carreras -------------------------------- */

export function listCarreras(): Carrera[] {
  asegurarCargado()
  return [...carreras].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

export function getCarrera(id: string): Carrera | null {
  asegurarCargado()
  return carreras.find((c) => c.id === id) ?? null
}

function exigirCarrera(id: string): Carrera {
  const c = getCarrera(id)
  if (!c) throw new AppError('Esa carrera ya no existe. Actualizá la pantalla y probá de nuevo.')
  return c
}

/** Crea sin persistir ni tocar la version. Solo para el rescate de huerfanas. */
function crearCarreraInterna(nombre: string): Carrera {
  const c: Carrera = {
    id: randomUUID(),
    nombre: safeDisplayName(nombre, 120),
    orden: carreras.length,
    createdAt: Date.now(),
    ritmo: 'normal'
  }
  carreras.push(c)
  return c
}

export function createCarrera(nombre: string): Carrera {
  asegurarCargado()
  const c = crearCarreraInterna(nombre)
  persistMaterias()
  touch()
  return c
}

export function renameCarrera(id: string, nombre: string): Carrera {
  const c = exigirCarrera(id)
  c.nombre = safeDisplayName(nombre, 120)
  persistMaterias()
  touch()
  return c
}

/**
 * El ritmo de estudio de una carrera: cuantas tarjetas nuevas y cuantos repasos
 * por dia. Es UN control para toda la carrera, no uno por materia.
 *
 * En Psicoflashy esto colgaba de la materia. Con catorce materias era tedioso
 * pero posible; con la farmacologia de todas las carreras son decenas, y un
 * tope diario que nadie configura porque la pantalla cansa es un tope mal puesto.
 */
export function setRitmo(id: string, ritmo: Ritmo): Carrera {
  const c = exigirCarrera(id)
  if (!(RITMOS as string[]).includes(ritmo)) throw new AppError('Ese ritmo de estudio no existe.')
  c.ritmo = ritmo
  persistMaterias()
  touch()
  return c
}

export function reorderCarreras(ids: string[]): Carrera[] {
  asegurarCargado()
  ids.forEach((id, i) => {
    const c = carreras.find((x) => x.id === id)
    if (c) c.orden = i
  })
  persistMaterias()
  touch()
  return listCarreras()
}

/**
 * Borra la carrera con TODAS sus materias, unidades y tarjetas.
 *
 * Es la operacion mas destructiva de la app —una carrera entera pueden ser dos
 * mil tarjetas y meses de repasos— asi que quien la llame tiene que haber
 * preguntado antes con un dialogo nativo. `ipc.ts` lo hace.
 *
 * Devuelve cuantas unidades se llevo puestas, para poder decirlo.
 */
export function deleteCarrera(id: string): number {
  exigirCarrera(id)
  const suyas = materias.filter((m) => m.carreraId === id)
  let unidadesBorradas = 0
  for (const m of suyas) unidadesBorradas += deleteMateria(m.id)
  carreras = carreras.filter((c) => c.id !== id)
  persistMaterias()
  touch()
  logger.info('datos', `Carrera borrada con ${suyas.length} materia(s) y ${unidadesBorradas} unidad(es).`)
  return unidadesBorradas
}

/* -------------------------------- materias -------------------------------- */

function exigirMateria(id: string): Materia {
  const m = getMateria(id)
  if (!m) throw new AppError('Esa materia ya no existe. Actualizá la pantalla y probá de nuevo.')
  return m
}

/**
 * El nombre pasa por `safeDisplayName` aunque NO se use como nombre de archivo.
 *
 * Suena innecesario y no lo es: limpia caracteres de control, colapsa espacios y
 * corta a 120. Un nombre pegado desde un PDF puede traer un `‮` (marca de
 * dirección) que da vuelta el texto de toda la fila, o 4.000 caracteres que
 * revientan el ancho de la lista.
 */
export function createMateria(carreraId: string, nombre: string): Materia {
  exigirCarrera(carreraId)
  const m: Materia = {
    id: randomUUID(),
    carreraId,
    nombre: safeDisplayName(nombre, 120),
    // El orden es DENTRO de la carrera: con `materias.length` a secas, la
    // primera materia de la segunda carrera arrancaria en el puesto 30.
    orden: listMaterias(carreraId).length,
    createdAt: Date.now()
  }
  materias.push(m)
  persistMaterias()
  touch()
  return m
}

export function renameMateria(id: string, nombre: string): Materia {
  const m = exigirMateria(id)
  m.nombre = safeDisplayName(nombre, 120)
  persistMaterias()
  touch()
  return m
}

/** Mueve la materia entera —con sus unidades y su progreso— a otra carrera. */
export function moveMateria(id: string, carreraId: string): Materia {
  const m = exigirMateria(id)
  exigirCarrera(carreraId)
  if (m.carreraId === carreraId) return m
  m.carreraId = carreraId
  m.orden = listMaterias(carreraId).length
  persistMaterias()
  touch()
  return m
}

export function reorderMaterias(carreraId: string, ids: string[]): Materia[] {
  exigirCarrera(carreraId)
  ids.forEach((id, i) => {
    const m = materias.find((x) => x.id === id)
    if (m && m.carreraId === carreraId) m.orden = i
  })
  persistMaterias()
  touch()
  return listMaterias(carreraId)
}

/**
 * Borra la materia con TODAS sus unidades y tarjetas.
 *
 * Se sobrescriben los archivos antes de borrarlos (`shredFile`): son apuntes del
 * usuario convertidos en tarjetas, o sea contenido suyo. Un `unlink` a secas
 * suelta la entrada de directorio y deja el contenido recuperable con
 * herramientas comunes.
 *
 * El orden importa: primero las unidades, después el índice. Al revés, un corte a
 * mitad dejaría archivos de unidad sin materia — que `adoptarHuerfanas()` sabe
 * rescatar, pero rescatar algo que el usuario acaba de mandar a borrar sería
 * bastante peor que perderlo.
 */
export function deleteMateria(id: string): number {
  exigirMateria(id)
  const suyas = listUnidades(id)

  for (const u of suyas) {
    shredFile(join(unitsDir(), `${u.id}.json`))
    unidades.delete(u.id)
  }
  materias = materias.filter((x) => x.id !== id)
  persistMaterias()
  touch()

  logger.info('datos', `Materia borrada con ${suyas.length} unidad(es).`)
  return suyas.length
}

/* -------------------------------- unidades -------------------------------- */

function exigirUnidad(id: string): UnidadFile {
  const u = getUnidad(id)
  if (!u) throw new AppError('Esa unidad ya no existe. Actualizá la pantalla y probá de nuevo.')
  return u
}

export function createUnidad(materiaId: string, nombre: string): Unidad {
  exigirMateria(materiaId)
  const u: UnidadFile = {
    version: 1,
    id: randomUUID(),
    materiaId,
    nombre: safeDisplayName(nombre, 120),
    orden: listUnidades(materiaId).length,
    createdAt: Date.now(),
    tarjetas: []
  }
  unidades.set(u.id, u)
  persistUnidad(u)
  touch()
  return toUnidad(u)
}

export function renameUnidad(id: string, nombre: string): Unidad {
  const u = exigirUnidad(id)
  u.nombre = safeDisplayName(nombre, 120)
  persistUnidad(u)
  touch()
  return toUnidad(u)
}

/** Mueve la unidad entera —con sus tarjetas y su progreso— a otra materia. */
export function moveUnidad(id: string, materiaId: string): Unidad {
  const u = exigirUnidad(id)
  exigirMateria(materiaId)
  if (u.materiaId === materiaId) return toUnidad(u)

  u.materiaId = materiaId
  // Va al final de la materia nueva: insertarla en el medio movería las demás sin
  // que el usuario lo haya pedido.
  u.orden = listUnidades(materiaId).length
  persistUnidad(u)
  touch()
  return toUnidad(u)
}

export function reorderUnidades(materiaId: string, ids: string[]): Unidad[] {
  exigirMateria(materiaId)
  ids.forEach((id, i) => {
    const u = unidades.get(id)
    if (u && u.materiaId === materiaId) {
      u.orden = i
      persistUnidad(u)
    }
  })
  touch()
  return listUnidades(materiaId).map(toUnidad)
}

export function deleteUnidad(id: string): boolean {
  const u = exigirUnidad(id)
  shredFile(join(unitsDir(), `${u.id}.json`))
  unidades.delete(id)
  touch()
  logger.info('datos', `Unidad borrada con ${u.tarjetas.length} tarjeta(s).`)
  return true
}

/** La vista sin tarjetas, que es lo que viaja a la interfaz en las listas. */
export function toUnidad(u: UnidadFile): Unidad {
  return { id: u.id, materiaId: u.materiaId, nombre: u.nombre, orden: u.orden, createdAt: u.createdAt }
}

/* -------------------------------- tarjetas -------------------------------- */

/** Tope por unidad. Existe para que un apunte de 800 páginas no arme un archivo inmanejable. */
const MAX_TARJETAS_POR_UNIDAD = 5000

/**
 * Lo más largo que se guarda de cada campo de una tarjeta.
 *
 * Exportado porque el importador de mazos valida contra estos mismos números: si
 * aceptara un dorso más largo que el que se guarda, lo recortaría en silencio, y
 * en una tarjeta de dosis un recorte silencioso es peor que un error explicado.
 */
export const LARGO_MAXIMO = { frente: 400, dorso: 1200, fuente: 300 } as const

/**
 * Recorta una cita larga en el último espacio, con puntos suspensivos.
 *
 * Las fuentes del mazo de fábrica llegan a 1.200 caracteres (libro, página y el
 * porqué de cada página) y la pantalla de estudio las muestra chicas debajo de la
 * respuesta. Antes se cortaban a los 300 a mitad de palabra: "la depuraci". El
 * dato que importa —libro y página— va siempre al principio y queda entero.
 */
function recortarCita(v: string): string {
  const limpio = limpiarTexto(v, Number.MAX_SAFE_INTEGER)
  if (limpio.length <= LARGO_MAXIMO.fuente) return limpio
  const corte = limpio.slice(0, LARGO_MAXIMO.fuente - 1)
  const espacio = corte.lastIndexOf(' ')
  return (espacio > LARGO_MAXIMO.fuente * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:(]+$/, '') + '…'
}

const limpiarTexto = (v: string, max: number): string =>
  Array.from(typeof v === 'string' ? v : '')
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code >= 32 || ch === '\n'
    })
    .join('')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max)

function nuevaTarjeta(frente: string, dorso: string, origen: 'ia' | 'manual', tipo?: TipoTarjeta, fuente?: string): Flashcard {
  const f = limpiarTexto(frente, LARGO_MAXIMO.frente)
  const d = limpiarTexto(dorso, LARGO_MAXIMO.dorso)
  if (f.length === 0 || d.length === 0) throw new AppError('La tarjeta necesita texto adelante y atrás.')
  const now = Date.now()
  const cita = typeof fuente === 'string' ? recortarCita(fuente) : ''
  return {
    id: randomUUID(),
    frente: f,
    dorso: d,
    createdAt: now,
    updatedAt: now,
    origen,
    ...(tipo ? { tipo } : {}),
    ...(cita.length > 0 ? { fuente: cita } : {}),
    schedule: emptySchedule(now)
  }
}

export function createCard(unidadId: string, frente: string, dorso: string): Flashcard {
  const u = exigirUnidad(unidadId)
  if (u.tarjetas.length >= MAX_TARJETAS_POR_UNIDAD) {
    throw new AppError(`Esta unidad ya tiene ${MAX_TARJETAS_POR_UNIDAD} tarjetas, que es el máximo. Creá otra unidad para seguir.`)
  }
  const card = nuevaTarjeta(frente, dorso, 'manual')
  u.tarjetas.push(card)
  persistUnidad(u)
  touch()
  return card
}

/**
 * Guarda de una vez las tarjetas revisadas de una generación.
 *
 * DESCARTA LAS QUE YA ESTÁN EN LA UNIDAD, y eso es lo que hace que "generar más
 * tarjetas" sea una acción segura.
 *
 * El generador deduplica dentro de UNA corrida, pero no sabe nada de lo que ya
 * está guardado. Sin este chequeo, el caso más normal del mundo —el usuario genera
 * de un apunte, se queda corto, y vuelve a generar del mismo apunte con la
 * densidad en "Muchas"— le deja el mazo lleno de pares idénticos, y cada repaso le
 * pregunta lo mismo dos veces para siempre. La única forma de arreglarlo sería a
 * mano, tarjeta por tarjeta.
 *
 * Se devuelve cuántas se guardaron y cuántas se descartaron por repetidas, para
 * que la interfaz lo pueda decir en vez de que el usuario cuente y no le cierre.
 */
export function saveCards(
  unidadId: string,
  cards: Array<{ frente: string; dorso: string; tipo?: TipoTarjeta; fuente?: string }>
): { guardadas: number; repetidas: number } {
  const u = exigirUnidad(unidadId)
  const espacio = MAX_TARJETAS_POR_UNIDAD - u.tarjetas.length
  if (espacio <= 0) {
    throw new AppError(`Esta unidad ya tiene ${MAX_TARJETAS_POR_UNIDAD} tarjetas, que es el máximo. Creá otra unidad para seguir.`)
  }

  // Las huellas de lo que YA está en la unidad. Se calculan una sola vez: con 500
  // tarjetas guardadas y 40 nuevas serían 20.000 comparaciones si se rehicieran.
  const huellas = u.tarjetas.map((c) => fingerprint(c.frente))

  let guardadas = 0
  let repetidas = 0

  for (const c of cards) {
    if (guardadas >= espacio) break
    try {
      const huella = fingerprint(c.frente)
      if (isDuplicate(huella, huellas)) {
        repetidas++
        continue
      }
      u.tarjetas.push(nuevaTarjeta(c.frente, c.dorso, 'ia', c.tipo, c.fuente))
      // Se suma a las huellas para que dos tarjetas iguales DENTRO de este mismo
      // guardado tampoco entren las dos.
      huellas.push(huella)
      guardadas++
    } catch {
      // Una tarjeta vacía que se coló de la revisión no puede tirar abajo el
      // guardado de las otras cuarenta.
    }
  }

  if (guardadas > 0) {
    persistUnidad(u)
    touch()
  }
  return { guardadas, repetidas }
}

/**
 * Cambia el texto de una tarjeta. NO TOCA SU PROGRESO, y es deliberado.
 *
 * La app no puede distinguir "le corregí una coma" de "cambié la pregunta
 * entera", y adivinar mal duele en las dos direcciones: resetear por una errata
 * tira semanas de repasos, y no resetear un cambio real deja al usuario creyendo
 * que sabe algo que nunca vio. Como no se puede saber, la app no decide: no
 * resetea nunca, y al lado del editor hay un botón explícito para hacerlo.
 * Es lo mismo que hace Anki, por el mismo motivo.
 */
export function updateCard(unidadId: string, cardId: string, frente: string, dorso: string): Flashcard {
  const u = exigirUnidad(unidadId)
  const card = u.tarjetas.find((c) => c.id === cardId)
  if (!card) throw new AppError('Esa tarjeta ya no existe.')

  const f = limpiarTexto(frente, LARGO_MAXIMO.frente)
  const d = limpiarTexto(dorso, LARGO_MAXIMO.dorso)
  if (f.length === 0 || d.length === 0) throw new AppError('La tarjeta necesita texto adelante y atrás.')

  card.frente = f
  card.dorso = d
  card.updatedAt = Date.now()
  persistUnidad(u)
  touch()
  return card
}

export function resetProgress(unidadId: string, cardId: string): Flashcard {
  const u = exigirUnidad(unidadId)
  const card = u.tarjetas.find((c) => c.id === cardId)
  if (!card) throw new AppError('Esa tarjeta ya no existe.')
  card.schedule = emptySchedule()
  card.updatedAt = Date.now()
  persistUnidad(u)
  touch()
  return card
}

/** Guarda el nuevo estado de repaso después de calificar. */
export function saveSchedule(unidadId: string, cardId: string, schedule: Flashcard['schedule']): void {
  const u = getUnidad(unidadId)
  if (!u) return
  const card = u.tarjetas.find((c) => c.id === cardId)
  if (!card) return
  card.schedule = schedule
  persistUnidad(u)
  touch()
}

export function moveCard(fromUnidadId: string, cardId: string, toUnidadId: string): boolean {
  if (fromUnidadId === toUnidadId) return true
  const origen = exigirUnidad(fromUnidadId)
  const destino = exigirUnidad(toUnidadId)

  const i = origen.tarjetas.findIndex((c) => c.id === cardId)
  if (i < 0) throw new AppError('Esa tarjeta ya no existe.')
  if (destino.tarjetas.length >= MAX_TARJETAS_POR_UNIDAD) {
    throw new AppError('La unidad de destino ya llegó al máximo de tarjetas.')
  }

  // Se mueve con su progreso: el usuario ordenó su biblioteca, no volvió a
  // empezar de cero con esa tarjeta.
  const [card] = origen.tarjetas.splice(i, 1)
  destino.tarjetas.push(card)
  persistUnidad(origen)
  persistUnidad(destino)
  touch()
  return true
}

export function deleteCard(unidadId: string, cardId: string): boolean {
  const u = exigirUnidad(unidadId)
  const antes = u.tarjetas.length
  u.tarjetas = u.tarjetas.filter((c) => c.id !== cardId)
  if (u.tarjetas.length === antes) return false
  persistUnidad(u)
  touch()
  return true
}

/** Dónde está una tarjeta. Lo usa la sesión de estudio, que trabaja con ids sueltos. */
export function findCard(cardId: string): { card: Flashcard; unidad: UnidadFile } | null {
  asegurarCargado()
  for (const u of unidades.values()) {
    const card = u.tarjetas.find((c) => c.id === cardId)
    if (card) return { card, unidad: u }
  }
  return null
}
