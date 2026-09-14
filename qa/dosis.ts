import { app } from 'electron'
import { MAZOS_DE_REGALO } from '../src/main/services/mazosDeRegalo'

/**
 * La prueba que hace cumplir la regla de las dosis.
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * En Psicoflashy el peor error posible de una tarjeta era académico: atribuirle
 * a Freud algo que dijo Klein. Acá el peor error es de otra clase. Una tarjeta
 * que dice una dosis equivocada la memoriza alguien que dentro de seis meses va
 * a cargar una jeringa, y el daño no es una nota baja.
 *
 * El anclaje de citas que ya tiene la app (`core/anchor.ts`) NO cubre esto:
 * verifica que el texto citado exista en el apunte, no que la respuesta sea
 * correcta. Una dosis inventada por el modelo —o tipeada mal por una persona—
 * pasa los cinco filtros del generador sin que salte nada.
 *
 * Entonces la defensa es editorial y se verifica acá: **si una tarjeta dice un
 * número de dosis, tiene que decir de dónde sale.** No porque la fuente lo haga
 * correcto, sino porque:
 *
 *  · el estudiante puede verificarlo antes de usarlo;
 *  · cuando la guía cambie, se sabe qué tarjetas revisar;
 *  · y quien escribió la tarjeta tuvo que mirar algo antes de escribir el número,
 *    que es la parte que de verdad evita el error.
 *
 * ---------------------------------------------------------------------------
 * Qué NO hace esta prueba
 * ---------------------------------------------------------------------------
 *
 * No verifica que la dosis sea correcta: ningún programa puede. Verifica que
 * esté acompañada. Es un piso, no un techo, y no reemplaza la revisión humana
 * de las unidades marcadas como riesgo alto.
 */

/**
 * Patrones que delatan una dosis o una concentración.
 *
 * Van con límite de palabra para que "500 mg" salte y "algo" no. Se incluyen
 * las unidades que aparecen de verdad en farmacología argentina: los mg/kg de
 * pediatría, las UI de insulina y heparina, los mcg de levotiroxina, los ml y
 * las gotas de las diluciones de enfermería, y los mEq de los electrolitos.
 */
const PATRON_DOSIS =
  /\b\d[\d.,]*\s*(mg\s*\/\s*kg|mcg\s*\/\s*kg|ug\s*\/\s*kg|mg\s*\/\s*m2|mg|mcg|µg|ug|gramos?|g\b|UI|U\b|mEq|mmol|ml|cc|gotas?|%)\b/i

/**
 * Lo que cuenta como decir de dónde sale.
 *
 * Se acepta una fuente NOMBRADA, no una vaguedad. Y el listón subió después de
 * encontrar el agujero: la primera versión aceptaba las palabras sueltas "guía"
 * y "consenso", así que escribir "según la guía" satisfacía la regla que corta
 * el build. Con 1.500 tarjetas con números por escribir, ese agujero se habría
 * colado en todas y auditarlas después no habría sido barato.
 *
 * Ahora "guía" y "consenso" sólo cuentan si viene la entidad que las firma, los
 * textos sólo cuentan con año o edición, y las leyes con número. La lista es
 * deliberadamente concreta para que agregarle una fuente nueva sea una decisión
 * consciente y quede en el historial del archivo.
 */
const PATRON_FUENTE = new RegExp(
  [
    // Organismos y publicaciones oficiales argentinas.
    'ANMAT',
    'Ministerio de Salud',
    'Formulario Terapéutico Nacional|Formulario Terapeutico Nacional|FTN\\b',
    'COMRA',
    'CIME\\b',
    'Remediar',
    'ANLIS',
    'Calendario Nacional de Vacunación|Calendario Nacional de Vacunacion',
    'SENASA',
    // Organismos internacionales.
    'OMS\\b|OPS\\b|FDA\\b|EMA\\b',
    // Textos, siempre con edición o año para que no valga nombrarlos al pasar.
    //
    // El `[ªa°]` no es un capricho: la primera versión sólo aceptaba el ordinal
    // volado ("13.ª ed.") y las tarjetas escriben "13.a ed." con a normal, así
    // que rechazaba decenas de citas correctas del propio libro que exige.
    '(Goodman|Katzung|Rang|Flórez|Florez|Lorenzo|Velázquez|Velazquez|Malamed|Brunton)[^.]{0,40}\\d{4}',
    '(Goodman|Katzung|Rang|Flórez|Florez|Lorenzo|Velázquez|Velazquez|Malamed|Brunton)[^.]{0,20}\\d{1,2}\\.?[ªa°]? ?(ed|edición|edicion)',

    /*
     * Fuentes argentinas de segundo nivel, agregadas después del lote de cálculo
     * de dosis de Enfermería.
     *
     * No es que la regla se haya aflojado: los escritores encontraron fuentes
     * MEJORES que las que esta lista preveía, y todas cumplen el criterio que
     * importa —que el estudiante pueda abrirlas y verificar el número—.
     *
     * La Guía Farmacoterapéutica de un hospital público es, para una
     * presentación comercial argentina, mejor fuente que Goodman & Gilman, que
     * es traducción de la edición estadounidense y no conoce nuestras ampollas.
     * Y una norma ISO con cláusula es la única fuente real para el factor de
     * goteo de un equipo de infusión: ningún libro de farmacología lo trae.
     *
     * Lo que se sigue rechazando es lo de siempre: la fuente sin nombre.
     */
    // Guías y boletines de hospitales y facultades: exigen la institución.
    '(Gu[íi]a|Bolet[íi]n|Formulario|Manual|Vademécum|Vademecum)[^.]{0,70}(Hospital|Facultad|Universidad|Instituto|Sanatorio)',
    '(Hospital|Facultad|Universidad|Instituto)[^.]{0,70}(Gu[íi]a|Bolet[íi]n|Formulario|Manual|Farmacoterap|Farmacia)',
    // Normas técnicas: la ISO va con número, que es lo que la hace rastreable.
    '(ISO|IRAM|IEC)\\s*\\d{3,5}',
    // Seguridad del medicamento: el ISMP es la referencia del área.
    'ISMP',
    // Revistas con año y volumen, y las sociedades científicas argentinas.
    '(Arch(ivos)? Argent|Fronteras en Medicina|Medicina \\(B(uenos)? Aires\\)|Farm Hosp|Rev(ista)? Argent)[^.]{0,40}\\d{4}',
    '(Consejo|Colegio|Sociedad|Asociación|Asociacion)\\s+Argentin[oa]',
    // Guías y consensos: exigen entidad que los firme, no la palabra suelta.
    '(guía|guia|consenso|guidelines?)[^.]{0,60}(Sociedad|Asociación|Asociacion|Ministerio|OMS|OPS|Colegio|Federación|Federacion|Academia|ACLS|AHA)',
    '(Sociedad|Asociación|Asociacion|Colegio|Federación|Federacion|Academia) (Argentina|Española|Espanola|Americana|Internacional)[^.]{0,40}',
    // Normativa: la ley va con número.
    '(Ley|LEY|Decreto|Disposición|Disposicion|Resolución|Resolucion)\\s*N?[°º]?\\s*\\d',
    // El envase del propio producto.
    'prospecto|ficha técnica|ficha tecnica|vademécum|vademecum'
  ].join('|'),
  'i'
)

