/**
 * A scenario survives every route a plan can travel (decision
 * D-SCENARIO-JSON-LOSS, G4).
 *
 * The "No guardrails" example scenario was a loose patch whose meaning lived
 * in JavaScript `undefined`, so every JSON route (a backup, the single-plan
 * copy handed to the MCP, a JSON library such as RetireGolden-Pro's) stored
 * `{ "expenses": {} }` and the scenario silently became the base plan. These
 * tests run every embedded example scenario through every route and hold the
 * applied plan to the one the app applies; scan every patch the app can save
 * for an `undefined` on a merged object key; convert a stored legacy patch at
 * load; and show that a scenario that lost its meaning says it changes nothing.
 */
import { describe, expect, it } from 'vitest'

import { migratePlanToCurrent } from '@retiregolden/engine/model/migrations'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { registry } from '@retiregolden/engine/insights/registry'
import { runScreen } from '@retiregolden/engine/insights/runInsights'
import { packForYear } from '@retiregolden/engine/params'
import { relocationScenarioPatch } from '@retiregolden/engine/projection/relocation'
import {
  canonicalScenarioJson,
  legacyPatchReliesOnUndefined,
  scenarioChangesNothing,
} from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch, compareScenarios } from '@retiregolden/engine/scenarios/scenarios'

import { appExamplePlans } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from '../planner/examples/buildContext'
import { taxCalculatorFor } from '../planTaxCalculator'
import { projectPlan } from '../projection'
import { parseV2Backup, serializeSinglePlan, serializeV2Backup } from './planFormat'
import { normalizePlansForImport } from './v2Backup'
import { cloneAsUserPlan, convertedFromExample } from './planStore'

const fixedNow = () => new Date('2026-06-29T12:00:00.000Z')

function ok(result: { ok: true; plan: Plan } | { ok: false }, label: string): Plan {
  if (!result.ok) throw new Error(`${label}: ${JSON.stringify(result)}`)
  return result.plan
}

function parsed(document: unknown, label: string): Plan {
  const result = parsePlan(document)
  if (!result.ok) throw new Error(`${label}: ${result.issues.join('; ')}`)
  return result.plan
}

async function backup(plan: Plan): Promise<Plan> {
  const restored = parseV2Backup(serializeV2Backup([plan], fixedNow))
  if (!restored.ok) throw new Error(`backup: ${restored.reason}`)
  return (await normalizePlansForImport(restored.plans, []))[0]!
}

const saved = (plan: Plan): Plan => ok(convertedFromExample(plan, { newId: () => 'saved-id', now: fixedNow }), 'save')

/** Every route a stored plan can travel, as the app and its hosts run them. */
const ROUTES: Record<string, (plan: Plan) => Promise<Plan>> = {
  'browser store (structured clone, then load)': async (plan) => ok(migratePlanToCurrent(structuredClone(plan)), 'store'),
  Duplicate: async (plan) => cloneAsUserPlan(plan, { newId: () => 'duplicate-id', now: fixedNow }).clone,
  'Save to My Plans': async (plan) => saved(plan),
  'plain JSON': async (plan) => parsed(JSON.parse(JSON.stringify(plan)), 'json'),
  'backup export and import': backup,
  'single-plan JSON (the MCP hand-off)': async (plan) =>
    parsed((JSON.parse(serializeSinglePlan(plan, EXAMPLE_FIXED_YEAR)) as { plan: unknown }).plan, 'single'),
  'Save to My Plans, then backup': async (plan) => backup(saved(plan)),
  'a JSON library (RetireGolden-Pro: stringify, parse, load)': async (plan) =>
    ok(migratePlanToCurrent(JSON.parse(JSON.stringify(plan))), 'library'),
}

/** The fields a scenario may change, as canonical JSON. */
const editable = (plan: Plan): string =>
  canonicalScenarioJson({ ...plan, id: '', name: '', origin: '', exampleSourceId: '', createdAtIso: '', updatedAtIso: '', scenarios: [] })

/** `undefined` values reached through plain objects only (a merged key), with their paths. */
function undefinedOnMergedKeys(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, item]) => {
    const at = path === '' ? key : `${path}.${key}`
    return item === undefined ? [at] : undefinedOnMergedKeys(item, at)
  })
}

