import { useMemo } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { projectPlan, type ProjectPlanOptions, type ProjectionView } from '../projection'

export { taxCalculatorFor } from '../planTaxCalculator'
export { currentStartYear, projectPlan, type ProjectPlanOptions, type ProjectionView } from '../projection'

export type UseProjectionOptions = Pick<ProjectPlanOptions, 'captureAnnualCashFlow'>

export function useProjection(plan: Plan, opts?: UseProjectionOptions): ProjectionView {
  const captureAnnualCashFlow = opts?.captureAnnualCashFlow === true
  return useMemo(
    () => (captureAnnualCashFlow ? projectPlan(plan, { captureAnnualCashFlow: true }) : projectPlan(plan)),
    [plan, captureAnnualCashFlow],
  )
}

/** Stable Monte Carlo seed per plan (re-rollable in the UI). */
export function seedFromPlanId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
