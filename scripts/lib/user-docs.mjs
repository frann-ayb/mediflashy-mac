/**
 * Textos que lee el comprador. Viven acá, en un solo lugar, para que el archivo
 * que va suelto junto al build y el que va en la carpeta de Drive nunca se
 * contradigan.
 *
 * Los nombres de archivo se reciben como parámetro porque en la carpeta de Drive
 * llevan un número adelante para que Drive los ordene solos.
 *
 * ---------------------------------------------------------------------------
 * De dónde viene este archivo
 * ---------------------------------------------------------------------------
 *
 * Es el de Convertexto, adaptado. La ESTRUCTURA se conserva entera —los mismos
 * documentos, la misma numeración de Drive, el mismo tono, la misma lógica
 * condicional por plataforma— porque ya está probada contra compradores reales.
 * Lo que cambia es el contenido específico del producto: donde decía grabar y
 * transcribir, ahora dice cargar un apunte y generar tarjetas.
 *
 * El CONTRATO (`buildEula`) se reutiliza casi textual, y eso no es pereza: su
 * cláusula 1.4 declara explícitamente que identifica al Software POR SU ORIGEN y
 * no por su nombre, y que alcanza a cualquier programa que el Licenciante
 * entregue "se distribuyan bajo el mismo nombre comercial o bajo otro distinto".
 * Está escrito para servir a más de un producto del mismo vendedor. Lo que sí se
 * adaptó son las cláusulas que describen QUÉ HACE el programa, porque ahí decir
 * lo que no es sería una declaración falsa en un contrato.
 *
 * `buildLicenses` NO está acá: el aviso de terceros lo arma
 * `scripts/write-licenses.mjs`, leyendo las dependencias y los VERSION.txt reales
 * del árbol. Tener dos generadores del mismo documento sería tener dos verdades.
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** La raíz del proyecto: este archivo vive en `scripts/lib/`. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Nombre del producto tal como queda instalado.
 *
 * La autoridad es `productName` de electron-builder.yml: de ahí sale el nombre
 * del bundle instalado —en Mac `/Applications/<nombre>.app`, en Windows la
 * carpeta de datos `%APPDATA%\<nombre>`— y los documentos tienen que
 * decir lo mismo, porque una ruta o un comando de Terminal escritos contra un
 * nombre que no existe fallan en silencio.
 *
 * SE LEE DEL YML, NO SE COPIA ACÁ, y no es prolijidad: la versión anterior
 * declaraba la autoridad en este mismo comentario y después copiaba el valor a
 * mano. Cuando el producto pasó a llamarse Mediflashy, el yml cambió y esta
 * constante no, así que los documentos mandaban al comprador a
 * `%APPDATA%\Psicoflashy\logs` —una carpeta que en su máquina no existe— justo
 * cuando algo le andaba mal y necesitaba el log. Un valor copiado se desincroniza;
 * uno leído no puede.
 */
function productNameDeBuilder() {
  const yml = readFileSync(join(RAIZ, 'electron-builder.yml'), 'utf8')
  const m = yml.match(/^productName:(.*)$/m)
  const nombre = m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  if (!nombre) {
    throw new Error(
      'electron-builder.yml no declara productName. Es el nombre con el que la app queda ' +
        'instalada, y de él dependen todas las rutas que los documentos le dan al comprador.'
    )
  }
  return nombre
}

export const APP_NAME = productNameDeBuilder()

/**
 * ¿La entrega lleva la carpeta de material de regalo?
 *
 * ---------------------------------------------------------------------------
 * Hoy es `false`, y no es un olvido
 * ---------------------------------------------------------------------------
 *
 * El material de regalo que existe en el árbol es el de Psicoflashy: cuatro
 * apuntes (Psicoanálisis, Desarrollo, Psicopatología, Social), el mapa de
 * autores, las parejas de conceptos y los simulacros de las catorce materias de
 * Psicología. Mediflashy vende Farmacología. Meter eso en la carpeta no sería
 * "algo de más": el comprador de Farmacología abriría un bonus sobre Freud y la
 * conclusión razonable es que le vendieron el producto equivocado. Es peor que
 * no mandar nada.
 *
 * La landing ya lo dice en un comentario para quien publica: los tres bonus de
 * Farmacología —los simulacros por carrera, el mapa de grupos por sufijo y los
 * pares que se confunden— todavía no existen, y sus números están en "+000".
 * Mientras esa sección no se genere o no se baje de la landing, la entrega va
 * sin bonus y lo dice de frente.
 *
 * ---------------------------------------------------------------------------
 * Por qué una constante y no borrar el código
 * ---------------------------------------------------------------------------
 *
 * Son TRES lugares los que tienen que estar de acuerdo —`make-drive-folder.mjs`
 * arma la carpeta, `qa/entrega.mjs` la valida y `guias.mjs` la describe en el
 * PDF que el comprador lee—. Con el dato en tres lugares, activarlo después
 * significa acordarse de los tres, y el que se olvide produce justo el error que
 * más caro sale: o una carpeta prometida que no está, o una que está y que el
 * validador no mira. Acá es una línea.
 *
 * Para encenderlo: generar el material de Farmacología, poner esto en `true`,
 * y actualizar en `qa/entrega.mjs` qué archivos espera encontrar.
 */
export const HAY_BONUS = false

/**
 * ¿El mapa de los grupos farmacológicos viaja en la entrega?
 *
 * Es una constante APARTE de `HAY_BONUS` y no una tercera opción del mismo
 * flag, porque son dos materiales de origen distinto. `HAY_BONUS` gobierna los
 * cuatro apuntes de arranque y los tres bonus grandes que hoy son de
 * Psicología y siguen sin adaptar. Este mapa es nuevo, se escribió para
 * Farmacología, se verificó contra Goodman & Gilman y contra ANMAT, y no
 * depende de que el resto del material de regalo exista. Fundirlo en el mismo
 * flag habría significado esperar a los otros tres para publicar este.
 */
export const HAY_MAPA_GRUPOS = true

/**
 * Ruta del bundle instalado en Mac, ya entrecomillada.
 *
 * "Mediflashy" no lleva espacios, así que hoy las comillas no son
 * imprescindibles. Se dejan igual porque son gratis y porque protegen del día que
 * el nombre sí tenga uno: sin ellas, la Terminal partiría el argumento en dos y el
 * comando no haría nada. En Convertexto ya pasó, con "Transcriptor 2".
 */
const MAC_APP = `"/Applications/${APP_NAME}.app"`

/**
 * Nombres de los archivos tal como los ve el comprador.
 *
 * El número de adelante existe para que Drive los ordene solos, así que tiene
 * que ser correlativo: una entrega sólo para Mac numerada 1, 2b, 2c, 4, 5, 6 se
 * ve incompleta —falta el 3— y lo primero que hace el comprador es escribir
 * preguntando qué no se le descargó. Por eso los números salen de lo que
 * realmente lleva la entrega y no de una lista fija.
 *
 * Con las dos plataformas se conserva el esquema 2b/2c de siempre: deja los
 * .dmg pegados al bloque de Windows y no mueve ningún otro número.
 *
 * `hasMac` se recibe por simetría con el resto de los generadores; para numerar
 * alcanza con saber si hay Windows, porque si no hay Mac esos dos nombres
 * directamente no se usan.
 */
export function driveFiles({ hasWindows = true } = {}) {
  const macArm = hasWindows ? '2b.' : '2.'
  const macIntel = hasWindows ? '2c.' : '3.'
  return {
    readme: '1. LEEME PRIMERO.txt',
    installer: `2. ${APP_NAME} - Instalador Windows.exe`,
    portable: `3. ${APP_NAME} - Portable, sin instalar (Windows).exe`,
    help: '4. Ayuda y solución de problemas.txt',
    licenses: '5. Licencias de los componentes.txt',
    eula: '6. Licencia de uso.txt',
    // Va después del contrato porque es su anexo: la definición de "defecto"
    // de la cláusula 11 cuelga de este archivo (ver buildRequisitos).
    requisitos: '7. Requisitos y funciones.txt',
    /*
     * Las dos guías de estudio, sueltas en la carpeta y no adentro del material
     * de regalo.
     *
     * Antes vivían dentro de "Apuntes de regalo", numeradas 5 y 6. Estaban mal
     * ubicadas: no son un regalo, son cómo se usa lo que compró. La del método
     * explica por qué el repaso espaciado funciona —que es la promesa del
     * producto— y el recetario es lo único que enseña a sacarle algo a la
     * pestaña Generar, que es la otra mitad de la app. Enterradas en una
     * subcarpeta, el comprador no las abría.
     */
    metodo: '8. Cómo estudiar con repaso espaciado.pdf',
    recetario: '9. Recetario de instrucciones.pdf',
    // El único bonus que hoy existe de verdad. Ver HAY_MAPA_GRUPOS.
    mapaGrupos: '10. El mapa de los grupos.pdf',
    macArm: `${macArm} ${APP_NAME} - Mac con chip M1 M2 M3 M4.dmg`,
    macIntel: `${macIntel} ${APP_NAME} - Mac con procesador Intel.dmg`
  }
}

/**
 * La numeración de la entrega completa (Windows + Mac), que es exactamente la
 * que había antes de que esto fuera una función. La usan los importadores que no
 * saben qué plataformas lleva la entrega y sirve de valor por defecto.
 */
export const DRIVE_FILES = driveFiles({ hasWindows: true, hasMac: true })

/** Nombre del aviso de licencias donde no hay numeración de Drive. */
export const LICENSES_FILE = 'LICENCIAS DE TERCEROS.txt'

/** Nombre del contrato de licencia donde no hay numeración de Drive. */
export const EULA_FILE = 'LICENCIA DE USO.txt'

/**
 * Nombre del anexo del contrato donde no hay numeración de Drive.
 *
 * Va con los otros dos porque los tres viajan juntos adentro del paquete: el
 * contrato define "defecto" comparando contra este archivo, así que entregar uno
 * sin el otro deja la cláusula 11.10 colgada.
 */
export const REQUISITOS_FILE = 'REQUISITOS Y FUNCIONES.txt'

/**
 * Datos del vendedor que el contrato de licencia necesita para ser exigible.
 *
 * Están todos acá, en un solo lugar, porque aparecen repetidos a lo largo del
 * contrato y porque la Ley 24.240 (art. 4) y la Res. 104/2005 obligan a
 * identificar al proveedor: sin esto, el EULA es un borrador, no un contrato.
 *
 * HAY DOS CLASES DE CAMPO, y la diferencia importa:
 *
 *   · OBLIGATORIOS (`CAMPOS_OBLIGATORIOS`, más abajo). Sostienen una cláusula: si
 *     faltan, la cláusula queda sin sentido o directamente vacía. Los marcadores
 *     `[ASÍ]` los detecta `hasPlaceholders()`, y `datosFaltantes()` detecta además
 *     el caso de dejarlos en blanco.
 *
 *   · OPCIONALES (los que arrancan en `''`). Son datos de identificación
 *     adicionales: si están, el contrato los declara; si no, la frase se arma sin
 *     ellos y queda bien redactada igual. NO hay que rellenarlos con un guión ni
 *     con "N/A": dejalos vacíos y listo.
 *
 * Sobre el domicilio, porque conviene decidirlo a conciencia: si lo completás,
 * viaja en el contrato que baja cada comprador Y adentro del .app (va a
 * `resources/` por extraResources), así que no se puede retirar de las copias ya
 * entregadas. Si vendés desde tu casa, lo habitual es poner un domicilio fiscal o
 * comercial en lugar del particular. Que quede vacío es una opción, pero si esto
 * es una venta a consumidores conviene chequear con tu contador qué datos del
 * proveedor son exigibles antes de omitirlo.
 */
export const LICENCIANTE = {
  // --- Obligatorios ---------------------------------------------------------
  /*
   * El nombre comercial con el que se vende, y con el que contrata el comprador.
   *
   * NO es el del certificado Developer ID. Apple emite los certificados a
   * nombre de una persona física o de una empresa registrada, nunca de un
   * nombre de fantasía, así que la firma de la app dice otra cosa: el CN está
   * en `electron-builder.yml` (`mac.identity`) y ahí tiene que quedar letra por
   * letra como lo emitió Apple, o la firma se rompe.
   *
   * Ningún documento que recibe el comprador nombra ese certificado. Antes el
   * instructivo de Mac traía un `codesign -dv` diciéndole qué nombre iba a ver;
   * se sacó a pedido. La app sigue firmada y notarizada, y la Mac la verifica
   * sola en cada arranque.
   */
  nombre: 'Digiconocimiento',
  // Sostiene la cláusula 14.1 (el canal de soporte) y el "escribinos" del
  // instructivo. En Convertexto sostiene además la oferta de código fuente que
  // pide la LGPL de FFmpeg; acá no hay ningún componente LGPL, así que esa
  // obligación no aplica.
  email: 'infoycontacto.store@gmail.com',
  // Las dos sostienen la cláusula 17.2 (jurisdicción). Vacías dejarían
  // "los tribunales ordinarios de , ", que es una cláusula nula.
  ciudad: 'Neuquén',
  provincia: 'Neuquén',
  // Fecha de vigencia del contrato. No se genera automáticamente a propósito: si
  // saliera de la fecha del build, la misma versión del contrato afirmaría fechas
  // distintas en cada compilación.
  vigenciaDesde: '8 de agosto de 2026',

  // --- Opcionales: dejalos en '' si no los querés declarar ------------------
  cuit: '',
  domicilio: '',
  web: '',
  // Si está, la cláusula 14.1 promete un plazo orientativo de respuesta. Si queda
  // vacío, la cláusula dice sólo "con esfuerzos razonables, en días hábiles, en
  // español", sin comprometer ningún plazo.
  plazoSoporte: '',

  // --- Términos comerciales -------------------------------------------------
  // Cuántas computadoras puede usar UN comprador con una licencia. Es una decisión
  // de negocio, no técnica: la app no verifica nada, no hay clave de activación ni
  // registro, así que este número vive sólo en el contrato. En 1 la licencia es
  // estrictamente individual: una persona, una computadora.
  equipos: 1,
  contratoVersion: '1.0'
  // `anio` (el del copyright) NO está acá: se deduce de `vigenciaDesde`. Tenerlo
  // como campo aparte permitía que quedaran desincronizados —contrato vigente
  // desde 2026 y "© 2025"— sin que nada lo detectara.
}

/**
 * Los que sostienen una cláusula. Si falta alguno, el contrato no se emite.
 * @see LICENCIANTE
 */
export const CAMPOS_OBLIGATORIOS = ['nombre', 'email', 'ciudad', 'provincia', 'vigenciaDesde']

/**
 * Qué campos obligatorios están sin completar, ya sea porque quedó el marcador
 * `[ASÍ]` o porque están en blanco.
 *
 * POR QUÉ EXISTE, aparte de `hasPlaceholders()`: ese chequeo mira el texto YA
 * GENERADO buscando corchetes, y desde que hay campos que legítimamente van
 * vacíos, un obligatorio en blanco no deja ningún corchete que encontrar. El
 * contrato saldría diciendo `"El Licenciante" (también "nosotros") es .` y los dos
 * chequeos darían verde. Esta función mira los datos de entrada, no la salida.
 *
 * @returns {string[]} nombres de los campos que faltan; vacío si está todo
 */
export function datosFaltantes(licenciante = LICENCIANTE) {
  return CAMPOS_OBLIGATORIOS.filter((campo) => {
    const valor = String(licenciante?.[campo] ?? '').trim()
    return valor === '' || hasPlaceholders(valor)
  })
}

/** ¿Quedó algún marcador `[ASÍ]` sin completar en un texto generado? */
export function hasPlaceholders(text) {
  return /\[[A-ZÁÉÍÓÚÑ0-9 ,.ÁÉÍÓÚ/-]{3,}\]/.test(text)
}

