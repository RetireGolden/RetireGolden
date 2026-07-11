/**
 * Mortality sampling for stochastic-longevity Monte Carlo (roadmap V6).
 *
 * Annual death probability q(x) is derived from the SSA 2022 period life
 * expectancy table already in the repo, via the standard identity
 *   E(x) = e(x) − 0.5 = p(x)·(1 + E(x+1))   ⇒   q(x) = 1 − (e(x)−0.5)/(e(x+1)+0.5)
 * where E is the curtate expectation and p = 1−q is one-year survival. This
 * grounds the model in the same cited SSA data the deterministic life-
 * expectancy estimate uses — no separate q(x) dataset to maintain.
 *
 * @see ../../longevity/ssaPeriod2022 (SSA Table 4C6, 2022)
 */

import { FEMALE, MALE } from '../longevity/ssaPeriod2022.js'
import type { Rng } from './rng.js'

export type Sex = 'male' | 'female' | 'average'

const AVERAGE: readonly number[] = MALE.map((m, i) => (m + (FEMALE[i] ?? m)) / 2)
/** Oldest integer age in the table; everyone is forced to die by here. */
export const MAX_AGE = MALE.length - 1

function expectancyTable(sex: Sex): readonly number[] {
  return sex === 'male' ? MALE : sex === 'female' ? FEMALE : AVERAGE
}

/** One-year probability of death at integer age `age` for the given sex. */
export function annualMortality(age: number, sex: Sex): number {
  const t = expectancyTable(sex)
  const x = Math.floor(age)
  if (x < 0) return 0
  if (x >= t.length - 1) return 1
  const survival = (t[x]! - 0.5) / (t[x + 1]! + 0.5)
  return Math.min(1, Math.max(0, 1 - survival))
}

/**
 * Sample the age (last full year alive) at death for someone currently `currentAge`,
 * walking the survival curve year by year with the path RNG. Returns an age that
 * plays the same role as `planningAge` (alive through it, dead the next year).
 * Deterministic given the RNG stream, so paths stay reproducible.
 */
export function sampleDeathAge(rng: Rng, currentAge: number, sex: Sex): number {
  let age = Math.floor(Math.max(currentAge, 0))
  while (age < MAX_AGE) {
    if (rng.next() < annualMortality(age, sex)) return age
    age++
  }
  return MAX_AGE
}

/**
 * Joint last-survivor life expectancy at the two ages — the years until *both*
 * are dead, assuming independent lifetimes: e = 0.5 + Σ_t [1 − (1−tp_a)(1−tp_b)].
 * Used for stochastic-longevity analysis; IRS RMD Table II lives in the RMD module.
 */
export function jointLastSurvivorExpectancy(ageA: number, sexA: Sex, ageB: number, sexB: Sex): number {
  let expectancy = 0.5
  let survivalA = 1
  let survivalB = 1
  for (let t = 1; t <= MAX_AGE + 1; t++) {
    survivalA *= 1 - annualMortality(ageA + t - 1, sexA)
    survivalB *= 1 - annualMortality(ageB + t - 1, sexB)
    expectancy += 1 - (1 - survivalA) * (1 - survivalB)
  }
  return expectancy
}
