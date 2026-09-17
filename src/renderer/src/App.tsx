import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ChartColumn,
  FileText,
  GraduationCap,
  HardDrive,
  Library,
  MessageCircle,
  Monitor,
  Moon,
  Sun,
  WandSparkles
} from 'lucide-react'
import type { AppConfig, AppInfo, ArchivoEnCola, Carrera, GenProgress, GeneratedCard, Materia, ModelProgress, Tema } from '@shared/types'
import { call, logToMain } from '@/lib/api'
import { cn } from '@/lib/cn'
import { aplicar as aplicarTema, escucharAlSistema } from '@/lib/tema'
import { Banner } from '@/components/primitives'
import { BibliotecaView } from '@/components/BibliotecaView'
import { GenerarView } from '@/components/GenerarView'
import { EstudiarView } from '@/components/EstudiarView'
import { ProgresoView } from '@/components/ProgresoView'
import { IndicadorMemoria } from '@/components/IndicadorMemoria'
import { ModelosModal } from '@/components/ModelosModal'
import { BienvenidaModal } from '@/components/BienvenidaModal'
import { AvisoGenerarModal } from '@/components/AvisoGenerarModal'
import { SelectorCarrera } from '@/components/SelectorCarrera'
import { AcercaDeModal } from '@/components/AcercaDeModal'

/**
 * El armazón de la app: las cuatro secciones y lo que comparten.
 *
 * ---------------------------------------------------------------------------
 * Por qué hay tanto estado acá arriba
 * ---------------------------------------------------------------------------
 *
 * Las secciones se montan y se desmontan al cambiar de pestaña, así que TODO lo
 * que tenga que sobrevivir a ese cambio vive acá. Y hay tres cosas que tienen que
 * sobrevivir, cada una por un motivo distinto:
 *
 *  · `revision` — las tarjetas recién generadas, todavía sin guardar. Esto no es
 *    una comodidad: viviendo adentro de `GenerarView`, un click sin querer en
 *    "Biblioteca" borraba dos minutos de generación sin aviso ni forma de
 *    recuperarlos. Era la peor pérdida de datos de la app.
 *
 *  · `miniPrompt` — las preferencias de generación. Volver a la biblioteca a crear
 *    la unidad donde guardar es justamente lo que el usuario hace en el medio, y
 *    tener que reescribirlas cada vez convierte una función útil en una molestia.
 *
 *  · `seleccion` — qué materia y qué unidad está mirando. Ir a ver el progreso y
 *    volver para encontrar la biblioteca en el principio es chico, pero pasa
 *    veinte veces por sesión.
 *
 * Nada de esto se guarda en disco. El mini-prompt por decisión del producto; los
 * otros dos porque son estado de una sesión, no preferencias.
 */

type Seccion = 'biblioteca' | 'generar' | 'estudiar' | 'progreso'

interface Aviso {
  tone: 'info' | 'warn' | 'error' | 'success'
  text: string
}

/** Un mazo recién generado, esperando que el usuario lo revise y lo guarde. */
export interface Revision {
  cards: GeneratedCard[]
  descartadas: number
  unidadId: string
  unidadNombre: string
}

export interface Seleccion {
  /** Estudiar o generar sobre la carrera entera. */
  carreraId?: string | null
  materiaId: string | null
  unidadId: string | null
  /**
   * Arrancar directo en repaso libre.
   *
   * Lo usa la recomendación de Progreso cuando lo que sugiere es repasar algo
   * que NO vence hoy: mandarlo a la sesión normal mostraría "no hay nada para
   * repasar" justo después de recomendarle que lo repase.
   */
  libre?: boolean
}

/**
 * El botón del tema: un solo botón que da la vuelta por los tres estados.
 *
 * Se eligió un botón que cicla y no un menú desplegable porque cambiar el tema
 * es de esas cosas que uno hace una vez y no vuelve a tocar nunca, o que hace
 * seguido porque estudia de día y de noche. En los dos casos, abrir un menú para
 * elegir entre tres opciones es un paso de más.
 *
 * El ícono muestra SIEMPRE el estado actual —monitor, sol o luna— y el tooltip
 * dice qué pasa si se lo toca. Sin esas dos cosas, un botón que cicla es un
 * botón que nadie entiende.
 */
