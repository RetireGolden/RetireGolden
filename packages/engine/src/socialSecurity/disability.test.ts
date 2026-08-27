import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { ssdiMonthlyBenefit, ssdiSuspendedBySga, inSsdiWindow, SGA_ANNUAL_MONTHS } from './disability.js'
import { computePiaFromEarnings, isPiaFromEarningsError } from './piaFromEarnings.js'
import { AWI_BY_YEAR } from './ssaWageData.js'

describe('ssdiMonthlyBenefit', () => {
  it('returns the PIA with no early-retirement reduction', () => {
    expect(ssdiMonthlyBenefit(2_000)).toBe(2_000)
  })

  it('is the full PIA even for an onset well before 62 (the SSDI difference)', () => {
    // Early retirement at 55 would reduce ~30%; SSDI pays the full PIA.
    expect(ssdiMonthlyBenefit(2_000)).toBe(2_000)
    expect(ssdiMonthlyBenefit(2_000)).toBeGreaterThan(2_000 * 0.70)
  })

  it('floors at zero for a negative PIA input', () => {
    expect(ssdiMonthlyBenefit(-1)).toBe(0)
  })
})

describe('ssdiSuspendedBySga', () => {
  const sgaMonthly = 1_690 // 2026 non-blind monthly SGA, 90 FR 49047
  const annual = sgaMonthly * SGA_ANNUAL_MONTHS // 20,280

  it('does not suspend when wages are at or below the annual SGA limit', () => {
    expect(ssdiSuspendedBySga(0, annual)).toBe(false)
    expect(ssdiSuspendedBySga(annual, annual)).toBe(false)
  })

  it('suspends when wages exceed the annual SGA limit', () => {
    expect(ssdiSuspendedBySga(annual + 1, annual)).toBe(true)
    expect(ssdiSuspendedBySga(60_000, annual)).toBe(true)
  })
})

describe('inSsdiWindow', () => {
  const onsetAge = 58
  const fraYears = 67

  it('is false before the onset age', () => {
    expect(inSsdiWindow(55, onsetAge, fraYears)).toBe(false)
    expect(inSsdiWindow(57, onsetAge, fraYears)).toBe(false)
  })

  it('is true from onset through FRA-1 (the SSDI window, pre-conversion)', () => {
    expect(inSsdiWindow(58, onsetAge, fraYears)).toBe(true)
    expect(inSsdiWindow(62, onsetAge, fraYears)).toBe(true)
    expect(inSsdiWindow(66, onsetAge, fraYears)).toBe(true)
  })

  it('is false at/after FRA (SSDI has converted to retirement)', () => {
    expect(inSsdiWindow(67, onsetAge, fraYears)).toBe(false)
    expect(inSsdiWindow(70, onsetAge, fraYears)).toBe(false)
  })
})

// Hand worksheet for 42 U.S.C. 415(b)(2)(B): born 1964, hence the 1986–2025
// base window. The 33 1986–2018 earnings equal the published AWI for their
// year, so each indexes to floor(69,846.57) = 69,846 in 2024 index dollars.
// The seven calendar years 2019–2025 are wholly inside a documented disability
// period and have zero earnings. A freeze excludes those seven years, then the
// five-year dropout leaves 28 computation years:
//   28 × 69,846 ÷ (28 × 12) = 5,820.5 → 5,820 AIME.
// The helper has no period-of-disability input, so it retains two zero years
// after its ordinary five-year dropout: 33 x 69,846 / 420 = 5,487.9 -> 5,487.
function disabilityFreezeEarnings(): { year: number; amount: number }[] {
  return Array.from({ length: 33 }, (_, index) => {
    const year = 1986 + index
    const amount = AWI_BY_YEAR[year]
    if (amount === undefined) throw new Error(`expected published AWI for ${year}`)
    return { year, amount }
  })
}

describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    disabilityYearsExcludedFromAime: 5_820,
    ordinaryFiveYearDropoutLeavesTwoDisabilityZeros: 5_487,
  },
  accepted: 'disabilityYearsExcludedFromAime',
  produced: 'ordinaryFiveYearDropoutLeavesTwoDisabilityZeros',
}, ({ accepted, produced }) => {
  it('does not exclude seven wholly disabled zero-earnings years from the AIME divisor', () => {
    const result = computePiaFromEarnings({
      dobYear: 1964,
      dobMonth: 6,
      dobDay: 15,
      earnings: disabilityFreezeEarnings(),
      lastEarningsYear: 2025,
    })
    if (isPiaFromEarningsError(result)) throw new Error(`expected PIA result, received ${result.code}`)

    expect(result.aime).toBe(produced)
    expect(result.aime).not.toBe(accepted)
  })
})
