#!/usr/bin/env node
/**
 * Portero de la firma y la notarización. Se corre DESPUÉS de electron-builder y
 * corta el build si los .app que acaba de generar no están firmados con Developer
 * ID y notarizados como corresponde.
 *
 * POR QUÉ EXISTE, y por qué no alcanza con `notarize: true`
 * --------------------------------------------------------
 * MacTargetHelper.notarizeIfProvided() de app-builder-lib 26 NO corta si faltan
 * las variables de entorno de notarización:
 *
 *     const options = MacTargetHelper.getNotarizeOptions(appPath)
 *     if (!options) {
 *       log.warn({ reason: '`notarize` options were unable to be generated' },
 *                'skipped macOS notarization')
 *       return                                  // <-- sigue, no tira error
 *     }
 *
 * O sea que un secret mal cargado produce dos .dmg SIN NOTARIZAR, un build en
 * verde, y un aviso perdido entre miles de líneas de log. El comprador ve el mismo
 * cartel de Gatekeeper que antes y nos enteramos por un reclamo. Este script es el
 * corte que electron-builder no hace.
 *
 * Y cubre lo que tampoco se puede dar por sentado sobre los DOS BINARIOS
 * EMBEBIDOS: @electron/osx-sign los encuentra recorriendo Contents/ y quedándose
 * con lo que `isbinaryfile` considere binario. Es un heurístico, no una
 * comprobación de Mach-O. Acá se afirma el RESULTADO, no el mecanismo: si algún
 * día ese walk cambia, o el heurístico falla, o `mac.binaries` deja de resolver,
 * el build corta acá y no en la Mac de un comprador.
 *
 * Uso:
 *   node scripts/verify-firma-mac.mjs      # o `npm run verify:firma-mac`
 *
 * Lee APPLE_TEAM_ID del entorno. Si está, exige que la firma declare ESE Team ID
 * y agrega el requisito compuesto de codesign; si no está, se conforma con que
 * haya alguno (así el script sigue sirviendo para mirar un build ajeno).
 *
 * Sale 0 si está todo; 1 con la lista de problemas y qué mirar; 2 si se lo corre
 * fuera de macOS (usa codesign, spctl y xcrun stapler, que sólo existen ahí).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const TEAM_ID = (process.env.APPLE_TEAM_ID ?? '').trim()

const log = (msg) => console.log(`[firma] ${msg}`)
/** Rutas relativas al proyecto y con `/`: se leen igual en cualquier log. */
const corta = (p) => relative(ROOT, p).split(sep).join('/')

/* ------------------------------- problemas ------------------------------- */

/**
 * No se corta en el primer problema: se juntan todos. "No está firmado" y "está
 * firmado pero sin sello de tiempo" se arreglan distinto, y enterarse de a uno
 * cuesta 40 minutos de build por vez.
 */
const problemas = []
const problema = (que, detalle) => problemas.push({ que, detalle })

