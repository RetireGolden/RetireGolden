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
  // 42 U.S.C. 1395r(i) makes the applicable percentage the beneficiary's SHARE
  // OF PROGRAM COST, where the standard premium is 25 percent of that cost. So
  // the first tier at 35 percent means paying 35/25 of the standard premium --
  // a multiplier of 1.4 -- not the standard premium plus 35 percent.
  //
  // Reading the percentage as a surcharge is the natural error and understates
  // every tier: 1.35 rather than 1.4 at the first, and it gets worse higher up.
  // The engine reads CMS's published tier total ($284.10), which CMS derives
  // from the unrounded actuarial rate, so the ratio is 1.4 to three places, not
  // exactly (202.90 x 1.4 = 284.06).
  describeRule('usc-42-1395r-i-irmaa-applicable-percentage', {
    readings: { shareOfProgramCost: 1.4, percentageAsSurcharge: 1.35 },
    accepted: 'shareOfProgramCost',
  }, ({ accepted, readings }) => {
    it('prices the first tier at 35/25 of the standard premium, as CMS publishes it', () => {
      const standard = medicareAnnualPremiumPerPerson(pack, 0, 'single')
      const firstTier = medicareAnnualPremiumPerPerson(
        pack,
        pack.medicare.irmaaTiers[0]!.magiOver.single + 1,
        'single',
      )

      const ratio = firstTier.partBAnnual / standard.partBAnnual
      expect(ratio).toBeCloseTo(accepted, 3)
      expect(ratio).not.toBeCloseTo(readings.percentageAsSurcharge, 3)
      expect(firstTier.partBAnnual).toBe(pack.medicare.irmaaTiers[0]!.partBTotalMonthly * 12)
      expect(firstTier.irmaaTier).toBe(1)
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
