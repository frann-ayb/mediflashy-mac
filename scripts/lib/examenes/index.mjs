/**
 * Los 14 simulacros de final, uno por materia.
 *
 * Cada archivo hermano exporta un `EXAMEN` con la misma forma: 8 preguntas de
 * desarrollo con su respuesta modelo, 8 de opción múltiple con la correcta y el
 * porqué de cada distractor, y 4 de oral con la guía de lo que se espera.
 *
 * El orden es el de la carrera y NO el alfabético: el que busca su materia la
 * encuentra donde la espera, y el índice del PDF sale ordenado solo.
 */
import { EXAMEN as historia } from './historia.mjs'
import { EXAMEN as psicoanalisis1 } from './psicoanalisis-1.mjs'
import { EXAMEN as psicoanalisis2 } from './psicoanalisis-2.mjs'
import { EXAMEN as desarrollo } from './desarrollo.mjs'
import { EXAMEN as cognitiva } from './cognitiva.mjs'
import { EXAMEN as aprendizaje } from './aprendizaje.mjs'
import { EXAMEN as basesBiologicas } from './bases-biologicas.mjs'
import { EXAMEN as neuropsicologia } from './neuropsicologia.mjs'
import { EXAMEN as psicopatologia } from './psicopatologia.mjs'
import { EXAMEN as social } from './social.mjs'
import { EXAMEN as corrientes } from './corrientes.mjs'
import { EXAMEN as psicometria } from './psicometria.mjs'
import { EXAMEN as metodos } from './metodos.mjs'
import { EXAMEN as etica } from './etica.mjs'

export const EXAMENES = [
  historia,
  psicoanalisis1,
  psicoanalisis2,
  desarrollo,
  cognitiva,
  aprendizaje,
  basesBiologicas,
  neuropsicologia,
  psicopatologia,
  social,
  corrientes,
  psicometria,
  metodos,
  etica
]

/** Cuántas preguntas hay en total, sumando las tres secciones de las 14. */
export const TOTAL_PREGUNTAS = EXAMENES.reduce(
  (n, e) => n + e.desarrollo.length + e.multiple.length + e.oral.length,
  0
)
