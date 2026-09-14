#!/usr/bin/env node
/**
 * Descarga el binario `llama-server` de llama.cpp y lo deja en
 * `resources/llm/<plataforma-arquitectura>/` para que electron-builder lo
 * empaquete como recurso extra. Es el motor que genera las tarjetas, y corre
 * 100 % en la computadora del usuario.
 *
 * Uso:
 *   node scripts/fetch-llama.mjs             # instala si falta
 *   node scripts/fetch-llama.mjs --force     # reinstala siempre
 *   node scripts/fetch-llama.mjs --optional  # no falla el proceso si hay error (postinstall)
 *
 * En Windows baja el build de CPU x64. En macOS baja arm64 Y x64, porque
 * `electron-builder --mac` arma los dos .dmg en la misma corrida.
 *
 * ---------------------------------------------------------------------------
 * Por qué una carpeta `llm` propia
 * ---------------------------------------------------------------------------
 *
 * Viene de Convertexto, donde conviven whisper.cpp y llama.cpp: los dos usan ggml
 * y sus librerías se llaman igual (`ggml.dll`, `ggml-base.dll`, `ggml-cpu-*.dll`),
 * pero están compiladas contra COMMITS DISTINTOS de ggml y exportan los mismos
 * símbolos con firmas que no tienen por qué coincidir. La que cargue segunda se
 * lleva la versión de la otra y falla a mitad de un trabajo, sin mensaje.
 *
 * Acá no hay whisper, así que el riesgo no existe — pero la carpeta se mantiene
 * igual para que este script y el de Convertexto sigan siendo el mismo archivo, y
 * un arreglo en uno se pueda traer al otro sin traducir rutas.
 *
 * ---------------------------------------------------------------------------
 * Por qué el build de CPU y no el de CUDA o Vulkan
 * ---------------------------------------------------------------------------
 *
 * El de CPU pesa 18 MB; el de CUDA, 250 MB más 390 MB de runtime, y sólo sirve en
 * placas NVIDIA. El de Vulkan (34 MB) andaría en casi cualquier GPU y sería
 * bastante más rápido, pero agrega una superficie de fallo nueva (drivers viejos,
 * GPU integradas que reportan soporte y no lo tienen). Queda anotado como mejora,
 * detectando el backend en tiempo de ejecución y cayendo a CPU si no anda.
 *
 * En macOS no aplica: el build oficial ya usa Metal, que viene con el sistema.
 */
import {
  chmodSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import https from 'node:https'
import { copyVcRuntime } from './lib/vc-runtime.mjs'

/**
 * Build fijo, no "latest".
 *
 * llama.cpp publica varias veces por día. Con "latest", dos compilaciones del
 * mismo código de la app se llevarían motores distintos, y un bug que aparece en
 * la máquina de un comprador sería imposible de reproducir acá. Subir esta
 * constante es una decisión explícita, con su prueba de QA.
 */
const LLAMA_BUILD = 'b10361'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RESOURCES = join(ROOT, 'resources', 'llm')

const argv = process.argv.slice(2)
const FORCE = argv.includes('--force')
const OPTIONAL = argv.includes('--optional')

const log = (msg) => console.log(`[llama] ${msg}`)
const warn = (msg) => console.warn(`[llama] ${msg}`)

/** Descarga una URL a un archivo, siguiendo redirecciones, mostrando progreso. */
function download(url, dest, redirects = 0) {
  return new Promise((res, rej) => {
    if (redirects > 8) return rej(new Error('Demasiadas redirecciones'))
    https
      .get(url, { headers: { 'User-Agent': 'transcriptor-setup' } }, (response) => {
        const status = response.statusCode ?? 0
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume()
          const next = new URL(response.headers.location, url).toString()
          return download(next, dest, redirects + 1).then(res, rej)
        }
        if (status !== 200) {
          response.resume()
          return rej(new Error(`HTTP ${status} al descargar ${url}`))
        }
        const total = Number(response.headers['content-length'] ?? 0)
        let received = 0
        let lastPrint = 0
        const out = createWriteStream(dest)
        response.on('data', (chunk) => {
          received += chunk.length
          const now = Date.now()
          if (total > 0 && now - lastPrint > 500) {
            lastPrint = now
            process.stdout.write(`\r[llama] descargando… ${Math.round((received / total) * 100)}%`)
          }
        })
        response.pipe(out)
        out.on('finish', () => {
          if (total > 0) process.stdout.write('\r[llama] descargando… 100%\n')
          out.close(() => res())
        })
        out.on('error', rej)
        response.on('error', rej)
      })
      .on('error', rej)
  })
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`\`${cmd} ${args.join(' ')}\` terminó con código ${r.status}`)
}

