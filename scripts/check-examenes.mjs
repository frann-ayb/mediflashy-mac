/**
 * Arnés de los simulacros de final.
 *
 *   node scripts/check-examenes.mjs
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * Porque este bonus se entrega impreso y no se puede corregir después. Si un
 * examen quedó con siete preguntas en vez de ocho, si una múltiple tiene tres
 * opciones, o si la respuesta correcta apunta a una letra que no existe, el
 * comprador lo descubre estudiando para un final. Nada de eso tira un error
 * solo: hay que ir a buscarlo.
 *
 * El chequeo que más importa es el último: que las 14 materias del bonus sean
 * EXACTAMENTE las 14 de la app. Un simulacro de una materia que la app no
 * cubre, o una materia de la app sin simulacro, rompe la promesa de la página
 * de venta, que dice "un modelo de examen por materia".
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXAMENES, TOTAL_PREGUNTAS } from './lib/examenes/index.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let fallas = 0
let pruebas = 0
const ok = (c, q, d = '') => {
  pruebas++
  if (c) console.log(`  ✓ ${q}`)
  else {
    fallas++
    console.error(`  ✗ ${q}${d ? ` — ${d}` : ''}`)
  }
}
const seccion = (t) => console.log(`\n${t}`)

console.log('\n=== Los 14 simulacros de final ===')

/* ---------------------------- la forma de cada uno ------------------------ */

seccion('Que cada examen esté completo')

ok(EXAMENES.length === 14, `son 14 exámenes`, `hay ${EXAMENES.length}`)

const mal = (f) => EXAMENES.filter(f).map((e) => e.materia)

ok(mal((e) => e.desarrollo?.length !== 8).length === 0, 'los 14 tienen 8 preguntas de desarrollo', mal((e) => e.desarrollo?.length !== 8).join(' | '))
ok(mal((e) => e.multiple?.length !== 8).length === 0, 'los 14 tienen 8 de opción múltiple', mal((e) => e.multiple?.length !== 8).join(' | '))
ok(mal((e) => e.oral?.length !== 4).length === 0, 'los 14 tienen 4 de oral', mal((e) => e.oral?.length !== 4).join(' | '))

/* ----------------------------- las múltiple ------------------------------- */

seccion('Las de opción múltiple, que son las que más se rompen')

const cadaMultiple = (f) =>
  EXAMENES.flatMap((e) => e.multiple.map((m, i) => ({ e, m, i })).filter(({ m }) => f(m)))
    .map(({ e, i }) => `${e.materia} M${i + 1}`)

const sinCuatro = cadaMultiple((m) => !Array.isArray(m.ops) || m.ops.length !== 4)
ok(sinCuatro.length === 0, 'todas tienen exactamente 4 opciones', sinCuatro.join(' | '))

const letraMala = cadaMultiple((m) => !['a', 'b', 'c', 'd'].includes(m.ok))
ok(letraMala.length === 0, 'la correcta siempre es a, b, c o d', letraMala.join(' | '))

const sinPor = cadaMultiple((m) => !m.por?.trim())
ok(sinPor.length === 0, 'todas explican por qué las otras están mal', sinPor.join(' | '))

/*
 * Que la correcta no caiga siempre en la misma letra.
 *
 * Si las 112 respuestas fueran "b", el simulacro se aprueba sin leerlo y deja
 * de servir para lo único que sirve. Se pide que ninguna letra pase de la
 * mitad; con 8 preguntas por materia, el azar reparte bastante mejor que eso.
 */
const cuenta = { a: 0, b: 0, c: 0, d: 0 }
for (const e of EXAMENES) for (const m of e.multiple) cuenta[m.ok] = (cuenta[m.ok] ?? 0) + 1
const totalM = Object.values(cuenta).reduce((a, b) => a + b, 0)
const masUsada = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0]
ok(
  masUsada[1] <= totalM * 0.5,
  `la correcta está repartida (${Object.entries(cuenta).map(([l, n]) => `${l}:${n}`).join(' ')})`,
  `"${masUsada[0]}" se lleva ${masUsada[1]} de ${totalM}`
)

/*
 * Y que el «por qué» no señale a la CORRECTA.
 *
 * Éste es el chequeo caro. Las opciones se reordenaron para que la respuesta no
 * cayera siempre en la "b", y en ese movimiento hubo que reescribir las letras
 * que cada `por` menciona. Si alguna quedó sin remapear, el documento de
 * respuestas dice que la opción correcta está mal: el peor error posible en un
 * material de estudio, y uno que no se nota leyendo por encima.
 *
 * Se buscan SÓLO las formas inequívocas de nombrar una opción —"(b)", "la b",
 * "b)"— y nunca la letra suelta. En español "a" es además preposición
 * ("corresponde a la repolarización"), así que una búsqueda amplia daría falsos
 * positivos en cada respuesta cuya correcta sea la "a", que es justo donde este
 * chequeo tiene que ser confiable.
 */
seccion('Que el «por qué» no acuse a la respuesta correcta')

/*
 * Un matiz que costó un falso positivo: varios `por` CIERRAN afirmando la
 * correcta —"…; sólo (d) describe el desequilibrio disposicional"— y eso está
 * bien, es la frase que remata la explicación. Lo que no puede pasar es que la
 * nombre como si fuera uno de los descartes. Por eso no alcanza con encontrar
 * la letra: hay que mirar si viene detrás de "sólo" o "únicamente".
 */
