import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { packForYear } from '../params/index.js'
import {
  acaApplicablePct,
  acaEconomicPremiumByMonth,
  acaFederalPovertyLine,
  acaNetAnnualPremium,
  acaNetAnnualPremiumByMonth,
  buildAcaHouseholdMagi,
} from './aca.js'

const pack = packForYear(2026).pack

describe('acaApplicablePct', () => {
  // Rev. Proc. 2025-25 section 3.01 states the bands as "at least 133% but less
  // than 150%", so 133 is a real step: strictly below is the 2.10% floor and
  // 133 itself opens the next band at 3.14%. Reading the floor as running
  // through 133 inclusive understates the expected contribution at exactly that
  // income and overstates the credit.
  describeRule('rev-proc-2025-25-aca-applicable-percentage-2026', {
    readings: { stepOpensAt133: 3.14, floorRunsThrough133: 2.1 },
    accepted: 'stepOpensAt133',
  }, ({ accepted, readings }) => {
    it('steps to the 133 band at exactly 133 percent of the poverty line', () => {
      expect(acaApplicablePct(pack, 133)).toBeCloseTo(accepted, 6)
      expect(acaApplicablePct(pack, 132.999)).toBeCloseTo(readings.floorRunsThrough133, 6)
    })
  })

  it('has the sourced step at exactly 133% FPL', () => {
    expect(acaApplicablePct(pack, 50)).toBe(2.1)
    expect(acaApplicablePct(pack, 132.999)).toBe(2.1)
    expect(acaApplicablePct(pack, 133)).toBe(3.14)
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

describe('ACA current-year contract math', () => {
  it('pins every 2026 applicable-percentage boundary just below, at, and above', () => {
    // IRS Rev. Proc. 2025-25 §3.01.
    const boundaries = [100, 133, 150, 200, 250, 300, 400]
    for (const boundary of boundaries) {
      const values = [
        acaApplicablePct(pack, boundary - 0.001),
        acaApplicablePct(pack, boundary),
        acaApplicablePct(pack, boundary + 0.001),
      ]
      expect(values.every(Number.isFinite)).toBe(true)
    }
    expect(acaApplicablePct(pack, 132.999)).toBe(2.1)
    expect(acaApplicablePct(pack, 133)).toBe(3.14)
  })

  it('uses the separate SLCSP while capping allowable PTC at enrollment premium', () => {
    // Form 8962 instructions: benchmark drives the preliminary credit, but the
    // allowable credit cannot exceed the enrollment premium.
    const enrollment = new Array<number>(12).fill(500)
    const benchmark = new Array<number>(12).fill(1_000)
    const result = acaEconomicPremiumByMonth(pack, 1, 31_300, enrollment, benchmark)
    expect(result.grossEnrollmentPremium).toBe(6_000)
    expect(result.applicableSlcspPremium).toBe(12_000)
    expect(result.modeledAllowablePtc).toBe(6_000)
    expect(result.economicNetPremium).toBe(0)
  })

  it('excludes SLCSP amounts from months without enrollment', () => {
    const enrollment = [500, ...new Array<number>(11).fill(0)]
    const benchmark = new Array<number>(12).fill(1_000)
    const result = acaEconomicPremiumByMonth(pack, 1, 31_300, enrollment, benchmark)
    expect(result.grossEnrollmentPremium).toBe(500)
    expect(result.applicableSlcspPremium).toBe(1_000)
    expect(result.modeledAllowablePtc).toBe(500)
  })

  it('uses the separate 2025 HHS poverty tables for Alaska and Hawaii', () => {
    // https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
    expect(acaFederalPovertyLine(pack, 1, 'contiguous')).toBe(15_650)
    expect(acaFederalPovertyLine(pack, 1, 'alaska')).toBe(19_550)
    expect(acaFederalPovertyLine(pack, 1, 'hawaii')).toBe(17_990)
    expect(acaFederalPovertyLine(pack, 4, 'alaska')).toBe(40_190)
    expect(acaFederalPovertyLine(pack, 4, 'hawaii')).toBe(36_980)
  })

  it('resolves every regional poverty guideline from the versioned parameter pack', () => {
    const regionalPack = structuredClone(pack)
    regionalPack.federalPovertyLine.alaska.firstPerson = 20_000
    regionalPack.federalPovertyLine.hawaii.perAdditionalPerson = 7_000

    expect(acaFederalPovertyLine(regionalPack, 1, 'alaska')).toBe(20_000)
    expect(acaFederalPovertyLine(regionalPack, 2, 'hawaii')).toBe(24_990)
  })

  it('builds household MAGI from AGI, addbacks, and required-filer dependents', () => {
    const result = buildAcaHouseholdMagi({
      federalAgi: 30_000,
      grossSocialSecurity: 20_000,
      taxableSocialSecurity: 5_000,
      taxExemptInterest: { state: 'known', amount: 1_000 },
      foreignExclusionAddback: { state: 'known', amount: 2_000 },
      dependents: [
        { personId: 'required', requiredToFile: 'required', magi: 3_000 },
        { personId: 'not-required', requiredToFile: 'notRequired', magi: 4_000 },
      ],
    })
    expect(result.actionable).toBe(true)
    expect(result.components).toEqual({
      federalAgi: 30_000,
      nontaxableSocialSecurity: 15_000,
      taxExemptInterest: 1_000,
      foreignExclusionAddback: 2_000,
      requiredFilerDependentMagi: 3_000,
    })
    expect(result.magi).toBe(51_000)
  })

  it('preserves signed federal AGI until applying the final household-income floor', () => {
    const positiveAfterAddbacks = buildAcaHouseholdMagi({
      federalAgi: -10_000,
      grossSocialSecurity: 0,
      taxableSocialSecurity: 0,
      taxExemptInterest: { state: 'known', amount: 3_000 },
      foreignExclusionAddback: { state: 'known', amount: 8_000 },
      dependents: [{ personId: 'dependent', requiredToFile: 'required', magi: 4_000 }],
    })
    expect(positiveAfterAddbacks.components.federalAgi).toBe(-10_000)
    expect(positiveAfterAddbacks.magi).toBe(5_000)

    const flooredHousehold = buildAcaHouseholdMagi({
      federalAgi: -20_000,
      grossSocialSecurity: 0,
      taxableSocialSecurity: 0,
      taxExemptInterest: { state: 'known', amount: 3_000 },
      foreignExclusionAddback: { state: 'known', amount: 8_000 },
      dependents: [{ personId: 'dependent', requiredToFile: 'required', magi: 4_000 }],
    })
    expect(flooredHousehold.components.federalAgi).toBe(-20_000)
    expect(flooredHousehold.magi).toBe(0)
  })

  it('fails closed when a required ACA-MAGI fact is unknown', () => {
    const result = buildAcaHouseholdMagi({
      federalAgi: 30_000,
      grossSocialSecurity: 0,
      taxableSocialSecurity: 0,
      taxExemptInterest: { state: 'unknown', amount: null },
      foreignExclusionAddback: { state: 'unknown', amount: null },
      dependents: [{ personId: 'dep', requiredToFile: 'unknown', magi: 5_000 }],
    })
    expect(result.actionable).toBe(false)
    expect(result.magi).toBeNull()
    expect(result.blockers).toEqual([
      'tax-exempt-interest-unknown',
      'foreign-exclusion-addback-unknown',
      'dependent-filing-status-unknown',
    ])
  })
})
