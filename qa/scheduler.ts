import { app } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Schedule } from '@shared/types'

/**
 * La carrera donde viven las materias de estas pruebas.
 *
 * Existe porque la jerarquia paso a ser Carrera -> Materia -> Unidad y una
 * materia ya no puede crearse suelta. Se reusa la primera que haya para que dos
 * llamadas seguidas no dejen dos carreras de prueba.
 */
const carreraDePrueba = (): string => deck.listCarreras()[0]?.id ?? deck.createCarrera('Carrera de prueba').id


/**
 * Arnés del repaso: FSRS, los topes diarios y el ciclo de una sesión.
 *
 * Lo que se verifica acá es la promesa central del producto: que una tarjeta que
 * el usuario acierta se espacie, que una que falla vuelva pronto, y que nunca le
 * aparezcan doscientas juntas.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-qa-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const deck = require('../src/main/services/deckStore') as typeof import('../src/main/services/deckStore')
const sched = require('../src/main/services/scheduler') as typeof import('../src/main/services/scheduler')
const sesion = require('../src/main/services/studySession') as typeof import('../src/main/services/studySession')
const log = require('../src/main/services/reviewLog') as typeof import('../src/main/services/reviewLog')
const { logger } = require('../src/main/services/core/logger') as typeof import('../src/main/services/core/logger')
const { RITMO_SPECS } = require('@shared/types') as typeof import('@shared/types')

let fallas = 0
let pruebas = 0

function ok(condicion: boolean, que: string, detalle = ''): void {
  pruebas++
  if (condicion) console.log(`  ✓ ${que}`)
  else {
    fallas++
    console.error(`  ✗ ${que}${detalle ? ` — ${detalle}` : ''}`)
  }
}

const seccion = (t: string): void => console.log(`\n${t}`)
const dias = (ms: number): number => ms / 86_400_000

function correr(): void {
  logger.init(join(raiz, 'logs'))
  deck.load()
  log.init(() => new Set())

  const ahora = Date.UTC(2026, 8, 15, 12, 0, 0)

  /* ---------------------------------- FSRS --------------------------------- */

  seccion('FSRS programa como se espera')

  const nueva = sched.emptySchedule(ahora)
  ok(nueva.state === 0 && nueva.reps === 0, 'una tarjeta nueva arranca en cero')
  ok(sched.madurez(nueva) === 'nueva', 'y su madurez es "nueva"')
  ok(sched.fuerza(nueva) === 0, 'con fuerza 0')

  const sabida = sched.grade(nueva, 'si', ahora)
  const masOMenos = sched.grade(nueva, 'masomenos', ahora)
  const noSabida = sched.grade(nueva, 'no', ahora)

  ok(sabida.due > noSabida.due, '"la sabía" espacia más que "no la sabía"')
  ok(sabida.due >= masOMenos.due, '"la sabía" espacia al menos tanto como "más o menos"')
  ok(noSabida.due - ahora < 60 * 60 * 1000, '"no la sabía" la trae de vuelta en menos de una hora', `${Math.round((noSabida.due - ahora) / 60000)} min`)
  ok(sabida.reps === 1 && noSabida.reps === 1, 'cualquiera de las tres cuenta como un repaso')

  /* --------------------------- espaciado creciente -------------------------- */

  seccion('Acertar repetido espacia cada vez más')

  let s: Schedule = sched.emptySchedule(ahora)
  let t = ahora
  const intervalos: number[] = []
  for (let i = 0; i < 6; i++) {
    s = sched.grade(s, 'si', t)
    intervalos.push(dias(s.due - t))
    t = s.due
  }
  const creciente = intervalos.every((v, i) => i === 0 || v >= intervalos[i - 1])
  ok(creciente, 'cada acierto da un intervalo mayor o igual al anterior', intervalos.map((d) => d.toFixed(1)).join(' → '))
  ok(intervalos[intervalos.length - 1] > 20, 'después de 6 aciertos el intervalo pasa los 20 días', `${intervalos[intervalos.length - 1].toFixed(0)} d`)
  ok(sched.madurez(s) === 'aprendida', 'y la tarjeta ya cuenta como aprendida')
  ok(sched.fuerza(s) === 1, 'con fuerza máxima')

  /* -------------------------------- fallar --------------------------------- */

  seccion('Fallar una tarjeta madura la trae de vuelta')

  const olvidada = sched.grade(s, 'no', t)
  ok(olvidada.lapses === 1, 'cuenta como un olvido')
  ok(dias(olvidada.due - t) < 1, 'y vuelve a aparecer el mismo día', `${(dias(olvidada.due - t) * 24).toFixed(1)} h`)
  ok(sched.madurez(olvidada) === 'aprendiendo', 'vuelve al estado de aprendizaje')

  /* ------------------------------ determinismo ------------------------------ */

  seccion('El mismo camino da el mismo resultado')

  const caminoA = ['si', 'masomenos', 'si', 'no', 'si'] as const
  const correrCamino = (): Schedule => {
    let x = sched.emptySchedule(ahora)
    let cuando = ahora
    for (const g of caminoA) {
      x = sched.grade(x, g, cuando)
      cuando += 86_400_000
    }
    return x
  }
  const r1 = correrCamino()
  const r2 = correrCamino()
  ok(r1.stability === r2.stability && r1.difficulty === r2.difficulty, 'dos corridas idénticas dan la misma estabilidad')
  // El `due` puede diferir por el fuzz (±5 %), que es a propósito para desparejar
  // los vencimientos de un mazo generado de una sentada.
  ok(Math.abs(dias(r1.due - r2.due)) < dias(r1.due - ahora) * 0.15, 'el vencimiento sólo varía dentro del margen del fuzz')

  /* ------------------------------ la sesión -------------------------------- */

  seccion('La sesión de estudio')

  const materia = deck.createMateria(carreraDePrueba(), 'Historia')
  const unidad = deck.createUnidad(materia.id, 'Unidad 1')
  for (let i = 0; i < 8; i++) deck.createCard(unidad.id, `Pregunta ${i}`, `Respuesta ${i}`)

  let estado = sesion.start({ unidadId: unidad.id })
  ok(estado.actual !== null, 'arranca con una tarjeta')
  ok(estado.pendientes === 8, 'con las 8 tarjetas nuevas en la cola', String(estado.pendientes))
  ok(estado.actual?.esNueva === true, 'y la primera está marcada como nueva')

  const primera = estado.actual!.id
  estado = sesion.grade('no')
  ok(
    estado.pendientes === 8,
    'fallar una tarjeta NO la saca de la sesión: sigue habiendo 8 pendientes',
    String(estado.pendientes)
  )

  // Se recorre la cola hasta encontrarla de nuevo, calificando el resto con "sí".
  let volvio = false
  for (let i = 0; i < 12 && estado.actual; i++) {
    if (estado.actual.id === primera) {
      volvio = true
      break
    }
    estado = sesion.grade('si')
  }
  ok(volvio, 'la tarjeta fallada vuelve a aparecer antes de que termine la sesión')

  while (estado.actual) estado = sesion.grade('si')
  const cierre = sesion.end()
  ok(cierre.hechas >= 9, 'el resumen cuenta todas las respuestas, incluida la repetida', String(cierre.hechas))
  ok(cierre.noSabidas === 1, 'y distingue cuántas no sabía')
  ok(!sesion.isActive(), 'la sesión queda cerrada')

  /* ----------------------------- topes diarios ------------------------------ */

  /*
   * El tope es POR CARRERA, y el nombre viejo de esta sección ("por materia") era
   * la descripción de otro producto.
   *
   * Cuando la jerarquía ganó el nivel Carrera, el cupo subió con él, y tenía que
   * hacerlo: si el límite fuera por materia, abrir cinco materias multiplicaría
   * por cinco las tarjetas nuevas del día y la promesa de que nunca aparecen
   * doscientas juntas se caería sola. El cupo vive donde vive el ritmo, y el
   * ritmo lo elige el estudiante una vez para su carrera.
   *
   * Este bloque estrena su propia carrera a propósito. Las secciones de arriba ya
   * gastaron cupo del día en la carrera de prueba, y con el tope compartido eso
   * se descuenta —ésa era la razón real de las tres fallas del arnés viejo, que
   * seguía suponiendo que una materia nueva llegaba con el cupo entero—. Que el
   * cupo se comparta se prueba abajo, en un escenario armado para eso.
   */
  seccion('El tope diario por carrera')

  const carreraTope = deck.createCarrera('Carrera del tope').id
  deck.setRitmo(carreraTope, 'normal')

  const grande = deck.createMateria(carreraTope, 'Medicina')
  const uGrande = deck.createUnidad(grande.id, 'Bolilla 1')
  const cuantas = RITMO_SPECS.normal.nuevasPorDia + 15
  for (let i = 0; i < cuantas; i++) deck.createCard(uGrande.id, `Concepto ${i}`, `Definición ${i}`)

  const conTope = sesion.start({ materiaId: grande.id })
  ok(
    conTope.pendientes === RITMO_SPECS.normal.nuevasPorDia,
    `con ritmo Normal la sesión trae ${RITMO_SPECS.normal.nuevasPorDia} y no las ${cuantas}`,
    String(conTope.pendientes)
  )
  sesion.end()

  deck.setRitmo(carreraTope, 'intenso')
  const conIntenso = sesion.start({ materiaId: grande.id })
  ok(
    conIntenso.pendientes === Math.min(cuantas, RITMO_SPECS.intenso.nuevasPorDia),
    'subir el ritmo a Intenso trae más tarjetas en la misma sesión',
    String(conIntenso.pendientes)
  )

  // Se estudian 5 y se cierra: al reabrir, el cupo del día tiene que estar gastado.
  for (let i = 0; i < 5 && conIntenso.actual; i++) sesion.grade('si')
  sesion.end()

  const usadas = log.nuevasHoy(new Set([grande.id]))
  ok(usadas === 5, 'el historial registra las 5 nuevas que se vieron hoy', String(usadas))

  const segundaSesion = sesion.start({ materiaId: grande.id })
  ok(
    segundaSesion.nuevas === Math.min(cuantas, RITMO_SPECS.intenso.nuevasPorDia) - 5,
    'la segunda sesión del día descuenta lo que ya se estudió',
    `${segundaSesion.nuevas} nuevas`
  )
  sesion.end()

  /*
   * Y acá lo que el arnés viejo no podía ver, porque preguntaba por materia.
   *
   * Se vuelve a Normal para que el cupo sea el que ATA: quedan 20 − 5 = 15. La
   * materia hermana tiene 35 tarjetas sin ver, así que si el tope fuera por
   * materia la sesión traería 20. Trae 15, y esa diferencia es toda la prueba.
   */
  deck.setRitmo(carreraTope, 'normal')

  const hermana = deck.createMateria(carreraTope, 'Farmacología')
  const uHermana = deck.createUnidad(hermana.id, 'Bolilla 1')
  for (let i = 0; i < cuantas; i++) deck.createCard(uHermana.id, `Fármaco ${i}`, `Definición ${i}`)

  const enLaHermana = sesion.start({ materiaId: hermana.id })
  ok(
    enLaHermana.nuevas === RITMO_SPECS.normal.nuevasPorDia - 5,
    'abrir otra materia de la misma carrera NO renueva el cupo del día',
    `${enLaHermana.nuevas} nuevas`
  )
  sesion.end()

  /*
   * Y el reverso, que es la otra mitad de la promesa: otra CARRERA sí trae su
   * propio cupo. Quien cursa dos no arrastra a la segunda lo que gastó en la
   * primera, que es exactamente por qué el tope subió a este nivel y no más.
   */
  const otraCarrera = deck.createCarrera('Otra carrera').id
  deck.setRitmo(otraCarrera, 'normal')

  const ajena = deck.createMateria(otraCarrera, 'Anatomía')
  const uAjena = deck.createUnidad(ajena.id, 'Bolilla 1')
  for (let i = 0; i < cuantas; i++) deck.createCard(uAjena.id, `Hueso ${i}`, `Definición ${i}`)

  const enLaAjena = sesion.start({ materiaId: ajena.id })
  ok(
    enLaAjena.nuevas === RITMO_SPECS.normal.nuevasPorDia,
    'otra carrera arranca con el cupo del día entero',
    `${enLaAjena.nuevas} nuevas`
  )
  sesion.end()

  /* -------------------------------- el día --------------------------------- */

  seccion('El día empieza a las 4 de la mañana')

  // En hora LOCAL, no UTC: el corte de las 4 es el reloj de pared del usuario, que
  // es lo que él entiende por "hoy". Con `Date.UTC` la prueba mediría otra cosa.
  const local = (d: number, h: number, min = 0): number => new Date(2026, 8, d, h, min).getTime()

  ok(log.diaDe(local(16, 1, 30)) === log.diaDe(local(15, 23)), 'estudiar a la 1:30 AM cuenta como el día anterior')
  ok(log.diaDe(local(16, 5)) !== log.diaDe(local(15, 23)), 'y a las 5 AM ya es un día nuevo')
  ok(log.diaDe(local(16, 5)) - log.diaDe(local(15, 5)) === 1, 'dos días seguidos difieren en exactamente 1')
  ok(log.diaDe(local(15, 3, 59)) === log.diaDe(local(14, 12)), 'las 3:59 AM todavía son del día anterior')
  ok(log.diaDe(local(15, 4, 1)) === log.diaDe(local(15, 12)), 'y las 4:01 ya son del día nuevo')

  /* ---------------------------------- final -------------------------------- */

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  app.exit(fallas === 0 ? 0 : 1)
}

app.whenReady().then(correr, (err) => {
  console.error('El arnés no pudo arrancar:', err)
  app.exit(1)
})