/**
 * Une fragmentos con comas, salteando los vacíos, y corta en renglones de ancho
 * fijo con sangría. Es lo que permite que la presentación del Licenciante en la
 * cláusula 1.1 se arme sola con los datos que haya, sin dejar comas colgando ni
 * huecos donde iba un campo opcional.
 *
 * @param {string[]} fragmentos  partes de la frase; los vacíos se descartan
 * @param {number} ancho         columnas útiles del renglón
 * @param {string} sangria       lo que va delante de los renglones 2 en adelante
 * @param {string} final         qué cerrar la frase (por defecto, un punto)
 */
export function frase(fragmentos, { ancho = 72, sangria = '     ', final = '.' } = {}) {
  // `filter(Boolean)` va PRIMERO: los fragmentos se arman con `dato && \`texto\``,
  // que devuelve `false` cuando el dato falta. Convertir antes a string daría
  // `"false"`, que no es vacío y terminaría impreso en el contrato.
  const texto =
    fragmentos
      .filter(Boolean)
      .map((f) => String(f).trim())
      .filter(Boolean)
      .join(', ') + final
  const renglones = []
  let actual = ''
  for (const palabra of texto.split(/\s+/)) {
    // El primer renglón ya viene precedido por el número de cláusula, así que
    // todos se miden contra el mismo ancho útil.
    if (actual && `${actual} ${palabra}`.length > ancho) {
      renglones.push(actual)
      actual = palabra
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra
    }
  }
  if (actual) renglones.push(actual)
  return renglones.map((r, i) => (i === 0 ? r : sangria + r)).join('\n')
}

const LINE = '==============================================================================='

/**
 * Hoja de ruta corta: qué bajar y qué avisos esperar. Es lo primero (y a veces
 * lo único) que el comprador va a leer, así que va al grano.
 */
/**
 * OBSOLETA — no la llames. Quedó reemplazada por `guiaInicio()` de
 * `scripts/lib/guias.mjs`.
 *
 * Su texto describe una versión anterior del producto: nombra los apuntes de
 * regalo de Anatomía y Derecho —que ya no existen— y no menciona el repaso
 * libre, las recomendaciones de Progreso ni el tema claro. Entregarlo hoy sería
 * darle al comprador un manual de otra app.
 *
 * Se conserva el cuerpo, y no se borra, porque de acá salieron las frases que
 * el contrato referencia y conviene poder leerlas. El `throw` está para que no
 * pueda volver a entregarse por accidente.
 */
export function buildReadme({ names, hasWindows, hasMac }) {
  throw new Error('buildReadme() está obsoleta: usá guiaInicio() de scripts/lib/guias.mjs.')
  const parts = []

  parts.push(LINE)
  parts.push(`  ${APP_NAME.toUpperCase()} — EMPEZÁ POR ACÁ`)
  parts.push(LINE)
  parts.push('')
  parts.push('¡Gracias por tu compra!')
  parts.push('')
  parts.push(`${APP_NAME} convierte tus apuntes en tarjetas de estudio y después te`)
  parts.push('las va tomando, todo en tu propia computadora:')
  parts.push('')
  parts.push('  GENERA  tarjetas a partir de un PDF, un Word, un PowerPoint o')
  parts.push('          texto que pegues. Las revisás vos antes de guardarlas.')
  parts.push('')
  parts.push('  TE TOMA esas tarjetas espaciándolas en el tiempo: las que te')
  parts.push('          cuestan vuelven seguido y las que ya sabés, cada vez')
  parts.push('          más lejos.')
  parts.push('')
  parts.push('No se sube ningún archivo a internet y no pagás por uso.')
  parts.push('')
  parts.push('')
  parts.push('DESCARGÁ UN SOLO ARCHIVO DE ESTA CARPETA')
  parts.push('----------------------------------------')
  parts.push('')

  if (hasWindows) {
    parts.push('  Si usás WINDOWS, elegí una de estas dos opciones:')
    parts.push('')
    parts.push('     ¿Querés instalarlo como cualquier otro programa?')
    parts.push(`        →  ${names.installer}`)
    parts.push('           (recomendado: te deja el ícono en el Escritorio)')
    parts.push('')
    parts.push('     ¿Preferís no instalar nada?')
    parts.push(`        →  ${names.portable}`)
    parts.push('           (se abre con doble clic; podés llevarlo en un pendrive')
    parts.push('           y tus materias viajan con él)')
    parts.push('')
    parts.push('  Los dos son exactamente la misma app. Con uno alcanza.')
    parts.push('')
  }

  if (hasMac) {
    parts.push('  Si usás MAC:')
    parts.push('')
    parts.push(`     Chip M1, M2, M3 o M4  →  ${names.macArm}`)
    parts.push(`     Procesador Intel      →  ${names.macIntel}`)
    parts.push('')
    parts.push('     ¿No sabés cuál tenés? Menú Apple (arriba a la izquierda) →')
    parts.push('     "Acerca de esta Mac". Ahí lo dice.')
    parts.push('')
    // El minimo se declara aca, en el primer archivo que se lee, y no solo en el
    // contrato: alguien con una Mac vieja tiene que enterarse ANTES de bajar el
    // instalador e instalar algo que no va a abrir.
    parts.push('     Hace falta macOS 12 (Monterey) o posterior. En esa misma')
    parts.push('     pantalla, "Acerca de esta Mac", figura la versión que tenés.')
    parts.push('')
  } else {
    parts.push('  NOTA: esta versión es para Windows. Si usás Mac, escribime y te')
    parts.push('  paso la versión para tu equipo.')
    parts.push('')
  }

  parts.push('')
  if (hasWindows) {
    parts.push('DOS AVISOS QUE VAN A APARECER (Y SON NORMALES)')
    parts.push('---------------------------------------------')
  } else {
    parts.push('UN AVISO QUE VA A APARECER (Y ES NORMAL)')
    parts.push('----------------------------------------')
  }
  parts.push('')
  parts.push('1) Al DESCARGAR, Google Drive puede decir:')
  parts.push('   "No se puede analizar el archivo en busca de virus".')
  parts.push('')
  parts.push('   Pasa con cualquier archivo grande, no es una advertencia sobre la')
  parts.push('   app. Hacé clic en "Descargar de todos modos".')
  parts.push('')

  if (hasWindows) {
    parts.push('2) Al ABRIR por primera vez, Windows va a pedirte una confirmación')
    parts.push('   extra. No es un virus.')
    parts.push('')
    parts.push('   Vas a ver una pantalla azul: "Windows protegió tu PC".')
    parts.push('      a) Hacé clic en el texto "Más información".')
    parts.push('      b) Aparece un botón abajo: "Ejecutar de todas formas".')
    parts.push('      c) Hacé clic ahí y listo.')
    parts.push('')
  }

  if (hasMac) {
    parts.push('CÓMO INSTALARLA EN MAC')
    parts.push('----------------------')
    parts.push('')
    parts.push('   a) Doble clic en el .dmg. Se abre una ventana con el ícono de')
    parts.push(`      ${APP_NAME}: arrastralo sobre la carpeta "Aplicaciones"`)
    parts.push('      que aparece al lado. Después expulsá el disco (la flechita')
    parts.push('      que aparece al lado del nombre, en el Finder).')
    parts.push('')
    parts.push(`   b) Abrí ${APP_NAME} desde Aplicaciones, con doble clic.`)
    parts.push('')
    parts.push('      Y listo, no hay ningún paso más. La app está firmada y')
    parts.push('      certificada por Apple, así que no vas a ver ningún aviso de')
    parts.push('      seguridad ni tenés que autorizar nada.')
    parts.push('')
    parts.push('      La primera vez puede tardar unos segundos en abrir: macOS')
    parts.push('      está verificando el certificado. Después abre al instante.')
    parts.push('')
    // A diferencia de Convertexto, aca NO hay ningun permiso que conceder: la app
    // no toca el microfono ni la pantalla. Decirlo es informacion util, no relleno:
    // quien viene del otro producto espera el cartel y se preocupa si no aparece.
    parts.push('   c) No pide ningún permiso: no usa el micrófono, ni la cámara, ni')
    parts.push('      graba la pantalla. Lo único que abre son los apuntes que vos')
    parts.push('      elegís.')
    parts.push('')
    parts.push(`   Si algo no sale como dice acá, mirá "${names.help}".`)
    parts.push('')
  }

  parts.push('')
  parts.push('LA APP TIENE CUATRO PESTAÑAS, ARRIBA')
  parts.push('------------------------------------')
  parts.push('')
  parts.push('  BIBLIOTECA')
  parts.push('')
  parts.push('  Tus materias, con sus unidades adentro y las tarjetas de cada')
  parts.push('  unidad. Acá creás, renombrás, corregís y borrás. Arriba hay un')
  parts.push('  buscador que encuentra cualquier tarjeta aunque no te acuerdes')
  parts.push('  en qué materia estaba.')
  parts.push('')
  parts.push('  PASAR MAZOS DE UNA COMPUTADORA A OTRA')
  parts.push('')
  parts.push('  Pasando el mouse por encima de una materia aparece una flecha')
  parts.push('  hacia abajo: guarda esa materia entera —con sus unidades y sus')
  parts.push('  tarjetas— en un archivo. Para traer uno, la flecha hacia arriba')
  parts.push('  que está al lado del "+" de Materias.')
  parts.push('')
  parts.push('  El archivo lleva SOLO las tarjetas. Tu progreso de estudio no')
  parts.push('  viaja, y es a propósito: quien lo abra tiene que arrancar de')
  parts.push('  cero, no heredar qué te sabías vos.')
  parts.push('')
  parts.push('  Si al importar ya tenés una materia con ese nombre, la app te')
  parts.push('  pregunta si querés agregar las tarjetas ahí o dejarlas en una')
  parts.push('  materia aparte. En los dos casos, las que ya tengas no se')
  parts.push('  duplican.')
  parts.push('')
  parts.push('  GENERAR')
  parts.push('')
  parts.push('  1. Pegá el texto de tu apunte, o cargá un archivo (PDF, Word,')
  parts.push('     PowerPoint o .txt). También podés arrastrarlo a la ventana.')
  parts.push('')
  parts.push('     PEGAR EL TEXTO A MANO DA MEJORES RESULTADOS. Un PDF hay que')
  parts.push('     interpretarlo —columnas, encabezados, palabras cortadas al')
  parts.push('     final del renglón— y a veces sale desordenado. Lo que pegás')
  parts.push('     vos entra tal cual.')
  parts.push('')
  parts.push('     SI TENÉS VARIOS APUNTES DE LA MISMA UNIDAD, tocá "Elegir')
  parts.push('     varios" y marcalos todos juntos. La app los va a procesar')
  parts.push('     uno atrás del otro sola: podés dejar la computadora')
  parts.push('     trabajando e irte. Cuando termine el último, te muestra')
  parts.push('     TODAS las tarjetas juntas para que las revises de una vez.')
  parts.push('     Si alguno de los archivos no se puede leer, los demás')
  parts.push('     siguen igual y después te dice cuál falló.')
  parts.push('')
  parts.push('  2. Elegí en qué materia y unidad se van a guardar. Si todavía no')
  parts.push('     las creaste, hay un botón "+" al lado de cada selector.')
  parts.push('  3. Elegí el formato de las tarjetas y, si querés, escribile una')
  parts.push('     indicación ("enfocate en las fechas y los nombres").')
  parts.push('  4. Tocá "Generar tarjetas" y esperá.')
  parts.push('  5. REVISÁ LO QUE SALIÓ antes de guardar. Podés corregir el texto')
  parts.push('     de cada tarjeta y descartar las que no sirvan.')
  parts.push('')
  parts.push('  La primera vez, la app descarga su motor de generación y te muestra')
  parts.push('  el progreso. Necesitás internet SOLO para esa descarga; después')
  parts.push('  funciona sin conexión.')
  parts.push('')
  parts.push('  ESTUDIAR')
  parts.push('')
  parts.push('  1. Elegí una materia entera o una unidad suelta.')
  parts.push('  2. Te muestra el frente de una tarjeta. RESPONDÉ EN TU CABEZA')
  parts.push('     antes de mirar: ése es el ejercicio, no leer la respuesta.')
  parts.push('  3. Tocá "Mostrar resultado" (o la barra espaciadora) y compará.')
  parts.push('  4. Elegí "No la sabía", "Más o menos" o "La sabía" — o las teclas')
  parts.push('     1, 2 y 3. Según lo que elijas, la app decide cuándo te la')
  parts.push('     vuelve a mostrar.')
  parts.push('')
  parts.push('  PROGRESO')
  parts.push('')
  parts.push('  Cuánto sabés de cada materia, cuántos días seguidos venís')
  parts.push('  estudiando y qué porcentaje acertás al repasar.')
  parts.push('')
  parts.push('')

  // El regalo se anuncia acá, entre las cuatro pantallas y las advertencias,
  // porque es justo el momento en que el comprador ya entendió qué hace la app
  // y todavía no la abrió. Anunciarlo al final sería tarde: para entonces ya
  // está buscando un apunte propio, que es la fricción que esto viene a sacar.
  parts.push('PARA PROBARLA HOY MISMO, SIN BUSCAR NADA')
  parts.push('----------------------------------------')
  parts.push('')
  parts.push('  En la carpeta "8. Apuntes de regalo y guía de estudio" te dejé')
  parts.push('  cuatro apuntes listos para pegar: Anatomía, Derecho')
  parts.push('  Constitucional, Biología celular e Inglés técnico.')
  parts.push('')
  parts.push('  Abrí cualquiera, copiá el texto que está debajo de la línea de')
  parts.push('  guiones y pegalo en la pestaña Generar. En un minuto tenés unas')
  parts.push('  veinte tarjetas andando y ya viste el circuito completo.')
  parts.push('')
  parts.push('  Ahí adentro está también "Cómo estudiar con repaso espaciado":')
  parts.push('  diez minutos de lectura sobre cómo escribir una tarjeta que')
  parts.push('  sirva, cuántas generar por unidad y los tres errores que hacen')
  parts.push('  que la gente abandone antes del primer mes. Si nunca usaste')
  parts.push('  este método, leelo antes de cargar tu primera materia.')
  parts.push('')
  parts.push('')
  parts.push('LO QUE LA IA ESCRIBE HAY QUE LEERLO')
  parts.push('-----------------------------------')
  parts.push('')
  parts.push('  Las tarjetas las genera un modelo de inteligencia artificial a')
  parts.push('  partir de tu apunte. Es bueno, pero no es infalible: puede')
  parts.push('  confundir una fecha o dar vuelta una definición.')
  parts.push('')
  parts.push('  Por eso la app NUNCA guarda una tarjeta sin mostrártela antes.')
  parts.push('  Esa pantalla de revisión no es un trámite: es lo que separa')
  parts.push('  estudiar bien de memorizar algo equivocado para un final.')
  parts.push('')
  parts.push('  Tus apuntes y tus tarjetas quedan solamente en tu computadora. La')
  parts.push('  app no los sube a ningún lado, ni siquiera para generarlas.')
  parts.push('')
  parts.push('')
  parts.push(`¿Algo no funciona? Abrí "${names.help}".`)

  if (names.eula) {
    parts.push('')
    parts.push('')
    parts.push('LOS DOS ARCHIVOS LEGALES')
    parts.push('------------------------')
    parts.push('')
    parts.push(`  "${names.eula}" es tu licencia: qué podés hacer con el`)
    parts.push(`  programa y qué no. Usar ${APP_NAME} implica aceptarla, así que`)
    parts.push('  conviene que le des una leída: arranca con un resumen de 30')
    parts.push('  segundos. Ahí están también la garantía y cómo pedir el reembolso.')
    parts.push('')
  }
  if (names.licenses) {
    if (!names.eula) parts.push('')
    parts.push(`  "${names.licenses}" acredita el software libre que`)
    parts.push(`  usa ${APP_NAME}, bajo qué licencia y dónde está su código fuente.`)
    parts.push('')
  }
  parts.push('')
  parts.push(LINE)
  parts.push('')

  return parts.join('\n')
}

