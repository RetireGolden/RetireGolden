import type { ReactNode } from 'react'

type GettingStartedReopenerProps = {
  expanded: boolean
  onToggle: () => void
  panelId: string
  children: ReactNode
}

export function GettingStartedReopener({ expanded, onToggle, panelId, children }: GettingStartedReopenerProps) {
  return (
    <div className="home-getting-started-reopener">
      <button
        type="button"
        className="home-reopener-btn"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="home-reopener-icon" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        New here? Getting started
      </button>
      {expanded ? (
        <div id={panelId} className="home-getting-started-panel">
          {children}
        </div>
      ) : null}
    </div>
  )
}
