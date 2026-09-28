/**
 * Retirement/survivor family maximum (MFB), using SSA's PIA-based formula.
 *
 * The worker's own benefit is never reduced by the family maximum; auxiliary
 * benefits payable on that worker's record share the room left after "an amount
 * equal to the primary insurance amount" of the worker (20 CFR 404.404; POMS
 * RS 00615.756 B.1, "Deduct PIA from maximum"), whatever the worker is paid: a
 * benefit raised by delayed credits or cut for an early claim leaves the same
 * room. RetireGolden models only the current-spouse auxiliary on a worker
 * record (no child dependents), so that whole room goes to the one spouse.
 *
 * @see https://www.ssa.gov/oact/cola/familymax.html
 */

import type { ClaimAge } from './claimFactor.js'
import { spouseDualEntitlementMonthly } from './dualEntitlement.js'
import { effectiveBirthYear } from './nra.js'
import { familyMaximumBendPointsForEligibilityYearOrLatest } from './ssaWageData.js'

function floorToDime(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10
}

/** Year of eligibility for the retirement/survivor family maximum. */
export function familyMaximumEligibilityYearFromDobParts(year: number, month: number, day: number): number {
  return effectiveBirthYear(year, month, day) + 62
}

/**
 * Monthly family maximum for a retirement/survivor worker record, before COLA
 * and trust-fund haircut: 150% of the PIA up to the eligibility year's first
 * family-maximum bend point, plus 272% of the slice up to the second, plus
 * 134% of the slice up to the third, plus 175% of the PIA above the third,
 * floored to the dime (the SSA formula at ssa.gov/oact/cola/familymax.html).
 * The bend points come from FAMILY_MAXIMUM_BEND_POINTS in ssaWageData.ts.
 */
export function familyMaximumMonthlyFromPia(piaMonthly: number, eligibilityYear: number): number {
  if (piaMonthly <= 0) return 0
  const bp = familyMaximumBendPointsForEligibilityYearOrLatest(eligibilityYear)
  const first = Math.min(piaMonthly, bp.first)
  const second = Math.max(0, Math.min(piaMonthly, bp.second) - bp.first)
  const third = Math.max(0, Math.min(piaMonthly, bp.third) - bp.second)
  const above = Math.max(0, piaMonthly - bp.third)
  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34 + above * 1.75)
}

export interface AuxiliaryFamilyMaximumInput {
  /** Worker PIA on whose record the auxiliary is paid, today's dollars. */
  workerPiaMonthly: number
  /** Worker date of birth, used to pick the eligibility-year bend points. */
  workerDob: { year: number; month: number; day: number }
  /** Proposed auxiliary benefit on the worker record, before COLA/haircut. */
  auxiliaryMonthly: number
  /**
   * The family maximum to apply, for a caller that has one other than the
   * retirement and survivor maximum (the disability maximum of 20 CFR
   * 404.403(d-1), for example). Omitted, it is familyMaximumMonthlyFromPia at
   * the worker's eligibility year. The ledger passes none, so a worker on SSDI
   * gets the retirement and survivor maximum too
   * (usc-42-403-a-6-ssdi-family-maximum).
   */
  familyMaximumMonthly?: number
}

/**
 * Cap a single auxiliary benefit to the room under the worker's MFB: the
 * family maximum less the worker's PIA (20 CFR 404.404), not less the benefit
 * the worker is paid. With no child benefits modeled, this is the whole
 * current-spouse allocation. Under the retirement and survivor maximum, which
 * is at least 150 percent of the PIA before it is floored to the dime, the
 * room is at least half the PIA less that rounding (under 10 cents a month),
 * so a single spouse's original benefit fits in it within those cents. The
 * disability maximum can be as low as the PIA itself and leave no room at all;
 * the engine does not model it (usc-42-403-a-6-ssdi-family-maximum).
 */
export function capAuxiliaryForFamilyMaximum(input: AuxiliaryFamilyMaximumInput): number {
  if (input.auxiliaryMonthly <= 0 || input.workerPiaMonthly <= 0) return 0
  const eligibilityYear = familyMaximumEligibilityYearFromDobParts(
    input.workerDob.year,
    input.workerDob.month,
    input.workerDob.day,
  )
  const familyMaximum = input.familyMaximumMonthly ?? familyMaximumMonthlyFromPia(input.workerPiaMonthly, eligibilityYear)
  const roomForAuxiliaries = Math.max(0, familyMaximum - input.workerPiaMonthly)
  return Math.min(input.auxiliaryMonthly, roomForAuxiliaries)
}

export interface CurrentSpouseFamilyMaximumInput {
  /** Worker PIA on whose record the spouse benefit is paid. */
  workerPiaMonthly: number
  /** Worker date of birth, for the eligibility-year bend points. */
  workerDob: { year: number; month: number; day: number }
  /** As in AuxiliaryFamilyMaximumInput; omitted, the retirement and survivor maximum. */
  familyMaximumMonthly?: number
  /** The spouse's own PIA; 0 for a spouse with no own benefit. */
  ownPiaMonthly: number
  /** The spouse's own benefit as paid, or 0. */
  ownActualMonthly: number
  /** The spouse reduction factor for the first month of the spouse benefit, 1 at or after FRA. */
  spouseFactor: number
}

/**
 * A current spouse's total monthly benefit, own benefit included, in the
 * regulation's order. The original spouse benefit, one half of the worker's
 * PIA, is held to the family maximum room first; the spouse's own PIA is then
 * subtracted and the excess reduced for age, and the own benefit added back
 * (spouseDualEntitlementMonthly). 20 CFR 404.410(b): the spouse's benefits
 * "before any reduction ... are reduced first (if necessary) for the family
 * maximum" and "then reduced based on the number of months of entitlement";
 * POMS RS 00615.010 reduces "the spouse's benefit (adjusted for the maximum if
 * necessary)"; 404.403(a)(5) Example 1 subtracts the dual-entitlement
 * reduction from the "benefit, reduced for maximum". Capping the reduced
 * excess instead pays more whenever the room is below half the PIA.
 */
export function currentSpouseMonthlyUnderFamilyMaximum(input: CurrentSpouseFamilyMaximumInput): number {
  const spouseBaseMonthly = capAuxiliaryForFamilyMaximum({
    workerPiaMonthly: input.workerPiaMonthly,
    workerDob: input.workerDob,
    auxiliaryMonthly: 0.5 * input.workerPiaMonthly,
    ...(input.familyMaximumMonthly === undefined ? {} : { familyMaximumMonthly: input.familyMaximumMonthly }),
  })
  return spouseDualEntitlementMonthly({
    ownPiaMonthly: input.ownPiaMonthly,
    ownActualMonthly: input.ownActualMonthly,
    spouseBaseMonthly,
    spouseFactor: input.spouseFactor,
  })
}

export function claimAgeTotalMonths(claimAge: ClaimAge): number {
  return claimAge.years * 12 + claimAge.months
}
