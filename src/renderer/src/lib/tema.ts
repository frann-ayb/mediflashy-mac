import type { Tema } from '@shared/types'

/**
 * Claro u oscuro: quién lo decide y cuándo se aplica.
 *
 * ---------------------------------------------------------------------------
 * Por qué el arranque está acá y no en un <script> de index.html
 * ---------------------------------------------------------------------------
 *
 * Lo natural para que no parpadee sería un script inline en el `<head>`, que
 * corre antes de que se pinte nada. Acá no se puede: la política de seguridad de
 * la app declara `script-src 'self'` (ver `src/main/security.ts`), y un script
 * inline queda bloqueado. Habilitarlo pediría `unsafe-inline` en los scripts, o
 * sea abrir la puerta a la ejecución de cualquier cosa incrustada en el HTML,
 * para arreglar un destello. No vale ni cerca.
 *
 * El parpadeo se resuelve del otro lado y mejor: `BrowserWindow` se crea con el
 * `backgroundColor` del tema guardado y con `show: false` hasta `ready-to-show`.
 * Cuando la ventana aparece, ya está pintada del color correcto.
 *
 * ---------------------------------------------------------------------------
 * Dos memorias para lo mismo, a propósito
 * ---------------------------------------------------------------------------
 *
 * La preferencia vive en la configuración de la app (el proceso principal la
 * escribe en disco y es la fuente de verdad). Pero además se copia a
 * `localStorage`, porque el proceso principal necesita el valor ANTES de crear
 * la ventana y la configuración se lee ahí sin problema — mientras que esta
 * copia le sirve a la interfaz para estampar el tema en el primer instante, sin
 * esperar el viaje de ida y vuelta del IPC. Sin ella, la app abre en oscuro y
 * salta a claro medio segundo después.
 *
 * Si las dos se desincronizan gana la configuración: `App` llama a `aplicar()`
 * apenas la recibe.
 */

const CLAVE = 'psicoflashy:tema'

export type TemaResuelto = 'claro' | 'oscuro'

function prefiereClaro(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches
  } catch {
    // Un entorno sin matchMedia no existe en Electron, pero si existiera, el
    // oscuro es el tema con el que se diseñó la app.
    return false
  }
}

export function resolver(tema: Tema): TemaResuelto {
  if (tema === 'claro') return 'claro'
  if (tema === 'oscuro') return 'oscuro'
  return prefiereClaro() ? 'claro' : 'oscuro'
}

/** Lo último que se eligió, para poder estampar el tema sin esperar al IPC. */
export function guardado(): Tema {
  try {
    const v = localStorage.getItem(CLAVE)
    if (v === 'claro' || v === 'oscuro' || v === 'sistema') return v
  } catch {
    /* modo incógnito o almacenamiento bloqueado: se sigue con el valor por defecto */
  }
  return 'sistema'
}

/** Estampa el tema en el documento y recuerda la elección. */
export function aplicar(tema: Tema): void {
  document.documentElement.setAttribute('data-theme', resolver(tema))
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    /* que no se pueda recordar no es motivo para no aplicarlo */
  }
}

/**
 * Sigue los cambios del sistema mientras la opción elegida sea "sistema".
 *
 * Windows y macOS cambian solos de claro a oscuro al anochecer si el usuario lo
 * configuró así. Sin esto, la app se queda con el tema que tenía cuando se
 * abrió: alguien que la deja abierta toda la tarde ve oscurecerse el sistema
 * entero menos esta ventana.
 */
export function escucharAlSistema(tema: Tema, alCambiar: () => void): () => void {
  if (tema !== 'sistema') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  const manejar = (): void => alCambiar()
  mq.addEventListener('change', manejar)
  return () => mq.removeEventListener('change', manejar)
}
