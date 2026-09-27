/**
 * Dual entitlement to an own old-age benefit and a spouse's benefit: the one
 * composition every spouse path in the engine uses, for a current spouse
 * (annualSocialSecurity.ts, and the insight that reconstructs its prior year)
 * and for a divorced spouse (maritalBenefits.ts).
 *
 * 42 U.S.C. 402(q)(3)(B) reduces a wife's or husband's benefit by the old-age
 * reduction plus the reduction the spouse benefit would carry "if it were equal
 * to the excess of such wife's or husband's insurance benefit (before reduction
 * under this subsection) over such old-age insurance benefit (before reduction
 * under this subsection)", and 402(k)(3)(A) then offsets the reduced old-age
 * benefit against it, "but not below zero". The claimant is paid the own
 * benefit plus the separately reduced excess of half the worker's PIA over the
 * claimant's own PIA (POMS RS 00615.250). When the own benefit carries delayed
 * credits, the combined amount is computed without them and the own benefit
 * with them is subtracted from it (POMS RS 00615.694), so the claimant is paid
 * the larger of the two.
 *
 * The spouse factor is the spouse reduction for the claimant's age in the first
 * month of the spouse benefit (402(q)(6)(A)(ii)). With deemed filing (402(r),
 * for people who attain 62 after 2015, so births from January 2, 1954), a person
 * entitled to an own benefit is deemed to file for a spouse benefit in the first
 * month they are eligible for it: the later of their own claim and the first
 * month the worker's record supports it (#spouseEntitlementAgeMonths). For a
 * current spouse that is the month the worker's own benefit starts, under the
 * plan's claim-age convention (#claimStartMonthIndex, the same convention that
 * prices the worker's own benefit). For a divorced spouse whose ex need not have
 * filed it is the first month the ex is 62 throughout (POMS RS 00202.005 B.2.a,
 * #divorcedExFirstMonthIndex).
 *
 * Precondition: the spouse benefit does not start before the own benefit. For
 * anyone who attains 62 after 2015 that is the rule: deemed filing (402(r))
 * makes an application for either benefit an application for both, so a spouse
 * benefit is not paid before an own benefit the claimant is eligible for begins.
 * For earlier births, who could restrict an application to the spouse benefit,
 * the plan's one claim age still gives it: a spouse benefit is paid only from
 * the claimant's own claim. A spouse benefit entitled before the own benefit is
 * reduced by a different method (POMS RS 00615.020 method D, RS 00615.240) that
 * this composition does not cover.
 *
 * Inputs are monthly, in today's dollars, before COLA and any benefit haircut.
 */

import { spousalBenefitFactor } from './claimFactor.js'
import { attainedAgeZeroMonthIndex, effectiveBirthYear, fraForBirthYear, fraTotalMonths, type DobParts } from './nra.js'

export interface SpouseDualEntitlementInput {
  /** The claimant's own PIA; 0 for a claimant with no own benefit. */
  readonly ownPiaMonthly: number
  /**
   * The claimant's own old-age benefit as paid: the PIA after the claim factor
   * (early reduction or delayed credits, and any earnings-test credit), or 0.
   */
  readonly ownActualMonthly: number
  /** The unreduced spouse benefit: one half of the worker's PIA (402(b)(2), (c)(2)). */
  readonly spouseBaseMonthly: number
  /** The spouse reduction factor for the first month of the spouse benefit, 1 at or after FRA. */
  readonly spouseFactor: number
}

/**
 * The claimant's total monthly benefit when entitled to an own benefit and a
 * spouse benefit: `max(own, min(own, ownPia) + max(0, spouseBase - ownPia) x
 * spouseFactor)`. For an own benefit at or below the PIA this is the own
 * benefit plus the reduced excess; with delayed credits it is the larger of the
 * own benefit and the combined amount without them (POMS RS 00615.694). The
 * spouse benefit actually paid is this total less the own benefit.
 */
export function spouseDualEntitlementMonthly(input: SpouseDualEntitlementInput): number {
  const ownPia = Math.max(0, input.ownPiaMonthly)
  const own = Math.max(0, input.ownActualMonthly)
  const excess = Math.max(0, input.spouseBaseMonthly - ownPia)
  return Math.max(own, Math.min(own, ownPia) + excess * input.spouseFactor)
}

/**
 * The calendar month, as `year * 12 + (month - 1)`, in which a benefit claimed
 * at `claimAgeMonths` starts under the plan's claim-age convention: the month
 * that age is attained (a person attains an age on the day before the
 * birthday). The ledger prices a configured claim of 62 years 0 months as 60
 * months before a full retirement age of 67, which is this month.
 */
export function claimStartMonthIndex(dob: DobParts, claimAgeMonths: number): number {
  return attainedAgeZeroMonthIndex(dob) + claimAgeMonths
}

/**
 * The first month an ex-spouse who need not have filed supports a divorced
 * spouse's benefit: the first month the ex is 62 throughout. POMS RS 00202.005
 * B.2.a: "the NH must be 62 throughout the first month of entitlement but need
 * not have filed a claim for benefits". A person attains 62 on the day before the
 * 62nd birthday, so an ex born on the 2nd is 62 throughout the birth month; one
 * born on the 1st attains 62 on the last day of the month before and is 62
 * throughout the birth month too; anyone else attains 62 during the birth month
 * and is 62 throughout only from the next month.
 */
export function divorcedExFirstMonthIndex(exDob: DobParts): number {
  return attainedAgeZeroMonthIndex(exDob) + 62 * 12 + (exDob.day === 2 ? 0 : 1)
}

/**
 * The claimant's age, in total months, in the first month of the spouse
 * benefit: the later of the claimant's own claim and the claimant's age in the
 * month the worker's record first supports it, `workerStartMonthIndex`
 * (#claimStartMonthIndex for a current spouse, #divorcedExFirstMonthIndex for a
 * divorced spouse).
 */
export function spouseEntitlementAgeMonths(
  claimantDob: DobParts,
  claimantOwnClaimMonths: number,
  workerStartMonthIndex: number,
): number {
  return Math.max(claimantOwnClaimMonths, workerStartMonthIndex - attainedAgeZeroMonthIndex(claimantDob))
}

/**
 * The spouse reduction factor at an age in total months (at least 62 years):
 * 25/36 of 1 percent for each of the first 36 months before full retirement age
 * and 5/12 of 1 percent for each month beyond (#spousalBenefitFactor), and 1 at
 * or after full retirement age, whatever the age, since a spouse benefit earns no
 * delayed credits.
 */
export function spouseReductionFactorAtAgeMonths(dob: DobParts, ageMonths: number): number {
  const fraMonths = fraTotalMonths(fraForBirthYear(effectiveBirthYear(dob.year, dob.month, dob.day)))
  if (ageMonths >= fraMonths) return 1
  return spousalBenefitFactor(dob.year, dob.month, dob.day, { years: Math.floor(ageMonths / 12), months: ageMonths % 12 })
}
