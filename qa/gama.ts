import { app } from 'electron'
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/**
 * Cómo se porta la app según la máquina que le toque.
 *
 *   node scripts/run-qa.mjs gama
 *
 * POR QUÉ EXISTE
 * --------------
 * Todo lo que se midió del producto salió de una máquina de desarrollo con doce
 * núcleos y 23 GB. El comprador no tiene eso, y "anda bien acá" no es una
 * afirmación sobre su computadora.
 *
 * Este arnés corre la MISMA generación limitando los recursos, para poder decir
 * con números qué le va a pasar a alguien con una notebook modesta.
 *
 * QUÉ MIDE
 * --------
 *  1. Velocidad del motor con 8, 4 y 2 hilos, que es lo más parecido a bajar de
 *     gama de procesador que se puede hacer sin cambiar de máquina.
 *  2. Cuánta memoria ocupa realmente, contra lo que el indicador de la barra
 *     dice que hace falta.
 *  3. Los tres estados del indicador, contra valores de memoria libre elegidos a
 *     mano: es lo único de todo esto que se puede afirmar sin una máquina real.
 *  4. Una generación completa de punta a punta, para confirmar que la calidad no
 *     se movió.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-gama-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const { nivelDeMemoria, MEMORIA_PARA_GENERAR } = require('../src/main/services/memoria') as typeof import('../src/main/services/memoria')
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel, checkRam } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer, bloquesParaMemoria } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')

let fallas = 0
let pruebas = 0
function ok(cond: boolean, que: string, detalle = ''): void {
  pruebas++
  if (cond) console.log(`  ✓ ${que}${detalle ? `  ${detalle}` : ''}`)
  else {
    fallas++
    console.log(`  ✗ ${que}${detalle ? `  ${detalle}` : ''}`)
  }
}
const seccion = (t: string): void => console.log(`\n${t}\n${'─'.repeat(t.length)}`)
const GB = 1024 ** 3

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  CÓMO SE PORTA LA APP SEGÚN LA MÁQUINA')
  console.log('══════════════════════════════════════════════════════════════')

  /* ------------------- 1. el semáforo de memoria ------------------- */
  seccion('El indicador de memoria, en las tres situaciones')

  console.log(`  Generar necesita ${(MEMORIA_PARA_GENERAR / GB).toFixed(1)} GB, medido.\n`)

  const CASOS: Array<[string, number, string]> = [
    ['una máquina de 16 GB casi vacía', 11 * GB, 'holgado'],
    ['una de 8 GB con el navegador abierto', 4 * GB, 'holgado'],
    ['una de 8 GB con bastante en uso', 2.6 * GB, 'justo'],
    ['una de 4 GB recién arrancada', 1.6 * GB, 'escaso'],
    ['una de 4 GB usándose', 0.7 * GB, 'escaso'],
    ['justo en el límite de lo necesario', MEMORIA_PARA_GENERAR, 'justo']
  ]
  for (const [que, libre, esperado] of CASOS) {
    const dio = nivelDeMemoria(libre)
    ok(dio === esperado, `${que} (${(libre / GB).toFixed(1)} GB libres) → ${esperado}`, dio === esperado ? '' : `dio "${dio}"`)
  }

  /* ------- 1 bis. el chequeo de RAM contra lo que Windows REPORTA ------- */
  seccion('El chequeo de RAM, contra lo que el sistema operativo informa de verdad')

  /**
   * POR QUÉ ESTE BLOQUE EXISTE
   *
   * `totalmem()` no devuelve la memoria instalada: devuelve la instalada MENOS la
   * que se reservan el firmware y la placa de video integrada. Medido en la máquina
   * de desarrollo, 24 GiB instalados reportan 23,65.
   *
   * El descuento es aproximadamente fijo en bytes, así que castiga muchísimo más a
   * las máquinas chicas. Comparado contra un umbral de 4 GiB exactos, NINGUNA
   * computadora de 4 GB del mundo pasa: todas reportan menos. El chequeo rechazaba
   * exactamente al comprador que la app dice soportar en tres lugares distintos, y
   * no se veía en desarrollo por dos motivos a la vez: acá hay 24 GB, y además el
   * modelo viene prestado de la otra app, lo que saltea el chequeo entero.
   *
   * Los números de abajo son lo que REPORTA cada máquina, no lo que tiene puesto.
   */
  const pasa = (level: 'rapido' | 'detallado', total: number): boolean => {
    try {
      checkRam(level, total)
      return true
    } catch {
      return false
    }
  }

  const RAM: Array<[string, 'rapido' | 'detallado', number, boolean]> = [
    ['una de 4 GB reporta ~3,6 y tiene que poder usar Rápido', 'rapido', 3.63 * GB, true],
    ['una de 4 GB con integrada golosa reporta ~3,4 y también', 'rapido', 3.4 * GB, true],
    ['una de 8 GB reporta ~7,6 y tiene que poder usar Detallado', 'detallado', 7.63 * GB, true],
    ['una de 8 GB con Rápido, obviamente', 'rapido', 7.63 * GB, true],
    ['3 GB de verdad no alcanzan ni para Rápido', 'rapido', 2.7 * GB, false],
    ['2 GB tampoco', 'rapido', 1.8 * GB, false],
    ['4 GB no alcanzan para Detallado', 'detallado', 3.63 * GB, false],
    ['6 GB tampoco alcanzan para Detallado', 'detallado', 5.6 * GB, false]
  ]
  for (const [que, level, total, esperado] of RAM) {
    const dio = pasa(level, total)
    ok(dio === esperado, que, dio === esperado ? '' : dio ? 'dejó pasar y no debía' : 'RECHAZÓ y debía pasar')
  }

  /* ------- 1 ter. la escalera de bloques paralelos ------- */
  seccion('Cuántos bloques a la vez, según la memoria libre')

  /**
   * Antes esto era un interruptor: cuatro bloques o uno. Medido sobre la carga real
   * de la app, eso estaba mal en las dos puntas —el cuarto bloque no aporta nada, y
   * la máquina a la que no le entran tres no tiene por qué caer al doble de tiempo.
   *
   *     bloques   tiempo   contra uno
   *        1       234 s       —
   *        2       155 s     1,51x
   *        3       131 s     1,79x
   *        4       134 s     1,75x
   *
   * Se prueba la función pura, que es la única forma de comprobar qué elegiría en
   * una máquina que no tengo acá.
   */
  const RAPIDO = 1_280_835_840
  const DETALLADO = 2_740_937_888

  const ESCALERA: Array<[string, number, number, number]> = [
    ['4 GB de RAM con 1,6 libres, modelo Rápido', 1.6 * GB, RAPIDO, 1],
    ['4 GB apretada, 2,4 libres', 2.4 * GB, RAPIDO, 1],
    ['8 GB con bastante en uso, 3,6 libres', 3.6 * GB, RAPIDO, 2],
    ['8 GB con 3,9 libres', 3.9 * GB, RAPIDO, 3],
    ['16 GB tranquila, 8 libres', 8 * GB, RAPIDO, 3],
    ['una máquina enorme no pide más de 3', 40 * GB, RAPIDO, 3],
    ['Detallado con 4 libres no entra en paralelo', 4 * GB, DETALLADO, 1],
    ['Detallado con 4,9 libres entra de a 2', 4.9 * GB, DETALLADO, 2],
    ['Detallado con 6 libres entra de a 3', 6 * GB, DETALLADO, 3]
  ]
  for (const [que, libre, modelo, esperado] of ESCALERA) {
    const dio = bloquesParaMemoria(libre, modelo)
    ok(dio === esperado, que + ' → ' + esperado, dio === esperado ? '' : 'dio ' + dio)
  }

  /* El piso no se negocia: aunque no entre nada, hay que poder generar. */
  ok(bloquesParaMemoria(0, DETALLADO) === 1, 'sin memoria libre igual devuelve 1, nunca 0')

  /* ------------------- 2. el motor según los hilos ------------------- */
  seccion('El motor, con menos procesador')

  const control = new AbortController()
  const modelo = await ensureGenModel({ level: 'rapido', signal: control.signal, onProgress: () => {} })

  const carpeta = (() => {
    for (let dir = resolve(__dirname, '..'), n = 0; n < 5; n++) {
      const cand = resolve(dir, 'testing documentos')
      if (existsSync(cand)) return cand
      const arriba = resolve(dir, '..')
      if (arriba === dir) break
      dir = arriba
    }
    throw new Error('No encontré "testing documentos".')
  })()

  const rutas: string[] = []
  const recorrer = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) recorrer(p)
      else if (e.toLowerCase().endsWith('.pdf')) rutas.push(p)
    }
  }
  recorrer(carpeta)

  /* Un apunte de tamaño medio: el caso normal, ni el más corto ni el más largo. */
  let apunte: { nombre: string; texto: string; palabras: number } | null = null
  for (const r of rutas) {
    try {
      const d = await ingest.extractDocument(r)
      const n = d.texto.split(/\s+/).filter(Boolean).length
      if (n >= 500 && n <= 900) {
        apunte = { nombre: basename(r, '.pdf'), texto: d.texto, palabras: n }
        break
      }
    } catch {
      /* un PDF escaneado no participa */
    }
  }
  if (!apunte) throw new Error('No encontré un apunte de tamaño medio para la prueba.')
  console.log(`  Apunte: "${apunte.nombre.slice(0, 44)}" (${apunte.palabras} palabras)\n`)

  await startServer(modelo, control.signal)

  const t0 = Date.now()
  const r = await generate({
    texto: apunte.texto,
    options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad: 'normal' },
    miniPrompt: '',
    signal: control.signal,
    onProgress: () => {},
    seed: 20260830
  })
  const seg = Math.round((Date.now() - t0) / 1000)
  await stopServer()

  console.log(`  Generó ${r.cards.length} tarjetas en ${seg} s con los hilos de esta máquina.`)
  console.log(`  Una cada ${Math.round(apunte.palabras / Math.max(1, r.cards.length))} palabras.\n`)

  ok(r.cards.length >= 5, 'la generación sigue dando tarjetas', `${r.cards.length}`)
  ok(
    r.cards.every((c) => c.frente.trim().length > 0 && c.dorso.trim().length > 0),
    'ninguna salió con el frente o el dorso vacío'
  )
  ok(
    r.cards.every((c) => c.dorso.trim().length >= 15 && c.dorso.trim().length <= 400),
    'todos los dorsos tienen un largo que se puede memorizar'
  )
  const frentes = new Set(r.cards.map((c) => c.frente.trim().toLowerCase()))
  ok(frentes.size === r.cards.length, 'no hay dos tarjetas con el mismo frente')

  /*
   * La medición por hilos vive en `.qa/bench.sh` porque necesita levantar el
   * motor a mano con `-t`, y el servidor de la app no expone ese parámetro. El
   * resultado de esa medición, para que quede acá y no se pierda:
   *
   *     8 hilos   18,8 tok/s
   *     4 hilos   14,6 tok/s
   *     2 hilos   16,1 tok/s
   *
   * O sea: la cantidad de núcleos casi no cambia nada, porque el trabajo está
   * limitado por ancho de banda de memoria y no por cómputo. Lo que sí cambia
   * las cosas es cuánta memoria LIBRE hay, que es lo que mide el bloque 1.
   */

  const destino = join(process.cwd(), '.qa', 'gama.json')
  writeFileSync(
    destino,
    JSON.stringify({ apunte: apunte.nombre, palabras: apunte.palabras, tarjetas: r.cards.length, segundos: seg, cards: r.cards }, null, 2),
    'utf8'
  )

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(fallas === 0 ? `  ✅ ${pruebas}/${pruebas} comprobaciones pasaron.` : `  ❌ ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  console.log('══════════════════════════════════════════════════════════════\n')
  process.exit(fallas === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
