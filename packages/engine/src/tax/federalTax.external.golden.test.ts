import { describe, expect, it } from 'vitest'

import { packForYear } from '../params/index.js'
import { computeFederalTax } from './federalTax.js'
import { expectMoney } from '../testing/money.js'
import type { TaxYearInput } from '../projection/types.js'

/**
 * ORACLE-001 (Phase 5, external-oracle-comparisons.md) — federal income tax vs
 * IRS Revenue Procedure 2025-32 (2026 inflation adjustments, post-OBBBA).
 *
 * For wages-only ordinary tax the IRS rate schedule *is* the primary oracle, so
 * no external microsimulation run is needed: this fixture freezes the published
 * 2026 schedule and standard deduction and asserts (a) the pack equals them and
 * (b) hand worksheets over those published values reproduce the engine's tax.
 *
 * Oracle: IRS Rev. Proc. 2025-32, "tax year 2026 inflation adjustments".
 * Oracle URLs:
 *   https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
 *   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 * Brackets + standard deduction verified directly from the IRS newsroom release.
 * LTCG breakpoints and the age-65 additional deduction cross-checked against the
 * Tax Foundation reproduction of Rev. Proc. 2025-32
 *   (https://taxfoundation.org/data/all/federal/2026-tax-brackets/).
 * Access date: 2026-06-29. Tax year under test: 2026. Tolerance: $1.
 */

// IRS Rev. Proc. 2025-32 — 2026 ordinary rate schedule (rate, bracket lower bound).
const IRS_2026_BRACKETS = {
  single: [
    { lowerBound: 0, ratePct: 10 },
    { lowerBound: 12_400, ratePct: 12 },
    { lowerBound: 50_400, ratePct: 22 },
    { lowerBound: 105_700, ratePct: 24 },
    { lowerBound: 201_775, ratePct: 32 },
    { lowerBound: 256_225, ratePct: 35 },
    { lowerBound: 640_600, ratePct: 37 },
  ],
  marriedFilingJointly: [
    { lowerBound: 0, ratePct: 10 },
    { lowerBound: 24_800, ratePct: 12 },
    { lowerBound: 100_800, ratePct: 22 },
    { lowerBound: 211_400, ratePct: 24 },
    { lowerBound: 403_550, ratePct: 32 },
    { lowerBound: 512_450, ratePct: 35 },
    { lowerBound: 768_700, ratePct: 37 },
  ],
} as const
const IRS_2026_STANDARD_DEDUCTION = { single: 16_100, marriedFilingJointly: 32_200 } as const
const IRS_2026_AGE65_ADDITION = { single: 2_050, marriedFilingJointly: 1_650 } as const
const IRS_2026_LTCG_15_STARTS_ABOVE = { single: 49_450, marriedFilingJointly: 98_900 } as const
const IRS_2026_LTCG_20_STARTS_ABOVE = { single: 545_500, marriedFilingJointly: 613_700 } as const

const pack = packForYear(2026).pack

function fed(overrides: Partial<TaxYearInput>): ReturnType<typeof computeFederalTax> {
  return computeFederalTax({
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...overrides,
  })
}

describe('ORACLE-001: federal income tax vs IRS Rev. Proc. 2025-32 (2026)', () => {
  it('pack rate schedule and standard deduction equal the IRS 2026 published values', () => {
    expect(pack.federalTax.brackets.single).toEqual(IRS_2026_BRACKETS.single)
    expect(pack.federalTax.brackets.marriedFilingJointly).toEqual(IRS_2026_BRACKETS.marriedFilingJointly)
    expect(pack.federalTax.standardDeduction).toEqual(IRS_2026_STANDARD_DEDUCTION)
    expect(pack.federalTax.age65Addition).toEqual(IRS_2026_AGE65_ADDITION)
    expect(pack.capitalGains.rate15StartsAbove).toEqual(IRS_2026_LTCG_15_STARTS_ABOVE)
    expect(pack.capitalGains.rate20StartsAbove).toEqual(IRS_2026_LTCG_20_STARTS_ABOVE)
  })

  it('single filer, $60,000 wages — taxable income spans the 10% and 12% brackets', () => {
    // Worksheet (IRS 2026 single):
    //   AGI 60,000; standard deduction 16,100; taxable income 43,900.
    //   10%: 12,400 × .10            =   1,240.00
    //   12%: (43,900 − 12,400) × .12 =   3,780.00  (43,900 < 50,400 → only two brackets)
    //   ordinary tax                 =   5,020.00
    const r = fed({ ordinaryIncome: 60_000 })
    expectMoney(r.agi, 60_000)
    expectMoney(r.deduction, 16_100)
    expectMoney(r.taxableIncome, 43_900)
    expectMoney(r.ordinaryTax, 5_020)
    expectMoney(r.totalTax, 5_020)
  })

  it('single high earner, $250,000 wages — crosses five brackets into the 32% bracket', () => {
    // Worksheet (IRS 2026 single): taxable income 250,000 − 16,100 = 233,900.
    //   10%: 12,400 × .10              =  1,240.00
    //   12%: (50,400 − 12,400) × .12   =  4,560.00
    //   22%: (105,700 − 50,400) × .22  = 12,166.00
    //   24%: (201,775 − 105,700) × .24 = 23,058.00
    //   32%: (233,900 − 201,775) × .32 = 10,280.00
    //   ordinary tax                   = 51,304.00
    // No NIIT: all income is wages, so net investment income is 0.
    const r = fed({ ordinaryIncome: 250_000 })
    expectMoney(r.taxableIncome, 233_900)
    expectMoney(r.ordinaryTax, 51_304)
    expectMoney(r.niit, 0)
    expectMoney(r.totalTax, 51_304)
  })

  it('married filing jointly, $120,000 wages — taxable income spans the 10% and 12% brackets', () => {
    // Worksheet (IRS 2026 MFJ): AGI 120,000; standard deduction 32,200; taxable 87,800.
    //   10%: 24,800 × .10            =  2,480.00
    //   12%: (87,800 − 24,800) × .12 =  7,560.00  (87,800 < 100,800 → two brackets)
    //   ordinary tax                 = 10,040.00
    const r = fed({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 120_000 })
    expectMoney(r.deduction, 32_200)
    expectMoney(r.taxableIncome, 87_800)
    expectMoney(r.ordinaryTax, 10_040)
    expectMoney(r.totalTax, 10_040)
  })
})
