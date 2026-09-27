/**
 * Marital-history benefit menu (V7 phase 3): the divorced-spousal and survivor
 * benefits a person can claim on a *former* spouse's record, separate from the
 * current-spouse spousal top-up the engine already models for couples.
 *
 * Eligibility rules (from the gap analysis):
 *  - Divorced-spousal: marriage lasted ≥10 years, the claimant is currently
 *    unmarried, and the year is at or after the calendar year of the first
 *    month the ex is 62 throughout (the year the ex turns 62, or the next year
 *    for an ex born in December after the 2nd) — the ex need not have filed.
 *    The ledger pays that whole year, its annual convention for a first year.
 *    The claimant is paid their own benefit plus the excess of 50% of the ex's
 *    PIA over their own PIA, reduced for the claimant's age in the first month
 *    of the divorced-spouse benefit: the later of their own claim and the first
 *    month the ex is 62 throughout (`dualEntitlement.ts`, POMS RS 00202.005
 *    B.2.a; 42 U.S.C. 402(q)(3)(B), (k)(3)(A)),
 *    with no delayed credits. Worker entitlement, fully-insured status, and
 *    years since divorce are unmodeled
 *    (`cfr-20-404-331-living-divorced-spouse-eligibility`).
 *  - Ordinary survivor (deceased spouse): marriage lasted ≥9 months, the
 *    claimant is ≥60, and remarriage before 60 is treated as an unconditional
 *    historical forfeiture even when the claimant is now single; at/after 60
 *    preserves it. Ordinary-widow 20 CFR 404.335
 *    (`cfr-20-404-335-ordinary-widow-eligibility`).
 *  - Surviving-divorced survivor: marriage lasted ≥10 years before divorce, with
 *    the same age-60 and remarriage gates on the non-disabled path. 20 CFR
 *    404.336 (`cfr-20-404-336-surviving-divorced-spouse-eligibility`). Survivor
 *    benefit is based
 *    on the deceased's actual benefit, with the early-claim widow(er) reduction
 *    and the RIB-LIM widow's-limit cap applied by the shared
 *    `survivorBenefitMonthly` helper (cited in domain rules §4).
 *
 * Simplifications (spec §6): survivor is modeled at the claimant's own claim age
 * (the ledger doesn't model separate survivor-vs-own claim ages here — that
 * sequencing lives in the actuarial `survivorSwitching` view), and the plan holds
 * no date of death for a former spouse, so the widow(er) benefit starts with
 * that claim. The ledger pays the larger of the own benefit and the best
 * candidate below, which for a divorced spouse already includes the own benefit.
 */

