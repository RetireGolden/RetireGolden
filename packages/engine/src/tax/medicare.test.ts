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
  describeRule('usc-42-1395r-i-irmaa-applicable-percentage', {
    readings: { shareOfProgramCost: 1.4, percentageAsSurcharge: 1.35 },
    accepted: 'shareOfProgramCost',
  }, ({ accepted, readings }) => {
    it('scales the standard premium by the applicable percentage over 25', () => {
      const standard = medicareAnnualPremiumPerPerson(pack, 0, 'single')
      const firstTier = medicareAnnualPremiumPerPerson(
        pack,
        pack.medicare.irmaaTiers[0]!.magiOver.single + 1,
        'single',
      )

      const ratio = firstTier.partBAnnual / standard.partBAnnual
      expect(ratio).toBeCloseTo(accepted, 6)
      expect(ratio).not.toBeCloseTo(readings.percentageAsSurcharge, 6)
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
    expect(r.partBAnnual).toBeCloseTo(202.9 * 1.4 * 12, 6)
    expect(r.partDSurchargeAnnual).toBeCloseTo(14.5 * 12, 6)
    expect(r.irmaaSurchargeAnnual).toBeCloseTo((202.9 * 0.4 + 14.5) * 12, 6)
    expect(r.partDSurchargeUnverified).toBe(false)
  })

  it('charges the verified Part D surcharge on middle tiers', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 150_000, 'single') // tier 2
    expect(r.irmaaTier).toBe(2)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 2 * 12, 6)
    expect(r.partDSurchargeAnnual).toBeCloseTo(37.5 * 12, 6)
    expect(r.partDSurchargeUnverified).toBe(false)
  })

  it('flags unverified Part D surcharges when a future pack has a null surcharge', () => {
    const r = medicareAnnualPremiumPerPerson(packWithUnverifiedTier2PartD, 150_000, 'single') // tier 2
    expect(r.irmaaTier).toBe(2)
    expect(r.partDSurchargeAnnual).toBe(0)
    expect(r.partDSurchargeUnverified).toBe(true)
  })

  it('uses MFJ thresholds and tops out at 3.4×', () => {
    expect(medicareAnnualPremiumPerPerson(pack, 218_000, 'marriedFilingJointly').irmaaTier).toBe(0)
    const top = medicareAnnualPremiumPerPerson(pack, 800_000, 'marriedFilingJointly')
    expect(top.irmaaTier).toBe(5)
    expect(top.partBAnnual).toBeCloseTo(202.9 * 3.4 * 12, 6)
    expect(top.partDSurchargeAnnual).toBeCloseTo(91 * 12, 6)
  })

  it('scales thresholds and premiums independently for future years', () => {
    // Thresholds doubled: 200k single is back under the first tier.
    const r = medicareAnnualPremiumPerPerson(pack, 200_000, 'single', 2, 1.5)
    expect(r.irmaaTier).toBe(0)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 12 * 1.5, 6)
  })
})
