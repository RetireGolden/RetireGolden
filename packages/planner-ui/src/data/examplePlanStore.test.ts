import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import { exampleStorageId } from './planOrigin'
import {
  _resetPlanStoreForTests,
  convertExampleToUserPlan,
  countStoredPlans,
  duplicatePlan,
  listExampleSummaries,
  listUserPlanSummaries,
  loadPlan,
  savePlan,
} from './planStore'
import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import {
  ownedNonRothIraAnnualFilingSourceRecord,
  traditionalAccount,
} from '@retiregolden/engine/testing/planFixtures'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { saveFreshDemo, saveExampleToMyPlans } from '../planner/examples/loadExample'
import { serializeV2Backup, normalizePlansForImport } from './v2Backup'

let counter = 0
const testIds = () => `store-${++counter}`
const fixedNow = () => new Date('2026-06-11T12:00:00.000Z')

const POPULATED_ANNUAL_FEDERAL_TAX_FACTS: Plan['annualFederalTaxFacts'] = {
  foreignIncomeAdjustments: [
    {
      year: 2040,
      foreignExclusionAddback: {
        state: 'known',
        amount: 600.125,
        provenance: {
          sourceKind: 'foreignExclusionAggregateWorkpaper',
          acquisition: 'import',
          sourceLabel: 'PRIVATE-3D-A',
        },
      },
      niitSection911A1NetAddback: {
        state: 'known',
        amount: 250.25,
        provenance: {
          sourceKind: 'form8960Line13AllocationWorksheet',
          acquisition: 'import',
          sourceLabel: ' PRIVATE-3D-B ',
        },
      },
    },
    {
      year: 2027,
      foreignExclusionAddback: {
        state: 'known',
        amount: 0,
        provenance: {
          sourceKind: 'planningEstimate',
          acquisition: 'manual',
          sourceLabel: 'PRIVATE-3D-C',
        },
      },
      niitSection911A1NetAddback: {
        state: 'notApplicable',
        amount: null,
        provenance: {
          sourceKind: 'taxProfessionalWorkpaper',
          acquisition: 'import',
          sourceLabel: 'PRIVATE-3D-D',
        },
      },
    },
    {
      year: 2026,
      foreignExclusionAddback: {
        state: 'notApplicable',
        amount: null,
        provenance: {
          sourceKind: 'userAttestation',
          acquisition: 'manual',
          sourceLabel: 'PRIVATE-3D-E',
        },
      },
      niitSection911A1NetAddback: {
        state: 'unknown',
        amount: null,
        provenance: {
          sourceKind: 'unresolvedSource',
          acquisition: 'manual',
          sourceLabel: 'PRIVATE-3D-F <b>"source"</b>',
        },
      },
    },
  ],
}

function populatedAnnualEvidencePlan(planId?: string): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow, name: 'Annual evidence' })
  if (planId) plan.id = planId
  const ownerPersonId = plan.household.people[0]!.id
  plan.accounts = [traditionalAccount('ira-1', 10_000, ownerPersonId)]
  plan.annualFederalTaxFacts = structuredClone(POPULATED_ANNUAL_FEDERAL_TAX_FACTS)
  plan.retirementActionAnnualTaxFacts = {
    ownedNonRothIraAnnualFilingSourceRecords: [
      ownedNonRothIraAnnualFilingSourceRecord(plan, ownerPersonId, ['ira-1']),
    ],
  }
  const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)
  const iraSnapshot = structuredClone(plan.retirementActionAnnualTaxFacts)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  expect(parsed.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
  expect(parsed.plan.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)
  return parsed.plan
}

function newPlan(name: string): Plan {
  return { ...createEmptyPlan({ newId: testIds, now: fixedNow }), name }
}

function addCanonicalScenario(plan: Plan): void {
  const edited = structuredClone(plan)
  edited.expenses.baseAnnual += 12_345
  const created = createScenarioPatch(plan, edited, {
    title: 'Higher spending',
    createdAtIso: fixedNow().toISOString(),
    actor: { kind: 'user' },
  })
  if (!created.ok) throw new Error(created.issues.join('; '))
  plan.scenarios.push({
    id: 'canonical-scenario',
    name: created.patch.title,
    patch: created.patch,
  })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
})

