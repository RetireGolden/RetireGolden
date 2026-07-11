/**
 * Mortality-weighted expected present value of a Social Security claiming
 * strategy — the "benefits only" actuarial view: weight each future year's
 * benefit by the probability of being
 * alive to receive it, and discount at a real rate (benefits are CPI-indexed,
 * so working in today's dollars with a real rate makes COLA and inflation
 * cancel).
 *
 * Survival curve: the repo's SSA period table stores remaining-life-expectancy
 * e(x), not death probabilities, so we recover one-year survival from the
 * standard identity p(x) = l(x+1)/l(x) = (e(x) − 0.5) / (e(x+1) + 0.5)
 * (half-year-of-life convention). This avoids transcribing a second large
 * q(x) table and matches the SSA e(x) data already used by the longevity
 * model. An optional multiplier scales e(x) to reflect a person's longevity
 * questionnaire result (approximate).
 *
 * Simplifications: annual (not monthly) cashflows; claim months ignored
 * (whole-year claim ages, matching the analysis grid); couples assume
 * independent lifetimes; spousal top-up and survivor step-up mirror the
 * projection engine. See DOCS/features/social-security.md.
 */

import { FEMALE, MALE } from '@retiregolden/engine/longevity/ssaPeriod2022'
import type { Sex } from '@retiregolden/engine/longevity/types'
import { claimFactor, spousalBenefitFactor, type ClaimAge } from '@retiregolden/engine/socialSecurity/claimFactor'

function table(sex: Sex): readonly number[] {
  return sex === 'male' ? MALE : sex === 'female' ? FEMALE : MALE // 'average' handled in remainingYears
}

/** Remaining life expectancy e(x) at integer age, optionally scaled by a longevity multiplier. */
function remainingYears(age: number, sex: Sex, multiplier: number): number {
  const i = Math.max(0, Math.min(Math.round(age), MALE.length - 1))
  const raw = sex === 'average' ? (MALE[i]! + FEMALE[i]!) / 2 : table(sex)[i]!
  return raw * multiplier
}

/** One-year survival probability p(age) = P(alive at age+1 | alive at age). */
function oneYearSurvival(age: number, sex: Sex, multiplier: number): number {
  const ex = remainingYears(age, sex, multiplier)
  const exNext = remainingYears(age + 1, sex, multiplier)
  const p = (ex - 0.5) / (exNext + 0.5)
  return Math.max(0, Math.min(1, p))
}

export interface SurvivalCurve {
  /** P(alive at integer `toAge` | alive at integer `fromAge`). 1 when toAge ≤ fromAge. */
  survival(fromAge: number, toAge: number): number
}

export function survivalCurve(sex: Sex, longevityMultiplier = 1): SurvivalCurve {
  const m = longevityMultiplier > 0 ? longevityMultiplier : 1
  // Precompute cumulative survival from age 0 so survival(a,b) = S(b)/S(a).
  const cum: number[] = [1]
  for (let age = 0; age < MALE.length; age++) {
    cum.push(cum[age]! * oneYearSurvival(age, sex, m))
  }
  return {
    survival(fromAge: number, toAge: number): number {
      if (toAge <= fromAge) return 1
      const a = Math.max(0, Math.min(Math.round(fromAge), cum.length - 1))
      const b = Math.max(0, Math.min(Math.round(toAge), cum.length - 1))
      if (cum[a]! <= 0) return 0
      return cum[b]! / cum[a]!
    },
  }
}

export interface ClaimantInput {
  /** Whole age today (the present value's t=0 reference). */
  currentAge: number
  dob: { year: number; month: number; day: number }
  sex: Sex
  piaMonthly: number
  claimAge: ClaimAge
  /** Scales SSA remaining-years (e.g. from the longevity questionnaire); default 1. */
  longevityMultiplier?: number
  /**
   * Optional monthly benefit floor the claimant receives instead of their own
   * once claimed, if larger — e.g. a divorced-spousal benefit on an ex's record.
   * Already reduced for the claim age by the caller.
   */
  benefitFloorMonthly?: number
}

