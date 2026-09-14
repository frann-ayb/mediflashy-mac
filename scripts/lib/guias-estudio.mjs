import { APP_NAME } from './user-docs.mjs'

/**
 * Las dos guías de estudio que van con los apuntes de regalo.
 *
 * Están separadas de `guias.mjs` —que trae las dos guías del producto— porque
 * hablan de otra cosa: no de cómo se usa la app sino de cómo se estudia. Se
 * entregan en la carpeta de bonus y tienen sentido incluso para alguien que use
 * otro programa.
 *
 * Mismo modelo de bloques y mismos dos dibujantes que el resto.
 */

/* ========================================================================== */
/*                    CÓMO ESTUDIAR CON REPASO ESPACIADO                      */
/* ========================================================================== */

export function guiaMetodo() {
  return {
    titulo: 'Cómo estudiar con repaso espaciado',
    kicker: 'La guía del método',
    bajada:
      'Se lee en diez minutos y te ahorra los tres errores que hacen que la mayoría abandone antes del primer mes.',
    pie: `Guía que viene con ${APP_NAME}`,
    secciones: [
      {
        titulo: 'Por qué funciona',
        bloques: [
          {
            t: 'p',
            x: 'Tu cerebro descarta lo que no volvés a usar. No es un defecto: es lo que le permite no ahogarse en información inútil. El problema es que no distingue entre «no lo usé» y «lo necesito para el final».'
          },
          { t: 'p', x: 'Hay dos cosas que revierten eso, y son las dos que hace esta app.' },
          {
            t: 'defs',
            x: [
              [
                'Recuperar, no releer',
                'Sacar la respuesta de tu cabeza sin ayuda deja una marca mucho más profunda que volver a pasar los ojos por el texto. Cuando releés, reconocés — y reconocer se siente igual que saber, pero no lo es. En el final no tenés la ficha de cátedra delante.'
              ],
              [
                'Espaciar',
                'Repasar algo justo cuando estás por olvidarlo lo fija mucho más que repasarlo cuando todavía lo tenés fresco. Por eso los repasos se van separando: uno al día siguiente, el próximo a los tres días, el próximo a la semana, y así.'
              ]
            ]
          },
          {
            t: 'aviso',
            titulo: 'No es una opinión',
            x: 'Una revisión de más de setecientos estudios (Dunlosky y otros, 2013) calificó a esas dos técnicas como las únicas de «alta utilidad» entre las diez que analizó. Subrayar y releer quedaron en la categoría más baja. Son las dos que hace todo el mundo.'
          }
        ]
      },

      {
        titulo: 'Cómo es una tarjeta que sirve',
        bloques: [
          { t: 'h', x: 'Una idea por tarjeta' },
          {
            t: 'contraste',
            etMal: 'Una tarjeta imposible',
            etBien: 'Tres tarjetas que sí',
            mal: [
              '**Frente:** Efectos adversos de los IECA',
              '**Dorso:** Tos seca, hiperpotasemia, deterioro de la función renal en estenosis bilateral de la arteria renal, angioedema, hipotensión de primera dosis…'
            ],
            bien: [
              '¿Por qué los IECA dan tos seca? → Porque se acumula bradicinina, que la ECA es la que degrada.',
              '¿Qué ion tiende a retenerse con un IECA? → El potasio, porque baja la aldosterona.',
              '¿Qué efecto adverso de los IECA obliga a suspender el fármaco? → El angioedema.'
            ]
          },
          {
            t: 'p',
            x: 'Una tarjeta con cinco datos adentro son cinco tarjetas que siempre vas a fallar juntas. Nunca vas a saber cuál de los cinco era el que no sabías.'
          },
          { t: 'h', x: 'Que la pregunta tenga una sola respuesta posible' },
          {
            t: 'contraste',
            mal: '¿Qué pasa con el primer paso hepático?',
            bien: '¿Qué le pasa a la biodisponibilidad de un fármaco con alto primer paso hepático si se da por vía oral?'
          },
          {
            t: 'p',
            x: 'Si al leer el frente no sabés qué te están preguntando, la tarjeta no sirve aunque el dorso esté perfecto.'
          },
          { t: 'h', x: 'Sin pistas involuntarias' },
          {
            t: 'p',
            x: 'Si todas tus tarjetas de una unidad empiezan con «Los β-bloqueantes…», vas a aprender a reconocer el grupo por el formato de la pregunta y no por el mecanismo. Cuando en el parcial te den el caso sin avisar de qué grupo se trata, que es como se toma, no lo vas a tener.'
          },
          { t: 'h', x: 'Ojo con los pares que se confunden' },
          {
            t: 'p',
            x: 'En Farmacología, media materia son pares que se parecen: heparina y warfarina, agonista y agonista parcial, antagonista competitivo y no competitivo, farmacocinética y farmacodinamia, enalapril y losartán. **Hacé una tarjeta que los contraste explícitamente**, no una para cada uno por separado: lo que falla en el examen no es la definición suelta, es cuál era cuál.'
          },
          {
            t: 'ficha',
            frente: '¿Cuál es la diferencia entre un antagonista competitivo y uno no competitivo?',
            dorso: 'Al competitivo lo desplaza subir la concentración del agonista, porque pelean el mismo sitio. Al no competitivo no, porque no compite por ese sitio.'
          }
        ]
      },

      {
        titulo: 'Cuántas generar',
        bloques: [
          { t: 'p', x: 'Como referencia: **entre 15 y 30 tarjetas por unidad de apunte**.' },
          {
            t: 'aviso',
            tono: 'alto',
            titulo: 'El error número uno de abandono',
            x: 'Si generás 200 tarjetas de una materia el primer día, en tres días vas a tener 200 repasos vencidos, vas a abrir la app, vas a ver el número y vas a cerrarla.'
          },
          {
            t: 'p',
            x: 'Mejor: **una unidad por vez**. Cuando esa unidad ya te sale, cargás la que sigue. Es más lento el primer día y muchísimo más rápido al mes.'
          },
          {
            t: 'p',
            x: 'El control de cantidad tiene tres posiciones. «Pocas» saca nada más que las ideas principales. «Normal» está en el medio y para una primera pasada suele ser lo correcto. «Exhaustiva» recorre el apunte entero buscando los temas uno por uno: saca alrededor del triple y tarda bastante más, así que conviene para la unidad que estás por rendir, no para probar.'
          }
        ]
      },

      {
        titulo: 'Los tres botones',
        bloques: [
          {
            t: 'defs',
            x: [
              ['No la sabía', 'No te salió, o dudaste tanto que en un examen no la habrías escrito. Vuelve enseguida.'],
              ['Más o menos', 'Te salió, pero te costó o te faltó una parte. Vuelve pronto, pero no hoy.'],
              ['La sabía', 'Te salió sin esfuerzo. Se va lejos en el tiempo.']
            ]
          },
          {
            t: 'p',
            x: 'El error más común es apretar «La sabía» por orgullo. La app no te está puntuando: está calculando cuándo mostrártela de nuevo. Si le mentís, te la va a mostrar cuando ya te la hayas olvidado, y el método deja de funcionar. **Sé duro con vos mismo** — es el único momento en que conviene.'
          }
        ]
      },

      {
        titulo: 'El repaso libre: cuándo sí y cuándo no',
        bloques: [
          {
            t: 'p',
            x: 'La app tiene un segundo modo, **Repaso libre**, que te pasa todas las tarjetas que quieras sin importar si vencen hoy, y **sin tocar tu calendario**. Es muy útil, y usado mal arruina el método.'
          },
          {
            t: 'tabla',
            cab: ['', 'Situación', 'Qué hacer'],
            filas: [
              ['Sí', 'Rendís en tres días y querés pasar la materia entera de corrido.', 'Repaso libre, las veces que quieras.'],
              ['Sí', 'Progreso dice que una unidad está floja pero hoy no te vence nada de ahí.', 'Repaso libre de esa unidad.'],
              ['Sí', 'Ya hiciste lo de hoy y te quedaron ganas.', 'Repaso libre, sin culpa: no descuenta nada de mañana.'],
              [
                'No',
                'Todos los días, en lugar de la sesión normal.',
                'Usá «Lo de hoy». El repaso libre no programa nada: si estudiás sólo así, tus tarjetas nunca se espacian y estás haciendo el método viejo con una app nueva.'
              ]
            ]
          },
          {
            t: 'aviso',
            tono: 'clave',
            titulo: 'La regla en una línea',
            x: '«Lo de hoy» construye la memoria. «Repaso libre» te tranquiliza antes de un examen. Necesitás las dos, en ese orden.'
          }
        ]
      },

      {
        titulo: 'Los tres errores que hacen abandonar',
        bloques: [
          { t: 'h', x: 'Primero: cargar todo el cuatrimestre en una semana' },
          { t: 'p', x: 'Ya explicado arriba. Una unidad por vez.' },
          { t: 'h', x: 'Segundo: saltear días' },
          {
            t: 'p',
            x: 'El sistema calcula sus fechas suponiendo que vas a aparecer. Tres días sin abrir la app y te encontrás una pila. **Diez minutos por día valen más que dos horas el domingo** — y no es una frase motivacional, es literalmente cómo funciona el algoritmo.'
          },
          { t: 'h', x: 'Tercero: no corregir las tarjetas malas' },
          {
            t: 'p',
            x: 'Si una tarjeta te la fallás cinco veces seguidas, casi nunca es que no la sabés: es que está mal escrita. Abrila y arreglala. Se edita desde la Biblioteca, y editarla **no** le borra el progreso.'
          }
        ]
      },

      {
        titulo: 'Una rutina que aguanta',
        bloques: [
          {
            t: 'lista',
            x: [
              'Todos los días, a la misma hora, abrís y hacés lo que te toca. Diez o quince minutos.',
              'Una vez por semana, cargás una unidad nueva.',
              'Cada tanto mirás **Progreso**: la lista viene ordenada de más floja a más firme y arriba te dice qué conviene hacer ahora. Esa es la que estudiás, no la que te gusta más.',
              'La racha sirve para una sola cosa: para que te dé lástima cortarla. Usala.'
            ]
          },
          { t: 'h', x: 'La semana antes de un final' },
          {
            t: 'pasos',
            x: [
              'Entrá a **Progreso** y mirá qué unidad de esa materia figura como la más floja.',
              'Hacé **lo de hoy** primero: eso mantiene el resto de las materias en orden.',
              'Después, **repaso libre** de la unidad floja, todas las veces que quieras. No gasta nada y no desordena nada.',
              'El día anterior, repaso libre de la materia entera, de corrido. Es la pasada que reemplaza a releer el apunte.'
            ]
          },
          {
            t: 'cierre',
            titulo: 'Lo único que hay que recordar',
            x: ['Todos los días un rato, honestidad al calificarte, y una unidad por vez.', 'El resto lo hace la app.']
          }
        ]
      }
    ]
  }
}

