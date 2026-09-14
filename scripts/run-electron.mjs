#!/usr/bin/env node
/**
 * Corre un script dentro de Electron en lugar de Node.
 *
 * Hace falta para todo lo que necesite `app`, `BrowserWindow` o `net` — o sea,
 * la impresión de los PDF. Es el mismo truco que usa `run-qa.mjs`, pero sin el
 * paso de esbuild: estos scripts ya son .mjs y Electron 43 los carga tal cual.
 *
 * `ELECTRON_RUN_AS_NODE` se BORRA del entorno a propósito. Si viene puesta
 * —y viene puesta cuando algo se lanza desde otro proceso de Electron—, el
 * binario arranca como un Node pelado, sin `app` ni ventanas, y el script se
 * cae con un "Cannot read properties of undefined" que no dice nada.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const objetivo = process.argv[2]
if (!objetivo) {
  console.error('Uso: node scripts/run-electron.mjs <script.mjs> [args…]')
  process.exit(1)
}

/* La ruta la resuelve el propio paquete (lee path.txt): en macOS el binario es
   Electron.app/Contents/MacOS/Electron, no `dist/electron`, y armarla a mano
   rompía `npm run drive` en el runner de Mac. */
const electron = createRequire(import.meta.url)('electron')
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const r = spawnSync(electron, [join(ROOT, objetivo), ...process.argv.slice(3)], { stdio: 'inherit', env, cwd: ROOT })
process.exit(r.status ?? 1)