/**
 * Guía completa: paso a paso, qué esperar y qué hacer si algo falla.
 *
 * Recibe `licenciante` para poder mandar al comprador al mail de soporte sin
 * escribir una dirección a mano: así el marcador `[EMAIL DE CONTACTO Y SOPORTE]`
 * sin completar aparece también acá y `hasPlaceholders()` lo puede detectar.
 */
/**
 * OBSOLETA — no la llames. Quedó reemplazada por `guiaAyuda()` de
 * `scripts/lib/guias.mjs`.
 *
 * Su texto describe una versión anterior del producto: nombra los apuntes de
 * regalo de Anatomía y Derecho —que ya no existen— y no menciona el repaso
 * libre, las recomendaciones de Progreso ni el tema claro. Entregarlo hoy sería
 * darle al comprador un manual de otra app.
 *
 * Se conserva el cuerpo, y no se borra, porque de acá salieron las frases que
 * el contrato referencia y conviene poder leerlas. El `throw` está para que no
 * pueda volver a entregarse por accidente.
 */
export function buildHelp({ version, names, hasWindows, hasMac, licenciante = LICENCIANTE }) {
  throw new Error('buildHelp() está obsoleta: usá guiaAyuda() de scripts/lib/guias.mjs.')
  const parts = []
  const L = { ...LICENCIANTE, ...licenciante }

  parts.push(LINE)
  parts.push(`  ${APP_NAME.toUpperCase()} — AYUDA Y SOLUCIÓN DE PROBLEMAS`)
  parts.push(`  Versión ${version}`)
  parts.push(LINE)
  parts.push('')
  parts.push('Este archivo tiene el detalle completo. Si sólo querés empezar,')
  parts.push(`alcanza con "${names.readme}".`)
  parts.push('')

  if (hasWindows) {
    parts.push('')
    parts.push(LINE)
    parts.push('  WINDOWS — PASO A PASO')
    parts.push(LINE)
    parts.push('')
    parts.push(`1) Descargá "${names.installer}".`)
    parts.push('')
    parts.push('   Si Google Drive avisa que no puede analizar el archivo en busca de')
    parts.push('   virus, es por el tamaño. Tocá "Descargar de todos modos".')
    parts.push('')
    parts.push('2) Hacé doble clic en el archivo descargado.')
    parts.push('')
    parts.push('3) IMPORTANTE: es muy probable que aparezca una pantalla azul que dice')
    parts.push('   "Windows protegió tu PC" o "SmartScreen de Microsoft Defender".')
    parts.push('')
    parts.push('   Esto NO significa que el programa tenga un virus. Aparece porque la')
    parts.push('   app no tiene un certificado de firma digital.')
    parts.push('')
    parts.push('   Para continuar:')
    parts.push('      a) Hacé clic en el texto "Más información".')
    parts.push('      b) Aparece un botón nuevo abajo: "Ejecutar de todas formas".')
    parts.push('      c) Hacé clic en "Ejecutar de todas formas".')
    parts.push('')
    parts.push('4) Seguí el instalador (Siguiente → Instalar). Al terminar vas a tener')
    parts.push(`   el ícono de ${APP_NAME} en el Escritorio y en el menú Inicio.`)
    parts.push('')
    parts.push('5) Abrí la app. La primera vez te muestra una pantalla con los 3 pasos')
    parts.push('   de uso, con un casillero para no volver a verla.')
    parts.push('')
    parts.push('VERSIÓN PORTABLE')
    parts.push('')
    // El nombre del archivo va en su propio renglón: interpolado en medio de la
    // frase, con el nombre numerado y largo que se ve en Drive, la línea se iba
    // a 107 columnas y rompía el ancho del documento.
    parts.push('Si preferís no instalar nada, descargá')
    parts.push('')
    parts.push(`  "${names.portable}"`)
    parts.push('')
    parts.push('y hacé doble clic directamente. Funciona igual (también puede aparecer')
    parts.push('el aviso de SmartScreen del punto 3) y podés guardarlo en un pendrive.')
    parts.push('')
    parts.push('ANTIVIRUS')
    parts.push('')
    parts.push('Si tenés un antivirus distinto de Windows Defender y bloquea la app,')
    parts.push('agregala a las excepciones. Es por el mismo motivo: falta de firma.')
    parts.push('')
  }

  if (hasMac) {
    parts.push('')
    parts.push(LINE)
    parts.push('  MAC — PASO A PASO')
    parts.push(LINE)
    parts.push('')
    parts.push('1) Descargá el .dmg que corresponde a tu Mac:')
    parts.push('')
    parts.push(`      Chip M1/M2/M3/M4  →  ${names.macArm}`)
    parts.push(`      Procesador Intel  →  ${names.macIntel}`)
    parts.push('')
    parts.push('   ¿No sabés cuál tenés? Menú Apple → "Acerca de esta Mac".')
    parts.push('')
    parts.push('2) Hacé doble clic en el .dmg. Se abre una ventana con el ícono.')
    parts.push('')
    parts.push(`3) Arrastrá el ícono de ${APP_NAME} sobre la carpeta "Aplicaciones"`)
    parts.push('   que aparece al lado y esperá a que termine de copiar. Después')
    parts.push('   expulsá el disco: en el Finder, la flechita al lado del nombre.')
    parts.push('')
    // ACÁ ANTES HABÍA 95 LÍNEAS.
    //
    // El paso 4 decía "LA PRIMERA VEZ VA A FALLAR, y está bien que falle", y
    // seguían tres opciones (A: Ajustes del Sistema → "Abrir igualmente";
    // B: `xattr -cr` en la Terminal; C: `codesign --force --sign -`) más una
    // sección para Macs viejas. Todo eso existía porque la app estaba firmada
    // ad-hoc y Gatekeeper la bloqueaba.
    //
    // Ahora está firmada con Developer ID y NOTARIZADA por Apple, con el ticket
    // pegado al bundle. Gatekeeper la acepta a la primera: no hay cartel que
    // cerrar, no hay Ajustes que visitar, y no hay que pedirle a un comprador que
    // pegue comandos en la Terminal — que era, según la auditoría, el paso con más
    // riesgo de reembolso de toda la entrega.
    parts.push(`4) Abrí ${APP_NAME} desde Aplicaciones, con doble clic.`)
    parts.push('')
    parts.push('   Y listo. No hay ningún paso más.')
    parts.push('')
    parts.push('   No vas a ver ningún aviso de seguridad: la app está firmada con un')
    parts.push('   certificado de desarrollador de Apple y certificada por Apple')
    parts.push('   (notarizada). Tampoco tenés que tocar nada en Ajustes del Sistema')
    parts.push('   ni escribir nada en la Terminal.')
    parts.push('')
    parts.push('   La primera vez puede tardar unos segundos en abrir mientras macOS')
    parts.push('   verifica el certificado. Después abre al instante.')
    parts.push('')
    parts.push('5) No te va a pedir ningún permiso, y eso es esperable: la app no')
    parts.push('   usa el micrófono, ni la cámara, ni graba la pantalla. Lo único')
    parts.push('   que abre son los apuntes que vos elegís.')
    parts.push('')
  }

  parts.push(LINE)
  parts.push('  CÓMO SE GENERAN LAS TARJETAS')
  parts.push(LINE)
  parts.push('')
  parts.push('1) Andá a la pestaña "Generar" y poné el material. Tenés dos formas:')
  parts.push('')
  parts.push('   PEGAR EL TEXTO (recomendado)')
  parts.push('   Copiás el apunte de donde lo tengas y lo pegás en el cuadro')
  parts.push('   grande. Lo que pegás entra tal cual, sin que nadie lo')
  parts.push('   interprete, y por eso da los mejores resultados.')
  parts.push('')
  parts.push('   CARGAR UN ARCHIVO')
  parts.push('   Tocá "Elegir un archivo" o arrastralo a la ventana. Acepta PDF,')
  parts.push('   Word (.docx), PowerPoint (.pptx) y texto (.txt, .md).')
  parts.push('')
  parts.push('   La app saca el texto y te lo muestra en el mismo cuadro, para')
  parts.push('   que lo revises. SI VES FRASES MEZCLADAS O CORTADAS, arreglalas')
  parts.push('   ahí antes de generar: el modelo va a leer exactamente eso.')
  parts.push('')
  parts.push('2) Elegí DÓNDE se guardan: una materia y una unidad.')
  parts.push('')
  parts.push('   Si todavía no las creaste, no hace falta que salgas de esta')
  parts.push('   pantalla: el botón "+" al lado de cada selector las crea ahí')
  parts.push('   mismo.')
  parts.push('')
  parts.push('3) Elegí CÓMO las querés:')
  parts.push('')
  parts.push('   Formato    "Concepto y definición" pone el término adelante y')
  parts.push('              qué significa atrás. "Pregunta y respuesta" arma una')
  parts.push('              pregunta directa. "Mezcla" usa el que le convenga a')
  parts.push('              cada parte del texto.')
  parts.push('   Cantidad   "Pocas" saca nada más que lo principal. "Normal"')
  parts.push('              está en el medio y sirve para casi todo.')
  parts.push('              "Exhaustiva" recorre el apunte entero buscando los')
  parts.push('              temas uno por uno para no saltearse ninguno: saca')
  parts.push('              alrededor del triple de tarjetas y tarda bastante')
  parts.push('              más.')
  parts.push('   Idioma     En qué idioma se escriben las tarjetas.')
  parts.push('   Calidad    Rápida usa un modelo más chico (1,3 GB, anda con')
  parts.push('              4 GB de RAM). Detallada usa uno más grande (2,7 GB,')
  parts.push('              pide 8 GB) y arma mejores preguntas.')
  parts.push('')
  parts.push('4) Si querés, escribile una indicación en el cuadro de abajo:')
  parts.push('   "enfocate en las fechas y los nombres", "es para un final oral,')
  parts.push('   priorizá definiciones exactas". Hay ejemplos para tocar.')
  parts.push('')
  parts.push('   ESO NO SE GUARDA EN NINGÚN LADO. Se usa para esta generación y')
  parts.push('   se olvida cuando cerrás la app.')
  parts.push('')
  parts.push('5) Tocá "Generar tarjetas".')
  parts.push('')
  parts.push('   LA PRIMERA VEZ que usás cada calidad, la app descarga su modelo')
  parts.push('   y te muestra el progreso. Es una sola vez; después funciona sin')
  parts.push('   internet. Si la descarga se corta a la mitad, la próxima vez')
  parts.push('   sigue desde donde iba: no vuelve a empezar de cero.')
  parts.push('')
  parts.push('6) REVISÁ LAS TARJETAS ANTES DE GUARDAR.')
  parts.push('')
  parts.push('   Podés corregir el texto de cada una y descartar las que no')
  parts.push('   sirvan. Recién cuando tocás "Guardar" entran a tu biblioteca.')
  parts.push('')
  parts.push('   La app te avisa si descartó tarjetas: eso pasa cuando el modelo')
  parts.push('   propuso algo que no estaba respaldado por tu texto. Es la app')
  parts.push('   filtrando lo que se inventó, y es una buena señal.')
  parts.push('')
  parts.push('CUÁNTO TARDA')
  parts.push('')
  /* Los números salen medidos, no estimados: `node scripts/run-qa.mjs bonus` y
     el arnés e2e, sobre apuntes reales de facultad. Si se toca el troceado o la
     densidad hay que volver a medirlos. */
  parts.push('Depende de tu computadora, del largo del apunte, de la calidad y')
  parts.push('de la cantidad que hayas elegido.')
  parts.push('')
  parts.push('Como referencia, en una notebook común y con calidad Rápida, unas')
  parts.push('dos páginas de apunte tardan poco más de un minuto en "Normal" y')
  parts.push('unos tres o cuatro minutos en "Exhaustiva", que revisa el apunte')
  parts.push('entero y saca alrededor del triple de tarjetas.')
  parts.push('')
  parts.push('Si te parece que tarda demasiado, probá con "Normal" o con la')
  parts.push('calidad Rápida, o generá el apunte por partes.')
  parts.push('')
  parts.push('FORMATOS QUE ACEPTA')
  parts.push('')
  parts.push('  PDF · Word (.docx) · PowerPoint (.pptx) · texto (.txt, .md)')
  parts.push('')
  parts.push('  Un PDF ESCANEADO (una foto del apunte) no tiene texto adentro: la')
  parts.push('  app te lo dice y no lo procesa. En ese caso, copiá el texto a mano.')
  parts.push('')
  parts.push('')
  parts.push(LINE)
  parts.push('  CÓMO SE ESTUDIA')
  parts.push(LINE)
  parts.push('')
  parts.push('1) Andá a "Estudiar" y elegí una materia entera o una unidad suelta.')
  parts.push('   También podés entrar desde el botón "Estudiar" de la biblioteca.')
  parts.push('')
  parts.push('2) Te muestra el FRENTE de una tarjeta y nada más.')
  parts.push('')
  parts.push('   RESPONDÉ EN TU CABEZA ANTES DE MIRAR. Ése es el ejercicio: sacar')
  parts.push('   algo de la memoria es lo que lo fija. Leer la respuesta no.')
  parts.push('')
  parts.push('3) Tocá "Mostrar resultado" (o la barra espaciadora) y compará.')
  parts.push('')
  parts.push('4) Calificate con uno de los tres botones, o con las teclas 1, 2 y 3:')
  parts.push('')
  parts.push('   No la sabía   →  vuelve enseguida, en esta misma sesión')
  parts.push('   Más o menos   →  vuelve pronto, en un día o dos')
  parts.push('   La sabía      →  vuelve más adelante, cada vez más espaciada')
  parts.push('')
  parts.push('   Sé honesto al calificarte. Marcar "La sabía" cuando dudaste')
  parts.push('   engaña a la app, no al examen.')
  parts.push('')
  parts.push('EL LÍMITE DIARIO')
  parts.push('')
  parts.push('Cada materia tiene un ritmo: Tranquilo, Normal o Intenso. Sirve para')
  parts.push('que generar un mazo de 300 tarjetas no te haga aparecer las 300')
  parts.push('juntas el primer día.')
  parts.push('')
  parts.push('Se cambia desde la biblioteca: tocá la materia y vas a ver la')
  parts.push('pregunta "¿Cuánto querés estudiar por día?".')
  parts.push('')
  parts.push('EL DÍA EMPIEZA A LAS 4 DE LA MAÑANA')
  parts.push('')
  parts.push('Si estudiás a la una y media de la madrugada, para la app todavía es')
  parts.push('el día anterior. Es a propósito: así no gastás el cupo dos veces en')
  parts.push('una misma noche y no se te corta la racha un día que sí estudiaste.')
  parts.push('')

  parts.push(LINE)
  parts.push('  SI ALGO NO FUNCIONA')
  parts.push(LINE)
  parts.push('')
  parts.push('La app guarda un archivo de registro con el detalle de lo que pasó. Si')
  parts.push('tenés un problema, mandame ese archivo y lo reviso.')
  parts.push('')
  parts.push('Para encontrarlo: en la app, arriba a la derecha, tocá el ícono de la')
  parts.push('hoja de papel. Se abre la carpeta con el archivo "flashcards.log".')
  parts.push('')
  parts.push('También podés llegar a mano:')
  parts.push('')
  if (hasWindows) {
    parts.push(`   Windows:  %APPDATA%\\${APP_NAME}\\logs`)
    parts.push('             (pegá eso en la barra del Explorador de archivos)')
    parts.push('')
  }
  if (hasMac) {
    parts.push(`   Mac:      ~/Library/Application Support/${APP_NAME}/logs`)
    parts.push('')
  }
  parts.push('PROBLEMAS AL GENERAR TARJETAS')
  parts.push('')
  parts.push('  • "No se pudo abrir el PDF" / "Ese PDF está protegido con contraseña"')
  parts.push('    Abrilo con tu lector de PDF, guardalo sin contraseña y probá de')
  parts.push('    nuevo. Si no podés, copiá el texto a mano y pegalo.')
  parts.push('')
  parts.push('  • "Este PDF no tiene texto: sus páginas son imágenes"')
  parts.push('    Es un escaneo o una foto del apunte. La app no lee imágenes.')
  parts.push('    Copiá el texto a mano y pegalo en el cuadro.')
  parts.push('')
  parts.push('  • "Ese archivo parece ser un .doc del Word viejo"')
  parts.push('    Abrilo en Word, "Guardar como" y elegí "Documento de Word')
  parts.push('    (.docx)". El formato viejo, de antes de 2007, no se puede leer.')
  parts.push('')
  parts.push('  • El texto salió desordenado o con frases mezcladas')
  parts.push('    Pasa con PDFs a dos columnas. La app avisa cuando detecta uno.')
  parts.push('    Corregilo en el cuadro antes de generar, o —más rápido— copiá')
  parts.push('    el texto directamente del PDF y pegalo.')
  parts.push('')
  parts.push('  • Palabras pegadas o cortadas raro')
  parts.push('    Los PDF cortan palabras al final del renglón. La app las')
  parts.push('    reconstruye, pero no siempre acierta. Revisá el cuadro.')
  parts.push('')
  parts.push('  • "No hay memoria suficiente para este modelo"')
  parts.push('    Elegí la calidad Rápida, que anda bien con 4 GB de RAM. La')
  parts.push('    Detallada necesita 8 GB.')
  parts.push('')
  parts.push('  • "No hay espacio suficiente en disco"')
  parts.push('    El modelo Rápido ocupa 1,3 GB y el Detallado 2,7 GB. Liberá')
  parts.push('    espacio, o borrá el que no uses desde el botón "Modelos".')
  parts.push('')
  parts.push('  • "No hay conexión a internet"')
  parts.push('    Sólo hace falta internet la primera vez que usás cada calidad,')
  parts.push('    para descargar su modelo. Conectate y probá de nuevo.')
  parts.push('')
  parts.push('  • Salieron pocas tarjetas, o ninguna')
  parts.push('    Puede pasar por tres motivos:')
  parts.push('      - El texto es corto. Hacen falta al menos unas 60 palabras.')
  parts.push('      - El texto no tiene contenido para estudiar (un índice, una')
  parts.push('        bibliografía, una portada).')
  parts.push('      - El modelo propuso cosas que no estaban en el texto y la app')
  parts.push('        las descartó. Probá con la calidad Detallada o con un texto')
  parts.push('        más explicativo.')
  parts.push('')
  parts.push('  • Las tarjetas salieron flojas o demasiado obvias')
  parts.push('    Probá la calidad Detallada, subí la cantidad, o escribí una')
  parts.push('    indicación en el cuadro de abajo diciéndole en qué enfocarse.')
  parts.push('    Y acordate de que las filminas de PowerPoint suelen dar tarjetas')
  parts.push('    básicas: son el apoyo de una explicación hablada, no el apunte.')
  parts.push('')
  parts.push('  • Una tarjeta dice algo mal')
  parts.push('    Corregila: en la biblioteca, tocá la tarjeta y editala. Cambiar')
  parts.push('    el texto NO te hace perder el progreso de repaso que ya tenía.')
  parts.push('')
  parts.push('PROBLEMAS AL ESTUDIAR')
  parts.push('')
  parts.push('  • "Por hoy ya está: llegaste al límite diario"')
  parts.push('    Es el ritmo de la materia haciendo su trabajo. Si querés')
  parts.push('    avanzar más rápido, subilo desde la biblioteca: tocá la materia')
  parts.push('    y cambiá "¿Cuánto querés estudiar por día?".')
  parts.push('')
  parts.push('  • "No hay nada para repasar por ahora"')
  parts.push('    Ya estudiaste todo lo que tocaba hoy. Las tarjetas vuelven')
  parts.push('    solas cuando corresponde: ése es el punto del repaso espaciado.')
  parts.push('    Podés estudiar otra materia mientras tanto.')
  parts.push('')
  parts.push('  • Cambié una tarjeta y quiero que vuelva a empezar de cero')
  parts.push('    Abrí la tarjeta y tocá "Reiniciar progreso". Está separado del')
  parts.push('    botón de guardar a propósito: tira a la basura el historial de')
  parts.push('    repasos de esa tarjeta.')
  parts.push('')
  parts.push('  • El porcentaje de la materia sube muy despacio')
  parts.push('    Mide cuánto de tu mazo está en la memoria de LARGO plazo, no')
  parts.push('    cuántas acertaste hoy. Sube cuando acertás una tarjeta con')
  parts.push('    intervalos cada vez más largos, y eso lleva semanas. Es lento')
  parts.push('    porque es honesto.')
  parts.push('')
  parts.push('PROBLEMAS FRECUENTES')
  parts.push('')
  parts.push('  • Borré una materia sin querer')
  parts.push('    No se puede deshacer, y por eso la app pregunta antes diciendo')
  parts.push('    cuántas unidades y cuántas tarjetas se van a borrar. Leé ese')
  parts.push('    cartel: es la única red que hay.')
  parts.push('')
  parts.push('  • No encuentro una tarjeta')
  parts.push('    Usá el buscador de arriba en la biblioteca. Encuentra por')
  parts.push('    cualquier palabra del frente o del dorso, y no importan las')
  parts.push('    tildes ni las mayúsculas: "informacion" encuentra "información".')
  parts.push('')
  parts.push('  • Quiero mover una unidad a otra materia')
  parts.push('    Se puede, y se lleva sus tarjetas con todo su progreso.')
  parts.push('')
  parts.push('  • La app tarda en abrir')
  parts.push('    Con muchas tarjetas, el arranque lee toda tu biblioteca. Con')
  parts.push('    15.000 tarjetas son menos de dos segundos.')
  parts.push('')
  parts.push('  • ¿Dónde quedan mis tarjetas?')
  parts.push('    En tu computadora, en la carpeta de datos de la app (la misma')
  parts.push('    donde está el registro; ver más arriba). En la versión portable,')
  parts.push('    al lado del programa, así viajan con el pendrive.')
  parts.push('')
  parts.push('  • Tengo Convertexto instalado. ¿Se pisan?')
  parts.push('    No. Son dos programas distintos con carpetas de datos separadas.')
  parts.push('    Lo único que comparten, si los dos están instalados, es el')
  parts.push(`    modelo de IA: ${APP_NAME} usa el que ya descargó Convertexto en`)
  parts.push('    lugar de bajar los mismos gigabytes otra vez, y nunca lo toca.')
  parts.push('    Desinstalar uno no afecta al otro.')
  parts.push('')

  if (hasMac) {
    // Un .dmg no tiene desinstalador y arrastrar la app a la Papelera no toca
    // ~/Library: los motores de transcripción (hasta ~2,1 GB si bajó los tres)
    // quedan ocupando disco para siempre y el usuario no tiene forma de
    // adivinarlo. En Windows esto lo resuelve solo el desinstalador
    // (`deleteAppDataOnUninstall` en electron-builder.yml).
    parts.push('')
    parts.push(LINE)
    parts.push('  CÓMO DESINSTALAR EN MAC')
    parts.push(LINE)
    parts.push('')
    parts.push('En Mac no hay desinstalador, y mandar la app a la Papelera NO borra')
    parts.push('NI TUS TARJETAS NI el modelo de IA que descargaste, que ocupa entre')
    parts.push('1,3 y 2,7 GB. Son tres pasos, en este orden:')
    parts.push('')
    parts.push('1) ANTES DE BORRAR NADA, ubicá la carpeta de datos. Con la app todavía')
    parts.push('   instalada, abrila y tocá el ícono de la hoja de papel (arriba a la')
    parts.push('   derecha): se abre en el Finder la carpeta de registros. Subí UNA')
    parts.push(`   carpeta (Cmd + ↑) y vas a quedar parado en "${APP_NAME}". Esa es`)
    parts.push('   la carpeta que tiene TODO. Dejá esa ventana abierta.')
    parts.push('')
    parts.push('   ¿Preferís ir directo? En el Finder, Cmd + Shift + G y pegá:')
    parts.push('')
    parts.push(`      ~/Library/Application Support/${APP_NAME}`)
    parts.push('')
    parts.push('2) SI QUERÉS CONSERVAR TUS MATERIAS, copiá esa carpeta a otro lado')
    parts.push('   antes de seguir. Adentro están tus tarjetas y todo tu historial')
    parts.push('   de repasos, y no hay forma de recuperarlos después.')
    parts.push('')
    parts.push(`3) Cerrá la app (Cmd + Q), arrastrá "${APP_NAME}" de la carpeta`)
    parts.push('   Aplicaciones a la Papelera, y arrastrá también la carpeta del')
    parts.push('   paso 1. Vaciá la Papelera para recuperar el espacio.')
    parts.push('')
  }

  parts.push(LINE)
  parts.push('')

  return parts.join('\n')
}

