/**
 * The last boundary above the app shell.
 *
 * `RouteErrorBoundary` sits INSIDE `<main>`, so it catches a route and nothing
 * else: a throw in the header, the theme switcher, the footer,
 * `PlanStoreProvider`, or `ImportAvailabilityProvider` took the whole page
 * with it. For this app that is worse than it sounds, because the only copy of
 * a household's plans is this browser's IndexedDB and every recovery
 * affordance (backup export, import) lives on the home route a blank page
 * cannot reach — Home is a plain reload of the same broken tree, so it is not
 * a way to reach that screen when the throw is not transient.
 *
 * Deliberately plainer than the route boundary: no router hooks, no React
 * context, no lazy chunk, and a bare `<a href>` rather than a `<Link>`,
 * because whatever broke may be the router or a provider this fallback would
 * otherwise re-enter. The backup button below keeps that promise: it calls
 * `indexedDbPlanStore` and the seam's plain `listPlansVia`/`loadPlanVia`
 * functions directly (data/planStoreContext.ts) — the same read path
 * `useHomeData.ts` uses — rather than going through `usePlanStore()` or any
 * provider this boundary sits above, so a broken `PlanStoreProvider` render
 * cannot take the one remaining way to a copy of the plans with it.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

import { indexedDbPlanStore, listPlansVia, loadPlanVia } from './data/planStoreContext'
import { serializeV2Backup } from './data/planFormat'
import type { Plan } from '@retiregolden/engine/model/plan'

interface Props {
  children: ReactNode
}

type ExportState = { kind: 'idle' } | { kind: 'pending' } | { kind: 'done'; count: number } | { kind: 'failed'; message: string }

interface State {
  error: Error | null
  exportState: ExportState
}

export class ShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null, exportState: { kind: 'idle' } }

  static getDerivedStateFromError(error: Error): State {
    return { error, exportState: { kind: 'idle' } }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App shell render error:', error, info.componentStack)
  }

  /**
   * Reads every plan straight off the browser's IndexedDB store — bypassing
   * `PlanStoreProvider` and any host override of it — and downloads the same
   * v2 backup envelope "Download backup" writes on the home page. This is the
   * fallback's only way to move a household's data out of a browser that will
   * not finish loading, so a failure here is reported inline rather than
   * thrown: the boundary that catches it is the one already showing.
   */
  downloadBackup = async (): Promise<void> => {
    this.setState({ exportState: { kind: 'pending' } })
    try {
      const summaries = await listPlansVia(indexedDbPlanStore)
      const loaded: Plan[] = []
      for (const s of summaries) {
        const r = await loadPlanVia(indexedDbPlanStore, s.id)
        if (r.ok) loaded.push(r.plan)
      }
      const blob = new Blob([serializeV2Backup(loaded)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `retiregolden-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      this.setState({ exportState: { kind: 'done', count: loaded.length } })
    } catch {
      this.setState({
        exportState: {
          kind: 'failed',
          message: 'No backup was downloaded. Storage is unavailable in this browser right now.',
        },
      })
    }
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children
    const { exportState } = this.state
    return (
      <div className="error-boundary-fallback" role="alert">
        <h1>RetireGolden could not finish loading</h1>
        <p className="muted">
          Your plans are still in this browser&apos;s storage, not on a server. Reloading usually fixes this. If it
          does not, Download plan backup below reads this browser&apos;s storage directly and writes every plan it
          can read to a JSON file you keep.
        </p>
        <pre className="error-boundary-stack">{this.state.error.message}</pre>
        <p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>{' '}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void this.downloadBackup()}
            disabled={exportState.kind === 'pending'}
          >
            {exportState.kind === 'pending' ? 'Downloading…' : 'Download plan backup'}
          </button>{' '}
          <a className="btn btn-secondary" href="/">
            Home
          </a>
        </p>
        {exportState.kind === 'done' ? (
          <p className="field-note" role="status">
            Backup downloaded with {exportState.count} plan{exportState.count === 1 ? '' : 's'}.
          </p>
        ) : null}
        {exportState.kind === 'failed' ? (
          <p className="field-error" role="alert">
            {exportState.message}
          </p>
        ) : null}
      </div>
    )
  }
}
