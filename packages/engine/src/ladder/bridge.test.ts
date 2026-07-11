import { describe, expect, it } from 'vitest'

import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { claimFactor } from '../socialSecurity/claimFactor.js'
import { sizeBridge } from './bridge.js'

// Born 1964 → FRA 67; age 62 in 2026.
const base = {
  piaMonthly: 2_000,
  dob: { year: 1964, month: 6, day: 15 },
  claimAge: { years: 70, months: 0 },
  currentYear: 2026,
  retirementYear: 2026,
  curve: EMBEDDED_REAL_YIELD_CURVE,
}

describe('sizeBridge', () => {
  it('reproduces the BPC framing: the bridge pays the forgone age-62 benefit until the claim age', () => {
    const bridge = sizeBridge(base)!
    expect(bridge).not.toBeNull()
    // Age-62 benefit for FRA-67: 70% of PIA (60 months early).
    const factor62 = claimFactor(1964, 6, 15, { years: 62, months: 0 })
    expect(factor62).toBeCloseTo(0.7, 6)
    expect(bridge.monthlyAge62Benefit).toBeCloseTo(2_000 * 0.7, 6)
    expect(bridge.annualRealAmount).toBeCloseTo(16_800, 6)
    // Gap window: next year (62 attained in 2026, already mid-year) → the year
    // before the age-70 claim (2034).
    expect(bridge.startYear).toBe(2027)
    expect(bridge.endYear).toBe(2033)
    expect(bridge.years).toBe(7)
    // Cost is near years × annual amount, discounted (real yields > 0).
    expect(bridge.ladderCost).toBeGreaterThan(16_800 * 7 * 0.8)
    expect(bridge.ladderCost).toBeLessThan(16_800 * 7)
  })

  it('starts no earlier than age 62 for an early retiree', () => {
    const bridge = sizeBridge({ ...base, dob: { year: 1970, month: 1, day: 1 }, retirementYear: 2028 })!
    // Age 62 in 2032 > retirement 2028 → the bridge waits for eligibility.
    expect(bridge.startYear).toBe(2032)
    expect(bridge.endYear).toBe(2039)
  })

  it('starts at retirement for someone already past 62', () => {
    const bridge = sizeBridge({ ...base, dob: { year: 1960, month: 1, day: 1 }, retirementYear: 2028 })!
    expect(bridge.startYear).toBe(2028)
    expect(bridge.endYear).toBe(2029)
  })

  it('bridges the claim year itself for a mid-year claim (months > 0)', () => {
    // Claiming at 67y6m: the ledger pays SS only from the claim month, so the
    // pre-claim months of the age-67 year need bridge income too — the window
    // extends through the claim year (slightly conservative overlap).
    const midYear = sizeBridge({ ...base, claimAge: { years: 67, months: 6 } })!
    const wholeYear = sizeBridge({ ...base, claimAge: { years: 67, months: 0 } })!
    expect(wholeYear.endYear).toBe(1964 + 67 - 1)
    expect(midYear.endYear).toBe(1964 + 67)
    expect(midYear.years).toBe(wholeYear.years + 1)
  })

  it('returns null when there is nothing to bridge', () => {
    expect(sizeBridge({ ...base, claimAge: { years: 62, months: 0 } })).toBeNull()
    expect(sizeBridge({ ...base, piaMonthly: 0 })).toBeNull()
    // Claiming at 63 with the gap year already in the past → no fundable years.
    expect(sizeBridge({ ...base, dob: { year: 1961, month: 1, day: 1 }, claimAge: { years: 63, months: 0 } })).toBeNull()
  })
})