/**
 * Versión del anexo de requisitos. Se versiona APARTE de la versión del
 * producto y aparte de la del contrato, a propósito: la cláusula 11 del EULA
 * define "defecto" por comparación contra este documento, así que hay que poder
 * decir con precisión CUÁL edición del anexo regía en una entrega determinada.
 *
 * Subir este número cada vez que cambie lo prometido: requisitos, funciones
 * disponibles por plataforma, o límites conocidos.
 */
export const REQUISITOS_VERSION = '1.0'

/**
 * Anexo de requisitos y funciones: el documento contra el cual se mide si el
 * Producto tiene un defecto.
 *
 * POR QUÉ EXISTE COMO ARCHIVO APARTE
 * ----------------------------------
 * La cláusula 11.10 del contrato define defecto como "que el Producto no haga,
 * de manera sustancial, lo que la documentación de la entrega dice que hace".
 * Sin un documento único, versionado y acotado, esa definición cuelga de todo
 * lo que se haya escrito alguna vez —el LEEME, la ayuda, la landing, un mail—,
 * y el alcance de la obligación queda abierto. Con este anexo, el perímetro es
 * exactamente lo que dice acá.
 *
 * Sirve además para lo inverso: un comprador que reclama porque su Mac no
 * cumple los requisitos, o porque esperaba una función que nunca se prometió,
 * tiene la respuesta por escrito y fechada, entregada junto con el producto.
 *
 * REGLA AL EDITARLO: no prometas de más. Cada afirmación de este archivo es una
 * obligación exigible; cada límite declarado es una defensa. Si algo no se
 * probó, no se declara.
 */
