/**
 * Deterministic projection over the standard tax stack (federal engine + flat
 * state rate — the same stack the Monte Carlo workers use, see
 * src/mc/runRequest.ts).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { taxCalculatorFor } from './planTaxCalculator'

export function currentStartYear(): number {
  return new Date().getFullYear()
}

export interface ProjectionView {
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  /** Divide a nominal amount in `year` by this to get today's dollars. */
  deflate: (year: number, amount: number) => number
}

/**
 * Deterministic projection: the same `(plan, startYear)` produces the same
 * `result` and `summary`. Hosts capturing evidence must pass an explicit
 * `startYear` instead of relying on the clock default.
 */
export function projectPlan(plan: Plan, startYear = currentStartYear()): ProjectionView {
  const result = simulatePlan(plan, { startYear, taxCalculator: taxCalculatorFor(plan) })
  const summary = summarizeProjection(plan, result)
  const r = 1 + plan.assumptions.inflationPct / 100
  return {
    result,
    summary,
    startYear,
    deflate: (year, amount) => amount / Math.pow(r, year - startYear),
  }
}
