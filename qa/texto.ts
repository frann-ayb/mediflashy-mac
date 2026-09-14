import { app } from 'electron'
import { existsSync, mkdtempSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
app.setPath('userData', mkdtempSync(join(tmpdir(), 'fc-t-')))
/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const carpeta = (() => {
  for (let dir = resolve(__dirname, '..'), n = 0; n < 5; n++) {
    const c = resolve(dir, 'testing documentos')
    if (existsSync(c)) return c
    const a = resolve(dir, '..'); if (a === dir) break; dir = a
  }
  throw new Error('no encontré los apuntes')
})()
const rutas: string[] = []
const rec = (d: string): void => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) rec(p); else if (e.toLowerCase().endsWith('.pdf')) rutas.push(p) } }
rec(carpeta)
async function main(): Promise<void> {
  const r = rutas.find((x) => x.includes('SEMANA 1 - Pobla'))!
  const t = (await ingest.extractDocument(r)).texto.replace(/\s+/g, ' ')
  const i = t.indexOf('DEFINICIONES PREVIAS')
  console.log(t.slice(i, i + 1200))
  process.exit(0)
}
main()
