import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

/**
 * El banco de pruebas de las palancas de rendimiento.
 *
 *   node scripts/run-qa.mjs palancas -- <etiqueta>
 *
 * POR QUÉ EXISTE
 * --------------
 * Se van a probar seis cambios distintos para acelerar la generación, uno por vez.
 * Comparar corridas hechas de distinta forma no sirve para nada: hay que medir lo
 * MISMO, sobre los MISMOS documentos, y guardar el resultado con una etiqueta para
 * poder ponerlo al lado del anterior.
 *
 * Y sobre todo: cada palanca se juzga por DOS cosas a la vez. Si acelera un 14 % y
 * empeora las tarjetas, no sirve — el producto se vende por la calidad de lo que
 * genera, no por la velocidad. Por eso acá se mide el tiempo y ocho indicadores de
 * calidad en la misma pasada.
 *
 * QUÉ MIDE
 * --------
 *  · Tiempo total y por documento.
 *  · Cuántas tarjetas quedaron y cuántas descartó cada filtro.
 *  · Largo del frente y del dorso, con su distribución.
 *  · Cuántos frentes son preguntas de verdad.
 *  · Cuántos dorsos están respaldados por el texto fuente (anclaje léxico
 *    independiente, calculado acá y no por el generador: es el juez, no el filtro).
 *  · Cuántas tarjetas repetidas quedaron entre documentos.
 */

/* El corredor de arneses pasa adelante la ruta del .cjs compilado, así que la
   etiqueta es el ÚLTIMO argumento suelto y no el primero. */
const sueltos = process.argv.slice(1).filter((a) => !a.startsWith('-') && !/[\\/]/.test(a) && a !== 'palancas')
const etiqueta = (sueltos[sueltos.length - 1] ?? 'sin-nombre').replace(/[^a-z0-9-]/gi, '-').toLowerCase()

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-palancas-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer, slotsDisponibles } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')

/* ------------------------------- los documentos ------------------------------ */

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

/* --------------------------- el juez de fundamentación ------------------------ */

const VACIAS = new Set([
  'para','como','cada','pero','este','esta','esto','esos','esas','otro','otra','otros','otras','sobre','entre','desde',
  'hasta','porque','cuando','donde','todos','todas','todo','toda','puede','pueden','tiene','tienen','hace','hacen',
  'ser','son','está','están','sus','sus','del','los','las','una','uno','que','con','por','más','menos','muy','sin',
  'sea','fue','han','hay','ese','esa','ello','ella','él','ellos','ellas','nos','les','lo','al','se','de','en','un','y','o','a'
])

const normalizar = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')

const palabrasDeContenido = (s: string): string[] =>
  normalizar(s)
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !VACIAS.has(w))

/**
 * Qué proporción de las palabras de contenido del dorso aparecen en el texto fuente.
 *
 * Es un JUEZ, no un filtro: se calcula acá y no lo usa el generador. Sirve para
 * detectar si una palanca empezó a dejar pasar tarjetas que hablan de cosas que el
 * apunte no dice. Un dorso legítimo reformula el texto con sus mismas palabras
 * clave; uno inventado trae términos que no están en ningún lado.
 */
function fundamentacion(dorso: string, fuente: string): number {
  const pd = palabrasDeContenido(dorso)
  if (pd.length === 0) return 1
  const enFuente = new Set(palabrasDeContenido(fuente))
  const dentro = pd.filter((w) => enFuente.has(w)).length
  return dentro / pd.length
}

/** ¿El frente es una pregunta o un término, y no un renglón copiado? */
function esFrenteUtil(frente: string, fuente: string): boolean {
  const f = frente.trim()
  if (f.includes('?') || f.includes('¿')) return true
  if (f.split(/\s+/).length <= 6) return true
  /* Frase larga sin signos de pregunta: si aparece literal en el apunte, es copia. */
  return !normalizar(fuente).includes(normalizar(f))
}

const huella = (s: string): string => palabrasDeContenido(s).sort().join(' ')

/* ---------------------------------- la corrida -------------------------------- */

interface Ficha {
  documento: string
  segundos: number
  bloques: number
  quedaron: number
  descartadas: number
  repetidas: number
  cards: Array<{ frente: string; dorso: string }>
}

