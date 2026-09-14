/**
 * Que las cuatro capas del contrato IPC digan lo mismo.
 *
 *   node scripts/verify-ipc.mjs
 *
 * POR QUÉ EXISTE
 * --------------
 * El contrato entre el renderer y el proceso principal vive en cuatro archivos
 * separados: el nombre del canal en `shared/types.ts`, la firma en
 * `shared/api.ts`, el `ipcRenderer.invoke` en `preload/index.ts` y el `handle()`
 * en `main/ipc.ts`. TypeScript verifica tres de las cuatro, pero NO la que
 * importa: que exista un handler para cada canal que el preload invoca. El
 * `invoke` de un canal sin handler compila perfecto y falla en tiempo de
 * ejecución con "No handler registered for 'x'", que es jerga de Electron
 * mostrada tal cual adentro de un cartel rojo.
 *
 * Pasó de verdad: se agregó `doc:pick-many` en tres capas y el handler quedó sin
 * registrar por un error de edición. Compiló, pasó el typecheck, pasó los arneses
 * —ninguno abre el diálogo nativo— y llegó al instalador. El botón "Elegir
 * varios" fallaba siempre, y con él toda la cola de generación quedaba
 * inalcanzable.
 *
 * Este script es la comprobación que faltaba. Corre dentro de `npm run build`,
 * así que ningún instalador se puede armar con un canal huérfano.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (p) => readFileSync(join(ROOT, p), 'utf8')

/* ------------------------- 1. los canales declarados ------------------------ */

const types = leer('src/shared/types.ts')
const bloque = types.match(/export const IPC = \{([\s\S]*?)\n\} as const/)
if (!bloque) {
  console.error('No encontré el mapa `export const IPC = {...} as const` en src/shared/types.ts.')
  process.exit(1)
}

/** nombre en el código → string del canal. Ej: docPickMany → 'doc:pick-many' */
const canales = new Map()
for (const m of bloque[1].matchAll(/^\s*(\w+):\s*'([^']+)'/gm)) canales.set(m[1], m[2])

if (canales.size === 0) {
  console.error('El mapa IPC quedó vacío al parsearlo: cambió el formato y este script dejó de servir.')
  process.exit(1)
}

/* --------------------- 2. lo que el preload le pide al main ------------------ */

const preload = leer('src/preload/index.ts')
const invocados = new Set()
for (const m of preload.matchAll(/ipcRenderer\.(?:invoke|send|sendSync)\(\s*IPC\.(\w+)/g)) invocados.add(m[1])
/* `ipcRenderer.on` es el sentido inverso —el main avisa— y no necesita handler. */
const escuchados = new Set()
for (const m of preload.matchAll(/ipcRenderer\.(?:on|once)\(\s*IPC\.(\w+)/g)) escuchados.add(m[1])

/* --------------------- 3. lo que el main efectivamente atiende --------------- */

const main = leer('src/main/ipc.ts')
const atendidos = new Set()
/* El genérico se salta con [^(]* y NO con [^>]*: `handle<[Partial<AppConfig>],
   AppConfig>(IPC.configSet` tiene un `>` adentro que cortaba el match y daba un
   falso positivo sobre un canal que sí estaba registrado. Se corta en el
   paréntesis de apertura, que es inequívoco. */
for (const m of main.matchAll(/\bhandle\s*(?:<[^(]*>)?\s*\(\s*IPC\.(\w+)/g)) atendidos.add(m[1])
for (const m of main.matchAll(/ipcMain\.(?:handle|on|once)\(\s*IPC\.(\w+)/g)) atendidos.add(m[1])

/* ------------------------------ 4. el veredicto ----------------------------- */

const huerfanos = [...invocados].filter((n) => !atendidos.has(n))
const desconocidos = [...invocados, ...atendidos].filter((n) => !canales.has(n))
/* Un handler que nadie invoca no rompe nada, pero es código muerto: se avisa. */
const sinUsar = [...atendidos].filter((n) => !invocados.has(n) && !escuchados.has(n))

console.log('')
console.log(`  ${canales.size} canales declarados · ${invocados.size} invocados por el preload · ${atendidos.size} atendidos por el main`)

if (desconocidos.length > 0) {
  console.error('\n  ✗ Nombres que no están en el mapa IPC de shared/types.ts:')
  for (const n of desconocidos) console.error(`      IPC.${n}`)
}

if (huerfanos.length > 0) {
  console.error('\n  ✗ CANALES SIN HANDLER. El preload los invoca y el main no los atiende:')
  for (const n of huerfanos) console.error(`      IPC.${n}  ('${canales.get(n)}')`)
  console.error('\n    Cualquiera de estos falla en tiempo de ejecución con "No handler')
  console.error('    registered", mostrado tal cual al comprador. Registralos en')
  console.error('    src/main/ipc.ts con handle(...) antes de compilar.')
}

if (sinUsar.length > 0) {
  console.log('\n  ·  Handlers que ningún preload invoca (no rompe, pero puede ser código muerto):')
  for (const n of sinUsar) console.log(`      IPC.${n}`)
}

if (huerfanos.length > 0 || desconocidos.length > 0) {
  console.error('')
  process.exit(1)
}

console.log('  ✓ Todos los canales que el preload invoca tienen handler.\n')
