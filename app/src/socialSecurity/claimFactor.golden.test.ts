import { describe, expect, it } from 'vitest'

import { claimFactor, spousalBenefitFactor } from './claimFactor'

/**
 * Atomic oracle tests for the spousal claim factor and claim-age range guards
 * (Phase 1 P1, calculation-test-plan.md).
 *
 * Spousal reduction (SSA): 25/36% per month for the first 36 months before FRA,
 * 5/12% per month beyond, and NO delayed credits past FRA. Worker born 1962 -> FRA 67.
 */
describe('spousal claim-factor golden worksheets (FRA 67)', () => {
  it('reduces a spousal benefit by 35% at 60 months early (age 62)', () => {
    // 36*(25/36)% + 24*(5/12)% = 25% + 10% = 35% -> factor 0.65.
    expect(spousalBenefitFactor(1962, 6, 15, { years: 62, months: 0 })).toBeCloseTo(0.65, 12)
  })

  it('reduces a spousal benefit by 25% at exactly 36 months early (age 64)', () => {
    expect(spousalBenefitFactor(1962, 6, 15, { years: 64, months: 0 })).toBeCloseTo(0.75, 12)
  })

  it('reduces a spousal benefit by 8.333% at 12 months early (age 66)', () => {
    // 12 * 25/36% = 8.3333% -> factor 0.9166667.
    expect(spousalBenefitFactor(1962, 6, 15, { years: 66, months: 0 })).toBeCloseTo(0.9166667, 6)
  })

  it('is 1.0 at FRA and earns no delayed credits past FRA', () => {
    expect(spousalBenefitFactor(1962, 6, 15, { years: 67, months: 0 })).toBe(1)
    expect(spousalBenefitFactor(1962, 6, 15, { years: 70, months: 0 })).toBe(1)
  })
})

describe('claim-age range guards', () => {
  it('rejects claim ages below 62y0m', () => {
    expect(() => claimFactor(1962, 6, 15, { years: 61, months: 11 })).toThrow(RangeError)
    expect(() => spousalBenefitFactor(1962, 6, 15, { years: 61, months: 11 })).toThrow(RangeError)
  })

  it('rejects claim ages above 70y0m', () => {
    expect(() => claimFactor(1962, 6, 15, { years: 70, months: 1 })).toThrow(RangeError)
    expect(() => spousalBenefitFactor(1962, 6, 15, { years: 71, months: 0 })).toThrow(RangeError)
  })

  it('accepts the inclusive 62y0m and 70y0m endpoints', () => {
    expect(() => claimFactor(1962, 6, 15, { years: 62, months: 0 })).not.toThrow()
    expect(() => claimFactor(1962, 6, 15, { years: 70, months: 0 })).not.toThrow()
  })
})
