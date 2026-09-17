#!/usr/bin/env node
/**
 * Revisión visual: captura cada pantalla en los dos tamaños que importan.
 *
 * No afirma nada por sí solo — es el material para mirar una por una contra la
 * lista del final. Las pruebas que sí afirman están en los otros arneses.
 *
 * Los dos tamaños no son arbitrarios. El mínimo (940×660) es el que la app deja
 * achicar, y es donde las cosas se desbordan: un modal más alto que la ventana
 * deja el título cortado arriba y los botones tapados abajo, sin forma de llegar
 * a ellos porque el overlay no scrollea. En Convertexto eso lo encontró la
 * revisión visual, no una prueba: es exactamente la clase de cosa que sólo se ve
 * mirando.
 *
 *   npm run qa:vista
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = join(ROOT, '.qa', 'vista')
const PORT = 9455

const TAMANOS = [
  { nombre: 'chico', ancho: 940, alto: 660 },
  { nombre: 'grande', ancho: 1280, alto: 860 }
]

/**
 * Los dos temas.
 *
 * El recorrido completo se hace en los dos tamaños con el tema oscuro y en UN
 * tamaño con el claro, y la asimetría es a propósito: el tamaño prueba el
 * ACOMODO —qué se desborda, qué se corta— y eso no depende del color; el tema
 * prueba el COLOR, y eso no depende del ancho de la ventana. Hacer la matriz
 * completa serían cuarenta y cuatro capturas para mirar dos veces lo mismo.
 *
 * Lo que sí corre en los dos temas es la sonda de contraste, que es la que
 * encuentra de verdad los problemas de un tema nuevo.
 */
const TEMAS = ['oscuro', 'claro']

const electron = join(ROOT, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')

let ws
let seq = 0
const pendientes = new Map()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const capturas = []
let fallo = false

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
  evaluar(`(() => {
    const el = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(ariaLabel)}) + ']')
    if (!el) return false
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    return true
  })()`)

async function captura(nombre) {
  try {
    mkdirSync(SHOTS, { recursive: true })
    const r = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(SHOTS, `${nombre}.png`), Buffer.from(r.data, 'base64'))
    capturas.push(nombre)
    console.log(`  📷 ${nombre}`)
  } catch (err) {
    console.log(`  (no se pudo capturar ${nombre}: ${err.message})`)
  }
}

/**
 * ¿Algo se sale de la ventana?
 *
 * Se mide el desborde HORIZONTAL del documento y de cada elemento visible. Un
 * scroll vertical es normal; uno horizontal, en una app de escritorio con ancho
 * fijo, casi siempre es algo que se pasó de largo.
 */
const desbordes = () =>
  evaluar(`(() => {
    const salida = []
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      salida.push('EL DOCUMENTO scrollea horizontalmente: ' + document.documentElement.scrollWidth + ' > ' + window.innerWidth)
    }
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right > window.innerWidth + 2 || r.left < -2) {
        const t = (el.textContent ?? '').trim().slice(0, 40)
        salida.push(el.tagName.toLowerCase() + (t ? ' "' + t + '"' : '') + ' → ' + Math.round(r.left) + '..' + Math.round(r.right))
      }
      if (r.bottom > window.innerHeight + 2 && el.closest('[role="dialog"]')) {
        salida.push('EN UN MODAL, algo se pasa de alto: ' + el.tagName.toLowerCase() + ' hasta ' + Math.round(r.bottom))
      }
    }
    return [...new Set(salida)].slice(0, 12)
  })()`)

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

