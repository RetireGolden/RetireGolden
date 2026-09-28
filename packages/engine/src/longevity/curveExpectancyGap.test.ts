/**
 * PR #759 review 8: the gap the questionnaire's results card prints between
 * the survival curve's life expectancy and SSA's printed one is the engine's
 * published CURVE_EXPECTANCY_GAP, and this recomputes it from the columns: the
 * largest |E(1) - e(x)| at the questionnaire's ages, 18 to 110, for a man or a
 * woman, E(1) read off the engine's survival curve at hazard power 1. A table
 * refresh that moves it fails here until the constant is restated.
 */
import { describe, expect, it } from 'vitest'

import { MAX_AGE } from '../montecarlo/mortality.js'
import { survivalCurve } from '../montecarlo/survival.js'
import { CURVE_EXPECTANCY_GAP, SSA_PERIOD_LIFE_TABLE } from './ssaPeriodLifeTable.js'

/** The curve's own expectancy at hazard power 1: 0.5 + the sum of S(t), as montecarlo/survival.ts reads it. */
function curveExpectancy(age: number, sex: 'male' | 'female' | 'average'): number {
  const curve = survivalCurve(age, sex)
  let e = 0.5
  for (let t = 1; age + t <= MAX_AGE + 1; t++) {
    const s = curve.survivalTo(t)
    e += s
    if (s <= 1e-12) break
  }
  return e
}

describe('CURVE_EXPECTANCY_GAP', () => {
  const [first, last] = CURVE_EXPECTANCY_GAP.ages

  it('is the largest gap between the curve’s life expectancy and SSA’s printed one at the questionnaire’s ages', () => {
    expect([first, last]).toEqual([18, 110])
    let largest = { gap: 0, age: -1, sex: '' }
    for (const sex of ['male', 'female'] as const) {
      for (let age = first; age <= last; age++) {
        const gap = curveExpectancy(age, sex) - SSA_PERIOD_LIFE_TABLE[sex].e[age]!
        if (Math.abs(gap) > Math.abs(largest.gap)) largest = { gap, age, sex }
      }
    }
    expect(Math.abs(largest.gap)).toBe(CURVE_EXPECTANCY_GAP.maxYears)
    expect({ age: largest.age, sex: largest.sex }).toEqual({ age: CURVE_EXPECTANCY_GAP.age, sex: CURVE_EXPECTANCY_GAP.sex })
    // Exact rational arithmetic on the printed columns gives 0.00496138398922941.
    expect(Math.abs(CURVE_EXPECTANCY_GAP.maxYears - 0.00496138398922941)).toBeLessThan(1e-14)
  })

  it('bounds the gap for a sex not stated too, whose curve and baseline are the means of the two', () => {
    for (let age = first; age <= last; age++) {
      const printed = (SSA_PERIOD_LIFE_TABLE.male.e[age]! + SSA_PERIOD_LIFE_TABLE.female.e[age]!) / 2
      expect(Math.abs(curveExpectancy(age, 'average') - printed), `${age}`).toBeLessThanOrEqual(CURVE_EXPECTANCY_GAP.maxYears)
    }
  })
})
