/**
 * "What you paid in vs. what you get back" — a pure education/context readout
 * for Social Security, NOT a working-years tax inside the projection (the engine
 * never taxes pre-retirement wages; this is an analysis helper called from the SS
 * analysis panel). Cited in DOCS/domain/domain-rules-reference.md §4.
 *
 * - **Paid in** = the OASDI (Social Security portion) payroll tax over the
 *   entered earnings history, capped at each year's taxable wage base. Employee
 *   share = 6.2%; self-employed = 12.4% (employee + employer combined). The 1.45%
 *   Medicare HI is intentionally excluded (the "get back" side is the SS
 *   benefit, not Medicare). The employer's 6.2% is returned as optional context.
 * - **Get back** reuses the tested `expectedPvSingle` path (mortality-weighted
 *   expected PV at the chosen claim age), so the "return" is the survival-
 *   weighted PV of lifetime benefits in today's dollars.
 *
 * Documented simplifications: the OASDI rate is applied uniformly over the
 * career (historical rates were slightly lower pre-1990); the self-employed
 * half-deductibility of SE tax is ignored; the figure is an individual-level
 * illustration, not the program's actuarial return, and excludes disability and
 * survivor insurance value, spousal benefits, and the Medicare portion.
 */

import { WAGE_BASE_BY_YEAR } from './ssaWageData'

export interface FicaPaidInResult {
  /** Employee (or self-employed total) OASDI paid over the earnings history, today's $. */
  paidIn: number
  /** Employer-side OASDI (context only; 0 for self-employed since it's in paidIn). */
  employerPaid: number
}

export interface FicaPaidInOptions {
  /** Employee-side OASDI rate as a percent (e.g. 6.2). From the parameter pack. */
  oasdiEmployeeRatePct: number
  /** Self-employed ⇒ paidIn doubles (employee + employer combined = 12.4%). */
  selfEmployed: boolean
  /**
   * Per-year OASDI taxable wage base. Defaults to the SSA historical series
   * (`WAGE_BASE_BY_YEAR`); the caller may override (e.g., a grown future cap).
   */
  wageBaseByYear?: Readonly<Record<number, number>>
  /** Wage base for earnings years beyond the table (defaults to the latest known). */
  wageBaseFallback?: number
}

/**
 * Sum the OASDI payroll tax over an earnings history (employee or self-employed),
 * capped at each year's taxable wage base. Today's dollars (nominal history; no
 * indexing — this is "what you literally paid," not wage-indexed like AIME).
 */
export function ficaOasdiPaidIn(
  earnings: ReadonlyArray<{ year: number; amount: number }>,
  opts: FicaPaidInOptions,
): FicaPaidInResult {
  const table = opts.wageBaseByYear ?? WAGE_BASE_BY_YEAR
  const fallback = opts.wageBaseFallback ?? latestWageBase(table)
  const rate = opts.oasdiEmployeeRatePct / 100
  let employee = 0
  let employer = 0
  for (const { year, amount } of earnings) {
    if (amount <= 0) continue
    const cap = table[year] ?? fallback
    const capped = cap > 0 ? Math.min(amount, cap) : amount
    if (opts.selfEmployed) {
      employee += capped * rate * 2 // 12.4% total (employee + employer)
    } else {
      employee += capped * rate // 6.2% employee
      employer += capped * rate // 6.2% employer (context)
    }
  }
  return { paidIn: employee, employerPaid: opts.selfEmployed ? 0 : employer }
}

function latestWageBase(table: Readonly<Record<number, number>>): number {
  let latest = 0
  for (const y of Object.keys(table)) {
    const year = Number(y)
    if (Number.isFinite(year) && table[year]! > latest) latest = table[year]!
  }
  return latest
}