/** Estampa el tema como lo hace la app, y espera a que repinte. */
const ponerTema = async (tema) => {
  await evaluar(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(tema)})`)
  await sleep(300)
}

/**
 * Mide el contraste real de cada texto contra el fondo que efectivamente tiene.
 *
 * ---------------------------------------------------------------------------
 * Por qué esto y no mirar las capturas
 * ---------------------------------------------------------------------------
 *
 * El token más usado de la app es `--color-ink-faint`: unas ochenta veces, y su
 * trabajo es ser un gris que se lee sin gritar. Un gris así, mal elegido, no se
 * ve mal en una captura — se ve "sutil". Recién se nota cuando alguien lo tiene
 * que leer en una pantalla peor que la del que lo eligió. El número no perdona y
 * la vista sí.
 *
 * ── Lo que hace bien y que una sonda ingenua hace mal ──
 *
 * El fondo NO es `backgroundColor` del elemento: casi todos los textos están
 * sobre un elemento transparente. Se sube por los ancestros COMPONIENDO cada
 * capa semitransparente hasta llegar a una opaca. Sin eso, un chip con fondo
 * `bg-warn/10` se mediría contra el color del panel de abajo y daría un número
 * que no es el que ve nadie.
 *
 * El umbral es 4,5:1, y 3:1 para texto grande, que es lo que pide WCAG AA.
 */
const contraste = () =>
  evaluar(`(() => {
    /*
     * Resolver un color CSS a RGB: se pinta y se lee el píxel.
     *
     * Parece rebuscado y es lo único que funciona. Tailwind v4 escribe los
     * fondos con alfa como \`color-mix(in oklab, var(--color-good) 10%,
     * transparent)\`, y \`getComputedStyle\` devuelve eso —y los \`text-*​/70\`—
     * como \`oklab(0.64 -0.02 -0.001 / 0.7)\`. Dos intentos anteriores de leer
     * esa cadena a mano fallaron: el primero tomaba los canales de 0 a 1 como si
     * fueran de 0 a 255 y el segundo se comía los signos negativos. Los dos
     * reportaban 1,13:1 sobre texto que en realidad tiene 4,9:1, o sea mandaban
     * a arreglar colores que estaban bien.
     *
     * Pintar y leer el píxel delega la conversión de espacios de color al mismo
     * motor que va a dibujar la app. No hay cadena que parsear ni espacio de
     * color que soportar: lo que devuelve es, exactamente, lo que el usuario ve.
     */
    const cv = document.createElement("canvas")
    cv.width = 1
    cv.height = 1
    const ctx = cv.getContext("2d", { willReadFrequently: true })
    const color = (c) => {
      if (!c || c === "transparent" || c === "none") return null
      try {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = "#000000"
        ctx.fillStyle = c
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
      } catch (e) {
        return null
      }
    }
    const sobre = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1
    })
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
    const ratio = (a, b) => {
      const la = lum(a), lb = lum(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }

    /* El fondo efectivo: se apilan las capas semitransparentes de abajo hacia
       arriba hasta dar con una opaca. */
    const fondoDe = (el) => {
      const capas = []
      for (let n = el; n; n = n.parentElement) {
        const c = color(getComputedStyle(n).backgroundColor)
        if (c && c.a > 0.001) {
          capas.push(c)
          if (c.a >= 0.999) break
        }
      }
      let base = { r: 255, g: 255, b: 255, a: 1 }
      for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base)
      return base
    }

    const malos = []
    for (const el of document.querySelectorAll('*')) {
      const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
      if (!propio) continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      const s = getComputedStyle(el)
      if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.15) continue

      const tinta = color(s.color)
      if (!tinta) continue
      const fondo = fondoDe(el)
      const efectiva = tinta.a < 0.999 ? sobre(tinta, fondo) : tinta
      const px = parseFloat(s.fontSize)
      const peso = Number(s.fontWeight) || 400
      const grande = px >= 24 || (px >= 18.66 && peso >= 700)
      const minimo = grande ? 3 : 4.5
      const v = ratio(efectiva, fondo)
      if (v < minimo) {
        malos.push({
          texto: (el.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 48),
          ratio: Math.round(v * 100) / 100,
          minimo,
          px: Math.round(px),
          /* La tinta YA COMPUESTA sobre su fondo, no la declarada. Es lo que se
             ve, y es el número contra el que hay que elegir el color nuevo. */
          tinta: 'rgb(' + [efectiva.r, efectiva.g, efectiva.b].map(Math.round).join(',') + ')',
          fondo: 'rgb(' + [fondo.r, fondo.g, fondo.b].map(Math.round).join(',') + ')'
        })
      }
    }
    const vistos = new Set()
    return malos
      .filter((m) => { const k = m.texto + m.ratio; if (vistos.has(k)) return false; vistos.add(k); return true })
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 10)
  })()`)

async function recorrer(tamano, tema = 'oscuro') {
  console.log(`\n── ${tamano.nombre} (${tamano.ancho}×${tamano.alto}) · tema ${tema} ──`)
  await ponerTema(tema)
  await send('Emulation.setDeviceMetricsOverride', {
    width: tamano.ancho,
    height: tamano.alto,
    deviceScaleFactor: 1,
    mobile: false
  })
  await sleep(500)

  const p = (n) => `${tema === 'claro' ? 'claro-' : ''}${tamano.nombre}-${n}`
  const problemas = []
  const flojos = []

  const revisar = async (donde) => {
    const d = await desbordes()
    if (Array.isArray(d) && d.length > 0) problemas.push([`${tema} · ${donde}`, d])
    const c = await contraste()
    if (Array.isArray(c) && c.length > 0) flojos.push([`${tema} · ${donde}`, c])
  }

  await clic('Biblioteca')
  await sleep(400)
  await captura(p('01-biblioteca'))
  await revisar('biblioteca')

  // Con la unidad elegida, que es donde se ven las tarjetas y los filtros.
  await clic('Unidad 1')
  await sleep(500)
  await captura(p('02-unidad'))
  await revisar('unidad con tarjetas')

  // El editor de tarjeta es un modal: el caso donde el alto importa.
  await evaluar(`(() => {
    const el = [...document.querySelectorAll('button')].find(x => (x.getAttribute('title') ?? '') === 'Editar la tarjeta')
    if (!el) return false
    el.click(); return true
  })()`)
  await sleep(500)
  await captura(p('03-editor'))
  await revisar('editor de tarjeta')
  await evaluar('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))')
  await sleep(300)

  await clic('Generar')
  await sleep(600)
  /* La primera vez aparece el aviso de la generación con IA. Se captura y se mide
     en los DOS temas acá mismo —después de aceptarlo no vuelve—, y se acepta. */
  if (await evaluar(`document.body.innerText.includes('Antes de generar tarjetas con IA')`)) {
    await captura(p('04a-aviso-generar'))
    await revisar('aviso de generar')
    const otro = tema === 'claro' ? 'oscuro' : 'claro'
    await ponerTema(otro)
    await captura(`${otro === 'claro' ? 'claro-' : ''}${tamano.nombre}-04a-aviso-generar`)
    const antes = flojos.length
    await revisar('aviso de generar')
    for (const f of flojos.slice(antes)) f[0] = f[0].replace(tema, otro)
    await ponerTema(tema)
    await evaluar(`document.querySelector('[role="dialog"] input[type="checkbox"]')?.click()`)
    await sleep(250)
    await clic('Continuar')
    await sleep(600)
  }
  await captura(p('04-generar'))
  await revisar('generar')

  await clic('Estudiar')
  await sleep(500)
  await clic('Estudiar todo')
  await sleep(800)
  await captura(p('05-estudiar-frente'))
  await revisar('estudiar')
  await clic('Mostrar resultado')
  await sleep(400)
  await captura(p('06-estudiar-dorso'))
  await revisar('estudiar revelado')
  await clic('Terminar')
  await sleep(600)
  await captura(p('07-cierre'))

  await clic('Progreso')
  await sleep(600)
  await captura(p('08-progreso'))
  await revisar('progreso')

  await clic('Modelos')
  await sleep(700)
  await captura(p('09-modelos'))
  await revisar('modelos')
  await clic('Cerrar')
  await sleep(300)

  return { problemas, flojos }
}

async function main() {
  if (!existsSync(join(ROOT, 'out', 'main', 'index.js'))) {
    console.error('Falta compilar. Corré `npm run build` antes.')
    process.exit(1)
  }

  const tmp = mkdtempSync(join(tmpdir(), 'flashcards-vista-'))
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: tmp }
  delete env.ELECTRON_RUN_AS_NODE

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

  /* --------- material de prueba: hace falta algo que mirar --------- */

  console.log('Preparando material de prueba…')
  await captura('00-bienvenida')
  await clic('Siguiente')
  await sleep(300)
  await captura('00b-bienvenida-2')
  await clic('Siguiente')
  await sleep(300)
  await captura('00c-bienvenida-3')
  await clic('Siguiente')
  await sleep(300)
  // El paso que hay que aceptar. Se captura SIN marcar, que es como lo ve el
  // comprador al llegar: con el botón apagado y el motivo escrito abajo.
  await captura('00d-bienvenida-aviso')
  await evaluar(`(() => {
    const c = document.querySelector('[role="dialog"] input[type="checkbox"]')
    if (!c) return false
    c.click(); return true
  })()`)
  await sleep(250)
  await clic('Entendido')
  await sleep(500)
  await captura('00e-primera-vez')

  /* El enlace "creá una materia vacía" sólo existe con la biblioteca vacía, y la
     app arranca con los mazos de regalo: el clic no encontraba nada y el paso
     seguía sin abrir el formulario. Si el enlace no está, se usa el "+". */
  if (!(await clic('creá una materia vacía'))) {
    await evaluar(`(() => {
      const el = [...document.querySelectorAll('button')].find(x => x.getAttribute('title') === 'Nueva materia')
      if (el) el.click()
    })()`)
  }
  await sleep(300)
  await escribir('Nombre de la materia', 'Clínica de Adultos')
  await sleep(200)
  // Con el formulario abierto: los botones Cancelar y Crear viven en la columna
  // angosta del árbol, justo donde un botón de más desborda sin avisar.
  await captura('00f-materia-nueva')
  await enter('Nombre de la materia')
  await sleep(700)

  await clic('Nueva unidad')
  await sleep(300)
  await escribir('Nombre de la unidad', 'Unidad 1 — Entrevista de admisión')
  await enter('Nombre de la unidad')
  await sleep(700)

  const TARJETAS = [
    ['¿Qué se busca establecer en la primera entrevista?', 'El motivo de consulta, la demanda del paciente y una evaluación del riesgo. Es lo que orienta todo lo que sigue.'],
    ['¿Qué diferencia hay entre motivo de consulta y demanda?', 'El motivo es lo que la persona dice que le pasa; la demanda es lo que espera del tratamiento. No siempre coinciden.'],
    ['¿Qué textos marcó la cátedra como obligatorios para el primer parcial?', 'Los dos capítulos de Fernández Álvarez y la ficha de entrevista.'],
    ['Encuadre', 'El conjunto de constantes del tratamiento —frecuencia, duración, honorarios, lugar— que se acuerdan al inicio y sostienen el trabajo.']
  ]
  for (const [frente, dorso] of TARJETAS) {
    await clic('Nueva tarjeta')
    if (await clic('Escribir una tarjeta')) await sleep(200)
    await sleep(400)
    await escribir('Frente de la tarjeta', frente)
    await escribir('Dorso de la tarjeta', dorso)
    await sleep(200)
    await clic('Guardar')
    await sleep(600)
  }

  const todos = []
  const contrastes = []
  for (const t of TAMANOS) {
    const r = await recorrer(t, 'oscuro')
    todos.push(...r.problemas)
    contrastes.push(...r.flojos)
  }
  // El tema claro, en un solo tamaño. Ver el comentario de TEMAS.
  {
    const r = await recorrer(TAMANOS[1], TEMAS[1])
    todos.push(...r.problemas)
    contrastes.push(...r.flojos)
  }
  await ponerTema(TEMAS[0])

  console.log(`\n${capturas.length} capturas en ${SHOTS}`)

  if (todos.length > 0) {
    console.log('\n⚠  DESBORDES DETECTADOS:')
    for (const [donde, lista] of todos) {
      console.log(`\n   en ${donde}:`)
      for (const l of lista) console.log(`      · ${l}`)
    }
  } else {
    console.log('\n✓ Nada se sale de la ventana en ninguno de los dos tamaños.')
  }

  /*
   * El contraste SÍ afirma.
   *
   * El resto de este arnés es material para mirar; esto es una medición, y por
   * eso es lo único que hace fallar la corrida. Un tema nuevo con un gris mal
   * elegido no se ve mal en una captura: se ve sutil. El número no perdona.
   */
  if (contrastes.length > 0) {
    console.log('\n❌ CONTRASTE POR DEBAJO DE WCAG AA:')
    for (const [donde, lista] of contrastes) {
      console.log(`\n   en ${donde}:`)
      for (const m of lista) {
        console.log(`      · ${m.ratio}:1 (mínimo ${m.minimo}) — ${m.px}px ${m.tinta} sobre ${m.fondo}`)
        console.log(`        "${m.texto}"`)
      }
    }
    fallo = true
  } else {
    console.log('✓ Todo el texto pasa 4,5:1 (3:1 el grande) en los dos temas.')
  }

  console.log('\nQué mirar en cada captura:')
  console.log('  · nada cortado ni desbordado, en los dos tamaños')
  console.log('  · el texto tenue se lee (contraste)')
  console.log('  · los controles alineados entre sí')
  console.log('  · ningún texto en inglés, voseo consistente')
  console.log('  · los estados vacíos explican qué hacer, no sólo que está vacío')

  try {
    ws.close()
  } catch {
    /* ya estaba cerrado */
  }
  app.kill()
  matarSobrantes('electron.exe')
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch {
    /* la deja el sistema */
  }

  if (fallo) process.exitCode = 1
}

main().catch((err) => {
  console.error('El arnés falló:', err)
  matarSobrantes('electron.exe')
  process.exit(1)
})
