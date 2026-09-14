import { freemem } from 'node:os'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { AppError } from './errors'
import { describeError, logger } from './logger'
import { dataRoot, llamaBinary } from './paths'
import { WINDOWS_LOADER_FAILURES, threadCount } from './platform'

/** Lo que ocupa una generación completa: motor + app. Medido en Windows 11. */
export const MEMORIA_PARA_GENERAR = 2.3 * 1024 * 1024 * 1024

/**
 * Ciclo de vida del motor de generación: `llama-server` de llama.cpp.
 *
 * ---------------------------------------------------------------------------
 * Por qué un servidor y no invocar un binario por vez
 * ---------------------------------------------------------------------------
 *
 * Generar las tarjetas de un apunte no es una llamada: es una pasada por cada
 * bloque de texto, y un apunte de veinte páginas son diez o doce bloques.
 * `llama-cli` recarga el modelo del disco en cada invocación, y cargar un GGUF de
 * 2,7 GB cuesta entre 8 y 25 segundos según sea SSD o disco mecánico. Eso serían
 * varios minutos de pura recarga por documento. El servidor carga una vez y
 * atiende todas las pasadas.
 *
 * Corre como SUBPROCESO y no como addon nativo: un crash del motor —memoria
 * insuficiente, una instrucción que la CPU no soporta— no puede llevarse puesta
 * la ventana del usuario. Lo peor que puede pasar es un código de salida distinto
 * de cero que la app reporta como error de esta generación.
 *
 * ---------------------------------------------------------------------------
 * Por qué node:http y no el `net` de Electron
 * ---------------------------------------------------------------------------
 *
 * `net` usa la pila de red de Chromium, que respeta el proxy del sistema. Eso está
 * perfecto para descargar los modelos (download.ts lo usa por eso), y es exactamente
 * lo que no se quiere acá: en una red corporativa con un proxy sin excepción para
 * loopback, un pedido a 127.0.0.1 se iría por el proxy y fallaría. `node:http` va
 * derecho al socket.
 *
 * ---------------------------------------------------------------------------
 * Seguridad
 * ---------------------------------------------------------------------------
 *
 * Escucha SÓLO en 127.0.0.1 (nunca 0.0.0.0), en un puerto efímero distinto en cada
 * corrida, y con una api-key aleatoria de 24 bytes que sólo conoce este proceso.
 * No es un servicio expuesto: es comunicación entre dos procesos de la misma
 * máquina que casualmente habla HTTP.
 */

/**
 * Contexto por slot, en tokens.
 *
 * NO BAJARLO PARA AHORRAR MEMORIA. Se midió, y no paga:
 *
 *     -c 8192                    1932 MB
 *     -c 4096                    1884 MB     ← 48 MB, 2,5 %
 *     -c 4096 -b 256 -ub 64      1875 MB     ← 57 MB, 2,9 %
 *
 * El bulto no es el KV cache: son los 1,22 GB de pesos del modelo, que tienen
 * que estar residentes para que la generación no se arrastre. No hay ajuste de
 * llama.cpp que cambie eso.
 *
 * Y bajarlo tiene un costo real. La generación necesita alrededor de 4.766
 * tokens —1.400 del bloque con su solape, ~1.400 de los prompts y 1.966 de las
 * ocho tarjetas del esquema—, así que 4096 queda POR DEBAJO y truncaría la
 * respuesta. 6144 alcanzaría y ahorraría 24 MB: un 1,2 % a cambio de acercarse
 * al borde. No vale.
 *
 * Lo que sí ayuda en una máquina con poca memoria está en otro lado: el motor
 * se apaga apenas termina de generar (ver ipc.ts) y el indicador de la barra de
 * arriba le muestra a la persona por qué está lento.
 */
