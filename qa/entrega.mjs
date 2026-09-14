#!/usr/bin/env node
/**
 * La prueba del comprador: ¿la carpeta de entregables alcanza, sola?
 *
 * Todos los demás arneses corren DENTRO del proyecto: con node_modules, con el
 * Electron de desarrollo, con la carpeta `out/` compilada al lado. Nada de eso lo
 * tiene quien compra. Éste prueba lo único que él va a tener: el archivo que baja
 * de Drive, en una carpeta cualquiera de su computadora.
 *
 * Qué se verifica:
 *
 *  1. Que la carpeta de entregables esté completa, con sus textos y su instalador.
 *  2. Que el PORTABLE arranque copiado a otra carpeta, con el entorno limpio: sin
 *     Node en el PATH, sin ninguna variable ELECTRON_*, sin NODE_*. Es la
 *     situación real de una computadora que nunca vio este proyecto.
 *  3. Que la interfaz responda de verdad —no sólo que el proceso levante— y que
 *     pueda crear y guardar una tarjeta en el disco.
 *  4. Que sus datos queden AL LADO DEL EXE, que es la promesa del formato portable.
 *
 *   npm run qa:entrega
 */
import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, HAY_BONUS, HAY_MAPA_GRUPOS } from '../scripts/lib/user-docs.mjs'
import { armarMazos, nombreDeArchivo } from '../scripts/armar-mazo.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENTREGA = join(ROOT, `${APP_NAME} - Entregables`)

/**
 * Cuántas unidades siembra la app en el primer arranque.
 *
 * Se lee de `src/shared/types.ts` con una expresión regular porque este arnés es
 * .mjs y la constante vive en TypeScript. Feo, pero el número escrito a mano ya
 * se quedó viejo una vez: decía 71 cuando el mazo pasó a traer 48 unidades, y un
 * arnés que compara contra un número inventado no verifica la siembra, la
 * inventa también.
 */
function unidadesDeRegalo() {
  const ts = readFileSync(join(ROOT, 'src', 'shared', 'types.ts'), 'utf8')
  const m = ts.match(/export const UNIDADES_DE_REGALO = (\d+)/)
  if (!m) throw new Error('src/shared/types.ts no declara UNIDADES_DE_REGALO')
  return Number(m[1])
}

const UNIDADES_DE_REGALO = unidadesDeRegalo()
const PORT = 9458

let ws
let seq = 0
const pendientes = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fallas = 0
let pruebas = 0

function ok(condicion, que, detalle = '') {
  pruebas++
  if (condicion) console.log(`  ✓ ${que}`)
  else {
    fallas++
    console.error(`  ✗ ${que}${detalle ? ` — ${detalle}` : ''}`)
  }
}

const seccion = (t) => console.log(`\n${t}`)

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const id = ++seq
    pendientes.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluar(expresion) {
  const r = await send('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description ?? 'error' }
  return r.result?.value
}

const clic = (texto) =>
  evaluar(`(() => {
    const el = [...document.querySelectorAll('button')].find(x => (x.textContent ?? '').includes(${JSON.stringify(texto)}))
    if (!el) return false
    el.click(); return true
  })()`)

const escribir = (ariaLabel, texto) =>
  evaluar(`(() => {
    const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(ariaLabel)}) + ']')
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(texto)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)

const enter = (ariaLabel) =>
  evaluar(`document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(ariaLabel)}) + ']')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)

const texto = () => evaluar('document.body.innerText')

/**
 * Cierra cualquier instancia que haya quedado colgada de una corrida anterior.
 *
 * Es por plataforma porque el arnés también corre en la Mac, donde `taskkill` no
 * existe: sin esto, el primer intento de correr QA allá muere con "command not
 * found" en un lugar que no tiene nada que ver con lo que se está probando.
 */
/**
 * Mata cualquier instancia colgada antes de arrancar.
 *
 * Se matan los TRES nombres, y no sólo el propio. Mediflashy salió de Psicoflashy y
 * Psicoflashy de Flashcards, y
 * una carpeta de entregables a medio migrar puede tener el .exe viejo adentro: si el
 * arnés lo levanta y ese proceso queda vivo, se queda con el puerto de depuración y
 * TODAS las corridas siguientes se conectan a él en vez de a la app que se quería
 * probar. Pasó de verdad: durante media hora el arnés estuvo informando sobre los
 * mazos de Anatomía y Derecho de la otra app, mientras la que se estaba probando
 * andaba perfecto.
 *
 * Es la peor clase de falla de una prueba: no dice "no pude", dice "está mal" sobre
 * algo que no es lo que mirabas.
 */
