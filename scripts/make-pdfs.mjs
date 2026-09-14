/**
 * Imprime las guías del comprador a PDF.
 *
 *   npm run make:pdfs
 *
 * ---------------------------------------------------------------------------
 * Por qué se imprime con Electron y no con una librería de PDF
 * ---------------------------------------------------------------------------
 *
 * Porque Electron ya está instalado y trae Chromium, que es el mejor motor de
 * maquetación que hay. Una librería de PDF significaría una dependencia nueva y
 * volver a escribir a mano el salto de página, la viuda, la huérfana y el corte
 * de una tabla — cosas que el navegador resuelve solo y bien.
 *
 * `preferCSSPageSize` hace que mande el `@page` de la hoja de estilos, así el
 * tamaño y los márgenes se deciden en un solo lugar, junto al resto del diseño.
 *
 * ---------------------------------------------------------------------------
 * Qué NO se imprime
 * ---------------------------------------------------------------------------
 *
 * La licencia de uso, el anexo de requisitos y funciones y las licencias de
 * terceros. Los tres siguen siendo .txt y no pasan por acá: son documentos
 * contractuales, su texto está acordado y su formato también.
 *
 * Tampoco los cuatro apuntes de arranque. Ésos existen para que el comprador
 * los COPIE Y PEGUE en la app, y la app misma explica que pegar el texto da
 * mejores resultados que sacarlo de un PDF. Convertirlos a PDF sería fabricar
 * justo el problema que el producto le pide evitar.
 */
import { app, BrowserWindow } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { guiaATexto, guiaInicio, guiaAyuda } from './lib/guias.mjs'
import { guiaMetodo, guiaRecetario } from './lib/guias-estudio.mjs'
import { guiaAHtml } from './lib/guias-html.mjs'
import { APP_NAME, HAY_BONUS, HAY_MAPA_GRUPOS, driveFiles } from './lib/user-docs.mjs'
import { bonusParejas } from './lib/bonus-doc-parejas.mjs'
import { bonusAutores } from './lib/bonus-doc-autores.mjs'
import { bonusMapaGrupos } from './lib/bonus-doc-mapa-grupos.mjs'
import { examenPreguntas, examenRespuestas } from './lib/bonus-doc-examenes.mjs'
import { EXAMENES } from './lib/examenes/index.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const VERSION = PKG.version

/** Dónde quedan los PDF ya impresos, para que la entrega sólo los copie. */
const SALIDA = join(ROOT, 'recursos-docs')

/** Los bonus, aparte de las guías de uso. Y los simulacros, aparte de los otros dos. */
const BONUS = 'Bonus'
const SIMULACROS = join(BONUS, 'Simulacros de final')

/*
 * El nombre de la materia, apto para un nombre de archivo.
 *
 * En Windows los dos puntos y la barra son ilegales, y la raya larga de
 * "Psicoanálisis I — Freud" sobrevive pero se copia mal por algunos canales.
 * Se recorta acá y no en el título del documento: adentro del PDF el nombre va
 * completo y como corresponde.
 */
