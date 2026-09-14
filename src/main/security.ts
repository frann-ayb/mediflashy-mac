import { app, session } from 'electron'
import { logger } from './services/core/logger'

/**
 * Content Security Policy y permisos de la ventana.
 *
 * Se aplica siempre (también en desarrollo) para que la política real esté
 * ejercitada durante el desarrollo y no aparezca recién en el instalador. En
 * desarrollo se relaja lo mínimo indispensable para que funcione el recargado en
 * vivo de Vite: sus scripts inyectados y su websocket.
 *
 * ---------------------------------------------------------------------------
 * Es más cerrada que la de Convertexto, y eso es una ventaja de este producto
 * ---------------------------------------------------------------------------
 *
 * Convertexto necesita `media-src 'self' grabacion:` para reproducir las
 * grabaciones del usuario a través de su esquema propio. Flashcards no reproduce
 * nada, así que esa línea no está: no se abre `blob:`, ni `file:`, ni ningún
 * esquema propio.
 *
 * `connect-src 'self'` merece un párrafo. Podría sorprender que la app no
 * necesite hablar con nadie cuando descarga modelos de 2,7 GB desde HuggingFace —
 * y es exactamente el punto: esa descarga la hace el PROCESO PRINCIPAL con
 * `net.request`, no el renderer. La interfaz nunca abre una conexión a internet.
 * Si algún día alguien agrega un `fetch()` en el renderer, la CSP lo bloquea y se
 * entera enseguida, que es lo que se quiere.
 */

const PRODUCCION = [
  "default-src 'self'",
  "script-src 'self'",
  // Los estilos en línea son necesarios para las barras de progreso (style="width: …").
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Nada de multimedia: esta app no reproduce ni graba nada.
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

function politicaDesarrollo(devServerUrl: string): string {
  const websocket = devServerUrl.replace(/^http/, 'ws')
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${devServerUrl}`,
    `style-src 'self' 'unsafe-inline' ${devServerUrl}`,
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self' ${devServerUrl} ${websocket}`,
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
}

export function applyContentSecurityPolicy(): void {
  const devServerUrl = app.isPackaged ? null : (process.env.ELECTRON_RENDERER_URL ?? null)
  const policy = devServerUrl ? politicaDesarrollo(devServerUrl) : PRODUCCION

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    })
  })
}

/**
 * Se rechaza TODO permiso, sin excepciones.
 *
 * Convertexto tiene que dejar pasar `media` para el micrófono y manejar la
 * captura de pantalla. Flashcards no pide ninguna de las dos cosas: lo único que
 * toca del disco del usuario es el apunte que él mismo elige, y eso pasa por el
 * diálogo nativo del proceso principal, no por un permiso del navegador.
 *
 * Un handler que devuelve `false` a todo no es paranoia: es la diferencia entre
 * "esta app no puede acceder a tu cámara" y "esta app no le pide acceso a tu
 * cámara". Lo primero lo garantiza el código; lo segundo es una promesa.
 *
 * `setDisplayMediaRequestHandler(null)` es la forma de decirle a Electron que
 * ningún pedido de captura de pantalla se atienda. Sin esto, en Windows quedaría
 * el comportamiento por defecto de Chromium.
 */
export function denyAllPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_solicitante, permission, callback) => {
    logger.warn('security', `Permiso rechazado: ${permission}.`)
    callback(false)
  })

  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setDisplayMediaRequestHandler(null)
}
