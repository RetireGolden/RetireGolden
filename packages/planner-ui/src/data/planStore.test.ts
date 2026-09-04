import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import {
  ownedNonRothIraAnnualFilingSourceRecord,
  traditionalAccount,
} from '@retiregolden/engine/testing/planFixtures'
import {
  _resetPlanStoreForTests,
  clearAllPlans,
  deletePlan,
  duplicatePlan,
  listPlanSummaries,
  loadPlan,
  PLAN_DB_NAME,
  PLAN_STORAGE_UNAVAILABLE,
  savePlan,
} from './planStore'

let counter = 0
const testIds = () => `store-${++counter}`
const fixedNow = () => new Date('2026-06-11T12:00:00.000Z')

function newPlan(name: string): Plan {
  return { ...createEmptyPlan({ newId: testIds, now: fixedNow }), name }
}

function addCanonicalScenario(plan: Plan): void {
  const edited = structuredClone(plan)
  edited.expenses.baseAnnual = 12_345
  const created = createScenarioPatch(plan, edited, {
    title: 'Higher spending',
    createdAtIso: fixedNow().toISOString(),
    actor: { kind: 'user' },
  })
  if (!created.ok) throw new Error(created.issues.join('; '))
  plan.scenarios.push({
    id: 'scenario-1',
    name: created.patch.title,
    patch: created.patch,
  })
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
      ownerPersonId: plan.household.people[0].id,
      annualReturnPct: null,
      balance: 100_000,
      annualContribution: 0,
    })
    addCanonicalScenario(plan)
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
    expect(duplicated.plan.accounts[0].id).toBe('acct-1')
    const applied = applyScenarioPatch(duplicated.plan, duplicated.plan.scenarios[0].patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.baseAnnual).toBe(12_345)
    expect((await listPlanSummaries()).map((s) => s.name)).toEqual(['A/B copy', 'Original'])
  })

  it('discards Plan-id-bound annual tax facts when duplicating', async () => {
    const plan = newPlan('Authoritative source')
    const ownerPersonId = plan.household.people[0].id
    plan.accounts = [traditionalAccount('ira-1', 10_000, ownerPersonId)]
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(
          plan,
          ownerPersonId,
          ['ira-1'],
        ),
      ],
    }
    await savePlan(plan, fixedNow)

    const duplicated = await duplicatePlan(plan.id, {
      newId: () => 'copy-without-authoritative-source',
      now: fixedNow,
    })

    expect(duplicated.ok).toBe(true)
    if (duplicated.ok) {
      expect(duplicated.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    }
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

describe('planStore connection failures', () => {
  it('names the reason on a host with no IndexedDB instead of throwing a ReferenceError', async () => {
    const real = globalThis.indexedDB
    // @ts-expect-error modelling a host that exposes no IndexedDB at all
    delete globalThis.indexedDB
    try {
      await expect(listPlanSummaries()).rejects.toThrow(PLAN_STORAGE_UNAVAILABLE)
    } finally {
      globalThis.indexedDB = real
    }
  })

  it('does not cache a rejected open, so a later read can still succeed', async () => {
    // A newer deploy in another tab left the database at a higher version, so
    // opening at DB_VERSION fails with a VersionError. This is the real shape
    // of the transient failure: recoverable, and previously fatal for the tab
    // because the rejected promise stayed in the memo.
    const ahead = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = globalThis.indexedDB.open(PLAN_DB_NAME, 2)
      request.onupgradeneeded = () => undefined
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    await expect(listPlanSummaries()).rejects.toThrow()

    ahead.close()
    await new Promise<void>((resolve) => {
      const request = globalThis.indexedDB.deleteDatabase(PLAN_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })

    // The retry is the whole point: with the rejection memoised this still
    // rejects, and every read and write stays dead for the tab's lifetime.
    await expect(listPlanSummaries()).resolves.toEqual([])
  })
})
