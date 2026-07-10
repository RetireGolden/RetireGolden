import { describe, expect, it } from 'vitest'

import {
  capAuxiliaryForFamilyMaximum,
  familyMaximumEligibilityYearFromDobParts,
  familyMaximumMonthlyFromPia,
} from './familyMaximum'

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
