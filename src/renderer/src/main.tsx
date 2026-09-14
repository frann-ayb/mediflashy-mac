import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logToMain } from './lib/api'
import { aplicar, guardado } from './lib/tema'

// El tema, lo primero de todo y antes de montar React: si se estampara dentro de
// un efecto, el primer fotograma saldría con el tema oscuro y saltaría al claro.
aplicar(guardado())

// Sin esto, soltar un archivo fuera de la zona de carga haría que Electron
// navegue a ese archivo y la app "desaparezca".
window.addEventListener('dragover', (event) => event.preventDefault())
window.addEventListener('drop', (event) => event.preventDefault())

// Cualquier error de la interfaz termina en el archivo de registro del usuario.
window.addEventListener('error', (event) => {
  logToMain('error', `${event.message} (${event.filename}:${event.lineno}:${event.colno})`)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  logToMain('error', `Promesa rechazada sin manejar: ${reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason)}`)
})

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  )
}
