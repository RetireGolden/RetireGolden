import { useMemo } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { projectPlan, type ProjectPlanOptions, type ProjectionView } from '../projection'

export { taxCalculatorFor } from '../planTaxCalculator'
export {
  compareStartYear,
  currentStartYear,
  projectPlan,
  projectionStartYear,
  stampCalendarMonth,
  stampCalendarYear,
  startYearDollarsWord,
  startYearDollarsWordCapitalized,
  type ProjectPlanOptions,
  type ProjectionView,
} from '../projection'

export type UseProjectionOptions = Pick<ProjectPlanOptions, 'captureAnnualCashFlow'>

/**
 * The plan's deterministic projection from `startYear`, memoized on the plan
 * object and the year. The year is the caller's, with no clock default: a
 * workspace page passes `projectionStartYear(plan)`. Keying the memo on the
 * year too means a tab left open over New Year re-projects from the new year
 * on its next render instead of keeping the old one.
 */
export function useProjection(plan: Plan, startYear: number, opts?: UseProjectionOptions): ProjectionView {
  const captureAnnualCashFlow = opts?.captureAnnualCashFlow === true
  return useMemo(
    () =>
      captureAnnualCashFlow
        ? projectPlan(plan, { startYear, captureAnnualCashFlow: true })
        : projectPlan(plan, startYear),
    [plan, startYear, captureAnnualCashFlow],
  )
}
