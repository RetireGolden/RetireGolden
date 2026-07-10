import { describe, expect, it } from 'vitest'

import { expectedPvCouple, expectedPvSingle, survivalCurve, type ClaimantInput } from './expectedPv'

const dob1962 = { year: 1962, month: 6, day: 15 } // FRA 67

function claimant(over: Partial<ClaimantInput> = {}): ClaimantInput {
  return {
    currentAge: 62,
    dob: dob1962,
    sex: 'average',
    piaMonthly: 2_000,
    claimAge: { years: 67, months: 0 },
    ...over,
  }
}

describe('survivalCurve', () => {
  it('is 1 to the same/earlier age and decreases with age', () => {
    const c = survivalCurve('average')
    expect(c.survival(65, 65)).toBe(1)
    expect(c.survival(65, 64)).toBe(1)
    const s75 = c.survival(65, 75)
    const s85 = c.survival(65, 85)
    expect(s75).toBeGreaterThan(0)
    expect(s75).toBeLessThan(1)
    expect(s85).toBeLessThan(s75)
  })

  it('reproduces a plausible one-year mortality around 65', () => {
    const c = survivalCurve('male')
    const p = c.survival(65, 66) // one-year survival ~0.98
    expect(p).toBeGreaterThan(0.97)
    expect(p).toBeLessThan(0.995)
  })

  it('a longevity multiplier > 1 raises survival to later ages', () => {
    const base = survivalCurve('average', 1)
    const longer = survivalCurve('average', 1.2)
    expect(longer.survival(65, 90)).toBeGreaterThan(base.survival(65, 90))
  })
})

describe('expectedPvSingle', () => {
  it('favors delaying at a low discount rate', () => {
    const early = expectedPvSingle(claimant({ claimAge: { years: 62, months: 0 } }), { discountRate: 0 })
    const late = expectedPvSingle(claimant({ claimAge: { years: 70, months: 0 } }), { discountRate: 0 })
    expect(late).toBeGreaterThan(early)
  })

  it('favors claiming early at a high discount rate', () => {
    const early = expectedPvSingle(claimant({ claimAge: { years: 62, months: 0 } }), { discountRate: 0.1 })
    const late = expectedPvSingle(claimant({ claimAge: { years: 70, months: 0 } }), { discountRate: 0.1 })
    expect(early).toBeGreaterThan(late)
  })

  it('decreases as the discount rate rises', () => {
    const c = claimant()
    const low = expectedPvSingle(c, { discountRate: 0.01 })
    const high = expectedPvSingle(c, { discountRate: 0.05 })
    expect(high).toBeLessThan(low)
  })

  it('scales linearly with PIA', () => {
    const one = expectedPvSingle(claimant({ piaMonthly: 1_000 }), { discountRate: 0.02 })
    const two = expectedPvSingle(claimant({ piaMonthly: 2_000 }), { discountRate: 0.02 })
    expect(two).toBeCloseTo(one * 2, 6)
  })
})

describe('expectedPvCouple', () => {
  const high = claimant({ piaMonthly: 3_000 })
  const low = claimant({ piaMonthly: 1_000 })

  it('rewards delaying the HIGHER earner more than delaying the lower earner', () => {
    // Survivor inherits the larger benefit, so the high earner's delay protects
    // whichever spouse lives longer — the core couples result.
    const delayHigh = expectedPvCouple(
      { ...high, claimAge: { years: 70, months: 0 } },
      { ...low, claimAge: { years: 62, months: 0 } },
      { discountRate: 0.02 },
    )
    const delayLow = expectedPvCouple(
      { ...high, claimAge: { years: 62, months: 0 } },
      { ...low, claimAge: { years: 70, months: 0 } },
      { discountRate: 0.02 },
    )
    expect(delayHigh).toBeGreaterThan(delayLow)
  })

  it('exceeds the lone higher earner thanks to spousal + survivor value', () => {
    const couple = expectedPvCouple(high, low, { discountRate: 0.02 })
    const soloHigh = expectedPvSingle(high, { discountRate: 0.02 })
    expect(couple).toBeGreaterThan(soloHigh)
  })
})
