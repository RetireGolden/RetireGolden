import { describe, expect, it } from 'vitest'

import { createFlatTaxCalculator } from './flatTax.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { expectMoney } from '../testing/money.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
  traditionalAccount,
} from '../testing/planFixtures.js'

const noTax = createFlatTaxCalculator(0)
const federal = createFederalTaxCalculator()

describe('full-plan golden fixtures', () => {
  it('Plan A: cash-only retiree drains cash and records a shortfall', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.expenses.baseAnnual = 40_000

    const result = runPlan(plan, noTax)

    // Independent worksheet:
    // 2026: 100,000 - 40,000 = 60,000.
    // 2027:  60,000 - 40,000 = 20,000.
    // 2028: only 20,000 available for 40,000 spending -> 20,000 shortfall.
    expect(result.depletionYear).toBe(2028)
    expectMoney(result.years[0]!.withdrawals.cash, 40_000)
    expectMoney(result.years[0]!.balances['cash']!, 60_000)
    expectMoney(result.years[1]!.withdrawals.cash, 40_000)
    expectMoney(result.years[1]!.balances['cash']!, 20_000)
    expectMoney(result.years[2]!.withdrawals.cash, 20_000)
    expectMoney(result.years[2]!.shortfall, 20_000)
    expectMoney(result.years[2]!.balances['cash']!, 0)
  })

  it('Plan B: traditional withdrawal grosses up to cover federal tax', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [traditionalAccount('ira', 100_000)]
    plan.expenses.baseAnnual = 50_000

    const result = runPlan(plan, federal)
    const year = result.years[0]!

    // Independent worksheet:
    // Let W be the traditional withdrawal. Taxable income = W - 16,100.
    // Spending needs 50,000 after tax, and W lands in the 12% bracket:
    // W = 50,000 + 1,240 + 12% * (W - 16,100 - 12,400)
    // W = 54,340.91, tax = 4,340.91.
    expectMoney(year.expenses.total, 50_000)
    expectMoney(year.withdrawals.traditional, 54_340.91)
    expectMoney(year.tax, 4_340.91)
    expectMoney(year.magi, 54_340.91)
    expectMoney(year.balances['ira']!, 45_659.09)
  })

  it('Plan C: taxable brokerage withdrawal realizes gains by basis ratio', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [taxableAccount('taxable', 100_000, 70_000)]
    plan.expenses.baseAnnual = 20_000

    const result = runPlan(plan, federal)
    const year = result.years[0]!

    // Independent worksheet:
    // Cost basis ratio = 70,000 / 100,000 = 70%.
    // A 20,000 withdrawal realizes 30% gain = 6,000.
    // With no ordinary income, 6,000 of gains is below the 16,100 deduction,
    // so federal tax is 0 and ending balance is 80,000.
    expectMoney(year.withdrawals.taxable, 20_000)
    expectMoney(year.realizedGains, 6_000)
    expectMoney(year.tax, 0)
    expectMoney(year.balances['taxable']!, 80_000)
  })

  it('Plan D: Social Security taxation flows into MAGI and the annual ledger', () => {
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.expenses.baseAnnual = 10_000
    plan.incomes = [
      recurringOrdinaryIncome('ordinary', 20_000, 2026),
      socialSecurityIncome('ss', 2_000 / 0.7, 62),
    ]

    const result = runPlan(plan, federal)
    const year = result.years[0]!

    // Independent worksheet:
    // Born 1964 -> FRA 67; claim at 62 -> 70% of PIA.
    // PIA 2,000 / 0.70 = 2,857.142857, so gross SS = 24,000.
    // Provisional income = 20,000 + 50% * 24,000 = 32,000.
    // Taxable SS = 50% * (32,000 - 25,000) = 3,500.
    // AGI/MAGI = 20,000 + 3,500 = 23,500.
    // Taxable income = 23,500 - 16,100 = 7,400; tax = 740.
    // Surplus invested = 20,000 + 24,000 - 10,000 - 740 = 33,260.
    expectMoney(year.incomes.socialSecurity, 24_000)
    expectMoney(year.magi, 23_500)
    expectMoney(year.tax, 740)
    expectMoney(year.surplusInvested, 33_260)
    expectMoney(year.balances['cash']!, 133_260)
  })

  it('Plan E: first-year ACA credit uses recent MAGI and honors the cliff', () => {
    const below = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    below.accounts = [cashAccount('cash', 100_000)]
    below.assumptions.recentAnnualMagi = 50_000
    below.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }

    const belowResult = runPlan(below, noTax)

    // Independent worksheet:
    // Single FPL = 15,650; MAGI 50,000 = 319.49% FPL.
    // Applicable percentage is capped at 9.96%.
    // Expected contribution = 50,000 * 9.96% = 4,980.
    expectMoney(belowResult.years[0]!.expenses.healthcare, 4_980)
    expect(belowResult.warnings.some((w) => w.includes('ACA credit'))).toBe(false)

    const above = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    above.accounts = [cashAccount('cash', 100_000)]
    above.assumptions.recentAnnualMagi = 62_601
    above.expenses.healthcare = below.expenses.healthcare

    const aboveResult = runPlan(above, noTax)

    // 400% FPL = 15,650 * 4 = 62,600. One dollar over gets no credit.
    expectMoney(aboveResult.years[0]!.expenses.healthcare, 12_000)
    expect(aboveResult.warnings.some((w) => w.includes('ACA credit'))).toBe(true)
  })

  it('Plan F: RMD and QCD separate distribution from taxable income', () => {
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 73 })
    plan.accounts = [traditionalAccount('ira', 265_000)]
    plan.strategies.qcdAnnual = 5_000

    const result = runPlan(plan, federal)
    const year = result.years[0]!

    // Independent worksheet:
    // Born 1953 starts RMDs at 73. Uniform divisor at 73 = 26.5.
    // RMD = 265,000 / 26.5 = 10,000.
    // QCD = 5,000, so taxable ordinary income from the RMD is 5,000.
    // Age-65+ standard/senior deductions exceed 5,000, so tax is 0.
    expectMoney(year.rmd, 10_000)
    expectMoney(year.qcd, 5_000)
    expectMoney(year.withdrawals.traditional, 10_000)
    expectMoney(year.magi, 5_000)
    expectMoney(year.tax, 0)
    expectMoney(year.balances['ira']!, 255_000)
  })

  it('Plan G: survivor year uses survivor Social Security, pension survivor pay, and single tax brackets', () => {
    const plan = couplePlan({
      p1Dob: '1962-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 95,
      p2PlanningAge: 75,
      state: 'FL',
    })
    plan.accounts = [
      cashAccount('cash', 100_000),
      {
        type: 'pension',
        id: 'pension',
        name: 'High earner pension',
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        startAge: 65,
        monthlyAmount: 4_000,
        colaPct: 0,
        survivorPct: 50,
      },
    ]
    plan.incomes = [
      socialSecurityIncome('low-ss', 1_000, 67),
      socialSecurityIncome('high-ss', 3_000, 67, 'p2'),
    ]

    const result = runPlan(plan, federal)
    const bothAlive = result.years.find((y) => y.year === 2035)!
    const survivorYear = result.years.find((y) => y.year === 2036)!

    // Independent worksheet, 2035:
    // Federal tax uses the 2026 stand-in pack because no 2035 pack exists.
    // The OBBBA senior deduction is absent because it expires after 2028.
    // Both spouses are alive. Low earner's own SS is 12,000, but the spousal
    // benefit is 50% * 3,000 * 12 = 18,000, i.e. a 6,000 top-up over the low
    // earner's own benefit. High earner receives 36,000.
    // Pension pays 4,000 * 12 = 48,000. Provisional income = 48,000 + 27,000.
    // Taxable SS (MFJ) = 0.85 * (75,000 - 44,000) + 6,000 = 32,350.
    // AGI = 80,350. Deduction = 32,200 + 2 * 1,650 = 35,500.
    // Taxable income = 44,850; tax = 2,480 + 12% * 20,050 = 4,886.
    expect(bothAlive.people).toEqual([
      { personId: 'p1', ageAttained: 73, alive: true },
      { personId: 'p2', ageAttained: 75, alive: true },
    ])
    expectMoney(bothAlive.incomes.socialSecurity, 54_000)
    expectMoney(bothAlive.incomes.pension, 48_000)
    expectMoney(bothAlive.magi, 80_350)
    expectMoney(bothAlive.tax, 4_886)

    // Independent worksheet, 2036:
    // Federal tax still uses the 2026 stand-in pack; senior deduction is expired.
    // High earner is no longer alive. Low earner steps up to the deceased
    // spouse's 36,000 survivor benefit and receives 50% pension survivor pay.
    // Provisional income = 24,000 + 18,000 = 42,000.
    // Taxable SS (single) = 0.85 * (42,000 - 34,000) + 4,500 = 11,300.
    // AGI = 35,300. Deduction = 16,100 + 2,050 = 18,150.
    // Taxable income = 17,150; tax = 1,240 + 12% * 4,750 = 1,810.
    expect(survivorYear.people).toEqual([
      { personId: 'p1', ageAttained: 74, alive: true },
      { personId: 'p2', ageAttained: 76, alive: false },
    ])
    expectMoney(survivorYear.incomes.socialSecurity, 36_000)
    expectMoney(survivorYear.incomes.pension, 24_000)
    expectMoney(survivorYear.magi, 35_300)
    expectMoney(survivorYear.tax, 1_810)
  })

  it('Plan H: state relocation switches state tax by calendar year', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 61, state: 'FL' })
    plan.household.stateMoves = [{ fromYear: 2027, fromMonth: 1, state: 'KY' }]
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.incomes = [recurringOrdinaryIncome('consulting', 100_000, 2026)]

    const result = runPlan(plan, productionTaxCalculator())
    const beforeMove = result.years[0]!
    const afterMove = result.years[1]!

    // Independent worksheet:
    // Federal tax is identical in both years:
    // 100,000 - 16,100 standard deduction = 83,900 taxable.
    // Tax = 1,240 + 12% * 38,000 + 22% * 33,500 = 13,170.
    // FL has no income tax. KY taxes 100,000 - 3,360 standard deduction
    // at 3.5%, so KY adds 3,382.40 in the move year.
    expectMoney(beforeMove.tax, 13_170)
    expectMoney(afterMove.tax, 16_552.4)
    expectMoney(afterMove.tax - beforeMove.tax, 3_382.4)
  })
})
