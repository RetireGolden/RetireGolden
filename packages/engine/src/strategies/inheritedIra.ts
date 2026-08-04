/**
 * Inherited (beneficiary) IRA 10-year rule (roadmap V8, §4 tax depth).
 *
 * Post-SECURE-Act, a non-spouse beneficiary must empty an inherited IRA by the
 * end of the 10th year after the original owner's death. If the owner had
 * already reached their required beginning date (RBD) — i.e. had started RMDs —
 * the beneficiary must ALSO take an annual RMD in years 1–9, because the
 * at-least-as-rapidly rule of section 401(a)(9)(B)(i) survives the death. If
 * the owner died before their RBD, no annual RMD is required during the window;
 * the only requirement is to be empty by year 10.
 *
 * Inherited-IRA distributions are taxable ordinary income but are NEVER subject
 * to the 10% early-withdrawal penalty, regardless of the beneficiary's age.
 *
 * The annual divisor is the beneficiary's remaining life expectancy from the
 * Single Life Table of Treas. Reg. 1.401(a)(9)-9(b), carried in the parameter
 * pack. Treas. Reg. 1.401(a)(9)-5(d)(3)(i) is explicit that "all life
 * expectancies are determined using the Single Life Table in § 1.401(a)(9)-9(b)"
 * — that table and no other. It is unisex, which is why nothing here takes a
 * sex: an SSA period table indexed by sex is not the prescribed table, and the
 * divisor it produces is not the prescribed number.
 *
 * The expectancy is FIXED, not recalculated. Under 1.401(a)(9)-5(d)(3)(iii) a
 * non-spouse designated beneficiary reads the table once, at the age reached in
 * the calendar year FOLLOWING the year of death, and then reduces that entry by
 * one for each later calendar year. Only a surviving spouse who is the sole
 * beneficiary redetermines annually, under (d)(3)(iv) — and a surviving spouse
 * does not hold an inherited IRA at all under IRC 408(d)(3)(C)(ii), so the
 * subtract-one method is the only one an account reaching this module can use.
 *
 * NOT modelled: the greater-of test of 1.401(a)(9)-5(d)(1)(ii), which takes the
 * greater of the beneficiary's and the EMPLOYEE's remaining life expectancy.
 * The plan model records the year the owner died but never their age, so the
 * decedent's expectancy cannot be looked up at all. See the registry record
 * treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy for the
 * direction of the resulting error.
 */

import { singleLifeExpectancyYears } from '../params/index.js'
import type { ParameterPack } from '../params/types.js'

/** The account must be fully distributed by the END of this year. */
export function inheritedTenYearDeadline(ownerDeathYear: number): number {
  return ownerDeathYear + 10
}

/**
 * The calendar year the beneficiary's fixed life expectancy is read at: the
 * calendar year following the calendar year of the employee's death, which is
 * the year 1.401(a)(9)-5(d)(3)(iii) names for the initial table lookup and
 * measures its subtract-one reductions from.
 */
export function beneficiaryFirstDistributionYear(ownerDeathYear: number): number {
  return ownerDeathYear + 1
}

/**
 * The beneficiary's remaining life expectancy for `year`, per Treas. Reg.
 * 1.401(a)(9)-5(d)(3)(i) and (d)(3)(iii): the Single Life Table entry for the
 * age the beneficiary reaches in the first distribution calendar year, reduced
 * by one for each calendar year elapsed since that year.
 *
 * May return zero or a negative number once the fixed entry has been exhausted;
 * the caller decides what that means for the distribution.
 */
export function beneficiaryRemainingLifeExpectancy(
  pack: ParameterPack,
  input: { year: number; ownerDeathYear: number; beneficiaryAge: number },
): number {
  const elapsed = input.year - beneficiaryFirstDistributionYear(input.ownerDeathYear)
  // `beneficiaryAge` is the age attained in `year`; walk it back to the age
  // attained in the first distribution year, which is the only age the table is
  // ever read at for this account.
  const ageInFirstYear = input.beneficiaryAge - elapsed
  return singleLifeExpectancyYears(pack, ageInFirstYear) - elapsed
}

export interface InheritedForcedInput {
  /** Parameter pack supplying the Single Life Table. */
  pack: ParameterPack
  /** Current projection year. */
  year: number
  /** Calendar year the original owner died. */
  ownerDeathYear: number
  /** Did the decedent reach their RBD (had started RMDs)? Drives years 1–9. */
  decedentHadStartedRmds: boolean
  /** Current account balance. */
  balance: number
  /** Start-of-year balance, used for the annual-RMD divisor. */
  startBalance: number
  /** Beneficiary's attained age this year. */
  beneficiaryAge: number
}

/**
 * The forced distribution required from an inherited IRA this year:
 *   - the full remaining balance in (and after) the 10th year — the final sweep;
 *   - an annual single-life RMD in years 1–9 when the decedent had started RMDs;
 *   - otherwise 0 (the beneficiary may still withdraw voluntarily).
 * Never exceeds the current balance.
 */
export function inheritedForcedAmount(input: InheritedForcedInput): number {
  const { year, ownerDeathYear, balance } = input
  if (balance <= 0 || year <= ownerDeathYear) return 0

  if (year >= inheritedTenYearDeadline(ownerDeathYear)) return balance // empty it by year 10

  if (input.decedentHadStartedRmds) {
    const le = beneficiaryRemainingLifeExpectancy(input.pack, input)
    // A fixed expectancy that has run out leaves nothing to divide by, so the
    // entire remaining interest is due. Reachable only for a beneficiary past
    // about age 110 when they inherit, since the window is at most nine years.
    if (le <= 0) return balance
    return Math.min(input.startBalance / le, balance)
  }
  return 0
}
