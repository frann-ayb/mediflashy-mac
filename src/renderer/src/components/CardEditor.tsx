import { useEffect, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Flashcard } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Button, Textarea } from '@/components/primitives'

/**
 * El editor de una tarjeta.
 *
 * Es UN solo componente para las tres cosas que se hacen con una tarjeta —crear
 * una a mano, corregir una existente y arreglar una que salió de la generación—
 * porque son literalmente la misma operación: escribir un frente y un dorso.
 * Tenerlo tres veces sería tener tres lugares donde el límite de caracteres o el
 * atajo de teclado se pueden desincronizar.
 *
 * El botón de reiniciar el progreso aparece SÓLO al editar una tarjeta que ya
 * tiene historial, y separado de los botones de guardar. La razón es que son dos
 * acciones de peso muy distinto: guardar un cambio de texto es inofensivo y
 * reiniciar el progreso tira a la basura semanas de repasos. Ponerlos juntos
 * invita a un click equivocado.
 */

interface Props {
  /** `null` para crear una nueva. */
  card: Flashcard | null
  titulo: string
  onGuardar: (frente: string, dorso: string) => Promise<void> | void
  onReiniciar?: () => Promise<void> | void
  onClose: () => void
}

const MAX_FRENTE = 400
const MAX_DORSO = 1200

export function CardEditor({ card, titulo, onGuardar, onReiniciar, onClose }: Props): ReactNode {
  const [frente, setFrente] = useState(card?.frente ?? '')
  const [dorso, setDorso] = useState(card?.dorso ?? '')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    setFrente(card?.frente ?? '')
    setDorso(card?.dorso ?? '')
  }, [card])

  const valido = frente.trim().length > 0 && dorso.trim().length > 0
  // Una tarjeta recién creada no tiene nada que reiniciar. `reps > 0` es la
  // pregunta correcta —"¿la respondió alguna vez?"— y no `state !== 0`, porque
  // una tarjeta puede estar en aprendizaje sin haberse contestado todavía.
  const tieneProgreso = (card?.schedule.reps ?? 0) > 0

  const guardar = async (): Promise<void> => {
    if (!valido || guardando) return
    setGuardando(true)
    try {
      await onGuardar(frente.trim(), dorso.trim())
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={titulo}
      bajada="El frente es lo que ves primero; el dorso es lo que se revela."
      ancho="xl"
      onClose={onClose}
      acciones={
        <>
          {tieneProgreso && onReiniciar ? (
            <Button
              variant="ghost"
              onClick={() => void onReiniciar()}
              className="mr-auto"
              title="La tarjeta vuelve a ser nueva y se repasa desde cero"
            >
              <RotateCcw size={15} />
              Reiniciar progreso
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void guardar()} disabled={!valido || guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink-dim">Frente — el concepto o la pregunta</label>
          <Textarea
            value={frente}
            onChange={setFrente}
            ariaLabel="Frente de la tarjeta"
            rows={3}
            maxLength={MAX_FRENTE}
            placeholder="¿Qué es la prescripción adquisitiva?"
          />
          <p className="mt-1 text-right text-[11px] text-ink-faint">
            {frente.length}/{MAX_FRENTE}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-ink-dim">Dorso — la definición o la respuesta</label>
          <Textarea
            value={dorso}
            onChange={setDorso}
            ariaLabel="Dorso de la tarjeta"
            rows={6}
            maxLength={MAX_DORSO}
            placeholder="El modo de adquirir el dominio de una cosa por la posesión continuada durante el tiempo que fija la ley."
          />
          <p className="mt-1 text-right text-[11px] text-ink-faint">
            {dorso.length}/{MAX_DORSO}
          </p>
        </div>

        {tieneProgreso ? (
          <p className="text-[12px] leading-relaxed text-ink-faint">
            Editar el texto no cambia cuándo te toca repasarla. Si la cambiaste tanto que ya es otra tarjeta, usá
            &quot;Reiniciar progreso&quot;.
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
