import { app } from 'electron'
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/**
 * ¿Exhaustiva cubre más que Normal, y a qué precio?
 *
 *   node scripts/run-qa.mjs exhaustiva
 *
 * Corre los MISMOS apuntes con los dos modos y compara lo único que importa:
 * cuántas tarjetas salen, cuánto tarda, y si las de más son buenas o relleno.
 *
 * Se eligen los apuntes más largos porque son los que tienen el problema: en
 * uno corto los dos modos dan casi lo mismo, y el techo de 8 por bloque no
 * llega a morder.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-exh-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')

/** Cuántos apuntes se comparan, de más largo a más corto. */
const CUANTOS = 2

async function main(): Promise<void> {
  /* Se busca subiendo: el proyecto se copia a carpetas de versión y ahí un
     '..' fijo ya no llega. Los apuntes de prueba viven una sola vez. */
  const carpeta = (() => {
    for (let dir = resolve(__dirname, '..'), n = 0; n < 5; n++) {
      const cand = resolve(dir, 'testing documentos')
      if (existsSync(cand)) return cand
      const arriba = resolve(dir, '..')
      if (arriba === dir) break
      dir = arriba
    }
    throw new Error('No encontré la carpeta "testing documentos".')
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

  const docs: Array<{ nombre: string; texto: string; palabras: number }> = []
  for (const r of rutas) {
    try {
      const d = await ingest.extractDocument(r)
      const n = d.texto.split(/\s+/).filter(Boolean).length
      if (n >= 120) docs.push({ nombre: basename(r, '.pdf'), texto: d.texto, palabras: n })
    } catch {
      /* Un PDF escaneado no participa de esta comparación. */
    }
  }
  docs.sort((a, b) => b.palabras - a.palabras)
  const elegidos = docs.slice(0, CUANTOS)

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  NORMAL contra EXHAUSTIVA, sobre los apuntes más largos')
  console.log('══════════════════════════════════════════════════════════════')

  const control = new AbortController()
  const modelo = await ensureGenModel({ level: 'rapido', signal: control.signal, onProgress: () => {} })
  await startServer(modelo, control.signal)

  const salida: Record<string, unknown>[] = []

  for (const d of elegidos) {
    console.log(`\n── ${d.nombre}  (${d.palabras} palabras) ──`)
    const fila: Record<string, unknown> = { apunte: d.nombre, palabras: d.palabras }

    for (const densidad of ['normal', 'alta'] as const) {
      const t0 = Date.now()
      let cards: Array<{ frente: string; dorso: string }> = []
      let descartadas = 0
      let repetidas = 0
      try {
        const r = await generate({
          texto: d.texto,
          options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad },
          miniPrompt: '',
          signal: control.signal,
          onProgress: (p) => process.stdout.write(`    ${densidad}: ${p.message ?? ''} (${p.encontradas ?? 0})        \r`),
          seed: 20260829
        })
        cards = r.cards
        descartadas = r.descartadas
        repetidas = r.repetidas
      } catch (e) {
        console.log(`    ${densidad}: falló — ${(e as Error).message.slice(0, 60)}`)
      }
      const seg = Math.round((Date.now() - t0) / 1000)
      process.stdout.write(' '.repeat(80) + '\r')
      console.log(
        `    ${densidad.padEnd(8)} ${String(cards.length).padStart(3)} tarjetas   ${String(seg).padStart(4)}s   ` +
          `${descartadas} descartadas, ${repetidas} repetidas   ` +
          `una cada ${cards.length ? Math.round(d.palabras / cards.length) : 0} palabras`
      )
      fila[densidad] = { tarjetas: cards.length, segundos: seg, descartadas, repetidas, cards }
    }

    const n = (fila.normal as { cards: unknown[] }).cards
    const a = (fila.alta as { cards: unknown[] }).cards
    console.log(`    → Exhaustiva saca ${a.length - n.length} tarjeta(s) más`)
    salida.push(fila)
  }

  await stopServer()
  const destino = join(process.cwd(), '.qa', 'exhaustiva-vs-normal.json')
  writeFileSync(destino, JSON.stringify(salida, null, 2), 'utf8')
  console.log(`\n  El detalle quedó en ${destino}\n`)
  process.exit(0)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
