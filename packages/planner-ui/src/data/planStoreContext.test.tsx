/** @vitest-environment jsdom */
/**
 * The plan-persistence seam, exercised through a fake host `PlanStore`:
 * the workspace loads/saves through the provided store, list views read it,
 * demo records stay browser-local, and "Save to my plans" is the crossing
 * point. The fake records every call so the tests can also prove what does
 * NOT cross the seam.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { createScenarioPatch } from '@retiregolden/engine/scenarios/patch'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import {
  ownedNonRothIraAnnualFilingSourceRecord,
  traditionalAccount,
} from '@retiregolden/engine/testing/planFixtures'
import { App } from '../App.tsx'
import { exampleStorageId } from './planOrigin'
import { _resetPlanStoreForTests, loadPlan, savePlan } from './planStore'
import {
  duplicatePlanVia,
  indexedDbPlanStore,
  listPlansVia,
  loadPlanVia,
  savePlanVia,
  type PlanStore,
  type PlanSummary,
} from './planStoreContext'
import { PlanStoreProvider } from './PlanStoreProvider'
import { PlanProvider } from '../planner/PlanContext'
import { usePlan } from '../planner/planContextCore'
import { saveExampleToMyPlans, saveFreshDemo } from '../planner/examples/loadExample'
import { EXAMPLE_PLANS } from '../planner/examples/registry'
import { createSamplePlan } from '../testSupport/samplePlan'
import { AUTOSAVE_SETTLE_MS, sleep, waitFor } from '../testSupport/settle'

let evidenceCounter = 0
const evidenceIds = () => `ctx-evidence-${++evidenceCounter}`
const evidenceNow = () => new Date('2026-07-11T12:00:00.000Z')

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
  const plan = createEmptyPlan({ newId: evidenceIds, now: evidenceNow, name: 'Annual evidence' })
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

function addReboundScenario(plan: Plan): void {
  const edited = structuredClone(plan)
  edited.expenses.baseAnnual += 9_876
  const created = createScenarioPatch(plan, edited, {
    title: 'Higher spending',
    createdAtIso: evidenceNow().toISOString(),
    actor: { kind: 'user' },
  })
  if (!created.ok) throw new Error(created.issues.join('; '))
  plan.scenarios.push({
    id: 'rebound-scenario',
    name: created.patch.title,
    patch: created.patch,
  })
}

/** In-memory PlanStore that records every call, standing in for a host adapter. */
function makeFakeStore() {
  const docs = new Map<string, unknown>()
  const calls: string[] = []
  const store: PlanStore = {
    async listPlans(): Promise<PlanSummary[]> {
      calls.push('listPlans')
      return [...docs.values()].map((doc) => {
        const p = doc as Plan
        return { id: p.id, name: p.name, updatedAtIso: p.updatedAtIso }
      })
    },
    async loadPlan(id: string): Promise<unknown> {
      calls.push(`loadPlan:${id}`)
      return docs.get(id) ?? null
    },
    async savePlan(plan: Plan): Promise<void> {
      calls.push(`savePlan:${plan.id}`)
      docs.set(plan.id, structuredClone(plan))
    },
    async deletePlan(id: string): Promise<void> {
      calls.push(`deletePlan:${id}`)
      docs.delete(id)
    },
  }
  return { store, docs, calls }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

describe('seam operations over a fake store', () => {
  it('loadPlanVia migrates+validates the stored document and reports a missing record as not_object', async () => {
    const { store, docs } = makeFakeStore()
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    const loaded = await loadPlanVia(store, sample.id)
    expect(loaded.ok && loaded.plan.name).toBe(sample.name)

    const missing = await loadPlanVia(store, 'nowhere')
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.reason).toBe('not_object')
  })

  it('savePlanVia stamps updatedAtIso, validates, and writes the checked plan to the store', async () => {
    const { store, docs, calls } = makeFakeStore()
    const sample = createSamplePlan()
    const fixedNow = () => new Date('2026-07-11T12:00:00.000Z')

    const saved = await savePlanVia(store, sample, fixedNow)
    expect(saved.ok).toBe(true)
    expect((docs.get(sample.id) as Plan).updatedAtIso).toBe('2026-07-11T12:00:00.000Z')

    // A validation failure never reaches the store.
    const broken = structuredClone(sample)
    broken.household.people = []
    const rejected = await savePlanVia(store, broken, fixedNow)
    expect(rejected.ok).toBe(false)
    expect(calls.filter((c) => c === `savePlan:${broken.id}`)).toHaveLength(1)
  })

  it('listPlansVia returns the store summaries newest first regardless of store order', async () => {
    const { store, docs } = makeFakeStore()
    const older = { ...createSamplePlan(), id: 'older', updatedAtIso: '2026-01-01T00:00:00.000Z' }
    const newer = { ...createSamplePlan(), id: 'newer', updatedAtIso: '2026-06-01T00:00:00.000Z' }
    docs.set(older.id, older)
    docs.set(newer.id, newer)

    const summaries = await listPlansVia(store)
    expect(summaries.map((s) => s.id)).toEqual(['newer', 'older'])
  })

  it.each([
    ['fake host store', () => makeFakeStore().store],
    ['indexedDbPlanStore', () => indexedDbPlanStore],
  ])(
    'savePlanVia and loadPlanVia preserve both populated annual evidence roots (%s)',
    async (_label, storeFactory) => {
      const store = storeFactory()
      const plan = populatedAnnualEvidencePlan()
      const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)
      const iraSnapshot = structuredClone(plan.retirementActionAnnualTaxFacts)

      const saved = await savePlanVia(store, plan, evidenceNow)
      expect(saved.ok).toBe(true)
      if (!saved.ok) return
      expect(saved.plan.updatedAtIso).toBe('2026-07-11T12:00:00.000Z')

      const loaded = await loadPlanVia(store, plan.id)
      expect(loaded.ok).toBe(true)
      if (!loaded.ok) return
      expect(loaded.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
      expect(loaded.plan.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)
    },
  )

  it('rejected savePlanVia does not overwrite stored annual evidence', async () => {
    const { store } = makeFakeStore()
    const plan = populatedAnnualEvidencePlan()
    const federalSnapshot = structuredClone(plan.annualFederalTaxFacts)
    const saved = await savePlanVia(store, plan, evidenceNow)
    expect(saved.ok).toBe(true)

    const broken = structuredClone(plan)
    broken.household.people = []
    const rejected = await savePlanVia(store, broken, evidenceNow)
    expect(rejected.ok).toBe(false)

    const reloaded = await loadPlanVia(store, plan.id)
    expect(reloaded.ok).toBe(true)
    if (reloaded.ok) expect(reloaded.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
  })

  it('duplicatePlanVia drops IRA annual facts but preserves the federal root from stored source', async () => {
    const { store } = makeFakeStore()
    const source = populatedAnnualEvidencePlan('source-stored')
    addReboundScenario(source)
    const federalSnapshot = structuredClone(source.annualFederalTaxFacts)
    const iraSnapshot = structuredClone(source.retirementActionAnnualTaxFacts)
    await savePlanVia(store, source, evidenceNow)

    const dup = await duplicatePlanVia(store, source.id, {
      name: 'Evidence clone',
      newId: () => 'clone-stored',
      now: evidenceNow,
    })
    expect(dup.ok).toBe(true)
    if (!dup.ok) return
    expect(dup.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(dup.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(dup.plan.origin).toBe('user')
    expect(dup.plan.id).toBe('clone-stored')

    const reloadedClone = await loadPlanVia(store, 'clone-stored')
    expect(reloadedClone.ok).toBe(true)
    if (reloadedClone.ok) {
      expect(reloadedClone.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
      expect(reloadedClone.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
      const scenario = reloadedClone.plan.scenarios.find(({ id }) => id === 'rebound-scenario')!
      expect(applyScenarioPatch(reloadedClone.plan, scenario.patch).ok).toBe(true)
    }

    const reloadedSource = await loadPlanVia(store, source.id)
    expect(reloadedSource.ok).toBe(true)
    if (reloadedSource.ok) {
      expect(reloadedSource.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
      expect(reloadedSource.plan.retirementActionAnnualTaxFacts).toEqual(iraSnapshot)
    }
  })

  it('duplicatePlanVia follows explicit live source federal values over stale storage', async () => {
    const { store } = makeFakeStore()
    const stored = populatedAnnualEvidencePlan('source-live')
    const storedPlanSnapshot = structuredClone(stored)
    const storedFederalSnapshot = structuredClone(stored.annualFederalTaxFacts)
    await savePlanVia(store, stored, evidenceNow)

    const live = structuredClone(stored)
    live.annualFederalTaxFacts.foreignIncomeAdjustments[0]!.foreignExclusionAddback = {
      state: 'known',
      amount: 999.125,
      provenance: {
        sourceKind: 'taxProfessionalWorkpaper',
        acquisition: 'manual',
        sourceLabel: 'LIVE-3D-ONLY',
      },
    }
    const livePlanSnapshot = structuredClone(live)
    const liveFederalSnapshot = structuredClone(live.annualFederalTaxFacts)

    const dup = await duplicatePlanVia(store, stored.id, {
      newId: () => 'clone-live',
      source: live,
      now: evidenceNow,
    })
    expect(dup.ok).toBe(true)
    if (!dup.ok) return
    expect(dup.plan.annualFederalTaxFacts).toEqual(liveFederalSnapshot)
    expect(dup.plan.annualFederalTaxFacts).not.toEqual(storedFederalSnapshot)
    expect(dup.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(live).toEqual(livePlanSnapshot)
    expect(stored).toEqual(storedPlanSnapshot)

    const reloadedSource = await loadPlanVia(store, stored.id)
    expect(reloadedSource.ok).toBe(true)
    if (reloadedSource.ok) {
      expect(reloadedSource.plan.annualFederalTaxFacts).toEqual(storedFederalSnapshot)
    }

    dup.plan.annualFederalTaxFacts.foreignIncomeAdjustments[0]!.year = 1999
    expect(live.annualFederalTaxFacts.foreignIncomeAdjustments[0]!.year).toBe(2040)
  })

  it('duplicatePlanVia lands the user-origin clone in the store', async () => {
    const { store, docs } = makeFakeStore()
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    const dup = await duplicatePlanVia(store, sample.id, { name: 'Cloned', newId: () => 'clone-1' })
    expect(dup.ok).toBe(true)
    const stored = docs.get('clone-1') as Plan
    expect(stored.name).toBe('Cloned')
    expect(stored.origin).toBe('user')
  })
})

describe('demo records stay browser-local', () => {
  it('routes example ids to the browser store even when a host store is provided', async () => {
    const { store, calls } = makeFakeStore()
    const seeded = await saveFreshDemo(EXAMPLE_PLANS[0]!)
    expect(seeded.ok).toBe(true)
    if (!seeded.ok) return

    const viaSeam = await loadPlanVia(store, seeded.plan.id)
    expect(viaSeam.ok && viaSeam.plan.origin).toBe('example')
    // The host store never saw the demo id.
    expect(calls).toEqual([])

    const resaved = await savePlanVia(store, seeded.plan)
    expect(resaved.ok).toBe(true)
    expect(calls).toEqual([])
  })

  it('"Save to my plans" crosses the seam: converted plan in the host store, demo record dropped from the browser', async () => {
    const { store, docs } = makeFakeStore()
    const seeded = await saveFreshDemo(EXAMPLE_PLANS[0]!)
    expect(seeded.ok).toBe(true)
    if (!seeded.ok) return

    const converted = await saveExampleToMyPlans(seeded.plan, { newId: () => 'promoted-1', store })
    expect(converted.ok).toBe(true)
    expect((docs.get('promoted-1') as Plan).origin).toBe('user')
    // The browser-local demo record is gone.
    expect((await loadPlan(seeded.plan.id)).ok).toBe(false)
  })

  it('"Save to my plans" preserves populated federal annual facts and drops IRA annual facts in the host store', async () => {
    const { store, docs } = makeFakeStore()
    const demo = populatedAnnualEvidencePlan(exampleStorageId('example-couple'))
    demo.origin = 'example'
    demo.exampleSourceId = 'example-couple'
    const federalSnapshot = structuredClone(demo.annualFederalTaxFacts)
    const saved = await savePlan(demo, evidenceNow)
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    const passedDemoSnapshot = structuredClone(saved.plan)

    const converted = await saveExampleToMyPlans(saved.plan, {
      newId: () => 'promoted-evidence',
      store,
    })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return
    expect(converted.plan.annualFederalTaxFacts).toEqual(federalSnapshot)
    expect(converted.plan).not.toHaveProperty('retirementActionAnnualTaxFacts')
    expect(converted.plan.origin).toBe('user')
    expect((docs.get('promoted-evidence') as Plan).annualFederalTaxFacts).toEqual(federalSnapshot)
    expect((await loadPlan(demo.id)).ok).toBe(false)
    expect(saved.plan).toEqual(passedDemoSnapshot)
  })

  it('a host-store save failure during convert surfaces as issues and keeps the demo record', async () => {
    const { store } = makeFakeStore()
    store.savePlan = async () => {
      throw new Error('disk full')
    }
    const seeded = await saveFreshDemo(EXAMPLE_PLANS[0]!)
    expect(seeded.ok).toBe(true)
    if (!seeded.ok) return

    const converted = await saveExampleToMyPlans(seeded.plan, { store })
    expect(converted.ok).toBe(false)
    if (!converted.ok) expect(converted.issues.join(' ')).toContain('could not save')
    // Nothing was lost: the browser-local demo is still there.
    expect((await loadPlan(seeded.plan.id)).ok).toBe(true)
  })
})

describe('workspace over a fake store', () => {
  let container: HTMLDivElement
  let root: Root

  function Probe() {
    const { plan, update, saveState } = usePlan()
    return (
      <div>
        <span data-testid="name">{plan.name}</span>
        <span data-testid="state">{saveState}</span>
        <button
          data-testid="rename"
          onClick={() =>
            update((d) => {
              d.name = 'Host renamed'
            })
          }
        />
      </div>
    )
  }

  async function mount(store: PlanStore, planId: string) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${planId}`]}>
          <PlanStoreProvider store={store}>
            <Routes>
              <Route
                path="/plan/:planId"
                element={
                  <PlanProvider planId={planId}>
                    <Probe />
                  </PlanProvider>
                }
              />
            </Routes>
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    await act(async () => {})
  }

  it('loads from the host store and autosaves back to it — never to the browser store', async () => {
    const { store, docs } = makeFakeStore()
    const sample = populatedAnnualEvidencePlan('host-autosave')
    const federalSnapshot = structuredClone(sample.annualFederalTaxFacts)
    docs.set(sample.id, structuredClone(sample))

    await mount(store, sample.id)
    expect(container.querySelector('[data-testid="name"]')!.textContent).toBe(sample.name)

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
      await sleep(AUTOSAVE_SETTLE_MS)
    })
    expect(container.querySelector('[data-testid="state"]')!.textContent).toBe('saved')
    const stored = docs.get(sample.id) as Plan
    expect(stored.name).toBe('Host renamed')
    expect(stored.annualFederalTaxFacts).toEqual(federalSnapshot)
    // Nothing leaked into IndexedDB.
    expect((await loadPlan(sample.id)).ok).toBe(false)
    await act(async () => root.unmount())
    container.remove()
  })
})

describe('<PlannerApp/> store injection', () => {
  async function mountApp(ui: ReactNode) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>)
    })
    return {
      container,
      unmount: async () => {
        await act(async () => root.unmount())
        container.remove()
      },
    }
  }

  it('honors an ambient <PlanStoreProvider> when the planStore prop is omitted', async () => {
    const { store, docs } = makeFakeStore()
    const sample = { ...createSamplePlan(), name: 'Ambient host plan' }
    docs.set(sample.id, structuredClone(sample))

    const { container, unmount } = await mountApp(
      <PlanStoreProvider store={store}>
        <App />
      </PlanStoreProvider>,
    )
    await waitFor(() => (container.textContent ?? '').includes('Ambient host plan'))
    await unmount()
  })

  it('"Clear all data" erases the host store too, not just this browser', async () => {
    const { store, docs } = makeFakeStore()
    const sample = { ...createSamplePlan(), name: 'Host plan to clear' }
    docs.set(sample.id, structuredClone(sample))

    const { container, unmount } = await mountApp(<App planStore={store} />)
    await waitFor(() => (container.textContent ?? '').includes('Host plan to clear'))

    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Clear all data')
    await act(async () => {
      clearBtn!.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    // The typed-confirmation gate: type 'delete', then the erase button arms.
    const gate = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(gate, 'delete')
      gate.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button'))
        .find((b) => b.textContent === 'Erase everything')!
        .click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    expect(docs.size).toBe(0)
    await waitFor(() => !(container.textContent ?? '').includes('Host plan to clear'))
    await unmount()
  })
})
