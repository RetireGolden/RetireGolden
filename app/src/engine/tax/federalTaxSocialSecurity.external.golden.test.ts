import { describe, it } from 'vitest'

import { expectMoney } from '../../testSupport/money'
import { computeFederalTax } from './federalTax'
import type { TaxYearInput } from '../projection/types'

/**
 * ORACLE-002 (Phase 5, external-oracle-comparisons.md) — retired MFJ household
 * with pension + Social Security, vs the IRS taxable-Social-Security worksheet
 * (IRC §86) and the 2026 IRS rate schedule.
 *
 * Oracles:
 *   Taxable Social Security: IRS Publication 915, Worksheet 1 / the Form 1040
 *     "Social Security Benefits Worksheet" (https://www.irs.gov/pub/irs-pdf/p915.pdf).
 *     Statutory MFJ base amounts $32,000 / $44,000 (never indexed). Each case
 *     below is a full hand-walk of that worksheet.
 *   Deductions + brackets: IRS Rev. Proc. 2025-32 (2026) — already pinned in
 *     ORACLE-001. MFJ standard deduction $32,200, +$1,650/person age 65, OBBBA
 *     senior deduction $6,000/person (no phase-out below $150,000 MAGI).
 * Access date: 2026-06-29. Tax year: 2026. Tolerance: $1.
 *
 * Each household is MFJ, both spouses 65+, no capital gains, no state tax.
 * Total deduction in every case = 32,200 + 2×1,650 + 2×6,000 = $47,500.
 */
function retiredMfj(pension: number, ssBenefits: number): ReturnType<typeof computeFederalTax> {
  const input: TaxYearInput = {
    year: 2026,
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: pension,
    capitalGains: 0,
    ssBenefits,
    peopleAged65Plus: 2,
  }
  return computeFederalTax(input)
}

describe('ORACLE-002: retired MFJ pension + Social Security vs IRS Pub 915 worksheet', () => {
  it('taxes 0% of benefits below the first base amount (provisional ≤ $32,000)', () => {
    // Pub 915 worksheet: ½·20,000 + 15,000 = 25,000 ≤ 32,000 → none taxable.
    const r = retiredMfj(15_000, 20_000)
    expectMoney(r.taxableSocialSecurity, 0)
    expectMoney(r.agi, 15_000) // 15,000 pension + 0 taxable SS
    expectMoney(r.deduction, 47_500)
    expectMoney(r.taxableIncome, 0) // deduction exceeds AGI
    expectMoney(r.totalTax, 0)
  })

  it('taxes within the 50% tier ($32,000 < provisional ≤ $44,000)', () => {
    // Worksheet: provisional = ½·20,000 + 30,000 = 40,000.
    //   line 9  = 40,000 − 32,000 = 8,000
    //   line 11 = min(8,000, 12,000) = 8,000 ; line 12 = ½·8,000 = 4,000
    //   line 13 = min(½·benefits 10,000, 4,000) = 4,000 ; no amount over 44,000
    //   taxable SS = min(4,000, 0.85·20,000) = 4,000.
    const r = retiredMfj(30_000, 20_000)
    expectMoney(r.taxableSocialSecurity, 4_000)
    expectMoney(r.agi, 34_000) // 30,000 + 4,000
    expectMoney(r.taxableIncome, 0) // 34,000 − 47,500 < 0
    expectMoney(r.totalTax, 0)
  })

  it('taxes within the 85% tier, below the 85% cap (provisional > $44,000)', () => {
    // Worksheet: provisional = ½·40,000 + 40,000 = 60,000.
    //   line 13 = min(½·40,000, ½·12,000) = 6,000
    //   line 14 = 60,000 − 44,000 = 16,000 ; line 15 = 0.85·16,000 = 13,600
    //   line 16 = 6,000 + 13,600 = 19,600 ; line 17 = 0.85·40,000 = 34,000
    //   taxable SS = min(19,600, 34,000) = 19,600.
    const r = retiredMfj(40_000, 40_000)
    expectMoney(r.taxableSocialSecurity, 19_600)
    expectMoney(r.agi, 59_600) // 40,000 + 19,600
    expectMoney(r.deduction, 47_500)
    expectMoney(r.taxableIncome, 12_100) // 59,600 − 47,500
    // MFJ ordinary tax: 12,100 entirely in the 10% bracket = $1,210.
    expectMoney(r.totalTax, 1_210)
  })

  it('caps taxable benefits at 85% of benefits for a higher-income retiree', () => {
    // Worksheet: provisional = ½·40,000 + 70,000 = 90,000.
    //   line 16 = 6,000 + 0.85·(90,000 − 44,000) = 6,000 + 39,100 = 45,100
    //   line 17 = 0.85·40,000 = 34,000 ; taxable SS = min(45,100, 34,000) = 34,000 (85% cap).
    const r = retiredMfj(70_000, 40_000)
    expectMoney(r.taxableSocialSecurity, 34_000)
    expectMoney(r.agi, 104_000) // 70,000 + 34,000
    expectMoney(r.deduction, 47_500)
    expectMoney(r.taxableIncome, 56_500) // 104,000 − 47,500
    // MFJ ordinary tax: 24,800·10% + (56,500 − 24,800)·12% = 2,480 + 3,804 = $6,284.
    expectMoney(r.totalTax, 6_284)
  })
})
