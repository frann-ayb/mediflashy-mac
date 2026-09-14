#!/usr/bin/env node
/**
 * Compila y corre uno de los arneses de QA de `qa/` dentro de Electron.
 * Los arneses usan `app` y `net`, así que no pueden correr con Node pelado.
 *
 *   node scripts/run-qa.mjs datos       # CRUD de los 3 niveles, cascadas, índice
 *   node scripts/run-qa.mjs scheduler   # FSRS, topes diarios, sesión de estudio
 *   node scripts/run-qa.mjs ingesta     # los 4 formatos de apunte
 *   node scripts/run-qa.mjs siembra     # los mazos de regalo que trae la app
 *   node scripts/run-qa.mjs e2e         # de los PDFs de prueba al estudio, con modelo
 *   node scripts/run-qa.mjs exhaustiva  # Normal contra Exhaustiva sobre los apuntes largos
 *   node scripts/run-qa.mjs generacion  # el generador (con --real usa el modelo)
 *
 * La interfaz real no pasa por acá porque necesita manejar la app por CDP:
 * `node qa/ui.mjs`.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2] ?? 'harness'
const entry = join(ROOT, 'qa', `${target}.ts`)

if (!existsSync(entry)) {
  // La lista se lee de la carpeta y no se escribe a mano: escrita a mano se
  // desactualiza, y nombraba dos arneses que ya no existen.
  const hay = readdirSync(join(ROOT, 'qa'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => f.slice(0, -3))
    .join(', ')
  console.error(`No existe qa/${target}.ts. Opciones: ${hay}.`)
  process.exit(1)
}

// A diferencia de Convertexto, acá los arneses no necesitan archivos de prueba
// preexistentes: los que hacen falta (un .pptx, un .txt) los fabrica el propio
// arnés en `.qa/`, porque son de kilobytes y no de megabytes de audio.

const outDir = join(ROOT, '.qa')
mkdirSync(outDir, { recursive: true })
const bundle = join(outDir, `${target}.cjs`)

/**
 * Las dependencias de producción se dejan EXTERNAS, igual que hace
 * `externalizeDepsPlugin()` con la app real. Es lo que hace que el arnés ejercite
 * el mismo camino de carga que el producto y no una versión bundleada distinta.
 *
 * `canvas` va aparte y no está en package.json a propósito: pdfjs-dist lo pide con
 * un `require()` opcional para renderizar en Node, cosa que acá no se hace nunca.
 * Sin declararlo externo, esbuild corta el build por no poder resolver un módulo
 * que en tiempo de ejecución jamás se pide.
 */
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const externos = ['electron', 'canvas', ...Object.keys(pkg.dependencies ?? {})]

const esbuild = join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild')
const build = spawnSync(
  process.execPath,
  [
    esbuild,
    entry,
    '--bundle',
    '--platform=node',
    '--target=node22',
    '--format=cjs',
    ...externos.map((n) => `--external:${n}`),
    `--tsconfig=${join(ROOT, 'tsconfig.node.json')}`,
    `--outfile=${bundle}`
  ],
  { stdio: 'inherit', cwd: ROOT }
)
if (build.status !== 0) process.exit(build.status ?? 1)

// La ruta la resuelve el paquete: en macOS es Electron.app/Contents/MacOS/Electron.
const electron = createRequire(import.meta.url)('electron')
const env = { ...process.env }
// Si está seteada, Electron correría como Node pelado y no habría `app`.
delete env.ELECTRON_RUN_AS_NODE

/**
 * Lo que venga después del nombre del arnés se le pasa tal cual.
 *
 * Es lo que hace funcionar a `npm run qa:generacion-real`, que es
 * `run-qa.mjs generacion -- --real`: npm se come el `--` y deja `--real`, y sin
 * esta línea el flag se perdía acá y el arnés corría siempre en modo sin modelo,
 * informando que todo pasó sin haber probado la generación de verdad.
 */
const extra = process.argv.slice(3).filter((a) => a !== '--')

const run = spawnSync(electron, [bundle, ...extra], { stdio: 'inherit', cwd: ROOT, env })
process.exit(run.status ?? 1)
