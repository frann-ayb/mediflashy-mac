import type { Dominio, Flashcard, MateriaResumen, Progreso, Sugerencia, UnidadResumen } from '@shared/types'
import { allUnidades, listMaterias, listUnidades, toUnidad } from './deckStore'
import { fuerza, isDue, madurez } from './scheduler'
import { racha, retencion, totalHoy } from './reviewLog'

/**
 * Cuánto sabe el usuario de cada cosa.
 *
 * ---------------------------------------------------------------------------
 * Qué mide el porcentaje
 * ---------------------------------------------------------------------------
 *
 * El promedio de la FUERZA de cada tarjeta, donde la fuerza es la estabilidad de
 * FSRS llevada a una escala de 0 a 1 (ver `scheduler.fuerza`). En criollo: qué
 * proporción del mazo está de verdad en la memoria de largo plazo.
 *
 * Se eligió esto sobre las dos alternativas obvias, y las dos se descartaron por
 * el mismo motivo — mienten en una dirección concreta:
 *
 *  · **Porcentaje de tarjetas acertadas la última vez.** Sube al 100 % apenas el
 *    usuario acierta una ronda, aunque las vaya a olvidar todas en tres días.
 *  · **Porcentaje de tarjetas maduras.** Es un escalón: la barra no se mueve
 *    durante semanas y después salta. Una barra que no se mueve mientras uno
 *    estudia todos los días desmotiva, y desmotivar es el peor bug posible en una
 *    app de repaso espaciado.
 *
 * ---------------------------------------------------------------------------
 * Por qué el promedio se pondera
 * ---------------------------------------------------------------------------
 *
 * El dominio de una materia NO es el promedio de los porcentajes de sus unidades:
 * es el promedio sobre TODAS sus tarjetas. Con una unidad de 200 tarjetas al 40 %
 * y otra de 6 al 100 %, el promedio simple daría 70 % y la verdad es 42 %. La
 * diferencia no es académica: el usuario decidiría que ya sabe la materia.
 *
 * Se logra solo, sin fórmula de ponderación, porque `dominioDe()` siempre recibe
 * la lista completa de tarjetas y nunca promedia porcentajes ya calculados.
 */

const VACIO: Dominio = {
  total: 0,
  nuevas: 0,
  aprendiendo: 0,
  repasando: 0,
  aprendidas: 0,
  vencidas: 0,
  porcentaje: 0
}

export function dominioDe(cards: Flashcard[], now = Date.now()): Dominio {
  if (cards.length === 0) return { ...VACIO }

  let nuevas = 0
  let aprendiendo = 0
  let repasando = 0
  let aprendidas = 0
  let vencidas = 0
  let suma = 0

  for (const c of cards) {
    switch (madurez(c.schedule)) {
      case 'nueva':
        nuevas++
        break
      case 'aprendiendo':
        aprendiendo++
        break
      case 'repasando':
        repasando++
        break
      case 'aprendida':
        aprendidas++
        break
    }
    // Una tarjeta nueva no está "vencida": nunca se vio, así que no hay nada que
    // recordar. Contarlas acá haría que el botón de estudiar diga "300 vencidas"
    // apenas se genera un mazo, que es alarmante y falso.
    if (madurez(c.schedule) !== 'nueva' && isDue(c.schedule, now)) vencidas++
    suma += fuerza(c.schedule)
  }

  return {
    total: cards.length,
    nuevas,
    aprendiendo,
    repasando,
    aprendidas,
    vencidas,
    porcentaje: Math.round((suma / cards.length) * 100)
  }
}

export function dominioUnidad(unidadId: string, now = Date.now()): Dominio {
  const u = allUnidades().find((x) => x.id === unidadId)
  return u ? dominioDe(u.tarjetas, now) : { ...VACIO }
}

export function unidadesConDominio(materiaId: string, now = Date.now()): UnidadResumen[] {
  return listUnidades(materiaId).map((u) => ({ unidad: toUnidad(u), dominio: dominioDe(u.tarjetas, now) }))
}

