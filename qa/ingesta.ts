import { app } from 'electron'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'

/**
 * Arnés de ingesta: los cuatro formatos de apunte.
 *
 * Los archivos de prueba se FABRICAN acá en vez de vivir en el repositorio. Son
 * de kilobytes y armarlos es determinista, así que guardarlos sería sumar binarios
 * al árbol para no ganar nada — y además obligaría a explicar de dónde salieron y
 * bajo qué licencia.
 */

const raiz = mkdtempSync(join(tmpdir(), 'flashcards-qa-'))
app.setPath('userData', raiz)

/* eslint-disable @typescript-eslint/no-var-requires */
const ingest = require('../src/main/services/ingest') as typeof import('../src/main/services/ingest')
const { chunkText, toParagraphs } = require('../src/main/services/core/chunker') as typeof import('../src/main/services/core/chunker')
const { logger } = require('../src/main/services/core/logger') as typeof import('../src/main/services/core/logger')

let fallas = 0
let pruebas = 0

function ok(condicion: boolean, que: string, detalle = ''): void {
  pruebas++
  if (condicion) console.log(`  ✓ ${que}`)
  else {
    fallas++
    console.error(`  ✗ ${que}${detalle ? ` — ${detalle}` : ''}`)
  }
}

const seccion = (t: string): void => console.log(`\n${t}`)

const CUERPO = [
  'La prescripción adquisitiva es el modo de adquirir el dominio de una cosa por la posesión continuada durante el tiempo que fija la ley.',
  'Requiere posesión ostensible y continua. La buena fe y el justo título reducen el plazo a diez años en el caso de inmuebles.',
  'El plazo ordinario para inmuebles es de veinte años cuando falta el justo título, y corre desde que se inició la posesión.'
]

/* ------------------------------- fabricantes ------------------------------ */

