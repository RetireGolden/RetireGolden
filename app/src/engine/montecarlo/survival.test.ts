import { describe, expect, it } from 'vitest'

import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'
import { annualMortality, MAX_AGE } from './mortality'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalPercentileAge,
  survivalProbabilityTo,
} from './survival'

describe('survivalProbabilityTo', () => {
  it('is 1 at or below the current age and decreases with target age', () => {
    expect(survivalProbabilityTo(65, 'male', 65)).toBe(1)
    expect(survivalProbabilityTo(65, 'male', 60)).toBe(1)
    const p80 = survivalProbabilityTo(65, 'male', 80)
    const p90 = survivalProbabilityTo(65, 'male', 90)
    expect(p80).toBeGreaterThan(p90)
    expect(p90).toBeGreaterThan(0)
    expect(survivalProbabilityTo(65, 'male', MAX_AGE + 1)).toBe(0)
  })

  it('matches the direct product of one-year survivals from the SSA q(x) table', () => {
    let s = 1
    for (let age = 65; age < 90; age++) s *= 1 - annualMortality(age, 'female')
    expect(survivalProbabilityTo(65, 'female', 90)).toBeCloseTo(s, 12)
  })
})

describe('survivalPercentileAge', () => {
  it('is exactly the oldest age whose reach-probability clears the threshold', () => {
    for (const pct of [50, 25, 10]) {
      const age = survivalPercentileAge(65, 'male', pct)
      expect(survivalProbabilityTo(65, 'male', age)).toBeGreaterThanOrEqual(pct / 100)
      expect(survivalProbabilityTo(65, 'male', age + 1)).toBeLessThan(pct / 100)
    }
  })

  it('lower percentiles give older planning ages, and women outlive men', () => {
    const p50 = survivalPercentileAge(65, 'male', 50)
    const p25 = survivalPercentileAge(65, 'male', 25)
    const p10 = survivalPercentileAge(65, 'male', 10)
    expect(p25).toBeGreaterThan(p50)
    expect(p10).toBeGreaterThan(p25)
    expect(survivalPercentileAge(65, 'female', 25)).toBeGreaterThanOrEqual(p25)
  })

  it('lands in the SSA ballpark for a 65-year-old male (median ≈ 83, 25th ≈ 89-92)', () => {
    // e(65, male) = 17.48 ⇒ median death age just above 83 (the distribution skews).
    const median = survivalPercentileAge(65, 'male', 50)
    expect(median).toBeGreaterThanOrEqual(82)
    expect(median).toBeLessThanOrEqual(86)
    const p25 = survivalPercentileAge(65, 'male', 25)
    expect(p25).toBeGreaterThanOrEqual(88)
    expect(p25).toBeLessThanOrEqual(93)
  })

  it('a worse-health hazard lowers the age; better health raises it', () => {
    const base = survivalPercentileAge(65, 'male', 25)
    expect(survivalPercentileAge(65, 'male', 25, 1.8)).toBeLessThan(base)
    expect(survivalPercentileAge(65, 'male', 25, 0.7)).toBeGreaterThan(base)
  })
})

describe('jointSurvivalPercentileAge', () => {
  it('either-alive age is at least each single-life age (strictly above for twins)', () => {
    const single = survivalPercentileAge(65, 'male', 25)
    const joint = jointSurvivalPercentileAge(
      { age: 65, sex: 'male' },
      { age: 65, sex: 'male' },
      25,
    )
    expect(joint).toBeGreaterThan(single)
  })

  it('matches the independence identity 1 − (1−Sa)(1−Sb) computed directly', () => {
    const joint = jointSurvivalPercentileAge(
      { age: 67, sex: 'male' },
      { age: 64, sex: 'female' },
      25,
    )
    const eitherAliveAt = (primaryAge: number): number => {
      const t = primaryAge - 67
      const sa = survivalProbabilityTo(67, 'male', 67 + t)
      const sb = survivalProbabilityTo(64, 'female', 64 + t)
      return 1 - (1 - sa) * (1 - sb)
    }
    expect(eitherAliveAt(joint)).toBeGreaterThanOrEqual(0.25)
    expect(eitherAliveAt(joint + 1)).toBeLessThan(0.25)
  })
})

describe('hazardForExpectancyMultiplier', () => {
  it('returns ~1 for the identity multiplier', () => {
    expect(hazardForExpectancyMultiplier(65, 'male', 1)).toBeCloseTo(1, 1)
  })

  it('reproduces the requested expectancy scaling within tolerance', () => {
    for (const m of [0.8, 0.9, 1.1]) {
      const h = hazardForExpectancyMultiplier(65, 'female', m)
      // Recompute expectancy under h and compare against m × baseline.
      let s = 1
      let e = 0.5
      for (let a = 65; a <= MAX_AGE; a++) {
        s *= Math.pow(1 - annualMortality(a, 'female'), h)
        e += s
      }
      expect(e).toBeCloseTo(m * baselineRemainingYears(65, 'female'), 1)
    }
  })

  it('shorter expectancy means a higher hazard power', () => {
    expect(hazardForExpectancyMultiplier(65, 'male', 0.8)).toBeGreaterThan(1)
    expect(hazardForExpectancyMultiplier(65, 'male', 1.12)).toBeLessThan(1)
  })
})
