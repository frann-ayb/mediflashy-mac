#!/usr/bin/env node
/**
 * Genera `build/icon.png` (1024x1024) sin dependencias externas.
 * electron-builder deriva de ahí el .ico de Windows y el .icns de macOS.
 *
 * El dibujo es un cuadrado redondeado con degradado violeta y DOS TARJETAS
 * apiladas en blanco, una detrás de la otra. Se calcula la cobertura de cada
 * píxel con 3x3 muestras para que los bordes queden suaves.
 *
 * Convertexto usa este mismo script con una onda de audio. Acá el glifo cambia
 * porque el ícono es lo primero que el usuario ve en el escritorio y en la barra
 * de tareas, y las dos apps van a estar instaladas en la misma computadora: si
 * comparten el dibujo, el comprador abre la equivocada todos los días.
 *
 * El fondo SÍ se mantiene igual —el mismo violeta— y es a propósito: son productos
 * de la misma casa, y que se reconozca la familia vale más que la diferenciación
 * total. La forma distingue; el color emparenta.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'build', 'icon.png')

const SAMPLES = 3
const CORNER_RADIUS = SIZE * 0.225

/**
 * Las dos tarjetas, en fracciones del lienzo: [x, y, ancho, alto].
 *
 * La de atrás asoma arriba y a la izquierda, corrida lo justo para que se lea como
 * un mazo y no como un rectángulo con un borde raro. A 32 px —el tamaño real en la
 * barra de tareas— un desplazamiento más chico se convierte en una línea sucia y
 * uno más grande hace que parezcan dos objetos separados.
 */
const TARJETAS = [
  { x: 0.215, y: 0.185, w: 0.5, h: 0.62 },
  { x: 0.3, y: 0.255, w: 0.5, h: 0.62 }
]
const TARJETA_RADIO = SIZE * 0.045

/**
 * Separación entre las dos tarjetas: la de adelante se recorta contra el fondo
 * dejando este hueco alrededor de la de atrás. Sin esto las dos formas blancas se
 * funden en una sola mancha y se pierde la idea de mazo.
 */
const SEPARACION = SIZE * 0.022

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function insideBackground(x, y) {
  return insideRoundedRect(x, y, 0, 0, SIZE, SIZE, CORNER_RADIUS)
}

const caja = (t, margen = 0) => ({
  left: t.x * SIZE - margen,
  top: t.y * SIZE - margen,
  right: (t.x + t.w) * SIZE + margen,
  bottom: (t.y + t.h) * SIZE + margen
})

const dentroDe = (x, y, t, margen = 0, radio = TARJETA_RADIO) => {
  const c = caja(t, margen)
  return insideRoundedRect(x, y, c.left, c.top, c.right, c.bottom, radio + margen)
}

/**
 * El glifo: la tarjeta de atrás, menos el hueco de la de adelante, más la de
 * adelante.
 *
 * El orden importa: primero se descuenta el hueco y recién después se suma la
 * tarjeta de adelante, para que el recorte no le coma el borde a la que está
 * arriba.
 */
function insideGlyph(x, y) {
  const [atras, adelante] = TARJETAS
  if (dentroDe(x, y, adelante)) return true
  if (dentroDe(x, y, adelante, SEPARACION)) return false
  return dentroDe(x, y, atras)
}

/** Degradado diagonal de violeta claro a indigo profundo. */
function backgroundColor(x, y) {
  const t = Math.min(1, Math.max(0, (x / SIZE) * 0.45 + (y / SIZE) * 0.55))
  /*
   * ACÁ EL COLOR TAMBIÉN CAMBIA, y es lo que distingue a Psicoflashy.
   *
   * Convertexto y Flashcards son productos de la misma casa para el mismo público,
   * así que comparten el violeta y se distinguen por la forma. Psicoflashy no: es
   * de nicho, se vende como algo propio, y su comprador no tiene por qué reconocer
   * una familia de productos que no le vendieron.
   *
   * El verde azulado salió por descarte: el violeta ya está tomado por las otras
   * dos y el azul clínico es lo que usa cualquier app de salud. Este tono se lee
   * sereno sin ser genérico y se distingue de un vistazo en la barra de tareas.
   */
  const from = [0x2e, 0xa8, 0x9a]
  const to = [0x0e, 0x4f, 0x63]
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t)
  ]
}

function coverage(x, y, test) {
  let hits = 0
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      if (test(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) hits++
    }
  }
  return hits / (SAMPLES * SAMPLES)
}

function renderRgba() {
  // Cada fila del PNG arranca con un byte de tipo de filtro (0 = sin filtro).
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  let offset = 0

  for (let y = 0; y < SIZE; y++) {
    raw[offset++] = 0
    for (let x = 0; x < SIZE; x++) {
      const bg = coverage(x, y, insideBackground)
      if (bg === 0) {
        offset += 4
        continue
      }
      const glyph = coverage(x, y, insideGlyph)
      const [r, g, b] = backgroundColor(x + 0.5, y + 0.5)
      // El glifo blanco se mezcla sobre el fondo según su cobertura.
      raw[offset++] = Math.round(r + (255 - r) * glyph)
      raw[offset++] = Math.round(g + (255 - g) * glyph)
      raw[offset++] = Math.round(b + (255 - b) * glyph)
      raw[offset++] = Math.round(bg * 255)
    }
  }
  return raw
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData), 0)
  return Buffer.concat([length, typeAndData, crc])
}

function buildPng(raw) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0)
  ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8 // profundidad de bits
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0 // compresión deflate
  ihdr[11] = 0 // filtro adaptativo
  ihdr[12] = 0 // sin entrelazado
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, buildPng(renderRgba()))
console.log(`[icon] generado ${OUT} (${SIZE}x${SIZE})`)
