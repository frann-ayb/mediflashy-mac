import { app } from 'electron'
import { existsSync, rmSync, renameSync, statSync } from 'node:fs'
import { totalmem, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GenLevel, GenModelStatus, ModelProgress } from '@shared/types'
import { modelsDir } from './paths'
import { formatBytes, freeSpace } from './fsutil'
import { logger } from './logger'
import { AppError } from './errors'
import { downloadWithResume, sha256OfFile } from './download'

/**
 * Descarga y cacheo de los modelos de lenguaje que generan las tarjetas.
 *
 * ---------------------------------------------------------------------------
 * Qué modelo y por qué
 * ---------------------------------------------------------------------------
 *
 * Qwen3.5, en sus dos tamaños chicos, cuantizado a Q4_K_M en formato GGUF. Son
 * exactamente los mismos que usa Convertexto para resumir, con las mismas
 * revisiones fijadas y los mismos hashes — y eso es a propósito, ver más abajo.
 *
 *  - **Licencia Apache 2.0.** Es el requisito que descarta casi todo lo demás.
 *    Llama pide atribución y tiene tope de usuarios; Gemma tiene restricciones de
 *    uso. Apache 2.0 se puede redistribuir dentro de un producto que se vende sin
 *    más obligación que reproducir el texto de la licencia.
 *  - **Multilingüe de verdad.** Está entrenado en más de 200 idiomas. Un apunte de
 *    facultad en español no lo despeina, y tampoco uno en inglés, que en carreras
 *    técnicas es la mitad de la bibliografía.
 *  - **Sin razonamiento por defecto** en los tamaños chicos. Para extraer conceptos
 *    de un texto que ya los tiene escritos, pensar en voz alta sólo suma minutos.
 *
 * ---------------------------------------------------------------------------
 * Por qué la URL lleva la revisión y no "main"
 * ---------------------------------------------------------------------------
 *
 * unsloth recuantiza y vuelve a subir con el mismo nombre de archivo. Con `main` y
 * un sha256 fijo, el día que resuban, TODO comprador nuevo recibiría "el modelo
 * llegó dañado" para siempre, y la función se moriría sin que nadie se entere hasta
 * que llegue el primer mail de soporte. Con la revisión fijada, el archivo que se
 * baja es exactamente el que se verificó acá.
 *
 * Para actualizar: pedir `https://huggingface.co/api/models/<repo>` (campo `sha`) y
 * `.../tree/<sha>` (campos `size` y `lfs.oid`), y correr `qa:modelo`.
 */

export interface GenModelSpec {
  level: GenLevel
  /** Cómo se llama el nivel para el usuario. */
  label: string
  fileName: string
  /** Tamaño exacto en bytes: sirve para avisar por espacio y para detectar basura. */
  sizeBytes: number
  sha256: string
  url: string
  /** RAM mínima para que el modelo entre sin irse al archivo de paginación. */
  minRamBytes: number
}

const GB = 1024 ** 3

export const GEN_MODELS: Record<GenLevel, GenModelSpec> = {
  rapido: {
    level: 'rapido',
    label: 'Rápido',
    fileName: 'Qwen3.5-2B-Q4_K_M.gguf',
    sizeBytes: 1_280_835_840,
    sha256: 'aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223',
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/f6d5376be1edb4d416d56da11e5397a961aca8ae/Qwen3.5-2B-Q4_K_M.gguf',
    minRamBytes: 4 * GB
  },
  detallado: {
    level: 'detallado',
    label: 'Detallado',
    fileName: 'Qwen3.5-4B-Q4_K_M.gguf',
    sizeBytes: 2_740_937_888,
    sha256: '00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4',
    url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/e87f176479d0855a907a41277aca2f8ee7a09523/Qwen3.5-4B-Q4_K_M.gguf',
    minRamBytes: 8 * GB
  }
}

/**
 * Dónde guarda Flashcards sus modelos.
 *
 * `llama-server` recibe la ruta del modelo por argv, y en Windows el CRT pasa argv
 * por el code page ANSI del sistema: una cuenta llamada "José" rompería la ruta.
 * `dataRoot()` ya resuelve eso eligiendo una carpeta ASCII, y `modelsDir()` cuelga
 * de ahí.
 */
