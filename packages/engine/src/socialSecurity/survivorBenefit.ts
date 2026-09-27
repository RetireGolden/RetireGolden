/**
 * Survivor (widow(er)) benefit — the shared, SSA-cited computation used by
 * **both** the actuarial PV view (`survivorSwitching.ts`) and the projection
 * ledger (`simulate.ts` survivor step-up + `maritalBenefits.ts` former-spouse
 * path), so the two can't drift (the gap-analysis row this closes was exactly
 * that drift: the PV view had a reduction, the ledger didn't).
 *
 * Rules encoded (see DOCS/domain/domain-rules-reference.md §4, each cited):
 *  - **Survivor base = the larger of the deceased's PIA and actual benefit**
 *    (42 U.S.C. 402(e)(2)(A) and (C)): the PIA for a deceased who claimed early
 *    (the early claim lowers the survivor only through the widow's limit below),
 *    and the actual benefit, with its delayed-retirement credits, for one who
 *    delayed past FRA.
 *  - **A worker who died without having claimed** was never paid, so the base
 *    is the benefit he would have received for the month before his death:
 *    the PIA plus the credits earned up to the death, with no early reduction
 *    (`neverClaimedDeceasedFactor` below).
 *  - **Early-claim widow(er) reduction**: claiming survivor between 60 and the
 *    survivor's FRA reduces the benefit by up to 28.5% at 60 (linear monthly
 *    proration) — a floor of 71.5% of the survivor base.
 *  - **RIB-LIM ("widow's limit")**, applied AFTER that reduction: when the
 *    deceased was ever entitled to an old-age benefit reduced for an early claim,
 *    a widow(er) benefit that is still above both the deceased's actual benefit
 *    and 82.5% of the deceased's PIA is cut to the larger of the two (42 U.S.C.
 *    402(e)(2)(D); POMS RS 00615.320 A.3). A deceased who never claimed, claimed
 *    at or after FRA, or was paid disability benefits has no limit.
 *
 * Inputs are monthly, today's dollars, pre-COLA/haircut; callers scale to the
 * annual COLA-adjusted frame they need. Illustrative, not a filing tool.
 */

import { delayedCreditMonthlyPct, delayedRetirementFactor } from './benefitFactor.js'
import type { ClaimAge } from './claimFactor.js'
import { attainedAgeMonthsInMonth, effectiveBirthYear, fraForBirthYear, fraTotalMonths, type DobParts } from './nra.js'

/** Earliest age a (non-disabled) widow(er) can claim survivor benefits. */
export const SURVIVOR_EARLIEST_AGE = 60
/** Maximum widow(er) reduction, applied at the earliest claim age (28.5% → 71.5% payable). */
export const SURVIVOR_MAX_REDUCTION = 0.285
/** RIB-LIM: the widow's-limit floor as a fraction of the deceased's PIA. */
export const WIDOW_LIMIT_PIA_FRACTION = 0.825

export interface SurvivorBenefitInput {
  /** The deceased worker's PIA (today's dollars, pre-COLA/haircut). */
  deceasedPiaMonthly: number
  /**
   * The deceased's actual monthly benefit = PIA × the deceased's claim factor
   * (claim-age-adjusted, including delayed-retirement credits), or, for a
   * worker who died without having claimed, PIA × `neverClaimedDeceasedFactor`.
   * Pre-COLA/haircut.
   */
  deceasedActualMonthly: number
  /**
   * Whether the deceased was ever entitled to an old-age benefit reduced for
   * claiming before full retirement age (42 U.S.C. 402(e)(2)(D); POMS RS
   * 00615.320 A.1). Only then does the RIB-LIM limit apply. False for a worker
   * who never claimed, claimed at or after full retirement age, or was paid
   * disability benefits. When omitted it is taken as `actual < PIA`, the one
   * reduction these inputs can carry. The flag cannot change a result: for a
   * deceased never reduced, the actual benefit is at least the PIA, so the
   * limit, the larger of that actual benefit and 82.5% of the PIA, is never
   * below the reduced base.
   */
  deceasedEverReduced?: boolean
  /** The survivor's claim age (years + months, ≥60) — months are honored. */
  survivorClaimAge: ClaimAge
  /** Survivor (widow(er)) FRA in total months — see `survivorFraForBirthYear`. */
  survivorFraMonths: number
}

/**
 * Widow(er) reduction factor for claiming survivor at `ageMonths` total months
 * (linear from a 28.5% reduction at age 60 to no reduction at the survivor's
 * FRA). 1.0 at/after FRA; 0.715 at/before 60. Accepts total months so a survivor
 * claiming at exactly their survivor FRA (e.g. 66y8m for born 1960) is not
 * reduced.
 */
export function survivorReductionFactor(ageMonths: number, survivorFraMonths: number): number {
  if (ageMonths >= survivorFraMonths) return 1
  const earliest = SURVIVOR_EARLIEST_AGE * 12
  if (ageMonths <= earliest) return 1 - SURVIVOR_MAX_REDUCTION
  const frac = (ageMonths - earliest) / (survivorFraMonths - earliest)
  return 1 - SURVIVOR_MAX_REDUCTION * (1 - frac)
}

