/**
 * Deterministic projection over the standard tax stack (federal engine + flat
 * state rate — the same stack the Monte Carlo workers use, see
 * src/mc/runRequest.ts).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { conversionFreeRun, summarizeProjection, type ProjectionSummary } from '@retiregolden/engine/projection/compare'
import {
  projectionDollarBasis,
  toNominalDollars,
  toTodayDollars,
  type DollarBasis,
} from '@retiregolden/engine/projection/dollarBasis'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { ProjectionResult } from '@retiregolden/engine/projection/types'
import { taxCalculatorFor } from './planTaxCalculator'

export {
  compareStartYear,
  currentStartYear,
  projectionStartYear,
  stampCalendarMonth,
  stampCalendarYear,
  startYearDollarsWord,
  startYearDollarsWordCapitalized,
} from './startYear'

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
  /**
   * The year the projection starts. Required: a caller projecting a stored
   * plan passes `projectionStartYear(plan)`, so an example runs from the year
   * its copy is written for and a user plan from the clock's.
   */
  startYear: number
  /**
   * Opt-in annual cash-flow ledger on each `YearResult`. Absent by default so
   * existing callers (and every shared `useProjection` consumer) stay unchanged.
   */
  captureAnnualCashFlow?: boolean
}

/**
 * Deterministic projection: the same `(plan, startYear)` produces the same
 * `result` and `summary`. The start year is always the caller's: there is no
 * clock default, because a default read the clock for examples too.
 *
 * The second argument is either the start year or the options (Results passes
 * `{ startYear, captureAnnualCashFlow: true }`).
 */
export function projectPlan(plan: Plan, startYear: number): ProjectionView
export function projectPlan(plan: Plan, opts: ProjectPlanOptions): ProjectionView
export function projectPlan(plan: Plan, startYearOrOpts: number | ProjectPlanOptions): ProjectionView {
  const opts: ProjectPlanOptions =
    typeof startYearOrOpts === 'object' ? startYearOrOpts : { startYear: startYearOrOpts }
  const startYear = opts.startYear
  const simulateOptions = { startYear, taxCalculator: taxCalculatorFor(plan) }
  const result = simulatePlan(plan, {
    ...simulateOptions,
    ...(opts.captureAnnualCashFlow === true ? { captureAnnualCashFlow: true } : {}),
  })
  // The FI number's spending year is priced without a Roth conversion's
  // one-off tax: when that year converts, the engine reads it from this same
  // plan run with its conversions removed (decision D-FI-CONVERSION-TAX).
  const summary = summarizeProjection(plan, result, {
    conversionFreeRun: conversionFreeRun(plan, simulateOptions),
  })
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
