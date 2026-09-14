#!/usr/bin/env node
/**
 * Arma "Mediflashy - Entregables", la carpeta lista para subir a Drive.
 *
 * El nombre sale de `APP_NAME`, que a su vez sale del `productName` de
 * electron-builder: es la misma convención que "Convertexto Version Final -
 * Entregables" y así no queda una carpeta con el nombre del producto anterior,
 * que es exactamente lo que había pasado.
 *
 *   Mediflashy - Entregables/
 *   ├─ Versión Windows/    el instalador, el portable y sus textos
 *   └─ Versión MacOs/      los dos .dmg y sus textos
 *
 * Cada subcarpeta es una entrega COMPLETA e independiente: el comprador baja la
 * suya y ahí adentro tiene todo lo que necesita para instalar, usar y saber qué
 * compró. No tiene que entrar a la otra ni preguntarse cuál de los archivos le
 * corresponde.
 *
 * ---------------------------------------------------------------------------
 * Por qué separadas y no una sola carpeta con todo
 * ---------------------------------------------------------------------------
 *
 * Convertexto entrega una carpeta única con los cuatro instaladores y textos que
 * hablan de las dos plataformas ("si usás Windows… si usás Mac…"). Funciona, pero
 * tiene dos costos que acá se pueden evitar:
 *
 *  1. **El comprador de Windows baja 230 MB de los que 115 no le sirven**, o peor,
 *     abre el .dmg y no entiende por qué no pasa nada.
 *
 *  2. **Los textos hablan de un producto que no tiene.** El instructivo le explica
 *     Gatekeeper a alguien que usa Windows, y —lo que importa de verdad— la
 *     cláusula 11.9 del contrato CAMBIA según la plataforma: en Mac se apoya en la
 *     firma de Apple, que el sistema verifica al abrir; en Windows no hay firma y
 *     esa parte se cae. Con una carpeta por plataforma, cada comprador recibe el
 *     contrato que describe SU copia, no una mezcla.
 *
 * Los generadores de texto ya reciben `hasWindows`/`hasMac`, así que esto no
 * agrega complejidad: se los llama dos veces, una por carpeta.
 *
 * ---------------------------------------------------------------------------
 * Qué pasa si falta una plataforma
 * ---------------------------------------------------------------------------
 *
 * La carpeta se arma igual, con sus textos, y adentro queda una nota diciendo qué
 * falta y cómo completarlo. Es a propósito: los .dmg se compilan en una Mac, y
 * entre que se compila Windows y se compila Mac pasan días. Tener la carpeta ya
 * armada y esperando los dos archivos es mejor que no tenerla.
 *
 *   npm run drive
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, HAY_BONUS, HAY_MAPA_GRUPOS, buildEula, buildRequisitos, datosFaltantes, driveFiles, hasPlaceholders } from './lib/user-docs.mjs'
import { guiaATexto, guiaAyuda, guiaInicio } from './lib/guias.mjs'
import { buildLicencias } from './lib/licencias.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const OUT = join(ROOT, `${APP_NAME} - Entregables`)

const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = PKG.version

const BOM = String.fromCharCode(0xfeff)

/** Los .txt se escriben con BOM y CRLF para que se vean bien en el Bloc de notas. */
function writeText(path, content) {
  writeFileSync(path, BOM + content.replace(/\r?\n/g, '\r\n'), 'utf8')
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`

/** Busca un artefacto en release/ por sufijo, sin depender del número de versión. */
function findArtifact(suffix) {
  if (!existsSync(RELEASE)) return null
  const match = readdirSync(RELEASE).find((f) => f.endsWith(suffix))
  return match ? join(RELEASE, match) : null
}

const artefactos = {
  installer: findArtifact('-Windows-Instalador.exe'),
  portable: findArtifact('-Windows-Portable.exe'),
  macArm: findArtifact('-macOS-arm64.dmg'),
  macIntel: findArtifact('-macOS-x64.dmg')
}

const hayWindows = Boolean(artefactos.installer || artefactos.portable)
const hayMac = Boolean(artefactos.macArm || artefactos.macIntel)

if (!hayWindows && !hayMac) {
  console.error('No encontré instaladores en release/.')
  console.error('Compilá primero:  npm run build:win   (y/o  npm run build:mac  en una Mac)')
  process.exit(1)
}

/*
 * ¿Los instaladores son de este código, o de una compilación vieja?
 *
 * POR QUÉ ESTO CORTA. Este script sólo COPIA lo que encuentra en `release/`, así
 * que no tiene forma de saber si eso se compiló hace cinco minutos o hace una
 * semana con la mitad de las mejoras. Y armar la entrega es lo último que uno hace
 * después de tocar código: la secuencia natural —cambiar algo, probarlo con
 * `npm run dev`, y correr `npm run drive`— produce una carpeta con un .exe viejo
 * sin que nada lo delate.
 *
 * Pasó de verdad: la entrega salió con un instalador anterior a un cambio de
 * interfaz, y sólo lo agarró el arnés que abre el .exe y mira la pantalla. Sin esta
 * guarda, eso llega a Drive.
 *
 * Se compara contra `out/main/index.js`, que es lo último que escribe
 * `electron-vite build`.
 */
const compilado = join(ROOT, 'out', 'main', 'index.js')
if (existsSync(compilado)) {
  const codigo = statSync(compilado).mtimeMs
  const viejos = Object.entries(artefactos)
    .filter(([, ruta]) => ruta && statSync(ruta).mtimeMs < codigo - 1000)
    .map(([, ruta]) => ruta)

  if (viejos.length > 0) {
    console.error('\nLos instaladores de release/ son ANTERIORES al código compilado.\n')
    for (const v of viejos) console.error(`   viejo: ${v}`)
    console.error('\nSi armara la entrega con esto, subirías a Drive una versión sin los')
    console.error('últimos cambios y no habría forma de notarlo mirando la carpeta.')
    console.error('\nRecompilá y volvé a intentar:')
    console.error('   npm run build:win        (y `npm run build:mac` en una Mac)')
    console.error('   npm run drive\n')
    process.exit(1)
  }
}

/*
 * El aviso de licencias se arma ANTES de copiar nada: si le faltan datos, la
 * entrega no se puede armar y es preferible cortar antes de mover 200 MB.
 *
 * La licencia MIT de llama.cpp pide que el aviso diga la versión exacta y dónde
 * está su código fuente, y eso sale del VERSION.txt que deja `setup:llama`.
 */
const licencias = buildLicencias({ productName: PKG.productName, version })

if (!licencias.llama || licencias.faltantes.length) {
  console.error('\nNo puedo armar la entrega: al aviso de licencias le faltan datos.\n')
  if (!licencias.llama) {
    console.error('   falta: resources/llm/<plataforma>/VERSION.txt')
    console.error('          Corré `npm run setup:llama`.')
  }
  for (const f of licencias.faltantes) console.error(`   falta en node_modules: ${f}`)
  console.error('\nEl aviso tiene que declarar la versión exacta de llama.cpp y dónde está')
  console.error('su código fuente: es lo que pide su licencia MIT.\n')
  process.exit(1)
}

/* ------------------------------ una plataforma ----------------------------- */

/**
 * Sincroniza una carpeta en vez de borrarla y rehacerla.
 *
 * Borrarla entera sería más simple y es destructivo: los .exe pesan 115 MB cada
 * uno y Windows los deja bloqueados si el Explorador los está previsualizando o si
 * la app está abierta. El `rmSync` se llevaba puesto el instalador y recién después
 * fallaba con EPERM sobre el portable, dejando una carpeta incompleta que a simple
 * vista parece completa. Pasó de verdad en Convertexto.
 */
function sincronizar(dir, esperados) {
  mkdirSync(dir, { recursive: true })
  for (const name of readdirSync(dir)) {
    if (esperados.has(name)) continue
    try {
      rmSync(join(dir, name), { recursive: true, force: true })
      console.log(`   (quité "${name}", que ya no corresponde)`)
    } catch {
      console.error(`No pude borrar "${name}" de ${dir}: cerrá el Explorador de`)
      console.error('archivos y la app, y volvé a correr `npm run drive`.')
      process.exit(1)
    }
  }
}

function copiar(origen, destino) {
  // Los .exe son idénticos entre corridas salvo que se haya recompilado: copiar
  // 230 MB de nuevo cada vez sólo suma tiempo y chances de chocar con un lock.
  const src = statSync(origen)
  const actual = existsSync(destino) ? statSync(destino) : null
  if (actual && actual.size === src.size && actual.mtimeMs >= src.mtimeMs) return
  try {
    copyFileSync(origen, destino)
  } catch (err) {
    console.error(`No pude copiar "${destino}": ${err.message}`)
    console.error('Suele ser que el archivo está abierto. Cerrá el Explorador de')
    console.error('archivos y la app, y volvé a correr `npm run drive`.')
    process.exit(1)
  }
}

const FALTA_MAC = 'FALTA — los dos instaladores de Mac.txt'

/**
 * Los materiales de regalo, que van en las DOS carpetas.
 *
 * Son cinco archivos de texto de 6 KB cada uno: duplicarlos cuesta 30 KB y a
 * cambio cada carpeta sigue siendo una entrega completa que se puede mandar
 * sola. Ese fue el criterio desde el principio y no se rompe por 30 KB.
 *
 * La landing de venta los promete con nombre y número ("4 apuntes... 80
 * tarjetas"). Si esta carpeta no viaja, el comprador paga por algo que no
 * recibe, así que acá se corta el build en vez de avisar.
 */
const BONUS_ORIGEN = join(ROOT, 'recursos-bonus')
// "11." y no "10.": el 10 ya lo ocupa el mapa de grupos (`names.mapaGrupos`),
// que es un bonus real y viaja siempre. Este es el que sigue apagado.
const BONUS_DESTINO = '11. Apuntes de regalo'
/** Adentro de esa carpeta, los tres bonus de la oferta (30 PDF en total). */
const BONUS_GRANDES = 'Bonus'

/** Los PDF ya impresos por `npm run make:pdfs`. */
const DOCS_ORIGEN = join(ROOT, 'recursos-docs')

/** El nombre que lleva la guía en la carpeta del comprador. */
const nombrePdf = (nombreTxt) => nombreTxt.replace(/\.txt$/, '.pdf')

/**
 * Cómo se llama ese mismo PDF adentro de `recursos-docs`.
 *
 * Hay dos versiones de cada guía —una para Windows y otra para Mac, porque los
 * pasos de instalación son distintos— y las dos se numeran igual en la carpeta
 * del comprador, que sólo lleva una. Adentro de `recursos-docs` conviven, así
 * que las de Mac llevan un prefijo.
 */
const pdfOrigen = (nombreTxt, plataforma) =>
  `${plataforma.hasMac && !plataforma.hasWindows ? 'mac — ' : ''}${nombrePdf(nombreTxt)}`

/**
 * La carpeta de regalo: cuatro apuntes en .txt y dos guías en PDF.
 *
 * ---------------------------------------------------------------------------
 * Por qué los apuntes NO son PDF y las guías sí
 * ---------------------------------------------------------------------------
 *
 * Las guías se leen: van en PDF, maquetadas, con los colores de la app.
 *
 * Los apuntes NO se leen: se COPIAN Y SE PEGAN en la pestaña Generar. Y la app
 * misma le dice al comprador, en dos lugares distintos, que pegar el texto da
 * mejores resultados que sacarlo de un PDF —porque un PDF no guarda párrafos y
 * hay que reconstruir el orden de lectura—. Entregar el material de prueba en
 * el formato que el producto desaconseja sería fabricarle al comprador el
 * primer mal resultado, justo en su primera generación.
 */
function copiarBonus(dir) {
  if (!existsSync(BONUS_ORIGEN)) {
    console.error(`\nNo existe ${BONUS_ORIGEN}.`)
    console.error('La landing promete los apuntes de regalo. Corré:  npm run make:bonus\n')
    process.exit(1)
  }
  const apuntes = readdirSync(BONUS_ORIGEN).filter((f) => f.toLowerCase().endsWith('.txt'))
  if (apuntes.length !== 4) {
    console.error(`\nEsperaba 4 apuntes de arranque y encontré ${apuntes.length}.`)
    console.error('Si cambiaste la cantidad, actualizá también la landing, que dice "4 apuntes".\n')
    process.exit(1)
  }

  if (!existsSync(DOCS_ORIGEN)) {
    console.error(`\nNo existe ${DOCS_ORIGEN}.`)
    console.error('Las guías se imprimen aparte. Corré:  npm run make:pdfs\n')
    process.exit(1)
  }
  const destino = join(dir, BONUS_DESTINO)
  /*
   * La subcarpeta de los tres bonus grandes va listada como "esperada" para que
   * `sincronizar` no la borre: barre todo lo que no reconoce, y sin esto
   * limpiaría los 30 PDF recién copiados en cada corrida.
   */
  const todos = [...apuntes, BONUS_GRANDES]
  sincronizar(destino, new Set(todos))
  for (const f of apuntes) copiar(join(BONUS_ORIGEN, f), join(destino, f))
  return copiarBonusGrandes(join(destino, BONUS_GRANDES)) + apuntes.length
}

/**
 * Los tres bonus que se imprimen aparte: las parejas, el mapa de autores y los
 * 28 simulacros.
 *
 * Se copia el árbol entero de `recursos-docs/Bonus` en vez de nombrar archivo
 * por archivo. Son 30 PDF y su cantidad depende de cuántas materias traiga la
 * app: una lista escrita a mano acá quedaría desactualizada la primera vez que
 * se agregue una materia, y el comprador recibiría la carpeta incompleta sin
 * que salte ningún error.
 */
function copiarBonusGrandes(destino) {
  const origen = join(DOCS_ORIGEN, 'Bonus')
  if (!existsSync(origen)) {
    console.error(`\nNo existe ${origen}.`)
    console.error('Son los tres bonus de la oferta. Corré:  npm run make:pdfs\n')
    process.exit(1)
  }

  let cuantos = 0
  const copiarArbol = (desde, hacia) => {
    mkdirSync(hacia, { recursive: true })
    const hijos = readdirSync(desde, { withFileTypes: true })
    sincronizar(hacia, new Set(hijos.map((h) => h.name)))
    for (const h of hijos) {
      if (h.isDirectory()) copiarArbol(join(desde, h.name), join(hacia, h.name))
      else {
        copiar(join(desde, h.name), join(hacia, h.name))
        cuantos++
      }
    }
  }
  copiarArbol(origen, destino)

  /* Los 28 simulacros son 14 pares. Un número impar significa que una materia
     se quedó sin su documento de respuestas, o al revés. */
  const sim = join(destino, 'Simulacros de final')
  const pares = existsSync(sim) ? readdirSync(sim).filter((f) => f.endsWith('.pdf')).length : 0
  if (pares % 2 !== 0) {
    console.error(`\nHay ${pares} PDF de simulacro: tienen que ser pares, uno de preguntas y uno`)
    console.error('de respuestas por materia. Volvé a correr:  npm run make:pdfs\n')
    process.exit(1)
  }
  return cuantos
}

/**
 * Arma una de las dos carpetas.
 *
 * `plataforma` decide QUÉ dicen los textos, no sólo qué archivos se copian: los
 * generadores reciben `hasWindows`/`hasMac` y escriben un instructivo y un contrato
 * específicos. Ver el comentario del encabezado.
 */
function armarCarpeta({ nombre, plataforma, binarios, faltante }) {
  const dir = join(OUT, nombre)
  const names = driveFiles(plataforma)

  const copias = binarios.filter((b) => b.origen)

  /*
   * Las dos guías del producto van en PDF; los tres documentos legales, en .txt.
   *
   * No es una inconsistencia de formato: es una distinción entre dos clases de
   * documento. La licencia de uso, el anexo de requisitos y las licencias de
   * terceros son contractuales — su texto está acordado, la cláusula 11 define
   * los defectos comparándolos contra el anexo, y el .txt plano es el formato en
   * el que se pactaron. Las guías son material de acompañamiento y se leen de
   * punta a punta: ésas sí ganan con estar maquetadas.
   */
  const pdfInicio = nombrePdf(names.readme)
  const pdfAyuda = nombrePdf(names.help)

  const esperados = new Set([
    ...copias.map((b) => b.destino),
    pdfInicio,
    pdfAyuda,
    names.licenses,
    names.eula,
    names.requisitos,
    names.metodo,
    names.recetario,
    ...(HAY_MAPA_GRUPOS ? [names.mapaGrupos] : []),
    ...(HAY_BONUS ? [BONUS_DESTINO] : []),
    ...(faltante ? [FALTA_MAC] : [])
  ])

  sincronizar(dir, esperados)
  for (const b of copias) copiar(b.origen, join(dir, b.destino))

  const args = { version, names, ...plataforma }
  const eula = buildEula(args)
  /* Se revisan por marcadores los textos que EFECTIVAMENTE se entregan. Los PDF
     salen de estas mismas dos guías, así que revisar su versión en texto revisa
     lo que el comprador va a leer. */
  const readme = guiaATexto(guiaInicio(args))
  const help = guiaATexto(guiaAyuda(args))

  copiar(join(DOCS_ORIGEN, pdfOrigen(names.readme, plataforma)), join(dir, pdfInicio))
  copiar(join(DOCS_ORIGEN, pdfOrigen(names.help, plataforma)), join(dir, pdfAyuda))

  /*
   * Las dos guías de estudio, sueltas en la carpeta.
   *
   * Son las mismas para las dos plataformas —hablan del método de estudio, no
   * de cómo se instala— así que no llevan la variante "mac —" que sí llevan las
   * dos guías del producto.
   */
  const sueltosParaCopiar = [names.metodo, names.recetario, ...(HAY_MAPA_GRUPOS ? [names.mapaGrupos] : [])]
  for (const g of sueltosParaCopiar) {
    const origen = join(DOCS_ORIGEN, g)
    if (!existsSync(origen)) {
      console.error(`\nFalta "${g}" en ${DOCS_ORIGEN}.`)
      console.error('Las guías y el bonus se imprimen aparte. Corré:  npm run make:pdfs\n')
      process.exit(1)
    }
    copiar(origen, join(dir, g))
  }
  writeText(join(dir, names.licenses), licencias.texto)
  writeText(join(dir, names.eula), eula)
  writeText(join(dir, names.requisitos), buildRequisitos(args))

  if (HAY_BONUS) copiarBonus(dir)

  if (faltante) writeText(join(dir, FALTA_MAC), faltante)

  const archivos = readdirSync(dir).map((f) => ({ name: f, size: statSync(join(dir, f)).size }))
  return { dir, nombre, archivos, textos: { readme, help, eula } }
}

/* --------------------------------- armado --------------------------------- */

mkdirSync(OUT, { recursive: true })

// Si sobra una carpeta de una corrida anterior con otro nombre, se saca.
for (const name of readdirSync(OUT)) {
  if (name === 'Versión Windows' || name === 'Versión MacOs') continue
  try {
    rmSync(join(OUT, name), { recursive: true, force: true })
    console.log(`   (quité "${name}", que ya no corresponde)`)
  } catch {
    /* si está bloqueado, se avisa abajo por el listado */
  }
}

const hechas = []

hechas.push(
  armarCarpeta({
    nombre: 'Versión Windows',
    plataforma: { hasWindows: true, hasMac: false },
    binarios: [
      { origen: artefactos.installer, destino: driveFiles({ hasWindows: true }).installer },
      { origen: artefactos.portable, destino: driveFiles({ hasWindows: true }).portable }
    ]
  })
)

const macNames = driveFiles({ hasWindows: false })
hechas.push(
  armarCarpeta({
    nombre: 'Versión MacOs',
    plataforma: { hasWindows: false, hasMac: true },
    binarios: [
      { origen: artefactos.macArm, destino: macNames.macArm },
      { origen: artefactos.macIntel, destino: macNames.macIntel }
    ],
    faltante: hayMac
      ? null
      : [
          'ESTA CARPETA TODAVÍA NO ESTÁ COMPLETA',
          '=====================================',
          '',
          'Los textos ya están listos y son los definitivos para Mac.',
          'Lo que falta son los dos instaladores:',
          '',
          `   ${macNames.macArm}`,
          `   ${macNames.macIntel}`,
          '',
          'Se compilan EN UNA MAC, con el certificado Developer ID en el llavero y',
          'estas tres variables en el entorno:',
          '',
          '   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID',
          '',
          'Ahí se corre:',
          '',
          '   npm install',
          '   npm run build:mac',
          '   npm run drive',
          '',
          '`build:mac` firma y notariza, y termina con `verify:firma-mac`, que es el',
          'que corta si algo quedó sin firmar: electron-builder, si no encuentra el',
          'certificado, sólo escribe un aviso y sigue de largo dejando una app sin',
          'firmar que macOS después bloquea.',
          '',
          '`npm run drive` vuelve a armar esta carpeta y borra este archivo solo.',
          '',
          'NO SUBAS ESTA CARPETA A DRIVE HASTA QUE ESTE ARCHIVO DESAPAREZCA.',
          ''
        ].join('\n')
  })
)

/* -------------------------------- el informe ------------------------------- */

console.log('')
console.log(`Carpeta lista:  ${OUT}`)

let total = 0
for (const { nombre, archivos } of hechas) {
  console.log('')
  console.log(`   ${nombre}/`)
  for (const f of archivos.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    total += f.size
    console.log(`      ${f.name.padEnd(52)} ${mb(f.size).padStart(8)}`)
  }
}
console.log('')
console.log(`   ${'TOTAL'.padEnd(55)} ${mb(total).padStart(8)}`)
console.log('')

if (!hayMac) {
  console.log('   ⚠  "Versión MacOs" tiene los textos pero NO los .dmg.')
  console.log('      Adentro quedó un archivo explicando cómo completarla.')
  console.log('')
}

/*
 * Va último y grita a propósito: un contrato con los datos del vendedor sin
 * completar no es exigible, y encima incumple el deber de identificación del
 * proveedor (Ley 24.240 art. 4). Es lo peor que se puede mandar a un comprador.
 *
 * `datosFaltantes()` mira los datos de ENTRADA y `hasPlaceholders()` la salida:
 * desde que hay campos que legítimamente van vacíos, un obligatorio en blanco no
 * deja ningún corchete que encontrar, y la carpeta se subiría con un contrato que
 * dice `"El Licenciante" (también "nosotros") es .`
 */
const conMarcadores = hechas.flatMap(({ nombre, textos }) =>
  Object.entries(textos)
    .filter(([, texto]) => hasPlaceholders(texto))
    .map(([cual]) => `${nombre}/${cual}`)
)
const sinDatos = datosFaltantes()

if (conMarcadores.length || sinDatos.length) {
  console.log('   ###########################################################')
  console.log('   #  ATENCIÓN: NO SUBAS ESTA CARPETA TODAVÍA                #')
  console.log('   ###########################################################')
  console.log('')
  if (sinDatos.length) {
    console.log('   Campos OBLIGATORIOS de LICENCIANTE sin completar:')
    for (const f of sinDatos) console.log(`      LICENCIANTE.${f}`)
    console.log('')
  }
  for (const d of conMarcadores) console.log(`   "${d}" tiene datos sin completar.`)
  console.log('   Completalos en LICENCIANTE, en scripts/lib/user-docs.mjs,')
  console.log('   y volvé a correr `npm run drive`.')
  console.log('')
  console.log('   Los campos cuit, domicilio, web y plazoSoporte son OPCIONALES:')
  console.log("   dejalos en '' y el contrato se redacta sin ellos.")
  console.log('')
  // Sale con error, no sólo con un cartel: en Convertexto el cartel solo no
  // alcanzó, porque el comando terminaba en verde y el aviso quedaba quince
  // líneas más arriba en la terminal.
  process.exit(1)
}
