import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { packForYear } from '../params/index.js'
import { medicareAnnualPremiumPerPerson } from './medicare.js'

/**
 * ORACLE-004 (DOCS/external-oracles.md) — Medicare Part B / IRMAA
 * vs the CMS 2026 release (premiums from 2024 MAGI, two-year lookback).
 *
 * Oracle: CMS, "2026 Medicare Parts A & B Premiums and Deductibles" (fact
 * sheet, https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles),
 * read 2026-09-29. Tax/premium year: 2026. Tolerance: one cent.
 *
 * CMS 2026 published figures frozen as the oracle:
 *   Standard Part B: $202.90/mo.
 *   IRMAA tiers (single / MFJ MAGI floor): cliffs are "> threshold", except the
 *     top tier starts at "greater than or equal to" the final threshold.
 *   Total Part B at each tier, as published: $284.10, $405.80, $527.50,
 *     $649.20, $689.90. CMS derives them from the unrounded actuarial rate,
 *     so they are not the standard premium times applicablePct / 25 rounded to
 *     the dime (tier 4 would round 649.28 to 649.30); the pack carries them.
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
// CMS 2026 Part D IRMAA monthly surcharge per tier.
const CMS_PART_D_SURCHARGE = [14.5, 37.5, 60.4, 83.3, 91.0] as const
// CMS 2026 total monthly Part B premium per tier, full Part B coverage.
const CMS_PART_B_TOTAL = [284.1, 405.8, 527.5, 649.2, 689.9] as const

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

  it('per-tier total Part B equals CMS\'s published premium to the cent', () => {
    expect(pack.medicare.irmaaTiers.map((tier) => tier.partBTotalMonthly)).toEqual(CMS_PART_B_TOTAL)
    const tierProbe = [109_001, 137_001, 171_001, 205_001, 500_000]
    tierProbe.forEach((magi, i) => {
      const r = medicareAnnualPremiumPerPerson(pack, magi, 'single')
      expect(r.irmaaTier).toBe(i + 1)
      expectMoney(r.partBAnnual, CMS_PART_B_TOTAL[i]! * 12)
      expectMoney(r.irmaaSurchargeAnnual, (CMS_PART_B_TOTAL[i]! - STD_MONTHLY + CMS_PART_D_SURCHARGE[i]!) * 12)
    })
    // The standard premium times applicablePct / 25 misses four of the five
    // (tier 4 by 8 cents a month), so it is not a stand-in for the table.
    const derived = pack.medicare.irmaaTiers.map((tier) => Math.round(STD_MONTHLY * (tier.applicablePct / 25) * 100) / 100)
    expect(derived).toEqual([284.06, 405.8, 527.54, 649.28, 689.86])
    expect(derived).not.toEqual(CMS_PART_B_TOTAL)
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
