/**
 * Stage 2 portfolio-funding, loan-proceeds, and post-solve source lines.
 *
 * Stage 5 identities close for these fixtures: uses and transfers have
 * landed, and post-solve deposits are excluded from both cash sides.
 */
import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import { parsePlan, type Account, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  taxableAccount,
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
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
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
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
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
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
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
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
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
    expect(y2027.cashFlow!.reconciliation.status).toBe('reconciled')
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
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('emits ordinaryIncome character on an equity-compensation retirement-action withdrawal', () => {
    // Independent worksheet, year 2026, 0% tax, $0 spending:
    //   vested equity compensation 10,000, ordinary-withdrawal action 10,000.
    //   Executor publishes a $10,000 ordinaryIncome segment; cash is 10,000
    //   with that non-cash character attached (not a second money line).
    const parsed = parseRetirementActionRequest({
      actionId: 'equity-income',
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: START_YEAR,
      executionDate: '2026-06-15',
      executionSequence: 1,
      requestedAmount: 10_000_00,
      allocations: [{
        allocationId: 'allocation-equity-income',
        sourceAccountId: 'equity',
        requestedAmount: 10_000_00,
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    })
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 60 })
    plan.accounts = [
      cashAccount('cash-1', 0),
      {
        type: 'equityComp',
        id: 'equity',
        name: 'equity',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: 10_000,
        costBasis: 0,
        annualContribution: 0,
        vestingMode: 'final',
        vestDate: null,
      },
    ]
    plan.strategies.retirementActions = [parsed.request]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = sourceById(
      y2026,
      'source:retirementActionWithdrawal:equity-income:allocation-equity-income',
    )
    expect(line.kind).toBe('retirementActionWithdrawal')
    expect(line.role).toBe('portfolioFunding')
    expectMoney(line.amountPlanDollars, 10_000)
    expect(line.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 10_000 },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('attaches ordinaryIncome to inherited traditional forced lines and none to Roth', () => {
    // Independent worksheet / simulate.inheritedRegimeExecution R1 + K1 oracles:
    //   Traditional: owner death 2022 on/after RBD, beneficiary born 1965-06-15.
    //     2026 divisor 25.9 (beneficiary-fixed Single Life). Forced = 300,000 / 25.9
    //     and carries ordinary character equal to the forced cash.
    //   Roth: owner death 2016 (always before RBD), 2026 is the year-ten sweep
    //     of 100,000. Roth forced carries no ordinary character.
    const plan = singlePersonPlan({ dob: '1965-06-15', planningAge: 100, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 1_000_000),
      {
        type: 'traditional',
        id: 'inherited-trad',
        name: 'Inherited IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 300_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2022,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'none',
            beneficiaryBirthYear: 1965,
            soleBeneficiary: true,
            ownerBirthYear: 1940,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
      {
        type: 'roth',
        id: 'inherited-roth',
        name: 'Inherited Roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2016,
          decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'none',
            beneficiaryBirthYear: 1965,
            soleBeneficiary: true,
            ownerBirthYear: 1940,
            roth5YearStartYear: 2010,
            provenance: { source: 'test', asOf: '2026-01-01' },
          },
        },
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
    const traditionalForced = 300_000 / 25.9

    const traditional = sourceById(y2026, 'source:inheritedAccountDistribution:inherited-trad')
    expect(traditional.kind).toBe('inheritedAccountDistribution')
    expectMoney(traditional.amountPlanDollars, traditionalForced)
    expect(traditional.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: traditional.amountPlanDollars },
    ])

    const roth = sourceById(y2026, 'source:inheritedAccountDistribution:inherited-roth')
    expectMoney(roth.amountPlanDollars, 100_000)
    expect(roth.taxCharacter).toBeUndefined()
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('attaches ordinaryIncome to a nonqualified capByMedicalExpenses HSA withdrawal', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, p1 attained 60:
    //   HSA 100,000, withdrawalTreatment capByMedicalExpenses.
    //   No modeled qualified medical (premiums 0, no care event) → cap 0.
    //   Lifestyle 10,000. Pre-65 HSA excess penalty 20%.
    //   Closed form W = 10,000 + 0.2W → W = 12,500 ordinary; penalty 2,500.
    //   Every withdrawn dollar is nonqualified, so ordinary character equals
    //   the HSA source amount (the penalty fixed-point may sit a few
    //   thousandths above the closed form).
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.expenses.baseAnnual = 10_000
    plan.accounts = [
      {
        type: 'hsa',
        id: 'hsa-1',
        name: 'HSA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: 100_000,
        annualContribution: 0,
        withdrawalTreatment: 'capByMedicalExpenses',
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = sourceById(y2026, 'source:needBasedPortfolioWithdrawal:hsa-1')
    expect(line.kind).toBe('needBasedPortfolioWithdrawal')
    expectMoney(line.amountPlanDollars, 12_500)
    expect(line.taxCharacter).toHaveLength(1)
    expect(line.taxCharacter![0]!.kind).toBe('ordinaryIncome')
    expect(line.taxCharacter![0]!.amountPlanDollars).toBe(line.amountPlanDollars)
    expectMoney(y2026.penalties, 2_500)
  })

  it('attaches ordinaryIncome on a pre-60 designated-Roth need-based withdrawal that reaches earnings', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, p1 attained 50:
    //   employer Roth 100,000, contributionBasis 0 → the whole draw is earnings.
    //   Lifestyle 9,000. Pre-59½ earnings ordinary + 10% penalty.
    //   Closed form W = 9,000 + 0.1W → W = 10,000; penalty 1,000.
    //   Designated-Roth pools are per account (`roth:`), so ordinary sits on
    //   the need-based line, not the owned-Roth-IRA pool metadata row.
    const plan = singlePersonPlan({ dob: '1976-01-01', planningAge: 60, retirementAge: 50 })
    plan.expenses.baseAnnual = 9_000
    plan.accounts = [
      {
        type: 'roth',
        id: 'roth-401k',
        name: 'Roth 401k',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'employer',
        balance: 100_000,
        annualContribution: 0,
        contributionBasis: 0,
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = sourceById(y2026, 'source:needBasedPortfolioWithdrawal:roth-401k')
    expect(line.kind).toBe('needBasedPortfolioWithdrawal')
    expectMoney(line.amountPlanDollars, 10_000)
    expect(line.taxCharacter).toHaveLength(1)
    expect(line.taxCharacter![0]!.kind).toBe('ordinaryIncome')
    expect(line.taxCharacter![0]!.amountPlanDollars).toBe(line.amountPlanDollars)
    expect(y2026.cashFlow!.taxCharacterMetadata.some(
      (row) => row.id === 'metadata:ordinaryIncome:rothPool:p1',
    )).toBe(false)
    expectMoney(y2026.penalties, 1_000)
  })

  it('attaches recovered cost basis as returnOfBasis alongside gain on a taxable need-based withdrawal', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, p1 attained 60:
    //   taxable 100,000, cost basis 40,000, sequential, lifestyle 20,000.
    //   Sale proceeds 20,000. Sold fraction 20,000 / 100,000 = 0.2.
    //   recoveredCostBasis = 0.2 × 40,000 = 8,000.
    //   realizedCapitalGainOrLoss = 20,000 − 8,000 = 12,000.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 20_000
    plan.accounts = [taxableAccount('brokerage-1', 100_000, 40_000)]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const line = sourceById(y2026, 'source:needBasedPortfolioWithdrawal:brokerage-1')
    expect(line.kind).toBe('needBasedPortfolioWithdrawal')
    expectMoney(line.amountPlanDollars, 20_000)
    expect(line.taxCharacter).toEqual([
      { kind: 'capitalGain', amountPlanDollars: 12_000 },
      { kind: 'returnOfBasis', amountPlanDollars: 8_000 },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('carries both recipient and funding-owner person references on a cross-spouse funded annuity', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax:
    //   p1 owns the traditional IRA that funded the qualified contract.
    //   p2 owns the annuity (recipient while alive). Pre-start purchase so
    //   the 2026 year is a payment year, not a purchase year.
    //   monthlyAmount 1,000 × 12, cola 0, startAge 60, attained 60 → paid 12,000.
    const plan = couplePlan({
      p1Dob: '1966-01-01',
      p2Dob: '1966-01-01',
      p1PlanningAge: 70,
      p2PlanningAge: 70,
    })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-p1', 10_000, 'p1', 'ira'),
      {
        type: 'annuity',
        id: 'ann-1',
        name: 'SPIA',
        ownerPersonId: 'p2',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 1_000,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2021,
          premium: 50_000,
          fundingAccountId: 'ira-p1',
          taxQualification: 'qualified',
        },
      },
    ]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
    const payment = sourceById(y2026, 'source:annuityPayment:ann-1')
    expect(payment.kind).toBe('annuityPayment')
    expectMoney(payment.amountPlanDollars, 12_000)
    expect(payment.identities).toEqual([
      { entityKind: 'annuityContract', annuityAccountId: 'ann-1' },
      { entityKind: 'account', accountId: 'ann-1' },
      { entityKind: 'person', personId: 'p2' },
      { entityKind: 'person', personId: 'p1' },
    ])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
