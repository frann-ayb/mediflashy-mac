import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarClock,
  ChartColumn,
  CirclePlay,
  Flame,
  GraduationCap,
  HardDrive,
  Infinity as Infinito,
  Target,
  TrendingDown
} from 'lucide-react'
import type { AppInfo, MateriaResumen, Progreso, Sugerencia } from '@shared/types'
import { call } from '@/lib/api'
import { cn } from '@/lib/cn'
import { plural } from '@/lib/format'
import { Button, Chip, Empty, Meter, Segmented } from '@/components/primitives'

/**
 * Cuánto sabe el usuario, por materia y en total.
 *
 * ---------------------------------------------------------------------------
 * Qué se muestra y qué se decidió NO mostrar
 * ---------------------------------------------------------------------------
 *
 * Hay tres números arriba —racha, repasos de hoy y retención—, la sugerencia de
 * qué hacer ahora, y una barra por materia. La tentación en una app de repaso es
 * llenar esto de gráficos por día, mapas de calor y proyecciones, y todo eso
 * tiene el mismo problema: son lindos y no cambian ninguna decisión. Las únicas
 * dos preguntas que el usuario se hace acá son "¿cómo vengo?" y "¿qué estudio
 * ahora?", así que todo lo que hay contesta una de las dos.
 *
 * La retención puede venir en `null` y entonces no se muestra. Es deliberado: un
 * 100 % calculado sobre tres respuestas es peor que no mostrar nada, porque el
 * usuario le cree.
 *
 * ---------------------------------------------------------------------------
 * El orden de las materias
 * ---------------------------------------------------------------------------
 *
 * Por defecto van de más floja a más firme, no en el orden en que se crearon.
 * Con catorce materias, una lista en orden de creación obliga a comparar catorce
 * porcentajes a ojo para contestar "¿cuál tengo peor?", que es exactamente la
 * pregunta que esta pantalla existe para contestar.
 *
 * Las que no empezó van al final, y no adelante. Ordenadas por porcentaje puro
 * irían primeras —todas en 0 %— y la lista diría que lo más flojo del mazo es
 * justo aquello que el usuario nunca tocó. Es cierto y es inútil: lo que necesita
 * saber es cuál de las que estudia se le está escapando.
 */

interface Props {
  info: AppInfo | null
  /**
   * El progreso se calcula DENTRO de la carrera activa.
   *
   * Sin esto, quien cursa una sola carrera leería un porcentaje promediado sobre
   * el mazo de todas —un número que no significa nada— y recibiría sugerencias
   * de estudiar materias de carreras que no cursa.
   */
  carreraActivaId: string | null
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
  onEstudiar: (scope: { materiaId: string | null; unidadId: string | null; libre?: boolean }) => void
}

type Orden = 'flojas' | 'creacion'

const ORDENES = [
  { value: 'flojas' as const, label: 'Más flojas primero' },
  { value: 'creacion' as const, label: 'Como las creé' }
]

/** Ver el comentario del encabezado: empezadas primero, y ahí sí por flojera. */
function porFlojera(a: MateriaResumen, b: MateriaResumen): number {
  const aEmp = a.empezadas > 0
  const bEmp = b.empezadas > 0
  if (aEmp !== bEmp) return aEmp ? -1 : 1
  if (aEmp) return (a.porcentajeEmpezadas ?? 100) - (b.porcentajeEmpezadas ?? 100)
  return b.dominio.total - a.dominio.total
}

