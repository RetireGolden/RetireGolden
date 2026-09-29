/**
 * A scenario's meaning survives JSON, and a scenario that changes nothing is
 * known to (decision D-SCENARIO-JSON-LOSS). The planner-ui route test
 * (data/scenarioSaveRoutes.test.ts) runs the library examples through every
 * save route; these pin the engine helpers it relies on.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { isScenarioPatchEnvelope } from './contract.js'
import {
  convertUndefinedLegacyScenarioPatches,
  legacyPatchReliesOnUndefined,
  scenarioChangesNothing,
} from './patch.js'
import { applyScenarioPatch, compareScenarios } from './scenarios.js'

function guardedPlan(scenarios: Plan['scenarios'] = []): Plan {
  const plan = createEmptyPlan({ newId: () => 'json-loss', now: () => new Date('2026-06-29T12:00:00.000Z') })
  plan.expenses.baseAnnual = 76_000
  plan.expenses.requiredAnnual = 58_000
  plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', upperGuardrailPct: 125 }
  plan.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 900_000, annualContribution: 0 }]
  plan.scenarios = scenarios
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const removing = { expenses: { spendingPolicy: undefined, requiredAnnual: undefined } }

describe('legacyPatchReliesOnUndefined', () => {
  it('finds undefined on a key the merge reaches, and not inside an array or in an envelope', () => {
    expect(legacyPatchReliesOnUndefined(removing)).toBe(true)
    expect(legacyPatchReliesOnUndefined({ expenses: { baseAnnual: 1 } })).toBe(false)
    expect(legacyPatchReliesOnUndefined({ accounts: [{ id: 'a', allocation: undefined }] })).toBe(false)
    expect(legacyPatchReliesOnUndefined(null)).toBe(false)
  })
})

describe('convertUndefinedLegacyScenarioPatches', () => {
  it('rewrites the patch as two remove operations that survive JSON, and applies the same plan', () => {
    const plan = guardedPlan([{ id: 's', name: 'No guardrails', patch: removing }])
    const before = applyScenarioPatch(plan, plan.scenarios[0]!.patch)
    const { plan: converted, converted: list } = convertUndefinedLegacyScenarioPatches(plan)
    expect(list).toEqual([{ scenarioId: 's', scenarioName: 'No guardrails' }])
    const patch = converted.scenarios[0]!.patch
    expect(isScenarioPatchEnvelope(patch)).toBe(true)
    const throughJson = JSON.parse(JSON.stringify(converted)) as Plan
    const after = applyScenarioPatch(throughJson, throughJson.scenarios[0]!.patch)
    expect(before.ok && after.ok).toBe(true)
    if (before.ok && after.ok) {
      expect(after.plan.expenses.spendingPolicy).toBeUndefined()
      expect(after.plan.expenses.requiredAnnual).toBeUndefined()
      expect(scenarioChangesNothing(before.plan, after.plan)).toBe(true)
    }
  })

  it('leaves a plan with nothing to convert as it is', () => {
    const plan = guardedPlan([{ id: 's', name: 'Spend more', patch: { expenses: { baseAnnual: 80_000 } } }])
    const result = convertUndefinedLegacyScenarioPatches(plan)
    expect(result.plan).toBe(plan)
    expect(result.converted).toEqual([])
  })

  it('leaves a patch that removes nothing the plan holds, since no operation results', () => {
    const plan = guardedPlan([{ id: 's', name: 'Nothing', patch: { expenses: { idealAnnual: undefined } } }])
    expect(convertUndefinedLegacyScenarioPatches(plan).converted).toEqual([])
  })
})

describe('a scenario that changes nothing', () => {
  it('is marked on its comparison row, and a scenario that changes something is not', () => {
    const plan = guardedPlan([
      { id: 'lost', name: 'No guardrails (after a JSON export)', patch: { expenses: {} } },
      { id: 'real', name: 'Spend more', patch: { expenses: { baseAnnual: 80_000 } } },
    ])
    const rows = compareScenarios(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0.15) }).rows
    expect(rows.map((row) => [row.name, row.changesNothing])).toEqual([
      ['Base plan', false],
      ['No guardrails (after a JSON export)', true],
      ['Spend more', false],
    ])
  })
})