const CONTEXT_TOKENS = 8192
/** Cuánto se espera a que el modelo cargue y /health conteste 200. */
const BOOT_TIMEOUT_MS = 3 * 60 * 1000
/** Sin un token nuevo por este tiempo, se considera colgado. */
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
/** Cuánto se espera a que el proceso muera por las buenas antes de forzarlo. */
const KILL_GRACE_MS = 5000

interface RunningServer {
  child: ChildProcess
  port: number
  apiKey: string
  modelPath: string
  stderrTail: string
}

let server: RunningServer | null = null

const pidFile = (): string => join(dataRoot(), 'llama-server.pid')

/* ------------------------------- utilidades ------------------------------- */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Reserva un puerto libre pidiéndoselo al sistema y soltándolo enseguida.
 *
 * `--port 0` no sirve: el servidor elegiría un puerto que nosotros no sabríamos.
 * Queda una ventana chica entre el cierre y el `listen` de llama-server en la que
 * otro proceso podría tomarlo; por eso el arranque reintenta con otro puerto si el
 * servidor muere quejándose del bind.
 */
function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => (port > 0 ? resolve(port) : reject(new Error('no se pudo reservar un puerto'))))
    })
  })
}

function friendlyLlamaError(stderr: string, code: number | null): string {
  const text = stderr.toLowerCase()
  if (text.includes('failed to load model') || text.includes('unable to load model') || text.includes('error loading model')) {
    return 'El modelo de generación no se pudo cargar; puede haber quedado dañado. Borralo desde "Modelos descargados" para que se baje de nuevo.'
  }
  if (text.includes('not enough memory') || text.includes('failed to allocate') || text.includes('bad_alloc') || text.includes('out of memory')) {
    return 'No hay memoria suficiente para este modelo. Probá con el nivel Rápido, que necesita bastante menos.'
  }
  if (
    (code !== null && WINDOWS_LOADER_FAILURES.has(code)) ||
    text.includes('dll') ||
    text.includes('dylib') ||
    text.includes('shared librar')
  ) {
    return 'Faltan archivos del motor de generación o están dañados. Reinstalá la app desde el instalador original.'
  }
  return `El motor de generación terminó con un error (código ${code ?? 'desconocido'}). El detalle quedó en el archivo de registro.`
}

/** `true` si el stderr indica que el puerto estaba tomado. */
function esPuertoOcupado(stderr: string): boolean {
  const text = stderr.toLowerCase()
  return text.includes('address already in use') || text.includes('bind') || text.includes('couldn\'t bind')
}

/* ---------------------------- matar el proceso ---------------------------- */

/**
 * Mata un PID y todo su árbol.
 *
 * En Windows `child.kill()` le manda la señal al proceso pero no siempre baja a
 * los hijos, y llama-server puede tener hilos de trabajo que mantienen vivo el
 * ejecutable. `taskkill /T /F` es la única forma confiable de asegurarse.
 */
function taskkill(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* ya estaba muerto */
    }
  }
}

/**
 * Barre un `llama-server` que haya sobrevivido a un cierre anormal de la app.
 *
 * Se llama al arrancar. Cubre el caso de que alguien cierre la app desde el
 * Administrador de tareas, o de un corte de luz: sin esto, quedarían 1,7 GB de RAM
 * tomados por un proceso sin ventana que nadie sabe qué es.
 *
 * Antes de matar se verifica que el PID sea realmente un llama-server: los PID se
 * reciclan, y matar a ciegas el número que quedó escrito en un archivo podría
 * llevarse cualquier otro programa del usuario.
 */
export function sweepOrphanServer(): void {
  const file = pidFile()
  if (!existsSync(file)) return
  try {
    const { pid } = JSON.parse(readFileSync(file, 'utf8')) as { pid?: number }
    if (typeof pid === 'number' && pid > 0 && esNuestroProceso(pid)) {
      taskkill(pid)
      logger.warn('motor', `Se encontró un motor de generación huérfano (pid ${pid}) de una sesión anterior y se cerró.`)
    }
  } catch {
    /* archivo ilegible: se borra igual */
  }
  rmSync(file, { force: true })
}

