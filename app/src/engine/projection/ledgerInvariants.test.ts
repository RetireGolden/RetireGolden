import { describe, expect, it } from 'vitest'

import { createFederalTaxCalculator } from '../tax/federalTax'
import { createFlatTaxCalculator } from './flatTax'
import { expectMoney } from '../../testSupport/money'
import {
  cashAccount,
  couplePlan,
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
  traditionalAccount,
} from '../../testSupport/planFixtures'
import type { ProjectionResult } from './types'

function expectYearSums(result: ProjectionResult): void {
  for (const y of result.years) {
    expectMoney(
      y.incomes.total,
      y.incomes.wages +
        y.incomes.socialSecurity +
        y.incomes.pension +
        y.incomes.annuity +
        y.incomes.tipsLadder +
        y.incomes.recurring +
        y.incomes.oneTime,
    )
    expectMoney(
      y.expenses.total,
      y.expenses.baseSpending +
        y.expenses.oneTimeGoals +
        y.expenses.debtService +
        y.expenses.propertyCosts +
        y.expenses.healthcare +
        y.expenses.insurancePremiums +
        y.expenses.careCost -
        y.expenses.ltcBenefit,
    )
    expectMoney(
      y.withdrawals.total,
      y.withdrawals.cash + y.withdrawals.taxable + y.withdrawals.traditional + y.withdrawals.roth + y.withdrawals.hsa,
    )
  }
}

function expectNoNegativeBalances(result: ProjectionResult): void {
  for (const y of result.years) {
    for (const [id, balance] of Object.entries(y.balances)) {
      expect(balance, `${y.year} ${id}`).toBeGreaterThanOrEqual(-0.01)
    }
    expect(y.investableTotal).toBeGreaterThanOrEqual(-0.01)
    expect(y.netWorth).toBeGreaterThanOrEqual(-0.01)
  }
}

function expectInvestableEqualsAccountBalances(result: ProjectionResult): void {
  for (const y of result.years) {
    const balanceSum = Object.values(y.balances).reduce((sum, balance) => sum + balance, 0)
    expectMoney(y.investableTotal, balanceSum)
  }
}