/**
 * The survivor monthly benefit payable (today's dollars, pre-COLA/haircut).
 *
 * The widow(er) benefit is the deceased's PIA, deemed up to the deceased's
 * old-age benefit when that is larger (42 U.S.C. 402(e)(2)(A) and (C)), reduced
 * for the survivor's age (402(q)). Only then, and only when the deceased was
 * ever entitled to a reduced old-age benefit, does RIB-LIM apply: an amount
 * above both the deceased's actual benefit and 82.5% of the PIA is cut to the
 * larger of the two (402(e)(2)(D)), so
 * `min(max(PIA, actual) × factor, max(actual, 0.825 × PIA))`; otherwise the
 * benefit is `max(PIA, actual) × factor`. The survivor's claim-age **months**
 * are carried through (a survivor at exactly their survivor FRA is unreduced).
 * Returns 0 when the deceased had no PIA.
 */
export function survivorBenefitMonthly(input: SurvivorBenefitInput): number {
  if (input.deceasedPiaMonthly <= 0) return 0
  const ageMonths = input.survivorClaimAge.years * 12 + input.survivorClaimAge.months
  const reduced =
    Math.max(input.deceasedPiaMonthly, input.deceasedActualMonthly) *
    survivorReductionFactor(ageMonths, input.survivorFraMonths)
  if (!(input.deceasedEverReduced ?? input.deceasedActualMonthly < input.deceasedPiaMonthly)) return reduced
  return Math.min(
    reduced,
    Math.max(input.deceasedActualMonthly, WIDOW_LIMIT_PIA_FRACTION * input.deceasedPiaMonthly),
  )
}

/**
 * The deceased's benefit, as a fraction of PIA, for a worker who died without
 * ever having claimed: the old-age benefit he "would upon application have
 * received for the month prior to the month in which he died" (42 U.S.C.
 * 402(e)(2)(C)). Delayed retirement credits count from the month he attains
 * full retirement age up to but not including the month of death (20 CFR
 * 404.313(e)(1)) and stop before the month he attains 70 (402(w)(2)(A)), so a
 * death at or before full retirement age earns none. Each credit is worth the
 * percentage 20 CFR 404.313(b)(2) gives for his date of birth. No early-retirement
 * reduction applies, and the 402(e)(2)(D) limit cannot bind, because he was
 * never entitled to a reduced benefit: the factor is never below 1.
 *
 * Ages are counted as SSA counts them: a person attains an age on the day
 * before the birthday, so a birthday on the 1st attains each age in the month
 * before.
 */
export function neverClaimedDeceasedFactor(
  dob: { readonly year: number; readonly month: number; readonly day: number },
  deathYear: number,
  deathMonth: number,
): number {
  const ageMonthsAtDeath = attainedAgeMonthsInMonth(dob, deathYear, deathMonth)
  const effY = effectiveBirthYear(dob.year, dob.month, dob.day)
  const fraMonths = fraTotalMonths(fraForBirthYear(effY))
  const creditMonths = Math.min(ageMonthsAtDeath, 70 * 12) - fraMonths
  return delayedRetirementFactor(creditMonths, 70 * 12 - fraMonths, delayedCreditMonthlyPct(effY))
}

/**
 * The survivor's age, in total months, at the first month of widow(er)
 * entitlement under the ledger's one-claim-age model: the later of the
 * survivor's own configured claim month and January of the year after the
 * worker died, the first month the ledger pays a survivor benefit (it keeps the
 * worker alive through the whole year of the life age, so December of that year
 * is the ledger's month of death). The law could start entitlement with the
 * month of death itself (20 CFR 404.621(a)(4)(ii), "if you choose"), but the
 * ledger pays nothing for that month, so reducing from it would count a month
 * that buys no payment; January, the month after the death, is an equally
 * lawful first month. The one-claim-age model also starts the survivor benefit
 * no earlier than the survivor's own claim. 42 U.S.C. 402(q)(6)(A)(iii) begins
 * the reduction period "with the first day of the first month for which such
 * individual is entitled to such benefit or the first day of the month in which
 * such individual attains age 60, whichever is the later"; #survivorReductionFactor
 * supplies the age-60 floor. An own benefit claimed earlier does not carry its
 * months into the widow(er) benefit (402(q)(3)(E)). Pass the ORIGINAL configured
 * claim months: earnings-test credits for months the widow(er) benefit was
 * withheld are the caller's to add (402(q)(7)).
 */
export function widowEntitlementAgeMonths(
  survivorDob: DobParts,
  deathYear: number,
  survivorOwnClaimMonths: number,
): number {
  return Math.max(survivorOwnClaimMonths, attainedAgeMonthsInMonth(survivorDob, deathYear + 1, 1))
}

/** Convenience: a deceased claim age of "at/after FRA" (no early reduction, no DRCs). */
export const DECEASED_CLAIMED_AT_FRA: ClaimAge = { years: 67, months: 0 }
