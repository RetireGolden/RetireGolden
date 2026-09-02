/**
 * Not-found chrome (#442, #464): the same card family as the plan-load error
 * card, so an unmatched URL never leaves the main region blank. Two shapes:
 * the site-level page for an unknown route, and the workspace variant that
 * renders inside the plan shell for an unknown section segment (the rail,
 * KPI bar, and breadcrumb stay up, and the way back is the plan's first
 * section rather than the site home).
 */

import { Link, useParams } from 'react-router'

import { useImportAvailability } from '../import/importAvailability'
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

/**
 * Site-level pages a plan URL is likely to be guessed for (#536): the rail's
 * "Compare plans" sits among the plan links, so `/plan/:id/compare` is a
 * natural miss, and `/plan/:id/import` the same for the import wizard. The
 * label matches the destination's own title (App.tsx ROUTE_TITLES).
 */
const SITE_LEVEL_ESCAPES: Readonly<Record<string, { to: string; label: string }>> = {
  compare: { to: '/compare', label: 'Compare plans' },
  import: { to: '/import', label: 'Import & migrate' },
  examples: { to: '/examples', label: 'Examples' },
  learn: { to: '/learn', label: 'Learning Center' },
}

export function WorkspaceNotFound() {
  const { planId, '*': splat } = useParams()
  const importAvailability = useImportAvailability()
  const segment = splat?.split('/').filter(Boolean)[0] ?? ''
  // The import wizard is a host capability: while the host has it switched
  // off (or has not yet said), the plain copy applies instead of a primary
  // action into an unavailable page. Whether a host mounts the route at all
  // is not knowable from here; the same is true of every /import link in the
  // package, and a host without the route answers with its own not-found.
  const importOffered = importAvailability.enabled && importAvailability.resolved
  const escape =
    Object.hasOwn(SITE_LEVEL_ESCAPES, segment) && (segment !== 'import' || importOffered)
      ? SITE_LEVEL_ESCAPES[segment]
      : undefined
  return (
    <div className="card empty-state">
      <h2>This plan has no such section</h2>
      {escape ? (
        <p className="muted">
          {escape.label} is not a section of this plan; it has its own page outside the plan workspace.
        </p>
      ) : (
        <p className="muted">
          The address names a section that is not part of the planner. Every section is listed in the rail; Household
          is the first.
        </p>
      )}
      <div className="picker-actions">
        {escape ? (
          <Link to={escape.to} className="btn btn-primary">
            Go to {escape.label}
          </Link>
        ) : null}
        <Link to={`/plan/${planId}/household`} className={escape ? 'btn btn-secondary' : 'btn btn-primary'}>
          Go to Household
        </Link>
        <Link to={`/plan/${planId}/results`} className="btn btn-secondary">
          Go to Results
        </Link>
      </div>
    </div>
  )
}