/* ========================================================================== */
/*                       RECETARIO DE INSTRUCCIONES                           */
/* ========================================================================== */

/**
 * Cada receta es un tipo de contenido de la materia y la indicación que conviene
 * escribirle a la app cuando generás sobre eso.
 *
 * Están escritas para Farmacología a propósito. Una receta genérica del tipo
 * "enfocate en los conceptos" no cambia nada; lo que sí cambia el resultado es
 * pedirle exactamente la operación que ese material necesita — contrastar dos
 * fármacos del mismo grupo, separar mecanismo de indicación, fijar el antídoto.
 *
 * Ninguna receta le pide a la app un número de dosis. No es un olvido: las
 * tarjetas que traen dosis son las que el mazo de regalo trae ya verificadas
 * contra fuente argentina, y una receta que empuje al modelo a sacar dosis de un
 * apunte de clase fabricaría justo el error que más caro sale acá.
 */
const RECETAS = [
  {
    n: 'Grupos farmacológicos y sus sufijos',
    para: 'Farmacología General y todas las unidades por sistemas.',
    receta:
      'Por cada grupo, hacé una tarjeta con el sufijo que lo identifica y otra al revés: dado el sufijo, qué grupo es y por dónde actúa. No mezcles las dos en la misma tarjeta.',
    porque: 'Reconocer el grupo por el nombre es lo que te deja razonar un fármaco que no viste nunca.'
  },
  {
    n: 'Fármacos que se confunden entre sí',
    para: 'Toda la materia. Es el pedido que más rinde.',
    receta:
      'Enfocate en los pares que se confunden. Por cada par, hacé una tarjeta que pregunte explícitamente la diferencia —mecanismo, vía o control— y no una definición de cada uno por separado.',
    porque: 'Lo que se falla no es la definición suelta: es cuál de los dos era.'
  },
  {
    n: 'Mecanismo de acción',
    para: 'Farmacología General, receptores, unidades por sistemas.',
    receta:
      'Por cada fármaco: sobre qué receptor o enzima actúa, si lo activa o lo bloquea, y qué efecto se sigue de eso. Una tarjeta por cada una de las tres partes, no las tres juntas.',
    porque: 'El mecanismo se toma pidiéndote que deduzcas el efecto, y para eso las tres partes tienen que estar sueltas.'
  },
  {
    n: 'Efectos adversos',
    para: 'Unidades por sistemas y Farmacología clínica.',
    receta:
      'Por cada efecto adverso preguntá POR QUÉ pasa, no sólo que pasa. Y hacé una tarjeta aparte con el que obliga a suspender el fármaco.',
    porque: 'El adverso que se explica por el mecanismo se acuerda; la lista suelta no. Y el que obliga a suspender es el que se pregunta.'
  },
  {
    n: 'Interacciones',
    para: 'Farmacología clínica, polifarmacia, geriatría.',
    receta:
      'Por cada interacción: qué dos fármacos, por qué mecanismo se pisan y en qué se traduce eso en el paciente. Preguntá por el mecanismo, no por la lista de pares.',
    porque: 'Las listas de pares son infinitas; los mecanismos por los que se pisan son pocos y se repiten.'
  },
  {
    n: 'Farmacocinética: absorción, distribución, metabolismo y excreción',
    para: 'Farmacología General.',
    receta:
      'Por cada concepto, una tarjeta que pregunte qué mide y otra que pregunte qué le pasa si cambia una variable —insuficiencia renal, primer paso, unión a proteínas—. Priorizá la segunda.',
    porque: 'La definición sola se toma poco; lo que se toma es qué cambia cuando el paciente no es el del libro.'
  },
  {
    n: 'Contraindicaciones y precauciones',
    para: 'Unidades por sistemas, y para el práctico.',
    receta:
      'Por cada fármaco: en qué situación no se usa y por qué mecanismo. Separá la contraindicación absoluta de la precaución, en tarjetas distintas.',
    porque: 'Confundir «no se puede» con «se puede con control» es el error clásico de esta parte.'
  },
  {
    n: 'Intoxicaciones y antídotos',
    para: 'Toxicología y Farmacología de urgencias.',
    receta:
      'Por cada intoxicación: cómo se reconoce, cuál es el antídoto y por qué mecanismo lo revierte. Y una tarjeta al revés: dado el antídoto, de qué es.',
    porque: 'En el examen y en la guardia te llega el cuadro, no el nombre del tóxico.'
  },
  {
    n: 'Cálculo y administración, para Enfermería',
    para: 'Cálculo de dosis y Bases del uso seguro.',
    receta:
      'Preguntá por el MÉTODO: qué datos hacen falta, qué unidades hay que igualar antes de dividir y qué se verifica antes de administrar. Escribí las tarjetas desde el lugar de quien administra bajo indicación.',
    porque: 'El número cambia con cada indicación; el método y la verificación son los que se repiten siempre.'
  },
  {
    n: 'Definiciones textuales de cátedra',
    para: 'Cuando la cátedra toma la definición palabra por palabra.',
    receta:
      'Respetá la formulación exacta del texto. No parafrasees ni simplifiques: la tarjeta tiene que decir lo mismo que dice el apunte.',
    porque: 'Si la cátedra corrige por la letra, una paráfrasis buena te resta puntos igual.'
  },
  {
    n: 'Vocabulario en inglés académico',
    para: 'Inglés técnico, y para leer papers y prospectos.',
    receta:
      'Idioma de las tarjetas: inglés. Formato: concepto y definición. Poné el término en inglés adelante y qué significa en castellano atrás.',
    porque: 'Al revés entrenás traducir, no reconocer, que es lo que necesitás al leer.'
  },
  {
    n: 'Marco legal y prescripción',
    para: 'Legislación, Salud Pública, Bases del uso seguro.',
    receta:
      'Por cada norma: qué obliga, a quién obliga y cuál es su excepción. La excepción es la parte que se toma.',
    porque: 'La prescripción por nombre genérico y el alcance de cada profesión se preguntan siempre por sus límites, no por el enunciado.'
  }
]

