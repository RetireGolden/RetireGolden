import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'

import { describePlanStoreContract, type PlanDocOverrides } from './planStoreContract'
import { indexedDbPlanStore } from './planStoreContext'
import { _resetPlanStoreForTests } from './planStore'

let counter = 0
const testIds = () => `contract-${++counter}`
const fixedNow = () => new Date('2026-06-11T12:00:00.000Z')

function makePlan(overrides: PlanDocOverrides = {}): Plan {
  const plan: Plan = { ...createEmptyPlan({ newId: testIds, now: fixedNow }) }
  if (overrides.id !== undefined) plan.id = overrides.id
  if (overrides.name !== undefined) plan.name = overrides.name
  if (overrides.updatedAtIso !== undefined) plan.updatedAtIso = overrides.updatedAtIso
  return plan
}

// A schema-1-era shape: fields the current schema no longer carries and none
// of its later additions. The store must round-trip it untouched — migration
// happens in the seam layer (`loadPlanVia`), never in a store.
function makeLegacyPlan(overrides: PlanDocOverrides = {}): Plan {
  const legacy = {
    schemaVersion: 1,
    id: overrides.id ?? testIds(),
    name: overrides.name ?? `legacy-${testIds()}`,
    updatedAtIso: overrides.updatedAtIso ?? '2024-03-01T00:00:00.000Z',
    people: [{ name: 'Sam', birthYear: 1970 }],
    accounts: [{ kind: 'taxable', balance: 125000 }],
    legacyOnlyField: 'kept-verbatim',
  }
  return legacy as unknown as Plan
}

describePlanStoreContract('indexedDbPlanStore', {
  createStore: () => {
    // A fresh backing database per test: swap in a new fake IndexedDB and drop
    // the store's cached connection so it reopens against the empty database.
    globalThis.indexedDB = new IDBFactory()
    _resetPlanStoreForTests()
    return indexedDbPlanStore
  },
  makePlan,
  makeLegacyPlan,
})
