import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import { acaApplicablePct, acaNetAnnualPremium, acaNetAnnualPremiumByMonth } from './aca.js'

const pack = packForYear(2026).pack

describe('acaApplicablePct', () => {
  it('is flat at the floor below 133% FPL', () => {
    expect(acaApplicablePct(pack, 50)).toBe(2.1)
    expect(acaApplicablePct(pack, 133)).toBe(2.1)
  })

  it('interpolates within bands', () => {
    // Midpoint of the 150–200 band: 4.19 + 0.5×(6.6−4.19)
    expect(acaApplicablePct(pack, 175)).toBeCloseTo(5.395, 6)
  })

  it('is flat at the cap from 300–400%', () => {
    expect(acaApplicablePct(pack, 320)).toBeCloseTo(9.96, 6)
    expect(acaApplicablePct(pack, 400)).toBeCloseTo(9.96, 6)
  })
})

describe('acaNetAnnualPremium', () => {
  it('computes the credit as premium minus expected contribution', () => {
    // Single, MAGI 50,000 -> 319.5% FPL -> 9.96% expected contribution.
    const r = acaNetAnnualPremium(pack, 1, 50_000, 12_000)
    expect(r.overCliff).toBe(false)
    expect(r.expectedContribution).toBeCloseTo(4_980, 6)
    expect(r.credit).toBeCloseTo(7_020, 6)
    expect(r.netAnnualPremium).toBeCloseTo(4_980, 6)
  })

  it('forfeits the entire credit $1 over the 400% cliff', () => {
    const fpl = 15_650
    const justUnder = acaNetAnnualPremium(pack, 1, fpl * 4, 12_000)
    const justOver = acaNetAnnualPremium(pack, 1, fpl * 4 + 1, 12_000)
    expect(justUnder.overCliff).toBe(false)
    expect(justUnder.credit).toBeGreaterThan(5_000)
    expect(justOver.overCliff).toBe(true)
    expect(justOver.credit).toBe(0)
    expect(justOver.netAnnualPremium).toBe(12_000)
  })

  it('scales the poverty line for household size and future years', () => {
    // Couple: FPL = 15,650 + 5,500 = 21,150. Same MAGI -> lower FPL%.
    const single = acaNetAnnualPremium(pack, 1, 60_000, 12_000)
    const couple = acaNetAnnualPremium(pack, 2, 60_000, 12_000)
    expect(single.overCliff).toBe(false)
    expect(single.fplPct).toBeGreaterThan(couple.fplPct)
    // fplScale indexes the guideline forward: same MAGI lands lower.
    const scaled = acaNetAnnualPremium(pack, 1, 63_000, 12_000, 1.05)
    expect(scaled.fplPct).toBeCloseTo(acaNetAnnualPremium(pack, 1, 60_000, 12_000).fplPct, 6)
  })

  it('never credits below zero when income covers the premium', () => {
    const r = acaNetAnnualPremium(pack, 1, 55_000, 3_000) // contribution > premium
    expect(r.credit).toBe(0)
    expect(r.netAnnualPremium).toBe(3_000)
  })
})

describe('acaNetAnnualPremiumByMonth', () => {
  it('matches the annual calculation for twelve equal covered months', () => {
    const annual = acaNetAnnualPremium(pack, 1, 50_000, 12_000)
    const monthly = acaNetAnnualPremiumByMonth(pack, 1, 50_000, new Array<number>(12).fill(1_000))
    expect(monthly.expectedContribution).toBeCloseTo(annual.expectedContribution, 6)
    expect(monthly.credit).toBeCloseTo(annual.credit, 6)
    expect(monthly.netAnnualPremium).toBeCloseTo(annual.netAnnualPremium, 6)
  })

  it('charges only the covered months share of the expected contribution', () => {
    // Five covered months at $1,000; MAGI 50,000 -> expected 4,980/yr = 415/mo.
    // Each covered month nets max(0, 1,000 − 415) credit, so the net premium is
    // 5 × 415 — five-twelfths of the annual contribution, not all of it.
    const months = [1_000, 1_000, 1_000, 1_000, 1_000, 0, 0, 0, 0, 0, 0, 0]
    const r = acaNetAnnualPremiumByMonth(pack, 1, 50_000, months)
    expect(r.expectedContribution).toBeCloseTo(4_980, 6)
    expect(r.credit).toBeCloseTo(5 * (1_000 - 415), 6)
    expect(r.netAnnualPremium).toBeCloseTo(5 * 415, 6)
  })

  it('earns no credit in uncovered months even when the contribution is small', () => {
    // One expensive covered month: the other eleven months contribute nothing.
    const months = [2_000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const r = acaNetAnnualPremiumByMonth(pack, 1, 20_000, months) // low MAGI, cheap contribution
    expect(r.credit).toBeCloseTo(2_000 - r.expectedContribution / 12, 6)
    expect(r.netAnnualPremium).toBeCloseTo(r.expectedContribution / 12, 6)
  })

  it('forfeits everything over the cliff', () => {
    const months = [1_000, 1_000, 1_000, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    const r = acaNetAnnualPremiumByMonth(pack, 1, 15_650 * 4 + 1, months)
    expect(r.overCliff).toBe(true)
    expect(r.credit).toBe(0)
    expect(r.netAnnualPremium).toBe(3_000)
  })
})