export function guiaRecetario() {
  const secciones = [
    {
      titulo: 'Cómo se usa esto',
      bloques: [
        {
          t: 'p',
          x: 'Cuando generás tarjetas, abajo del todo hay un cuadro para escribirle una indicación a la app. Es opcional y **cambia bastante el resultado**: sin nada escrito, el modelo decide solo qué es importante; con una indicación, le decís qué operación hacer sobre tu texto.'
        },
        {
          t: 'p',
          x: 'Buscá abajo el tipo de material que estás cargando y copiá la receta en ese cuadro. Podés cambiarle las palabras: no es un comando, es una instrucción en castellano.'
        },
        {
          t: 'aviso',
          tono: 'ojo',
          titulo: 'Lo que la indicación NO puede hacer',
          x: 'No agrega información que no esté en tu apunte. Si le pedís que incluya un fármaco que tu texto no menciona, no lo va a inventar — y si lo intentara, el filtro de la app lo descartaría. La indicación ajusta el foco, no el contenido.'
        }
      ]
    }
  ]

  for (const r of RECETAS) {
    secciones.push({
      titulo: r.n,
      bloques: [
        { t: 'p', x: `**Para:** ${r.para}` },
        { t: 'aviso', tono: 'clave', titulo: 'Copiá esto en el cuadro', x: r.receta },
        { t: 'p', x: `**Por qué:** ${r.porque}` }
      ]
    })
  }

  secciones.push({
    titulo: 'Tres cosas que valen para cualquier materia',
    bloques: [
      {
        t: 'lista',
        x: [
          '**Una idea por tarjeta.** Si la respuesta tiene tres partes, son tres tarjetas.',
          '**Contrastá los pares que se confunden.** Es lo que más rinde en Farmacología y lo que ninguna app hace sola si no se lo pedís.',
          '**Revisá lo que salió.** La indicación mejora el resultado; no lo garantiza. La pantalla de revisión sigue siendo tuya.'
        ]
      },
      {
        t: 'cierre',
        titulo: 'Y una que no es una receta',
        x: 'La mejor indicación es un buen apunte. De un texto explicativo salen buenas tarjetas con cualquier receta; de una filmina con tres palabras por renglón no salen buenas con ninguna.'
      }
    ]
  })

  return {
    titulo: 'Recetario de instrucciones',
    kicker: '12 indicaciones listas para copiar',
    bajada:
      'Qué escribirle a la app según lo que estés cargando, para que las tarjetas salgan como las necesitás. Una receta por tipo de material.',
    pie: `Guía que viene con ${APP_NAME}`,
    secciones
  }
}
