/**
 * Bonus: las parejas de conceptos que se confunden.
 *
 * Escrito en el mismo formato que las guías para que salga por la misma
 * imprenta (`make-pdfs.mjs`): hereda portada, tipografía, pie numerado y los
 * colores de la app sin una línea de CSS nueva.
 *
 * Va en su propio archivo, separado del mapa de autores, porque los dos bonus
 * se generan de fuentes distintas y conviene poder tocar uno sin recompilar el
 * otro.
 */
import { PAREJAS_POR_MATERIA, TOTAL_PAREJAS } from './bonus-parejas.mjs'

export function bonusParejas() {
  return {
    titulo: 'Las parejas que se confunden',
    kicker: `Bonus · ${TOTAL_PAREJAS} pares de conceptos`,
    bajada:
      'Los conceptos que se parecen tanto que en el examen se mezclan. No son definiciones sueltas: cada uno está puesto al lado del que se le parece, que es la única forma de que dejen de confundirse.',
    pie: 'Bonus que viene con Psicoflashy',
    secciones: [
      {
        titulo: 'Cómo se usa',
        bloques: [
          {
            t: 'p',
            x: 'En Psicología casi nada se pregunta solo. Se pregunta **contra otra cosa**: qué distingue la ilusión de la alucinación, la represión de la negación, la asimilación de la acomodación. El que estudió cada concepto por separado sabe los dos y aun así falla, porque nunca los vio juntos.'
          },
          {
            t: 'p',
            x: 'Esta lista los pone juntos. Tapá la respuesta con la mano, contestá en voz alta y recién ahí destapá. Si leés las dos columnas de corrido no sirve de nada: **reconocer no es saber**, y en el final no vas a tener la hoja delante.'
          },
          {
            t: 'aviso',
            titulo: 'Están todas adentro de la app',
            x: `Estas ${TOTAL_PAREJAS} salieron de las 1.507 tarjetas que Psicoflashy trae cargadas: son las que contrastan dos conceptos. Este PDF es para llevar en el celular o imprimir; el repaso de verdad, el que decide cuál te toca hoy, lo hace la app.`
          }
        ]
      },
      ...PAREJAS_POR_MATERIA.map((m) => ({
        titulo: m.materia,
        bloques: [{ t: 'defs', x: m.parejas }]
      })),
      {
        titulo: 'Y ahora',
        bloques: [
          {
            t: 'cierre',
            titulo: 'Esto es la punta',
            x: [
              `Estas ${TOTAL_PAREJAS} son las que entran en un PDF. En la app hay 1.507 tarjetas de las mismas 14 materias, y encima podés cargar tus propios apuntes para que te arme las de tu cátedra.`,
              'La diferencia no es la cantidad. Es que la app **se acuerda de cuáles fallaste** y te las vuelve a poner adelante justo antes de que se te borren. Un PDF no puede hacer eso.'
            ]
          }
        ]
      }
    ]
  }
}
