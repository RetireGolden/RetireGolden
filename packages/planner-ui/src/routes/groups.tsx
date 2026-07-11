/**
 * Route-level exports: the planner's route table split into host-mountable
 * groups. `<PlannerApp/>` composes all three; a host that owns its own
 * plans-management chrome mounts the workspace (and usually content) groups
 * under its router and omits the home group entirely.
 *
 * The groups are react-router v7 `RouteObject[]` arrays — the shape that
 * spreads into `useRoutes`, nests under a host's route config, or feeds
 * `createBrowserRouter` — rather than `<Route>` fragments, which can't cross
 * a component boundary (`<Routes>` only reads `<Route>` children it can see
 * literally). Paths are relative so the groups work at the router root or
 * nested under a host path.
 *
 * Everything here stays chrome-free: pages only, no header/nav/footer and no
 * document.title management for non-plan routes (plan routes retitle
 * themselves in PlanWorkspace). The host owns that, as `<PlannerApp/>` does
 * for the web app.
 */

import { Suspense, type ReactNode } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

import { PlanPickerPage } from '../planner/PlanPickerPage'
import { DisclaimerPage } from '../planner/DisclaimerPage'
import { RouteFallback } from './RouteFallback'
import { ComparePlansPage, ExamplesPage, HowTestedPage, ImportPage, LearnRoutes, PlanRoutes } from './lazyPages'

function suspended(children: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>
}

/**
 * The plan workspace: everything under `/plan/:planId/*` (entry sections,
 * results, Monte Carlo, scenarios, survivor, relocation, the optimizers, the
 * report) plus cross-plan Compare. Deep links work when this group is
 * mounted alone. Workspace pages link to `/` ("Your plans") and into the
 * content group (`/disclaimer`, `/how-tested`, Learn) — a host mounts or
 * redirects those paths as it sees fit.
 */
export const plannerWorkspaceRoutes: RouteObject[] = [
  { path: 'plan/*', element: suspended(<PlanRoutes />) },
  { path: 'compare', element: suspended(<ComparePlansPage />) },
]

/**
 * Storage-independent content: the example library, the Learning Center,
 * the disclaimer, and the "How RetireGolden is tested" trust page (linked
 * from Results and the Disclaimer, so hosts mounting the workspace want it).
 */
export const plannerContentRoutes: RouteObject[] = [
  { path: 'examples', element: suspended(<ExamplesPage />) },
  { path: 'learn/*', element: suspended(<LearnRoutes />) },
  { path: 'disclaimer', element: <DisclaimerPage /> },
  { path: 'how-tested', element: suspended(<HowTestedPage />) },
]

/**
 * The web app's plans-management surfaces: the home page (plan list, backup
 * download/import, clear-all) and the file-import wizard, plus redirects for
 * retired v1 routes. Hosts with their own library chrome omit this group.
 */
export const plannerHomeRoutes: RouteObject[] = [
  { index: true, element: <PlanPickerPage /> },
  { path: 'import', element: suspended(<ImportPage />) },
  // Retired v1 routes now redirect into the planner.
  { path: 'legacy', element: <Navigate to="/" replace /> },
  { path: 'longevity', element: <Navigate to="/" replace /> },
  { path: 'social-security', element: <Navigate to="/" replace /> },
]
