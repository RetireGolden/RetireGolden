/** @vitest-environment jsdom */
/**
 * The generic read-only workspace capability: when a host sets `readOnly` on
 * `<PlanStoreProvider>`, the workspace must render its editing surfaces
 * disabled and never attempt a write — no `store.savePlan` call fires on an
 * edit — while read/explore/export paths keep working. Default (`readOnly`
 * omitted) must be byte-for-byte the old behavior: autosave fires, controls
 * enabled.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import { _resetPlanStoreForTests } from './planStore'
import type { PlanStore, PlanSummary } from './planStoreContext'
import { PlanStoreProvider } from './PlanStoreProvider'
import { useWorkspaceReadOnly } from './workspaceReadOnly'
import { PlanProvider } from '../planner/PlanContext'
import { PlanCtx, usePlan, type PlanContextValue } from '../planner/planContextCore'
import { EditableFieldset } from '../planner/EditableFieldset'
import { HouseholdSection } from '../planner/sections'
import { YourPlans } from '../planner/home/YourPlans'
import { ExamplePreviewBanner } from '../planner/examples/ExamplePreviewBanner'
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

/** Renders a rename-on-click probe inside a workspace over the given store. */
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
            d.name = 'Edited name'
          })
        }
      />
    </div>
  )
}

describe('read-only autosave suppression', () => {
  let container: HTMLDivElement
  let root: Root

  async function mount(store: PlanStore, planId: string, readOnly: boolean) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${planId}`]}>
          <PlanStoreProvider store={store} readOnly={readOnly}>
            <PlanProvider planId={planId}>
              <Probe />
            </PlanProvider>
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    await act(async () => {})
  }

  async function teardown() {
    await act(async () => root.unmount())
    container.remove()
  }

  it('ignores the edit entirely — no mutation, no store.savePlan', async () => {
    const { store, docs, calls } = makeFakeStore()
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    await mount(store, sample.id, true)
    // The load path may read the store; drop everything before the edit so the
    // assertion is purely about writes triggered by editing.
    calls.length = 0

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
      await settle()
    })

    // Read-only means the plan cannot mutate: the on-screen name is unchanged
    // (not just unsaved), so a later re-enable can't persist a phantom edit…
    expect(container.querySelector('[data-testid="name"]')!.textContent).toBe(sample.name)
    // …and nothing reached the store.
    expect(calls.filter((c) => c.startsWith('savePlan:'))).toEqual([])
    expect((docs.get(sample.id) as Plan).name).toBe(sample.name)
    // No misleading "saving"/"dirty" state churn.
    expect(container.querySelector('[data-testid="state"]')!.textContent).not.toBe('saving')

    await teardown()
  })

  it('without readOnly (default): the same edit autosaves through the store', async () => {
    const { store, docs, calls } = makeFakeStore()
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    await mount(store, sample.id, false)
    calls.length = 0

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
      await settle()
    })

    expect(calls.filter((c) => c === `savePlan:${sample.id}`)).toHaveLength(1)
    expect((docs.get(sample.id) as Plan).name).toBe('Edited name')

    await teardown()
  })
})

describe('readOnly inherits an ambient provider', () => {
  function ReadOnlyProbe() {
    return <span data-testid="ro">{String(useWorkspaceReadOnly())}</span>
  }

  async function mountNested(outer: boolean, inner: boolean | undefined) {
    const { store } = makeFakeStore()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <PlanStoreProvider store={store} readOnly={outer}>
          <PlanStoreProvider store={store} readOnly={inner}>
            <ReadOnlyProbe />
          </PlanStoreProvider>
        </PlanStoreProvider>,
      )
    })
    const seen = container.querySelector('[data-testid="ro"]')!.textContent
    await act(async () => root.unmount())
    container.remove()
    return seen
  }

  it('a nested provider that omits readOnly inherits the parent value', async () => {
    expect(await mountNested(true, undefined)).toBe('true')
  })

  it('an explicit readOnly on the nested provider still wins', async () => {
    expect(await mountNested(true, false)).toBe('false')
  })
})

describe('read-only flips mid-session', () => {
  it('cancels an in-flight autosave when readOnly flips true before the debounce fires', async () => {
    const { store, docs, calls } = makeFakeStore()
    const sample = createSamplePlan()
    docs.set(sample.id, structuredClone(sample))

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const tree = (readOnly: boolean) => (
      <MemoryRouter initialEntries={[`/plan/${sample.id}`]}>
        <PlanStoreProvider store={store} readOnly={readOnly}>
          <PlanProvider planId={sample.id}>
            <Probe />
          </PlanProvider>
        </PlanStoreProvider>
      </MemoryRouter>
    )

    await act(async () => { root.render(tree(false)) })
    await act(async () => {})
    calls.length = 0

    // Edit while writable — this schedules the 600 ms debounce — but do NOT
    // wait it out; flip read-only on first, then let the window elapse.
    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
    })
    await act(async () => { root.render(tree(true)) })
    await act(async () => { await settle() })

    // The scheduled save never reached the store.
    expect(calls.filter((c) => c.startsWith('savePlan:'))).toEqual([])
    expect((docs.get(sample.id) as Plan).name).toBe(sample.name)

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('read-only disables editing controls', () => {
  function ctx(plan: Plan): PlanContextValue {
    return { plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }
  }

  async function mountHousehold(readOnly: boolean) {
    const { store } = makeFakeStore()
    const plan = createSamplePlan()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plan/x/household']}>
          <PlanStoreProvider store={store} readOnly={readOnly}>
            <PlanCtx.Provider value={ctx(plan)}>
              <EditableFieldset>
                <HouseholdSection />
              </EditableFieldset>
            </PlanCtx.Provider>
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    return { container, unmount: async () => { await act(async () => root.unmount()); container.remove() } }
  }

  it('wraps the entry section in a disabled fieldset (the native disabled cascade)', async () => {
    const { container, unmount } = await mountHousehold(true)
    const fieldset = container.querySelector('fieldset.editable-region') as HTMLFieldSetElement
    expect(fieldset).not.toBeNull()
    // `disabled` on the fieldset is the mechanism: the browser propagates it to
    // every contained control. (jsdom doesn't model that cascade on the child's
    // own `.disabled` IDL, so we assert the fieldset state + that real controls
    // live under it.)
    expect(fieldset.disabled).toBe(true)
    expect(fieldset.querySelectorAll('input, select, button').length).toBeGreaterThan(0)
    await unmount()
  })

  it('leaves the fieldset enabled by default', async () => {
    const { container, unmount } = await mountHousehold(false)
    const fieldset = container.querySelector('fieldset.editable-region') as HTMLFieldSetElement
    expect(fieldset.disabled).toBe(false)
    await unmount()
  })
})

describe('read-only hides discrete write actions', () => {
  async function render(ui: ReactNode, readOnly: boolean) {
    const { store } = makeFakeStore()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={store} readOnly={readOnly}>
            {ui}
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    return { container, unmount: async () => { await act(async () => root.unmount()); container.remove() } }
  }

  const buttonTexts = (c: HTMLElement) => Array.from(c.querySelectorAll('button')).map((b) => b.textContent)

  it('YourPlans hides Duplicate and Delete when read-only, keeps Open', async () => {
    const plans: PlanSummary[] = [{ id: 'p1', name: 'Plan one', updatedAtIso: '2026-07-01T00:00:00.000Z' }]
    const yp = (
      <YourPlans plans={plans} onOpenPlan={() => undefined} onDuplicate={() => undefined} onDelete={() => undefined} />
    )

    const ro = await render(yp, true)
    expect(buttonTexts(ro.container)).not.toContain('Duplicate')
    expect(buttonTexts(ro.container)).not.toContain('Delete')
    // The plan is still openable (read path).
    expect(ro.container.querySelector('[aria-label="Open plan Plan one"]')).not.toBeNull()
    await ro.unmount()

    const rw = await render(yp, false)
    expect(buttonTexts(rw.container)).toContain('Duplicate')
    expect(buttonTexts(rw.container)).toContain('Delete')
    await rw.unmount()
  })

  it('ExamplePreviewBanner hides "Save to my plans" when read-only', async () => {
    const example = { ...createSamplePlan(), origin: 'example' as const }
    const banner = (
      <PlanCtx.Provider
        value={{ plan: example, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
      >
        <ExamplePreviewBanner />
      </PlanCtx.Provider>
    )

    const ro = await render(banner, true)
    expect(buttonTexts(ro.container)).not.toContain('Save to my plans')
    await ro.unmount()

    const rw = await render(banner, false)
    expect(buttonTexts(rw.container)).toContain('Save to my plans')
    await rw.unmount()
  })
})
