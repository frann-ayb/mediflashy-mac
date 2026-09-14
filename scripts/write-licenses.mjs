#!/usr/bin/env node
/**
 * Escribe los TRES documentos de la cadena legal que viajan con el producto:
 *
 *   LICENCIAS DE TERCEROS.txt   qué software libre incluye y bajo qué licencia
 *   LICENCIA DE USO.txt         el contrato con el comprador
 *   REQUISITOS Y FUNCIONES.txt  el anexo del contrato: qué hace y qué no hace
 *
 * Los deja en tres lugares: la raíz del proyecto (para mirarlos), `resources/`
 * (de ahí los toma `extraResources` y viajan ADENTRO del paquete instalado) y
 * `release/` si existe, al lado de los instaladores.
 *
 * Ninguno de los tres es opcional. El primero lo piden las licencias de los
 * componentes. El segundo es lo que hace que la venta tenga condiciones escritas.
 * Y el tercero va con ellos porque su cláusula 11.10 define qué se considera un
 * DEFECTO por comparación contra el anexo: si el contrato viaja adentro del
 * paquete y su anexo no, esa definición apunta a un documento que el comprador no
 * tiene, y la cláusula se vuelve inaplicable.
 *
 *   npm run make:licenses
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLicencias } from './lib/licencias.mjs'
import { EULA_FILE, LICENSES_FILE, REQUISITOS_FILE, buildEula, buildRequisitos, datosFaltantes, hasPlaceholders } from './lib/user-docs.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RESOURCES = join(ROOT, 'resources')
const RELEASE = join(ROOT, 'release')

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = pkg.version

/** BOM y CRLF para que el Bloc de notas de Windows no destroce los acentos. */
const BOM = String.fromCharCode(0xfeff)
const asText = (body) => BOM + body.replace(/\r?\n/g, '\r\n')

const destinos = [ROOT, RESOURCES, ...(existsSync(RELEASE) ? [RELEASE] : [])]
for (const dir of destinos) mkdirSync(dir, { recursive: true })

/**
 * Este árbol produce las DOS plataformas, pero los documentos que van adentro del
 * paquete se generan por separado en cada build (`build:win` y `build:mac` los
 * regeneran), así que acá se declara la plataforma que se está compilando.
 *
 * NO es decorativo: la cláusula 11.9 del contrato —la que prueba que el Producto
 * no fue alterado— se apoya en la firma de Apple, que sólo existe en la versión de
 * Mac. La de Windows se distribuye sin certificado (decisión de presupuesto). Sin
 * esta distinción, el contrato de Windows le prometería al comprador una firma que
 * su copia no tiene, justo en la cláusula que sostiene la defensa frente a un
 * reclamo tardío.
 */
const PLATAFORMA = process.platform === 'darwin' ? { hasWindows: false, hasMac: true } : { hasWindows: true, hasMac: false }

/* ----------------------------- aviso de terceros ---------------------------- */

const { texto: licenciasBody, faltantes: paquetesFaltantes, llama } = buildLicencias({
  productName: pkg.productName,
  version
})
const licencias = asText(licenciasBody)
for (const dir of destinos) writeFileSync(join(dir, LICENSES_FILE), licencias, 'utf8')
console.log(`[licencias] escrito ${LICENSES_FILE} (${destinos.length} ubicaciones).`)

/* -------------------------------- el contrato ------------------------------- */

/*
 * El EULA usa acá los nombres SIN numerar, que son los que el comprador ve dentro
 * de la carpeta de instalación. En la carpeta de Drive van numerados, y de eso se
 * ocupa make-drive-folder.mjs.
 *
 * LOS TRES NOMBRES, no dos. `buildEula` fusiona lo que reciba contra los nombres
 * numerados de Drive, así que omitir `requisitos` no lo deja vacío: lo deja
 * diciendo "7. Requisitos y funciones.txt" en las cláusulas 11.10 y 11.11.a, o sea
 * mandando al comprador a un archivo que en su carpeta de instalación no existe
 * con ese nombre. Y son justo las dos cláusulas de las que cuelga la definición de
 * defecto. En Convertexto este mismo lugar salió mal una vez, con `undefined`.
 */
