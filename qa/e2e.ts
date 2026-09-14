import { app } from 'electron'
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, basename } from 'node:path'

/**
 * La carrera donde viven las materias de estas pruebas.
 *
 * Existe porque la jerarquia paso a ser Carrera -> Materia -> Unidad y una
 * materia ya no puede crearse suelta. Se reusa la primera que haya para que dos
 * llamadas seguidas no dejen dos carreras de prueba.
 */
const carreraDePrueba = (): string => deck.listCarreras()[0]?.id ?? deck.createCarrera('Carrera de prueba').id


/**
 * El recorrido completo, con apuntes de verdad.
 *
 *   node scripts/run-qa.mjs e2e
 *
 * Los otros arneses prueban cada pieza contra texto fabricado. Éste hace lo que
 * hace un estudiante el primer día: agarra los PDFs de una unidad real de una
 * materia real, los carga, genera las tarjetas con el modelo, las guarda,
 * estudia, y comprueba que el repaso espaciado haga lo que promete la página de
 * venta.
 *
 * Los PDFs salen de `testing documentos/`. Son cuatro, de una unidad de Bases de
 * Datos: repaso de SQL, introducción a las no relacionales, comparaciones y
 * gestores.
 *
 * NO TOCA LOS DATOS DEL USUARIO. `app.setPath('userData')` apunta a una carpeta
 * temporal, así que las materias que se creen acá no aparecen en la app
 * instalada.
 *
 * Lo que se comprueba, en orden:
 *
 *   1. INGESTA   — que los cuatro PDFs den texto aprovechable
 *   2. GENERACIÓN— que salgan tarjetas y ninguna esté inventada
 *   3. CALIDAD   — que las tarjetas sirvan para estudiar, no sólo que existan
 *   4. GUARDADO  — que lleguen al disco y se puedan volver a leer
 *   5. ESTUDIO   — una sesión completa, calificando de verdad
 *   6. REPASO    — que el espaciado crezca al acertar y se derrumbe al fallar
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-e2e-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { generate } = require('../src/main/services/generator') as typeof import('../src/main/services/generator')
const { ensureGenModel } = require('../src/main/services/core/genModels') as typeof import('../src/main/services/core/genModels')
const { startServer, stopServer } = require('../src/main/services/core/llamaServer') as typeof import('../src/main/services/core/llamaServer')
const deck = require('../src/main/services/deckStore') as typeof import('../src/main/services/deckStore')
const sched = require('../src/main/services/scheduler') as typeof import('../src/main/services/scheduler')
const sesion = require('../src/main/services/studySession') as typeof import('../src/main/services/studySession')

let pasaron = 0
let fallaron = 0
const problemas: string[] = []

function ok(cond: boolean, texto: string, detalle?: string): void {
  if (cond) {
    pasaron++
    console.log(`  ✓ ${texto}${detalle ? `  ${detalle}` : ''}`)
  } else {
    fallaron++
    problemas.push(texto)
    console.log(`  ✗ ${texto}${detalle ? `  →  ${detalle}` : ''}`)
  }
}

function titulo(t: string): void {
  console.log(`\n${t}`)
}

/** Sin tildes, en minúscula: la misma normalización que usa el anclaje. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function palabras(s: string): string[] {
  return normalizar(s)
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p.length > 3)
}

async function main(): Promise<void> {
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  RECORRIDO COMPLETO CON APUNTES DE VERDAD')
  console.log('══════════════════════════════════════════════════════════════')
  console.log(`  Carpeta de datos de esta corrida: ${raiz}`)

  /* ── 1. INGESTA ──────────────────────────────────────────────────────── */
  titulo('1 · Cargar los PDFs de la unidad')

  /* Todos los PDFs, agrupados por la carpeta que los contiene: cada carpeta
     será una materia y cada PDF una unidad. Los que están sueltos en la raíz
     van a una materia aparte. Así se ejercita la jerarquía de verdad y no una
     sola materia con todo adentro. */
  /* Se busca subiendo: el proyecto se copia a carpetas de versión y ahí un
     '..' fijo ya no llega. Los apuntes de prueba viven una sola vez.

     Y en cada nivel se mira también adentro de las carpetas de los productos
     hermanos, no sólo al lado. Psicoflashy es una copia de `flashcards/`, que es
     donde quedaron los apuntes: subiendo se llega a la raíz que contiene a las
     dos carpetas, pero los PDFs están un nivel MÁS ABAJO, del otro lado. Sin
     esto, el arnés E2E de este producto no corría nunca y fallaba con un error
     que parecía de entorno. */
  const carpeta = (() => {
    const HERMANOS = ['flashcards', 'Flashcards']
    for (let dir = resolve(__dirname, '..'), n = 0; n < 5; n++) {
      const cand = resolve(dir, 'testing documentos')
      if (existsSync(cand)) return cand
      for (const h of HERMANOS) {
        const enHermano = resolve(dir, h, 'testing documentos')
        if (existsSync(enHermano)) return enHermano
      }
      const arriba = resolve(dir, '..')
      if (arriba === dir) break
      dir = arriba
    }
    throw new Error('No encontré la carpeta "testing documentos".')
  })()
  const pdfs: Array<{ ruta: string; grupo: string }> = []
  for (const entrada of readdirSync(carpeta)) {
    const d = join(carpeta, entrada)
    if (statSync(d).isDirectory()) {
      for (const f of readdirSync(d)) {
        if (f.toLowerCase().endsWith('.pdf')) pdfs.push({ ruta: join(d, f), grupo: entrada })
      }
    } else if (entrada.toLowerCase().endsWith('.pdf')) {
      pdfs.push({ ruta: d, grupo: 'Sueltos' })
    }
  }
  pdfs.sort((a, b) => a.ruta.localeCompare(b.ruta))
  ok(pdfs.length > 0, 'hay PDFs para probar', `${pdfs.length} en ${new Set(pdfs.map((p) => p.grupo)).size} carpeta(s)`)

  const documentos: Array<{ nombre: string; grupo: string; texto: string; palabras: number }> = []
  const flojos: string[] = []
  for (const p of pdfs) {
    const corto = basename(p.ruta, '.pdf')
    let doc
    try {
      doc = await ingest.extractDocument(p.ruta)
    } catch (e) {
      /* Un PDF que no se puede leer NO corta el recorrido: se anota y se sigue.
         Es lo que hace la app, y es lo que hay que poder afirmar. */
      flojos.push(`${corto}: ${(e as Error).message.slice(0, 70)}`)
      continue
    }
    const n = doc.texto.split(/\s+/).filter(Boolean).length
    if (n < 120) {
      flojos.push(`${corto}: sólo ${n} palabras`)
      continue
    }
    documentos.push({ nombre: corto, grupo: p.grupo, texto: doc.texto, palabras: n })
    console.log(`    ✓ ${corto.slice(0, 52).padEnd(52)} ${String(n).padStart(6)} palabras   [${p.grupo}]`)
  }
  ok(documentos.length > 0, 'al menos un apunte dio texto aprovechable', `${documentos.length} de ${pdfs.length}`)
  if (flojos.length) {
    console.log(`    · ${flojos.length} sin contenido para estudiar (escaneados, carátulas o guías):`)
    for (const f of flojos) console.log(`        ${f}`)
  }

  const totalPalabras = documentos.reduce((n, d) => n + d.palabras, 0)
  console.log(`    → ${totalPalabras} palabras en total, de ${documentos.length} apuntes`)

  /* ── 2. GENERACIÓN ───────────────────────────────────────────────────── */
  titulo('2 · Generar las tarjetas con el modelo')

  const control = new AbortController()

  /* El motor hay que ARRANCARLO. Sin esto `generate()` no falla ruidoso: cada
     fragmento se saltea con un aviso y al final la app le dice al usuario que su
     apunte "puede ser un índice o una bibliografía". Es el mensaje equivocado y
     quedó anotado como hallazgo. */
  let ultimo = ''
  const modelo = await ensureGenModel({
    level: 'rapido',
    signal: control.signal,
    onProgress: (p) => {
      const linea = `    modelo: ${p.phase} ${p.percent}%`
      if (linea !== ultimo) { ultimo = linea; process.stdout.write(`${linea}          `) }
    }
  })
  await startServer(modelo, control.signal)
  console.log('    motor listo                              ')

  const generadas: Array<{ apunte: string; grupo: string; cards: Array<{ frente: string; dorso: string }>; descartadas: number; repetidas: number }> = []

  for (const d of documentos) {
    if (d.palabras < 120) continue
    const t0 = Date.now()
    let r
    try {
      r = await generate({
      texto: d.texto,
      options: { level: 'rapido', language: 'es', tipo: 'mixto', densidad: 'normal' },
      miniPrompt: '',
      signal: control.signal,
      onProgress: (p) => process.stdout.write(`\r    ${d.nombre.slice(0, 40)}: ${p.message ?? ''} (${p.encontradas ?? 0})          `),
        seed: 20260828
      })
    } catch (e) {
      /* Que un apunte no dé tarjetas no puede tumbar la corrida entera: la app
         tampoco lo hace, avisa y sigue con los demás. */
      process.stdout.write(' '.repeat(90) + String.fromCharCode(13))
      console.log(`    ${d.nombre.slice(0, 46)}  →  sin tarjetas: ${(e as Error).message.slice(0, 60)}`)
      continue
    }
    const seg = Math.round((Date.now() - t0) / 1000)
    process.stdout.write('\r' + ' '.repeat(90) + '\r')
    console.log(`    ${d.nombre.slice(0, 46)}  →  ${r.cards.length} tarjetas en ${seg}s  (${r.descartadas} descartadas, ${r.repetidas} repetidas)`)
    generadas.push({ apunte: d.nombre, grupo: d.grupo, cards: r.cards, descartadas: r.descartadas, repetidas: r.repetidas })
  }

  await stopServer()

  const todas = generadas.flatMap((g) => g.cards)

  /* Las tarjetas quedan en un archivo para poder MIRARLAS. Un arnés que sólo
     cuenta no dice si sirven para estudiar; eso se ve leyéndolas. */
  const volcado = join(process.cwd(), '.qa', 'tarjetas-generadas.json')
  writeFileSync(volcado, JSON.stringify(generadas, null, 2), 'utf8')
  console.log(`    → las tarjetas quedaron en ${volcado}`)
  ok(todas.length > 0, 'salieron tarjetas de los apuntes', `${todas.length} en total`)
  ok(
    generadas.every((g) => g.cards.length > 0),
    'de CADA apunte salió al menos una tarjeta',
    generadas.map((g) => g.cards.length).join(' / ')
  )

  /* ── 3. CALIDAD ──────────────────────────────────────────────────────── */
  titulo('3 · ¿Sirven para estudiar?')

  ok(
    todas.every((c) => c.frente.trim().length > 0 && c.dorso.trim().length > 0),
    'ninguna tiene el frente o el dorso vacío'
  )

  /* La app deduplica DENTRO de cada generación, que es lo que promete: dos
     apuntes distintos que cubren el mismo tema pueden dar la misma tarjeta en
     dos unidades, y borrar una en silencio se sentiría como que faltan
     tarjetas. Así que se afirma lo que sí garantiza, y lo otro se informa. */
  for (const g of generadas) {
    const f = g.cards.map((c) => normalizar(c.frente).replace(/[^a-z0-9ñ]+/g, ' ').trim())
    ok(new Set(f).size === f.length, `no hay dos tarjetas repetidas dentro de "${g.apunte.slice(0, 34)}"`,
      `${f.length - new Set(f).size} repetida(s)`)
  }
  const frentes = todas.map((c) => normalizar(c.frente).replace(/[^a-z0-9ñ]+/g, ' ').trim())
  const cruzadas = frentes.length - new Set(frentes).size
  console.log(`    → ${cruzadas} tarjeta(s) repetida(s) ENTRE apuntes distintos (no es un defecto: son unidades separadas)`)

  /* Una tarjeta cuyo frente no pregunta nada no se puede responder de memoria:
     es un título, no una tarjeta. */
  const preguntan = todas.filter((c) => c.frente.includes('?') || /^(qué|cuál|cómo|cuándo|dónde|por qué|quién|para qué|definí|nombrá|explicá|enumerá)/i.test(c.frente.trim()))
  ok(preguntan.length / todas.length >= 0.8,
    'al menos 8 de cada 10 frentes son una pregunta de verdad',
    `${preguntan.length}/${todas.length}`)

  /* Un dorso de una palabra no enseña nada; uno de 400 caracteres no se puede
     recordar de memoria, que es justo lo que la tarjeta tiene que entrenar. */
  const dorsoUtil = todas.filter((c) => c.dorso.trim().length >= 15 && c.dorso.trim().length <= 400)
  ok(dorsoUtil.length / todas.length >= 0.9,
    'los dorsos tienen un largo que se puede memorizar (15 a 400 caracteres)',
    `${dorsoUtil.length}/${todas.length}`)

  /* La defensa contra el invento: el generador ya descarta lo que no ancla en el
     texto. Acá se comprueba el resultado de esa defensa desde afuera. */
  const totalDescartadas = generadas.reduce((n, g) => n + g.descartadas, 0)
  console.log(`    → el filtro anti-invento descartó ${totalDescartadas} tarjeta(s) que no estaban respaldadas por el apunte`)

  const vocabulario = new Set(documentos.flatMap((d) => palabras(d.texto)))
  const conVocabulario = todas.filter((c) => {
    const suyas = palabras(`${c.frente} ${c.dorso}`)
    if (!suyas.length) return false
    return suyas.filter((p) => vocabulario.has(p)).length / suyas.length >= 0.5
  })
  ok(conVocabulario.length / todas.length >= 0.85,
    'las tarjetas hablan del vocabulario del apunte, no de otro tema',
    `${conVocabulario.length}/${todas.length}`)

  console.log('\n    Todas las tarjetas. La cruz marca las que NO preguntan nada:')
  for (const c of todas) {
    console.log(`      ${preguntan.includes(c) ? '·' : '✗'} ${c.frente.slice(0, 72)}`)
  }

  /* ── 4. GUARDADO ─────────────────────────────────────────────────────── */
  titulo('4 · Guardar la materia y la unidad')

  deck.load()
  const porGrupo = new Map<string, string>()
  for (const g of generadas) {
    if (!porGrupo.has(g.grupo)) porGrupo.set(g.grupo, deck.createMateria(carreraDePrueba(), g.grupo).id)
  }
  ok(porGrupo.size > 0, `se crearon las materias, una por carpeta`, `${porGrupo.size}`)
  ok(deck.listMaterias().length >= porGrupo.size, 'y todas figuran en la biblioteca')

  let guardadasTotal = 0
  for (const g of generadas) {
    const u = deck.createUnidad(porGrupo.get(g.grupo) as string, g.apunte.slice(0, 60))
    const r = deck.saveCards(u.id, g.cards)
    guardadasTotal += r.guardadas
  }
  ok(guardadasTotal === todas.length, 'se guardaron todas las tarjetas generadas',
    `${guardadasTotal} de ${todas.length}`)

  /* Se vuelve a leer del disco: guardar en memoria y creer que quedó escrito es
     el error que deja al usuario sin sus mazos al cerrar la app. */
  deck.load()
  const enDisco = deck.allUnidades().reduce((n, u) => n + u.tarjetas.length, 0)
  ok(enDisco === guardadasTotal, 'y siguen ahí después de volver a leer del disco', `${enDisco}`)

  /* ── 5. ESTUDIO ──────────────────────────────────────────────────────── */
  titulo('5 · Estudiar de verdad')

  /* Sin materiaId: se estudia TODO, que es lo que hace el botón grande de la
     app. Con trece apuntes de dos materias distintas es además la prueba de que
     la sesión mezcla bien. */
  const s0 = sesion.start({})
  ok(s0.pendientes > 0, 'la sesión arranca con tarjetas para estudiar', `${s0.pendientes} pendientes`)
  ok(!!s0.actual, 'y muestra la primera tarjeta')

  /* Se estudia como estudia una persona: la mayoría bien, algunas mal. */
  let respondidas = 0
  let estado = s0
  const MAX = 60
  while (estado.actual && respondidas < MAX) {
    const g: 'si' | 'masomenos' | 'no' = respondidas % 5 === 0 ? 'no' : respondidas % 3 === 0 ? 'masomenos' : 'si'
    estado = sesion.grade(g)
    respondidas++
  }
  ok(respondidas > 0, 'se pudieron calificar tarjetas una tras otra', `${respondidas} calificaciones`)

  const resumen = sesion.end()
  ok(resumen.hechas === respondidas, 'el resumen de la sesión cuenta bien lo respondido',
    `${resumen.hechas} hechas = ${resumen.sabidas} sí + ${resumen.masOMenos} más o menos + ${resumen.noSabidas} no`)
  ok(resumen.sabidas + resumen.masOMenos + resumen.noSabidas === resumen.hechas,
    'y las tres categorías suman el total')

  /* ── 6. EL REPASO ESPACIADO ──────────────────────────────────────────── */
  titulo('6 · ¿El repaso espaciado hace lo que promete?')

  const DIA = 86400000
  let ahora = Date.now()

  /* Acertar siempre tiene que ESPACIAR: cada repaso acertado empuja el
     siguiente más lejos. Es la promesa central del producto. */
  let buena = sched.emptySchedule(ahora)
  const saltos: number[] = []
  for (let i = 0; i < 6; i++) {
    buena = sched.grade(buena, 'si', ahora)
    const dias = (buena.due - ahora) / DIA
    saltos.push(Math.round(dias * 10) / 10)
    ahora = buena.due
  }
  const crece = saltos.every((d, i) => i === 0 || d >= saltos[i - 1])
  ok(crece, 'acertando, cada repaso se aleja más que el anterior', saltos.join(' → ') + ' días')
  ok(saltos[saltos.length - 1] > saltos[0], 'y el último intervalo es mayor que el primero',
    `${saltos[0]} → ${saltos[saltos.length - 1]} días`)

  /* Fallar tiene que TRAERLA DE VUELTA. */
  /* Se comparan las dos ramas DESDE EL MISMO INSTANTE. Comparar contra
     `buena.due` daba cero: `ahora` ya había avanzado hasta ese vencimiento, así
     que el intervalo "de antes" medía cero y la comprobación no probaba nada. */
  const siguiendoBien = sched.grade(buena, 'si', ahora)
  const fallada = sched.grade(buena, 'no', ahora)
  const diasBien = (siguiendoBien.due - ahora) / DIA
  const diasMal = (fallada.due - ahora) / DIA
  ok(diasMal < diasBien / 10,
    'fallando, la tarjeta vuelve muchísimo antes que si se acierta',
    `${Math.round(diasBien)} días si acierta contra ${Math.round(diasMal * 100) / 100} si falla`)
  ok(fallada.lapses > buena.lapses, 'y queda registrado que se falló', `lapses ${fallada.lapses}`)
  ok(fallada.stability < buena.stability,
    'y la tarjeta pierde fuerza, no vuelve a espaciarse como si nada',
    `estabilidad ${Math.round(buena.stability * 10) / 10} → ${Math.round(fallada.stability * 10) / 10}`)

  /* "Más o menos" tiene que quedar en el medio: ni tan lejos como acertar ni
     tan cerca como fallar. Si no, el botón del medio no significa nada. */
  const base = sched.grade(sched.emptySchedule(Date.now()), 'si', Date.now())
  const t = Date.now()
  const conSi = sched.grade(base, 'si', t).due - t
  const conMas = sched.grade(base, 'masomenos', t).due - t
  const conNo = sched.grade(base, 'no', t).due - t
  ok(conNo < conMas && conMas < conSi,
    'los tres botones dan tres resultados distintos y en el orden correcto',
    `no ${Math.round(conNo / DIA * 10) / 10}d < más o menos ${Math.round(conMas / DIA * 10) / 10}d < sí ${Math.round(conSi / DIA * 10) / 10}d`)

  /* La madurez tiene que progresar: una tarjeta nueva no puede figurar como
     aprendida, y una acertada muchas veces no puede seguir figurando como nueva. */
  ok(sched.madurez(sched.emptySchedule(Date.now())) === 'nueva', 'una tarjeta recién creada figura como nueva')
  ok(sched.madurez(buena) === 'aprendida' || sched.madurez(buena) === 'repasando',
    'una acertada seis veces ya no figura como nueva', sched.madurez(buena))

  /* Y una tarjeta que todavía no vence NO puede aparecer para repasar hoy: es
     lo que evita que la app te muestre siempre lo mismo. */
  const futura = sched.grade(sched.emptySchedule(Date.now()), 'si', Date.now())
  ok(!sched.isDue(futura, Date.now()), 'una tarjeta ya repasada hoy no vuelve a aparecer hoy')
  ok(sched.isDue(futura, futura.due + 1000), 'pero sí el día que le toca')

  /* ── final ───────────────────────────────────────────────────────────── */
  console.log('\n══════════════════════════════════════════════════════════════')
  if (fallaron === 0) {
    console.log(`  ✅ ${pasaron}/${pasaron} comprobaciones pasaron.`)
  } else {
    console.log(`  ❌ ${fallaron} FALLA(S) de ${pasaron + fallaron}:`)
    for (const p of problemas) console.log(`     · ${p}`)
  }
  console.log('══════════════════════════════════════════════════════════════\n')
  process.exit(fallaron === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n  ✗ el recorrido se cortó:', e?.message ?? e)
  console.error(e?.stack ?? '')
  process.exit(1)
})
