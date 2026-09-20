import { APP_NAME, HAY_BONUS, HAY_MAPA_GRUPOS } from './user-docs.mjs'

/**
 * Las guías del comprador: contenido estructurado, una sola fuente.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto no son plantillas de texto
 * ---------------------------------------------------------------------------
 *
 * Las guías se entregan en PDF, y además existen en .txt adentro del programa y
 * en la carpeta de descarga. Escribirlas dos veces garantiza que en el segundo
 * cambio queden distintas: alguien arregla una explicación en el PDF, nadie
 * toca el .txt, y el comprador termina leyendo dos versiones de la misma
 * instrucción. Acá el contenido está una vez, en bloques, y se dibuja de las dos
 * maneras — `aTexto()` acá, `guiaAHtml()` en `guias-html.mjs`.
 *
 * ---------------------------------------------------------------------------
 * Qué NO entra acá
 * ---------------------------------------------------------------------------
 *
 * La licencia de uso y el anexo de requisitos y funciones NO pasan por este
 * módulo y siguen viviendo en `user-docs.mjs`, en .txt. Los dos son parte del
 * contrato: la cláusula 11 define qué se considera un defecto comparándolo
 * contra el texto del anexo. Reescribirlos "para que se entiendan mejor"
 * cambiaría lo que la empresa se obligó a cumplir, que es una decisión legal y
 * no de redacción.
 *
 * ---------------------------------------------------------------------------
 * Los bloques
 * ---------------------------------------------------------------------------
 *
 *   p          párrafo. Admite **negrita** y `literal`.
 *   grupo      encabezado de grupo, un nivel por encima de `h`
 *   h          subtítulo dentro de una sección
 *   lista      viñetas
 *   pasos      lista numerada
 *   defs       [[término, qué es], …]
 *   tabla      { cab: [...], filas: [[...], …] }
 *   aviso      { tono: 'ojo'|'clave'|'alto', titulo, x }
 *   contraste  { mal, bien }  — el ejemplo malo al lado del bueno
 *   ficha      { frente, dorso } — una tarjeta dibujada como en la app
 *   cierre     el bloque final, en verde
 */

/* ========================================================================== */
/*                          EL DIBUJANTE DE TEXTO                             */
/* ========================================================================== */

const ANCHO = 79

/** Saca el marcado que sólo tiene sentido en el PDF. */
const plano = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '"$1"')

/** Parte un párrafo en renglones sin cortar palabras. */
function envolver(texto, ancho, sangria = '') {
  const palabras = plano(texto).split(/\s+/).filter(Boolean)
  const salida = []
  let linea = ''
  for (const p of palabras) {
    if (linea.length === 0) linea = p
    else if (linea.length + 1 + p.length <= ancho) linea += ` ${p}`
    else {
      salida.push(sangria + linea)
      linea = p
    }
  }
  if (linea.length > 0) salida.push(sangria + linea)
  return salida
}

const regla = (c = '=') => c.repeat(ANCHO)

function bloqueATexto(b) {
  const L = []
  switch (b.t) {
    case 'p':
      L.push(...envolver(b.x, ANCHO - 2, '  '), '')
      break

    /*
     * Un nivel POR ENCIMA de `h`, para agrupar.
     *
     * Sin esto, en la lista de problemas "AL CARGAR UN ARCHIVO" —que es un
     * grupo— y "«No se pudo abrir el PDF»" —que es un caso adentro de ese
     * grupo— se dibujaban iguales, y la lista quedaba plana: veinte títulos del
     * mismo peso donde en realidad hay cuatro bloques de cinco.
     */
    case 'grupo': {
      const t = plano(b.x).toUpperCase()
      L.push('', `  ${t}`, `  ${'═'.repeat(Math.min(t.length, ANCHO - 4))}`, '')
      break
    }

    case 'h': {
      /*
       * Los subtítulos NO se pasan a mayúsculas.
       *
       * Varios citan texto que el usuario ve en pantalla —«Windows protegió tu
       * PC», «Por hoy ya está»— y en mayúsculas dejan de coincidir con lo que
       * tiene delante. Un manual que escribe distinto de lo que el sistema
       * muestra obliga a traducir mientras se busca. Se marcan con un subrayado,
       * que jerarquiza igual y no toca las palabras.
       */
      const t = plano(b.x)
      L.push(`  ${t}`, `  ${'-'.repeat(Math.min(t.length, ANCHO - 4))}`, '')
      break
    }

    case 'lista':
      for (const i of b.x) {
        const r = envolver(i, ANCHO - 6, '')
        L.push(`  · ${r[0]}`, ...r.slice(1).map((x) => `    ${x}`))
      }
      L.push('')
      break

    case 'pasos':
      b.x.forEach((i, n) => {
        const r = envolver(i, ANCHO - 7, '')
        L.push(`  ${n + 1}) ${r[0]}`, ...r.slice(1).map((x) => `     ${x}`))
      })
      L.push('')
      break

    case 'defs':
      for (const [t, d] of b.x) {
        L.push(`  ${plano(t)}`)
        L.push(...envolver(d, ANCHO - 8, '      '), '')
      }
      break

    case 'tabla': {
      // Se dibuja como definiciones y no como columnas ASCII: una tabla de
      // ancho fijo en un .txt se descuadra apenas alguien la abre con otra
      // fuente, y estas se leen igual de bien en dos renglones.
      for (const f of b.filas) {
        L.push(`  ${plano(f[0])}`)
        for (let i = 1; i < f.length; i++) {
          if (String(f[i]).trim().length === 0) continue
          L.push(...envolver(`${b.cab[i]}: ${f[i]}`, ANCHO - 8, '      '))
        }
        L.push('')
      }
      break
    }

    case 'aviso': {
      if (b.titulo) L.push(`  ${plano(b.titulo).toUpperCase()}`)
      for (const p of Array.isArray(b.x) ? b.x : [b.x]) L.push(...envolver(p, ANCHO - 6, '     '))
      L.push('')
      break
    }

    case 'contraste':
      L.push(`  ${(b.etMal ?? 'Así no').toUpperCase()}`)
      for (const p of Array.isArray(b.mal) ? b.mal : [b.mal]) L.push(...envolver(p, ANCHO - 8, '     '))
      L.push('')
      L.push(`  ${(b.etBien ?? 'Así sí').toUpperCase()}`)
      for (const p of Array.isArray(b.bien) ? b.bien : [b.bien]) L.push(...envolver(p, ANCHO - 8, '     '))
      L.push('')
      break

    case 'ficha':
      L.push(`  ${(b.caraFrente ?? 'Frente').toUpperCase()}`)
      L.push(...envolver(b.frente, ANCHO - 8, '     '), '')
      L.push(`  ${(b.caraDorso ?? 'Dorso').toUpperCase()}`)
      L.push(...envolver(b.dorso, ANCHO - 8, '     '), '')
      break

    case 'cierre':
      L.push(regla('-'))
      if (b.titulo) L.push(`  ${plano(b.titulo).toUpperCase()}`, '')
      for (const p of Array.isArray(b.x) ? b.x : [b.x]) L.push(...envolver(p, ANCHO - 2, '  '), '')
      break

    default:
      throw new Error(`Bloque desconocido en una guía: "${b.t}"`)
  }
  return L
}

