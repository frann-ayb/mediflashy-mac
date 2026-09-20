/**
 * Contrato compartido entre el proceso principal (Electron), el preload y la UI.
 * Cualquier cambio acá se refleja en los tres lados y lo valida `npm run typecheck`.
 */

export type Language = 'es' | 'en'
export const LANGUAGES: Language[] = ['es', 'en']

/**
 * Claro, oscuro, o lo que diga el sistema operativo.
 *
 * `sistema` es el valor por defecto y no es una comodidad: quien estudia de
 * noche ya tiene Windows en oscuro, y quien estudia en una biblioteca a las
 * once de la mañana lo tiene en claro. Arrancar siguiendo esa decisión acierta
 * casi siempre sin preguntar nada.
 */
export type Tema = 'claro' | 'oscuro' | 'sistema'
export const TEMAS: Tema[] = ['claro', 'oscuro', 'sistema']

/* --------------------- lo que la app trae de fábrica --------------------- */

/**
 * Los tres números de los mazos de regalo.
 *
 * Viven ACÁ y no en `mazosDeRegalo.ts` porque los usan los dos procesos: el
 * principal para sembrar y la interfaz para mostrarlos en «Sobre esta versión».
 * El renderer no puede importar nada de `main/`, así que tenerlos allá obligaba
 * a escribirlos de nuevo a mano en la pantalla — y un número repetido a mano es
 * un número que en el próximo cambio queda distinto.
 *
 * `qa/siembra.ts` comprueba que coincidan con lo que efectivamente se siembra en
 * disco, y que la página de venta publique TARJETAS_DISTINTAS_DE_REGALO.
 */
export const TARJETAS_DE_REGALO = 3669
/**
 * Las tarjetas DISTINTAS, que es la cifra que se le muestra al usuario y la que
 * publica la landing. No es la misma que TARJETAS_DE_REGALO porque las tres
 * Enfermerías (Tecnicatura, Universitaria y Licenciatura) traen el mismo mazo de
 * 390 copiado tres veces: 2.173 cargadas son 1.393 distintas. Mostrar el total
 * cargado es prometer contenido que no existe.
 */
export const TARJETAS_DISTINTAS_DE_REGALO = 2889
export const MATERIAS_DE_REGALO = 14
export const UNIDADES_DE_REGALO = 243
/** Carreras que trae el mazo de Farmacología. */
export const CARRERAS_DE_REGALO = 4

/** Calidad del modelo que genera las tarjetas. */
export type GenLevel = 'rapido' | 'detallado'
export const GEN_LEVELS: GenLevel[] = ['rapido', 'detallado']

/**
 * De qué clase es una tarjeta.
 *
 * NO es una preferencia de estilo: es la unidad de medida de la calidad del mazo.
 * Un mazo de farmacología se degrada siempre de la misma manera —se llena de
 * "átomos", que son la ficha técnica del fármaco partida en pedacitos, porque son
 * los más baratos de escribir y los que un modelo genera solo a mansalva— y ése
 * es exactamente el mazo que ya existe gratis en inglés y con más volumen.
 *
 * Los tipos que diferencian son los caros de generar por accidente y baratos de
 * generar a propósito: la INVERSA (del rasgo al fármaco, que es la dirección en
 * que pregunta el examen y nadie estudia), el CONTRASTE (el par confundible, que
 * es de dónde salen los distractores del multiple choice), el DESCARTE (cuatro
 * candidatos y una condición, la forma literal del Examen Único) y la TRADUCCIÓN
 * ARGENTINA (el paciente no dice ibuprofeno, dice Actron).
 *
 * El campo por sí solo no hace nada. Lo que sirve es `qa/mezcla.ts`, que corta el
 * build si una unidad se sale de la mezcla: con 407 unidades escritas por muchas
 * manos a lo largo de meses, la disciplina humana no escala y la unidad 300
 * termina siendo una lista de fichas técnicas si nada lo impide.
 */
export type TipoTarjeta =
  | 'atomo'
  | 'inversa'
  | 'contraste'
  | 'conducta'
  | 'cadena'
  | 'descarte'
  | 'calculo'
  | 'bandera'
  | 'traduccion'
  | 'prescripcion'
  | 'anclaje'
  | 'familia'
  | 'trampa'

