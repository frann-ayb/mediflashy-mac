/**
 * Hook `afterPack` de electron-builder: saca el contrato de licencia del paquete
 * cuando el build es de PRUEBA.
 *
 * PARA QUÉ
 * --------
 * `LICENCIA DE USO.txt` viaja adentro del .app (extraResources en
 * electron-builder.yml) y se genera desde la constante LICENCIANTE. Mientras esos
 * datos no estén completos, el archivo sale con marcadores tipo
 * `[NOMBRE O RAZÓN SOCIAL DEL LICENCIANTE]`.
 *
 * Un build de prueba —el que sirve para validar la firma de Apple antes de tener
 * resuelto lo legal— puede llegar a manos de alguien. Que ese alguien encuentre un
 * contrato a medio llenar es peor que que no encuentre ninguno: parece un descuido
 * y, si además pagó, es un contrato sin identificación del proveedor. Así que en
 * modo prueba el archivo no viaja.
 *
 * LO QUE NO SE TOCA, NUNCA
 * ------------------------
 * `LICENCIAS DE TERCEROS.txt` se queda siempre. Acredita el software libre que la
 * app incluye y bajo qué licencia, y eso lo piden esas mismas licencias: sacarlo
 * sería un incumplimiento, en cualquier modo de build. No depende de los datos del
 * vendedor, así que tampoco tiene marcadores.
 *
 * POR QUÉ ACÁ Y NO EN afterSign
 * -----------------------------
 * El ciclo de vida de electron-builder (verificado en platformPackager.js) es:
 *
 *     copyFiles(extraResources)  →  emitAfterPack  →  firma  →  emitAfterSign
 *
 * O sea que en `afterPack` los archivos ya están copiados y todavía no se firmó
 * nada: lo que se borre acá simplemente no entra en el sello que arma osx-sign
 * después. En `afterSign` sería al revés y rompería la firma: el sello del .app
 * incluye el hash de todo Contents/, así que borrar un archivo después dejaría el
 * bundle inválido con "a sealed resource is missing or invalid" y Apple rechazaría
 * el envío.
 *
 * Tampoco afecta al `asarIntegrity`: se calcula ANTES de copiar los
 * extraResources, y este archivo no está adentro del asar.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** El contrato. Es el único archivo que este hook puede sacar. */
const EULA = 'LICENCIA DE USO.txt'

/**
 * Aviso de licencias de terceros. Está acá sólo para poder afirmar que sigue
 * estando: lo piden las licencias de los componentes y ningún modo de build lo
 * saca.
 */
const LICENCIAS_TERCEROS = 'LICENCIAS DE TERCEROS.txt'

/**
 * El anexo del contrato.
 *
 * Se afirma junto al contrato porque su cláusula 11.10 define qué se considera un
 * DEFECTO por comparación contra este archivo: entregar el contrato sin su anexo
 * deja esa definición apuntando a un documento que el comprador no tiene, y con
 * ella la cláusula que más protege al vendedor frente a un reclamo.
 */
const REQUISITOS = 'REQUISITOS Y FUNCIONES.txt'

const log = (msg) => console.log(`  • after-pack: ${msg}`)

/**
 * ¿Es un build `--dir`, o sea la carpeta desempaquetada sin .dmg ni instalador?
 *
 * `context.targets` son objetos Target con `.name`, y electron-builder usa el
 * nombre "dir" para ese caso (DIR_TARGET en out/core.js). Sirve para distinguir
 * `npm run build:unpacked` de un build real sin depender de variables de entorno,
 * que en npm scripts no son portables entre Windows y macOS.
 */
const soloCarpeta = (context) =>
  Array.isArray(context.targets) && context.targets.length > 0 && context.targets.every((t) => t?.name === 'dir')

