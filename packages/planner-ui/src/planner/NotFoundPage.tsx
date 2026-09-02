/**
 * Not-found chrome (#442, #464): the same card family as the plan-load error
 * card, so an unmatched URL never leaves the main region blank. Two shapes:
 * the site-level page for an unknown route, and the workspace variant that
 * renders inside the plan shell for an unknown section segment (the rail,
 * KPI bar, and breadcrumb stay up, and the way back is the plan's first
 * section rather than the site home).
 */

import { Link, useParams } from 'react-router'

import { usePlannerEdition } from './editionContext'

export function NotFoundPage() {
  const { homeLabel } = usePlannerEdition()
  return (
    <div className="page">
      <div className="card empty-state">
        {/* The site-level page owns its document, so its heading is the h1;
            the workspace variant below sits under the plan's h1. */}
        <h1>Page not found</h1>
        <p className="muted">
          There is nothing at this address. It may be an old bookmark, a mistyped link, or a page that has moved.
        </p>
        <div className="picker-actions">
          <Link to="/" className="btn btn-primary">
            {homeLabel}
          </Link>
          <Link to="/examples" className="btn btn-secondary">
            Browse examples
          </Link>
          <Link to="/learn" className="btn btn-secondary">
            Learning Center
          </Link>
        </div>
      </div>
    </div>
  )
}

export function WorkspaceNotFound() {
  const { planId } = useParams()
  return (
    <div className="card empty-state">
      <h2>This plan has no such section</h2>
      <p className="muted">
        The address names a section that is not part of the planner. Every section is listed in the rail; Household
        is the first.
      </p>
      <div className="picker-actions">
        <Link to={`/plan/${planId}/household`} className="btn btn-primary">
          Go to Household
        </Link>
        <Link to={`/plan/${planId}/results`} className="btn btn-secondary">
          Go to Results
        </Link>
      </div>
    </div>
  )
}
