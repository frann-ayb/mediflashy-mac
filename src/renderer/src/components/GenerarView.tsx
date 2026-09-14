import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  Layers,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  WandSparkles,
  X
} from 'lucide-react'
import type {
  AppConfig,
  CardType,
  Densidad,
  ExtractedDoc,
  GenLevel,
  GenProgress,
  GeneratedCard,
  Language,
  Materia,
  ModelProgress,
  UnidadResumen,
  ArchivoEnCola
} from '@shared/types'
import type { Revision } from '@/App'
import { call } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatBytes, formatEta, plural } from '@/lib/format'
import { procesarCola, sinRepetidas } from '@/lib/cola'
import { Banner, Button, Empty, Input, ProgressBar, Segmented, SelectCard, Textarea } from '@/components/primitives'

/**
 * De un apunte a un mazo, en tres pasos.
 *
 *   1. El material   →   2. Dónde va y cómo   →   3. Revisión y guardado
 *
 * ---------------------------------------------------------------------------
 * Por qué el paso 3 no se puede saltear
 * ---------------------------------------------------------------------------
 *
 * Sería fácil poner un botón "generar y guardar" y ahorrarle un paso al usuario.
 * No está, y es a propósito: un modelo de 2B produce alguna tarjeta con un error
 * sutil —una fecha cambiada, una definición que invierte la relación—, y esas
 * tarjetas después se memorizan para un final. La revisión no es burocracia, es la
 * última cosa que separa "una app que te ayuda a estudiar" de "una app que te
 * enseña cosas mal".
 *
 * ---------------------------------------------------------------------------
 * El mini-prompt
 * ---------------------------------------------------------------------------
 *
 * Su estado vive en `App.tsx`, no acá, para que sobreviva a ir a la biblioteca y
 * volver. No se guarda en disco en ningún momento.
 */

interface Props {
  materias: Materia[]
  /**
   * La carrera activa. Las materias que llegan por `materias` YA vienen
   * filtradas por ella, así que acá sólo hace falta para crear una materia nueva.
   * No se agrega un tercer combo: la carrera se hereda de la barra de arriba.
   */
  carreraActivaId: string | null
  config: AppConfig | null
  engineReady: boolean
  miniPrompt: string
  onMiniPrompt: (v: string) => void
  /**
   * El mazo generado esperando revisión. Vive en `App` y no acá.
   *
   * No es una preferencia de arquitectura: viviendo en este componente, cambiar de
   * pestaña lo desmontaba y borraba dos minutos de generación sin aviso. Ahora
   * sobrevive, y la pestaña "Generar" muestra un punto mientras haya algo esperando.
   */
  revision: Revision | null
  onRevision: (r: Revision | null) => void
  /**
   * El estado de la generación en curso, también izado a `App`.
   *
   * Mismo motivo que `revision`: viviendo acá, cambiar de pestaña desmontaba la
   * vista y escondía una generación que seguía corriendo en el proceso principal,
   * sin barra y sin forma de cancelarla. Con la cola son horas de trabajo
   * desatendido, y la app misma empuja al usuario a ir a la Biblioteca en el medio
   * para crear la unidad donde va a guardar.
   */
  generando: boolean
  onGenerando: (v: boolean) => void
  progreso: GenProgress | null
  onProgreso: (p: GenProgress | null) => void
  modelo: ModelProgress | null
  onModelo: (m: ModelProgress | null) => void
  cola: EnCola[]
  onCola: (c: EnCola[]) => void
  enCurso: number
  onEnCurso: (i: number) => void
  preseleccion: { materiaId?: string | null; unidadId?: string | null }
  onConfig: (patch: Partial<AppConfig>) => void
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
  onListo: () => void
}

/**
 * Ejemplos clickeables del mini-prompt.
 *
 * Un campo de texto vacío con un placeholder genérico no lo usa nadie: el usuario
 * no sabe qué se puede pedir ahí, así que no pide nada. Con tres ejemplos para
 * tocar, entiende el rango de lo posible en dos segundos y después escribe los
 * suyos. Es la diferencia entre una función que existe y una que se usa.
 */
const EJEMPLOS = [
  'Enfocate en las fechas, los nombres y las cifras.',
  'Es para un final oral: priorizá definiciones exactas.',
  'Ignorá la bibliografía y los ejemplos, sólo los conceptos.'
]

/**
 * Un archivo esperando su turno.
 *
 * Una unidad de la facultad no es un PDF: son diez o quince. Sin cola había que
 * quedarse al lado de la computadora —cargar uno, esperar, revisar, guardar, y
 * volver a empezar— dos horas y media. Con la cola se eligen todos de una vez.
 *
 * Lo que la cola NO cambia: la revisión. Las tarjetas de todos los archivos se
 * juntan y se revisan de una sola vez al final. Ver el comentario del principio
 * sobre por qué el paso 3 no se puede saltear.
 */
