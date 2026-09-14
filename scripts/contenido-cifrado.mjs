#!/usr/bin/env node
/**
 * Lo que se vende, encriptado, para poder compilar en un repositorio PÚBLICO.
 *
 *   node scripts/contenido-cifrado.mjs cifrar      # en la máquina de desarrollo
 *   node scripts/contenido-cifrado.mjs descifrar   # en el runner, antes de compilar
 *   node scripts/contenido-cifrado.mjs sellar <archivo-o-carpeta> <salida.mfenc>
 *   node scripts/contenido-cifrado.mjs abrir <entrada.mfenc> <carpeta-destino>
 *   node scripts/contenido-cifrado.mjs verificar  # ¿el cifrado está al día con el original?
 *
 * ---------------------------------------------------------------------------
 * Por qué existe
 * ---------------------------------------------------------------------------
 *
 * El build de Mac corre en GitHub Actions, y sólo los repositorios públicos tienen
 * minutos de macOS sin límite. Pero en un repo público queda a la vista todo lo que
 * se sube, y el código de Mediflashy lleva EL PRODUCTO: el mazo de tarjetas y el
 * contenido del bonus. Y peor: en un repo público cualquier usuario de GitHub puede
 * bajar los artefactos de una corrida, o sea el .dmg terminado, con todo adentro.
 *
 * Así que dos cosas viajan encriptadas:
 *
 *  · CONTENIDO_PROTEGIDO (el mazo y el bonus): en el repo sólo está la versión
 *    `.mfenc` de cada uno, dentro de `contenido-cifrado/`. El original está en el
 *    .gitignore. El workflow lo descifra antes de compilar.
 *  · Los ARTEFACTOS (los .dmg y la carpeta de entrega): el workflow los sella antes
 *    de subirlos, y se abren acá con la misma clave.
 *
 * La clave NO está en el repo: vive en `C:\Users\herre\Desktop\firma-apple\
 * mediflashy-contenido.key` y en el secret MEDIFLASHY_CONTENIDO_KEY. Un fork no
 * recibe los secrets, así que no puede descifrar nada.
 *
 * AES-256-GCM: además de ocultar, detecta cualquier alteración. Un archivo tocado o
 * una clave equivocada no descifra "algo raro": falla.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CARPETA_CIFRADA = join(ROOT, 'contenido-cifrado')
const CLAVE_LOCAL = 'C:/Users/herre/Desktop/firma-apple/mediflashy-contenido.key'
const MARCA = Buffer.from('MFENC1')

/** Lo que se vende. Si se agrega un archivo con contenido pago, va acá Y en el .gitignore. */
export const CONTENIDO_PROTEGIDO = ['src/main/services/mazosDeRegalo.ts', 'scripts/lib/mapa-grupos.mjs']

function clave() {
  const texto = process.env.MEDIFLASHY_CONTENIDO_KEY ?? (existsSync(CLAVE_LOCAL) ? readFileSync(CLAVE_LOCAL, 'utf8') : '')
  const k = Buffer.from(texto.trim(), 'base64')
  if (k.length !== 32) {
    throw new Error(
      'No hay clave de contenido válida. En el runner es el secret MEDIFLASHY_CONTENIDO_KEY; ' +
        `en la máquina de desarrollo, el archivo ${CLAVE_LOCAL}.`
    )
  }
  return k
}

export function cifrar(buffer, k = clave()) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', k, iv)
  const cuerpo = Buffer.concat([c.update(buffer), c.final()])
  return Buffer.concat([MARCA, iv, c.getAuthTag(), cuerpo])
}

export function descifrar(buffer, k = clave()) {
  if (buffer.length < MARCA.length + 28 || !buffer.subarray(0, MARCA.length).equals(MARCA)) {
    throw new Error('No es un archivo cifrado por este script.')
  }
  const iv = buffer.subarray(MARCA.length, MARCA.length + 12)
  const tag = buffer.subarray(MARCA.length + 12, MARCA.length + 28)
  const d = createDecipheriv('aes-256-gcm', k, iv)
  d.setAuthTag(tag)
  try {
    return Buffer.concat([d.update(buffer.subarray(MARCA.length + 28)), d.final()])
  } catch {
    throw new Error('No se pudo descifrar: la clave no es la correcta o el archivo fue alterado.')
  }
}

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16)

