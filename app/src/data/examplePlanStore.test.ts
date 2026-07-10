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
import { createEmptyPlan, parsePlan, type Plan } from '../engine/model/plan'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { saveFreshDemo, saveExampleToMyPlans } from '../planner/examples/loadExample'
import { serializeV2Backup, normalizePlansForImport } from './v2Backup'

let counter = 0
const testIds = () => `store-${++counter}`
const fixedNow = () => new Date('2026-06-11T12:00:00.000Z')

function newPlan(name: string): Plan {
  return { ...createEmptyPlan({ newId: testIds, now: fixedNow }), name }
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

    const converted = await convertExampleToUserPlan(saved.plan, { newId: () => 'user-plan-1', now: fixedNow })
    expect(converted.ok).toBe(true)

    expect(await countStoredPlans()).toBe(1)
    const loaded = await loadPlan('user-plan-1')
    expect(loaded.ok).toBe(true)
    if (loaded.ok) {
      expect(loaded.plan.origin).toBe('user')
      expect(loaded.plan.exampleSourceId).toBe('example-couple')
    }
    expect((await loadPlan(exampleStorageId('example-couple'))).ok).toBe(false)
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
    const normalized = await normalizePlansForImport([demo])
    expect(normalized).toHaveLength(1)
    expect(normalized[0]!.origin).toBe('user')
    expect(normalized[0]!.id).not.toMatch(/^example:/)
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
