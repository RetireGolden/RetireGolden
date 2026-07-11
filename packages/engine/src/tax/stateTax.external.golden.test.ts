import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { stateParamsFor } from '../params/state/index.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTax } from './stateTax.js'

const ky = stateParamsFor('KY', 2026)!
const nj = stateParamsFor('NJ', 2026)!

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
 * ORACLE-009 (Phase 5, external-oracle-comparisons.md) - New Jersey graduated
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
 * ORACLE-010 (Phase 5, external-oracle-comparisons.md) - Kentucky retirement
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
