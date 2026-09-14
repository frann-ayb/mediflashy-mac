import { app } from 'electron'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
 * Arnés de datos: el CRUD de los tres niveles contra el disco de verdad.
 *
 * Corre adentro de Electron porque `paths.ts` usa `app.getPath()`. Se apunta
 * `userData` a una carpeta temporal ANTES de importar nada del código de la app:
 * los módulos cachean `dataRoot()` en la primera llamada, así que si se importaran
 * primero, el arnés escribiría en la carpeta real del usuario.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-qa-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const deck = require('../src/main/services/deckStore') as typeof import('../src/main/services/deckStore')
const { search } = require('../src/main/services/searchIndex') as typeof import('../src/main/services/searchIndex')
const stats = require('../src/main/services/stats') as typeof import('../src/main/services/stats')
const { unitsDir, dataRoot } = require('../src/main/services/core/paths') as typeof import('../src/main/services/core/paths')
const { logger } = require('../src/main/services/core/logger') as typeof import('../src/main/services/core/logger')

let fallas = 0
let pruebas = 0

function ok(condicion: boolean, que: string, detalle = ''): void {
  pruebas++
  if (condicion) {
    console.log(`  ✓ ${que}`)
  } else {
    fallas++
    console.error(`  ✗ ${que}${detalle ? ` — ${detalle}` : ''}`)
  }
}

function seccion(titulo: string): void {
  console.log(`\n${titulo}`)
}

