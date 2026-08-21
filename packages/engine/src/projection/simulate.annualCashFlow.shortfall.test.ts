/**
 * Stage 3 residual shortfall attribution through `simulatePlan`.
 *
 * Reporting attribution must never rewrite `YearResult` layer scalars.
 * Expected values are independent hand worksheets, never taken from running
 * the assembler. The committed-credit contribution transfer records the full
 * credited amount with `committedCreditBeyondFunding` lineage to the use.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../model/plan.js'
import { cashAccount, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearCashFlowUseLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function captureOn(plan: Plan, taxCalculator = noTax, extra: { horizonEndYear?: number } = {}): ProjectionResult {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator,
    captureAnnualCashFlow: true,
    ...extra,
  })
}

function captureOff(plan: Plan, taxCalculator = noTax, extra: { horizonEndYear?: number } = {}): ProjectionResult {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator,
    ...extra,
  })
}

function yearOf(result: ProjectionResult, calendarYear: number): YearResult {
  const year = result.years.find((row) => row.year === calendarYear)
  if (year === undefined) throw new Error(`missing year ${calendarYear}`)
  return year
}

function useById(year: YearResult, id: string): YearCashFlowUseLine {
  const line = year.cashFlow?.useLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing use line ${id}`)
  return line
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

function equityCompUnvested(id: string, annualContribution: number): Account {
  return {
    type: 'equityComp',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 0,
    costBasis: 0,
    annualContribution,
    vestingMode: 'cliff',
    vestDate: '2030-01-01',
  }
}

describe('simulatePlan annual cash-flow residual shortfall', () => {
  it('(a) unfunds excess then ideal then target before required, without rewriting YearResult.requiredShortfall', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax:
    //   requiredAnnual 10,000, baseAnnual 20,000 → required 10k + target 10k
    //   idealAnnual 5,000, excessAnnual 5,000
    //   attempted spending = 30,000; cash 22,000; shortfallAfterHecm = 8,000
    //   residual: excess takes 5,000 (funded 0); remaining 3,000
    //             ideal takes 3,000 → funded 2,000, unfunded 3,000
    //             target and required untouched
    //   attributeShortfall (YearResult scalars):
    //     actualFunded = 30,000 − 8,000 = 22,000
    //     requiredShortfall = max(0, 10,000 − 22,000) = 0
    //     idealShortfall = 5,000 − min(5,000, 22,000 − 20,000) = 3,000
    //     excessShortfall = 5,000
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
    plan.accounts = [cashAccount('cash-1', 22_000)]
    plan.expenses.requiredAnnual = 10_000
    plan.expenses.baseAnnual = 20_000
    plan.expenses.idealAnnual = 5_000
    plan.expenses.excessAnnual = 5_000
    const extra = { horizonEndYear: 2026 }
    const on = captureOn(plan, noTax, extra)
    const off = captureOff(plan, noTax, extra)
    const yOn = yearOf(on, START_YEAR)
    const yOff = yearOf(off, START_YEAR)

    expect('cashFlow' in yOff).toBe(false)
    expectMoney(yOn.requiredShortfall, yOff.requiredShortfall)
    expectMoney(yOn.targetShortfall, yOff.targetShortfall)
    expectMoney(yOn.idealShortfall, yOff.idealShortfall)
    expectMoney(yOn.excessShortfall, yOff.excessShortfall)
    expectMoney(yOn.shortfall, yOff.shortfall)
    expectMoney(yOn.surplusInvested, yOff.surplusInvested)
    expectMoney(yOn.requiredShortfall, 0)
    expectMoney(yOn.idealShortfall, 3_000)
    expectMoney(yOn.excessShortfall, 5_000)

    expectMoney(useById(yOn, 'use:excessLifestyle:household').fundedPlanDollars, 0)
    expectMoney(useById(yOn, 'use:excessLifestyle:household').unfundedPlanDollars, 5_000)
    expectMoney(useById(yOn, 'use:idealLifestyle:household').fundedPlanDollars, 2_000)
    expectMoney(useById(yOn, 'use:idealLifestyle:household').unfundedPlanDollars, 3_000)
    expectMoney(useById(yOn, 'use:targetLifestyle:household').unfundedPlanDollars, 0)
    expectMoney(useById(yOn, 'use:requiredLifestyle:household').unfundedPlanDollars, 0)
    expect(yOn.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('(b) phantom conversion income leaves settledTax unfunded while the cash identity closes', () => {
    // Independent worksheet, year 2026, 0% inflation, 0% spending:
    //   p1 born 1960-01-01 → attained 66 (past 59½, before RMD)
    //   traditional IRA 10,000 converted in full to Roth IRA (opening 0)
    //   conversion is a transfer, not household cash; ordinary income 10,000
    //   flat tax 150% → tax = 15,000
    //   after conversion Roth holds 10,000; sequential withdrawal takes 10,000
    //   shortfallAfterHecm = 5,000, all residual to settledTax
    //   spending lines omitted (requested 0); settledTax funded 10,000, unfunded 5,000
    //   sources 10,000 = funded tax 10,000 → cash identity closes
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 80, retirementAge: null })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-1', 10_000, 'p1', 'ira'),
      rothIra('roth-1', 0),
    ]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 10_000 }] }
    const tax = createFlatTaxCalculator(150)
    const extra = { horizonEndYear: 2026 }
    const on = captureOn(plan, tax, extra)
    const off = captureOff(plan, tax, extra)
    const yOn = yearOf(on, START_YEAR)
    const yOff = yearOf(off, START_YEAR)

    expectMoney(yOn.tax, 15_000)
    expectMoney(yOn.tax, yOff.tax)
    expectMoney(yOn.requiredShortfall, yOff.requiredShortfall)
    expectMoney(yOn.shortfall, yOff.shortfall)
    expect(yOn.cashFlow!.useLines.some((line) => line.kind === 'requiredLifestyle')).toBe(false)
    const settled = useById(yOn, 'use:settledTax:household')
    expect(settled.kind).toBe('settledTax')
    expectMoney(settled.requestedPlanDollars, 15_000)
    expect(settled.unfundedPlanDollars).toBeGreaterThan(0)
    expectMoney(settled.unfundedPlanDollars, 5_000)
    expectMoney(settled.fundedPlanDollars, 10_000)
    expect(yOn.cashFlow!.reconciliation.cash.differencePlanDollars).toBeCloseTo(0, 6)
    expect(yOn.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('(c) residual reaches contributions last; credited stays the committed amount', () => {
    // Independent worksheet, year 2026, 0% inflation, $0 tax, $0 lifestyle:
    //   wages 1,000 (cash inflow)
    //   unvested equity-comp annualContribution 8,000, vestDate 2030 → not spendable
    //   wages > 0 so desired = 8,000; equity-comp has no IRC group cap → credited 8,000
    //   need = 8,000; cash inflows = 1,000; cannot withdraw unvested equity
    //   shortfallAfterHecm = 7,000, spending/tax/penalties empty → residual to contribution
    //   requested 8,000, funded 1,000, unfunded 7,000
    //   stage 4 will emit transfer credit 8,000 with committedCreditBeyondFunding
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, retirementAge: 70 })
    plan.accounts = [cashAccount('cash-1', 0), equityCompUnvested('rsu-1', 8_000)]
    plan.incomes = [
      {
        type: 'wages',
        id: 'wage-1',
        personId: 'p1',
        annualGross: 1_000,
        endAge: null,
        realGrowthPct: 0,
      },
    ]
    const extra = { horizonEndYear: 2026 }
    const on = captureOn(plan, noTax, extra)
    const off = captureOff(plan, noTax, extra)
    const yOn = yearOf(on, START_YEAR)
    const yOff = yearOf(off, START_YEAR)

    expectMoney(yOn.requiredShortfall, yOff.requiredShortfall)
    expectMoney(yOn.shortfall, yOff.shortfall)
    expectMoney(yOn.contributions, 8_000)
    expectMoney(yOff.contributions, 8_000)

    const contrib = useById(yOn, 'use:contribution:rsu-1')
    expect(contrib.kind).toBe('contribution')
    expectMoney(contrib.requestedPlanDollars, 8_000)
    expectMoney(contrib.fundedPlanDollars, 1_000)
    expectMoney(contrib.unfundedPlanDollars, 7_000)
    expect(contrib.identities).toEqual([
      { entityKind: 'account', accountId: 'rsu-1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const transfer = yOn.cashFlow!.transferLines.find(
      (line) => line.id === 'transfer:employeeContribution:rsu-1',
    )
    expect(transfer).toBeDefined()
    expect(transfer!.kind).toBe('employeeContribution')
    expectMoney(transfer!.debitPlanDollars, 8_000)
    expectMoney(transfer!.creditPlanDollars, 8_000)
    expect(transfer!.lineage).toEqual([
      { lineId: 'use:contribution:rsu-1', relationship: 'committedCreditBeyondFunding' },
    ])
    expect(yOn.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