describe('every example scenario survives every save route (D-SCENARIO-JSON-LOSS, G4)', () => {
  const examples = appExamplePlans().filter(({ plan }) => plan.scenarios.length > 0)

  it('has example scenarios to test', () => {
    expect(examples.map(({ id }) => id)).toContain('guardrails-flex-goals')
  })

  for (const { id, plan } of examples) {
    it(`${id}: the applied plan is the app's after every route`, async () => {
      for (const [route, travel] of Object.entries(ROUTES)) {
        const routed = await travel(structuredClone(plan))
        expect(routed.scenarios.map((s) => s.name), `${route}`).toEqual(plan.scenarios.map((s) => s.name))
        for (const scenario of routed.scenarios) {
          const inApp = applyScenarioPatch(plan, plan.scenarios.find((s) => s.name === scenario.name)!.patch)
          const applied = applyScenarioPatch(routed, scenario.patch)
          expect(inApp.ok, `${route} / ${scenario.name} in the app`).toBe(true)
          expect(applied.ok, `${route} / ${scenario.name}`).toBe(true)
          if (!inApp.ok || !applied.ok) continue
          expect(editable(applied.plan), `${route} / ${scenario.name}`).toBe(editable(inApp.plan))
          expect(scenarioChangesNothing(routed, applied.plan), `${route} / ${scenario.name}`).toBe(false)
        }
      }
    }, 120_000)
  }

  it('keeps the guardrails scenario doing what it did: removing the policy and the floor', () => {
    const guardrails = examples.find(({ id }) => id === 'guardrails-flex-goals')!.plan
    const applied = applyScenarioPatch(guardrails, guardrails.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return
    expect(applied.plan.expenses.spendingPolicy).toBeUndefined()
    expect(applied.plan.expenses.requiredAnnual).toBeUndefined()
    expect(guardrails.expenses.spendingPolicy).toBeDefined()
    expect(guardrails.expenses.requiredAnnual).toBe(34_000)
  })
})

describe('no patch the app can store relies on undefined', () => {
  it('scans the example scenarios, both insight passes, the relocation compare and the spending solver', () => {
    const found: string[] = []
    let scanned = 0
    for (const { id, plan } of appExamplePlans()) {
      for (const scenario of plan.scenarios) {
        scanned++
        for (const at of undefinedOnMergedKeys(scenario.patch)) found.push(`${id} scenario "${scenario.name}": ${at}`)
      }
      const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
      const ctx = { plan, projection: detectorProjection(view.result, view.summary), params: packForYear(view.startYear).pack }
      for (const card of runScreen(ctx)) {
        const action = card.action as { kind: string; patch?: unknown }
        if (action.kind !== 'preview-scenario') continue
        scanned++
        for (const at of undefinedOnMergedKeys(action.patch)) found.push(`${id} insight ${card.id}: ${at}`)
        const detector = registry.find((d) => d.id === card.id)
        if (detector?.evaluate === undefined) continue
        const evaluated = detector.evaluate(ctx).action as { kind: string; patch?: unknown }
        if (evaluated.kind !== 'preview-scenario') continue
        scanned++
        for (const at of undefinedOnMergedKeys(evaluated.patch)) found.push(`${id} insight ${card.id} (evaluated): ${at}`)
      }
      for (const state of ['FL', 'TX', 'KY', 'CA']) {
        scanned++
        const patch = relocationScenarioPatch(plan, { state, localRatePct: 1, spendingDeltaPct: -5 }, EXAMPLE_FIXED_YEAR)
        for (const at of undefinedOnMergedKeys(patch)) found.push(`${id} relocation ${state}: ${at}`)
      }
      // The spending solver's "Add as scenario" (SpendingSolverPage).
      scanned++
      for (const at of undefinedOnMergedKeys({ expenses: { baseAnnual: plan.expenses.baseAnnual } })) found.push(`${id} solver: ${at}`)
    }
    expect(scanned).toBeGreaterThan(29)
    expect(found).toEqual([])
  }, 300_000)
})

describe('a stored legacy patch that relies on undefined', () => {
  function withLegacyGuardrailsPatch(): Plan {
    const plan = appExamplePlans().find(({ id }) => id === 'guardrails-flex-goals')!.plan
    return {
      ...plan,
      scenarios: [
        {
          id: 'legacy-no-guard',
          name: 'No guardrails (saved before the fix)',
          patch: { expenses: { spendingPolicy: undefined, requiredAnnual: undefined } },
        },
      ],
    }
  }

  it('is converted at load, reported, and then survives a backup', async () => {
    const stored = withLegacyGuardrailsPatch()
    expect(legacyPatchReliesOnUndefined(stored.scenarios[0]!.patch)).toBe(true)
    const loaded = migratePlanToCurrent(structuredClone(stored))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.repairs).toContainEqual({ kind: 'legacyScenarioConverted', scenarioId: 'legacy-no-guard', scenarioName: 'No guardrails (saved before the fix)' })
    const restored = await backup(loaded.plan)
    const applied = applyScenarioPatch(restored, restored.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.spendingPolicy).toBeUndefined()
  })

  it('is converted before a JSON export too', async () => {
    const restored = await backup(withLegacyGuardrailsPatch())
    const applied = applyScenarioPatch(restored, restored.scenarios[0]!.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.requiredAnnual).toBeUndefined()
    const single = parsed((JSON.parse(serializeSinglePlan(withLegacyGuardrailsPatch(), EXAMPLE_FIXED_YEAR)) as { plan: unknown }).plan, 'single')
    const fromSingle = applyScenarioPatch(single, single.scenarios[0]!.patch)
    expect(fromSingle.ok && fromSingle.plan.expenses.spendingPolicy).toBeFalsy()
  })

  it('says it changes nothing once a file has already lost its meaning', () => {
    const lost = { ...withLegacyGuardrailsPatch(), scenarios: [{ id: 'lost', name: 'No guardrails', patch: { expenses: {} } }] }
    const plan = parsed(lost, 'lost')
    const rows = compareScenarios(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) }).rows
    expect(rows.map((row) => row.changesNothing)).toEqual([false, true])
  })
})
