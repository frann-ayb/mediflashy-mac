import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  BookOpen,
  ChevronRight,
  Download,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  WandSparkles,
  X
} from 'lucide-react'
import type { Carrera, EstadoFiltro, Flashcard, Materia, SearchHit, UnidadResumen } from '@shared/types'
import { RITMO_SPECS, RITMOS } from '@shared/types'
import { call } from '@/lib/api'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'
import { Button, Chip, Empty, Input, Meter, Segmented } from '@/components/primitives'
import type { Seleccion } from '@/App'
import { CardEditor } from '@/components/CardEditor'

/**
 * La biblioteca: materias, unidades y tarjetas, con todo el CRUD y el buscador.
 *
 * ---------------------------------------------------------------------------
 * Por qué dos paneles y no una navegación en tres pasos
 * ---------------------------------------------------------------------------
 *
 * La jerarquía es Materia → Unidad → Tarjeta, y lo obvio sería una pantalla por
 * nivel con un botón "atrás". Se hizo en dos paneles —el árbol a la izquierda, el
 * contenido a la derecha— porque el uso real es saltar entre unidades de la misma
 * materia todo el tiempo: revisás una unidad, corregís dos tarjetas, te acordás de
 * algo de la unidad anterior. Con navegación en pasos, cada salto son dos clicks y
 * una pantalla que se redibuja entera.
 *
 * ---------------------------------------------------------------------------
 * El buscador se apodera del panel derecho
 * ---------------------------------------------------------------------------
 *
 * Cuando hay algo escrito, la derecha muestra resultados en vez de la unidad
 * seleccionada, y cada resultado dice de qué materia y unidad viene. Es lo que
 * permite buscar "prescripción" sin acordarse de dónde estaba, que es el caso de
 * uso que justifica que exista un buscador.
 */

interface Props {
  materias: Materia[]
  /** Todas las carreras, para poder resolver la de la materia abierta. */
  carreras: Carrera[]
  /** La carrera activa. `null` = el usuario eligió ver todas. */
  carreraActivaId: string | null
  /**
   * Qué está mirando el usuario. Vive en `App` para que ir a ver el progreso y
   * volver no lo devuelva al principio de la biblioteca.
   */
  seleccion: Seleccion
  onSeleccion: (s: Seleccion) => void
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
  onEstudiar: (scope: Seleccion) => void
  onGenerar: (scope: Seleccion) => void
}

const FILTRO_LABEL: Record<EstadoFiltro, string> = {
  todas: 'Todas',
  nuevas: 'Sin empezar',
  aprendiendo: 'Aprendiendo',
  repasando: 'Repasando',
  aprendidas: 'Ya las sé',
  vencidas: 'Para repasar hoy'
}

/*
 * Sólo tres de los seis se muestran.
 *
 * Los otros nombran estados internos de la repetición espaciada, y a un
 * estudiante no le dicen nada: "Repasando" y "Para repasar" suenan igual y son
 * cosas distintas. Seis opciones tampoco se leen de un vistazo.
 *
 * El TIPO no se toca: los seis siguen siendo válidos y el índice de búsqueda los
 * sigue entendiendo. Esto es sólo qué se le ofrece a la persona.
 */
const FILTROS_VISIBLES: EstadoFiltro[] = ['todas', 'vencidas', 'aprendidas']

