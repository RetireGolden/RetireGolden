import { Navigate, Route, Routes } from 'react-router-dom'
import { PlanWorkspace } from '../planner/PlanWorkspace'
import { ReportPage } from '../planner/ReportPage'
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
import { AssumptionsCardPage } from '../planner/AssumptionsCardPage'
import { SocialSecuritySection } from '../planner/SocialSecuritySection'
import { SsAnalysisPage } from '../planner/SsAnalysisPage'
import { ResultsPage } from '../planner/ResultsPage'
import { MonteCarloPage } from '../planner/MonteCarloPage'
import { RelocationComparePage } from '../planner/RelocationComparePage'
import { ScenariosPage } from '../planner/ScenariosPage'
import { OptimizePage } from '../planner/OptimizePage'
import { SpendingSolverPage } from '../planner/SpendingSolverPage'
import { SurvivorTransitionPage } from '../planner/SurvivorTransitionPage'
import { HouseholdMapPage } from '../householdMap/HouseholdMapPage'
import { InsightsPage } from '../planner/insights/InsightsPage'
import { EditableFieldset } from '../planner/EditableFieldset'
import '../planner/planner.css'

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
        <Route path="assumptions-card" element={<AssumptionsCardPage />} />
        <Route path="social-security-analysis" element={<SsAnalysisPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="monte-carlo" element={<MonteCarloPage />} />
        <Route path="scenarios" element={<ScenariosPage />} />
        <Route path="household-map" element={<HouseholdMapPage />} />
        <Route path="survivor" element={<SurvivorTransitionPage />} />
        <Route path="relocation" element={<RelocationComparePage />} />
        <Route path="optimize" element={<OptimizePage />} />
        <Route path="spending-solver" element={<SpendingSolverPage />} />
        <Route path="insights" element={<InsightsPage />} />
      </Route>
      <Route path=":planId/report" element={<ReportPage />} />
    </Routes>
  )
}