const TEMA_SIGUIENTE: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }

const TEMA_INFO: Record<Tema, { icono: ReactNode; nombre: string }> = {
  sistema: { icono: <Monitor size={16} />, nombre: 'igual que el sistema' },
  claro: { icono: <Sun size={16} />, nombre: 'claro' },
  oscuro: { icono: <Moon size={16} />, nombre: 'oscuro' }
}

const SECCIONES: Array<{ id: Seccion; label: string; icono: ReactNode }> = [
  { id: 'biblioteca', label: 'Biblioteca', icono: <Library size={16} /> },
  { id: 'generar', label: 'Generar', icono: <WandSparkles size={16} /> },
  { id: 'estudiar', label: 'Estudiar', icono: <GraduationCap size={16} /> },
  { id: 'progreso', label: 'Progreso', icono: <ChartColumn size={16} /> }
]

export function App(): ReactNode {
  const [seccion, setSeccion] = useState<Seccion>('biblioteca')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [materias, setMaterias] = useState<Materia[]>([])
  const [carreras, setCarreras] = useState<Carrera[]>([])
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [modelos, setModelos] = useState(false)
  const [bienvenida, setBienvenida] = useState(false)
  const [acercaDe, setAcercaDe] = useState(false)

  /** Preferencias de generación. En memoria, nunca a disco. */
  const [miniPrompt, setMiniPrompt] = useState('')
  /** Mazo generado esperando revisión. Sobrevive a cambiar de pestaña. */
  const [revision, setRevision] = useState<Revision | null>(null)

  /**
   * La generación EN CURSO. Vive acá por el mismo motivo que `revision`.
   *
   * Cuando esto vivía adentro de `GenerarView`, tocar cualquier pestaña
   * desmontaba la vista y se perdían los tres: al volver aparecía el formulario
   * vacío, como si no estuviera pasando nada, mientras el proceso principal seguía
   * trabajando sin forma de verlo ni de cancelarlo.
   *
   * Con la cola de archivos eso pasó de molesto a serio: una unidad entera son dos
   * horas de generación desatendida, y la app justamente le pide al usuario que
   * vaya a la Biblioteca a crear la unidad donde va a guardar. Un click en la
   * pestaña equivocada le escondía dos horas de trabajo.
   */
  const [generando, setGenerando] = useState(false)
  const [progresoGen, setProgresoGen] = useState<GenProgress | null>(null)
  const [progresoModelo, setProgresoModelo] = useState<ModelProgress | null>(null)
  /* La cola también: volver a la pestaña y no saber por qué archivo va es la mitad
     del problema que la cola vino a resolver. */
  const [cola, setCola] = useState<ArchivoEnCola[]>([])
  const [enCurso, setEnCurso] = useState(-1)
  const [seleccion, setSeleccion] = useState<Seleccion>({ materiaId: null, unidadId: null })

  /**
   * El progreso de la generación y de la descarga del modelo, escuchado desde acá.
   *
   * Tiene que estar en `App` y no en `GenerarView` porque la vista se desmonta al
   * cambiar de pestaña. Con la suscripción adentro de la vista, irse a la
   * Biblioteca durante una generación —que es lo que la app misma te pide hacer
   * para crear la unidad donde vas a guardar— dejaba de recibir eventos, y al
   * volver la barra mostraba el valor congelado de diez minutos antes.
   */
  useEffect(() => {
    const api = window.flashcards
    if (!api) return
    const off1 = api.onGenProgress(setProgresoGen)
    const off2 = api.onModelProgress(setProgresoModelo)
    return () => {
      off1()
      off2()
    }
  }, [])

  /*
   * La carrera activa. Vive en la configuracion y no en un estado suelto porque
   * tiene que sobrevivir a cerrar la app: quien cursa Enfermeria la elige una vez
   * y no la vuelve a tocar nunca.
   */
  const carreraActivaId = config?.carreraActivaId ?? null

  const refrescarCarreras = useCallback(async () => {
    const { data, error } = await call((api) => api.listCarreras())
    if (error) setAviso({ tone: 'error', text: error })
    else setCarreras(data ?? [])
  }, [])

  /* Las materias que se piden son las de la carrera activa. Ese filtro es el que
     hace que el resto de la app no vea las otras carreras: la lista de materias
     baja a la biblioteca, a generar y a estudiar. */
  const refrescarMaterias = useCallback(async () => {
    const { data, error } = await call((api) => api.listMaterias(carreraActivaId))
    if (error) setAviso({ tone: 'error', text: error })
    else setMaterias(data ?? [])
  }, [carreraActivaId])

  /**
   * Cambiar de carrera.
   *
   * Limpia la seleccion, y no es un detalle: la materia y la unidad que estaban
   * abiertas son de la carrera anterior y despues del cambio ya no existen para
   * ninguna pantalla. Sin esto, la biblioteca quedaria mostrando una unidad que
   * el arbol de la izquierda ya no lista.
   */
  const cambiarCarrera = useCallback(
    (id: string | null) => {
      setSeleccion({ carreraId: id, materiaId: null, unidadId: null })
      void guardarConfig({ carreraActivaId: id })
    },
    // `guardarConfig` se define abajo con useCallback vacio; no entra en deps a
    // proposito para no reordenar el archivo entero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    void (async () => {
      const [infoRes, configRes] = await Promise.all([call((api) => api.getAppInfo()), call((api) => api.getConfig())])
      if (infoRes.data) setInfo(infoRes.data)
      if (configRes.data) {
        setConfig(configRes.data)
        /*
         * Dos condiciones, no una.
         *
         * `hideOnboarding` dice si quiere volver a ver la presentación;
         * `avisoAceptado` registra que se le explicó que el contenido puede
         * tener un error, que conviene verificar lo crítico y que las tarjetas
         * se editan. Con una sola condición, quien venía de una versión anterior
         * con la presentación desactivada nunca vería la aclaración — que es
         * justo la persona que ya está estudiando con las tarjetas.
         */
        if (!configRes.data.hideOnboarding || !configRes.data.avisoAceptado) setBienvenida(true)
      }
      if (infoRes.error) setAviso({ tone: 'error', text: infoRes.error })
      await Promise.all([refrescarCarreras(), refrescarMaterias()])
    })()
  }, [refrescarCarreras, refrescarMaterias])

  // Cualquier cambio en la biblioteca —desde donde sea— refresca las listas de
  // carreras y materias. Sin esto, crear una materia desde la pantalla de generar
  // dejaría la biblioteca desactualizada hasta que el usuario recargue.
  //
  // Las dos listas y no sólo las materias: borrar una carrera entera desde el
  // diálogo nativo deja el selector de arriba mostrando una carrera que ya no
  // existe, y ése es justo el momento en que el usuario mira el selector.
  useEffect(() => {
    const api = window.flashcards
    if (!api) return
    return api.onLibraryChanged(() => {
      void refrescarCarreras()
      void refrescarMaterias()
    })
  }, [refrescarCarreras, refrescarMaterias])

  /*
   * Aviso al cerrar con tarjetas sin guardar.
   *
   * `beforeunload` corre en el renderer y Electron lo respeta al cerrar la ventana.
   * Es la única red para el caso de cerrar la app con un mazo recién generado en
   * pantalla: subir el estado a este componente salva el cambio de pestaña, pero no
   * el cierre. Sin esto, dos minutos de generación se van con un click en la X.
   */
  useEffect(() => {
    if (!revision || revision.cards.length === 0) return
    const alCerrar = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', alCerrar)
    return () => window.removeEventListener('beforeunload', alCerrar)
  }, [revision])

  const guardarConfig = useCallback(async (patch: Partial<AppConfig>) => {
    const { data, error } = await call((api) => api.setConfig(patch))
    if (error) setAviso({ tone: 'error', text: error })
    else if (data) setConfig(data)
  }, [])

  /*
   * La bienvenida tiene UNA salida y es aceptar.
   *
   * Antes había un casillero de "no volver a mostrar" y el cierre era opcional.
   * Ahora el casillero es la aceptación de la aclaración, y aceptar implica las
   * dos cosas: queda registrado que se le explicó, y no se le vuelve a mostrar.
   * Dos casilleros juntos —uno obligatorio y otro no— sólo consiguen que la
   * gente marque el que no era.
   */
  const aceptarBienvenida = useCallback(() => {
    setBienvenida(false)
    void guardarConfig({ hideOnboarding: true, avisoAceptado: true })
  }, [guardarConfig])

  /*
   * El aviso de Generar se acepta una sola vez. Se marca en el estado ANTES de que
   * vuelva la respuesta del disco: si no, el modal seguiría en pantalla el instante
   * que tarda el guardado y parecería que el botón no hizo nada.
   */
  const aceptarAvisoIa = useCallback(() => {
    setConfig((c) => (c ? { ...c, avisoIaAceptado: true } : c))
    void guardarConfig({ avisoIaAceptado: true })
  }, [guardarConfig])

  const irAEstudiar = useCallback((scope: Seleccion) => {
    setSeleccion(scope)
    setSeccion('estudiar')
  }, [])

  const irAGenerar = useCallback(
    (scope: Seleccion) => {
      setSeleccion(scope)
      setSeccion('generar')
      if (scope.materiaId || scope.unidadId) {
        void guardarConfig({ ultimaMateriaId: scope.materiaId, ultimaUnidadId: scope.unidadId })
      }
    },
    [guardarConfig]
  )

  useEffect(() => {
    if (info) logToMain('info', `Interfaz lista (v${info.version}).`)
  }, [info])

  /*
   * El tema, en cuanto llega la configuración.
   *
   * `main.tsx` ya estampó el tema recordado antes de montar nada, así que esto
   * casi nunca cambia lo que se ve: está para el caso en que la configuración
   * del disco y la copia rápida no coincidan —otra instalación, un perfil
   * distinto— y para que gane la del disco, que es la fuente de verdad.
   *
   * El retorno del efecto deja de escuchar al sistema. Sólo se escucha cuando la
   * opción es "sistema"; en claro u oscuro fijos no hay nada que seguir.
   */
  useEffect(() => {
    if (!config) return
    aplicarTema(config.tema)
    return escucharAlSistema(config.tema, () => aplicarTema(config.tema))
  }, [config])

  const hayRevision = (revision?.cards.length ?? 0) > 0

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <header className="drag-region flex shrink-0 items-center gap-1 border-b border-line px-4 pt-3 pb-0">
        <nav className="no-drag flex gap-1" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeccion(s.id)}
              aria-current={seccion === s.id ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                seccion === s.id ? 'border-brand text-ink' : 'border-transparent text-ink-faint hover:text-ink-dim'
              )}
            >
              {s.icono}
              {s.label}
              {/* Un punto en "Generar" cuando hay tarjetas esperando revisión. Sin
                  esto, el usuario que se fue a crear una unidad no tiene forma de
                  saber que su mazo lo está esperando del otro lado. */}
              {s.id === 'generar' && hayRevision ? (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand"
                  title="Tenés tarjetas sin guardar"
                />
              ) : null}
            </button>
          ))}
        </nav>

        {/*
            `min-w-0` para que el grupo pueda achicarse.
            Sin esto la barra de arriba es una fila de anchos fijos y no entra en
            los 940 px que la app deja: el nombre de la carrera es texto libre
            —"Licenciatura en Enfermería" mide el doble que "Medicina"— y quien
            paga el desborde es el botón de la punta, que queda fuera de la
            ventana. Con la cadena de `min-w-0` puesta, el que cede es el nombre,
            que se recorta con puntos suspensivos y se sigue entendiendo.
        */}
        <div className="no-drag mb-1.5 ml-auto flex min-w-0 items-center gap-3">
          {/* La carrera gobierna toda la app, asi que vive en la barra de arriba y
              no adentro de la biblioteca. Ver SelectorCarrera. */}
          <SelectorCarrera carreras={carreras} activaId={carreraActivaId} onCambiar={cambiarCarrera} />

          {/* Va antes que los íconos y no después: si la memoria está en rojo, es
              lo primero que conviene que vea, no lo último. */}
          <IndicadorMemoria />
          {config ? (
            <button
              type="button"
              onClick={() => void guardarConfig({ tema: TEMA_SIGUIENTE[config.tema] })}
              title={`Tema ${TEMA_INFO[config.tema].nombre}. Tocá para ponerlo ${TEMA_INFO[TEMA_SIGUIENTE[config.tema]].nombre}.`}
              aria-label={`Cambiar el tema. Ahora está ${TEMA_INFO[config.tema].nombre}.`}
              className="rounded-xl p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
            >
              {TEMA_INFO[config.tema].icono}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setAcercaDe(true)}
            title="Sobre esta versión y cómo contactarnos"
            aria-label="Sobre esta versión y cómo contactarnos"
            className="rounded-xl p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
          >
            <MessageCircle size={16} />
          </button>
          <button
            type="button"
            onClick={() => void call((api) => api.openDataFolder())}
            title="Abrir la carpeta con tus materias y tarjetas, para hacer una copia"
            className="rounded-xl p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
          >
            <HardDrive size={16} />
          </button>
          {/* El archivo de registro. El instructivo que recibe el comprador le dice
              textualmente "tocá el ícono de la hoja de papel", y el contrato le pide
              adjuntarlo a cualquier reclamo: tiene que existir y estar donde se le
              dijo que está. */}
          <button
            type="button"
            onClick={() => void call((api) => api.openLogFile())}
            title="Ver el archivo de registro"
            className="rounded-xl p-2 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
          >
            <FileText size={16} />
          </button>
          <button
            type="button"
            onClick={() => setModelos(true)}
            title="Modelos descargados"
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
          >
            Modelos
          </button>
        </div>
      </header>

      {aviso ? (
        <div className="shrink-0 px-4 pt-3">
          <Banner tone={aviso.tone} onDismiss={() => setAviso(null)}>
            {aviso.text}
          </Banner>
        </div>
      ) : null}

      {info && !info.engineReady ? (
        <div className="shrink-0 px-4 pt-3">
          <Banner tone="warn">
            {info.engineError ?? 'Falta el motor de generación.'} Podés seguir estudiando y editando tus tarjetas; lo único que
            no funciona es crear tarjetas nuevas con IA.
          </Banner>
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto">
        {seccion === 'biblioteca' ? (
          <BibliotecaView
            materias={materias}
            carreras={carreras}
            carreraActivaId={carreraActivaId}
            seleccion={seleccion}
            onSeleccion={setSeleccion}
            onAviso={setAviso}
            onEstudiar={irAEstudiar}
            onGenerar={irAGenerar}
          />
        ) : null}

        {seccion === 'generar' ? (
          <GenerarView
            materias={materias}
            carreraActivaId={carreraActivaId}
            config={config}
            engineReady={info?.engineReady ?? false}
            miniPrompt={miniPrompt}
            onMiniPrompt={setMiniPrompt}
            revision={revision}
            onRevision={setRevision}
            generando={generando}
            onGenerando={setGenerando}
            progreso={progresoGen}
            onProgreso={setProgresoGen}
            modelo={progresoModelo}
            onModelo={setProgresoModelo}
            cola={cola}
            onCola={setCola}
            enCurso={enCurso}
            onEnCurso={setEnCurso}
            preseleccion={seleccion}
            onConfig={guardarConfig}
            onAviso={setAviso}
            onListo={() => setSeccion('biblioteca')}
          />
        ) : null}

        {seccion === 'estudiar' ? <EstudiarView materias={materias} alcance={seleccion} onAviso={setAviso} /> : null}

        {seccion === 'progreso' ? (
          <ProgresoView info={info} carreraActivaId={carreraActivaId} onAviso={setAviso} onEstudiar={irAEstudiar} />
        ) : null}
      </main>

      {modelos ? <ModelosModal nombre={info?.nombre ?? 'La app'} onClose={() => setModelos(false)} onAviso={setAviso} /> : null}
      {bienvenida ? (
        <BienvenidaModal yaVioLaGira={config?.hideOnboarding === true} onAceptar={aceptarBienvenida} />
      ) : null}
      {/* Cada vez que se entra a Generar sin haber aceptado, venga de la pestaña o
          de cualquier botón que lleve ahí. Volver sin aceptar lleva a la Biblioteca. */}
      {seccion === 'generar' && config && !config.avisoIaAceptado && !bienvenida ? (
        <AvisoGenerarModal onAceptar={aceptarAvisoIa} onVolver={() => setSeccion('biblioteca')} />
      ) : null}
      {acercaDe ? <AcercaDeModal info={info} onClose={() => setAcercaDe(false)} onAviso={setAviso} /> : null}
    </div>
  )
}
