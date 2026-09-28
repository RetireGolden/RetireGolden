/**
 * Survival-percentile planning ages (spending-paths & SWR-lenses plan, Goal 4).
 *
 * "Plan to the age you have a 25% (or 10%) chance of reaching" is standard
 * longevity-risk advice — the refreshed Actuaries Longevity Illustrator is the
 * canonical tool that operationalizes it. These helpers compute that age from
 * the engine's one survival curve, built on SSA's published death
 * probabilities (deathProbability.ts#annualMortality, the table in
 * ../longevity/ssaPeriodLifeTable.ts), the curve the stochastic-longevity
 * Monte Carlo and the Social Security analysis models also read, so every
 * surface quotes one mortality table.
 *
 * The optional health adjustment is a proportional-hazards transform: annual
 * survival p(x) is raised to a hazard power h (q' = 1 − (1−q)^h; h > 1 = worse
 * health). `hazardForExpectancyMultiplier` converts the longevity wizard's
 * remaining-years multiplier (its sourced smoking/health/activity factors,
 * see ../../longevity/factors.ts) into that hazard power, so the percentile
 * picker can reuse the questionnaire instead of a second unsourced factor set.
 */

import { annualMortality, MAX_AGE, type Sex, type TableSex } from './deathProbability.js'

/** One-year survival probability at integer age, under a hazard power. */
function annualSurvival(age: number, sex: TableSex, hazard: number): number {
  const q = annualMortality(age, sex)
  if (q >= 1) return 0
  return Math.pow(1 - q, hazard)
}

/**
 * The engine's one survival curve for a life aged `fromAge` today. For a man
 * or a woman it is the running product of the one-year survivals
 * `annualSurvival` (SSA's published q(x) from `annualMortality`, raised to the
 * hazard power) over integer ages. For 'average' it is the 50/50 mixture of
 * the man's and the woman's curves from `fromAge`, each under the same hazard
 * power: the curve of someone equally likely to be either. `survivalProbabilityTo`
 * is a view of it, and the percentile ages, the hazard solver, the death-age
 * draw, the joint expectancy and the Social Security analysis models read it,
 * so a probability of being alive at a later age comes from this one curve.
 */
export interface SurvivalCurve {
  readonly fromAge: number
  readonly sex: Sex
  readonly hazard: number
  /**
   * P(alive at age fromAge + t | alive at fromAge), for a whole number of
   * years t: 1 at t <= 0, and 0 once the product passes the table's end.
   */
  survivalTo(t: number): number
  /**
   * P(dies in year t, between ages fromAge + t and fromAge + t + 1): for a man
   * or a woman survivalTo(t) × (1 − that year's one-year survival); for
   * 'average' survivalTo(t) − survivalTo(t + 1). 0 for t < 0.
   */
  deathProbabilityInYear(t: number): number
  /**
   * P(dies in year t | alive at fromAge + t): for a man or a woman
   * 1 − (1 − q(fromAge + t))^h, which at h = 1 is q itself; for 'average'
   * 1 − survivalTo(t + 1)/survivalTo(t), and 1 once survivalTo(t) is 0. It
   * depends on the starting age for 'average', whose survivors become more
   * female with age. 0 for t < 0.
   */
  deathProbabilityGivenAlive(t: number): number
}

function wholeYears(t: number): number {
  if (!Number.isInteger(t)) throw new RangeError(`A survival curve is read at whole years; got ${t}`)
  return t
}

/** The running product of one sex's one-year survivals from `fromAge`. */
function tableSexSurvival(fromAge: number, sex: TableSex, hazard: number): SurvivalCurve {
  // products[t] is the product of the first t one-year survivals, multiplied
  // left to right; once it reaches 0 every later product is 0. Past the
  // table's last age (q = 1 there) every product is 0, so the walk stops.
  const products: number[] = [1]
  const survivalTo = (t: number): number => {
    const years = wholeYears(t)
    if (years <= 0) return 1
    const index = Math.min(years, MAX_AGE + 2)
    while (products.length <= index) {
      const last = products[products.length - 1]!
      products.push(last <= 0 ? 0 : last * annualSurvival(fromAge + products.length - 1, sex, hazard))
    }
    return products[index]!
  }
  return {
    fromAge,
    sex,
    hazard,
    survivalTo,
    deathProbabilityInYear(t: number): number {
      const years = wholeYears(t)
      if (years < 0) return 0
      const alive = survivalTo(years)
      if (alive <= 0) return 0
      return alive * (1 - annualSurvival(fromAge + years, sex, hazard))
    },
    deathProbabilityGivenAlive(t: number): number {
      const years = wholeYears(t)
      if (years < 0) return 0
      const q = annualMortality(fromAge + years, sex)
      if (q >= 1) return 1
      // At power 1 this is q exactly, not 1 − (1 − q), which can differ from
      // q in the last binary digit.
      return hazard === 1 ? q : 1 - Math.pow(1 - q, hazard)
    },
  }
}

/** The 50/50 mixture of the male and female curves from `fromAge`, each under the hazard power. */
function averageSurvival(fromAge: number, hazard: number): SurvivalCurve {
  const male = tableSexSurvival(fromAge, 'male', hazard)
  const female = tableSexSurvival(fromAge, 'female', hazard)
  const survivalTo = (t: number): number => (male.survivalTo(t) + female.survivalTo(t)) / 2
  return {
    fromAge,
    sex: 'average',
    hazard,
    survivalTo,
    deathProbabilityInYear(t: number): number {
      const years = wholeYears(t)
      if (years < 0) return 0
      return survivalTo(years) - survivalTo(years + 1)
    },
    deathProbabilityGivenAlive(t: number): number {
      const years = wholeYears(t)
      if (years < 0) return 0
      const alive = survivalTo(years)
      if (alive <= 0) return 1
      return 1 - survivalTo(years + 1) / alive
    },
  }
}

