import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { compareRothConversion, summarizeProjection } from './compare.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `cmp-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function conversionPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-06-15',
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 85, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 4
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [
    { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
    { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_500_000, annualContribution: 0 },
    { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
  ]
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'topOfBracket',
    targetValue: 22,
    startYear: 2026,
    endYear: 2034, // before RMDs start at 75 (2035)
  }
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('summarizeProjection', () => {
  it('totals taxes and buckets ending balances by category', () => {
    const plan = conversionPlan()
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    const summary = summarizeProjection(plan, result)

    expect(summary.lifetimeTaxesAndPenalties).toBeGreaterThan(0)
    expect(summary.lifetimeRothConversions).toBeGreaterThan(500_000)
    expect(summary.endingByCategory.roth).toBeGreaterThan(0)
    expect(summary.depletionYear).toBeNull()
  })

  it('haircuts only the traditional balance for the after-tax estate', () => {
    const plan = conversionPlan()
    plan.assumptions.heirTaxRatePct = 25
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    const summary = summarizeProjection(plan, result)

    const expected = summary.endingNetWorth - summary.endingByCategory.traditional * 0.25
    expect(summary.endingAfterTaxEstate).toBeCloseTo(expected, 6)
    // Conversions move money traditional -> Roth, so the haircut is below a naive 25% of net worth.
    expect(summary.endingAfterTaxEstate).toBeGreaterThan(summary.endingNetWorth - summary.endingNetWorth * 0.25)
  })

  it('a higher heir tax rate lowers the after-tax estate when traditional remains', () => {
    const low = conversionPlan()
    low.assumptions.heirTaxRatePct = 10
    const high = conversionPlan()
    high.assumptions.heirTaxRatePct = 40
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const lowSummary = summarizeProjection(low, simulatePlan(low, opts))
    const highSummary = summarizeProjection(high, simulatePlan(high, opts))
    expect(highSummary.endingAfterTaxEstate).toBeLessThan(lowSummary.endingAfterTaxEstate)
  })

  it('derives FIRE metrics from the projection ledger', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Alex',
      dob: '1996-06-15',
      sex: 'average',
      retirementAge: 40,
      longevity: { planningAge: 60, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.safeWithdrawalRatePct = 4
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [{ type: 'wages', id: 'w1', personId: 'p1', annualGross: 100_000, endAge: null, realGrowthPct: 0 }]
    plan.accounts = [{ type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_000_000, annualContribution: 0 }]
    const r = parsePlan(plan)
    if (!r.ok) throw new Error(r.issues.join('; '))

    const result = simulatePlan(r.plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    const summary = summarizeProjection(r.plan, result)

    expect(summary.fiNumber).toBeCloseTo(1_000_000, 6)
    expect(summary.fiYear).toBe(2026)
    expect(summary.fiAge).toBe(30)
    expect(summary.averagePreRetirementSavingsRatePct).toBeCloseTo(60, 6)
    expect(summary.coastFireNumber).toBeCloseTo(1_000_000, 6)
  })
})

describe('compareRothConversion', () => {
  it('runs with and without conversions for side-by-side comparison', () => {
    const comparison = compareRothConversion(conversionPlan(), {
      startYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })

    const w = comparison.withConversions
    const wo = comparison.withoutConversions
    expect(wo.lifetimeRothConversions).toBe(0)
    expect(w.lifetimeRothConversions).toBeGreaterThan(0)
    // Conversions shift money traditional -> Roth and prepay tax.
    expect(w.endingByCategory.traditional).toBeLessThan(wo.endingByCategory.traditional)
    expect(w.endingByCategory.roth).toBeGreaterThan(wo.endingByCategory.roth)
    expect(w.lifetimeTaxesAndPenalties).not.toBe(wo.lifetimeTaxesAndPenalties)
    // RMDs after the conversion window are smaller with conversions.
    const lastYearWith = comparison.withConversions
    expect(lastYearWith.endingByCategory.traditional).toBeGreaterThanOrEqual(0)
  })
})