describe('example plan isolation', () => {
  it('hides demos from user plan list', async () => {
    await savePlan(newPlan('Mine'))
    await saveFreshDemo(EXAMPLE_PLANS[0]!)

    const userPlans = await listUserPlanSummaries()
    expect(userPlans).toHaveLength(1)
    expect(userPlans[0]!.name).toBe('Mine')
  })

  it('lists only example demos', async () => {
    await savePlan(newPlan('Mine'))
    await saveFreshDemo(EXAMPLE_PLANS[0]!)
    await saveFreshDemo(EXAMPLE_PLANS[1]!)

    const demos = await listExampleSummaries()
    expect(demos).toHaveLength(2)
    expect(demos.every((summary) => summary.origin === 'example')).toBe(true)
    expect(demos.map((summary) => summary.id).sort()).toEqual(
      [exampleStorageId(EXAMPLE_PLANS[0]!.id), exampleStorageId(EXAMPLE_PLANS[1]!.id)].sort(),
    )
  })

  it('treats missing origin as user on raw records', async () => {
    const plan = newPlan('Legacy')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { origin, ...legacy } = plan
    await (await import('idb')).openDB('retiregolden.v2', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath: 'id' })
      },
    }).then(async (db) => {
      await db.put('plans', legacy)
    })

    const summaries = await listUserPlanSummaries()
    expect(summaries.map((s) => s.name)).toContain('Legacy')
  })

  it('defaults origin to user via parsePlan for legacy shape', () => {
    const plan = newPlan('Parsed legacy')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { origin, ...withoutOrigin } = plan
    const parsed = parsePlan(withoutOrigin)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.plan.origin).toBe('user')
  })

  it('atomic convert removes demo and creates one user plan', async () => {
    const saved = await saveFreshDemo(EXAMPLE_PLANS[0]!)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    addCanonicalScenario(saved.plan)

    const converted = await convertExampleToUserPlan(saved.plan, { newId: () => 'user-plan-1', now: fixedNow })
    expect(converted.ok).toBe(true)

    expect(await countStoredPlans()).toBe(1)
    const loaded = await loadPlan('user-plan-1')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.plan.origin).toBe('user')
      expect(loaded.plan.exampleSourceId).toBe('example-couple')
      const scenario = loaded.plan.scenarios.find(({ id }) => id === 'canonical-scenario')!
      expect(applyScenarioPatch(loaded.plan, scenario.patch).ok).toBe(true)
    }
    expect((await loadPlan(exampleStorageId('example-couple'))).ok).toBe(false)
  })

  it('discards authoritative Plan-id-bound facts on example conversion and import re-keying', async () => {
    const demo = newPlan('Example with filing source')
    demo.id = 'example:filing-source'
    demo.origin = 'example'
    const ownerPersonId = demo.household.people[0]!.id
    demo.accounts = [traditionalAccount('ira-1', 10_000, ownerPersonId)]
    demo.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(
          demo,
          ownerPersonId,
          ['ira-1'],
        ),
      ],
    }

    const saved = await savePlan(demo, fixedNow)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const converted = await convertExampleToUserPlan(saved.plan, {
      newId: () => 'converted-user-plan',
      now: fixedNow,
    })
    expect(converted.ok).toBe(true)
    if (converted.ok) {
      expect(converted.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    }

    const normalized = await normalizePlansForImport(
      [structuredClone(demo)],
      ['example:filing-source'],
    )
    expect(normalized[0]!.id).not.toBe(demo.id)
    expect(normalized[0]).not.toHaveProperty('retirementActionAnnualTaxFacts')
  })

  it('saveExampleToMyPlans preserves populated federal annual facts and drops IRA annual facts in the browser store', async () => {
    const demo = populatedAnnualEvidencePlan(exampleStorageId('example-couple'))
    demo.origin = 'example'
    demo.exampleSourceId = 'example-couple'
    const federalSnapshot = structuredClone(demo.annualFederalTaxFacts)
    const saved = await savePlan(demo, fixedNow)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const passedDemoSnapshot = structuredClone(saved.plan)

    const converted = await saveExampleToMyPlans(saved.plan, { newId: () => 'user-plan-evidence' })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return
    expect(converted.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(converted.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(converted.plan.origin).toBe('user')

    const loaded = await loadPlan('user-plan-evidence')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
      expect(loaded.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    }
    expect((await loadPlan(demo.id)).ok).toBe(false)
    expect(saved.plan).toEqual(passedDemoSnapshot)
  })

  it('saveExampleToMyPlans stamps updatedAtIso with the current time', async () => {
    const saved = await saveFreshDemo(EXAMPLE_PLANS[0]!)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const before = Date.now()
    const converted = await saveExampleToMyPlans(saved.plan, { newId: () => 'user-plan-now' })
    const after = Date.now()
    expect(converted.ok).toBe(true)
    if (converted.ok) {
      const updated = new Date(converted.plan.updatedAtIso).getTime()
      expect(updated).toBeGreaterThanOrEqual(before)
      expect(updated).toBeLessThanOrEqual(after)
      expect(converted.plan.updatedAtIso).not.toBe(saved.plan.updatedAtIso)
    }
  })

  it('duplicate always yields a user plan', async () => {
    const saved = await saveFreshDemo(EXAMPLE_PLANS[1]!)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const dup = await duplicatePlan(saved.plan.id, { newId: () => 'dup-1', now: fixedNow })
    expect(dup.ok).toBe(true)
    if (dup.ok) expect(dup.plan.origin).toBe('user')
  })

  it('normalizes imported example plans', async () => {
    const demo = EXAMPLE_PLANS[0]!.build()
    demo.id = exampleStorageId('example-couple')
    demo.origin = 'example'
    addCanonicalScenario(demo)
    const normalized = await normalizePlansForImport([demo])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.origin).toBe('user')
    expect(normalized[0]!.id).not.toMatch(/^example:/)
    const scenario = normalized[0]!.scenarios.find(({ id }) => id === 'canonical-scenario')!
    expect(applyScenarioPatch(normalized[0]!, scenario.patch).ok).toBe(true)
  })
})

