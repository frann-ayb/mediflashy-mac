#!/usr/bin/env node
/**
 * La app REAL, manejada de punta a punta por CDP.
 *
 * Los otros arneses prueban la lógica llamando a los módulos directamente. Éste
 * prueba lo que los otros no pueden: que el preload exponga bien el puente, que
 * los canales de IPC estén conectados a lo que la interfaz cree, y que un click
 * en un botón termine en un archivo escrito en el disco.
 *
 * NO usa el modelo de IA: generar tarjetas de verdad son 2,7 GB de descarga y
 * varios minutos. El flujo que se ejercita acá es el otro 90 % — crear, editar,
 * buscar, estudiar y borrar—, que es donde vive el uso diario.
 *
 *   npm run qa:ui
 *
 * Corre contra una carpeta de datos temporal, no contra la del usuario.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* El número de unidades del mazo sale de la constante compartida, que es la
   misma que la app muestra en «Sobre esta versión» y la que `qa/siembra.ts`
   cruza contra el contenido real. */
const UNIDADES_DE_REGALO = Number(
  /UNIDADES_DE_REGALO = (\d+)/.exec(readFileSync(join(ROOT, 'src', 'shared', 'types.ts'), 'utf8'))?.[1] ?? 0
)
const SHOTS = join(ROOT, '.qa', 'shots')
const PORT = 9451

const electron = join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')

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

