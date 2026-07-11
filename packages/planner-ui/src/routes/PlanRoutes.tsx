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
import { InsightsPage } from '../planner/insights/InsightsPage'
import '../planner/planner.css'

export default function PlanRoutes() {
  return (
    <Routes>
      <Route path=":planId" element={<PlanWorkspace />}>
        <Route index element={<Navigate to="household" replace />} />
        <Route path="household" element={<HouseholdSection />} />
        <Route path="social-security" element={<SocialSecuritySection />} />
        <Route path="accounts" element={<AccountsSection />} />
        <Route path="insurance" element={<InsuranceSection />} />
        <Route path="income" element={<IncomeSection />} />
        <Route path="income-floor" element={<IncomeFloorSection />} />
        <Route path="spending" element={<SpendingSection />} />
        <Route path="strategy" element={<StrategySection />} />
        <Route path="assumptions" element={<AssumptionsSection />} />
        <Route path="assumptions-card" element={<AssumptionsCardPage />} />
        <Route path="social-security-analysis" element={<SsAnalysisPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="monte-carlo" element={<MonteCarloPage />} />
        <Route path="scenarios" element={<ScenariosPage />} />
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
