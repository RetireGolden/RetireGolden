import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, type Plan } from '../engine/model/plan'
import {
  _resetPlanStoreForTests,
  clearAllPlans,
  deletePlan,
  duplicatePlan,
  listPlanSummaries,
  loadPlan,
  savePlan,
} from './planStore'

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

describe('planStore', () => {
  it('saves and reloads a plan intact', async () => {
    const plan = newPlan('Round trip')
    const saved = await savePlan(plan, fixedNow)
    expect(saved.ok).toBe(true)

    const loaded = await loadPlan(plan.id)
    expect(loaded.ok).toBe(true)
    if (loaded.ok && saved.ok) expect(loaded.plan).toEqual(saved.plan)
  })

  it('bumps updatedAtIso on save', async () => {
    const plan = newPlan('Stamped')
    const later = () => new Date('2027-01-01T00:00:00.000Z')
    const saved = await savePlan(plan, later)
    expect(saved.ok).toBe(true)
    if (saved.ok) expect(saved.plan.updatedAtIso).toBe('2027-01-01T00:00:00.000Z')
  })

  it('rejects invalid plans without writing', async () => {
    const bad = { ...newPlan('Bad'), name: '' }
    const result = await savePlan(bad, fixedNow)
    expect(result.ok).toBe(false)
    expect(await listPlanSummaries()).toHaveLength(0)
  })

  it('lists summaries sorted by recency', async () => {
    const a = newPlan('Older')
    const b = newPlan('Newer')
    await savePlan(a, () => new Date('2026-01-01T00:00:00.000Z'))
    await savePlan(b, () => new Date('2026-06-01T00:00:00.000Z'))

    const summaries = await listPlanSummaries()
    expect(summaries.map((s) => s.name)).toEqual(['Newer', 'Older'])
  })

  it('duplicates a plan with a fresh id and timestamps while preserving plan-local ids', async () => {
    const plan = newPlan('Original')
    plan.accounts.push({
      id: 'acct-1',
      name: 'IRA',
      type: 'traditional',
      kind: 'ira',
      ownerPersonId: plan.household.people[0]!.id,
      annualReturnPct: null,
      balance: 100_000,
      annualContribution: 0,
    })
    await savePlan(plan, fixedNow)

    const duplicated = await duplicatePlan(plan.id, {
      name: 'A/B copy',
      newId: () => 'copy-id',
      now: () => new Date('2026-06-12T12:00:00.000Z'),
    })

    expect(duplicated.ok).toBe(true)
    if (!duplicated.ok) return
    expect(duplicated.plan.id).toBe('copy-id')
    expect(duplicated.plan.name).toBe('A/B copy')
    expect(duplicated.plan.createdAtIso).toBe('2026-06-12T12:00:00.000Z')
    expect(duplicated.plan.updatedAtIso).toBe('2026-06-12T12:00:00.000Z')
    expect(duplicated.plan.accounts[0]!.id).toBe('acct-1')
    expect((await listPlanSummaries()).map((s) => s.name)).toEqual(['A/B copy', 'Original'])
  })

  it('duplicates from an in-memory source, not the stale stored copy', async () => {
    const plan = newPlan('Live edits')
    await savePlan(plan, fixedNow) // stored copy = "Live edits"
    // Simulate unsaved workspace edits not yet flushed to IndexedDB.
    const edited: Plan = { ...plan, expenses: { ...plan.expenses, baseAnnual: 99_999 } }

    const duplicated = await duplicatePlan(plan.id, { name: 'Copy', newId: () => 'copy-2', now: fixedNow, source: edited })

    expect(duplicated.ok).toBe(true)
    if (duplicated.ok) expect(duplicated.plan.expenses.baseAnnual).toBe(99_999) // the live edit, not the stored 0
  })

  it('returns not-ok for a missing id', async () => {
    const result = await loadPlan('nope')
    expect(result.ok).toBe(false)
  })

  it('deletes and clears', async () => {
    const a = newPlan('A')
    const b = newPlan('B')
    await savePlan(a, fixedNow)
    await savePlan(b, fixedNow)

    await deletePlan(a.id)
    expect((await listPlanSummaries()).map((s) => s.name)).toEqual(['B'])

    await clearAllPlans()
    expect(await listPlanSummaries()).toHaveLength(0)
  })
})
