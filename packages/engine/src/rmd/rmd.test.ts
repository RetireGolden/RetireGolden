import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { packForYear } from '../params/index.js'
import { requiredMinimumDistribution } from './rmd.js'

const pack = packForYear(2026).pack

describe('requiredMinimumDistribution', () => {
  // Treas. Reg. 1.401(a)(9)-5 gives the Joint and Last Survivor Table only to a
  // sole-beneficiary spouse "more than 10 years younger". Exactly ten is not
  // more than ten, so that case stays on the Uniform Lifetime Table. An owner
  // aged 75 with a 100,000 balance takes 100,000 / 24.6 there; an eleven-year
  // gap moves to the joint table's 25.3 divisor and a smaller distribution.
  describeRule('treas-reg-1-401-a-9-5-joint-life-spouse-sole-beneficiary', {
    readings: {
      uniformAtExactlyTenYears: 100_000 / 24.6,
      jointTableAtElevenYears: 100_000 / 25.3,
    },
    accepted: 'uniformAtExactlyTenYears',
  }, ({ accepted, readings }) => {
    it('keeps a spouse exactly ten years younger on the Uniform Lifetime Table', () => {
      const spouse = (ageAttained: number) => ({ ageAttained, sex: 'average' as const })

      expect(requiredMinimumDistribution(pack, 1951, 75, 100_000, { spouse: spouse(65) }))
        .toBeCloseTo(accepted, 6)
      expect(requiredMinimumDistribution(pack, 1951, 75, 100_000, { spouse: spouse(64) }))
        .toBeCloseTo(readings.jointTableAtElevenYears, 6)
    })
  })

  it('starts at 73 for the 1951–1959 cohort', () => {
    expect(requiredMinimumDistribution(pack, 1953, 72, 265_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1953, 73, 265_000)).toBeCloseTo(265_000 / 26.5, 6)
  })

  it('starts at 75 for the 1960+ cohort', () => {
    expect(requiredMinimumDistribution(pack, 1960, 73, 246_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1960, 74, 246_000)).toBe(0)
    expect(requiredMinimumDistribution(pack, 1960, 75, 246_000)).toBeCloseTo(10_000, 6)
  })

  it('uses the floor divisor beyond the table end', () => {
    expect(requiredMinimumDistribution(pack, 1950, 125, 10_000)).toBeCloseTo(5_000, 6)
  })

  it('is zero for an empty account', () => {
    expect(requiredMinimumDistribution(pack, 1953, 80, 0)).toBe(0)
  })

  it('uses the joint-life divisor (smaller RMD) when the spouse is >10 yrs younger', () => {
    const uniform = requiredMinimumDistribution(pack, 1953, 80, 500_000)
    const jointYoungSpouse = requiredMinimumDistribution(pack, 1953, 80, 500_000, {
      ownerSex: 'male',
      spouse: { ageAttained: 62, sex: 'female' }, // 18 yrs younger
    })
    expect(jointYoungSpouse).toBeGreaterThan(0)
    expect(jointYoungSpouse).toBeLessThan(uniform) // larger divisor → smaller RMD
  })

  it('keeps the uniform divisor when the age gap is 10 years or less', () => {
    const uniform = requiredMinimumDistribution(pack, 1953, 80, 500_000)
    const closeSpouse = requiredMinimumDistribution(pack, 1953, 80, 500_000, {
      ownerSex: 'male',
      spouse: { ageAttained: 72, sex: 'female' }, // 8 yrs younger
    })
    expect(closeSpouse).toBeCloseTo(uniform, 6)
  })
})
