import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { randomInt } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  EstadoMemoria,
  AppConfig,
  AppInfo,
  ExtractedDoc,
  Flashcard,
  GenLevel,
  GenModelStatus,
  GenOptions,
  GenProgress,
  GenResult,
  GeneratedCard,
  InstalledModel,
  Materia,
  ModelProgress,
  Platform,
  Progreso,
  ResumenImportacion,
  Result,
  Ritmo,
  SaveResult,
  SearchQuery,
  SearchResult,
  SessionState,
  SessionSummary,
  StudyScope,
  Tema,
  Unidad,
  UnidadResumen
} from '@shared/types'
import { GEN_LEVELS, IPC, SUPPORTED_DOC_EXTENSIONS } from '@shared/types'
import type { Carrera } from '@shared/types'
import type { ConfigStore } from './services/core/config'
import { GEN_MODELS, deleteGenModel, ensureGenModel, genModelStatus, genPartialBytes, resolveInstalledModel } from './services/core/genModels'
import { startServer, stopServer } from './services/core/llamaServer'
import { dataRoot, llamaBinary, logsDir, modelsDir } from './services/core/paths'
import { threadCount } from './services/core/platform'
import { formatBytes } from './services/core/fsutil'
import {
  MAX_BYTES_ARCHIVO,
  exportarMateria,
  importar,
  materiaConEseNombre,
  nombreDeArchivo,
  parsear
} from './services/mazoArchivo'
import { logger } from './services/core/logger'
import { leerMemoria } from './services/memoria'
import { AppError, isCanceled, userMessage } from './services/core/errors'
import * as deck from './services/deckStore'
import { search } from './services/searchIndex'
import { dominioDe, idsVivos, progreso, unidadesConDominio } from './services/stats'
import { compact } from './services/reviewLog'
import { extractDocument, fromPastedText } from './services/ingest'
import { generate } from './services/generator'
import * as sesion from './services/studySession'

/**
 * Todos los canales que la interfaz puede llamar.
 *
 * Dos reglas que valen para todo el archivo:
 *
 *  1. **Ninguna excepción llega cruda al renderer.** El wrapper `handle()` las
 *     atrapa, las loguea con su detalle técnico y devuelve un `Result` con un
 *     mensaje escrito para una persona.
 *  2. **El main no confía en el renderer.** Aunque hoy del otro lado haya una UI
 *     propia que se porta bien, los handlers validan lo que reciben. Es lo que
 *     hace que el día que entre contenido de terceros al renderer, lo peor que
 *     pueda pasar siga siendo nada.
 */

/** Generación en curso. Es una por vez: el motor tiene un solo slot. */
let generacion: AbortController | null = null

/**
 * Descarga de modelo disparada fuera de una generación.
 *
 * Tiene su propio controlador porque puede arrancar sola desde la pantalla de
 * modelos. Si compartiera el `AbortController` de la generación, cancelar la
 * descarga cancelaría una generación que ni siquiera empezó, y al revés.
 */
let descargaModelo: AbortController | null = null

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

/** Le avisa a la interfaz que la biblioteca cambió, para que refresque sola. */
function libraryChanged(): void {
  send(IPC.evtLibraryChanged, null)
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

function fail<T>(error: string): Result<T> {
  return { ok: false, error }
}

/** Envuelve un handler para que ninguna excepción llegue cruda al renderer. */
function handle<TArgs extends unknown[], TResult>(channel: string, fn: (...args: TArgs) => Promise<TResult> | TResult): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return ok(await fn(...(args as TArgs)))
    } catch (err) {
      if (!isCanceled(err)) logger.error('ipc', `Falló el canal "${channel}".`, err)
      return fail(userMessage(err))
    }
  })
}

/**
 * Rutas que la interfaz tiene permitido abrir con el shell del sistema.
 *
 * `shell.openPath` ejecuta lo que le pasen —un .exe, un .lnk—, así que el handler
 * no puede confiar en el argumento. Hoy la interfaz sólo pide abrir la carpeta de
 * modelos y el log; con la lista, aunque algún día entre contenido de terceros al
 * renderer, lo peor que puede hacer es volver a abrir algo que la app ya le mostró.
 */
const abribles = new Set<string>()

function claveRuta(target: string): string {
  const full = resolve(target)
  return process.platform === 'win32' ? full.toLowerCase() : full
}

function permitirAbrir(target: string | undefined | null): void {
  if (typeof target === 'string' && target.length > 0) abribles.add(claveRuta(target))
}

/* ------------------------------ validaciones ------------------------------ */

const esId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

function exigirId(v: unknown, que: string): string {
  if (!esId(v)) throw new AppError(`Falta el identificador de ${que}.`)
  return v
}

