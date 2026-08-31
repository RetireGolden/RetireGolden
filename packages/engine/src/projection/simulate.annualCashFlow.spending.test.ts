/**
 * Stage 3 use-line capture for lifestyle, goals, system costs, and healthcare.
 *
 * Spending-only fixtures (no QCD, no reinvest, no conversions) reconcile
 * under the stage-5 cash/use/transfer identities. Expected values are
 * independent hand worksheets, never taken from running the assembler.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type CareEvent, type InsurancePolicy, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowUseLine, YearResult } from './types.js'

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

function useById(year: YearResult, id: string): YearCashFlowUseLine {
  const line = year.cashFlow?.useLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing use line ${id}`)
  return line
}

function debt(id: string, balance: number, monthlyPayment: number): Account {
  return {
    type: 'debt',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    interestPct: 0,
    monthlyPayment,
  }
}

function home(id: string, propertyTaxAnnual: number, insuranceAnnual: number): Account {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    value: 400_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    propertyTaxAnnual,
    insuranceAnnual,
  }
}

function permLife(id: string, annualPremium: number): InsurancePolicy {
  return {
    kind: 'permanentLife',
    id,
    name: id,
    insured: 'p1',
    beneficiary: 'estate',
    annualPremium,
    premiumMode: 'lifetime',
    deathBenefit: 0,
    cashValue: 0,
    cashValueMode: 'flatRate',
    cashValueGrowthPct: 0,
  }
}

function ltcPolicy(id: string, benefitMonthly: number): InsurancePolicy {
  return {
    kind: 'ltc',
    id,
    name: id,
    owner: 'p1',
    annualPremium: 0,
    premiumMode: 'paidUp',
    benefitMonthly,
    benefitPeriodYears: 'lifetime',
    eliminationPeriodDays: 0,
  }
}

function careEvent(id: string, annualCost: number): CareEvent {
  return { id, personId: 'p1', startAge: 60, durationYears: 3, annualCost }
}

describe('simulatePlan annual cash-flow spending uses', () => {
  it('publishes four household lifestyle lines from the post-split layers', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax:
    //   requiredAnnual 20,000, baseAnnual 50,000, idealAnnual 8,000, excessAnnual 3,000
    //   split: required = min(20k, 50k) = 20,000
    //          target = 50k − 20k = 30,000
    //          ideal = 8,000; excess = 3,000
    //   cash 200,000 funds all four; no guardrail
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.accounts = [cashAccount('cash-1', 200_000)]
    plan.expenses.requiredAnnual = 20_000
    plan.expenses.baseAnnual = 50_000
    plan.expenses.idealAnnual = 8_000
    plan.expenses.excessAnnual = 3_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const required = useById(y2026, 'use:requiredLifestyle:household')
    expect(required.kind).toBe('requiredLifestyle')
    expectMoney(required.requestedPlanDollars, 20_000)
    expectMoney(required.fundedPlanDollars, 20_000)
    expectMoney(required.unfundedPlanDollars, 0)
    expect(required.identities).toEqual([])

    const target = useById(y2026, 'use:targetLifestyle:household')
    expect(target.kind).toBe('targetLifestyle')
    expectMoney(target.requestedPlanDollars, 30_000)
    expectMoney(target.fundedPlanDollars, 30_000)
    expectMoney(target.unfundedPlanDollars, 0)

    const ideal = useById(y2026, 'use:idealLifestyle:household')
    expectMoney(ideal.requestedPlanDollars, 8_000)
    expectMoney(ideal.fundedPlanDollars, 8_000)

    const excess = useById(y2026, 'use:excessLifestyle:household')
    expectMoney(excess.requestedPlanDollars, 3_000)
    expectMoney(excess.fundedPlanDollars, 3_000)

    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a one-time goal by goalId and excludes a deferred goal from the year', () => {
    // Independent worksheet, declining cash so guardrails cut:
    //   cash 300,000 at −6%/yr, target 30,000 / required 18,000 (same as spendingGuardrails)
    //   funded goal `car` is fixed in 2026 for 5,000 → one use line, funded = requested
    //   movable `roof` target 2030, latest 2036: while cutting, years before 2036
    //   increment deferred only and must not appear as a current-year use
    const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
    const cash = cashAccount('cash', 300_000)
    cash.annualReturnPct = -6
    plan.accounts = [cash]
    plan.expenses.baseAnnual = 30_000
    plan.expenses.requiredAnnual = 18_000
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.expenses.oneTimeGoals = [
      { id: 'car', label: 'Car', year: 2026, amount: 5_000, classification: 'target', flexibility: 'fixed' },
      {
        id: 'roof',
        label: 'Roof',
        year: 2030,
        amount: 20_000,
        classification: 'ideal',
        flexibility: 'movable',
        latestYear: 2036,
      },
    ]
    const years = run(plan)
    const y2026 = yearOf(years, 2026)
    const car = useById(y2026, 'use:oneTimeGoal:car')
    expect(car.kind).toBe('oneTimeGoal')
    expectMoney(car.requestedPlanDollars, 5_000)
    expectMoney(car.fundedPlanDollars, 5_000)
    expect(car.identities).toEqual([{ entityKind: 'goal', goalId: 'car' }])

    const deferredYear = years.find((row) => row.flexibleGoals.deferred > 0)
    expect(deferredYear).toBeDefined()
    expect(deferredYear!.cashFlow!.useLines.some((line) => line.id === 'use:oneTimeGoal:roof')).toBe(false)
    expect(years.some((row) => row.cashFlow?.useLines.some((line) => line.id === 'use:oneTimeGoal:roof' && row.flexibleGoals.deferred > 0 && row.year < 2036))).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes a skipped goal with unfunded = requested', () => {
    // Independent worksheet (spendingGuardrails skippable excess):
    //   lux-trip 25,000 skippable, target 2033, latestYear 2034, excess layer
    //   when skipped, requested = 25,000, funded = 0, unfunded = 25,000
    const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 90 })
    const cash = cashAccount('cash', 300_000)
    cash.annualReturnPct = -6
    plan.accounts = [cash]
    plan.expenses.baseAnnual = 30_000
    plan.expenses.requiredAnnual = 18_000
    plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    plan.expenses.oneTimeGoals = [
      {
        id: 'lux-trip',
        label: 'Luxury trip',
        year: 2033,
        amount: 25_000,
        classification: 'excess',
        flexibility: 'skippable',
        latestYear: 2034,
      },
    ]
    const years = run(plan)
    const skipYear = years.find((row) => row.flexibleGoals.skipped > 0)
    expect(skipYear).toBeDefined()
    const trip = useById(skipYear!, 'use:oneTimeGoal:lux-trip')
    expectMoney(trip.requestedPlanDollars, 25_000)
    expectMoney(trip.fundedPlanDollars, 0)
    expectMoney(trip.unfundedPlanDollars, 25_000)
    expect(trip.identities).toEqual([{ entityKind: 'goal', goalId: 'lux-trip' }])
    expect(skipYear!.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes per-account debt, per-property costs, per-policy insurance, and per-person net LTC', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, person attained 60:
    //   debt-a 0% interest, monthly 500 → payment = min(balance, 6,000) = 6,000
    //   debt-b monthly 250 → 3,000
    //   home-a tax 3,000 + insurance 1,000 = 4,000
    //   home-b tax 1,500 + insurance 500 = 2,000
    //   life-a premium 2,200 (level, not inflated)
    //   care-1 annualCost 60,000; ltc-1 benefitMonthly 2,000 × 12 = 24,000
    //   net LTC = 60,000 − 24,000 = 36,000; benefit is not a source
    //   cash 200,000 funds the year; lifestyle 0
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.accounts = [
      cashAccount('cash-1', 200_000),
      debt('debt-a', 80_000, 500),
      debt('debt-b', 40_000, 250),
      home('home-a', 3_000, 1_000),
      home('home-b', 1_500, 500),
    ]
    plan.insurance = [permLife('life-a', 2_200), ltcPolicy('ltc-1', 2_000)]
    plan.careEvents = [careEvent('care-1', 60_000)]
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    const debtA = useById(y2026, 'use:debtService:debt-a')
    expect(debtA.kind).toBe('debtService')
    expectMoney(debtA.requestedPlanDollars, 6_000)
    expectMoney(debtA.fundedPlanDollars, 6_000)
    expect(debtA.identities[0]).toEqual({ entityKind: 'account', accountId: 'debt-a' })

    const debtB = useById(y2026, 'use:debtService:debt-b')
    expectMoney(debtB.requestedPlanDollars, 3_000)

    const propA = useById(y2026, 'use:propertyCosts:home-a')
    expect(propA.kind).toBe('propertyCosts')
    expectMoney(propA.requestedPlanDollars, 4_000)
    expect(propA.identities).toEqual([{ entityKind: 'propertyAccount', propertyAccountId: 'home-a' }])

    const propB = useById(y2026, 'use:propertyCosts:home-b')
    expectMoney(propB.requestedPlanDollars, 2_000)

    const prem = useById(y2026, 'use:insurancePremium:life-a')
    expect(prem.kind).toBe('insurancePremium')
    expectMoney(prem.requestedPlanDollars, 2_200)
    expect(prem.identities).toEqual([
      { entityKind: 'insurancePolicy', policyId: 'life-a' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const ltc = useById(y2026, 'use:longTermCare:p1')
    expect(ltc.kind).toBe('longTermCare')
    expectMoney(ltc.requestedPlanDollars, 36_000)
    expectMoney(ltc.fundedPlanDollars, 36_000)
    expect(ltc.identities).toEqual([
      { entityKind: 'person', personId: 'p1' },
      { entityKind: 'careEvent', careEventId: 'care-1' },
      { entityKind: 'insurancePolicy', policyId: 'ltc-1' },
    ])
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'wages' && line.amountPlanDollars === 24_000)).toBe(false)
    expect(y2026.cashFlow!.sourceLines.every((line) => (line.kind as string) !== 'longTermCare')).toBe(true)
    expectMoney(y2026.expenses.ltcBenefit, 24_000)
    expectMoney(y2026.expenses.careCost, 60_000)

    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes household healthcare after ACA-off marketplace months, not a subsidy source', () => {
    // Independent worksheet, year 2026, person attained 60 (all 12 months marketplace):
    //   pre65MonthlyPremiumPerPerson 400, applyAcaCredit false
    //   healthcare = 400 × 12 = 4,800; no subsidy source
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.accounts = [cashAccount('cash-1', 50_000)]
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 400,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)
    const hc = useById(y2026, 'use:healthcare:household')
    expect(hc.kind).toBe('healthcare')
    expectMoney(hc.requestedPlanDollars, 4_800)
    expectMoney(hc.fundedPlanDollars, 4_800)
    expect(hc.identities).toEqual([])
    expect(y2026.cashFlow!.sourceLines.every((line) => (line.kind as string) !== 'healthcare')).toBe(true)
    expectMoney(y2026.expenses.healthcare, 4_800)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('publishes two-owner need-based sources plus lifestyle uses that close the cash identity', () => {
    // Independent worksheet, year 2026, 0% growth, 0% inflation, $0 tax:
    //   both born 1953-01-01 → attained 73. Uniform Lifetime divisor 26.5.
    //   p1 IRA 265,000 → RMD1 = 265,000 / 26.5 = 10,000
    //   p2 IRA 132,500 → RMD2 = 132,500 / 26.5 = 5,000
    //   requiredAnnual 20,000, baseAnnual 40,000 → required 20,000 + target 20,000
    //   Medicare Part B standard 202.90/mo (2026 pack, IRMAA tier 0) × 12 × 2
    //     = 4,869.60 household healthcare (required system cost)
    //   total uses 44,869.60; RMD cash 15,000
    //   need-based = 44,869.60 − 15,000 = 29,869.60 from p1 (sequential)
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
    plan.expenses.requiredAnnual = 20_000
    plan.expenses.baseAnnual = 40_000
    const y2026 = yearOf(run(plan, { horizonEndYear: 2026 }), START_YEAR)

    expectMoney(y2026.rmd, 15_000)
    const p1Rmd = y2026.cashFlow!.sourceLines.find((line) => line.id === 'source:requiredMinimumDistribution:ownedIraPool:p1')
    const p2Rmd = y2026.cashFlow!.sourceLines.find((line) => line.id === 'source:requiredMinimumDistribution:ownedIraPool:p2')
    expectMoney(p1Rmd!.amountPlanDollars, 10_000)
    expectMoney(p2Rmd!.amountPlanDollars, 5_000)
    const p1Need = y2026.cashFlow!.sourceLines.find((line) => line.id === 'source:needBasedPortfolioWithdrawal:ira-p1')
    expectMoney(p1Need!.amountPlanDollars, 29_869.60)
    expect(y2026.cashFlow!.sourceLines.some((line) => line.id === 'source:needBasedPortfolioWithdrawal:ira-p2')).toBe(false)

    expectMoney(useById(y2026, 'use:requiredLifestyle:household').fundedPlanDollars, 20_000)
    expectMoney(useById(y2026, 'use:targetLifestyle:household').fundedPlanDollars, 20_000)
    expectMoney(useById(y2026, 'use:healthcare:household').fundedPlanDollars, 4_869.60)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
