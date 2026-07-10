import { describe, expect, it } from 'vitest'

import {
  expectedPvSwitch,
  rankSwitchStrategies,
  survivorReductionFactor,
  type SwitchingInput,
} from './survivorSwitching'

describe('survivorReductionFactor', () => {
  const fra67 = 67 * 12
  it('is full at or after FRA and 28.5% reduced at 60', () => {
    expect(survivorReductionFactor(67 * 12, fra67)).toBe(1)
    expect(survivorReductionFactor(70 * 12, fra67)).toBe(1)
    expect(survivorReductionFactor(60 * 12, fra67)).toBeCloseTo(0.715, 5)
  })
  it('interpolates linearly between 60 and FRA', () => {
    // Midpoint age 63.5y = 762 months → half the max reduction.
    expect(survivorReductionFactor(762, fra67)).toBeCloseTo(1 - 0.285 / 2, 5)
  })
})

// Widow born 1962 (FRA 67), age 60 today.
const base: SwitchingInput = {
  dob: { year: 1962, month: 1, day: 1 },
  sex: 'female',
  currentAge: 60,
  ownPiaMonthly: 1_500,
  survivorMonthly: 2_500,
  longevityMultiplier: 1,
}
const opts = { discountRate: 0.02 }

describe('rankSwitchStrategies', () => {
  it('returns strategies sorted by expected PV (descending)', () => {
    const ranked = rankSwitchStrategies(base, opts)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.expectedPv).toBeGreaterThanOrEqual(ranked[i]!.expectedPv)
    }
  })

  it('never does worse than the best single-benefit-only strategy', () => {
    const ranked = rankSwitchStrategies(base, opts)
    const top = ranked[0]!.expectedPv
    const ownOnly = expectedPvSwitch(base, { survivorClaimAge: null, ownClaimAge: 70 }, opts)
    const survivorOnly = expectedPvSwitch(base, { survivorClaimAge: 67, ownClaimAge: null }, opts)
    expect(top).toBeGreaterThanOrEqual(ownOnly)
    expect(top).toBeGreaterThanOrEqual(survivorOnly)
  })

  it('uses both benefits when both are positive (bridge with one, switch to the other)', () => {
    const top = rankSwitchStrategies(base, opts)[0]!
    expect(top.strategy.survivorClaimAge).not.toBeNull()
    expect(top.strategy.ownClaimAge).not.toBeNull()
  })

  it('when the survivor benefit dwarfs own, the survivor benefit drives the answer', () => {
    const dwarf = { ...base, ownPiaMonthly: 800, survivorMonthly: 3_000 }
    const top = rankSwitchStrategies(dwarf, opts)[0]!
    expect(top.strategy.survivorClaimAge).not.toBeNull()
    // Own alone is far worse than the top — the survivor benefit drives the answer.
    // (The top may still claim own early to fill the gap before survivor starts,
    //  which is a legitimate switching strategy, so it can beat survivor-only.)
    const ownOnly = expectedPvSwitch(dwarf, { survivorClaimAge: null, ownClaimAge: 70 }, opts)
    expect(top.expectedPv).toBeGreaterThan(ownOnly)
  })

  it('when own dwarfs the survivor benefit, the top strategy delays own to 70', () => {
    const ranked = rankSwitchStrategies({ ...base, ownPiaMonthly: 3_000, survivorMonthly: 800 }, opts)
    const top = ranked[0]!
    expect(top.strategy.ownClaimAge).toBe(70)
    expect(top.strategy.survivorClaimAge).not.toBeNull()
  })

  it('respects the current age (no claiming in the past)', () => {
    const ranked = rankSwitchStrategies({ ...base, currentAge: 68 }, opts)
    for (const r of ranked) {
      if (r.strategy.survivorClaimAge !== null) expect(r.strategy.survivorClaimAge).toBeGreaterThanOrEqual(68)
      if (r.strategy.ownClaimAge !== null) expect(r.strategy.ownClaimAge).toBeGreaterThanOrEqual(68)
    }
  })

  it('offers a claim-now option for a widow already past the earliest age', () => {
    // 63-year-old: must be able to take the survivor benefit now (and own now),
    // not only at the fixed 60/FRA grid.
    const ranked = rankSwitchStrategies({ ...base, currentAge: 63 }, opts)
    expect(ranked.some((r) => r.strategy.survivorClaimAge === 63)).toBe(true)
    expect(ranked.some((r) => r.strategy.ownClaimAge === 63)).toBe(true)
  })

  it('still offers a benefit for someone past FRA', () => {
    const ranked = rankSwitchStrategies({ ...base, currentAge: 72 }, opts)
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked.some((r) => r.strategy.survivorClaimAge === 72)).toBe(true)
    expect(ranked.some((r) => r.strategy.ownClaimAge === 70)).toBe(true)
  })
})
