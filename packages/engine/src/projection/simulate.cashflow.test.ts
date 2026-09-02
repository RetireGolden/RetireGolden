import { describe, expect, it } from 'vitest'

import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  noTax,
  taxable,
  testIds,
  traditional,
  validate,
} from './simulate.test-support.js'

describe('spending, withdrawals, and depletion', () => {
  it('drains cash before taxable before traditional before roth', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 60_000, annualContribution: 0 },
      traditional(60_000),
      taxable(60_000, 60_000),
      cash(60_000),
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBe(50_000)
    expect(y1.withdrawals.taxable).toBe(0)

    const y2 = result.years[1]!
    expect(y2.withdrawals.cash).toBe(10_000)
    expect(y2.withdrawals.taxable).toBe(40_000)

    const y3 = result.years[2]!
    expect(y3.withdrawals.taxable).toBe(20_000)
    expect(y3.withdrawals.traditional).toBe(30_000)

    const y4 = result.years[3]!
    expect(y4.withdrawals.traditional).toBe(30_000)
    expect(y4.withdrawals.roth).toBe(20_000)
  })

  it('keeps cliff-vesting equity compensation out of withdrawals until the vest year', () => {
    const plan = basePlan()
    plan.assumptions.defaultReturnPct = 0
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [
      { type: 'equityComp', id: 'rsu1', name: 'RSUs', ownerPersonId: 'p1', annualReturnPct: 0, balance: 100_000, costBasis: 70_000, annualContribution: 0, vestingMode: 'cliff', vestDate: '2028-03-15' },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.withdrawals.taxable).toBe(0)
    expect(result.years[0]!.shortfall).toBe(50_000)
    expect(result.years[0]!.netWorth).toBe(100_000)
    expect(result.years.find((y) => y.year === 2028)!.withdrawals.taxable).toBe(50_000)
  })

  it('treats final equity compensation as taxable brokerage for gains', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      { type: 'equityComp', id: 'espp1', name: 'ESPP', ownerPersonId: 'p1', annualReturnPct: null, balance: 100_000, costBasis: 25_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.withdrawals.taxable).toBe(40_000)
    expect(result.years[0]!.realizedGains).toBeCloseTo(30_000, 6)
  })

  it('realizes gains via the basis ratio on taxable withdrawals', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [taxable(100_000, 25_000)] // 75% of every dollar is gain
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.taxable).toBe(40_000)
    expect(y1.realizedGains).toBeCloseTo(30_000, 6)
  })

  it('realizes a signed loss and exhausts basis on a full taxable withdrawal', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [taxable(100_000, 200_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
    })

    expect(result.years[0]!.withdrawals.taxable).toBe(100_000)
    expect(result.years[0]!.realizedGains).toBe(-100_000)
    expect(result.years[0]!.balances[plan.accounts[0]!.id]).toBe(0)
  })

  it('records the first shortfall year as depletion', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [cash(250_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.depletionYear).toBe(2028) // 100k×2 covered, third year partial
    const depletion = result.years.find((y) => y.year === 2028)!
    expect(depletion.shortfall).toBeCloseTo(50_000, 6)
    expect(result.endingInvestable).toBe(0)
  })

  it('applies spending phases on the primary age axis', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.expenses.phases = [
      { fromAge: 75, multiplier: 0.8 },
      { fromAge: 85, multiplier: 0.6 },
    ]
    plan.accounts = [cash(10_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2040)!.expenses.baseSpending).toBe(100_000) // age 74
    expect(result.years.find((y) => y.year === 2041)!.expenses.baseSpending).toBe(80_000) // age 75
    expect(result.years.find((y) => y.year === 2051)!.expenses.baseSpending).toBe(60_000) // age 85
  })

  it('inflates base spending and goals', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 3
    plan.expenses.baseAnnual = 100_000
    plan.expenses.oneTimeGoals = [{ id: testIds(), label: 'New roof', year: 2028, amount: 30_000 }]
    plan.accounts = [cash(10_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(y2028.expenses.baseSpending).toBeCloseTo(100_000 * 1.03 ** 2, 4)
    expect(y2028.expenses.oneTimeGoals).toBeCloseTo(30_000 * 1.03 ** 2, 4)
  })
})
describe('withdrawal strategies', () => {
  it('proportional draws pro-rata across cash, taxable, and traditional', () => {
    const plan = basePlan() // age 60: no early-withdrawal penalty at >= 60
    plan.expenses.baseAnnual = 40_000
    plan.strategies.withdrawalOrder = { mode: 'proportional' }
    plan.accounts = [cash(100_000), taxable(100_000, 100_000), traditional(200_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBeCloseTo(10_000, 4)
    expect(y1.withdrawals.taxable).toBeCloseTo(10_000, 4)
    expect(y1.withdrawals.traditional).toBeCloseTo(20_000, 4)
    expect(y1.withdrawals.total).toBeCloseTo(40_000, 4)
    expect(y1.shortfall).toBe(0)
  })

  it('proportional drains the whole pool and reports the shortfall when insufficient', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 250_000
    plan.strategies.withdrawalOrder = { mode: 'proportional' }
    plan.accounts = [cash(10_000), traditional(190_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.withdrawals.cash).toBeCloseTo(10_000, 2)
    expect(y1.withdrawals.traditional).toBeCloseTo(190_000, 2)
    expect(y1.shortfall).toBeCloseTo(50_000, 2)
    expect(result.depletionYear).toBe(2026)
  })

  it('bracket-targeted fills traditional to the bracket top, remainder from taxable', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null } // 66
    plan.expenses.baseAnnual = 90_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 12 }
    plan.accounts = [traditional(1_000_000), taxable(500_000, 500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // Headroom: deductions 24,150 + 50,400 bracket top = 74,550 from traditional.
    expect(y1.withdrawals.traditional).toBeCloseTo(74_550, 0)
    expect(y1.magi).toBeCloseTo(74_550, 0)
    // Remainder (spending + Part B + tax − traditional) from taxable, gains-free here.
    expect(y1.withdrawals.taxable).toBeCloseTo(90_000 + y1.expenses.healthcare + y1.tax - 74_550, 0)
    expect(y1.tax).toBeCloseTo(5_800, 0) // brackets on exactly 50,400
    expect(y1.shortfall).toBe(0)
  })

  it('bracket-targeted uses available equity compensation before returning to traditional', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null }
    plan.expenses.baseAnnual = 100_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 10 }
    plan.accounts = [
      traditional(1_000_000),
      { type: 'equityComp', id: 'rsu1', name: 'RSUs', ownerPersonId: 'p1', annualReturnPct: 0, balance: 80_000, costBasis: 80_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    expect(y1.withdrawals.traditional).toBeGreaterThan(0)
    expect(y1.withdrawals.taxable).toBeGreaterThan(0)
    expect(y1.withdrawals.taxable).toBeLessThanOrEqual(80_000)
    expect(y1.shortfall).toBe(0)
  })

  it('bracket-targeted leaves traditional for last once the bracket is full', () => {
    const plan = basePlan()
    plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null }
    plan.expenses.baseAnnual = 120_000
    plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 12 }
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Pension-like', annualAmount: 100_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    plan.accounts = [traditional(1_000_000), cash(500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // 100k ordinary income already exceeds the 12% top: no traditional draws.
    expect(y1.withdrawals.traditional).toBe(0)
    expect(y1.withdrawals.cash).toBeGreaterThan(0)
  })

  it('bracket-targeted caps traditional lower when exempt interest raises taxable Social Security', () => {
    const make = (withExemptYield: boolean) => {
      const plan = basePlan()
      plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1960-06-15', retirementAge: null } // 66
      plan.expenses.baseAnnual = 90_000
      plan.strategies.withdrawalOrder = { mode: 'bracketTargeted', bracketPct: 10 }
      plan.incomes = [
        {
          type: 'socialSecurity',
          id: testIds(),
          personId: 'p1',
          // ~$40k/yr at 66y0m (8 months before FRA 66y8m for 1960 birth).
          piaMonthly: 3_489,
          earnings: null,
          claimAge: { years: 66, months: 0 },
        },
      ]
      plan.accounts = [
        traditional(1_000_000),
        withExemptYield
          ? { ...taxable(100_000, 100_000), taxExemptInterestYieldPct: 8, reinvestDividends: true }
          : taxable(100_000, 100_000),
      ]
      return plan
    }
    const sim = (withExemptYield: boolean) =>
      simulatePlan(validate(make(withExemptYield)), {
        startYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }).years[0]!
    const withoutYield = sim(false)
    const withYield = sim(true)
    // At the 10% top, ordinary income ≈ 12,400 taxable + deductions ≈ mid-30k;
    // provisional ≈ ordinary + 20,000 (half of SS) ≈ 55k without exempt interest;
    // saturation ≈ 68,700, so the band has room. +8,000 exempt interest raises
    // taxable SS by ~0.85 × 8,000 = 6,800 and the traditional cap falls by
    // roughly 6,800/1.85 ≈ 3,700.
    expect(withYield.incomes.taxExemptInterest).toBeCloseTo(8_000, 0)
    expect(withYield.withdrawals.traditional).toBeLessThan(withoutYield.withdrawals.traditional)
    const capDelta = withoutYield.withdrawals.traditional - withYield.withdrawals.traditional
    expect(capDelta).toBeGreaterThan(2_000)
    expect(capDelta).toBeLessThan(6_000)
  })
})