import type { FormerSpouse } from '../model/plan.js'
import { claimFactor, creditedAgeMonths, type ClaimAge } from './claimFactor.js'
import {
  divorcedExFirstMonthIndex,
  spouseDualEntitlementMonthly,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from './dualEntitlement.js'
import { ageToTotalMonths, effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from './nra.js'
import { survivorBenefitMonthly } from './survivorBenefit.js'

export const DIVORCED_MIN_MARRIAGE_YEARS = 10
export const SURVIVOR_MIN_MARRIAGE_YEARS = 0.75 // 9 months
export const SURVIVOR_MIN_AGE = 60
export const DIVORCED_EX_MIN_AGE = 62
export const REMARRIAGE_SURVIVOR_PRESERVE_AGE = 60

export type MaritalBenefitKind = 'divorcedSpousal' | 'survivor'

export interface MaritalBenefitContext {
  claimantDob: { year: number; month: number; day: number }
  /** The claimant's configured claim age, before any earnings-test credit. */
  claimantClaimAge: ClaimAge
  /** The claimant's own PIA, for a divorced spouse's dual entitlement; 0 when they have none. */
  claimantOwnPiaMonthly: number
  /** The claimant's own old-age benefit as paid (after the claim factor), or 0. */
  claimantOwnActualMonthly: number
  /**
   * Months withheld under the earnings test while a spouse benefit was paid,
   * credited to the divorced-spouse reduction from the claimant's FRA year
   * (402(q)(7)); 0 when omitted.
   */
  claimantSpouseWithheldMonths?: number
  /** Claim age for survivor factors; defaults to claimantClaimAge for direct helper callers. */
  claimantSurvivorClaimAge?: ClaimAge
  /** Whole age the claimant has attained in the year being evaluated. */
  claimantAge: number
  /** Calendar year being evaluated (to derive the ex-spouse's current age). */
  year: number
  /** True when the claimant has no current spouse (single household). */
  claimantIsSingle: boolean
}

export interface MaritalBenefitCandidate {
  kind: MaritalBenefitKind
  /**
   * Monthly amount, today's dollars, before COLA/haircut, that the claimant is
   * paid when this candidate wins: for a divorced spouse, the own benefit plus
   * the reduced excess; for a survivor, the widow(er) benefit, which is paid in
   * place of a smaller own benefit (402(k)(3)(A)).
   */
  monthly: number
}

function birthYear(dob: string): number {
  return Number(dob.slice(0, 4))
}

/**
 * Living-divorced gates actually applied here; worker entitlement/insured/divorce-date facts are absent.
 * The age gate admits the calendar year of the first month the ex is 62
 * throughout (#divorcedExFirstMonthIndex, POMS RS 00202.005 B.2.a), the month
 * the divorced-spouse benefit starts: the year the ex turns 62
 * (DIVORCED_EX_MIN_AGE), or the next January for an ex born in December after
 * the 2nd, so no year before that month pays the spouse benefit.
 */
function isDivorcedSpouseEligible(record: FormerSpouse, ctx: MaritalBenefitContext): boolean {
  if (record.relationship !== 'divorced') return false
  if (!ctx.claimantIsSingle) return false
  if (record.marriageYears < DIVORCED_MIN_MARRIAGE_YEARS) return false
  const exDob = { year: birthYear(record.dob), month: Number(record.dob.slice(5, 7)), day: Number(record.dob.slice(8, 10)) }
  if (ctx.year < Math.floor(divorcedExFirstMonthIndex(exDob) / 12)) return false
  return true
}

/** Historical remarriage before 60 is an unconditional forfeiture; at/after 60 is preserved. */
export function passesSurvivorRemarriageGate(record: FormerSpouse): boolean {
  return record.remarriedAtAge === null || record.remarriedAtAge >= REMARRIAGE_SURVIVOR_PRESERVE_AGE
}

/**
 * Modeled ordinary-widow record gates on a deceased-spouse record:
 * relationship, 9-month duration, and historical remarriage before 60. Does not
 * test current marital status, statutory duration/remarriage exceptions, or
 * complete claimant eligibility; isWidowEligible owns the age-60 gate.
 */
export function passesModeledOrdinaryWidowRecordGates(record: FormerSpouse): boolean {
  if (record.relationship !== 'deceased') return false
  if (record.marriageYears < SURVIVOR_MIN_MARRIAGE_YEARS) return false
  if (!passesSurvivorRemarriageGate(record)) return false
  return true
}

/**
 * Modeled surviving-divorced 404.336(a)(2) duration: relationship
 * surviving-divorced and ten years immediately before divorce. Does not test
 * remarriage, valid marriage, application, own-benefit, disability, or complete
 * claimant eligibility.
 */
export function passesModeledSurvivingDivorcedDurationGates(record: FormerSpouse): boolean {
  if (record.relationship !== 'surviving-divorced') return false
  if (record.marriageYears < DIVORCED_MIN_MARRIAGE_YEARS) return false
  return true
}

/**
 * Modeled surviving-divorced record gates: (a)(2) duration and the historical
 * remarriage gate. Does not test valid marriage, application, own-benefit,
 * disability, or complete claimant eligibility; isSurvivingDivorcedEligible owns
 * the age-60 gate.
 */
export function passesModeledSurvivingDivorcedRecordGates(record: FormerSpouse): boolean {
  if (!passesModeledSurvivingDivorcedDurationGates(record)) return false
  if (!passesSurvivorRemarriageGate(record)) return false
  return true
}

/** Ordinary-widow gates actually applied here; fully-insured and application facts are absent. */
function isWidowEligible(record: FormerSpouse, ctx: MaritalBenefitContext): boolean {
  if (!passesModeledOrdinaryWidowRecordGates(record)) return false
  if (ctx.claimantAge < SURVIVOR_MIN_AGE) return false
  return true
}

/** Surviving-divorced gates actually applied here; fully-insured and application facts are absent. */
function isSurvivingDivorcedEligible(record: FormerSpouse, ctx: MaritalBenefitContext): boolean {
  if (!passesModeledSurvivingDivorcedRecordGates(record)) return false
  if (ctx.claimantAge < SURVIVOR_MIN_AGE) return false
  return true
}

function survivorBenefitFromFormerSpouse(record: FormerSpouse, ctx: MaritalBenefitContext): MaritalBenefitCandidate {
  const exDobYear = birthYear(record.dob)
  const exDobMonth = Number(record.dob.slice(5, 7))
  const exDobDay = Number(record.dob.slice(8, 10))
  const exEffYear = effectiveBirthYear(exDobYear, exDobMonth, exDobDay)
  const exFra = fraForBirthYear(exEffYear)
  const exClaimAge: ClaimAge = record.deceasedClaimAge ?? { years: exFra.years, months: exFra.extraMonths }
  const deceasedActualMonthly = record.piaMonthly * claimFactor(exDobYear, exDobMonth, exDobDay, exClaimAge)
  // An ex who claimed before full retirement age was entitled to a reduced
  // benefit, so the 402(e)(2)(D) limit applies; a null claim age means FRA.
  const deceasedEverReduced = ageToTotalMonths(exClaimAge.years, exClaimAge.months) < fraTotalMonths(exFra)
  const claimantEffYear = effectiveBirthYear(ctx.claimantDob.year, ctx.claimantDob.month, ctx.claimantDob.day)
  const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(claimantEffYear))
  const monthly = survivorBenefitMonthly({
    deceasedPiaMonthly: record.piaMonthly,
    deceasedActualMonthly,
    deceasedEverReduced,
    survivorClaimAge: ctx.claimantSurvivorClaimAge ?? ctx.claimantClaimAge,
    survivorFraMonths,
  })
  return { kind: 'survivor', monthly }
}

/** Eligibility + monthly amount for one former-spouse record; null if not eligible this year. */
export function maritalBenefitFor(record: FormerSpouse, ctx: MaritalBenefitContext): MaritalBenefitCandidate | null {
  // A benefit on someone else's record only starts once the claimant has claimed.
  if (ctx.claimantAge < ctx.claimantClaimAge.years) return null

  if (record.relationship === 'divorced') {
    if (!isDivorcedSpouseEligible(record, ctx)) return null
    // The ex need not have filed: the divorced-spouse benefit starts in the later
    // of the claimant's own claim and the first month the ex is 62 throughout
    // (POMS RS 00202.005 B.2.a), and is reduced for the claimant's age then
    // (deemed filing, 402(r); 402(q)(6)(A)(ii)).
    const exDob = {
      year: birthYear(record.dob),
      month: Number(record.dob.slice(5, 7)),
      day: Number(record.dob.slice(8, 10)),
    }
    const claimantFraMonths = fraTotalMonths(
      fraForBirthYear(effectiveBirthYear(ctx.claimantDob.year, ctx.claimantDob.month, ctx.claimantDob.day)),
    )
    const spouseAgeMonths = creditedAgeMonths(
      spouseEntitlementAgeMonths(
        ctx.claimantDob,
        ageToTotalMonths(ctx.claimantClaimAge.years, ctx.claimantClaimAge.months),
        divorcedExFirstMonthIndex(exDob),
      ),
      ctx.claimantSpouseWithheldMonths ?? 0,
      ctx.claimantAge,
      claimantFraMonths,
    )
    return {
      kind: 'divorcedSpousal',
      monthly: spouseDualEntitlementMonthly({
        ownPiaMonthly: ctx.claimantOwnPiaMonthly,
        ownActualMonthly: ctx.claimantOwnActualMonthly,
        spouseBaseMonthly: 0.5 * record.piaMonthly,
        spouseFactor: spouseReductionFactorAtAgeMonths(ctx.claimantDob, spouseAgeMonths),
      }),
    }
  }

  if (record.relationship === 'surviving-divorced') {
    if (!isSurvivingDivorcedEligible(record, ctx)) return null
    return survivorBenefitFromFormerSpouse(record, ctx)
  }

  // Deceased spouse → ordinary-widow survivor.
  if (!isWidowEligible(record, ctx)) return null
  return survivorBenefitFromFormerSpouse(record, ctx)
}

/** Largest eligible monthly marital benefit across all former spouses; null if none. */
export function bestMaritalBenefit(
  records: FormerSpouse[] | undefined,
  ctx: MaritalBenefitContext,
): MaritalBenefitCandidate | null {
  let best: MaritalBenefitCandidate | null = null
  for (const record of records ?? []) {
    const candidate = maritalBenefitFor(record, ctx)
    if (candidate && (best === null || candidate.monthly > best.monthly)) best = candidate
  }
  return best
}
