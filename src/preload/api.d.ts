import type { FlashcardsApi } from '@shared/api'

/**
 * Lo que el preload cuelga de `window`. Declararlo acá es lo que permite que el
 * renderer use `window.flashcards` con tipos, sin importar nada de Electron.
 */
declare global {
  interface Window {
    flashcards: FlashcardsApi
  }
}

export {}