export const TIPOS_TARJETA: TipoTarjeta[] = [
  'atomo',
  'inversa',
  'contraste',
  'conducta',
  'cadena',
  'descarte',
  'calculo',
  'bandera',
  'traduccion',
  'prescripcion',
  'anclaje',
  'familia',
  'trampa'
]

/** Cómo se llama cada tipo en la interfaz. */
export const TIPO_LABEL: Record<TipoTarjeta, string> = {
  atomo: 'Dato',
  inversa: 'Del síntoma al fármaco',
  contraste: 'Diferencia',
  conducta: 'Qué mirar',
  cadena: 'Por qué',
  descarte: 'Cuál elegir',
  calculo: 'Cálculo',
  bandera: 'Bandera roja',
  traduccion: 'Marca comercial',
  prescripcion: 'Prescripción',
  anclaje: 'Definición',
  familia: 'Regla de familia',
  trampa: 'Trampa'
}

/** Qué forma tienen las tarjetas que se le piden al modelo. */
export type CardType = 'concepto' | 'pregunta' | 'mixto'
export const CARD_TYPES: CardType[] = ['concepto', 'pregunta', 'mixto']

/** Cuántas tarjetas sacar por bloque de texto. */
export type Densidad = 'baja' | 'normal' | 'alta'
export const DENSIDADES: Densidad[] = ['baja', 'normal', 'alta']

/** Extensiones de apunte que la app sabe leer. */
export const SUPPORTED_DOC_EXTENSIONS = ['pdf', 'docx', 'pptx', 'txt', 'md'] as const

/* ------------------------------- jerarquía ------------------------------- */

/**
 * Carrera → Materia → Unidad → Flashcard, estricta. Una tarjeta pertenece a UNA
 * unidad, una unidad a UNA materia y una materia a UNA carrera.
 *
 * La tarjeta NO guarda `materiaId` ni `carreraId`: se derivan subiendo por la
 * cadena. Esa decisión venía de Psicoflashy y con un nivel más se vuelve MÁS
 * importante, no menos: un `carreraId` desnormalizado en la tarjeta se
 * desincronizaría en dos operaciones distintas —mover una unidad de materia y
 * mover una materia de carrera— en vez de una.
 *
 * Que la misma unidad de Farmacología la vean dos carreras se resuelve
 * duplicándola, no compartiéndola. Es a propósito y está explicado en
 * `mazosDeRegalo.ts`: adentro de una unidad no hay recorte posible, y una
 * unidad compartida le comería al estudiante de una carrera el cupo diario con
 * tarjetas que en su final no se toman.
 */

/**
 * Con cuánta intensidad estudia el usuario esta materia.
 *
 * Es un solo control en vez de dos campos numéricos a propósito: "20 tarjetas
 * nuevas y 200 repasos por día" son dos números que nadie sabe elegir la primera
 * vez, y elegirlos mal arruina la experiencia en las dos direcciones (sin límite,
 * el primer día aparecen 300 tarjetas juntas y el usuario abandona; con un límite
 * muy bajo, nunca termina de aprender el mazo). Tres opciones con nombre, el
 * número exacto en letra chica, y listo.
 */
export type Ritmo = 'tranquilo' | 'normal' | 'intenso'
export const RITMOS: Ritmo[] = ['tranquilo', 'normal', 'intenso']

export interface RitmoSpec {
  ritmo: Ritmo
  label: string
  /** Tarjetas que el usuario ve por primera vez, por día. */
  nuevasPorDia: number
  /**
   * Tope de repasos por día. Va bastante alto porque no es una meta sino una red:
   * existe para que volver después de dos semanas sin abrir la app no muestre 800
   * tarjetas vencidas de golpe.
   */
  repasosPorDia: number
  /** Frase para la UI, en criollo. */
  hint: string
}

