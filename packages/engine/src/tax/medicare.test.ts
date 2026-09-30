import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { packForYear } from '../params/index.js'
import { medicareAnnualPremiumPerPerson } from './medicare.js'

const pack = packForYear(2026).pack
const packWithUnverifiedTier2PartD = {
  ...pack,
  medicare: {
    ...pack.medicare,
    irmaaTiers: pack.medicare.irmaaTiers.map((tier, i) => (i === 1 ? { ...tier, partDSurchargeMonthly: null } : tier)),
  },
}

describe('IRMAA applicable percentage', () => {
  // 42 U.S.C. 1395r(i)(3)(A) sets the monthly adjustment as the applicable
  // percentage minus 25 percentage points, times the unsubsidized Part B premium
  // amount (200 percent of the monthly actuarial rate). The percentage is the
  // beneficiary's share of program cost, where the standard premium is 25
  // percent of it, and CMS applies it to the unrounded actuarial rate and
  // publishes each tier's total. The engine reads that total: $284.10 a month
  // at the 2026 first tier. Two readings of the rule miss it:
  //   - the rounded standard premium scaled by 35/25, 202.90 x 1.4 = 284.06,
  //     the engine's rule until 2026-09-29 and 48 cents a year low;
  //   - the percentage as a surcharge on the standard premium,
  //     202.90 x 1.35 = 273.915, which understates every tier.
  describeRule('usc-42-1395r-i-irmaa-applicable-percentage', {
    readings: { cmsPublishedTotal: 284.1, standardTimes35Over25: 284.06, percentageAsSurcharge: 273.915 },
    accepted: 'cmsPublishedTotal',
  }, ({ accepted, readings }) => {
    it('prices the first tier at the total CMS publishes for it, $284.10 a month', () => {
      const tier = pack.medicare.irmaaTiers[0]!
      const standardMonthly = medicareAnnualPremiumPerPerson(pack, 0, 'single').partBAnnual / 12
      const firstTier = medicareAnnualPremiumPerPerson(pack, tier.magiOver.single + 1, 'single')

      expect(tier.partBTotalMonthly).toBe(accepted)
      expect(firstTier.partBAnnual).toBe(tier.partBTotalMonthly * 12)
      expect(firstTier.partBAnnual).toBe(284.1 * 12)
      expect(firstTier.irmaaTier).toBe(1)
      // The rejected readings are what the standard premium gives, and the
      // published total is neither of them.
      expect(standardMonthly * tier.applicablePct / 25).toBeCloseTo(readings.standardTimes35Over25, 6)
      expect(standardMonthly * (1 + tier.applicablePct / 100)).toBeCloseTo(readings.percentageAsSurcharge, 6)
      expect(firstTier.partBAnnual / 12).not.toBeCloseTo(readings.standardTimes35Over25, 2)
      expect(firstTier.partBAnnual / 12).not.toBeCloseTo(readings.percentageAsSurcharge, 2)
    })
  })
})

describe('medicareAnnualPremiumPerPerson', () => {
  it('charges the standard premium at or below the first threshold', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 109_000, 'single')
    expect(r.irmaaTier).toBe(0)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 12, 6)
    expect(r.partDSurchargeAnnual).toBe(0)
    expect(r.irmaaSurchargeAnnual).toBe(0)
  })

  it('jumps to tier 1 a dollar over (cliff), with Part D surcharge', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 109_001, 'single')
    expect(r.irmaaTier).toBe(1)
    // CMS 2026: $284.10 total Part B ($81.20 over standard) and $14.50 Part D.
    expect(r.partBAnnual).toBeCloseTo(284.1 * 12, 6)
    expect(r.partDSurchargeAnnual).toBeCloseTo(14.5 * 12, 6)
    expect(r.irmaaSurchargeAnnual).toBeCloseTo((81.2 + 14.5) * 12, 6)
    expect(r.partDSurchargeUnverified).toBe(false)
  })

  it('charges the verified Part D surcharge on middle tiers', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 150_000, 'single') // tier 2
    expect(r.irmaaTier).toBe(2)
    expect(r.partBAnnual).toBeCloseTo(405.8 * 12, 6)
    expect(r.partDSurchargeAnnual).toBeCloseTo(37.5 * 12, 6)
    expect(r.partDSurchargeUnverified).toBe(false)
  })

  it('flags unverified Part D surcharges when a future pack has a null surcharge', () => {
    const r = medicareAnnualPremiumPerPerson(packWithUnverifiedTier2PartD, 150_000, 'single') // tier 2
    expect(r.irmaaTier).toBe(2)
    expect(r.partDSurchargeAnnual).toBe(0)
    expect(r.partDSurchargeUnverified).toBe(true)
  })

  it('uses MFJ thresholds and tops out at CMS\'s $689.90', () => {
    expect(medicareAnnualPremiumPerPerson(pack, 218_000, 'marriedFilingJointly').irmaaTier).toBe(0)
    const top = medicareAnnualPremiumPerPerson(pack, 800_000, 'marriedFilingJointly')
    expect(top.irmaaTier).toBe(5)
    expect(top.partBAnnual).toBeCloseTo(689.9 * 12, 6)
    expect(top.partDSurchargeAnnual).toBeCloseTo(91 * 12, 6)
  })

  it('scales thresholds and premiums independently for future years', () => {
    // Thresholds doubled: 200k single is back under the first tier. The premium
    // year sits inside the freeze window so this exercises the lower rows only.
    const r = medicareAnnualPremiumPerPerson(pack, 200_000, 'single', {
      premiumYear: 2027,
      inflationFactorToYear: (year: number): number => (year <= pack.year ? 1 : 2),
    }, 1.5)
    expect(r.irmaaTier).toBe(0)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 12 * 1.5, 6)
  })
})
