/**
 * El aviso de licencias de terceros.
 *
 * ---------------------------------------------------------------------------
 * Por qué no es opcional
 * ---------------------------------------------------------------------------
 *
 * Todo lo que viaja adentro del instalador tiene una licencia que pide, como
 * mínimo, que se reproduzca su texto y se reconozca la autoría. Vender la app sin
 * este archivo es incumplir esas licencias, y no es un tecnicismo: Apache 2.0 —la
 * licencia del modelo Qwen3.5, que es el corazón de la función principal— lo pide
 * explícitamente.
 *
 * ---------------------------------------------------------------------------
 * En qué se diferencia del de Convertexto
 * ---------------------------------------------------------------------------
 *
 * Aquél gira alrededor de FFmpeg, que va bajo LGPL y obliga a bastante más: un
 * aviso prominente, el derecho del usuario a REEMPLAZAR la librería por su propia
 * versión, y explicarle cómo hacerlo. Mediflashy no lleva FFmpeg ni whisper, así
 * que esa obligación desaparece y el aviso es mucho más simple: todo lo que se
 * distribuye acá es MIT, Apache 2.0, BSD o ISC, que sólo piden atribución.
 *
 * ---------------------------------------------------------------------------
 * Por qué se leen los datos en vez de escribirlos a mano
 * ---------------------------------------------------------------------------
 *
 * Las versiones y las licencias salen de `node_modules` y de los `VERSION.txt` que
 * dejan los scripts de setup. Un aviso escrito a mano se desactualiza en la primera
 * actualización de dependencias y nadie se entera, porque nadie lo relee. Leyéndolo
 * del árbol real, el aviso que se distribuye describe lo que efectivamente se
 * distribuye.
 *
 * Vive en `lib/` y no adentro de `write-licenses.mjs` porque lo usan DOS
 * generadores: ése, que lo deja junto al build y adentro del paquete, y
 * `make-drive-folder.mjs`, que lo pone en la carpeta que baja el comprador. Con la
 * lógica duplicada, los dos avisos podrían decir cosas distintas del mismo
 * producto.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RESOURCES = join(ROOT, 'resources')

const linea = (n = 74) => '-'.repeat(n)

/**
 * Las librerías que viajan adentro del paquete.
 *
 * Se listan sólo las de EJECUCIÓN. Las de desarrollo (TypeScript, Vite,
 * electron-builder) no se distribuyen, así que no corresponde declararlas: hacerlo
 * sería inflar el aviso con cosas que el comprador no recibe.
 */
const EMPAQUETADAS = [
  { nombre: 'electron', que: 'el entorno de escritorio (incluye Chromium y Node.js)' },
  { nombre: 'react', que: 'la interfaz' },
  { nombre: 'react-dom', que: 'la interfaz' },
  { nombre: 'lucide-react', que: 'los íconos' },
  { nombre: 'tailwindcss', que: 'los estilos' },
  { nombre: 'ts-fsrs', que: 'el algoritmo de repaso espaciado (FSRS)' },
  { nombre: 'mammoth', que: 'la lectura de archivos de Word' },
  { nombre: 'pdfjs-dist', que: 'la lectura de archivos PDF' },
  { nombre: 'fflate', que: 'la lectura de archivos de PowerPoint' }
]

export function datosDePaquete(nombre) {
  const p = join(ROOT, 'node_modules', nombre, 'package.json')
  if (!existsSync(p)) return null
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    return {
      version: j.version ?? '?',
      licencia: typeof j.license === 'string' ? j.license : '?',
      url: (typeof j.repository === 'string' ? j.repository : (j.repository?.url ?? j.homepage ?? ''))
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
    }
  } catch {
    return null
  }
}

/**
 * Lee el VERSION.txt que dejó `fetch-llama.mjs` junto al binario.
 *
 * Se busca en todas las carpetas de plataforma porque el aviso tiene que salir
 * igual aunque se genere en una máquina que sólo preparó una de las dos.
 */
export function datosDeLlama() {
  const base = join(RESOURCES, 'llm')
  if (!existsSync(base)) return null
  const carpetas = readdirSync(base)
  for (const carpeta of carpetas) {
    const f = join(base, carpeta, 'VERSION.txt')
    if (!existsSync(f)) continue
    try {
      const texto = readFileSync(f, 'utf8')
      const build = /llama\.cpp\s+(\S+)/.exec(texto)?.[1]
      const fuente = /Código fuente:\s*(\S+)/.exec(texto)?.[1]
      if (build) return { build, fuente: fuente ?? 'https://github.com/ggml-org/llama.cpp', carpetas }
    } catch {
      /* se prueba la siguiente */
    }
  }
  return null
}

