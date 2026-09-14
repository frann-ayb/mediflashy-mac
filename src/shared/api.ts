import type {
  AppConfig,
  AppInfo,
  Carrera,
  EstadoMemoria,
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
  ResumenImportacion,
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
} from './types'

export type Unsubscribe = () => void

/**
 * Superficie completa que el preload expone a la interfaz. Se declara acá (sin
 * importar nada de Electron) para que la UI se compile sin conocer Electron.
 */
export interface FlashcardsApi {
  getAppInfo: () => Promise<Result<AppInfo>>
  getConfig: () => Promise<Result<AppConfig>>
  setConfig: (patch: Partial<AppConfig>) => Promise<Result<AppConfig>>
  openPath: (target: string) => Promise<Result<boolean>>
  openLogFile: () => Promise<Result<boolean>>
  /** Abre en el explorador la carpeta con las materias, las tarjetas y el historial. */
  openDataFolder: () => Promise<Result<boolean>>
  /** Cuánta memoria libre hay. Para el indicador de la barra de arriba. */
  memoria: () => Promise<Result<EstadoMemoria>>
  log: (level: 'info' | 'warn' | 'error', message: string) => void

  /* -------------------------------- carreras ------------------------------- */

  listCarreras: () => Promise<Result<Carrera[]>>
  createCarrera: (nombre: string) => Promise<Result<Carrera>>
  renameCarrera: (id: string, nombre: string) => Promise<Result<Carrera>>
  /**
   * El ritmo de estudio (cuántas nuevas y cuántos repasos por día) cuelga de la
   * CARRERA, no de la materia. Con la farmacología de ocho carreras son decenas
   * de materias, y un control por materia es una pantalla que nadie toca.
   */
  setRitmo: (carreraId: string, ritmo: Ritmo) => Promise<Result<Carrera>>
  reorderCarreras: (ids: string[]) => Promise<Result<Carrera[]>>
  /** Borra la carrera con TODAS sus materias, unidades y tarjetas. Pide confirmación nativa. */
  deleteCarrera: (id: string) => Promise<Result<boolean>>

  /* -------------------------------- materias ------------------------------- */

  /** Sin `carreraId` devuelve todas. Las pantallas mandan la carrera activa. */
  listMaterias: (carreraId?: string | null) => Promise<Result<Materia[]>>
  createMateria: (carreraId: string, nombre: string) => Promise<Result<Materia>>
  renameMateria: (id: string, nombre: string) => Promise<Result<Materia>>
  /** Mueve la materia entera —con sus unidades y su progreso— a otra carrera. */
  moveMateria: (id: string, carreraId: string) => Promise<Result<Materia>>
  reorderMaterias: (carreraId: string, ids: string[]) => Promise<Result<Materia[]>>
  /** Borra la materia con TODAS sus unidades y tarjetas. Pide confirmación nativa. */
  deleteMateria: (id: string) => Promise<Result<boolean>>

  /* -------------------------------- unidades ------------------------------- */

  /** Las unidades de una materia, con su dominio ya calculado. */
  listUnidades: (materiaId: string) => Promise<Result<UnidadResumen[]>>
  createUnidad: (materiaId: string, nombre: string) => Promise<Result<Unidad>>
  renameUnidad: (id: string, nombre: string) => Promise<Result<Unidad>>
  /** Mueve una unidad entera a otra materia. */
  moveUnidad: (id: string, materiaId: string) => Promise<Result<Unidad>>
  reorderUnidades: (materiaId: string, ids: string[]) => Promise<Result<Unidad[]>>
  /** Borra la unidad con todas sus tarjetas. Pide confirmación nativa. */
  deleteUnidad: (id: string) => Promise<Result<boolean>>

  /* -------------------------------- tarjetas ------------------------------- */

  listCards: (unidadId: string) => Promise<Result<Flashcard[]>>
  createCard: (unidadId: string, frente: string, dorso: string) => Promise<Result<Flashcard>>
  /**
   * Edita el texto de una tarjeta. NO toca su progreso de repaso: la app no puede
   * distinguir "corregí una coma" de "cambié la pregunta entera", y adivinar mal
   * en cualquiera de las dos direcciones molesta. Para eso está `resetProgress`.
   */
  updateCard: (unidadId: string, cardId: string, frente: string, dorso: string) => Promise<Result<Flashcard>>
  moveCard: (fromUnidadId: string, cardId: string, toUnidadId: string) => Promise<Result<boolean>>
  deleteCard: (unidadId: string, cardId: string) => Promise<Result<boolean>>
  /** Vuelve la tarjeta a "nueva". Es una acción explícita del usuario. */
  resetProgress: (unidadId: string, cardId: string) => Promise<Result<Flashcard>>
  /**
   * Guarda de una vez las tarjetas revisadas de una generación.
   *
   * Descarta las que ya estén en la unidad, así generar dos veces del mismo apunte
   * no deja el mazo lleno de pares idénticos. Devuelve cuántas entraron y cuántas
   * se descartaron por repetidas.
   */
  saveCards: (unidadId: string, cards: GeneratedCard[]) => Promise<Result<SaveResult>>