export function ProgresoView({ info, carreraActivaId, onAviso, onEstudiar }: Props): ReactNode {
  const [datos, setDatos] = useState<Progreso | null>(null)
  const [orden, setOrden] = useState<Orden>('flojas')

  const cargar = useCallback(async () => {
    const { data, error } = await call((api) => api.getProgress(carreraActivaId))
    if (error) onAviso({ tone: 'error', text: error })
    else setDatos(data)
  }, [onAviso])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const api = window.flashcards
    if (!api) return
    return api.onLibraryChanged(() => void cargar())
  }, [cargar])

  // `useMemo` va antes de cualquier salida temprana: los hooks no pueden quedar
  // detrás de un `return`, y abajo hay dos.
  const materiasOrdenadas = useMemo(() => {
    if (!datos) return []
    return orden === 'creacion' ? datos.materias : [...datos.materias].sort(porFlojera)
  }, [datos, orden])

  if (!datos) return null

  if (datos.global.total === 0) {
    return (
      <Empty
        icono={<ChartColumn size={40} />}
        titulo="Todavía no hay nada que medir"
        bajada="Cuando tengas tarjetas y empieces a repasarlas, acá vas a ver cuánto sabés de cada materia."
      />
    )
  }

  const paraRepasar = datos.materias.reduce((n, m) => n + m.dominio.vencidas, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="grid grid-cols-3 gap-3">
        <Tarjeta
          icono={<Flame size={16} />}
          valor={datos.racha === 0 ? '—' : String(datos.racha)}
          label={datos.racha === 1 ? 'día seguido' : 'días seguidos'}
          tono="text-warn"
        />
        <Tarjeta icono={<GraduationCap size={16} />} valor={String(datos.hoy)} label="repasos hoy" tono="text-brand-soft" />
        <Tarjeta
          icono={<Target size={16} />}
          valor={datos.retencion30d === null ? '—' : `${datos.retencion30d}%`}
          label="acertás al repasar"
          nota={datos.retencion30d === null ? 'todavía sin datos' : undefined}
          tono="text-good"
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Todo junto</h2>
          <span className="text-2xl font-semibold tabular-nums">{datos.global.porcentaje}%</span>
        </div>
        <Meter percent={datos.global.porcentaje} total={datos.global.total} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{plural(datos.global.total, 'tarjeta')}</Chip>
          {datos.global.nuevas > 0 ? <Chip tone="brand">{datos.global.nuevas} sin ver</Chip> : null}
          {paraRepasar > 0 ? <Chip tone="warn">{paraRepasar} para repasar</Chip> : null}
          {datos.global.aprendidas > 0 ? <Chip tone="good">{plural(datos.global.aprendidas, 'aprendida')}</Chip> : null}
        </div>
        {/* Se explica qué mide el número. Sin esto, "62%" puede leerse como "acerté
            el 62% de las veces", que es otra cosa y bastante más pesimista. */}
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          El porcentaje es cuánto de tu mazo está en la memoria de largo plazo. Sube a medida que acertás una tarjeta con
          intervalos cada vez más largos.
        </p>
      </div>

      <Recomendaciones sugerencias={datos.sugerencias} onEstudiar={onEstudiar} />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Por materia</h2>
          {datos.materias.length > 1 ? (
            <Segmented options={ORDENES} value={orden} onChange={setOrden} ariaLabel="Cómo ordenar las materias" />
          ) : null}
        </div>
        <div className="space-y-2">
          {materiasOrdenadas.map((m, i) => (
            <div key={m.materia.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.materia.nombre}</span>
                    {/* El cartel de "la más floja" sólo aparece cuando la lista está
                        ordenada por flojera Y hay con qué comparar: en la primera
                        materia que uno empieza, decirle que es la más floja de todas
                        es verdad y no significa nada. */}
                    {orden === 'flojas' && i === 0 && m.empezadas > 0 && materiasOrdenadas.filter((x) => x.empezadas > 0).length > 1 ? (
                      <Chip tone="bad">la que tenés más floja</Chip>
                    ) : null}
                    {m.dominio.vencidas > 0 ? <Chip tone="warn">{m.dominio.vencidas} para repasar</Chip> : null}
                    {m.empezadas === 0 && m.dominio.total > 0 ? <Chip>sin empezar</Chip> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {plural(m.unidades, 'unidad', 'unidades')} · {plural(m.dominio.total, 'tarjeta')}
                    {m.unidadFloja ? ` · más floja: ${m.unidadFloja.nombre} (${m.unidadFloja.porcentaje}%)` : ''}
                  </p>
                </div>

                <span className="shrink-0 text-lg font-semibold tabular-nums">
                  {m.dominio.total > 0 ? `${m.dominio.porcentaje}%` : '—'}
                </span>

                <Button onClick={() => onEstudiar({ materiaId: m.materia.id, unidadId: null })} disabled={m.dominio.total === 0}>
                  Estudiar
                </Button>
              </div>

              <Meter percent={m.dominio.porcentaje} total={m.dominio.total} className="mt-2.5" />
            </div>
          ))}
        </div>
      </div>

      <Respaldo info={info} />
    </div>
  )
}

/**
 * Qué conviene estudiar ahora.
 *
 * ---------------------------------------------------------------------------
 * Por qué cada motivo tiene su propio botón
 * ---------------------------------------------------------------------------
 *
 * Las tres sugerencias no se resuelven de la misma manera, y el botón tiene que
 * llevar a la acción que efectivamente sirve:
 *
 *  · **vencidas** → sesión normal. Es lo que el algoritmo dice que toca.
 *  · **floja** → REPASO LIBRE, y esto es lo importante. Si una materia está
 *    floja pero no le vence nada hoy, la sesión normal contesta "no hay nada
 *    para repasar". Un botón que recomienda algo y después dice que no hay nada
 *    que hacer es peor que no recomendar nada.
 *  · **sin-empezar** → sesión normal, que es donde entran las nuevas.
 */
function Recomendaciones({
  sugerencias,
  onEstudiar
}: {
  sugerencias: Sugerencia[]
  onEstudiar: Props['onEstudiar']
}): ReactNode {
  if (sugerencias.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Qué te conviene ahora</h2>
      <div className="space-y-2">
        {sugerencias.map((s) => (
          <Sugerida key={`${s.motivo}-${s.materiaId}`} s={s} onEstudiar={onEstudiar} />
        ))}
      </div>
    </div>
  )
}

