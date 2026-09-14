import { useMemo, type ReactNode } from 'react'
import { Copy, Mail } from 'lucide-react'
import type { AppInfo } from '@shared/types'
import { TARJETAS_DISTINTAS_DE_REGALO } from '@shared/types'
import { Button } from '@/components/primitives'
import { Modal } from '@/components/Modal'

/**
 * Qué versión tengo, quién hizo esto y a dónde escribo.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe una pantalla para esto
 * ---------------------------------------------------------------------------
 *
 * El contrato le pide al comprador que, ante cualquier reclamo, informe la
 * versión del programa y adjunte el archivo de registro. Hasta ahora la versión
 * no se mostraba en ningún lado de la interfaz: estaba en el nombre del
 * instalador, que para cuando alguien escribe pidiendo ayuda ya se borró.
 *
 * Y el correo de contacto vivía sólo en los .txt de la entrega. Alguien que
 * instaló la app hace tres meses y tiene un problema no va a buscar la carpeta
 * de descarga: abre el programa. Tiene que poder encontrarlo ahí.
 *
 * ---------------------------------------------------------------------------
 * El botón de copiar
 * ---------------------------------------------------------------------------
 *
 * Copia el bloque técnico entero de una vez. Es para pegarlo en el mail: pedirle
 * a alguien que transcriba a mano una ruta de Windows con acentos y espacios es
 * pedirle que se equivoque, y después el diagnóstico se hace sobre datos malos.
 */

interface Props {
  info: AppInfo | null
  onClose: () => void
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
}

const CORREO = 'infoycontacto.store@gmail.com'
const TITULAR = 'Digiconocimiento'

const PLATAFORMA: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

export function AcercaDeModal({ info, onClose, onAviso }: Props): ReactNode {
  /*
   * El bloque que se copia. Se arma una sola vez y es EXACTAMENTE lo que se ve
   * en pantalla: si alguien pega esto en un mail, lo que llega es lo mismo que
   * el usuario está mirando, sin campos de más ni de menos.
   */
  const paraElMail = useMemo(() => {
    if (!info) return ''
    return [
      `${info.nombre} ${info.version}`,
      `Sistema: ${PLATAFORMA[info.platform] ?? info.platform}`,
      `Motor de generación: ${info.engineReady ? 'disponible' : `no disponible — ${info.engineError ?? 'sin detalle'}`}`,
      `Núcleos en uso: ${info.threads}`,
      `Carpeta de datos: ${info.dataDir}`,
      `Archivo de registro: ${info.logFilePath}`
    ].join('\n')
  }, [info])

  const copiar = (): void => {
    void navigator.clipboard.writeText(paraElMail).then(
      () => onAviso({ tone: 'success', text: 'Copiado. Pegalo en el mail junto con tu consulta.' }),
      () => onAviso({ tone: 'error', text: 'No se pudo copiar. Podés escribir los datos a mano.' })
    )
  }

  return (
    <Modal
      titulo="Sobre esta versión"
      bajada="Los datos del programa y cómo contactarnos."
      onClose={onClose}
      ancho="lg"
      acciones={
        <>
          <Button onClick={copiar}>
            <Copy size={15} />
            Copiar los datos
          </Button>
          <Button variant="primary" onClick={onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Lo que trae la versión, en números que el comprador reconoce de la
            página donde compró. */}
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-ink">{info?.nombre ?? '—'}</span>
            <span className="text-[13px] tabular-nums text-ink-dim">versión {info?.version ?? '—'}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
            Trae {TARJETAS_DISTINTAS_DE_REGALO.toLocaleString('es-AR')} tarjetas de Farmacología, para Medicina y
            Enfermería. Todo el trabajo pasa dentro de tu computadora: no hay cuenta, no hay nube y
            nada de lo tuyo se envía a ningún lado.
          </p>
        </div>

        <Dato etiqueta="Sistema" valor={info ? (PLATAFORMA[info.platform] ?? info.platform) : '—'} />
        <Dato
          etiqueta="Motor de generación"
          valor={info?.engineReady ? 'Disponible' : 'No disponible'}
          nota={info?.engineReady ? undefined : info?.engineError}
        />
        <Dato etiqueta="Núcleos en uso" valor={info ? String(info.threads) : '—'} />
        <Dato etiqueta="Carpeta de datos" valor={info?.dataDir ?? '—'} mono />
        <Dato etiqueta="Archivo de registro" valor={info?.logFilePath ?? '—'} mono />

        {/* Contacto y derechos. Van juntos y al final: es lo que se busca cuando
            algo pasa, y lo que el contrato manda tener a la vista. */}
        <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-ink">
            <Mail size={15} className="text-brand-soft" />
            ¿Necesitás ayuda?
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
            Escribinos a{' '}
            <span className="selectable font-semibold text-ink">{CORREO}</span>. Contanos qué esperabas y qué pasó, y
            adjuntá el archivo de registro: con eso lo podemos diagnosticar.
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-faint">
          © {new Date().getFullYear()} {TITULAR}. Todos los derechos reservados. {info?.nombre ?? 'Este programa'} es un programa con licencia
          de uso personal e intransferible: se te concede el derecho a usarlo, no a copiarlo, distribuirlo, revenderlo ni
          modificarlo. Las condiciones completas están en «Licencia de uso», el archivo que vino con tu descarga.
        </p>
      </div>
    </Modal>
  )
}

function Dato({
  etiqueta,
  valor,
  nota,
  mono
}: {
  etiqueta: string
  valor: string
  nota?: string
  /** Para rutas: en monoespaciado se distingue una l de un 1. */
  mono?: boolean
}): ReactNode {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3 last:border-b-0">
      <span className="text-[13px] text-ink-faint">{etiqueta}</span>
      <span
        className={
          mono
            ? 'selectable max-w-full truncate font-mono text-[11px] text-ink-dim'
            : 'selectable text-[13px] font-medium text-ink'
        }
        title={mono ? valor : undefined}
      >
        {valor}
      </span>
      {nota ? <span className="w-full text-[11px] leading-relaxed text-warn">{nota}</span> : null}
    </div>
  )
}