  /* -------------------------------- búsqueda ------------------------------- */

  search: (query: SearchQuery) => Promise<Result<SearchResult>>

  /* -------------------------------- ingesta -------------------------------- */

  /** Abre el diálogo de archivos y extrae el texto del que se elija. */
  pickDocument: () => Promise<Result<ExtractedDoc | null>>
  /**
   * Ruta real de un archivo arrastrado a la ventana. Recibe un `File` del DOM;
   * se declara `unknown` para no atar este tipo compartido a las librerías DOM.
   */
  getPathForFile: (file: unknown) => string
  extractDocument: (path: string) => Promise<Result<ExtractedDoc>>
  /**
   * Elegir VARIOS apuntes de una. Devuelve las rutas, no el contenido: una
   * unidad entera son quince o veinte archivos y extraerlos todos de golpe
   * dejaría decenas de megas de texto en memoria antes de usar el primero.
   */
  pickDocuments: () => Promise<Result<string[]>>

  /* --------------------------- exportar e importar --------------------------- */

  /**
   * Guarda una materia entera en un archivo, para venderla o regalarla.
   *
   * Devuelve la ruta donde quedó, o `null` si el usuario cerró el diálogo. El
   * archivo NO lleva el progreso de estudio: quien lo importa arranca de cero.
   */
  exportMateria: (materiaId: string) => Promise<Result<string | null>>
  /**
   * Lee un archivo de mazo y lo agrega a la biblioteca.
   *
   * Devuelve `null` si el usuario canceló, en el diálogo de archivos o en la
   * pregunta de qué hacer cuando ya existe una materia con ese nombre.
   */
  importMazo: () => Promise<Result<ResumenImportacion | null>>

  /* ------------------------------- generación ------------------------------ */

  /**
   * Genera tarjetas a partir de un texto.
   *
   * `miniPrompt` son las preferencias que escribió el usuario. NO SE GUARDA EN
   * NINGÚN LADO: llega por este parámetro, se usa en la pasada, y muere con ella.
   * No va a disco, no va a la config, no va al log.
   *
   * El progreso llega por `onGenProgress`.
   */
  generate: (texto: string, options: GenOptions, miniPrompt: string) => Promise<Result<GenResult>>
  cancelGeneration: () => Promise<Result<boolean>>

  /* -------------------------------- estudio -------------------------------- */

  startSession: (scope: StudyScope) => Promise<Result<SessionState>>
  /** Califica la tarjeta actual y devuelve el nuevo estado de la sesión. */
  gradeCard: (grade: 'no' | 'masomenos' | 'si') => Promise<Result<SessionState>>
  endSession: () => Promise<Result<SessionSummary>>

  /* -------------------------------- progreso ------------------------------- */

  /** El progreso de una carrera. `null` = todas. */
  getProgress: (carreraId?: string | null) => Promise<Result<Progreso>>

  /* -------------------------------- modelos -------------------------------- */

  getModelStatus: (level: GenLevel) => Promise<Result<GenModelStatus>>
  /**
   * Descarga el modelo. Con `propio` en true baja una copia propia aunque ya
   * exista una prestada de otra app, para que Flashcards deje de depender de una
   * carpeta que no controla.
   */
  downloadModel: (level: GenLevel, propio?: boolean) => Promise<Result<boolean>>
  cancelModelDownload: () => Promise<Result<boolean>>
  listModels: () => Promise<Result<InstalledModel[]>>
  /** Borra un modelo para liberar espacio. Pide confirmación nativa. */
  deleteModel: (level: GenLevel) => Promise<Result<boolean>>
  revealModelsFolder: () => Promise<Result<boolean>>

  /* -------------------------------- eventos -------------------------------- */

  onGenProgress: (listener: (progress: GenProgress) => void) => Unsubscribe
  onModelProgress: (listener: (progress: ModelProgress) => void) => Unsubscribe
  /** Algo cambió en la biblioteca (se guardó, se borró, se movió): refrescar. */
  onLibraryChanged: (listener: () => void) => Unsubscribe
}
