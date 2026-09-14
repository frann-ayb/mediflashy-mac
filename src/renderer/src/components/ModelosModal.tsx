import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Download, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import type { InstalledModel, ModelProgress } from '@shared/types'
import { call } from '@/lib/api'
import { formatBytes, formatEta } from '@/lib/format'
import { Modal } from '@/components/Modal'
import { Button, Chip, ProgressBar } from '@/components/primitives'

/**
 * Los modelos descargados: cuánto ocupan y cómo liberarlos.
 *
 * Existe por una razón concreta de producto, heredada de Convertexto: entre los
 * dos niveles son 4 GB en el disco, y sin esta pantalla la única forma de
 * recuperarlos sería desinstalar la app. Un estudiante con una notebook de 256 GB
 * lo nota.
 *
 * ---------------------------------------------------------------------------
 * Esta pantalla NO depende de Convertexto
 * ---------------------------------------------------------------------------
 *
 * La mayoría de los compradores va a tener sólo Mediflashy y nunca va a instalar
 * la otra app. Para esa persona —el caso normal— acá hay dos filas con
 * "Descargar" y, una vez bajado, "Borrar". Convertexto no aparece en ningún lado.
 *
 * El caso del modelo prestado es una EXCEPCIÓN, no el diseño. Si la otra app del
 * mismo autor ya tiene el mismo GGUF —mismo repo, misma revisión, mismo hash—,
 * Mediflashy lo usa en vez de hacer bajar 2,7 GB por segunda vez.
 *
 * Cuando eso pasa hay dos cosas que la pantalla tiene que resolver, y antes
 * resolvía sólo la primera:
 *
 *  1. No ofrecer "Borrar", porque el archivo es de otro programa y borrarle
 *     archivos a otra app es un destrozo.
 *  2. NO DEJARLO EN UN CALLEJÓN SIN SALIDA. Esa carpeta ajena desaparece si el
 *     usuario desinstala la otra app, así que tiene que poder decir "quiero que
 *     Mediflashy tenga el suyo" con un botón. Después de eso, es un modelo propio
 *     como cualquier otro y se borra desde acá.
 */

interface Props {
  /** Cómo se llama el producto. Sale de `AppInfo`, que lo lee de `app.getName()`. */
  nombre: string
  onClose: () => void
  onAviso: (a: { tone: 'info' | 'warn' | 'error' | 'success'; text: string }) => void
}