/** Afirma una cosa concreta. `detalle` es lo que se imprime si falla. */
function check(condicion, que, detalle) {
  if (condicion) {
    console.log(`  OK    ${que}`)
    return true
  }
  console.log(`  FALLA ${que}`)
  problema(que, detalle)
  return false
}

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  // codesign y spctl escriben en stderr incluso cuando salen bien: se junta todo.
  return { status: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/* ------------------------------ plataforma ------------------------------- */

if (process.platform !== 'darwin') {
  console.error('[firma] Sólo corre en macOS: usa codesign, spctl y xcrun stapler.')
  process.exit(2)
}

/* ------------------------- qué .app hay que mirar ------------------------ */

/**
 * Las carpetas que deja electron-builder, una por arquitectura. Se DESCUBREN en
 * vez de escribirse a mano porque el sufijo lo decide builder-util y no es obvio:
 * `mac-arm64` para Apple Silicon y `mac` a secas para x64, que es la arquitectura
 * por defecto (el mismo motivo por el que el ${arch} del dmg queda vacío en
 * Intel; ver el comentario largo de electron-builder.yml).
 */
const bundles = existsSync(RELEASE)
  ? readdirSync(RELEASE)
      .filter((d) => d === 'mac' || d.startsWith('mac-'))
      .map((d) => join(RELEASE, d, `${PKG.productName}.app`))
      .filter(existsSync)
  : []

if (bundles.length === 0) {
  console.error(`[firma] No encontré ningún "${PKG.productName}.app" en release/.`)
  console.error('[firma] ¿Corrió electron-builder? Este script va DESPUÉS del empaquetado.')
  process.exit(2)
}

/*
 * Los motores, dentro del bundle. Las rutas salen de extraResources y son las
 * mismas que `mac.binaries` de electron-builder.yml: si una lista cambia, la
 * otra también.
 *
 * ACÁ ESTABAN LOS DE CONVERTEXTO —whisper-cli y ffmpeg— que en Flashcards no
 * existen. Como el bucle marca el motor faltante con `check(false, …)`, este
 * script cortaba el build de macOS con un error sobre whisper-cli, un binario
 * que la app nunca tuvo. Y, peor, los `llama-server` que sí viajan no se
 * verificaban nunca: quedaban fuera del único control que corta.
 *
 * La otra diferencia es la arquitectura. Los motores de Convertexto son Mach-O
 * universales (una sola copia con las dos slices), así que allá se exige
 * `arm64 + x86_64` en los dos. Los de llama.cpp se bajan por separado, uno por
 * arquitectura, así que acá cada uno tiene que declarar LA SUYA. Exigir
 * universalidad haría fallar un build correcto; no exigir nada dejaría pasar
 * dos copias de la misma arquitectura, que es el error real que puede cometer
 * `fetch-llama.mjs` al bajarlos.
 */
const MOTORES = [
  ['llama-server arm64', join('Contents', 'Resources', 'llm', 'darwin-arm64', 'llama-server'), 'arm64'],
  ['llama-server x64', join('Contents', 'Resources', 'llm', 'darwin-x64', 'llama-server'), 'x86_64']
]

/* ------------------------------ la firma -------------------------------- */

/**
 * Lo que TIENE que cumplir cualquier Mach-O del bundle. Se afirma cada cosa por
 * separado a propósito: un booleano único no distingue entre "no está firmado" y
 * "está firmado pero le falta el hardened runtime", y el arreglo es distinto.
 *
 * @param {string} etiqueta  cómo se llama esto en el mensaje
 * @param {string} path      el .app o el binario
 */
function verificarFirma(etiqueta, path) {
  const { salida } = sh('codesign', ['-dv', '--verbose=4', path])
  const linea = (re) => (salida.match(re) ?? [])[0] ?? '(ausente)'
  const autoridades = salida.match(/^Authority=.*$/gm) ?? []

  // Con Developer ID, codesign NO imprime ninguna línea `Signature=`: imprime
  // `Signature size=NNNN`. Que apareciera "adhoc" significa que electron-builder
  // no encontró el certificado y firmó por las suyas, que es justo el .dmg que no
  // se puede entregar.
  check(
    !/Signature=adhoc/.test(salida),
    `${etiqueta}: no quedó con la firma ad-hoc`,
    `${linea(/^Signature.*$/m)} — electron-builder no encontró el certificado. Revisá CSC_LINK, CSC_KEY_PASSWORD y el valor de mac.identity.`
  )

  check(
    /^Authority=Developer ID Application: /m.test(salida),
    `${etiqueta}: firmado con un Developer ID Application`,
    autoridades[0] ?? '(sin ninguna línea Authority)'
  )

  // Tienen que salir TRES líneas Authority: hoja, intermedio y raíz. Si sale una
  // sola, al .p12 le falta el certificado intermedio de Apple.
  check(
    /Apple Root CA/.test(salida),
    `${etiqueta}: la cadena de certificados llega hasta Apple Root CA`,
    `${autoridades.length} autoridad(es): ${autoridades.join(' | ') || '(ninguna)'} — si es una sola, rehacé el .p12 con -certfile (los intermedios de apple.com/certificateauthority).`
  )

  check(
    /^Timestamp=/m.test(salida),
    `${etiqueta}: tiene sello de tiempo seguro`,
    'sin la línea Timestamp= notarytool rechaza el envío con "The signature does not include a secure timestamp"'
  )

  check(
    /flags=\S*runtime/.test(salida),
    `${etiqueta}: hardened runtime activado`,
    `${linea(/^CodeDirectory.*$/m)} — sin el flag runtime, Apple rechaza con "The executable does not have the hardened runtime enabled"`
  )

  if (TEAM_ID) {
    check(
      salida.includes(`TeamIdentifier=${TEAM_ID}`),
      `${etiqueta}: el Team ID es ${TEAM_ID}`,
      `${linea(/^TeamIdentifier=.*$/m)} — no coincide con APPLE_TEAM_ID`
    )

    // La afirmación más fuerte de todas, en un solo comando: que la cadena ancle
    // en Apple Y que la hoja sea nuestro Team ID. Si el certificado no es el que
    // creemos, o la cadena está incompleta, acá se ve.
    const req = sh('codesign', [
      '--verify',
      '--strict',
      '-R',
      `=anchor apple generic and certificate leaf[subject.OU] = "${TEAM_ID}"`,
      path
    ])
    check(
      req.status === 0,
      `${etiqueta}: cumple "anchor apple generic + OU=${TEAM_ID}"`,
      req.salida.trim().slice(-300)
    )
  } else {
    check(
      /^TeamIdentifier=(?!not set)/m.test(salida),
      `${etiqueta}: declara algún Team ID`,
      `${linea(/^TeamIdentifier=.*$/m)} — poné APPLE_TEAM_ID en el entorno para exigir el valor exacto`
    )
  }
}

/* ------------------------------- recorrida ------------------------------- */

for (const app of bundles) {
  console.log('')
  log(corta(app))

  verificarFirma('la app', app)

  // El sello del .app incluye el hash de TODO lo que hay en Contents/. Si algo se
  // modificó después de firmar —un hook mal puesto en afterSign, por ejemplo—
  // acá aparece como "a sealed resource is missing or invalid".
  const deep = sh('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
  check(
    deep.status === 0,
    'la app: la firma verifica en todo el bundle (--deep --strict)',
    deep.salida.trim().slice(-300)
  )

  for (const [nombre, rel, arqEsperada] of MOTORES) {
    const bin = join(app, rel)
    if (!existsSync(bin)) {
      check(false, `${nombre}: viajó adentro del .app`, corta(bin))
      continue
    }
    verificarFirma(nombre, bin)

    // Que cada motor sea el de SU arquitectura. Los dos se bajan del mismo
    // release de llama.cpp con nombres que se diferencian en una palabra, así
    // que bajar dos veces el mismo es un error fácil de cometer y imposible de
    // ver mirando la carpeta: los archivos se llaman igual. El síntoma en la
    // Mac del comprador sería que el motor no arranca, sin nada en pantalla.
    const archs = sh('lipo', ['-archs', bin]).salida.trim()
    check(
      new RegExp(`\\b${arqEsperada}\\b`).test(archs),
      `${nombre}: es de la arquitectura que dice su carpeta (${arqEsperada})`,
      `lipo -archs devolvió "${archs}"`
    )
  }

  // LA notarización. `stapler validate` es lo único que prueba que el ticket está
  // PEGADO al bundle, que es lo que hace que la Mac del comprador la acepte
  // incluso sin internet.
  const stapler = sh('xcrun', ['stapler', 'validate', app])
  check(
    stapler.status === 0,
    'la app: tiene el ticket de notarización pegado',
    `${stapler.salida.trim().slice(-300)} — "Error 65" significa que no hay ticket: la notarización no corrió (buscá "skipped macOS notarization" más arriba en el log) o no llegó a pegarlo.`
  )

  // Y esto es, literalmente, lo que va a decidir si el comprador puede abrirla.
  const spctl = sh('spctl', ['-a', '-t', 'exec', '-vvv', app])
  log(`  spctl: ${spctl.salida.trim().replace(/\n/g, ' | ')}`)
  check(spctl.status === 0, 'la app: Gatekeeper la ACEPTA', spctl.salida.trim().slice(-300))
  check(
    /source=Notarized Developer ID/.test(spctl.salida),
    'la app: Gatekeeper la reconoce como NOTARIZADA',
    `${spctl.salida.trim().slice(-300)} — "source=Unnotarized Developer ID" quiere decir bien firmada pero SIN notarizar.`
  )
}

/* --------------------------- los .dmg de salida -------------------------- */

console.log('')
const dmgs = existsSync(RELEASE) ? readdirSync(RELEASE).filter((f) => f.endsWith('.dmg')) : []
check(
  dmgs.length === 2,
  `se generaron los dos .dmg (arm64 e Intel)`,
  `encontré ${dmgs.length}: ${dmgs.join(', ') || 'ninguno'}`
)

/* -------------------------------- final --------------------------------- */

console.log('')
if (problemas.length > 0) {
  log(`${problemas.length} verificación(es) fallaron. Los .dmg NO se pueden entregar.`)
  console.log('')
  for (const { que, detalle } of problemas) {
    console.log(`  · ${que}`)
    if (detalle) console.log(`      ${String(detalle).split('\n').slice(0, 4).join('\n      ')}`)
  }
  console.log('')
  log('Si más arriba en el log dice "skipped macOS notarization", falta algún secret:')
  log('  APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID.')
  log('Si Apple rechazó el envío, pedile el motivo exacto (nombra el archivo culpable):')
  log('  xcrun notarytool history --apple-id "$APPLE_ID" \\')
  log('    --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"')
  log('  xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" \\')
  log('    --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"')
  process.exit(1)
}

log('Firma y notarización verificadas: los .dmg se pueden entregar.')