describe('import normalization preserves populated federal annual evidence', () => {
  it('keeps both annual evidence roots when the user id does not collide', async () => {
    const plan = populatedAnnualEvidencePlan('stable-user-id')
    addCanonicalScenario(plan)
    const input = structuredClone(plan)
    const inputSnapshot = structuredClone(input)
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)
    const iraSnapshot = structuredClone(plan.retirementActionAnnualTaxFacts)

    const normalized = await normalizePlansForImport([input], ['other-user-id'])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.id).toBe('stable-user-id')
    expect(normalized[0]!.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(normalized[0]!.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)
    const parsed = parsePlan(normalized[0]!)
    expect(parsed.ok).toBe(true)

    const saved = await savePlan(normalized[0]!, fixedNow)
    expect(saved.ok).toBe(true)
    const loaded = await loadPlan('stable-user-id')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
      expect(loaded.plan.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)
    }
    expect(input).toEqual(inputSnapshot)
  })

  it('rekeys reserved example ids and drops only the IRA annual root', async () => {
    const plan = populatedAnnualEvidencePlan('example:reserved-slot')
    plan.origin = 'user'
    addCanonicalScenario(plan)
    const input = structuredClone(plan)
    const inputSnapshot = structuredClone(input)
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)

    const normalized = await normalizePlansForImport([input], ['taken-id'])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.id).not.toBe('example:reserved-slot')
    expect(normalized[0]!.id).not.toMatch(/^example:/)
    expect(normalized[0]!.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(normalized[0]).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(input).toEqual(inputSnapshot)
    const scenario = normalized[0]!.scenarios.find(({ id }) => id === 'canonical-scenario')!
    expect(applyScenarioPatch(normalized[0]!, scenario.patch).ok).toBe(true)
    expect(parsePlan(normalized[0]!).ok).toBe(true)
  })

  it('rekeys colliding ordinary user ids and drops only the IRA annual root', async () => {
    const plan = populatedAnnualEvidencePlan('colliding-user-id')
    addCanonicalScenario(plan)
    const input = structuredClone(plan)
    const inputSnapshot = structuredClone(input)
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)

    const normalized = await normalizePlansForImport([input], ['colliding-user-id'])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.id).not.toBe('colliding-user-id')
    expect(normalized[0]!.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(normalized[0]).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(input).toEqual(inputSnapshot)
    expect(parsePlan(normalized[0]!).ok).toBe(true)
  })

  it('rekeys example-origin plans even when the id is not reserved', async () => {
    const plan = populatedAnnualEvidencePlan('plain-user-id')
    plan.origin = 'example'
    const input = structuredClone(plan)
    const inputSnapshot = structuredClone(input)
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)

    const normalized = await normalizePlansForImport([input], ['ambient-id'])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.id).not.toBe('plain-user-id')
    expect(normalized[0]!.origin).toBe('user')
    expect(normalized[0]!.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(normalized[0]).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(input).toEqual(inputSnapshot)
    expect(parsePlan(normalized[0]!).ok).toBe(true)
  })
})

describe('v2 backup export excludes demos', () => {
  it('serialize only includes user plans in practice via picker export path', async () => {
    await savePlan(newPlan('User only'))
    await saveFreshDemo(EXAMPLE_PLANS[0]!)
    const userSummaries = await listUserPlanSummaries()
    const loaded: Plan[] = []
    for (const s of userSummaries) {
      const r = await loadPlan(s.id)
      if (r.ok) loaded.push(r.plan)
    }
    const json = serializeV2Backup(loaded)
    expect(json).toContain('User only')
    expect(json).not.toContain('Example couple')
  })
})
