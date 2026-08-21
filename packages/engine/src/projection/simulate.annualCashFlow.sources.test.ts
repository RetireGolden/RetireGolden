/**
 * Stage 2 portfolio-funding, loan-proceeds, and post-solve source lines.
 *
 * Sources-without-uses years may be `notReconciled`. Assert identities and
 * amounts; never assert a lying `reconciled` status.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowSourceLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function run(plan: Plan, extra: { horizonEndYear?: number } = {}): YearResult[] {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
    ...extra,
  }).years
}

function yearOf(years: readonly YearResult[], calendarYear: number): YearResult {
  const year = years.find((row) => row.year === calendarYear)
  if (year === undefined) throw new Error(`missing year ${calendarYear}`)
  return year
}

function sourceById(year: YearResult, id: string): YearCashFlowSourceLine {
  const line = year.cashFlow?.sourceLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing source line ${id}`)
  return line
}

function home(opts: {
  id?: string
  value?: number
  plannedSaleYear?: number | null
  costBasis?: number
  expectedNetProceeds?: number | null
  hecm?: Extract<Account, { type: 'property' }>['hecm']
}): Account {
  return {
    type: 'property',
    id: opts.id ?? 'home-1',
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value: opts.value ?? 500_000,
    plannedSaleYear: opts.plannedSaleYear ?? null,
    expectedNetProceeds: opts.expectedNetProceeds ?? null,
    primaryResidence: true,
    ...(opts.costBasis !== undefined ? { costBasis: opts.costBasis } : {}),
    ...(opts.hecm ? { hecm: opts.hecm } : {}),
  }
}

describe('simulatePlan annual cash-flow portfolio and property sources', () => {
  it('publishes two owned-IRA RMD pool lines by personId, not per-account owned-IRA RMD', () => {
    // Independent worksheet, year 2026, 0% growth, 0% inflation, $0 tax:
    //   both born 1953-01-01 → attained 73. SECURE 2.0 start age 73.
    //   Uniform Lifetime divisor at 73 is 26.5 (Pub 590-B).
    //   p1 IRA opening 265,000 → RMD = 265,000 / 26.5 = 10,000.
    //   p2 IRA opening 132,500 → RMD = 132,500 / 26.5 = 5,000.
    //   QCD 0, so published net = gross. Employer-plan grammar must not appear.
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1953-01-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
      p1RetirementAge: null,
      p2RetirementAge: null,
    })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-p1', 265_000, 'p1', 'ira'),
      traditionalAccount('ira-p2', 132_500, 'p2', 'ira'),
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const p1 = sourceById(y2026, 'source:requiredMinimumDistribution:ownedIraPool:p1')
    expect(p1.kind).toBe('requiredMinimumDistribution')
    expect(p1.role).toBe('portfolioFunding')
    expectMoney(p1.amountPlanDollars, 10_000)
    expect(p1.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p1' },
    ])

    const p2 = sourceById(y2026, 'source:requiredMinimumDistribution:ownedIraPool:p2')
    expectMoney(p2.amountPlanDollars, 5_000)
    expect(p2.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p2' },
    ])

    expect(y2026.cashFlow!.sourceLines.some((line) =>
      line.id === 'source:requiredMinimumDistribution:account:ira-p1' ||
      line.id === 'source:requiredMinimumDistribution:account:ira-p2',
    )).toBe(false)
    expectMoney(y2026.rmd, 15_000)
    expect(y2026.cashFlow!.reconciliation.status).toBe('notReconciled')
  })

  it('publishes employer-plan RMD per account and gross, separate from the owned-IRA pool', () => {
    // Independent worksheet, year 2026, same 73 / 26.5 divisor:
    //   employer 401(k) 265,000 → RMD 10,000, grammar account:401k-p1.
    //   owned IRA 265,000 → RMD 10,000, grammar ownedIraPool:p1.
    //   QCD cannot divert the employer-plan line.
    const plan = singlePersonPlan({ dob: '1953-01-01', planningAge: 80, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('401k-p1', 265_000, 'p1', 'employer'),
      traditionalAccount('ira-p1', 265_000, 'p1', 'ira'),
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const employer = sourceById(y2026, 'source:requiredMinimumDistribution:account:401k-p1')
    expect(employer.kind).toBe('requiredMinimumDistribution')
    expect(employer.role).toBe('portfolioFunding')
    expectMoney(employer.amountPlanDollars, 10_000)
    expect(employer.identities).toEqual([
      { entityKind: 'account', accountId: '401k-p1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const owned = sourceById(y2026, 'source:requiredMinimumDistribution:ownedIraPool:p1')
    expectMoney(owned.amountPlanDollars, 10_000)
    expect(owned.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p1' },
    ])
    expectMoney(y2026.rmd, 20_000)
  })

  it('publishes exact-basis property sale as spendable proceeds, not a post-solve deposit', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   value 200,000, costBasis 200,000, sellingCostPct omitted → 0.
    //   salePrice = value × (1 + 0) = 200,000.
    //   netProceeds = 200,000. HECM payoff 0. Gain 0.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [
      cashAccount('cash-1', 0),
      home({ value: 200_000, costBasis: 200_000, plannedSaleYear: 2026 }),
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const sale = sourceById(y2026, 'source:propertySaleProceeds:home-1')
    expect(sale.kind).toBe('propertySaleProceeds')
    expect(sale.role).toBe('spendableSource')
    expectMoney(sale.amountPlanDollars, 200_000)
    expect(sale.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'legacyPropertySaleDeposit')).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('notReconciled')
  })

  it('publishes a legacy property sale as a post-solve deposit with the cash destination', () => {
    // Independent worksheet, year 2026:
    //   costBasis omitted → legacy path. expectedNetProceeds 150,000, no HECM.
    //   deposit lands on cash-1 (only cash/taxable destination, sorted by id).
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [
      cashAccount('cash-1', 0),
      home({ value: 200_000, plannedSaleYear: 2026, expectedNetProceeds: 150_000 }),
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const deposit = sourceById(y2026, 'source:legacyPropertySaleDeposit:home-1')
    expect(deposit.kind).toBe('legacyPropertySaleDeposit')
    expect(deposit.role).toBe('postSolveDeposit')
    expectMoney(deposit.amountPlanDollars, 150_000)
    expect(deposit.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])
    if (deposit.role !== 'postSolveDeposit') throw new Error('expected post-solve')
    expect(deposit.postSolveDestination).toEqual({ entityKind: 'account', accountId: 'cash-1' })
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'propertySaleProceeds')).toBe(false)
  })

  it('publishes a HECM last-resort draw as hecmBackstopDraw loan proceeds on the property', () => {
    // Independent worksheet from hecm.test.ts last-resort fixture:
    //   50,000 cash, 40,000 spending, 2% upfront of 500,000 financed.
    //   2026 covered (draw 0). 2027 short 30,000 → backstop draws 30,000.
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 85, retirementAge: 62 })
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cashAccount('cash-1', 50_000),
      home({
        hecm: { openYear: 2026, principalLimitPct: 40, growthRatePct: 7.5, upfrontCostPct: 2, drawPolicy: 'lastResort' },
      }),
    ]
    const years = run(plan)
    const y2026 = yearOf(years, 2026)
    const y2027 = yearOf(years, 2027)

    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'hecmBackstopDraw')).toBe(false)
    const backstop = sourceById(y2027, 'source:hecmBackstopDraw:home-1')
    expect(backstop.kind).toBe('hecmBackstopDraw')
    expect(backstop.role).toBe('loanProceeds')
    expectMoney(backstop.amountPlanDollars, 30_000)
    expect(backstop.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])
    expect(y2027.cashFlow!.sourceLines.some((line) => line.kind === 'hecmCoordinatedDraw')).toBe(false)
    expect(y2027.cashFlow!.reconciliation.status).toBe('notReconciled')
  })

  it('publishes an already-owned annuity payment with the living recipient', () => {
    // Independent worksheet, year 2026, owner alive, life-only (default):
    //   monthlyAmount 1,000 × 12, cola 0, startAge 60, attained 60 → paid 12,000.
    //   No purchase → nonqualifiedExcludable 0; recipient = owner p1.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.accounts = [
      cashAccount('cash-1', 0),
      {
        type: 'annuity',
        id: 'ann-1',
        name: 'SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 1_000,
        colaPct: 0,
        taxablePct: 100,
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
    const payment = sourceById(y2026, 'source:annuityPayment:ann-1')
    expect(payment.kind).toBe('annuityPayment')
    expect(payment.role).toBe('spendableSource')
    expectMoney(payment.amountPlanDollars, 12_000)
    expect(payment.identities).toEqual([
      { entityKind: 'annuityContract', annuityAccountId: 'ann-1' },
      { entityKind: 'account', accountId: 'ann-1' },
      { entityKind: 'person', personId: 'p1' },
    ])
  })
})
