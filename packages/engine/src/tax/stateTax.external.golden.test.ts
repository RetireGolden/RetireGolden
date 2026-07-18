import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { stateParamsFor } from '../params/state/index.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTax } from './stateTax.js'

const ca = stateParamsFor('CA', 2026)!
const ga = stateParamsFor('GA', 2026)!
const il = stateParamsFor('IL', 2026)!
const ky = stateParamsFor('KY', 2026)!
const nj = stateParamsFor('NJ', 2026)!
const sc = stateParamsFor('SC', 2026)!
const me = stateParamsFor('ME', 2026)!

function stateInput(state: string, overrides: Partial<TaxYearInput>): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state,
    ...overrides,
  }
}

/**
 * ORACLE-009 (DOCS/external-oracles.md) - New Jersey graduated
 * income tax vs the New Jersey Division of Taxation 2025 NJ-1040 instructions.
 *
 * The state pack carries latest-published state values forward into the 2026
 * planning year. New Jersey's current published resident return instructions
 * provide a clean graduated-rate worksheet on taxable income line 42.
 *
 * Oracle: New Jersey Division of Taxation.
 *   2025 NJ-1040 instructions, page 64:
 *     https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf
 *   Official rate page, updated 2026-03-24:
 *     https://www.nj.gov/treasury/taxation/taxtables.shtml
 * Access date: 2026-06-30. Pack year: 2026. Source tax year: 2025.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-009: New Jersey graduated state income tax vs NJ Division of Taxation', () => {
  it('pack NJ parameters match the published single-filer rate schedule used by the worksheet', () => {
    expect(nj.hasIncomeTax).toBe(true)
    expect(nj.taxesSocialSecurity).toBe(false)
    expect(nj.standardDeduction.single).toBe(0)
    expect(nj.brackets.single).toEqual([
      { lowerBound: 0, ratePct: 1.4 },
      { lowerBound: 20_000, ratePct: 1.75 },
      { lowerBound: 35_000, ratePct: 3.5 },
      { lowerBound: 40_000, ratePct: 5.525 },
      { lowerBound: 75_000, ratePct: 6.37 },
      { lowerBound: 500_000, ratePct: 8.97 },
      { lowerBound: 1_000_000, ratePct: 10.75 },
    ])
  })

  it('taxes a single filer across five graduated bracket layers', () => {
    // Single, $120,000 New Jersey taxable income on NJ-1040 line 42.
    // NJ worksheet Table A: 120,000 * 6.37% - 2,126.25 = $5,517.75.
    // Equivalent bracket stack:
    //   20,000 * 1.4% = 280.00
    //   15,000 * 1.75% = 262.50
    //    5,000 * 3.5% = 175.00
    //   35,000 * 5.525% = 1,933.75
    //   45,000 * 6.37% = 2,866.50
    const tax = computeStateTax(nj, stateInput('NJ', { ordinaryIncome: 120_000, agesAlive: [45] }))
    expectMoney(tax, 5_517.75)
  })
})

/**
 * ORACLE-010 (DOCS/external-oracles.md) - Kentucky retirement
 * exclusion and flat income tax vs the Kentucky Department of Revenue, 2026.
 *
 * This also closes the open thread from PR #91 review, where the Kentucky flat
 * rate was corrected to 3.5%: the correction is confirmed against the primary
 * source below.
 *
 * Oracle: Kentucky Department of Revenue.
 *   2026 withholding formula, standard deduction $3,360 and tax rate 3.5%:
 *     https://revenue.ky.gov/Forms/2026%20Withholding%20Formula.pdf
 *   Pension/retirement income exclusion $31,110 per person:
 *     https://revenue.ky.gov/Individual/Individual-Income-Tax/Pages/default.aspx
 * Access date: 2026-06-30. Tax year: 2026. Tolerance: $1, asserted to cents
 * where the model is exact.
 */
