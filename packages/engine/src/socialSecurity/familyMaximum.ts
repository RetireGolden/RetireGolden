/**
 * The family maximum (MFB) on a worker record: SSA's PIA-based retirement and
 * survivor formula, and, while the worker is entitled to disability insurance
 * benefits, the disability maximum of 42 U.S.C. 403(a)(6).
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
import { piaWithCostOfLivingIncreases, type PiaAsOf, type ResolvedStreamPia } from './piaFromEarnings.js'
import { familyMaximumBendPointsForEligibilityYearOrLatest } from './ssaWageData.js'

function floorToDime(value: number): number {
  return Math.floor(value * 10 + 1e-9) / 10
}

/** The year a worker attains 62 (the effective birth year plus 62): his year of eligibility absent a disability. */
export function familyMaximumEligibilityYearFromDobParts(year: number, month: number, day: number): number {
  return effectiveBirthYear(year, month, day) + 62
}

/**
 * The year of eligibility the retirement and survivor maximum takes its bend
 * points from. 20 CFR 404.403(a)(2) counts the year of death, of attaining 62
 * or of the beginning of a current disability, "whichever is earlier", and
 * 42 U.S.C. 403(a)(2)(D) does not count the year of attaining 62 when the
 * worker was entitled to disability benefits in any of the 12 months before,
 * counting instead the year of eligibility for that disability benefit. A
 * disability benefit in the plan runs without a break from its first payable
 * month to the full-retirement-age month, so for a worker with one the year
 * of eligibility is the earlier of the year the disability began and the year
 * he attains 62: before 62 the disability year counts either way, and a
 * disability that begins after the year of 62 leaves that year in place.
 * `disabilityOnsetYear` is null for a worker the plan gives no disability
 * benefit (no disability month payable before full retirement age).
 */
export function familyMaximumEligibilityYear(
  dob: { year: number; month: number; day: number },
  disabilityOnsetYear: number | null,
): number {
  const attainsSixtyTwo = familyMaximumEligibilityYearFromDobParts(dob.year, dob.month, dob.day)
  return disabilityOnsetYear === null ? attainsSixtyTwo : Math.min(disabilityOnsetYear, attainsSixtyTwo)
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

/**
 * The family maximum on the record of a worker entitled to disability
 * insurance benefits, 42 U.S.C. 403(a)(6) and 20 CFR 404.403(d-1): the smaller
 * of 85 percent of the AIME (or 100 percent of the PIA, if larger) and 150
 * percent of the PIA, in the dollars of the year of eligibility the AIME and
 * PIA are computed for. Neither the statute nor the regulation rounds it; a
 * later cost-of-living increase does (#disabilityFamilyMaximumAtStart).
 *
 * `aimeMonthly` null is a worker whose PIA the plan holds without the AIME it
 * was computed from (an entered PIA). The engine then takes the 150 percent
 * ceiling, the largest maximum the statute allows for that PIA, which leaves a
 * single spouse room for half the PIA
 * (usc-42-403-a-6-ssdi-family-maximum, needs-fact).
 */
export function disabilityFamilyMaximumMonthly(piaMonthly: number, aimeMonthly: number | null): number {
  if (piaMonthly <= 0) return 0
  const ceiling = 1.5 * piaMonthly
  if (aimeMonthly === null) return ceiling
  return Math.min(Math.max(0.85 * aimeMonthly, piaMonthly), ceiling)
}

/**
 * The disability maximum for a stream whose PIA the earnings history gives, in
 * the dollars of the projection's first year: #disabilityFamilyMaximumMonthly on
 * the computation's own AIME and eligibility-year PIA, raised by the same
 * cost-of-living increases the PIA is raised by, each decreased to the next
 * lower multiple of $0.10 (42 U.S.C. 415(i)(2)(A)(ii) increases "the amount
 * of total monthly benefits based on any primary insurance amount which is
 * permitted under section 203" with the PIA; 403(a)(6) is "subject to"
 * it). Null for an entered PIA, which comes with no AIME.
 */
export function disabilityFamilyMaximumAtStart(resolved: ResolvedStreamPia, asOf: PiaAsOf): number | null {
  if (resolved.status !== 'fromEarnings') return null
  const atEligibility = disabilityFamilyMaximumMonthly(resolved.detail.piaMonthly, resolved.detail.aime)
  return piaWithCostOfLivingIncreases(atEligibility, resolved.detail.eligibilityYear, asOf.startYear - 1, asOf.colaAssumptionPct).piaMonthly
}

/** A worker's disability benefit, as the family maximum on his record reads it. */
export interface WorkerDisabilityForMaximum {
  /** The calendar year the disability began (the birth year plus `onsetAge`). */
  readonly onsetYear: number
  /** The first month the disability benefit is payable, as `year * 12 + (month - 1)`. */
  readonly firstPayableMonthIndex: number
  /** The full-retirement-age month, from which the benefit is the converted old-age benefit. */
  readonly fraMonthIndex: number
  /** #disabilityFamilyMaximumMonthly for the worker, in the PIA's dollars. */
  readonly disabilityMaximumMonthly: number
}

/**
 * The family maximum on a worker record in a month (`year * 12 + (month - 1)`).
 * While the worker is entitled to disability benefits, from the first payable
 * month to the month before full retirement age (42 U.S.C. 423(a)(1)), it is
 * the disability maximum (403(a)(6)). Otherwise it is the retirement and
 * survivor maximum on the bend points of #familyMaximumEligibilityYear, which,
 * after the disability benefit converts at full retirement age, is the year of
 * eligibility for the disability benefit: 20 CFR 404.403(g)(3) computes the
 * maximum after that second entitlement "without regard to" the disability
 * maximum, and 403(a)(2)(D) supplies the year.
 */
export function workerFamilyMaximumMonthlyAt(
  worker: {
    readonly piaMonthly: number
    readonly dob: { year: number; month: number; day: number }
    readonly disability: WorkerDisabilityForMaximum | null
  },
  monthIndex: number,
): number {
  const disability = worker.disability
  if (disability !== null && monthIndex >= disability.firstPayableMonthIndex && monthIndex < disability.fraMonthIndex) {
    return disability.disabilityMaximumMonthly
  }
  return familyMaximumMonthlyFromPia(worker.piaMonthly, familyMaximumEligibilityYear(worker.dob, disability?.onsetYear ?? null))
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
   * retirement and survivor maximum at the year the worker attains 62: the
   * ledger passes #workerFamilyMaximumMonthlyAt, which is the disability
   * maximum of 20 CFR 404.403(d-1) while the worker is entitled to disability
   * benefits. Omitted, it is familyMaximumMonthlyFromPia at the year the
   * worker attains 62.
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
 * disability maximum can be as low as the PIA itself and leave no room at all
 * (#disabilityFamilyMaximumMonthly).
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