export function genModelPath(level: GenLevel): string {
  return join(modelsDir(), GEN_MODELS[level].fileName)
}

/* ------------------- reutilización de los modelos de Convertexto ------------------- */

/**
 * Carpetas donde Convertexto pudo haber dejado sus modelos.
 *
 * POR QUÉ ESTO EXISTE: son los mismos GGUF, byte por byte —mismo repo, misma
 * revisión, mismo hash—. Alguien que ya tiene Convertexto y compra Flashcards no
 * tiene por qué esperar veinte minutos y gastar 2,7 GB de disco por segunda vez
 * para bajar un archivo que ya tiene.
 *
 * SÓLO LECTURA, Y NO ES NEGOCIABLE. Flashcards nunca escribe, renombra ni borra
 * acá adentro. El motivo es concreto: Convertexto declara
 * `deleteAppDataOnUninstall: true`, así que esta carpeta puede desaparecer en
 * cualquier momento sin avisar. Si Flashcards dependiera de ella para algo más que
 * un atajo, desinstalar Convertexto rompería Flashcards. Como es sólo un atajo, lo
 * peor que puede pasar es que un día el modelo no esté y se descargue, que es
 * exactamente lo que habría pasado sin este código.
 *
 * La lista replica la cadena de alternativas de `dataRoot()`, pero con la carpeta
 * de Convertexto. No cubre el caso portable —no hay forma de saber a qué pendrive
 * lo enchufó— y no hace falta que lo cubra.
 */
function convertextoModelDirs(): string[] {
  const AJENO = 'Transcriptor2'
  const dirs: string[] = []
  const add = (base: string | undefined | null): void => {
    if (typeof base === 'string' && base.length > 0) dirs.push(join(base, AJENO, 'models'))
  }

  try {
    add(app.getPath('appData'))
  } catch {
    /* en un arnés sin `app` lista, se prueban las demás */
  }
  add(tmpdir())
  add(process.env.LOCALAPPDATA)
  add(join(process.env.SystemDrive ?? 'C:', 'ProgramData'))

  return dirs
}

/**
 * Devuelve la ruta a un GGUF válido de Convertexto, o `null`.
 *
 * "Válido" es tamaño exacto, sin tolerancia: un archivo a medio bajar de la otra
 * app haría que llama-server muera sin explicar nada, y el usuario culparía a
 * Flashcards por algo que no es suyo. No se verifica el sha256 acá porque leer
 * 2,7 GB tardaría más que el arranque entero; el tamaño exacto ya descarta el
 * único caso realista, que es un `.part` renombrado o una descarga interrumpida.
 */
function findInConvertexto(level: GenLevel): string | null {
  const spec = GEN_MODELS[level]
  for (const dir of convertextoModelDirs()) {
    const candidate = join(dir, spec.fileName)
    try {
      if (existsSync(candidate) && statSync(candidate).size === spec.sizeBytes) return candidate
    } catch {
      /* carpeta sin permisos o ruta inválida: se prueba la siguiente */
    }
  }
  return null
}

/**
 * La ruta del modelo listo para usar, mire donde mire: primero la propia, después
 * la de Convertexto. `null` si hay que descargarlo.
 */
export function resolveInstalledModel(level: GenLevel): string | null {
  const propio = genModelPath(level)
  try {
    if (existsSync(propio) && statSync(propio).size === GEN_MODELS[level].sizeBytes) return propio
  } catch {
    /* sigue con el de Convertexto */
  }
  return findInConvertexto(level)
}

export function isGenModelInstalled(level: GenLevel): boolean {
  return resolveInstalledModel(level) !== null
}

export function genModelStatus(level: GenLevel): GenModelStatus {
  const spec = GEN_MODELS[level]
  const disk = freeSpace(modelsDir())
  const found = resolveInstalledModel(level)
  return {
    level,
    installed: found !== null,
    // Que el modelo esté pero prestado de Convertexto cambia lo que la UI puede
    // ofrecer: no tiene sentido un botón "borrar para liberar espacio" sobre un
    // archivo de otra app.
    borrowed: found !== null && found !== genModelPath(level),
    sizeBytes: spec.sizeBytes,
    minRamBytes: spec.minRamBytes,
    freeBytes: disk.known ? disk.availableBytes : null
  }
}

