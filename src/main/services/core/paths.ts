import { app } from 'electron'
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { shredFile } from './fsutil'

/**
 * Resolución de rutas y binarios.
 *
 * `llama-server` recibe la ruta del modelo por argv y en Windows el CRT la
 * convierte al code page ANSI del sistema, así que un carácter fuera de ese code
 * page llegaría corrupto. Por eso los modelos viven en un directorio cuya ruta es
 * ASCII, y `dataRoot()` se rompe la cabeza para conseguir uno.
 *
 * Los apuntes que elige el usuario NO pasan por acá: se leen con `fs` de Node
 * (Unicode completo) y su texto vive en memoria hasta que se descarta.
 */

/**
 * TIENE QUE SER DISTINTO DEL DE FLASHCARDS Y DEL DE CONVERTEXTO.
 *
 * Psicoflashy sale del mismo código que Flashcards, así que heredar su carpeta es
 * el error más fácil de cometer acá. Un estudiante puede tener las dos instaladas:
 * si compartieran esta carpeta vería las materias de una mezcladas con las de la
 * otra, y desinstalar cualquiera de las dos se llevaría puesto el progreso de
 * ambas. No es un detalle cosmético.
 *
 * Convertexto usa `Transcriptor2` y su instalador declara
 * `deleteAppDataOnUninstall: true`. Si Flashcards heredara ese nombre, las dos
 * apps compartirían `%APPDATA%\Transcriptor2` y pasarían dos cosas, las dos malas:
 *
 *  1. **Desinstalar Convertexto le borraría al usuario todos los mazos y todo el
 *     progreso de estudio.** Meses de repasos, evaporados por desinstalar otro
 *     programa. No hay forma de que se entienda como otra cosa que un bug grave.
 *  2. La limpieza de temporales de cada app pisaría la de la otra en pleno uso,
 *     con fallas intermitentes imposibles de diagnosticar desde un log.
 *
 * Acá adentro viven la configuración, las materias, las unidades, las tarjetas y
 * el historial de repasos. Una vez publicada la app, este nombre no se toca sin
 * una migración que mueva el contenido: cambiarlo a secas haría que el usuario
 * abriera la app y encontrara su biblioteca vacía, con los archivos intactos en el
 * disco pero invisibles.
 *
 * Sin espacio ni acentos a propósito: esta ruta viaja hasta llama-server por argv.
 */
const APP_FOLDER = 'Mediflashy'

/** Avisos acumulados durante la resolución, para loguearlos cuando el logger ya exista. */
const notices: string[] = []

/**
 * Carpeta donde está el .exe cuando corre la versión portable.
 *
 * El stub NSIS del target `portable` define `PORTABLE_EXECUTABLE_DIR` con la
 * carpeta real del .exe —no con la carpeta temporal de autoextracción—, así que
 * es el único lugar que sobrevive entre ejecuciones y entre computadoras.
 * Está vacío en la app instalada y en desarrollo.
 */
function portableExeDir(): string | null {
  const dir = process.env.PORTABLE_EXECUTABLE_DIR
  return typeof dir === 'string' && dir.length > 0 ? dir : null
}

export function isPortable(): boolean {
  return portableExeDir() !== null
}

/**
 * Fija la carpeta de datos del usuario, separada de la de Convertexto.
 *
 * Vive acá y no en `index.ts` para que sea una sola decisión: el nombre sale del
 * mismo `APP_FOLDER` que usan las alternativas de `dataRoot()`, así no pueden
 * quedar desincronizados. La llama el arranque de la app y también los arneses de
 * QA, que si no correrían contra `%APPDATA%\Electron`.
 *
 * Por qué el nombre no puede coincidir con el de Convertexto está explicado
 * arriba, en `APP_FOLDER`. Es la parte de este archivo que no hay que tocar.
 */
export function configureUserDataDir(): void {
  app.setPath('userData', join(app.getPath('appData'), APP_FOLDER))
}

