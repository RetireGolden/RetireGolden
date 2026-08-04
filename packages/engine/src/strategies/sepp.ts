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
 *                     interest rate. IRS Notice 2022-6 section 3.02(c) permits
 *                     any rate at or below the GREATER of 5% or 120% of the
 *                     federal mid-term rate, so the flat 5% used here clears
 *                     the ceiling in every rate environment. (The bare
 *                     120%-of-mid-term cap with no 5% leg was the rule of Rev.
 *                     Rul. 2002-62, which Notice 2022-6 modified and
 *                     superseded; under it a flat 5% would have been
 *                     impermissible in a low-rate year.)
 *
 * The life-expectancy divisor is the Single Life Table of Treas. Reg.
 * 1.401(a)(9)-9(b), carried in the parameter pack. Notice 2022-6 section
 * 3.02(a) permits exactly three tables — the Uniform Lifetime Table in its
 * Appendix A, that Single Life Table, and the Joint and Last Survivor Table of
 * 1.401(a)(9)-9(d) — and Single Life is both the natural table for a
 * single-life series and the shortest of the three, so it produces the smallest
 * permitted payment. All three are unisex, which is why nothing here takes a
 * sex: an SSA period table indexed by sex is not among them, and the divisor it
 * produces is not a permitted number.
 */

import { singleLifeExpectancyYears } from '../params/index.js'
import type { ParameterPack } from '../params/types.js'

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
  pack: ParameterPack,
  method: SeppMethod,
  balance: number,
  age: number,
  ratePct = SEPP_AMORTIZATION_RATE_PCT,
): number {
  if (balance <= 0) return 0
  const lifeExpectancy = singleLifeExpectancyYears(pack, age)
  if (method === 'rmd') return balance / lifeExpectancy
  // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
  // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
  const r = ratePct / 100
  if (r === 0) return balance / lifeExpectancy
  return (balance * r) / (1 - Math.pow(1 + r, -lifeExpectancy))
}