/** Bytes de una descarga a medias, para poder mostrarlos y borrarlos. */
export function genPartialBytes(level: GenLevel): number {
  const part = `${genModelPath(level)}.part`
  try {
    return existsSync(part) ? statSync(part).size : 0
  } catch {
    return 0
  }
}

/**
 * Chequeo de memoria antes de bajar 2,7 GB.
 *
 * Se hace ANTES de la descarga a propósito. Descubrir que el modelo no entra en la
 * máquina recién cuando el motor falla, después de veinte minutos de descarga, es
 * la peor forma posible de enterarse. Y el mensaje ofrece la salida concreta (el
 * nivel Rápido) en vez de sólo decir que no.
 */
/**
 * Lo que Windows le descuenta al total físico antes de contárselo a nadie.
 *
 * `totalmem()` devuelve `ullTotalPhys`, que ya tiene restada la memoria que se
 * quedan el firmware y la placa de video integrada. Medido en esta máquina: 24 GiB
 * instalados reportan 23,65 —380 MB de diferencia—, que es el mismo "23,6 GB
 * utilizables" que muestra Windows en Configuración.
 *
 * POR QUÉ IMPORTA TANTO: el descuento es más o menos fijo en bytes, así que
 * castiga proporcionalmente mucho más a las máquinas chicas. Una notebook de 4 GiB
 * reporta ~3,6 y una de 8 GiB ~7,6. Comparadas contra un umbral de 4 y 8 GiB
 * exactos, LAS DOS FALLAN SIEMPRE, no en un caso raro: ninguna computadora de 4 GB
 * del mundo reporta 4,00 GiB.
 *
 * Sin este margen, el comprador de una notebook de 4 GB —el público que la app
 * dice soportar en tres lugares distintos— aprieta "Descargar" el día que compró y
 * recibe un cartel que le dice que su computadora no alcanza. No se veía en
 * desarrollo por dos motivos a la vez: esta máquina tiene 24 GB, y además usa el
 * modelo prestado de la otra app, que saltea este chequeo entero.
 *
 * 768 MB cubre con aire el caso peor realista, que es una integrada quedándose
 * medio giga. Una máquina de 3 GB o menos sigue rechazada, que es correcto: el
 * motor necesita 2,3 GB medidos y ahí no entra.
 */
const RESERVA_HARDWARE = 768 * 1024 * 1024

/** El `total` se puede inyectar para poder probar los umbrales sin cambiar de máquina. */
export function checkRam(level: GenLevel, totalBytes?: number): void {
  const spec = GEN_MODELS[level]
  const total = totalBytes ?? totalmem()
  if (total + RESERVA_HARDWARE >= spec.minRamBytes) return

  const tiene = (total / GB).toFixed(1).replace('.', ',')
  const pide = Math.round(spec.minRamBytes / GB)
  if (level === 'detallado') {
    throw new AppError(
      `El nivel Detallado necesita al menos ${pide} GB de memoria RAM y esta computadora tiene ${tiene} GB. ` +
        'Elegí el nivel Rápido, que anda bien con 4 GB.'
    )
  }
  throw new AppError(
    `Generar tarjetas necesita al menos ${pide} GB de memoria RAM y esta computadora tiene ${tiene} GB. ` +
      'Podés seguir estudiando y editando las tarjetas que ya tengas; lo que no va a poder hacerse es generar nuevas.'
  )
}

export interface EnsureGenModelOptions {
  level: GenLevel
  signal: AbortSignal
  onProgress: (progress: ModelProgress) => void
  /**
   * Bajar una copia PROPIA aunque ya haya una prestada de la otra app.
   *
   * Sin esto, quien tiene las dos apps instaladas queda atrapado: Flashcards usa
   * el archivo del vecino, no lo puede borrar —es de otro— y tampoco puede tener
   * el suyo. Y como la otra app borra su carpeta al desinstalarse, esa persona
   * depende de algo que puede desaparecer sin aviso.
   *
   * Con esta opción, "quiero que sea mío" es una decisión del usuario y no una
   * consecuencia de qué otros programas tenga instalados.
   */
  propio?: boolean
}