function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Deja el texto de la licencia MIT junto al binario, igual que whisper.
 *
 * El zip de llama.cpp tampoco lo trae, así que se baja del repositorio en el mismo
 * build. Se verifica el contenido y no sólo que el archivo exista: un 404 en HTML
 * pasaría un `existsSync` y dejaría el aviso de licencias diciendo cualquier cosa.
 */
async function ensureLicense(fromPackage, target) {
  if (existsSync(fromPackage)) {
    copyFileSync(fromPackage, target)
    log('copiada la licencia MIT de llama.cpp junto al binario.')
    return
  }
  const url = `https://raw.githubusercontent.com/ggml-org/llama.cpp/${LLAMA_BUILD}/LICENSE`
  try {
    await download(url, target)
    const texto = readFileSync(target, 'utf8')
    if (!/MIT License/i.test(texto) || texto.length < 500) {
      rmSync(target, { force: true })
      throw new Error('lo que se bajó no parece el texto de la licencia MIT')
    }
    log(`licencia MIT de llama.cpp bajada del repositorio (${LLAMA_BUILD}) y guardada junto al binario.`)
  } catch (err) {
    warn(`no se pudo obtener el LICENSE de llama.cpp (${err.message}). NO distribuyas sin resolverlo.`)
  }
}

/* ------------------------------- Windows -------------------------------- */