function matarSobrantes() {
  const nombres = [APP_NAME, 'Psicoflashy', 'Flashcards']
  for (const n of nombres) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/im', `${n}.exe`, '/f', '/t'], { stdio: 'ignore' })
    else spawnSync('pkill', ['-f', n], { stdio: 'ignore' })
  }
}

/**
 * Un entorno como el de una computadora que nunca vio este proyecto.
 *
 * Se saca Node del PATH y se borran TODAS las variables NODE_* y ELECTRON_*. Las
 * segundas no son paranoia: en esta misma máquina `ELECTRON_RUN_AS_NODE` está
 * seteada, y con ella el .exe arranca como Node pelado, `electron.app` viene
 * `undefined` y la app muere antes de abrir la ventana. Un comprador no la tiene;
 * si el arnés la heredara, estaría probando algo que no es lo que él va a vivir.
 */
function entornoLimpio(carpetaDelExe) {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    const K = k.toUpperCase()
    if (K.startsWith('ELECTRON_') || K.startsWith('NODE_') || K === 'NPM_CONFIG_PREFIX') continue
    env[k] = v
  }
  const sistema = [
    join(process.env.SystemRoot ?? 'C:\\Windows', 'system32'),
    process.env.SystemRoot ?? 'C:\\Windows',
    join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'Wbem')
  ]
  env.PATH = sistema.join(';')
  env.Path = env.PATH
  // El portable define esto solo al autoextraerse. Se declara igual para que el
  // arnés sepa dónde mirar y para no depender de adivinar la carpeta temporal.
  env.PORTABLE_EXECUTABLE_DIR = carpetaDelExe
  return env
}