/**
 * Devuelve la ruta al modelo listo para usar, descargándolo si hace falta.
 * Lanza `AppError` con un mensaje mostrable si no se puede.
 */
export async function ensureGenModel({ level, signal, onProgress, propio }: EnsureGenModelOptions): Promise<string> {
  const spec = GEN_MODELS[level]
  const target = genModelPath(level)

  const emit = (partial: Partial<Omit<ModelProgress, 'level'>>): void => {
    onProgress({
      level,
      phase: 'checking',
      receivedBytes: 0,
      totalBytes: spec.sizeBytes,
      percent: 0,
      bytesPerSecond: 0,
      ...partial
    })
  }

  emit({ phase: 'checking', message: 'Verificando el modelo…' })

  /* Con `propio` se ignora el atajo a propósito: el punto es justamente NO
     quedarse con el archivo del vecino. */
  const yaEsta = propio === true ? (existsSync(target) && statSync(target).size === spec.sizeBytes ? target : null) : resolveInstalledModel(level)
  if (yaEsta) {
    if (yaEsta !== target) {
      logger.info('modelos', `Se usa el modelo ${spec.fileName} ya descargado por Convertexto: ${yaEsta}`)
    }
    emit({ phase: 'ready', percent: 100, receivedBytes: spec.sizeBytes, message: 'Modelo listo.' })
    return yaEsta
  }

  checkRam(level)

  // Un archivo con tamaño distinto al esperado es basura de un intento fallido.
  if (existsSync(target)) {
    logger.warn('modelos', `El modelo ${spec.fileName} existe con tamaño incorrecto; se descarta y se vuelve a descargar.`)
    rmSync(target, { force: true })
  }

  const partFile = `${target}.part`
  let alreadyHave = 0
  if (existsSync(partFile)) {
    try {
      alreadyHave = statSync(partFile).size
      /**
       * Un `.part` del tamaño EXACTO está entero: sólo faltó renombrarlo.
       *
       * Pasa de verdad —se corta la luz, o se cierra la app, justo entre el último
       * byte y el rename— y antes se tiraba junto con los que miden de más, que sí
       * son basura. Tirarlo significa volver a bajar hasta 2,7 GB que la persona ya
       * tenía en el disco, con la conexión que tenga.
       *
       * Se verifica el sha antes de aceptarlo: son unos segundos de leer el archivo
       * contra veinte minutos de descarga, y es la misma comprobación que se le
       * hace a cualquier descarga al terminar. Si no da, se borra como antes.
       */
      if (alreadyHave === spec.sizeBytes) {
        emit({ phase: 'checking', message: 'Comprobando lo que ya estaba bajado…' })
        if ((await sha256OfFile(partFile, signal)) === spec.sha256) {
          renameSync(partFile, target)
          logger.info('modelos', `El ${spec.fileName} ya estaba bajado entero; se aprovechó sin volver a descargarlo.`)
          emit({ phase: 'ready', percent: 100, receivedBytes: spec.sizeBytes, message: 'Modelo listo.' })
          return target
        }
        logger.warn('modelos', `El ${spec.fileName} a medias tenía el tamaño justo pero el sha no da; se descarta.`)
      }
      if (alreadyHave >= spec.sizeBytes) {
        rmSync(partFile, { force: true })
        alreadyHave = 0
      }
    } catch {
      alreadyHave = 0
    }
  }

  const needed = spec.sizeBytes - alreadyHave
  const disk = freeSpace(modelsDir())
  // Margen del 10 % para no dejar el disco exactamente en cero.
  if (disk.known && disk.availableBytes < needed * 1.1) {
    throw new AppError(
      `No hay espacio suficiente en disco para el modelo ${spec.label}: hacen falta ${formatBytes(
        needed
      )} y hay ${formatBytes(disk.availableBytes)} libres. Liberá espacio y probá de nuevo.`,
      { retryable: true }
    )
  }

  logger.info('modelos', `Descargando ${spec.fileName} (${formatBytes(spec.sizeBytes)}), ya había ${formatBytes(alreadyHave)}.`)

  let lastEmit = 0
  let lastBytes = alreadyHave
  let lastTime = Date.now()
  let speed = 0

  emit({
    phase: 'downloading',
    receivedBytes: alreadyHave,
    percent: Math.round((alreadyHave / spec.sizeBytes) * 100),
    message: 'Descargando el modelo…'
  })

  await downloadWithResume({
    url: spec.url,
    expectedBytes: spec.sizeBytes,
    partFile,
    alreadyHave,
    signal,
    queEs: 'el modelo',
    onChunk: (received, totalBytes) => {
      const now = Date.now()
      if (now - lastEmit < 250) return
      const elapsed = (now - lastTime) / 1000
      if (elapsed > 0) {
        const instant = (received - lastBytes) / elapsed
        // Media móvil: la velocidad instantánea de una descarga salta tanto que
        // el "faltan X minutos" quedaría bailando entre 2 y 40.
        speed = speed === 0 ? instant : speed * 0.7 + instant * 0.3
      }
      lastEmit = now
      lastBytes = received
      lastTime = now
      emit({
        phase: 'downloading',
        receivedBytes: received,
        totalBytes,
        percent: Math.min(99, Math.round((received / totalBytes) * 100)),
        bytesPerSecond: Math.max(0, Math.round(speed)),
        message: 'Descargando el modelo…'
      })
    }
  })

  if (signal.aborted) throw new AppError('Cancelado.', { canceled: true })

  const size = statSync(partFile).size
  if (size !== spec.sizeBytes) {
    rmSync(partFile, { force: true })
    throw new AppError('La descarga del modelo quedó incompleta. Probá de nuevo.', { retryable: true })
  }

  emit({ phase: 'verifying', receivedBytes: size, percent: 99, message: 'Verificando el modelo…' })

  const digest = await sha256OfFile(partFile, signal)
  if (digest !== spec.sha256) {
    rmSync(partFile, { force: true })
    logger.error('modelos', `El modelo ${spec.fileName} llegó con un hash distinto al esperado.`)
    throw new AppError(
      'El modelo descargado llegó dañado y se descartó. Probá de nuevo; si vuelve a pasar, puede ser un problema de la conexión.',
      { retryable: true }
    )
  }

  renameSync(partFile, target)
  logger.info('modelos', `Modelo ${spec.fileName} listo en ${target}.`)
  emit({ phase: 'ready', receivedBytes: size, percent: 100, message: 'Modelo listo.' })
  return target
}

