/**
 * Mortality for stochastic-longevity Monte Carlo (roadmap V6) and the joint
 * last-survivor expectancy, both read off the engine's one survival curve
 * (montecarlo/survival.ts#survivalCurve).
 *
 * The one-year death probability lives in the leaf ./deathProbability.ts,
 * which this module and survival.ts both import, and which this module
 * re-exports so its published subpath keeps `annualMortality`, `MAX_AGE`,
 * `Sex` and `TableSex`. A person whose sex is 'average' has no single q(x);
 * the death-age draw and the joint expectancy read the curve, which builds
 * 'average' as the 50/50 mixture of the male and female curves.
 *
 * @see ../longevity/ssaPeriodLifeTable.ts (SSA Table 4C6, 2023 period, 2026 Trustees Report)
 */

import { MAX_AGE, type Sex } from './deathProbability.js'
import type { Rng } from './rng.js'
import { survivalCurve } from './survival.js'

export { annualMortality, MAX_AGE, type Sex, type TableSex } from './deathProbability.js'

/**
 * Sample the age (last full year alive) at death for someone currently `currentAge`,
 * walking the survival curve year by year with the path RNG: one uniform draw per
 * year, dying in a year when the draw falls below the curve's probability of
 * dying that year given alive at its start. For a man or a woman that is q(x);
 * for 'average' it is the mixture's, so the drawn age has the mixture's
 * distribution. Returns an age that plays the same role as `planningAge` (alive
 * through it, dead the next year). Deterministic given the RNG stream, so paths
 * stay reproducible. A non-finite age (NaN or ±Infinity) throws a RangeError.
 */
export function sampleDeathAge(rng: Rng, currentAge: number, sex: Sex): number {
  if (!Number.isFinite(currentAge)) throw new RangeError(`A death age is drawn from a finite age; got ${currentAge}`)
  const from = Math.floor(Math.max(currentAge, 0))
  if (from >= MAX_AGE) return MAX_AGE
  const curve = survivalCurve(from, sex)
  for (let t = 0; from + t < MAX_AGE; t++) {
    if (rng.next() < curve.deathProbabilityGivenAlive(t)) return from + t
  }
  return MAX_AGE
}

/**
 * Joint last-survivor life expectancy at the two ages — the years until *both*
 * are dead, assuming independent lifetimes: e = 0.5 + Σ_t [1 − (1−tp_a)(1−tp_b)],
 * each tp read from that life's survival curve. Used for the joint-and-survivor
 * annuity exclusion multiple; IRS RMD Table II lives in the RMD module. A
 * non-finite age (NaN or ±Infinity) for either life throws a RangeError.
 */
export function jointLastSurvivorExpectancy(ageA: number, sexA: Sex, ageB: number, sexB: Sex): number {
  for (const age of [ageA, ageB]) {
    if (!Number.isFinite(age)) throw new RangeError(`A joint life expectancy is read at finite ages; got ${age}`)
  }
  const survivalA = lifeSurvival(ageA, sexA)
  const survivalB = lifeSurvival(ageB, sexB)
  let expectancy = 0.5
  for (let t = 1; t <= MAX_AGE + 1; t++) {
    expectancy += 1 - (1 - survivalA(t)) * (1 - survivalB(t))
  }
  return expectancy
}

/**
 * P(alive t years on) for a life of age `age` as passed: the curve from the
 * floored age. Below age 0 no death probability applies (q is 0 there), so a
 * negative age survives with certainty until it reaches 0 and then follows the
 * curve from 0.
 */
function lifeSurvival(age: number, sex: Sex): (t: number) => number {
  const floored = Math.floor(age)
  const start = Math.max(floored, 0)
  const lead = start - floored
  const curve = survivalCurve(start, sex)
  return (t) => curve.survivalTo(t - lead)
}
