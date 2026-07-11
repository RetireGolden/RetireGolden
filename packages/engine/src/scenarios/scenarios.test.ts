import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan, type Scenario } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { applyScenarioPatch, compareScenarios, diffScenarioPatch } from './scenarios.js'

let counter = 0
const testIds = () => `sc-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [taxable(1_000_000)]
  return plan
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('applyScenarioPatch', () => {
  it('deep-merges nested objects and leaves the rest of the plan intact', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { assumptions: { inflationPct: 4 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.assumptions.inflationPct).toBe(4)
    expect(r.plan.assumptions.defaultReturnPct).toBe(5) // sibling untouched
    expect(r.plan.expenses.baseAnnual).toBe(40_000)
    expect(plan.assumptions.inflationPct).toBe(2.5) // base not mutated
  })

  it('replaces arrays wholesale and merges discriminated unions by replacement', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, {
      expenses: { oneTimeGoals: [{ id: 'g1', label: 'Roof', year: 2030, amount: 30_000 }] },
      assumptions: { ssHaircut: { fromYear: 2034, cutPct: 19 } },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.expenses.oneTimeGoals).toHaveLength(1)
    expect(r.plan.assumptions.ssHaircut).toEqual({ fromYear: 2034, cutPct: 19 })
  })

  it('rejects overrides that fail schema validation', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { assumptions: { inflationPct: 'lots' } })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.issues.join(' ')).toContain('assumptions.inflationPct')
  })

  it('cannot change schema version, id, or the scenario list itself', () => {
    const plan = validate(basePlan())
    const r = applyScenarioPatch(plan, { schemaVersion: 99, id: 'hijacked', scenarios: [{ bogus: true }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.id).toBe(plan.id)
    expect(r.plan.scenarios).toEqual(plan.scenarios)
  })
})

describe('diffScenarioPatch', () => {
  it('lists changed leaves with base and scenario values', () => {
    const plan = validate(basePlan())
    const diff = diffScenarioPatch(plan, {
      assumptions: { inflationPct: 4, ssHaircut: { fromYear: 2034, cutPct: 19 } },
    })
    expect(diff).toContainEqual({ path: 'assumptions.inflationPct', baseValue: 2.5, scenarioValue: 4 })
    // ssHaircut is null in the base, so the whole object shows as one change.
    expect(diff.some((d) => d.path === 'assumptions.ssHaircut')).toBe(true)
    expect(diff.some((d) => d.path === 'assumptions.defaultReturnPct')).toBe(false)
  })
})

describe('compareScenarios', () => {
  const opts = { startYear: 2026, taxCalculator: noTax }

  it('runs base plus scenarios and reflects overrides in the metrics', () => {
    const plan = validate(basePlan())
    plan.scenarios = [
      { id: 's1', name: 'Spend more', patch: { expenses: { baseAnnual: 90_000 } } },
      { id: 's2', name: '19% SS cut', patch: { assumptions: { ssHaircut: { fromYear: 2034, cutPct: 19 } } } },
    ]
    const cmp = compareScenarios(plan, opts)
    expect(cmp.rows).toHaveLength(3)
    const [base, spend, cut] = cmp.rows
    expect(base!.scenarioId).toBeNull()
    expect(spend!.error).toBeNull()
    expect(spend!.summary.endingInvestable).toBeLessThan(base!.summary.endingInvestable)
    expect(cut!.diff.some((d) => d.path === 'assumptions.ssHaircut')).toBe(true)
  })

  it('reports an error row for an invalid patch without sinking the table', () => {
    const plan = validate(basePlan())
    plan.scenarios = [{ id: 'bad', name: 'Broken', patch: { household: { filingStatus: 'royalty' } } } as Scenario]
    const cmp = compareScenarios(plan, opts)
    expect(cmp.rows).toHaveLength(2)
    expect(cmp.rows[1]!.error).toContain('invalid')
    expect(cmp.rows[0]!.error).toBeNull()
  })

  it('attaches Monte Carlo success rates when requested, same seed for every row', () => {
    const plan = validate(basePlan())
    plan.scenarios = [{ id: 's1', name: 'Spend way more', patch: { expenses: { baseAnnual: 150_000 } } }]
    const cmp = compareScenarios(plan, {
      ...opts,
      monteCarlo: { model: { type: 'lognormal', inflationMeanPct: 2.5 }, pathCount: 40, seed: 7 },
    })
    expect(cmp.rows[0]!.successRate).not.toBeNull()
    expect(cmp.rows[1]!.successRate).not.toBeNull()
    expect(cmp.rows[1]!.successRate!).toBeLessThanOrEqual(cmp.rows[0]!.successRate!)
  })
})
