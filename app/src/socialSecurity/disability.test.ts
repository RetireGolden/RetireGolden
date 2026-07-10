import { describe, expect, it } from 'vitest'

import { ssdiMonthlyBenefit, ssdiSuspendedBySga, inSsdiWindow, SGA_ANNUAL_MONTHS } from './disability'

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
  const sgaMonthly = 1_620
  const annual = sgaMonthly * SGA_ANNUAL_MONTHS // 19,440

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