/**
 * Borra un modelo y lo que haya quedado de una descarga a medias.
 *
 * BORRA SÓLO EL PROPIO. Si el modelo que la app está usando es el prestado de
 * Convertexto, acá no hay nada que borrar y se devuelve 0: tocar los archivos de
 * otra app sería un destrozo, aunque el botón esté en esta ventana.
 *
 * No usa `shredFile`: un modelo público bajado de internet no es contenido del
 * usuario, así que no hay nada que sobrescribir, y sobrescribir 2,7 GB tardaría
 * minutos sin ganar nada. Los mazos sí se sobrescriben, porque ésos sí son suyos.
 */
export function deleteGenModel(level: GenLevel): number {
  const target = genModelPath(level)
  const part = `${target}.part`
  let liberados = 0
  for (const file of [target, part]) {
    try {
      if (existsSync(file)) {
        liberados += statSync(file).size
        rmSync(file, { force: true })
      }
    } catch (err) {
      throw new AppError('No se pudo borrar el modelo. Puede estar en uso: esperá a que termine la generación en curso y probá de nuevo.', {
        cause: err
      })
    }
  }
  if (liberados > 0) {
    logger.info('modelos', `Modelo ${level} borrado (${formatBytes(liberados)} liberados).`)
  }
  return liberados
}