function cmdCifrar() {
  const k = clave()
  mkdirSync(CARPETA_CIFRADA, { recursive: true })
  for (const rel of CONTENIDO_PROTEGIDO) {
    const origen = join(ROOT, rel)
    if (!existsSync(origen)) throw new Error(`No existe ${rel}: no hay nada que cifrar.`)
    const plano = readFileSync(origen)
    const destino = join(CARPETA_CIFRADA, `${rel.replaceAll('/', '__')}.mfenc`)
    // Si el cifrado vigente ya corresponde a este original, no se reescribe: cada
    // cifrado tiene un IV nuevo y ensuciaría el historial con un cambio que no es.
    if (existsSync(destino)) {
      try {
        if (descifrar(readFileSync(destino), k).equals(plano)) {
          console.log(`= ${rel} (sin cambios)`)
          continue
        }
      } catch {
        /* se reescribe */
      }
    }
    writeFileSync(destino, cifrar(plano, k))
    console.log(`✓ ${rel} → contenido-cifrado/${basename(destino)} (${plano.length} bytes, sha ${sha(plano)})`)
  }
}

function cmdDescifrar() {
  const k = clave()
  for (const rel of CONTENIDO_PROTEGIDO) {
    const origen = join(CARPETA_CIFRADA, `${rel.replaceAll('/', '__')}.mfenc`)
    if (!existsSync(origen)) throw new Error(`Falta contenido-cifrado/${basename(origen)}.`)
    const plano = descifrar(readFileSync(origen), k)
    mkdirSync(dirname(join(ROOT, rel)), { recursive: true })
    writeFileSync(join(ROOT, rel), plano)
    console.log(`✓ ${rel} (${plano.length} bytes, sha ${sha(plano)})`)
  }
}

/**
 * ¿Los .mfenc corresponden a los originales de hoy?
 *
 * El build de Mac compila con lo que está CIFRADO en el repo, no con el original.
 * Si alguien corrige una tarjeta y no vuelve a cifrar, Windows sale con la tarjeta
 * nueva y Mac con la vieja, sin que nada lo avise. Por eso `build:win` corre esto
 * primero y corta. Sin la clave en la máquina, no se puede verificar y también corta.
 */
function cmdVerificar() {
  const k = clave()
  const viejos = []
  for (const rel of CONTENIDO_PROTEGIDO) {
    const cifrado = join(CARPETA_CIFRADA, `${rel.replaceAll('/', '__')}.mfenc`)
    const original = join(ROOT, rel)
    if (!existsSync(original)) continue
    if (!existsSync(cifrado) || !descifrar(readFileSync(cifrado), k).equals(readFileSync(original))) viejos.push(rel)
  }
  if (viejos.length > 0) {
    throw new Error(`El cifrado está desactualizado para: ${viejos.join(', ')}. Corré "npm run contenido:cifrar".`)
  }
  console.log('✓ el contenido cifrado está al día con los originales')
}

/*
 * Empaqueta con tar (está en macOS, Linux y Windows 10+) y cifra el paquete.
 *
 * El tar va por la entrada y la salida estándar, con `cwd`, y NUNCA recibe una
 * ruta: el tar de GNU que trae Git para Windows toma "C:/…" como un servidor
 * remoto ("Cannot connect to C: resolve failed").
 */
const MAX_TAR = 4 * 1024 * 1024 * 1024

function cmdSellar(entrada, salida) {
  if (!entrada || !salida) throw new Error('Uso: sellar <archivo-o-carpeta> <salida.mfenc>')
  const abs = resolve(entrada)
  if (!existsSync(abs)) throw new Error(`No existe ${entrada}.`)
  const r = spawnSync('tar', ['-cf', '-', basename(abs)], { cwd: dirname(abs), maxBuffer: MAX_TAR })
  if (r.status !== 0) throw new Error(`tar falló: ${String(r.stderr ?? '').trim()}`)
  writeFileSync(salida, cifrar(r.stdout))
  console.log(`✓ ${entrada} → ${salida} (${(statSync(salida).size / 1048576).toFixed(1)} MB, cifrado)`)
}

function cmdAbrir(entrada, destino) {
  if (!entrada || !destino) throw new Error('Uso: abrir <entrada.mfenc> <carpeta-destino>')
  const plano = descifrar(readFileSync(entrada))
  mkdirSync(destino, { recursive: true })
  const r = spawnSync('tar', ['-xf', '-'], { cwd: destino, input: plano, maxBuffer: MAX_TAR })
  if (r.status !== 0) throw new Error(`tar falló al extraer: ${String(r.stderr ?? '').trim()}`)
  console.log(`✓ ${entrada} → ${destino}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2)
  try {
    if (cmd === 'cifrar') cmdCifrar()
    else if (cmd === 'descifrar') cmdDescifrar()
    else if (cmd === 'sellar') cmdSellar(a, b)
    else if (cmd === 'abrir') cmdAbrir(a, b)
    else if (cmd === 'verificar') cmdVerificar()
    else throw new Error('Comandos: cifrar | descifrar | verificar | sellar <entrada> <salida> | abrir <entrada> <destino>')
  } catch (e) {
    console.error(`✗ ${e.message}`)
    process.exit(1)
  }
}
