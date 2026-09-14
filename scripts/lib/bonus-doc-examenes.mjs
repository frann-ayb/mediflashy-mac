/**
 * Bonus: los simulacros de final, por materia.
 *
 * ---------------------------------------------------------------------------
 * Por qué son DOS documentos y no uno
 * ---------------------------------------------------------------------------
 *
 * Porque un examen con las respuestas al lado no es un examen: es un apunte.
 * El valor entero de esto está en el rato en que el estudiante no sabe si
 * acertó, y eso desaparece apenas la respuesta entra en el campo visual.
 *
 * Por eso, por cada materia salen dos PDF con el mismo número: el de preguntas,
 * que es el que se imprime o se abre en el celular, y el de respuestas, que se
 * abre DESPUÉS. Es la misma razón por la que la app muestra el frente y obliga
 * a contestar antes de dar vuelta la tarjeta.
 *
 * El de respuestas repite la pregunta arriba de cada una: si sólo trajera las
 * respuestas numeradas, corregir obligaría a tener los dos documentos abiertos
 * en paralelo, que en un celular no se puede.
 */

/*
 * Las preguntas van con el encabezado normal ('h') y NO con el de etiqueta
 * ('grupo'). El de etiqueta va en versalitas espaciadas, que se lee bien en
 * dos o tres palabras y muy mal en una pregunta de ochenta caracteres: en la
 * prueba de imprenta, "¿QUÉ FUNDÓ EFECTIVAMENTE WUNDT EN LEIPZIG EN 1879 Y QUÉ
 * PARTE DE SU OBRA SUELE OMITIRSE?" costaba leerlo de corrido.
 */

/** La letra que le toca a cada opción. El texto de la opción NO la trae. */
const LETRAS = ['a', 'b', 'c', 'd']

/* ═══════════════════════════════════════════════════════════════════════════
   El de PREGUNTAS
   ═══════════════════════════════════════════════════════════════════════════ */