export const RITMO_SPECS: Record<Ritmo, RitmoSpec> = {
  tranquilo: {
    ritmo: 'tranquilo',
    label: 'Tranquilo',
    nuevasPorDia: 10,
    repasosPorDia: 100,
    hint: 'Unos 10 minutos por día. Para cursar sin apuro.'
  },
  normal: {
    ritmo: 'normal',
    label: 'Normal',
    nuevasPorDia: 20,
    repasosPorDia: 200,
    hint: 'Unos 20 minutos por día. Es el ritmo recomendado.'
  },
  intenso: {
    ritmo: 'intenso',
    label: 'Intenso',
    nuevasPorDia: 40,
    repasosPorDia: 400,
    hint: 'Unos 40 minutos por día. Para cuando el final está cerca.'
  }
}

/**
 * La carrera que cursa el estudiante. Es el nivel de arriba de todo.
 *
 * NO es una carpeta más del árbol: es un FILTRO sobre la app entera. Cuando hay
 * una carrera activa, las materias de las otras carreras no aparecen en la
 * biblioteca, ni en el buscador, ni en el progreso, ni en el selector de
 * "dónde va" al generar. Un árbol de tres niveles plegables no alcanza: la otra
 * carrera seguiría siendo una fila visible, a un click de abrirse por error, y
 * seguiría apareciendo en todas las demás pantallas.
 *
 * El `ritmo` vive ACÁ y no en la materia, que es donde estaba en Psicoflashy.
 * Con catorce materias, elegir "tranquilo / normal / intenso" una por una era
 * tedioso pero posible. Farmacología de todas las carreras son decenas de
 * materias: configurarlas de a una es una pantalla que nadie va a tocar, y un
 * tope diario que nadie configura es un tope diario mal puesto.
 */
export interface Carrera {
  id: string
  nombre: string
  /** Orden manual en el selector. */
  orden: number
  createdAt: number
  ritmo: Ritmo
}

export interface Materia {
  id: string
  /** A qué carrera pertenece. Una materia pertenece a UNA carrera. */
  carreraId: string
  nombre: string
  /** Orden manual en la lista. */
  orden: number
  createdAt: number
}

export interface Unidad {
  id: string
  materiaId: string
  nombre: string
  /** "Unidad 1, 2, 3" no es alfabético: el orden lo pone el usuario. */
  orden: number
  createdAt: number
}

/**
 * Estado de repaso de una tarjeta, en el vocabulario de FSRS.
 *
 * Se guardan fechas como epoch en ms y no como `Date` porque esto viaja a JSON y
 * vuelve: un `Date` serializado es un string ISO que hay que acordarse de
 * rehidratar en cada lectura, y el día que alguien se olvide, FSRS recibe un
 * string donde espera una fecha y programa el repaso para 1970.
 */
export interface Schedule {
  /** Cuándo toca repasarla, epoch ms. */
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  /** 0 New · 1 Learning · 2 Review · 3 Relearning (el enum `State` de ts-fsrs). */
  state: 0 | 1 | 2 | 3
  /**
   * En qué paso de aprendizaje está (`learning_steps` de ts-fsrs).
   *
   * ESTE CAMPO NO ES OPCIONAL Y NO SE PUEDE OMITIR. Parece un detalle interno de
   * la librería y es estado de verdad: una tarjeta en aprendizaje avanza 1 min →
   * 10 min → se gradúa a intervalos de días, y este número dice en cuál de esos
   * pasos está. Si no se persiste, cada vez que la tarjeta se guarda y se vuelve a
   * leer arranca de nuevo en el paso 0, no se gradúa NUNCA, y el usuario ve la
   * misma tarjeta cada diez minutos para siempre.
   *
   * Lo peor es cómo se ve desde afuera: la app parece andar. Califica, guarda,
   * muestra la siguiente. Sólo al medir los intervalos se descubre que ninguno
   * pasa de los diez minutos.
   */
  learningSteps: number
  lastReview: number | null
}