function esNuestroProceso(pid: number): boolean {
  if (process.platform !== 'win32') return false
  const r = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'], {
    encoding: 'utf8',
    windowsHide: true
  })
  return /llama-server\.exe/i.test(r.stdout ?? '')
}

/**
 * Cierra el servidor. Es idempotente y nunca lanza: se llama desde los `finally`
 * y desde los hooks de salida de la app, donde una excepción sería lo peor.
 */
export function stopServer(): void {
  const actual = server
  server = null
  rmSync(pidFile(), { force: true })
  if (!actual) return

  const { child } = actual
  try {
    child.kill()
  } catch {
    /* ya estaba muerto */
  }
  if (child.pid) {
    const pid = child.pid
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) taskkill(pid)
    }, KILL_GRACE_MS).unref()
  }
  logger.info('motor', 'Motor de generación cerrado.')
}

/**
 * Versión síncrona para `process.on('exit')`, donde no corre nada asíncrono.
 * Es la última red: si llegó acá, las otras dos fallaron.
 */
export function stopServerSync(): void {
  const actual = server
  server = null
  rmSync(pidFile(), { force: true })
  if (actual?.child.pid) taskkill(actual.child.pid)
}

export function isServerRunning(): boolean {
  return server !== null && server.child.exitCode === null
}

/* --------------------------------- arranque -------------------------------- */

/**
 * Conexión nueva en cada pedido, sin reutilizar sockets.
 *
 * Node reusa conexiones por defecto (`keepAlive` global). Con llama-server eso
 * rompe de una forma especialmente confusa: el servidor cierra la conexión al
 * terminar de responder, el socket muerto vuelve al pool, y el pedido siguiente lo
 * agarra y falla con "socket hang up". El síntoma es un patrón alternado —una
 * llamada anda, la siguiente falla, la otra anda— que parece un problema del
 * modelo y no lo es.
 *
 * Reutilizar conexiones no aporta nada acá: son pedidos largos (decenas de
 * segundos), poco frecuentes y contra loopback. El handshake no se nota.
 */
const NO_KEEP_ALIVE = false as const

/** Un GET a /health. `true` si el modelo terminó de cargar. */
function ping(port: number, apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path: '/health',
        method: 'GET',
        agent: NO_KEEP_ALIVE,
        headers: { Authorization: `Bearer ${apiKey}` }
      },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      }
    )
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
    req.end()
  })
}

/**
 * Levanta el servidor con el modelo dado. Si ya hay uno con el mismo modelo, no
 * hace nada; si hay uno con otro modelo, lo reemplaza.
 */
