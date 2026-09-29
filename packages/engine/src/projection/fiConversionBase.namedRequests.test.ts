/**
 * The FI base's two untested branches (the independent review's L4, mutants
 * C01 and C05): a year whose only conversion is a named request, executed or
 * refused, and a legacy aggregate conversion request in the plan run without
 * conversions (decision D-FI-CONVERSION-TAX).
 */
import { describe, expect, it } from 'vitest'

import { parseRetirementActionRequest } from '../actions/index.js'
import type { Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { conversionFreeRun, summarizeProjection, withoutRothConversions } from './compare.js'
import { simulatePlan } from './simulate.js'

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

/** Pat, born 1960, never retires by age, so the FI figures price 2026. */
function plan(actions: ReturnType<typeof request>[]): Plan {
  const base = singlePersonPlan({ planningAge: 85, dob: '1960-06-15' })
  base.expenses.baseAnnual = 40_000
  base.accounts = [
    { type: 'cash', id: 'cash-a', name: 'Cash', ownerPersonId: 'p1', annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
    // A provably zero basis makes the conversion's character knowable at commit.
    { type: 'traditional', id: 'ira-a', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 1_000_000, annualContribution: 0, nondeductibleBasis: 0 },
    { type: 'roth', id: 'roth-a', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
  ]
  base.retirementActionEligibilityFacts = {
    iraClassifications: [{ evidenceId: 'ira-a-classification', provenance: { source: 'manual' }, sourceAccountId: 'ira-a', subtype: 'traditional' }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  base.strategies.retirementActions = actions
  return validatePlan(base)
}

const named = (cents: number) =>
  request({
    actionId: 'named-conversion', kind: 'rothConversion', personId: 'p1', year: 2026,
    executionDate: '2026-06-15', executionSequence: 1, requestedAmount: cents,
    allocations: [{ allocationId: 'named-conversion-a', sourceAccountId: 'ira-a', requestedAmount: cents }],
    destinationRothAccountId: 'roth-a', taxFunding: { kind: 'noneExpected' }, provenance: { source: 'manual' },
  })

const opts = () => ({ startYear: 2026, taxCalculator: createFlatTaxCalculator(22) })

function priced(target: Plan) {
  const result = simulatePlan(target, opts())
  let runs = 0
  const free = conversionFreeRun(target, opts())
  const summary = summarizeProjection(target, result, { conversionFreeRun: () => { runs++; return free() } })
  return { year: result.years.find((y) => y.year === 2026)!, summary, runs }
}

describe('the FI base and named or legacy conversion requests (review L4)', () => {
  const none = priced(plan([]))

  it('prices a year whose only conversion is an executed named request without its tax (C01)', () => {
    const executed = priced(plan([named(40_000_00)]))
    // $40,000 converts at a flat 22%: $8,800 of tax that the plan without it does not pay.
    expect(executed.year.rothConversion).toBe(40_000)
    expect(executed.year.tax).toBe(none.year.tax + 8_800)
    expect(executed.runs).toBe(1)
    expect(executed.summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'conversionFreeProjection' })
    expect(executed.summary.fiNumber).toBe(none.summary.fiNumber)
  })

  it('reads the run without conversions when a named request was refused and nothing converted (C01)', () => {
    // $2,000,000 asked of a $1,000,000 IRA: the request is refused whole, so
    // the year's rothConversion is 0 and only the published execution shows
    // the plan asked to convert.
    const refused = priced(plan([named(2_000_000_00)]))
    expect(refused.year.rothConversion).toBe(0)
    expect(refused.year.rothConversionActionExecution?.evidence.map((e) => e.outcome)).toEqual(['refused'])
    expect(refused.runs).toBe(1)
    expect(refused.summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'conversionFreeProjection' })
    expect(refused.summary.fiNumber).toBe(none.summary.fiNumber)
    // A plan that asks for no conversion never runs the counterfactual.
    expect(none.runs).toBe(0)
    expect(none.summary.fiBasis).toMatchObject({ spendingSource: 'projection' })
  })

  it('drops legacy aggregate conversion requests, as well as named ones and their tax withdrawals, from the plan run without conversions (C05)', () => {
    const withdrawal = request({
      actionId: 'tax-withdrawal', kind: 'ordinaryWithdrawal', personId: 'p1', year: 2026,
      executionDate: '2026-06-14', executionSequence: 1, requestedAmount: 8_800_00,
      allocations: [{ allocationId: 'tax-withdrawal-a', sourceAccountId: 'cash-a', requestedAmount: 8_800_00 }],
      purpose: { kind: 'taxPayment', referenceId: 'linked-conversion' }, provenance: { source: 'manual' },
    })
    const linked = request({
      actionId: 'linked-conversion', kind: 'rothConversion', personId: 'p1', year: 2027,
      executionDate: '2027-06-15', executionSequence: 2, requestedAmount: 40_000_00,
      allocations: [{ allocationId: 'linked-conversion-a', sourceAccountId: 'ira-a', requestedAmount: 40_000_00 }],
      destinationRothAccountId: 'roth-a', taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'tax-withdrawal' },
      provenance: { source: 'manual' },
    })
    const legacyConversion = request({ actionId: 'legacy-conversion', kind: 'legacyAggregateRothConversion', year: 2028, requestedAmount: 20_000_00, provenance: { source: 'migration' } })
    const legacyQcd = request({ actionId: 'legacy-qcd', kind: 'legacyAggregateQcd', year: 2029, requestedAmount: 8_000_00, legacyField: 'qcdAnnual', provenance: { source: 'migration' } })
    const source = { ...plan([]), strategies: { ...plan([]).strategies, rothConversion: { mode: 'manual' as const, conversions: [{ year: 2026, amount: 10_000 }] }, retirementActions: [withdrawal, linked, legacyConversion, legacyQcd, named(40_000_00)] } }
    const free = withoutRothConversions(source)
    expect(free.strategies.rothConversion).toEqual({ mode: 'none' })
    expect(free.strategies.retirementActions.map((action) => action.actionId)).toEqual(['legacy-qcd'])
  })
})
