import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  delayedRetirementFactor,
  earlyRetirementFactor,
  retirementBenefitPiaFactor,
} from './benefitFactor.js'

describe('earlyRetirementFactor', () => {
  // 20 CFR 404.410(a) changes rate after 36 months: 5/9 of 1 percent for the
  // first 36, then 5/12 of 1 percent. Carrying 5/9 all the way through is the
  // natural misreading and over-reduces anyone claiming more than three years
  // early -- which is every claim at 62 against a full retirement age above 65.
  //
  // 48 months early: 36 x 5/9 = 20 percent, plus 12 x 5/12 = 5 percent, so a
  // 25 percent reduction and a factor of exactly 0.75. At a flat 5/9 the
  // reduction would be 48 x 5/9 = 26.67 percent, a factor of about 0.7333.
  describeRule('cfr-20-404-410-early-retirement-reduction', {
    readings: { rateChangesAfterThirtySix: 0.75, flatFiveNinthsThroughout: 0.7333333333333334 },
    accepted: 'rateChangesAfterThirtySix',
  }, ({ accepted, readings }) => {
    it('slows the reduction after the thirty-sixth month', () => {
      expect(earlyRetirementFactor(48)).toBeCloseTo(accepted, 10)
      expect(earlyRetirementFactor(48)).not.toBeCloseTo(readings.flatFiveNinthsThroughout, 6)
      // The two readings agree at exactly 36 months, which is why the fixture
      // has to look past the boundary to discriminate at all.
      expect(earlyRetirementFactor(36)).toBeCloseTo(0.8, 10)
    })
  })

  it('matches 30% reduction at 60 months early (FRA 67 vs claim 62)', () => {
    const f = earlyRetirementFactor(60)
    expect(f).toBeCloseTo(0.7, 6)
  })

  it('matches 25% reduction at 48 months early (FRA 66 vs claim 62)', () => {
    const f = earlyRetirementFactor(48)
    expect(f).toBeCloseTo(0.75, 6)
  })
})

describe('delayedRetirementFactor', () => {
  it('adds 24% at 36 months for max DRC to 70 from FRA 67', () => {
    const f = delayedRetirementFactor(36, 36)
    expect(f).toBeCloseTo(1.24, 6)
  })
})

describe('retirementBenefitPiaFactor', () => {
  it('claim 62 vs FRA 67 → 70% PIA', () => {
    const f = retirementBenefitPiaFactor(62, { years: 67, extraMonths: 0 })
    expect(f).toBeCloseTo(0.7, 6)
  })

  it('claim 70 vs FRA 67 → 124% PIA', () => {
    const f = retirementBenefitPiaFactor(70, { years: 67, extraMonths: 0 })
    expect(f).toBeCloseTo(1.24, 6)
  })

  it('claim 66 vs FRA 66 → 100% PIA', () => {
    const f = retirementBenefitPiaFactor(66, { years: 66, extraMonths: 0 })
    expect(f).toBeCloseTo(1, 6)
  })

  it('claim 62 vs FRA 66 → 75% PIA', () => {
    const f = retirementBenefitPiaFactor(62, { years: 66, extraMonths: 0 })
    expect(f).toBeCloseTo(0.75, 6)
  })
})