/**
 * Cuántos bloques de texto se procesan a la vez.
 *
 * ---------------------------------------------------------------------------
 * Por qué ayuda
 * ---------------------------------------------------------------------------
 *
 * Generar tarjetas está limitado por el ancho de banda de la memoria, no por el
 * procesador. Atendiendo varios bloques juntos, los pesos del modelo se leen UNA
 * vez por paso y se aprovechan para todas las secuencias a la vez. Por eso NO
 * hace falta una máquina mejor: medido, gana casi lo mismo con cuatro núcleos
 * (1,42x) que con ocho (1,48x).
 *
 * ---------------------------------------------------------------------------
 * Por qué hay una escalera y no un interruptor
 * ---------------------------------------------------------------------------
 *
 * Esto antes preguntaba una sola cosa —"¿alcanza para cuatro?"— y si no, caía a
 * uno. Estaba mal en las dos puntas. Medido sobre la carga real de la app (12
 * pedidos de ~1.400 tokens, mediana de tres corridas, modelo Rápido):
 *
 *     bloques   tiempo    contra uno    memoria del motor
 *        1       234 s        —              2.046 MB
 *        2       155 s      1,51x            2.682 MB
 *        3       131 s      1,79x            2.955 MB
 *        4       134 s      1,75x            3.118 MB
 *
 * Dos conclusiones, las dos contra lo que estaba escrito acá antes:
 *
 *  1. **El cuarto bloque no sirve.** La curva se aplana en tres: el cuarto cuesta
 *     163 MB más y no da nada. Se sacó.
 *  2. **Dos bloques ya dan la mitad larga de la ganancia** por menos memoria que
 *     tres. Una máquina a la que no le entran tres no tiene por qué caer hasta el
 *     doble de tiempo: baja un escalón.
 *
 * La constante vieja decía 92 MB por bloque. Estaba mal por 7x: esos 92 MB se
 * midieron con el contexto TOTAL fijo, y la app le da a cada bloque su contexto
 * completo (`-c CONTEXT_TOKENS * slots`), que es lo que hace falta para que un
 * pedido no se trunque. Con la constante vieja, una máquina con 3,2 GB libres
 * elegía cuatro bloques creyendo que costaban 276 MB cuando costaban 1.072: se
 * ponía a paginar contra el disco justo la computadora modesta que el chequeo
 * tenía que proteger.
 *
 * ---------------------------------------------------------------------------
 * Por qué se mide contra el tamaño del modelo
 * ---------------------------------------------------------------------------
 *
 * Los números de arriba son del modelo Rápido, que pesa 1.221 MB. El Detallado
 * pesa 2.614 MB y ocupa proporcionalmente más. Fijar los totales medidos habría
 * hecho que el nivel Detallado decidiera con los números del otro modelo y se
 * pasara de largo. Lo que se guarda es el AGREGADO sobre el archivo del modelo,
 * que es lo que depende de la cantidad de bloques y no del modelo.
 */

/** Lo que suma el motor por encima del archivo del modelo, medido, por bloques. */
const AGREGADO_POR_BLOQUES: ReadonlyArray<readonly [number, number]> = [
  [3, 1734 * 1024 * 1024],
  [2, 1461 * 1024 * 1024],
  [1, 825 * 1024 * 1024]
]

/** Lo que ocupa Electron con la app abierta, aparte del motor. */
const MEMORIA_DE_LA_APP = 400 * 1024 * 1024

/**
 * El aire que tiene que sobrar DESPUÉS de todo.
 *
 * No alcanza con que entre justo: si queda al borde, el paralelismo se paga con
 * paginación contra el disco, que cuesta muchísimo más de lo que ahorra.
 */
const AIRE = 512 * 1024 * 1024

/**
 * Cuántos bloques entran en `libre` bytes con un modelo de `modeloBytes`.
 *
 * Es una función pura y exportada a propósito: así se puede probar la decisión
 * para máquinas que no tengo, en `qa:gama`, en vez de confiar en que anda porque
 * anda en la mía.
 */
export function bloquesParaMemoria(libre: number, modeloBytes: number): number {
  for (const [bloques, agregado] of AGREGADO_POR_BLOQUES) {
    if (libre >= modeloBytes + agregado + MEMORIA_DE_LA_APP + AIRE) return bloques
  }
  /* Uno es el piso y no se negocia: si ni eso entra, igual hay que generar. El
     indicador de memoria de la barra superior ya le avisó que va a ir lento. */
  return 1
}

/**
 * Cuántos bloques está atendiendo el servidor que está corriendo AHORA.
 *
 * Lo fija `startServer` cuando arranca un proceso, y sólo entonces: tiene que
 * coincidir con el `-np` real de ese proceso, o el generador armaría tandas más
 * grandes de lo que el servidor puede atender a la vez.
 */
let slots = 1

/** De a cuántos bloques puede pedir el generador. 1 mientras no haya servidor. */
export function slotsDisponibles(): number {
  return slots
}

