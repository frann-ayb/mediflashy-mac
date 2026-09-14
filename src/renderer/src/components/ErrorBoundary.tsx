import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logToMain } from '@/lib/api'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Última barrera de la interfaz: si un componente lanza, en lugar de dejar la
 * ventana en blanco se muestra una pantalla con la opción de recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logToMain('error', `Error en la interfaz: ${error.message}\n${error.stack ?? ''}\n${info.componentStack ?? ''}`)
  }

  private reload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full items-center justify-center bg-canvas p-8">
        <div className="max-w-md rounded-2xl border border-line-strong bg-surface p-7 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Algo se rompió en la pantalla</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
            El problema quedó anotado en el archivo de registro. Volvé a cargar la pantalla para seguir estudiando; tus
            tarjetas están guardadas.
          </p>
          <button
            type="button"
            onClick={this.reload}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-on-brand transition-colors hover:bg-brand-soft"
          >
            Recargar la pantalla
          </button>
        </div>
      </div>
    )
  }
}
