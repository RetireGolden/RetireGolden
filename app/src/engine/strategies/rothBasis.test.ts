import { describe, expect, it } from 'vitest'

import { emptyRothBasis, splitRothWithdrawal, type RothBasisState } from './rothBasis'

describe('splitRothWithdrawal — ordering', () => {
  const state: RothBasisState = {
    contributionBasis: 20_000,
    conversionLayers: [
      { year: 2020, amount: 30_000, taxableAmount: 30_000 }, // seasoned by 2026
      { year: 2024, amount: 15_000, taxableAmount: 15_000 }, // unseasoned in 2026
    ],
  }

  it('takes contributions first — free at any age', () => {
    const r = splitRothWithdrawal(state, 12_000, 2026, 45)
    expect(r.contributions).toBe(12_000)
    expect(r.conversions).toBe(0)
    expect(r.earnings).toBe(0)
    expect(r.penalty).toBe(0)
    expect(r.taxableOrdinary).toBe(0)
    expect(r.next.contributionBasis).toBe(8_000)
  })

  it('moves to conversions (oldest first) after contributions are exhausted', () => {
    // 20k contributions + 25k more → all 20k basis, then 25k from the 2020 layer.
    const r = splitRothWithdrawal(state, 45_000, 2026, 45)
    expect(r.contributions).toBe(20_000)
    expect(r.conversions).toBe(25_000)
    expect(r.penalty).toBe(0) // the 2020 layer is seasoned (>5y)
    expect(r.next.contributionBasis).toBe(0)
    expect(r.next.conversionLayers).toEqual([
      { year: 2020, amount: 5_000, taxableAmount: 5_000 },
      { year: 2024, amount: 15_000, taxableAmount: 15_000 },
    ])
  })
})

describe('splitRothWithdrawal — 5-year conversion recapture', () => {
  it('penalizes an unseasoned conversion tapped before 59½', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 50) // 2 years < 5, age < 60
    expect(r.conversions).toBe(10_000)
    expect(r.taxableOrdinary).toBe(0) // never income-taxed again
    expect(r.penalty).toBeCloseTo(1_000, 6) // 10% recapture
  })

  it('does not penalize the same conversion once 5 years pass', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2029, 50) // 5 years elapsed
    expect(r.penalty).toBe(0)
  })

  it('does not penalize an unseasoned conversion once 59½ (age 60) is reached', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 10_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 60)
    expect(r.penalty).toBe(0)
  })

  it('recaptures only the taxable share of a conversion that carried IRA basis', () => {
    // A $10k conversion that was half nondeductible basis: the full $10k returns
    // tax-free (never treated as earnings), but only the $5k taxable share is
    // penalized when tapped unseasoned before 59½ (IRS Pub 590-B).
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 5_000 }]
    const r = splitRothWithdrawal(state, 10_000, 2026, 50)
    expect(r.conversions).toBe(10_000)
    expect(r.earnings).toBe(0) // the basis share is principal, not earnings
    expect(r.taxableOrdinary).toBe(0)
    expect(r.penalty).toBeCloseTo(500, 6) // 10% of the $5k taxable share only
  })

  it('recaptures the taxable share proportionally on a partial tap', () => {
    const state = emptyRothBasis(0)
    state.conversionLayers = [{ year: 2024, amount: 10_000, taxableAmount: 4_000 }]
    const r = splitRothWithdrawal(state, 5_000, 2026, 50) // taps half the layer
    expect(r.conversions).toBe(5_000)
    expect(r.penalty).toBeCloseTo(200, 6) // 10% of half the $4k taxable share
    expect(r.next.conversionLayers).toEqual([{ year: 2024, amount: 5_000, taxableAmount: 2_000 }])
  })
})

describe('splitRothWithdrawal — earnings', () => {
  const withEarnings: RothBasisState = { contributionBasis: 5_000, conversionLayers: [] }

  it('taxes and penalizes earnings withdrawn before 59½', () => {
    const r = splitRothWithdrawal(withEarnings, 9_000, 2026, 45) // 5k basis, 4k earnings
    expect(r.contributions).toBe(5_000)
    expect(r.earnings).toBe(4_000)
    expect(r.taxableOrdinary).toBe(4_000)
    expect(r.penalty).toBeCloseTo(400, 6)
  })

  it('treats earnings as fully qualified at 60+', () => {
    const r = splitRothWithdrawal(withEarnings, 9_000, 2026, 62)
    expect(r.earnings).toBe(4_000)
    expect(r.taxableOrdinary).toBe(0)
    expect(r.penalty).toBe(0)
  })
})