function slotsSegunMemoria(modelPath: string): number {
  const libre = freemem()
  let modeloBytes = 0
  try {
    modeloBytes = statSync(modelPath).size
  } catch {
    /* Si no se puede leer el tamaño, se asume el modelo más grande: equivocarse
       para el lado de pedir de más deja la máquina lenta, para el otro lado la
       deja paginando. */
    modeloBytes = 2_740_937_888
  }

  const bloques = bloquesParaMemoria(libre, modeloBytes)
  logger.info(
    'llama',
    `Memoria libre ${Math.round(libre / 1024 ** 2)} MB con un modelo de ${Math.round(modeloBytes / 1024 ** 2)} MB: ` +
      (bloques === 1 ? 'se genera de a un bloque por vez.' : `se generan ${bloques} bloques a la vez.`)
  )
  return bloques
}


export async function startServer(modelPath: string, signal: AbortSignal): Promise<void> {
  /* Si el servidor que ya está levantado sirve, se usa tal cual: `slots` NO se
     vuelve a calcular. Recalcularlo acá dejaba a `slotsDisponibles()` informando un
     número distinto del `-np` con el que ese proceso arrancó de verdad, y el
     generador armaba tandas más grandes de lo que el servidor podía atender a la
     vez. `slots` sólo puede cambiar cuando cambia el proceso. */
  if (server && server.modelPath === modelPath && server.child.exitCode === null) return
  if (server) stopServer()

  slots = slotsSegunMemoria(modelPath)

  const { path: binary, error } = llamaBinary()
  if (!binary) throw new AppError(error ?? 'El motor de generación no está disponible.')

  let ultimoError: unknown = null
  // Reintentos por si el puerto reservado se ocupa en la ventana entre que lo
  // soltamos y que llama-server lo toma.
  for (let intento = 1; intento <= 3; intento++) {
    if (signal.aborted) throw new AppError('Cancelado.', { canceled: true })
    try {
      await intentarArranque(binary, modelPath, signal)
      return
    } catch (err) {
      ultimoError = err
      if (err instanceof AppError && err.canceled) throw err
      const stderr = server?.stderrTail ?? ''
      stopServer()
      if (!esPuertoOcupado(stderr)) throw err
      logger.warn('motor', `El puerto estaba ocupado, reintento ${intento} de 3.`)
    }
  }
  throw ultimoError instanceof Error ? ultimoError : new AppError('No se pudo iniciar el motor de generación.')
}