describe('ledger invariants', () => {
  it('keeps yearly component totals equal to their reported totals', () => {
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 64 })
    plan.accounts = [
      cashAccount('cash', 25_000),
      taxableAccount('taxable', 80_000, 50_000),
      traditionalAccount('ira', 150_000),
    ]
    plan.incomes = [recurringOrdinaryIncome('consulting', 30_000, 2026)]
    plan.expenses.baseAnnual = 45_000
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Car', year: 2027, amount: 10_000 }]

    const result = runPlan(plan, createFederalTaxCalculator())

    expectYearSums(result)
    expectInvestableEqualsAccountBalances(result)
  })

  it('does not report negative account balances in ordinary depletion cases', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    plan.accounts = [
      cashAccount('cash', 10_000),
      taxableAccount('taxable', 20_000, 15_000),
      traditionalAccount('ira', 30_000),
    ]
    plan.expenses.baseAnnual = 40_000

    const result = runPlan(plan, createFlatTaxCalculator(0))

    expectNoNegativeBalances(result)
    expect(result.depletionYear).toBe(2027)
  })

  it('includes unassigned surplus cash in investable totals when no account can receive it', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.incomes = [recurringOrdinaryIncome('consulting', 10_000, 2026)]

    const result = runPlan(plan, createFlatTaxCalculator(0))
    const year = result.years[0]!

    // Independent reasoning: with no accounts and no spending/tax, the $10,000
    // income has nowhere to be assigned but remains investable household cash.
    expect(Object.values(year.balances).reduce((sum, balance) => sum + balance, 0)).toBe(0)
    expectMoney(year.surplusInvested, 10_000)
    expectMoney(year.investableTotal, 10_000)
    expectMoney(result.endingInvestable, 10_000)
  })

  it('is deterministic for repeated runs of the same validated plan', () => {
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 65 })
    plan.accounts = [cashAccount('cash', 40_000), taxableAccount('taxable', 120_000, 90_000), traditionalAccount('ira', 200_000)]
    plan.incomes = [recurringOrdinaryIncome('pension', 25_000, 2026)]
    plan.expenses.baseAnnual = 50_000

    const first = runPlan(plan, createFederalTaxCalculator())
    const second = runPlan(plan, createFederalTaxCalculator())

    expect(second).toEqual(first)
  })

  it('adding a zero-premium ACA setting is a no-op for the annual ledger', () => {
    const base = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    base.accounts = [cashAccount('cash', 50_000)]
    base.incomes = [recurringOrdinaryIncome('consulting', 10_000, 2026)]
    base.expenses.baseAnnual = 5_000

    const withNoOpAca = singlePersonPlan({ dob: '1964-01-01', planningAge: 62 })
    withNoOpAca.accounts = [cashAccount('cash', 50_000)]
    withNoOpAca.incomes = [recurringOrdinaryIncome('consulting', 10_000, 2026)]
    withNoOpAca.expenses.baseAnnual = 5_000
    withNoOpAca.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }

    expect(runPlan(withNoOpAca, createFlatTaxCalculator(0))).toEqual(runPlan(base, createFlatTaxCalculator(0)))
  })

  it('higher spending does not improve ending investable assets when all else is equal', () => {
    const lowerSpend = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    lowerSpend.accounts = [cashAccount('cash', 200_000)]
    lowerSpend.expenses.baseAnnual = 20_000

    const higherSpend = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    higherSpend.accounts = [cashAccount('cash', 200_000)]
    higherSpend.expenses.baseAnnual = 30_000

    const low = runPlan(lowerSpend, createFlatTaxCalculator(0))
    const high = runPlan(higherSpend, createFlatTaxCalculator(0))

    // Independent reasoning: same 3-year horizon, zero growth/inflation/tax.
    // Spending is 10,000 higher per year, so ending investable is 30,000 lower.
    expectMoney(low.endingInvestable - high.endingInvestable, 30_000)
  })

  it('higher flat tax cannot improve ending investable assets in a simple plan', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.incomes = [recurringOrdinaryIncome('consulting', 50_000, 2026)]

    const noTax = runPlan(plan, createFlatTaxCalculator(0))
    const tenPercentTax = runPlan(plan, createFlatTaxCalculator(10))

    // Independent reasoning: same 3-year horizon, $50,000 income per year.
    // A 10% flat tax costs $5,000 per year, so ending investable is $15,000 lower.
    expectMoney(noTax.endingInvestable - tenPercentTax.endingInvestable, 15_000)
  })

  it('earlier death does not increase future household income from survivor-sensitive streams', () => {
    const earlierDeath = couplePlan({
      p1Dob: '1962-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 95,
      p2PlanningAge: 75,
      state: 'FL',
    })
    earlierDeath.accounts = [
      {
        type: 'pension',
        id: 'pension',
        name: 'Pension',
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        startAge: 65,
        monthlyAmount: 4_000,
        colaPct: 0,
        survivorPct: 50,
      },
    ]
    earlierDeath.incomes = [socialSecurityIncome('low-ss', 1_000, 67), socialSecurityIncome('high-ss', 3_000, 67, 'p2')]

    const laterDeath = couplePlan({
      p1Dob: '1962-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 95,
      p2PlanningAge: 80,
      state: 'FL',
    })
    laterDeath.accounts = earlierDeath.accounts
    laterDeath.incomes = earlierDeath.incomes

    const earlier2036 = runPlan(earlierDeath, createFlatTaxCalculator(0)).years.find((y) => y.year === 2036)!
    const later2036 = runPlan(laterDeath, createFlatTaxCalculator(0)).years.find((y) => y.year === 2036)!

    expect(earlier2036.incomes.socialSecurity).toBeLessThanOrEqual(later2036.incomes.socialSecurity)
    expect(earlier2036.incomes.pension).toBeLessThanOrEqual(later2036.incomes.pension)
  })

  it('with zero returns and inflation, balances move only by explicit cash flows', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62 })
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.incomes = [recurringOrdinaryIncome('consulting', 20_000, 2026)]
    plan.expenses.baseAnnual = 15_000
    plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Roof', year: 2027, amount: 5_000 }]

    const result = runPlan(plan, createFlatTaxCalculator(0))

    // 2026: +20,000 income -15,000 spending = +5,000.
    // 2027: +20,000 income -15,000 spending -5,000 goal = 0.
    // 2028: +20,000 income -15,000 spending = +5,000.
    expectMoney(result.years[0]!.balances['cash']!, 105_000)
    expectMoney(result.years[1]!.balances['cash']!, 105_000)
    expectMoney(result.years[2]!.balances['cash']!, 110_000)
    expectMoney(result.endingInvestable, 110_000)
  })
})