export function buildRequisitos({ version, names: namesArg, hasWindows = false, hasMac = true, licenciante = LICENCIANTE } = {}) {
  const L = { ...LICENCIANTE, ...licenciante }
  /*
   * Los nombres se FUSIONAN contra el default, igual que en `buildEula`, y por el
   * mismo motivo: este anexo cita al contrato y a la ayuda por su nombre, y ese
   * nombre cambia según dónde esté la copia. En la carpeta de Drive los archivos
   * van numerados ("6. Licencia de uso.txt"); adentro del paquete instalado, no
   * ("LICENCIA DE USO.txt").
   *
   * Estaban cableados a `DRIVE_FILES`, así que la copia que viaja adentro del
   * paquete mandaba al comprador a un archivo que en su carpeta de instalación no
   * existe con ese nombre — y lo hacía justo en el renglón que explica de qué
   * cláusula depende este anexo.
   */
  const names = { ...DRIVE_FILES, ...namesArg }
  const parts = []

  parts.push(LINE)
  parts.push(`  ${APP_NAME.toUpperCase()} — REQUISITOS Y FUNCIONES`)
  parts.push(`  Anexo versión ${REQUISITOS_VERSION}`)
  parts.push(`  Aplica a ${APP_NAME} versión ${version}`)
  parts.push(`  Vigente desde ${L.vigenciaDesde}`)
  parts.push(LINE)
  parts.push('')
  parts.push('')
  parts.push('QUÉ ES ESTE ARCHIVO')
  parts.push('-------------------')
  parts.push('')
  parts.push('Acá está, en un solo lugar, qué necesita tu computadora para correr')
  parts.push(`${APP_NAME} y qué hace exactamente el programa en cada sistema.`)
  parts.push('')
  parts.push('No es informativo solamente: es el anexo del contrato de licencia. La')
  parts.push(`cláusula 11 de "${names.eula}" define qué se considera un defecto`)
  parts.push('comparándolo contra lo que dice ESTE archivo. Si el programa no hace algo')
  parts.push('que acá se promete, es un defecto y respondemos. Si no hace algo que acá')
  parts.push('no figura, no lo es.')
  parts.push('')
  parts.push('Guardalo junto con el resto de la entrega.')
  parts.push('')

  if (hasMac) {
    parts.push('')
    parts.push('REQUISITOS EN MAC')
    parts.push('-----------------')
    parts.push('')
    parts.push('  Sistema operativo    macOS 12 (Monterey) o posterior.')
    parts.push('                       En versiones anteriores no instala.')
    parts.push('')
    parts.push('  Procesador           Chip Apple (M1, M2, M3, M4 o posterior)')
    parts.push('                       o procesador Intel de 64 bits.')
    parts.push('                       Cada uno tiene su propio archivo de')
    parts.push('                       instalación: bajá el que corresponda.')
    parts.push('')
    parts.push('  Memoria (RAM)        4 GB para la calidad Rápida.')
    parts.push('                       8 GB para la calidad Detallada.')
    parts.push('                       El programa comprueba la memoria ANTES de')
    parts.push('                       descargar y avisa si tu equipo no llega.')
    parts.push('')
    parts.push('  Espacio en disco     ~200 MB para el programa, MÁS el espacio del')
    parts.push('                       modelo que uses:')
    parts.push('                         Rápida     ~1,3 GB')
    parts.push('                         Detallada  ~2,7 GB')
    parts.push('                       Si usás los dos, contá ~4,2 GB en total.')
    parts.push('                       Más lo que ocupen tus tarjetas, que es')
    parts.push('                       despreciable: son archivos de texto.')
    parts.push('')
    parts.push('  Internet             Sólo la primera vez que usás cada calidad,')
    parts.push('                       para descargar su modelo. Después funciona')
    parts.push('                       sin conexión.')
    parts.push('')
  }

  if (hasWindows) {
    parts.push('')
    parts.push('REQUISITOS EN WINDOWS')
    parts.push('---------------------')
    parts.push('')
    parts.push('  Sistema operativo    Windows 10 o Windows 11, de 64 bits.')
    parts.push('')
    parts.push('  Memoria (RAM)        4 GB para la calidad Rápida, 8 GB para la')
    parts.push('                       Detallada. El programa lo comprueba antes de')
    parts.push('                       descargar.')
    parts.push('')
    parts.push('  Espacio en disco     ~200 MB para el programa, MÁS el espacio del')
    parts.push('                       modelo que uses:')
    parts.push('                         Rápida     ~1,3 GB')
    parts.push('                         Detallada  ~2,7 GB')
    parts.push('                       Si usás los dos, contá ~4,2 GB en total.')
    parts.push('')
    parts.push('  Internet             Sólo para la descarga inicial de cada modelo.')
    parts.push('')
  }

  parts.push('')
  parts.push('QUÉ HACE EL PROGRAMA')
  parts.push('--------------------')
  parts.push('')
  parts.push('  GENERAR tarjetas de estudio a partir de un texto que pegues o de')
  parts.push('  un archivo PDF, Word (.docx), PowerPoint (.pptx) o texto plano')
  parts.push('  (.txt, .md), usando un modelo de inteligencia artificial que corre')
  parts.push('  en tu computadora.')
  parts.push('')
  parts.push('  MOSTRARTE TODAS LAS TARJETAS ANTES DE GUARDARLAS, para que las')
  parts.push('  corrijas o las descartes. Ninguna se guarda sin tu revisión.')
  parts.push('')
  parts.push('  ORGANIZARLAS en materias y unidades, con buscador, y dejarte')
  parts.push('  crear, editar, mover y borrar en los tres niveles.')
  parts.push('')
  parts.push('  TOMÁRTELAS con repaso espaciado (algoritmo FSRS): según te')
  parts.push('  califiques en cada tarjeta, decide cuándo volver a mostrártela.')
  parts.push('')
  parts.push('  MOSTRARTE TU PROGRESO por materia y por unidad.')
  parts.push('')
  parts.push('  DOS NIVELES DE CALIDAD (Rápida y Detallada), para elegir entre')
  parts.push('  velocidad y requisitos de memoria.')
  parts.push('')
  parts.push('  TODO EN TU COMPUTADORA. No hay cuenta, no hay registro, y ni tus')
  parts.push('  apuntes ni tus tarjetas se envían a ningún servidor.')
  parts.push('')

  parts.push('')
  parts.push('QUÉ NO HACE — LÍMITES CONOCIDOS')
  parts.push('-------------------------------')
  parts.push('')
  parts.push('Esto no son fallas: son límites declarados antes de la compra, y por')
  parts.push('eso no constituyen defectos del Producto.')
  parts.push('')
  parts.push('  LAS TARJETAS LAS ESCRIBE UNA INTELIGENCIA ARTIFICIAL Y PUEDEN')
  parts.push('  TENER ERRORES. No es un buscador ni una base de datos: es un')
  parts.push('  modelo que redacta a partir de tu texto, y puede confundir una')
  parts.push('  fecha, invertir una definición o entender mal una frase ambigua.')
  parts.push('')
  parts.push('  El programa filtra lo que puede: descarta automáticamente las')
  parts.push('  tarjetas cuyo contenido no está respaldado por el texto que')
  parts.push('  cargaste. Ese filtro reduce los errores; no los elimina.')
  parts.push('')
  parts.push('  POR ESO TODAS LAS TARJETAS SE TE MUESTRAN ANTES DE GUARDARLAS. Esa')
  parts.push('  revisión es parte del funcionamiento normal del programa, no un')
  parts.push('  paso opcional. NO prometemos ningún porcentaje de acierto, y que')
  parts.push('  una tarjeta salga mal redactada o equivocada no constituye un')
  parts.push('  defecto.')
  parts.push('')
  parts.push('  LA CALIDAD DEPENDE DEL TEXTO QUE CARGUES. De un apunte explicativo')
  parts.push('  salen buenas tarjetas; de un índice, una bibliografía o una')
  parts.push('  filmina con tres palabras por renglón, salen pocas y básicas. Eso')
  parts.push('  es una propiedad del material, no del programa.')
  parts.push('')
  parts.push('  NO LEE PDF ESCANEADOS NI IMÁGENES. Un PDF que es una foto del')
  parts.push('  apunte no tiene texto adentro. El programa lo detecta, te lo')
  parts.push('  explica y no lo procesa. No incluye reconocimiento de caracteres')
  parts.push('  (OCR).')
  parts.push('')
  parts.push('  LA EXTRACCIÓN DE TEXTO DE UN PDF ES UNA RECONSTRUCCIÓN. Un PDF no')
  parts.push('  guarda párrafos: guarda fragmentos con una posición. El programa')
  parts.push('  reconstruye el orden de lectura, y en documentos a dos columnas o')
  parts.push('  con encabezados puede equivocarse. Por eso siempre te muestra el')
  parts.push('  texto extraído para que lo revises y lo corrijas antes de generar.')
  parts.push('  Pegar el texto a mano evita este paso por completo.')
  parts.push('')
  parts.push('  NO LEE .doc DEL WORD VIEJO (anterior a 2007), ni .odt, ni .rtf, ni')
  parts.push('  planillas de cálculo, ni páginas web.')
  parts.push('')
  parts.push('  EL RENDIMIENTO DEPENDE DE TU COMPUTADORA, NO DEL PROGRAMA. Cuánto')
  parts.push('  tarda una generación depende de tres cosas que están fuera de')
  parts.push('  nuestro control:')
  parts.push('')
  parts.push('    · la capacidad de tu equipo (procesador, memoria disponible,')
  parts.push('      espacio libre en disco y qué otros programas estés usando);')
  parts.push('    · la calidad que elijas, porque el modelo Detallado es más')
  parts.push('      pesado y más lento; y')
  parts.push('    · el largo del apunte.')
  parts.push('')
  parts.push('  Por eso NO declaramos un tiempo de procesamiento: no sería cierto')
  parts.push('  para todos los equipos. En una computadora con pocos recursos, un')
  parts.push('  apunte largo con la calidad Detallada puede tardar mucho, quedar')
  parts.push('  sin memoria o no completarse.')
  parts.push('')
  parts.push('  QUE ESO OCURRA NO ES UNA FALLA DEL PROGRAMA: es un límite del')
  parts.push('  equipo. El programa no promete un rendimiento determinado, y por')
  parts.push('  eso esos casos no constituyen un defecto (ver el inciso a) de la')
  parts.push('  cláusula 11.11 del contrato). Si te pasa, probá con la calidad')
  parts.push('  Rápida o generando por partes: escribinos y te ayudamos a')
  parts.push('  encontrar la combinación que funcione en tu equipo.')
  parts.push('')
  parts.push('  NO GRABA AUDIO NI TRANSCRIBE. Si lo que necesitás es pasar una')
  parts.push('  clase grabada a texto, eso lo hace Convertexto, que es otro')
  parts.push('  producto. Podés transcribir con él, exportar a Word y cargar ese')
  parts.push('  archivo acá.')
  parts.push('')
  parts.push('  NO SINCRONIZA ENTRE COMPUTADORAS. Tus tarjetas viven en el equipo')
  parts.push('  donde las creaste. La versión portable las lleva en el pendrive.')
  parts.push('')
  /*
   * Esta línea decía "NO IMPORTA NI EXPORTA MAZOS, ni los de otros programas de
   * tarjetas", y la primera mitad dejó de ser cierta cuando se agregó la
   * exportación e importación por materia.
   *
   * No es un detalle de redacción: este anexo es el que la cláusula 11 usa para
   * decidir qué es un defecto, y además el manual del comprador le explica cómo
   * usar esa función. Un anexo que niega algo que el manual enseña es una
   * contradicción entre dos documentos de la misma entrega.
   *
   * Se conserva el límite que SÍ sigue vigente —no lee mazos de otros
   * programas— y se acota el alcance del que existe.
   */
  parts.push('  NO LEE MAZOS DE OTROS PROGRAMAS DE TARJETAS, como Anki o')
  parts.push('  Quizlet. La exportación e importación por materia que trae el')
  parts.push('  programa usa su propio formato y sirve para mover tus mazos')
  parts.push(`  entre dos instalaciones de ${APP_NAME}, no para intercambiar`)
  parts.push('  con otras aplicaciones.')
  parts.push('')
  parts.push('  NO HACE COPIAS DE SEGURIDAD AUTOMÁTICAS. Si formateás la')
  parts.push('  computadora o desinstalás el programa, tus tarjetas se pierden.')
  parts.push('  Copiá la carpeta de datos si querés conservarlas (el archivo de')
  parts.push('  ayuda explica dónde está).')
  parts.push('')
  parts.push('  NO SE ACTUALIZA SOLO, y no está garantizada su compatibilidad con')
  parts.push('  versiones futuras de tu sistema operativo.')
  parts.push('')

  /*
   * La sección entera es de Mac y sólo se escribe si la entrega lo incluye.
   *
   * Antes el título y la frase de cierre iban siempre, así que en la entrega de
   * Windows quedaba "CÓMO VERIFICAR QUE TU COPIA ES LA ORIGINAL" seguido de
   * "Esta verificación también sirve ante un problema…" sin haber descrito
   * ninguna verificación. En Windows no hay ninguna que describir: el
   * instalador no está firmado, y por eso aparece el aviso de SmartScreen que
   * explica el LEEME.
   *
   * Tampoco va el `codesign -dv` que había acá. Ese comando imprime el nombre
   * del certificado, y Apple los emite a nombre de una persona y no del nombre
   * comercial con el que se vende. Se sacó a pedido. La firma sigue estando y
   * la Mac la sigue verificando sola en cada arranque; lo único que ya no se
   * entrega es la instrucción para mirarla a mano.
   */
  if (hasMac) {
    parts.push('')
    parts.push('CÓMO VERIFICAR QUE TU COPIA ES LA ORIGINAL')
    parts.push('------------------------------------------')
    parts.push('')
    parts.push('En Mac, el programa está firmado con un certificado de desarrollador de')
    parts.push('Apple y certificado por Apple (notarizado). Tu Mac verifica esa firma')
    parts.push('sola, cada vez que lo abrís: si el archivo hubiera sido alterado, no')
    parts.push('abriría.')
    parts.push('')
    parts.push('Eso también sirve ante un problema: permite establecer si el programa')
    parts.push('sigue siendo el que entregamos o si algo lo modificó.')
    parts.push('')
  }

  parts.push('')
  parts.push('SI ALGO NO FUNCIONA')
  parts.push('-------------------')
  parts.push('')
  parts.push(`Mirá primero "${names.help}",`)
  parts.push('que cubre los casos más comunes.')
  parts.push('')
  parts.push('Si no lo resuelve, escribinos a:')
  parts.push('')
  parts.push(`    ${L.email}`)
  parts.push('')
  parts.push('Contanos qué esperabas, qué pasó, cuándo apareció el problema por')
  parts.push('primera vez, qué versión de tu sistema operativo tenés, y adjuntá el')
  parts.push('archivo de registro que genera el programa. Con eso podemos')
  parts.push('diagnosticarlo; sin eso, no.')
  parts.push('')
  parts.push(LINE)
  parts.push(`  Anexo versión ${REQUISITOS_VERSION} — ${APP_NAME} ${version}`)
  parts.push(`  Forma parte de "${names.eula}" y se interpreta con él.`)
  parts.push(LINE)
  parts.push('')

  return parts.join('\n')
}

/**
 * Contrato de licencia de usuario final (EULA): lo que el comprador puede y no
 * puede hacer con Convertexto.
 *
 * CRITERIO DE REDACCIÓN: GENERAL, NO EXHAUSTIVO.
 *
 * Este contrato existe para dos cosas: proteger al Licenciante y cumplir la ley.
 * No para documentar el producto. Por eso NO enumera permisos del sistema uno por
 * uno, ni versiones de sistema operativo, ni qué función anda en qué plataforma,
 * ni rutas de archivos internos. Todo eso va en la documentación de la entrega,
 * que se puede corregir sin reeditar un contrato, y que no compromete a nada.
 *
 * La ventaja concreta de redactarlo así: el contrato no se desactualiza cuando el
 * producto cambia. Una versión que agregue una función nueva, o que la habilite en
 * una plataforma donde antes no estaba, no obliga a emitir un contrato nuevo — y
 * dos textos distintos circulando bajo la misma "versión de contrato" rompen la
 * trazabilidad: ante un reclamo no se sabría cuál aceptó el comprador.
 *
 * Por el mismo motivo NO se parametriza por plataforma: `write-licenses.mjs` no
 * sabe para qué sistema se está compilando.
 *
 * TRES COSAS QUE NO HAY QUE SACAR SIN LEER ANTES LA LGPL:
 *
 *  1. La distinción entre "Componentes Propietarios" y "Componentes de Terceros",
 *     desde la cláusula 1, con TODAS las prohibiciones predicadas sólo de los
 *     primeros. FFmpeg viaja bajo LGPL: si el contrato se leyera como una
 *     restricción sobre él, sería un incumplimiento de esa licencia.
 *  2. La prevalencia de las licencias de terceros sobre este contrato, con la
 *     regla de que cualquier cláusula que las contradiga se tiene por no escrita
 *     respecto de ese componente.
 *  3. Que la terminación por incumplimiento no alcance a los derechos LGPL/MIT:
 *     sobreviven al contrato porque no dependen de él.
 *
 * Un dato que permitió acortar mucho esta parte: FFmpeg y whisper.cpp se ejecutan
 * con `spawn` como PROGRAMAS APARTE (ver src/main/services/), no se linkean al
 * binario de la app. No hay obra combinada, así que no hay obligación de relinkeo:
 * las obligaciones reales son entregar el texto de la licencia y dar acceso al
 * código fuente. Las dos se cumplen y están en la cláusula 5.
 *
 * Se arma con un template literal y no con `parts.push()`: es texto corrido y así
 * se lee y se corrige mejor.
 */
