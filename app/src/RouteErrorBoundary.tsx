import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">
            This page hit an unexpected error. You can try reloading, or go back to the home page.
          </p>
          <pre className="error-boundary-stack">{this.state.error.message}</pre>
          <p>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>{' '}
            <Link className="btn btn-secondary" to="/">
              Home
            </Link>
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