describe('ORACLE-010: Kentucky retirement exclusion vs KY DOR 2026', () => {
  it('pack KY parameters match the Kentucky DOR 2026 published values', () => {
    expect(ky.hasIncomeTax).toBe(true)
    expect(ky.taxesSocialSecurity).toBe(false)
    expect(ky.brackets.single).toEqual([{ lowerBound: 0, ratePct: 3.5 }])
    expect(ky.brackets.marriedFilingJointly).toEqual([{ lowerBound: 0, ratePct: 3.5 }])
    expect(ky.standardDeduction.single).toBe(3_360)
    expect(ky.retirementPrivate).toEqual({ kind: 'capped', capPerPerson: 31_110 })
    expect(ky.retirementPublic).toEqual({ kind: 'capped', capPerPerson: 31_110 })
  })

  it('taxes wages at the 3.5% flat rate after the standard deduction', () => {
    // Single, $50,000 wages, no retirement income.
    //   taxable = 50,000 - 3,360 = 46,640; tax = 46,640 * 3.5% = $1,632.40.
    const tax = computeStateTax(ky, stateInput('KY', { ordinaryIncome: 50_000, agesAlive: [45] }))
    expectMoney(tax, 1_632.4)
  })

  it('excludes retirement income below the $31,110 per-person cap', () => {
    // Single age 70, $30,000 wages + $20,000 pension.
    //   exclusion = min(20,000, 31,110) = 20,000.
    //   taxable = 50,000 - 20,000 - 3,360 = 26,640; tax = $932.40.
    const tax = computeStateTax(
      ky,
      stateInput('KY', { ordinaryIncome: 50_000, retirementIncome: 20_000, agesAlive: [70] }),
    )
    expectMoney(tax, 932.4)
  })

  it('excludes retirement income exactly at the $31,110 per-person cap', () => {
    // Single age 70, $30,000 wages + $31,110 pension.
    //   exclusion = min(31,110, 31,110) = 31,110.
    //   taxable = 61,110 - 31,110 - 3,360 = 26,640; tax = $932.40.
    const tax = computeStateTax(
      ky,
      stateInput('KY', { ordinaryIncome: 61_110, retirementIncome: 31_110, agesAlive: [70] }),
    )
    expectMoney(tax, 932.4)
  })

  it('taxes retirement income above the $31,110 per-person cap', () => {
    // Single age 70, $30,000 wages + $50,000 pension.
    //   exclusion = min(50,000, 31,110) = 31,110.
    //   taxable = 80,000 - 31,110 - 3,360 = 45,530; tax = $1,593.55.
    const tax = computeStateTax(
      ky,
      stateInput('KY', { ordinaryIncome: 80_000, retirementIncome: 50_000, agesAlive: [70] }),
    )
    expectMoney(tax, 1_593.55)
  })
})

