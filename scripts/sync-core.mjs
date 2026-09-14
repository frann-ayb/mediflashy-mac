#!/usr/bin/env node
/**
 * Vigila que el núcleo compartido con Convertexto no se desincronice sin que
 * nadie se entere.
 *
 * ---------------------------------------------------------------------------
 * Por qué copia y no un paquete compartido
 * ---------------------------------------------------------------------------
 *
 * Convertexto es un producto que YA SE VENDIÓ y está instalado en máquinas de
 * compradores. Si el motor de IA viviera en un paquete compartido, cualquier
 * cambio hecho para Flashcards podría romper Convertexto, y nadie se enteraría
 * hasta que llegue un mail de soporte. El aislamiento vale más que el DRY.
 *
 * Pero copiar sin disciplina es peor: a los seis meses hay dos `llamaServer.ts`
 * distintos, un bug arreglado en uno y vivo en el otro, y ya nadie sabe cuál es
 * cuál. Este script es la disciplina.
 *
 * ---------------------------------------------------------------------------
 * Qué hace
 * ---------------------------------------------------------------------------
 *
 * Cada archivo del core lleva un hash del original de Convertexto en
 * `.core-sync.json`. El script compara el original de HOY contra ese hash:
 *
 *   · igual        → nada que hacer.
 *   · distinto     → Convertexto cambió ese archivo DESPUÉS de que se copió.
 *                    Hay que mirar el cambio y decidir si se trae o no.
 *
 * Lo que NO hace es copiar automáticamente. Los archivos de acá están adaptados
 * a mano (nombres, mensajes, el `seed` parametrizado), así que sobrescribirlos
 * con el original perdería esas adaptaciones. Este script avisa; la decisión y
 * el merge son humanos.
 *
 *   node scripts/sync-core.mjs           # verifica y sale con 1 si hay drift
 *   node scripts/sync-core.mjs --write   # acepta el estado actual como la base
 *
 * `--write` se usa DESPUÉS de haber traído a mano un cambio de Convertexto, para
 * dejar registrado que este archivo ya está al día con esa versión.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Dónde vive Convertexto, relativo a la raíz de este proyecto.
 *
 * Es una ruta relativa y no absoluta para que el script siga funcionando si
 * alguien mueve la carpeta entera de proyectos a otro disco.
 *
 * TIENE QUE APUNTAR A LA CARPETA VIVA DE CONVERTEXTO, no a la última que se
 * publicó. Cuando salió la 3.0.1 el desarrollo se mudó a "Version 4" y "Version 3"
 * quedó congelada como respaldo de lo que se vendió; mientras esto siguió
 * apuntando a la 3, el script decía "todo al día" para siempre, porque comparaba
 * contra un árbol que ya no cambia nunca. Un aviso que no puede saltar es peor
 * que no tener aviso: da la falsa impresión de que alguien está mirando.
 *
 * Al arrancar la próxima versión de Convertexto, actualizá esta línea.
 */
const CONVERTEXTO = resolve(ROOT, '..', 'Version 4', 'Version Windows')

const REGISTRO = join(ROOT, '.core-sync.json')

/**
 * Los archivos del core, con su origen.
 *
 * `adaptado: true` quiere decir que la copia de acá tiene cambios a propósito
 * (nombres de producto, mensajes al usuario, algún parámetro). Para ésos, un
 * cambio en el original NO significa "copiá esto encima": significa "mirá si el
 * cambio te sirve".
 */
const CORE = [
  { archivo: 'llamaServer.ts', adaptado: true },
  { archivo: 'chunker.ts', adaptado: true },
  { archivo: 'anchor.ts', adaptado: true },
  { archivo: 'download.ts', adaptado: false },
  { archivo: 'paths.ts', adaptado: true },
  { archivo: 'config.ts', adaptado: true },
  { archivo: 'logger.ts', adaptado: true },
  { archivo: 'errors.ts', adaptado: false },
  { archivo: 'fsutil.ts', adaptado: false },
  { archivo: 'summaryModels.ts', destino: 'genModels.ts', adaptado: true }
]

