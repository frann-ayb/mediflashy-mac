import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * La cola de generación.
 *
 *   node scripts/run-qa.mjs cola
 *
 * POR QUÉ EXISTE
 * --------------
 * La cola es la única parte de la app que puede perder DOS HORAS de trabajo del
 * usuario de una sola vez. Genera de doce apuntes seguidos sin supervisión; si el
 * bucle se corta en el octavo, o pierde lo de los siete anteriores, o mezcla el
 * orden, no hay forma de recuperarlo: el texto fuente no se guarda y las tarjetas
 * nunca llegaron a disco.
 *
 * Por eso el bucle vive en `renderer/src/lib/cola.ts` y no adentro del componente:
 * acá se le puede hacer fallar un archivo, cancelarlo en el medio y darle una
 * lectura vacía sin abrir una ventana.
 *
 * QUÉ PRUEBA
 * ----------
 *  1. Que salgan todas las tarjetas, en el orden de los archivos.
 *  2. Que un archivo que falla NO corte la cola.
 *  3. Que cancelar conserve lo ya generado.
 *  4. Que no se llame al motor después de cancelar.
 *  5. Que las repetidas exactas entre archivos se saquen antes de la revisión.
 */

app.setPath('userData', mkdtempSync(join(tmpdir(), 'flashcards-cola-')))

/* eslint-disable @typescript-eslint/no-var-requires */
const { procesarCola, sinRepetidas } = require('../src/renderer/src/lib/cola') as typeof import('../src/renderer/src/lib/cola')

let pruebas = 0
let fallas = 0

function ok(cond: boolean, texto: string, detalle = ''): void {
  pruebas++
  if (cond) {
    console.log('  ✓ ' + texto + (detalle ? '  ' + detalle : ''))
  } else {
    fallas++
    console.log('  ✗ ' + texto + (detalle ? '  ' + detalle : ''))
  }
}

interface Card {
  frente: string
  dorso: string
}

/**
 * Un motor de mentira.
 *
 * Devuelve las tarjetas que se le indiquen por archivo, y anota cada llamada para
 * poder comprobar que después de cancelar no se le pide nada más.
 */
function motor(porArchivo: Record<string, Card[] | string>): {
  llamadas: string[]
  ops: {
    leer: (ruta: string) => Promise<{ data: { texto: string } | null; error: string | null }>
    generar: (texto: string) => Promise<{ data: { cards: Card[]; descartadas: number } | null; error: string | null }>
  }
} {
  const llamadas: string[] = []
  return {
    llamadas,
    ops: {
      leer: async (ruta) => {
        if (porArchivo[ruta] === 'no-se-lee') return { data: null, error: 'Ese PDF es una imagen escaneada.' }
        return { data: { texto: 'texto de ' + ruta }, error: null }
      },
      generar: async (texto) => {
        llamadas.push(texto)
        const ruta = texto.replace('texto de ', '')
        const v = porArchivo[ruta]
        if (v === 'no-genera') return { data: null, error: 'El motor no respondió.' }
        return { data: { cards: Array.isArray(v) ? v : [], descartadas: 1 }, error: null }
      }
    }
  }
}

const c = (n: string): Card => ({ frente: n, dorso: 'dorso de ' + n })

const ganchosVacios = {
  alEmpezar: (): void => {},
  alTerminar: (): void => {},
  cancelado: (): boolean => false
}

