import { useState, type ReactNode } from 'react'
import { GraduationCap, PencilLine, ShieldCheck, WandSparkles } from 'lucide-react'
import { TARJETAS_DISTINTAS_DE_REGALO } from '@shared/types'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/primitives'

/**
 * Lo primero que ve alguien que acaba de comprar la app.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * Sin esto, el comprador paga, instala, abre, y lo que encuentra es una lista
 * vacía con un botón que dice "Crear mi primera materia". No sabe qué hace la
 * app, no sabe que necesita un apunte, y no sabe que la primera generación
 * descarga un modelo de más de un giga. Las tres cosas se descubren tropezando.
 *
 * El orden importa: primero QUÉ hace, después CÓMO se estudia, después la
 * promesa de privacidad, y al final la aclaración sobre el contenido — que es
 * la única que le pide algo de vuelta.
 *
 * ---------------------------------------------------------------------------
 * Por qué el último paso BLOQUEA
 * ---------------------------------------------------------------------------
 *
 * Es el único lugar de toda la app que no deja seguir hasta que el usuario hace
 * algo, y la excepción está pensada.
 *
 * Un mazo de farmacología escrito con ayuda de inteligencia artificial puede
 * tener un error, y quien lo compra tiene derecho a saberlo ANTES de estudiar,
 * no cuando lo descubre. Decirlo sólo en el contrato —que casi nadie abre— es
 * cumplir con la letra y no con lo que importa: que el estudiante contraste los
 * datos críticos y sepa que la tarjeta se edita en dos clics.
 *
 * Por eso no alcanza con mostrarlo: hay que poder afirmar que se mostró. El
 * casillero deja registro en `avisoAceptado`, y mientras esté en `false` el
 * modal no se cierra ni con Escape ni con un clic afuera. Un aviso que se puede
 * saltear sin leer no es un aviso, es un trámite.
 *
 * El tono es a propósito amable y no legal: la aclaración tiene que leerse, y un
 * párrafo con mayúsculas y "EL LICENCIANTE NO SE RESPONSABILIZA" se saltea
 * entero. Lo que buscamos es que entienda, no que se rinda.
 */

interface Props {
  /**
   * Si ya vio la presentación en una versión anterior.
   *
   * Cuando es `true` el modal abre DIRECTO en la aclaración. Alguien que ya usó
   * la app y sólo tiene pendiente aceptar no debería tener que pasar otra vez
   * por tres pantallas que ya leyó: eso convierte el aviso en un peaje molesto,
   * y lo que se lee con fastidio no se lee.
   */
  yaVioLaGira: boolean
  /** Se llama sólo cuando aceptó. No hay otra salida del modal. */
  onAceptar: () => void
}

interface Paso {
  icono: ReactNode
  titulo: string
  cuerpo: ReactNode
}

