import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  capAuxiliaryForFamilyMaximum,
  familyMaximumEligibilityYearFromDobParts,
  familyMaximumMonthlyFromPia,
} from './familyMaximum.js'

describe('family maximum bend point formula', () => {
  // 42 U.S.C. 403(a)(2) applies each rate only to the part of the PIA inside
  // its own band. The common shorthand -- that the family maximum is roughly
  // 150 to 188 percent of the PIA -- invites applying a single percentage to
  // the whole, which understates every record above the first bend point.
  //
  // 2025 family-maximum bend points 1,567 / 2,262 / 2,950, PIA 3,500:
  //   1.50 x 1,567             = 2,350.50
  //   2.72 x (2,262 - 1,567)   = 1,890.40
  //   1.34 x (2,950 - 2,262)   =   921.92
  //   1.75 x (3,500 - 2,950)   =   962.50
  //   total 6,125.32, decreased to the next lower dime = 6,125.30
  // A flat 150 percent on the whole PIA would give 5,250.
  describeRule('usc-42-403-a-2-family-maximum-formula', {
    readings: { marginalAcrossBendPoints: 6_125.3, flatOneHundredFiftyPercent: 5_250 },
    accepted: 'marginalAcrossBendPoints',
  }, ({ accepted, readings }) => {
    it('applies each rate only to the PIA inside its own band', () => {
      expect(familyMaximumMonthlyFromPia(3_500, 2025)).toBeCloseTo(accepted, 6)
      expect(familyMaximumMonthlyFromPia(3_500, 2025))
        .not.toBeCloseTo(readings.flatOneHundredFiftyPercent, 6)
    })
  })
})

describe('familyMaximumMonthlyFromPia', () => {
  it('matches the SSA 2026 retirement/survivor family maximum worksheet', () => {
    // 2026 bend points: 1,643 / 2,371 / 3,093.
    // 150% of 1,643 + 272% of 728 + 134% of 629 = 5,287.52, rounded down to dime.
    expect(familyMaximumMonthlyFromPia(3_000, 2026)).toBe(5_287.5)
  })

  it('uses the Jan 1 birth-year rule for eligibility', () => {
    expect(familyMaximumEligibilityYearFromDobParts(1964, 1, 1)).toBe(2025)
    expect(familyMaximumEligibilityYearFromDobParts(1964, 6, 15)).toBe(2026)
  })
})

describe('capAuxiliaryForFamilyMaximum', () => {
  it('caps the current-spouse auxiliary to the room left by the worker benefit', () => {
    expect(
      capAuxiliaryForFamilyMaximum({
        workerPiaMonthly: 1_000,
        workerActualMonthly: 1_240,
        workerDob: { year: 1960, month: 6, day: 15 },
        auxiliaryMonthly: 500,
      }),
    ).toBe(260)
  })

  it('leaves an auxiliary unchanged when the worker record has enough room', () => {
    expect(
      capAuxiliaryForFamilyMaximum({
        workerPiaMonthly: 4_000,
        workerActualMonthly: 4_000,
        workerDob: { year: 1960, month: 6, day: 15 },
        auxiliaryMonthly: 2_000,
      }),
    ).toBe(2_000)
  })
})
