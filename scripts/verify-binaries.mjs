#!/usr/bin/env node
/**
 * Verifica que el motor esté completo y sano ANTES de empaquetar.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * `fetch-llama.mjs` corre en el `postinstall` con `--optional`: si falla —no hay
 * internet, GitHub está caído, el zip cambió de formato— avisa y deja seguir, para
 * que un `npm install` no se muera por eso. Es la decisión correcta ahí y es
 * exactamente el agujero que deja: se puede llegar a `electron-builder` con la
 * carpeta del motor vacía o a medias, y el instalador sale sin motor.
 *
 * Ese instalador ARRANCA. Muestra la biblioteca, deja estudiar, deja editar. Lo
 * único que no hace es generar tarjetas, que es para lo que se compró. El
 * comprador lo descubre solo, después de pagar.
 *
 * Por eso esto CORTA el build en vez de avisar. Va en `build:win` y `build:mac`,
 * antes de electron-builder.
 *
 *   node scripts/verify-binaries.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LLM = join(ROOT, 'resources', 'llm')
const ARREGLO = 'npm run setup:llama -- --force'

const problemas = []
const avisos = []

const falla = (msg) => problemas.push(msg)
const avisar = (msg) => avisos.push(msg)

/**
 * Qué carpetas tienen que estar según para dónde se compila.
 *
 * En Windows sólo se puede armar el instalador de Windows, así que se exige
 * `win32-x64` y nada más. En macOS se arman los DOS .dmg en la misma corrida y
 * `extraResources` copia la carpeta entera en los dos, así que faltando una
 * arquitectura sale un .dmg sin motor.
 */
function carpetasEsperadas() {
  if (process.platform === 'darwin') return ['darwin-arm64', 'darwin-x64']
  if (process.platform === 'win32') return ['win32-x64']
  return []
}

const ejecutable = (carpeta) => (carpeta.startsWith('win32') ? 'llama-server.exe' : 'llama-server')

/**
 * Archivos vacíos.
 *
 * Un archivo de 0 bytes pasa cualquier `existsSync` y es lo que queda de una
 * descarga interrumpida o de un antivirus que puso el archivo en cuarentena
 * mientras se copiaba. Se chequea el tamaño, no la existencia.
 */
function revisarNoVacios(dir) {
  for (const f of readdirSync(dir)) {
    const ruta = join(dir, f)
    try {
      if (statSync(ruta).isFile() && statSync(ruta).size === 0) {
        falla(`${join('resources', 'llm', dir.slice(LLM.length + 1), f)} está vacío (0 bytes). Arreglalo con: ${ARREGLO}`)
      }
    } catch {
      /* un symlink roto lo detecta la prueba del binario */
    }
  }
}

for (const carpeta of carpetasEsperadas()) {
  const dir = join(LLM, carpeta)
  const exe = join(dir, ejecutable(carpeta))

  if (!existsSync(dir)) {
    falla(`Falta resources/llm/${carpeta}. Arreglalo con: ${ARREGLO}`)
    continue
  }
  if (!existsSync(exe)) {
    falla(`Falta el motor en resources/llm/${carpeta}. Arreglalo con: ${ARREGLO}`)
    continue
  }

  revisarNoVacios(dir)

  /*
   * El aviso de licencias se arma leyendo esto. Sin el VERSION.txt, el aviso sale
   * sin la versión de llama.cpp ni el link a su código fuente —que es justo lo que
   * la licencia MIT pide reproducir—, y `write-licenses.mjs` corta.
   */
  const version = join(dir, 'VERSION.txt')
  if (!existsSync(version)) falla(`Falta resources/llm/${carpeta}/VERSION.txt. Arreglalo con: ${ARREGLO}`)
  else if (!/llama\.cpp\s+\S+/.test(readFileSync(version, 'utf8'))) {
    falla(`resources/llm/${carpeta}/VERSION.txt no tiene el formato esperado. Arreglalo con: ${ARREGLO}`)
  }

  const licencia = join(dir, 'LICENSE.txt')
  if (!existsSync(licencia)) falla(`Falta resources/llm/${carpeta}/LICENSE.txt (la licencia MIT de llama.cpp). Arreglalo con: ${ARREGLO}`)
  else if (!/MIT License/i.test(readFileSync(licencia, 'utf8'))) {
    falla(`resources/llm/${carpeta}/LICENSE.txt no parece el texto de la licencia MIT. Arreglalo con: ${ARREGLO}`)
  }

  /*
   * La prueba de fuego: que el binario arranque.
   *
   * Sólo se puede correr sobre la arquitectura nativa. En una Mac con Apple
   * Silicon el binario x64 necesita Rosetta 2, que puede no estar; y al revés
   * directamente no corre. Cuando no se puede probar se avisa, porque no poder
   * verificar no es lo mismo que estar roto — pero tampoco es lo mismo que estar
   * verificado, y quien compila tiene que saber cuál de las dos cosas pasó.
   */
  const nativa =
    (carpeta === 'win32-x64' && process.platform === 'win32') ||
    (carpeta === `darwin-${process.arch}` && process.platform === 'darwin')

  if (!nativa) {
    avisar(`No se pudo ejecutar el motor de ${carpeta} en esta máquina (es ${process.platform}/${process.arch}): está presente pero sin probar.`)
    continue
  }

  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8', windowsHide: true })
  const salida = `${probe.stdout ?? ''}${probe.stderr ?? ''}`
  if (!/version|build/i.test(salida)) {
    const codigo = probe.status === null ? 'no arrancó' : `código ${probe.status}`
    const pista =
      probe.status === 3221225781 || probe.status === -1073741515
        ? ' Le falta una DLL: revisá el filtro `keep` de fetch-llama.mjs contra el contenido del zip.'
        : ''
    falla(`El motor de ${carpeta} no respondió a --version (${codigo}).${pista} Arreglalo con: ${ARREGLO}`)
  } else {
    console.log(`[binarios] ${carpeta}: ${salida.split('\n').find((l) => l.trim().length > 0)?.trim() ?? 'responde'}`)
  }
}

if (carpetasEsperadas().length === 0) {
  console.log(`[binarios] ${process.platform} no es una plataforma de distribución; no hay nada que verificar.`)
  process.exit(0)
}

for (const a of avisos) console.warn(`[binarios] AVISO: ${a}`)

if (problemas.length > 0) {
  console.error('\n[binarios] El motor NO está listo para empaquetar:\n')
  for (const p of problemas) console.error(`  · ${p}`)
  console.error('\nEl build se detiene acá a propósito: un instalador sin motor abre igual y')
  console.error('sólo falla al generar tarjetas, o sea en la computadora del comprador.\n')
  process.exit(1)
}

console.log('[binarios] El motor está completo y responde.')
