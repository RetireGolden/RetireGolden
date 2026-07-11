import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { packForYear } from '../params/index.js'
import { medicareAnnualPremiumPerPerson } from './medicare.js'

/**
 * ORACLE-004 (Phase 5, external-oracle-comparisons.md) — Medicare Part B / IRMAA
 * vs the CMS 2026 release (premiums from 2024 MAGI, two-year lookback).
 *
 * Oracle: CMS CY2026 Medicare Parts B & D premium / IRMAA amounts.
 * Cross-checked against the Kiplinger 2026 IRMAA table (the pack provenance
 * source), thefinancebuff.com, and irmaagroup.com — all reproducing the CMS
 * figures. Access date: 2026-06-29. Tax/premium year: 2026. Tolerance: $1/yr.
 *
 * CMS 2026 published figures frozen as the oracle:
 *   Standard Part B: $202.90/mo.
 *   IRMAA tiers (single / MFJ MAGI floor): cliffs are "> threshold", except the
 *     top tier starts at "greater than or equal to" the final threshold.
 *   Total Part B at each tier is the standard premium × statutory multiplier
 *     (1.4 / 2.0 / 2.6 / 3.2 / 3.4 = applicablePct ÷ 25); CMS rounds the printed
 *     premium to the dime — endpoints published as $284.10 … $689.90.
 *   Part D IRMAA surcharge (identical across filing statuses): $14.50, $37.50,
 *     $60.40, $83.30, $91.00.
 */
const pack = packForYear(2026).pack
const STD_MONTHLY = 202.9

// CMS 2026 IRMAA tier MAGI floors (the income strictly above which the tier applies).
const CMS_THRESHOLDS = [
  { single: 109_000, marriedFilingJointly: 218_000 },
  { single: 137_000, marriedFilingJointly: 274_000 },
  { single: 171_000, marriedFilingJointly: 342_000 },
  { single: 205_000, marriedFilingJointly: 410_000 },
  { single: 500_000, marriedFilingJointly: 750_000 },
] as const
// CMS 2026 statutory cost-share multipliers (= applicablePct ÷ 25).
const CMS_PART_B_MULTIPLIER = [1.4, 2.0, 2.6, 3.2, 3.4] as const
// CMS 2026 Part D IRMAA monthly surcharge per tier.
const CMS_PART_D_SURCHARGE = [14.5, 37.5, 60.4, 83.3, 91.0] as const
// CMS-published dime-rounded total Part B endpoints (tier 1 and tier 5).
const CMS_PART_B_TIER1_MONTHLY = 284.1
const CMS_PART_B_TIER5_MONTHLY = 689.9

describe('ORACLE-004: Medicare Part B / IRMAA vs CMS 2026', () => {
  it('standard Part B premium equals the CMS 2026 value ($202.90/mo)', () => {
    expect(pack.medicare.partBStandardMonthly).toBe(STD_MONTHLY)
    const r = medicareAnnualPremiumPerPerson(pack, 50_000, 'single')
    expect(r.irmaaTier).toBe(0)
    expectMoney(r.partBAnnual, 202.9 * 12)
  })

  it('IRMAA tier MAGI thresholds match CMS 2026 for single and MFJ', () => {
    expect(pack.medicare.irmaaTiers).toHaveLength(CMS_THRESHOLDS.length)
    pack.medicare.irmaaTiers.forEach((tier, i) => {
      expect(tier.magiOver.single, `tier ${i + 1} single`).toBe(CMS_THRESHOLDS[i]!.single)
      expect(tier.magiOver.marriedFilingJointly, `tier ${i + 1} MFJ`).toBe(CMS_THRESHOLDS[i]!.marriedFilingJointly)
    })
  })

  it('per-tier total Part B matches the CMS statutory multiplier of the standard premium', () => {
    // applicablePct / 25 reproduces the CMS multipliers 1.4 / 2.0 / 2.6 / 3.2 / 3.4.
    pack.medicare.irmaaTiers.forEach((tier, i) => {
      expect(tier.applicablePct / 25).toBeCloseTo(CMS_PART_B_MULTIPLIER[i]!, 10)
    })
    // Endpoints vs CMS's dime-rounded published premiums, within the $1/yr tolerance.
    const tier1 = medicareAnnualPremiumPerPerson(pack, 109_001, 'single')
    expectMoney(tier1.partBAnnual, CMS_PART_B_TIER1_MONTHLY * 12, 1) // 284.06 vs 284.10 → 48¢/yr
    const tier5 = medicareAnnualPremiumPerPerson(pack, 500_000, 'single')
    expectMoney(tier5.partBAnnual, CMS_PART_B_TIER5_MONTHLY * 12, 1) // 689.86 vs 689.90 → 48¢/yr
  })

  it('matches CMS top-tier boundary semantics (single $500,000 / MFJ $750,000)', () => {
    expect(medicareAnnualPremiumPerPerson(pack, 499_999, 'single').irmaaTier).toBe(4)
    expect(medicareAnnualPremiumPerPerson(pack, 500_000, 'single').irmaaTier).toBe(5)
    expect(medicareAnnualPremiumPerPerson(pack, 749_999, 'marriedFilingJointly').irmaaTier).toBe(4)
    expect(medicareAnnualPremiumPerPerson(pack, 750_000, 'marriedFilingJointly').irmaaTier).toBe(5)
  })

  it('verified Part D surcharges for all tiers match CMS 2026', () => {
    expect(pack.medicare.irmaaTiers.map((tier) => tier.partDSurchargeMonthly)).toEqual(CMS_PART_D_SURCHARGE)

    const tierProbe = [
      { magi: 109_001, tierIndex: 0 },
      { magi: 137_001, tierIndex: 1 },
      { magi: 171_001, tierIndex: 2 },
      { magi: 205_001, tierIndex: 3 },
      { magi: 500_000, tierIndex: 4 },
    ]
    for (const { magi, tierIndex } of tierProbe) {
      const r = medicareAnnualPremiumPerPerson(pack, magi, 'single')
      expect(r.irmaaTier).toBe(tierIndex + 1)
      expect(r.partDSurchargeUnverified).toBe(false)
      expectMoney(r.partDSurchargeAnnual, CMS_PART_D_SURCHARGE[tierIndex]! * 12)
    }
  })
})