function isAscii(value: string): boolean {
  return Array.from(value).every((ch) => (ch.codePointAt(0) ?? 0) < 128)
}

function isUsable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, `.write-test-${process.pid}`)
    writeFileSync(probe, 'ok')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

/**
 * Nombre corto 8.3 de una carpeta (`C:\Users\JOSÉ~1\...`). Permite conservar la
 * carpeta dentro del perfil del usuario —con los permisos correctos— aunque el
 * nombre de la cuenta tenga acentos. Puede no existir: la generación de nombres
 * 8.3 se puede deshabilitar por volumen.
 */
function shortPath(dir: string): string | null {
  if (process.platform !== 'win32') return null
  try {
    mkdirSync(dir, { recursive: true })
    // Pasar 'cmd.exe' como archivo y el `for ... do` como un elemento del array de
    // argumentos NO funciona: spawnSync entrecomilla ese argumento con sus propias
    // reglas (pensadas para un argv genérico) antes de que cmd.exe lo vea, y
    // cmd.exe interpreta las comillas de otra forma para `/C`. El resultado es una
    // salida rota (`C:\"<la-ruta-larga-sin-acortar>\"`) SIEMPRE, con o sin acentos
    // — nunca un nombre corto real. Pasar el comando como una única string con
    // `shell: true` evita ese doble entrecomillado: así lo arma Node mismo para
    // cmd.exe y sale bien.
    const result = spawnSync(`for %I in ("${dir}") do @echo %~sI`, {
      shell: true,
      encoding: 'utf8',
      windowsHide: true
    })
    const short = (result.stdout ?? '').trim()
    return short.length > 0 && isAscii(short) && existsSync(short) ? short : null
  } catch {
    return null
  }
}

/**
 * Deja la carpeta accesible sólo para el usuario actual (más SYSTEM y
 * administradores, que igual pueden todo). Importa en las alternativas fuera del
 * perfil: `C:\ProgramData` y la raíz del disco heredan permisos de lectura para
 * *todas* las cuentas locales de la máquina, así que sin esto los mazos del
 * usuario —que son sus apuntes convertidos en tarjetas— quedarían legibles por
 * cualquier otra cuenta del equipo.
 *
 * Los grupos se referencian por SID y no por nombre porque en un Windows en
 * español se llaman "Administradores" y `icacls` no acepta el nombre en inglés.
 *
 * Son dos pasadas y el orden importa:
 *
 *  1. `/reset /T` devuelve la herencia a lo que ya exista adentro (de una
 *     instalación anterior).
 *  2. `/inheritance:r` + los permisos, SÓLO sobre la raíz. Windows propaga las
 *     ACE heredables a los hijos, y todo lo que se cree después las hereda.
 *
 * Lo que NO hay que hacer es `/inheritance:r` con `/T`: eso le saca la herencia
 * también a cada hijo, y como los hijos no tienen permisos propios quedan con
 * una ACL vacía, que en Windows significa "nadie puede nada". La app puede
 * seguir creando archivos ahí pero no borrar los que ya estaban, así que el
 * usuario no podría borrar una materia ni una tarjeta: la app diría que sí y en
 * el disco quedarían para siempre.
 * Verificado a mano: con `/T` el borrado de los temporales falla con EPERM.
 */
function restrictToCurrentUser(dir: string): boolean {
  try {
    if (process.platform !== 'win32') {
      chmodSync(dir, 0o700)
      return true
    }
    const user = process.env.USERNAME
    if (!user) return false

    spawnSync('icacls', [dir, '/reset', '/T', '/C', '/Q'], { encoding: 'utf8', windowsHide: true })

    const result = spawnSync(
      'icacls',
      [
        dir,
        '/inheritance:r',
        '/grant:r',
        `${user}:(OI)(CI)F`,
        '/grant:r',
        '*S-1-5-18:(OI)(CI)F', // SYSTEM
        '/grant:r',
        '*S-1-5-32-544:(OI)(CI)F', // Administradores
        '/C',
        '/Q'
      ],
      { encoding: 'utf8', windowsHide: true }
    )
    return result.status === 0
  } catch {
    return false
  }
}

