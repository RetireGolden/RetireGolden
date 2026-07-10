import { describe, expect, it } from 'vitest'

import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'
import { annualMortality, MAX_AGE, sampleDeathAge } from './mortality'
import { createRng } from './rng'

describe('annualMortality', () => {
  it('matches plausible SSA period-table rates in mid-retirement', () => {
    // SSA 2022: male q(65) ≈ 1.6–1.9%, female lower.
    expect(annualMortality(65, 'male')).toBeGreaterThan(0.01)
    expect(annualMortality(65, 'male')).toBeLessThan(0.025)
    expect(annualMortality(65, 'female')).toBeLessThan(annualMortality(65, 'male'))
  })

  it('rises with age and is certain at the top of the table', () => {
    expect(annualMortality(90, 'male')).toBeGreaterThan(annualMortality(70, 'male'))
    expect(annualMortality(MAX_AGE, 'male')).toBe(1)
    expect(annualMortality(MAX_AGE + 5, 'female')).toBe(1)
  })
})

describe('sampleDeathAge', () => {
  it('is deterministic for a given seed', () => {
    const a = sampleDeathAge(createRng(42), 65, 'male')
    const b = sampleDeathAge(createRng(42), 65, 'male')
    expect(a).toBe(b)
  })

  it('never returns an age below the current age, and is capped at MAX_AGE', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const d = sampleDeathAge(rng, 70, 'female')
      expect(d).toBeGreaterThanOrEqual(70)
      expect(d).toBeLessThanOrEqual(MAX_AGE)
    }
  })

  it('mean sampled lifespan ≈ current age + life expectancy (validates the q(x) derivation)', () => {
    const rng = createRng(12345)
    const currentAge = 65
    const N = 20_000
    let sum = 0
    for (let i = 0; i < N; i++) sum += sampleDeathAge(rng, currentAge, 'male')
    const meanDeathAge = sum / N
    const expected = currentAge + baselineRemainingYears(currentAge, 'male')
    // Within ~1 year (the +0.5 curtate convention and integer ages aside).
    expect(Math.abs(meanDeathAge - expected)).toBeLessThan(1.0)
  })
})