const eulaBody = buildEula({
  version,
  names: { licenses: LICENSES_FILE, eula: EULA_FILE, requisitos: REQUISITOS_FILE },
  ...PLATAFORMA
})
const eula = asText(eulaBody)
for (const dir of destinos) writeFileSync(join(dir, EULA_FILE), eula, 'utf8')
console.log(`[licencias] escrito ${EULA_FILE} (${destinos.length} ubicaciones).`)

/* ------------------------------ anexo del contrato -------------------------- */

// Los mismos nombres sin numerar que el contrato: este anexo lo cita, y una copia
// que manda a "6. Licencia de uso.txt" desde adentro de la carpeta de instalación
// apunta a un archivo que ahí no existe.
const requisitos = asText(
  buildRequisitos({ version, names: { help: 'INSTRUCCIONES DE INSTALACIÓN.txt', eula: EULA_FILE }, ...PLATAFORMA })
)
for (const dir of destinos) writeFileSync(join(dir, REQUISITOS_FILE), requisitos, 'utf8')
console.log(`[licencias] escrito ${REQUISITOS_FILE} (${destinos.length} ubicaciones).`)

/* --------------------------------- controles -------------------------------- */

/*
 * De acá para abajo todo CORTA el build, y es deliberado.
 *
 * Antes, en Convertexto, esto era un `console.warn` que no cortaba, y por eso los
 * compradores de Windows vinieron recibiendo un contrato con los datos del vendedor
 * SIN COMPLETAR: "[NOMBRE O RAZÓN SOCIAL DEL LICENCIANTE]", "[CUIT O DNI]". Un
 * aviso que nadie lee no protege nada.
 */

const sinDatos = datosFaltantes()
if (sinDatos.length || hasPlaceholders(eulaBody)) {
  console.error('')
  console.error('[licencias] ###########################################################')
  console.error(`[licencias] #  ${EULA_FILE} TIENE DATOS DEL VENDEDOR SIN COMPLETAR`)
  console.error('[licencias] ###########################################################')
  console.error('')
  for (const f of sinDatos) console.error(`[licencias]    falta LICENCIANTE.${f}`)
  for (const m of [...new Set(eula.match(/\[[^\]]+\]/g) ?? [])]) console.error(`[licencias]    ${m}`)
  console.error('')
  console.error('[licencias] Completá LICENCIANTE en scripts/lib/user-docs.mjs.')
  console.error('')
  process.exit(1)
}

if (paquetesFaltantes.length > 0) {
  console.error(`[licencias] No se encontraron en node_modules: ${paquetesFaltantes.join(', ')}.`)
  console.error('[licencias] Corré `npm install` y volvé a generar.')
  process.exit(1)
}

if (!llama) {
  console.error('[licencias] Falta el VERSION.txt del motor, así que el aviso no puede declarar')
  console.error('[licencias] la versión de llama.cpp ni dónde está su código fuente, que es')
  console.error('[licencias] justo lo que su licencia MIT pide reproducir.')
  console.error('[licencias] Corré `npm run setup:llama` y volvé a generar.')
  process.exit(1)
}

/*
 * Segunda red: valores de JavaScript que se colaron al texto.
 *
 * `hasPlaceholders()` busca [CORCHETES EN MAYÚSCULAS] y no ve un `undefined`
 * interpolado, que es otra forma de quedarse sin un dato. Pasó de verdad en
 * Convertexto: `names.requisitos` salía `undefined` y el contrato que se vendía
 * decía que el anexo se llamaba "undefined", justo en las dos cláusulas de las que
 * cuelga la definición de defecto.
 */
const basura = /\b(undefined|null|NaN)\b|\[object Object\]/
for (const [nombre, texto] of [
  [LICENSES_FILE, licencias],
  [EULA_FILE, eula],
  [REQUISITOS_FILE, requisitos]
]) {
  const malas = texto.split('\n').filter((l) => basura.test(l))
  if (malas.length === 0) continue
  console.error('')
  console.error(`[licencias] ${nombre} TIENE VALORES DE JAVASCRIPT EN EL TEXTO:`)
  for (const l of malas.slice(0, 10)) console.error(`[licencias]    ${l.trim()}`)
  console.error('')
  process.exit(1)
}

console.log('[licencias] Los tres documentos están completos y sin marcadores.')
