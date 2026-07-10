import { describe, expect, it } from 'vitest'

import { packForYear } from '../params'
import { medicareAnnualPremiumPerPerson } from './medicare'

const pack = packForYear(2026).pack
const packWithUnverifiedTier2PartD = {
  ...pack,
  medicare: {
    ...pack.medicare,
    irmaaTiers: pack.medicare.irmaaTiers.map((tier, i) => (i === 1 ? { ...tier, partDSurchargeMonthly: null } : tier)),
  },
}

describe('medicareAnnualPremiumPerPerson', () => {
  it('charges the standard premium at or below the first threshold', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 109_000, 'single')
    expect(r.irmaaTier).toBe(0)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 12, 6)
    expect(r.partDSurchargeAnnual).toBe(0)
  })

  it('jumps to tier 1 a dollar over (cliff), with Part D surcharge', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 109_001, 'single')
    expect(r.irmaaTier).toBe(1)
    expect(r.partBAnnual).toBeCloseTo(202.9 * 1.4 * 12, 6)
    expect(r.partDSurchargeAnnual).toBeCloseTo(14.5 * 12, 6)
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
