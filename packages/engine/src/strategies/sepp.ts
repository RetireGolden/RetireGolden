/**
 * 72(t) Substantially Equal Periodic Payments (roadmap V8, §4 tax depth).
 *
 * A 72(t) SEPP lets someone tap a traditional IRA/401(k) before 59½ without the
 * 10% early-withdrawal penalty, IF they take a fixed series of "substantially
 * equal" payments for the LONGER of five years or until age 59½. Modifying the
 * series early triggers retroactive penalties; the engine assumes the schedule
 * is honored (it doesn't model busting).
 *
 * Two of the three IRS-sanctioned methods are supported:
 *   - 'rmd':          payment = balance ÷ life-expectancy divisor, recomputed
 *                     each year (varies with the balance).
 *   - 'amortization': payment fixed at the first SEPP year, amortizing that
 *                     year's balance over the life expectancy at the chosen
 *                     interest rate (IRS Notice 2022-6 allows up to 120% of the
 *                     federal mid-term AFR; we use a flat assumed rate).
 *
 * The life-expectancy divisor uses the repo's SSA period table
 * (`baselineRemainingYears`) as a documented proxy for the IRS Single Life
 * Table — close enough for a planning tool and avoids carrying a second table.
 */

import type { Sex } from '../longevity/types.js'
import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'

export type SeppMethod = 'rmd' | 'amortization'

/** Assumed 72(t) interest rate for the amortization method (the common 5% floor). */
export const SEPP_AMORTIZATION_RATE_PCT = 5

/**
 * A SEPP must run for the LONGER of 5 years or until age 59½ (≈ the engine's
 * age-60 penalty boundary). Active in the year the owner attains `age` when the
 * election has started and neither condition has yet been satisfied.
 */
export function seppActive(startAge: number, age: number): boolean {
  if (age < startAge) return false
  return age < 60 || age - startAge < 5
}

/**
 * The penalty-free SEPP distribution for the year, by method.
 *  - rmd:          `balance` is the current start-of-year balance.
 *  - amortization: `balance` is the FIRST SEPP year's balance and `age` should
 *                  be `startAge`; the result is fixed for the whole series.
 */
export function seppAnnualAmount(
  method: SeppMethod,
  balance: number,
  age: number,
  sex: Sex,
  ratePct = SEPP_AMORTIZATION_RATE_PCT,
): number {
  if (balance <= 0) return 0
  const lifeExpectancy = Math.max(1, baselineRemainingYears(age, sex))
  if (method === 'rmd') return balance / lifeExpectancy
  // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
  // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
  const r = ratePct / 100
  if (r === 0) return balance / lifeExpectancy
  return (balance * r) / (1 - Math.pow(1 + r, -lifeExpectancy))
}
