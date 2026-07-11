/**
 * Lazy page bindings for the route groups (routes/groups.tsx), split out so
 * each file exports only components (react-refresh boundary rule).
 */

import { lazy } from 'react'

export const PlanRoutes = lazy(() => import('./PlanRoutes'))
export const LearnRoutes = lazy(() => import('./LearnRoutes'))
// Lazy like /plan and /learn: Examples pulls in all example builders + the Zod
// schema, Compare pulls in the whole engine via projectPlan — eager imports
// here would drag both into the landing entry chunk.
export const ExamplesPage = lazy(() => import('../planner/examples/ExamplesPage').then((m) => ({ default: m.ExamplesPage })))
export const ComparePlansPage = lazy(() => import('../planner/ComparePlansPage').then((m) => ({ default: m.ComparePlansPage })))
// Lazy so the glob-derived test-suite manifests it embeds stay out of the landing chunk.
export const HowTestedPage = lazy(() => import('../planner/HowTestedPage').then((m) => ({ default: m.HowTestedPage })))
// Lazy: the import wizard pulls in the per-source mappers and the Zod schema.
export const ImportPage = lazy(() => import('../import/ImportPage').then((m) => ({ default: m.ImportPage })))