export interface Flashcard {
  id: string
  /** Lo que el usuario ve primero: el concepto o la pregunta. */
  frente: string
  /** Lo que se revela: la definición o la respuesta. */
  dorso: string
  createdAt: number
  updatedAt: number
  /** Si la escribió el modelo o el usuario. Se muestra al revisar un mazo generado. */
  origen: 'ia' | 'manual'
  /**
   * De qué clase es. Opcional: las tarjetas que escribe el usuario y las que
   * genera la IA a partir de un apunte no lo traen, y está bien — el tipo es una
   * herramienta de control del mazo de fábrica, no algo que se le pida a nadie.
   */
  tipo?: TipoTarjeta
  /**
   * De dónde sale lo que la tarjeta afirma.
   *
   * Es un CAMPO y no un renglón del dorso, y la diferencia importa por tres cosas:
   *
   *  1. Se puede verificar sin adivinar. La primera versión de `qa/dosis.ts`
   *     buscaba la fuente con una expresión regular sobre el dorso y aceptaba la
   *     palabra suelta "guía": escribir "según la guía" satisfacía la regla de
   *     seguridad. Con un campo, la prueba mira el campo.
   *  2. Cuando cambia una guía se puede listar exactamente qué tarjetas la citan.
   *     Este contenido envejece en meses, no en décadas: el Calendario Nacional
   *     de Vacunación se modifica, las guías de RCP se actualizan.
   *  3. Deja de competir por los 400 caracteres del dorso, y de renderizarse con
   *     el mismo peso que la respuesta — que hacía que el estudiante la leyera
   *     como si tuviera que aprendérsela.
   *
   * Obligatoria en toda tarjeta que diga un número de dosis o concentración.
   * `qa/dosis.ts` corta el build si falta.
   */
  fuente?: string
  schedule: Schedule
}

/**
 * Un mazo exportado a un archivo.
 *
 * Viaja el contenido y NADA del progreso de estudio: quien lo importa arranca de
 * cero. Si viajara, el que compra un mazo recibiria tarjetas ya marcadas como
 * aprendidas y la repeticion espaciada le mentiria desde el primer dia.
 *
 * Tampoco viajan los ids: son de la instalacion que exporto y no significan nada
 * en otra.
 */
export interface ArchivoMazo {
  /** Marca fija, para reconocer el archivo antes de leerlo. */
  formato: 'flashcards-mazo'
  version: 1
  materia: string
  /**
   * Para qué carrera se armó el mazo. Opcional e informativo: al importar sin
   * carrera elegida se propone ésta, pero decide el usuario. Los archivos viejos
   * no lo traen y siguen entrando.
   */
  carrera?: string
  /** Epoch ms. Informativo: no se usa para decidir nada. */
  exportadoEn: number
  unidades: Array<{ nombre: string; tarjetas: TarjetaDeArchivo[] }>
}

/**
 * Una tarjeta dentro de un archivo de mazo.
 *
 * `tipo` y `fuente` son opcionales y se agregaron sin subir la versión: un archivo
 * que no los trae es igual de válido. Viajan porque un mazo de Farmacología que se
 * vende sin la fuente de cada dosis pierde justo lo que lo hace confiable, y porque
 * la pantalla de estudio la muestra debajo de la respuesta.
 */
export interface TarjetaDeArchivo {
  frente: string
  dorso: string
  tipo?: TipoTarjeta
  fuente?: string
}

/** Como termino una importacion, para poder contarselo al usuario. */
export interface ResumenImportacion {
  materiaId: string
  materiaNombre: string
  guardadas: number
  repetidas: number
  unidadesNuevas: number
  /** true si se agrego a una materia que ya existia. */
  fusionada: boolean
}

/** Lo que hay adentro de `unidades/<id>.json`. */
export interface UnidadFile {
  version: 1
  id: string
  materiaId: string
  nombre: string
  orden: number
  createdAt: number
  tarjetas: Flashcard[]
}

/* -------------------------------- métricas ------------------------------- */

/**
 * Cuánto sabe el usuario de algo (una unidad, una materia, todo).
 *
 * `porcentaje` se pondera por cantidad de tarjetas cuando agrupa varias unidades,
 * NO es el promedio de sus porcentajes. Con 200 tarjetas al 40 % y 6 al 100 %, el
 * promedio simple diría 70 % y sería mentira.
 */
export interface Dominio {
  total: number
  nuevas: number
  aprendiendo: number
  repasando: number
  aprendidas: number
  /** Vencidas hoy, para el botón de "estudiar". */
  vencidas: number
  /** 0..100. */
  porcentaje: number
}

