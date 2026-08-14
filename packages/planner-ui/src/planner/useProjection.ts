import { useMemo } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'
import { projectPlan, type ProjectionView } from '../projection'

export { taxCalculatorFor } from '../planTaxCalculator'
export { currentStartYear, projectPlan, type ProjectionView } from '../projection'

export function useProjection(plan: Plan): ProjectionView {
  return useMemo(() => projectPlan(plan), [plan])
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
