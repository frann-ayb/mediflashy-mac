import { useState, type ReactNode } from 'react'
import { Cpu, WandSparkles } from 'lucide-react'
import { TARJETAS_DISTINTAS_DE_REGALO } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/primitives'

/**
 * El aviso que aparece la primera vez que se abre "Generar".
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * Lo que se vende es el mazo y el repaso. Generar tarjetas con IA es un EXTRA que
 * ya estaba integrado y se deja, pero corre con la potencia de la computadora del
 * comprador: con poca memoria o un procesador viejo, generar es lento, tarda
 * minutos o no termina. Sin este aviso, quien lo vive piensa que la app está rota
 * y pide el reembolso por algo que depende de su equipo.
 *
 * Por eso dice tres cosas, en este orden: qué hace (y que descarga los modelos),
 * que tiene requisitos mínimos y que una demora es casi siempre la computadora, y
 * qué hacer si pasa (cargar las tarjetas a mano, y que el mazo ya viene hecho).
 *
 * Hay que marcar la casilla para usar la función, y queda registrado en
 * `avisoIaAceptado`: aparece una sola vez. Sin marcarla, la salida es volver a la
 * Biblioteca —con el botón, con Escape o tocando afuera—, nunca entrar.
 *
 * Los números (4 y 8 GB de RAM, 1,3 y 2,7 GB de disco) son los de
 * `genModels.ts` y los del anexo de requisitos: si cambian allá, cambian acá.
 */

interface Props {
  onAceptar: () => void
  /** Salir sin aceptar: vuelve a la Biblioteca. */
  onVolver: () => void
}

export function AvisoGenerarModal({ onAceptar, onVolver }: Props): ReactNode {
  const [aceptado, setAceptado] = useState(false)

  return (
    <Modal
      titulo="Antes de generar tarjetas con IA"
      /* xl y texto corto a propósito: tiene que entrar ENTERO en la ventana más
         chica que deja la app (940×660). Si scrollea, el foco cae en la casilla y
         el primer párrafo —lo que más importa leer— queda fuera de la vista. */
      ancho="xl"
      onClose={onVolver}
      acciones={
        <>
          <Button variant="ghost" onClick={onVolver}>
            Volver
          </Button>
          <Button variant="primary" disabled={!aceptado} onClick={onAceptar}>
            Continuar
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="mt-0.5 shrink-0 text-brand-soft">
          <WandSparkles size={22} />
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-[14px] leading-relaxed text-ink-dim">
          <p>
            Esta función <strong>genera flashcards con inteligencia artificial</strong> a partir del contenido que le
            brindes: un apunte, una guía o un texto pegado. Para eso,{' '}
            <strong>los modelos de IA se descargan en tu computadora</strong> (1,3 GB o 2,7 GB, según la calidad) y
            trabajan ahí mismo: tus apuntes no se envían a internet.
          </p>

          <div className="rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Cpu size={16} className="shrink-0 text-warn" />
              Depende de la potencia de tu computadora
            </p>
            <p className="mt-1.5">
              Generar con IA <strong>requiere requisitos mínimos</strong>: al menos <strong>4 GB de RAM</strong> para la
              calidad Rápida y <strong>8 GB</strong> para la Detallada. Con menos memoria, un procesador antiguo o muchos
              programas abiertos, puede ser <strong>lento, demorarse varios minutos o no terminar</strong>. Si eso pasa, lo
              más probable es que se deba a los <strong>recursos de tu computadora</strong> y no a una falla de la app.
            </p>
          </div>

          <p>
            Si notás demoras o no tenés una buena experiencia, te recomendamos{' '}
            <strong>agregar las tarjetas manualmente</strong>: en una unidad de la Biblioteca, tocá «Escribir una
            tarjeta». La app ya trae {TARJETAS_DISTINTAS_DE_REGALO.toLocaleString('es-AR')} tarjetas listas para estudiar;
            la generación con IA es un extra.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line-strong bg-surface-2 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink">
          <input
            type="checkbox"
            checked={aceptado}
            onChange={(e) => setAceptado(e.target.checked)}
            className="size-4 shrink-0 accent-[var(--color-brand)]"
          />
          Aceptar y no volver a mostrar
        </label>
      </div>
    </Modal>
  )
}
