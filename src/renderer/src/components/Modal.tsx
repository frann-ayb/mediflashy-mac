import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Diálogo modal reutilizable.
 *
 * El onboarding traía su propio overlay inline, y le faltaban tres cosas que en
 * un modal de decisión sí importan: no atrapa el foco (con Tab se puede salir a
 * los controles de atrás, que están tapados), no cierra con Escape, y al cerrarse
 * no devuelve el foco a donde estaba. Con un modal que pregunta "¿descargo 1,3 GB?"
 * eso deja de ser un detalle: alguien que navega con teclado se pierde.
 *
 * Se escribe una vez acá y lo usan todos.
 */

interface ModalProps {
  titulo: string
  /** Frase bajo el título. */
  bajada?: string
  children: ReactNode
  /** Botones del pie, de izquierda a derecha. */
  acciones: ReactNode
  onClose: () => void
  /** Ancho máximo. `lg` para avisos, `xl` para listas. */
  ancho?: 'lg' | 'xl'
  /**
   * Saca las dos salidas de cortesía: Escape y el clic afuera.
   *
   * Existe para UN caso —la aclaración sobre el contenido que hay que aceptar
   * antes de entrar— y no debería crecer. Un modal del que no se puede salir es
   * lo más cerca que está una app de secuestrar al usuario, y sólo se justifica
   * cuando el propio acto de cerrarlo sin leer es el problema que se quiere
   * evitar. Para todo lo demás, dejar salir es lo correcto.
   *
   * No toca la trampa de foco ni el botón del pie: la salida sigue existiendo,
   * es la del pie, y es la que deja registro.
   */
  bloqueado?: boolean
}

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ titulo, bajada, children, acciones, onClose, ancho = 'lg', bloqueado = false }: ModalProps): ReactNode {
  const id = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previoRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Se recuerda quién tenía el foco para devolvérselo al cerrar.
    previoRef.current = document.activeElement as HTMLElement | null

    const primero = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLES)
    primero?.focus()

    const alTeclado = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!bloqueado) onClose()
        return
      }
      if (e.key !== 'Tab') return

      // Trampa de foco: el ciclo se cierra sobre el diálogo.
      const focusables = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLES) ?? [])]
      if (focusables.length === 0) return
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', alTeclado)
    return () => {
      document.removeEventListener('keydown', alTeclado)
      previoRef.current?.focus?.()
    }
  }, [onClose, bloqueado])

  return (
    <div
      className="animate-overlay fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6 backdrop-blur-[2px]"
      // Click afuera para cerrar, sólo si el click empezó afuera: si no, arrastrar
      // una selección de texto desde adentro y soltar afuera cerraría el diálogo.
      onMouseDown={(e) => {
        if (bloqueado) return
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/*
        `max-h` + scroll interno, con el título y los botones fijos.

        Sin esto, en la ventana más chica que la app permite (900×650) el diálogo
        de modelos se pasaba de alto: el título quedaba cortado arriba y el botón
        de cerrar tocaba el borde de abajo. Y como el overlay no scrollea, no había
        forma de llegar a lo que faltaba. Lo encontró la revisión visual, no una
        prueba: es exactamente la clase de cosa que sólo se ve mirando.
      */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={cn(
          'animate-in-up flex max-h-full w-full flex-col rounded-2xl border border-line-strong bg-surface shadow-[0_28px_70px_-28px_var(--color-shadow)]',
          ancho === 'xl' ? 'max-w-xl' : 'max-w-lg'
        )}
      >
        <div className="shrink-0 px-7 pt-7">
          <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
            {titulo}
          </h2>
          {bajada ? <p className="mt-1 text-[13px] text-ink-faint">{bajada}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">{children}</div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 px-7 pt-1 pb-7">{acciones}</div>
      </div>
    </div>
  )
}
