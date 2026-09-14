import { useEffect, useState, type ReactNode } from 'react'
import type { EstadoMemoria } from '@shared/types'
import { call } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * Un punto de color en la barra de arriba con la memoria libre.
 *
 * POR QUÉ ESTÁ
 * ------------
 * Generar tarjetas necesita unos 2,3 GB. Cuando no los hay, la app no falla:
 * se arrastra, porque el sistema empieza a usar el disco como memoria. Desde
 * afuera eso se ve como "la app se colgó", y el comprador no tiene forma de
 * saber que el problema es que tiene el navegador con veinte pestañas abiertas.
 *
 * Esto se lo muestra ANTES, sin interrumpirlo y sin bloquearle nada. Verde y no
 * dice nada más; rojo y agrega una línea chiquita al lado. Nunca un cartel,
 * nunca un modal: si le tapáramos la pantalla cada vez que la memoria baja,
 * sería peor que el problema.
 */

const CADA = 5000

/** Redondea a un decimal y usa coma, como el resto de la app. */
const gb = (bytes: number): string => (bytes / 1024 ** 3).toFixed(1).replace('.', ',')

const TONO: Record<EstadoMemoria['nivel'], string> = {
  holgado: 'bg-good',
  justo: 'bg-warn',
  escaso: 'bg-bad'
}

function explicacion(m: EstadoMemoria): string {
  const libre = gb(m.libreBytes)
  const total = gb(m.totalBytes)
  const pide = gb(m.necesarioBytes)
  if (m.nivel === 'holgado') {
    return `Memoria RAM libre: ${libre} GB de ${total} GB. Alcanza de sobra para generar tarjetas.`
  }
  if (m.nivel === 'justo') {
    return `Memoria RAM libre: ${libre} GB de ${total} GB. Generar necesita unos ${pide} GB, así que va a entrar justo y puede tardar más de lo normal.`
  }
  return `Memoria RAM libre: ${libre} GB de ${total} GB. Generar necesita unos ${pide} GB. Con esta poca, la generación se vuelve muy lenta. Cerrá el navegador u otros programas y va a andar mucho mejor.`
}

export function IndicadorMemoria(): ReactNode {
  const [mem, setMem] = useState<EstadoMemoria | null>(null)

  useEffect(() => {
    let vivo = true
    const mirar = async (): Promise<void> => {
      const { data } = await call((api) => api.memoria())
      /* Si falla, el indicador simplemente no aparece. Un problema al leer la
         memoria no puede molestar a alguien que está estudiando. */
      if (vivo && data) setMem(data)
    }
    void mirar()
    const t = setInterval(() => void mirar(), CADA)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [])

  if (!mem) return null

  return (
    <div className="flex items-center gap-1.5" title={explicacion(mem)}>
      <span
        aria-hidden
        className={cn('size-2 shrink-0 rounded-full transition-colors', TONO[mem.nivel])}
      />
      <span className="sr-only">{explicacion(mem)}</span>
      {mem.nivel === 'escaso' ? (
        /* La única vez que ocupa espacio. Chiquito, en el tono del aviso y sin
           botón: no hay nada que tocar, es un dato. */
        <span className="text-[11px] leading-none text-bad">Te recomendamos liberar memoria RAM</span>
      ) : null}
    </div>
  )
}