function hacerDocx(destino: string, parrafos: string[]): void {
  const escapar = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cuerpo = parrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapar(p)}</w:t></w:r></w:p>`).join('')

  const archivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '</Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>'
    ),
    'word/document.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        `<w:body>${cuerpo}</w:body></w:document>`
    )
  }
  writeFileSync(destino, Buffer.from(zipSync(archivos)))
}

function hacerPptx(destino: string, filminas: string[][]): void {
  const archivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '</Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
    )
  }

  filminas.forEach((bloques, i) => {
    const parrafos = bloques
      .map((b) => `<a:p><a:r><a:t>${b.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a:t></a:r></a:p>`)
      .join('')
    archivos[`ppt/slides/slide${i + 1}.xml`] = strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
        `<p:cSld><p:spTree><p:sp><p:txBody>${parrafos}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`
    )
  })

  writeFileSync(destino, Buffer.from(zipSync(archivos)))
}

/**
 * Un PDF mínimo pero válido, con los offsets de la xref bien calculados.
 *
 * `conTexto: false` produce una página sin ningún operador de texto, que es lo que
 * se ve en un escaneo: el PDF existe, tiene páginas, y no hay una sola letra
 * extraíble.
 */
function hacerPdf(destino: string, paginas: string[][], conTexto = true): void {
  const objetos: string[] = []
  const total = paginas.length

  const idsPagina = paginas.map((_, i) => 3 + i * 2)
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>')
  objetos.push(`<< /Type /Pages /Kids [${idsPagina.map((id) => `${id} 0 R`).join(' ')}] /Count ${total} >>`)

  paginas.forEach((renglones, i) => {
    const idPagina = 3 + i * 2
    const idContenido = idPagina + 1
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${idContenido} 0 R ` +
        `/Resources << /Font << /F1 ${3 + total * 2} 0 R >> >> >>`
    )

    const cuerpo = conTexto
      ? `BT /F1 11 Tf 14 TL 72 720 Td ${renglones
          .map((r) => `(${r.replace(/([()\\])/g, '\\$1')}) Tj T*`)
          .join(' ')} ET`
      : '' // Página en blanco: el caso del escaneo.
    objetos.push(`<< /Length ${cuerpo.length} >>\nstream\n${cuerpo}\nendstream`)
  })

  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objetos.forEach((cuerpo, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })

  const inicioXref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`

  writeFileSync(destino, Buffer.from(pdf, 'latin1'))
}

/* ---------------------------------- pruebas -------------------------------- */

async function correr(): Promise<void> {
  logger.init(join(raiz, 'logs'))
  const dir = join(raiz, 'apuntes')
  mkdirSync(dir, { recursive: true })

  /* -------------------------------- texto ---------------------------------- */

  seccion('Texto plano')

  const txt = join(dir, 'apunte.txt')
  writeFileSync(txt, CUERPO.join('\n\n'), 'utf8')
  const rTxt = await ingest.extractDocument(txt)
  ok(rTxt.texto.includes('prescripción adquisitiva'), 'lee un .txt en UTF-8 con acentos')
  ok(rTxt.palabras > 50, 'cuenta las palabras', String(rTxt.palabras))
  ok(rTxt.aviso === undefined, 'y no dispara ningún aviso')

  // El Bloc de notas de Windows guarda "Unicode" como UTF-16 LE con BOM. Leído
  // como UTF-8 saldría un nulo entre cada letra, sin que nada falle.
  const utf16 = join(dir, 'apunte-utf16.txt')
  writeFileSync(utf16, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(CUERPO.join('\n\n'), 'utf16le')]))
  const rUtf16 = await ingest.extractDocument(utf16)
  ok(rUtf16.texto.includes('prescripción adquisitiva'), 'lee un .txt guardado en UTF-16 desde el Bloc de notas')
  // Si se hubiera leído como UTF-8, cada letra vendría seguida de un byte nulo.
  ok(!rUtf16.texto.includes(String.fromCharCode(0)), 'sin caracteres nulos de por medio')

  const pegado = ingest.fromPastedText(CUERPO.join('\n\n'))
  ok(pegado.nombre === 'Texto pegado' && pegado.palabras > 50, 'el texto pegado a mano entra tal cual')

  let cortoRechazado = false
  try {
    ingest.fromPastedText('Muy poco.')
  } catch {
    cortoRechazado = true
  }
  ok(cortoRechazado, 'y un texto demasiado corto se rechaza con un mensaje')

  /* --------------------------------- word ---------------------------------- */

  seccion('Word')

  const docx = join(dir, 'apunte.docx')
  hacerDocx(docx, CUERPO)
  const rDocx = await ingest.extractDocument(docx)
  ok(rDocx.texto.includes('posesión continuada'), 'lee un .docx')
  ok(rDocx.texto.split('\n\n').length === CUERPO.length, 'y respeta los párrafos', String(rDocx.texto.split('\n\n').length))

  const falsoDocx = join(dir, 'viejo.docx')
  writeFileSync(falsoDocx, Buffer.from('\xd0\xcf\x11\xe0 esto es un .doc binario del Word 97', 'latin1'))
  let mensajeDoc = ''
  try {
    await ingest.extractDocument(falsoDocx)
  } catch (err) {
    mensajeDoc = err instanceof Error ? err.message : ''
  }
  ok(mensajeDoc.includes('.doc'), 'un .doc viejo renombrado da un mensaje que explica cómo convertirlo', mensajeDoc.slice(0, 60))

  /* ------------------------------ powerpoint -------------------------------- */

  seccion('PowerPoint')

  const pptx = join(dir, 'clase.pptx')
  hacerPptx(pptx, [
    ['Prescripción adquisitiva', 'Modo de adquirir el dominio', 'Por posesión continuada en el tiempo que fija la ley'],
    ['Requisitos', 'Posesión ostensible y continua', 'Buena fe y justo título reducen el plazo a diez años'],
    ['Plazos', 'Ordinario: veinte años para inmuebles', 'Corre desde que se inició la posesión efectiva']
  ])
  const rPptx = await ingest.extractDocument(pptx)
  ok(rPptx.texto.includes('Prescripción adquisitiva'), 'lee un .pptx')
  ok(rPptx.texto.includes(' · '), 'une las viñetas de cada filmina en un solo bloque')
  ok(rPptx.texto.split('\n\n').length === 3, 'un párrafo por filmina', String(rPptx.texto.split('\n\n').length))

  const flojo = join(dir, 'floja.pptx')
  hacerPptx(flojo, Array.from({ length: 12 }, (_, i) => [`Título ${i}`, 'Idea suelta']))
  const rFlojo = await ingest.extractDocument(flojo)
  ok(rFlojo.aviso !== undefined && rFlojo.aviso.includes('poco texto'), 'avisa cuando las filminas tienen muy poco texto')

  /* ---------------------------------- pdf ----------------------------------- */

  seccion('PDF')

  const pdf = join(dir, 'apunte.pdf')
  hacerPdf(pdf, [
    ['La prescripcion adquisitiva es el modo de adquirir el dominio', 'de una cosa por la posesion continuada durante el', 'tiempo que fija la ley.'],
    ['Requiere posesion ostensible y continua. La buena fe y el', 'justo titulo reducen el plazo a diez anios en el caso', 'de los inmuebles.']
  ])
  const rPdf = await ingest.extractDocument(pdf)
  ok(rPdf.texto.includes('prescripcion adquisitiva'), 'lee un PDF de texto')
  ok(rPdf.texto.includes('posesion continuada'), 'y une los renglones de un mismo párrafo')

  const escaneado = join(dir, 'escaneado.pdf')
  hacerPdf(escaneado, [[], [], [], []], false)
  let mensajeEscaneo = ''
  try {
    await ingest.extractDocument(escaneado)
  } catch (err) {
    mensajeEscaneo = err instanceof Error ? err.message : ''
  }
  ok(mensajeEscaneo.includes('imágenes'), 'un PDF escaneado se detecta y se explica', mensajeEscaneo.slice(0, 70))
  ok(mensajeEscaneo.includes('pegal'), 'y el mensaje ofrece la salida concreta')

  /* -------------------------------- errores --------------------------------- */

  seccion('Casos que tienen que fallar bien')

  const raro = join(dir, 'planilla.xlsx')
  writeFileSync(raro, 'lo que sea')
  let mensajeRaro = ''
  try {
    await ingest.extractDocument(raro)
  } catch (err) {
    mensajeRaro = err instanceof Error ? err.message : ''
  }
  ok(mensajeRaro.includes('xlsx') && mensajeRaro.includes('PDF'), 'un formato no soportado dice cuáles sí lo son')

  let mensajeFalta = ''
  try {
    await ingest.extractDocument(join(dir, 'no-existe.pdf'))
  } catch (err) {
    mensajeFalta = err instanceof Error ? err.message : ''
  }
  ok(mensajeFalta.includes('No se encontró'), 'un archivo inexistente da un mensaje claro')

  /* -------------------------------- troceado -------------------------------- */

  seccion('El troceado del texto')

  const largo = Array.from({ length: 200 }, (_, i) => `${CUERPO[i % 3]} Este es el párrafo número ${i}.`).join('\n\n')
  const bloques = chunkText(largo)
  ok(bloques.length >= 3, 'un texto largo se parte en varios bloques', `${bloques.length} bloques`)
  ok(
    bloques.every((b) => b.text.length < 12000),
    'ningún bloque se pasa del contexto del modelo'
  )
  ok(bloques[0].text.includes(bloques[0].paragraphs[0]), 'el texto del bloque son sus párrafos')

  const solapan = bloques.length > 1 && bloques[1].paragraphs.some((p) => bloques[0].paragraphs.includes(p))
  ok(solapan, 'los bloques se solapan, así una idea partida aparece entera en alguno')

  const conGuion = toParagraphs('El derecho de posesión se consti-\ntución ejerce de forma continua sobre la cosa poseída.')
  ok(!conGuion[0].includes('consti tución'), 'una palabra cortada a fin de renglón se reconstruye', conGuion[0].slice(0, 50))

  const conBasura = toParagraphs('Un párrafo con contenido de verdad que sirve.\n\n42\n\nOtro párrafo con contenido real.')
  ok(conBasura.length === 2, 'un número de página suelto se descarta', `quedaron ${conBasura.length}`)

  /* ---------------------------------- final ---------------------------------- */

  console.log(`\n${fallas === 0 ? '✅' : '❌'} ${pruebas - fallas}/${pruebas} comprobaciones pasaron.`)
  app.exit(fallas === 0 ? 0 : 1)
}

app.whenReady().then(
  () => {
    correr().catch((err) => {
      console.error('El arnés falló:', err)
      app.exit(1)
    })
  },
  (err) => {
    console.error('El arnés no pudo arrancar:', err)
    app.exit(1)
  }
)
