#!/usr/bin/env node
/**
 * Escribe los materiales de regalo que van con la compra, en UTF-8 con BOM y
 * saltos de Windows, igual que el resto de los documentos del producto.
 *
 *   node scripts/write-bonus.mjs
 *
 * ---------------------------------------------------------------------------
 * Por qué son apuntes y no mazos ya armados
 * ---------------------------------------------------------------------------
 *
 * La v1 no importa ni exporta mazos: fue una decisión tomada a propósito y está
 * documentada. Regalar un archivo de mazo obligaría a que el comprador lo
 * copiara a mano dentro de la carpeta de datos, pisando su `materias.json` — o
 * sea, la primera experiencia con el producto sería una operación de archivos
 * capaz de borrarle lo que ya tenía.
 *
 * Un apunte listo para pegar resuelve el mismo problema —"lo instalé y no tengo
 * material a mano para probarlo"— sin inventar una función que no existe, y de
 * paso le enseña el flujo real: pegar, generar, revisar, guardar.
 *
 * Los cuatro son de materias básicas y están escritos en frases declarativas
 * cortas, que es lo que un modelo de 2B convierte bien en tarjetas. Un apunte
 * con prosa enredada daría tarjetas malas y el comprador creería que la app no
 * sirve, cuando el problema sería el material de ejemplo que le dimos nosotros.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, HAY_BONUS } from './lib/user-docs.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const CARPETA_BONUS = join(ROOT, 'recursos-bonus')

const BOM = String.fromCharCode(0xfeff)
const escribir = (destino, cuerpo) => writeFileSync(destino, BOM + cuerpo.replace(/\r?\n/g, '\r\n'), 'utf8')

/*
 * El número de tarjetas y el tiempo NO se estiman: salen de correr los cuatro
 * apuntes por el generador de verdad, con `node scripts/run-qa.mjs bonus`. Si
 * alguien toca el troceado o la densidad, hay que correrlo otra vez y
 * actualizarlos acá. Un instructivo que promete veinte tarjetas y entrega diez
 * hace que el comprador crea que la app le falló.
 *
 * Ese mismo arnés lee lo que quedó escrito en el apunte y falla si la app
 * entrega menos de lo prometido, así que el número no puede quedar viejo en
 * silencio.
 */

/**
 * Ajusta un párrafo a 78 columnas con dos espacios de sangría, como el resto
 * del documento. Hace falta porque el tiempo y la cantidad cambian de apunte a
 * apunte: escritos a mano, "alrededor de un minuto" y "unos cinco minutos"
 * dejan renglones de distinto largo y uno de ellos se pasa del margen.
 */
function parrafo(texto) {
  const lineas = []
  let actual = ''
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (actual === '') actual = palabra
    else if (`  ${actual} ${palabra}`.length <= 78) actual += ` ${palabra}`
    else {
      lineas.push(`  ${actual}`)
      actual = palabra
    }
  }
  if (actual !== '') lineas.push(`  ${actual}`)
  return lineas.join('\n')
}
const encabezado = ({ titulo, materia, unidad, tarjetas, tiempo }) => `===============================================================================
  ${titulo}
  Apunte de arranque para ${APP_NAME}
===============================================================================

  QUÉ HACER CON ESTO

  1. Abrí ${APP_NAME} y andá a la pestaña "Generar".
  2. Dejá elegido "Pegar texto".
  3. Copiá TODO lo que hay debajo de la línea de guiones y pegalo ahí.
  4. Creá la materia "${materia}" y la unidad "${unidad}".
     Los dos se crean desde la misma pantalla, con el botón "+ nueva".
  5. Elegí cantidad "Exhaustiva" y tocá Generar.

${parrafo(
  `Con este apunte tarda ${tiempo}. Es la opción que más cubre: en vez de sacar ` +
    'nada más que lo principal, recorre el apunte entero buscando los temas uno ' +
    'por uno, y eso lleva su tiempo. Si tu computadora es lenta puede tardar un ' +
    'poco más. Mientras tanto podés dejarla trabajando y hacer otra cosa.'
)}

${parrafo(
  `Cuando termine vas a tener alrededor de ${tarjetas} tarjetas. Revisalas, ` +
    'corregí lo que no te guste, borrá lo que sobre y guardá.'
)}

  Si alguna vez tenés apuro, elegí "Normal": tarda bastante menos, aunque saca
  bastantes menos tarjetas.

  Esto es material de ejemplo, para que tengas con qué probar la app el primer
  día sin salir a buscar nada. Después usá tus propios apuntes: la app está
  hecha para eso, y con tu material rinde mucho mejor.

-------------------------------------------------------------------------------

`

