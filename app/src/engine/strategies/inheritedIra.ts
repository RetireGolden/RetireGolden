/**
 * Inherited (beneficiary) IRA 10-year rule (roadmap V8, §4 tax depth).
 *
 * Post-SECURE-Act, a non-spouse beneficiary must empty an inherited IRA by the
 * end of the 10th year after the original owner's death. If the owner had
 * already reached their required beginning date (RBD) — i.e. had started RMDs —
 * the beneficiary must ALSO take an annual RMD in years 1–9, based on their own
 * single life expectancy ("at least as rapidly", per the 2024 final regs). If
 * the owner died before their RBD, no annual RMD is required during the window;
 * the only requirement is to be empty by year 10.
 *
 * Inherited-IRA distributions are taxable ordinary income but are NEVER subject
 * to the 10% early-withdrawal penalty, regardless of the beneficiary's age.
 *
 * The single-life divisor uses the repo's SSA period table
 * (`baselineRemainingYears`) as a documented proxy for the IRS Single Life
 * Table, and is recomputed each year rather than using the strict subtract-one
 * method — a small, documented simplification consistent with the SEPP module.
 */

import type { Sex } from '../../longevity/types'
import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'

/** The account must be fully distributed by the END of this year. */
export function inheritedTenYearDeadline(ownerDeathYear: number): number {
  return ownerDeathYear + 10
}

export interface InheritedForcedInput {
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
  beneficiarySex: Sex
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
    const le = Math.max(1, baselineRemainingYears(input.beneficiaryAge, input.beneficiarySex))
    return Math.min(input.startBalance / le, balance)
  }
  return 0
}
