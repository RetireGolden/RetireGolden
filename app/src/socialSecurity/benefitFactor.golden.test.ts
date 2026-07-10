import { describe, expect, it } from 'vitest'

import { delayedRetirementFactor, earlyRetirementFactor } from './benefitFactor'

/**
 * Atomic oracle tests for the SSA early-reduction and delayed-credit factors
 * (Phase 1, calculation-test-plan.md).
 *
 * Worksheets follow SSA's published rules
 * (https://www.ssa.gov/benefits/retirement/planner/agereduction.html):
 *   early reduction = 5/9% per month for the first 36 months, 5/12% beyond;
 *   delayed credit = 2/3% per month after FRA, capped at age 70.
 */
describe('SSA claim-factor golden worksheets', () => {
  it('reduces by 30% when claiming 60 months early (age 62, FRA 67)', () => {
    // 36 * 5/9% + 24 * 5/12% = 20% + 10% = 30% -> factor 0.70.
    expect(earlyRetirementFactor(60)).toBeCloseTo(0.7, 12)
  })

  it('reduces by 25% when claiming 48 months early (age 62, FRA 66)', () => {
    // 36 * 5/9% + 12 * 5/12% = 20% + 5% = 25% -> factor 0.75.
    expect(earlyRetirementFactor(48)).toBeCloseTo(0.75, 12)
  })

  it('reduces by exactly 20% at 36 months early (only the 5/9% band)', () => {
    expect(earlyRetirementFactor(36)).toBeCloseTo(0.8, 12)
  })

  it('is 1.0 at FRA (no reduction)', () => {
    expect(earlyRetirementFactor(0)).toBe(1)
  })

  it('adds 24% delayed credit at age 70 from FRA 67 (36 months)', () => {
    // 36 * 2/3% = 24% -> factor 1.24.
    expect(delayedRetirementFactor(36, 36)).toBeCloseTo(1.24, 12)
  })

  it('adds 32% delayed credit at age 70 from FRA 66 (48 months)', () => {
    // 48 * 2/3% = 32% -> factor 1.32.
    expect(delayedRetirementFactor(48, 48)).toBeCloseTo(1.32, 12)
  })

  it('caps delayed credits at age 70 (no growth past the cap)', () => {
    // Requesting 60 months but capped at 36 -> still 1.24.
    expect(delayedRetirementFactor(60, 36)).toBeCloseTo(1.24, 12)
  })
})
