import { app } from 'electron'
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/**
 * ¿Sirve el modelo Q3 para las máquinas con poca memoria?
 *
 *   node scripts/run-qa.mjs q3 -- <ruta del .gguf Q3>
 *
 * Q3 ocupa 324 MB menos que Q4 —medido, 1.609 contra 1.933— y eso deja el total
 * de la app en 1.999 MB, que es lo que decide si una máquina de 4 GB puede o no.
 *
 * Pero un modelo de 2B ya es chico, y cuantizarlo a tres bits pega justo donde
 * esta app lo necesita entero: seguir el esquema JSON y no inventar. Este arnés
 * corre los MISMOS apuntes con los dos y compara lo único que importa —cuántas
 * tarjetas salen, cuántas descarta el filtro anti-invento, y si las preguntas
 * siguen siendo preguntas— para poder decidir con datos y no con una intuición.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-q3-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')

const RUTA_Q3 = process.argv.find((a) => a.toLowerCase().endsWith('.gguf'))

/** Cuántos apuntes se comparan. Dos alcanzan para ver la tendencia. */
const CUANTOS = 2

async function main(): Promise<void> {
  if (!RUTA_Q3 || !existsSync(RUTA_Q3)) {
    console.error('\n  Pasá la ruta del .gguf Q3:\n    node scripts/run-qa.mjs q3 -- C:/.../Qwen3.5-2B-Q3_K_M.gguf\n')
    process.exit(1)
  }

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

  const docs: Array<{ nombre: string; texto: string; palabras: number }> = []
  for (const r of rutas) {
    try {
      const d = await ingest.extractDocument(r)
      const n = d.texto.split(/\s+/).filter(Boolean).length
      if (n >= 500) docs.push({ nombre: basename(r, '.pdf'), texto: d.texto, palabras: n })
    } catch {
      /* escaneado */
    }
  }
  docs.sort((a, b) => b.palabras - a.palabras)
  const elegidos = docs.slice(0, CUANTOS)

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  Q4 CONTRA Q3, sobre los mismos apuntes')
  console.log('══════════════════════════════════════════════════════════════')

  const control = new AbortController()
  const q4 = await ensureGenModel({ level: 'rapido', signal: control.signal, onProgress: () => {} })

  const salida: Record<string, unknown>[] = []

  for (const [etiqueta, modelo] of [
    ['Q4', q4],
    ['Q3', RUTA_Q3]
  ] as const) {
    await startServer(modelo, control.signal)
    for (const d of elegidos) {
      const t0 = Date.now()
      let cards: Array<{ frente: string; dorso: string }> = []
      let descartadas = 0
      try {
        const r = await generate({
          texto: d.texto,
          options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad: 'normal' },
          miniPrompt: '',
          signal: control.signal,
          onProgress: () => {},
          seed: 20260830
        })
        cards = r.cards
        descartadas = r.descartadas
      } catch (e) {
        console.log(`    ${etiqueta} falló en "${d.nombre.slice(0, 30)}": ${(e as Error).message.slice(0, 60)}`)
      }
      const seg = Math.round((Date.now() - t0) / 1000)

      /* Que el frente siga siendo una PREGUNTA es la señal más simple de que el
         modelo sigue entendiendo la consigna. Si Q3 empieza a devolver frases
         sueltas, se ve acá antes que en ningún otro lado. */
      const preguntas = cards.filter((c) => /\?/.test(c.frente)).length
      console.log(
        `  ${etiqueta}  ${d.nombre.slice(0, 34).padEnd(36)}` +
          `${String(cards.length).padStart(3)} tarjetas  ${String(seg).padStart(4)}s  ` +
          `${String(descartadas).padStart(2)} descartadas  ${preguntas}/${cards.length} preguntan algo`
      )
      salida.push({ modelo: etiqueta, apunte: d.nombre, tarjetas: cards.length, segundos: seg, descartadas, preguntas, cards })
    }
    await stopServer()
    console.log('')
  }

  writeFileSync(join(process.cwd(), '.qa', 'q3-vs-q4.json'), JSON.stringify(salida, null, 2), 'utf8')
  console.log('  El detalle quedó en .qa/q3-vs-q4.json\n')
  process.exit(0)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
