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

/**
 * The one place the app moves an amount between today's dollars and a year's
 * nominal dollars.
 *
 * Not a second model of anything: the engine already ran the ledger in nominal
 * dollars, and both directions here are the same single compounding of the
 * plan's own `inflationPct` from one base year. It exists because that
 * conversion was being re-derived by hand at four call sites, which is four
 * chances to take the wrong base year and nowhere to test it once.
 */
export interface InflationView {
  /** A nominal amount in `year`, expressed in `startYear` dollars. */
  deflate: (year: number, amount: number) => number
  /** A `startYear`-dollar amount, expressed in `year`'s nominal dollars. */
  inflate: (year: number, amount: number) => number
}

/** `deflate` and `inflate` for one inflation rate compounded from one base year. */
export function inflationView(inflationPct: number, startYear: number): InflationView {
  const r = 1 + inflationPct / 100
  return {
    deflate: (year, amount) => amount / Math.pow(r, year - startYear),
    inflate: (year, amount) => amount * Math.pow(r, year - startYear),
  }
}

export interface ProjectionView extends InflationView {
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
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
  return { result, summary, startYear, ...inflationView(plan.assumptions.inflationPct, startYear) }
}