function correr(): void {
  logger.init(join(raiz, 'logs'))
  deck.load()

  /* ------------------------------- crear --------------------------------- */

  seccion('Crear la jerarquía')

  const anatomia = deck.createMateria(carreraDePrueba(), 'Anatomía I: cabeza y cuello')
  ok(anatomia.id.length > 0, 'se crea una materia')
  ok(anatomia.nombre === 'Anatomía I cabeza y cuello', 'un nombre con ":" se limpia sin destruirse', anatomia.nombre)
  ok(deck.getCarrera(anatomia.carreraId)?.ritmo === 'normal', 'la carrera arranca en ritmo normal')

  const u1 = deck.createUnidad(anatomia.id, 'Unidad 1 — Osteología')
  const u2 = deck.createUnidad(anatomia.id, 'Unidad 2 — Músculos')
  ok(deck.listUnidades(anatomia.id).length === 2, 'las dos unidades quedan en la materia')
  ok(u1.orden === 0 && u2.orden === 1, 'el orden se asigna solo, incremental')

  const c1 = deck.createCard(u1.id, 'Hueso frontal', 'Forma la frente y el techo de las órbitas.')
  deck.createCard(u1.id, 'Hueso occipital', 'Cierra la parte posterior e inferior del cráneo.')
  deck.createCard(u2.id, 'Músculo temporal', 'Eleva la mandíbula. Se inserta en la apófisis coronoides.')
  ok(deck.listCards(u1.id).length === 2, 'las tarjetas van a su unidad')
  ok(deck.listCards(u2.id).length === 1, 'y no se mezclan con las de otra')

  /* ------------------------------ el archivo ------------------------------ */

  seccion('Cómo queda en el disco')

  const archivos = readdirSync(unitsDir()).filter((n) => n.endsWith('.json'))
  ok(archivos.length === 2, 'un archivo JSON por unidad')
  ok(archivos.includes(`${u1.id}.json`), 'el archivo se llama por el ID, no por el nombre')
  ok(
    !archivos.some((n) => n.includes('Osteología')),
    'el nombre de la unidad NO aparece en el nombre del archivo'
  )
  ok(existsSync(join(dataRoot(), 'materias.json')), 'el índice de materias existe')

  const enDisco = JSON.parse(readFileSync(join(unitsDir(), `${u1.id}.json`), 'utf8'))
  ok(enDisco.materiaId === anatomia.id, 'la unidad guarda a qué materia pertenece')
  ok(enDisco.tarjetas[0].materiaId === undefined, 'la TARJETA no guarda materiaId (se deriva de la unidad)')

  /* ------------------------------- renombrar ------------------------------ */

  seccion('Renombrar')

  const antesDelRename = readdirSync(unitsDir()).sort().join()
  deck.renameUnidad(u1.id, 'Unidad 1 — Huesos del cráneo')
  ok(deck.getUnidad(u1.id)?.nombre === 'Unidad 1 — Huesos del cráneo', 'el nombre cambia')
  ok(readdirSync(unitsDir()).sort().join() === antesDelRename, 'renombrar NO mueve ningún archivo')
  ok(deck.listCards(u1.id).length === 2, 'y no se pierde ninguna tarjeta')

  /* -------------------------------- editar -------------------------------- */

  seccion('Editar una tarjeta no toca su progreso')

  const { grade } = require('../src/main/services/scheduler') as typeof import('../src/main/services/scheduler')
  deck.saveSchedule(u1.id, c1.id, grade(c1.schedule, 'si'))
  const conProgreso = deck.listCards(u1.id).find((c) => c.id === c1.id)!
  const dueAntes = conProgreso.schedule.due
  ok(conProgreso.schedule.reps === 1, 'calificar suma un repaso')

  deck.updateCard(u1.id, c1.id, 'Hueso frontal', 'Forma la frente y el techo de las órbitas. Se articula con el etmoides.')
  const editada = deck.listCards(u1.id).find((c) => c.id === c1.id)!
  ok(editada.schedule.due === dueAntes, 'editar el texto NO cambia cuándo toca repasarla')
  ok(editada.schedule.reps === 1, 'ni pierde los repasos hechos')
  ok(editada.dorso.includes('etmoides'), 'pero el texto sí cambió')

  deck.resetProgress(u1.id, c1.id)
  const reiniciada = deck.listCards(u1.id).find((c) => c.id === c1.id)!
  ok(reiniciada.schedule.reps === 0 && reiniciada.schedule.state === 0, 'reiniciar el progreso sí la vuelve nueva')

  /* -------------------------------- buscar -------------------------------- */

  seccion('Buscar')

  ok(search({ texto: 'occipital' }).total === 1, 'encuentra por una palabra del frente')
  ok(search({ texto: 'mandíbula' }).total === 1, 'y por una palabra del dorso')
  ok(search({ texto: 'mandibula' }).total === 1, 'SIN TILDE encuentra lo mismo que con tilde')
  ok(search({ texto: 'MANDÍBULA' }).total === 1, 'y en mayúsculas también')
  ok(search({ texto: 'osteologia' }).total === 0, 'el nombre viejo de la unidad ya no matchea')
  ok(search({ texto: 'craneo' }).total === 2, 'busca también en el nombre de la unidad')
  ok(search({ texto: 'hueso occipital' }).total === 1, 'dos palabras son un AND, no un OR')
  ok(search({ texto: 'hueso inexistente' }).total === 0, 'si una de las dos no está, no hay resultado')
  ok(search({ texto: '', unidadId: u2.id }).total === 1, 'filtra por unidad')
  ok(search({ texto: '', estado: 'nuevas' }).total === 3, 'filtra por estado')

  /* ----------------------------- índice fresco ---------------------------- */

  seccion('El índice se mantiene fresco')

  deck.createCard(u2.id, 'Músculo masetero', 'Eleva la mandíbula. Es el más potente de la masticación.')
  ok(search({ texto: 'masetero' }).total === 1, 'una tarjeta nueva aparece enseguida en el buscador')

  const masetero = deck.listCards(u2.id).find((c) => c.frente.includes('masetero'))!
  deck.deleteCard(u2.id, masetero.id)
  ok(search({ texto: 'masetero' }).total === 0, 'y una borrada desaparece enseguida')

  /* --------------------------------- mover -------------------------------- */

  seccion('Mover')

  const paraMover = deck.listCards(u1.id)[1]
  deck.moveCard(u1.id, paraMover.id, u2.id)
  ok(deck.listCards(u1.id).length === 1, 'sale de la unidad de origen')
  ok(deck.listCards(u2.id).length === 2, 'y entra en la de destino')
  ok(
    deck.listCards(u2.id).some((c) => c.id === paraMover.id),
    'con el mismo id, así conserva su historial'
  )

  const fisica = deck.createMateria(carreraDePrueba(), 'Física')
  deck.moveUnidad(u2.id, fisica.id)
  ok(deck.listUnidades(anatomia.id).length === 1, 'la unidad sale de su materia')
  ok(deck.listUnidades(fisica.id).length === 1, 'y entra en la otra')
  ok(search({ texto: 'temporal' }).hits[0]?.materiaNombre === 'Física', 'el buscador ya la muestra en la materia nueva')

  /* -------------------------------- dominio ------------------------------- */

  seccion('El dominio se pondera por cantidad de tarjetas')

  const grande = deck.createUnidad(fisica.id, 'Grande')
  const chica = deck.createUnidad(fisica.id, 'Chica')
  for (let i = 0; i < 20; i++) deck.createCard(grande.id, `Concepto grande ${i}`, `Definición ${i}`)
  for (let i = 0; i < 2; i++) deck.createCard(chica.id, `Concepto chico ${i}`, `Definición ${i}`)

  // Las 2 de la unidad chica se llevan a un estado maduro artificialmente; las 20
  // de la grande quedan nuevas. El promedio simple de porcentajes daría ~50 %.
  for (const c of deck.listCards(chica.id)) {
    deck.saveSchedule(chica.id, c.id, { ...c.schedule, state: 2, stability: 60, reps: 5, due: Date.now() + 86_400_000 })
  }

  const dGrande = stats.dominioUnidad(grande.id)
  const dChica = stats.dominioUnidad(chica.id)
  const dMateria = stats.dominioMateria(fisica.id)

  ok(dGrande.porcentaje === 0, 'la unidad de 20 tarjetas nuevas da 0 %')
  ok(dChica.porcentaje === 100, 'la de 2 tarjetas maduras da 100 %')
  const promedioSimple = Math.round((dGrande.porcentaje + dChica.porcentaje) / 2)
  ok(
    dMateria.porcentaje < 20,
    `la materia da ${dMateria.porcentaje} % y no el ${promedioSimple} % del promedio simple`,
    `ponderado=${dMateria.porcentaje}`
  )

  /* ------------------------------- cascadas ------------------------------- */

  seccion('Borrado en cascada')

  const archivosAntes = readdirSync(unitsDir()).filter((n) => n.endsWith('.json')).length
  const unidadesDeFisica = deck.listUnidades(fisica.id).length
  const tarjetasDeFisica = deck.listUnidades(fisica.id).reduce((n, u) => n + u.tarjetas.length, 0)
  ok(tarjetasDeFisica === 24, 'Física tiene 24 tarjetas antes de borrarla', String(tarjetasDeFisica))

  deck.deleteMateria(fisica.id)
  ok(deck.getMateria(fisica.id) === null, 'la materia desaparece')
  ok(deck.listUnidades(fisica.id).length === 0, 'sus unidades también')
  ok(
    readdirSync(unitsDir()).filter((n) => n.endsWith('.json')).length === archivosAntes - unidadesDeFisica,
    'y sus archivos se borran del disco'
  )
  ok(search({ texto: 'masetero' }).total === 0 && search({ texto: 'Concepto grande' }).total === 0, 'el buscador ya no las encuentra')

  /* ------------------------- sobrevivir a un reinicio ---------------------- */

  seccion('Todo sobrevive a cerrar y abrir la app')

  const antesDeRecargar = {
    materias: deck.listMaterias().length,
    tarjetas: deck.allUnidades().reduce((n, u) => n + u.tarjetas.length, 0)
  }
  deck.load()
  ok(deck.listMaterias().length === antesDeRecargar.materias, 'las materias se releen del disco')
  ok(
    deck.allUnidades().reduce((n, u) => n + u.tarjetas.length, 0) === antesDeRecargar.tarjetas,
    'y las tarjetas también'
  )
  ok(search({ texto: 'frontal' }).total === 1, 'el índice se reconstruye solo después de recargar')

  /* ------------------------- archivos rotos y huérfanos -------------------- */

  seccion('Aguanta archivos rotos')

  writeFileSync(join(unitsDir(), 'roto.json'), '{ esto no es JSON válido', 'utf8')
  const huerfana = {
    version: 1,
    id: 'huerfana-0000',
    materiaId: 'una-materia-que-no-existe',
    nombre: 'Huérfana',
    orden: 0,
    createdAt: Date.now(),
    tarjetas: [
      {
        id: 'tarjeta-huerfana',
        frente: 'Sobreviví',
        dorso: 'a la inconsistencia',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        origen: 'manual',
        schedule: { due: Date.now(), stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, state: 0, lastReview: null }
      }
    ]
  }
  writeFileSync(join(unitsDir(), 'huerfana-0000.json'), JSON.stringify(huerfana), 'utf8')

  deck.load()
  ok(deck.listMaterias().length > 0, 'un JSON corrupto NO impide que la app arranque')
  const rescatada = deck.listMaterias().find((m) => m.nombre === 'Recuperadas')
  ok(rescatada !== undefined, 'una unidad sin materia se adopta en "Recuperadas"')
  ok(search({ texto: 'Sobreviví' }).total === 1, 'y sus tarjetas siguen siendo encontrables')

  /* --------------------------------- final -------------------------------- */

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  console.log(`   Carpeta de prueba: ${raiz}`)
  app.exit(fallas === 0 ? 0 : 1)
}

app.whenReady().then(correr, (err) => {
  console.error('El arnés no pudo arrancar:', err)
  app.exit(1)
})