/**
 * ORACLE-013 (DOCS/external-oracles.md) - California graduated income tax vs
 * the Franchise Tax Board 2025 Schedule X rate schedule.
 *
 * The state pack carries the latest-published FTB values into the 2026
 * planning year (same convention as ORACLE-009/NJ). The oracle claim is the
 * Schedule X bracket arithmetic on California taxable income; FTB personal
 * exemption CREDITS ($149 single for 2025) are a documented pack
 * simplification and are outside the asserted subset (see
 * DOCS/domain/state-tax-research/CA.md, researched 2026-06-13).
 *
 * Oracle: California Franchise Tax Board.
 *   2025 Schedule X/Y rate schedules:
 *     https://www.ftb.ca.gov/forms/2025/2025-540-tax-rate-schedules.pdf
 *   2025 Form 540 instructions (standard deduction $5,540 / $11,080; SS exempt):
 *     https://www.ftb.ca.gov/forms/2025/2025-540-instructions.html
 * Research date: 2026-06-13. Pack year: 2026. Source tax year: 2025.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-013: California graduated state income tax vs FTB Schedule X', () => {
  it('pack CA parameters match the published FTB schedule and deduction', () => {
    expect(ca.hasIncomeTax).toBe(true)
    expect(ca.taxesSocialSecurity).toBe(false)
    expect(ca.standardDeduction).toEqual({ single: 5_540, marriedFilingJointly: 11_080 })
    expect(ca.brackets.single).toEqual([
      { lowerBound: 0, ratePct: 1 },
      { lowerBound: 11_079, ratePct: 2 },
      { lowerBound: 26_264, ratePct: 4 },
      { lowerBound: 41_452, ratePct: 6 },
      { lowerBound: 57_542, ratePct: 8 },
      { lowerBound: 72_724, ratePct: 9.3 },
      { lowerBound: 371_479, ratePct: 10.3 },
      { lowerBound: 445_771, ratePct: 11.3 },
      { lowerBound: 742_953, ratePct: 12.3 },
    ])
    expect(ca.retirementPrivate).toEqual({ kind: 'none' })
  })

  it('taxes a single filer across six Schedule X bracket layers', () => {
    // Single, $100,000 CA taxable income (model input: 105,540 ordinary less
    // the 5,540 standard deduction). Schedule X stack:
    //   11,079 * 1%    =   110.79
    //   15,185 * 2%    =   303.70   (11,079 -> 26,264)
    //   15,188 * 4%    =   607.52   (26,264 -> 41,452)
    //   16,090 * 6%    =   965.40   (41,452 -> 57,542)
    //   15,182 * 8%    = 1,214.56   (57,542 -> 72,724)
    //   27,276 * 9.3%  = 2,536.668  (72,724 -> 100,000)
    //   total          = 5,738.638
    const tax = computeStateTax(ca, stateInput('CA', { ordinaryIncome: 105_540, agesAlive: [45] }))
    expectMoney(tax, 5_738.64)
  })

  it('exempts Social Security while fully taxing pension income (no exclusion)', () => {
    // MFJ retirees 68/66, $80,000 ordinary income (including a $30,000
    // pension), $40,000 Social Security. CA exempts SS entirely and has no
    // retirement-income exclusion, so taxable = 80,000 - 11,080 = 68,920.
    //   22,158 * 1% =   221.58
    //   30,370 * 2% =   607.40   (22,158 -> 52,528)
    //   16,392 * 4% =   655.68   (52,528 -> 68,920)
    //   total       = 1,484.66
    const tax = computeStateTax(
      ca,
      stateInput('CA', {
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 80_000,
        retirementIncome: 30_000,
        ssBenefits: 40_000,
        agesAlive: [68, 66],
      }),
    )
    expectMoney(tax, 1_484.66)
  })
})

/**
 * ORACLE-014 (DOCS/external-oracles.md) - Georgia flat tax and age-65+
 * retirement-income exclusion vs the Georgia Department of Revenue, 2026.
 *
 * Georgia's rate is on a legislated ramp: 5.39% (2024), cut retroactively to
 * 5.19% for 2025, and published at 4.99% with $15,000/$30,000 standard
 * deductions for 2026 — the values asserted here (this fixture's PR review
 * caught the pack carrying the stale 5.39%/$12k vintage and both were
 * refreshed together).
 *
 * The Retirement Income Exclusion allows taxpayers 65+ to exclude up to
 * $65,000 per person. The DOR's 62-64 tier ($35,000 per person) is a
 * documented pack simplification (only the 65+ tier is modeled, minAge 65) and
 * is outside the asserted subset, as is the exclusion's coverage of broad
 * investment income (modeled narrowly as pension/IRA income). See
 * DOCS/domain/state-tax-research/GA.md.
 *
 * Oracle: Georgia Department of Revenue.
 *   2026 flat rate 4.99% and standard deduction $15,000 single / $30,000 MFJ
 *   ("2026 Income Tax Changes"):
 *     https://dor.georgia.gov/taxes/important-tax-updates
 *   Retirement Income Exclusion ($35,000 at 62-64 / $65,000 at 65+ per person):
 *     https://dor.georgia.gov/retirement-income-exclusion
 * Access date: 2026-07-15. Pack year: 2026. Source tax year: 2026.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-014: Georgia retirement-income exclusion vs GA DOR 2026', () => {
  it('pack GA parameters match the GA DOR 2026 published values', () => {
    expect(ga.hasIncomeTax).toBe(true)
    expect(ga.taxesSocialSecurity).toBe(false)
    expect(ga.brackets.single).toEqual([{ lowerBound: 0, ratePct: 4.99 }])
    expect(ga.brackets.marriedFilingJointly).toEqual([{ lowerBound: 0, ratePct: 4.99 }])
    expect(ga.standardDeduction).toEqual({ single: 15_000, marriedFilingJointly: 30_000 })
    expect(ga.retirementPrivate).toEqual({ kind: 'capped', capPerPerson: 65_000, minAge: 65 })
  })

  it('excludes retirement income below the $65,000 cap for a 65+ filer', () => {
    // Single age 66, $20,000 wages + $50,000 pension.
    //   exclusion = min(50,000, 65,000) = 50,000.
    //   taxable = 70,000 - 50,000 - 15,000 = 5,000; tax = 5,000 * 4.99% = $249.50.
    const tax = computeStateTax(
      ga,
      stateInput('GA', { ordinaryIncome: 70_000, retirementIncome: 50_000, agesAlive: [66] }),
    )
    expectMoney(tax, 249.5)
  })

  it('caps the exclusion at $65,000 per person', () => {
    // Single age 70, $10,000 wages + $80,000 pension.
    //   exclusion = min(80,000, 65,000) = 65,000.
    //   taxable = 90,000 - 65,000 - 15,000 = 10,000; tax = $499.00.
    const tax = computeStateTax(
      ga,
      stateInput('GA', { ordinaryIncome: 90_000, retirementIncome: 80_000, agesAlive: [70] }),
    )
    expectMoney(tax, 499)
  })

  it('doubles the cap for a married couple who are both 65+', () => {
    // MFJ ages 70/67, $40,000 wages + $140,000 combined pensions.
    //   exclusion = min(140,000, 2 * 65,000) = 130,000.
    //   taxable = 180,000 - 130,000 - 30,000 = 20,000; tax = $998.00.
    const tax = computeStateTax(
      ga,
      stateInput('GA', {
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 180_000,
        retirementIncome: 140_000,
        agesAlive: [70, 67],
      }),
    )
    expectMoney(tax, 998)
  })
})

/**
 * ORACLE-015 (DOCS/external-oracles.md) - Illinois flat tax with the full
 * retirement-income subtraction vs the Illinois Department of Revenue.
 *
 * Illinois subtracts essentially all retirement income (qualified pensions,
 * IRA/401(k) distributions, Social Security) from base income and taxes the
 * rest at a flat 4.95%. The $2,850 personal exemption is a documented pack
 * simplification (not modeled); both cases below are chosen so the exemption
 * does not change the DOR answer - the wages case sits above the exemption's
 * $250,000 single-filer AGI disallowance threshold, and the retiree case is
 * zero-tax regardless. See DOCS/domain/state-tax-research/IL.md, researched
 * 2026-06-13.
 *
 * Oracle: Illinois Department of Revenue.
 *   Flat 4.95% rate and What's New:
 *     https://tax.illinois.gov/research/publications/bulletins/fy-2025-16.html
 *   Personal exemption $2,850 and the high-AGI disallowance:
 *     https://tax.illinois.gov/questionsandanswers/answer.851.html
 * Research date: 2026-06-13. Pack year: 2026. Source tax year: 2025.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-015: Illinois full retirement subtraction vs IL DOR', () => {
  it('pack IL parameters match the IL DOR published values', () => {
    expect(il.hasIncomeTax).toBe(true)
    expect(il.taxesSocialSecurity).toBe(false)
    expect(il.brackets.single).toEqual([{ lowerBound: 0, ratePct: 4.95 }])
    expect(il.standardDeduction).toEqual({ single: 0, marriedFilingJointly: 0 })
    expect(il.retirementPrivate).toEqual({ kind: 'full' })
  })

  it('taxes wages at the flat 4.95% with no standard deduction', () => {
    // Single, $300,000 wages (above the exemption disallowance threshold, so
    // the DOR return has no exemption either): tax = 300,000 * 4.95% = $14,850.
    const tax = computeStateTax(il, stateInput('IL', { ordinaryIncome: 300_000, agesAlive: [55] }))
    expectMoney(tax, 14_850)
  })

  it('subtracts retirement income in full, leaving a retiree at zero tax', () => {
    // Single age 70, $80,000 pension/IRA distributions + $30,000 Social
    // Security. The retirement subtraction removes all $80,000 and SS is
    // exempt: taxable = 0; tax = $0.
    const tax = computeStateTax(
      il,
      stateInput('IL', { ordinaryIncome: 80_000, retirementIncome: 80_000, ssBenefits: 30_000, agesAlive: [70] }),
    )
    expectMoney(tax, 0)
  })
})

/**
 * ORACLE-016 (DOCS/external-oracles.md) - South Carolina's H.4216 (signed
 * 2026-03-30) two-tier 2026 schedule and the SCIAD standard deduction vs the
 * SCDOR "Information About H.4216" notice.
 *
 * H.4216 rewrote TY2026 mid-year: (1) SC decouples from the federal standard
 * deduction, replaced by the SC Income Adjusted Deduction (SCIAD) of $15,000
 * single / $30,000 MFJ (its AGI phase-out is not modeled in the pack); (2) the
 * old 0%/3%/6% schedule becomes "1.99% for South Carolina taxable income under
 * $30,000" and "5.21% minus $966 at $30,000 and above". That is mathematically
 * the two-bracket graduated pair 1.99% (0-$30,000) / 5.21% (above), which is
 * exactly how the pack encodes it:
 *
 *   Continuity identity. The $966 offset is (5.21% - 1.99%) x $30,000
 *   = 3.22% x $30,000 = $966, so at taxable = $30,000 both formulas meet:
 *     lower tier:  $30,000 x 1.99%            = $597.00
 *     upper tier:  $30,000 x 5.21% - $966     = $1,563.00 - $966 = $597.00
 *   and for any taxable T >= $30,000 the two-bracket stack reproduces the
 *   "5.21% minus $966" rule exactly:
 *     $30,000 x 1.99% + (T - $30,000) x 5.21% = T x 5.21% - $966.
 *
 * These cases use wage income only (no retirement income) so the schedule and
 * the SCIAD are isolated; SC's retirement-income deduction ($10,000 at 65+),
 * the age-65 general deduction, the 44% net-LTCG deduction, and the SCIAD
 * income phase-out are documented pack simplifications outside this subset
 * (see DOCS/domain/state-tax-research/SC.md).
 *
 * Oracle: South Carolina Department of Revenue.
 *   "Information About H. 4216" (SCIAD $15,000/$30,000; 1.99% under $30,000;
 *   5.21% minus $966 at/above $30,000):
 *     https://www.dor.sc.gov/index.php/news/information-about-h-4216
 * Access date: 2026-07-17. Pack year: 2026. Source tax year: 2026.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-016: South Carolina H.4216 two-tier schedule + SCIAD vs SCDOR', () => {
  it('pack SC parameters match the H.4216 SCIAD and two-tier schedule', () => {
    expect(sc.hasIncomeTax).toBe(true)
    expect(sc.taxesSocialSecurity).toBe(false)
    expect(sc.standardDeduction).toEqual({ single: 15_000, marriedFilingJointly: 30_000 })
    expect(sc.brackets.single).toEqual([
      { lowerBound: 0, ratePct: 1.99 },
      { lowerBound: 30_000, ratePct: 5.21 },
    ])
    expect(sc.brackets.marriedFilingJointly).toEqual([
      { lowerBound: 0, ratePct: 1.99 },
      { lowerBound: 30_000, ratePct: 5.21 },
    ])
  })

  it('taxes South Carolina taxable income below $30,000 at the 1.99% lower tier', () => {
    // Single, $40,000 wages. SCIAD: taxable = 40,000 - 15,000 = 25,000 (< 30,000).
    //   tax = 25,000 * 1.99% = $497.50.
    const tax = computeStateTax(sc, stateInput('SC', { ordinaryIncome: 40_000, agesAlive: [45] }))
    expectMoney(tax, 497.5)
  })

  it('meets the continuity point at exactly $30,000 of taxable income ($966 identity)', () => {
    // Single, $45,000 wages. SCIAD: taxable = 45,000 - 15,000 = 30,000.
    //   lower tier:  30,000 * 1.99%        = 597.00
    //   upper tier:  30,000 * 5.21% - 966  = 1,563.00 - 966 = 597.00  (identical)
    const tax = computeStateTax(sc, stateInput('SC', { ordinaryIncome: 45_000, agesAlive: [45] }))
    expectMoney(tax, 597)
  })

  it('taxes South Carolina taxable income above $30,000 (the "5.21% minus $966" rule)', () => {
    // Single, $75,000 wages. SCIAD: taxable = 75,000 - 15,000 = 60,000 (> 30,000).
    //   two-bracket stack: 30,000 * 1.99% + 30,000 * 5.21% = 597.00 + 1,563.00 = 2,160.00
    //   "5.21% minus $966": 60,000 * 5.21% - 966 = 3,126.00 - 966 = 2,160.00  (identical)
    const tax = computeStateTax(sc, stateInput('SC', { ordinaryIncome: 75_000, agesAlive: [45] }))
    expectMoney(tax, 2_160)
  })

  it('applies the doubled $30,000 SCIAD for a married-filing-jointly couple', () => {
    // MFJ, $90,000 wages. SCIAD: taxable = 90,000 - 30,000 = 60,000 (> 30,000).
    //   (thresholds are NOT doubled: the $30,000 rate breakpoint is per-return.)
    //   60,000 * 5.21% - 966 = 3,126.00 - 966 = 2,160.00.
    const tax = computeStateTax(
      sc,
      stateInput('SC', { filingStatus: 'marriedFilingJointly', ordinaryIncome: 90_000, agesAlive: [45, 45] }),
    )
    expectMoney(tax, 2_160)
  })
})

/**
 * ORACLE-017 (DOCS/external-oracles.md) - Maine's decoupled 2026 standard
 * deduction, graduated bracket stack, and the 2% high-income surcharge
 * (modeled as a 9.15% top bracket) vs the Maine Revenue Services 2026 rate
 * schedule.
 *
 * For 2026 Maine decoupled from the federal standard deduction (36 M.R.S.
 * §5124-C 1-B), publishing its own $15,700 single / $31,400 MFJ amounts; and
 * added a 2% surcharge on Maine taxable income over $1,000,000 (single) /
 * $1,500,000 (MFJ). The pack encodes the surcharge as an equivalent 9.15% top
 * bracket (7.15% base + 2% surcharge); on income above the threshold,
 * 9.15% = 7.15% + 2%, so the marginal-bracket form reproduces the surcharge
 * exactly.
 *
 * The MRS schedule publishes each bracket's cumulative base rounded to whole
 * dollars (single: $1,589 / $4,117 / $70,980; MFJ: $3,181 / $8,237 /
 * $106,210). The worksheets below compute the unrounded marginal-bracket stack
 * the engine uses and cross-check each cumulative sum against the published
 * rounded base; the two agree within rounding (<$1).
 *
 * Maine's $48,216-per-person pension deduction, its reduction by SS/Railroad
 * Retirement received, the personal exemption ($5,300), and the standard-
 * deduction phase-out are documented pack simplifications outside this subset
 * (see DOCS/domain/state-tax-research/ME.md); these cases carry wage income
 * only so the deduction and schedule are isolated.
 *
 * Oracle: Maine Revenue Services.
 *   "2026 Individual Income Tax Rates" schedule, rev. May 5, 2026
 *   (standard deduction $15,700/$31,400; brackets 5.8%/6.75%/7.15% at
 *   $27,400/$64,850 single and $54,850/$129,750 MFJ; 9.15% over $1M single /
 *   $1.5M MFJ from the 2% surcharge):
 *     https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/ind_tax_rate_sched_2026.pdf
 * Access date: 2026-07-17. Pack year: 2026. Source tax year: 2026.
 * Tolerance: $1, asserted to cents where the model is exact.
 */