/** Hace click en el primer elemento que coincide con el selector y contiene el texto. */
const clic = (selector, texto) =>
  evaluar(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find(x => (x.textContent ?? '').includes(${JSON.stringify(texto)}))
    if (!el) return false
    el.click(); return true
  })()`)

const clicPorTitulo = (titulo) =>
  evaluar(`(() => {
    const el = [...document.querySelectorAll('button')].find(x => (x.getAttribute('title') ?? '') === ${JSON.stringify(titulo)})
    if (!el) return false
    el.click(); return true
  })()`)

/** Escribe en un input/textarea disparando el evento que React escucha. */
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
  evaluar(`(() => {
    const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(ariaLabel)}) + ']')
    if (!el) return false
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    return true
  })()`)

const texto = () => evaluar('document.body.innerText')

/**
 * Espera a que la pantalla diga algo, en vez de esperar una cantidad de tiempo.
 *
 * Un `sleep` fijo es una apuesta contra la máquina más lenta que vaya a correr
 * esto, y se pierde sola con el tiempo: la búsqueda esperaba 900 ms, y al pasar
 * la app a sembrar 1.507 tarjetas el índice tardó un poco más en reconstruirse
 * y la prueba empezó a fallar una de cada dos veces. Subir el número otra vez
 * sólo corre el problema unos meses.
 *
 * Devuelve el texto apenas aparece lo buscado, así la corrida feliz es MÁS
 * rápida que el sleep que reemplaza, y sólo se demora cuando de verdad hay que
 * esperar.
 */
async function esperarTexto(fragmento, { limite = 6000, paso = 100 } = {}) {
  const hasta = Date.now() + limite
  let ultimo = ''
  do {
    ultimo = await texto()
    if (ultimo.includes(fragmento)) return ultimo
    await sleep(paso)
  } while (Date.now() < hasta)
  return ultimo
}

async function captura(nombre) {
  try {
    mkdirSync(SHOTS, { recursive: true })
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(SHOTS, `${nombre}.png`), Buffer.from(r.data, 'base64'))
  } catch {
    /* una captura que falla no invalida la prueba */
  }
}

/**
 * Cierra cualquier instancia que haya quedado colgada de una corrida anterior.
 *
 * Es por plataforma porque el arnés también corre en la Mac, donde `taskkill` no
 * existe: sin esto, el primer intento de correr QA allá muere con "command not
 * found" en un lugar que no tiene nada que ver con lo que se está probando.
 */
function matarSobrantes(proceso) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/im', proceso, '/f', '/t'], { stdio: 'ignore' })
  } else {
    spawnSync('pkill', ['-f', proceso.replace(/\.exe$/, '')], { stdio: 'ignore' })
  }
}

async function main() {
  if (!existsSync(join(ROOT, 'out', 'main', 'index.js'))) {
    console.error('Falta compilar. Corré `npm run build` antes.')
    process.exit(1)
  }

  /**
   * La prueba corre la app EN MODO PORTABLE, y eso resuelve dos cosas a la vez.
   *
   * La primera es aislarla. Se probó redirigir `%APPDATA%` y no alcanza: en Windows
   * `app.getPath('appData')` sale de la API de carpetas conocidas del shell y no de
   * la variable de entorno, así que la app escribía igual en la carpeta real del
   * usuario. `--user-data-dir` tampoco sirve, porque `configureUserDataDir()` lo
   * pisa al arrancar. `PORTABLE_EXECUTABLE_DIR` sí: es lo que lee `dataRoot()`, y
   * con `logsDir()`/`configFile()` colgando de ahí en portable, TODO lo que la app
   * escribe queda adentro de la carpeta temporal.
   *
   * La segunda es que, de paso, se ejercita el modo portable, que es una de las dos
   * formas en que se entrega el producto y sería fácil que se rompiera sin que
   * nadie lo note hasta que un comprador lo enchufe en un pendrive.
   */
  const tmp = mkdtempSync(join(tmpdir(), 'flashcards-ui-'))
  const datos = join(tmp, 'Mediflashy-datos')
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: tmp }
  delete env.ELECTRON_RUN_AS_NODE

  console.log(`Carpeta de datos de la prueba: ${datos}`)
  const app = spawn(electron, ['.', `--remote-debugging-port=${PORT}`], { cwd: ROOT, env, stdio: 'ignore' })

  let page = null
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      page = list.find((t) => t.type === 'page')
    } catch {
      /* todavía no levantó */
    }
  }
  if (!page) {
    console.error('La app no abrió ninguna ventana.')
    app.kill()
    matarSobrantes('electron.exe')
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
  await sleep(2000)

  /* ------------------------------- el puente ------------------------------- */

  seccion('El puente con el proceso principal')

  const tienePuente = await evaluar('typeof window.flashcards === "object" && window.flashcards !== null')
  ok(tienePuente === true, 'el preload expone window.flashcards')

  const sinNode = await evaluar('typeof window.require === "undefined" && typeof window.process === "undefined"')
  ok(sinNode === true, 'y la interfaz NO tiene acceso a Node')

  const info = await evaluar('window.flashcards.getAppInfo().then(r => r.data)')
  ok(info?.version?.length > 0, 'getAppInfo responde', JSON.stringify(info)?.slice(0, 80))
  ok(info?.engineReady === true, 'el motor de generación está disponible', info?.engineError ?? '')

  /*
   * El nombre en la barra de la ventana.
   *
   * Se comprueba contra `info.nombre` —que sale de `app.getName()`, o sea del
   * `productName` de electron-builder— y no contra el literal "Mediflashy": lo
   * que importa no es que diga una palabra, es que diga LA MISMA que el producto
   * instalado.
   *
   * Existe porque falló de verdad. El `BrowserWindow` se creaba con
   * `title: 'Mediflashy'` y el título igual salía mal: el `<title>` del HTML
   * pisa al de la ventana en cuanto el documento carga, y ahí seguía el nombre
   * del producto del que se copió este árbol. Las dos cosas parecían bien por
   * separado y el usuario veía la equivocada.
   */
  const tituloVentana = await evaluar('document.title')
  ok(
    tituloVentana === info?.nombre,
    'la ventana lleva el nombre del producto instalado',
    `la barra dice ${JSON.stringify(tituloVentana)} y la app se llama ${JSON.stringify(info?.nombre)}`
  )

  /* ------------------------------- la bienvenida ---------------------------- */

  seccion('La primera vez, la bienvenida')

  const saludo = await texto()
  ok(saludo.includes('Tus apuntes se convierten en tarjetas'), 'aparece sola en el primer arranque')
  ok(saludo.includes('Siguiente'), 'con un paso a paso, no un cartel único')

  await clic('button', 'Siguiente')
  await sleep(300)
  ok((await texto()).includes('te las va tomando'), 'el segundo paso explica el repaso espaciado')

  await clic('button', 'Siguiente')
  await sleep(300)
  ok((await texto()).includes('en tu computadora'), 'el tercero es la promesa de privacidad')

  /*
   * El cuarto paso es el único de toda la app que no deja seguir.
   *
   * Y es el que más se comprueba, porque es el que sostiene una promesa
   * comercial: que nadie compre, encuentre un error y diga con razón que nadie
   * le avisó. Un aviso que se puede saltear con Escape, o cuyo botón deja pasar
   * igual, no es un aviso — es un cartel. Por eso acá no alcanza con verificar
   * que el texto esté: se verifica que el paso esté CERRADO antes de marcar.
   */
  await clic('button', 'Siguiente')
  await sleep(300)
  const aviso = await texto()
  ok(aviso.includes('puede quedar un error'), 'el cuarto avisa que el contenido puede tener errores')
  ok(aviso.includes('contrastalo'), 'y le pide contrastar los datos críticos')
  ok(aviso.includes('todas las tarjetas se editan'), 'y le dice que puede corregir cualquier tarjeta')
  ok(aviso.includes('Marcá la casilla para entrar'), 'y explica por qué el botón está apagado')
  ok(!aviso.includes('¿Qué estudiás?'), 'y ya no le hace elegir una carrera')

  const botonApagado = () =>
    evaluar(`(() => {
      const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => (x.textContent ?? '').includes('Entendido'))
      return b ? b.disabled : null
    })()`)

  ok((await botonApagado()) === true, 'sin marcar la casilla, el botón de entrar está apagado')

  // Escape tampoco cierra: es la salida que usaría cualquiera para saltearlo.
  await evaluar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await sleep(250)
  ok((await texto()).includes('Marcá la casilla'), 'ni Escape lo saltea')

  const marcada = await evaluar(`(() => {
    const c = document.querySelector('[role="dialog"] input[type="checkbox"]')
    if (!c) return false
    c.click(); return true
  })()`)
  ok(marcada === true, 'la casilla de aceptación está en ese paso')
  await sleep(250)
  ok((await botonApagado()) === false, 'y al marcarla recién ahí se habilita')

  await clic('button', 'Entendido')
  await sleep(500)
  ok(!(await texto()).includes('Tus apuntes se convierten'), 'se cierra al aceptar')

  /* -------------------------------- pantalla ------------------------------- */

  seccion('La pantalla arranca bien')

  const inicial = await texto()
  ok(inicial.includes('Biblioteca') && inicial.includes('Generar'), 'se ven las cuatro secciones')
  /*
   * El primer arranque ya no muestra el estado vacío: la app siembra cuatro
   * mazos de regalo. Se verifica lo que ve el comprador de verdad, que es lo
   * único que importa — si la siembra dejara de correr, esto salta.
   */
  ok(inicial.includes('Farmacología'), 'la app arranca con los mazos de regalo cargados')
  ok(inicial.includes('Absorción') || inicial.includes('Farmacología General'), 'las materias de la carrera están')
  ok(!inicial.includes('Convertí tu primer apunte en tarjetas'), 'y por eso no se ve el estado vacío')
  await captura('01-primer-arranque')

  /* --------------------------------- crear --------------------------------- */

  seccion('Arrepentirse de crear una materia')

  /*
   * Lo encontró el dueño usando la app: abría "Nueva materia", elegía la carrera
   * y no había forma de salir. El Escape sólo lo escuchaba el campo de texto
   * (con el foco en el desplegable no llegaba) y no había ningún botón. Se
   * prueban las tres salidas, y la del Escape desde el desplegable, que era la rota.
   */
  const formularioAbierto = () => evaluar(`!!document.querySelector('[aria-label="Nombre de la materia"]')`)

  await clicPorTitulo('Nueva materia')
  await sleep(300)
  ok((await formularioAbierto()) === true, 'se abre el formulario de materia nueva')
  await clic('button', 'Cancelar')
  await sleep(300)
  ok((await formularioAbierto()) === false, 'el botón Cancelar lo cierra')

  await clicPorTitulo('Nueva materia')
  await sleep(300)
  const conDesplegable = await evaluar(`(() => {
    const s = document.querySelector('[aria-label="Carrera de la materia nueva"]')
    if (!s) return false
    s.focus()
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    return true
  })()`)
  await sleep(300)
  ok(conDesplegable === true && (await formularioAbierto()) === false, 'Escape lo cierra aunque el foco esté en la carrera')

  await clicPorTitulo('Nueva materia')
  await sleep(300)
  await clicPorTitulo('Cancelar la materia nueva')
  await sleep(300)
  ok((await formularioAbierto()) === false, 'y tocar el + de nuevo también lo cierra')
  ok(!(await texto()).includes('Clínica de Adultos'), 'sin crear ninguna materia')

  seccion('Crear una materia, una unidad y una tarjeta')

  await clicPorTitulo('Nueva materia')
  await sleep(300)
  await escribir('Nombre de la materia', 'Clínica de Adultos')
  await enter('Nombre de la materia')
  await sleep(600)

  ok((await texto()).includes('Clínica de Adultos'), 'la materia aparece en el árbol')

  await clic('button', 'Nueva unidad')
  await sleep(300)
  await escribir('Nombre de la unidad', 'Unidad de prueba ZZQA')
  await enter('Nombre de la unidad')
  await sleep(600)

  ok((await texto()).includes('ZZQA'), 'la unidad aparece bajo su materia')
  await captura('02-con-unidad')

  await clic('button', 'Escribir una tarjeta')
  await sleep(400)
  await escribir('Frente de la tarjeta', '¿Qué es la prescripción adquisitiva?')
  await escribir('Dorso de la tarjeta', 'El modo de adquirir el dominio por la posesión continuada durante el tiempo que fija la ley.')
  await sleep(200)
  await clic('button', 'Guardar')
  await sleep(700)

  const conTarjeta = await texto()
  ok(conTarjeta.includes('prescripción adquisitiva'), 'la tarjeta queda en la lista')
  // En singular, no "1 tarjetas": la concordancia la resuelve `plural()`.
  ok(conTarjeta.includes('1 tarjeta') && !conTarjeta.includes('1 tarjetas'), 'y los contadores la reflejan, bien conjugados')

  seccion('Los accesos que la documentación promete')
  const conAccesos = await evaluar(
    `[...document.querySelectorAll('button')].map(b => b.getAttribute('title') ?? '').filter(Boolean)`
  )
  ok(
    Array.isArray(conAccesos) && conAccesos.some((t) => t.includes('archivo de registro')),
    'existe el botón del registro que el instructivo manda a tocar'
  )
  ok(
    Array.isArray(conAccesos) && conAccesos.some((t) => t.includes('copia')),
    'y el que abre la carpeta de datos para respaldar'
  )
  await captura('03-con-tarjeta')

  /* ------------------------------- en el disco ------------------------------ */

  seccion('Quedó escrita en el disco de verdad')

  const dirUnidades = join(datos, 'unidades')

  /*
   * Se busca la unidad POR SU NOMBRE y no dando por hecho que es la única.
   *
   * Desde que la app siembra los mazos de regalo hay cinco archivos acá: los
   * cuatro de fábrica más el que crea esta prueba. La versión anterior exigía
   * exactamente uno y empezó a fallar el día que la siembra entró.
   */
  const archivoDeLaUnidad = () => {
    const todos = existsSync(dirUnidades) ? readdirSync(dirUnidades).filter((n) => n.endsWith('.json')) : []
    return todos.find((n) => {
      try {
        return JSON.parse(readFileSync(join(dirUnidades, n), 'utf8')).nombre.includes('ZZQA')
      } catch {
        return false
      }
    })
  }

  const archivos = existsSync(dirUnidades) ? readdirSync(dirUnidades).filter((n) => n.endsWith('.json')) : []
  /*
   * 70 unidades de regalo más la que crea esta prueba.
   *
   * El número venía de cuando la app sembraba cuatro mazos; al pasar el producto
   * a Psicología pasaron a ser 70 y esta línea siguió esperando 5, así que
   * fallaba por una razón que no tenía nada que ver con lo que prueba.
   *
   * Quien manda sobre el 70 es `qa/siembra.ts`, que lo verifica contra las
   * constantes del módulo de mazos y contra la landing. Acá sólo se comprueba
   * que la unidad recién creada se sumó a las que ya estaban.
   */
  /* Contra la constante y no contra un numero pegado: el mazo crece lote a lote
     y un 71 escrito a mano se desactualiza en la proxima tanda. */
  const esperadas = UNIDADES_DE_REGALO + 1
  ok(
    archivos.length === esperadas,
    `hay ${esperadas} archivos de unidad: los ${UNIDADES_DE_REGALO} de regalo y el de la prueba`,
    `${archivos.length} en ${dirUnidades}`
  )

  const miArchivo = archivoDeLaUnidad()
  ok(miArchivo !== undefined, 'y el de la unidad recién creada está entre ellos')

  if (miArchivo) {
    const enDisco = JSON.parse(readFileSync(join(dirUnidades, miArchivo), 'utf8'))
    ok(enDisco.tarjetas.length === 1, 'con la tarjeta adentro')
    ok(enDisco.tarjetas[0].frente.includes('prescripción'), 'y su texto completo')
    ok(typeof enDisco.tarjetas[0].schedule.learningSteps === 'number', 'con el paso de aprendizaje persistido')
  }

  /* -------------------------------- buscar --------------------------------- */

  seccion('Buscar desde la interfaz')

  await escribir('Buscar tarjetas', 'posesion')
  // Entre guardar la tarjeta y ver el resultado pasan tres cosas asincrónicas:
  // el guardado, el refresco de la biblioteca por evento y el debounce de
  // 150 ms del buscador. Se espera a que el resultado APAREZCA en vez de
  // apostar a un número de milisegundos; ver `esperarTexto`.
  const conBusqueda = await esperarTexto('prescripción adquisitiva')
  ok(conBusqueda.includes('prescripción adquisitiva'), 'buscar "posesion" sin tilde encuentra "posesión"')
  ok(conBusqueda.includes('Clínica de Adultos'), 'y el resultado dice de qué materia viene')
  await captura('04-busqueda')

  await escribir('Buscar tarjetas', '')
  await sleep(500)

  /* -------------------------------- estudiar ------------------------------- */

  seccion('Una sesión de estudio')

  // El primer botón con el texto "Estudiar" en el DOM es la pestaña del encabezado,
  // así que este click cambia de sección; el segundo arranca la sesión. Es a
  // propósito: prueba el camino de entrar a Estudiar sin venir de la biblioteca.
  await clic('button', 'Estudiar')
  await sleep(700)
  await clic('button', 'Estudiar todo')
  await sleep(900)

  const enSesion = await texto()
  ok(enSesion.includes('Mostrar resultado'), 'arranca mostrando sólo el frente')
  ok(enSesion.includes('¿Qué es la prescripción adquisitiva?'), 'con la pregunta')
  ok(!enSesion.includes('tiempo que fija la ley'), 'y el dorso NO se ve todavía')
  await captura('05-frente')

  await clic('button', 'Mostrar resultado')
  await sleep(500)

  const revelado = await texto()
  ok(revelado.includes('tiempo que fija la ley'), 'al mostrar el resultado aparece el dorso')
  ok(revelado.includes('No la sabía') && revelado.includes('La sabía'), 'y los tres botones')
  await captura('06-revelado')

  await clic('button', 'La sabía')
  await sleep(900)

  const cerrada = await texto()
  ok(cerrada.includes('Listo'), 'acertar la única tarjeta CIERRA la sesión, no la repite')
  ok(cerrada.includes('Las sabía'), 'y el resumen desglosa cómo le fue')
  await captura('07-cierre')

  const historial = join(datos, 'repasos.jsonl')
  ok(existsSync(historial), 'el repaso quedó anotado en el historial')
  if (existsSync(historial)) {
    const linea = readFileSync(historial, 'utf8').trim().split('\n')[0]
    const entrada = JSON.parse(linea)
    ok(entrada.g === 'si' && entrada.n === 1, 'con la calificación y la marca de "era nueva"', linea)
  }

  /* -------------------------------- progreso ------------------------------- */

  seccion('El progreso refleja lo estudiado')

  await clic('button', 'Progreso')
  await sleep(800)
  const progreso = await texto()
  ok(progreso.includes('Clínica de Adultos'), 'la materia aparece en el panel')
  ok(progreso.includes('repasos hoy'), 'y el contador del día')
  await captura('08-progreso')

  /* -------------------------- el mini-prompt no se guarda ------------------- */

  seccion('El aviso de la generación con IA')

  /*
   * Generar con IA es un extra que depende de la computadora del comprador. El
   * aviso tiene que aparecer la primera vez, decir que tiene requisitos mínimos y
   * recomendar cargar las tarjetas a mano, y no dejar usar la función sin aceptar.
   */
  const avisoIa = () => evaluar(`!!document.querySelector('[role="dialog"]') && document.body.innerText.includes('Antes de generar tarjetas con IA')`)
  const continuarApagado = () =>
    evaluar(`(() => {
      const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => (x.textContent ?? '').trim() === 'Continuar')
      return b ? b.disabled : null
    })()`)

  await clic('button', 'Generar')
  await sleep(600)
  ok((await avisoIa()) === true, 'al abrir Generar aparece el aviso')
  const textoAviso = await texto()
  ok(textoAviso.includes('los modelos de IA se descargan en tu computadora'), 'dice que los modelos se descargan en la computadora')
  ok(textoAviso.includes('requisitos mínimos') && textoAviso.includes('4 GB de RAM'), 'dice que tiene requisitos mínimos, con la memoria')
  ok(textoAviso.includes('recursos de tu computadora') && textoAviso.includes('no a una falla de la app'), 'y que una demora es la computadora, no un error de la app')
  ok(textoAviso.includes('agregar las tarjetas manualmente'), 'recomienda cargar las tarjetas a mano')
  ok(textoAviso.includes('Aceptar y no volver a mostrar'), 'la casilla dice "Aceptar y no volver a mostrar"')
  ok((await continuarApagado()) === true, 'sin marcar la casilla, Continuar está apagado')
  await captura('08b-aviso-generar')

  await clic('button', 'Volver')
  await sleep(500)
  // Se reconoce la Biblioteca por su botón de materia nueva: el título "Materias"
  // se ve en mayúsculas y `innerText` lo devuelve así.
  const enBiblioteca = await evaluar(`!!document.querySelector('button[title="Nueva materia"]')`)
  ok((await avisoIa()) === false && enBiblioteca === true, 'Volver lleva a la Biblioteca sin entrar a Generar')

  await clic('button', 'Generar')
  await sleep(600)
  ok((await avisoIa()) === true, 'al volver a Generar sin haber aceptado, el aviso aparece otra vez')
  await evaluar(`document.querySelector('[role="dialog"] input[type="checkbox"]')?.click()`)
  await sleep(250)
  ok((await continuarApagado()) === false, 'al marcar la casilla se habilita Continuar')
  await clic('button', 'Continuar')
  await sleep(700)
  ok((await avisoIa()) === false, 'Continuar cierra el aviso y deja usar Generar')
  const cfgAviso = JSON.parse(readFileSync(join(datos, 'config.json'), 'utf8'))
  ok(cfgAviso.avisoIaAceptado === true, 'la aceptación queda guardada en la configuración')

  await clic('button', 'Biblioteca')
  await sleep(400)
  await clic('button', 'Generar')
  await sleep(600)
  ok((await avisoIa()) === false, 'y no se vuelve a mostrar')

  seccion('El mini-prompt no toca el disco')

  await clic('button', 'Biblioteca')
  await sleep(300)
  await clic('button', 'Generar')
  await sleep(700)
  const SECRETO = 'ESTO-NO-DEBE-QUEDAR-GUARDADO-12345'
  await escribir('Preferencias para la generación', SECRETO)
  await sleep(400)
  await captura('09-generar')

  // Se cambia de sección y se vuelve: el texto tiene que seguir ahí (vive en RAM)
  // pero no puede haber tocado ningún archivo.
  await clic('button', 'Biblioteca')
  await sleep(400)
  await clic('button', 'Generar')
  await sleep(500)

  // El valor de un <textarea> NO aparece en `innerText`: hay que leer la propiedad.
  const enElCampo = await evaluar(
    `document.querySelector('[aria-label="Preferencias para la generación"]')?.value ?? ''`
  )
  ok(enElCampo.includes(SECRETO), 'sobrevive a cambiar de sección (vive en memoria)', enElCampo.slice(0, 40))

  const archivosDeDatos = []
  const recorrer = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) recorrer(p)
      else archivosDeDatos.push(p)
    }
  }
  recorrer(datos)

  const filtrado = archivosDeDatos.filter((p) => {
    try {
      return readFileSync(p, 'utf8').includes(SECRETO)
    } catch {
      return false
    }
  })
  ok(filtrado.length === 0, 'NO aparece en ningún archivo de la carpeta de datos', filtrado.join(', '))

  /* --------------------------------- borrar -------------------------------- */

  seccion('Borrar una tarjeta')

  await clic('button', 'Biblioteca')
  await sleep(600)

  // Volver a la sección desmonta y remonta la biblioteca, así que ninguna unidad
  // queda seleccionada: hay que elegirla de nuevo en el árbol para ver sus tarjetas.
  //
  // Se busca por "ZZQA", que es un nombre que el mazo no puede contener.
  //
  // Antes se buscaba por "Unidad 3" —y había catorce unidades de regalo llamadas
  // así— y después por "Prescripción", que también terminó chocando: el mazo de
  // Farmacología trae "Unidad 14 — Prescripción racional y poblaciones
  // especiales". Las dos veces `clic` agarró una unidad del regalo y fallaban
  // las tres comprobaciones siguientes sin que ninguna tuviera que ver con
  // borrar. La lección: el nombre de una unidad de prueba tiene que ser
  // imposible de encontrar en el contenido real, no sólo poco probable.
  await clic('button', 'ZZQA')
  await sleep(700)
  ok((await texto()).includes('prescripción adquisitiva'), 'al volver y elegir la unidad, la tarjeta sigue ahí')

  /**
   * Se borra una TARJETA y no una materia, y hay un motivo técnico además del de
   * alcance: borrar una materia abre un `dialog.showMessageBoxSync` nativo, que
   * BLOQUEA el proceso principal hasta que alguien apriete un botón. Y como el
   * canal de CDP lo atiende ese mismo proceso, el arnés queda esperando una
   * respuesta que no va a llegar nunca: se cuelga hasta el timeout.
   *
   * Verificado: con el click a "Borrar" de una materia, esta prueba se colgaba en
   * ese punto todas las veces.
   *
   * Borrar una tarjeta no pide confirmación —es una acción barata y frecuente— así
   * que sí se puede automatizar, y ejercita el mismo camino de escritura al disco.
   * La confirmación nativa de materias y unidades va en la lista de comprobaciones
   * manuales del README.
   */
  const antesDeBorrar = archivoDeLaUnidad()
  const tarjetasAntes = antesDeBorrar
    ? JSON.parse(readFileSync(join(dirUnidades, antesDeBorrar), 'utf8')).tarjetas.length
    : -1
  ok(tarjetasAntes === 1, 'antes de borrar hay una tarjeta en el disco', String(tarjetasAntes))

  await clicPorTitulo('Borrar la tarjeta')
  await sleep(900)

  const tarjetasDespues = antesDeBorrar
    ? JSON.parse(readFileSync(join(dirUnidades, antesDeBorrar), 'utf8')).tarjetas.length
    : -1
  ok(tarjetasDespues === 0, 'después del click ya no está en el disco', String(tarjetasDespues))
  ok((await texto()).includes('todavía no tiene tarjetas'), 'y la pantalla vuelve al estado vacío')
  await captura('10-borrada')

  /* ---------------------------------- final -------------------------------- */

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  console.log(`   Capturas en ${SHOTS}`)

  try {
    ws.close()
  } catch {
    /* ya estaba cerrado */
  }
  app.kill()
  matarSobrantes('electron.exe')
  if (fallas === 0) {
    try {
      rmSync(tmp, { recursive: true, force: true })
    } catch {
      /* la deja el sistema */
    }
  } else {
    console.log(`   La carpeta de datos queda para inspección: ${tmp}`)
  }
  process.exit(fallas === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('El arnés falló:', err)
  matarSobrantes('electron.exe')
  process.exit(1)
})