async function setupWindows() {
  const target = join(RESOURCES, 'win32-x64')
  const exe = join(target, 'llama-server.exe')
  if (existsSync(exe) && !FORCE) {
    log(`ya instalado (${exe}) — usá --force para reinstalar.`)
    return
  }

  const work = freshDir(join(tmpdir(), `llama-setup-${process.pid}`))
  const asset = `llama-${LLAMA_BUILD}-bin-win-cpu-x64.zip`
  const zip = join(work, asset)
  const url = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/${asset}`

  log(`descargando llama.cpp ${LLAMA_BUILD} para Windows x64 (CPU)…`)
  await download(url, zip)

  log('extrayendo…')
  const extract = join(work, 'x')
  run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${extract}' -Force`
  ])

  // Según el build, el zip trae todo en la raíz o dentro de \build\bin.
  let srcDir = extract
  for (const sub of [join(extract, 'build', 'bin'), join(extract, 'bin'), join(extract, 'Release')]) {
    if (existsSync(join(sub, 'llama-server.exe'))) {
      srcDir = sub
      break
    }
  }

  // Sólo el servidor y sus librerías. El zip trae además llama-cli, llama-bench,
  // llama-quantize, llama-tts y una docena más de herramientas que la app no usa:
  // meterlas sería engordar el instalador y ampliar la superficie que revisa un
  // antivirus sin ninguna ganancia.
  //
  // OJO con la forma del paquete: desde estos builds `llama-server.exe` es un
  // lanzador de 9 KB y toda la lógica vive en `llama-server-impl.dll`, que a su vez
  // depende de `llama-common.dll` y del runtime de OpenMP de LLVM
  // (`libomp140.x86_64.dll`). Copiar sólo el .exe deja un binario que arranca y
  // muere con 0xC0000135 (DLL no encontrada) sin decir cuál. Si en un build futuro
  // vuelve a cambiar, el chequeo de `--version` del final lo detecta acá y no en la
  // computadora del comprador.
  //
  // Los ggml-cpu-*.dll son variantes por set de instrucciones; ggml elige en
  // tiempo de ejecución la que soporte la CPU del usuario, así que van todas.
  const keep = (f) =>
    f === 'llama-server.exe' ||
    f === 'llama-server-impl.dll' ||
    f === 'llama-common.dll' ||
    f === 'llama.dll' ||
    f === 'ggml.dll' ||
    f === 'ggml-base.dll' ||
    f === 'ggml-rpc.dll' ||
    f === 'mtmd.dll' ||
    f === 'libomp140.x86_64.dll' ||
    /^ggml-cpu-.*\.dll$/.test(f)

  freshDir(target)
  const files = readdirSync(srcDir).filter(keep)
  if (!files.includes('llama-server.exe')) {
    throw new Error(`El zip descargado no contiene llama-server.exe (¿cambió el formato del release ${LLAMA_BUILD}?)`)
  }
  for (const f of files) copyFileSync(join(srcDir, f), join(target, f))

  await ensureLicense(join(srcDir, 'LICENSE'), join(target, 'LICENSE.txt'))

  const runtime = copyVcRuntime(target, { log, warn, setupCmd: 'npm run setup:llama -- --force' })

  writeFileSync(
    join(target, 'VERSION.txt'),
    // El formato lo parsea scripts/write-licenses.mjs para armar el aviso de
    // licencias: la primera línea tiene que empezar con "llama.cpp <build>" y
    // tiene que haber una línea "Código fuente:".
    `llama.cpp ${LLAMA_BUILD} (release oficial ${asset}) — licencia MIT.\n` +
      `Código fuente: https://github.com/ggml-org/llama.cpp/tree/${LLAMA_BUILD}\n` +
      `+ runtime de Visual C++ (${runtime.source}) para que el motor no dependa del redistribuible.\n`,
    'utf8'
  )
  rmSync(work, { recursive: true, force: true })

  const size = (statSync(exe).size / 1024 / 1024).toFixed(1)
  log(`listo: ${files.length + runtime.count} archivos en resources/llm/win32-x64 (llama-server.exe ${size} MB)`)

  // Verificación dura: que el binario arranque y responda de verdad.
  //
  // Es un `throw` y no un warning a propósito. La primera vez que se armó esto, el
  // filtro de arriba dejaba afuera `llama-server-impl.dll` y quedaba un .exe de
  // 9 KB que moría con 0xC0000135 sin imprimir nada. Un warning en medio de un log
  // de build se pasa por alto; un motor roto adentro del instalador que se vende,
  // no se puede pasar por alto: llega hasta la computadora del comprador.
  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8', windowsHide: true })
  const salida = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
  if (!/version|build/i.test(salida)) {
    const codigo = probe.status === null ? 'no arrancó' : `código ${probe.status}`
    const pista =
      probe.status === 3221225781 || probe.status === -1073741515
        ? ' Le falta una DLL: revisá el filtro `keep` contra el contenido del zip.'
        : ''
    throw new Error(`llama-server.exe no respondió a --version (${codigo}).${pista}`)
  }
  log(`verificado: ${salida.split('\n').find((l) => l.trim().length > 0)?.trim() ?? 'responde'}`)
}

/* --------------------------------- macOS --------------------------------- */

