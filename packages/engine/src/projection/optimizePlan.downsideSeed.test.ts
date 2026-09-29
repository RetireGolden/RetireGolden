/**
 * The Optimize tournament's downside-resilience metric draws its 200 paths
 * from the engine's default seed on the headline model (decision
 * D-MC-DEFAULT-SEED, 2026-09-28; review finding M3, S12), so they are the
 * first 200 paths of the plan's headline run.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../montecarlo/sharedPaths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../montecarlo/sharedPaths.js')>()
  return { ...actual, comparePlansOnSharedMarketPaths: vi.fn(actual.comparePlansOnSharedMarketPaths) }
})

import { objectivePolicies } from '../decisions/objectives.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { buildLognormalModelConfigForPlan } from '../montecarlo/marketModels.js'
import { comparePlansOnSharedMarketPaths } from '../montecarlo/sharedPaths.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { runExactLedgerTournament } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

function retiree(): Plan {
  let counter = 0
  const plan = createEmptyPlan({ newId: () => `seed-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 75, source: 'manual' },
  }
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: 'ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 900_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('the tournament downside-resilience metric', () => {
  it('runs 200 paths on the default seed, 6,221,293, with the headline model', () => {
    const plan = retiree()
    const options = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    runExactLedgerTournament(plan, simulatePlan(plan, options), null, options, {
      search: false,
      policy: objectivePolicies['max-downside-resilience'],
    })
    const calls = vi.mocked(comparePlansOnSharedMarketPaths).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const opts = calls.at(-1)![1]
    expect(opts.seed).toBe(6_221_293)
    expect(opts.pathCount).toBe(200)
    expect(opts.model).toStrictEqual(buildLognormalModelConfigForPlan(plan, 12))
  }, 120_000)
})
