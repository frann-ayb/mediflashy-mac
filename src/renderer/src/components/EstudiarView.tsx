import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Check, Eye, GraduationCap, Infinity as Infinito, Loader2, RotateCcw, Target } from 'lucide-react'
import type { Grade, Materia, SessionState, SessionSummary, UnidadResumen } from '@shared/types'
import { call } from '@/lib/api'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'
import { Button, Chip, Empty, ProgressBar, Segmented } from '@/components/primitives'

/**
 * La sesión de estudio.
 *
 * ---------------------------------------------------------------------------
 * El ciclo, y por qué es de dos tiempos
 * ---------------------------------------------------------------------------
 *
 *   se muestra el frente  →  el usuario responde EN SU CABEZA
 *                         →  aprieta "Mostrar resultado"
 *                         →  compara y se califica
 *
 * El paso de responder mentalmente antes de ver la respuesta no es una formalidad:
 * es el mecanismo por el que esto funciona. Recuperar algo de la memoria fortalece
 * el recuerdo; leer la respuesta directamente, no. Por eso el dorso está oculto de
 * verdad y no en gris clarito: si se llega a leer de reojo, el ejercicio no sirvió.
 *
 * ---------------------------------------------------------------------------
 * Los atajos de teclado
 * ---------------------------------------------------------------------------
 *
 * Espacio revela, 1/2/3 califican. En una sesión de 60 tarjetas son 120 clicks
 * ahorrados, y sobre todo permite estudiar sin sacar la mano del teclado, que es
 * como se estudia de verdad. Están escritos en pantalla, chiquitos, debajo de cada
 * botón: un atajo que no se descubre no existe.
 *
 * ---------------------------------------------------------------------------
 * Los dos modos
 * ---------------------------------------------------------------------------
 *
 * **Lo de hoy** es la sesión de siempre: lo que el repaso espaciado dice que
 * toca, con el tope diario de la materia.
 *
 * **Repaso libre** pasa todas las tarjetas del alcance sin importar el
 * vencimiento ni el tope, y NO toca el calendario. Es para la semana de finales.
 *
 * La diferencia se explica en pantalla, y no en el manual, porque de otra forma
 * el usuario elegiría "repaso libre" creyendo que es "estudiar más" y se
 * quedaría sin entender por qué su porcentaje no se mueve.
 */

type Modo = 'hoy' | 'libre'

const MODOS = [
  { value: 'hoy' as const, label: 'Lo de hoy' },
  { value: 'libre' as const, label: 'Repaso libre' }
]

const EXPLICACION: Record<Modo, string> = {
  hoy: 'La app arma la sesión con lo que toca hoy según tu progreso, y respeta el límite diario de cada materia.',
  libre: 'Pasás todas las tarjetas que quieras, vengan o no. No cambia cuándo vuelve cada una, no gasta el límite del día y no afecta tu porcentaje: es práctica pura, para antes de un examen.'
}

interface Props {
  materias: Materia[]
  alcance: { materiaId?: string | null; unidadId?: string | null; libre?: boolean }
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
}

const BOTONES: Array<{ grade: Grade; label: string; atajo: string; clase: string }> = [
  { grade: 'no', label: 'No la sabía', atajo: '1', clase: 'border-bad/40 bg-bad/10 text-bad hover:bg-bad/20' },
  { grade: 'masomenos', label: 'Más o menos', atajo: '2', clase: 'border-warn/40 bg-warn/10 text-warn hover:bg-warn/20' },
  { grade: 'si', label: 'La sabía', atajo: '3', clase: 'border-good/40 bg-good/10 text-good hover:bg-good/20' }
]

