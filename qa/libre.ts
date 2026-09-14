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
 * Arnés del REPASO LIBRE y de las recomendaciones de estudio.
 *
 * ---------------------------------------------------------------------------
 * Qué se prueba acá y por qué importa tanto
 * ---------------------------------------------------------------------------
 *
 * El repaso libre existe para poder pasar una materia entera antes de un final
 * sin esperar a que el algoritmo lo permita. Toda su utilidad depende de UNA
 * promesa: que no toque el calendario. Si la rompe, es peor que no existir —
 * el usuario haría un repaso extra creyendo que ayuda y en realidad estaría
 * desordenándose los meses siguientes de estudio.
 *
 * Por eso la comprobación central no es "anduvo", es una foto byte a byte de
 * TODOS los `schedule` antes y después de una sesión libre completa. Si aparece
 * una sola diferencia, el arnés falla y dice en qué tarjeta y en qué campo.
 *
 *   npm run qa:libre
 */

const raiz = mkdtempSync(join(tmpdir(), 'psicoflashy-libre-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const deck = require('../src/main/services/deckStore') as typeof import('../src/main/services/deckStore')
const sesion = require('../src/main/services/studySession') as typeof import('../src/main/services/studySession')
const log = require('../src/main/services/reviewLog') as typeof import('../src/main/services/reviewLog')
const stats = require('../src/main/services/stats') as typeof import('../src/main/services/stats')
const { logger } = require('../src/main/services/core/logger') as typeof import('../src/main/services/core/logger')

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

const DIA = 86_400_000

/** Foto profunda de todos los `schedule`, por id de tarjeta. */
function fotoDeSchedules(): Map<string, string> {
  const foto = new Map<string, string>()
  for (const u of deck.allUnidades()) {
    for (const c of u.tarjetas) foto.set(c.id, JSON.stringify(c.schedule))
  }
  return foto
}

/** En qué se diferencian dos fotos. Vacío = idénticas. */
function diferencias(antes: Map<string, string>, despues: Map<string, string>): string[] {
  const out: string[] = []
  for (const [id, valor] of antes) {
    const ahora = despues.get(id)
    if (ahora === undefined) out.push(`${id.slice(0, 8)} desapareció`)
    else if (ahora !== valor) out.push(`${id.slice(0, 8)}: ${valor} → ${ahora}`)
  }
  for (const id of despues.keys()) if (!antes.has(id)) out.push(`${id.slice(0, 8)} apareció`)
  return out
}

/** Pasa una sesión entera contestando siempre lo mismo. Devuelve el resumen. */
function pasarSesionEntera(g: 'no' | 'masomenos' | 'si', now: number, tope = 2000): number {
  let vueltas = 0
  while (vueltas < tope) {
    const estado = sesion.grade(g, now)
    vueltas++
    if (estado.actual === null) break
  }
  return vueltas
}

function correr(): void {
  logger.init(join(raiz, 'logs'))
  deck.load()
  log.init(() => new Set())

  const lunes = new Date(2026, 8, 14, 10, 0, 0).getTime()

  /* ------------------------------ el escenario ----------------------------- */

  const psico = deck.createMateria(carreraDePrueba(), 'Psicopatología')
  const uSintomas = deck.createUnidad(psico.id, 'Unidad 1 — Semiología')
  const uCuadros = deck.createUnidad(psico.id, 'Unidad 2 — Cuadros clínicos')
  for (let i = 0; i < 12; i++) deck.createCard(uSintomas.id, `Síntoma ${i}`, `Definición ${i}`)
  for (let i = 0; i < 12; i++) deck.createCard(uCuadros.id, `Cuadro ${i}`, `Criterios ${i}`)

  // Ritmo tranquilo = 10 nuevas por día. Con 24 tarjetas, el tope se nota.
  deck.setRitmo(psico.carreraId, 'tranquilo')

  /* ------------------- lo que la sesión normal NO puede hacer --------------- */

  seccion('El caso que el repaso libre viene a resolver')

  const normal = sesion.start({ materiaId: psico.id }, lunes)
  ok(normal.libre === false, 'una sesión normal se declara como no libre')
  ok(normal.pendientes === 10, 'y el ritmo tranquilo la recorta a 10 tarjetas', `fueron ${normal.pendientes}`)

  pasarSesionEntera('si', lunes)
  const cierre = sesion.end()
  ok(cierre.hechas === 10, 'se contestan las 10', `contestó ${cierre.hechas}`)
  ok(cierre.libre === false, 'y el cierre también se declara no libre')

  // Mismo día, otra vez: el cupo ya se gastó.
  let seCorto = ''
  try {
    sesion.start({ materiaId: psico.id }, lunes + 60_000)
  } catch (e) {
    seCorto = (e as Error).message
  }
  ok(seCorto.includes('límite diario'), 'volver a estudiar el mismo día choca con el tope diario', seCorto)
  ok(seCorto.includes('repaso libre'), 'y el mensaje ofrece el repaso libre como salida', seCorto)

  /* ---------------------- el repaso libre sí puede ------------------------- */

  seccion('El repaso libre pasa todo, sin importar el tope ni el vencimiento')

  const libre = sesion.start({ materiaId: psico.id, libre: true }, lunes + 60_000)
  ok(libre.libre === true, 'la sesión se declara libre')
  ok(libre.pendientes === 24, 'y trae las 24 tarjetas de la materia', `trajo ${libre.pendientes}`)

  const soloUnidad = () => {
    sesion.end()
    return sesion.start({ unidadId: uCuadros.id, libre: true }, lunes + 60_000)
  }
  ok(soloUnidad().pendientes === 12, 'acotado a una unidad, trae sólo las 12 de esa unidad')

  /* ============================ LA COMPROBACIÓN ============================= */

  seccion('LO CENTRAL: un repaso libre completo no mueve un solo schedule')

  sesion.end()
  const antes = fotoDeSchedules()
  const retencionAntes = log.retencion(30, lunes + 120_000)

  const sesionLibre = sesion.start({ materiaId: psico.id, libre: true }, lunes + 120_000)
  ok(sesionLibre.pendientes === 24, 'arranca con las 24')

  // Se contesta de las tres formas, incluida la que en una sesión normal
  // reprograma más agresivamente.
  let n = 0
  while (n < 500) {
    const g = n % 3 === 0 ? 'no' : n % 3 === 1 ? 'masomenos' : 'si'
    const estado = sesion.grade(g as 'no' | 'masomenos' | 'si', lunes + 120_000)
    n++
    if (estado.actual === null) break
  }
  const resumenLibre = sesion.end()

  ok(resumenLibre.libre === true, 'el resumen se declara libre')
  ok(resumenLibre.hechas >= 24, `se contestaron todas y las repetidas (${resumenLibre.hechas})`)
  ok(resumenLibre.pendientesPorTope === 0, 'y no reporta nada pendiente por tope, porque no hay tope')

  const despues = fotoDeSchedules()
  const dif = diferencias(antes, despues)
  ok(dif.length === 0, 'NINGUNA tarjeta cambió su schedule', dif.slice(0, 3).join(' | '))

  /* ------------------- ni el cupo diario ni la retención ------------------- */

  seccion('Tampoco gasta el cupo del día ni ensucia la retención')

  ok(log.nuevasHoy(new Set([psico.id]), lunes + 120_000) === 10, 'las nuevas de hoy siguen siendo las 10 de la sesión normal', `${log.nuevasHoy(new Set([psico.id]), lunes + 120_000)}`)
  ok(log.repasosHoy(new Set([psico.id]), lunes + 120_000) === 0, 'y los repasos de hoy siguen en 0', `${log.repasosHoy(new Set([psico.id]), lunes + 120_000)}`)
  ok(log.retencion(30, lunes + 120_000) === retencionAntes, 'la retención no se movió')

  // La racha SÍ lo cuenta: el esfuerzo fue real.
  ok(log.racha(lunes + 120_000) === 1, 'pero la racha cuenta el día', `${log.racha(lunes + 120_000)}`)
  ok(log.totalHoy(lunes + 120_000) > 10, 'y "repasos hoy" incluye lo practicado', `${log.totalHoy(lunes + 120_000)}`)

  /* --------------- y al día siguiente todo sigue como debía ---------------- */

  seccion('Al día siguiente el calendario está intacto')

  const martes = lunes + DIA
  const alDiaSiguiente = sesion.start({ materiaId: psico.id }, martes)

  /*
   * Se miran las dos mitades por separado, y son dos pruebas distintas:
   *
   *  · 10 NUEVAS  →  el cupo de tarjetas nuevas del martes está entero. Si el
   *    repaso libre hubiera contado, acá habría menos (o ninguna).
   *  · 10 REPASOS →  son exactamente las 10 del lunes, que vencieron solas al
   *    día siguiente porque se contestaron "la sabía" y nada las movió después.
   *    Si el repaso libre hubiera tocado los schedules, este número sería otro:
   *    las respuestas fueron un tercio "no", que en una sesión normal las habría
   *    reprogramado para minutos y no para el día siguiente.
   *
   * O sea que el 10 y 10 no es una casualidad del escenario: es la huella de que
   * el calendario quedó como lo dejó la sesión del lunes.
   */
  ok(alDiaSiguiente.nuevas === 10, 'el martes el cupo de nuevas está entero: 10', `fueron ${alDiaSiguiente.nuevas}`)
  ok(
    alDiaSiguiente.repasos === 10,
    'y vencen las 10 del lunes, ni una más ni una menos',
    `vencieron ${alDiaSiguiente.repasos}`
  )
  ok(alDiaSiguiente.libre === false, 'y es una sesión normal')
  sesion.end()

  /* --------------------------- fallar en libre ----------------------------- */

  seccion('Fallar una tarjeta la trae de vuelta, pero no para siempre')

  const chica = deck.createMateria(carreraDePrueba(), 'Neuroanatomía')
  const uChica = deck.createUnidad(chica.id, 'Unidad 1')
  deck.createCard(uChica.id, 'Única', 'Respuesta')

  sesion.start({ unidadId: uChica.id, libre: true }, martes)
  let repeticiones = 0
  while (repeticiones < 20) {
    const estado = sesion.grade('no', martes)
    repeticiones++
    if (estado.actual === null) break
  }
  ok(repeticiones === 4, 'una tarjeta fallada vuelve 3 veces y después se deja ir', `volvió ${repeticiones - 1} vez/veces`)
  sesion.end()

  const fotoChica = fotoDeSchedules()
  ok(
    diferencias(antes, fotoChica).filter((d) => !d.includes('apareció')).length === 0,
    'y fallar cuatro veces en libre tampoco movió ningún schedule anterior'
  )

  /* -------------------------- las recomendaciones -------------------------- */

  seccion('Las recomendaciones: qué conviene estudiar ahora')

  const p = stats.progreso(null, martes)
  const porNombre = new Map(p.materias.map((m) => [m.materia.nombre, m]))

  const mPsico = porNombre.get('Psicopatología')!
  ok(mPsico.empezadas === 10, 'Psicopatología figura con 10 tarjetas empezadas', `${mPsico.empezadas}`)
  ok(mPsico.porcentajeEmpezadas !== null, 'y tiene un porcentaje sobre lo empezado')
  ok(mPsico.dominio.total === 24, 'sobre 24 en total')

  const mNeuro = porNombre.get('Neuroanatomía')!
  ok(mNeuro.empezadas === 0, 'Neuroanatomía no tiene nada empezado')
  ok(mNeuro.porcentajeEmpezadas === null, 'así que su porcentaje sobre lo empezado es null y no 0')
  ok(mNeuro.unidadFloja === null, 'y no se le señala ninguna unidad floja')

  const sinEmpezar = p.sugerencias.find((s) => s.motivo === 'sin-empezar')
  ok(
    sinEmpezar?.materiaNombre === 'Neuroanatomía',
    'se sugiere EMPEZAR Neuroanatomía, no "repasarla porque está floja"',
    sinEmpezar ? sinEmpezar.materiaNombre : 'no hubo sugerencia'
  )

  // Con tarjetas vencidas, eso manda sobre todo lo demás.
  const enUnMes = martes + 30 * DIA
  const conVencidas = stats.progreso(null, enUnMes)
  const primera = conVencidas.sugerencias[0]
  ok(primera?.motivo === 'vencidas', 'cuando hay vencidas, es la primera sugerencia', primera?.motivo ?? 'ninguna')
  ok(primera?.materiaNombre === 'Psicopatología', 'y apunta a la materia que las tiene')
  ok(primera !== undefined && primera.cantidad > 0, 'diciendo cuántas son')

  ok(
    conVencidas.sugerencias.filter((s) => s.materiaId === primera?.materiaId).length === 1,
    'una materia no se sugiere dos veces'
  )

  /* ---------------------------------- final -------------------------------- */

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  console.log(`   Carpeta de prueba: ${raiz}`)
  app.exit(fallas === 0 ? 0 : 1)
}

app.whenReady().then(correr, (err) => {
  console.error('El arnés no pudo arrancar:', err)
  app.exit(1)
})
