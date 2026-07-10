import { describe, expect, it } from 'vitest'
import {
  delayedRetirementFactor,
  earlyRetirementFactor,
  retirementBenefitPiaFactor,
} from './benefitFactor'

describe('earlyRetirementFactor', () => {
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