/**
 * Builds the curve without checking its arguments, so `survivalProbabilityTo`
 * and the percentile searches keep their own domain (they floor ages and use
 * any hazard as passed) while sharing the curve with `survivalCurve`.
 */
function runningSurvival(fromAge: number, sex: Sex, hazard: number): SurvivalCurve {
  return sex === 'average' ? averageSurvival(fromAge, hazard) : tableSexSurvival(fromAge, sex, hazard)
}

/**
 * The survival curve of a life aged `fromAge` (a whole number of years, at
 * least 0) under the proportional-hazards power `hazard` (1 = the table, above
 * 1 = worse health). A fractional age, or a hazard that is not a positive
 * finite number, is refused rather than rounded or used as passed.
 */
export function survivalCurve(fromAge: number, sex: Sex, hazard = 1): SurvivalCurve {
  if (!Number.isInteger(fromAge) || fromAge < 0) {
    throw new RangeError(`A survival curve starts at a whole age of at least 0; got ${fromAge}`)
  }
  if (!Number.isFinite(hazard) || hazard <= 0) {
    throw new RangeError(`A survival curve's hazard power must be a positive finite number; got ${hazard}`)
  }
  return runningSurvival(fromAge, sex, hazard)
}

/**
 * Probability someone `currentAge` today is still alive at `targetAge`: the
 * survival curve from the floored current age, read at the floored target.
 * 1 for targetAge ≤ current.
 */
export function survivalProbabilityTo(
  currentAge: number,
  sex: Sex,
  targetAge: number,
  hazard = 1,
): number {
  const from = Math.floor(Math.max(currentAge, 0))
  const to = Math.floor(targetAge)
  // Not later (a NaN target included, as the empty product always was): 1.
  if (!(to > from)) return 1
  // An infinite target reads the product past the table's end, which is 0.
  return runningSurvival(from, sex, hazard).survivalTo(Number.isFinite(to) ? to - from : MAX_AGE + 2)
}

/**
 * The oldest integer age this person still reaches with probability ≥ pct/100 —
 * "the age I have a `pct`% chance of reaching", read off the survival curve.
 * Monotone: smaller pct ⇒ older age. Always ≥ the floored current age (you
 * have already reached it), and otherwise at most MAX_AGE (the closed last
 * row forces death during it): at most max(MAX_AGE, the floored current age).
 */
export function survivalPercentileAge(
  currentAge: number,
  sex: Sex,
  pct: number,
  hazard = 1,
): number {
  const threshold = Math.min(Math.max(pct, 0.1), 100) / 100
  const from = Math.floor(Math.max(currentAge, 0))
  const curve = runningSurvival(from, sex, hazard)
  let best = from
  for (let t = 1; from + t <= MAX_AGE + 1; t++) {
    if (curve.survivalTo(t) >= threshold) best = from + t
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
 * P = 1 − (1 − S_primary)(1 − S_partner), each S read off that person's
 * survival curve. Always ≥ the single-life answer.
 */
export function jointSurvivalPercentileAge(
  primary: SurvivalPerson,
  partner: SurvivalPerson,
  pct: number,
): number {
  const threshold = Math.min(Math.max(pct, 0.1), 100) / 100
  const from = Math.floor(Math.max(primary.age, 0))
  const partnerFrom = Math.floor(Math.max(partner.age, 0))
  const primaryCurve = runningSurvival(from, primary.sex, primary.hazard ?? 1)
  const partnerCurve = runningSurvival(partnerFrom, partner.sex, partner.hazard ?? 1)
  let best = from
  // Walk both survival curves on the primary's clock; the partner's own clock
  // is offset by the age difference.
  for (let t = 0; from + t <= MAX_AGE + 1; t++) {
    const sPrimary = primaryCurve.survivalTo(t)
    const sPartner = partnerCurve.survivalTo(t)
    if (t > 0 && sPrimary <= 0 && sPartner <= 0) break
    const eitherAlive = 1 - (1 - sPrimary) * (1 - sPartner)
    if (eitherAlive >= threshold) best = from + t
    else break
  }
  return best
}

/**
 * Curtate-style remaining life expectancy under a hazard power, read off the
 * survival curve: 0.5 + Σ S(t), stopping once S(t) ≤ 1e-12.
 */
function expectancyUnderHazard(age: number, sex: Sex, hazard: number): number {
  const from = Math.floor(Math.max(age, 0))
  const curve = runningSurvival(from, sex, hazard)
  let e = 0.5
  for (let t = 1; from + t <= MAX_AGE + 1; t++) {
    const s = curve.survivalTo(t)
    e += s
    if (s <= 1e-12) break
  }
  return e
}

/**
 * Convert a remaining-years multiplier `m` (the longevity questionnaire's
 * applied multiplier: m < 1 = shorter expectancy) into the proportional-hazards
 * power whose adjusted expectancy at this age is m × the curve's own
 * expectancy at power 1, solved by bisection. m = 1 returns exactly 1, the
 * root (the bisection cannot land on it). Results are clamped to a sane hazard
 * range so extreme questionnaire answers cannot degenerate the curve.
 */
export function hazardForExpectancyMultiplier(age: number, sex: Sex, m: number): number {
  if (m === 1) return 1
  const target = Math.max(0.1, m) * expectancyUnderHazard(age, sex, 1)
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