async function main(): Promise<void> {
  console.log('\n1 · Todo sale, y en orden')
  {
    const m = motor({ a: [c('a1'), c('a2')], b: [c('b1')], d: [c('d1'), c('d2'), c('d3')] })
    const r = await procesarCola<Card>(['a', 'b', 'd'], m.ops, ganchosVacios)
    ok(r.cards.length === 6, 'salen todas las tarjetas de los tres archivos', r.cards.length + ' de 6')
    ok(
      r.cards.map((x) => x.frente).join(',') === 'a1,a2,b1,d1,d2,d3',
      'y en el orden de los archivos, no en el que fueron contestando',
      r.cards.map((x) => x.frente).join(',')
    )
    ok(r.hechos === 3 && r.fallados === 0, 'cuenta bien cuántos se procesaron', r.hechos + ' hechos, ' + r.fallados + ' fallados')
    ok(r.descartadas === 3, 'suma las descartadas de todos los archivos', String(r.descartadas))
    ok(!r.cortada, 'y no figura como cortada')
  }

  console.log('\n2 · Un archivo que no se puede leer no corta la cola')
  {
    const m = motor({ a: [c('a1')], malo: 'no-se-lee', d: [c('d1'), c('d2')] })
    const estados: string[] = []
    const r = await procesarCola<Card>(['a', 'malo', 'd'], m.ops, {
      ...ganchosVacios,
      alTerminar: (i, res) => estados.push(i + ':' + res.estado)
    })
    ok(r.cards.length === 3, 'siguen saliendo las tarjetas de los otros dos', r.cards.length + ' de 3')
    ok(r.fallados === 1 && r.hechos === 2, 'y el que falló queda contado aparte', r.hechos + ' hechos, ' + r.fallados + ' fallados')
    ok(estados.join(' ') === '0:listo 1:error 2:listo', 'la vista se entera de cuál falló', estados.join(' '))
  }

  console.log('\n3 · Un archivo donde el motor no responde tampoco la corta')
  {
    const m = motor({ a: [c('a1')], mudo: 'no-genera', d: [c('d1')] })
    const r = await procesarCola<Card>(['a', 'mudo', 'd'], m.ops, ganchosVacios)
    ok(r.cards.length === 2 && r.fallados === 1, 'se saltea y sigue', r.cards.length + ' tarjetas, ' + r.fallados + ' fallado')
  }

  console.log('\n4 · Cancelar no tira lo ya generado')
  {
    const m = motor({ a: [c('a1'), c('a2')], b: [c('b1')], d: [c('d1')], e: [c('e1')] })
    let terminados = 0
    const r = await procesarCola<Card>(['a', 'b', 'd', 'e'], m.ops, {
      alEmpezar: () => {},
      alTerminar: () => {
        terminados++
      },
      /* Cancela una vez que terminaron dos, como si el usuario hubiera tocado el
         botón mientras corría el tercero. */
      cancelado: () => terminados >= 2
    })
    ok(r.cards.length === 3, 'quedan las tarjetas de los archivos que sí terminaron', r.cards.length + ' de 3')
    ok(r.cortada, 'y se informa que quedó cortada')
    ok(r.hechos === 2, 'con la cuenta de los que llegaron a terminar', String(r.hechos))
    ok(m.llamadas.length === 2, 'no se le pidió nada más al motor después de cancelar', m.llamadas.length + ' llamadas')
  }

  console.log('\n5 · Cancelar antes de empezar no llama a nadie')
  {
    const m = motor({ a: [c('a1')] })
    const r = await procesarCola<Card>(['a', 'b'], m.ops, { ...ganchosVacios, cancelado: () => true })
    ok(r.cards.length === 0 && r.cortada, 'no genera nada y avisa que se cortó')
    ok(m.llamadas.length === 0, 'y el motor no se toca', m.llamadas.length + ' llamadas')
  }

  console.log('\n6 · Una cola vacía no rompe')
  {
    const m = motor({})
    const r = await procesarCola<Card>([], m.ops, ganchosVacios)
    ok(r.cards.length === 0 && !r.cortada && r.hechos === 0, 'devuelve vacío sin errores')
  }

  console.log('\n7 · Las repetidas exactas entre archivos se sacan antes de revisar')
  {
    const entrada = [
      c('¿Qué es una célula?'),
      c('¿Qué es un tejido?'),
      { frente: '  ¿QUÉ ES UNA CÉLULA?  ', dorso: 'otra redacción' },
      c('¿Qué es un órgano?')
    ]
    const salida = sinRepetidas(entrada)
    ok(salida.length === 3, 'la repetida con otro caso y espacios no pasa dos veces', salida.length + ' de 4')
    ok(salida[0].dorso === 'dorso de ¿Qué es una célula?', 'y se queda la primera, no la última')
    ok(sinRepetidas([c('a'), c('b'), c('d')]).length === 3, 'y no saca nada cuando no hay repetidas')
  }

  console.log('\n8 · Lo que la cola NO hace, a propósito')
  {
    const casi = sinRepetidas([
      { frente: '¿Qué es una célula?', dorso: 'x' },
      { frente: '¿Qué es la célula?', dorso: 'y' }
    ])
    ok(
      casi.length === 2,
      'las PARECIDAS las deja pasar: filtrarlas es trabajo de saveCards, con trigramas',
      'una segunda regla que con el tiempo diverja sería peor que ninguna'
    )
  }

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(
    fallas === 0 ? '  ✅ ' + pruebas + '/' + pruebas + ' comprobaciones pasaron.' : '  ❌ ' + (pruebas - fallas) + '/' + pruebas + ' comprobaciones pasaron.'
  )
  console.log('══════════════════════════════════════════════════════════════\n')
  process.exit(fallas === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('\n  se cortó:', e?.message ?? e)
  process.exit(1)
})