export function BibliotecaView({
  materias,
  carreras,
  carreraActivaId,
  seleccion,
  onSeleccion,
  onAviso,
  onEstudiar,
  onGenerar
}: Props): ReactNode {
  const materiaId = seleccion.materiaId
  const unidadId = seleccion.unidadId
  const setMateriaId = useCallback(
    (id: string | null) => onSeleccion({ materiaId: id, unidadId: null }),
    [onSeleccion]
  )
  const setUnidadId = useCallback(
    (id: string | null) => onSeleccion({ materiaId, unidadId: id }),
    [onSeleccion, materiaId]
  )

  const [unidades, setUnidades] = useState<UnidadResumen[]>([])
  const [cards, setCards] = useState<Flashcard[]>([])

  const [texto, setTexto] = useState('')
  const [filtro, setFiltro] = useState<EstadoFiltro>('todas')
  const [resultados, setResultados] = useState<SearchHit[]>([])
  const [totalResultados, setTotalResultados] = useState(0)

  const [editando, setEditando] = useState<{ unidadId: string; card: Flashcard | null } | null>(null)
  const [creandoMateria, setCreandoMateria] = useState(false)
  const [creandoUnidad, setCreandoUnidad] = useState(false)
  const [renombrando, setRenombrando] = useState<{ tipo: 'materia' | 'unidad'; id: string; valor: string } | null>(null)

  const materia = useMemo(() => materias.find((m) => m.id === materiaId) ?? null, [materias, materiaId])

  /**
   * La unidad REALMENTE seleccionada: la que está en la lista que se está mostrando.
   *
   * Se deriva en vez de guardarse porque guardarla trae una condición de carrera
   * fea. Antes había un efecto que hacía "si `unidadId` no está en `unidades`,
   * limpialo", y como la lista se recarga de forma asíncrona, ese efecto corría con
   * la lista VIEJA justo después de crear una unidad y la deseleccionaba sola: el
   * usuario creaba "Unidad 1", la veía aparecer en el árbol, y el panel derecho le
   * mostraba el resumen de la materia en vez de la unidad recién creada. Salía a
   * veces sí y a veces no, según cuál de las dos cosas llegara primero.
   *
   * Derivándola, un id que todavía no está en la lista simplemente no selecciona
   * nada, y cuando la lista llega se selecciona solo. Sin efectos ni carreras.
   */
  const unidadActual = useMemo(() => unidades.find((u) => u.unidad.id === unidadId) ?? null, [unidades, unidadId])
  const unidadVigente = unidadActual?.unidad.id ?? null

  const buscando = texto.trim().length > 0 || filtro !== 'todas'

  const avisarError = useCallback((error: string | null) => {
    if (error) onAviso({ tone: 'error', text: error })
  }, [onAviso])

  /* --------------------------------- carga --------------------------------- */

  // La primera materia se selecciona sola. Sin esto, la app abre con el panel
  // derecho vacío y un árbol a la izquierda, y no se entiende que hay que hacer
  // click en algo.
  useEffect(() => {
    if (materiaId === null && materias.length > 0) setMateriaId(materias[0].id)
    else if (materiaId !== null && !materias.some((m) => m.id === materiaId)) setMateriaId(materias[0]?.id ?? null)
  }, [materias, materiaId, setMateriaId])

  const cargarUnidades = useCallback(async () => {
    if (!materiaId) {
      setUnidades([])
      return
    }
    const { data, error } = await call((api) => api.listUnidades(materiaId))
    avisarError(error)
    setUnidades(data ?? [])
  }, [materiaId, avisarError])

  const cargarCards = useCallback(async () => {
    if (!unidadVigente) {
      setCards([])
      return
    }
    const { data, error } = await call((api) => api.listCards(unidadVigente))
    avisarError(error)
    setCards(data ?? [])
  }, [unidadVigente, avisarError])

  useEffect(() => {
    void cargarUnidades()
  }, [cargarUnidades])

  useEffect(() => {
    void cargarCards()
  }, [cargarCards])

  useEffect(() => {
    const api = window.flashcards
    if (!api) return
    return api.onLibraryChanged(() => {
      void cargarUnidades()
      void cargarCards()
    })
  }, [cargarUnidades, cargarCards])

  /* -------------------------------- búsqueda -------------------------------- */

  // Se debouncea porque el buscador dispara en cada tecla. 150 ms es más rápido
  // que escribir la letra siguiente, así que no se siente la espera, y evita
  // mandar seis consultas para escribir "hígado".
  useEffect(() => {
    if (!buscando) {
      setResultados([])
      setTotalResultados(0)
      return
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data, error } = await call((api) => api.search({ texto, materiaId, unidadId: unidadVigente, estado: filtro }))
        avisarError(error)
        setResultados(data?.hits ?? [])
        setTotalResultados(data?.total ?? 0)
      })()
    }, 150)
    return () => clearTimeout(t)
  }, [texto, filtro, materiaId, unidadVigente, buscando, avisarError])

  /* --------------------------------- acciones ------------------------------- */

  /*
   * Crear una materia estando en "todas las carreras".
   *
   * Antes esto devolvía «Elegí una carrera arriba antes de crear una materia»,
   * y era un callejón: "todas" es el estado de fábrica y una opción legítima, así
   * que la app le pedía al usuario que abandonara una preferencia suya para
   * poder usar un botón. Peor todavía, el cartel aparecía DESPUÉS de haber
   * escrito el nombre.
   *
   * Ahora el destino se resuelve en cascada: la carrera activa si hay una; si no,
   * la que el usuario eligió en el formulario; y si hay una sola carrera en toda
   * la biblioteca, esa, sin preguntar nada — con una sola opción, preguntar es
   * hacerle hacer un clic para confirmar lo único posible.
   */
  const crearMateria = async (nombre: string, carreraElegida: string | null): Promise<void> => {
    const destino = carreraActivaId ?? carreraElegida ?? (carreras.length === 1 ? carreras[0].id : null)
    if (!destino) {
      avisarError('Elegí en qué carrera va la materia.')
      return
    }
    const { data, error } = await call((api) => api.createMateria(destino, nombre))
    avisarError(error)
    if (data) setMateriaId(data.id)
    setCreandoMateria(false)
  }

  const crearUnidad = async (nombre: string): Promise<void> => {
    if (!materiaId) return
    const { data, error } = await call((api) => api.createUnidad(materiaId, nombre))
    avisarError(error)
    if (data) setUnidadId(data.id)
    setCreandoUnidad(false)
  }

  const confirmarRenombre = async (): Promise<void> => {
    if (!renombrando || renombrando.valor.trim().length === 0) {
      setRenombrando(null)
      return
    }
    const { tipo, id, valor } = renombrando
    const { error } =
      tipo === 'materia'
        ? await call((api) => api.renameMateria(id, valor.trim()))
        : await call((api) => api.renameUnidad(id, valor.trim()))
    avisarError(error)
    setRenombrando(null)
  }

  const borrarMateria = async (id: string): Promise<void> => {
    const { error } = await call((api) => api.deleteMateria(id))
    avisarError(error)
  }

  /* ------------------------- exportar e importar mazos ----------------------- */

  /**
   * Guarda una materia entera en un archivo.
   *
   * El diálogo de dónde guardarlo lo abre el proceso principal, así que acá sólo
   * queda contar cómo terminó. Un `null` sin error es que el usuario cerró el
   * diálogo: no hay nada que decirle sobre algo que decidió no hacer.
   */
  const exportarMateria = async (id: string): Promise<void> => {
    const { data, error } = await call((api) => api.exportMateria(id))
    if (error) {
      onAviso({ tone: 'error', text: error })
      return
    }
    if (!data) return
    onAviso({ tone: 'success', text: 'Mazo guardado. Ya lo podés compartir o vender: no lleva tu progreso de estudio.' })
  }

  const importarMazo = async (): Promise<void> => {
    const { data, error } = await call((api) => api.importMazo())
    if (error) {
      onAviso({ tone: 'error', text: error })
      return
    }
    if (!data) return
    /* Se cuenta lo que pasó de verdad, no "listo": si de 60 tarjetas entraron 12
       porque el resto ya estaba, el usuario tiene que entender por qué el número
       que ve no es el que decía el mazo. */
    const partes = [`Se ${data.guardadas === 1 ? 'agregó' : 'agregaron'} ${plural(data.guardadas, 'tarjeta')} a "${data.materiaNombre}"`]
    if (data.unidadesNuevas > 0) partes.push(`en ${plural(data.unidadesNuevas, 'unidad', 'unidades')} nueva${data.unidadesNuevas === 1 ? '' : 's'}`)
    if (data.repetidas > 0) partes.push(`· ${plural(data.repetidas, 'repetida')} ya ${data.repetidas === 1 ? 'estaba' : 'estaban'}`)
    onAviso({
      tone: data.guardadas > 0 ? 'success' : 'warn',
      text: data.guardadas > 0 ? partes.join(' ') + '.' : `Ese mazo ya estaba completo en "${data.materiaNombre}": no se agregó ninguna tarjeta.`
    })
  }

  const borrarUnidad = async (id: string): Promise<void> => {
    const { error } = await call((api) => api.deleteUnidad(id))
    avisarError(error)
  }

  const borrarCard = async (uid: string, cid: string): Promise<void> => {
    const { error } = await call((api) => api.deleteCard(uid, cid))
    avisarError(error)
  }

  const guardarCard = async (frente: string, dorso: string): Promise<void> => {
    if (!editando) return
    const { unidadId: uid, card } = editando
    const { error } = card
      ? await call((api) => api.updateCard(uid, card.id, frente, dorso))
      : await call((api) => api.createCard(uid, frente, dorso))
    avisarError(error)
    if (!error) setEditando(null)
  }

  const reiniciarCard = async (): Promise<void> => {
    if (!editando?.card) return
    const { unidadId: uid, card } = editando
    const { error } = await call((api) => api.resetProgress(uid, card.id))
    avisarError(error)
    if (!error) {
      onAviso({ tone: 'success', text: 'La tarjeta vuelve a estar como nueva.' })
      setEditando(null)
    }
  }

  /* El id que recibe es el de la CARRERA, no el de la materia. Ver `setRitmo`. */
  const cambiarRitmo = async (carreraId: string, ritmo: (typeof RITMOS)[number]): Promise<void> => {
    const { error } = await call((api) => api.setRitmo(carreraId, ritmo))
    avisarError(error)
  }

  /* ---------------------------------- vista --------------------------------- */

  return (
    <div className="flex h-full min-h-0">
      {/* ------------------------------- árbol ------------------------------- */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-[13px] font-semibold tracking-wide text-ink-faint uppercase">Materias</h2>
          <div className="flex items-center gap-0.5">
            {/* Importar vive acá arriba y no dentro de una materia porque no
                pertenece a ninguna: trae una nueva, o agrega a la que coincida. */}
            <button
              type="button"
              onClick={() => void importarMazo()}
              title="Importar un mazo desde un archivo"
              className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Upload size={16} />
            </button>
            <button
              type="button"
              /* Alterna: tocar el "+" con el formulario abierto lo cierra. */
              onClick={() => setCreandoMateria((abierto) => !abierto)}
              title={creandoMateria ? 'Cancelar la materia nueva' : 'Nueva materia'}
              className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {creandoMateria ? (
            <NombreNuevo
              placeholder="Nombre de la materia"
              /* Sólo se pregunta cuando de verdad hay ambigüedad: sin carrera
                 activa y con más de una para elegir. */
              carreras={carreraActivaId === null && carreras.length > 1 ? carreras : undefined}
              onConfirmar={crearMateria}
              onCancelar={() => setCreandoMateria(false)}
            />
          ) : null}

          {materias.length === 0 && !creandoMateria ? (
            <p className="px-2 py-6 text-center text-[13px] leading-relaxed text-ink-faint">
              {/* No dice "creá una materia": el panel de la derecha está empujando
                  a generar, y dos carteles pidiendo cosas distintas dejan al
                  usuario decidiendo cuál obedecer. Acá sólo se describe el estado;
                  la acción vive en un solo lugar. */}
              Tus materias van a aparecer acá.
            </p>
          ) : null}

          {materias.map((m) => (
            <div key={m.id}>
              {renombrando?.tipo === 'materia' && renombrando.id === m.id ? (
                <div className="px-1 py-1">
                  <Input
                    value={renombrando.valor}
                    onChange={(v) => setRenombrando({ ...renombrando, valor: v })}
                    ariaLabel="Nuevo nombre de la materia"
                    autoFocus
                    maxLength={120}
                    onEnter={() => void confirmarRenombre()}
                    onEscape={() => setRenombrando(null)}
                  />
                </div>
              ) : (
                <FilaArbol
                  activa={m.id === materiaId}
                  icono={<BookOpen size={15} />}
                  nombre={m.nombre}
                  /* Sólo cuando hace falta: con una carrera activa, repetir su
                     nombre en cada fila es ruido en todas ellas. */
                  bajada={
                    carreraActivaId === null && carreras.length > 1
                      ? carreras.find((c) => c.id === m.carreraId)?.nombre
                      : undefined
                  }
                  que="la materia"
                  onClick={() => setMateriaId(m.id)}
                  onRenombrar={() => setRenombrando({ tipo: 'materia', id: m.id, valor: m.nombre })}
                  onBorrar={() => void borrarMateria(m.id)}
                  extra={{
                    icono: <Download size={13} />,
                    titulo: `Guardar "${m.nombre}" en un archivo`,
                    onClick: () => void exportarMateria(m.id)
                  }}
                />
              )}

              {m.id === materiaId ? (
                <div className="mt-0.5 mb-2 ml-3 border-l border-line pl-2">
                  {unidades.map((u) =>
                    renombrando?.tipo === 'unidad' && renombrando.id === u.unidad.id ? (
                      <div key={u.unidad.id} className="px-1 py-1">
                        <Input
                          value={renombrando.valor}
                          onChange={(v) => setRenombrando({ ...renombrando, valor: v })}
                          ariaLabel="Nuevo nombre de la unidad"
                          autoFocus
                          maxLength={120}
                          onEnter={() => void confirmarRenombre()}
                          onEscape={() => setRenombrando(null)}
                        />
                      </div>
                    ) : (
                      <FilaArbol
                        key={u.unidad.id}
                        activa={u.unidad.id === unidadId}
                        icono={<Layers size={14} />}
                        nombre={u.unidad.nombre}
                        que="la unidad"
                        sufijo={u.dominio.total > 0 ? String(u.dominio.total) : undefined}
                        medidor={u.dominio}
                        onClick={() => setUnidadId(u.unidad.id)}
                        onRenombrar={() => setRenombrando({ tipo: 'unidad', id: u.unidad.id, valor: u.unidad.nombre })}
                        onBorrar={() => void borrarUnidad(u.unidad.id)}
                      />
                    )
                  )}

                  {creandoUnidad ? (
                    <NombreNuevo placeholder="Nombre de la unidad" onConfirmar={crearUnidad} onCancelar={() => setCreandoUnidad(false)} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCreandoUnidad(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink-dim"
                    >
                      <Plus size={14} />
                      Nueva unidad
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      {/* ------------------------------ contenido ----------------------------- */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/*
          La barra de búsqueda y los filtros SÓLO cuando hay algo que buscar.
          Con la biblioteca vacía ocupaban el lugar más visible de la pantalla
          ofreciendo buscar entre cero tarjetas, y empujaban el único texto que
          servía —el que explica qué hacer— hacia abajo.
        */}
        {materias.length > 0 ? (
        <div className="shrink-0 space-y-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
              <Input
                value={texto}
                onChange={setTexto}
                ariaLabel="Buscar tarjetas"
                placeholder="Buscar en tus tarjetas…"
                maxLength={200}
                className="pl-9"
              />
              {texto.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTexto('')}
                  title="Limpiar"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1 text-ink-faint hover:text-ink"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {materia ? (
              <>
                <Button onClick={() => onGenerar({ materiaId, unidadId })}>
                  <WandSparkles size={15} />
                  Generar
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onEstudiar(unidadVigente ? { materiaId, unidadId: unidadVigente } : { materiaId, unidadId: null })}
                  disabled={(unidadActual?.dominio.total ?? 0) === 0 && unidades.every((u) => u.dominio.total === 0)}
                >
                  <GraduationCap size={15} />
                  Estudiar
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <Segmented
              ariaLabel="Filtrar por estado"
              value={filtro}
              onChange={setFiltro}
              options={FILTROS_VISIBLES.map((f) => ({ value: f, label: FILTRO_LABEL[f] }))}
            />
          </div>
        </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {buscando ? (
            <Resultados
              hits={resultados}
              total={totalResultados}
              onEditar={(hit) => setEditando({ unidadId: hit.unidadId, card: hit.card })}
              onBorrar={(hit) => void borrarCard(hit.unidadId, hit.card.id)}
            />
          ) : unidadActual ? (
            <Tarjetas
              titulo={unidadActual.unidad.nombre}
              dominio={unidadActual.dominio}
              cards={cards}
              onNueva={() => setEditando({ unidadId: unidadActual.unidad.id, card: null })}
              onEditar={(card) => setEditando({ unidadId: unidadActual.unidad.id, card })}
              onBorrar={(card) => void borrarCard(unidadActual.unidad.id, card.id)}
            />
          ) : materia ? (
            <ResumenMateria
              materia={materia}
              carrera={carreras.find((c) => c.id === materia.carreraId) ?? null}
              unidades={unidades}
              onElegir={setUnidadId}
              onRitmo={(r) => void cambiarRitmo(materia.carreraId, r)}
              onGenerar={() => onGenerar({ materiaId: materia.id, unidadId: null })}
            />
          ) : (
            /*
              El botón manda a GENERAR, no a crear una materia.
              Antes decía "Crear mi primera materia", que es el paso 2: nadie abre
              esta app para crear una materia vacía, la abre para convertir un
              apunte en tarjetas. Y la pantalla de generar deja crear la materia y
              la unidad ahí mismo, así que empezar por ahí no saltea nada — al
              revés, evita un viaje de ida y vuelta.
            */
            <Empty
              icono={<WandSparkles size={40} />}
              titulo="Convertí tu primer apunte en tarjetas"
              bajada="Pegá el texto de un apunte o cargá un PDF. La app arma las tarjetas, vos las revisás, y después te las va tomando."
              accion={
                <div className="flex flex-col items-center gap-3">
                  <Button variant="primary" size="lg" onClick={() => onGenerar({ materiaId: null, unidadId: null })}>
                    <WandSparkles size={16} />
                    Generar mis primeras tarjetas
                  </Button>
                  <button
                    type="button"
                    onClick={() => setCreandoMateria(true)}
                    className="text-[12px] text-ink-faint underline decoration-ink-faint/40 underline-offset-2 transition-colors hover:text-ink-dim"
                  >
                    o creá una materia vacía y escribí las tarjetas a mano
                  </button>
                </div>
              }
            />
          )}
        </div>
      </section>

      {editando ? (
        <CardEditor
          card={editando.card}
          titulo={editando.card ? 'Editar tarjeta' : 'Nueva tarjeta'}
          onGuardar={guardarCard}
          onReiniciar={editando.card ? reiniciarCard : undefined}
          onClose={() => setEditando(null)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------- subcomponentes ------------------------------ */

function NombreNuevo({
  placeholder,
  carreras,
  onConfirmar,
  onCancelar
}: {
  placeholder: string
  /**
   * Si viene, se pregunta ADEMÁS en qué carrera va.
   *
   * Sólo lo usa el formulario de materia nueva cuando el usuario está viendo
   * todas las carreras. El de unidad no lo pasa nunca: una unidad cuelga de la
   * materia que está abierta y ahí no hay nada que preguntar.
   */
  carreras?: Carrera[]
  onConfirmar: (nombre: string, carreraId: string | null) => void | Promise<void>
  onCancelar: () => void
}): ReactNode {
  const [valor, setValor] = useState('')
  const [carreraId, setCarreraId] = useState(carreras?.[0]?.id ?? '')

  const confirmar = (): void => {
    if (valor.trim().length > 0) void onConfirmar(valor.trim(), carreras ? carreraId : null)
  }

  /* Escape se escucha en el contenedor y no sólo en el campo de texto: quien
     eligió la carrera tiene el foco en el desplegable, y ahí el Escape del
     campo no llegaba nunca. Por eso tampoco se le pasa onEscape al Input: se
     cancelaría dos veces. Los botones son para quien usa el mouse, que no
     tenía ninguna salida visible. */
  const alTeclado = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancelar()
    }
  }

  return (
    <div className="px-1 py-1" onKeyDown={alTeclado}>
      {carreras ? (
        <select
          value={carreraId}
          onChange={(e) => setCarreraId(e.target.value)}
          aria-label="Carrera de la materia nueva"
          className="mb-1.5 h-9 w-full min-w-0 rounded-xl border border-line-strong bg-surface-2 px-2.5 text-[13px] text-ink transition-colors focus:border-brand focus:outline-none"
        >
          {carreras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      ) : null}

      <Input
        value={valor}
        onChange={setValor}
        ariaLabel={placeholder}
        placeholder={placeholder}
        autoFocus
        maxLength={120}
        onEnter={confirmar}
      />
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <Button variant="ghost" onClick={onCancelar} title="Cancelar (Esc)">
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmar} disabled={valor.trim().length === 0} title="Crear (Enter)">
          Crear
        </Button>
      </div>
    </div>
  )
}

function FilaArbol({
  activa,
  icono,
  nombre,
  /**
   * Qué es esta fila ("la materia", "la unidad"). Va en el tooltip de los botones.
   *
   * Un tooltip que dice "Borrar" a secas no le dice al usuario qué se lleva puesto,
   * y acá la diferencia es enorme: borrar una materia arrastra todas sus unidades y
   * todas sus tarjetas. Que el tooltip diga "Borrar la materia" es la última
   * oportunidad de darse cuenta antes del diálogo de confirmación.
   */
  que,
  /**
   * Un segundo renglón chico bajo el nombre.
   *
   * Lo usa el árbol para decir de qué carrera es cada materia cuando el usuario
   * está viendo todas. Sin esto, las tres carreras de Enfermería —que comparten
   * el mismo plan— muestran tres filas con el mismo nombre, y no hay forma de
   * saber cuál es cuál sin abrirlas una por una. El nombre se trunca, así que
   * ponerlo como sufijo en la misma línea no serviría: se cortaría justo él.
   */
  bajada,
  sufijo,
  medidor,
  onClick,
  onRenombrar,
  onBorrar,
  extra
}: {
  activa: boolean
  icono: ReactNode
  nombre: string
  que: string
  bajada?: string
  sufijo?: string
  medidor?: { porcentaje: number; total: number }
  onClick: () => void
  onRenombrar: () => void
  onBorrar: () => void
  /* Una acción más, opcional. Hoy la usan sólo las materias, para exportarse. */
  extra?: { icono: ReactNode; titulo: string; onClick: () => void }
}): ReactNode {
  return (
    <div
      className={cn(
        'group flex flex-col gap-1 rounded-lg px-2 py-1.5 transition-colors',
        activa ? 'bg-surface-2' : 'hover:bg-surface-2/60'
      )}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={cn('shrink-0', activa ? 'text-brand-soft' : 'text-ink-faint')}>{icono}</span>
          <span
              title={nombre}
              className={cn('truncate text-[13px]', activa ? 'font-medium text-ink' : 'text-ink-dim')}
            >
              {nombre}
            </span>
          {sufijo ? <span className="ml-auto shrink-0 text-[11px] text-ink-faint">{sufijo}</span> : null}
        </button>

        {/* Los botones aparecen al pasar el mouse. Con tres filas visibles siempre
            llenas de íconos, el árbol se vuelve ilegible. */}
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {extra ? (
            <button
              type="button"
              onClick={extra.onClick}
              title={extra.titulo}
              className="rounded p-1 text-ink-faint hover:bg-line hover:text-ink"
            >
              {extra.icono}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRenombrar}
            title={`Renombrar ${que}`}
            className="rounded p-1 text-ink-faint hover:bg-line hover:text-ink"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={onBorrar}
            title={`Borrar ${que}`}
            className="rounded p-1 text-ink-faint hover:bg-line hover:text-bad"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {bajada ? (
        <p title={bajada} className="truncate pl-[23px] text-[11px] leading-none text-ink-faint">
          {bajada}
        </p>
      ) : null}

      {medidor && medidor.total > 0 ? <Meter percent={medidor.porcentaje} total={medidor.total} className="h-1" /> : null}
    </div>
  )
}

function ResumenMateria({
  materia,
  carrera,
  unidades,
  onElegir,
  onRitmo,
  onGenerar
}: {
  materia: Materia
  /** La carrera de esta materia. El ritmo cuelga de acá. `null` si quedó colgada. */
  carrera: Carrera | null
  unidades: UnidadResumen[]
  onElegir: (id: string) => void
  onRitmo: (r: (typeof RITMOS)[number]) => void
  onGenerar: () => void
}): ReactNode {
  if (unidades.length === 0) {
    return (
      <Empty
        icono={<Layers size={40} />}
        titulo={`"${materia.nombre}" no tiene unidades`}
        bajada="Una unidad es un tema o una bolilla. Creá la primera desde el panel de la izquierda y después generá tarjetas."
        accion={
          <Button variant="primary" onClick={onGenerar}>
            <WandSparkles size={15} />
            Generar tarjetas
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{materia.nombre}</h2>
        <p className="mt-0.5 text-[13px] text-ink-faint">
          {plural(unidades.length, 'unidad', 'unidades')} · {plural(unidades.reduce((n, u) => n + u.dominio.total, 0), 'tarjeta')}
        </p>
      </div>

      <div className="space-y-2">
        {unidades.map((u) => (
          <button
            key={u.unidad.id}
            type="button"
            onClick={() => onElegir(u.unidad.id)}
            className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span title={u.unidad.nombre} className="truncate text-sm font-medium">
                    {u.unidad.nombre}
                  </span>
                {u.dominio.vencidas > 0 ? <Chip tone="warn">{u.dominio.vencidas} para repasar</Chip> : null}
                {u.dominio.total > 0 && u.dominio.nuevas === u.dominio.total ? <Chip tone="brand">sin empezar</Chip> : null}
              </div>
              <Meter percent={u.dominio.porcentaje} total={u.dominio.total} className="mt-2" />
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums">{u.dominio.total > 0 ? `${u.dominio.porcentaje}%` : '—'}</div>
              <div className="text-[11px] text-ink-faint">{plural(u.dominio.total, 'tarjeta')}</div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-ink-faint" />
          </button>
        ))}
      </div>

      {/* El ritmo cuelga de la CARRERA, no de la materia. Se muestra igual acá
          porque es donde el usuario lo busca, pero el texto lo dice: con la
          farmacología de varias carreras son decenas de materias, y un tope por
          materia se convierte en no tener tope (ver `nuevasHoy` en reviewLog). */}
      {carrera ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink-dim">¿Cuánto querés estudiar por día?</h3>
          <p className="mt-0.5 mb-3 text-[12px] text-ink-faint">
            Es para toda la carrera de {carrera.nombre}, no sólo para esta materia. Sirve para que no te aparezcan cien
            tarjetas juntas.
          </p>
          <Segmented
            ariaLabel="Ritmo de estudio"
            value={carrera.ritmo}
            onChange={onRitmo}
            options={RITMOS.map((r) => ({ value: r, label: RITMO_SPECS[r].label }))}
          />
          <p className="mt-2.5 text-[12px] text-ink-faint">
            {RITMO_SPECS[carrera.ritmo].hint} Hasta {RITMO_SPECS[carrera.ritmo].nuevasPorDia} tarjetas nuevas por día.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function Tarjetas({
  titulo,
  dominio,
  cards,
  onNueva,
  onEditar,
  onBorrar
}: {
  titulo: string
  dominio: { porcentaje: number; total: number; vencidas: number; nuevas: number; aprendidas: number }
  cards: Flashcard[]
  onNueva: () => void
  onEditar: (card: Flashcard) => void
  onBorrar: (card: Flashcard) => void
}): ReactNode {
  return (
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{titulo}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip>{plural(dominio.total, 'tarjeta')}</Chip>
            {dominio.nuevas > 0 ? <Chip tone="brand">{plural(dominio.nuevas, 'nueva')}</Chip> : null}
            {dominio.vencidas > 0 ? <Chip tone="warn">{dominio.vencidas} para repasar</Chip> : null}
            {dominio.aprendidas > 0 ? <Chip tone="good">{plural(dominio.aprendidas, 'aprendida')}</Chip> : null}
          </div>
        </div>
        <Button onClick={onNueva}>
          <Plus size={15} />
          Nueva tarjeta
        </Button>
      </div>

      {cards.length === 0 ? (
        <Empty
          icono={<Layers size={40} />}
          titulo="Esta unidad todavía no tiene tarjetas"
          bajada="Generalas desde un apunte con la pestaña Generar, o escribí una a mano."
          accion={
            <Button onClick={onNueva}>
              <Plus size={15} />
              Escribir una tarjeta
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {cards.map((card) => (
            <FilaTarjeta key={card.id} card={card} onEditar={() => onEditar(card)} onBorrar={() => onBorrar(card)} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilaTarjeta({
  card,
  contexto,
  onEditar,
  onBorrar
}: {
  card: Flashcard
  contexto?: string
  onEditar: () => void
  onBorrar: () => void
}): ReactNode {
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong">
      <button type="button" onClick={onEditar} className="min-w-0 flex-1 text-left">
        {contexto ? <p className="mb-1 truncate text-[11px] text-ink-faint">{contexto}</p> : null}
        <p className="truncate text-sm font-medium text-ink">{card.frente}</p>
        <p className="mt-0.5 truncate text-[13px] text-ink-faint">{card.dorso}</p>
      </button>

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={onEditar}
          title="Editar la tarjeta"
          className="rounded-lg p-1.5 text-ink-faint hover:bg-line hover:text-ink"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onBorrar}
          title="Borrar la tarjeta"
          className="rounded-lg p-1.5 text-ink-faint hover:bg-line hover:text-bad"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function Resultados({
  hits,
  total,
  onEditar,
  onBorrar
}: {
  hits: SearchHit[]
  total: number
  onEditar: (hit: SearchHit) => void
  onBorrar: (hit: SearchHit) => void
}): ReactNode {
  if (hits.length === 0) {
    return (
      <Empty
        icono={<Search size={40} />}
        titulo="No encontré nada"
        bajada="Probá con otra palabra, o sacá los filtros de estado."
      />
    )
  }

  return (
    <div className="p-6">
      <p className="mb-4 text-[13px] text-ink-faint">
        {plural(total, 'tarjeta')}
        {total > hits.length ? ` · se muestran las primeras ${hits.length}` : ''}
      </p>
      <div className="space-y-2">
        {hits.map((hit) => (
          <FilaTarjeta
            key={hit.card.id}
            card={hit.card}
            contexto={`${hit.materiaNombre} · ${hit.unidadNombre}`}
            onEditar={() => onEditar(hit)}
            onBorrar={() => onBorrar(hit)}
          />
        ))}
      </div>
    </div>
  )
}