type EnCola = ArchivoEnCola

/** El nombre del archivo, sin la carpeta. Sirve en Windows y en Mac. */
function nombreDe(ruta: string): string {
  const partes = ruta.split(/[/\\]/)
  return partes[partes.length - 1] || ruta
}


const MAX_MINI_PROMPT = 300

export function GenerarView({
  materias,
  carreraActivaId,
  config,
  engineReady,
  miniPrompt,
  onMiniPrompt,
  revision,
  onRevision,
  generando,
  onGenerando,
  progreso,
  onProgreso,
  modelo,
  onModelo,
  cola,
  onCola,
  enCurso,
  onEnCurso,
  preseleccion,
  onConfig,
  onAviso,
  onListo
}: Props): ReactNode {
  const [doc, setDoc] = useState<ExtractedDoc | null>(null)
  const [texto, setTexto] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  /* La cola vive en `App` (ver las props). Alias para no tocar el resto. */
  const setCola = onCola
  const setEnCurso = onEnCurso
  /* Un ref y no un estado: el bucle de generación lo lee entre archivo y archivo,
     y un estado ahí adentro tendría el valor viejo de la pasada del render. */
  const cancelado = useRef(false)

  const [materiaId, setMateriaId] = useState<string | null>(preseleccion.materiaId ?? config?.ultimaMateriaId ?? null)
  const [unidadId, setUnidadId] = useState<string | null>(preseleccion.unidadId ?? config?.ultimaUnidadId ?? null)
  const [unidades, setUnidades] = useState<UnidadResumen[]>([])
  const [nuevaMateria, setNuevaMateria] = useState('')
  const [nuevaUnidad, setNuevaUnidad] = useState('')
  const [creandoMateria, setCreandoMateria] = useState(false)
  const [creandoUnidad, setCreandoUnidad] = useState(false)

  /* Estos tres viven en `App` (ver las props). Los alias dejan el resto del
     componente exactamente igual que antes, que es lo que evita romper algo al
     mudarlos. */
  const setGenerando = onGenerando
  const setProgreso = onProgreso
  const setModelo = onModelo

  const [guardando, setGuardando] = useState(false)

  const zonaRef = useRef<HTMLDivElement | null>(null)

  const level: GenLevel = config?.genLevel ?? 'rapido'
  const language: Language = config?.language ?? 'es'
  const tipo: CardType = config?.tipo ?? 'mixto'
  const densidad: Densidad = config?.densidad ?? 'normal'

  const palabras = useMemo(() => texto.trim().split(/\s+/).filter((w) => w.length > 0).length, [texto])

  const avisarError = useCallback(
    (error: string | null) => {
      if (error) onAviso({ tone: 'error', text: error })
    },
    [onAviso]
  )

  /* ------------------------------- suscripciones ----------------------------- */

  /* La suscripción al progreso vive en `App`, no acá: este componente se
     desmonta al cambiar de pestaña, y con ella adentro nadie escuchaba los
     eventos mientras el usuario estaba en la Biblioteca. Al volver, la barra
     mostraba el último valor de hace diez minutos hasta el evento siguiente. */

  useEffect(() => {
    if (!materiaId) {
      setUnidades([])
      return
    }
    void (async () => {
      const { data, error } = await call((api) => api.listUnidades(materiaId))
      avisarError(error)
      setUnidades(data ?? [])
    })()
  }, [materiaId, avisarError, materias])

  useEffect(() => {
    if (unidadId && unidades.length > 0 && !unidades.some((u) => u.unidad.id === unidadId)) setUnidadId(null)
  }, [unidades, unidadId])

  /* --------------------------------- material -------------------------------- */

  const cargarArchivo = async (path?: string): Promise<void> => {
    setLeyendo(true)
    try {
      const { data, error } = path ? await call((api) => api.extractDocument(path)) : await call((api) => api.pickDocument())
      if (error) {
        onAviso({ tone: 'error', text: error })
        return
      }
      if (!data) return
      setDoc(data)
      setTexto(data.texto)
    } finally {
      setLeyendo(false)
    }
  }

  /**
   * Elegir varios apuntes de una.
   *
   * Devuelve rutas, no textos: una unidad entera son quince archivos y extraerlos
   * todos ahora dejaría decenas de megas de texto en memoria antes de usar el
   * primero. Cada uno se lee recién cuando le toca.
   */
  const elegirVarios = async (): Promise<void> => {
    setLeyendo(true)
    try {
      const { data, error } = await call((api) => api.pickDocuments())
      if (error) {
        onAviso({ tone: 'error', text: error })
        return
      }
      if (!data || data.length === 0) return
      const nuevos = data.map<EnCola>((ruta) => ({ ruta, nombre: nombreDe(ruta), estado: 'espera', cards: 0 }))
      /* Si ya había cola, se agrega al final sin repetir rutas: el usuario puede
         volver a abrir el diálogo para sumar los que le faltaron. */
      const ya = new Set(cola.map((c) => c.ruta))
      setCola([...cola, ...nuevos.filter((c) => !ya.has(c.ruta))])
      setDoc(null)
      setTexto('')
    } finally {
      setLeyendo(false)
    }
  }

  const alSoltar = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setArrastrando(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const ruta = window.flashcards?.getPathForFile(file) ?? ''
    if (ruta.length === 0) {
      onAviso({ tone: 'error', text: 'No se pudo leer ese archivo. Probá con el botón de elegir archivo.' })
      return
    }
    void cargarArchivo(ruta)
  }

  /* --------------------------------- destino --------------------------------- */

  const crearMateria = async (): Promise<void> => {
    const nombre = nuevaMateria.trim()
    if (nombre.length === 0) return
    if (!carreraActivaId) {
      // Sin carrera activa no hay donde poner la materia nueva. Se avisa en vez de
      // elegir una por el usuario: crear la materia en la carrera equivocada la
      // deja invisible apenas vuelva a filtrar.
      avisarError('Elegí una carrera arriba antes de crear una materia.')
      return
    }
    const { data, error } = await call((api) => api.createMateria(carreraActivaId, nombre))
    avisarError(error)
    if (data) {
      setMateriaId(data.id)
      setUnidadId(null)
      setNuevaMateria('')
      setCreandoMateria(false)
      // La unidad se pide enseguida: una materia recién creada no tiene ninguna, y
      // sin unidad no se puede guardar nada. Encadenar los dos campos evita que el
      // usuario se quede mirando un selector vacío sin entender por qué.
      setCreandoUnidad(true)
    }
  }

  const crearUnidad = async (): Promise<void> => {
    const nombre = nuevaUnidad.trim()
    if (nombre.length === 0 || !materiaId) return
    const { data, error } = await call((api) => api.createUnidad(materiaId, nombre))
    avisarError(error)
    if (data) {
      setUnidadId(data.id)
      setNuevaUnidad('')
      setCreandoUnidad(false)
      const { data: lista } = await call((api) => api.listUnidades(materiaId))
      setUnidades(lista ?? [])
    }
  }

  /* -------------------------------- generación ------------------------------- */

  const generar = async (): Promise<void> => {
    if (!unidadId || generando) return
    cancelado.current = false
    setGenerando(true)
    setProgreso({ phase: 'preparing', percent: 0, message: 'Preparando…' })
    onConfig({ ultimaMateriaId: materiaId, ultimaUnidadId: unidadId })

    try {
      const { data, error } = await call((api) => api.generate(texto, { level, language, tipo, densidad }, miniPrompt))
      if (error) {
        onAviso({ tone: 'error', text: error })
        return
      }
      if (!data) return
      onRevision({
        cards: data.cards,
        descartadas: data.descartadas,
        unidadId,
        unidadNombre: unidades.find((u) => u.unidad.id === unidadId)?.unidad.nombre ?? ''
      })
    } finally {
      setGenerando(false)
      setProgreso(null)
      setModelo(null)
    }
  }

  /**
   * Genera de todos los archivos de la cola, uno atrás del otro, y junta todo
   * para UNA sola revisión al final.
   *
   * Decisiones que importan:
   *
   * - Un archivo que falla NO corta la cola. Un PDF escaneado en la posición 3 no
   *   puede tirar abajo los otros once; queda marcado en rojo y se sigue.
   * - Cancelar corta entre archivo y archivo, pero NO tira lo ya generado: si
   *   cancelás en el octavo de doce, se revisan las tarjetas de los siete.
   * - El motor queda levantado entre archivo y archivo. Volver a arrancarlo por
   *   cada uno costaría medio minuto de carga del modelo doce veces.
   */
  const generarCola = async (): Promise<void> => {
    if (!unidadId || generando || cola.length === 0) return
    cancelado.current = false
    setGenerando(true)
    onConfig({ ultimaMateriaId: materiaId, ultimaUnidadId: unidadId })

    /* Se congela la lista antes de arrancar: si el usuario tocara algo, el
       bucle no puede cambiar de largo en el medio. */
    const rutas = cola.map((c) => c.ruta)
    const estados: EnCola[] = cola.map((c) => ({ ...c, estado: 'espera', cards: 0, detalle: undefined }))
    let salida

    try {
      salida = await procesarCola<GeneratedCard>(
        rutas,
        {
          leer: (ruta) => call((api) => api.extractDocument(ruta)),
          generar: (texto) => call((api) => api.generate(texto, { level, language, tipo, densidad }, miniPrompt))
        },
        {
          alEmpezar: (i) => {
            setEnCurso(i)
            estados[i] = { ...estados[i], estado: 'trabajando' }
            setCola([...estados])
            setProgreso({ phase: 'preparing', percent: 0, message: 'Leyendo el archivo…' })
          },
          alTerminar: (i, r) => {
            estados[i] = { ...estados[i], ...r }
            setCola([...estados])
          },
          cancelado: () => cancelado.current
        }
      )
    } finally {
      setGenerando(false)
      setProgreso(null)
      setModelo(null)
      setEnCurso(-1)
    }

    const unicas = sinRepetidas(salida.cards)
    if (unicas.length === 0) {
      onAviso({
        tone: 'warn',
        text: cancelado.current
          ? 'Se canceló antes de que saliera alguna tarjeta.'
          : 'No salió ninguna tarjeta de esos archivos. Probá pegando el texto a mano.'
      })
      return
    }
    /* Los archivos que fallaron hay que DECIRLOS acá. La lista roja desaparece
       al pasar a la revisión, y sin este aviso el usuario revisa 60 tarjetas sin
       enterarse de que tres de sus doce apuntes no entraron. */
    if (salida.fallados > 0) {
      onAviso({
        tone: 'warn',
        text:
          `No se pudo leer ${plural(salida.fallados, 'archivo')}. ` +
          `Las tarjetas que siguen salieron de ${plural(salida.hechos, 'archivo')}.`
      })
    } else if (salida.cortada) {
      onAviso({
        tone: 'info',
        text: `Se canceló. Igual quedaron las tarjetas de ${plural(salida.hechos, 'archivo')} para revisar.`
      })
    }

    onRevision({
      cards: unicas,
      descartadas: salida.descartadas,
      unidadId,
      unidadNombre: unidades.find((u) => u.unidad.id === unidadId)?.unidad.nombre ?? ''
    })
  }

  const cancelar = (): void => {
    /* Antes que nada: corta el bucle de la cola en el próximo archivo. */
    cancelado.current = true
    void call((api) => api.cancelGeneration())
  }

  const guardar = async (): Promise<void> => {
    if (!revision || revision.cards.length === 0) return
    setGuardando(true)
    try {
      const { data, error } = await call((api) => api.saveCards(revision.unidadId, revision.cards))
      if (error) {
        onAviso({ tone: 'error', text: error })
        return
      }
      const { guardadas, repetidas } = data ?? { guardadas: 0, repetidas: 0 }
      onAviso({
        tone: guardadas > 0 ? 'success' : 'warn',
        // Si se descartó alguna por repetida hay que DECIRLO. Guardar 40 y que
        // aparezcan 31 sin explicación se lee como que la app perdió nueve.
        text:
          guardadas === 0
            ? 'Esas tarjetas ya estaban todas en la unidad, así que no se agregó ninguna.'
            : `Se ${guardadas === 1 ? 'guardó' : 'guardaron'} ${plural(guardadas, 'tarjeta')}. Ya podés estudiarlas.` +
              (repetidas > 0 ? ` Se ${repetidas === 1 ? 'salteó' : 'saltearon'} ${plural(repetidas, 'repetida')}.` : '')
      })
      reiniciar()
      onListo()
    } finally {
      setGuardando(false)
    }
  }

  /** Vuelve al principio, pero conserva el destino y las preferencias. */
  const reiniciar = (): void => {
    setDoc(null)
    setTexto('')
    setCola([])
    onRevision(null)
  }

  /* ---------------------------------- vista ---------------------------------- */

  if (!engineReady) {
    return (
      <Empty
        icono={<WandSparkles size={40} />}
        titulo="El motor de generación no está disponible"
        bajada="Podés seguir estudiando y editando tus tarjetas. Para crear tarjetas nuevas, reinstalá la app desde el instalador original."
      />
    )
  }

  if (generando) {
    return (
      <PantallaGenerando progreso={progreso} modelo={modelo} onCancelar={cancelar} cola={cola} enCurso={enCurso} />
    )
  }

  if (revision && revision.cards.length > 0) {
    return (
      <PantallaRevision
        cards={revision.cards}
        descartadas={revision.descartadas}
        unidadNombre={revision.unidadNombre}
        guardando={guardando}
        onCambiar={(cards) => onRevision({ ...revision, cards })}
        onGuardar={guardar}
        onDescartar={reiniciar}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* ------------------------------ 1. material ----------------------------- */}
      <section>
        <Encabezado numero={1} titulo="¿De dónde salen las tarjetas?" />

        {cola.length > 0 ? (
          <ListaCola cola={cola} onQuitar={(i) => setCola(cola.filter((_, k) => k !== i))} />
        ) : (
        <div
          ref={zonaRef}
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={cn(
            'rounded-2xl border border-dashed p-1 transition-colors',
            arrastrando ? 'border-brand bg-brand/5' : 'border-line-strong'
          )}
        >
          <Textarea
            value={texto}
            onChange={(v) => {
              setTexto(v)
              if (doc) setDoc(null)
            }}
            ariaLabel="Texto del apunte"
            /* Chico mientras está vacío: en la ventana mínima (940x660) diez
               filas empujaban el botón de generar abajo de todo, y la primera
               pantalla que ve el comprador el día 1 quedaba sin salida a la
               vista. Crece apenas hay texto, que es cuando hace falta. */
            rows={texto.length > 0 ? 10 : 4}
            placeholder={'Pegá acá el texto de tu apunte…\n\nO arrastrá un PDF, un Word, un PowerPoint o un .txt.'}
            className="border-0 bg-transparent focus:border-0"
          />
        </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void cargarArchivo()} disabled={leyendo || cola.length > 0}>
            {leyendo ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {leyendo ? 'Leyendo…' : 'Elegir un archivo'}
          </Button>

          {/* La cola. El botón dice "varios" y no "toda la unidad" a propósito:
              describe lo que hace el diálogo —se pueden marcar varios— y no una
              promesa sobre cómo el usuario organiza sus apuntes. */}
          <Button onClick={() => void elegirVarios()} disabled={leyendo}>
            <Layers size={15} />
            {cola.length > 0 ? 'Agregar más' : 'Elegir varios'}
          </Button>

          {texto.length > 0 || cola.length > 0 ? (
            <Button variant="ghost" onClick={reiniciar}>
              <X size={15} />
              Limpiar
            </Button>
          ) : null}

          <span className="ml-auto text-[12px] text-ink-faint">
            {cola.length > 0
              ? plural(cola.length, 'archivo')
              : palabras > 0
                ? `${palabras.toLocaleString('es-AR')} palabras`
                : ''}
          </span>
        </div>

        {/* El consejo va acá y no en un tooltip: es la diferencia entre tarjetas
            buenas y tarjetas regulares, y el usuario tiene que leerlo ANTES de
            elegir cómo cargar el material, no después. */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5">
          <ClipboardPaste size={15} className="mt-0.5 shrink-0 text-ink-faint" />
          <p className="text-[12px] leading-relaxed text-ink-faint">
            <span className="font-medium text-ink-dim">Pegar el texto a mano da mejores resultados.</span> Un PDF hay que
            interpretarlo —columnas, encabezados, palabras cortadas al final del renglón— y siempre puede salir algo
            desordenado. Lo que pegás vos entra tal cual.
          </p>
        </div>

        {cola.length > 1 ? (
          <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
            Se van a procesar de a uno, en orden. Podés dejar la computadora trabajando: cuando termine el último vas a
            revisar <span className="text-ink-dim">todas las tarjetas juntas</span>, de una sola vez.
          </p>
        ) : null}

        {doc?.aviso ? (
          <div className="mt-3">
            <Banner tone="warn">{doc.aviso}</Banner>
          </div>
        ) : null}

        {doc ? (
          <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-faint">
            <FileText size={13} />
            Texto extraído de <span className="text-ink-dim">{doc.nombre}</span>. Revisalo y corregí lo que haga falta antes de
            generar.
          </p>
        ) : null}
      </section>

      {/* ------------------------------ 2. destino ------------------------------ */}
      <section>
        <Encabezado numero={2} titulo="¿Dónde se guardan?" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Selector
            label="Materia"
            valor={materiaId}
            opciones={materias.map((m) => ({ id: m.id, nombre: m.nombre }))}
            creando={creandoMateria}
            valorNuevo={nuevaMateria}
            placeholderNuevo="Nombre de la materia"
            onElegir={(id) => {
              setMateriaId(id)
              setUnidadId(null)
            }}
            onCrear={() => setCreandoMateria(true)}
            onCambiarNuevo={setNuevaMateria}
            onConfirmarNuevo={() => void crearMateria()}
            onCancelarNuevo={() => {
              setCreandoMateria(false)
              setNuevaMateria('')
            }}
          />

          <Selector
            label="Unidad"
            valor={unidadId}
            opciones={unidades.map((u) => ({ id: u.unidad.id, nombre: u.unidad.nombre }))}
            deshabilitado={!materiaId}
            creando={creandoUnidad}
            valorNuevo={nuevaUnidad}
            placeholderNuevo="Nombre de la unidad"
            onElegir={setUnidadId}
            onCrear={() => setCreandoUnidad(true)}
            onCambiarNuevo={setNuevaUnidad}
            onConfirmarNuevo={() => void crearUnidad()}
            onCancelarNuevo={() => {
              setCreandoUnidad(false)
              setNuevaUnidad('')
            }}
          />
        </div>
      </section>

      {/* ------------------------------ 3. opciones ----------------------------- */}
      <section>
        <Encabezado numero={3} titulo="¿Cómo las querés?" />

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink-dim">Formato</p>
            <div className="flex gap-2">
              <SelectCard
                title="Concepto y definición"
                subtitle="Adelante el término, atrás qué significa."
                selected={tipo === 'concepto'}
                onClick={() => onConfig({ tipo: 'concepto' })}
              />
              <SelectCard
                title="Pregunta y respuesta"
                subtitle="Adelante una pregunta directa, atrás la respuesta."
                selected={tipo === 'pregunta'}
                onClick={() => onConfig({ tipo: 'pregunta' })}
              />
              <SelectCard
                title="Mezcla"
                subtitle="Lo que mejor le venga a cada parte del texto."
                selected={tipo === 'mixto'}
                onClick={() => onConfig({ tipo: 'mixto' })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-dim">Cantidad</p>
              <Segmented
                ariaLabel="Cantidad de tarjetas"
                value={densidad}
                onChange={(v) => onConfig({ densidad: v })}
                options={[
                  { value: 'baja', label: 'Pocas' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'alta', label: 'Exhaustiva' }
                ]}
              />
              {/* El nombre cambió de "Muchas" a "Exhaustiva" porque no es más
                  de lo mismo: funciona distinto. Pocas y Normal calculan la
                  cantidad por el largo del texto; Exhaustiva le pregunta
                  primero al modelo qué conceptos hay y arma tarjetas para
                  cubrirlos. Da mejor cobertura en apuntes largos y tarda
                  bastante más, y eso hay que decirlo ANTES de que la elija. */}
              {densidad === 'alta' && (
                <p className="mt-2 max-w-[280px] text-[12px] leading-snug text-ink-dim">
                  Busca los conceptos del apunte y arma al menos una tarjeta por cada uno.
                  Cubre mucho más, pero tarda varias veces más.
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-dim">Idioma de las tarjetas</p>
              <Segmented
                ariaLabel="Idioma"
                value={language}
                onChange={(v) => onConfig({ language: v })}
                options={[
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'Inglés' }
                ]}
              />
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-ink-dim">Calidad</p>
              <Segmented
                ariaLabel="Calidad"
                value={level}
                onChange={(v) => onConfig({ genLevel: v })}
                options={[
                  { value: 'rapido', label: 'Rápida' },
                  { value: 'detallado', label: 'Detallada' }
                ]}
              />
              {/* El único control de esta pantalla que no explicaba nada, y el
                  único donde elegir mal deja a la persona sin poder generar:
                  "Detallada" suena mejor y se elige sola, pero pide el doble de
                  memoria. No se desactiva; se dice lo que hace y lo que pide. */}
              <p className="mt-2 max-w-[300px] text-[12px] leading-snug text-ink-dim">
                {level === 'rapido' ? (
                  <>
                    Anda bien en cualquier computadora. Descarga 1,3 GB la primera vez y
                    necesita 4 GB de memoria RAM.
                  </>
                ) : (
                  <>
                    Arma preguntas mejores, pero descarga 2,7 GB y necesita{' '}
                    <b className="font-medium text-ink">8 GB de memoria RAM</b>. Tarda bastante
                    más que Rápida.
                  </>
                )}
              </p>
            </div>
          </div>

          <MiniPrompt valor={miniPrompt} onCambiar={onMiniPrompt} />
        </div>
      </section>

      {/* Pegada al fondo del área que scrollea: el botón no se pierde nunca.
          El -mx-6/px-6 la hace llegar a los bordes por encima del padding del
          contenedor, para que el contenido pase por debajo y no por al lado. */}
      <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex items-center justify-end gap-3 border-t border-line bg-canvas px-6 pt-4 pb-6">
        {!unidadId ? <p className="mr-auto text-[12px] text-ink-faint">Elegí una materia y una unidad para poder generar.</p> : null}
        <Button
          variant="primary"
          size="lg"
          onClick={() => void (cola.length > 0 ? generarCola() : generar())}
          disabled={!unidadId || (cola.length === 0 && palabras < 30)}
        >
          <WandSparkles size={16} />
          {cola.length > 0 ? `Generar de ${plural(cola.length, 'archivo')}` : 'Generar tarjetas'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------- subcomponentes ------------------------------ */

function Encabezado({ numero, titulo }: { numero: number; titulo: string }): ReactNode {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-faint">
        {numero}
      </span>
      <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
    </div>
  )
}

/**
 * Selector con "+ nueva" adentro.
 *
 * Que se pueda crear la materia y la unidad SIN salir de esta pantalla es lo que
 * hace que el flujo no se trabe. Un usuario que acaba de esperar dos minutos a que
 * se generen cuarenta tarjetas y descubre que tiene que ir a otra pantalla a crear
 * la unidad donde guardarlas, con el riesgo de perder lo generado, no vuelve a
 * usar la función.
 */
function Selector({
  label,
  valor,
  opciones,
  deshabilitado,
  creando,
  valorNuevo,
  placeholderNuevo,
  onElegir,
  onCrear,
  onCambiarNuevo,
  onConfirmarNuevo,
  onCancelarNuevo
}: {
  label: string
  valor: string | null
  opciones: Array<{ id: string; nombre: string }>
  deshabilitado?: boolean
  creando: boolean
  valorNuevo: string
  placeholderNuevo: string
  onElegir: (id: string) => void
  onCrear: () => void
  onCambiarNuevo: (v: string) => void
  onConfirmarNuevo: () => void
  onCancelarNuevo: () => void
}): ReactNode {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[13px] font-medium text-ink-dim">{label}</p>

      {creando ? (
        <div className="flex gap-2">
          <Input
            value={valorNuevo}
            onChange={onCambiarNuevo}
            ariaLabel={placeholderNuevo}
            placeholder={placeholderNuevo}
            autoFocus
            maxLength={120}
            onEnter={onConfirmarNuevo}
            onEscape={onCancelarNuevo}
          />
          <Button variant="primary" onClick={onConfirmarNuevo} disabled={valorNuevo.trim().length === 0}>
            <Check size={15} />
          </Button>
          <Button variant="ghost" onClick={onCancelarNuevo}>
            <X size={15} />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={valor ?? ''}
            disabled={deshabilitado}
            onChange={(e) => onElegir(e.target.value)}
            aria-label={label}
            className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink transition-colors focus:border-brand focus:outline-none disabled:opacity-50"
          >
            <option value="" disabled>
              {deshabilitado ? 'Elegí una materia primero' : `Elegí una ${label.toLowerCase()}`}
            </option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <Button onClick={onCrear} disabled={deshabilitado} title={`Nueva ${label.toLowerCase()}`}>
            <Plus size={15} />
          </Button>
        </div>
      )}
    </div>
  )
}

function MiniPrompt({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }): ReactNode {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <p className="text-[13px] font-medium text-ink-dim">Algo más que quieras pedirle</p>
        <span className="text-[11px] text-ink-faint">opcional</span>
      </div>

      <Textarea
        value={valor}
        onChange={onCambiar}
        ariaLabel="Preferencias para la generación"
        rows={2}
        maxLength={MAX_MINI_PROMPT}
        placeholder="Por ejemplo: enfocate en las fechas y los nombres."
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {EJEMPLOS.map((ej) => (
          <button
            key={ej}
            type="button"
            onClick={() => onCambiar(ej)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-dim"
          >
            {ej}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-faint">
          {valor.length}/{MAX_MINI_PROMPT}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Esto no se guarda en ningún lado: se usa para esta generación y se olvida cuando cerrás la app.
      </p>
    </div>
  )
}

/**
 * La lista de archivos en cola.
 *
 * Muestra el estado de cada uno mientras se procesan y no se va cuando termina:
 * si tres de doce fallaron, el usuario tiene que poder ver CUÁLES antes de
 * revisar las tarjetas, porque son los que va a tener que cargar a mano.
 */
function ListaCola({ cola, onQuitar }: { cola: EnCola[]; onQuitar: (i: number) => void }): ReactNode {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {cola.map((c, i) => (
        <li key={c.ruta} className="flex items-center gap-3 bg-surface px-3.5 py-2.5">
          {c.estado === 'trabajando' ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-brand" />
          ) : c.estado === 'listo' ? (
            <Check size={14} className="shrink-0 text-good" />
          ) : c.estado === 'error' ? (
            <TriangleAlert size={14} className="shrink-0 text-bad" />
          ) : (
            <FileText size={14} className="shrink-0 text-ink-faint" />
          )}

          <span className="min-w-0 flex-1 truncate text-[13px]" title={c.nombre}>
            {c.nombre}
          </span>

          {c.estado === 'listo' ? (
            <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">{plural(c.cards, 'tarjeta')}</span>
          ) : c.estado === 'error' ? (
            <span className="shrink-0 text-[12px] text-bad" title={c.detalle}>
              No se pudo
            </span>
          ) : c.estado === 'trabajando' ? (
            <span className="shrink-0 text-[12px] text-ink-faint">Generando…</span>
          ) : (
            <button
              type="button"
              onClick={() => onQuitar(i)}
              className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label={`Quitar ${c.nombre} de la lista`}
            >
              <X size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function PantallaGenerando({
  progreso,
  modelo,
  onCancelar,
  cola,
  enCurso
}: {
  progreso: GenProgress | null
  modelo: ModelProgress | null
  onCancelar: () => void
  cola: EnCola[]
  enCurso: number
}): ReactNode {
  const bajandoModelo = modelo !== null && modelo.phase === 'downloading' && (progreso?.phase ?? 'preparing') !== 'generating'
  const enCola = cola.length > 0 && enCurso >= 0
  /* Lo acumulado de los archivos ya terminados. Sin esto, la barra vuelve a cero
     doce veces y la espera se siente como si no avanzara nunca. */
  const previas = cola.reduce((n, c) => n + c.cards, 0)

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Loader2 size={32} className="mx-auto mb-5 animate-spin text-brand" />

        {bajandoModelo ? (
          <>
            <h2 className="text-[15px] font-semibold">Descargando el modelo</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
              Es una sola vez. Después queda en tu computadora y todo funciona sin internet.
            </p>
            <ProgressBar percent={modelo.percent} className="mt-5" />
            <p className="mt-2 text-[12px] tabular-nums text-ink-faint">
              {formatBytes(modelo.receivedBytes)} de {formatBytes(modelo.totalBytes)}
              {modelo.bytesPerSecond > 0
                ? ` · ${formatEta(modelo.totalBytes - modelo.receivedBytes, modelo.bytesPerSecond)}`
                : ''}
            </p>
          </>
        ) : (
          <>
            {enCola ? (
              <p className="mb-2 text-[12px] tabular-nums text-ink-faint">
                Archivo {enCurso + 1} de {cola.length} · <span className="text-ink-dim">{cola[enCurso]?.nombre}</span>
              </p>
            ) : null}
            <h2 className="text-[15px] font-semibold">Armando las tarjetas</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
              {progreso?.message ?? 'Preparando…'}
            </p>
            <ProgressBar percent={progreso?.percent ?? null} className="mt-5" />
            {typeof progreso?.encontradas === 'number' && progreso.encontradas > 0 ? (
              <p className="mt-2 text-[12px] tabular-nums text-ink-faint">
                {progreso.encontradas} tarjetas hasta ahora
                {previas > 0 ? ` · ${previas} de los archivos anteriores` : ''}
              </p>
            ) : previas > 0 ? (
              <p className="mt-2 text-[12px] tabular-nums text-ink-faint">{previas} tarjetas de los archivos anteriores</p>
            ) : null}
            {enCola && cola.length > 1 ? (
              <p className="mt-4 text-[12px] leading-relaxed text-ink-faint">
                Podés dejarla trabajando. Al terminar el último archivo vas a revisar todas las tarjetas juntas.
              </p>
            ) : null}
          </>
        )}

        <Button variant="ghost" onClick={onCancelar} className="mt-6">
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function PantallaRevision({
  cards,
  descartadas,
  unidadNombre,
  guardando,
  onCambiar,
  onGuardar,
  onDescartar
}: {
  cards: GeneratedCard[]
  descartadas: number
  unidadNombre: string
  guardando: boolean
  onCambiar: (cards: GeneratedCard[]) => void
  onGuardar: () => void
  onDescartar: () => void
}): ReactNode {
  const editar = (i: number, campo: 'frente' | 'dorso', valor: string): void => {
    const copia = [...cards]
    copia[i] = { ...copia[i], [campo]: valor }
    onCambiar(copia)
  }

  const borrar = (i: number): void => {
    onCambiar(cards.filter((_, j) => j !== i))
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight">
          {plural(cards.length, 'tarjeta')} {cards.length === 1 ? 'lista' : 'listas'}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
          Leelas antes de guardarlas: corregí lo que esté mal y borrá lo que no sirva. Se guardan en{' '}
          <span className="text-ink-dim">{unidadNombre}</span>.
        </p>
      </div>

      {descartadas > 0 ? (
        <div className="mb-4">
          <Banner tone="info">
            Se descartaron {plural(descartadas, 'tarjeta')} porque lo que decían no estaba en el texto. Es la app filtrando lo
            que el modelo inventó.
          </Banner>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <Empty
          icono={<TriangleAlert size={40} />}
          titulo="Borraste todas las tarjetas"
          bajada="Volvé atrás para generar de nuevo, quizá con otro texto o con otras preferencias."
          accion={<Button onClick={onDescartar}>Volver</Button>}
        />
      ) : (
        <div className="space-y-3">
          {cards.map((card, i) => (
            <div key={i} className="group rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-faint">Tarjeta {i + 1}</span>
                <button
                  type="button"
                  onClick={() => borrar(i)}
                  title="Descartar esta tarjeta"
                  className="rounded-lg p-1 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-bad"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <Textarea
                value={card.frente}
                onChange={(v) => editar(i, 'frente', v)}
                ariaLabel={`Frente de la tarjeta ${i + 1}`}
                rows={2}
                maxLength={400}
              />
              <div className="my-1.5 flex items-center gap-2 px-1 text-ink-faint">
                <ArrowRight size={13} />
                <span className="text-[11px]">respuesta</span>
              </div>
              <Textarea
                value={card.dorso}
                onChange={(v) => editar(i, 'dorso', v)}
                ariaLabel={`Dorso de la tarjeta ${i + 1}`}
                rows={3}
                maxLength={1200}
              />
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 ? (
        <div className="sticky bottom-0 mt-5 flex items-center justify-end gap-3 border-t border-line bg-canvas py-4">
          <Button variant="ghost" onClick={onDescartar}>
            Descartar todo
          </Button>
          <Button variant="primary" size="lg" onClick={onGuardar} disabled={guardando}>
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Guardar {plural(cards.length, 'tarjeta')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