function Sugerida({ s, onEstudiar }: { s: Sugerencia; onEstudiar: Props['onEstudiar'] }): ReactNode {
  const contenido =
    s.motivo === 'vencidas'
      ? {
          icono: <CalendarClock size={16} />,
          tono: 'text-warn',
          titulo: `Empezá por ${s.materiaNombre}`,
          texto: `${plural(s.cantidad, 'tarjeta')} de esta materia te vencen hoy. Son las que estás por olvidar, así que es lo que más rinde hacer ahora.`,
          boton: 'Estudiar',
          scope: { materiaId: s.materiaId, unidadId: null }
        }
      : s.motivo === 'floja'
        ? {
            icono: <TrendingDown size={16} />,
            tono: 'text-bad',
            titulo: `${s.materiaNombre} es la que tenés más floja`,
            texto: s.unidadNombre
              ? `Donde peor estás es en ${s.unidadNombre}: ${s.porcentaje}%. Hoy no te vence nada ahí, así que la forma de reforzarla es un repaso libre — pasás las tarjetas sin que se altere el calendario.`
              : `Vas ${s.porcentaje}% de lo que ya empezaste. Hoy no te vence nada, así que la forma de reforzarla es un repaso libre.`,
            boton: 'Repaso libre',
            scope: { materiaId: s.unidadId ? null : s.materiaId, unidadId: s.unidadId, libre: true }
          }
        : {
            icono: <CirclePlay size={16} />,
            tono: 'text-brand-soft',
            titulo: `${s.materiaNombre} está sin empezar`,
            texto: `Tiene ${plural(s.cantidad, 'tarjeta')} que todavía no viste ni una vez.`,
            boton: 'Empezar',
            scope: { materiaId: s.materiaId, unidadId: null }
          }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className={cn('mt-0.5 shrink-0', contenido.tono)}>{contenido.icono}</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold tracking-tight">{contenido.titulo}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-faint">{contenido.texto}</p>
      </div>
      <Button variant="primary" onClick={() => onEstudiar(contenido.scope)} className="mt-0.5 shrink-0">
        {s.motivo === 'floja' ? <Infinito size={15} /> : <Target size={15} />}
        {contenido.boton}
      </Button>
    </div>
  )
}

/**
 * Dónde están sus datos y cómo hacer una copia.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto está en la app y no sólo en el manual
 * ---------------------------------------------------------------------------
 *
 * La app NO hace copias de seguridad, y así está declarado en el anexo del
 * contrato. Esa es una decisión defendible para un MVP; lo que no es defendible es
 * declararla y no darle al usuario forma de protegerse.
 *
 * Alguien que estudió seis meses tiene acá adentro algo que no existe en ningún
 * otro lado. Decirle "copiá la carpeta de datos" sin decirle cuál es, y sin un
 * botón para llegar, es pedirle que se defienda con las manos atadas.
 *
 * Va en Progreso y no escondido en un menú porque es la pantalla que mira quien ya
 * lleva tiempo usando la app — o sea, exactamente quien más tiene para perder.
 */
function Respaldo({ info }: { info: AppInfo | null }): ReactNode {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <HardDrive size={16} className="mt-0.5 shrink-0 text-ink-faint" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Hacé una copia de tus tarjetas</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
            La app no hace copias de seguridad sola. Todo lo tuyo —materias, tarjetas e historial de repasos— vive en una
            carpeta de tu computadora: copiala de vez en cuando a un pendrive o a la nube, y no perdés nada aunque formatees.
          </p>
          {info?.dataDir ? (
            <p className="selectable mt-2 truncate font-mono text-[11px] text-ink-faint" title={info.dataDir}>
              {info.dataDir}
            </p>
          ) : null}
        </div>
        <Button onClick={() => void call((api) => api.openDataFolder())} className="shrink-0">
          Abrir la carpeta
        </Button>
      </div>
    </div>
  )
}

function Tarjeta({
  icono,
  valor,
  label,
  tono,
  nota
}: {
  icono: ReactNode
  valor: string
  label: string
  tono: string
  /** Aclaración cuando el número todavía no significa nada. */
  nota?: string
}): ReactNode {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className={cn('mb-1.5', tono)}>{icono}</div>
      <div className="text-2xl font-semibold tabular-nums">{valor}</div>
      {/* La etiqueta dice SIEMPRE qué mide el número, aunque no haya número. Si
          cambiara a "sin datos aún" cuando falta el dato, el usuario nunca llega a
          enterarse de qué iba a mostrarle esa tarjeta. */}
      <div className="mt-0.5 text-[11px] text-ink-faint">{label}</div>
      {nota ? <div className="mt-0.5 text-[10px] text-ink-faint">{nota}</div> : null}
    </div>
  )
}
