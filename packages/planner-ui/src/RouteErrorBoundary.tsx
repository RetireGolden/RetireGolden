import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { RouteFallback } from './routes/RouteFallback'
import { isStaleChunkError, reloadOnceForStaleChunk } from './staleChunkReload'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  /** A stale-chunk auto-reload is in flight — show the loading skeleton, not an error. */
  reloading: boolean
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Stale-deployment backstop: a lazy route chunk vanished because a new
    // deploy replaced the hashed assets under this tab (see
    // staleChunkReload.ts). One reload picks up the new index; while it's in
    // flight the route just looks like it's still loading. The web host also
    // catches this earlier via `vite:preloadError`; this boundary ships
    // inside the exported route groups (routes/groups.tsx), so hosts that
    // skip `installStaleChunkReloadHandler()` recover here instead.
    if (isStaleChunkError(error) && reloadOnceForStaleChunk()) {
      this.setState({ reloading: true })
      return
    }
    console.error('Route render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.reloading) {
      return <RouteFallback />
    }
    if (this.state.error) {
      const staleChunk = isStaleChunkError(this.state.error)
      return (
        <div className="error-boundary-fallback" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">
            {staleChunk
              ? 'Part of the app failed to load — this can happen right after an update, or while offline. Reloading usually fixes it.'
              : 'This page hit an unexpected error. You can try reloading, or go back to the home page.'}
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