/** El .txt de una guía, con BOM y CRLF los pone quien escribe el archivo. */
export function guiaATexto(doc) {
  const L = [regla(), `  ${doc.titulo.toUpperCase()}`]
  if (doc.pie) L.push(`  ${doc.pie}`)
  L.push(regla(), '')
  L.push(...envolver(doc.bajada, ANCHO - 2, '  '), '')

  for (const s of doc.secciones) {
    if (s.titulo) {
      L.push('', regla('-'), `  ${s.titulo.toUpperCase()}`, regla('-'), '')
    }
    for (const b of s.bloques) L.push(...bloqueATexto(b))
  }

  L.push(regla())
  // Se limpian los renglones en blanco de más que dejan los bloques al
  // encadenarse: tres seguidos en un .txt se leen como que falta algo.
  return L.join('\n').replace(/\n{4,}/g, '\n\n\n') + '\n'
}

/* ========================================================================== */
/*                        1 · EMPEZÁ POR ACÁ                                  */
/* ========================================================================== */

export function guiaInicio({ version = '1.0.0', names = {}, hasWindows = true, hasMac = false } = {}) {
  const instalador = names.installer ?? `${APP_NAME}-${version}-Windows-Instalador.exe`
  const portable = names.portable ?? `${APP_NAME}-${version}-Windows-Portable.exe`
  // Siempre .pdf: es el nombre que el archivo tiene en la carpeta del comprador.
  // `names.help` viene con extensión .txt porque el mismo mapa de nombres se usa
  // para los documentos legales, que sí siguen siendo texto.
  const ayuda = (names.help ?? '4. Ayuda y solución de problemas.txt').replace(/\.txt$/, '.pdf')

  /*
   * ¿Esta guía viaja sola o acompañada?
   *
   * En la carpeta del comprador hay siete archivos y el manual completo es uno
   * de ellos, así que tiene sentido mandarlo a abrirlo. Pero esta misma guía se
   * escribe también como `INSTRUCCIONES DE INSTALACIÓN.txt` al lado del .exe
   * recién compilado, y ahí `names.readme` y `names.help` son EL MISMO nombre:
   * el texto terminaba diciendo "abrí INSTRUCCIONES DE INSTALACIÓN.pdf", o sea
   * mandando al lector a un archivo que no existe y que además es el que está
   * leyendo. La versión anterior tenía exactamente el mismo error.
   */
  const sola = !names.help || names.help === names.readme

  const secciones = []

  secciones.push({
    titulo: `Qué hace ${APP_NAME}`,
    bloques: [
      {
        t: 'p',
        x: 'Le das tus apuntes y te devuelve tarjetas de estudio. Después te las va tomando, espaciándolas: las que te cuestan vuelven seguido y las que ya sabés, cada vez más lejos en el tiempo.'
      },
      {
        t: 'p',
        x: 'Todo pasa **en tu computadora**. No hay cuenta, no hay servidor, no se sube ningún apunte a internet y no pagás por uso. Internet lo necesitás una sola vez, para bajar el motor de generación.'
      },
      {
        t: 'ficha',
        caraFrente: 'Frente',
        caraDorso: 'Dorso',
        frente: 'Paracetamol — Mecanismo de acción',
        dorso: 'Inhibe la COX en el sistema nervioso central; por eso baja la fiebre y el dolor, pero casi no tiene efecto antiinflamatorio en los tejidos periféricos, a diferencia de los AINE clásicos.'
      },
      {
        t: 'p',
        // Este número tiene que coincidir con TARJETAS_DISTINTAS_DE_REGALO
        // (src/shared/types.ts): actualizalo a mano acá si esa constante cambia,
        // porque este archivo es .mjs y no puede importarla directamente.
        x: 'La app ya viene con **2.889 tarjetas de Farmacología**, listas para estudiar hoy. No hace falta que cargues nada para empezar.'
      }
    ]
  })

  if (hasWindows) {
    secciones.push({
      titulo: 'Bajá un solo archivo',
      bloques: [
        { t: 'p', x: 'En esta carpeta hay dos programas. **Son exactamente la misma app**: elegí uno y listo.' },
        {
          t: 'defs',
          x: [
            [instalador, 'Recomendado. Se instala como cualquier programa y te deja el ícono en el Escritorio y en el menú Inicio.'],
            [portable, 'Si preferís no instalar nada. Se abre con doble clic. Podés llevarlo en un pendrive y tus materias viajan con él.']
          ]
        },
        hasMac
          ? { t: 'p', x: 'Si usás Mac, bajá el archivo `.dmg` que corresponda a tu equipo.' }
          : { t: 'p', x: 'Esta carpeta es la versión para Windows. Si usás Mac, escribinos y te pasamos la tuya.' }
      ]
    })

    secciones.push({
      titulo: 'Los avisos que van a aparecer, y son normales',
      bloques: [
        {
          t: 'h',
          x: 'Al descargar: «No se puede analizar el archivo en busca de virus»'
        },
        {
          t: 'p',
          x: 'Lo dice Google Drive con cualquier archivo grande. No es una advertencia sobre la app. Tocá **Descargar de todos modos**.'
        },
        { t: 'h', x: 'Al abrirlo: una pantalla azul que dice «Windows protegió tu PC»' },
        {
          t: 'p',
          x: 'Aparece porque el programa no tiene un certificado de firma digital, que es un trámite caro que se paga por año. **No significa que tenga un virus.**'
        },
        {
          t: 'pasos',
          x: [
            'Hacé clic en el texto chiquito que dice **Más información**.',
            'Abajo aparece un botón nuevo: **Ejecutar de todas formas**.',
            'Tocalo. Listo, no lo vuelve a pedir.'
          ]
        },

        /*
         * El caso que dejaba gente trabada.
         *
         * Un comprador con Windows 11 recién instalado no ve la pantalla azul de
         * SmartScreen: ve el Control Inteligente de Aplicaciones, que es otra
         * cosa y no tiene «Ejecutar de todas formas». Sólo ofrece «De acuerdo» y
         * «Obtener aplicaciones en Store». Siguiendo los pasos de arriba se
         * quedaba sin salida, con la app comprada y sin poder instalarla.
         *
         * El texto que muestra ese cartel dice que la app «se identificó como
         * malware que puede robar tu información». Es la redacción genérica que
         * usa con CUALQUIER programa sin firmar, no un diagnóstico. Conviene
         * citarlo textual acá: el que lo tiene delante necesita reconocerlo, y
         * leerlo en el instructivo es lo que lo tranquiliza.
         */
        { t: 'h', x: 'O, en algunas computadoras: «El Control Inteligente de Aplicaciones bloqueó esta aplicación»' },
        {
          t: 'p',
          x: 'Es un cartel distinto del anterior, con fondo verde, y **no trae el botón «Ejecutar de todas formas»**. Sólo aparece en computadoras con Windows 11 instalado de cero, no en las que se actualizaron desde Windows 10.'
        },
        {
          t: 'p',
          x: 'Ese aviso dice que el archivo «se identificó como malware que puede robar tu información». Es el texto que Windows usa con **cualquier** programa sin firma digital, sin haber analizado nada. Es el mismo motivo que la pantalla azul, sólo que este filtro no deja continuar.'
        },
        {
          t: 'p',
          x: 'Para instalar hay que apagarlo un momento:'
        },
        {
          t: 'pasos',
          x: [
            'Abrí el menú Inicio y escribí **Seguridad de Windows**. Entrá.',
            'Elegí **Control de aplicaciones y navegador**.',
            'Tocá **Configuración de Control inteligente de aplicaciones**.',
            'Ponelo en **Desactivado**.',
            `Instalá ${APP_NAME}.`,
            'Volvé al mismo lugar y ponelo otra vez en **Activado**.'
          ]
        },
        {
          t: 'aviso',
          tono: 'ojo',
          titulo: 'Si tenés otro antivirus',
          x: 'Si usás un antivirus que no es Windows Defender y bloquea la app, agregala a las excepciones. Es por el mismo motivo: le falta la firma, no le sobra nada.'
        }
      ]
    })
  }

  /*
   * La versión de Mac necesita su propia sección de descarga.
   *
   * Antes las dos secciones de arriba estaban las dos adentro del `if
   * (hasWindows)`, así que la guía de Mac salía sin decir qué archivo bajar: el
   * comprador abría el manual y lo primero que encontraba era "tu primer día".
   */
  if (hasMac && !hasWindows) {
    secciones.push({
      titulo: 'Bajá el archivo que corresponde a tu Mac',
      bloques: [
        { t: 'p', x: 'Hay dos, y **no son intercambiables**: cada uno trae el motor compilado para su procesador.' },
        {
          t: 'defs',
          x: [
            [names.macArm ?? 'Mac con chip M1, M2, M3 o M4', 'Si tu Mac es de 2020 en adelante, casi seguro es ésta. Se ve en  → Acerca de esta Mac: dice «Chip Apple M…».'],
            [names.macIntel ?? 'Mac con procesador Intel', 'Si en ese mismo lugar dice «Procesador Intel», es ésta.']
          ]
        },
        {
          t: 'pasos',
          x: [
            'Abrí el archivo `.dmg` que bajaste.',
            `Arrastrá **${APP_NAME}** a la carpeta **Aplicaciones**.`,
            'Abrilo desde Aplicaciones o desde Launchpad.'
          ]
        },
        {
          t: 'aviso',
          tono: 'clave',
          titulo: 'No vas a ver ninguna advertencia',
          x: 'La app está firmada y notarizada por Apple, así que macOS la abre sin preguntar nada. Si igual te aparece un aviso, es que el archivo se bajó a medias: borralo y bajalo de nuevo.'
        }
      ]
    })
  }

  secciones.push({
    titulo: 'Tu primer día, en diez minutos',
    bloques: [
      {
        t: 'p',
        x: 'No hace falta que configures nada ni que cargues un apunte. Hacé esto y ya viste el circuito entero.'
      },
      {
        t: 'pasos',
        x: [
          'Abrí la app. La primera vez te muestra cuatro pantallas de bienvenida: leelas y tocá **Entendido, empecemos**.',
          'Andá a **Estudiar** y elegí cualquier materia. Ya tenés 2.889 tarjetas cargadas.',
          'Leé el frente y **respondé en tu cabeza antes de mirar**. Ése es el ejercicio; leer la respuesta directamente no sirve.',
          'Tocá **Mostrar resultado** (o la barra espaciadora) y compará.',
          'Calificate con **No la sabía**, **Más o menos** o **La sabía** — o con las teclas 1, 2 y 3.',
          'Cuando termines, entrá a **Progreso**. Ahí vas a ver qué te conviene estudiar mañana.'
        ]
      },
      {
        t: 'p',
        x: 'Con eso ya sabés usar la app. Lo de generar tarjetas desde tus propios apuntes lo podés dejar para el segundo día.'
      }
    ]
  })

  secciones.push({
    titulo: 'Las cuatro pestañas',
    bloques: [
      {
        t: 'defs',
        x: [
          ['Biblioteca', 'Tus materias, con sus unidades adentro y las tarjetas de cada unidad. Acá creás, corregís, movés y borrás. Arriba hay un buscador que encuentra cualquier tarjeta aunque no te acuerdes en qué materia estaba: no le importan las tildes ni las mayúsculas.'],
          ['Generar', 'Le das un apunte —pegado o en archivo— y te devuelve tarjetas. Siempre te las muestra antes de guardarlas.'],
          ['Estudiar', 'La sesión del día. Tiene dos modos: **Lo de hoy**, que es el repaso espaciado, y **Repaso libre**, para pasar todo lo que quieras antes de un final sin desordenar el calendario.'],
          ['Progreso', 'Cuánto sabés de cada materia, cuál tenés más floja, y qué te conviene estudiar ahora.']
        ]
      },
      {
        t: 'aviso',
        tono: 'clave',
        titulo: 'Claro u oscuro',
        x: 'Arriba a la derecha hay un botón con un monitor, un sol o una luna. Cada toque cambia el tema: sigue al sistema, claro, oscuro. Se acuerda de lo que elegiste.'
      }
    ]
  })

  secciones.push({
    titulo: 'Lo que escribe la IA hay que leerlo',
    bloques: [
      {
        t: 'p',
        x: 'Las tarjetas las redacta un modelo de inteligencia artificial a partir de tu apunte. Es bueno y no es infalible: puede confundir una fecha o dar vuelta una definición.'
      },
      {
        t: 'p',
        x: 'Por eso la app **nunca guarda una tarjeta sin mostrártela antes**. Esa pantalla de revisión no es un trámite: es lo que separa estudiar bien de memorizar algo equivocado para un final.'
      },
      {
        t: 'aviso',
        tono: 'clave',
        titulo: 'Buena señal',
        x: 'Si la app te avisa que descartó tarjetas, es porque el modelo propuso algo que tu texto no respaldaba y el filtro lo tiró. Eso es el filtro funcionando.'
      }
    ]
  })

  if (!sola)
  secciones.push({
    titulo: 'Qué es cada archivo de esta carpeta',
    bloques: [
      {
        t: 'defs',
        x: [
          [ayuda, 'El manual completo: cómo generar, cómo estudiar, y qué hacer si algo no anda. Empezá por acá si te trabás.'],
          ...(HAY_BONUS
            ? [
                [
                  'Apuntes de regalo y guía de estudio',
                  'Apuntes listos para pegar y probar la generación, más la guía del método y un recetario de instrucciones.'
                ]
              ]
            : []),
          ['Licencia de uso', 'Tu licencia: qué podés hacer con el programa y qué no. Arranca con un resumen de treinta segundos. Ahí está también la garantía y cómo pedir el reembolso.'],
          ['Requisitos y funciones', 'Qué necesita tu computadora y qué hace exactamente el programa. Es el anexo del contrato.'],
          ['Licencias de los componentes', `El software libre que usa ${APP_NAME}, bajo qué licencia y dónde está su código.`],
          [
            'Cómo estudiar con repaso espaciado',
            'Los diez minutos que más rinden de esta carpeta: por qué el método funciona y los tres errores que hacen que la mayoría abandone antes del primer mes.'
          ],
          [
            'Recetario de instrucciones',
            'Doce indicaciones listas para copiar en el cuadro de la pestaña Generar, una por tipo de material: mecanismos, efectos adversos, interacciones, cálculo, marco legal.'
          ],
          ...(HAY_MAPA_GRUPOS
            ? [
                [
                  'El mapa de los grupos',
                  'Qué termina en «-olol», en «-pril», en «-sartán»: mecanismo, para qué se usa y el adverso que se toma siempre, por sufijo.'
                ]
              ]
            : [])
        ]
      }
    ]
  })

  secciones.push({
    bloques: [
      {
        t: 'cierre',
        titulo: '¿Algo no funciona?',
        x: [
          ...(sola ? [] : [`Abrí **${ayuda}**: cubre los casos más comunes, uno por uno.`]),
          `${sola ? 'Escribinos' : 'Si no lo resuelve, escribinos'} a **infoycontacto.store@gmail.com** y contanos qué esperabas, qué pasó y en qué momento. Adjuntá el archivo de registro que genera el programa: en la app, arriba a la derecha, el ícono de la hoja de papel te abre la carpeta donde está.`
        ]
      }
    ]
  })

  return {
    titulo: 'Empezá por acá',
    kicker: 'Guía de instalación y primeros pasos',
    bajada:
      'Gracias por tu compra. Esto se lee en cinco minutos y te deja estudiando hoy mismo, sin cargar un solo apunte.',
    pie: `${APP_NAME} ${version}`,
    secciones
  }
}