export function dominioMateria(materiaId: string, now = Date.now()): Dominio {
  // Se juntan TODAS las tarjetas de la materia y se calcula una sola vez. Ésta es
  // la línea que hace que la ponderación salga bien sin fórmula.
  const cards = allUnidades()
    .filter((u) => u.materiaId === materiaId)
    .flatMap((u) => u.tarjetas)
  return dominioDe(cards, now)
}

/* --------------------------- qué tengo más flojo -------------------------- */

/**
 * Cuánto sabe de lo que YA EMPEZÓ.
 *
 * Es el número honesto para responder "¿cuál tengo más floja?". El
 * `dominio.porcentaje` cuenta las nuevas como cero —correcto para medir cuánto
 * del mazo está en la memoria— pero convierte cualquier materia recién generada
 * en la más floja de todas, que es exactamente el consejo equivocado: no está
 * floja, está sin empezar, y lo que le hace falta es empezarla, no repasarla.
 */
function sobreEmpezadas(cards: Flashcard[]): { empezadas: number; porcentaje: number | null } {
  let vistas = 0
  let suma = 0
  for (const c of cards) {
    if (madurez(c.schedule) === 'nueva') continue
    vistas++
    suma += fuerza(c.schedule)
  }
  return { empezadas: vistas, porcentaje: vistas === 0 ? null : Math.round((suma / vistas) * 100) }
}

/**
 * Cuántas tarjetas empezadas tiene que tener una unidad para poder señalarla
 * como "la más floja".
 *
 * Sin este piso gana siempre la unidad donde el usuario abrió una sola tarjeta y
 * la falló: 0 % sobre una tarjeta. Señalar eso como su punto débil es ruido, y
 * peor, lo manda a estudiar donde no hay casi nada que estudiar.
 */
const MIN_PARA_SENALAR = 3

/**
 * A partir de qué porcentaje deja de tener sentido decir "esto lo tenés flojo".
 *
 * `fuerza` es estabilidad sobre 21 días, así que 60 % es un recuerdo que aguanta
 * unos doce días. Por encima de eso la materia no está floja: está andando, y
 * sugerir repasarla sería inventarle un problema al usuario para tener algo que
 * recomendarle.
 */
const UMBRAL_FLOJA = 60

/** Y cuántas tarjetas empezadas hacen falta para que el promedio signifique algo. */
const MIN_EMPEZADAS_MATERIA = 5

function unidadMasFloja(materiaId: string): MateriaResumen['unidadFloja'] {
  let mejor: MateriaResumen['unidadFloja'] = null
  for (const u of listUnidades(materiaId)) {
    const { empezadas, porcentaje } = sobreEmpezadas(u.tarjetas)
    if (empezadas < MIN_PARA_SENALAR || porcentaje === null) continue
    if (mejor === null || porcentaje < mejor.porcentaje) mejor = { id: u.id, nombre: u.nombre, porcentaje }
  }
  return mejor
}

/**
 * Qué conviene estudiar ahora, lo más urgente primero.
 *
 * Son tres preguntas distintas y por eso hay tres motivos, en este orden:
 *
 *  1. **vencidas** — lo que FSRS dice que toca hoy. Nada le gana: es la única
 *     recomendación que además evita perder lo ya aprendido.
 *  2. **floja** — la materia que peor tiene de lo que ya estudió. Ojo con esto:
 *     si no vence nada, la sesión normal no le va a mostrar nada, así que la
 *     única acción posible es un repaso libre. Recomendar "estudiá esto" y que
 *     al tocarlo diga "no hay nada para repasar" sería una recomendación rota.
 *  3. **sin-empezar** — dónde hay más material que todavía no tocó.
 *
 * Una materia aparece UNA sola vez: si tiene vencidas, ya se la nombró.
 */
