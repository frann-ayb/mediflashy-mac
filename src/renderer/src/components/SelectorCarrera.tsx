import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, GraduationCap } from 'lucide-react'
import type { Carrera } from '@shared/types'
import { cn } from '@/lib/cn'

/**
 * El selector de carrera de la barra de arriba.
 *
 * ---------------------------------------------------------------------------
 * Por qué la carrera es un FILTRO y no un nivel del árbol
 * ---------------------------------------------------------------------------
 *
 * Lo obvio, teniendo Carrera → Materia → Unidad, sería un árbol de tres niveles
 * plegables en el panel izquierdo. No alcanza, y el motivo es el pedido mismo:
 * que el estudiante vea SU carrera y no las demás.
 *
 * Con un árbol, las otras carreras siguen siendo filas visibles arriba de la
 * suya, siempre a un click de abrirse por error. Y peor: siguen existiendo en
 * todas las otras pantallas. El buscador sigue devolviendo tarjetas de
 * farmacología veterinaria, el progreso sigue promediando sobre un mazo que en
 * su mayoría no cursa, y el selector de "dónde va" al generar sigue ofreciendo
 * las materias de las ocho carreras.
 *
 * "No verlas" traducido a diseño es más fuerte que "tenerlas plegadas": es que
 * dejen de existir para todas las pantallas hasta que el estudiante cambie de
 * carrera a propósito, acá. Por eso el control vive en la barra superior y no
 * adentro de la biblioteca — porque no gobierna la biblioteca, gobierna la app.
 *
 * El árbol, entonces, sigue siendo de dos niveles: materia → unidad. Que es lo
 * que ya funcionaba y ya estaba probado.
 *
 * ---------------------------------------------------------------------------
 * "Todas las carreras" existe a propósito
 * ---------------------------------------------------------------------------
 *
 * No es un modo de administrador ni un resto de implementación: hay gente que
 * cursa dos carreras, gente que se cambió, y gente que quiere ver todo el mazo
 * antes de decidir. Sacarla obligaría a esa persona a cambiar de carrera de ida
 * y de vuelta todo el tiempo.
 */

interface Props {
  carreras: Carrera[]
  /** `null` = todas. */
  activaId: string | null
  onCambiar: (id: string | null) => void
}

export function SelectorCarrera({ carreras, activaId, onCambiar }: Props): ReactNode {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  /* Cerrar al tocar afuera o con Escape. Un menú que sólo se cierra volviendo a
     tocar el botón es de las cosas que se sienten rotas sin saber por qué. */
  useEffect(() => {
    if (!abierto) return
    const afuera = (e: MouseEvent): void => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const escape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  // Con una sola carrera el selector no decide nada: ocupa lugar y ofrece una
  // elección que no existe. Se muestra el nombre y listo.
  if (carreras.length === 0) return null

  const activa = activaId ? (carreras.find((c) => c.id === activaId) ?? null) : null
  const etiqueta = activa?.nombre ?? 'Todas las carreras'

  if (carreras.length === 1) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-ink-dim" title="Tu carrera">
        <GraduationCap size={15} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 max-w-[220px] truncate font-medium">{carreras[0].nombre}</span>
      </div>
    )
  }

  return (
    <div ref={caja} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        title="Elegí qué carrera estás cursando. El resto de la app se filtra por ésta."
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-medium transition-colors',
          abierto ? 'bg-surface-2 text-ink' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
        )}
      >
        <GraduationCap size={15} className="shrink-0 text-ink-faint" />
        {/* El tope de 220 px evita que un nombre larguísimo se coma la barra;
            el `min-w-0` deja que además se recorte cuando la ventana es chica. */}
        <span className="min-w-0 max-w-[220px] truncate">{etiqueta}</span>
        <ChevronDown size={14} className={cn('shrink-0 text-ink-faint transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto ? (
        <div
          role="listbox"
          aria-label="Carrera"
          className="absolute top-full right-0 z-30 mt-1.5 max-h-[60vh] w-[280px] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg"
        >
          {carreras.map((c) => (
            <Opcion
              key={c.id}
              texto={c.nombre}
              elegida={c.id === activaId}
              onClick={() => {
                onCambiar(c.id)
                setAbierto(false)
              }}
            />
          ))}

          <div className="my-1.5 border-t border-line" />

          <Opcion
            texto="Todas las carreras"
            detalle="Para quien cursa más de una, o quiere ver el mazo entero."
            elegida={activaId === null}
            onClick={() => {
              onCambiar(null)
              setAbierto(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function Opcion({
  texto,
  detalle,
  elegida,
  onClick
}: {
  texto: string
  detalle?: string
  elegida: boolean
  onClick: () => void
}): ReactNode {
  return (
    <button
      type="button"
      role="option"
      aria-selected={elegida}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        elegida ? 'bg-surface-2 text-ink' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
      )}
    >
      <Check size={15} className={cn('mt-0.5 shrink-0', elegida ? 'text-brand' : 'text-transparent')} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{texto}</span>
        {detalle ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{detalle}</span> : null}
      </span>
    </button>
  )
}