const COMPONENTES = [
  { archivo: 'Modal.tsx', adaptado: false },
  { archivo: 'primitives.tsx', adaptado: true },
  { archivo: 'ErrorBoundary.tsx', adaptado: true }
]

const sha = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, 16)

function leer(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  } catch {
    return null
  }
}

function entradas() {
  const salida = []
  for (const { archivo, destino, adaptado } of CORE) {
    salida.push({
      clave: `services/${archivo}`,
      origen: join(CONVERTEXTO, 'src', 'main', 'services', archivo),
      copia: join(ROOT, 'src', 'main', 'services', 'core', destino ?? archivo),
      adaptado
    })
  }
  for (const { archivo, adaptado } of COMPONENTES) {
    salida.push({
      clave: `components/${archivo}`,
      origen: join(CONVERTEXTO, 'src', 'renderer', 'src', 'components', archivo),
      copia: join(ROOT, 'src', 'renderer', 'src', 'components', archivo),
      adaptado
    })
  }
  return salida
}

const escribir = process.argv.includes('--write')
const registro = JSON.parse(leer(REGISTRO) ?? '{}')
const nuevo = {}

let drift = 0
let faltantes = 0

if (!existsSync(CONVERTEXTO)) {
  // No es un error: alguien puede estar compilando Flashcards en una máquina donde
  // no está el árbol de Convertexto. Se avisa y se sigue, porque bloquear el build
  // por esto sería peor que el problema que resuelve.
  console.log(`[core] No encontré el árbol de Convertexto en ${CONVERTEXTO}; se saltea la verificación.`)
  process.exit(0)
}

for (const { clave, origen, copia, adaptado } of entradas()) {
  const textoOrigen = leer(origen)
  const textoCopia = leer(copia)

  if (textoCopia === null) {
    console.error(`[core] FALTA la copia de ${clave} en este proyecto.`)
    faltantes++
    continue
  }
  if (textoOrigen === null) {
    console.log(`[core] ${clave}: el original ya no existe en Convertexto (se habrá renombrado). Revisalo.`)
    continue
  }

  const hoy = sha(textoOrigen)
  nuevo[clave] = hoy

  const anotado = registro[clave]
  if (anotado === undefined) {
    if (!escribir) console.log(`[core] ${clave}: sin registrar. Corré \`npm run sync:core-write\` para fijar la base.`)
    continue
  }

  if (anotado !== hoy) {
    drift++
    console.log(
      `[core] CAMBIÓ en Convertexto: ${clave}` +
        (adaptado
          ? '\n        (la copia de acá está adaptada a propósito: mirá el diff y traé sólo lo que corresponda)'
          : '\n        (la copia de acá es idéntica al original: probablemente convenga traer el cambio entero)')
    )
    console.log(`        original: ${origen}`)
    console.log(`        copia:    ${copia}`)
  }
}

if (escribir) {
  writeFileSync(REGISTRO, `${JSON.stringify(nuevo, null, 2)}\n`, 'utf8')
  console.log(`[core] Base registrada: ${Object.keys(nuevo).length} archivo(s).`)
  process.exit(0)
}

if (faltantes > 0) {
  console.error(`[core] Faltan ${faltantes} archivo(s) del core. El build no puede seguir.`)
  process.exit(1)
}

if (drift > 0) {
  console.log(
    `\n[core] ${drift} archivo(s) del core cambiaron en Convertexto desde la última vez.\n` +
      '       Revisá los diffs, traé a mano lo que corresponda y después:\n' +
      '           npm run sync:core-write\n'
  )
  // Se avisa fuerte pero NO se corta el build. Convertexto puede haber cambiado por
  // algo que a Flashcards no le aplica (un mensaje sobre grabaciones, por ejemplo),
  // y bloquear el build de un producto por un cambio en otro sería un acople peor
  // que el que este script existe para evitar.
  process.exit(0)
}

console.log('[core] Todo al día con Convertexto.')
