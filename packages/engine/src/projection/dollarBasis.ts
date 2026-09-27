/**
 * The dollar basis: how an amount moves between a projection year's nominal
 * dollars and the projection's start-year ("today's") dollars.
 *
 * The ledger runs in nominal dollars and publishes, on every row, the exact
 * general-inflation factor it used that year (`YearResult.inflationScale`):
 * the left-to-right product of `(1 + rate)` over the years from the start
 * year to the year before, exactly 1 in the start year. This module reads
 * that factor, so every surface that shows "today's dollars" divides by the
 * same number the ledger multiplied by (owner decision R19, 2026-09-25).
 *
 * Convention:
 * - Base year: the projection's `startYear`, whose factor is exactly 1.
 * - `today(y, x) = x / f(y)` for a nominal amount `x` in year `y`;
 *   `nominal(y, x) = x * f(y)` for a start-year amount.
 * - A display function never converts a figure into the basis it is already
 *   in, so a start-year amount shown in today's dollars is returned unchanged.
 * - Years outside `[startYear, endYear]`, and non-integer years, are refused
 *   with a `RangeError`; nothing is extrapolated.
 * - No rounding: formatting to whole dollars belongs to the page.
 *
 * `planDollarBasis` is for a surface that holds no projection result for the
 * rows it converts (the relocation page today). It runs
 * the ledger's own recurrence in the same order, so it is bit-identical to the
 * `inflationScale` a deterministic run at that rate publishes. It is not the
 * factor of a Monte Carlo path, which follows its own inflation series.
 *
 * @see DOCS/calculations/cash-flow-and-summary/display-dollar-basis-conversion.md
 */
import type { ProjectionResult } from './types.js'

/** 'today' shows start-year dollars; 'nominal' shows each year's own dollars. */
export type DollarMode = 'today' | 'nominal'

/**
 * The general-inflation factors that move amounts between a projection's
 * nominal dollars and its start year's dollars. `factors[k]` is the
 * cumulative factor from `startYear` to `startYear + k` (`factors[0] === 1`),
 * the same left-to-right product the ledger publishes as
 * `YearResult.inflationScale`.
 */
export interface DollarBasis {
  readonly startYear: number
  readonly endYear: number
  readonly factors: readonly number[]
}

function assertYearRange(startYear: number, endYear: number): void {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new RangeError(
      `A dollar basis needs whole start and end years with endYear >= startYear; got ${startYear} to ${endYear}`,
    )
  }
}

/**
 * The basis a projection result carries: each row's published
 * `inflationScale`, read in ledger order. Throws when the rows are not the
 * contiguous years `startYear..endYear`, or when a row lacks a finite
 * positive `inflationScale` (a hand-built row without it should use
 * `planDollarBasis` instead; nothing is back-filled here). A projection with
 * no rows (its horizon ends before its start year) gives an empty basis, in
 * which every year is refused.
 */
export function projectionDollarBasis(
  result: Pick<ProjectionResult, 'startYear' | 'endYear' | 'years'>,
): DollarBasis {
  const { startYear, endYear, years } = result
  if (years.length === 0 && Number.isInteger(startYear) && Number.isInteger(endYear) && endYear < startYear) {
    return Object.freeze({ startYear, endYear, factors: Object.freeze([]) })
  }
  assertYearRange(startYear, endYear)
  if (years.length !== endYear - startYear + 1) {
    throw new Error(
      `A projection from ${startYear} to ${endYear} must carry ${endYear - startYear + 1} rows to give a dollar basis; it carries ${years.length}`,
    )
  }
  const factors = years.map((row, index) => {
    const year = startYear + index
    if (row.year !== year) {
      throw new Error(`Projection row ${index} is year ${row.year}, not ${year}; a dollar basis needs contiguous years`)
    }
    const scale = row.inflationScale
    if (scale === undefined || !Number.isFinite(scale) || scale <= 0) {
      throw new Error(`Projection year ${year} publishes no usable inflationScale (${String(scale)}), so it has no dollar basis`)
    }
    return scale
  })
  return Object.freeze({ startYear, endYear, factors: Object.freeze(factors) })
}

/**
 * The ledger's deterministic recurrence for a surface that holds no
 * projection result: `f(startYear) = 1`, `f(y + 1) = f(y) * (1 + inflationPct / 100)`,
 * evaluated left to right exactly as `simulatePlan` builds `inflationScale`.
 */
export function planDollarBasis(inflationPct: number, startYear: number, endYear: number): DollarBasis {
  assertYearRange(startYear, endYear)
  if (!Number.isFinite(inflationPct) || inflationPct <= -100) {
    throw new RangeError(`Inflation must be a finite percent above -100; got ${inflationPct}`)
  }
  const r = inflationPct / 100
  const factors: number[] = [1]
  for (let year = startYear; year < endYear; year++) {
    factors.push(factors[factors.length - 1]! * (1 + r))
  }
  return Object.freeze({ startYear, endYear, factors: Object.freeze(factors) })
}

/** `f(year)`; a `RangeError` outside `[startYear, endYear]` or for a non-integer year. */
export function inflationFactor(basis: DollarBasis, year: number): number {
  if (!Number.isInteger(year) || year < basis.startYear || year > basis.endYear) {
    throw new RangeError(
      `Year ${year} is outside the projection's years ${basis.startYear} to ${basis.endYear}; no inflation factor is extrapolated`,
    )
  }
  return basis.factors[year - basis.startYear]!
}

/** A nominal amount in `year`, in start-year dollars: `nominal / f(year)`. */
export function toTodayDollars(basis: DollarBasis, year: number, nominal: number): number {
  return nominal / inflationFactor(basis, year)
}

/** A start-year amount, in `year`'s nominal dollars: `today * f(year)`. */
export function toNominalDollars(basis: DollarBasis, year: number, today: number): number {
  return today * inflationFactor(basis, year)
}

/**
 * A nominal amount shown in the page's mode: converted to start-year dollars
 * in 'today' mode, unchanged in 'nominal' mode (the year is range-checked in
 * both).
 */
export function nominalForDisplay(basis: DollarBasis, mode: DollarMode, year: number, nominal: number): number {
  if (mode === 'today') return toTodayDollars(basis, year, nominal)
  inflationFactor(basis, year)
  return nominal
}

/**
 * A start-year amount shown in the page's mode: unchanged in 'today' mode (the
 * year is still range-checked), converted to `year`'s dollars in 'nominal' mode.
 */
export function todayForDisplay(basis: DollarBasis, mode: DollarMode, year: number, today: number): number {
  if (mode === 'nominal') return toNominalDollars(basis, year, today)
  inflationFactor(basis, year)
  return today
}
