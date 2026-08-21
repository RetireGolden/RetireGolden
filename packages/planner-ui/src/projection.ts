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

export interface ProjectPlanOptions {
  startYear?: number
  /**
   * Opt-in annual cash-flow ledger on each `YearResult`. Absent by default so
   * existing callers (and every shared `useProjection` consumer) stay unchanged.
   */
  captureAnnualCashFlow?: boolean
}

/**
 * Deterministic projection: the same `(plan, startYear)` produces the same
 * `result` and `summary`. Hosts capturing evidence must pass an explicit
 * `startYear` instead of relying on the clock default.
 *
 * The second argument remains a start year for existing callers. Results may
 * pass `{ captureAnnualCashFlow: true }` (optionally with `startYear`) instead.
 */
export function projectPlan(plan: Plan, startYear?: number): ProjectionView
export function projectPlan(plan: Plan, opts: ProjectPlanOptions): ProjectionView
export function projectPlan(
  plan: Plan,
  startYearOrOpts: number | ProjectPlanOptions = currentStartYear(),
): ProjectionView {
  const opts: ProjectPlanOptions =
    typeof startYearOrOpts === 'object' ? startYearOrOpts : { startYear: startYearOrOpts }
  const startYear = opts.startYear ?? currentStartYear()
  const result = simulatePlan(plan, {
    startYear,
    taxCalculator: taxCalculatorFor(plan),
    ...(opts.captureAnnualCashFlow === true ? { captureAnnualCashFlow: true } : {}),
  })
  const summary = summarizeProjection(plan, result)
  const r = 1 + plan.assumptions.inflationPct / 100
  return {
    result,
    summary,
    startYear,
    deflate: (year, amount) => amount / Math.pow(r, year - startYear),
  }
}
