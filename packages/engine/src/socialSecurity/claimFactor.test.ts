import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { claimFactor, spousalBenefitFactor } from './claimFactor.js'

// Born June 1960 -> SSA effective birth year 1960 -> FRA 67y0m.
const dob = { y: 1960, m: 6, d: 15 }

describe('spousal benefit and delayed credits', () => {
  // 42 U.S.C. 402(b)(2) measures the spousal benefit against the worker's
  // PRIMARY INSURANCE AMOUNT, not against what the worker actually collects.
  // The PIA does not grow with delay, so a spouse claiming after their own full
  // retirement age gains nothing -- the factor tops out at 1.
  //
  // Born 1960 (full retirement age 67), claiming at 70 is 36 months late:
  //   spousal:                        1.00
  //   retirement-style credits:  1 + 36 x 2/3 percent = 1.24
  describeRule('usc-42-402-b-2-spousal-half-of-pia', {
    readings: { noDelayedCreditsOnSpousal: 1, retirementCreditsApplied: 1.24 },
    accepted: 'noDelayedCreditsOnSpousal',
  }, ({ accepted, readings }) => {
    it('stops growing at full retirement age', () => {
      const late = spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })

      expect(late).toBeCloseTo(accepted, 10)
      expect(late).not.toBeCloseTo(readings.retirementCreditsApplied, 6)
      // The worker's own benefit does grow over the same span, which is what
      // makes the difference a rule rather than a rounding artefact.
      expect(claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 }))
        .toBeCloseTo(readings.retirementCreditsApplied, 6)
    })
  })
})

describe('claimFactor', () => {
  it('is 1 at FRA, reduced before, credited after', () => {
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 67, months: 0 })).toBeCloseTo(1, 10)
    // 60 months early: 36×5/9% + 24×5/12% = 30% reduction.
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 62, months: 0 })).toBeCloseTo(0.7, 10)
    // 36 months DRC at 2/3%/mo = 24%.
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })).toBeCloseTo(1.24, 10)
  })
})

describe('spousalBenefitFactor', () => {
  it('is 1 at FRA and never earns delayed credits', () => {
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 67, months: 0 })).toBeCloseTo(1, 10)
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 68, months: 0 })).toBe(1)
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })).toBe(1)
  })

  it('reduces early claims on the steeper spousal schedule (25/36%/mo)', () => {
    // 36 months early: 36 × 25/36% = 25% reduction -> 0.75 (the classic spousal floor at 3 yrs early).
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 64, months: 0 })).toBeCloseTo(0.75, 10)
    // 60 months early: 36×25/36% + 24×5/12% = 25% + 10% = 35% -> 0.65.
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 62, months: 0 })).toBeCloseTo(0.65, 10)
  })

  it('is steeper than the retirement reduction for the same early claim', () => {
    const early = { years: 63, months: 0 }
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, early)).toBeLessThan(claimFactor(dob.y, dob.m, dob.d, early))
  })

  it('rejects out-of-range claim ages', () => {
    expect(() => spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 61, months: 0 })).toThrow()
    expect(() => spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 71, months: 0 })).toThrow()
  })
})
