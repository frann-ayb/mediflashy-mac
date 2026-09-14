import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Qué tarjeta choca con cuál, según el criterio de la app.
 *
 *   node scripts/run-qa.mjs choques
 *
 * `qa/siembra.ts` avisa que hay choques y lista los frentes, pero no dice contra
 * QUÉ chocan, y sin eso no se puede reformular: hay que ver las dos para saber cuál
 * conviene cambiar y cómo.
 *
 * Usa `fingerprint` e `isDuplicate` de la app, no una implementación propia: si
 * midiera distinto, arreglaría un problema que la app no tiene y dejaría el que sí.
 */

app.setPath('userData', mkdtempSync(join(tmpdir(), 'flashcards-choques-')))

/* eslint-disable @typescript-eslint/no-var-requires */
const regalo = require('../src/main/services/mazosDeRegalo') as typeof import('../src/main/services/mazosDeRegalo')
const { fingerprint, isDuplicate } = require('../src/main/services/core/anchor') as typeof import('../src/main/services/core/anchor')

/*
 * Se compara DENTRO de cada unidad, no contra el mazo entero, y eso cambia el
 * resultado en las dos direcciones.
 *
 * `saveCards` (deckStore) deduplica contra las tarjetas de LA UNIDAD en la que
 * guarda, nunca contra otras unidades. O sea que dos frentes parecidos en
 * unidades distintas conviven sin problema —y tiene sentido: la farmacología de
 * Enfermeria y la de Medicina van a preguntar cosas parecidas y son mazos
 * distintos—, mientras que dos parecidos en la MISMA unidad hacen que una se
 * pierda al sembrar, en silencio y sin log.
 *
 * Comparando global, esta prueba reportaba choques que en la práctica no ocurren
 * y no frenaba los que sí. Con 19 carreras que comparten temas, ese ruido habría
 * hecho que se ignorara el informe entero.
 */
let total = 0
let choques = 0

console.log('')
for (const mazo of regalo.MAZOS_DE_REGALO) {
  const huellas: Array<{ h: ReturnType<typeof fingerprint>; frente: string }> = []
  for (const t of mazo.tarjetas) {
    total++
    const h = fingerprint(t.frente)
    const contra = huellas.find((x) => isDuplicate(h, [x.h]))
    if (contra) {
      choques++
      console.log(`  CHOQUE ${choques}  ·  ${mazo.carrera}  ·  ${mazo.materia}  ·  ${mazo.unidad}`)
      console.log(`    A  ${contra.frente}`)
      console.log(`    B  ${t.frente}`)
      console.log('')
      continue
    }
    huellas.push({ h, frente: t.frente })
  }
}

console.log(`  ${total} tarjetas · ${choques} choque(s) dentro de una misma unidad`)

/*
 * CORTA EL BUILD. Antes era `process.exit(0)`: informaba y seguía de largo.
 *
 * Un choque no es una advertencia de estilo: es una tarjeta que el comprador NO
 * VA A RECIBIR. Se siembra el mazo, `saveCards` la descarta por parecida, y el
 * número que publica la landing deja de coincidir con lo que hay en la máquina
 * del que pagó. Escribir 9.000 y entregar 8.400 sin saber cuáles faltan es
 * exactamente el problema que este archivo existe para evitar.
 */
process.exit(choques > 0 ? 1 : 0)
