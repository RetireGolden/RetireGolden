import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  emptyRothBasis,
  freeRothCoverCapacity,
  splitRothWithdrawal,
  type RothBasisState,
} from './rothBasis.js'

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

describeRule('irc-408A-d-3-F-roth-conversion-recapture', {
  // A $10,000 conversion of which only $4,000 was includible in gross income,
  // tapped in full two years later at age 50. 408A(d)(3)(F)(i) applies 72(t) to
  // the portion allocable to the conversion; (F)(ii) caps that at the includible
  // amount. Reading (F)(i) alone recaptures the whole principal.
  readings: { statuteIncludiblePortionOnly: 400, rejectedWholeConversionPrincipal: 1_000 },
  accepted: 'statuteIncludiblePortionOnly',
}, ({ accepted, readings }) => {
  const partlyBasisConversion = (): RothBasisState => ({
    contributionBasis: 0,
    conversionLayers: [{ year: 2024, amount: 10_000, taxableAmount: 4_000 }],
  })

  it('recaptures only so much of the conversion as was includible at the time', () => {
    const split = splitRothWithdrawal(partlyBasisConversion(), 10_000, 2026, 50)
    expect(split.penalty).toBeCloseTo(accepted, 6)
    expect(split.penalty).not.toBeCloseTo(readings.rejectedWholeConversionPrincipal, 6)
  })

  it('applies 72(t) without taxing the conversion principal a second time', () => {
    const split = splitRothWithdrawal(partlyBasisConversion(), 10_000, 2026, 50)
    expect(split.conversions).toBe(10_000)
    expect(split.earnings).toBe(0)
    expect(split.taxableOrdinary).toBe(0)
  })

  it('runs the five-taxable-year period from the year of that conversion', () => {
    // The period beginning with 2024 covers 2024 through 2028, so a 2028 tap
    // still recaptures and a 2029 tap does not.
    expect(splitRothWithdrawal(partlyBasisConversion(), 10_000, 2028, 50).penalty)
      .toBeCloseTo(accepted, 6)
    expect(splitRothWithdrawal(partlyBasisConversion(), 10_000, 2029, 50).penalty).toBe(0)
  })
})

describe('freeRothCoverCapacity — FIFO prefix', () => {
  it('sums seasoned and wholly nontaxable unseasoned layers when they lead the queue', () => {
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2020, amount: 30_000, taxableAmount: 30_000 }, // seasoned by 2026
        { year: 2025, amount: 10_000, taxableAmount: 0 }, // nontaxable unseasoned
      ],
    }
    expect(freeRothCoverCapacity(state, 2026, 55)).toBe(40_000)
  })

  it('stops at the first unseasoned taxable layer (deeper free layers are not free cover)', () => {
    // §408A(d)(4)(B)(ii)(I): conversions out FIFO. A later nontaxable unseasoned
    // layer cannot cover a draw without first tapping the blocking taxable layer
    // (which recaptures under §72(t) when pre-59½).
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2026, amount: 10_000, taxableAmount: 10_000 }, // unseasoned taxable — blocks
        { year: 2027, amount: 10_000, taxableAmount: 0 }, // nontaxable, but behind the block
      ],
    }
    // Age 55, year 2028: both layers unseasoned; free cover is 0, not 10k.
    expect(freeRothCoverCapacity(state, 2028, 55)).toBe(0)
    // Removing assumed seed and drawing $10k reaches the 2026 layer → $1,000 §72(t).
    const split = splitRothWithdrawal(state, 10_000, 2028, 55)
    expect(split.penalty).toBeCloseTo(1_000, 6)
  })

  it('includes unseasoned taxable layers once the owner is qualified (age 60+)', () => {
    const state: RothBasisState = {
      contributionBasis: 0,
      conversionLayers: [
        { year: 2026, amount: 10_000, taxableAmount: 10_000 },
        { year: 2027, amount: 10_000, taxableAmount: 0 },
      ],
    }
    expect(freeRothCoverCapacity(state, 2028, 60)).toBe(20_000)
  })
})