/* ═══════════════════════════════════════════════════════════════════════════
   Los cuatro apuntes
   ═══════════════════════════════════════════════════════════════════════════ */

import { APUNTES_PSICO } from './lib/apuntes-psico.mjs'

/*
 * Los cuatro apuntes viven en su propio módulo.
 *
 * Antes estaban acá adentro, como quinientas líneas de plantillas. Al
 * anicharse el producto había que cambiarlos enteros, y un archivo que es a la
 * vez contenido y programa hace que cada cambio de texto sea un cambio de
 * código. Separados, el contenido se edita sin tocar la lógica de escritura.
 */
const APUNTES = APUNTES_PSICO

/* ═══════════════════════════════════════════════════════════════════════════
   La guía
   ═══════════════════════════════════════════════════════════════════════════ */

/*
 * La guía del método y el recetario ya NO se escriben acá.
 *
 * Viven en `lib/guias-estudio.mjs` como contenido estructurado, y de ahí salen
 * en PDF (y en .txt, del mismo contenido) desde `make-pdfs.mjs`. Tenerlos en
 * dos lugares garantizaba que en el segundo cambio quedaran distintos.
 */

/*
 * Se escriben sólo si el material de regalo viaja en la entrega.
 *
 * Los cuatro apuntes que hay son los de Psicoflashy —Psicoanálisis, Desarrollo,
 * Psicopatología, Social— y Mediflashy vende Farmacología. Dejarlos escritos en
 * `recursos-bonus/` no es inocuo: `npm run drive` es un solo comando, y el día
 * que alguien encienda `HAY_BONUS` sin generar el material nuevo, esos cuatro se
 * van derecho a la carpeta del comprador. Mejor que la carpeta esté vacía y el
 * error sea imposible de no ver.
 */
if (!HAY_BONUS) {
  console.log('[bonus] HAY_BONUS está en false: no se escribe material de regalo.')
  console.log('[bonus] Los apuntes que hay en el árbol son los de Psicología y no')
  console.log('[bonus] corresponden a un producto de Farmacología. Ver user-docs.mjs.')
} else {
  for (const apunte of APUNTES) {
    const texto = encabezado(apunte) + apunte.cuerpo
    escribir(join(CARPETA_BONUS, apunte.archivo), texto)
    console.log(`[bonus] ${apunte.archivo} — ${texto.length.toLocaleString()} caracteres`)
  }
}


/*
 * Tienen que ser cuatro, porque así los cuenta la entrega (`qa/entrega.mjs`) y
 * así los nombra la carpeta que baja el comprador.
 */
if (APUNTES.length !== 4) {
  console.error(`[bonus] Hay ${APUNTES.length} apuntes y la entrega espera 4. Actualizá los dos.`)
  process.exit(1)
}

/*
 * Acá había un corte más: que los `tarjetas` de los cuatro sumaran 80, "porque
 * la landing promete 80". No era cierto. Lo que la landing promete son las 82
 * tarjetas YA CARGADAS dentro de la app —los mazos de regalo de
 * `mazosDeRegalo.ts`, que verifica `qa/siembra.ts` contra el HTML de la
 * página—, y eso no tiene nada que ver con cuántas rinde cada apunte de
 * arranque al generarlo.
 *
 * Un corte que compara dos cosas distintas no protege nada y obliga a mentir
 * en los números para que cierre la suma. El que sí protege está en
 * `qa/bonus.ts`: genera con los cuatro apuntes y falla si la app entrega menos
 * de lo que el instructivo promete.
 */
const totalTarjetas = APUNTES.reduce((n, a) => n + a.tarjetas, 0)

if (HAY_BONUS) console.log(`[bonus] ${APUNTES.length} apuntes (~${totalTarjetas} tarjetas) en recursos-bonus/`)