/**
 * Arma el texto del aviso.
 *
 * @returns {{ texto: string, faltantes: string[], llama: object|null }}
 *   `faltantes` son los paquetes que no se encontraron en node_modules; quien
 *   llama decide si eso corta o no. Devolverlo en vez de imprimirlo es lo que
 *   permite que los dos generadores reaccionen distinto.
 */
export function buildLicencias({ productName, version }) {
  const partes = []
  const p = (...ls) => partes.push(...ls)

  const llama = datosDeLlama()

  p(
    `${productName} ${version} — AVISO DE LICENCIAS DE TERCEROS`,
    linea(),
    '',
    `${productName} incluye y distribuye los componentes que se listan abajo.`,
    'Cada uno pertenece a sus autores y se usa bajo su propia licencia.',
    '',
    'Todo funciona en tu computadora: ninguno de estos componentes envía tus',
    'apuntes, tus tarjetas ni tu progreso de estudio a ningún servidor.',
    ''
  )

  /* ------------------------------- el motor ------------------------------- */

  p(linea(), '1. MOTOR DE GENERACIÓN — llama.cpp', linea(), '')

  if (llama) {
    p(
      `  Versión:        ${llama.build}`,
      '  Licencia:       MIT',
      `  Código fuente:  ${llama.fuente}`,
      '  Texto completo: resources/llm/<plataforma>/LICENSE.txt, junto al binario',
      `  Arquitecturas:  ${llama.carpetas.join(', ')}`,
      ''
    )
  } else {
    p(
      '  ATENCIÓN: no se encontró resources/llm/*/VERSION.txt.',
      '  Corré `npm run setup:llama` antes de generar este aviso; sin esos datos',
      '  el archivo no describe lo que realmente se distribuye.',
      ''
    )
  }

  p(
    '  Es el programa que lee tus apuntes y arma las tarjetas. Corre como un',
    '  proceso aparte dentro de tu computadora, escuchando sólo en 127.0.0.1.',
    ''
  )

  /* -------------------------------- el modelo ------------------------------- */

  p(
    linea(),
    '2. MODELO DE LENGUAJE — Qwen3.5 (2B y 4B), cuantizado a GGUF',
    linea(),
    '',
    '  Autor:          Alibaba Cloud / equipo Qwen',
    '  Licencia:       Apache License 2.0',
    '  Código y pesos: https://huggingface.co/Qwen',
    '  Cuantización:   unsloth (https://huggingface.co/unsloth)',
    '',
    '  EL MODELO NO VIAJA ADENTRO DEL INSTALADOR. Se descarga la primera vez que',
    '  generás tarjetas, directamente desde Hugging Face, y queda guardado en tu',
    '  computadora. A partir de ahí la app funciona sin internet.',
    '',
    '  La Apache 2.0 permite usarlo y redistribuirlo, incluso comercialmente, con',
    '  la condición de reconocer la autoría y conservar el aviso de licencia. Eso',
    '  es lo que hace este archivo.',
    '',
    '  Texto completo de la Apache 2.0: https://www.apache.org/licenses/LICENSE-2.0',
    ''
  )

  /* ------------------------------ las librerías ----------------------------- */

  p(linea(), '3. LIBRERÍAS INCLUIDAS', linea(), '')

  const faltantes = []
  for (const { nombre, que } of EMPAQUETADAS) {
    const d = datosDePaquete(nombre)
    if (!d) {
      faltantes.push(nombre)
      continue
    }
    p(`  ${nombre} ${d.version}`, `    ${que}`, `    Licencia: ${d.licencia}${d.url ? ` · ${d.url}` : ''}`, '')
  }

  p(
    '  Electron incluye Chromium y Node.js, que a su vez incluyen componentes de',
    '  terceros con sus propias licencias (BSD, MIT y otras). El detalle completo',
    '  está disponible desde la app, en el menú de Chromium: chrome://credits',
    ''
  )

  /* --------------------------------- cierre --------------------------------- */

  p(
    linea(),
    '4. CÓMO PEDIR EL CÓDIGO FUENTE',
    linea(),
    '',
    '  El código fuente de cada componente está en el enlace que figura al lado.',
    '  Todos son proyectos públicos y se pueden descargar sin costo.',
    '',
    '  Si tenés una duda sobre este aviso, escribinos y te la respondemos.',
    '',
    linea(),
    `Generado automáticamente a partir del árbol de dependencias real de ${productName} ${version}.`,
    ''
  )

  return { texto: partes.join('\n'), faltantes, llama }
}
