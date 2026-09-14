import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * La carrera donde viven las materias de estas pruebas.
 *
 * Existe porque la jerarquia paso a ser Carrera -> Materia -> Unidad y una
 * materia ya no puede crearse suelta. Se reusa la primera que haya para que dos
 * llamadas seguidas no dejen dos carreras de prueba.
 */
const carreraDePrueba = (): string => deck.listCarreras()[0]?.id ?? deck.createCarrera('Carrera de prueba').id


/**
 * Exportar e importar mazos.
 *
 *   node scripts/run-qa.mjs mazos
 *
 * POR QUÉ EXISTE
 * --------------
 * Esta es la única parte de la app que lee un archivo que vino de AFUERA. Todo lo
 * demás nace adentro: los apuntes los elige el usuario de su propia máquina y las
 * tarjetas las escribe el modelo local. Un mazo, en cambio, se descarga de
 * internet, y quien lo mandó puede no ser quien dice ser.
 *
 * Así que lo que se prueba acá no es sólo que funcione, sino que NO se pueda usar
 * para hacer daño: un archivo cortado, uno con un millón de tarjetas, uno con un
 * campo que es un objeto donde se espera texto, uno con nombres de mil caracteres.
 * Ninguno puede tirar abajo la app ni dejar media materia creada.
 *
 * La otra mitad es la promesa comercial: si el mazo se vende, el progreso de
 * estudio del que lo vendió NO puede viajar adentro.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-mazos-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const deck = require('../src/main/services/deckStore') as typeof import('../src/main/services/deckStore')
const mazo = require('../src/main/services/mazoArchivo') as typeof import('../src/main/services/mazoArchivo')
const { grade } = require('../src/main/services/scheduler') as typeof import('../src/main/services/scheduler')

let pruebas = 0
let fallas = 0

function ok(cond: boolean, texto: string, detalle = ''): void {
  pruebas++
  console.log(`  ${cond ? '✓' : '✗'} ${texto}${detalle ? '  ' + detalle : ''}`)
  if (!cond) fallas++
}

/** Corre algo que tiene que fallar, y devuelve el mensaje que le llegaría al usuario. */
function rechaza(que: string, fn: () => unknown): void {
  pruebas++
  try {
    fn()
    fallas++
    console.log(`  ✗ ${que}  ← NO lo rechazó`)
  } catch (e) {
    const m = (e as Error).message
    /* No alcanza con que falle: el mensaje tiene que ser para una persona. Un
       "Cannot read properties of undefined" es una falla distinta. */
    const explicado = m.length > 15 && !/undefined|null|\[object|TypeError/i.test(m)
    if (!explicado) fallas++
    console.log(`  ${explicado ? '✓' : '✗'} ${que}`)
    console.log(`      "${m.slice(0, 88)}"`)
  }
}

function seccion(t: string): void {
  console.log(`\n${t}`)
  console.log('─'.repeat(Math.min(t.length, 62)))
}

function main(): void {
  deck.load()

  seccion('1 · Ida y vuelta: lo que sale es lo que entra')

  const m = deck.createMateria(carreraDePrueba(), 'Anatomía')
  const u1 = deck.createUnidad(m.id, 'Unidad 1 — Generalidades')
  const u2 = deck.createUnidad(m.id, 'Unidad 2 — Huesos')
  deck.saveCards(u1.id, [
    { frente: '¿Qué es la posición anatómica?', dorso: 'La posición de referencia: de pie, palmas hacia adelante.' },
    { frente: '¿Qué plano divide el cuerpo en derecha e izquierda?', dorso: 'El plano sagital.' }
  ])
  deck.saveCards(u2.id, [{ frente: '¿Cuántos huesos tiene el adulto?', dorso: '206 huesos.' }])

  const archivo = mazo.exportarMateria(m.id)
  ok(archivo.materia === 'Anatomía', 'el archivo lleva el nombre de la materia', archivo.materia)
  ok(archivo.unidades.length === 2, 'lleva las dos unidades', String(archivo.unidades.length))
  ok(archivo.unidades[0].nombre === 'Unidad 1 — Generalidades', 'y en el orden que les puso el usuario')
  ok(
    archivo.unidades.reduce((n, x) => n + x.tarjetas.length, 0) === 3,
    'con las tres tarjetas'
  )

  const texto = JSON.stringify(archivo, null, 2)
  const vuelta = mazo.parsear(texto)
  ok(vuelta.materia === archivo.materia, 'lo que se escribe se vuelve a leer igual')
  ok(JSON.stringify(vuelta.unidades) === JSON.stringify(archivo.unidades), 'con las mismas unidades y tarjetas')

  seccion('2 · El progreso de estudio NO viaja')

  /* Se estudia una tarjeta de verdad para que tenga historial. */
  const card = deck.listCards(u1.id)[0]
  const nuevo = grade(card.schedule, 'si', Date.now())
  deck.saveSchedule(u1.id, card.id, nuevo)
  const estudiada = deck.listCards(u1.id)[0]
  ok(estudiada.schedule.reps > 0, 'la tarjeta quedó con historial de repaso', `reps ${estudiada.schedule.reps}`)

  const conHistorial = mazo.exportarMateria(m.id)
  const serializado = JSON.stringify(conHistorial)
  ok(!serializado.includes('schedule'), 'el archivo no lleva el estado de repaso')
  ok(!serializado.includes('stability') && !serializado.includes('lapses'), 'ni ninguno de sus campos')
  ok(!serializado.includes(card.id), 'ni los ids de la instalación que exportó')

  seccion('3 · Archivos hostiles o rotos')

  rechaza('un archivo que no es JSON', () => mazo.parsear('esto no es json {{{'))
  rechaza('un JSON que es un número', () => mazo.parsear('42'))
  rechaza('un JSON que es un array', () => mazo.parsear('[]'))
  rechaza('un objeto sin la marca del formato', () => mazo.parsear('{"materia":"X","unidades":[]}'))
  rechaza('otro formato que se hace pasar', () => mazo.parsear('{"formato":"otra-cosa","version":1,"materia":"X","unidades":[]}'))
  rechaza('una versión futura', () =>
    mazo.parsear('{"formato":"flashcards-mazo","version":99,"materia":"X","unidades":[]}')
  )
  rechaza('sin unidades', () => mazo.parsear('{"formato":"flashcards-mazo","version":1,"materia":"X"}'))
  rechaza('con cero unidades', () =>
    mazo.parsear('{"formato":"flashcards-mazo","version":1,"materia":"X","unidades":[]}')
  )
  rechaza('el nombre de la materia es un objeto', () =>
    mazo.parsear('{"formato":"flashcards-mazo","version":1,"materia":{"a":1},"unidades":[{"nombre":"U","tarjetas":[]}]}')
  )
  rechaza('una tarjeta sin dorso', () =>
    mazo.parsear(
      '{"formato":"flashcards-mazo","version":1,"materia":"X","unidades":[{"nombre":"U","tarjetas":[{"frente":"hola"}]}]}'
    )
  )
  rechaza('un frente que es un número', () =>
    mazo.parsear(
      '{"formato":"flashcards-mazo","version":1,"materia":"X","unidades":[{"nombre":"U","tarjetas":[{"frente":7,"dorso":"x"}]}]}'
    )
  )
  rechaza('un nombre de materia de 5.000 caracteres', () =>
    mazo.parsear(
      JSON.stringify({ formato: 'flashcards-mazo', version: 1, materia: 'a'.repeat(5000), unidades: [{ nombre: 'U', tarjetas: [] }] })
    )
  )
  rechaza('300 unidades', () =>
    mazo.parsear(
      JSON.stringify({
        formato: 'flashcards-mazo',
        version: 1,
        materia: 'X',
        unidades: Array.from({ length: 300 }, (_, i) => ({ nombre: `U${i}`, tarjetas: [{ frente: 'a', dorso: 'b' }] }))
      })
    )
  )
  rechaza('un mazo con 30.000 tarjetas', () =>
    mazo.parsear(
      JSON.stringify({
        formato: 'flashcards-mazo',
        version: 1,
        materia: 'X',
        unidades: Array.from({ length: 10 }, (_, i) => ({
          nombre: `U${i}`,
          tarjetas: Array.from({ length: 3000 }, (_, k) => ({ frente: `f${k}`, dorso: `d${k}` }))
        }))
      })
    )
  )

  seccion('4 · Nada se escribe a medias')

  const antes = deck.listMaterias().length
  try {
    mazo.parsear('{"formato":"flashcards-mazo","version":1,"materia":"Zoología","unidades":[{"nombre":"U","tarjetas":[{"frente":7}]}]}')
  } catch {
    /* se esperaba */
  }
  ok(deck.listMaterias().length === antes, 'un archivo inválido no deja una materia creada a medias', `${antes} materias antes y después`)

  seccion('5 · Importar en una biblioteca limpia')

  deck.deleteMateria(m.id)
  ok(deck.listMaterias().length === 0, 'la biblioteca quedó vacía para la prueba')

  const r1 = mazo.importar(vuelta, null, carreraDePrueba())
  ok(r1.guardadas === 3, 'entran las tres tarjetas', String(r1.guardadas))
  ok(r1.unidadesNuevas === 2, 'y se crean las dos unidades', String(r1.unidadesNuevas))
  ok(!r1.fusionada, 'figura como materia nueva, no como fusión')
  ok(deck.listMaterias().length === 1, 'hay una sola materia')

  const importada = deck.listMaterias()[0]
  const cards = deck.listUnidades(importada.id).flatMap((u) => deck.listCards(u.id))
  ok(cards.length === 3, 'las tarjetas están en la biblioteca', String(cards.length))
  ok(
    cards.every((c) => c.schedule.reps === 0 && c.schedule.state === 0),
    'y TODAS arrancan sin historial, como si fueran nuevas'
  )

  seccion('6 · Importar dos veces no duplica')

  const r2 = mazo.importar(vuelta, importada.id, carreraDePrueba())
  ok(r2.guardadas === 0, 'la segunda vez no entra ninguna', String(r2.guardadas))
  ok(r2.repetidas === 3, 'las tres figuran como repetidas', String(r2.repetidas))
  ok(r2.unidadesNuevas === 0, 'y no se crean unidades de más')
  const total = deck.listUnidades(importada.id).flatMap((u) => deck.listCards(u.id)).length
  ok(total === 3, 'la biblioteca sigue con tres tarjetas', String(total))

  seccion('7 · Choque de nombre: las dos salidas')

  ok(mazo.materiaConEseNombre('Anatomía', carreraDePrueba()) === importada.id, 'se detecta la materia que ya existe')
  ok(mazo.materiaConEseNombre('anatomía', carreraDePrueba()) === importada.id, 'sin importar mayúsculas ni minúsculas')
  ok(mazo.materiaConEseNombre('Química', carreraDePrueba()) === null, 'y no inventa una que no está')

  /* Salida A: fusionar. Una ampliación con una unidad nueva y una tarjeta nueva. */
  const ampliacion = mazo.parsear(
    JSON.stringify({
      formato: 'flashcards-mazo',
      version: 1,
      materia: 'Anatomía',
      exportadoEn: 0,
      unidades: [{ nombre: 'Unidad 3 — Músculos', tarjetas: [{ frente: '¿Cuántos músculos hay?', dorso: 'Más de 600.' }] }]
    })
  )
  const r3 = mazo.importar(ampliacion, importada.id, carreraDePrueba())
  ok(r3.fusionada, 'la ampliación se agrega a la materia que ya estaba')
  ok(deck.listMaterias().length === 1, 'y no aparece una segunda "Anatomía"', `${deck.listMaterias().length} materia(s)`)
  ok(deck.listUnidades(importada.id).length === 3, 'ahora tiene tres unidades')

  /* Salida B: aparte. El mismo mazo, pero eligiendo separar. */
  const r4 = mazo.importar(ampliacion, null, carreraDePrueba())
  ok(deck.listMaterias().length === 2, 'eligiendo separar, aparece una materia nueva')
  ok(r4.materiaNombre !== 'Anatomía', 'con un nombre que no choca', r4.materiaNombre)
  ok(!r4.fusionada, 'y no figura como fusión')

  seccion('8 · El nombre del archivo')

  ok(mazo.nombreDeArchivo('Anatomía').endsWith('.mazo.json'), 'termina en .mazo.json', mazo.nombreDeArchivo('Anatomía'))
  const sucio = mazo.nombreDeArchivo('Derecho: Civil / Penal *2024*')
  ok(!/[<>:"/\\|?*]/.test(sucio), 'sin los caracteres que Windows no acepta en una ruta', sucio)
  ok(mazo.nombreDeArchivo('   ').length > 5, 'un nombre vacío igual da un archivo válido', mazo.nombreDeArchivo('   '))

  seccion('9 · Un mazo para vender: fuente, tipo, renglones y carrera')

  /*
   * El caso que manda este archivo: el autor arma un mazo de Farmacología, se lo
   * manda al comprador y el comprador lo importa. Antes viajaban sólo frente y
   * dorso: la fuente de cada dosis se perdía y los renglones del dorso llegaban
   * aplastados en un párrafo. Acá se prueba la ida y la vuelta con lo que importa.
   */
  for (const x of deck.listMaterias()) deck.deleteMateria(x.id)
  const carreraMed = deck.createCarrera('Medicina QA')
  const mv = deck.createMateria(carreraMed.id, 'Farmacología Cardiovascular')
  const uv = deck.createUnidad(mv.id, 'Unidad 2 — Diuréticos')
  const DORSO = 'En el asa de Henle.\nInhibe el cotransportador Na-K-2Cl.'
  const FUENTE = 'Goodman & Gilman, 13.a ed., pág. 452'
  deck.saveCards(uv.id, [
    { frente: 'Furosemida: ¿dónde actúa?', dorso: DORSO, tipo: 'atomo', fuente: FUENTE },
    { frente: 'Espironolactona: ¿qué se vigila?', dorso: 'El potasio.\nPuede subir.', tipo: 'bandera' }
  ])

  const archivoV = mazo.exportarMateria(mv.id)
  const tV = archivoV.unidades[0].tarjetas
  const furo = tV.find((t) => t.frente.startsWith('Furosemida'))
  const espiro = tV.find((t) => t.frente.startsWith('Espironolactona'))
  ok(furo?.fuente === FUENTE, 'el archivo lleva la fuente de la tarjeta', String(furo?.fuente))
  ok(furo?.tipo === 'atomo', 'y su tipo', String(furo?.tipo))
  ok(Boolean(espiro) && !('fuente' in (espiro as object)), 'y no inventa una fuente donde no la había')
  ok(archivoV.carrera === 'Medicina QA', 'y dice para qué carrera se armó', String(archivoV.carrera))

  const vueltaV = mazo.parsear(JSON.stringify(archivoV))
  ok(vueltaV.unidades[0].tarjetas.some((t) => t.dorso === DORSO), 'los renglones del dorso sobreviven la lectura del archivo')

  deck.deleteMateria(mv.id)
  const carreraEnf = deck.createCarrera('Enfermería QA')
  const rV = mazo.importar(vueltaV, null, carreraEnf.id)
  const importadasV = deck.listUnidades(rV.materiaId).flatMap((u) => deck.listCards(u.id))
  ok(importadasV.some((c) => c.fuente === FUENTE), 'al importar, la tarjeta guarda su fuente')
  ok(importadasV.some((c) => c.dorso === DORSO), 'y su dorso en renglones, igual que se exportó')
  ok(importadasV.some((c) => c.tipo === 'bandera'), 'y su tipo')
  ok(deck.getMateria(rV.materiaId)?.carreraId === carreraEnf.id, 'y queda en la carrera elegida, no en la que dice el archivo')

  let mensaje = ''
  try {
    mazo.parsear(JSON.stringify({ ...archivoV, unidades: [{ nombre: 'U', tarjetas: [{ frente: 'f', dorso: 'x'.repeat(1201) }] }] }))
  } catch (e) {
    mensaje = (e as Error).message
  }
  ok(/1201 caracteres/.test(mensaje), 'un dorso más largo del que se guarda se rechaza diciendo cuánto mide, no se recorta', mensaje)

  const tipoRaro = mazo.parsear(
    JSON.stringify({ ...archivoV, unidades: [{ nombre: 'U', tarjetas: [{ frente: 'f', dorso: 'd', tipo: 'inventado' }] }] })
  )
  ok(!('tipo' in tipoRaro.unidades[0].tarjetas[0]), 'un tipo que la app no conoce se descarta sin rechazar el mazo')

  const viejo = { formato: 'flashcards-mazo', version: 1, materia: 'Vieja', exportadoEn: 0, unidades: [{ nombre: 'U', tarjetas: [{ frente: 'f', dorso: 'd' }] }] }
  ok(mazo.parsear(JSON.stringify(viejo)).materia === 'Vieja', 'un archivo de antes, sin fuente ni carrera, sigue entrando')

  const CITA = 'Goodman & Gilman, 13.a ed. (Brunton, 2019), pág. 15 ' + '(lo que dice esa página sobre el transporte) '.repeat(12)
  const uc = deck.createUnidad(rV.materiaId, 'Unidad con cita larga')
  deck.saveCards(uc.id, [{ frente: 'Una tarjeta con una cita larguísima', dorso: 'd', fuente: CITA }])
  const guardada = deck.listCards(uc.id)[0]?.fuente ?? ''
  ok(
    guardada.length <= deck.LARGO_MAXIMO.fuente && guardada.endsWith('…') && guardada.startsWith('Goodman & Gilman, 13.a ed. (Brunton, 2019), pág. 15'),
    'una cita larga se recorta en una palabra, con puntos suspensivos, y conserva libro y página',
    `…${guardada.slice(-30)} (${guardada.length})`
  )
  ok(!/\s…$/.test(guardada), 'sin un espacio colgando antes de los puntos suspensivos')

  seccion('10 · El script que arma mazos para vender')

  /* eslint-disable-next-line @typescript-eslint/no-var-requires */
  const armar = require('../scripts/armar-mazo.mjs') as {
    LARGOS: { frente: number; dorso: number }
    armarMazos: (
      entrada: unknown,
      opciones?: { materia?: string | null; carrera?: string | null }
    ) => { mazos: unknown[]; problemas: string[] }
  }
  ok(
    armar.LARGOS.frente === deck.LARGO_MAXIMO.frente && armar.LARGOS.dorso === deck.LARGO_MAXIMO.dorso,
    'el script controla con los mismos topes que usa la app para guardar',
    JSON.stringify(armar.LARGOS)
  )

  const lote = [
    {
      carrera: 'Medicina',
      materia: 'Farmacología Cardiovascular',
      unidad: 'Unidad 2 — Diuréticos',
      tarjetas: [{ frente: 'Furosemida', dorso: 'Asa de Henle.\r\nDa hipopotasemia.', tipo: 'atomo', fuente: 'Goodman &amp; Gilman, pág. 452', estado: 'verificada' }]
    },
    { carrera: 'Medicina', materia: 'Farmacología Cardiovascular', unidad: 'Unidad 1 — Antihipertensivos', tarjetas: [{ frente: 'Enalapril', dorso: 'IECA.', tipo: 'familia' }] },
    { carrera: 'Medicina', materia: 'Otra materia', unidad: 'Unidad 1', tarjetas: [{ frente: 'x', dorso: 'y' }] }
  ]
  const armado = armar.armarMazos(lote, { materia: 'Farmacología Cardiovascular' })
  ok(armado.problemas.length === 0 && armado.mazos.length === 1, 'arma un solo mazo, el de la materia pedida', armado.problemas.join(' | '))

  const leido = mazo.parsear(JSON.stringify(armado.mazos[0]))
  ok(leido.unidades[0].nombre.startsWith('Unidad 1') && leido.unidades[1].nombre.startsWith('Unidad 2'), 'con las unidades ordenadas por número')
  ok(leido.carrera === 'Medicina', 'y la carrera que dice el lote', String(leido.carrera))
  const diur = leido.unidades[1].tarjetas[0]
  ok(diur.fuente === 'Goodman & Gilman, pág. 452', 'la app lee la fuente que armó el script, ya sin "&amp;"', String(diur.fuente))
  ok(diur.dorso === 'Asa de Henle.\nDa hipopotasemia.', 'y el dorso en renglones', JSON.stringify(diur.dorso))

  const largo = armar.armarMazos([{ materia: 'M', unidad: 'Unidad 1', tarjetas: [{ frente: 'f', dorso: 'x'.repeat(1201) }] }])
  ok(largo.problemas.some((p) => p.includes('1201')), 'un dorso demasiado largo frena el script y dice cuál es', largo.problemas.join(' | '))

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log(
    fallas === 0 ? `  ✅ ${pruebas}/${pruebas} comprobaciones pasaron.` : `  ❌ ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`
  )
  console.log('══════════════════════════════════════════════════════════════\n')
  process.exit(fallas === 0 ? 0 : 1)
}

try {
  main()
} catch (e) {
  console.error('\n  se cortó:', (e as Error)?.message ?? e)
  process.exit(1)
}