export function examenPreguntas(ex, n) {
  return {
    titulo: `Simulacro de final — ${ex.materia}`,
    kicker: `Bonus · modelo de examen ${n} de 14`,
    bajada:
      'Veinte preguntas, como las que se toman. Hacelo entero antes de mirar las respuestas: el que se fija en el momento no está estudiando, está leyendo.',
    pie: `Simulacro de ${ex.materia} · Psicoflashy`,
    secciones: [
      {
        titulo: 'Cómo hacerlo',
        bloques: [
          {
            t: 'pasos',
            x: [
              'Cronometrá **90 minutos** y no lo pares. En el final tampoco vas a poder pararlo.',
              'Escribí las respuestas de desarrollo **en una hoja aparte**, con tus palabras. Pensarlas «más o menos» no cuenta: en el oral hay que decirlas.',
              'Las de opción múltiple, marcá una sola letra. Si dudás entre dos, **anotá cuál era la otra**: eso es exactamente lo que tenés flojo.',
              'Las cuatro últimas son de oral. Contestalas **en voz alta**, de corrido, como si tuvieras la mesa adelante.',
              'Recién ahí abrí el documento de respuestas.'
            ]
          },
          {
            t: 'aviso',
            titulo: 'Lo que vale es lo que no te salió',
            x: 'Cada pregunta que fallaste es una unidad para poner en Psicoflashy esta semana. El simulacro no te dice cuánto sabés: te dice qué te falta, que es mucho más útil a diez días del final.'
          }
        ]
      },
      {
        titulo: 'Primera parte · Desarrollo',
        bloques: [
          { t: 'p', x: '**8 preguntas.** Respuesta escrita, en hoja aparte. Calculá unos 7 minutos para cada una.' },
          ...ex.desarrollo.flatMap((d, i) => [{ t: 'h', x: `${i + 1}. ${d.p}` }])
        ]
      },
      {
        titulo: 'Segunda parte · Opción múltiple',
        bloques: [
          { t: 'p', x: '**8 preguntas.** Una sola opción correcta en cada una.' },
          ...ex.multiple.flatMap((m, i) => [
            { t: 'h', x: `${i + 1}. ${m.p}` },
            { t: 'lista', x: m.ops.map((o, k) => `**${LETRAS[k]})** ${o}`) }
          ])
        ]
      },
      {
        titulo: 'Tercera parte · Oral',
        bloques: [
          { t: 'p', x: '**4 preguntas.** En voz alta, sin leer. Son las que se toman cuando la mesa quiere ver si entendiste o si memorizaste.' },
          ...ex.oral.flatMap((o, i) => [{ t: 'h', x: `${i + 1}. ${o.p}` }])
        ]
      },
      {
        titulo: 'Terminaste',
        bloques: [
          {
            t: 'cierre',
            titulo: 'Ahora sí, las respuestas',
            x: [
              `Abrí **«Respuestas — ${ex.materia}»**, corregí sin ser generoso con vos mismo y anotá cada tema que no salió redondo.`,
              'Esos temas son los que van a la app. Ahí se ordenan solos y te vuelven a aparecer justo antes de que se te borren.'
            ]
          }
        ]
      }
    ]
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   El de RESPUESTAS
   ═══════════════════════════════════════════════════════════════════════════ */

export function examenRespuestas(ex, n) {
  return {
    titulo: `Respuestas — ${ex.materia}`,
    kicker: `Bonus · modelo de examen ${n} de 14`,
    bajada:
      'Las respuestas modelo del simulacro, con el porqué de cada opción descartada. Abrilo después de haber contestado, no antes.',
    pie: `Respuestas de ${ex.materia} · Psicoflashy`,
    secciones: [
      {
        titulo: 'Cómo corregir',
        bloques: [
          {
            t: 'p',
            x: 'No te corrijas por parecido. La pregunta es si **dijiste lo que había que decir**, con el nombre del autor y el concepto correctos, no si «era más o menos eso».'
          },
          {
            t: 'defs',
            x: [
              ['La dijiste entera', 'Nombraste el concepto, el autor y lo que los distingue. Listo, no la toques.'],
              ['Te faltó una parte', 'Sabías el concepto pero no el autor, o al revés. Es la que más se cae en el oral: va a la app.'],
              ['No te salió', 'Ni la empezaste, o dijiste otra cosa. Esa unidad se estudia de nuevo, no se repasa.']
            ]
          },
          {
            t: 'aviso',
            tono: 'ojo',
            titulo: 'Las de opción múltiple se corrigen distinto',
            x: 'No alcanza con haber acertado. Leé el porqué de las tres que descartaste: si alguna te sonaba razonable, ahí hay un concepto que todavía tenés mezclado, aunque la respuesta te haya salido bien.'
          }
        ]
      },
      {
        titulo: 'Primera parte · Desarrollo',
        bloques: ex.desarrollo.flatMap((d, i) => [
          { t: 'h', x: `${i + 1}. ${d.p}` },
          { t: 'p', x: d.r }
        ])
      },
      {
        titulo: 'Segunda parte · Opción múltiple',
        bloques: ex.multiple.flatMap((m, i) => [
          { t: 'h', x: `${i + 1}. ${m.p}` },
          {
            t: 'contraste',
            etBien: `Correcta: ${m.ok})`,
            etMal: 'Por qué las otras no',
            bien: m.ops[LETRAS.indexOf(m.ok)],
            mal: m.por
          }
        ])
      },
      {
        titulo: 'Tercera parte · Oral',
        bloques: [
          {
            t: 'p',
            x: 'Estas no tienen respuesta única: tienen **lo que la mesa espera escuchar**. Compará contra eso y fijate qué parte no dijiste.'
          },
          ...ex.oral.flatMap((o, i) => [
            { t: 'h', x: `${i + 1}. ${o.p}` },
            { t: 'p', x: o.g }
          ])
        ]
      },
      {
        titulo: 'Y ahora',
        bloques: [
          {
            t: 'cierre',
            titulo: 'Lo que fallaste, a la app',
            x: [
              `Abrí Psicoflashy, entrá a **${ex.materia}** y estudiá las unidades de los temas que no salieron. Ya están cargadas.`,
              'Y si algo de tu cátedra no está, cargá el apunte y te arma las tarjetas de eso. Después la app decide sola cuándo te lo vuelve a preguntar.'
            ]
          }
        ]
      }
    ]
  }
}