async function main() {
  /* ------------------------- 1. la carpeta de entrega ------------------------ */

  seccion('La carpeta de entregables')

  ok(existsSync(ENTREGA), `existe "${APP_NAME} - Entregables"`, ENTREGA)
  if (!existsSync(ENTREGA)) process.exit(1)

  const carpetas = readdirSync(ENTREGA)
  ok(carpetas.includes('Versión Windows'), 'con la carpeta de Windows')
  ok(carpetas.includes('Versión MacOs'), 'y la de Mac')

  const win = join(ENTREGA, 'Versión Windows')
  const archivosWin = readdirSync(win)

  /*
   * Las dos guías van en PDF y los tres documentos legales en .txt.
   *
   * La distinción no es estética: la licencia de uso, el anexo de requisitos y
   * el aviso de licencias de terceros son contractuales —la cláusula 11 define
   * los defectos comparándolos contra el anexo— y su formato quedó acordado en
   * .txt plano. Si alguna vez alguien "moderniza" esos tres a PDF, esta lista
   * lo va a frenar acá y no del lado del comprador.
   */
  const DOCS = [
    '1. LEEME PRIMERO.pdf',
    '4. Ayuda y solución de problemas.pdf',
    '5. Licencias de los componentes.txt',
    '6. Licencia de uso.txt',
    '7. Requisitos y funciones.txt',
    /*
     * Las dos guías de estudio, que ahora viajan sueltas y no adentro del
     * material de regalo. Se exigen acá porque el PDF "LEEME PRIMERO" las
     * describe una por una: si no están, ese documento manda al comprador a
     * buscar dos archivos que no existen.
     */
    '8. Cómo estudiar con repaso espaciado.pdf',
    '9. Recetario de instrucciones.pdf',
    // El único bonus real de la landing. Si algún día se apaga (HAY_MAPA_GRUPOS
    // en false), este chequeo se apaga con él en vez de quedar en rojo.
    ...(HAY_MAPA_GRUPOS ? ['10. El mapa de los grupos.pdf'] : [])
  ]
  for (const d of DOCS) ok(archivosWin.includes(d), `Windows trae "${d}"`)

  const portableName = archivosWin.find((f) => f.includes('Portable') && f.endsWith('.exe'))
  const instaladorName = archivosWin.find((f) => f.includes('Instalador') && f.endsWith('.exe'))
  ok(Boolean(instaladorName), 'y el instalador')
  ok(Boolean(portableName), 'y el portable')

  // Ningún .txt vacío: un documento legal de 0 bytes pasa cualquier `existsSync`.
  const vacios = archivosWin.filter((f) => f.endsWith('.txt') && statSync(join(win, f)).size < 500)
  ok(vacios.length === 0, 'ningún texto salió vacío o truncado', vacios.join(', '))

  /*
   * Y ningún PDF en blanco.
   *
   * `printToPDF` no tira error cuando la página no cargó: devuelve un PDF válido
   * con una hoja vacía, de unos pocos kilobytes. Sin este corte, la entrega se
   * armaría con dos manuales en blanco y el error se vería recién del lado del
   * comprador. El mismo control está en `make-pdfs.mjs`, del otro lado.
   */
  const pdfsVacios = archivosWin.filter((f) => f.endsWith('.pdf') && statSync(join(win, f)).size < 12 * 1024)
  ok(pdfsVacios.length === 0, 'ningún PDF salió en blanco', pdfsVacios.join(', '))

  /*
   * El material de regalo: se exige si viaja, y se PROHÍBE si no.
   *
   * Las dos mitades importan. Si `HAY_BONUS`, la landing lo promete con nombre y
   * número y un comprador que no lo encuentra pagó por algo que no recibió.
   *
   * Si NO hay bonus, lo que hay que impedir es lo contrario: que sobreviva la
   * carpeta de Psicoflashy —los apuntes de Freud, los simulacros de las catorce
   * materias de Psicología— adentro de una entrega de Farmacología. Ese es el
   * modo de falla real de esta migración: nadie la agrega a propósito, queda de
   * una corrida anterior. `make-drive-folder.mjs` ya no la lista como esperada y
   * por eso `sincronizar` la borra, pero el que arma la entrega puede haberla
   * copiado a mano, y entonces el comprador de Farmacología abre un bonus sobre
   * psicoanálisis y concluye —con razón— que le vendieron otra cosa.
   */
  const BONUS = '8. Apuntes de regalo y guía de estudio'
  const carpetasEntregadas = [
    ['Windows', win],
    ['Mac', join(ENTREGA, 'Versión MacOs')]
  ]

  if (!HAY_BONUS) {
    for (const [etiqueta, carpeta] of carpetasEntregadas) {
      ok(
        !existsSync(join(carpeta, BONUS)),
        `${etiqueta}: no viaja material de regalo de otro producto`,
        'quedó la carpeta de bonus de Psicoflashy adentro de una entrega de Farmacología'
      )
    }
  } else {
      for (const [etiqueta, carpeta] of carpetasEntregadas) {
      const dir = join(carpeta, BONUS)
      const hay = existsSync(dir) ? readdirSync(dir) : []

      /*
       * Los apuntes van en .txt y las guías en PDF, y no es un descuido.
       *
       * Los apuntes existen para que el comprador los COPIE Y PEGUE en la pestaña
       * Generar. La app le dice, en dos lugares, que pegar el texto da mejores
       * resultados que sacarlo de un PDF. Entregarlos en PDF sería darle el
       * material de prueba en el formato que el propio producto desaconseja.
       */
      const apuntes = hay.filter((f) => f.includes('apunte de arranque') && f.endsWith('.txt'))
      ok(apuntes.length === 4, `${etiqueta} trae los 4 apuntes de regalo, en .txt`, `encontré ${apuntes.length}`)
      ok(
        apuntes.every((f) => /Psicoanálisis|Desarrollo|Psicopatología|Social/.test(f)),
        `${etiqueta}: los cuatro apuntes son de Psicología`,
        apuntes.join(', ')
      )
      ok(hay.some((f) => f.includes('repaso espaciado') && f.endsWith('.pdf')), `${etiqueta} trae la guía de estudio en PDF`)
      ok(hay.some((f) => f.includes('Recetario') && f.endsWith('.pdf')), `${etiqueta} trae el recetario en PDF`)
      /*
       * Los ARCHIVOS sueltos son seis; el séptimo elemento es la carpeta Bonus.
       *
       * Antes se comparaba contra el total de entradas del directorio, y al
       * agregar los tres bonus el arnés se puso en rojo señalando «encontré 7»
       * sin que nada estuviera mal. Peor todavía: el chequeo de tamaño hacía
       * statSync sobre «Bonus», y una carpeta siempre mide menos que el mínimo,
       * así que fallaba por un archivo que no existe.
       */
      const sueltos = hay.filter((f) => statSync(join(dir, f)).isFile())
      ok(sueltos.length === 6, `${etiqueta}: los 6 archivos de regalo`, `encontré ${sueltos.length}`)

      const cortos = sueltos.filter((f) => statSync(join(dir, f)).size < (f.endsWith('.pdf') ? 12 * 1024 : 3000))
      ok(cortos.length === 0, `${etiqueta}: ninguno salió truncado ni en blanco`, cortos.join(', '))

      /* Y los tres bonus, que son la mitad del valor de la oferta y hasta ahora
         no los miraba nadie. */
      const bonus = join(dir, 'Bonus')
      const enBonus = existsSync(bonus) ? readdirSync(bonus) : []
      ok(enBonus.some((f) => f.includes('autores') && f.endsWith('.pdf')), `${etiqueta}: el mapa de autores`)
      ok(enBonus.some((f) => f.includes('parejas') && f.endsWith('.pdf')), `${etiqueta}: las parejas que se confunden`)

      const simulacros = join(bonus, 'Simulacros de final')
      const pdfs = existsSync(simulacros) ? readdirSync(simulacros).filter((f) => f.endsWith('.pdf')) : []
      ok(pdfs.length === 28, `${etiqueta}: los 28 PDF de simulacros`, `encontré ${pdfs.length}`)
      ok(
        pdfs.filter((f) => f.includes('Preguntas')).length === 14 &&
          pdfs.filter((f) => f.includes('Respuestas')).length === 14,
        `${etiqueta}: 14 de preguntas y 14 de respuestas`
      )
      const enBlanco = [
        ...enBonus.filter((f) => f.endsWith('.pdf')).map((f) => join(bonus, f)),
        ...pdfs.map((f) => join(simulacros, f))
      ].filter((r) => statSync(r).size < 12 * 1024)
      ok(enBlanco.length === 0, `${etiqueta}: ningún bonus salió en blanco`, String(enBlanco.length))
    }
  }

  // Los marcadores del contrato sin completar.
  const contrato = readFileSync(join(win, '6. Licencia de uso.txt'), 'utf8')
  ok(!/\[[A-ZÁÉÍÓÚÑ ]{3,}\]/.test(contrato), 'el contrato no tiene datos del vendedor sin completar')
  ok(!/\bundefined\b/.test(contrato), 'ni valores de JavaScript en el texto')

  if (!portableName) {
    console.error('\nSin el portable no se puede probar el arranque limpio.')
    process.exit(1)
  }

  /* --------------------- 2. arranca sin Node ni nada más -------------------- */

  seccion('Arranca en una computadora sin Node')

  // Se copia a otra carpeta a propósito: si se ejecutara desde `entregables`, el
  // portable escribiría sus datos ahí adentro y ensuciaría la entrega.
  const casa = mkdtempSync(join(tmpdir(), 'comprador-'))
  const exe = join(casa, portableName)
  copyFileSync(join(win, portableName), exe)
  console.log(`  (copiado a ${casa})`)

  const env = entornoLimpio(casa)

  /*
   * El mazo que "manda el autor", armado con el mismo script con el que se van a
   * armar los de verdad. Se escribe ANTES de arrancar el .exe porque los dos
   * diálogos nativos del importador (elegir archivo, elegir carrera) se contestan
   * con estas variables: un diálogo nativo no se puede tocar por CDP. Se contestan
   * por el NOMBRE del botón, y si el botón no existe la app falla fuerte.
   *
   * Tres respuestas: la carrera en la primera importación, y en la segunda la
   * carrera otra vez y "Agregar a la que tengo", porque la materia ya existe.
   */
  const CARRERA_DEL_MAZO = 'Enfermería (Tecnicatura)'
  const MATERIA_DEL_MAZO = 'Mazo de prueba de entrega'
  const DORSO_EN_RENGLONES = 'Diluir antes de administrar.\nControlar la vía cada hora.'
  const FUENTE_DEL_MAZO = 'Formulario Terapéutico Nacional, 2023, pág. 88'
  const { mazos: mazoDePrueba, problemas: problemasDelMazo } = armarMazos([
    {
      carrera: CARRERA_DEL_MAZO,
      materia: MATERIA_DEL_MAZO,
      unidad: 'Unidad 2 — Administración',
      tarjetas: [
        { frente: 'Potasio endovenoso: ¿qué se hace antes de pasarlo?', dorso: DORSO_EN_RENGLONES, tipo: 'conducta', fuente: FUENTE_DEL_MAZO },
        { frente: 'Heparina: ¿qué control se pide?', dorso: 'El KPTT.', tipo: 'bandera' }
      ]
    },
    { carrera: CARRERA_DEL_MAZO, materia: MATERIA_DEL_MAZO, unidad: 'Unidad 1 — Presentaciones', tarjetas: [{ frente: 'Ampolla: ¿qué es?', dorso: 'Un envase de vidrio cerrado.', tipo: 'atomo' }] }
  ])
  const archivoDelMazo = join(casa, nombreDeArchivo(MATERIA_DEL_MAZO))
  if (problemasDelMazo.length === 0) writeFileSync(archivoDelMazo, JSON.stringify(mazoDePrueba[0], null, 2), 'utf8')
  env.MEDIFLASHY_QA_IMPORTAR = archivoDelMazo
  env.MEDIFLASHY_QA_RESPUESTAS = [CARRERA_DEL_MAZO, CARRERA_DEL_MAZO, 'Agregar a la que tengo'].join('|')
  ok(!('ELECTRON_RUN_AS_NODE' in env), 'el entorno de prueba no hereda ELECTRON_RUN_AS_NODE')
  ok(!env.PATH.toLowerCase().includes('nodejs'), 'ni Node en el PATH', env.PATH)

  const app = spawn(exe, [`--remote-debugging-port=${PORT}`], { cwd: casa, env, stdio: 'ignore' })

  let page = null
  for (let i = 0; i < 90 && !page; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      page = list.find((t) => t.type === 'page')
    } catch {
      /* todavía se está autoextrayendo */
    }
  }

  ok(Boolean(page), 'el portable abre una ventana')
  if (!page) {
    app.kill()
    matarSobrantes()
    console.error('\nEl .exe no levantó. Sin eso no tiene sentido seguir.')
    process.exit(1)
  }

  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pendientes.has(msg.id)) {
      const { res, rej } = pendientes.get(msg.id)
      pendientes.delete(msg.id)
      if (msg.error) rej(new Error(JSON.stringify(msg.error)))
      else res(msg.result)
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await sleep(2500)

  /* ------------------------ 3. la app hace lo que dice ---------------------- */

  seccion('Y funciona de verdad')

  const info = await evaluar('window.flashcards.getAppInfo().then(r => r.data)')
  ok(Boolean(info?.version), 'la interfaz habla con el proceso principal', JSON.stringify(info)?.slice(0, 70))
  ok(
    info?.engineReady === true,
    'el motor de generación viajó adentro del .exe y responde',
    info?.engineError ?? ''
  )

  let bienvenida = false
  for (let i = 0; i < 40 && !bienvenida; i++) {
    bienvenida = (await texto()).includes('Tus apuntes se convierten en tarjetas')
    if (!bienvenida) await sleep(500)
  }
  ok(bienvenida, 'la bienvenida aparece en el primer arranque')

  /*
   * Se avanza HASTA EL ÚLTIMO PASO, no una cantidad fija de veces.
   *
   * Antes eran dos `clic('Siguiente')` fijos, porque la bienvenida tenía tres
   * pantallas. Cuando ganó una cuarta el arnés se quedaba en la tercera: no
   * encontraba el casillero, no llegaba al botón final, y la falla aparecía
   * cuarenta líneas más abajo como «la configuración no guarda lo que el usuario
   * eligió», que apunta al lugar equivocado. Contar pasos ata el arnés a un
   * número que el producto puede cambiar sin avisar; buscar el botón final, no.
   */
  for (let i = 0; i < 8; i++) {
    if ((await texto()).includes('Entendido')) break
    await clic('Siguiente')
    await sleep(250)
  }
  ok((await texto()).includes('Entendido'), 'se llega a la aclaración sobre el contenido')

  /*
   * Marcar la aceptación es OBLIGATORIO para entrar, y acá cumple dos funciones.
   *
   * La primera es pasar: sin la marca el botón está apagado y el arnés se
   * quedaría mirando un modal que no se cierra. La segunda es que es la forma en
   * que la app escribe su configuración: el archivo no existe hasta que el
   * usuario cambia algo —el store sólo persiste en `set()`— así que sin esto no
   * habría nada que verificar sobre si las preferencias viajan en el pendrive.
   */
  await evaluar(`(() => {
    const c = document.querySelector('[role="dialog"] input[type="checkbox"]')
    if (!c) return false
    c.click(); return true
  })()`)
  await sleep(200)
  await clic('Entendido')
  await sleep(700)

  await clic('creá una materia vacía')
  await sleep(400)
  await escribir('Nombre de la materia', 'Prueba de entrega')
  await enter('Nombre de la materia')
  await sleep(800)

  await clic('Nueva unidad')
  await sleep(400)
  await escribir('Nombre de la unidad', 'Unidad 1')
  await enter('Nombre de la unidad')
  await sleep(800)

  await clic('Escribir una tarjeta')
  await sleep(500)
  await escribir('Frente de la tarjeta', '¿Anduvo el portable?')
  await escribir('Dorso de la tarjeta', 'Sí: sin Node, sin instalar nada y con los datos al lado del exe.')
  await sleep(250)
  await clic('Guardar')
  await sleep(900)

  ok((await texto()).includes('¿Anduvo el portable?'), 'se puede crear y guardar una tarjeta')

  /* ---------------------- 4. los datos, al lado del exe --------------------- */

  seccion('Los datos viajan con el programa')

  const datos = join(casa, `${APP_NAME}-datos`)
  ok(existsSync(datos), 'se creó la carpeta de datos al lado del .exe', datos)

  /*
   * Cinco unidades y no una: las cuatro de los mazos de regalo, que la app
   * siembra en el primer arranque, más la que crea esta prueba.
   *
   * La cuenta se verifica igual en vez de aflojarla a "al menos una": si mañana
   * la siembra deja de correr, el comprador vuelve a encontrarse la biblioteca
   * vacía el primer día y nada lo delataría — la app abre, guarda y funciona.
   */
  const unidades = existsSync(join(datos, 'unidades')) ? readdirSync(join(datos, 'unidades')) : []
  ok(
    unidades.length === UNIDADES_DE_REGALO + 1,
    `con las ${UNIDADES_DE_REGALO} unidades de regalo y la de la prueba`,
    `${unidades.length} archivo(s)`
  )

  if (unidades.length === 1) {
    const u = JSON.parse(readFileSync(join(datos, 'unidades', unidades[0]), 'utf8'))
    ok(u.tarjetas?.[0]?.frente?.includes('portable'), 'y la tarjeta escrita en el disco')
  }

  ok(existsSync(join(datos, 'logs')), 'el registro también queda al lado, no en el perfil del usuario')

  /*
   * Y se llama como dice el manual.
   *
   * El instructivo le pide al comprador que adjunte "el archivo <producto>.log"
   * y le abre esa carpeta. El archivo se llamó "flashcards.log" primero y
   * "psicoflashy.log" después —las dos veces heredado del producto del que salió
   * la copia— así que el comprador abría la carpeta y encontraba un archivo con
   * el nombre de otra app. Nada lo verificaba: es una promesa del manual sin
   * nadie que la sostenga. Por eso el nombre se compara contra APP_NAME y no
   * contra un literal: escrito a mano, se desincroniza en la próxima copia.
   */
  const logs = existsSync(join(datos, 'logs')) ? readdirSync(join(datos, 'logs')) : []
  ok(
    logs.includes(`${APP_NAME.toLowerCase()}.log`),
    'y el archivo se llama como el manual le dice al comprador que se llama',
    logs.join(', ') || 'la carpeta está vacía'
  )
  ok(existsSync(join(datos, 'config.json')), 'y la configuración, así el pendrive se lleva las preferencias')

  if (existsSync(join(datos, 'config.json'))) {
    const cfg = JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8'))
    ok(cfg.hideOnboarding === true, 'con lo que el usuario eligió, no con los valores por defecto')
    /*
     * Y el registro de que aceptó la aclaración, que es el que tiene valor si
     * mañana alguien pide el reembolso diciendo que nadie le avisó que las
     * tarjetas podían tener un error. Vive en la carpeta de datos del comprador,
     * no en un servidor: no prueba nada ante un tercero, pero sí obliga a que el
     * aviso se haya mostrado y marcado antes de poder usar la app.
     */
    ok(cfg.avisoAceptado === true, 'y con la aclaración sobre el contenido aceptada')
  }

  /* ------------------- 4b. importar un mazo que manda el autor ------------- */

  seccion('Importar un mazo que manda el autor')

  /*
   * El recorrido de un mazo vendido aparte, en el .exe que se entrega: el botón de
   * la Biblioteca, la pregunta de la carrera (la app está viendo todas), el aviso,
   * y lo que queda escrito. Antes el mazo iba a la primera carrera de la lista
   * —Medicina— y perdía la fuente de cada tarjeta y los renglones del dorso.
   */
  ok(problemasDelMazo.length === 0 && existsSync(archivoDelMazo), 'el script armó el mazo de prueba', problemasDelMazo.join(' | '))

  const clicPorTitulo = (titulo) =>
    evaluar(`(() => {
      const el = [...document.querySelectorAll('button')].find(x => x.getAttribute('title') === ${JSON.stringify(titulo)})
      if (!el) return false
      el.click(); return true
    })()`)

  const leerBiblioteca = () => {
    const indice = JSON.parse(readFileSync(join(datos, 'materias.json'), 'utf8'))
    const materia = (indice.materias ?? []).find((m) => m.nombre === MATERIA_DEL_MAZO)
    const carrera = materia ? (indice.carreras ?? []).find((c) => c.id === materia.carreraId) : null
    const tarjetas = materia
      ? readdirSync(join(datos, 'unidades'))
          .map((f) => JSON.parse(readFileSync(join(datos, 'unidades', f), 'utf8')))
          .filter((u) => u.materiaId === materia.id)
          .flatMap((u) => u.tarjetas)
      : []
    return { materia, carrera, tarjetas }
  }

  ok((await clicPorTitulo('Importar un mazo desde un archivo')) === true, 'está el botón de importar en la Biblioteca')
  let avisoImportado = ''
  for (let i = 0; i < 30 && !avisoImportado.includes('Se agregaron'); i++) {
    await sleep(300)
    avisoImportado = await texto()
  }
  ok(avisoImportado.includes('Se agregaron 3 tarjetas'), 'el aviso cuenta las tres tarjetas que entraron')

  const b1 = leerBiblioteca()
  ok(Boolean(b1.materia), 'la materia del mazo quedó en la biblioteca')
  ok(b1.carrera?.nombre === CARRERA_DEL_MAZO, `y en la carrera elegida (${CARRERA_DEL_MAZO}), no en la primera de la lista`, String(b1.carrera?.nombre))
  ok(b1.tarjetas.length === 3, 'con sus tres tarjetas', String(b1.tarjetas.length))
  ok(b1.tarjetas.some((t) => t.fuente === FUENTE_DEL_MAZO), 'la tarjeta llegó con su fuente')
  ok(b1.tarjetas.some((t) => t.dorso === DORSO_EN_RENGLONES), 'y con el dorso en renglones')
  ok(b1.tarjetas.every((t) => t.schedule?.reps === 0), 'y todas arrancan sin historial de estudio')

  ok((await clicPorTitulo('Importar un mazo desde un archivo')) === true, 'importar el mismo mazo otra vez')
  let avisoRepetido = ''
  for (let i = 0; i < 30 && !avisoRepetido.includes('ya estaba completo'); i++) {
    await sleep(300)
    avisoRepetido = await texto()
  }
  ok(avisoRepetido.includes('ya estaba completo'), 'avisa que el mazo ya estaba completo')
  const b2 = leerBiblioteca()
  ok(b2.tarjetas.length === 3, 'y no duplica ninguna tarjeta', String(b2.tarjetas.length))

  /* ---------------------- 5. lo que viaja adentro del exe ------------------- */

  seccion('Los documentos legales viajan adentro del programa')

  const recursos = await evaluar('window.flashcards.getAppInfo().then(r => r.data?.modelsDir)')
  ok(typeof recursos === 'string' && recursos.length > 0, 'la app sabe dónde guarda los modelos', String(recursos))

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)

  try {
    ws.close()
  } catch {
    /* ya estaba cerrado */
  }
  app.kill()
  matarSobrantes()
  await sleep(1000)
  try {
    rmSync(casa, { recursive: true, force: true })
  } catch {
    console.log(`   (la carpeta de prueba quedó en ${casa})`)
  }
  process.exit(fallas === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('El arnés falló:', err)
  matarSobrantes()
  process.exit(1)
})