export default async function afterPack(context) {
  // `getResourcesDir` es la misma función que usa electron-builder para decidir
  // dónde poner los extraResources, así que devuelve la ruta correcta en las dos
  // plataformas sin que haya que reconstruirla a mano:
  //   macOS   → <appOutDir>/<productName>.app/Contents/Resources
  //   Windows → <appOutDir>/resources
  const resources = context.packager.getResourcesDir(context.appOutDir)
  const eula = join(resources, EULA)
  const terceros = join(resources, LICENCIAS_TERCEROS)

  const requisitos = join(resources, REQUISITOS)

  const esPrueba = process.env.FLASHCARDS_EULA_INCOMPLETO === '1'

  if (esPrueba) {
    if (existsSync(eula)) {
      rmSync(eula)
      log(`build de PRUEBA: saqué "${EULA}" del paquete.`)
      log('  Este .dmg no lleva contrato de licencia y NO se puede vender.')
    } else {
      log(`build de PRUEBA: "${EULA}" no estaba en el paquete (nada que sacar).`)
    }
  } else if (soloCarpeta(context)) {
    // `--dir` no produce nada distribuible: es la carpeta desempaquetada que se usa
    // para mirar el bundle o depurar. `npm run build:unpacked` NO corre
    // `make:licenses`, así que exigirle el contrato haría fallar un comando que
    // antes andaba, por un archivo que en ese modo no le sirve a nadie.
    log(`build --dir (sin empaquetar): no exijo "${EULA}".`)
  } else {
    // Modo entrega: el contrato TIENE que estar. Si no está, algo se rompió antes
    // (no corrió `make:licenses`, o quedó un TRANSCRIPTOR_EULA_INCOMPLETO=1 dando
    // vueltas en el entorno) y el .dmg saldría sin contrato sin que nadie lo note.
    if (!existsSync(eula)) {
      throw new Error(
        `Falta "${EULA}" en ${resources}.\n` +
          'Es un build de ENTREGA y el contrato de licencia tiene que viajar adentro de la app.\n' +
          'Revisá que `npm run make:licenses` haya corrido y que FLASHCARDS_EULA_INCOMPLETO no esté en 1.'
      )
    }
    if (!existsSync(requisitos)) {
      throw new Error(
        `Falta "${REQUISITOS}" en ${resources}.\n` +
          'Es el anexo del contrato: sin él, la cláusula 11.10 define "defecto" contra un\n' +
          'documento que el comprador no recibió.\n' +
          'Revisá que `npm run make:licenses` haya corrido.'
      )
    }
    log(`build de ENTREGA: "${EULA}" y su anexo están en el paquete.`)
  }

  // Se afirma en los DOS modos. La obligación de atribuir no depende del modo, y si
  // algún día alguien toca este hook, que falle acá y no en la carpeta de un
  // comprador.
  if (!existsSync(terceros)) {
    throw new Error(
      `Falta "${LICENCIAS_TERCEROS}" en ${resources}.\n` +
        'Ese aviso acredita el software libre que la app incluye y bajo qué licencia:\n' +
        'lo piden sus licencias y no se saca en ningún modo de build.\n' +
        'Corré `npm run make:licenses`.'
    )
  }
  log(`"${LICENCIAS_TERCEROS}" está en el paquete.`)

  // Y el texto de licencia que viaja PEGADO al motor.
  //
  // La MIT de llama.cpp pide que su aviso acompañe a la copia del binario que se
  // distribuye. `fetch-llama.mjs` lo copia, pero si no puede bajarlo sólo emite un
  // warning —y un warning que nadie lee es exactamente cómo, en Convertexto,
  // whisper.cpp llegó a viajar meses sin su aviso—. Acá se afirma, y corta.
  //
  // Se busca por carpeta de plataforma en vez de por ruta fija porque el nombre
  // cambia (darwin-arm64, darwin-x64, win32-x64) y no vale la pena atarlo acá.
  for (const motor of ['llm']) {
    const raiz = join(resources, motor)
    if (!existsSync(raiz)) continue
    const plataformas = readdirSync(raiz, { withFileTypes: true }).filter((e) => e.isDirectory())
    for (const p of plataformas) {
      const licencia = join(raiz, p.name, 'LICENSE.txt')
      if (!existsSync(licencia)) {
        throw new Error(
          `Falta "LICENSE.txt" al lado del binario de ${motor} (${join(motor, p.name)}).\n` +
            'La licencia de ese componente exige que su aviso acompañe a la copia que se\n' +
            'distribuye. Sin ese archivo, entregar el .dmg es un incumplimiento.\n' +
            'Volvé a correr `npm run setup:llama -- --force` y fijate si avisó que no lo encontró.'
        )
      }
    }
    log(`${motor}: la licencia MIT viaja junto al binario.`)
  }
}