// `hasMac` arranca en FALSE a propósito, al revés que en los otros generadores.
//
// De esa bandera depende la cláusula 11.9, que afirma que el Producto está
// firmado y que el sistema operativo verifica esa firma al abrirlo. Es cierto en
// Mac y falso en Windows. Un llamador que se olvide de pasarla tiene que caer del
// lado de NO afirmarlo: un contrato más débil pero verdadero es recuperable; uno
// que le promete al comprador una firma que su copia no tiene, no.
export function buildEula({ version, names: namesArg, licenciante = LICENCIANTE, hasWindows = false, hasMac = false } = {}) {
  // Los dos se FUSIONAN contra el default, no lo reemplazan. Antes `names` era un
  // parámetro por defecto (`names = DRIVE_FILES`), y eso sólo aplica cuando el
  // llamador no manda nada: si mandaba un objeto PARCIAL, el default quedaba
  // anulado entero y las claves que faltaban salían `undefined`.
  //
  // No es hipotético: write-licenses.mjs pasa `{ licenses, eula }` a propósito
  // (adentro del .app los nombres van sin numerar), así que `names.requisitos`
  // salía `undefined` y el contrato que se vendía decía, en las cláusulas 11.10 y
  // 11.11.a, que el anexo se llama "undefined". Justo las dos cláusulas de las que
  // cuelga la definición de defecto. Y no lo agarraba nada: hasPlaceholders() busca
  // [CORCHETES EN MAYÚSCULAS], y "undefined" no deja ninguno.
  const names = { ...DRIVE_FILES, ...namesArg }
  const L = { ...LICENCIANTE, ...licenciante }

  // ───────────────────────────────────────────────────────────────────────────
  // CLÁUSULA 11.9 — LA PRUEBA DE QUE EL PRODUCTO NO CAMBIÓ.
  //
  // Es lo único del contrato que NO puede ser igual en las dos plataformas, y la
  // diferencia no es de redacción: es de hecho.
  //
  // La versión para Mac va firmada con Developer ID y notarizada por Apple. El
  // sistema operativo verifica esa firma en cada arranque, y cualquiera puede
  // repetir la verificación a mano con el comando que está en el anexo. Eso
  // convierte "el programa no fue alterado" en algo comprobable por un tercero.
  //
  // La versión para Windows se distribuye SIN certificado de firma de código
  // (decisión de presupuesto, ver electron-builder.yml). Ahí no hay firma, el
  // sistema no verifica nada al abrir, y no existe comando que poner en el
  // anexo. Afirmar lo mismo sería escribir tres cosas falsas seguidas en la
  // cláusula que justamente sostiene la defensa frente a un reclamo tardío: a
  // quien la lea con atención, le entrega el argumento en bandeja.
  //
  // Así que en Windows queda en pie sólo el registro local. Es más débil, y es
  // la verdad. Si algún día se firma Windows, esta bifurcación se borra.
  const pruebaInmutabilidad = hasMac
    ? `     EL PRODUCTO ES INMUTABLE, Y ESO SE PUEDE COMPROBAR. Lo que recibiste
     es una versión fija: no se actualiza sola, no cambia con el tiempo y
     no recibe modificaciones de nuestra parte. Frente a un problema que
     aparece tiempo después, hay dos elementos objetivos que permiten
     establecer qué cambió:

       · la FIRMA DIGITAL del Producto, emitida por su desarrollador y
         certificada por Apple. El sistema operativo la verifica solo, cada
         vez que abrís la aplicación, y cualquiera puede comprobarla a mano
         con el comando que figura en el anexo de requisitos. Si el
         programa hubiera sido alterado, esa verificación falla; y

       · el REGISTRO LOCAL que el propio Producto genera en tu computadora
         (cláusula 7.5), que deja constancia de qué ocurrió y cuándo.

     Con esos dos elementos, determinar si el problema vino del Producto o
     de su entorno no es una cuestión de opinión ni de palabra contra
     palabra: se verifica. Por eso el reclamo tiene que venir acompañado
     del registro (cláusula 11.12).`
    : `     EL PRODUCTO ES INMUTABLE. Lo que recibiste es una versión fija: no se
     actualiza sola, no cambia con el tiempo y no recibe modificaciones de
     nuestra parte. Nada de lo que hagamos después de tu compra puede
     alterar la copia que tenés instalada.

     Frente a un problema que aparece tiempo después, el elemento objetivo
     para establecer qué cambió es el REGISTRO LOCAL que el propio Producto
     genera en tu computadora (cláusula 7.5), que deja constancia de qué
     ocurrió y cuándo. Por eso el reclamo tiene que venir acompañado del
     registro (cláusula 11.12).`
  const equipos = L.equipos

  // El año del copyright se deduce de la fecha de vigencia en vez de ser un campo
  // aparte: así no pueden quedar desincronizados (contrato vigente desde 2026 y
  // "© 2025"), que era posible y nada lo detectaba.
  const anio = (String(L.vigenciaDesde).match(/\b(19|20)\d{2}\b/) ?? [])[0] ?? L.vigenciaDesde

  return `${LINE}
  ${APP_NAME.toUpperCase()} — LICENCIA DE USO (CONTRATO DE USUARIO FINAL)
  Contrato versión ${L.contratoVersion}
  Vigente desde ${L.vigenciaDesde}
  Aplica a ${APP_NAME} versión ${version}
${LINE}


EN RESUMEN (LEELO EN 30 SEGUNDOS)
---------------------------------

  Compraste el derecho a USAR ${APP_NAME} para siempre, para lo que
  quieras: uso personal y también comercial.

  Tus apuntes y las tarjetas que se generan son 100% tuyos. Todo se
  procesa en tu computadora y no se envía a ningún servidor.

  SÓLO CARGÁ MATERIAL QUE TENGAS DERECHO A USAR. Vos elegís qué apunte
  procesás, así que sos el responsable.

  LAS TARJETAS LAS ESCRIBE UNA INTELIGENCIA ARTIFICIAL Y PUEDEN TENER
  ERRORES. Por eso el programa te las muestra todas antes de guardarlas:
  leelas. Estudiar algo mal para un final es tu riesgo, no el nuestro.

  REEMBOLSOS: si el problema es del programa, lo corregimos —y si no se
  puede corregir, te devolvemos el dinero— dentro del plazo de garantía y
  siempre que nos avises a tiempo. Si la causa es ajena al programa —falta
  de espacio, una actualización del sistema, una configuración incorrecta,
  no saber usarlo— no hay reembolso, ni siquiera dentro de ese plazo. La
  ley te da además diez días para revocar la compra; si los usás, la
  Licencia termina, tenés que desinstalar el programa y borrar todas sus
  copias, y la prohibición de revenderlo sigue rigiendo igual. Las
  condiciones y los plazos completos están en la cláusula 11.

  LO QUE COMPRASTE ES EL PROGRAMA TAL COMO SE ENTREGA, para siempre. No
  incluye soporte continuado, actualizaciones ni servicios a futuro: la
  ayuda que damos es una cortesía que puede discontinuarse. Guardá una
  copia de respaldo del instalador: la entrega es por única vez y reenviarlo
  no es una obligación (cláusulas 2.6 y 12). Tu programa sigue funcionando
  igual, pase lo que pase con nosotros.

  Lo que NO podés hacer es revender, regalar, prestar, subir a internet
  ni compartir la aplicación, ni ofrecerla como servicio para que otros
  la operen.

  ESA PROHIBICIÓN NO SE CAE NUNCA: sigue valiendo aunque te devolvamos el
  dinero, aunque hagas un contracargo y aunque borres el programa. El
  reembolso no te vuelve dueño de nada (cláusula 4.5).

  ${APP_NAME} incluye software libre hecho por otras personas. Esas
  licencias siguen valiendo enteras y este contrato no te quita ninguno
  de los derechos que te dan.

  Este resumen es una ayuda para leer rápido y no tiene valor legal por sí
  mismo. Lo que rige es el articulado que sigue.


${LINE}
  EL CONTRATO
${LINE}


1. QUIÉNES SOMOS, QUÉ ES CADA COSA Y QUÉ ESTÁS ACEPTANDO
--------------------------------------------------------

1.1  ${frase([
    `"El Licenciante" (también "nosotros") es ${L.nombre}`,
    L.cuit && `CUIT/DNI N.º ${L.cuit}`,
    L.domicilio && `con domicilio en ${L.domicilio}`,
    `correo de contacto ${L.email}`,
    L.web && `sitio web ${L.web}`
  ])}

1.2  "Vos" o "el Usuario" es la persona humana o jurídica que adquirió
     legítimamente una licencia y que instala, abre o usa el producto.

1.3  "El Producto" es todo lo que recibiste en la carpeta de entrega.

1.4  "El Software" o "los Componentes Propietarios" son ÚNICAMENTE las
     partes desarrolladas por el Licenciante: el programa que se entrega
     junto con esta licencia, su código propio, su interfaz, su diseño, su
     empaquetado y sus instaladores, sus iconos, sus nombres y marcas, y la
     documentación de la entrega.

     ESTE CONTRATO IDENTIFICA AL SOFTWARE POR SU ORIGEN, NO POR SU NOMBRE.
     Alcanza al programa que recibiste junto con este archivo y a todas sus
     versiones, ediciones, compilaciones y adaptaciones —anteriores,
     actuales o futuras, para cualquier sistema operativo— que el
     Licenciante entregue, sea de forma individual o dentro de una entrega
     conjunta, se distribuyan bajo el mismo nombre comercial o bajo otro
     distinto. Un cambio de denominación, de versión, de plataforma o de
     presentación comercial NO crea un producto distinto ni deja este
     contrato sin efecto: si el programa lo desarrolló y lo entregó el
     Licenciante, está alcanzado por este contrato, se llame como se llame.

     ESTA ES LA REGLA DE LECTURA MÁS IMPORTANTE DEL CONTRATO: todo lo que
     este documento otorga, limita o prohíbe se refiere sólo a los
     Componentes Propietarios.

1.5  "Los Componentes de Terceros" son los programas, bibliotecas,
     archivos y modelos hechos por otras personas que el Producto incluye
     o descarga. Cada uno tiene su propia licencia y NO se licencian por
     este contrato: se licencian por la suya. El detalle está en
     "${names.licenses}".

1.6  "Tu Contenido" son los archivos que procesás con el Producto y los
     resultados que el Producto genera a partir de ellos.

1.7  ACEPTACIÓN: instalar, abrir o usar el Software implica que leíste y
     aceptás este contrato en su totalidad. Si no estás de acuerdo, no lo
     instales ni lo uses: borrá los archivos y, si estás en plazo, pedí el
     reembolso conforme a la cláusula 11. Si aceptás en nombre de una
     empresa, declarás tener facultades para obligarla.

1.8  Tu aceptación de este contrato no es condición de ninguno de los
     derechos que las licencias de software libre te dan sobre los
     Componentes de Terceros: esos derechos los tenés igual.


2. LA LICENCIA QUE TE OTORGAMOS
-------------------------------

2.1  Te otorgamos una licencia perpetua, mundial, no exclusiva,
     intransferible y no sublicenciable para instalar y usar el Software
     conforme a este contrato. Es revocable únicamente por incumplimiento
     (cláusula 13).

2.2  ALCANCE: podés usarlo tanto para fines personales como para tu
     actividad profesional o comercial. Está expresamente permitido
     producir resultados en el marco de tu trabajo, para tus clientes, y
     cobrar por ese trabajo. Lo permitido es que VOS operes el Software y
     entregues los resultados; lo prohibido es darle a un tercero acceso
     al Software para que lo opere él.

2.3  ${
       equipos === 1
         ? `EQUIPOS: la Licencia es individual. Podés instalar y usar el
     Software en UNA (1) computadora de tu propiedad o bajo tu control
     exclusivo, y quien lo use tenés que ser vos.`
         : `EQUIPOS: la Licencia es individual. Podés instalar y usar el
     Software en las computadoras de tu propiedad o bajo tu control
     exclusivo, hasta un máximo de ${equipos}, y quien lo use tenés que ser
     vos.`
     }
     Si en tu hogar, estudio o empresa lo va a usar más de una persona,
     hace falta una licencia por cada persona que lo use. Podés conservar
     copias de respaldo para tu propio uso.

2.4  SIN REGALÍAS NI LÍMITE DE VOLUMEN: no hay cupos ni cobro por uso.
     Pagaste una vez y listo.

2.5  LA LICENCIA ESTÁ CONDICIONADA AL PAGO EFECTIVO Y DEFINITIVO del
     precio. Si el pago no se perfecciona, o si es revertido, desconocido
     o anulado después, la Licencia se tiene por no otorgada y todo uso
     posterior del Software queda sin autorización nuestra.

2.6  ENTREGA ÚNICA Y COPIAS DE RESPALDO. La entrega se cumple, por única
     vez, cuando el Producto se pone a tu disposición para descargar. A
     partir de ahí, GUARDAR UNA COPIA DE RESPALDO DEL INSTALADOR ES TU
     RESPONSABILIDAD, y este contrato te autoriza expresamente a hacerla
     (cláusula 2.3). No estamos obligados a mantener el enlace de
     descarga disponible, ni a reenviarte los archivos si los perdés, los
     borrás o cambiás de computadora. Si nos escribís, podemos
     reenviártelos como cortesía (cláusula 12.5), pero no es una obligación
     ni un derecho que puedas exigir.


3. TU CONTENIDO ES TUYO
-----------------------

3.1  No reclamamos ningún derecho sobre Tu Contenido. Es 100% tuyo: podés
     usarlo, editarlo, publicarlo, cederlo, licenciarlo o venderlo sin
     pedirnos permiso, sin atribuirnos nada y sin pagarnos regalías.

3.2  Sos responsable de tener derecho a procesar lo que cargás:
     consentimiento de las personas involucradas cuando corresponda,
     derechos de autor, secreto profesional y normativa de protección de
     datos aplicable.


4. LO QUE NO PODÉS HACER
------------------------

4.1  ACLARACIÓN PREVIA, QUE MANDA SOBRE TODA ESTA CLÁUSULA: las
     prohibiciones que siguen se refieren EXCLUSIVAMENTE a los
     Componentes Propietarios. No alcanzan, ni limitan, ni condicionan de
     ninguna manera lo que podés hacer con los Componentes de Terceros,
     que se rige sólo por sus propias licencias (cláusula 5).

4.2  Salvo autorización previa y por escrito del Licenciante, NO podés:

     a) Revender, alquilar, prestar, ceder, transferir, sublicenciar,
        regalar, canjear o distribuir el Software o esta Licencia, sea a
        título gratuito u oneroso.

     b) Publicar, subir, compartir o poner a disposición los archivos del
        Producto, ni el enlace de descarga que recibiste, en internet,
        redes sociales, grupos de mensajería, repositorios, redes P2P,
        servicios de almacenamiento o cualquier otro medio.

     c) Poner el Software a disposición de terceros para que ellos lo
        operen: servicios web, acceso remoto, equipos compartidos, ni
        integrarlo dentro de otro producto, servicio o distribución.

     d) Quitar, ocultar, alterar o falsificar los avisos de derecho de
        autor, las marcas o los nombres del Software, ni los archivos de
        licencias que acompañan la entrega.

     e) Eludir o interferir con los mecanismos de licenciamiento del
        Software, ni crear, usar o distribuir parches, "cracks",
        generadores de claves ni herramientas para evadir esta Licencia.

     f) Modificar, adaptar, descompilar, desensamblar o realizar
        ingeniería inversa sobre el código de los Componentes
        Propietarios, ni intentar obtener su código fuente, ni usarlo para
        desarrollar un producto competidor.

     g) Presentar el Software como propio, renombrarlo, o usar su nombre,
        su ícono o su imagen para promocionar productos o servicios
        propios, o para sugerir una asociación que no existe.

     h) Usar el Producto para cometer delitos, vulnerar la privacidad de
        terceros o infringir derechos de propiedad intelectual.

4.3  Las prohibiciones de los incisos e) y f) rigen SIN PERJUICIO DE los
     derechos que las licencias de los Componentes de Terceros te otorgan
     sobre esos componentes, y de los actos que la ley te permita de modo
     irrenunciable, como los de interoperabilidad, corrección de errores o
     copia de seguridad. Modificar, recompilar o reemplazar un Componente
     de Terceros no es una elusión y está expresamente permitido.

4.4  El incumplimiento de esta cláusula habilita la terminación inmediata
     de la Licencia y el reclamo de los daños que correspondan, sin
     perjuicio de las acciones legales que pudieran caber.

4.5  LA PROHIBICIÓN DE REVENDER Y REDISTRIBUIR NO CADUCA NUNCA.

     Las prohibiciones de los incisos a) y b) de la cláusula 4.2 rigen
     desde el momento en que accedés al Producto, por cualquier medio, y
     subsisten INDEFINIDAMENTE. No se extinguen ni se relajan por ninguna
     causa. En particular, siguen rigiendo con plena fuerza:

     a) después de que la Licencia termine, por cualquier motivo, sin
        importar quién le haya puesto fin;

     b) si ejercés el derecho de arrepentimiento de la cláusula 11.3, o
        si te reembolsamos el precio por cualquier otra razón;

     c) si el pago es revertido, desconocido, anulado o reclamado ante el
        medio de pago o ante quien haya intervenido en la operación
        (contracargo), sea con o sin motivo;

     d) si dejás de usar el Producto, lo desinstalás o borrás tus copias;

     e) si nunca llegaste a pagar el precio, o si obtuviste los archivos
        de un tercero que no estaba autorizado a dártelos.

     QUE EL PRECIO TE SEA DEVUELTO NO TE TRANSFIERE NINGÚN DERECHO sobre
     el Software. La devolución te obliga a dejar de usarlo y a borrarlo,
     y deja la prohibición de revenderlo o redistribuirlo intacta. En
     ningún momento, ni bajo ninguna circunstancia, adquirís el derecho a
     vender, ceder, publicar ni entregar el Software a otra persona.

4.6  ESTO NO DEPENDE SÓLO DE ESTE CONTRATO. Los Componentes Propietarios
     están protegidos por la ley de propiedad intelectual (en la
     República Argentina, la Ley 11.723 y normas concordantes).
     Reproducirlos, distribuirlos, publicarlos o comercializarlos sin
     nuestra autorización es ilícito con independencia de este contrato, y
     lo es también para quien nunca lo aceptó. La Licencia de la cláusula
     2 es la única autorización que otorgamos: todo uso que la exceda
     queda sin autorización alguna.


5. COMPONENTES DE TERCEROS
--------------------------

5.1  El Producto incluye o descarga Componentes de Terceros distribuidos
     bajo licencias de software libre y otras licencias de sus
     respectivos titulares. Están detallados, con su versión y el lugar
     donde está su código fuente, en:

       "${names.licenses}"

     Los textos completos de esas licencias viajan con el Producto.

5.2  PREVALENCIA. En todo lo que se refiera a los Componentes de
     Terceros, SUS PROPIAS LICENCIAS PREVALECEN SOBRE ESTE CONTRATO. Nada
     de lo dicho acá te quita, limita, condiciona ni sujeta a permiso
     nuestro ninguno de los derechos que esas licencias te otorgan,
     incluidos los de usarlos, estudiarlos, modificarlos, reemplazarlos y
     redistribuirlos por separado en sus propios términos.

     No imponemos ni pretendemos imponer ninguna restricción adicional
     sobre esos componentes. Si alguna cláusula de este contrato llegara a
     interpretarse como una restricción adicional sobre un Componente de
     Terceros, esa cláusula es inaplicable en esa medida y se tiene por no
     escrita respecto de ese componente, sin afectar la validez del resto
     del contrato.

5.3  CÓDIGO FUENTE. Cuando la licencia de un componente obligue a
     ofrecerlo, el código fuente correspondiente está publicado y
     descargable en la dirección que se indica, para cada componente, en:

       "${names.licenses}"

     Esa publicación es la forma en que cumplimos la obligación: no hace
     falta que nos pidas nada. De manera adicional y subsidiaria, si alguno
     de esos enlaces dejara de estar disponible, podés pedirnos el fuente
     por correo a
     ${L.email}
     y te lo hacemos llegar. ESTA OFERTA SUBSIDIARIA TIENE UNA VIGENCIA DE
     TRES (3) AÑOS contados desde la entrega del Producto, que es el plazo
     que las licencias LGPL y GPL exigen para una oferta escrita de código
     fuente. Vencido ese plazo, la obligación queda cumplida con la
     publicación ya realizada.

5.4  Lo que no podés es redistribuir el conjunto empaquetado como
     ${APP_NAME}: la aplicación, su interfaz, su nombre y su código
     propio no son software libre.

5.5  GARANTÍA Y SOPORTE. Los titulares de los Componentes de Terceros los
     publican SIN GARANTÍA DE NINGUNA CLASE, conforme a sus propias
     licencias, y no responden por el funcionamiento del Producto.
     Cualquier compromiso que asumamos nosotros lo asumimos en nuestro
     propio nombre, no en el de ellos.

5.6  Si reemplazás o modificás un Componente de Terceros, esa
     configuración queda fuera de nuestra garantía y de nuestro soporte.
     Es una consecuencia razonable de que ya no sea el producto que
     entregamos: no es una prohibición ni te hace perder la Licencia.


6. PROPIEDAD INTELECTUAL
------------------------

6.1  Los Componentes Propietarios SE LICENCIAN, NO SE VENDEN. Lo que
     adquiriste es el derecho de uso descripto en la cláusula 2, no la
     propiedad del Software ni de su código.

6.2  El Licenciante conserva todos los derechos de propiedad intelectual
     sobre los Componentes Propietarios. Todo derecho no otorgado
     expresamente en este contrato queda reservado.

6.3  Los Componentes de Terceros pertenecen a sus respectivos titulares.
     No reclamamos ninguna titularidad sobre ellos.

6.4  Si nos enviás sugerencias o reportes de mejora, podemos usarlos
     libremente para mejorar el producto, sin que eso genere obligación de
     pago, atribución ni confidencialidad a nuestro cargo, y sin afectar
     tus derechos sobre Tu Contenido.


7. PRIVACIDAD Y PERMISOS DEL SISTEMA
------------------------------------

7.1  PROCESAMIENTO LOCAL: el Producto procesa Tu Contenido en tu propia
     computadora. No enviamos tus archivos ni los resultados a ningún
     servidor. El Licenciante no tiene ni puede tener acceso a Tu
     Contenido.

7.2  El Producto no requiere cuenta ni registro, y no recolecta
     telemetría, estadísticas de uso ni datos personales.

7.3  CONEXIÓN A INTERNET: el Producto puede necesitar conexión para
     descargar componentes de terceros necesarios para su funcionamiento.
     Esas descargas se rigen por los términos de quien las provee.

7.4  PERMISOS DEL SISTEMA: para funcionar, el Producto puede requerir
     permisos que otorga tu sistema operativo. Al usar cada función,
     autorizás los permisos que el sistema te solicite para esa función.
     Podés revocarlos en cualquier momento desde la configuración de tu
     sistema, entendiendo que la función asociada dejará de estar
     disponible. El Producto sólo usa cada permiso mientras la función
     correspondiente está en uso.

7.5  REGISTRO LOCAL: el Producto guarda un archivo de registro técnico en
     tu computadora. Sólo llega a nosotros si vos nos lo enviás para
     soporte; antes de enviarlo, revisá que no contenga información que
     prefieras no compartir.

7.6  Como Tu Contenido nunca sale de tu equipo, los recaudos sobre él
     —copias de respaldo, cifrado del disco, quién más usa esa
     computadora— quedan bajo tu responsabilidad.


8. RESPONSABILIDAD POR EL USO
-----------------------------

8.1  SOS EL ÚNICO RESPONSABLE del material que decidís cargar en el
     Producto. El Licenciante provee una herramienta de uso general y no
     participa, ni tiene forma de participar, en esa decisión.

8.2  SÓLO CARGÁ MATERIAL SOBRE EL QUE TENGAS DERECHO. Apuntes de cátedra,
     libros, manuales y presentaciones suelen estar protegidos por derecho
     de autor. Procesarlos para tu propio estudio es una cosa; reproducir
     o distribuir el material o las tarjetas resultantes puede ser otra
     muy distinta, y esa evaluación te corresponde a vos. Si el material
     contiene datos personales de terceros, las obligaciones que la
     normativa de protección de datos imponga sobre esa información las
     asumís vos.

8.3  Si usás el Producto en un ámbito laboral, académico o profesional,
     verificá además las políticas internas y los términos de los
     servicios que estés usando: algunas instituciones restringen qué se
     puede hacer con su material de cátedra.

8.4  El Licenciante no responde por el uso que hagas del Producto ni de
     sus resultados, ni por reclamos de terceros derivados de ese uso, y
     te obligás a mantenerlo indemne frente a esos reclamos, salvo en lo
     que la ley no permita limitar.


9. EXACTITUD DE LOS RESULTADOS
------------------------------

9.1  LAS TARJETAS LAS REDACTA UN MODELO DE INTELIGENCIA ARTIFICIAL, no
     una persona ni una base de datos. Es una generación estadística de
     texto: puede contener errores, omisiones, afirmaciones invertidas,
     fechas o cifras equivocadas y conceptos mal atribuidos. La calidad
     depende además del material que cargues.

9.2  El Producto incluye un filtro que descarta automáticamente las
     tarjetas cuyo contenido no está respaldado por el texto cargado. Ese
     filtro REDUCE los errores; no los elimina, y no se promete que lo
     haga.

9.3  POR ESO EL PRODUCTO TE MUESTRA TODAS LAS TARJETAS ANTES DE
     GUARDARLAS. Esa revisión es parte del funcionamiento normal del
     programa y es TU RESPONSABILIDAD: la decisión de guardar una tarjeta,
     y por lo tanto de estudiarla, la tomás vos después de leerla.

9.4  No garantizamos ningún porcentaje de exactitud, ni que las tarjetas
     sean aptas para un fin determinado, ni ningún resultado académico.

9.5  ADVERTENCIA IMPORTANTE: NO USES LAS TARJETAS COMO ÚNICA FUENTE NI
     COMO MATERIAL DEFINITIVO EN CONTEXTOS CRÍTICOS —exámenes
     habilitantes, matrículas profesionales, formación médica, técnica o
     de seguridad, o cualquier ámbito donde un dato equivocado tenga
     consecuencias— SIN CONTRASTARLAS CON EL MATERIAL ORIGINAL. Ese
     contraste es tu responsabilidad.


10. GARANTÍA Y LIMITACIÓN DE RESPONSABILIDAD
--------------------------------------------

10.1 En la máxima medida permitida por la ley, el Producto se proporciona
     "TAL CUAL", sin garantías de ninguna clase, expresas o implícitas,
     incluyendo las de comerciabilidad, adecuación a un fin particular,
     exactitud, o funcionamiento ininterrumpido y libre de errores.

10.2 No garantizamos que el Producto funcione en cualquier equipo o
     configuración, ni su compatibilidad con versiones futuras de tu
     sistema operativo, ni la disponibilidad permanente de las descargas
     que dependan de terceros. Los requisitos y las funciones disponibles
     están indicados en la documentación de la entrega, que forma parte de
     la información previa a la compra.

10.3 En la máxima medida permitida por la ley, el Licenciante no será
     responsable por daños indirectos, incidentales, especiales o
     consecuentes, ni por lucro cesante, pérdida de chance, pérdida o
     corrupción de datos, interrupción de la actividad o daño
     reputacional, ni por decisiones tomadas a partir de un resultado
     inexacto o incompleto.

10.4 En cualquier caso, la responsabilidad total y acumulada del
     Licenciante derivada de este contrato o del uso del Producto está
     limitada al monto que efectivamente pagaste por la Licencia.

10.5 Nada de lo anterior excluye ni limita la responsabilidad por dolo o
     culpa grave, por daños a la vida o a la integridad física de las
     personas, ni cualquier otra responsabilidad que la ley no permita
     excluir o limitar.

10.6 Mantener copias de respaldo de tus archivos originales es tu
     responsabilidad. El Producto no borra ni modifica tus archivos de
     origen, pero ninguna precaución reemplaza a un backup.

10.7 FUERZA MAYOR Y HECHOS DE TERCEROS. No respondemos por incumplimientos,
     demoras o fallas causados por hechos ajenos a nuestro control
     razonable: caso fortuito o fuerza mayor, fallas o decisiones de
     terceros (plataformas de pago, servicios de alojamiento de la
     descarga, repositorios de los modelos de lenguaje), cortes de
     servicios o de conectividad, o cambios que los fabricantes de tu
     sistema operativo introduzcan en él.


11. DEVOLUCIONES Y REEMBOLSOS
-----------------------------

     Esta es la política de reembolsos completa. La regla está en 11.1 y el
     resto de la cláusula la desarrolla. Está escrita en detalle a propósito:
     así sabés de antemano qué esperar, y no tenemos que discutirlo cuando ya
     hay un problema.

11.1 LA REGLA, EN UNA LÍNEA: si el problema es del Producto, aparece dentro
     del plazo de garantía y nos lo denunciás dentro de los sesenta días de
     haber aparecido, lo corregimos; sólo si no se puede corregir, te
     devolvemos el dinero. Si el problema es ajeno al Producto, o alguno de
     esos plazos ya venció, no hay reembolso. Y para arrepentirte sin
     motivo hay un plazo de diez días.

11.2 HAY DOS VÍAS DISTINTAS, y conviene no confundirlas porque funcionan al
     revés una de la otra:

       VÍA A — ARREPENTIMIENTO. No necesitás ningún motivo, pero sólo se
                puede dentro de los primeros diez días.

       VÍA B — DEFECTO DEL PRODUCTO. Tiene un plazo más largo, pero
                requiere que el problema sea efectivamente del Producto.

     Ninguna de las dos es indefinida: las dos tienen vencimiento.


     VÍA A — ARREPENTIMIENTO (DIEZ DÍAS, SIN NECESIDAD DE MOTIVO)
     ------------------------------------------------------------

11.3 Por tratarse de una compra a distancia, la ley te reconoce DIEZ (10)
     DÍAS CORRIDOS, contados desde la celebración del contrato o desde la
     entrega del Producto (lo que ocurra último), para revocar la compra sin
     expresar causa y sin costo alguno para vos (art. 34, Ley 24.240). Es un
     derecho irrenunciable, y te lo informamos acá porque la ley nos obliga
     a informarlo.

     REVOCAR NO ES PROBAR EL PRODUCTO GRATIS. La revocación pone fin a la
     Licencia: si la ejercés, tenés que desinstalar el Producto y borrar
     todas sus copias, incluidas las de respaldo, y la prohibición de
     revenderlo y redistribuirlo de la cláusula 4.5 te sigue rigiendo de
     modo indefinido, igual que en cualquier otro supuesto de terminación.

11.4 CÓMO EJERCERLO: escribinos a
     ${L.email}
     indicando tu nombre y el comprobante de compra, dentro del plazo. No
     hace falta motivo ni formalidad especial.

11.5 QUÉ PASA CUANDO SE EJERCE: te devolvemos el importe pagado por el mismo
     medio de pago con el que compraste, salvo que acordemos otro. A partir
     de ese momento la Licencia termina: tenés que dejar de usar el
     Software, desinstalarlo y borrar sus copias, incluidas las de respaldo.
     La prohibición de revender y redistribuir de la cláusula 4.5 sigue
     rigiendo igual, de modo indefinido.

11.6 VENCIDO EL PLAZO DE DIEZ DÍAS NO HAY DERECHO DE ARREPENTIMIENTO.
     Pasado ese plazo no hay reembolso por cambio de opinión, ni por no
     haber usado el Producto, ni por haberlo comprado por error, ni por
     haber comprado más licencias de las que necesitabas, ni por ninguna
     otra razón que no sea un defecto del Producto en los términos de la
     Vía B. Fuera de ese plazo, la única vía es la B.

11.7 SI NO SOS CONSUMIDOR FINAL —si compraste para tu actividad comercial,
     profesional o empresaria, o para reventa interna dentro de una
     organización— la Vía A no te aplica en absoluto: el derecho de
     arrepentimiento del art. 34 protege al consumidor final. En ese caso la
     única vía es la B, desde el primer día.


     VÍA B — DEFECTO DEL PRODUCTO
     -----------------------------

11.8 HASTA CUÁNDO SE PUEDE RECLAMAR UN DEFECTO. La Vía B tampoco es
     indefinida:

     a) Si sos consumidor final, la garantía por defectos es de SEIS (6)
        MESES contados desde la entrega del Producto. Es el mismo plazo que
        la Ley 24.240 fija para las cosas muebles nuevas, y lo adoptamos
        expresamente como plazo convencional de esta garantía.

     b) Si no sos consumidor final, la garantía contractual por defectos es
        de DIEZ (10) DÍAS CORRIDOS desde la entrega, en la máxima medida en
        que la ley permita pactarlo. Si esa reducción no te resultara
        oponible, rigen en su lugar los plazos del régimen de saneamiento
        del Código Civil y Comercial.

     c) Vencido el plazo que te corresponda, no hay obligación de corregir
        ni de reembolsar. Podés escribirnos igual y, como cortesía, vamos a
        intentar ayudarte (cláusula 12), pero ya no tenés derecho a que
        corrijamos nada ni a que te devolvamos el dinero.

     d) ADEMÁS, TENÉS QUE AVISARNOS PRONTO. Si aparece un defecto, tenés que
        denunciárnoslo dentro de los SESENTA (60) DÍAS de haberse
        manifestado (art. 1054 del Código Civil y Comercial). No alcanza con
        que el defecto haya aparecido dentro del plazo de garantía: si lo
        detectaste y dejaste pasar meses sin decirnos nada, el reclamo es
        tardío. Avisar a tiempo también es lo único que nos permite
        diagnosticarlo mientras todavía se puede.

     Los plazos corren desde la entrega y NO se reinician con las
     actualizaciones, las reinstalaciones, los cambios de equipo ni los
     reenvíos de cortesía de los archivos (cláusula 2.6).

     SÍ SE PROLONGAN, en cambio, por el tiempo durante el cual hayas estado
     privado del uso del Producto por causa de una reparación a nuestro
     cargo: ese lapso se suma al plazo de garantía, como manda el art. 16
     de la Ley 24.240.

     A LOS EFECTOS DE TODOS LOS PLAZOS DE ESTE CONTRATO, la entrega se
     produce cuando el Producto se pone a tu disposición para descargar
     (cláusula 2.6), con independencia de cuándo lo descargues, lo
     instales o lo empieces a usar por primera vez.

11.9 UN PROBLEMA QUE APARECE DESPUÉS CASI NUNCA ES UN DEFECTO, y estar
     dentro del plazo no lo convierte en uno.

     Si el Producto funcionaba y en algún momento dejó de funcionar sin que
     nosotros hayamos publicado ninguna versión nueva, lo que cambió no fue
     el Producto: fue el entorno donde corre. Los supuestos de la cláusula
     11.11 —una actualización del sistema operativo, un cambio de
     configuración, un antivirus nuevo, falta de espacio, un cambio de
     hardware— NO se vuelven defectos por haber aparecido más tarde, y
     quedan fuera del reembolso cualquiera sea el momento en que ocurran,
     incluso dentro del plazo de garantía.

     Dicho al revés: el plazo de la cláusula 11.8 limita hasta cuándo se
     puede reclamar un defecto, pero no amplía qué cosas son un defecto.

${pruebaInmutabilidad}

11.10 QUÉ CONSIDERAMOS UN DEFECTO: que el Producto no haga, de manera
     sustancial, lo que el anexo

       "${names.requisitos}"

     dice que hace, cuando se lo usa:

       a) en un equipo y un sistema operativo que cumplen los requisitos
          de ese anexo;
       b) en una instalación no modificada, con todos sus componentes
          originales; y
       c) del modo descripto en la documentación de la entrega.

     Si se cumplen esas tres condiciones y el Producto igual no funciona, es
     un defecto y responde el Licenciante.

     ESE ANEXO ES LA MEDIDA EXACTA DE LO PROMETIDO. Forma parte de este
     contrato, se entrega junto con él y está versionado: la edición
     aplicable es la vigente al momento de tu compra, que viaja en tu
     carpeta de entrega. Lo que el anexo declara como límite conocido no es
     un defecto, y lo que no figura en él no fue prometido.

11.11 QUÉ NO ES UN DEFECTO. La lista siguiente no es taxativa, y ninguno de
     estos supuestos da derecho a reembolso, porque en todos ellos el
     Producto no es la causa del problema:

     a) Falta de espacio en disco, de memoria o de recursos del equipo,
        incluida la que impida descargar o guardar los archivos que el
        Producto necesita para funcionar.

        Tampoco lo es EL RENDIMIENTO: cuánto tarda una generación, y
        qué duración de archivo se puede procesar de una sola vez,
        dependen de la capacidad de tu computadora, del nivel de calidad
        que elijas y del archivo, y no de una prestación que el Producto
        prometa. No declaramos ni garantizamos tiempos de procesamiento ni
        duraciones máximas, y así está informado antes de la compra en el
        anexo "${names.requisitos}".
        Que un archivo tarde mucho, agote la memoria del equipo o no
        llegue a completarse en una computadora determinada es un límite
        de ese equipo, no un defecto del Producto.

     b) Actualizaciones, cambios de versión o cambios de configuración del
        sistema operativo posteriores a la compra, y la pérdida de
        compatibilidad, de rendimiento o de funciones que puedan causar. El
        Producto se entrega para los sistemas informados antes de la
        compra; no garantizamos su compatibilidad con versiones futuras
        (cláusula 10.2).

     c) Configuración incorrecta, incompleta o modificada del equipo, del
        sistema operativo o del propio
        Producto.

     d) Permisos del sistema que no concediste, que revocaste, o que una
        política del equipo no permite conceder (cláusula 7.4).

     e) Antivirus, cortafuegos, políticas de seguridad, sistemas de gestión
        corporativa, o cualquier otro programa de terceros que bloquee,
        altere, ponga en cuarentena o interfiera con el Producto o con sus
        archivos.

     f) Fallas, límites o incompatibilidades del hardware: memoria
        insuficiente para el modelo elegido, controladores, disco.

     g) Falta de conexión a internet, conexión insuficiente o intermitente,
        o indisponibilidad de las descargas que dependen de terceros
        (cláusula 5).

     h) Haber modificado, reemplazado o eliminado cualquier componente del
        Producto (cláusula 5.6).

     i) Usarlo en un sistema operativo, una versión o una arquitectura
        distintos de los informados antes de la compra.

     j) La calidad o el contenido de las tarjetas generadas. La
        generación con inteligencia artificial es estadística y está
        advertido en la cláusula 9: una tarjeta con errores, omisiones,
        datos equivocados o mal redactada NO es un defecto del Producto,
        y menos aún si se guardó después de haberte sido mostrada para su
        revisión.

     k) No entender cómo usar el Producto, no saber configurarlo, no haber
        leído la documentación de la entrega, o esperar que haga algo que
        nunca dijimos que hace. Para eso podés escribirnos (cláusula 12) y
        vamos a intentar ayudarte, como cortesía y sin que eso genere
        derecho a reembolso.

     l) Que una función no esté disponible en tu plataforma o en tu equipo
        cuando eso está informado en la documentación de la entrega antes de
        la compra.

     m) Archivos de entrada dañados, incompletos, protegidos, cifrados o en
        formatos que el Producto no declara soportar.

     n) Pérdida de datos, de archivos o de resultados por causas ajenas al
        Producto, incluida la falta de copias de respaldo (cláusula 10.6).

     o) El arrepentimiento, el cambio de opinión, el desuso o la compra por
        error, que se rigen exclusivamente por la Vía A y su plazo.

11.12 CÓMO SE RECLAMA UN DEFECTO. Escribinos a
     ${L.email}
     con lo siguiente:

       · el comprobante de compra;
       · cuándo apareció el problema por primera vez;
       · qué esperabas que pasara y qué pasó en su lugar;
       · el mensaje de error exacto, si hubo uno;
       · qué sistema operativo y qué versión tenés;
       · el archivo de registro que genera el Producto (la documentación de
         la entrega explica dónde encontrarlo).

     Esa información no es un trámite: es lo único que permite distinguir un
     defecto del Producto de una causa externa, y computar los plazos de la
     cláusula 11.8 —la fecha de compra fija el plazo de garantía, y la fecha
     en que el problema apareció fija el de la denuncia—. Sin ella el
     reclamo no se puede evaluar, y te la vamos a pedir igual.

11.13 QUÉ HACEMOS CON UN RECLAMO. Lo diagnosticamos con esfuerzos
     razonables y en días hábiles. Según el resultado:

       · Si la causa es externa al Producto: te lo explicamos y, en la
         medida de lo razonable, te ayudamos igual a resolverlo. No
         corresponde reembolso, esté o no vencido el plazo de garantía.

       · Si es un defecto del Producto: LA SOLUCIÓN ES CORREGIRLO. Te
         entregamos una versión corregida o las instrucciones para
         solucionarlo, en un plazo razonable y sin costo para vos. El
         reembolso NO es la primera respuesta ni una opción a elección: es
         lo que corresponde sólo si el defecto no se puede corregir, o si
         corregido sigue impidiendo usar el Producto para lo que se anuncia.

     Un defecto reclamado dentro del plazo de garantía te da derecho a que
     el Producto FUNCIONE, que es lo que compraste. Si lo dejamos
     funcionando, la obligación quedó cumplida.

     Te pedimos que nos escribas antes de iniciar cualquier otra acción: en
     la enorme mayoría de los casos se resuelve por correo, y rápido.

11.14 SIN REEMBOLSOS PARCIALES. La Licencia es perpetua y de pago único: no
     hay reembolsos proporcionales, ni por tiempo no usado, ni por
     funciones que no hayas utilizado.

11.15 RECLAMOS ANTE EL MEDIO DE PAGO. Si iniciás un contracargo o
     desconocés el pago sin habernos escrito primero y sin haber ejercido la
     Vía A, además de terminar la Licencia (cláusula 13.3) nos impedís
     diagnosticar el problema, que es justamente lo que podría haberlo
     resuelto. La prohibición de revender y redistribuir de la cláusula 4.5
     sigue rigiendo en ese caso, igual que en cualquier otro.

11.16 TUS DERECHOS COMO CONSUMIDOR. Si adquiriste el Producto como
     consumidor final, te amparan la Ley 24.240 de Defensa del Consumidor y
     el Código Civil y Comercial de la Nación, incluida la garantía legal
     por defectos. Esos derechos son irrenunciables: nada de esta cláusula
     los limita ni los reemplaza, y toda disposición que se les oponga no se
     te aplica. Si tenés un reclamo también podés recurrir a la autoridad de
     defensa del consumidor de tu jurisdicción.


12. SOPORTE, ACTUALIZACIONES Y VIDA DEL PRODUCTO
------------------------------------------------

12.1 LO QUE COMPRASTE ES LA LICENCIA SOBRE EL PRODUCTO TAL COMO SE ENTREGA.
     El precio pagado no incluye ningún servicio continuado: ni soporte, ni
     mantenimiento, ni actualizaciones, ni compatibilidad futura. Esta
     cláusula existe para que eso quede claro desde el principio.

12.2 EL SOPORTE ES UNA CORTESÍA, NO UNA OBLIGACIÓN CONTRACTUAL. Hoy
     ofrecemos ayuda por correo electrónico a
     ${L.email}
     para consultas de instalación y uso, y la brindamos de buena fe, con
     esfuerzos razonables, en días hábiles y en español${
       L.plazoSoporte ? `, dentro de un\n     plazo orientativo de ${L.plazoSoporte}` : ', sin plazo de\n     respuesta garantizado'
     }.
     Podemos modificarla, reducirla o discontinuarla en cualquier momento,
     sin aviso previo, sin expresar motivo y sin que eso genere derecho a
     reembolso, compensación ni indemnización.

     LA ÚNICA EXCEPCIÓN es el diagnóstico y la corrección de los reclamos
     por defecto presentados en tiempo y forma según la cláusula 11: eso sí
     lo atendemos, porque es la garantía que la ley exige. Todo lo demás es
     cortesía.

12.3 QUÉ NO INCLUYE NI LA CORTESÍA: capacitación, personalizaciones,
     desarrollos a medida, recuperación de archivos, soporte sobre
     versiones modificadas por vos o con componentes reemplazados, ni
     soporte sobre tu hardware, tu sistema operativo, tu red o tu
     antivirus.

12.4 SIN ACTUALIZACIONES GARANTIZADAS: el Producto no tiene actualización
     automática y no estamos obligados a publicar nuevas versiones,
     correcciones, mejoras de seguridad, nuevos idiomas ni compatibilidad
     con sistemas operativos futuros. Si publicamos una versión nueva,
     ofrecértela o no es una decisión nuestra, y puede tener condiciones
     propias, incluido un precio.

12.5 LA AYUDA NO CREA OBLIGACIONES. Si en algún caso te ayudamos con algo
     que está fuera de este contrato, o después de vencidos los plazos de
     la cláusula 11, lo hacemos como cortesía. Esa cortesía no modifica
     este contrato, no extiende ninguna garantía, no reinicia ningún
     plazo, no crea precedente ni obligación de repetirla —con vos ni con
     nadie— y no implica renuncia a nada de lo pactado.

12.6 FIN DE VIDA DEL PRODUCTO. Podemos dejar de comercializar, desarrollar
     o mantener el Producto en cualquier momento, sin aviso previo y sin
     que eso genere derecho a reembolso ni indemnización. Nada de eso apaga
     tu Licencia: la copia que tenés sigue siendo tuya y podés seguir
     usándola. Lo que no garantizamos es que siga siendo compatible con los
     sistemas operativos que existan después, ni que las descargas que
     dependen de terceros (cláusula 5) sigan disponibles.

     CANAL DE CONTACTO. La dirección de correo indicada en este contrato es
     el canal vigente al momento de la entrega. Podemos reemplazarla por
     otra, informando el canal nuevo${
       L.web ? `\n     en ${L.web},` : '\n     en el sitio del Producto o en el punto de venta,'
     } con una antelación
     razonable. A partir de ese aviso, el canal
     informado reemplaza al de este contrato a todos sus efectos, incluidos
     los plazos y las comunicaciones de la cláusula 11. Mantener un canal
     de contacto vigente es una obligación nuestra; conocerlo antes de
     escribir, una carga tuya.


13. VIGENCIA Y TERMINACIÓN
--------------------------

13.1 Este contrato entra en vigor cuando instalás, abrís o usás el
     Software, y tiene duración indefinida.

13.2 La Licencia termina automáticamente, sin necesidad de intimación
     previa, si incumplís la cláusula 4, sin perjuicio de nuestro derecho
     a reclamar los daños causados.

13.3 La Licencia también termina si el pago con el que la adquiriste es
     revertido, desconocido, anulado o reclamado ante el medio de pago sin
     que hayas ejercido el derecho de arrepentimiento de la cláusula 11.3.

13.4 Terminada la Licencia, debés dejar de usar el Software,
     desinstalarlo y borrar sus copias, incluidas las de respaldo. Las
     prohibiciones de la cláusula 4 —en especial la de revender y
     redistribuir— siguen rigiendo después de la terminación, de modo
     indefinido y sin excepción (cláusula 4.5).

13.5 Podés dar por terminado este contrato cuando quieras: alcanza con
     desinstalar el Software y borrar sus copias. Salvo el supuesto de la
     cláusula 11.3, la terminación no da derecho a reembolso.

13.6 LA TERMINACIÓN NO ALCANZA A LOS COMPONENTES DE TERCEROS. Los
     derechos que sus licencias te otorgan sobre esos componentes
     sobreviven a la terminación de este contrato y no dependen de él en
     ninguna medida. Tampoco se ve afectada tu propiedad sobre los
     resultados ya generados, que siguen siendo enteramente tuyos.

13.7 Sobreviven a la terminación las cláusulas 3, 4, 5, 6, 8, 9, 10, 11,
     12.5 y 14, y toda otra que por su naturaleza deba subsistir.


14. LEY APLICABLE, JURISDICCIÓN Y DISPOSICIONES GENERALES
---------------------------------------------------------

14.1 Este contrato se rige por las leyes de la República Argentina.

14.2 Para cualquier controversia serán competentes los tribunales
     ordinarios de ${L.ciudad}, ${L.provincia}, con renuncia a cualquier
     otro fuero o jurisdicción.

14.3 SALVEDAD PARA CONSUMIDORES: si sos consumidor, la cláusula 14.2 no
     se te aplica. Será competente el tribunal correspondiente al lugar de
     tu domicilio, conforme a la normativa de defensa del consumidor.

14.4 Antes de iniciar cualquier acción, te pedimos que nos escribas: la
     enorme mayoría de los problemas se resuelve por correo.

14.5 ACUERDO COMPLETO: este contrato, junto con los demás archivos de la
     carpeta de entrega y tu comprobante de compra, constituye el acuerdo
     total entre las partes respecto de los Componentes Propietarios, y
     reemplaza cualquier comunicación anterior sobre el mismo objeto. Esta
     cláusula no alcanza a las licencias de los Componentes de Terceros,
     que rigen por sí mismas y con prevalencia (cláusula 5.2).

14.6 NULIDAD PARCIAL: si una cláusula resulta inválida o inaplicable, se
     la reemplaza por la disposición válida más parecida a su finalidad, y
     el resto del contrato sigue en plena vigencia. Cuando la invalidez
     provenga de un conflicto con la licencia de un Componente de
     Terceros, el reemplazo se hará en el sentido más favorable a los
     derechos que esa licencia otorga.

14.7 NO RENUNCIA: que no exijamos el cumplimiento de una cláusula en un
     momento dado no implica renuncia a exigirlo después.

14.8 CESIÓN: no podés ceder este contrato ni tu Licencia. El Licenciante
     puede cederlo a un sucesor o adquirente de su actividad,
     informándolo por los canales de contacto.

14.9 IDIOMA: la versión en español de este contrato es la única oficial.
     Cualquier traducción es de mera cortesía. Los títulos de las
     cláusulas son sólo una referencia y no afectan su interpretación.


15. CONTACTO
------------

${[
    `     ${L.nombre}`,
    L.cuit && `     CUIT/DNI: ${L.cuit}`,
    L.domicilio && `     Domicilio: ${L.domicilio}`,
    `     Correo: ${L.email}`,
    L.web && `     Sitio web: ${L.web}`
  ]
    .filter(Boolean)
    .join('\n')}

     ${APP_NAME}, versión ${version}
     Contrato versión ${L.contratoVersion}, vigente desde ${L.vigenciaDesde}.
     © ${anio} ${L.nombre}.
     Todos los derechos reservados sobre los Componentes Propietarios.

${LINE}
`
}