export function EstudiarView({ materias, alcance, onAviso }: Props): ReactNode {
  const [sesion, setSesion] = useState<SessionState | null>(null)
  const [resumen, setResumen] = useState<SessionSummary | null>(null)
  const [revelado, setRevelado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [total, setTotal] = useState(0)

  const [materiaId, setMateriaId] = useState<string | null>(alcance.materiaId ?? null)
  const [unidades, setUnidades] = useState<UnidadResumen[]>([])
  const [modo, setModo] = useState<Modo>(alcance.libre ? 'libre' : 'hoy')

  const avisarError = useCallback(
    (error: string | null) => {
      if (error) onAviso({ tone: 'error', text: error })
    },
    [onAviso]
  )

  const arrancar = useCallback(
    async (scope: { materiaId?: string | null; unidadId?: string | null; libre?: boolean }) => {
      setCargando(true)
      try {
        const { data, error } = await call((api) => api.startSession(scope))
        if (error) {
          onAviso({ tone: 'info', text: error })
          return
        }
        if (data) {
          setSesion(data)
          setResumen(null)
          setRevelado(false)
          setTotal(data.pendientes)
        }
      } finally {
        setCargando(false)
      }
    },
    [onAviso]
  )

  // Entrar desde el botón "Estudiar" de la biblioteca arranca la sesión sola: el
  // usuario ya eligió qué estudiar allá, hacerlo elegir de nuevo acá sería
  // preguntarle dos veces lo mismo.
  useEffect(() => {
    if (alcance.materiaId || alcance.unidadId) void arrancar(alcance)
    // Sólo al montar o si cambia el alcance con el que se entró.
  }, [alcance, arrancar])

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
  }, [materiaId, avisarError])

  const calificar = useCallback(
    async (g: Grade) => {
      if (!sesion?.actual || !revelado) return
      const { data, error } = await call((api) => api.gradeCard(g))
      avisarError(error)
      if (!data) return

      setRevelado(false)
      if (data.actual === null) {
        const { data: fin } = await call((api) => api.endSession())
        setResumen(fin ?? null)
        setSesion(null)
      } else {
        setSesion(data)
      }
    },
    [sesion, revelado, avisarError]
  )

  const terminar = useCallback(async () => {
    const { data } = await call((api) => api.endSession())
    setResumen(data ?? null)
    setSesion(null)
    setRevelado(false)
  }, [])

  /* -------------------------------- teclado -------------------------------- */

  useEffect(() => {
    if (!sesion?.actual) return

    const alTeclado = (e: KeyboardEvent): void => {
      // Si el foco está en un campo de texto, las teclas son para escribir.
      const activo = document.activeElement?.tagName
      if (activo === 'INPUT' || activo === 'TEXTAREA' || activo === 'SELECT') return

      if (!revelado && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault()
        setRevelado(true)
        return
      }
      if (revelado) {
        if (e.key === '1') void calificar('no')
        else if (e.key === '2') void calificar('masomenos')
        else if (e.key === '3') void calificar('si')
      }
    }

    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [sesion, revelado, calificar])

  /* --------------------------------- vistas -------------------------------- */

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand" />
      </div>
    )
  }

  if (resumen) {
    return <Cierre resumen={resumen} onOtra={() => setResumen(null)} />
  }

  if (sesion?.actual) {
    const hechas = total - sesion.pendientes
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-6 pt-5">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            {/* En repaso libre se dice que lo es y se aclara la consecuencia, acá
                arriba y durante toda la sesión. Si sólo se dijera al elegir, a la
                tarjeta treinta el usuario ya no se acuerda de en qué modo está, y
                la diferencia entre los dos modos es justamente qué pasa después. */}
            {sesion.libre ? (
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand-soft"
                title="No cambia cuándo vuelve cada tarjeta ni gasta el límite del día"
              >
                <Infinito size={12} />
                repaso libre
              </span>
            ) : null}
            <ProgressBar percent={total > 0 ? (hechas / total) * 100 : 0} className="flex-1" />
            <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
              {hechas} / {total}
            </span>
            <Button variant="ghost" onClick={() => void terminar()}>
              Terminar
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="text-[11px] text-ink-faint">
                {sesion.actual.materiaNombre} · {sesion.actual.unidadNombre}
              </span>
              {sesion.actual.esNueva ? <Chip tone="brand">nueva</Chip> : null}
            </div>

            <div className="rounded-2xl border border-line-strong bg-surface p-8">
              <p className="selectable text-center text-lg leading-relaxed font-medium">{sesion.actual.frente}</p>

              {revelado ? (
                <>
                  <div className="my-6 border-t border-line" />
                  {/*
                    Tres cosas de este className son la anatomía del dorso, no estilo:

                    · `whitespace-pre-line` — el dorso se escribe en hasta cuatro
                      renglones con un orden fijo (respuesta / porqué / consecuencia /
                      fuente). Sin esto el navegador los colapsa en un solo párrafo y
                      TODA la anatomía deja de verse: el que revela ya no encuentra la
                      respuesta de un vistazo, que es lo único que la tarjeta tiene que
                      lograr.
                    · sin `text-center` — 400 caracteres centrados obligan al ojo a
                      buscar dónde empieza cada renglón. A la izquierda se leen de una.
                    · sin `text-ink-dim` — la respuesta es lo más importante de la
                      pantalla y estaba más apagada que la pregunta.
                  */}
                  <p className="selectable animate-in-up text-[15px] leading-relaxed whitespace-pre-line">
                    {sesion.actual.dorso}
                  </p>

                  {/* La fuente va abajo, chica y en gris: está para poder verificar
                      el dato, no para aprendérsela. Cuando compartía renglón con el
                      dorso, el estudiante la leía como si fuera parte de la respuesta. */}
                  {sesion.actual.fuente ? (
                    <p className="selectable animate-in-up mt-4 text-[12px] leading-snug text-ink-faint">
                      {sesion.actual.fuente}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            {revelado ? (
              <div className="animate-in-up mt-6 grid grid-cols-3 gap-3">
                {BOTONES.map((b) => (
                  <button
                    key={b.grade}
                    type="button"
                    onClick={() => void calificar(b.grade)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border py-4 text-sm font-semibold transition-colors',
                      b.clase
                    )}
                  >
                    {b.label}
                    <span className="text-[11px] font-normal">tecla {b.atajo}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 text-center">
                <Button variant="primary" size="lg" onClick={() => setRevelado(true)} className="w-full max-w-xs">
                  <Eye size={16} />
                  Mostrar resultado
                </Button>
                <p className="mt-2.5 text-[11px] text-ink-faint">
                  {sesion.libre
                    ? 'Pensá la respuesta antes de mirar · tu calificación acá no cambia el calendario'
                    : 'Pensá la respuesta antes de mirar · barra espaciadora'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* -------------------------- elegir qué estudiar --------------------------- */

  if (materias.length === 0) {
    return (
      <Empty
        icono={<GraduationCap size={40} />}
        titulo="Todavía no hay nada para estudiar"
        bajada="Creá una materia con sus unidades y generá tarjetas desde tus apuntes. Después volvé acá."
      />
    )
  }

  const libre = modo === 'libre'

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="text-lg font-semibold tracking-tight">¿Qué querés repasar?</h2>
      <p className="mt-1 text-[13px] text-ink-faint">Elegí una materia entera o una unidad suelta.</p>

      <div className="mt-4">
        <Segmented options={MODOS} value={modo} onChange={setModo} ariaLabel="Modo de estudio" />
        <p className="mt-2.5 mb-5 max-w-xl text-[12px] leading-relaxed text-ink-faint">{EXPLICACION[modo]}</p>
      </div>

      <div className="space-y-2">
        {materias.map((m) => (
          <div key={m.id} className="rounded-xl border border-line bg-surface">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setMateriaId(materiaId === m.id ? null : m.id)}
                className="min-w-0 flex-1 text-left text-sm font-medium"
              >
                {m.nombre}
              </button>
              <Button variant="primary" onClick={() => void arrancar({ materiaId: m.id, libre })}>
                {libre ? <Infinito size={15} /> : <Target size={15} />}
                {libre ? 'Repasar todo' : 'Estudiar todo'}
              </Button>
            </div>

            {materiaId === m.id && unidades.length > 0 ? (
              <div className="border-t border-line px-4 py-2">
                {unidades.map((u) => (
                  <div key={u.unidad.id} className="flex items-center gap-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">{u.unidad.nombre}</span>
                    {/* En repaso libre estos dos números no significan nada: no se
                        respeta el vencimiento ni se separan las nuevas. Mostrarlos
                        haría pensar que la sesión va a traer eso. */}
                    {!libre && u.dominio.vencidas > 0 ? <Chip tone="warn">{u.dominio.vencidas}</Chip> : null}
                    {!libre && u.dominio.nuevas > 0 ? <Chip tone="brand">{u.dominio.nuevas} nuevas</Chip> : null}
                    {libre ? <Chip>{plural(u.dominio.total, 'tarjeta')}</Chip> : null}
                    <Button onClick={() => void arrancar({ unidadId: u.unidad.id, libre })} disabled={u.dominio.total === 0}>
                      {libre ? 'Repasar' : 'Estudiar'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function Cierre({ resumen, onOtra }: { resumen: SessionSummary; onOtra: () => void }): ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-good/10 text-good">
          <Check size={28} />
        </div>

        <h2 className="text-lg font-semibold tracking-tight">
          {resumen.hechas === 0
            ? 'Sesión cerrada'
            : resumen.libre
              ? `Repaso libre: ${plural(resumen.hechas, 'tarjeta')}`
              : `¡Listo! ${plural(resumen.hechas, 'tarjeta')}`}
        </h2>

        {resumen.hechas > 0 ? (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Marcador valor={resumen.sabidas} label="Las sabía" tono="text-good" />
            <Marcador valor={resumen.masOMenos} label="Más o menos" tono="text-warn" />
            <Marcador valor={resumen.noSabidas} label="No las sabía" tono="text-bad" />
          </div>
        ) : null}

        {/* Tres cierres distintos, porque prometen cosas distintas. El de repaso
            libre NO puede decir "volvé mañana y las que te costaron aparecen
            primero": justamente no se guardó cuáles te costaron. Decirlo sería
            mentir sobre lo único que diferencia a los dos modos. */}
        {resumen.libre ? (
          <p className="mt-5 text-[13px] leading-relaxed text-ink-faint">
            Fue práctica: tu calendario de repasos quedó igual que antes y el límite de hoy sigue entero. Podés volver a
            hacerlo las veces que quieras.
          </p>
        ) : resumen.pendientesPorTope > 0 ? (
          <p className="mt-5 text-[13px] leading-relaxed text-ink-faint">
            Quedaron {plural(resumen.pendientesPorTope, 'tarjeta')} para mañana por el límite diario. Si querés avanzar más
            rápido, subí el ritmo desde la materia — o hacé un repaso libre, que no tiene tope.
          </p>
        ) : (
          <p className="mt-5 text-[13px] leading-relaxed text-ink-faint">
            Por hoy terminaste con esto. Volvé mañana y las que te costaron van a aparecer primero.
          </p>
        )}

        <Button onClick={onOtra} className="mt-6">
          <RotateCcw size={15} />
          Estudiar otra cosa
        </Button>
      </div>
    </div>
  )
}

function Marcador({ valor, label, tono }: { valor: number; label: string; tono: string }): ReactNode {
  return (
    <div className="rounded-xl border border-line bg-surface py-3">
      <div className={cn('text-xl font-semibold tabular-nums', tono)}>{valor}</div>
      <div className="mt-0.5 text-[11px] text-ink-faint">{label}</div>
    </div>
  )
}