describe('ORACLE-017: Maine decoupled deduction + surcharge bracket vs MRS 2026 schedule', () => {
  it('pack ME parameters match the MRS 2026 schedule (surcharge as a 9.15% top bracket)', () => {
    expect(me.hasIncomeTax).toBe(true)
    expect(me.taxesSocialSecurity).toBe(false)
    expect(me.standardDeduction).toEqual({ single: 15_700, marriedFilingJointly: 31_400 })
    expect(me.brackets.single).toEqual([
      { lowerBound: 0, ratePct: 5.8 },
      { lowerBound: 27_400, ratePct: 6.75 },
      { lowerBound: 64_850, ratePct: 7.15 },
      { lowerBound: 1_000_000, ratePct: 9.15 },
    ])
    expect(me.brackets.marriedFilingJointly).toEqual([
      { lowerBound: 0, ratePct: 5.8 },
      { lowerBound: 54_850, ratePct: 6.75 },
      { lowerBound: 129_750, ratePct: 7.15 },
      { lowerBound: 1_500_000, ratePct: 9.15 },
    ])
  })

  it('applies the decoupled $15,700 single standard deduction in the first bracket', () => {
    // Single, $30,000 wages. Decoupled SD: taxable = 30,000 - 15,700 = 14,300
    // (< 27,400, first bracket). tax = 14,300 * 5.8% = $829.40. (The federal
    // 2026 standard deduction is $16,100, so decoupling raises Maine tax here.)
    const tax = computeStateTax(me, stateInput('ME', { ordinaryIncome: 30_000, agesAlive: [45] }))
    expectMoney(tax, 829.4)
  })

  it('stacks the 5.8% / 6.75% / 7.15% single brackets', () => {
    // Single, $100,000 wages. SD: taxable = 100,000 - 15,700 = 84,300 (7.15% band).
    //   27,400 * 5.8%             = 1,589.20   (base check: MRS $1,589)
    //   (64,850 - 27,400) * 6.75% = 2,527.875  (cum 4,117.075; MRS $4,117)
    //   (84,300 - 64,850) * 7.15% = 1,390.675
    //   total                     = 5,507.75
    const tax = computeStateTax(me, stateInput('ME', { ordinaryIncome: 100_000, agesAlive: [45] }))
    expectMoney(tax, 5_507.75)
  })

  it('applies the 2% surcharge (9.15% top bracket) for a single filer above $1M', () => {
    // Single, $1,215,700 wages. SD: taxable = 1,215,700 - 15,700 = 1,200,000.
    //   27,400 * 5.8%                    =     1,589.20
    //   (64,850 - 27,400) * 6.75%        =     2,527.875
    //   (1,000,000 - 64,850) * 7.15%     =    66,863.225  (cum 70,980.30; MRS $70,980)
    //   (1,200,000 - 1,000,000) * 9.15%  =    18,300.00
    //   total                            =    89,280.30
    //   surcharge check: the $200,000 over $1M is taxed at 9.15% = 7.15% + 2%,
    //   i.e. 18,300 = 14,300 (base) + 4,000 (2% surcharge).
    const tax = computeStateTax(me, stateInput('ME', { ordinaryIncome: 1_215_700, agesAlive: [55] }))
    expectMoney(tax, 89_280.3)
  })

  it('applies the 2% surcharge (9.15% top bracket) for an MFJ couple above $1.5M', () => {
    // MFJ, $1,631,400 wages. SD: taxable = 1,631,400 - 31,400 = 1,600,000.
    //   54,850 * 5.8%                    =      3,181.30
    //   (129,750 - 54,850) * 6.75%       =      5,055.75
    //   (1,500,000 - 129,750) * 7.15%    =     97,972.875 (cum 106,209.925; MRS $106,210)
    //   (1,600,000 - 1,500,000) * 9.15%  =      9,150.00
    //   total                            =    115,359.925  (to the cent: $115,359.93)
    //   surcharge check: the $100,000 over $1.5M is taxed at 9.15% = 7.15% + 2%,
    //   i.e. 9,150 = 7,150 (base) + 2,000 (2% surcharge).
    const tax = computeStateTax(
      me,
      stateInput('ME', { filingStatus: 'marriedFilingJointly', ordinaryIncome: 1_631_400, agesAlive: [55, 55] }),
    )
    expectMoney(tax, 115_359.93)
  })
})
