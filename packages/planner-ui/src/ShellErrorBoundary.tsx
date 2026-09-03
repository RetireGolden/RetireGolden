/**
 * The last boundary above the app shell.
 *
 * `RouteErrorBoundary` sits INSIDE `<main>`, so it catches a route and nothing
 * else: a throw in the header, the theme switcher, the footer,
 * `PlanStoreProvider`, or `ImportAvailabilityProvider` took the whole page
 * with it. For this app that is worse than it sounds, because the only copy of
 * a household's plans is this browser's IndexedDB and every recovery
 * affordance (backup export, import) lives on the home route a blank page
 * cannot reach.
 *
 * Deliberately plainer than the route boundary: no router hooks, no context,
 * no lazy chunk, and a bare `<a href>` rather than a `<Link>`, because
 * whatever broke may be the router or a provider this fallback would
 * otherwise re-enter.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App shell render error:', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return (
      <div className="error-boundary-fallback" role="alert">
        <h1>RetireGolden could not finish loading</h1>
        <p className="muted">
          Your plans are still in this browser&apos;s storage, not on a server. Reloading usually fixes this. If it
          does not, the home page has Data &amp; privacy → Download backup, which writes every plan it can read to a
          JSON file you keep.
        </p>
        <pre className="error-boundary-stack">{this.state.error.message}</pre>
        <p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>{' '}
          <a className="btn btn-secondary" href="/">
            Home
          </a>
        </p>
      </div>
    )
  }
}
