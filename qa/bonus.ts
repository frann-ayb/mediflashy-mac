import { app } from 'electron'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/**
 * ¿Los apuntes de regalo dan lo que la instrucción promete?
 *
 *   node scripts/run-qa.mjs bonus
 *
 * Cada apunte de regalo trae arriba un instructivo que le dice al comprador qué
 * densidad elegir y cuántas tarjetas esperar. Ese número no puede ser un deseo:
 * si dice veinte y salen cinco, el comprador cree que la app le falló. Este
 * arnés genera con los cuatro apuntes, en las dos densidades que puede llegar a
 * elegir, y devuelve lo único que importa para escribir esa línea: cuántas
 * salen y cuánto tarda.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-bonus-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')

/** Sólo el apunte: lo de arriba de la línea de guiones es el instructivo. */
function soloElApunte(texto: string): string {
  const corte = texto.indexOf('\n---------')
  return corte === -1 ? texto : texto.slice(corte).replace(/^\n-+\r?\n/, '')
}

async function main(): Promise<void> {
  /*
   * Los apuntes se leen de `recursos-bonus/`, que es de donde salen, y no de la
   * carpeta de entregables.
   *
   * Antes apuntaba a `entregables flashcards/Versión Windows/8. …`, que es el
   * nombre que tenía la carpeta en el producto anterior. Al renombrarse a
   * `entregables psicoflashy` este arnés dejó de encontrar nada y se cortaba con
   * un ENOENT — o sea, dejó de probar los bonus sin que nadie se enterara.
   *
   * `recursos-bonus/` es además la fuente correcta: la carpeta de entregables es
   * una COPIA, y probar la copia deja pasar el caso en que la copia no se
   * regeneró.
   */
  const carpeta = resolve(__dirname, '..', 'recursos-bonus')
  const apuntes = readdirSync(carpeta)
    .filter((f) => f.includes('apunte de arranque'))
    .sort()
    .map((f) => {
      const entero = readFileSync(join(carpeta, f), 'utf8')
      const corte = entero.indexOf('\n---------')
      return {
        nombre: basename(f, '.txt'),
        /* Lo de arriba de la línea de guiones: el instructivo que va a leer el
           comprador, con la promesa que este arnés tiene que comprobar. */
        instructivo: corte === -1 ? '' : entero.slice(0, corte),
        texto: soloElApunte(entero)
      }
    })

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  LOS APUNTES DE REGALO, CONTRA LO QUE PROMETE SU INSTRUCTIVO')
  console.log('══════════════════════════════════════════════════════════════')

  const control = new AbortController()
  const modelo = await ensureGenModel({ level: 'rapido', signal: control.signal, onProgress: () => {} })
  await startServer(modelo, control.signal)

  const salida: Record<string, unknown>[] = []
  for (const a of apuntes) {
    const palabras = a.texto.split(/\s+/).filter(Boolean).length
    console.log(`\n── ${a.nombre.slice(0, 46)}  (${palabras} palabras) ──`)
    const fila: Record<string, unknown> = { apunte: a.nombre, palabras }

    for (const densidad of ['normal', 'alta'] as const) {
      const t0 = Date.now()
      let cuantas = 0
      let descartadas = 0
      let cards: Array<{ frente: string; dorso: string }> = []
      try {
        const r = await generate({
          texto: a.texto,
          options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad },
          miniPrompt: '',
          signal: control.signal,
          onProgress: (p) => process.stdout.write(`    ${densidad}: ${p.message ?? ''} (${p.encontradas ?? 0})      \r`),
          seed: 20260829
        })
        cuantas = r.cards.length
        descartadas = r.descartadas
        cards = r.cards
      } catch (e) {
        console.log(`    ${densidad}: falló — ${(e as Error).message.slice(0, 70)}`)
      }
      const seg = Math.round((Date.now() - t0) / 1000)
      process.stdout.write(' '.repeat(78) + '\r')
      console.log(
        `    ${(densidad === 'alta' ? 'Exhaustiva' : 'Normal').padEnd(11)}` +
          `${String(cuantas).padStart(3)} tarjetas  ${String(seg).padStart(4)}s  ` +
          `${descartadas} descartada(s)`
      )
      fila[densidad] = { tarjetas: cuantas, segundos: seg, descartadas, cards }
    }
    salida.push(fila)
  }

  await stopServer()

  console.log('\n──────────────────────────────────────────────────────────────')
  console.log('  Para escribir el instructivo:')
  for (const f of salida) {
    const n = f.normal as { tarjetas: number; segundos: number }
    const a = f.alta as { tarjetas: number; segundos: number }
    console.log(
      `    ${String(f.apunte).slice(0, 30).padEnd(32)}` +
        `Normal ${String(n.tarjetas).padStart(2)} en ${String(n.segundos).padStart(3)}s   ` +
        `Exhaustiva ${String(a.tarjetas).padStart(2)} en ${String(a.segundos).padStart(3)}s`
    )
  }

  /*
   * Las dos afirmaciones de este arnés, que son las que hay que mirar antes de
   * cerrar una entrega.
   *
   * 1. Un modo que se llama "Exhaustiva" no puede cubrir MENOS que "Normal".
   *    Pasó de verdad —el apunte de inglés técnico dio 6 contra 7— porque los
   *    conceptos hacían de techo en vez de piso.
   *
   * 2. El instructivo que va arriba de cada apunte promete una cantidad. La app
   *    tiene que entregar por lo menos esa. Se lee del archivo QUE RECIBE EL
   *    COMPRADOR y no de la constante del script: lo que importa es el texto
   *    que le llega, no el que quisimos escribir.
   */
  console.log('')
  let mal = 0
  for (const f of salida) {
    const n = (f.normal as { tarjetas: number }).tarjetas
    const a = (f.alta as { tarjetas: number }).tarjetas
    if (a < n) {
      mal++
      console.log(`  ✗ ${String(f.apunte).slice(0, 34)}: Exhaustiva sacó ${a} y Normal ${n}`)
    }
  }
  if (mal === 0) console.log('  ✓ en los cuatro apuntes Exhaustiva cubre al menos tanto como Normal')

  for (const a of apuntes) {
    const fila = salida.find((f) => f.apunte === a.nombre)
    const dio = fila ? (fila.alta as { tarjetas: number }).tarjetas : 0
    const promesa = /alrededor de (\d+) tarjetas/.exec(a.instructivo)
    if (!promesa) {
      mal++
      console.log(`  ✗ ${a.nombre.slice(0, 34)}: el instructivo no dice cuántas tarjetas esperar`)
      continue
    }
    const prometidas = Number(promesa[1])
    if (dio < prometidas) {
      mal++
      console.log(
        `  ✗ ${a.nombre.slice(0, 34)}: promete ${prometidas} y la app entregó ${dio}`
      )
    } else {
      console.log(`  ✓ ${a.nombre.slice(0, 34).padEnd(36)}promete ${prometidas}, entregó ${dio}`)
    }
  }
  if (mal > 0) {
    console.log(`\n  ❌ ${mal} problema(s). La entrega no puede salir así.\n`)
    process.exit(1)
  }
  const destino = join(process.cwd(), '.qa', 'bonus.json')
  writeFileSync(destino, JSON.stringify(salida, null, 2), 'utf8')
  console.log(`\n  El detalle quedó en ${destino}\n`)
  process.exit(0)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
