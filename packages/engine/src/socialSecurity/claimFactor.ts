/**
 * Monthly-granularity claiming factor for the v2 engine.
 *
 * Reuses the FRA schedule and reduction/credit math in this directory, which
 * already works in months — v1 only ever called it with whole-year claim
 * ages. The projection engine (engine/projection/simulate.ts) imports this
 * module directly; it must stay pure (no UI, storage, or DOM access).
 */

import { delayedRetirementFactor, earlyRetirementFactor } from './benefitFactor.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths } from './nra.js'

export interface ClaimAge {
  years: number
  months: number
}

/**
 * Retirement benefit as a fraction of PIA for claiming at `claimAge`
 * (62y0m–70y0m), for a person born on the given date.
 */
export function claimFactor(dobYear: number, dobMonth: number, dobDay: number, claimAge: ClaimAge): number {
  const claimM = claimAge.years * 12 + claimAge.months
  if (claimM < 62 * 12 || claimM > 70 * 12) {
    throw new RangeError('claim age must be between 62y0m and 70y0m')
  }
  const effY = effectiveBirthYear(dobYear, dobMonth, dobDay)
  const fraM = fraTotalMonths(fraForBirthYear(effY))
  const maxDrcMonths = Math.max(0, 70 * 12 - fraM)

  if (claimM < fraM) return earlyRetirementFactor(fraM - claimM)
  if (claimM > fraM) return delayedRetirementFactor(claimM - fraM, maxDrcMonths)
  return 1
}

/**
 * Spousal benefit as a fraction of the worker's PIA (so the spousal benefit is
 * this × 0.5 × workerPIA at FRA, before the reduction below).
 *
 * Key differences from the retirement factor: the spousal benefit earns **no
 * delayed retirement credits** (it tops out at FRA), and the early-claim
 * reduction schedule is steeper — 25/36 of 1% per month for the first 36
 * months early, then 5/12 of 1% per month beyond that.
 *
 * Simplifications (deemed-filing era, born 1954+): assumes the worker has
 * already filed so the spouse is eligible, and ignores the spouse's own
 * earnings-test interaction. Returns the fraction to apply to 0.5 × workerPIA.
 *
 * @see https://www.ssa.gov/benefits/retirement/planner/applying7.html
 */
export function spousalBenefitFactor(dobYear: number, dobMonth: number, dobDay: number, claimAge: ClaimAge): number {
  const claimM = claimAge.years * 12 + claimAge.months
  if (claimM < 62 * 12 || claimM > 70 * 12) {
    throw new RangeError('claim age must be between 62y0m and 70y0m')
  }
  const effY = effectiveBirthYear(dobYear, dobMonth, dobDay)
  const fraM = fraTotalMonths(fraForBirthYear(effY))
  if (claimM >= fraM) return 1 // no delayed credits on spousal benefits
  const monthsEarly = fraM - claimM
  const first = Math.min(36, monthsEarly)
  const beyond = Math.max(0, monthsEarly - 36)
  const reductionPct = first * (25 / 36) + beyond * (5 / 12)
  return Math.max(0, 1 - reductionPct / 100)
}