/** ¿La carpeta está dentro del perfil del usuario, donde los permisos ya son privados? */
function insideUserProfile(dir: string): boolean {
  const profile = process.env.USERPROFILE ?? app.getPath('home')
  if (!profile) return false
  return dir.toLowerCase().startsWith(profile.toLowerCase() + sep)
}

let cachedRoot: string | null = null

/**
 * Directorio raíz de todo lo que la app guarda: los modelos, las materias, las
 * unidades y el historial de repasos. Se prefiere `userData`;
 * si su ruta tuviera caracteres no ASCII (por ejemplo un usuario de Windows
 * llamado "José"), se prueba primero su nombre corto 8.3 —que sigue estando
 * dentro del perfil— y recién después carpetas fuera del perfil, a las que se
 * les restringen los permisos.
 */
export function dataRoot(): string {
  if (cachedRoot) return cachedRoot

  const userData = app.getPath('userData')

  // En la versión portable los datos van al lado del .exe. Ése es el punto de
  // ser portable: los modelos (hasta 2,7 GB) y —lo que más importa acá— los mazos
  // del usuario viajan con el pendrive, así puede estudiar en la facultad y en su
  // casa con el mismo progreso y sin volver a descargar nada. Si esa carpeta no
  // sirve —Program Files, unidad de sólo lectura, ruta con acentos— se cae en
  // silencio a la cadena de siempre y se avisa.
  const exeDir = portableExeDir()
  const portableRoot = exeDir ? join(exeDir, `${APP_FOLDER}-datos`) : null

  /*
   * El nombre corto 8.3 de la carpeta portable, igual que ya se hace con
   * `userData` dos líneas más abajo.
   *
   * Sin esto, una carpeta de entrega como "Versión Windows" —con acento—
   * reprobaba el `isAscii` de más abajo, la portabilidad se abandonaba en
   * silencio y los datos caían a `userData`: el pendrive dejaba de llevarse
   * los mazos y el modelo (hasta 2,7 GB) se volvía a descargar en cada
   * computadora. `shortPath` crea la carpeta si hace falta y devuelve algo
   * como "VERSIN~1\Mediflashy-datos", que sigue siendo la MISMA carpeta en
   * disco, sin acentos en el nombre que usa el sistema de archivos.
   */
  const portableRootCorto = portableRoot ? shortPath(portableRoot) : null

  const candidates = [
    portableRoot,
    portableRootCorto,
    userData,
    shortPath(userData),
    join(tmpdir(), APP_FOLDER),
    join(process.env.LOCALAPPDATA ?? tmpdir(), APP_FOLDER),
    join(process.env.SystemDrive ?? 'C:', 'ProgramData', APP_FOLDER),
    join(process.env.SystemDrive ?? 'C:', `${APP_FOLDER}-data`)
  ].filter((c): c is string => typeof c === 'string' && c.length > 0)

  const chosen = candidates.find((c) => isAscii(c) && isUsable(c)) ?? candidates.find((c) => isUsable(c)) ?? userData

  /* ¿Terminamos guardando al lado del .exe, sea con el nombre normal o con el
     corto? Las dos cuentan como "portable anduvo": la carpeta en disco es la
     misma, cambia sólo cómo se la nombra. */
  const esPortableExitoso = chosen === portableRoot || (portableRootCorto !== null && chosen === portableRootCorto)

  // Lo que esperábamos usar: al lado del .exe si es portable, userData si no.
  const expected = portableRoot ?? userData
  if (esPortableExitoso) {
    notices.push(`Versión portable: los modelos y tus mazos quedan en ${chosen}, al lado del programa.`)
  } else if (chosen !== expected) {
    notices.push(
      portableRoot
        ? `No pude guardar los datos en ${portableRoot} (puede ser una carpeta de sólo lectura, o con acentos en la ruta). Se usará ${chosen}: los modelos no van a viajar con el programa y se van a descargar de nuevo en otra computadora.`
        : `La carpeta de datos habitual no se pudo usar tal cual (${userData}). Se usará ${chosen} para los modelos y tus mazos.`
    )
  }
  if (!isAscii(chosen)) {
    notices.push(`No encontré una carpeta de datos con ruta ASCII; se usará ${chosen}.`)
  }
  if (!insideUserProfile(chosen)) {
    // Fuera del perfil los permisos por defecto son de lectura para todas las
    // cuentas locales: hay que cerrarlos antes de escribir nada adentro.
    const locked = restrictToCurrentUser(chosen)
    if (locked) {
      notices.push(`${chosen} está fuera de tu carpeta de usuario: se restringieron los permisos para que sólo vos puedas leerla.`)
    } else if (esPortableExitoso) {
      // Caso normal en pendrives: FAT32 y exFAT no tienen permisos por usuario.
      // No es una falla de la app y no hay que asustar, pero sí decirlo.
      notices.push(
        `Los datos quedan en ${chosen}. Esa unidad no maneja permisos por usuario (pasa con pendrives y discos externos), así que cualquiera que tenga el disco puede leer lo que haya ahí.`
      )
    } else {
      notices.push(
        `No pude restringir los permisos de ${chosen}. Si compartís esta computadora con otras cuentas, cerrá la app y revisá los permisos de esa carpeta.`
      )
    }
  }

  cachedRoot = chosen
  return cachedRoot
}