export interface ExpectedPvOptions {
  /** Real annual discount rate, e.g. 0.02 for ~2% (≈ long TIPS yield). */
  discountRate: number
  /** Highest age to sum benefits through; defaults to the table's top. */
  maxAge?: number
}

/** Annual benefit (today's dollars) once claimed, ignoring claim months. */
function annualBenefit(c: ClaimantInput): number {
  const factor = claimFactor(c.dob.year, c.dob.month, c.dob.day, { years: c.claimAge.years, months: 0 })
  const own = c.piaMonthly * factor
  return Math.max(own, c.benefitFloorMonthly ?? 0) * 12
}

/** Expected PV of one person's own retirement benefit. */
export function expectedPvSingle(c: ClaimantInput, opts: ExpectedPvOptions): number {
  const maxAge = opts.maxAge ?? MALE.length - 1
  const curve = survivalCurve(c.sex, c.longevityMultiplier)
  const benefit = annualBenefit(c)
  const startAge = Math.max(c.currentAge, c.claimAge.years)
  let pv = 0
  for (let age = startAge; age <= maxAge; age++) {
    const t = age - c.currentAge
    const discount = Math.pow(1 + opts.discountRate, -t)
    pv += curve.survival(c.currentAge, age) * benefit * discount
  }
  return pv
}

/**
 * Expected PV of a couple's combined benefits under a claiming strategy,
 * including the spousal top-up (lower earner lifted to 50% of the higher PIA
 * while both alive and both claimed) and the survivor step-up (survivor keeps
 * the larger of the two benefits). Lifetimes assumed independent.
 */
export function expectedPvCouple(a: ClaimantInput, b: ClaimantInput, opts: ExpectedPvOptions): number {
  const maxAge = opts.maxAge ?? MALE.length - 1
  const curveA = survivalCurve(a.sex, a.longevityMultiplier)
  const curveB = survivalCurve(b.sex, b.longevityMultiplier)
  const benefitA = annualBenefit(a)
  const benefitB = annualBenefit(b)
  const lowerIsA = a.piaMonthly < b.piaMonthly
  const higher = lowerIsA ? b : a
  const lower = lowerIsA ? a : b
  // Spousal benefit (50% of higher PIA) reduced for the lower earner's own claim age.
  const spousalAnnual =
    0.5 * higher.piaMonthly * spousalBenefitFactor(lower.dob.year, lower.dob.month, lower.dob.day, lower.claimAge) * 12

  let pv = 0
  // Step over calendar years from now until both spouses are past the table.
  for (let t = 0; ; t++) {
    const ageA = a.currentAge + t
    const ageB = b.currentAge + t
    if (ageA > maxAge && ageB > maxAge) break
    const sA = curveA.survival(a.currentAge, ageA)
    const sB = curveB.survival(b.currentAge, ageB)

    const aClaimed = ageA >= a.claimAge.years
    const bClaimed = ageB >= b.claimAge.years
    const ownA = aClaimed ? benefitA : 0
    const ownB = bClaimed ? benefitB : 0

    // Both alive: spousal top-up lifts the lower earner once both have claimed.
    let bothAlive = ownA + ownB
    if (aClaimed && bClaimed) {
      const lowerOwn = lowerIsA ? ownA : ownB
      const otherOwn = lowerIsA ? ownB : ownA
      bothAlive = otherOwn + Math.max(lowerOwn, spousalAnnual)
    }

    // One survivor: keeps the larger of the two claimed benefits.
    const survivorBenefit = Math.max(ownA, ownB)

    const expected =
      sA * sB * bothAlive + sA * (1 - sB) * survivorBenefit + sB * (1 - sA) * survivorBenefit
    pv += expected * Math.pow(1 + opts.discountRate, -t)
  }
  return pv
}
