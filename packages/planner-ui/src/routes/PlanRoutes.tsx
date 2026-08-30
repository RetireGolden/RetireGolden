import { Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { PlanWorkspace } from '../planner/PlanWorkspace'
import {
  AccountsSection,
  AssumptionsSection,
  HouseholdSection,
  IncomeFloorSection,
  IncomeSection,
  InsuranceSection,
  SpendingSection,
  StrategySection,
} from '../planner/sections'
import { SocialSecuritySection } from '../planner/SocialSecuritySection'
import { EditableFieldset } from '../planner/EditableFieldset'
import { RouteErrorBoundary } from '../RouteErrorBoundary'
import { RouteFallback } from './RouteFallback'
import {
  AssumptionsCardPage,
  HouseholdMapPage,
  InsightsPage,
  MonteCarloPage,
  OptimizePage,
  RelocationComparePage,
  ReportPage,
  ResultsPage,
  ScenariosPage,
  SpendingSolverPage,
  SsAnalysisPage,
  SurvivorTransitionPage,
} from './planPages'
import '../planner/planner.css'

/**
 * Same contract as routes/groups.tsx: a lazy page carries its own error
 * boundary, not just Suspense, so the stale-chunk auto-reload backstop and a
 * recoverable fallback apply per chunk (see ../staleChunkReload.ts). The
 * workspace chrome around `<Outlet/>` stays mounted while the page loads —
 * only the outlet area shows the skeleton.
 */
function suspended(children: ReactNode) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

export default function PlanRoutes() {
  return (
    <Routes>
      <Route path=":planId" element={<PlanWorkspace />}>
        <Route index element={<Navigate to="household" replace />} />
        {/* The "Enter" sections are pure plan-editing forms; wrap each in
            EditableFieldset so its controls disable together when the workspace
            is read-only. The Optimize/Explore pages below stay outside — their
            compute and export controls must keep working, and the autosave
            guard already prevents any edit they make from persisting. */}
        <Route path="household" element={<EditableFieldset><HouseholdSection /></EditableFieldset>} />
        <Route path="social-security" element={<EditableFieldset><SocialSecuritySection /></EditableFieldset>} />
        <Route path="accounts" element={<EditableFieldset><AccountsSection /></EditableFieldset>} />
        <Route path="insurance" element={<EditableFieldset><InsuranceSection /></EditableFieldset>} />
        <Route path="income" element={<EditableFieldset><IncomeSection /></EditableFieldset>} />
        <Route path="income-floor" element={<EditableFieldset><IncomeFloorSection /></EditableFieldset>} />
        <Route path="spending" element={<EditableFieldset><SpendingSection /></EditableFieldset>} />
        <Route path="strategy" element={<EditableFieldset><StrategySection /></EditableFieldset>} />
        <Route path="assumptions" element={<EditableFieldset><AssumptionsSection /></EditableFieldset>} />
        <Route path="assumptions-card" element={suspended(<AssumptionsCardPage />)} />
        <Route path="social-security-analysis" element={suspended(<SsAnalysisPage />)} />
        <Route path="results" element={suspended(<ResultsPage />)} />
        <Route path="monte-carlo" element={suspended(<MonteCarloPage />)} />
        <Route path="scenarios" element={suspended(<ScenariosPage />)} />
        <Route path="household-map" element={suspended(<HouseholdMapPage />)} />
        <Route path="survivor" element={suspended(<SurvivorTransitionPage />)} />
        <Route path="relocation" element={suspended(<RelocationComparePage />)} />
        <Route path="optimize" element={suspended(<OptimizePage />)} />
        <Route path="spending-solver" element={suspended(<SpendingSolverPage />)} />
        <Route path="insights" element={suspended(<InsightsPage />)} />
      </Route>
      <Route path=":planId/report" element={suspended(<ReportPage />)} />
    </Routes>
  )
}
