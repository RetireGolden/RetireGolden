/**
 * Deterministic projection over the standard tax stack (federal engine + flat
 * state rate — the same stack the Monte Carlo workers use, see
 * src/mc/runRequest.ts).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import {
  projectionDollarBasis,
  toNominalDollars,
  toTodayDollars,
  type DollarBasis,
} from '@retiregolden/engine/projection/dollarBasis'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { taxCalculatorFor } from './planTaxCalculator'

export function currentStartYear(): number {
  return new Date().getFullYear()
}

/**
 * Moving an amount between today's dollars and a year's nominal dollars.
 *
 * The planner does no inflation math of its own: both directions divide or
 * multiply by the factor the engine's ledger published for that year
 * (`YearResult.inflationScale`, read through the engine's dollar basis). A
 * year outside the projection is refused, never extrapolated.
 */
export interface InflationView {
  /** A nominal amount in `year`, expressed in `startYear` dollars. */
  deflate: (year: number, amount: number) => number
  /** A `startYear`-dollar amount, expressed in `year`'s nominal dollars. */
  inflate: (year: number, amount: number) => number
}

export interface ProjectionView extends InflationView {
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  /** The run's own dollar basis: the ledger's published inflation factor for each projected year. */
  basis: DollarBasis
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
  const basis = projectionDollarBasis(result)
  return {
    result,
    summary,
    startYear,
    basis,
    deflate: (year, amount) => toTodayDollars(basis, year, amount),
    inflate: (year, amount) => toNominalDollars(basis, year, amount),
  }
}
