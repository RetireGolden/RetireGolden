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
import { waitFor } from '../../testSupport/settle'
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

/**
 * Wait for the post-confirm erase sequence (two databases, several awaits) to
 * reach its notice. A predicate rather than a fixed sleep: the sequence is as
 * slow as the host's IndexedDB is, and a timeout that says what it was waiting
 * for beats an assertion against a half-finished DOM.
 */
function waitForNotice(text: string) {
  return waitFor(() => notice().includes(text), { what: `the notice "${text}"`, describe: notice })
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
  it('flags an unreadable list rather than reporting an empty library', async () => {
    await render(storeOf([], { listPlans: () => Promise.reject(new Error('storage refused')) }))

    // Not a hung skeleton, and not "you have no plans": an empty list plus a
    // flag the page reads to keep first-run UI (and a disabled backup) away.
    expect(api().plans).toEqual([])
    expect(api().listUnavailable).toBe(true)
    // The flag carries it, not the notice: a notice here would overwrite the
    // outcome of whatever action asked for the refresh.
    expect(notice()).toBe('')
  })

  it('keeps the last list it read when a later refresh fails', async () => {
    let fail = false
    const store = storeOf([plan('good-1', 'Readable')], {
      listPlans: async () => {
        if (fail) throw new Error('storage refused')
        return [{ id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' }]
      },
    })
    await render(store)
    expect(api().plans).toHaveLength(1)

    fail = true
    await act(async () => api().refresh())
    await waitFor(() => api().listUnavailable, { what: 'the list-unavailable flag' })

    // Blanking the list here would hide plans that are still stored.
    expect(api().plans?.map((s) => s.name)).toEqual(['Readable'])
  })
})

describe('planner home plan actions', () => {
  it('says the new plan was not saved when the store rejects', async () => {
    await render(storeOf([], { savePlan: () => Promise.reject(new Error('quota exceeded')) }))

    await act(async () => api().createAndOpen(plan('new-1', 'New')))

    expect(notice()).toBe('Could not save the new plan. Storage is unavailable in this browser right now.')
  })

  it('says the duplicate was not made when the store rejects', async () => {
    const summary = { id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' }
    await render(storeOf([plan('good-1', 'Readable')], { loadPlan: () => Promise.reject(new Error('refused')) }))

    const duplicating = act(async () => {
      void api().handleDuplicate(summary)
    })
    await duplicating
    await click(dialogButton('Duplicate'))
    await waitForNotice('Could not duplicate')

    expect(notice()).toBe('Could not duplicate "Readable". Storage is unavailable in this browser right now.')
  })

  it('offers no Undo when the delete could not be made', async () => {
    const summary = { id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' }
    await render(storeOf([plan('good-1', 'Readable')], { deletePlan: () => Promise.reject(new Error('refused')) }))

    const deleting = act(async () => {
      void api().handleDelete(summary)
    })
    await deleting
    await click(dialogButton('Delete plan'))
    await waitForNotice('Could not delete')

    expect(notice()).toBe('Could not delete "Readable". Storage is unavailable in this browser right now.')
    // An Undo toast here would offer to reverse something that did not happen.
    expect(api().undoPlan).toBeNull()
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

    expect(outcome).toEqual({ downloaded: true, unreadable: ['From a newer deploy'], reason: null })
    // Named, not just counted: "which ones?" is the question a user has to
    // answer before deciding the backup is enough to erase against.
    expect(notice()).toBe(
      'Backup downloaded with 1 plan. 1 plan could not be read, so it is not in the backup: "From a newer deploy".',
    )
  })

  it('acknowledges a backup that held everything', async () => {
    await render(storeOf([plan('good-1', 'Readable'), plan('good-2', 'Also readable')]))

    const outcome = await act(async () => api().handleExportAll())

    expect(outcome).toEqual({ downloaded: true, unreadable: [], reason: null })
    expect(notice()).toBe('Backup downloaded with 2 plans.')
  })

  it('reports a backup that could not be produced at all', async () => {
    await render(storeOf([], { listPlans: () => Promise.reject(new Error('storage refused')) }))

    const outcome = await act(async () => api().handleExportAll())

    expect(outcome).toEqual({
      downloaded: false,
      unreadable: [],
      reason: 'Storage is unavailable in this browser right now.',
    })
    expect(notice()).toContain('No backup was downloaded')
  })

  it('reports a file that could not be handed to the browser', async () => {
    // Every record read; the download itself is what failed. Left unguarded
    // this rejection would abandon the clear-all flow with nothing said.
    URL.createObjectURL = vi.fn(() => {
      throw new Error('no object URLs in this host')
    })
    await render(storeOf([plan('good-1', 'Readable')]))

    const outcome = await act(async () => api().handleExportAll())

    expect(outcome.downloaded).toBe(false)
    expect(notice()).toBe('No backup was downloaded. The backup file could not be built in this browser.')
  })
})

describe('planner home clear all', () => {
  const SHORTFALL = '1 plan could not be read, so it is not in the backup: "From a newer deploy".'

  /** A store with one readable plan and one record this build cannot open. */
  function partialStore(deleted: string[]): PlanStore {
    const good = plan('good-1', 'Readable')
    return storeOf([good], {
      listPlans: async () => [
        { id: 'good-1', name: 'Readable', updatedAtIso: '2026-06-11T12:00:00.000Z' },
        { id: 'future-1', name: 'From a newer deploy', updatedAtIso: '2026-06-11T12:00:00.000Z' },
      ],
      loadPlan: async (id) => (id === 'good-1' ? good : { id: 'future-1', schemaVersion: 9_999 }),
      deletePlan: async (id) => {
        deleted.push(id)
      },
    })
  }

  /** Open the dialog, take the offered backup, and confirm the erase. */
  async function clearAllWithBackup() {
    await act(async () => {
      void api().handleClearAll()
    })
    await click(dialogButton('Download backup'))
    await typeConfirmation('delete')
    await click(dialogButton('Erase everything'))
  }

  it('stops the erase when the backup it offered was incomplete', async () => {
    const deleted: string[] = []
    await render(partialStore(deleted))

    await clearAllWithBackup()
    await waitForNotice('Nothing was erased')

    expect(deleted).toEqual([])
    expect(notice()).toBe(`Nothing was erased. ${SHORTFALL} Choose "Clear all data" again to erase anyway.`)

    // Second pass: the disclosure has been read, so the erase goes through
    // even with the same incomplete backup. Stopping every time would make an
    // unreadable record an unclearable store.
    await clearAllWithBackup()
    await waitForNotice('has been erased')

    expect(deleted).toEqual(['good-1', 'future-1'])
    expect(notice()).toBe(`All RetireGolden data has been erased from this browser. ${SHORTFALL}`)
  })

  it('stops again for a later clear-all, rather than spending the disclosure once', async () => {
    const deleted: string[] = []
    await render(partialStore(deleted))

    // Episode one: stopped, then erased. The stop must not be consumed for
    // good — a later erase is a new decision and gets its own warning.
    await clearAllWithBackup()
    await waitForNotice('Nothing was erased')
    await clearAllWithBackup()
    await waitForNotice('has been erased')

    await clearAllWithBackup()
    await waitForNotice('Nothing was erased')

    expect(notice()).toBe(`Nothing was erased. ${SHORTFALL} Choose "Clear all data" again to erase anyway.`)
  })

  it('does not carry a stop into a pass where no backup was taken', async () => {
    const deleted: string[] = []
    await render(partialStore(deleted))

    // No "Download backup" on this pass, so there is no shortfall to disclose
    // and nothing to hold the erase back.
    await act(async () => {
      void api().handleClearAll()
    })
    await typeConfirmation('delete')
    await click(dialogButton('Erase everything'))
    await waitForNotice('has been erased')

    expect(deleted).toEqual(['good-1', 'future-1'])
    expect(notice()).toBe('All RetireGolden data has been erased from this browser.')
  })

  it('erases when the backup held every plan', async () => {
    const deleted: string[] = []
    await render(
      storeOf([plan('good-1', 'Readable')], {
        deletePlan: async (id) => {
          deleted.push(id)
        },
      }),
    )

    await clearAllWithBackup()
    await waitForNotice('has been erased')

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
    expect(notice()).toBe('Imported 2 of 3 plans. 1 could not be saved to this browser: "C".')
  })

  it('does not frame a total failure as an import count', async () => {
    const store = storeOf([], { savePlan: () => Promise.reject(new Error('quota exceeded')) })
    await render(store)

    await act(async () => api().handleImportFile(backupFile([plan('a', 'A'), plan('b', 'B')])))

    // "Imported 0 of 2 plans" reads like a result; nothing landed.
    expect(notice()).toBe('No plans were imported. 2 could not be saved to this browser: "A", "B".')
  })

  it('still says how many landed on the happy path', async () => {
    const store = storeOf([])
    await render(store)

    await act(async () => api().handleImportFile(backupFile([plan('a', 'A'), plan('b', 'B')])))

    expect(notice()).toBe('Imported 2 plans.')
  })
})