export interface MateriaResumen {
  materia: Materia
  unidades: number
  dominio: Dominio
  /**
   * Cuánto sabe de lo que YA EMPEZÓ, de 0 a 100. `null` si no empezó nada.
   *
   * Existe para poder decir "ésta es la que tenés más floja" sin mentir. El
   * `dominio.porcentaje` cuenta las tarjetas nuevas como cero —correcto, porque
   * mide cuánto del mazo está en la memoria—, pero eso hace que una materia
   * recién generada dé 0 % y encabece cualquier ranking de flojera. Y no está
   * floja: no está empezada, que es otra cosa y se arregla de otra manera.
   */
  porcentajeEmpezadas: number | null
  /** Cuántas de sus tarjetas ya vio alguna vez. */
  empezadas: number
  /**
   * La unidad más floja de las que ya empezó, para poder señalar el tema y no
   * sólo la materia. `null` si no empezó ninguna.
   */
  unidadFloja: { id: string; nombre: string; porcentaje: number } | null
}

/* ----------------------------- recomendaciones ---------------------------- */

/**
 * Por qué la app sugiere estudiar algo. La frase la arma la pantalla; acá van
 * los datos con los que se arma.
 */
export type MotivoSugerencia = 'vencidas' | 'floja' | 'sin-empezar'

export interface Sugerencia {
  motivo: MotivoSugerencia
  carreraId: string
  materiaId: string
  materiaNombre: string
  /** La unidad concreta, cuando la sugerencia puede apuntar a una. */
  unidadId: string | null
  unidadNombre: string | null
  /** Cuántas tarjetas involucra (vencidas, o sin empezar, según el motivo). */
  cantidad: number
  /** El porcentaje que motivó la sugerencia, para poder mostrarlo. */
  porcentaje: number
}

export interface UnidadResumen {
  unidad: Unidad
  dominio: Dominio
}

/**
 * Panel de progreso: lo global más el detalle por materia.
 *
 * "Global" es global DENTRO DE LA CARRERA ACTIVA. Sin eso, el estudiante de
 * Enfermería que abre Progreso vería el porcentaje de un mazo que incluye la
 * farmacología de Veterinaria, y un "sabés el 12 %" que no significa nada.
 */
export interface Progreso {
  global: Dominio
  materias: MateriaResumen[]
  /**
   * Qué conviene estudiar ahora, lo más urgente primero. Como mucho tres.
   *
   * Va calculado en el proceso principal y no en la pantalla porque necesita las
   * tarjetas de todas las unidades, que la interfaz no tiene y no debería pedir.
   */
  sugerencias: Sugerencia[]
  /** Aciertos sobre repasos hechos en los últimos 30 días. `null` si no hay datos. */
  retencion30d: number | null
  /** Días seguidos con al menos un repaso, contando hasta hoy. */
  racha: number
  /** Repasos hechos hoy. */
  hoy: number
}

/* -------------------------------- búsqueda ------------------------------- */

export type EstadoFiltro = 'todas' | 'nuevas' | 'aprendiendo' | 'repasando' | 'aprendidas' | 'vencidas'
export const ESTADO_FILTROS: EstadoFiltro[] = ['todas', 'nuevas', 'aprendiendo', 'repasando', 'aprendidas', 'vencidas']

export interface SearchQuery {
  /** Se compara sin tildes y sin distinguir mayúsculas. Vacío = todas. */
  texto: string
  /** Acota la búsqueda a una carrera. `null` = buscar en todas. */
  carreraId?: string | null
  materiaId?: string | null
  unidadId?: string | null
  estado?: EstadoFiltro
}

/** Una tarjeta encontrada, con el camino completo para poder mostrarla. */
export interface SearchHit {
  card: Flashcard
  unidadId: string
  unidadNombre: string
  materiaId: string
  materiaNombre: string
  carreraId: string
  carreraNombre: string
}

export interface SearchResult {
  hits: SearchHit[]
  /** Cuántas coincidieron en total, si se recortó la lista. */
  total: number
}

/* ------------------------------- ingesta -------------------------------- */

