#!/usr/bin/env node
/**
 * Escribe "INSTRUCCIONES DE INSTALACIÓN.txt" junto al build, en UTF-8 con BOM y
 * saltos CRLF, para que se vea bien tanto en el Bloc de notas de Windows como en
 * TextEdit de macOS.
 *
 * El texto sale del mismo módulo que la guía en PDF que recibe el comprador
 * (scripts/lib/guias.mjs), así que las dos versiones nunca se contradicen. Éste
 * es el .txt que queda al lado del instalador compilado; el PDF es el que viaja
 * en la carpeta de descarga.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { guiaATexto, guiaInicio } from './lib/guias.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RELEASE = join(ROOT, 'release')
const FILE_NAME = 'INSTRUCCIONES DE INSTALACIÓN.txt'
const TARGET = join(ROOT, FILE_NAME)

const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const version = PKG.version
// El nombre sale de package.json y NO escrito a mano. En Convertexto estuvo
// cableado y un renombre dejó el instructivo apuntando a archivos que ya no
// existían: le decía al comprador que abriera un .exe con otro nombre. El
// artifactName de electron-builder.yml usa este mismo valor.
const APP = PKG.productName

function has(suffix) {
  return existsSync(RELEASE) && readdirSync(RELEASE).some((f) => f.endsWith(suffix))
}

// Junto al build los archivos conservan el nombre que generó electron-builder.
const names = {
  readme: FILE_NAME,
  help: FILE_NAME,
  installer: `${APP}-${version}-Windows-Instalador.exe`,
  portable: `${APP}-${version}-Windows-Portable.exe`,
  macArm: `${APP}-${version}-macOS-arm64.dmg`,
  macIntel: `${APP}-${version}-macOS-x64.dmg`
}

const hasWindows = has('-Windows-Instalador.exe')
const hasMac = has('-macOS-arm64.dmg') || has('-macOS-x64.dmg')

const BOM = String.fromCharCode(0xfeff)
const escribir = (destino, cuerpo) => writeFileSync(destino, BOM + cuerpo.replace(/\r?\n/g, '\r\n'), 'utf8')

const plataforma = { hasWindows: hasWindows || !hasMac, hasMac }

/* Va la guía de INICIO y no la de ayuda: este archivo queda al lado del .exe
   recién compilado y se llama "instrucciones de instalación", así que tiene que
   traer los pasos de instalación y los dos avisos de Windows. El manual completo
   viaja en PDF en la carpeta del comprador. */
escribir(TARGET, guiaATexto(guiaInicio({ version, names, ...plataforma })))
console.log(`[instrucciones] escrito ${FILE_NAME}`)

if (existsSync(RELEASE)) {
  copyFileSync(TARGET, join(RELEASE, FILE_NAME))
  console.log(`[instrucciones] copiado a release/${FILE_NAME}`)
}
