import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { AppConfig, CardType, Densidad, GenLevel, Language, Tema } from '@shared/types'
import { CARD_TYPES, DENSIDADES, GEN_LEVELS, LANGUAGES, TEMAS } from '@shared/types'
import { logger } from './logger'

/**
 * Almacén de configuración mínimo y a prueba de archivos corruptos.
 * Se implementa a mano (en lugar de electron-store) para no depender de un
 * paquete ESM dentro del bundle CommonJS del proceso principal: una sola
 * dependencia menos que pueda romper el empaquetado.
 *
 * ACÁ NO ENTRA EL MINI-PROMPT. Es la decisión del producto: lo que el usuario
 * escribe para guiar la generación no se guarda en ningún lado. Vive en el estado
 * de la interfaz mientras la app está abierta y muere al cerrarla. Si alguna vez
 * aparece un campo acá con el texto de las preferencias, es un bug.
 */

const DEFAULTS: AppConfig = {
  hideOnboarding: false,
  // Nadie aceptó nada todavía. Es el único valor de fábrica que bloquea el uso
  // de la app hasta que el usuario haga algo, y eso es deliberado.
  avisoAceptado: false,
  language: 'es',
  // Se sigue al sistema operativo hasta que el usuario elija. Ver `Tema`.
  tema: 'sistema',
  // Arranca en Rápido: baja 1,3 GB en vez de 2,7 y anda con 4 GB de RAM, que es
  // lo que tiene la notebook de la mitad de los estudiantes. Quien tenga una
  // máquina mejor lo cambia una vez y queda.
  genLevel: 'rapido',
  tipo: 'mixto',
  densidad: 'normal',
  // `null` = "mostrame todas las carreras". Es una opcion legitima y por eso es
  // el valor inicial: hasta que el estudiante conteste la bienvenida, la app no
  // tiene por que suponer que carrera cursa.
  carreraActivaId: null,
  ultimaMateriaId: null,
  ultimaUnidadId: null
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function sanitize(raw: unknown): AppConfig {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const id = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null)

  return {
    hideOnboarding: obj.hideOnboarding === true,
    // `=== true` y no un cast: un config.json viejo no trae el campo, y un
    // `undefined` tiene que leerse como "todavía no aceptó", nunca como que sí.
    avisoAceptado: obj.avisoAceptado === true,
    language: pick<Language>(obj.language, LANGUAGES, DEFAULTS.language),
    tema: pick<Tema>(obj.tema, TEMAS, DEFAULTS.tema),
    genLevel: pick<GenLevel>(obj.genLevel, GEN_LEVELS, DEFAULTS.genLevel),
    tipo: pick<CardType>(obj.tipo, CARD_TYPES, DEFAULTS.tipo),
    densidad: pick<Densidad>(obj.densidad, DENSIDADES, DEFAULTS.densidad),
    carreraActivaId: id(obj.carreraActivaId),
    // No se valida que la materia y la unidad sigan existiendo: sería leer toda la
    // biblioteca desde acá, y esto se lee en el arranque. La pantalla de generar ya
    // tiene que manejar el caso de un id que no está —el usuario pudo borrar esa
    // materia— así que validarlo dos veces no compra nada.
    //
    // OJO al agregar un campo nuevo a AppConfig: `set()` hace
    // `sanitize({...data, ...patch})`, y esta función reconstruye el objeto campo
    // por campo. Un campo que no figure acá se pierde en el primer `setConfig`, y
    // el síntoma es desconcertante — la preferencia se revierte sola al cambiar
    // cualquier otra. Son TRES lugares: el tipo, DEFAULTS y esto.
    ultimaMateriaId: id(obj.ultimaMateriaId),
    ultimaUnidadId: id(obj.ultimaUnidadId)
  }
}

export class ConfigStore {
  private data: AppConfig = { ...DEFAULTS }

  constructor(private readonly file: string) {
    this.load()
  }

  private load(): void {
    try {
      if (!existsSync(this.file)) {
        this.data = { ...DEFAULTS }
        return
      }
      this.data = sanitize(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch (err) {
      logger.warn('config', 'El archivo de configuración no se pudo leer; se usan los valores por defecto.', err)
      this.data = { ...DEFAULTS }
    }
  }

  get(): AppConfig {
    return { ...this.data }
  }

  set(patch: Partial<AppConfig>): AppConfig {
    this.data = sanitize({ ...this.data, ...patch })
    this.persist()
    return this.get()
  }

  private persist(): void {
    // Escritura atómica: si el proceso muere a mitad, el archivo original queda intacto.
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = join(dirname(this.file), `config.${process.pid}.tmp`)
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
      renameSync(tmp, this.file)
    } catch (err) {
      logger.warn('config', 'No se pudo guardar la configuración.', err)
    }
  }
}
