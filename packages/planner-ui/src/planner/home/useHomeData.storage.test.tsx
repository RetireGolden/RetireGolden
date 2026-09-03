/** @vitest-environment jsdom */
/**
 * The storage boundary of the planner home. This is a local-first app: the
 * browser database is the only copy, so every one of these paths has to say
 * what it could not do rather than degrade to silence. The cases here are the
 * failure half of `useHomeData` — the happy paths live in `home.test.tsx`.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { _resetPlanStoreForTests } from '../../data/planStore'
import { PlanStoreProvider } from '../../data/PlanStoreProvider'
import type { PlanStore } from '../../data/planStoreContext'
import { _resetRefreshHistoryForTests } from '../../import/refreshHistory'
import { serializeV2Backup } from '../../data/v2Backup'
import { useHomeData } from './useHomeData'

/** The latest hook value, published from an effect so render stays pure. */
const captured: { current: ReturnType<typeof useHomeData> | null } = { current: null }

function api(): ReturnType<typeof useHomeData> {
  expect(captured.current, 'expected the harness to have rendered').not.toBeNull()
  return captured.current!
}

function Harness() {
  const data = useHomeData()
  useEffect(() => {
    captured.current = data
  })
  return (
    <div>
      <output data-testid="notice">{data.notice ?? ''}</output>
      {data.dialogs}
    </div>
  )
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  _resetRefreshHistoryForTests()
  captured.current = null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // jsdom has neither of these; the download itself is not what is under test.
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

async function render(store: PlanStore) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanStoreProvider store={store}>
          <Harness />
        </PlanStoreProvider>
      </MemoryRouter>,
    )
  })
}

function notice(): string {
  return container.querySelector('[data-testid="notice"]')?.textContent ?? ''
}

function plan(id: string, name: string): Plan {
  return { ...createEmptyPlan({ newId: () => id, now: () => new Date('2026-06-11T12:00:00.000Z') }), name }
}

/** A store whose every operation is overridable, so one failure can be isolated. */
function storeOf(records: Plan[], overrides: Partial<PlanStore> = {}): PlanStore {
  const byId = new Map(records.map((p) => [p.id, p as unknown]))
  return {
    listPlans: async () =>
      [...byId.keys()].map((id) => ({ id, name: (byId.get(id) as Plan).name, updatedAtIso: '2026-06-11T12:00:00.000Z' })),
    loadPlan: async (id) => byId.get(id) ?? null,
    savePlan: async (p) => {
      byId.set(p.id, p)
    },
    deletePlan: async (id) => {
      byId.delete(id)
    },
    ...overrides,
  }
}

function dialogButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.modal-panel button')).find(
    (b) => b.textContent === label,
  )
}

async function click(el: Element | null | undefined) {
  expect(el, 'expected an element to click').toBeTruthy()
  await act(async () => {
    ;(el as HTMLElement).click()
  })
}