/**
 * Descarga `llama-server` para macOS, en las dos arquitecturas.
 *
 * A diferencia de Convertexto —cuyo árbol de Windows deriva esto a la carpeta
 * "version mac"—, acá Flashcards se entrega para las dos plataformas desde el
 * mismo proyecto, así que las dos arquitecturas se preparan juntas y el .dmg de
 * cada una encuentra su binario.
 *
 * ---------------------------------------------------------------------------
 * Por qué se bajan las DOS aunque la máquina sea una sola
 * ---------------------------------------------------------------------------
 *
 * `electron-builder --mac` arma un .dmg para arm64 y otro para x64 en la misma
 * corrida, y `extraResources` copia la carpeta `resources/llm` ENTERA en los dos.
 * Si sólo estuviera la arquitectura de la máquina que compila, el .dmg de la otra
 * saldría sin motor y el comprador vería "no se encontró el motor de generación"
 * en una app recién instalada.
 *
 * Pesan unos 20 MB cada una comprimidas: es barato comparado con enviar un
 * instalador roto.
 *
 * ---------------------------------------------------------------------------
 * Firma
 * ---------------------------------------------------------------------------
 *
 * Los binarios que bajan de un release de GitHub vienen sin firmar. NO se firman
 * acá: los firma `electron-builder` durante el build, con el mismo Developer ID
 * que el resto del bundle, porque están declarados en `mac.binaries` de
 * electron-builder.yml. Firmarlos acá con `codesign -s -` (ad-hoc) sería peor que
 * no firmarlos: una firma ad-hoc no tiene Team ID y hace que la validación de
 * librerías los rechace.
 *
 * Sí se les saca el atributo de cuarentena, que es lo que macOS le pone a todo lo
 * que se descarga: sin eso, el `--version` de verificación de más abajo falla en
 * la máquina de desarrollo con un diálogo de Gatekeeper.
 */
