import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const r = (...p: string[]): string => resolve(__dirname, ...p)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    },
    build: {
      sourcemap: true,
      rollupOptions: { input: { index: r('src/main/index.ts') } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': r('src/shared') }
    },
    build: {
      sourcemap: true,
      rollupOptions: { input: { index: r('src/preload/index.ts') } }
    }
  },
  renderer: {
    root: r('src/renderer'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': r('src/renderer/src'), '@shared': r('src/shared') }
    },
    build: {
      rollupOptions: { input: { index: r('src/renderer/index.html') } }
    }
  }
})