describe('taxable brokerage yield tax drag', () => {
  it('taxes annual qualified dividends and makes same-return taxable growth more conservative', () => {
    const dividendPlan = basePlan()
    dividendPlan.accounts = [
      {
        ...taxable(1_000_000, 1_000_000),
        annualReturnPct: 7,
        dividendYieldPct: 10,
        qualifiedRatio: 1,
        reinvestDividends: true,
      },
    ]

    const noYieldPlan = basePlan()
    noYieldPlan.accounts = [{ ...taxable(1_000_000, 1_000_000), annualReturnPct: 7 }]

    const withYield = simulatePlan(validate(dividendPlan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() }).years[0]!
    const withoutYield = simulatePlan(validate(noYieldPlan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() }).years[0]!

    expect(withYield.incomes.qualifiedDividends).toBeCloseTo(100_000, 6)
    expect(withYield.taxableYield).toBeCloseTo(100_000, 6)
    expect(withYield.tax).toBeGreaterThan(withoutYield.tax)
    expect(withYield.magi).toBeGreaterThan(99_000)
    expect(withYield.investableTotal).toBeLessThan(withoutYield.investableTotal)
  })

  it('adds reinvested dividends to basis before future taxable withdrawals', () => {
    const plan = basePlan()
    plan.household.people[0]!.longevity.planningAge = 61
    plan.accounts = [
      {
        ...taxable(1_000_000, 1_000_000),
        annualReturnPct: 10,
        dividendYieldPct: 10,
        qualifiedRatio: 1,
        reinvestDividends: true,
      },
    ]
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend', year: 2027, amount: 50_000 }]

    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.years.find((y) => y.year === 2026)!.balances[plan.accounts[0]!.id]).toBeCloseTo(1_100_000, 6)
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.withdrawals.taxable).toBeCloseTo(50_000, 6)
    expect(y2027.realizedGains).toBeCloseTo(0, 6)
  })
})