/** Texto extraído de un apunte, listo para que el usuario lo revise. */
export interface ExtractedDoc {
  /** El texto. Vive en memoria: no se guarda en disco en ningún momento. */
  texto: string
  /** Nombre del archivo, sólo para mostrarlo. */
  nombre: string
  palabras: number
  /**
   * Aviso para mostrar sobre el cuadro de revisión cuando la extracción tiene
   * riesgo: un PDF a dos columnas, una presentación con poco texto por filmina.
   */
  aviso?: string
}

/* ------------------------------ generación ------------------------------ */

export interface GenOptions {
  level: GenLevel
  language: Language
  tipo: CardType
  densidad: Densidad
}

export interface GeneratedCard {
  frente: string
  dorso: string
}

/** Cómo terminó el guardado de un mazo revisado. */
export interface SaveResult {
  guardadas: number
  /** Descartadas por estar ya en la unidad. Ver `deckStore.saveCards`. */
  repetidas: number
}

export interface GenResult {
  cards: GeneratedCard[]
  /** Cuántas se descartaron por no estar respaldadas por el texto. Métrica de salud. */
  descartadas: number
  /** Cuántas se descartaron por repetidas (el solapamiento de bloques las genera). */
  repetidas: number
  bloques: number
}

export type GenPhase = 'preparing' | 'model' | 'generating' | 'done' | 'error'

/** Un archivo esperando su turno en la cola de generación. */
export interface ArchivoEnCola {
  ruta: string
  nombre: string
  estado: 'espera' | 'trabajando' | 'listo' | 'error'
  cards: number
  detalle?: string
}

export interface GenProgress {
  phase: GenPhase
  /** 0..100. */
  percent: number
  message?: string
  /** Tarjetas encontradas hasta ahora, para que la espera se sienta viva. */
  encontradas?: number
}

/* -------------------------------- estudio ------------------------------- */

/**
 * Los tres botones. El usuario lee el frente, responde en su cabeza, muestra el
 * resultado y elige uno.
 */
export type Grade = 'no' | 'masomenos' | 'si'
export const GRADES: Grade[] = ['no', 'masomenos', 'si']

/** Qué se estudia: una materia entera, una unidad, o una selección del buscador. */
export interface StudyScope {
  /** Estudiar una carrera entera. Es el botón que más se usa. */
  carreraId?: string | null
  materiaId?: string | null
  unidadId?: string | null
  cardIds?: string[] | null
  /**
   * Repaso libre: pasar TODAS las tarjetas del alcance, vencidas o no, sin tocar
   * el calendario.
   *
   * Existe porque la sesión normal sólo muestra lo que FSRS dice que toca hoy, y
   * eso deja sin respuesta un caso muy concreto y muy común: mañana rindo, quiero
   * pasar las cien tarjetas de esta materia AHORA. Antes la única forma era
   * reiniciar el progreso de cada tarjeta, que borra el historial — o sea,
   * romper seis meses de repaso espaciado para poder repasar.
   *
   * La regla que lo hace seguro está en `studySession`: en libre no se escribe
   * NINGÚN `schedule`. Lo que el usuario conteste acá ordena esta sesión y nada
   * más; ninguna tarjeta se adelanta, se atrasa ni aparece donde no corresponde.
   */
  libre?: boolean
}

export interface StudyCard {
  id: string
  frente: string
  dorso: string
  /** La cita, para poder verificar el dato. Se muestra chica al pie, ver `Flashcard.fuente`. */
  fuente?: string
  unidadNombre: string
  materiaNombre: string
  /** `true` si el usuario nunca la vio. La UI lo marca. */
  esNueva: boolean
}

export interface SessionState {
  /** Cuántas quedan en esta sesión. */
  pendientes: number
  nuevas: number
  repasos: number
  /** Cuántas ya calificó en esta sesión. */
  hechas: number
  /** La que toca ahora, o `null` si la sesión terminó. */
  actual: StudyCard | null
  /** `true` si es un repaso libre. La pantalla lo dice: cambia lo que significan los botones. */
  libre: boolean
}

/** Cómo terminó una sesión, para la pantalla de cierre. */
export interface SessionSummary {
  hechas: number
  sabidas: number
  masOMenos: number
  noSabidas: number
  /** Cuántas quedaron sin ver por el tope diario. */
  pendientesPorTope: number
  /** `true` si fue un repaso libre: el cierre no puede prometer "vuelven mañana". */
  libre: boolean
}