const PASOS: Paso[] = [
  {
    icono: <WandSparkles size={22} />,
    titulo: 'Tus apuntes se convierten en tarjetas',
    cuerpo: (
      <>
        <p>
          Pegás el texto de un apunte —o cargás un PDF, un Word o un PowerPoint— y la app arma tarjetas de estudio: adelante
          el concepto o la pregunta, atrás la respuesta.
        </p>
        <p className="mt-3">
          Las escribe una inteligencia artificial, así que <strong>siempre te las muestra antes de guardarlas</strong> para que
          las revises. Esa revisión no es un trámite: es lo que separa estudiar bien de memorizar algo equivocado.
        </p>
      </>
    )
  },
  {
    icono: <GraduationCap size={22} />,
    titulo: 'Después te las va tomando',
    cuerpo: (
      <>
        <p>
          Leés el frente, <strong>respondés en tu cabeza</strong>, y recién ahí mostrás el resultado. Te calificás con tres
          botones: no la sabía, más o menos, la sabía.
        </p>
        <p className="mt-3">
          Según lo que elijas, la app decide cuándo volver a mostrártela. Las que te cuestan vuelven seguido; las que ya sabés,
          cada vez más espaciadas. Así estudiás menos y te acordás más.
        </p>
      </>
    )
  },
  {
    icono: <ShieldCheck size={22} />,
    titulo: 'Todo pasa en tu computadora',
    cuerpo: (
      <>
        <p>
          Tus apuntes y tus tarjetas no se suben a ningún lado. No hay cuenta que crear ni servidor que los reciba.
        </p>
        <p className="mt-3">
          La <strong>primera vez</strong> que generes, la app descarga el modelo de inteligencia artificial (1,3 GB). Es una
          sola vez y necesita internet sólo para eso: después funciona hasta en modo avión.
        </p>
      </>
    )
  },
  {
    icono: <PencilLine size={22} />,
    titulo: 'Una aclaración, y algo que te conviene saber',
    cuerpo: (
      <>
        <p>
          Las {TARJETAS_DISTINTAS_DE_REGALO.toLocaleString('es-AR')} tarjetas que vienen cargadas se escribieron con ayuda de
          inteligencia artificial y después se verificaron contra bibliografía y fuentes oficiales. Aun así, en un mazo de
          este tamaño <strong>puede quedar un error</strong>, o faltar el detalle que tu cátedra pide de otra manera.
        </p>
        <p className="mt-3">
          Por eso, antes de usar un dato crítico —una dosis, una interacción, una contraindicación—{' '}
          <strong>contrastalo</strong> con el prospecto, el Formulario Terapéutico Nacional o el material de tu cátedra. Es
          el mismo cuidado que tendrías con cualquier apunte.
        </p>
        <p className="mt-3">
          Y la buena noticia: <strong>todas las tarjetas se editan</strong>. Si ves algo que no cierra o que falta, abrís la
          tarjeta, lo corregís y queda arreglado para siempre. Son tuyas.
        </p>
      </>
    )
  }
]

/** El índice del paso que pide la aceptación: siempre el último. */
const PASO_AVISO = PASOS.length - 1

export function BienvenidaModal({ yaVioLaGira, onAceptar }: Props): ReactNode {
  const [paso, setPaso] = useState(yaVioLaGira ? PASO_AVISO : 0)
  const [aceptado, setAceptado] = useState(false)

  const actual = PASOS[paso]
  const enAviso = paso === PASO_AVISO
  const puedeSeguir = !enAviso || aceptado

  return (
    <Modal
      titulo={actual.titulo}
      ancho="lg"
      /*
       * Sin salida hasta que acepte. `onClose` igual apunta a `onAceptar` por si
       * alguna vez se desbloquea: dejarlo en un `() => {}` sería sembrar un modal
       * imposible de cerrar el día que alguien saque el `bloqueado`.
       */
      bloqueado
      onClose={onAceptar}
      acciones={
        <>
          {/* Los puntitos van a la izquierda del pie: dicen cuánto falta sin
              agregar un renglón de texto, y dejan los botones donde el ojo ya
              los busca. */}
          <div className="mr-auto flex items-center gap-1.5" aria-hidden>
            {PASOS.map((p, i) => (
              <span
                key={p.titulo}
                className={`size-1.5 rounded-full transition-colors ${i === paso ? 'bg-brand' : 'bg-line-strong'}`}
              />
            ))}
          </div>

          {paso > 0 && !yaVioLaGira ? (
            <Button variant="ghost" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
          ) : null}

          <Button
            variant="primary"
            disabled={!puedeSeguir}
            onClick={() => (enAviso ? onAceptar() : setPaso(paso + 1))}
          >
            {enAviso ? 'Entendido, empecemos' : 'Siguiente'}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="mt-0.5 shrink-0 text-brand-soft">{actual.icono}</div>
        <div className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-dim">{actual.cuerpo}</div>
      </div>

      {enAviso ? (
        <div className="mt-6 rounded-xl border border-line-strong bg-surface-2 p-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-ink-dim">
            <input
              type="checkbox"
              checked={aceptado}
              onChange={(e) => setAceptado(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
            />
            <span>
              Lo entendí: voy a <strong>verificar los datos críticos</strong> antes de usarlos, y sé que puedo{' '}
              <strong>editar cualquier tarjeta</strong> si encuentro un error o algo que falte.
            </span>
          </label>

          {/* Sólo aparece si todavía no marcó. Un cartel permanente al lado de un
              casillero ya marcado sería ruido, y uno que aparece justo cuando
              hace falta explica por qué el botón está apagado. */}
          {!aceptado ? (
            <p className="mt-2.5 pl-[26px] text-[12px] text-ink-faint">Marcá la casilla para entrar a la app.</p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
