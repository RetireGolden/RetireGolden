/**
 * Required minimum distributions (SECURE 2.0).
 *
 * Uses the Uniform Lifetime Table, except when the sole-beneficiary spouse is
 * more than 10 years younger — then the Joint Life & Last Survivor expectancy
 * applies (a larger divisor → smaller RMD), from IRS Pub 590-B Table II.
 * Inherited-account 10-year rules and the first-year April 1 deferral are later
 * phases (the RMD is taken in the age-attained year).
 * Roth IRAs and Roth 401(k)s (since 2024) have no lifetime RMDs.
 *
 * @see DOCS/domain/domain-rules-reference.md §6
 */

import type { Sex } from '../montecarlo/mortality'
import { rmdStartAgeForBirthYear, uniformLifetimeDivisor } from '../params'
import type { ParameterPack } from '../params/types'
import { jointLifeTableDivisor } from './jointLifeTable'

export interface RmdSpouse {
  ageAttained: number
  sex: Sex
}

export interface RmdOptions {
  /** Kept for API compatibility; IRS Table II is not sex-specific. */
  ownerSex?: Sex
  /** Sole-beneficiary spouse, if any; triggers the Joint Life table when >10 yrs younger. */
  spouse?: RmdSpouse
}

/**
 * RMD for one traditional account-year.
 * `priorYearEndBalance` is the Dec 31 balance of the previous year.
 */
export function requiredMinimumDistribution(
  pack: ParameterPack,
  birthYear: number,
  ageAttained: number,
  priorYearEndBalance: number,
  opts: RmdOptions = {},
): number {
  if (priorYearEndBalance <= 0) return 0
  if (ageAttained < rmdStartAgeForBirthYear(birthYear)) return 0
  let divisor = uniformLifetimeDivisor(pack, ageAttained)
  if (divisor === undefined || divisor <= 0) return 0
  // Joint Life & Last Survivor table when the spouse beneficiary is >10 yrs younger.
  if (opts.spouse && ageAttained - opts.spouse.ageAttained > 10) {
    const joint = jointLifeTableDivisor(ageAttained, opts.spouse.ageAttained)
    if (joint !== undefined) divisor = Math.max(divisor, joint)
  }
  return priorYearEndBalance / divisor
}
