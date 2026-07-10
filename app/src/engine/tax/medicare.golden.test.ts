import { describe, expect, it } from 'vitest'

import { expectMoney } from '../../testSupport/money'
import { packForYear } from '../params'
import { medicareAnnualPremiumPerPerson } from './medicare'

/**
 * Atomic oracle tests for Medicare Part B / IRMAA (Phase 1, calculation-test-plan.md).
 *
 * Thresholds and the standard premium are pinned against the 2026 pack (CMS 2026:
 * $202.90 standard Part B; IRMAA tiers per statute). Part B at a tier is the
 * standard premium scaled by applicablePct / 25 (the standard 25% cost share).
 * IRMAA brackets are cliffs on MAGI from two years prior.
 */
const pack = packForYear(2026).pack
const STD_MONTHLY = 202.9

describe('Medicare / IRMAA golden worksheets', () => {
  it('charges the standard premium at or below the first single threshold', () => {
    // Exactly at 109,000 is not "over" the threshold -> tier 0.
    const r = medicareAnnualPremiumPerPerson(pack, 109_000, 'single')
    expect(r.irmaaTier).toBe(0)
    expectMoney(r.partBAnnual, STD_MONTHLY * 12)
    expectMoney(r.partDSurchargeAnnual, 0)
  })

  it('jumps to tier 1 one dollar over the first single threshold (cliff)', () => {
    // applicablePct 35 -> Part B = 202.90 * (35/25) = 202.90 * 1.4.
    const r = medicareAnnualPremiumPerPerson(pack, 109_001, 'single')
    expect(r.irmaaTier).toBe(1)
    expectMoney(r.partBAnnual, STD_MONTHLY * 1.4 * 12)
    expectMoney(r.partDSurchargeAnnual, 14.5 * 12)
    expect(r.partDSurchargeUnverified).toBe(false)
  })

  it('uses the wider MFJ thresholds (double the single cliff)', () => {
    // MFJ first threshold is 218,000; single would already be tier 5 here.
    expect(medicareAnnualPremiumPerPerson(pack, 218_000, 'marriedFilingJointly').irmaaTier).toBe(0)
    expect(medicareAnnualPremiumPerPerson(pack, 218_001, 'marriedFilingJointly').irmaaTier).toBe(1)
  })

  it('charges the verified tier 2 Part D surcharge', () => {
    const r = medicareAnnualPremiumPerPerson(pack, 137_001, 'single')
    expect(r.irmaaTier).toBe(2)
    expect(r.partDSurchargeUnverified).toBe(false)
    expectMoney(r.partDSurchargeAnnual, 37.5 * 12)
  })

  it('reaches the top tier with the maximum applicable percentage', () => {
    // Tier 5 starts at single >= 500,000, applicablePct 85 -> Part B = 202.90 * (85/25) = * 3.4.
    const r = medicareAnnualPremiumPerPerson(pack, 500_000, 'single')
    expect(r.irmaaTier).toBe(5)
    expectMoney(r.partBAnnual, STD_MONTHLY * 3.4 * 12)
    expectMoney(r.partDSurchargeAnnual, 91 * 12)
  })

  it('uses CMS boundary semantics at the top tier', () => {
    expect(medicareAnnualPremiumPerPerson(pack, 499_999, 'single').irmaaTier).toBe(4)
    expect(medicareAnnualPremiumPerPerson(pack, 500_000, 'single').irmaaTier).toBe(5)
    expect(medicareAnnualPremiumPerPerson(pack, 749_999, 'marriedFilingJointly').irmaaTier).toBe(4)
    expect(medicareAnnualPremiumPerPerson(pack, 750_000, 'marriedFilingJointly').irmaaTier).toBe(5)
  })

  it('scales thresholds for future years (indexing stand-in)', () => {
    // With thresholdScale 1.1 the first single cliff moves to 109,000 * 1.1 = 119,900,
    // so 109,001 falls back to tier 0.
    expect(medicareAnnualPremiumPerPerson(pack, 109_001, 'single', 1.1).irmaaTier).toBe(0)
    expect(medicareAnnualPremiumPerPerson(pack, 119_901, 'single', 1.1).irmaaTier).toBe(1)
  })

  it('scales premiums for future years (healthcare inflation stand-in)', () => {
    // premiumScale 1.2 multiplies the standard Part B premium.
    const r = medicareAnnualPremiumPerPerson(pack, 50_000, 'single', 1, 1.2)
    expect(r.irmaaTier).toBe(0)
    expectMoney(r.partBAnnual, STD_MONTHLY * 1.2 * 12)
  })
})
