/**
 * Arnés del mapa de autores.
 *
 *   node scripts/check-autores.mjs src/main/services/mazosDeRegalo.ts
 *
 * Comprueba, en las dos direcciones, lo que el PDF afirma de sí mismo: que cada
 * autor listado aparece en las tarjetas de la app, y que ningún autor de las
 * tarjetas quedó afuera del mapa.
 *
 * Es la única forma de que la frase impresa en el bonus —"los 91 de esta lista
 * se sacaron contando quién aparece en las 1.507 tarjetas"— sea verdadera y no
 * una linda promesa. Un autor de relleno rompe la promesa hacia afuera; uno que
 * falta deja un hueco justo donde el comprador lo iba a buscar.
 */
import { readFileSync } from 'node:fs'
import { MAPA_DE_AUTORES, TOTAL_AUTORES } from './lib/bonus-autores.mjs'

const corpus = readFileSync(process.argv[2], 'utf8')

/* El apellido tal como se lo busca en el texto de las tarjetas. Dos entradas
   del mapa llevan nombre completo por claridad del lector, pero en las
   tarjetas figuran por el apellido. */
const COMO_APARECE = { 'Phineas Gage': 'Gage', 'Pichon Rivière': 'Pichon', 'Anna Freud': 'Anna Freud' }

let fallas = 0
const ok = (c, q, d = '') => {
  if (c) console.log(`  ✓ ${q}`)
  else {
    fallas++
    console.error(`  ✗ ${q}${d ? ` — ${d}` : ''}`)
  }
}

console.log('\n=== El mapa de autores contra las tarjetas de la app ===\n')

const listados = MAPA_DE_AUTORES.flatMap((m) => m.autores.map((a) => a[0]))

ok(listados.length === TOTAL_AUTORES, `el mapa declara ${TOTAL_AUTORES} autores y lista ${listados.length}`)
ok(new Set(listados).size === listados.length, 'ningún autor está repetido en dos materias')

const ausentes = listados.filter((a) => !corpus.includes(COMO_APARECE[a] ?? a))
ok(ausentes.length === 0, 'todos los autores del mapa aparecen en las tarjetas', ausentes.join(', '))

/* Los cuatro campos completos: una fila a la que le falte el aporte o los
   conceptos deja al lector sin lo único que el mapa promete. */
const incompletas = MAPA_DE_AUTORES.flatMap((m) =>
  m.autores.filter((a) => a.length !== 4 || a.some((c) => !String(c).trim())).map((a) => `${m.materia}/${a[0]}`)
)
ok(incompletas.length === 0, 'ninguna fila tiene campos vacíos', incompletas.join(', '))

/* El aporte tiene que entrar en la celda de la tabla sin desarmar la página. */
const largos = MAPA_DE_AUTORES.flatMap((m) => m.autores.filter((a) => a[2].length > 120).map((a) => `${a[0]} (${a[2].length})`))
ok(largos.length === 0, 'ningún aporte pasa los 120 caracteres', largos.join(', '))

console.log(`\n${fallas === 0 ? '✅' : '❌'} ${fallas} fallas · ${TOTAL_AUTORES} autores en ${MAPA_DE_AUTORES.length} materias\n`)
process.exit(fallas === 0 ? 0 : 1)