async function main(): Promise<void> {
  console.log('')
  console.log(`  BANCO DE PALANCAS  ·  variante "${etiqueta}"`)
  console.log('  ══════════════════════════════════════════════════════════')

  const dir = carpetaDocs()
  /* Un nivel de subcarpetas, igual que el E2E: los apuntes vienen agrupados por
     unidad, y mirar sólo la raíz encontraba 4 de 13. */
  const sirve = (f: string): boolean => /\.(pdf|docx|pptx|txt|md)$/i.test(f)
  const archivos: string[] = []
  for (const entrada of readdirSync(dir)) {
    const d = join(dir, entrada)
    if (statSync(d).isDirectory()) {
      for (const f of readdirSync(d)) if (sirve(f)) archivos.push(join(entrada, f))
    } else if (sirve(entrada)) archivos.push(entrada)
  }
  archivos.sort()

  /* `--solo <texto>` corre un único documento. Sirve para aislar un caso raro sin
     pagar los doce minutos de la comparación entera: cuando un bloque se cuelga,
     hay que poder bisecar la causa en un minuto y no en media hora. */
  const iSolo = process.argv.indexOf('--solo')
  const solo = iSolo >= 0 ? process.argv[iSolo + 1] : null
  const elegidos = solo ? archivos.filter((a) => a.toLowerCase().includes(solo.toLowerCase())) : archivos
  if (solo) console.log(`  --solo "${solo}" → ${elegidos.length} de ${archivos.length} documentos`)
  console.log(`  ${elegidos.length} documentos en "testing documentos"\n`)

  const control = new AbortController()
  const modelo = await ensureGenModel({ level: 'rapido', signal: control.signal, onProgress: () => {} })
  /* El servidor se levanta UNA vez para toda la comparación: si se reiniciara entre
     documentos, cada uno pagaría medio minuto de carga del modelo y el tiempo medido
     dejaría de ser el de la generación. */
  await startServer(modelo, control.signal)
  console.log(`  motor levantado, ${slotsDisponibles()} bloque(s) a la vez\n`)

  const fichas: Ficha[] = []
  const fuentes = new Map<string, string>()
  const t0 = Date.now()

  const salteados: string[] = []
  for (const archivo of elegidos) {
    /* Un PDF escaneado NO puede cortar la comparación entera: se anota y se sigue.
       Es lo que hace la app, y es lo que hace el E2E. */
    let doc
    try {
      doc = await ingest.extractDocument(join(dir, archivo))
    } catch (e) {
      salteados.push(`${archivo}: ${(e as Error).message.slice(0, 60)}`)
      continue
    }
    const palabras = doc.texto.split(/\s+/).filter(Boolean).length
    if (palabras < 120) {
      salteados.push(`${archivo}: sólo ${palabras} palabras`)
      continue
    }
    fuentes.set(archivo, doc.texto)

    /* Un documento que no da NINGUNA tarjeta hace que `generate` lance, y eso
       tiraba abajo la comparación entera después de diez minutos de trabajo ya
       hecho. En la app es un caso legítimo —un índice, una bibliografía— así que
       acá se anota con cero y se sigue. */
    const ti = Date.now()
    let r
    try {
      r = await generate({
      texto: doc.texto,
      options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad: 'normal' },
      miniPrompt: '',
      signal: control.signal,
      onProgress: () => {},
      /* Semilla fija: si cambiara entre variantes, las diferencias de calidad
         serían del azar y no del cambio que se está probando. */
      seed: 20260831
      })
    } catch (e) {
      const perdidos = (Date.now() - ti) / 1000
      salteados.push(`${archivo}: no dio tarjetas tras ${perdidos.toFixed(0)} s — ${(e as Error).message.slice(0, 55)}`)
      console.log(`  ${archivo.slice(0, 44).padEnd(46)}   0 tarjetas  ${perdidos.toFixed(0).padStart(4)} s  ← FALLÓ`)
      continue
    }
    const seg = (Date.now() - ti) / 1000

    fichas.push({
      documento: archivo,
      segundos: seg,
      bloques: r.bloques,
      quedaron: r.cards.length,
      descartadas: r.descartadas,
      repetidas: r.repetidas,
      cards: r.cards.map((c) => ({ frente: c.frente, dorso: c.dorso }))
    })
    console.log(
      `  ${basename(archivo).slice(0, 44).padEnd(46)} ${String(r.cards.length).padStart(3)} tarjetas  ` +
        `${seg.toFixed(0).padStart(4)} s  (${r.descartadas} descartadas)`
    )
  }

  if (salteados.length > 0) {
    console.log(`\n  ${salteados.length} sin contenido para estudiar (escaneados o carátulas):`)
    for (const s of salteados) console.log(`      ${s}`)
  }

  const segundos = (Date.now() - t0) / 1000
  stopServer()

  /* ------------------------------- los indicadores ---------------------------- */

  /* El puntaje del juez se guarda POR TARJETA y no sólo agregado: cuando una
     palanca haga bajar la fundamentación, hay que poder mirar cuáles fueron y
     decidir a ojo si son alucinaciones o paráfrasis legítimas. Con un promedio no
     se puede. */
  const todas = fichas.flatMap((f) =>
    f.cards.map((c) => ({ ...c, doc: f.documento, fundamento: fundamentacion(c.dorso, fuentes.get(f.documento) ?? '') }))
  )
  const fr = todas.map((c) => c.frente.length)
  const dr = todas.map((c) => c.dorso.length)
  const prom = (a: number[]): number => (a.length === 0 ? 0 : a.reduce((x, y) => x + y, 0) / a.length)
  const med = (a: number[]): number => (a.length === 0 ? 0 : [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)])

  const fundamentos = todas.map((c) => c.fundamento)
  const flojas = fundamentos.filter((v) => v < 0.6).length
  const muyFlojas = fundamentos.filter((v) => v < 0.4).length
  const frentesUtiles = todas.filter((c) => esFrenteUtil(c.frente, fuentes.get(c.doc) ?? '')).length

  const vistas = new Set<string>()
  let repesEntreDocs = 0
  for (const c of todas) {
    const h = huella(c.frente)
    if (vistas.has(h)) repesEntreDocs++
    else vistas.add(h)
  }

  const resumen = {
    etiqueta,
    fecha: new Date().toISOString(),
    segundos,
    documentos: fichas.length,
    tarjetas: todas.length,
    descartadas: fichas.reduce((a, f) => a + f.descartadas, 0),
    repetidas: fichas.reduce((a, f) => a + f.repetidas, 0),
    frentePromedio: Math.round(prom(fr)),
    frenteMediana: med(fr),
    dorsoPromedio: Math.round(prom(dr)),
    dorsoMediana: med(dr),
    dorsoMax: Math.max(...dr, 0),
    dorsosLargos: dr.filter((x) => x > 250).length,
    fundamentacionPromedio: prom(fundamentos),
    dorsosFlojos: flojas,
    dorsosMuyFlojos: muyFlojas,
    frentesUtiles,
    repesEntreDocs,
    /* Las tarjetas con su puntaje, para poder mirar los casos flojos uno por uno. */
    tarjetasConPuntaje: todas.map((c) => ({ doc: c.doc, frente: c.frente, dorso: c.dorso, fundamento: c.fundamento })),
    fichas
  }

  const carpeta = join(process.cwd(), '.qa')
  if (!existsSync(carpeta)) mkdirSync(carpeta, { recursive: true })
  const destino = join(carpeta, `palancas-${etiqueta}.json`)
  writeFileSync(destino, JSON.stringify(resumen, null, 2), 'utf8')

  console.log('')
  console.log('  ──────────────────────────────────────────────────────────')
  console.log(`  tiempo total                 ${segundos.toFixed(0)} s`)
  console.log(`  tarjetas                     ${todas.length}`)
  console.log(`  descartadas por los filtros  ${resumen.descartadas}`)
  console.log(`  frente  promedio ${resumen.frentePromedio} chars   mediana ${resumen.frenteMediana}`)
  console.log(`  dorso   promedio ${resumen.dorsoPromedio} chars   mediana ${resumen.dorsoMediana}   max ${resumen.dorsoMax}`)
  console.log(`  dorsos de más de 250 chars   ${resumen.dorsosLargos}`)
  console.log('')
  console.log(`  CALIDAD (juez independiente, no es el filtro del generador)`)
  console.log(`  fundamentación promedio      ${(resumen.fundamentacionPromedio * 100).toFixed(1)} %`)
  console.log(`  dorsos poco fundamentados    ${flojas}  (menos del 60 % de sus palabras en el apunte)`)
  console.log(`  dorsos MUY poco fundados     ${muyFlojas}  (menos del 40 %)  ← los sospechosos`)
  console.log(`  frentes que sirven           ${frentesUtiles} de ${todas.length}`)
  console.log(`  repetidas entre documentos   ${repesEntreDocs}`)
  console.log('  ──────────────────────────────────────────────────────────')

  /* ------------------------------ contra la base ------------------------------ */

  const base = join(carpeta, 'palancas-base.json')
  if (etiqueta !== 'base' && existsSync(base)) {
    const b = JSON.parse(readFileSync(base, 'utf8')) as typeof resumen
    const pct = (a: number, x: number): string => (x === 0 ? '—' : `${a >= x ? '+' : ''}${(((a - x) / x) * 100).toFixed(1)} %`)
    console.log('')
    console.log('  CONTRA LA BASE')
    console.log('  ──────────────────────────────────────────────────────────')
    console.log(`  tiempo          ${b.segundos.toFixed(0)} s  →  ${segundos.toFixed(0)} s     ${pct(segundos, b.segundos)}`)
    console.log(`  tarjetas        ${b.tarjetas}  →  ${todas.length}     ${pct(todas.length, b.tarjetas)}`)
    console.log(`  dorso medio     ${b.dorsoPromedio}  →  ${resumen.dorsoPromedio} chars`)
    console.log(`  fundamentación  ${(b.fundamentacionPromedio * 100).toFixed(1)} %  →  ${(resumen.fundamentacionPromedio * 100).toFixed(1)} %`)
    console.log(`  sospechosos     ${b.dorsosMuyFlojos}  →  ${muyFlojas}     ${muyFlojas > b.dorsosMuyFlojos ? '⚠ EMPEORÓ' : 'ok'}`)
    console.log(`  frentes útiles  ${b.frentesUtiles}/${b.tarjetas}  →  ${frentesUtiles}/${todas.length}`)
    console.log('  ──────────────────────────────────────────────────────────')
  }

  console.log(`\n  guardado en ${destino}\n`)
  process.exit(0)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
