import { describe, expect, it } from 'vitest'

import { annualMortality, MAX_AGE, type TableSex } from './mortality.js'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalPercentileAge,
  survivalProbabilityTo,
} from './survival.js'

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
    // e(65, male) = 18.12 ⇒ median death age just above 83 (the distribution skews).
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

  it('names the same calendar year whichever person is passed first, at every age gap (D-PEOPLE-ORDER, R6)', () => {
    // Birth years chosen so the start year is 2026: age = 2026 - birth year.
    let differences = 0
    let beyondOlderTable = 0
    for (const pct of [25, 10]) {
      for (let olderAge = 20; olderAge <= 100; olderAge += 5) {
        for (let youngerAge = 20; youngerAge <= olderAge; youngerAge += 5) {
          for (const [olderSex, youngerSex] of [['male', 'female'], ['female', 'male'], ['average', 'average']] as const) {
            const older = { age: olderAge, sex: olderSex }
            const younger = { age: youngerAge, sex: youngerSex }
            const olderFirst = 2026 - olderAge + jointSurvivalPercentileAge(older, younger, pct)
            const youngerFirst = 2026 - youngerAge + jointSurvivalPercentileAge(younger, older, pct)
            if (olderFirst !== youngerFirst) differences++
            if (jointSurvivalPercentileAge(older, younger, pct) > MAX_AGE + 1) beyondOlderTable++
          }
        }
      }
    }
    expect(differences).toBe(0)
    // The walk reaches past the older person's table end at wide gaps.
    expect(beyondOlderTable).toBeGreaterThan(0)
  })

  it("walks a much younger partner past the older person's table end", () => {
    // A 35-year gap. On the older person's clock the joint answer's calendar
    // year is never before the younger partner's own single-life answer.
    const joint = jointSurvivalPercentileAge({ age: 70, sex: 'male' }, { age: 35, sex: 'female' }, 25)
    const youngerSingle = survivalPercentileAge(35, 'female', 25)
    expect(2026 - 70 + joint).toBeGreaterThanOrEqual(2026 - 35 + youngerSingle)
  })
})

describe('hazardForExpectancyMultiplier', () => {
  it('returns exactly 1 for the identity multiplier', () => {
    expect(hazardForExpectancyMultiplier(65, 'male', 1)).toBe(1)
  })

  it('reproduces the requested expectancy scaling of the curve\'s own expectancy within tolerance', () => {
    const expectancy = (sex: TableSex, h: number): number => {
      let s = 1
      let e = 0.5
      for (let a = 65; a <= MAX_AGE; a++) {
        s *= Math.pow(1 - annualMortality(a, sex), h)
        e += s
      }
      return e
    }
    for (const m of [0.8, 0.9, 1.1]) {
      const h = hazardForExpectancyMultiplier(65, 'female', m)
      // Recompute the expectancy under h and compare against m × the expectancy at power 1.
      expect(expectancy('female', h)).toBeCloseTo(m * expectancy('female', 1), 6)
    }
  })

  it('shorter expectancy means a higher hazard power', () => {
    expect(hazardForExpectancyMultiplier(65, 'male', 0.8)).toBeGreaterThan(1)
    expect(hazardForExpectancyMultiplier(65, 'male', 1.12)).toBeLessThan(1)
  })
})
