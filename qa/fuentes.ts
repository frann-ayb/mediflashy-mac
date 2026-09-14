import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Vuelca a texto plano los apuntes de prueba.
 *
 *   node scripts/run-qa.mjs fuentes
 *
 * POR QUÉ EXISTE
 * --------------
 * El juez léxico del banco de palancas cuenta cuántas palabras del dorso aparecen
 * en el apunte. Sirve para detectar un derrumbe, pero es ciego a lo que importa
 * de verdad: una tarjeta puede usar todas las palabras del texto y decir algo
 * falso —invertir una relación, cambiar un número, atribuirle a un concepto la
 * definición del de al lado—. Eso sólo lo ve alguien que lea las dos cosas.
 *
 * Este arnés deja los apuntes en `.qa/fuentes/` como .txt para que se puedan leer
 * y contrastar contra las tarjetas generadas, sin volver a extraer los PDFs ni
 * volver a generar nada.
 *
 * No mide ni afirma nada: sólo extrae.
 */

app.setPath('userData', mkdtempSync(join(tmpdir(), 'flashcards-fuentes-')))

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')

function carpetaDocs(): string {
  for (let dir = resolve(__dirname, '..'), n = 0; n < 5; n++) {
    const cand = resolve(dir, 'testing documentos')
    if (existsSync(cand)) return cand
    const arriba = resolve(dir, '..')
    if (arriba === dir) break
    dir = arriba
  }
  throw new Error('No encontré "testing documentos".')
}

async function main(): Promise<void> {
  const dir = carpetaDocs()
  const destino = join(process.cwd(), '.qa', 'fuentes')
  if (!existsSync(destino)) mkdirSync(destino, { recursive: true })

  const sirve = (f: string): boolean => /\.(pdf|docx|pptx|txt|md)$/i.test(f)
  const archivos: string[] = []
  for (const entrada of readdirSync(dir)) {
    const d = join(dir, entrada)
    if (statSync(d).isDirectory()) {
      for (const f of readdirSync(d)) if (sirve(f)) archivos.push(join(entrada, f))
    } else if (sirve(entrada)) archivos.push(entrada)
  }
  archivos.sort()

  console.log('')
  let escritos = 0
  for (const archivo of archivos) {
    try {
      const doc = await ingest.extractDocument(join(dir, archivo))
      const palabras = doc.texto.split(/\s+/).filter(Boolean).length
      if (palabras < 120) {
        console.log(`  · ${archivo}  salteado (${palabras} palabras)`)
        continue
      }
      /* El nombre del archivo se aplana para que coincida con la clave que usa el
         banco de palancas, que es la ruta relativa con la subcarpeta adelante. */
      const nombre = archivo.replace(/[\\/]/g, '__') + '.txt'
      writeFileSync(join(destino, nombre), doc.texto, 'utf8')
      escritos++
      console.log(`  ✓ ${archivo.padEnd(56)} ${String(palabras).padStart(6)} palabras`)
    } catch (e) {
      console.log(`  · ${archivo}  no se pudo leer: ${(e as Error).message.slice(0, 50)}`)
    }
  }

  console.log(`\n  ${escritos} apuntes en ${destino}\n`)
  process.exit(0)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