/** Let the post-confirm erase sequence (two databases) settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

async function typeConfirmation(text: string) {
  const input = document.querySelector<HTMLInputElement>('.dialog-typed-field input')
  expect(input, 'expected the typed-confirmation field').toBeTruthy()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input!, text)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('planner home plan list', () => {
  it('says the plan list could not be read instead of showing an empty library', async () => {
    await render(storeOf([], { listPlans: () => Promise.reject(new Error('storage refused')) }))

    // Not a hung skeleton, and not a silent "you have no plans": the page
    // renders an empty list and names why it is empty.
    expect(api().plans).toEqual([])
    expect(notice()).toContain('Your saved plans could not be read')
  })
})

describe('planner home backup download', () => {
  it('counts the plans it could not read and says they are missing from the file', async () => {
    // The second record is what a newer deploy in another tab leaves behind:
    // stored, listed, and unreadable by this build's migration.
    const good = plan('good-1', 'Readable')
    const store = storeOf([good], {
      listPlans: async () => [
        { id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' },
        { id: 'future-1', name: 'From a newer deploy', updatedAtIso: '2026-06-11T12:00:00.000Z' },
      ],
      loadPlan: async (id) => (id === 'good-1' ? good : { id: 'future-1', schemaVersion: 9_999 }),
    })
    await render(store)

    const outcome = await act(async () => api().handleExportAll())

    expect(outcome).toEqual({ downloaded: true, unreadable: 1 })
    expect(notice()).toBe(
      'Backup downloaded with 1 plan. 1 plan could not be read, so it is not in the file.',
    )
  })

  it('reports a backup that could not be produced at all', async () => {
    await render(storeOf([], { listPlans: () => Promise.reject(new Error('storage refused')) }))

    const outcome = await act(async () => api().handleExportAll())

    expect(outcome).toEqual({ downloaded: false, unreadable: 0 })
    expect(notice()).toContain('No backup was downloaded')
  })
})

describe('planner home clear all', () => {
  it('stops the erase when the backup it offered was incomplete', async () => {
    const deleted: string[] = []
    const good = plan('good-1', 'Readable')
    const store = storeOf([good], {
      listPlans: async () => [
        { id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' },
        { id: 'future-1', name: 'From a newer deploy', updatedAtIso: '2026-06-11T12:00:00.000Z' },
      ],
      loadPlan: async (id) => (id === 'good-1' ? good : { id: 'future-1', schemaVersion: 9_999 }),
      deletePlan: async (id) => {
        deleted.push(id)
      },
    })
    await render(store)

    const clearing = act(async () => {
      void api().handleClearAll()
    })
    await clearing
    await click(dialogButton('Download backup'))
    await typeConfirmation('delete')
    await click(dialogButton('Erase everything'))
    await flush()

    expect(deleted).toEqual([])
    expect(notice()).toBe(
      'Nothing was erased. 1 plan could not be read, so it is not in the backup you just downloaded. ' +
        'Choose "Clear all data" again to erase anyway.',
    )

    // Second pass: the disclosure has been read, so the erase goes through
    // even with the same incomplete backup. Stopping every time would make an
    // unreadable record an unclearable store.
    await act(async () => {
      void api().handleClearAll()
    })
    await click(dialogButton('Download backup'))
    await typeConfirmation('delete')
    await click(dialogButton('Erase everything'))
    await flush()

    expect(deleted).toEqual(['good-1', 'future-1'])
    expect(notice()).toBe(
      'All RetireGolden data has been erased from this browser. ' +
        '1 plan could not be read, so it is not in the backup you just downloaded.',
    )
  })

  it('erases when the backup held every plan', async () => {
    const deleted: string[] = []
    const store = storeOf([plan('good-1', 'Readable')], {
      deletePlan: async (id) => {
        deleted.push(id)
      },
    })
    await render(store)

    await act(async () => {
      void api().handleClearAll()
    })
    await click(dialogButton('Download backup'))
    await typeConfirmation('delete')
    await click(dialogButton('Erase everything'))
    await flush()

    expect(deleted).toEqual(['good-1'])
    expect(notice()).toBe('All RetireGolden data has been erased from this browser.')
  })
})

describe('planner home restore from backup', () => {
  function backupFile(plans: Plan[]): File {
    return new File([serializeV2Backup(plans)], 'retiregolden-backup.json', { type: 'application/json' })
  }

  it('reports how many plans landed when the store rejects part-way through', async () => {
    const written: string[] = []
    const store = storeOf([], {
      savePlan: async (p) => {
        if (written.length >= 2) throw new Error('quota exceeded')
        written.push(p.id)
      },
    })
    await render(store)

    await act(async () => api().handleImportFile(backupFile([plan('a', 'A'), plan('b', 'B'), plan('c', 'C')])))

    // The two that landed really are stored; a thrown loop used to claim
    // nothing had happened at all.
    expect(written).toHaveLength(2)
    expect(notice()).toBe('Imported 2 of 3 plans. 1 could not be saved to this browser.')
  })

  it('still says how many landed on the happy path', async () => {
    const store = storeOf([])
    await render(store)

    await act(async () => api().handleImportFile(backupFile([plan('a', 'A'), plan('b', 'B')])))

    expect(notice()).toBe('Imported 2 plans.')
  })
})
