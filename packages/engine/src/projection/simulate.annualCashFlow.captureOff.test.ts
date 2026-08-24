import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type IncomeStream, type Plan } from '../model/plan.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import {
  simulatePlan,
  type CounterfactualAnnualLiabilityResult,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function emptyPlan(): Plan {
  return validate(singlePersonPlan({ dob: '1966-01-01', planningAge: 60 }))
}

function wages(annualGross: number): IncomeStream {
  return {
    type: 'wages',
    id: 'wage-1',
    personId: 'p1',
    annualGross,
    endAge: null,
    realGrowthPct: 0,
  }
}

function taxableReinvest(balance: number, interestYieldPct: number): Account {
  return {
    type: 'taxable',
    id: 'brokerage-1',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    costBasis: balance,
    interestYieldPct,
    dividendYieldPct: 0,
    qualifiedRatio: 0,
    reinvestDividends: true,
    annualContribution: 0,
  }
}

function stripCashFlow(result: ProjectionResult): ProjectionResult {
  return {
    ...result,
    years: result.years.map((year) => {
      const copy: YearResult = { ...year }
      delete copy.cashFlow
      return copy
    }),
  }
}

describe('SimulateOptions.captureAnnualCashFlow', () => {
  it('omits the cashFlow key when the option is omitted or false, and economic fields deep-equal a capture-on run with cashFlow stripped', () => {
    const plan = emptyPlan()
    plan.incomes = [wages(40_000)]
    plan.expenses.baseAnnual = 40_000
    const validated = validate(plan)
    const options = { startYear: START_YEAR, taxCalculator: noTax }

    // Same call shape as relocation.ts:378, montecarlo/run.ts:119, and
    // optimizePlan.ts:2636 — SimulateOptions without captureAnnualCashFlow.
    const omitted = simulatePlan(validated, options)
    const off = simulatePlan(validated, { ...options, captureAnnualCashFlow: false })
    const on = simulatePlan(validated, { ...options, captureAnnualCashFlow: true })

    expect(omitted.years.length).toBeGreaterThan(0)
    for (const year of omitted.years) {
      expect('cashFlow' in year).toBe(false)
    }
    for (const year of off.years) {
      expect('cashFlow' in year).toBe(false)
    }
    for (const year of on.years) {
      expect('cashFlow' in year).toBe(true)
      expect(year.cashFlow).toBeDefined()
    }

    const omittedJson = JSON.parse(JSON.stringify(omitted)) as ProjectionResult
    const offJson = JSON.parse(JSON.stringify(off)) as ProjectionResult
    for (const year of omittedJson.years) expect('cashFlow' in year).toBe(false)
    for (const year of offJson.years) expect('cashFlow' in year).toBe(false)

    expect(omitted).toEqual(off)
    expect(stripCashFlow(on)).toEqual(omitted)
    expect(stripCashFlow(on)).toEqual(off)
    // Stage 5 economic clone: capture-on with cashFlow stripped is byte-equal
    // to a run that never set the flag. JSON.stringify also proves the clone
    // carries no `"cashFlow"` key (toEqual would miss `cashFlow: undefined`).
    expect(JSON.stringify(stripCashFlow(on))).toBe(JSON.stringify(omitted))
    expect(JSON.stringify(stripCashFlow(on))).toBe(JSON.stringify(off))
  })

  it('publishes status reconciled for a $0 empty plan year', () => {
    // Worksheet: no incomes, no accounts, baseAnnual $0, 0% tax, 0% inflation.
    // Every incomplete-inventory probe scalar is 0; published lines are empty.
    const result = simulatePlan(emptyPlan(), {
      startYear: START_YEAR,
      taxCalculator: noTax,
      captureAnnualCashFlow: true,
    })
    const year = result.years[0]!
    expect(year.year).toBe(START_YEAR)
    expect(year.incomes.total).toBe(0)
    expect(year.cashFlow?.sourceLines).toEqual([])
    expect(year.cashFlow?.useLines).toEqual([])
    expect(year.cashFlow?.transferLines).toEqual([])
    expect(year.cashFlow?.reconciliation.status).toBe('reconciled')
    expect(year.cashFlow?.reconciliation.reasonCodes).toEqual([])
    expect(year.cashFlow?.reconciliation.tolerancePlanDollars).toBe(1e-6)
    expect(year.cashFlow?.reconciliation.cashIdentityTolerancePlanDollars).toBe(0.005)
  })

  it('reconciles a wages-only year once lifestyle uses land (stage 3)', () => {
    // Worksheet: wages $50,000, lifestyle $50,000, 0% tax, 0% inflation.
    // requiredAnnual omitted → required lifestyle = baseAnnual 50,000, target 0.
    // Wage source 50,000 = funded required-lifestyle use 50,000.
    const plan = emptyPlan()
    plan.incomes = [wages(50_000)]
    plan.expenses.baseAnnual = 50_000
    const year = simulatePlan(validate(plan), {
      startYear: START_YEAR,
      taxCalculator: noTax,
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.incomes.wages).toBe(50_000)
    expect(year.incomes.total).toBe(50_000)
    expect(year.surplusInvested).toBe(0)
    expect(year.cashFlow?.sourceLines).toEqual([
      expect.objectContaining({
        id: 'source:wages:wage-1',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 50_000,
      }),
    ])
    expect(year.cashFlow?.useLines).toEqual([
      expect.objectContaining({
        id: 'use:requiredLifestyle:household',
        kind: 'requiredLifestyle',
        requestedPlanDollars: 50_000,
        fundedPlanDollars: 50_000,
        unfundedPlanDollars: 0,
      }),
    ])
    expect(year.cashFlow?.reconciliation.status).toBe('reconciled')
    expect(year.cashFlow?.reconciliation.reasonCodes).toEqual([])
  })

  it('excludes reinvested yield from spendable sources exactly once and transfers the gross once', () => {
    // Worksheet: taxable $100,000, interestYieldPct 4, reinvestDividends true.
    // taxableYield = 4,000 = incomes.total = taxableYieldReinvested.
    // Spendable probe = 4,000 - 4,000 = 0 (empty spendable sources are correct).
    // Stage 4 publishes one reinvestedYield transfer of gross 4,000.
    const plan = emptyPlan()
    plan.accounts = [taxableReinvest(100_000, 4)]
    const year = simulatePlan(validate(plan), {
      startYear: START_YEAR,
      taxCalculator: noTax,
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.incomes.total).toBe(4_000)
    expect(year.incomes.taxableYield).toBe(4_000)
    expect(year.cashFlow?.sourceLines).toEqual([])
    expect(year.cashFlow?.transferLines).toEqual([
      expect.objectContaining({
        id: 'transfer:reinvestedYield:brokerage-1',
        kind: 'reinvestedYield',
        debitPlanDollars: 4_000,
        creditPlanDollars: 4_000,
      }),
    ])
    expect(year.cashFlow?.reconciliation.cash.spendableSourcesPlanDollars).toBe(0)
    expect(year.cashFlow?.reconciliation.status).toBe('reconciled')
    expect(year.cashFlow?.reconciliation.reasonCodes).toEqual([])
  })

  it('does not leak cashFlow onto annualCounterfactual empty-omit years while committed years publish it', () => {
    // Isolation: runPostContributionAnnualPass defaults publishCashFlow false.
    // The option-counterfactual at simulate.ts (empty omit set) re-enters the
    // pass before commit. Capture-on must not write cashFlow on that discarded
    // year; committed years still publish. Economic fields match a capture-off
    // run; committed cashFlow matches a capture-on run that never set
    // annualCounterfactual.
    const plan = emptyPlan()
    plan.incomes = [wages(40_000)]
    plan.expenses.baseAnnual = 40_000
    const validated = validate(plan)
    const options = { startYear: START_YEAR, taxCalculator: noTax }

    const off = simulatePlan(validated, options)
    const on = simulatePlan(validated, { ...options, captureAnnualCashFlow: true })
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const emptyOmit: SimulateAnnualCounterfactualRequest = {
      omitActionIds: [],
      taxUnitId: 'cf-tax-unit',
      nonGroupTaxInputs: [
        {
          inputId: 'federalFilingStatus',
          value: { representation: 'declaredTerm', term: 'single' },
        },
      ],
      capture: (result) => {
        captured.push(result)
      },
    }
    const onWithCounterfactual = simulatePlan(validated, {
      ...options,
      captureAnnualCashFlow: true,
      annualCounterfactual: emptyOmit,
    })

    expect(captured.length).toBe(onWithCounterfactual.years.length)
    expect(captured.length).toBeGreaterThan(0)
    for (const result of captured) {
      expect('cashFlow' in result).toBe(false)
    }
    for (const year of onWithCounterfactual.years) {
      expect('cashFlow' in year).toBe(true)
      expect(year.cashFlow).toBeDefined()
    }
    expect(stripCashFlow(onWithCounterfactual)).toEqual(off)
    expect(stripCashFlow(onWithCounterfactual)).toEqual(stripCashFlow(on))
    expect(onWithCounterfactual.years.map((year) => year.cashFlow)).toEqual(
      on.years.map((year) => year.cashFlow),
    )
  })

  it('relocation- and optimizer-shaped SimulateOptions without the flag stay key-absent', () => {
    const plan = emptyPlan()
    plan.incomes = [wages(40_000)]
    plan.expenses.baseAnnual = 40_000
    const validated = validate(plan)

    // Same call shape as projection/relocation.ts:378.
    const relocationShaped = simulatePlan(validated, {
      startYear: START_YEAR,
      taxCalculator: noTax,
    })
    // Same call shape as projection/optimizePlan.ts:503 (probe) and the shared
    // simulateOptions object at 2636 — captureOptimizerInputs may be set; the
    // cash-flow flag is not.
    const optimizerShaped = simulatePlan(validated, {
      startYear: START_YEAR,
      taxCalculator: noTax,
      captureOptimizerInputs: () => {},
    })

    for (const year of [...relocationShaped.years, ...optimizerShaped.years]) {
      expect('cashFlow' in year).toBe(false)
      expect(year.cashFlow).toBeUndefined()
    }
    const relocationJson = JSON.parse(JSON.stringify(relocationShaped)) as ProjectionResult
    const optimizerJson = JSON.parse(JSON.stringify(optimizerShaped)) as ProjectionResult
    for (const year of [...relocationJson.years, ...optimizerJson.years]) {
      expect('cashFlow' in year).toBe(false)
    }
  })
})
