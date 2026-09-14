/**
 * Bonus: el mapa de los grupos farmacológicos, por sufijo.
 *
 * Misma imprenta que el resto de las guías (ver `bonus-doc-autores.mjs` para
 * el porqué de la separación entre datos y armado del documento).
 */
import { APP_NAME } from './user-docs.mjs'
import { GRUPOS_POR_SISTEMA, TOTAL_GRUPOS } from './mapa-grupos.mjs'

export function bonusMapaGrupos() {
  return {
    titulo: 'El mapa de los grupos',
    kicker: `Bonus · ${TOTAL_GRUPOS} grupos farmacológicos por sufijo`,
    bajada:
      'Qué termina en «-olol», en «-pril», en «-sartán»: por dónde actúa cada grupo, para qué se indica y el efecto adverso que se toma siempre.',
    pie: `Bonus que viene con ${APP_NAME}`,
    secciones: [
      {
        titulo: 'Cómo se usa',
        bloques: [
          {
            t: 'p',
            x: 'Farmacología no se aprueba memorizando fármacos sueltos: se aprueba reconociendo el **grupo** al que pertenece cada uno. Si sabés que "-pril" es un IECA, no necesitás haber estudiado el ramipril en particular para saber que probablemente da tos seca y que hay que vigilar el potasio.'
          },
          {
            t: 'p',
            x: 'Tapá las últimas tres columnas, mirá sólo el sufijo y los ejemplos, y contestá de memoria: mecanismo, para qué se usa, y el efecto adverso que se toma siempre. Recién ahí destapá y comprobá.'
          },
          {
            t: 'aviso',
            tono: 'ojo',
            titulo: 'Misma terminación, grupo distinto',
            x: 'Gentamicina y azitromicina terminan las dos en "-micina", y no tienen nada que ver entre sí: la primera es un **aminoglucósido** (bloquea la síntesis proteica bacteriana en la subunidad 30S, y es la que da ototoxicidad y nefrotoxicidad); la segunda es un **macrólido** (bloquea la subunidad 50S, y su efecto adverso característico es el digestivo, por el mismo receptor que usa la motilina). El sufijo ayuda, pero no reemplaza saber a qué familia pertenece cada fármaco.'
          },
          {
            t: 'aviso',
            titulo: 'Grupos sin un sufijo confiable',
            x: 'No todos los grupos tienen una terminación única: los antidepresivos ISRS (fluoxetina, sertralina, citalopram, escitalopram) no comparten sufijo, y tampoco los opioides ni los antihistamínicos. Ahí no hay atajo: esos se estudian uno por uno, y es justo lo que hacen las tarjetas de la app.'
          }
        ]
      },
      ...GRUPOS_POR_SISTEMA.map((s) => ({
        titulo: s.sistema,
        bloques: [
          {
            t: 'tabla',
            cab: ['Sufijo', 'Ejemplos', 'Mecanismo', 'Se usa para', 'Ojo con'],
            filas: s.grupos
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
              'Este PDF te ubica: te dice a qué familia pertenece un fármaco que no estudiaste todavía, y con eso alcanza para no llegar en blanco.',
              'Lo que **no** hace es tomártelo. Eso lo hace la app: varios de estos grupos ya están en las unidades cargadas, y el resto lo vas viendo a medida que cursás, con la repetición espaciada decidiendo cuándo te toca repasar cada uno.'
            ]
          }
        ]
      }
    ]
  }
}