/**
 * Frases que señalan afuera de la tarjeta.
 *
 * Es la misma idea que `SENALA_AFUERA` en el generador, y acá vale para el mazo
 * escrito a mano: la app muestra texto plano, sin imágenes ni tablas, así que
 * una tarjeta que dice "ver la tabla" no se puede responder.
 */
const PATRON_AFUERA = /(en la (imagen|figura|tabla|captura|lámina|lamina)|como se ve en|el siguiente (esquema|cuadro)|ver el cuadro)/i

interface Falla {
  carrera: string
  materia: string
  unidad: string
  frente: string
  motivo: string
}

export function run(): void {
  const fallas: Falla[] = []
  let conDosis = 0
  let total = 0

  for (const mazo of MAZOS_DE_REGALO) {
    for (const t of mazo.tarjetas) {
      total++
      const texto = `${t.frente} ${t.dorso}`

      if (PATRON_AFUERA.test(texto)) {
        fallas.push({
          carrera: mazo.carrera,
          materia: mazo.materia,
          unidad: mazo.unidad,
          frente: t.frente,
          motivo: 'Señala afuera de la tarjeta (imagen, tabla o esquema), y acá no hay imágenes.'
        })
      }

      if (PATRON_DOSIS.test(texto)) {
        conDosis++
        /*
         * Se mira el CAMPO `fuente`, no el dorso. La primera versión rastreaba el
         * dorso con una expresión regular y por eso aceptaba la palabra suelta
         * "guía": escribir "según la guía" satisfacía la regla que corta el build.
         * Con un campo propio, o está o no está.
         */
        const cita = (t.fuente ?? '').trim()
        if (cita.length === 0) {
          fallas.push({
            carrera: mazo.carrera,
            materia: mazo.materia,
            unidad: mazo.unidad,
            frente: t.frente,
            motivo: 'Dice una dosis o una concentración y no tiene campo `fuente`.'
          })
        } else if (!PATRON_FUENTE.test(cita)) {
          fallas.push({
            carrera: mazo.carrera,
            materia: mazo.materia,
            unidad: mazo.unidad,
            frente: t.frente,
            motivo: `La fuente no es nombrable ni verificable: ${JSON.stringify(cita.slice(0, 90))}. Hace falta el organismo, la sociedad que firma la guía, la ley con número o el texto con año o edición.`
          })
        }
      }
    }
  }

  console.log(`Tarjetas revisadas: ${total}. Con dosis o concentración: ${conDosis}.`)

  if (fallas.length > 0) {
    console.error(`\n${fallas.length} tarjeta(s) no cumplen la regla:\n`)
    for (const f of fallas.slice(0, 40)) {
      console.error(`  [${f.carrera} · ${f.materia} · ${f.unidad}]`)
      console.error(`    ${f.frente}`)
      console.error(`    → ${f.motivo}\n`)
    }
    if (fallas.length > 40) console.error(`  … y ${fallas.length - 40} más.\n`)
    throw new Error(`${fallas.length} tarjeta(s) incumplen la regla de dosis o señalan afuera.`)
  }

  console.log('OK: ninguna dosis sin fuente, ninguna tarjeta que señale afuera.')
}

/*
 * Se llama desde el nivel superior, y esto NO es un detalle de estilo.
 *
 * `scripts/run-qa.mjs` empaqueta este archivo y lo ejecuta con Electron como un
 * script suelto: NUNCA busca ni llama a una función exportada. Las tres primeras
 * versiones de este arnés sólo exportaban `run()` — se empaquetaban, corrían,
 * devolvían exit 0 y no comprobaban absolutamente nada. Un arnés que no corre es
 * peor que ninguno, porque da confianza falsa.
 *
 * `app.exit(1)` es lo que corta el build.
 */
app.whenReady().then(
  () => {
    try {
      run()
      app.exit(0)
    } catch (err) {
      console.error(`
❌ ${(err as Error).message}`)
      app.exit(1)
    }
  },
  (err) => {
    console.error('El arnés no pudo arrancar:', err)
    app.exit(1)
  }
)
