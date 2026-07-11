import { describe, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeFederalTax } from './federalTax.js'

/**
 * Atomic oracle tests for federal income tax (Phase 1, calculation-test-plan.md).
 *
 * Every expected value is an independent hand worksheet computed from the 2026
 * pack's published constants (brackets, deductions, thresholds), not from running
 * RetireGolden. The pack constants themselves are the law/parameter inputs; see the
 * external-oracle backlog (ORACLE-001/002) for cross-checks against Tax-Calculator.
 *
 * 2026 single constants used below:
 *   standard deduction 16,100 (+2,050 age 65); brackets 10% <12,400, 12% <50,400,
 *   22% <105,700, 24% <201,775, 32% <256,225; LTCG 15% starts above 49,450;
 *   NIIT 3.8% over MAGI 200,000; SS provisional tiers 25,000 / 34,000.
 *   MFJ: standard 32,200; brackets 10% <24,800, 12% <100,800.
 */
function input(partial: Partial<TaxYearInput>): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...partial,
  }
}

describe('federal tax golden worksheets', () => {
  it('single, wages only, income entirely in the first bracket', () => {
    // 20,000 - 16,100 deduction = 3,900 taxable; 10% * 3,900 = 390.
    const r = computeFederalTax(input({ ordinaryIncome: 20_000 }))
    expectMoney(r.deduction, 16_100)
    expectMoney(r.taxableIncome, 3_900)
    expectMoney(r.ordinaryTax, 390)
    expectMoney(r.totalTax, 390)
  })

  it('MFJ, wages only, spanning the 10% and 12% brackets', () => {
    // 120,000 - 32,200 = 87,800 taxable.
    // 10% * 24,800 = 2,480; 12% * (87,800 - 24,800) = 12% * 63,000 = 7,560.
    const r = computeFederalTax(input({ filingStatus: 'marriedFilingJointly', ordinaryIncome: 120_000 }))
    expectMoney(r.deduction, 32_200)
    expectMoney(r.taxableIncome, 87_800)
    expectMoney(r.ordinaryTax, 10_040)
    expectMoney(r.totalTax, 10_040)
  })

  it('single high earner crossing five brackets', () => {
    // 250,000 - 16,100 = 233,900 taxable.
    // 10%*12,400=1,240; 12%*38,000=4,560; 22%*55,300=12,166;
    // 24%*96,075=23,058; 32%*(233,900-201,775)=32%*32,125=10,280.
    const r = computeFederalTax(input({ ordinaryIncome: 250_000 }))
    expectMoney(r.taxableIncome, 233_900)
    expectMoney(r.ordinaryTax, 51_304)
    expectMoney(r.totalTax, 51_304)
  })

  it('Social Security below the first provisional threshold is untaxed', () => {
    // Provisional = 10,000 + 50% * 20,000 = 20,000 <= 25,000 -> taxable SS 0.
    const r = computeFederalTax(input({ ordinaryIncome: 10_000, ssBenefits: 20_000 }))
    expectMoney(r.taxableSocialSecurity, 0)
    expectMoney(r.agi, 10_000)
    expectMoney(r.magi, 10_000)
    expectMoney(r.totalTax, 0)
  })

  it('Social Security in the 50% tier', () => {
    // Provisional = 20,000 + 10,000 = 30,000, between 25,000 and 34,000.
    // Taxable SS = min(50% * 20,000, 50% * (30,000 - 25,000)) = 2,500.
    // AGI = 20,000 + 2,500 = 22,500; taxable = 6,400; tax = 10% * 6,400 = 640.
    const r = computeFederalTax(input({ ordinaryIncome: 20_000, ssBenefits: 20_000 }))
    expectMoney(r.taxableSocialSecurity, 2_500)
    expectMoney(r.agi, 22_500)
    expectMoney(r.taxableIncome, 6_400)
    expectMoney(r.totalTax, 640)
  })

  it('Social Security capped at the 85% ceiling', () => {
    // Provisional = 100,000 + 20,000 = 120,000 >> 34,000.
    // tier1 = min(50% * 40,000, 50% * (34,000 - 25,000)) = 4,500.
    // Taxable SS = min(85% * 40,000 = 34,000, 85% * 86,000 + 4,500) = 34,000 (cap).
    const r = computeFederalTax(input({ ordinaryIncome: 100_000, ssBenefits: 40_000 }))
    expectMoney(r.taxableSocialSecurity, 34_000)
    expectMoney(r.agi, 134_000)
  })

  it('long-term gains stacked fully inside the 0% bracket', () => {
    // 30,000 gains, no other income. AGI 30,000 - 16,100 = 13,900 taxable.
    // All preferential income sits below the 49,450 15% threshold -> 0% tax.
    const r = computeFederalTax(input({ capitalGains: 30_000 }))
    expectMoney(r.preferentialIncome, 13_900)
    expectMoney(r.capitalGainsTax, 0)
    expectMoney(r.totalTax, 0)
  })

  it('long-term gains split between the 0% and 15% brackets', () => {
    // 60,000 ordinary + 40,000 gains. AGI 100,000 - 16,100 = 83,900 taxable.
    // Ordinary taxable = 83,900 - 40,000 = 43,900.
    // Gains stack 43,900 -> 83,900: 43,900-49,450 at 0%, 49,450-83,900 (34,450) at 15%.
    // Capital gains tax = 34,450 * 15% = 5,167.50.
    // Ordinary tax = 10%*12,400 + 12%*31,500 = 1,240 + 3,780 = 5,020.
    const r = computeFederalTax(input({ ordinaryIncome: 60_000, capitalGains: 40_000 }))
    expectMoney(r.ordinaryTaxable, 43_900)
    expectMoney(r.preferentialIncome, 40_000)
    expectMoney(r.capitalGainsTax, 5_167.5)
    expectMoney(r.ordinaryTax, 5_020)
    expectMoney(r.totalTax, 10_187.5)
  })

  it('NIIT applies only on investment income above the MAGI threshold', () => {
    // 50,000 gains. At MAGI exactly 200,000 -> no NIIT.
    const at = computeFederalTax(input({ ordinaryIncome: 150_000, capitalGains: 50_000 }))
    expectMoney(at.magi, 200_000)
    expectMoney(at.niit, 0)

    // One dollar over the threshold -> NIIT base = 1, NIIT = 3.8% * 1 = 0.038.
    const over = computeFederalTax(input({ ordinaryIncome: 150_001, capitalGains: 50_000 }))
    expectMoney(over.magi, 200_001)
    expectMoney(over.niit, 0.038)
  })

  it('OBBBA senior deduction phases out at 6% of MAGI above 75,000 (single)', () => {
    // Base 6,000 per person 65+. Standard incl. age-65 add = 16,100 + 2,050 = 18,150.
    // At MAGI 75,000: full 6,000; deduction 24,150; taxable 75,000-24,150 = 50,850.
    const atStart = computeFederalTax(input({ ordinaryIncome: 75_000, peopleAged65Plus: 1 }))
    expectMoney(atStart.seniorDeduction, 6_000)
    expectMoney(atStart.deduction, 24_150)
    expectMoney(atStart.taxableIncome, 50_850)

    // At MAGI 125,000: phase-out 6% * 50,000 = 3,000; senior 3,000.
    const mid = computeFederalTax(input({ ordinaryIncome: 125_000, peopleAged65Plus: 1 }))
    expectMoney(mid.seniorDeduction, 3_000)

    // At MAGI 175,000: phase-out 6% * 100,000 = 6,000; senior fully gone.
    const gone = computeFederalTax(input({ ordinaryIncome: 175_000, peopleAged65Plus: 1 }))
    expectMoney(gone.seniorDeduction, 0)
  })

  it('a negative net capital gain reduces both AGI and taxable Social Security', () => {
    // 30,000 ordinary, -3,000 net capital loss, 20,000 SS.
    // agi-excl-SS = 30,000 - 3,000 = 27,000; provisional = 27,000 + 10,000 = 37,000.
    // tier1 = min(10,000, 4,500) = 4,500; taxable SS = 85%*(37,000-34,000) + 4,500 = 7,050.
    // AGI = 27,000 + 7,050 = 34,050.
    const withLoss = computeFederalTax(input({ ordinaryIncome: 30_000, capitalGains: -3_000, ssBenefits: 20_000 }))
    expectMoney(withLoss.taxableSocialSecurity, 7_050)
    expectMoney(withLoss.agi, 34_050)

    // Without the loss, taxable SS rises to 9,600 and AGI to 39,600, so the 3,000
    // loss lowers AGI by 5,550 — 3,000 directly plus 2,550 less taxable SS.
    const noLoss = computeFederalTax(input({ ordinaryIncome: 30_000, ssBenefits: 20_000 }))
    expectMoney(noLoss.taxableSocialSecurity, 9_600)
    expectMoney(noLoss.agi, 39_600)
    expectMoney(noLoss.agi - withLoss.agi, 5_550)
  })

  it('itemized beats the standard deduction with SALT capped', () => {
    // SALT 50,000 capped at 40,400; + 5,000 mortgage + 5,000 charitable = 50,400.
    // 50,400 > 16,100 standard, so itemized is used.
    // 100,000 - 50,400 = 49,600 taxable; 10%*12,400 + 12%*37,200 = 1,240 + 4,464 = 5,704.
    const r = computeFederalTax(
      input({
        ordinaryIncome: 100_000,
        itemizedDeductions: { stateAndLocalTaxes: 50_000, mortgageInterest: 5_000, charitable: 5_000 },
      }),
    )
    expectMoney(r.deduction, 50_400)
    expectMoney(r.taxableIncome, 49_600)
    expectMoney(r.totalTax, 5_704)
  })
})