function sugerenciasDe(materias: MateriaResumen[]): Sugerencia[] {
  const salida: Sugerencia[] = []
  const usadas = new Set<string>()

  const conVencidas = materias
    .filter((m) => m.dominio.vencidas > 0)
    .sort((a, b) => b.dominio.vencidas - a.dominio.vencidas)[0]

  if (conVencidas) {
    usadas.add(conVencidas.materia.id)
    salida.push({
      motivo: 'vencidas',
      carreraId: conVencidas.materia.carreraId,
      materiaId: conVencidas.materia.id,
      materiaNombre: conVencidas.materia.nombre,
      unidadId: null,
      unidadNombre: null,
      cantidad: conVencidas.dominio.vencidas,
      porcentaje: conVencidas.dominio.porcentaje
    })
  }

  const floja = materias
    .filter(
      (m) =>
        !usadas.has(m.materia.id) &&
        m.empezadas >= MIN_EMPEZADAS_MATERIA &&
        m.porcentajeEmpezadas !== null &&
        m.porcentajeEmpezadas < UMBRAL_FLOJA
    )
    .sort((a, b) => (a.porcentajeEmpezadas ?? 100) - (b.porcentajeEmpezadas ?? 100))[0]

  if (floja) {
    usadas.add(floja.materia.id)
    salida.push({
      motivo: 'floja',
      carreraId: floja.materia.carreraId,
      materiaId: floja.materia.id,
      materiaNombre: floja.materia.nombre,
      unidadId: floja.unidadFloja?.id ?? null,
      unidadNombre: floja.unidadFloja?.nombre ?? null,
      cantidad: floja.empezadas,
      porcentaje: floja.unidadFloja?.porcentaje ?? floja.porcentajeEmpezadas ?? 0
    })
  }

  const sinEmpezar = materias
    .filter((m) => !usadas.has(m.materia.id) && m.empezadas === 0 && m.dominio.total > 0)
    .sort((a, b) => b.dominio.total - a.dominio.total)[0]

  if (sinEmpezar) {
    salida.push({
      motivo: 'sin-empezar',
      carreraId: sinEmpezar.materia.carreraId,
      materiaId: sinEmpezar.materia.id,
      materiaNombre: sinEmpezar.materia.nombre,
      unidadId: null,
      unidadNombre: null,
      cantidad: sinEmpezar.dominio.total,
      porcentaje: 0
    })
  }

  return salida
}

/**
 * El panel de progreso, acotado a una carrera.
 *
 * `carreraId` en `null` calcula sobre TODO, que es lo que corresponde cuando el
 * estudiante eligio "mostrame todas". Pero el caso normal es con carrera, y no
 * es una comodidad: si el mazo trae la farmacologia de ocho carreras y el
 * progreso se calculara sobre todas, el estudiante de Enfermeria abriria la
 * pantalla y leeria "sabes el 11 %" — un numero que no significa nada, porque
 * el 89 % restante es contenido de carreras que no cursa. Peor todavia con las
 * sugerencias: le dirian que estudie farmacologia veterinaria.
 */
export function progreso(carreraId: string | null = null, now = Date.now()): Progreso {
  const suMateria = new Set(listMaterias(carreraId).map((m) => m.id))
  const todas = carreraId ? allUnidades().filter((u) => suMateria.has(u.materiaId)) : allUnidades()
  const global = dominioDe(
    todas.flatMap((u) => u.tarjetas),
    now
  )

  const materias: MateriaResumen[] = listMaterias(carreraId).map((materia) => {
    const suyas = todas.filter((u) => u.materiaId === materia.id)
    const cards = suyas.flatMap((u) => u.tarjetas)
    const { empezadas, porcentaje } = sobreEmpezadas(cards)
    return {
      materia,
      unidades: suyas.length,
      dominio: dominioDe(cards, now),
      empezadas,
      porcentajeEmpezadas: porcentaje,
      unidadFloja: empezadas === 0 ? null : unidadMasFloja(materia.id)
    }
  })

  return {
    global,
    materias,
    sugerencias: sugerenciasDe(materias),
    retencion30d: retencion(30, now),
    racha: racha(now),
    hoy: totalHoy(now)
  }
}

/** Los ids de todas las tarjetas vivas. Lo usa la compactación del historial. */
export function idsVivos(): Set<string> {
  const out = new Set<string>()
  for (const u of allUnidades()) for (const c of u.tarjetas) out.add(c.id)
  return out
}
