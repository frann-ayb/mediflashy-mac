/**
 * Bonus: el mapa de autores de la carrera.
 *
 * Misma imprenta y mismo formato que el resto de las guías; ver
 * `bonus-doc-parejas.mjs` para el porqué de la separación.
 */
import { MAPA_DE_AUTORES, TOTAL_AUTORES } from './bonus-autores.mjs'

export function bonusAutores() {
  return {
    titulo: 'El mapa de autores',
    kicker: `Bonus · ${TOTAL_AUTORES} autores de la carrera`,
    bajada:
      'Quién es quién, qué aportó cada uno y con qué concepto se lo tiene que asociar. Una carilla por materia, para mirar antes de entrar al final.',
    pie: 'Bonus que viene con Psicoflashy',
    secciones: [
      {
        titulo: 'Cómo se usa',
        bloques: [
          {
            t: 'p',
            x: 'El error más caro de un final oral no es no saber un concepto: es **atribuírselo al autor equivocado**. Decir que la zona de desarrollo próximo es de Piaget, o el apego de Spitz, te tira abajo una respuesta que por lo demás estaba bien.'
          },
          {
            t: 'p',
            x: 'La última columna es la que importa. Son las palabras que, cuando aparecen en una pregunta, tienen que traerte el nombre sin pensarlo. Leé de derecha a izquierda: **concepto → autor**, que es la dirección en la que se toma.'
          },
          {
            t: 'aviso',
            titulo: 'Todos aparecen en las tarjetas',
            x: `Los ${TOTAL_AUTORES} de esta lista se sacaron contando quién aparece en las 1.507 tarjetas de la app. No hay ninguno de relleno: si está acá, hay tarjetas suyas adentro para estudiarlo en serio.`
          }
        ]
      },
      ...MAPA_DE_AUTORES.map((m) => ({
        titulo: m.materia,
        bloques: [
          {
            t: 'tabla',
            cab: ['Autor', 'Cuándo', 'Qué aportó', 'Se lo asocia con'],
            filas: m.autores
          }
        ]
      })),
      {
        titulo: 'Y ahora',
        bloques: [
          {
            t: 'cierre',
            titulo: 'El mapa no reemplaza el estudio',
            x: [
              'Este PDF te ubica. Te dice dónde va cada uno y con qué se lo asocia, y eso alcanza para no mezclarlos.',
              'Lo que **no** hace es tomártelo. Para eso están las 1.507 tarjetas de la app, que te van a preguntar por estos mismos autores el día que estés por olvidarlos.'
            ]
          }
        ]
      }
    ]
  }
}
