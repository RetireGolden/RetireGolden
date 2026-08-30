/**
 * Lazy page bindings for the plan workspace (routes/PlanRoutes.tsx), split out
 * so each file exports only components (react-refresh boundary rule) — the
 * same arrangement as routes/lazyPages.tsx for the top-level groups.
 *
 * Only the *Enter* sections stay eager in PlanRoutes: they are the screens a
 * reader lands on from `/plan/:id`, and they share one small form vocabulary.
 * Everything below is an output/analysis screen opened on demand, and each
 * drags in weight nothing else needs — Recharts (Results, Monte Carlo,
 * Scenarios, Insights), the engine's decision/insight/scenario modules, the
 * optimizer and solver runners, the report renderer. Importing them eagerly
 * put all of that in one ~919 KB chunk that every plan screen had to download
 * before it could render a household form.
 */

import { lazy } from 'react'

export const AssumptionsCardPage = lazy(() =>
  import('../planner/AssumptionsCardPage').then((m) => ({ default: m.AssumptionsCardPage })),
)
export const SsAnalysisPage = lazy(() => import('../planner/SsAnalysisPage').then((m) => ({ default: m.SsAnalysisPage })))
export const ResultsPage = lazy(() => import('../planner/ResultsPage').then((m) => ({ default: m.ResultsPage })))
export const MonteCarloPage = lazy(() => import('../planner/MonteCarloPage').then((m) => ({ default: m.MonteCarloPage })))
export const ScenariosPage = lazy(() => import('../planner/ScenariosPage').then((m) => ({ default: m.ScenariosPage })))
export const HouseholdMapPage = lazy(() =>
  import('../householdMap/HouseholdMapPage').then((m) => ({ default: m.HouseholdMapPage })),
)
export const SurvivorTransitionPage = lazy(() =>
  import('../planner/SurvivorTransitionPage').then((m) => ({ default: m.SurvivorTransitionPage })),
)
export const RelocationComparePage = lazy(() =>
  import('../planner/RelocationComparePage').then((m) => ({ default: m.RelocationComparePage })),
)
export const OptimizePage = lazy(() => import('../planner/OptimizePage').then((m) => ({ default: m.OptimizePage })))
export const SpendingSolverPage = lazy(() =>
  import('../planner/SpendingSolverPage').then((m) => ({ default: m.SpendingSolverPage })),
)
export const InsightsPage = lazy(() => import('../planner/insights/InsightsPage').then((m) => ({ default: m.InsightsPage })))
export const ReportPage = lazy(() => import('../planner/ReportPage').then((m) => ({ default: m.ReportPage })))
