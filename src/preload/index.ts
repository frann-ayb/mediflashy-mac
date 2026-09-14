import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { FlashcardsApi, Unsubscribe } from '@shared/api'
import type { Carrera,
  ResumenImportacion,
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
  Progreso,
  Result,
  Ritmo,
  SaveResult,
  SearchQuery,
  SearchResult,
  SessionState,
  SessionSummary,
  StudyScope,
  Unidad,
  UnidadResumen
} from '@shared/types'
import { IPC } from '@shared/types'

/**
 * Único puente entre la interfaz y el sistema. La UI no tiene acceso a Node ni a
 * Electron: sólo a estas funciones.
 *
 * Nada de lo que pasa por acá se guarda ni se cachea. En particular el
 * `miniPrompt` de `generate()`: entra por parámetro, cruza a `ipc.ts` y muere ahí.
 */

function subscribe<T>(channel: string, listener: (payload: T) => void): Unsubscribe {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

const api: FlashcardsApi = {
  getAppInfo: (): Promise<Result<AppInfo>> => ipcRenderer.invoke(IPC.appInfo),
  getConfig: (): Promise<Result<AppConfig>> => ipcRenderer.invoke(IPC.configGet),
  setConfig: (patch: Partial<AppConfig>): Promise<Result<AppConfig>> => ipcRenderer.invoke(IPC.configSet, patch),
  openPath: (target: string): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.openPath, target),
  openLogFile: (): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.openLogFile),
  openDataFolder: (): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.openDataFolder),
  memoria: (): Promise<Result<EstadoMemoria>> => ipcRenderer.invoke(IPC.memoria),
  log: (level: 'info' | 'warn' | 'error', message: string): void => {
    ipcRenderer.send(IPC.logFromRenderer, level, message)
  },

  /* -------------------------------- carreras ------------------------------- */

  listCarreras: (): Promise<Result<Carrera[]>> => ipcRenderer.invoke(IPC.carreraList),
  createCarrera: (nombre: string): Promise<Result<Carrera>> => ipcRenderer.invoke(IPC.carreraCreate, nombre),
  renameCarrera: (id: string, nombre: string): Promise<Result<Carrera>> => ipcRenderer.invoke(IPC.carreraRename, id, nombre),
  setRitmo: (carreraId: string, ritmo: Ritmo): Promise<Result<Carrera>> => ipcRenderer.invoke(IPC.carreraSetRitmo, carreraId, ritmo),
  reorderCarreras: (ids: string[]): Promise<Result<Carrera[]>> => ipcRenderer.invoke(IPC.carreraReorder, ids),
  deleteCarrera: (id: string): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.carreraDelete, id),

  /* -------------------------------- materias ------------------------------- */

  listMaterias: (carreraId?: string | null): Promise<Result<Materia[]>> =>
    ipcRenderer.invoke(IPC.materiaList, carreraId ?? null),
  createMateria: (carreraId: string, nombre: string): Promise<Result<Materia>> =>
    ipcRenderer.invoke(IPC.materiaCreate, carreraId, nombre),
  renameMateria: (id: string, nombre: string): Promise<Result<Materia>> => ipcRenderer.invoke(IPC.materiaRename, id, nombre),
  moveMateria: (id: string, carreraId: string): Promise<Result<Materia>> => ipcRenderer.invoke(IPC.materiaMove, id, carreraId),
  reorderMaterias: (carreraId: string, ids: string[]): Promise<Result<Materia[]>> =>
    ipcRenderer.invoke(IPC.materiaReorder, carreraId, ids),
  deleteMateria: (id: string): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.materiaDelete, id),

  /* -------------------------------- unidades ------------------------------- */

  listUnidades: (materiaId: string): Promise<Result<UnidadResumen[]>> => ipcRenderer.invoke(IPC.unidadList, materiaId),
  createUnidad: (materiaId: string, nombre: string): Promise<Result<Unidad>> => ipcRenderer.invoke(IPC.unidadCreate, materiaId, nombre),
  renameUnidad: (id: string, nombre: string): Promise<Result<Unidad>> => ipcRenderer.invoke(IPC.unidadRename, id, nombre),
  moveUnidad: (id: string, materiaId: string): Promise<Result<Unidad>> => ipcRenderer.invoke(IPC.unidadMove, id, materiaId),
  reorderUnidades: (materiaId: string, ids: string[]): Promise<Result<Unidad[]>> =>
    ipcRenderer.invoke(IPC.unidadReorder, materiaId, ids),
  deleteUnidad: (id: string): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.unidadDelete, id),

  /* -------------------------------- tarjetas ------------------------------- */

  listCards: (unidadId: string): Promise<Result<Flashcard[]>> => ipcRenderer.invoke(IPC.cardList, unidadId),
  createCard: (unidadId: string, frente: string, dorso: string): Promise<Result<Flashcard>> =>
    ipcRenderer.invoke(IPC.cardCreate, unidadId, frente, dorso),
  updateCard: (unidadId: string, cardId: string, frente: string, dorso: string): Promise<Result<Flashcard>> =>
    ipcRenderer.invoke(IPC.cardUpdate, unidadId, cardId, frente, dorso),
  moveCard: (fromUnidadId: string, cardId: string, toUnidadId: string): Promise<Result<boolean>> =>
    ipcRenderer.invoke(IPC.cardMove, fromUnidadId, cardId, toUnidadId),
  deleteCard: (unidadId: string, cardId: string): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.cardDelete, unidadId, cardId),
  resetProgress: (unidadId: string, cardId: string): Promise<Result<Flashcard>> =>
    ipcRenderer.invoke(IPC.cardResetProgress, unidadId, cardId),
  saveCards: (unidadId: string, cards: GeneratedCard[]): Promise<Result<SaveResult>> =>
    ipcRenderer.invoke(IPC.cardSaveMany, unidadId, cards),

  /* -------------------------------- búsqueda ------------------------------- */

  search: (query: SearchQuery): Promise<Result<SearchResult>> => ipcRenderer.invoke(IPC.search, query),

  /* -------------------------------- ingesta -------------------------------- */

  pickDocument: (): Promise<Result<ExtractedDoc | null>> => ipcRenderer.invoke(IPC.docPick),

  // Desde Electron 32 `File.path` no existe más: la ruta se obtiene con webUtils.
  getPathForFile: (file: unknown): string => {
    try {
      return webUtils.getPathForFile(file as File)
    } catch {
      return ''
    }
  },

  extractDocument: (path: string): Promise<Result<ExtractedDoc>> => ipcRenderer.invoke(IPC.docExtract, path),
  pickDocuments: (): Promise<Result<string[]>> => ipcRenderer.invoke(IPC.docPickMany),
  exportMateria: (materiaId: string): Promise<Result<string | null>> => ipcRenderer.invoke(IPC.mazoExport, materiaId),
  importMazo: (): Promise<Result<ResumenImportacion | null>> => ipcRenderer.invoke(IPC.mazoImport),

  /* ------------------------------- generación ------------------------------ */

  generate: (texto: string, options: GenOptions, miniPrompt: string): Promise<Result<GenResult>> =>
    ipcRenderer.invoke(IPC.genStart, texto, options, miniPrompt),
  cancelGeneration: (): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.genCancel),

  /* -------------------------------- estudio -------------------------------- */

  startSession: (scope: StudyScope): Promise<Result<SessionState>> => ipcRenderer.invoke(IPC.studyStart, scope),
  gradeCard: (grade: 'no' | 'masomenos' | 'si'): Promise<Result<SessionState>> => ipcRenderer.invoke(IPC.studyGrade, grade),
  endSession: (): Promise<Result<SessionSummary>> => ipcRenderer.invoke(IPC.studyEnd),

  /* -------------------------------- progreso ------------------------------- */

  getProgress: (carreraId?: string | null): Promise<Result<Progreso>> => ipcRenderer.invoke(IPC.progressGet, carreraId ?? null),

  /* -------------------------------- modelos -------------------------------- */

  getModelStatus: (level: GenLevel): Promise<Result<GenModelStatus>> => ipcRenderer.invoke(IPC.modelStatus, level),
  downloadModel: (level: GenLevel, propio?: boolean): Promise<Result<boolean>> =>
    ipcRenderer.invoke(IPC.modelDownload, level, propio === true),
  cancelModelDownload: (): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.modelCancelDownload),
  listModels: (): Promise<Result<InstalledModel[]>> => ipcRenderer.invoke(IPC.modelList),
  deleteModel: (level: GenLevel): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.modelDelete, level),
  revealModelsFolder: (): Promise<Result<boolean>> => ipcRenderer.invoke(IPC.modelReveal),

  /* -------------------------------- eventos -------------------------------- */

  onGenProgress: (listener: (progress: GenProgress) => void): Unsubscribe => subscribe(IPC.evtGenProgress, listener),
  onModelProgress: (listener: (progress: ModelProgress) => void): Unsubscribe => subscribe(IPC.evtModelProgress, listener),
  onLibraryChanged: (listener: () => void): Unsubscribe => subscribe(IPC.evtLibraryChanged, listener)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('flashcards', api)
  } catch (err) {
    // Si esto falla, la UI muestra su pantalla de error en lugar de una ventana en blanco.
    console.error('No se pudo exponer la API del preload:', err)
  }
} else {
  // Ruta no usada (contextIsolation siempre está activo); queda como respaldo.
  ;(globalThis as unknown as { flashcards: FlashcardsApi }).flashcards = api
}
