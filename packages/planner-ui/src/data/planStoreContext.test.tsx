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
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import { App } from '../App.tsx'
import { _resetPlanStoreForTests, loadPlan } from './planStore'
import {
  duplicatePlanVia,
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

/** Waits past the 600 ms autosave debounce. */
const settle = () => new Promise((r) => setTimeout(r, 750))

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
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    await mount(store, sample.id)
    expect(container.querySelector('[data-testid="name"]')!.textContent).toBe(sample.name)

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
      await settle()
    })
    expect(container.querySelector('[data-testid="state"]')!.textContent).toBe('saved')
    expect((docs.get(sample.id) as Plan).name).toBe('Host renamed')
    // Nothing leaked into IndexedDB.
    expect((await loadPlan(sample.id)).ok).toBe(false)
    await act(async () => root.unmount())
    container.remove()
  })
})

describe('<PlannerApp/> store injection', () => {
  async function waitFor(container: HTMLElement, predicate: () => boolean) {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (predicate()) return
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    }
    throw new Error(`Timed out waiting for expected render; got: ${container.textContent}`)
  }

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
    await waitFor(container, () => (container.textContent ?? '').includes('Ambient host plan'))
    await unmount()
  })

  it('"Clear all data" erases the host store too, not just this browser', async () => {
    const { store, docs } = makeFakeStore()
    const sample = { ...createSamplePlan(), name: 'Host plan to clear' }
    docs.set(sample.id, structuredClone(sample))

    const { container, unmount } = await mountApp(<App planStore={store} />)
    await waitFor(container, () => (container.textContent ?? '').includes('Host plan to clear'))

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
    await waitFor(container, () => !(container.textContent ?? '').includes('Host plan to clear'))
    await unmount()
  })
})
