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

describePlanStoreContract('indexedDbPlanStore', {
  createStore: () => {
    // A fresh backing database per test: swap in a new fake IndexedDB and drop
    // the store's cached connection so it reopens against the empty database.
    globalThis.indexedDB = new IDBFactory()
    _resetPlanStoreForTests()
    return indexedDbPlanStore
  },
  makePlan,
})