export function modelsDir(): string {
  const dir = join(dataRoot(), 'models')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Carpeta de los mazos: un JSON por unidad, nombrado por el id de la unidad.
 *
 * Es contenido del usuario y no se limpia nunca sola. El índice de materias y el
 * historial de repasos viven un nivel más arriba, sueltos en `dataRoot()`.
 */
export function unitsDir(): string {
  const dir = join(dataRoot(), 'unidades')
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Dónde van la configuración y los registros.
 *
 * En la versión instalada, en `userData` — pueden vivir ahí aunque la ruta tenga
 * acentos, porque sólo los escribe Node.
 *
 * EN LA PORTABLE VAN CON LOS DATOS, al lado del ejecutable, y eso es una
 * corrección respecto de Convertexto. Allá estos dos siempre cuelgan de `userData`,
 * así que una app portable deja su configuración y su log en CADA computadora
 * donde se la enchufa. Para un transcriptor es un detalle; acá rompe la promesa
 * del formato: alguien que estudia en la facultad y en su casa esperaría que su
 * ritmo de estudio viaje con el pendrive, y en cambio tendría que reconfigurarlo
 * en cada máquina — y encima dejaría rastro en computadoras ajenas.
 */
function configuracionYRegistros(): string {
  return isPortable() ? dataRoot() : app.getPath('userData')
}

export function logsDir(): string {
  return join(configuracionYRegistros(), 'logs')
}

export function configFile(): string {
  return join(configuracionYRegistros(), 'config.json')
}

/**
 * Borra los `.tmp` que hayan quedado de una escritura interrumpida.
 *
 * `deckStore` escribe a `<id>.json.tmp` y renombra encima: si la app se cerró de
 * golpe justo en el medio, queda el temporal. El `.json` de al lado sigue siendo
 * la versión buena —ése es todo el punto del rename atómico—, así que el temporal
 * es basura, pero es basura CON CONTENIDO DEL USUARIO adentro: tarjetas suyas. Por
 * eso se sobrescribe antes de borrarlo en vez de un `unlink` a secas.
 *
 * Convertexto tiene una función con este nombre que hace otra cosa (limpia el WAV
 * intermedio y el JSON de la transcripción). No hay nada equivalente acá: la
 * ingesta de apuntes es en memoria y no deja archivos.
 */
export function cleanStaleTemps(): void {
  for (const dir of [dataRoot(), unitsDir()]) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.tmp')) shredFile(join(dir, entry.name))
      }
    } catch {
      /* si no se puede listar, se reintenta el próximo arranque */
    }
  }
}

