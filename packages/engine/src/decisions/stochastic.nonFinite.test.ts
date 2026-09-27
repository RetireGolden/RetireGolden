import { describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { buildLognormalModelConfigForPlan } from '../montecarlo/marketModels.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'

vi.mock('../montecarlo/sharedPaths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../montecarlo/sharedPaths.js')>()
  return {
    ...actual,
    // The real shared-path run, with one entry's success rate replaced by a
    // figure that is not a number, as a pathological plan could produce.
    comparePlansOnSharedMarketPaths: vi.fn((plans: Parameters<typeof actual.comparePlansOnSharedMarketPaths>[0], opts: Parameters<typeof actual.comparePlansOnSharedMarketPaths>[1]) => {
      const comparison = actual.comparePlansOnSharedMarketPaths(plans, opts)
      return {
        ...comparison,
        rows: comparison.rows.map((row) =>
          row.id === 'not-finite' ? { ...row, summary: { ...row.summary, successRate: Number.NaN } } : row,
        ),
      }
    }),
  }
})

import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { makeMaximizeDownsideResilience } from './objectives.js'
import { attachStochasticMetrics, STOCHASTIC_METRICS_NOT_FINITE_DIAGNOSTIC } from './stochastic.js'

function retireePlan(): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `nonfinite-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 80, source: 'manual' },
  }
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_500_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function candidate(id: string, baseAnnual: number) {
  return {
    id,
    source: 'scenario-sweep' as const,
    category: 'spending' as const,
    label: id,
    explanation: `Spend $${baseAnnual} a year.`,
    planPatch: { expenses: { baseAnnual } },
  }
}

// PR #754 finding 6: compareScalars refuses a figure that is not finite. In the
// optimizer's max-downside-resilience path that refusal must refuse the one
// candidate, with a reason, not throw through the optimizer.
describe('attachStochasticMetrics with a Monte Carlo figure that is not finite', () => {
  it('refuses that candidate with a reason and attaches the others', () => {
    const plan = retireePlan()
    const taxCalculator = createFederalTaxCalculator()
    const ctx = createDecisionContext(plan, { startYear: 2026, taxCalculator })
    const bad = evaluateCandidate(ctx, candidate('not-finite', 35_000))
    const good = evaluateCandidate(ctx, candidate('finite', 36_000))
    expect(() =>
      attachStochasticMetrics(ctx, [bad, good], {
        startYear: 2026,
        taxCalculator,
        model: buildLognormalModelConfigForPlan(plan, 12),
        pathCount: 10,
        seed: 7,
      }),
    ).not.toThrow()
    expect(bad.stochastic).toBeUndefined()
    expect(bad.diagnostics).toContain(STOCHASTIC_METRICS_NOT_FINITE_DIAGNOSTIC)
    expect(good.stochastic).toBeDefined()
    expect(good.diagnostics).not.toContain(STOCHASTIC_METRICS_NOT_FINITE_DIAGNOSTIC)
    // The resilience policy refuses the candidate with a reason.
    const policy = makeMaximizeDownsideResilience()
    expect(policy.constraintViolations(bad, ctx)).toContain('stochastic metrics unavailable for robust ranking')
    expect(policy.constraintViolations(good, ctx)).not.toContain('stochastic metrics unavailable for robust ranking')
  })
})