async function intentarArranque(binary: string, modelPath: string, signal: AbortSignal): Promise<void> {
  const port = await reservePort()
  const apiKey = randomBytes(24).toString('hex')

  const args = [
    '-m', modelPath,
    // Nunca 0.0.0.0: esto no es un servicio, es comunicación entre dos procesos
    // de la misma máquina.
    '--host', '127.0.0.1',
    '--port', String(port),
    '--api-key', apiKey,
    // 8192 y no los 262144 que soporta el modelo: llama-server RESERVA el KV cache
    // del contexto completo al arrancar, y con 262K pediría varios GB y fallaría en
    // la mitad de las notebooks. El bloque más grande del map-reduce son ~3.000
    // tokens, así que 8192 sobra.
    '-c', String(CONTEXT_TOKENS * slots),
    '-t', String(threadCount()),
    // Un solo slot: las pasadas sobre los bloques son secuenciales.
    '-np', String(slots),
    // El build que se distribuye es el de CPU; el flag documenta la intención y
    // protege si algún día se cambia el zip por uno con soporte de GPU.
    '-ngl', '0',
    // Sin interfaz web: nadie va a abrir esto en un navegador, y no tiene sentido
    // servir HTML desde adentro de la app.
    '--no-webui',
    // La plantilla de chat viene adentro del GGUF; con --jinja el servidor la
    // aplica solo y no hay que replicar a mano el formato de prompt de Qwen.
    '--jinja',
    // El primer bloque del map ya calienta el modelo: el warmup son ~3 s de más.
    '--no-warmup'
  ]

  logger.info('motor', `Iniciando el motor de generación en el puerto ${port} con ${threadCount()} hilos.`)

  const child = spawn(binary, args, {
    // ggml busca sus DLL de backend en el directorio del
    // ejecutable, así que el cwd tiene que ser ése.
    cwd: dirname(binary),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const running: RunningServer = { child, port, apiKey, modelPath, stderrTail: '' }
  server = running

  const guardar = (chunk: Buffer): void => {
    // Sólo la cola: el servidor es locuaz y el mensaje útil siempre está al final.
    running.stderrTail = `${running.stderrTail}${chunk.toString('utf8')}`.slice(-4000)
  }
  child.stderr?.on('data', guardar)
  child.stdout?.on('data', guardar)

  child.on('error', (err) => {
    logger.error('motor', 'No se pudo ejecutar el motor de generación.', describeError(err))
  })

  if (child.pid) {
    try {
      writeFileSync(pidFile(), JSON.stringify({ pid: child.pid, startedAt: Date.now() }), 'utf8')
    } catch {
      // Sin el archivo se pierde el barrido de huérfanos, no el funcionamiento.
      logger.warn('motor', 'No se pudo anotar el pid del motor de generación.')
    }
  }

  await esperarSaludable(running, signal)
  logger.info('motor', 'Motor de generación listo.')
}

async function esperarSaludable(running: RunningServer, signal: AbortSignal): Promise<void> {
  const limite = Date.now() + BOOT_TIMEOUT_MS
  for (;;) {
    if (signal.aborted) throw new AppError('Cancelado.', { canceled: true })

    // Si el proceso ya murió no tiene sentido seguir esperando tres minutos: ése
    // era el peor caso posible, esperar a un muerto.
    if (running.child.exitCode !== null) {
      throw new AppError(friendlyLlamaError(running.stderrTail, running.child.exitCode), {
        cause: running.stderrTail
      })
    }
    if (Date.now() > limite) {
      throw new AppError(
        'El motor de generación tardó demasiado en iniciarse. Si la computadora está muy ocupada, probá de nuevo; si vuelve a pasar, probá con el nivel Rápido.'
      )
    }
    if (await ping(running.port, running.apiKey)) return
    await sleep(250)
  }
}

/* -------------------------------- inferencia ------------------------------- */

export interface ChatRequest {
  system: string
  user: string
  /** Esquema JSON que la respuesta tiene que cumplir. */
  schema: object
  schemaName: string
  maxTokens: number
  temperature?: number
  /**
   * Semilla de muestreo. Obligatoria a propósito: es lo que decide si dos pasadas
   * con la misma entrada dan lo mismo o no, y esa decisión tiene que tomarla quien
   * llama, no quedar escondida acá adentro. Ver el comentario en el cuerpo.
   */
  seed: number
}

/**
 * Una pasada de inferencia. Devuelve el texto crudo que generó el modelo.
 *
 * Se pide con `stream: true` por dos razones que no son estéticas:
 *
 *  1. El watchdog de inactividad se puede medir POR TOKEN. Sin streaming, un
 *     modelo colgado y uno lento se ven igual desde afuera: los dos son "todavía
 *     no contestó".
 *  2. Da progreso real para la barra, que en un apunte largo son varios minutos
 *     en los que si no se ve nada, la app parece trabada.
 */
export async function chat(req: ChatRequest, signal: AbortSignal, onToken?: (parcial: string) => void): Promise<string> {
  const actual = server
  if (!actual || actual.child.exitCode !== null) {
    throw new AppError('El motor de generación no está en marcha.')
  }

  const body = JSON.stringify({
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user }
    ],
    // El esquema se convierte a gramática GBNF adentro del servidor, que restringe
    // la generación token a token. Los esquemas que se le mandan son a propósito
    // pobres (objetos, arrays, strings y nada más): con `oneOf`, `anyOf` o
    // `pattern` la conversión se complica y hay casos donde falla en silencio y
    // devuelve texto libre. Por eso igual se parsea a la defensiva.
    response_format: {
      type: 'json_schema',
      json_schema: { name: req.schemaName, strict: true, schema: req.schema }
    },
    // Los modelos chicos de Qwen3.5 ya vienen sin razonamiento, pero dejarlo
    // explícito evita que una actualización del GGUF rompa el parseo en silencio:
    // con el modo "thinking" activo hay casos donde la gramática no se aplica.
    chat_template_kwargs: { enable_thinking: false },
    temperature: req.temperature ?? 0.2,
    top_p: 0.9,
    top_k: 20,
    repeat_penalty: 1.05,
    max_tokens: req.maxTokens,
    // La seed la elige quien llama, y eso NO es un detalle.
    //
    // Convertexto la tiene fija en 42 porque ahí el determinismo es lo correcto:
    // rehacer el resumen del mismo audio y obtener otro texto haría parecer que la
    // app es errática. Acá se quiere lo contrario en un caso concreto: cuando el
    // usuario aprieta "generar más tarjetas" sobre el mismo apunte, espera tarjetas
    // NUEVAS. Con la seed fija recibiría exactamente las mismas y el botón se vería
    // roto. El generador manda una seed distinta en cada pasada por ese motivo.
    seed: req.seed,
    stream: true,
    // El bloque de sistema es idéntico en todas las pasadas del map: reusar su KV
    // cache ahorra su prefill en todos los bloques menos el primero.
    cache_prompt: true
  })

  return new Promise<string>((resolve, reject) => {
    let texto = ''
    let ultimoToken = Date.now()
    let terminado = false

    const req_ = httpRequest(
      {
        host: '127.0.0.1',
        port: actual.port,
        path: '/v1/chat/completions',
        method: 'POST',
        agent: NO_KEEP_ALIVE,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${actual.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          let detalle = ''
          res.on('data', (c: Buffer) => {
            detalle += c.toString('utf8')
          })
          res.on('end', () => {
            cerrar()
            reject(new AppError(`El motor de generación respondió con un error (HTTP ${res.statusCode}).`, { cause: detalle }))
          })
          return
        }

        let pendiente = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          ultimoToken = Date.now()
          pendiente += chunk
          const lineas = pendiente.split('\n')
          pendiente = lineas.pop() ?? ''
          for (const linea of lineas) {
            const limpia = linea.trim()
            if (!limpia.startsWith('data:')) continue
            const carga = limpia.slice(5).trim()
            if (carga === '[DONE]') continue
            try {
              const evento = JSON.parse(carga) as { choices?: Array<{ delta?: { content?: string } }> }
              const trozo = evento.choices?.[0]?.delta?.content
              if (typeof trozo === 'string' && trozo.length > 0) {
                texto += trozo
                onToken?.(texto)
              }
            } catch {
              /* un evento suelto mal formado no invalida la respuesta entera */
            }
          }
        })
        res.on('end', () => {
          cerrar()
          resolve(texto)
        })
        res.on('error', (err) => {
          cerrar()
          reject(err)
        })
      }
    )

    const vigilante = setInterval(() => {
      if (terminado) return
      if (Date.now() - ultimoToken > INACTIVITY_TIMEOUT_MS) {
        cerrar()
        req_.destroy()
        reject(new AppError('El motor de generación dejó de responder. Se canceló la generación; las tarjetas que ya tenías guardadas no se ven afectadas.'))
      }
    }, 5000)
    vigilante.unref()

    const alCancelar = (): void => {
      cerrar()
      req_.destroy()
      reject(new AppError('Cancelado.', { canceled: true }))
    }

    function cerrar(): void {
      if (terminado) return
      terminado = true
      clearInterval(vigilante)
      signal.removeEventListener('abort', alCancelar)
    }

    if (signal.aborted) return alCancelar()
    signal.addEventListener('abort', alCancelar, { once: true })

    req_.on('error', (err) => {
      cerrar()
      reject(err)
    })
    req_.write(body)
    req_.end()
  })
}
