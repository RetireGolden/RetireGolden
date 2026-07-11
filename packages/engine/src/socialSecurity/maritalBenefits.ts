/**
 * Marital-history benefit menu (V7 phase 3): the divorced-spousal and survivor
 * benefits a person can claim on a *former* spouse's record, separate from the
 * current-spouse spousal top-up the engine already models for couples.
 *
 * Eligibility rules (from the gap analysis):
 *  - Divorced-spousal: marriage lasted ≥10 years, the claimant is currently
 *    unmarried, and the ex is eligible (≥62) — the ex need not have filed. Worth
 *    up to 50% of the ex's PIA, reduced for the claimant's own (early) claim age,
 *    with no delayed credits (same factor as current-spousal).
 *  - Survivor: marriage lasted ≥9 months, the claimant is ≥60, and remarriage
 *    rules are satisfied (remarrying before 60 forfeits it; at/after 60 preserves
 *    it). Survivor benefit is based on the deceased's actual benefit, with the
 *    early-claim widow(er) reduction and the RIB-LIM widow's-limit cap applied by
 *    the shared `survivorBenefitMonthly` helper (cited in domain rules §4).
 *
 * Simplifications (spec §6): survivor is modeled at the claimant's own claim age
 * (the ledger doesn't model separate survivor-vs-own claim ages here — that
 * sequencing lives in the actuarial `survivorSwitching` view); the
 * 2-years-since-divorce "independently entitled" rule for divorced-spousal on a
 * living ex is ignored (rarely binds in planning). Here a person receives the
 * larger of own vs the best marital benefit at their single claim age.
 */

import type { FormerSpouse } from '../model/plan.js'
import { claimFactor, spousalBenefitFactor, type ClaimAge } from './claimFactor.js'
import { effectiveBirthYear, fraForBirthYear, fraTotalMonths, survivorFraForBirthYear } from './nra.js'
import { survivorBenefitMonthly } from './survivorBenefit.js'

export const DIVORCED_MIN_MARRIAGE_YEARS = 10
export const SURVIVOR_MIN_MARRIAGE_YEARS = 0.75 // 9 months
export const SURVIVOR_MIN_AGE = 60
export const DIVORCED_EX_MIN_AGE = 62
export const REMARRIAGE_SURVIVOR_PRESERVE_AGE = 60

export type MaritalBenefitKind = 'divorcedSpousal' | 'survivor'

export interface MaritalBenefitContext {
  claimantDob: { year: number; month: number; day: number }
  /** Claim age for retirement/divorced-spousal factors, including any ARF credit the caller applies. */
  claimantClaimAge: ClaimAge
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
  /** Monthly benefit at the claimant's claim age, today's dollars, before COLA/haircut. */
  monthly: number
}

function birthYear(dob: string): number {
  return Number(dob.slice(0, 4))
}

/** Eligibility + monthly amount for one former-spouse record; null if not eligible this year. */
export function maritalBenefitFor(record: FormerSpouse, ctx: MaritalBenefitContext): MaritalBenefitCandidate | null {
  // A benefit on someone else's record only starts once the claimant has claimed.
  if (ctx.claimantAge < ctx.claimantClaimAge.years) return null

  if (record.relationship === 'divorced') {
    if (!ctx.claimantIsSingle) return null
    if (record.marriageYears < DIVORCED_MIN_MARRIAGE_YEARS) return null
    if (ctx.year - birthYear(record.dob) < DIVORCED_EX_MIN_AGE) return null
    const factor = spousalBenefitFactor(
      ctx.claimantDob.year,
      ctx.claimantDob.month,
      ctx.claimantDob.day,
      ctx.claimantClaimAge,
    )
    return { kind: 'divorcedSpousal', monthly: 0.5 * record.piaMonthly * factor }
  }

  // Deceased former spouse → survivor.
  if (record.marriageYears < SURVIVOR_MIN_MARRIAGE_YEARS) return null
  if (ctx.claimantAge < SURVIVOR_MIN_AGE) return null
  if (record.remarriedAtAge !== null && record.remarriedAtAge < REMARRIAGE_SURVIVOR_PRESERVE_AGE) return null
  // Survivor base = the deceased ex's actual (claim-age-adjusted) benefit, with
  // the RIB-LIM widow's-limit cap and the early-claim widow(er) reduction — both
  // computed by the shared helper (cited in domain rules §4). The deceased's
  // claim age defaults to "claimed at FRA" (factor 1, actual = PIA) when omitted.
  const exDobYear = birthYear(record.dob)
  const exDobMonth = Number(record.dob.slice(5, 7))
  const exDobDay = Number(record.dob.slice(8, 10))
  const exEffYear = effectiveBirthYear(exDobYear, exDobMonth, exDobDay)
  const exFra = fraForBirthYear(exEffYear)
  const exClaimAge: ClaimAge = record.deceasedClaimAge ?? { years: exFra.years, months: exFra.extraMonths }
  const deceasedActualMonthly = record.piaMonthly * claimFactor(exDobYear, exDobMonth, exDobDay, exClaimAge)
  const claimantEffYear = effectiveBirthYear(ctx.claimantDob.year, ctx.claimantDob.month, ctx.claimantDob.day)
  const survivorFraMonths = fraTotalMonths(survivorFraForBirthYear(claimantEffYear))
  const monthly = survivorBenefitMonthly({
    deceasedPiaMonthly: record.piaMonthly,
    deceasedActualMonthly,
    survivorClaimAge: ctx.claimantSurvivorClaimAge ?? ctx.claimantClaimAge,
    survivorFraMonths,
  })
  return { kind: 'survivor', monthly }
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