/* Se BORRA la frase afirmativa antes de buscar, en vez de intentar esquivarla
   con un lookbehind: "sólo (d)" contiene un "d)" cuyo carácter previo es "(",
   así que el lookbehind lo dejaba pasar igual. Quitando la frase entera, lo que
   queda para inspeccionar son sólo las menciones acusatorias. */
const sinAfirmaciones = (t) => t.replace(/\b(?:sólo|solo|únicamente|unicamente)\s+\(?[a-d]\)?/gi, ' ')

const nombraLa = (texto, letra) =>
  new RegExp(`\\(${letra}\\)|\\b${letra}\\)|\\bla ${letra}\\b|\\blas? opciones? ${letra}\\b`, 'i').test(
    sinAfirmaciones(texto)
  )

const acusaALaBuena = EXAMENES.flatMap((e) =>
  e.multiple.map((m, i) => ({ e, m, i })).filter(({ m }) => nombraLa(m.por, m.ok))
).map(({ e, i, m }) => `${e.materia} M${i + 1} (correcta "${m.ok}")`)

ok(
  acusaALaBuena.length === 0,
  'ningún «por qué» acusa a la opción correcta',
  acusaALaBuena.join(' | ')
)

/*
 * Y que cada explicación siga siendo una explicación de verdad.
 *
 * No se cuenta cuántas nombran las opciones por su letra: la mitad lo hace en
 * la forma "a describe…", sin paréntesis, y detectar esa forma en español pide
 * distinguir la opción "a" de la preposición "a", que es justo el enredo que
 * hizo imposible remapear esto por script. Lo que sí se puede afirmar sin
 * ambigüedad es que ninguna quedó reducida a un muñón al reescribirla.
 */
const cortas = EXAMENES.flatMap((e) =>
  e.multiple.map((m, i) => ({ e, m, i })).filter(({ m }) => m.por.trim().length < 60)
).map(({ e, i }) => `${e.materia} M${i + 1}`)
ok(cortas.length === 0, 'ninguna explicación quedó truncada al reordenar', cortas.join(' | '))

/* -------------------------- que no quede basura --------------------------- */

seccion('Que no se haya colado el formato del borrador')

const textos = EXAMENES.flatMap((e) => [
  ...e.desarrollo.flatMap((x) => [x.p, x.r]),
  ...e.multiple.flatMap((x) => [x.p, x.por, ...x.ops]),
  ...e.oral.flatMap((x) => [x.p, x.g])
])

ok(textos.every((t) => typeof t === 'string' && t.trim().length > 0), 'ningún campo quedó vacío')

/* Los prefijos del formato intermedio ("P1:", "M3:", "OK:", "POR:"). Si alguno
   sobrevivió, sale impreso en el PDF y se ve como un error de armado. */
const conPrefijo = textos.filter((t) => /^\s*(P|R|M|O|G)\d+\s*:|^\s*(OK|POR)\s*:/i.test(t))
ok(conPrefijo.length === 0, 'ninguno arrastra los prefijos del borrador', conPrefijo.slice(0, 3).join(' | '))

/* Las opciones no llevan su propia letra: la numeración la pone el PDF, y si
   además viene en el texto sale "a) a) ...". */
const conLetra = EXAMENES.flatMap((e) => e.multiple.flatMap((m, i) =>
  m.ops.filter((o) => /^\s*[a-d]\s*\)/i.test(o)).map(() => `${e.materia} M${i + 1}`)
))
ok(conLetra.length === 0, 'las opciones no repiten su letra adentro del texto', [...new Set(conLetra)].join(' | '))

/* Texto plano: el PDF no interpreta HTML ni markdown, se vería crudo. */
const conMarcas = textos.filter((t) => /<[a-z\/]|\*\*|^#{1,6}\s/i.test(t))
ok(conMarcas.length === 0, 'ninguno trae HTML ni markdown', conMarcas.slice(0, 2).map((t) => t.slice(0, 60)).join(' | '))

/* --------------- que las materias sean las de la app, las 14 -------------- */

seccion('Que las materias sean exactamente las que trae la app')

/*
 * Se leen del código de la app y no de una lista escrita acá: si mañana alguien
 * renombra una materia en `mazosDeRegalo.ts`, este chequeo lo señala en vez de
 * dejar que el bonus quede hablando de una materia que ya no se llama así.
 */
const fuente = readFileSync(resolve(ROOT, 'src/main/services/mazosDeRegalo.ts'), 'utf8')
const deLaApp = [...new Set([...fuente.matchAll(/materia:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`)))]

ok(deLaApp.length === 14, `la app declara 14 materias`, `declara ${deLaApp.length}`)

const delBonus = EXAMENES.map((e) => e.materia)
const sobran = delBonus.filter((m) => !deLaApp.includes(m))
const faltan = deLaApp.filter((m) => !delBonus.includes(m))

ok(sobran.length === 0, 'ningún simulacro es de una materia que la app no trae', sobran.join(' | '))
ok(faltan.length === 0, 'ninguna materia de la app se quedó sin simulacro', faltan.join(' | '))
ok(new Set(delBonus).size === delBonus.length, 'no hay dos simulacros de la misma materia')

/* ------------------------------- el cierre -------------------------------- */

console.log(
  `\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones · ` +
    `${TOTAL_PREGUNTAS} preguntas en ${EXAMENES.length} materias\n`
)
process.exit(fallas === 0 ? 0 : 1)
