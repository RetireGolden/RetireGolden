/**
 * Survivor (widow(er)) benefit — the shared, SSA-cited computation used by
 * **both** the actuarial PV view (`survivorSwitching.ts`) and the projection
 * ledger (`simulate.ts` survivor step-up + `maritalBenefits.ts` former-spouse
 * path), so the two can't drift (the gap-analysis row this closes was exactly
 * that drift: the PV view had a reduction, the ledger didn't).
 *
 * Rules encoded (see DOCS/domain/domain-rules-reference.md §4, each cited):
 *  - **Survivor base = the deceased's actual (claim-age-adjusted) benefit**,
 *    including the deceased's delayed-retirement credits when the deceased
 *    delayed past FRA (not flat PIA).
 *  - **RIB-LIM ("widow's limit")**: when the deceased claimed reduced benefits
 *    early, the survivor is capped at the larger of the deceased's actual
 *    reduced benefit or 82.5% of the deceased's PIA — equivalently
 *    `max(deceasedActual, 0.825 × PIA)`, which both floors the survivor when the
 *    deceased claimed early and passes delayed credits through when the deceased
 *    delayed.
 *  - **Early-claim widow(er) reduction**: claiming survivor between 60 and the
 *    survivor's FRA reduces the benefit by up to 28.5% at 60 (linear monthly
 *    proration) — a floor of 71.5% of the survivor base.
 *
 * Inputs are monthly, today's dollars, pre-COLA/haircut; callers scale to the
 * annual COLA-adjusted frame they need. Illustrative, not a filing tool.
 */

import type { ClaimAge } from './claimFactor'

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
   * (claim-age-adjusted, including delayed-retirement credits). Pre-COLA/haircut.
   */
  deceasedActualMonthly: number
  /** The survivor's claim age (years + months, ≥60) — months are honored. */
  survivorClaimAge: ClaimAge
  /** Survivor (widow(er)) FRA in total months — see `survivorFraForBirthYear`. */
  survivorFraMonths: number
}

/**
 * Widow(er) reduction factor for claiming survivor at `ageMonths` total months
 * (linear from a 28.5% reduction at age 60 to no reduction at the survivor's
 * FRA). 1.0 at/after FRA; 0.715 at/before 60. Accepts total months so a survivor
 * claiming at exactly their survivor FRA (e.g. 66y8m for born 1960+) is not
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
 * The survivor monthly benefit payable (today's dollars, pre-COLA/haircut):
 * `max(deceasedActual, 82.5% × PIA)` (RIB-LIM) × the widow(er) reduction factor.
 * The survivor's claim-age **months** are carried through (a survivor at exactly
 * their survivor FRA is unreduced). Returns 0 when the deceased had no PIA.
 */
export function survivorBenefitMonthly(input: SurvivorBenefitInput): number {
  if (input.deceasedPiaMonthly <= 0) return 0
  const base = Math.max(input.deceasedActualMonthly, WIDOW_LIMIT_PIA_FRACTION * input.deceasedPiaMonthly)
  const ageMonths = input.survivorClaimAge.years * 12 + input.survivorClaimAge.months
  return base * survivorReductionFactor(ageMonths, input.survivorFraMonths)
}

/** Convenience: a deceased claim age of "at/after FRA" (no early reduction, no DRCs). */
export const DECEASED_CLAIMED_AT_FRA: ClaimAge = { years: 67, months: 0 }
