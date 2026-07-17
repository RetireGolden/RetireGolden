import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { stateParamsFor } from '../params/state/index.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTax, createStateTaxCalculator } from './stateTax.js'

/**
 * Atomic oracle tests for state income tax (Phase 1, calculation-test-plan.md).
 *
 * Expected values are hand worksheets from the 2026 state pack constants. These
 * prove the engine applies each state's rate/deduction/exclusion structure; they
 * do not independently certify the pack rates against current state law.
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

const params = (code: string) => stateParamsFor(code, 2026)!

describe('state tax golden worksheets', () => {
  it('a no-income-tax state contributes zero', () => {
    expect(computeStateTax(params('FL'), input({ ordinaryIncome: 100_000 }))).toBe(0)
  })

  it('a flat-tax state taxes income after its standard deduction (KY 3.5%)', () => {
    // KY: standard deduction 3,360, flat 3.5%. (100,000 - 3,360) * 3.5% = 3,382.40.
    expectMoney(computeStateTax(params('KY'), input({ ordinaryIncome: 100_000 })), 3_382.4)
  })

  it('a graduated state stacks bracket layers (AL single)', () => {
    // AL single: SD 3,000; brackets 2% <500, 4% 500-3,000, 5% above.
    // 50,000 - 3,000 = 47,000 taxable.
    // 2%*500 + 4%*2,500 + 5%*44,000 = 10 + 100 + 2,200 = 2,310.
    expectMoney(computeStateTax(params('AL'), input({ ordinaryIncome: 50_000 })), 2_310)
  })

  it('a Social-Security-taxing state adds the federally taxable SS amount (CO 4.4%)', () => {
    // ordinary 30,000 + SS 20,000. Federal taxable SS:
    //   provisional 40,000 > 34,000; tier1 = min(10,000, 4,500) = 4,500;
    //   taxable SS = min(17,000, 85%*6,000 + 4,500) = 9,600.
    // CO: SD 16,100 (2026 federal-equivalent), flat 4.4%.
    //   (30,000 + 9,600 - 16,100) * 4.4% = 23,500 * 4.4% = 1,034.00.
    expectMoney(computeStateTax(params('CO'), input({ ordinaryIncome: 30_000, ssBenefits: 20_000 })), 1_034)
  })

  it('a full retirement-income exclusion removes all retirement income (IL)', () => {
    // IL: flat 4.95%, no standard deduction, full retirement exclusion (no min age).
    // 60,000 ordinary of which 40,000 is retirement income -> exclude all 40,000.
    //   (60,000 - 40,000) * 4.95% = 20,000 * 4.95% = 990.
    const excluded = computeStateTax(
      params('IL'),
      input({ ordinaryIncome: 60_000, retirementIncome: 40_000, agesAlive: [66] }),
    )
    expectMoney(excluded, 990)

    // Without retirement designation the full 60,000 is taxed: 60,000 * 4.95% = 2,970.
    const noExclusion = computeStateTax(params('IL'), input({ ordinaryIncome: 60_000 }))
    expectMoney(noExclusion, 2_970)
  })

  it('a capped retirement exclusion caps the excluded retirement income (KY)', () => {
    // KY: retirement exclusion capped at 31,110/person (no minimum age); SD 3,360; 3.5%.
    // Exclude min(40,000, 31,110) = 31,110.
    //   (40,000 - 31,110 - 3,360) * 3.5% = 5,530 * 3.5% = 193.55.
    const capped = computeStateTax(
      params('KY'),
      input({ ordinaryIncome: 40_000, retirementIncome: 40_000, agesAlive: [66] }),
    )
    expectMoney(capped, 193.55)
  })

  it('a minimum-age retirement exclusion toggles at the eligible age (AL single)', () => {
    // AL single: cap 6,000/person, minAge 65; SD 3,000; 2% <500, 4% 500-3,000, 5% above.
    // Eligible (age 66): exclude 6,000. taxable 40,000 - 6,000 - 3,000 = 31,000.
    //   2%*500 + 4%*2,500 + 5%*28,000 = 10 + 100 + 1,400 = 1,510.
    const eligible = computeStateTax(
      params('AL'),
      input({ ordinaryIncome: 40_000, retirementIncome: 20_000, agesAlive: [66] }),
    )
    expectMoney(eligible, 1_510)

    // Below the minimum age (60): no exclusion. taxable 40,000 - 3,000 = 37,000.
    //   10 + 100 + 5%*34,000 = 1,810. The 6,000 exclusion is worth 5% = 300.
    const tooYoung = computeStateTax(
      params('AL'),
      input({ ordinaryIncome: 40_000, retirementIncome: 20_000, agesAlive: [60] }),
    )
    expectMoney(tooYoung, 1_810)
    expectMoney(tooYoung - eligible, 300)
  })

  it('a per-person exclusion cap scales with the number of eligible people (AL MFJ)', () => {
    // AL MFJ: SD 8,500; brackets 2% <1,000, 4% 1,000-6,000, 5% above; cap 6,000/person, minAge 65.
    // Two eligible (66, 67): exclude min(20,000, 12,000) = 12,000.
    //   taxable 40,000 - 12,000 - 8,500 = 19,500.
    //   2%*1,000 + 4%*5,000 + 5%*13,500 = 20 + 200 + 675 = 895.
    const twoEligible = computeStateTax(
      params('AL'),
      input({
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 40_000,
        retirementIncome: 20_000,
        agesAlive: [66, 67],
      }),
    )
    expectMoney(twoEligible, 895)

    // One eligible (66) + one under 65 (40): exclude only 6,000.
    //   taxable 40,000 - 6,000 - 8,500 = 25,500.
    //   20 + 200 + 5%*19,500 = 1,195. The extra 6,000 of exclusion is worth 5% = 300.
    const oneEligible = computeStateTax(
      params('AL'),
      input({
        filingStatus: 'marriedFilingJointly',
        ordinaryIncome: 40_000,
        retirementIncome: 20_000,
        agesAlive: [66, 40],
      }),
    )
    expectMoney(oneEligible, 1_195)
    expectMoney(oneEligible - twoEligible, 300)
  })

  it('a flat override rate takes precedence over the modeled state', () => {
    // override 5% on (ordinary + positive gains), ignoring the FL no-tax pack.
    const calc = createStateTaxCalculator({ overridePct: 5 })
    expectMoney(calc.compute(input({ state: 'FL', ordinaryIncome: 100_000, capitalGains: 20_000 })), 6_000)
  })

  it('relocation switches the resolved state pack by year', () => {
    // Same income, FL (no tax) vs KY (3.5% after 3,360 SD).
    const calc = createStateTaxCalculator()
    expect(calc.compute(input({ state: 'FL', ordinaryIncome: 100_000 }))).toBe(0)
    expectMoney(calc.compute(input({ state: 'KY', ordinaryIncome: 100_000 })), 3_382.4)
  })
})
