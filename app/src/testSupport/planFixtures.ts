import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../engine/model/plan'
import { combineTaxCalculators, createFederalTaxCalculator } from '../engine/tax/federalTax'
import { createStateTaxCalculator } from '../engine/tax/stateTax'
import { simulatePlan } from '../engine/projection/simulate'
import type { ProjectionResult, TaxCalculator } from '../engine/projection/types'

let idCounter = 0

export function testId(prefix = 'test'): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function fixedNow(): Date {
  return new Date('2026-01-01T00:00:00.000Z')
}

export interface SinglePlanOptions {
  dob?: string
  planningAge?: number
  retirementAge?: number | null
  state?: string
}

export interface CouplePlanOptions {
  p1Dob?: string
  p2Dob?: string
  p1PlanningAge?: number
  p2PlanningAge?: number
  p1RetirementAge?: number | null
  p2RetirementAge?: number | null
  state?: string
}

export function singlePersonPlan(opts: SinglePlanOptions = {}): Plan {
  const plan = createEmptyPlan({ newId: () => testId('plan'), now: fixedNow, name: 'Test plan' })
  plan.household.filingStatus = 'single'
  plan.household.state = opts.state ?? 'KY'
  plan.household.people = [
    {
      id: 'p1',
      name: 'Pat',
      dob: opts.dob ?? '1966-01-01',
      sex: 'average',
      retirementAge: opts.retirementAge ?? null,
      longevity: { planningAge: opts.planningAge ?? 60, source: 'manual' },
    },
  ]
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.ssCola = { mode: 'fixed', annualPct: 0 }
  plan.assumptions.ssHaircut = null
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.recentAnnualMagi = 0
  plan.accounts = []
  plan.incomes = []
  plan.expenses.baseAnnual = 0
  plan.expenses.phases = []
  plan.expenses.oneTimeGoals = []
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.strategies.withdrawalOrder = { mode: 'sequential' }
  plan.strategies.rothConversion = { mode: 'none' }
  plan.strategies.qcdAnnual = 0
  return plan
}

export function couplePlan(opts: CouplePlanOptions = {}): Plan {
  const plan = singlePersonPlan({
    dob: opts.p1Dob,
    planningAge: opts.p1PlanningAge,
    retirementAge: opts.p1RetirementAge,
    state: opts.state,
  })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    {
      id: 'p1',
      name: 'Pat',
      dob: opts.p1Dob ?? '1966-01-01',
      sex: 'average',
      retirementAge: opts.p1RetirementAge ?? null,
      longevity: { planningAge: opts.p1PlanningAge ?? 60, source: 'manual' },
    },
    {
      id: 'p2',
      name: 'Robin',
      dob: opts.p2Dob ?? '1966-01-01',
      sex: 'average',
      retirementAge: opts.p2RetirementAge ?? null,
      longevity: { planningAge: opts.p2PlanningAge ?? 60, source: 'manual' },
    },
  ]
  return plan
}

export function cashAccount(id: string, balance: number): Account {
  return { type: 'cash', id, name: id, ownerPersonId: null, annualReturnPct: 0, balance, annualContribution: 0 }
}

export function taxableAccount(id: string, balance: number, costBasis: number): Account {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    costBasis,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0.85,
    reinvestDividends: true,
    annualContribution: 0,
  }
}

export function traditionalAccount(id: string, balance: number, ownerPersonId = 'p1', kind: 'ira' | 'employer' = 'ira'): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind,
    balance,
    annualContribution: 0,
  }
}

export function recurringOrdinaryIncome(id: string, annualAmount: number, startYear: number | null = null): IncomeStream {
  return {
    type: 'recurring',
    id,
    label: id,
    annualAmount,
    startYear,
    endYear: null,
    inflationAdjusted: false,
    taxTreatment: 'ordinary',
  }
}

export function socialSecurityIncome(id: string, piaMonthly: number, claimAgeYears: number, personId = 'p1'): IncomeStream {
  return {
    type: 'socialSecurity',
    id,
    personId,
    piaMonthly,
    earnings: null,
    claimAge: { years: claimAgeYears, months: 0 },
  }
}

export function validatePlan(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

export function productionTaxCalculator(): TaxCalculator {
  return combineTaxCalculators(createFederalTaxCalculator(), createStateTaxCalculator())
}

export function runPlan(plan: Plan, taxCalculator: TaxCalculator, startYear = 2026): ProjectionResult {
  return simulatePlan(validatePlan(plan), { startYear, taxCalculator })
}
