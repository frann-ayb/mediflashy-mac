/**
 * Runtime de Visual C++ al lado de un binario de Windows.
 *
 * Los binarios oficiales de whisper.cpp y de llama.cpp se compilan con MSVC y
 * dependen del Redistribuible de Visual C++, que NO viene con Windows. Si el
 * comprador no lo tiene instalado, la app abre pero el motor no arranca — y el
 * error que da Windows (0xc0000135) no le dice nada a nadie.
 *
 * En vez de pedirle que instale algo, se copian esas DLL al lado del ejecutable:
 * Windows resuelve primero la carpeta del .exe, así que el motor queda
 * autocontenido. Es el "deployment app-local" que documenta Microsoft.
 *
 * De dónde salen las DLL importa: el permiso para redistribuirlas viene con la
 * licencia de Visual Studio, y la fuente que esa licencia contempla es la carpeta
 * `VC\Redist\MSVC\...` de Visual Studio (o el instalador vc_redist), no las copias
 * que el sistema operativo tiene en System32. Por eso se busca primero el Redist.
 * System32 queda sólo como último recurso, y avisando: sirve para probar en la
 * máquina de desarrollo, no para armar el instalador que se vende.
 *
 * Las api-ms-win-crt-* que también importa son el Universal CRT, que sí forma
 * parte de Windows 10 y posteriores (el mínimo que pide Electron).
 *
 * ---------------------------------------------------------------------------
 * Este módulo lo comparten `fetch-whisper.mjs` y `fetch-llama.mjs`.
 *
 * Estaba escrito una sola vez adentro de fetch-whisper, y al sumar el motor de
 * resúmenes la opción fácil era copiarlo. Sería la peor: el aviso de "no armes el
 * instalador con las copias de System32" es la parte que más importa de todo esto,
 * y duplicado se desincroniza. Cada motor necesita SU copia de las DLL (Windows
 * busca en el directorio del ejecutable, no en el del vecino), pero la lógica de
 * dónde sacarlas es una sola.
 */
import { copyFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const VC_RUNTIME_DLLS = ['VCRUNTIME140.dll', 'VCRUNTIME140_1.dll', 'MSVCP140.dll', 'VCOMP140.DLL']

function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

/** Carpetas `VC\Redist\MSVC` de todas las instalaciones de Visual Studio. */
function redistRoots() {
  const roots = []
  for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean)) {
    const vs = join(base, 'Microsoft Visual Studio')
    for (const year of safeReaddir(vs)) {
      for (const edition of safeReaddir(join(vs, year))) {
        const redist = join(vs, year, edition, 'VC', 'Redist', 'MSVC')
        if (existsSync(redist)) roots.push(redist)
      }
    }
  }
  return roots
}

/** Compara versiones tipo `14.44.35112` para quedarse con la más nueva. */
function compareVersions(a, b) {
  const pa = a.split('.').map((n) => Number(n) || 0)
  const pb = b.split('.').map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  }
  return 0
}

/**
 * Busca un juego completo de DLL dentro de una misma versión del Redist. No se
 * mezclan versiones a propósito: MSVCP140 y VCRUNTIME140 de builds distintos es
 * una fuente clásica de fallos que sólo aparecen en la máquina del comprador.
 */
function findRedistSet() {
  const versions = []
  for (const root of redistRoots()) {
    for (const version of safeReaddir(root)) {
      const x64 = join(root, version, 'x64')
      const packages = safeReaddir(x64)
      const found = {}
      for (const dll of VC_RUNTIME_DLLS) {
        for (const pkg of packages) {
          const candidate = join(x64, pkg, dll)
          if (existsSync(candidate)) {
            found[dll] = candidate
            break
          }
        }
      }
      if (Object.keys(found).length === VC_RUNTIME_DLLS.length) versions.push({ version, found })
    }
  }
  versions.sort((a, b) => compareVersions(b.version, a.version))
  return versions[0] ?? null
}

/**
 * Copia el runtime al lado del binario.
 *
 * `log` y `warn` se reciben por parámetro para que cada script hable con su propio
 * prefijo (`[whisper]`, `[llama]`) y el comprador —o quien lea el log de un build—
 * sepa de qué motor le están hablando.
 *
 * `setupCmd` es el comando que hay que volver a correr si falta el Redist, y va en
 * el mensaje de error: un aviso que no dice qué hacer no sirve de nada.
 */
export function copyVcRuntime(target, { log, warn, setupCmd }) {
  const redist = findRedistSet()
  if (redist) {
    for (const dll of VC_RUNTIME_DLLS) copyFileSync(redist.found[dll], join(target, dll))
    log(`runtime de Visual C++ ${redist.version} incluido desde el Redist de Visual Studio (${VC_RUNTIME_DLLS.length} DLL).`)
    return { count: VC_RUNTIME_DLLS.length, source: `Redist de Visual Studio ${redist.version}` }
  }

  const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
  const missing = VC_RUNTIME_DLLS.filter((dll) => !existsSync(join(system32, dll)))
  if (missing.length > 0) {
    warn(
      `no encontré el Redist de Visual Studio ni ${missing.join(', ')} en System32. La app va a fallar en las ` +
        'computadoras que no tengan instalado el Redistribuible de Visual C++ 2015-2022. Instalá "Visual Studio Build Tools" ' +
        `(incluye VC\\Redist) o vc_redist.x64.exe y volvé a correr \`${setupCmd}\`.`
    )
    return { count: 0, source: 'no incluido' }
  }

  for (const dll of VC_RUNTIME_DLLS) copyFileSync(join(system32, dll), join(target, dll))
  warn(
    'no encontré el Redist de Visual Studio: las DLL se copiaron de System32. Sirve para probar acá, pero NO armes ' +
      `con esto el instalador que se distribuye: instalá "Visual Studio Build Tools" y volvé a correr \`${setupCmd}\`.`
  )
  return { count: VC_RUNTIME_DLLS.length, source: 'System32 (NO apto para distribuir)' }
}
