import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  SURVIVOR_EARLIEST_AGE,
  SURVIVOR_MAX_REDUCTION,
  WIDOW_LIMIT_PIA_FRACTION,
  survivorReductionFactor,
  survivorBenefitMonthly,
} from './survivorBenefit.js'

// Survivor FRA for born 1962+ is 66y8m = 66*12 + 8 = 800 months.
const SURVIVOR_FRA_1962PLUS = 66 * 12 + 8
// Survivor FRA for born 1951–56 is 66y0m = 792 months.
const SURVIVOR_FRA_1951TO56 = 66 * 12

const age = (years: number, months = 0) => ({ years, months })

describe('widow benefit base', () => {
  // 42 U.S.C. 402(e)(2)(A) sets the widow benefit at the deceased's PRIMARY
  // INSURANCE AMOUNT -- the whole of it. The one-half fraction of 402(b)(2)
  // belongs to a spouse of a LIVING worker, and carrying it across to the
  // survivor case halves the benefit at exactly the point a household can
  // least afford it.
  //
  // Deceased PIA 2,000 who claimed at their own full retirement age, so no
  // delayed credits are deemed in under 402(e)(2)(C) and the 82.5 percent
  // widow limit of 402(e)(2)(D) sits below the PIA without binding. The
  // survivor claims at 67y0m against a survivor FRA of 66y8m -- four months
  // PAST it, not at it, so the widow(er) reduction factor is 1 and the base
  // reaches the assertion untouched. Deliberately past rather than exactly on
  // the boundary: this fixture is about what the base IS, and parking it on
  // the at-or-after comparison would let an unrelated off-by-one in the
  // reduction schedule break it for a reason that has nothing to do with
  // 402(e)(2)(A). The boundary itself is covered by survivorReductionFactor
  // below.
  //   402(e)(2)(A):        2,000
  //   spousal half:        1,000
  describeRule('usc-42-402-e-2-widow-full-pia', {
    readings: { fullPrimaryInsuranceAmount: 2_000, halfAsForALivingWorkerSpouse: 1_000 },
    accepted: 'fullPrimaryInsuranceAmount',
  }, ({ accepted, readings }) => {
    it('pays the whole primary insurance amount to an unreduced survivor', () => {
      const monthly = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_000,
        deceasedActualMonthly: 2_000,
        survivorClaimAge: { years: 67, months: 0 },
        survivorFraMonths: SURVIVOR_FRA_1962PLUS,
      })

      expect(monthly).toBeCloseTo(accepted, 6)
      expect(monthly).not.toBeCloseTo(readings.halfAsForALivingWorkerSpouse, 6)
    })
  })
})

describe('survivorReductionFactor', () => {
  it('is 1.0 at/after the survivor FRA', () => {
    expect(survivorReductionFactor(67 * 12, SURVIVOR_FRA_1962PLUS)).toBe(1)
    expect(survivorReductionFactor(70 * 12, SURVIVOR_FRA_1962PLUS)).toBe(1)
  })

  it('is 1.0 when claiming at exactly the survivor FRA in months (66y8m for born 1962+)', () => {
    // The bug this guards: a survivor claiming at exactly 66y8m must NOT be reduced.
    expect(survivorReductionFactor(66 * 12 + 8, SURVIVOR_FRA_1962PLUS)).toBe(1)
  })

  it('is reduced just below the survivor FRA (66y7m when FRA is 66y8m)', () => {
    expect(survivorReductionFactor(66 * 12 + 7, SURVIVOR_FRA_1962PLUS)).toBeLessThan(1)
  })

  it('applies the full 28.5% reduction at the earliest age (60)', () => {
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(1 - SURVIVOR_MAX_REDUCTION, 10)
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(0.715, 6)
  })

  it('clamps below 60 to the same floor', () => {
    expect(survivorReductionFactor(50 * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(0.715, 6)
  })

  it('reduces linearly at a midpoint between 60 and FRA', () => {
    // FRA 66y0m = 792 months; earliest 60y = 720 months. Age 63 = 756 months.
    // frac = (756 - 720) / (792 - 720) = 0.5 → reduction = 28.5% × 0.5 = 14.25% → factor 0.8575.
    expect(survivorReductionFactor(63 * 12, SURVIVOR_FRA_1951TO56)).toBeCloseTo(0.8575, 4)
  })

  it('uses the survivor FRA, not the retirement FRA (66y8m for born 1962+)', () => {
    // A 66-year-old survivor is still below survivor FRA 66y8m → reduced, not 1.0.
    expect(survivorReductionFactor(66 * 12, SURVIVOR_FRA_1962PLUS)).toBeLessThan(1)
    // But a 66-year-old whose survivor FRA is 66y0m (born 1951–56) is at FRA → 1.0.
    expect(survivorReductionFactor(66 * 12, SURVIVOR_FRA_1951TO56)).toBe(1)
  })
})

describe('survivorBenefitMonthly', () => {
  it('returns 0 when the deceased had no PIA', () => {
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: 0,
      deceasedActualMonthly: 0,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBe(0)
  })

  it('pays the deceased actual benefit at survivor FRA when the deceased delayed', () => {
    // Deceased delayed to 70: actual = 124% of PIA. Survivor at FRA → base = max(124%, 82.5%) = 124%.
    const pia = 2000
    const actual = pia * 1.24
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: actual,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(actual, 6)
  })

  it('is unreduced when claiming at exactly the survivor FRA (66y8m)', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(66, 8),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(pia, 6)
  })

  it('floors the survivor at 82.5% of PIA (RIB-LIM) when the deceased claimed early', () => {
    // Deceased claimed at 62: actual = 70% of PIA. RIB-LIM floor = 82.5%.
    const pia = 2000
    const actual = pia * 0.70
    const atFra = survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: actual,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })
    expect(atFra).toBeCloseTo(WIDOW_LIMIT_PIA_FRACTION * pia, 6)
    expect(atFra).toBeGreaterThan(actual) // RIB-LIM lifts the survivor above the deceased's reduced benefit
  })

  it('applies the widow reduction on top of the RIB-LIM floor', () => {
    // Deceased claimed at 62 (70% PIA); survivor claims at 60.
    // base = max(70%, 82.5%) = 82.5% of PIA; × 0.715 = 58.9875% of PIA.
    const pia = 2000
    const actual = pia * 0.70
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: actual,
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(WIDOW_LIMIT_PIA_FRACTION * pia * 0.715, 6)
  })

  it('at survivor FRA: deceased claimed at FRA → 100% of PIA', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(pia, 6)
  })

  it('is monotonic in the deceased PIA', () => {
    const claim = (pia: number) => survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia, // claimed at FRA
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })
    expect(claim(1000)).toBeLessThanOrEqual(claim(2000))
    expect(claim(2000)).toBeLessThanOrEqual(claim(3000))
  })
})