export function ModelosModal({ nombre, onClose, onAviso }: Props): ReactNode {
  const [modelos, setModelos] = useState<InstalledModel[]>([])
  const [progreso, setProgreso] = useState<ModelProgress | null>(null)
  const [bajando, setBajando] = useState<string | null>(null)
  /* Cancelar es una decisión del usuario, no una falla. Sin esto, apretar
     "Cancelar la descarga" le devolvía un cartel ROJO de error por haber hecho
     exactamente lo que quería hacer. El flag `canceled` de AppError no sobrevive
     el cruce a `Result`, así que se recuerda de este lado. */
  const canceloUsuario = useRef(false)

  const cargar = useCallback(async () => {
    const { data, error } = await call((api) => api.listModels())
    if (error) onAviso({ tone: 'error', text: error })
    else setModelos(data ?? [])
  }, [onAviso])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const api = window.flashcards
    if (!api) return
    return api.onModelProgress(setProgreso)
  }, [])

  /**
   * Cuál se está bajando AHORA, venga de donde venga.
   *
   * Antes esto era sólo `bajando`, el estado local que se prende al apretar el
   * botón de esta pantalla. Con eso, la descarga que arranca sola adentro de la
   * primera generación —que es la que le pasa a TODO comprador que no tenga la
   * otra app instalada— era invisible acá: sin barra, sin cuánto falta y sin
   * botón de cancelar, mientras la fila seguía ofreciendo "Descargar" y ese click
   * abría un segundo escritor sobre el mismo archivo a medias.
   *
   * El evento de progreso ya trae el nivel, así que alcanza con creerle al evento.
   * `bajando` se conserva sólo para cubrir el cuarto de segundo entre el click y
   * el primer evento.
   */
  const bajandoNivel = progreso !== null && progreso.phase === 'downloading' ? progreso.level : bajando
  const hayDescarga = bajandoNivel !== null

  /* Si la descarga termina con esta pantalla abierta, la lista tiene que
     enterarse: si no, queda mostrando "Descargar" sobre un modelo que ya está. */
  useEffect(() => {
    if (progreso !== null && (progreso.phase === 'ready' || progreso.phase === 'error')) void cargar()
  }, [progreso, cargar])

  const descargar = async (level: InstalledModel['level'], propio = false): Promise<void> => {
    setBajando(level)
    try {
      canceloUsuario.current = false
      const { error } = await call((api) => api.downloadModel(level, propio))
      if (error && canceloUsuario.current) onAviso({ tone: 'info', text: 'Descarga cancelada. Lo que ya bajó queda guardado.' })
      else if (error) onAviso({ tone: 'error', text: error })
      else if (propio) onAviso({ tone: 'success', text: `Listo. Ahora el modelo es de ${nombre} y lo podés borrar desde acá.` })
      else onAviso({ tone: 'success', text: 'Modelo listo.' })
      await cargar()
    } finally {
      setBajando(null)
      setProgreso(null)
    }
  }

  const borrar = async (level: InstalledModel['level']): Promise<void> => {
    const { error } = await call((api) => api.deleteModel(level))
    if (error) onAviso({ tone: 'error', text: error })
    await cargar()
  }

  return (
    <Modal
      titulo="Modelos descargados"
      bajada="El motor que genera las tarjetas. Se descarga una vez y después funciona sin internet."
      ancho="xl"
      onClose={onClose}
      acciones={
        <>
          <Button
            variant="ghost"
            onClick={() => void call((api) => api.revealModelsFolder())}
            className="mr-auto"
          >
            <FolderOpen size={15} />
            Ver la carpeta
          </Button>
          <Button onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      <div className="space-y-3">
        {modelos.map((m) => {
          const bajandoEste = bajandoNivel === m.level
          const p = bajandoEste ? progreso : null

          return (
            <div key={m.level} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.installed ? <Chip tone="good">listo</Chip> : null}
                    {m.borrowed ? <Chip tone="brand">prestado</Chip> : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    {formatBytes(m.sizeBytes)}
                    {m.level === 'rapido' ? ' · anda bien con 4 GB de RAM' : ' · necesita 8 GB de RAM'}
                    {m.partialBytes > 0 ? ` · descarga a medias de ${formatBytes(m.partialBytes)}` : ''}
                  </p>
                </div>

                <div className="shrink-0">
                  {m.installed ? (
                    m.borrowed ? (
                      <Button onClick={() => void descargar(m.level, true)} disabled={hayDescarga}>
                        {bajandoEste ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        {bajandoEste ? 'Bajando…' : 'Bajar mi copia'}
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => void borrar(m.level)}>
                        <Trash2 size={15} />
                        Borrar
                      </Button>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Una descarga a medias ocupa hasta 2,7 GB y hasta acá no había
                          NINGUNA forma de recuperarlos desde la app: el botón de borrar
                          vivía sólo en la rama del modelo instalado. La fila justamente
                          muestra los bytes tirados dos líneas más arriba. */}
                      {m.partialBytes > 0 && !hayDescarga ? (
                        <Button variant="ghost" onClick={() => void borrar(m.level)} title="Borrar lo que quedó a medias">
                          <Trash2 size={15} />
                          Borrar lo bajado
                        </Button>
                      ) : null}
                      <Button variant="primary" onClick={() => void descargar(m.level)} disabled={hayDescarga}>
                        {bajandoEste ? <Loader2 size={15} className="animate-spin" /> : null}
                        {bajandoEste ? 'Bajando…' : m.partialBytes > 0 ? 'Seguir bajando' : 'Descargar'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {p && p.phase === 'downloading' ? (
                <div className="mt-3">
                  <ProgressBar percent={p.percent} />
                  <p className="mt-1.5 text-[11px] tabular-nums text-ink-faint">
                    {formatBytes(p.receivedBytes)} de {formatBytes(p.totalBytes)}
                    {p.bytesPerSecond > 0 ? ` · ${formatEta(p.totalBytes - p.receivedBytes, p.bytesPerSecond)}` : ''}
                  </p>
                </div>
              ) : null}

              {m.borrowed ? (
                <p className="mt-3 text-[11.5px] leading-relaxed text-ink-dim">
                  {nombre} está usando el modelo que ya tenía descargado Convertexto, así te ahorra bajar los
                  mismos {formatBytes(m.sizeBytes)} otra vez. No lo borra desde acá porque el archivo es de esa
                  app. <span className="text-ink">Si desinstalás Convertexto, este modelo se va con ella</span>: para
                  que {nombre} tenga el suyo y no dependa de nada, tocá "Bajar mi copia".
                </p>
              ) : null}
            </div>
          )
        })}

        {hayDescarga ? (
          <Button
            variant="ghost"
            onClick={() => {
              canceloUsuario.current = true
              void call((api) => api.cancelModelDownload())
            }}
          >
            Cancelar la descarga
          </Button>
        ) : null}
      </div>
    </Modal>
  )
}