const limpio = (s) => s.replace(/\s*—\s*/g, ' - ').replace(/[\\/:*?"<>|]/g, '')

const logoDataUri = () => {
  try {
    return `data:image/png;base64,${readFileSync(join(ROOT, 'build', 'icon.png')).toString('base64')}`
  } catch {
    // Sin ícono el PDF sale igual, apenas sin el logo de la portada. No vale la
    // pena cortar una entrega por eso; `npm run make:icon` lo genera.
    console.warn('[pdf] No encontré build/icon.png; las portadas van sin logo.')
    return ''
  }
}

/**
 * Los documentos a imprimir, con el nombre que llevan en la carpeta del
 * comprador.
 *
 * El nombre sale de `driveFiles()` para los dos que ya estaban numerados en la
 * entrega, así el número no queda escrito dos veces en dos archivos distintos.
 */
function documentos() {
  const win = driveFiles({ hasWindows: true, hasMac: false })
  const mac = driveFiles({ hasWindows: false, hasMac: true })

  return [
    {
      clave: 'inicio-win',
      archivo: win.readme.replace(/\.txt$/, '.pdf'),
      doc: guiaInicio({ version: VERSION, names: win, hasWindows: true, hasMac: false })
    },
    {
      clave: 'ayuda-win',
      archivo: win.help.replace(/\.txt$/, '.pdf'),
      doc: guiaAyuda({ version: VERSION, names: win, hasWindows: true, hasMac: false })
    },
    {
      clave: 'inicio-mac',
      archivo: `mac — ${mac.readme.replace(/\.txt$/, '.pdf')}`,
      doc: guiaInicio({ version: VERSION, names: mac, hasWindows: false, hasMac: true })
    },
    {
      clave: 'ayuda-mac',
      archivo: `mac — ${mac.help.replace(/\.txt$/, '.pdf')}`,
      doc: guiaAyuda({ version: VERSION, names: mac, hasWindows: false, hasMac: true })
    },
    { clave: 'metodo', archivo: win.metodo, doc: guiaMetodo() },
    { clave: 'recetario', archivo: win.recetario, doc: guiaRecetario() },

    /*
     * El único bonus real, suelto junto a las guías y no en la subcarpeta:
     * son un solo PDF y viaja siempre, así que no necesita esconderse detrás
     * de "Bonus/". Ver HAY_MAPA_GRUPOS en user-docs.mjs.
     */
    ...(HAY_MAPA_GRUPOS ? [{ clave: 'mapaGrupos', archivo: win.mapaGrupos, doc: bonusMapaGrupos() }] : []),

    /*
     * Los tres bonus.
     *
     * Van en su propia subcarpeta y no sueltos junto a las guías: son 30
     * archivos, y mezclados con los seis documentos de uso convertirían la
     * carpeta del comprador en una lista donde no se encuentra el instructivo
     * de instalación, que es lo primero que necesita.
     */
    /*
     * Los tres bonus se imprimen sólo si viajan.
     *
     * Con `HAY_BONUS` en false los generadores que hay son los de Psicoflashy, y
     * dejar 30 PDF sobre Freud y las catorce materias de Psicología dentro de
     * `recursos-docs/Bonus/` de un producto de Farmacología es fabricar la
     * trampa: el día que alguien encienda la copia del bonus sin mirar, se van
     * derecho a la carpeta del comprador.
     */
    ...(HAY_BONUS
      ? [
          { clave: 'parejas', archivo: join(BONUS, 'Las parejas que se confunden.pdf'), doc: bonusParejas() },
          { clave: 'autores', archivo: join(BONUS, 'El mapa de autores.pdf'), doc: bonusAutores() }
        ]
      : []),

    /*
     * Y los 28 de los simulacros: dos por materia.
     *
     * El número al principio del nombre es el mismo para la pareja de archivos,
     * así quedan uno al lado del otro al ordenar la carpeta por nombre. Y las
     * preguntas van antes que las respuestas en el orden alfabético
     * ("Preguntas" < "Respuestas"), que es justo el orden en que se usan.
     */
    ...(HAY_BONUS ? EXAMENES : []).flatMap((ex, i) => {
      const n = String(i + 1).padStart(2, '0')
      return [
        {
          clave: `examen-${n}`,
          archivo: join(SIMULACROS, `${n}. Preguntas — ${limpio(ex.materia)}.pdf`),
          doc: examenPreguntas(ex, i + 1)
        },
        {
          clave: `respuestas-${n}`,
          archivo: join(SIMULACROS, `${n}. Respuestas — ${limpio(ex.materia)}.pdf`),
          doc: examenRespuestas(ex, i + 1)
        }
      ]
    })
  ]
}

const PIE = `
<div style="width:100%;font-family:'Segoe UI',sans-serif;font-size:7pt;color:#64807B;
            padding:0 16mm;display:flex;justify-content:space-between;align-items:center;">
  <span>${APP_NAME} ${VERSION}</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`

async function imprimir(ventana, html, destino) {
  const casa = mkdtempSync(join(tmpdir(), `${APP_NAME.toLowerCase()}-pdf-`))
  const fuente = join(casa, 'doc.html')
  writeFileSync(fuente, html, 'utf8')

  await ventana.loadFile(fuente)
  // Un respiro para que termine de aplicar la hoja de estilos: sin esto, el
  // primer documento sale a veces con la tipografía por defecto.
  await new Promise((r) => setTimeout(r, 250))

  const pdf = await ventana.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: PIE,
    generateTaggedPDF: true
  })

  writeFileSync(destino, pdf)
  rmSync(casa, { recursive: true, force: true })
  return pdf.length
}

async function main() {
  mkdirSync(SALIDA, { recursive: true })

  const ventana = new BrowserWindow({
    show: false,
    width: 1000,
    height: 1400,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })

  const logo = logoDataUri()
  const docs = documentos()
  let total = 0

  for (const d of docs) {
    const html = guiaAHtml(d.doc, { logo, version: VERSION })
    const destino = join(SALIDA, d.archivo)
    // Los bonus viven en subcarpetas, así que la carpeta de destino puede no
    // existir todavía. `printToPDF` no la crea y el escribir fallaría al final
    // de un trabajo largo, después de haber impreso todo lo anterior.
    mkdirSync(dirname(destino), { recursive: true })
    const bytes = await imprimir(ventana, html, destino)
    total += bytes
    console.log(`[pdf] ${d.archivo}  —  ${(bytes / 1024).toFixed(0)} KB`)

    /*
     * Un PDF de menos de 12 KB es una hoja en blanco.
     *
     * Es exactamente lo que devuelve `printToPDF` cuando la página no cargó: no
     * tira error, devuelve un PDF válido y vacío. Sin este control, la entrega
     * se armaría con seis documentos en blanco y el error se vería recién del
     * lado del comprador.
     */
    if (bytes < 12 * 1024) {
      console.error(`[pdf] "${d.archivo}" pesa ${bytes} bytes: casi seguro salió en blanco.`)
      app.exit(1)
      return
    }
  }

  /* Y los .txt, del MISMO contenido, para la copia que va adentro del programa. */
  const txt = [
    { archivo: '5. Cómo estudiar con repaso espaciado.txt', doc: guiaMetodo() },
    { archivo: '6. Recetario de instrucciones.txt', doc: guiaRecetario() }
  ]
  const BOM = String.fromCharCode(0xfeff)
  for (const t of txt) {
    const cuerpo = BOM + guiaATexto(t.doc).replace(/\r?\n/g, '\r\n')
    writeFileSync(join(SALIDA, t.archivo), cuerpo, 'utf8')
    console.log(`[pdf] ${t.archivo}  —  ${(Buffer.byteLength(cuerpo) / 1024).toFixed(0)} KB  (texto)`)
  }

  console.log(`[pdf] ${docs.length} PDF y ${txt.length} .txt en ${SALIDA}  (${(total / 1024 / 1024).toFixed(1)} MB)`)
  app.exit(0)
}

app.whenReady().then(main, (err) => {
  console.error('[pdf] No se pudo arrancar:', err)
  app.exit(1)
})