/* -------------------------------- modelos ------------------------------- */

export type ModelPhase = 'checking' | 'downloading' | 'verifying' | 'ready' | 'error'

/**
 * Progreso de descarga del modelo.
 *
 * Convertexto usa una unión discriminada acá porque tiene dos familias de modelo
 * (whisper y resumen) y confundirlas hacía que la tarjeta de descarga dijera
 * "calidad Rápida" mientras bajaba otra cosa. Flashcards tiene una sola familia,
 * así que el discriminante no tendría nada que discriminar.
 */
export interface ModelProgress {
  level: GenLevel
  phase: ModelPhase
  receivedBytes: number
  totalBytes: number
  percent: number
  bytesPerSecond: number
  message?: string
}

export interface GenModelStatus {
  level: GenLevel
  installed: boolean
  /**
   * `true` si el modelo que se va a usar es el que ya tenía descargado
   * Convertexto. La UI lo dice ("ya lo tenías de Convertexto") y NO ofrece
   * borrarlo: no es de esta app.
   */
  borrowed: boolean
  sizeBytes: number
  /** RAM mínima recomendada, para avisar antes de descargar 2,7 GB al pedo. */
  minRamBytes: number
  /** Espacio libre en la carpeta de modelos; `null` si no se pudo averiguar. */
  freeBytes: number | null
}

export interface InstalledModel {
  level: GenLevel
  label: string
  sizeBytes: number
  installed: boolean
  borrowed: boolean
  /** Bytes de una descarga a medias que quedó dando vueltas. */
  partialBytes: number
}

/* ------------------------------ app y config ----------------------------- */

export interface AppConfig {
  /** Checkbox "no volver a mostrar este mensaje" del onboarding. */
  hideOnboarding: boolean
  /**
   * Si el usuario ya leyó y aceptó la aclaración sobre el contenido.
   *
   * Es un dato distinto de `hideOnboarding` y por eso no se guarda en el mismo
   * campo: aquél dice si quiere volver a ver la presentación, y éste registra
   * que se le explicó que las tarjetas pueden tener un error, que conviene
   * verificar lo crítico y que puede editar cualquiera. Sin esa separación, un
   * comprador que venía de una versión anterior con `hideOnboarding` en `true`
   * nunca vería la aclaración.
   *
   * Mientras esté en `false` la bienvenida no se puede cerrar: es lo único de
   * toda la app que bloquea el paso, y lo hace a propósito.
   */
  avisoAceptado: boolean
  /**
   * Si aceptó el aviso de la pestaña Generar: que la generación con IA descarga
   * modelos, que tiene requisitos mínimos y que una demora es casi siempre la
   * computadora, no la app. Mientras esté en `false`, abrir Generar muestra el
   * aviso y no deja usarla sin marcar la casilla. Ver `AvisoGenerarModal`.
   */
  avisoIaAceptado: boolean
  /** Idioma en el que se generan las tarjetas (la interfaz es siempre español). */
  language: Language
  /** Claro, oscuro o lo que diga el sistema. */
  tema: Tema
  genLevel: GenLevel
  tipo: CardType
  densidad: Densidad
  /**
   * La carrera que el estudiante eligió en la bienvenida. Filtra toda la app.
   *
   * `null` significa "mostrame todas", que es una opción legítima: alguien puede
   * cursar dos carreras, o querer mirar el mazo entero antes de decidir.
   */
  carreraActivaId: string | null
  /** Última materia y unidad elegidas, para preseleccionarlas al generar. */
  ultimaMateriaId: string | null
  ultimaUnidadId: string | null
}

/** Valor de `process.platform`. Sólo se distribuye para Windows y macOS. */
export type Platform = 'win32' | 'darwin' | 'linux'