/* ------------------------------- binarios -------------------------------- */

/**
 * Carpetas donde puede estar `resources/<nombre>`. En la app empaquetada es una
 * sola; en desarrollo se prueban varias porque el directorio de trabajo depende
 * de cómo se arrancó el proceso (electron-vite, un script suelto, el arnés de QA).
 */
function resourcesBases(name: string): string[] {
  if (app.isPackaged) return [join(process.resourcesPath, name)]

  const bases: string[] = []
  const seen = new Set<string>()
  const add = (dir: string): void => {
    const candidate = join(dir, 'resources', name)
    if (!seen.has(candidate)) {
      seen.add(candidate)
      bases.push(candidate)
    }
  }

  add(app.getAppPath())
  // Subir desde el archivo compilado (out/main/…) hasta la raíz del proyecto.
  let dir = __dirname
  for (let depth = 0; depth < 6; depth++) {
    add(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return bases
}

export interface BinaryResolution {
  path: string | null
  error?: string
}

/** Subcarpetas a probar, en orden de preferencia, para un binario por plataforma. */
function platformSubdirs(): string[] {
  return [
    `${process.platform}-${process.arch}`,
    process.platform,
    // En Windows on ARM, el build x64 corre emulado.
    ...(process.platform === 'win32' ? ['win32-x64'] : []),
    // En una Mac con Apple Silicon, el build x64 corre bajo Rosetta 2. Es un
    // respaldo, no el camino normal: el build arm64 usa Metal y va mucho más
    // rápido. Sirve para que un dmg universal al que le faltara el slice arm64
    // arranque igual en vez de decir que no encuentra el motor.
    ...(process.platform === 'darwin' && process.arch === 'arm64' ? ['darwin-x64'] : [])
  ]
}

function resolveBinary(resourceName: string, exeName: string): string | null {
  const candidates = resourcesBases(resourceName).flatMap((base) =>
    platformSubdirs().map((subdir) => join(base, subdir, exeName))
  )
  const found = candidates.find((c) => existsSync(c))
  if (found && process.platform !== 'win32') {
    try {
      chmodSync(found, 0o755)
    } catch {
      /* si ya tiene permisos, o el FS no lo permite, seguimos */
    }
  }
  return found ?? null
}

let cachedLlama: BinaryResolution | null = null

/**
 * El motor de generación: `llama-server` de llama.cpp.
 *
 * Vive en `resources/llm/<plataforma-arquitectura>/`. En Convertexto esa carpeta
 * propia existe para no mezclar las DLL de ggml con las de whisper —dos proyectos
 * compilados contra commits distintos que exportan los mismos símbolos, y
 * mezclarlas es un crash a mitad de un trabajo, sin mensaje—. Acá no hay whisper,
 * pero la carpeta se mantiene igual: el script que baja el binario es el mismo y
 * conviene que las dos apps se empaqueten idénticas.
 *
 * DIFERENCIA IMPORTANTE CON CONVERTEXTO: allá esto puede faltar sin drama, porque
 * la transcripción sigue andando y sólo se apaga la casilla de resumen. Acá es el
 * motor de la única función que hace la app, así que si falta hay que decirlo
 * fuerte y no dejar generar. Ver `engineCheck()` en ipc.ts.
 */
export function llamaBinary(): BinaryResolution {
  if (cachedLlama) return cachedLlama

  const exe = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
  const found = resolveBinary('llm', exe)

  cachedLlama = found
    ? { path: found }
    : {
        path: null,
        error:
          'No se encontró el motor de generación (llama-server), así que la app no puede crear tarjetas. Si estás en desarrollo, corré `npm run setup:llama`. Si es la app instalada, reinstalala desde el instalador original.'
      }
  return cachedLlama
}

export function takeNotices(): string[] {
  return notices.splice(0, notices.length)
}