function exigirTexto(v: unknown, que: string, max = 400): string {
  if (typeof v !== 'string' || v.trim().length === 0) throw new AppError(`Hace falta escribir ${que}.`)
  return v.slice(0, max)
}

function esGenLevel(v: unknown): v is GenLevel {
  return typeof v === 'string' && (GEN_LEVELS as string[]).includes(v)
}

/**
 * El motor de generación. Se chequea aparte del arranque de la app.
 *
 * Sin `llama-server` no se pueden crear tarjetas, pero SÍ se puede estudiar,
 * buscar y editar las que ya existen — que es la mayor parte del uso diario. Por
 * eso esto no bloquea el arranque: apaga el botón de generar, con su motivo a la
 * vista, y deja el resto andando.
 */
export function engineCheck(): { ready: boolean; error?: string } {
  const llama = llamaBinary()
  return llama.path ? { ready: true } : { ready: false, error: llama.error }
}

export function isGenerating(): boolean {
  return generacion !== null
}

export function cancelRunningGeneration(): void {
  generacion?.abort()
  descargaModelo?.abort()
}

/* -------------------------------- registro -------------------------------- */

export function registerIpc(config: ConfigStore, alCambiarTema?: (tema: Tema) => void): void {
  /* ------------------------------- app y config ------------------------------ */

  handle<[], AppInfo>(IPC.appInfo, () => {
    const engine = engineCheck()
    return {
      nombre: app.getName(),
      version: app.getVersion(),
      platform: process.platform as Platform,
      engineReady: engine.ready,
      ...(engine.error ? { engineError: engine.error } : {}),
      logFilePath: logger.filePath,
      modelsDir: modelsDir(),
      dataDir: dataRoot(),
      threads: threadCount()
    }
  })

  handle<[], AppConfig>(IPC.configGet, () => config.get())
  handle<[Partial<AppConfig>], AppConfig>(IPC.configSet, (patch) => {
    const temaAntes = config.get().tema
    const guardada = config.set(patch ?? {})
    if (guardada.tema !== temaAntes) alCambiarTema?.(guardada.tema)
    return guardada
  })

  handle<[string], boolean>(IPC.openPath, async (target) => {
    if (!abribles.has(claveRuta(target))) throw new AppError('No se puede abrir esa ubicación.')
    const err = await shell.openPath(target)
    if (err) throw new AppError('No se pudo abrir la ubicación.')
    return true
  })

  handle<[], boolean>(IPC.openLogFile, async () => {
    const err = await shell.openPath(logger.filePath)
    if (err) await shell.openPath(logsDir())
    return true
  })

  /**
   * Abre la carpeta donde vive todo lo del usuario, para que pueda copiarla.
   *
   * Es la única forma que tiene de hacer una copia de seguridad: la app no las hace
   * sola, y así está declarado en el anexo del contrato. Sin este botón, el
   * "copiá la carpeta de datos" del archivo de ayuda le pide algo que no puede
   * encontrar.
   */
  /* Cuánta memoria libre hay. La interfaz lo pide cada pocos segundos para el
     indicador de la barra de arriba: es una lectura del sistema operativo, sin
     costo apreciable, y no toca nada. */
  handle<[], EstadoMemoria>(IPC.memoria, async () => leerMemoria())

  handle<[], boolean>(IPC.openDataFolder, async () => {
    const dir = dataRoot()
    permitirAbrir(dir)
    const err = await shell.openPath(dir)
    if (err) throw new AppError('No se pudo abrir la carpeta de tus datos.')
    return true
  })

  ipcMain.on(IPC.logFromRenderer, (_event, level: unknown, message: unknown) => {
    const texto = typeof message === 'string' ? message.slice(0, 500) : ''
    if (texto.length === 0) return
    if (level === 'error') logger.error('ui', texto)
    else if (level === 'warn') logger.warn('ui', texto)
    else logger.info('ui', texto)
  })

  /* --------------------------------- carreras -------------------------------- */

  handle<[], Carrera[]>(IPC.carreraList, () => deck.listCarreras())

  handle<[string], Carrera>(IPC.carreraCreate, (nombre) => {
    const c = deck.createCarrera(exigirTexto(nombre, 'el nombre de la carrera', 120))
    libraryChanged()
    return c
  })

  handle<[string, string], Carrera>(IPC.carreraRename, (id, nombre) => {
    const c = deck.renameCarrera(exigirId(id, 'la carrera'), exigirTexto(nombre, 'el nombre de la carrera', 120))
    libraryChanged()
    return c
  })

  /* El ritmo de estudio cuelga de la carrera, no de la materia. Ver `setRitmo`. */
  handle<[string, Ritmo], Carrera>(IPC.carreraSetRitmo, (id, ritmo) => {
    const c = deck.setRitmo(exigirId(id, 'la carrera'), ritmo)
    libraryChanged()
    return c
  })

  handle<[string[]], Carrera[]>(IPC.carreraReorder, (ids) => {
    const lista = deck.reorderCarreras(Array.isArray(ids) ? ids.filter(esId) : [])
    libraryChanged()
    return lista
  })

  /**
   * Borrar una carrera es la operacion mas destructiva de la app: se lleva todas
   * sus materias, todas sus unidades, todas sus tarjetas y meses de repasos. Por
   * eso el dialogo dice con numeros exactamente cuanto se pierde, y por eso el
   * boton por defecto es Cancelar.
   */
  handle<[string], boolean>(IPC.carreraDelete, async (id) => {
    const carreraId = exigirId(id, 'la carrera')
    const carrera = deck.getCarrera(carreraId)
    if (!carrera) throw new AppError('Esa carrera ya no existe.')

    const materias = deck.listMaterias(carreraId)
    const unidades = materias.flatMap((m) => deck.listUnidades(m.id))
    const tarjetas = unidades.reduce((n, u) => n + u.tarjetas.length, 0)

    const elegido = dialog.showMessageBoxSync(ventana(), {
      type: 'warning',
      title: 'Mediflashy',
      message: `¿Borrar la carrera "${carrera.nombre}"?`,
      detail:
        `Se borran ${materias.length} materia(s), ${unidades.length} unidad(es) y ${tarjetas} tarjeta(s), ` +
        'con todo el progreso de repaso de cada una. Esto no se puede deshacer.',
      buttons: ['Cancelar', 'Borrar todo'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (elegido !== 1) return false

    deck.deleteCarrera(carreraId)
    libraryChanged()
    return true
  })

  /* --------------------------------- materias -------------------------------- */

  /* `carreraId` opcional: sin el devuelve todas, que es lo que necesita el
     buscador global. Las pantallas mandan la carrera activa. */
  handle<[string | null], Materia[]>(IPC.materiaList, (carreraId) =>
    deck.listMaterias(typeof carreraId === 'string' && carreraId.length > 0 ? carreraId : null)
  )

  handle<[string, string], Materia>(IPC.materiaCreate, (carreraId, nombre) => {
    const m = deck.createMateria(exigirId(carreraId, 'la carrera'), exigirTexto(nombre, 'el nombre de la materia', 120))
    libraryChanged()
    return m
  })

  handle<[string, string], Materia>(IPC.materiaRename, (id, nombre) => {
    const m = deck.renameMateria(exigirId(id, 'la materia'), exigirTexto(nombre, 'el nombre de la materia', 120))
    libraryChanged()
    return m
  })

  handle<[string, string], Materia>(IPC.materiaMove, (id, carreraId) => {
    const m = deck.moveMateria(exigirId(id, 'la materia'), exigirId(carreraId, 'la carrera'))
    libraryChanged()
    return m
  })

  handle<[string, string[]], Materia[]>(IPC.materiaReorder, (carreraId, ids) => {
    const lista = deck.reorderMaterias(exigirId(carreraId, 'la carrera'), Array.isArray(ids) ? ids.filter(esId) : [])
    libraryChanged()
    return lista
  })

  /**
   * Borrar una materia se lleva puestas todas sus unidades y todas sus tarjetas,
   * con el progreso de repaso de cada una. Es lo más destructivo que hace la app,
   * así que el diálogo dice EXACTAMENTE cuánto se va a perder, con números.
   */
  handle<[string], boolean>(IPC.materiaDelete, async (id) => {
    const materiaId = exigirId(id, 'la materia')
    const materia = deck.getMateria(materiaId)
    if (!materia) throw new AppError('Esa materia ya no existe.')

    const unidades = deck.listUnidades(materiaId)
    const tarjetas = unidades.reduce((n, u) => n + u.tarjetas.length, 0)

    const elegido = dialog.showMessageBoxSync(ventana(), {
      type: 'warning',
      title: 'Mediflashy',
      message: `¿Borrar la materia "${materia.nombre}"?`,
      detail:
        tarjetas > 0
          ? `Se van a borrar sus ${unidades.length} unidad(es) y sus ${tarjetas} tarjeta(s), junto con todo lo que estudiaste de ellas. Esto no se puede deshacer.`
          : 'La materia no tiene tarjetas todavía.',
      buttons: ['Cancelar', 'Borrar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (elegido !== 1) return false

    deck.deleteMateria(materiaId)
    // Borrar una materia entera deja miles de líneas huérfanas en el historial.
    // Es el momento correcto para compactar; en el borrado de una tarjeta suelta
    // no vale la pena.
    compact(idsVivos())
    libraryChanged()
    return true
  })

  /* --------------------------------- unidades -------------------------------- */

  handle<[string], UnidadResumen[]>(IPC.unidadList, (materiaId) => unidadesConDominio(exigirId(materiaId, 'la materia')))

  handle<[string, string], Unidad>(IPC.unidadCreate, (materiaId, nombre) => {
    const u = deck.createUnidad(exigirId(materiaId, 'la materia'), exigirTexto(nombre, 'el nombre de la unidad', 120))
    libraryChanged()
    return u
  })

  handle<[string, string], Unidad>(IPC.unidadRename, (id, nombre) => {
    const u = deck.renameUnidad(exigirId(id, 'la unidad'), exigirTexto(nombre, 'el nombre de la unidad', 120))
    libraryChanged()
    return u
  })

  handle<[string, string], Unidad>(IPC.unidadMove, (id, materiaId) => {
    const u = deck.moveUnidad(exigirId(id, 'la unidad'), exigirId(materiaId, 'la materia'))
    libraryChanged()
    return u
  })

  handle<[string, string[]], Unidad[]>(IPC.unidadReorder, (materiaId, ids) => {
    const lista = deck.reorderUnidades(exigirId(materiaId, 'la materia'), Array.isArray(ids) ? ids.filter(esId) : [])
    libraryChanged()
    return lista
  })

  handle<[string], boolean>(IPC.unidadDelete, async (id) => {
    const unidadId = exigirId(id, 'la unidad')
    const unidad = deck.getUnidad(unidadId)
    if (!unidad) throw new AppError('Esa unidad ya no existe.')

    const elegido = dialog.showMessageBoxSync(ventana(), {
      type: 'warning',
      title: 'Mediflashy',
      message: `¿Borrar la unidad "${unidad.nombre}"?`,
      detail:
        unidad.tarjetas.length > 0
          ? `Se van a borrar sus ${unidad.tarjetas.length} tarjeta(s) y todo lo que estudiaste de ellas. Esto no se puede deshacer.`
          : 'La unidad no tiene tarjetas todavía.',
      buttons: ['Cancelar', 'Borrar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (elegido !== 1) return false

    deck.deleteUnidad(unidadId)
    libraryChanged()
    return true
  })

  /* --------------------------------- tarjetas -------------------------------- */

  handle<[string], Flashcard[]>(IPC.cardList, (unidadId) => deck.listCards(exigirId(unidadId, 'la unidad')))

  handle<[string, string, string], Flashcard>(IPC.cardCreate, (unidadId, frente, dorso) => {
    const card = deck.createCard(
      exigirId(unidadId, 'la unidad'),
      exigirTexto(frente, 'el frente de la tarjeta', 400),
      exigirTexto(dorso, 'el dorso de la tarjeta', 1200)
    )
    libraryChanged()
    return card
  })

  handle<[string, string, string, string], Flashcard>(IPC.cardUpdate, (unidadId, cardId, frente, dorso) => {
    const card = deck.updateCard(
      exigirId(unidadId, 'la unidad'),
      exigirId(cardId, 'la tarjeta'),
      exigirTexto(frente, 'el frente de la tarjeta', 400),
      exigirTexto(dorso, 'el dorso de la tarjeta', 1200)
    )
    libraryChanged()
    return card
  })

  handle<[string, string, string], boolean>(IPC.cardMove, (fromId, cardId, toId) => {
    const movida = deck.moveCard(exigirId(fromId, 'la unidad'), exigirId(cardId, 'la tarjeta'), exigirId(toId, 'la unidad de destino'))
    libraryChanged()
    return movida
  })

  // Borrar UNA tarjeta no pide confirmación nativa: es una acción de bajo costo
  // (una tarjeta se vuelve a escribir en veinte segundos) y muy frecuente al
  // revisar un mazo recién generado. Un diálogo modal por cada una convertiría la
  // limpieza del mazo en una tortura. Materias y unidades sí la piden, porque ahí
  // lo que se pierde es de otro orden.
  handle<[string, string], boolean>(IPC.cardDelete, (unidadId, cardId) => {
    const borrada = deck.deleteCard(exigirId(unidadId, 'la unidad'), exigirId(cardId, 'la tarjeta'))
    if (borrada) libraryChanged()
    return borrada
  })

  handle<[string, string], Flashcard>(IPC.cardResetProgress, (unidadId, cardId) => {
    const card = deck.resetProgress(exigirId(unidadId, 'la unidad'), exigirId(cardId, 'la tarjeta'))
    libraryChanged()
    return card
  })

  handle<[string, GeneratedCard[]], SaveResult>(IPC.cardSaveMany, (unidadId, cards) => {
    if (!Array.isArray(cards) || cards.length === 0) throw new AppError('No hay tarjetas para guardar.')
    const r = deck.saveCards(exigirId(unidadId, 'la unidad'), cards)
    if (r.guardadas > 0) libraryChanged()
    return r
  })

  /* --------------------------------- búsqueda -------------------------------- */

  handle<[SearchQuery], SearchResult>(IPC.search, (query) =>
    search({
      texto: typeof query?.texto === 'string' ? query.texto.slice(0, 200) : '',
      materiaId: esId(query?.materiaId) ? query.materiaId : null,
      unidadId: esId(query?.unidadId) ? query.unidadId : null,
      estado: query?.estado ?? 'todas'
    })
  )

  /* --------------------------------- ingesta --------------------------------- */

  handle<[], ExtractedDoc | null>(IPC.docPick, async () => {
    const elegido = await dialog.showOpenDialog(ventana(), {
      title: 'Elegí un apunte',
      properties: ['openFile'],
      filters: [
        { name: 'Apuntes', extensions: [...SUPPORTED_DOC_EXTENSIONS] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx'] },
        { name: 'PowerPoint', extensions: ['pptx'] },
        { name: 'Texto', extensions: ['txt', 'md'] }
      ]
    })
    if (elegido.canceled || elegido.filePaths.length === 0) return null
    return extractDocument(elegido.filePaths[0])
  })

  /**
   * Elegir VARIOS apuntes de una. Es lo que llena la cola de generación.
   *
   * Devuelve las RUTAS, no el contenido: una unidad entera son quince archivos, y
   * extraerlos todos acá dejaría decenas de megas de texto en memoria antes de
   * usar el primero. Cada uno se lee recién cuando le toca su turno.
   */
  handle<[], string[]>(IPC.docPickMany, async () => {
    const elegido = await dialog.showOpenDialog(ventana(), {
      title: 'Elegí los apuntes de la unidad',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Apuntes', extensions: [...SUPPORTED_DOC_EXTENSIONS] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx'] },
        { name: 'PowerPoint', extensions: ['pptx'] },
        { name: 'Texto', extensions: ['txt', 'md'] }
      ]
    })
    if (elegido.canceled) return []
    return elegido.filePaths
  })

  handle<[string], ExtractedDoc>(IPC.docExtract, (path) => {
    if (typeof path !== 'string' || path.length === 0) throw new AppError('No se recibió ningún archivo.')
    return extractDocument(path)
  })

  /* ------------------------- exportar e importar mazos ---------------------- */

  /**
   * Escribe una materia entera a un archivo que se puede vender o regalar.
   *
   * Devuelve la ruta donde quedó, o `null` si el usuario cerró el diálogo. El
   * contenido lo arma `exportarMateria`, que deja afuera el progreso de estudio a
   * propósito: ver la cabecera de `mazoArchivo.ts`.
   */
  handle<[string], string | null>(IPC.mazoExport, async (materiaId) => {
    if (typeof materiaId !== 'string' || materiaId.length === 0) throw new AppError('No se recibió ninguna materia.')
    const mazo = exportarMateria(materiaId)

    const elegido = await dialog.showSaveDialog(ventana(), {
      title: 'Guardar el mazo',
      defaultPath: nombreDeArchivo(mazo.materia),
      filters: [{ name: `Mazo de ${app.getName()}`, extensions: ['json'] }]
    })
    if (elegido.canceled || !elegido.filePath) return null

    /* Con dos espacios de sangría: el archivo es legible a propósito, así que se
       escribe para que se pueda abrir y leer, no para ocupar poco. */
    writeFileSync(elegido.filePath, JSON.stringify(mazo, null, 2), 'utf8')
    return elegido.filePath
  })

  /*
   * Los dos diálogos nativos del importador pasan por acá, y no directo a
   * `dialog`, por una sola razón: poder probar el recorrido entero en el .exe que
   * se entrega. Un diálogo nativo no se puede tocar desde el arnés.
   *
   * Con MEDIFLASHY_QA_IMPORTAR (una ruta) no se abre el selector de archivos, y
   * con MEDIFLASHY_QA_RESPUESTAS ("Enfermería (Tecnicatura)|Agregar a la que
   * tengo") cada pregunta se contesta con el botón de ese nombre, en orden. Sin
   * esas variables, que sólo pone `qa/entrega.mjs`, todo es el diálogo de siempre.
   * Si la respuesta no coincide con ningún botón, falla fuerte: una prueba que
   * contesta a ciegas no prueba nada.
   */
  const respuestasDeQa = (process.env.MEDIFLASHY_QA_RESPUESTAS ?? '').split('|').filter((s) => s.length > 0)

  async function elegirArchivoDeMazo(): Promise<string | null> {
    if (process.env.MEDIFLASHY_QA_IMPORTAR) return process.env.MEDIFLASHY_QA_IMPORTAR
    const elegido = await dialog.showOpenDialog(ventana(), {
      title: 'Elegí el mazo que querés importar',
      properties: ['openFile'],
      filters: [{ name: `Mazo de ${app.getName()}`, extensions: ['json'] }]
    })
    if (elegido.canceled || elegido.filePaths.length === 0) return null
    return elegido.filePaths[0]
  }

  function preguntar(o: { message: string; detail: string; buttons: string[]; defaultId: number; cancelId: number }): number {
    if (process.env.MEDIFLASHY_QA_IMPORTAR) {
      const quiero = respuestasDeQa.shift()
      const i = quiero === undefined ? -1 : o.buttons.indexOf(quiero)
      if (i < 0) throw new AppError(`[QA] No hay respuesta para "${o.message}" entre ${JSON.stringify(o.buttons)}.`)
      return i
    }
    return dialog.showMessageBoxSync(ventana(), { type: 'question', title: app.getName(), noLink: true, ...o })
  }

  /**
   * Lee un archivo de mazo y lo mete en la biblioteca.
   *
   * El orden importa y es deliberado:
   *
   *  1. Se lee el archivo y se valida ENTERO antes de tocar nada. Un archivo
   *     hostil o cortado a la mitad no puede dejar media materia creada.
   *  2. Recién si es válido y hay choque de nombre, se le pregunta al usuario.
   *  3. Recién con su respuesta se escribe.
   */
  handle<[], ResumenImportacion | null>(IPC.mazoImport, async () => {
    const ruta = await elegirArchivoDeMazo()
    if (ruta === null) return null

    /* El tamaño se mira ANTES de leer: un archivo de dos gigas no se carga en
       memoria para después descubrir que era demasiado grande. */
    let tam = 0
    try {
      tam = statSync(ruta).size
    } catch {
      throw new AppError('No se pudo abrir ese archivo.')
    }
    if (tam > MAX_BYTES_ARCHIVO) {
      throw new AppError(`Ese archivo pesa ${formatBytes(tam)} y es demasiado grande para ser un mazo.`)
    }

    let crudo = ''
    try {
      crudo = readFileSync(ruta, 'utf8')
    } catch {
      throw new AppError('No se pudo leer ese archivo. Fijate que no esté abierto en otro programa.')
    }

    const mazo = parsear(crudo)

    /* El choque de nombre lo resuelve el usuario, no la app: fusionar es lo que
       quiere quien compró una ampliación de una materia que ya tiene, y separar es
       lo que quiere quien compró un mazo distinto que casualmente se llama igual. */
    const total = mazo.unidades.reduce((n, u) => n + u.tarjetas.length, 0)
    const cuanto = `${total} tarjeta(s) en ${mazo.unidades.length} unidad(es)`

    /* A qué carrera va. Con una carrera elegida arriba, a ésa: el usuario ya dijo
       qué está estudiando. Viendo TODAS, se le pregunta: antes iba a la primera de
       la lista, y un estudiante de Enfermería que importaba el mazo que compró lo
       veía aparecer en Medicina. Se propone la que declara el archivo, si existe. */
    const activa = config.get().carreraActivaId
    const lista = deck.listCarreras()
    let carreraDestino: string
    if (activa && deck.getCarrera(activa)) {
      carreraDestino = activa
    } else if (lista.length === 0) {
      carreraDestino = deck.createCarrera(mazo.carrera ?? mazo.materia).id
    } else if (lista.length === 1) {
      carreraDestino = lista[0].id
    } else {
      const sugerida = lista.findIndex((c) => c.nombre.toLocaleLowerCase('es') === mazo.carrera?.toLocaleLowerCase('es'))
      const r = preguntar({
        message: `¿En qué carrera querés agregar "${mazo.materia}"?`,
        detail: `El mazo trae ${cuanto}. Estás viendo todas las carreras, así que elegí en cuál va.`,
        buttons: [...lista.map((c) => c.nombre), 'Cancelar'],
        defaultId: sugerida >= 0 ? sugerida : 0,
        cancelId: lista.length
      })
      if (r === lista.length) return null
      carreraDestino = lista[r].id
    }

    const yaExiste = materiaConEseNombre(mazo.materia, carreraDestino)
    let destino: string | null = null
    if (yaExiste !== null) {
      const r = preguntar({
        message: `Ya tenés una materia que se llama "${mazo.materia}".`,
        detail:
          `El mazo trae ${cuanto}. ` +
          'Podés agregarlas a la materia que ya tenés, o dejarlas en una materia aparte. ' +
          'Las tarjetas que ya tengas no se duplican en ninguno de los dos casos.',
        buttons: ['Cancelar', 'Crear una materia aparte', 'Agregar a la que tengo'],
        defaultId: 2,
        cancelId: 0
      })
      if (r === 0) return null
      destino = r === 2 ? yaExiste : null
    }

    const resumen = importar(mazo, destino, carreraDestino)
    libraryChanged()
    return resumen
  })

  /* -------------------------------- generación ------------------------------- */

  handle<[string, GenOptions, string], GenResult>(IPC.genStart, async (texto, options, miniPrompt) => {
    if (generacion) throw new AppError('Ya hay una generación en curso.')
    const engine = engineCheck()
    if (!engine.ready) throw new AppError(engine.error ?? 'El motor de generación no está disponible.')

    const level = esGenLevel(options?.level) ? options.level : 'rapido'
    // El texto puede venir pegado a mano o de un archivo; en los dos casos pasa por
    // el mismo saneo mínimo, que además valida que haya suficiente material.
    const doc = fromPastedText(typeof texto === 'string' ? texto : '')

    const opciones: GenOptions = {
      level,
      language: options?.language === 'en' ? 'en' : 'es',
      tipo: options?.tipo === 'concepto' || options?.tipo === 'pregunta' ? options.tipo : 'mixto',
      densidad: options?.densidad === 'baja' || options?.densidad === 'alta' ? options.densidad : 'normal'
    }

    generacion = new AbortController()
    const signal = generacion.signal
    const progreso = (p: GenProgress): void => send(IPC.evtGenProgress, p)

    try {
      progreso({ phase: 'preparing', percent: 0, message: 'Preparando…' })

      /**
       * Mientras baja el modelo, esta generación TAMBIÉN es la descarga en curso.
       *
       * Al comprador que no tiene la otra app instalada, la primera descarga de
       * 1,3 GB le nace acá adentro y no desde la pantalla de modelos. Sin esta
       * línea, `descargaModelo` queda en null durante esos veinte minutos y pasan
       * dos cosas malas: el botón "Cancelar la descarga" de la pantalla de modelos
       * no aborta nada, y el guard de `modelDownload` deja arrancar un segundo
       * escritor sobre el mismo archivo a medias.
       *
       * Se le asigna el MISMO controlador: cancelar la descarga cancela la
       * generación, que es lo correcto —sin modelo no hay nada que generar— y es
       * lo que el usuario está pidiendo cuando aprieta ese botón.
       */
      descargaModelo = generacion
      let modelo: string
      try {
        modelo = await ensureGenModel({
          level,
          signal,
          onProgress: (p: ModelProgress) => send(IPC.evtModelProgress, p)
        })
      } finally {
        descargaModelo = null
      }

      progreso({ phase: 'model', percent: 5, message: 'Cargando el modelo…' })
      await startServer(modelo, signal)

      return await generate({
        texto: doc.texto,
        options: opciones,
        miniPrompt: typeof miniPrompt === 'string' ? miniPrompt : '',
        signal,
        onProgress: progreso,
        // Semilla distinta en cada corrida: apretar "generar más" sobre el mismo
        // apunte tiene que traer tarjetas nuevas, no las mismas otra vez.
        seed: randomInt(1, 2 ** 30)
      })
    } finally {
      generacion = null
      // El modelo ocupa entre 1,7 y 3,3 GB de RAM. Dejarlo cargado "por si genera
      // de nuevo" le come media máquina a alguien que quizá no vuelva a generar en
      // toda la sesión. Recargarlo cuesta entre 8 y 25 segundos y sólo lo paga
      // quien efectivamente genera otra vez.
      stopServer()
      progreso({ phase: 'done', percent: 100 })
    }
  })

  handle<[], boolean>(IPC.genCancel, () => {
    generacion?.abort()
    return true
  })

  /* --------------------------------- estudio --------------------------------- */

  handle<[StudyScope], SessionState>(IPC.studyStart, (scope) =>
    sesion.start({
      materiaId: esId(scope?.materiaId) ? scope.materiaId : null,
      unidadId: esId(scope?.unidadId) ? scope.unidadId : null,
      cardIds: Array.isArray(scope?.cardIds) ? scope.cardIds.filter(esId).slice(0, 5000) : null,
      // `=== true` y no un cast: lo que llega del renderer no se cree. Cualquier
      // otra cosa cae en la sesión normal, que es el lado seguro — como mucho el
      // usuario ve "no hay nada para repasar", nunca un calendario alterado.
      libre: scope?.libre === true
    })
  )

  handle<[unknown], SessionState>(IPC.studyGrade, (g) => {
    if (g !== 'no' && g !== 'masomenos' && g !== 'si') throw new AppError('Calificación inválida.')
    const estado = sesion.grade(g)
    libraryChanged()
    return estado
  })

  handle<[], SessionSummary>(IPC.studyEnd, () => sesion.end())

  /* -------------------------------- progreso --------------------------------- */

  /* El progreso es de la carrera activa. Sin eso, quien cursa una sola carrera
     leeria un porcentaje calculado sobre el mazo de las ocho, que no significa
     nada, y recibiria sugerencias de estudiar materias que no cursa. */
  handle<[string | null], Progreso>(IPC.progressGet, (carreraId) =>
    progreso(typeof carreraId === 'string' && carreraId.length > 0 ? carreraId : null)
  )

  /* --------------------------------- modelos --------------------------------- */

  handle<[GenLevel], GenModelStatus>(IPC.modelStatus, (level) => {
    if (!esGenLevel(level)) throw new AppError('Ese nivel no existe.')
    return genModelStatus(level)
  })

  handle<[GenLevel, boolean?], boolean>(IPC.modelDownload, async (level, propio) => {
    if (!esGenLevel(level)) throw new AppError('Ese nivel no existe.')
    /* Este guard es lo único que separa al usuario de dos escritores sobre el mismo
       archivo `.part`. En Windows los dos handles conviven, se intercalan los bytes,
       y el primero que termina encuentra un tamaño o un sha que no da, borra los
       2,7 GB y se lleva puesta la otra descarga. Cubre también la descarga que nace
       adentro de una generación, porque `genStart` se anota acá mientras baja. */
    if (descargaModelo) {
      throw new AppError('Ya hay una descarga de modelo en curso. Esperá a que termine o cancelala antes de empezar otra.')
    }

    descargaModelo = new AbortController()
    try {
      await ensureGenModel({
        level,
        propio: propio === true,
        signal: descargaModelo.signal,
        onProgress: (p: ModelProgress) => send(IPC.evtModelProgress, p)
      })
      return true
    } finally {
      descargaModelo = null
    }
  })

  handle<[], boolean>(IPC.modelCancelDownload, () => {
    descargaModelo?.abort()
    return true
  })

  handle<[], InstalledModel[]>(IPC.modelList, () =>
    GEN_LEVELS.map((level) => {
      const spec = GEN_MODELS[level]
      const encontrado = resolveInstalledModel(level)
      const status = genModelStatus(level)
      return {
        level,
        label: spec.label,
        sizeBytes: spec.sizeBytes,
        installed: encontrado !== null,
        borrowed: status.borrowed,
        partialBytes: genPartialBytes(level)
      }
    })
  )

  handle<[GenLevel], boolean>(IPC.modelDelete, async (level) => {
    if (!esGenLevel(level)) throw new AppError('Ese nivel no existe.')
    const spec = GEN_MODELS[level]

    /* Un modelo prestado no se borra desde acá: el archivo es de otro programa
       y borrarle archivos a otra app es un destrozo. Pero el mensaje ya no puede
       ser un callejón sin salida: hay un botón al lado para bajar la copia propia,
       y esa copia sí se borra normalmente. */
    if (genModelStatus(level).borrowed) {
      throw new AppError(
        `Este ${spec.label} no es de ${app.getName()}: es el archivo de la otra app que tenés instalada, y ${app.getName()} no borra archivos ajenos. ` +
          `Si querés que ${app.getName()} tenga el suyo propio, usá "Bajar mi copia" y después vas a poder borrarlo desde acá.`
      )
    }

    const elegido = dialog.showMessageBoxSync(ventana(), {
      type: 'question',
      title: 'Mediflashy',
      message: `¿Borrar el modelo ${spec.label}?`,
      detail: `Se liberan ${formatBytes(spec.sizeBytes)}. Tus tarjetas no se tocan. Si volvés a generar con este nivel, se descarga de nuevo.`,
      buttons: ['Cancelar', 'Borrar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (elegido !== 1) return false

    deleteGenModel(level)
    return true
  })

  handle<[], boolean>(IPC.modelReveal, async () => {
    const dir = modelsDir()
    permitirAbrir(dir)
    const err = await shell.openPath(dir)
    if (err) throw new AppError('No se pudo abrir la carpeta de modelos.')
    return true
  })

  logger.info('ipc', 'Canales registrados.')
}

/** La ventana principal, para colgarle los diálogos modales. */
function ventana(): BrowserWindow {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (!win) throw new AppError('No hay ninguna ventana abierta.')
  return win
}

/** Se exporta para el panel de progreso de una unidad puntual. */
export { dominioDe }
