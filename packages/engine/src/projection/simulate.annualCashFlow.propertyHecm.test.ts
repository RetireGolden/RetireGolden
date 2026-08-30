/**
 * Stage 5 property-sale, HECM, and death-benefit cash-flow fixtures.
 *
 * Exact-basis sale is a spendable source; the legacy path (costBasis omitted)
 * is a post-solve deposit with a destination. Coordinated and backstop HECM
 * draws are distinct kinds and IDs, and both may fire on one property in the
 * same year. Death benefit is post-solve `max(face, cashValue)`.
 *
 * Expected values are independent worksheets, never taken from running the
 * assembler.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type InsurancePolicy, type Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowSourceLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function run(
  plan: Plan,
  extra: { horizonEndYear?: number; taxCalculator?: ReturnType<typeof createFlatTaxCalculator>; market?: { returnShockPct: number[] } } = {},
): YearResult[] {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator: extra.taxCalculator ?? noTax,
    captureAnnualCashFlow: true,
    ...(extra.horizonEndYear !== undefined ? { horizonEndYear: extra.horizonEndYear } : {}),
    ...(extra.market !== undefined ? { market: extra.market } : {}),
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
  sellingCostPct?: number
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
    ...(opts.sellingCostPct !== undefined ? { sellingCostPct: opts.sellingCostPct } : {}),
    ...(opts.hecm ? { hecm: opts.hecm } : {}),
  }
}

function rothIra(id: string, balance: number): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function permLife(overrides: Partial<Extract<InsurancePolicy, { kind: 'permanentLife' }>> = {}): InsurancePolicy {
  return {
    kind: 'permanentLife',
    id: 'life-1',
    name: 'Whole life',
    insured: 'p1',
    beneficiary: 'estate',
    annualPremium: 0,
    premiumMode: 'lifetime',
    deathBenefit: 0,
    cashValue: 0,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 0,
    ...overrides,
  }
}

describe('simulatePlan annual cash-flow property, HECM, and death benefit', () => {
  it('publishes exact-basis property sale as spendable proceeds, not a post-solve deposit', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   value 200,000, costBasis 200,000, sellingCostPct omitted → 0.
    //   salePrice = value × (1 + 0) = 200,000.
    //   netProceeds = 200,000. HECM payoff 0. Gain 0.
    //   Exact path is spendable (enters baseCashInflows); legacy kind absent.
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
    //   Post-solve deposits are excluded from both cash-identity sides.
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

  it('publishes coordinated and backstop HECM as distinct kinds and IDs on the same property', () => {
    // Independent worksheet, 0% inflation, HECM open 2026, PL 40% of 500,000 = 200,000,
    // upfront 0, growth 0:
    //   p1 born 1964-01-01 → attained 62 in 2026 (HECM-eligible), 63 in 2027.
    //   2026: cash 40,000 covers spending 40,000. IRA 20,000 is not withdrawn.
    //     Market shock −50% on the IRA after withdrawals → realized return −50%.
    //     Coordinated does not fire (year === startYear). Backstop not needed.
    //   2027: prior-year return is negative, so coordinated is eligible.
    //     Manual Roth conversion of the remaining IRA 10,000 (20,000 × 0.5).
    //     Conversion is a transfer, not household cash. Flat tax 150% → tax = 15,000.
    //     Coordinated sizes to pre-tax need 40,000 (spending; cash inflows 0).
    //     Roth holds the converted 10,000 (basis; past 59½) and funds 10,000 of tax.
    //     Remaining tax 5,000 is withdrawalPlan.shortfall → backstop 5,000.
    //     hecmDraw = 40,000 + 5,000. Two kinds, two IDs, same propertyAccountId.
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 70, retirementAge: 62 })
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cashAccount('cash-1', 40_000),
      traditionalAccount('ira-1', 20_000, 'p1', 'ira'),
      rothIra('roth-1', 0),
      home({
        hecm: {
          openYear: 2026,
          principalLimitPct: 40,
          growthRatePct: 0,
          upfrontCostPct: 0,
          drawPolicy: 'coordinated',
        },
      }),
    ]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 10_000 }] }
    const years = run(plan, {
      horizonEndYear: 2027,
      taxCalculator: createFlatTaxCalculator(150),
      market: { returnShockPct: [-50, 0] },
    })
    const y2026 = yearOf(years, 2026)
    const y2027 = yearOf(years, 2027)

    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'hecmCoordinatedDraw')).toBe(false)
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'hecmBackstopDraw')).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')

    const coordinated = sourceById(y2027, 'source:hecmCoordinatedDraw:home-1')
    expect(coordinated.kind).toBe('hecmCoordinatedDraw')
    expect(coordinated.role).toBe('loanProceeds')
    expectMoney(coordinated.amountPlanDollars, 40_000)
    expect(coordinated.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])

    const backstop = sourceById(y2027, 'source:hecmBackstopDraw:home-1')
    expect(backstop.kind).toBe('hecmBackstopDraw')
    expect(backstop.role).toBe('loanProceeds')
    expectMoney(backstop.amountPlanDollars, 5_000)
    expect(backstop.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])
    expect(coordinated.id).not.toBe(backstop.id)
    expectMoney(y2027.hecmDraw, 45_000)
    expect(y2027.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a death benefit post-solve deposit of max(face, cashValue)', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   p1 born 1966-01-01, planningAge 60 → 2026 is the final alive / settlement year.
    //   face 50,000, cashValue 100,000, growth 0 → payout = max(50,000, 100,000) = 100,000.
    //   Cash value is zeroed; the deposit is post-solve (did not fund the year)
    //   and lands on cash-1 (stable cash-first destination).
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [cashAccount('cash-1', 0)]
    plan.insurance = [permLife({ deathBenefit: 50_000, cashValue: 100_000, cashValueGrowthPct: 0 })]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const benefit = sourceById(y2026, 'source:lifeInsuranceDeathBenefit:life-1')
    expect(benefit.kind).toBe('lifeInsuranceDeathBenefit')
    expect(benefit.role).toBe('postSolveDeposit')
    expectMoney(benefit.amountPlanDollars, 100_000)
    expect(benefit.identities).toEqual([
      { entityKind: 'insurancePolicy', policyId: 'life-1' },
      { entityKind: 'person', personId: 'p1' },
    ])
    if (benefit.role !== 'postSolveDeposit') throw new Error('expected post-solve')
    expect(benefit.postSolveDestination).toEqual({ entityKind: 'account', accountId: 'cash-1' })
    expectMoney(y2026.deathBenefit, 100_000)
    expect(y2026.cashFlow!.reconciliation.cash.differencePlanDollars).toBe(0)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes standalone capitalGain metadata when an exact-basis sale nets to zero after HECM payoff', () => {
    // Independent worksheet, 0% inflation, p1 born 1964-01-01 (attained 62 in 2026):
    //   value 400,000, costBasis 0, sellingCostPct 25, primary residence.
    //   HECM open 2026, PL 75% = 300,000, upfront 10% = 40,000.
    //   2026: spending 260,000, cash 0 → lastResort draws remaining capacity 260,000.
    //         loanBalance = 300,000.
    //   2027 sale: salePrice 400,000, selling costs 100,000, netProceeds 300,000.
    //         payoff min(300,000, 300,000) = 300,000 → net after HECM 0.
    //         amount realized 300,000 − basis 0 = 300,000 gain.
    //         §121 single exclusion 250,000 → capitalGain 50,000.
    //   Sale source omitted at zero; gain publishes as
    //   metadata:capitalGain:propertySale:home-1.
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 70 })
    plan.expenses.baseAnnual = 260_000
    plan.accounts = [
      cashAccount('cash-1', 0),
      home({
        value: 400_000,
        costBasis: 0,
        sellingCostPct: 25,
        plannedSaleYear: 2027,
        hecm: {
          openYear: 2026,
          principalLimitPct: 75,
          growthRatePct: 0,
          upfrontCostPct: 10,
          drawPolicy: 'lastResort',
        },
      }),
    ]
    const y2027 = yearOf(run(plan, { horizonEndYear: 2027 }), 2027)

    expect(y2027.cashFlow!.sourceLines.some((line) =>
      line.id === 'source:propertySaleProceeds:home-1',
    )).toBe(false)
    const gain = y2027.cashFlow!.taxCharacterMetadata.find(
      (row) => row.id === 'metadata:capitalGain:propertySale:home-1',
    )
    expect(gain).toBeDefined()
    expect(gain!.taxCharacter).toEqual({ kind: 'capitalGain', amountPlanDollars: 50_000 })
    expect(gain!.identities).toEqual([
      { entityKind: 'propertyAccount', propertyAccountId: 'home-1' },
    ])
    expect(gain!.relatedLineId).toBeUndefined()
    expect(y2027.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
