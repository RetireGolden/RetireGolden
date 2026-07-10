import { describe, expect, it } from 'vitest'

import { packForYear } from '../params'
import { requiredMinimumDistribution } from './rmd'

const pack = packForYear(2026).pack

describe('requiredMinimumDistribution', () => {
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