export interface AppInfo {
  /**
   * Cómo se llama el producto, tal como quedó instalado.
   *
   * Viaja desde el proceso principal —`app.getName()`, que es el `productName`
   * de electron-builder— en vez de estar escrito en cada pantalla. La versión
   * anterior lo tenía a mano en tres componentes y los tres siguieron diciendo
   * el nombre del producto del que se copió este árbol mucho después de que la
   * app se llamara distinto. Un nombre copiado se desincroniza; uno leído no.
   */
  nombre: string
  version: string
  platform: Platform
  /**
   * `false` si falta `llama-server`. A diferencia de Convertexto —donde el motor
   * de resúmenes puede faltar sin drama porque la transcripción sigue andando—,
   * acá esto apaga la única función que crea contenido. Estudiar y editar las
   * tarjetas que ya existen sigue funcionando.
   */
  engineReady: boolean
  engineError?: string
  logFilePath: string
  modelsDir: string
  /**
   * Dónde vive todo lo del usuario: materias, unidades, tarjetas e historial.
   *
   * Viaja a la interfaz para poder MOSTRARLA, no sólo para abrirla. La app no hace
   * copias de seguridad automáticas —está declarado en el anexo del contrato— así
   * que lo mínimo honesto es decirle al usuario dónde está lo suyo y darle un botón
   * para llegar. Un "hacé una copia de la carpeta de datos" sin decir cuál es no
   * sirve de nada.
   */
  dataDir: string
  /** Núcleos que usa llama.cpp. */
  threads: number
}

export interface Result<T> {
  ok: boolean
  data?: T
  error?: string
}

/** Nombres de los canales IPC (una sola fuente de verdad). */
/**
 * Cuánta memoria hay y si alcanza para generar.
 *
 * Viaja del proceso principal a la interfaz cada pocos segundos para alimentar
 * el indicador de la barra de arriba. No bloquea nada: informa.
 */
export type NivelMemoria = 'holgado' | 'justo' | 'escaso'

export interface EstadoMemoria {
  totalBytes: number
  libreBytes: number
  necesarioBytes: number
  nivel: NivelMemoria
}

export const IPC = {
  appInfo: 'app:info',
  configGet: 'config:get',
  configSet: 'config:set',
  openPath: 'shell:open-path',
  openLogFile: 'shell:open-log-file',
  openDataFolder: 'shell:open-data-folder',
  logFromRenderer: 'log:renderer',
  memoria: 'app:memoria',
  docPickMany: 'doc:pick-many',
  mazoExport: 'mazo:export',
  mazoImport: 'mazo:import',

  // carreras
  carreraList: 'carrera:list',
  carreraCreate: 'carrera:create',
  carreraRename: 'carrera:rename',
  carreraSetRitmo: 'carrera:set-ritmo',
  carreraReorder: 'carrera:reorder',
  carreraDelete: 'carrera:delete',

  // materias
  materiaList: 'materia:list',
  materiaCreate: 'materia:create',
  materiaRename: 'materia:rename',
  materiaReorder: 'materia:reorder',
  materiaDelete: 'materia:delete',

  // unidades
  unidadList: 'unidad:list',
  unidadCreate: 'unidad:create',
  unidadRename: 'unidad:rename',
  unidadMove: 'unidad:move',
  materiaMove: 'materia:move',
  unidadReorder: 'unidad:reorder',
  unidadDelete: 'unidad:delete',

  // tarjetas
  cardList: 'card:list',
  cardCreate: 'card:create',
  cardUpdate: 'card:update',
  cardMove: 'card:move',
  cardDelete: 'card:delete',
  cardResetProgress: 'card:reset-progress',
  cardSaveMany: 'card:save-many',

  // búsqueda
  search: 'search:query',

  // ingesta
  docPick: 'doc:pick',
  docExtract: 'doc:extract',

  // generación
  genStart: 'gen:start',
  genCancel: 'gen:cancel',

  // estudio
  studyStart: 'study:start',
  studyGrade: 'study:grade',
  studyEnd: 'study:end',

  // progreso
  progressGet: 'progress:get',

  // modelos
  modelStatus: 'model:status',
  modelDownload: 'model:download',
  modelCancelDownload: 'model:cancel-download',
  modelList: 'model:list',
  modelDelete: 'model:delete',
  modelReveal: 'model:reveal',

  // eventos main -> renderer
  evtGenProgress: 'evt:gen-progress',
  evtModelProgress: 'evt:model-progress',
  evtLibraryChanged: 'evt:library-changed'
} as const
