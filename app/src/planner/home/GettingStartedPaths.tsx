import { Link } from 'react-router-dom'

import { createEmptyPlan } from '../../engine/model/plan'

type GettingStartedPathsProps = {
  onCreatePlan: (plan: ReturnType<typeof createEmptyPlan>) => void
}

export function GettingStartedPaths({ onCreatePlan }: GettingStartedPathsProps) {
  return (
    <section className="home-paths" aria-labelledby="getting-started-paths-heading">
      <h2 id="getting-started-paths-heading">Getting started</h2>
      <div className="home-paths-grid plan-grid">
        <Link to="/learn" className="home-path-card plan-card">
          <span className="home-path-card-title">Learn the basics</span>
          <span className="home-path-card-desc">
            Read short guides on privacy, the planner sections, and what RetireGolden models.
          </span>
        </Link>
        <Link to="/examples" className="home-path-card plan-card">
          <span className="home-path-card-title">Try an example</span>
          <span className="home-path-card-desc">
            Open a curated household with realistic numbers — explore freely without saving anything yet.
          </span>
        </Link>
        <button
          type="button"
          className="home-path-card plan-card"
          onClick={() => void onCreatePlan(createEmptyPlan())}
        >
          <span className="home-path-card-title">Build your own plan</span>
          <span className="home-path-card-desc">
            Start from a blank slate and enter your household, accounts, and spending.
          </span>
        </button>
        <Link to="/import" className="home-path-card plan-card">
          <span className="home-path-card-title">Import from a file</span>
          <span className="home-path-card-desc">
            Seed a plan from a broker CSV, a ProjectionLab export, a spreadsheet, or last year&apos;s tax
            return — parsed on this device, never uploaded.
          </span>
        </Link>
      </div>
    </section>
  )
}
