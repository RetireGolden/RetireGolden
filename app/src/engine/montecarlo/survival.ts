/**
 * Survival-percentile planning ages (spending-paths & SWR-lenses plan, Goal 4).
 *
 * "Plan to the age you have a 25% (or 10%) chance of reaching" is standard
 * longevity-risk advice — the refreshed Actuaries Longevity Illustrator is the
 * canonical tool that operationalizes it. These helpers compute that age from
 * the same SSA 2022 q(x) derivation the stochastic-longevity Monte Carlo uses
 * (mortality.ts), so every surface quotes one mortality table.
 *
 * The optional health adjustment is a proportional-hazards transform: annual
 * survival p(x) is raised to a hazard power h (q' = 1 − (1−q)^h; h > 1 = worse
 * health). `hazardForExpectancyMultiplier` converts the longevity wizard's
 * remaining-years multiplier (its sourced smoking/health/activity factors,
 * see ../../longevity/factors.ts) into that hazard power, so the percentile
 * picker can reuse the questionnaire instead of a second unsourced factor set.
 */

import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'
import { annualMortality, MAX_AGE, type Sex } from './mortality'

/** One-year survival probability at integer age, under a hazard power. */
function annualSurvival(age: number, sex: Sex, hazard: number): number {
  const q = annualMortality(age, sex)
  if (q >= 1) return 0
  return Math.pow(1 - q, hazard)
}

/**
 * Probability someone `currentAge` today is still alive at `targetAge`
 * (product of one-year survivals over integer ages). 1 for targetAge ≤ current.
 */
export function survivalProbabilityTo(
  currentAge: number,
  sex: Sex,
  targetAge: number,
  hazard = 1,
): number {
  const from = Math.floor(Math.max(currentAge, 0))
  const to = Math.floor(targetAge)
  let s = 1
  for (let age = from; age < to; age++) {
    s *= annualSurvival(age, sex, hazard)
    if (s <= 0) return 0
  }
  return s
}

/**
 * The oldest integer age this person still reaches with probability ≥ pct/100 —
 * "the age I have a `pct`% chance of reaching". Monotone: smaller pct ⇒ older
 * age. Always ≥ the current age (you have already reached it) and ≤ MAX_AGE + 1
 * (the table forces death by then).
 */
export function survivalPercentileAge(
  currentAge: number,
  sex: Sex,
  pct: number,
  hazard = 1,
): number {
  const threshold = Math.min(Math.max(pct, 0.1), 100) / 100
  const from = Math.floor(Math.max(currentAge, 0))
  let s = 1
  let best = from
  for (let age = from; age <= MAX_AGE; age++) {
    s *= annualSurvival(age, sex, hazard)
    if (s >= threshold) best = age + 1
    else break
  }
  return best
}

export interface SurvivalPerson {
  age: number
  sex: Sex
  hazard?: number
}

/**
 * Joint ("either of us") percentile age on the primary person's age clock: the
 * oldest primary age A such that P(at least one member alive when the primary
 * would be A) ≥ pct/100, assuming independent lifetimes —
 * P = 1 − (1 − S_primary)(1 − S_partner). Always ≥ the single-life answer.
 */
export function jointSurvivalPercentileAge(
  primary: SurvivalPerson,
  partner: SurvivalPerson,
  pct: number,
): number {
  const threshold = Math.min(Math.max(pct, 0.1), 100) / 100
  const from = Math.floor(Math.max(primary.age, 0))
  const partnerFrom = Math.floor(Math.max(partner.age, 0))
  let sPrimary = 1
  let sPartner = 1
  let best = from
  // Walk both survival curves on the primary's clock; the partner's own clock
  // is offset by the age difference.
  for (let t = 0; from + t <= MAX_AGE + 1; t++) {
    const eitherAlive = 1 - (1 - sPrimary) * (1 - sPartner)
    if (eitherAlive >= threshold) best = from + t
    else break
    sPrimary *= annualSurvival(from + t, primary.sex, primary.hazard ?? 1)
    sPartner *= annualSurvival(partnerFrom + t, partner.sex, partner.hazard ?? 1)
    if (sPrimary <= 0 && sPartner <= 0) break
  }
  return best
}

/** Curtate-style remaining life expectancy under a hazard power: 0.5 + Σ S(t). */
function expectancyUnderHazard(age: number, sex: Sex, hazard: number): number {
  const from = Math.floor(Math.max(age, 0))
  let s = 1
  let e = 0.5
  for (let a = from; a <= MAX_AGE; a++) {
    s *= annualSurvival(a, sex, hazard)
    e += s
    if (s <= 1e-12) break
  }
  return e
}

/**
 * Convert a remaining-years multiplier `m` (the longevity questionnaire's
 * applied multiplier: m < 1 = shorter expectancy) into the proportional-hazards
 * power whose adjusted expectancy at this age is m × the SSA baseline, solved
 * by bisection. m = 1 returns ~1 (identity); results are clamped to a sane
 * hazard range so extreme questionnaire answers cannot degenerate the curve.
 */
export function hazardForExpectancyMultiplier(age: number, sex: Sex, m: number): number {
  const target = Math.max(0.1, m) * baselineRemainingYears(age, sex)
  let lo = 0.2 // far healthier than the table
  let hi = 8 // far sicker than the table
  // Expectancy is strictly decreasing in the hazard power.
  if (expectancyUnderHazard(age, sex, lo) <= target) return lo
  if (expectancyUnderHazard(age, sex, hi) >= target) return hi
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (expectancyUnderHazard(age, sex, mid) > target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