async function setupMac() {
  /*
   * Los assets de macOS son .tar.gz, NO .zip como los de Windows. Verificado
   * contra la API de releases: `llama-<build>-bin-macos-arm64.tar.gz`. Asumir el
   * .zip por analogía con Windows da un 404 recién al compilar en la Mac.
   */
  const ARQUITECTURAS = [
    { arch: 'arm64', asset: `llama-${LLAMA_BUILD}-bin-macos-arm64.tar.gz`, carpeta: 'darwin-arm64' },
    { arch: 'x64', asset: `llama-${LLAMA_BUILD}-bin-macos-x64.tar.gz`, carpeta: 'darwin-x64' }
  ]

  for (const { arch, asset, carpeta } of ARQUITECTURAS) {
    const target = join(RESOURCES, carpeta)
    const exe = join(target, 'llama-server')

    if (existsSync(exe) && !FORCE) {
      log(`${arch}: ya instalado (${exe}) — usá --force para reinstalar.`)
      continue
    }

    const work = freshDir(join(tmpdir(), `llama-setup-${arch}-${process.pid}`))
    const archivo = join(work, asset)
    const url = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/${asset}`

    log(`descargando llama.cpp ${LLAMA_BUILD} para macOS ${arch}…`)
    await download(url, archivo)

    log(`${arch}: extrayendo…`)
    const extract = join(work, 'x')
    mkdirSync(extract, { recursive: true })
    // `tar` viene con macOS y conserva el bit de ejecución del archivo original.
    run('tar', ['-xzf', archivo, '-C', extract])

    /*
     * El .tar.gz de macOS extrae TODO dentro de un directorio propio llamado como
     * el build (`llama-b10361/`), no en la raíz ni en `build/bin` como el .zip de
     * Windows. Se prueban las tres formas y, como red, cualquier subdirectorio
     * único que contenga el binario: así un cambio de layout en un build futuro no
     * rompe el setup en silencio.
     */
    const candidatos = [join(extract, `llama-${LLAMA_BUILD}`), join(extract, 'build', 'bin'), join(extract, 'bin'), extract]
    for (const sub of readdirSync(extract, { withFileTypes: true })) {
      if (sub.isDirectory()) candidatos.push(join(extract, sub.name))
    }

    const srcDir = candidatos.find((d) => existsSync(join(d, 'llama-server')))
    if (!srcDir) {
      throw new Error(`El paquete de ${arch} no contiene llama-server (¿cambió el formato del release ${LLAMA_BUILD}?)`)
    }

    /*
     * Qué se copia. Igual que en Windows: sólo el servidor y lo que necesita para
     * levantar, no las quince herramientas del release.
     *
     * El release trae unas veinticinco herramientas (llama-cli, llama-bench,
     * llama-tts…) que la app no usa: meterlas sería engordar el .dmg sin ganancia.
     *
     * En macOS las librerías son `.dylib`. Se copia también un `.metallib` si
     * apareciera: hoy el shader de Metal viene EMBEBIDO en libggml-metal (se
     * verificó: el paquete de b10361 no trae ningún .metallib suelto), pero si un
     * build futuro lo separa y no viajara, ggml caería al backend de CPU en
     * silencio — la app andaría igual, varias veces más lenta, que es el tipo de
     * degradación que nadie reporta como bug.
     */
    const keep = (f) => f === 'llama-server' || f === 'default.metallib' || /\.dylib$/.test(f)

    freshDir(target)
    const files = readdirSync(srcDir).filter(keep)
    for (const f of files) {
      const origen = join(srcDir, f)
      const destino = join(target, f)

      /*
       * Los symlinks se recrean como symlinks, no se resuelven.
       *
       * La mitad de los .dylib del paquete son enlaces a la versión completa
       * (`libggml.dylib` → `libggml.0.dylib` → `libggml.0.19.0.dylib`). Copiarlos
       * como archivos reales triplicaría el peso de cada librería en el .dmg, y
       * además `codesign` firmaría tres copias distintas de lo mismo.
       */
      if (lstatSync(origen).isSymbolicLink()) {
        symlinkSync(readlinkSync(origen), destino)
        continue
      }

      copyFileSync(origen, destino)
      if (f === 'llama-server') chmodSync(destino, 0o755)
      // Sacar la cuarentena de la descarga; si el atributo no está, no pasa nada.
      spawnSync('xattr', ['-d', 'com.apple.quarantine', destino], { stdio: 'ignore' })
    }

    await ensureLicense(join(srcDir, 'LICENSE'), join(target, 'LICENSE.txt'))

    writeFileSync(
      join(target, 'VERSION.txt'),
      `llama.cpp ${LLAMA_BUILD} (release oficial ${asset}) — licencia MIT.\n` +
        `Código fuente: https://github.com/ggml-org/llama.cpp/tree/${LLAMA_BUILD}\n`,
      'utf8'
    )
    rmSync(work, { recursive: true, force: true })

    const size = (statSync(exe).size / 1024 / 1024).toFixed(1)
    log(`${arch}: listo, ${files.length} archivo(s) en resources/llm/${carpeta} (llama-server ${size} MB)`)

    /*
     * La verificación sólo puede correr sobre la arquitectura NATIVA.
     *
     * En una Mac con Apple Silicon el binario x64 corre bajo Rosetta 2, que puede no
     * estar instalada; y en una Intel el arm64 directamente no arranca. Que no se
     * pueda verificar el cruzado no es un error del setup, así que se avisa y se
     * sigue — pero el nativo SÍ se verifica duro, con `throw`, por el mismo motivo
     * que en Windows: un motor roto adentro de un .dmg firmado llega hasta la
     * computadora del comprador.
     */
    const nativa = arch === process.arch
    if (!nativa) {
      log(`${arch}: no se verifica en esta máquina (es ${process.arch}); se comprueba al armar el .dmg de esa arquitectura.`)
      continue
    }

    const probe = spawnSync(exe, ['--version'], { encoding: 'utf8' })
    const salida = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
    if (!/version|build/i.test(salida)) {
      throw new Error(`llama-server (${arch}) no respondió a --version (${probe.status === null ? 'no arrancó' : `código ${probe.status}`}).`)
    }
    log(`${arch}: verificado — ${salida.split('\n').find((l) => l.trim().length > 0)?.trim() ?? 'responde'}`)
  }
}

/* ---------------------------------- main --------------------------------- */

async function main() {
  mkdirSync(RESOURCES, { recursive: true })
  if (process.platform === 'win32') await setupWindows()
  else if (process.platform === 'darwin') await setupMac()
  else warn(`no hay binarios de llama.cpp preparados para ${process.platform}: la app se distribuye para Windows y macOS.`)
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err)
  if (OPTIONAL) {
    // En el postinstall no se corta la instalación: quien compile va a correr
    // `npm run setup:llama` a mano y ahí sí ve el error completo.
    warn(`no se pudo preparar el motor de resúmenes: ${msg}`)
    warn('corré `npm run setup:llama` cuando tengas conexión. Sin esto, la app no puede generar resúmenes.')
    process.exit(0)
  }
  console.error(`[llama] ${msg}`)
  process.exit(1)
})
