import { BrowserWindow, app, dialog, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import type { Tema } from '@shared/types'
import { ConfigStore } from './services/core/config'
import { cancelRunningGeneration, engineCheck, isGenerating, registerIpc } from './ipc'
import { applyContentSecurityPolicy, denyAllPermissions } from './security'
import { cleanStaleTemps, configFile, configureUserDataDir, logsDir, takeNotices } from './services/core/paths'
import { stopServer, stopServerSync, sweepOrphanServer } from './services/core/llamaServer'
import { logger } from './services/core/logger'
import { load as loadLibrary, sembrarSiEstaVacio } from './services/deckStore'
import { init as initReviewLog } from './services/reviewLog'
import { idsVivos } from './services/stats'
import { isActive as sesionActiva, end as endSesion } from './services/studySession'

/**
 * Proceso principal.
 *
 * Regla de oro del producto, heredada de Convertexto: la app no se cierra sola
 * nunca. Toda excepción no controlada se loguea y, si hace falta, se muestra como
 * diálogo, pero la ventana sigue viva.
 */

const MIN_WIDTH = 940
const MIN_HEIGHT = 660

// Carpeta de datos propia, separada de la de Convertexto. Se fija antes de
// `whenReady` porque después ya hay rutas resueltas. Por qué el nombre no puede
// coincidir está en paths.ts, y es la parte que no hay que tocar.
configureUserDataDir()

let mainWindow: BrowserWindow | null = null
let quitConfirmed = false

/* --------------------------- red de contención --------------------------- */

process.on('uncaughtException', (err) => {
  logger.error('main', 'Excepción no controlada en el proceso principal.', err)
  showProblemDialog(err instanceof Error ? err.message : String(err))
})

process.on('unhandledRejection', (reason) => {
  logger.error('main', 'Promesa rechazada sin manejar.', reason)
})

let dialogOpen = false
function showProblemDialog(detail: string): void {
  if (dialogOpen || !app.isReady()) return
  dialogOpen = true
  const options = {
    type: 'error' as const,
    title: 'Mediflashy',
    message: 'Ocurrió un problema inesperado, pero la app sigue abierta.',
    detail: `Tus tarjetas están guardadas. Podés seguir usándola normalmente; si el problema se repite, mandá el archivo de registro.\n\n${detail.slice(0, 500)}`,
    buttons: ['Entendido', 'Ver el registro'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  }
  const choice =
    mainWindow && !mainWindow.isDestroyed() ? dialog.showMessageBoxSync(mainWindow, options) : dialog.showMessageBoxSync(options)
  if (choice === 1) void shell.openPath(logsDir())
  dialogOpen = false
}

/* -------------------------------- ventana -------------------------------- */

/**
 * El color con el que se pinta la ventana ANTES de que exista la interfaz.
 *
 * Es lo único que evita el destello al abrir: la ventana nace de este color, se
 * queda oculta hasta `ready-to-show`, y para cuando aparece la interfaz ya está
 * dibujada encima. El renderer no puede hacerlo —su primer fotograma es
 * posterior— y un script inline en el HTML lo prohíbe la política de seguridad
 * (`script-src 'self'`).
 *
 * ESTOS DOS VALORES SON UNA COPIA de `--color-canvas` de `index.css`, uno por
 * tema. No hay forma de compartirlos: acá no hay CSS. Si allá cambia el fondo,
 * cambiarlo también acá, o la app abre de un color y se pinta de otro.
 */
const FONDO: Record<'claro' | 'oscuro', string> = {
  oscuro: '#08100f',
  claro: '#f2f7f5'
}

function fondoDe(tema: Tema): string {
  if (tema === 'claro') return FONDO.claro
  if (tema === 'oscuro') return FONDO.oscuro
  return nativeTheme.shouldUseDarkColors ? FONDO.oscuro : FONDO.claro
}

function createWindow(tema: Tema): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: fondoDe(tema),
    autoHideMenuBar: true,
    title: 'Mediflashy',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 18, y: 20 } }
      : {}),
    icon: process.platform === 'linux' ? join(__dirname, '../../build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false
      // Sin `backgroundThrottling: false`. Convertexto lo necesita porque graba con
      // la ventana minimizada y Chromium le congelaría el cronómetro y los
      // medidores de nivel. Acá no hay nada que siga corriendo en la interfaz con
      // la ventana oculta: la generación pasa entera en el proceso principal, así
      // que dejar el ahorro de energía activado es gratis.
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Nada de navegación ni ventanas externas: los links van al navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDevServer = process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL)
    if (!isDevServer) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })

  // Si el proceso de la interfaz muere, se recarga en lugar de dejar una ventana negra.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('main', `El proceso de la interfaz terminó (${details.reason}).`, details)
    if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload()
    }
  })

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('main', 'La interfaz dejó de responder.')
  })

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error('main', `Error al cargar el preload (${preloadPath}).`, error)
  })

  /**
   * Cerrar en medio de una generación se pregunta; cerrar en medio de una sesión
   * de estudio NO.
   *
   * La diferencia es qué se pierde. Una generación son varios minutos de CPU y, si
   * se corta, no queda nada. Una sesión de estudio guarda cada respuesta en el
   * momento en que se aprieta el botón: cerrar la app no pierde absolutamente
   * nada, y preguntar "¿seguro?" sugeriría que sí, que es peor que no preguntar.
   */
  mainWindow.on('close', (event) => {
    if (quitConfirmed || !isGenerating()) return

    event.preventDefault()
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'question',
      title: 'Mediflashy',
      message: 'Se están generando tarjetas.',
      detail: 'Si cerrás ahora se cancela y las tarjetas de este apunte no se van a crear. Lo que ya tenías guardado no se toca.',
      buttons: ['Seguir generando', 'Cancelar y cerrar'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (choice === 1) {
      quitConfirmed = true
      cancelRunningGeneration()
      mainWindow?.destroy()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/* ------------------------------- arranque -------------------------------- */

// Una sola instancia. Dos ventanas escribiendo los mismos archivos de mazos sería
// una fuente de corrupción difícil de diagnosticar: las dos tienen la biblioteca
// en memoria y la última que guarda pisa a la otra.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(
    () => {
      logger.init(logsDir())
      logger.info('main', `${app.getName()} ${app.getVersion()} — ${process.platform}/${process.arch}, Electron ${process.versions.electron}.`)
      for (const notice of takeNotices()) logger.warn('paths', notice)

      cleanStaleTemps()
      // Si la sesión anterior terminó mal (cierre desde el Administrador de tareas,
      // corte de luz), puede haber quedado un motor vivo ocupando 1,7 GB de RAM sin
      // ventana que lo explique.
      sweepOrphanServer()

      const engine = engineCheck()
      if (!engine.ready) logger.error('main', `Motor no disponible: ${engine.error}`)

      // El orden importa: primero la biblioteca, porque el historial necesita saber
      // qué tarjetas siguen vivas para poder compactarse.
      loadLibrary()
      // Los mazos de regalo, si es el primer arranque. Va DESPUÉS de cargar la
      // biblioteca —necesita saber si está vacía— y ANTES del historial, que se
      // compacta contra la lista de tarjetas vivas.
      sembrarSiEstaVacio()
      initReviewLog(idsVivos)

      const config = new ConfigStore(configFile())

      /*
       * Una instalación nueva arranca en "todas las carreras", que es el `null`
       * de fábrica, y no se toca acá.
       *
       * Hubo una versión que al primer arranque fijaba la primera carrera
       * sembrada. La razón era real —sin carrera activa, «Nueva materia» no
       * sabía dónde poner la materia y se negaba a crearla— pero la solución
       * estaba en el lugar equivocado: tapaba un agujero de la interfaz
       * cambiándole al usuario una preferencia suya, y de paso decidía por un
       * estudiante de Enfermería que lo suyo era Medicina, porque Medicina es la
       * primera de la lista.
       *
       * El agujero se arregló donde estaba: cuando no hay carrera activa, el
       * formulario de «Nueva materia» pregunta en cuál va. Así "todas" es un
       * estado en el que la app funciona entera, que es lo que siempre tendría
       * que haber sido.
       */

      // Cambiar el tema en caliente tiene que repintar también el fondo de la
      // ventana. Si no, al agrandarla se ve por un instante el color del tema
      // anterior en el borde que todavía no dibujó la interfaz.
      registerIpc(config, (tema) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(fondoDe(tema))
      })

      applyContentSecurityPolicy()
      denyAllPermissions()
      createWindow(config.get().tema)

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow(config.get().tema)
      })
    },
    (err) => {
      logger.error('main', 'Falló el arranque de la app.', err)
      dialog.showErrorBox('Mediflashy', 'La app no pudo iniciarse. Probá reinstalarla desde el instalador original.')
      app.quit()
    }
  )

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    quitConfirmed = true
    cancelRunningGeneration()
    if (sesionActiva()) endSesion()
    // El motor tiene el modelo entero en memoria: si sobrevive al cierre, son 1,7 o
    // 3,3 GB de RAM tomados por un proceso sin ventana.
    stopServer()
  })

  app.on('will-quit', () => {
    cleanStaleTemps()
    stopServer()
    logger.info('main', '--- Sesión terminada ---')
  })

  // Última red, para las salidas que no pasan por los hooks de Electron. Acá no
  // corre nada asíncrono, así que sólo se puede hacer el taskkill directo.
  process.on('exit', stopServerSync)
}