/* ========================================================================== */
/*                    4 · AYUDA Y SOLUCIÓN DE PROBLEMAS                       */
/* ========================================================================== */

export function guiaAyuda({ version = '1.0.0', names = {}, hasWindows = true, hasMac = false } = {}) {
  const secciones = []

  secciones.push({
    titulo: 'Cómo se generan las tarjetas',
    bloques: [
      {
        t: 'pasos',
        x: [
          'Andá a **Generar** y poné el material. Podés pegar el texto o cargar un archivo: PDF, Word (.docx), PowerPoint (.pptx) o texto (.txt, .md). También podés arrastrarlo a la ventana.',
          'Elegí **dónde** se guardan: una materia y una unidad. Si todavía no las creaste, el botón **+** al lado de cada selector las crea ahí mismo, sin salir de la pantalla.',
          'Elegí **cómo** las querés: formato, cantidad, idioma y calidad. Están explicados abajo.',
          'Si querés, escribile una indicación: «enfocate en los autores y sus aportes», «es para un final oral, priorizá definiciones exactas». Hay ejemplos para tocar.',
          'Tocá **Generar tarjetas** y esperá.',
          '**Revisá lo que salió antes de guardar.** Podés corregir el texto de cada una y descartar las que no sirvan. Recién cuando tocás Guardar entran a tu biblioteca.'
        ]
      },
      {
        t: 'aviso',
        tono: 'clave',
        titulo: 'Pegar el texto da mejores resultados que cargar un PDF',
        x: 'Un PDF no guarda párrafos: guarda pedacitos con una posición, y la app tiene que reconstruir el orden de lectura. Con dos columnas o encabezados puede equivocarse. Lo que pegás vos entra tal cual.'
      },
      { t: 'h', x: 'Los cuatro controles' },
      {
        t: 'defs',
        x: [
          ['Formato', '«Concepto y definición» pone el término adelante y qué significa atrás. «Pregunta y respuesta» arma una pregunta directa. «Mezcla» usa el que le convenga a cada parte del texto.'],
          ['Cantidad', '«Pocas» saca nada más que lo principal. «Normal» está en el medio y sirve para casi todo. «Exhaustiva» recorre el apunte entero buscando los temas uno por uno: saca alrededor del triple y tarda bastante más.'],
          ['Idioma', 'En qué idioma se escriben las tarjetas. La interfaz es siempre español.'],
          ['Calidad', '**Rápida** usa un modelo más chico (1,3 GB, anda con 4 GB de RAM). **Detallada** usa uno más grande (2,7 GB, pide 8 GB) y arma mejores preguntas.']
        ]
      },
      { t: 'h', x: 'Varios apuntes de la misma unidad, de una' },
      {
        t: 'p',
        x: 'Tocá **Elegir varios** y marcalos todos juntos. La app los procesa uno atrás del otro sola: podés dejar la computadora trabajando e irte. Cuando termina el último te muestra **todas** las tarjetas juntas para que las revises de una vez. Si alguno no se puede leer, los demás siguen igual y al final te dice cuál falló.'
      },
      { t: 'h', x: 'La primera vez tarda más' },
      {
        t: 'p',
        x: 'La primera vez que usás cada calidad, la app descarga su modelo y te muestra el progreso. Es una sola vez; después funciona sin internet. Si la descarga se corta, la próxima vez sigue desde donde iba: no vuelve a empezar de cero.'
      },
      { t: 'h', x: 'Cuánto tarda' },
      {
        t: 'p',
        x: 'Depende de tu computadora, del largo del apunte, de la calidad y de la cantidad. Como referencia, en una notebook común y con calidad Rápida, unas dos páginas tardan poco más de un minuto en «Normal» y unos tres o cuatro minutos en «Exhaustiva».'
      },
      {
        t: 'p',
        x: 'Si te parece que tarda demasiado, probá con «Normal» o con la calidad Rápida, o generá el apunte por partes.'
      }
    ]
  })

  secciones.push({
    titulo: 'Cómo se estudia',
    corte: true,
    bloques: [
      {
        t: 'p',
        x: 'Andá a **Estudiar** y elegí una materia entera o una unidad suelta. También podés entrar desde el botón Estudiar de la Biblioteca o de Progreso.'
      },
      { t: 'h', x: 'Los tres botones' },
      {
        t: 'defs',
        x: [
          ['No la sabía  (tecla 1)', 'No te salió, o dudaste tanto que en un examen no la habrías escrito. Vuelve enseguida, en esta misma sesión.'],
          ['Más o menos  (tecla 2)', 'Te salió, pero te costó o te faltó una parte. Vuelve pronto, en un día o dos.'],
          ['La sabía  (tecla 3)', 'Te salió sin esfuerzo. Se va lejos en el tiempo, y cada vez más lejos.']
        ]
      },
      {
        t: 'aviso',
        tono: 'ojo',
        titulo: 'Calificate con honestidad',
        x: 'La app no te está puntuando: está calculando cuándo mostrarte la tarjeta de nuevo. Si le decís que la sabías cuando dudaste, te la va a mostrar cuando ya te la hayas olvidado.'
      },
      { t: 'h', x: 'Los dos modos: «Lo de hoy» y «Repaso libre»' },
      {
        t: 'tabla',
        cab: ['', 'Qué trae', 'Cuándo usarlo'],
        filas: [
          ['Lo de hoy', 'Sólo lo que toca según tu progreso, con el límite diario de la materia.', 'Todos los días. Es el modo normal y el que hace que el método funcione.'],
          ['Repaso libre', 'TODAS las tarjetas del alcance, vengan o no, sin límite.', 'La semana antes de un final, o cuando querés pasar una unidad entera de corrido.']
        ]
      },
      {
        t: 'aviso',
        tono: 'clave',
        titulo: 'El repaso libre no toca tu calendario',
        x: [
          'Lo que contestes en repaso libre **no adelanta ni atrasa ninguna tarjeta**, no gasta el límite del día y no mueve tu porcentaje. Los tres botones siguen ahí porque ordenan esa sesión: lo que fallás vuelve unos lugares más adelante.',
          'Podés hacerlo las veces que quieras, el mismo día, sin romper nada.'
        ]
      },
      { t: 'h', x: 'El límite diario' },
      {
        t: 'p',
        x: 'Cada materia tiene un ritmo: **Tranquilo** (10 tarjetas nuevas por día), **Normal** (20) o **Intenso** (40). Sirve para que generar un mazo de 300 tarjetas no te haga aparecer las 300 juntas el primer día.'
      },
      {
        t: 'p',
        x: 'Se cambia desde la Biblioteca: tocá la materia y vas a ver la pregunta «¿Cuánto querés estudiar por día?». Y si un día querés más, el repaso libre no tiene tope.'
      },
      { t: 'h', x: 'El día empieza a las 4 de la mañana' },
      {
        t: 'p',
        x: 'Si estudiás a la una y media de la madrugada, para la app todavía es el día anterior. Es a propósito: así no gastás el cupo dos veces en una misma noche y no se te corta la racha un día que sí estudiaste.'
      }
    ]
  })

  secciones.push({
    titulo: 'Qué te conviene estudiar',
    bloques: [
      {
        t: 'p',
        x: 'La pestaña **Progreso** contesta dos preguntas: cómo venís y qué hacer ahora.'
      },
      {
        t: 'defs',
        x: [
          ['Los tres números de arriba', 'Días seguidos estudiando, repasos de hoy, y qué porcentaje acertás al repasar en los últimos 30 días.'],
          ['Todo junto', 'Qué proporción de tu mazo está en la memoria de largo plazo. **No** es cuántas acertaste hoy: sube cuando acertás una tarjeta con intervalos cada vez más largos, y eso lleva semanas. Es lento porque es honesto.'],
          ['Qué te conviene ahora', 'Hasta tres sugerencias, la más urgente primero: lo que te vence hoy, la materia que tenés más floja, y la que todavía no empezaste. Cada una con su botón.'],
          ['Por materia', 'Vienen ordenadas **de más floja a más firme**, no en el orden en que las creaste. La primera lleva un cartel que lo dice, y debajo de cada una figura cuál es su unidad más floja.']
        ]
      },
      {
        t: 'aviso',
        tono: 'clave',
        titulo: 'Por qué a veces te sugiere un repaso libre',
        x: 'Si una materia está floja pero hoy no te vence nada, la sesión normal no te mostraría nada. Por eso ahí el botón dice «Repaso libre»: es la única forma de reforzarla hoy sin desordenar el calendario.'
      },
      {
        t: 'p',
        x: 'Las materias que todavía no empezaste van **al final** de la lista y con el cartel «sin empezar». No están flojas: están sin empezar, y eso se arregla de otra manera.'
      }
    ]
  })

  secciones.push({
    titulo: 'Pasar tus mazos a otra computadora',
    bloques: [
      {
        t: 'p',
        x: 'En la Biblioteca, pasando el mouse por encima de una materia aparece una **flecha hacia abajo**: guarda esa materia entera —con sus unidades y sus tarjetas— en un archivo. Para traer uno, la **flecha hacia arriba** que está al lado del «+» de Materias.'
      },
      {
        t: 'aviso',
        tono: 'ojo',
        titulo: 'El archivo lleva sólo las tarjetas',
        x: 'Tu progreso de estudio no viaja, y es a propósito: quien lo abra tiene que arrancar de cero, no heredar qué te sabías vos.'
      },
      {
        t: 'p',
        x: 'Si al importar ya tenés una materia con ese nombre, la app te pregunta si querés agregar las tarjetas ahí o dejarlas en una materia aparte. En los dos casos, las que ya tengas **no se duplican**.'
      }
    ]
  })

  secciones.push({
    titulo: 'Dónde están tus tarjetas (y cómo no perderlas)',
    bloques: [
      {
        t: 'aviso',
        tono: 'alto',
        titulo: 'La app no hace copias de seguridad sola',
        x: 'Si formateás la computadora o desinstalás el programa, tus tarjetas se pierden. Copiá la carpeta de datos de vez en cuando a un pendrive o a la nube y no perdés nada.'
      },
      {
        t: 'p',
        x: 'En la pestaña **Progreso**, abajo del todo, está la ruta exacta de esa carpeta y un botón para abrirla. También llegás desde el ícono del disco, arriba a la derecha.'
      },
      ...(hasWindows
        ? [
            {
              t: 'p',
              x: 'En Windows la carpeta es `%APPDATA%\\' + APP_NAME + '` (pegá eso en la barra del Explorador). En la versión portable, la carpeta viaja al lado del programa, así que copiando el pendrive ya tenés la copia.'
            }
          ]
        : []),
      ...(hasMac
        ? [
            {
              t: 'p',
              x: 'En Mac la carpeta es `~/Library/Application Support/' + APP_NAME + '`. En el Finder: menú Ir → Ir a la carpeta, y pegá esa ruta.'
            }
          ]
        : [])
    ]
  })

  /* ------------------------------ los problemas --------------------------- */

  const problema = (t, ...ps) => [{ t: 'h', x: t }, ...ps.map((x) => ({ t: 'p', x }))]

  secciones.push({
    titulo: 'Si algo no funciona',
    corte: true,
    bloques: [
      {
        t: 'aviso',
        titulo: 'Antes que nada',
        x: 'La app guarda un archivo de registro con el detalle de lo que pasó. En la app, arriba a la derecha, tocá el ícono de la **hoja de papel**: se abre la carpeta con el archivo `' + APP_NAME.toLowerCase() + '.log`. Si nos escribís, adjuntalo: con eso podemos diagnosticar, sin eso no.'
      },
      /* Sólo Windows. En Mac no existe ni el Control Inteligente de
         Aplicaciones ni SmartScreen —la app va firmada y notarizada por
         Apple— y el comprador de Mac abre esta misma guía. Sin la guarda,
         leía tres problemas que en su computadora no pueden pasar. */
      ...(hasWindows
        ? [
      /* Va PRIMERO, antes que todo lo demás. El que llega hasta este documento
               por un bloqueo de Windows todavía no pudo abrir la app ni una vez:
               buscar su problema abajo de «al cargar un archivo» no se le ocurre,
               porque nunca llegó a cargar nada. */
            { t: 'grupo', x: 'AL INSTALAR' },
            ...problema(
              '«El Control Inteligente de Aplicaciones bloqueó esta aplicación»',
              'Es un cartel verde y **no tiene botón para continuar**: sólo «De acuerdo» y «Obtener aplicaciones en Store». Aparece únicamente en computadoras con Windows 11 instalado de cero. Dice que el archivo es malware, pero es el texto que Windows usa con cualquier programa sin firma digital, sin haber analizado nada.',
              'Para instalar hay que apagarlo un momento: **Seguridad de Windows** → **Control de aplicaciones y navegador** → **Configuración de Control inteligente de aplicaciones** → **Desactivado**. Instalá la app y volvelo a activar.'
            ),
            ...problema(
              '«Windows protegió tu PC» (pantalla azul)',
              'Tocá **Más información** y después el botón **Ejecutar de todas formas**, que aparece abajo. Es porque la app no tiene certificado de firma digital, no porque tenga un virus.'
            ),
            ...problema(
              'El antivirus la bloquea o la borra sola',
              'Agregala a las excepciones de tu antivirus. Es el mismo motivo que los dos casos de arriba: le falta la firma, no le sobra nada. Si el antivirus ya borró el archivo, vas a tener que bajarlo de nuevo después de crear la excepción.'
            )
          ]
        : []),
      { t: 'grupo', x: 'AL CARGAR UN ARCHIVO' },
      ...problema(
        '«No se pudo abrir el PDF» o «Ese PDF está protegido con contraseña»',
        'Abrilo con tu lector de PDF, guardalo sin contraseña y probá de nuevo. Si no podés, copiá el texto a mano y pegalo.'
      ),
      ...problema(
        '«Este PDF no tiene texto: sus páginas son imágenes»',
        'Es un escaneo o una foto del apunte. La app no lee imágenes y no tiene reconocimiento de caracteres. Copiá el texto a mano.'
      ),
      ...problema(
        '«Ese archivo parece ser un .doc del Word viejo»',
        'Abrilo en Word, «Guardar como» y elegí «Documento de Word (.docx)». El formato anterior a 2007 no se puede leer.'
      ),
      ...problema(
        'El texto salió desordenado o con frases mezcladas',
        'Pasa con PDFs a dos columnas; la app avisa cuando detecta uno. Corregilo en el cuadro antes de generar, o —más rápido— copiá el texto directamente del PDF y pegalo.'
      ),
      ...problema(
        'Palabras pegadas o cortadas raro',
        'Los PDF cortan palabras al final del renglón. La app las reconstruye, pero no siempre acierta. Revisá el cuadro antes de generar.'
      ),
      { t: 'grupo', x: 'AL GENERAR' },
      ...problema(
        '«No hay memoria suficiente para este modelo»',
        'Elegí la calidad Rápida, que anda bien con 4 GB de RAM. La Detallada necesita 8 GB.'
      ),
      ...problema(
        '«No hay espacio suficiente en disco»',
        'El modelo Rápido ocupa 1,3 GB y el Detallado 2,7 GB. Liberá espacio, o borrá el que no uses desde el botón **Modelos**.'
      ),
      ...problema(
        '«No hay conexión a internet»',
        'Sólo hace falta internet la primera vez que usás cada calidad, para bajar su modelo. Conectate y probá de nuevo.'
      ),
      ...problema(
        'Salieron pocas tarjetas, o ninguna',
        'Puede ser por tres motivos: el texto es corto (hacen falta al menos unas 60 palabras); el texto no tiene contenido para estudiar (un índice, una bibliografía, una portada); o el modelo propuso cosas que el texto no respaldaba y la app las descartó.',
        'En el último caso, probá con la calidad Detallada o con un texto más explicativo.'
      ),
      ...problema(
        'Las tarjetas salieron flojas o demasiado obvias',
        'Probá la calidad Detallada, subí la cantidad, o escribí una indicación diciéndole en qué enfocarse. Y acordate de que las filminas de PowerPoint suelen dar tarjetas básicas: son el apoyo de una explicación hablada, no el apunte.'
      ),
      { t: 'grupo', x: 'AL ESTUDIAR' },
      ...problema(
        '«Por hoy ya está: llegaste al límite diario»',
        'Es el ritmo de la materia haciendo su trabajo. Si querés avanzar más rápido, subilo desde la Biblioteca. Y si lo que querés es pasar más tarjetas hoy sin cambiar nada, usá el **repaso libre**: no tiene tope.'
      ),
      ...problema(
        '«No hay nada para repasar por ahora»',
        'Ya estudiaste todo lo que tocaba hoy. Las tarjetas vuelven solas cuando corresponde: ése es el punto del método. Si igual querés repasar esa materia, hacé un repaso libre.'
      ),
      ...problema(
        'Quiero repasar algo que ya estudié hoy',
        'Usá el **repaso libre**: trae todas las tarjetas del alcance sin importar el vencimiento, y no altera nada. No hace falta reiniciar el progreso de nada.'
      ),
      ...problema(
        'Una tarjeta dice algo mal',
        'Corregila: en la Biblioteca, tocá la tarjeta y editala. Cambiar el texto **no** te hace perder el progreso de repaso que ya tenía.'
      ),
      ...problema(
        'Quiero que una tarjeta vuelva a empezar de cero',
        'Abrila y tocá **Reiniciar progreso**. Está separado del botón de guardar a propósito: tira a la basura el historial de repasos de esa tarjeta.'
      ),
      ...problema(
        'El porcentaje de la materia sube muy despacio',
        'Mide cuánto de tu mazo está en la memoria de **largo** plazo, no cuántas acertaste hoy. Sube cuando acertás una tarjeta con intervalos cada vez más largos, y eso lleva semanas.'
      ),
      { t: 'grupo', x: 'OTRAS COSAS' },
      ...problema(
        'Borré una materia sin querer',
        'No se puede deshacer, y por eso la app pregunta antes diciendo cuántas unidades y cuántas tarjetas se van a borrar. Ese cartel es la única red que hay.'
      ),
      ...problema(
        'No encuentro una tarjeta',
        'Usá el buscador de la Biblioteca. Encuentra por cualquier palabra del frente o del dorso, y no importan las tildes ni las mayúsculas: «informacion» encuentra «información».'
      ),
      ...problema(
        'La app tarda en abrir',
        'Con muchas tarjetas, el arranque lee toda tu biblioteca. Con 15.000 tarjetas son menos de dos segundos.'
      ),
      ...problema(
        'Tengo Convertexto instalado, ¿se pisan?',
        'No. Son dos programas distintos con carpetas de datos separadas. Lo único que comparten, si los dos están instalados, es el modelo de IA: ' + APP_NAME + ' usa el que ya descargó Convertexto en lugar de bajar los mismos gigabytes otra vez, y nunca lo toca. Desinstalar uno no afecta al otro.'
      )
    ]
  })

  if (hasWindows) {
    secciones.push({
      titulo: 'Cómo desinstalar',
      bloques: [
        {
          t: 'p',
          x: 'En Windows: **Configuración → Aplicaciones → Aplicaciones instaladas**, buscá ' + APP_NAME + ' y tocá Desinstalar. La versión portable no se desinstala: se borra el archivo.'
        },
        {
          t: 'aviso',
          tono: 'alto',
          titulo: 'Se van tus tarjetas con él',
          x: 'Desinstalar borra también tu carpeta de datos. Si querés conservar tus mazos, copiala **antes** — o exportá las materias que te importen desde la Biblioteca.'
        }
      ]
    })
  }

  if (hasMac) {
    secciones.push({
      titulo: 'Mac',
      bloques: [
        {
          t: 'p',
          x: 'Abrí el `.dmg` que corresponda a tu equipo y arrastrá ' + APP_NAME + ' a la carpeta Aplicaciones. La app está firmada y notarizada por Apple, así que no vas a ver ninguna advertencia.'
        },
        {
          t: 'p',
          // La ruta del registro NO es `~/Library/Logs/…`, que es donde macOS
          // guarda los logs del sistema: la app escribe el suyo adentro de su
          // propia carpeta de datos, en `logs/`. Verificado contra `logsDir()`.
          x: 'Para desinstalar, arrastrá la app a la Papelera y borrá la carpeta `~/Library/Application Support/' + APP_NAME + '`, que es donde viven tus tarjetas. El registro está adentro de esa misma carpeta, en `logs/`.'
        }
      ]
    })
  }

  secciones.push({
    bloques: [
      {
        t: 'cierre',
        titulo: 'Si nada de esto lo resuelve',
        x: [
          'Escribinos a **infoycontacto.store@gmail.com**.',
          'Contanos qué esperabas, qué pasó, cuándo apareció el problema por primera vez, qué versión de Windows o de macOS tenés, y **adjuntá el archivo de registro**. Con eso lo podemos diagnosticar; sin eso, no.'
        ]
      }
    ]
  })

  return {
    titulo: 'Ayuda y solución de problemas',
    kicker: 'Manual completo',
    bajada:
      'Todo lo que hace la app, explicado paso a paso, y qué hacer cuando algo no sale. Buscá el título que se parezca a tu problema.',
    pie: `${APP_NAME} ${version}`,
    secciones
  }
}
