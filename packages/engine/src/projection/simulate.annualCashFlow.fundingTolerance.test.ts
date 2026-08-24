/**
 * Independent worksheet for the funding fixed-point/cash-identity boundary.
 * The test exercises the real simulate -> capture path; it does not call the
 * reconciliation helper directly.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account } from '../model/plan.js'
import { cashAccount, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS,
  CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS,
} from './annualCashFlowCapture.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026

function rothIra(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

describe('annual cash-flow funding tolerance', () => {
  it('publishes the accepted funding-root residual for a taxed Roth-conversion year', () => {
    // Independent worksheet, year 2026, 0% inflation/growth:
    //   manual Roth conversion C = $10,000 (transfer, not household cash)
    //   required lifestyle E = $10,000
    //   flat ordinary-income tax rate r = 20%
    //   need-based traditional withdrawal W solves
    //     W = E + r(C + W), whose exact root is $15,000.
    // The bounded solver accepts |E + r(C + W) - W| <= $0.005. Published
    // cash difference is the opposite sign of that same worksheet residual:
    // household source W minus uses E + tax.
    const plan = singlePersonPlan({
      dob: '1966-01-01',
      planningAge: 60,
      retirementAge: null,
    })
    plan.assumptions.inflationPct = 0
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 100_000, 'p1', 'ira'),
      rothIra('roth-1'),
    ]
    plan.expenses.baseAnnual = 10_000
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [{ year: START_YEAR, amount: 10_000 }],
    }
    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    const year = simulatePlan(parsed.plan, {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: createFlatTaxCalculator(20),
      captureAnnualCashFlow: true,
    }).years[0]!
    const cashFlow = year.cashFlow
    if (cashFlow === undefined) throw new Error('missing captured cash flow')
    const needBasedWithdrawal = cashFlow.sourceLines.find(
      (line) => line.id === 'source:needBasedPortfolioWithdrawal:ira-1',
    )
    if (needBasedWithdrawal === undefined) throw new Error('missing need-based withdrawal')

    const worksheetTax = 0.2 * (10_000 + needBasedWithdrawal.amountPlanDollars)
    const worksheetFundingResidual =
      10_000 + worksheetTax - needBasedWithdrawal.amountPlanDollars

    expect(year.rothConversion).toBe(10_000)
    expect(year.tax).toBeCloseTo(worksheetTax, 10)
    expect(cashFlow.reconciliation.cash.differencePlanDollars)
      .toBeCloseTo(-worksheetFundingResidual, 10)
    expect(Math.abs(worksheetFundingResidual))
      .toBeGreaterThan(CASH_FLOW_RECONCILIATION_TOLERANCE_PLAN_DOLLARS)
    expect(Math.abs(worksheetFundingResidual))
      .toBeLessThanOrEqual(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)
    expect(cashFlow.reconciliation.cashIdentityTolerancePlanDollars)
      .toBe(CASH_FLOW_CASH_IDENTITY_TOLERANCE_PLAN_DOLLARS)
    expect(cashFlow.reconciliation.status).toBe('reconciled')
  })
})
