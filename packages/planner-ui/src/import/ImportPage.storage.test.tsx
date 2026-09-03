/** @vitest-environment jsdom */
/**
 * The import wizard's two async entry points, and what the report file holds.
 * Both entry points are fired as `void handleFile(f)` / `void saveAndOpen()`,
 * so an uncaught rejection leaves the wizard looking inert with nothing said
 * and, for the draft, one navigation from losing the only copy.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests } from '../data/planStore'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore } from '../data/planStoreContext'
import { MAX_CSV_CHARS } from './csv'
import { ImportPage } from './ImportPage'
import { ImportAvailabilityProvider } from './ImportAvailabilityProvider'
import { waitFor } from '../testSupport/settle'

const BROKER_CSV = `"Positions for account Roth IRA ...321 as of 09:12 PM ET, 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","VANGUARD TOTAL STOCK MARKET ETF","$14,000.00","$10,000.00"
`

const workingStore: PlanStore = {
  listPlans: async () => [],
  loadPlan: async () => null,
  savePlan: async () => undefined,
  deletePlan: async () => undefined,
}

let root: Root | null = null
let container: HTMLDivElement | null = null

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
})

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function render(store: PlanStore = workingStore) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/import']}>
        <PlanStoreProvider store={store}>
          <ImportAvailabilityProvider enabled resolved>
            <Routes>
              <Route path="/import" element={<ImportPage />} />
              <Route path="/plan/:planId/*" element={<div data-testid="plan-route" />} />
            </Routes>
          </ImportAvailabilityProvider>
        </PlanStoreProvider>
      </MemoryRouter>,
    )
  })
  return container
}

const waitForUi = (done: () => boolean, what: string) => waitFor(done, { what, attempts: 400, intervalMs: 5 })

/** A promise this test settles by hand, so "still in flight" is a real state. */
function deferred<T>() {
  let settle!: { resolve: (value: T) => void; reject: (reason: unknown) => void }
  const promise = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // An unhandled rejection would fail the run before the assertion; the
  // component's own catch is what the test is watching for.
  promise.catch(() => undefined)
  return { promise, ...settle }
}

function findButton(el: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))
}

function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  act(() => {
    ;(el as HTMLElement).click()
  })
}

async function chooseFile(el: HTMLElement, file: File, done: () => boolean, what: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitForUi(done, what)
}

describe('ImportPage async failure disclosure', () => {
  it('says so when the chosen file cannot be read', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))

    // The picker returns a handle; the read happens later, and by then the
    // file can have moved or lost its permission.
    const file = new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.reject(new Error('NotFoundError')),
      configurable: true,
    })

    await chooseFile(el, file, () => el.querySelector('[role="alert"]') !== null, 'the error callout')

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('That file could not be read')
    expect(el.querySelector('.import-review')).toBeNull()
  })

  it('says so when the drafted plan cannot be saved, and keeps the draft on screen', async () => {
    const rejectingStore: PlanStore = { ...workingStore, savePlan: () => Promise.reject(new Error('quota exceeded')) }
    const el = render(rejectingStore)
    click(findButton(el, 'Broker CSV'))
    await chooseFile(
      el,
      new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' }),
      () => el.querySelector('.import-review') !== null,
      'the review checklist',
    )

    click(findButton(el, 'Save draft'))
    await waitForUi(() => el.querySelector('[role="alert"]') !== null, 'the error callout')

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('The draft plan could not be saved')
    // Not navigated away, and the draft is still reviewable.
    expect(el.querySelector('[data-testid="plan-route"]')).toBeNull()
    expect(el.querySelector('.import-review')).not.toBeNull()
  })
})

describe('ImportPage stale completions', () => {
  /** Start a broker-CSV read that will not finish until the test says so. */
  async function startPendingRead(el: HTMLElement, arrayBuffer: () => Promise<ArrayBuffer>) {
    click(findButton(el, 'Broker CSV'))
    const file = new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer, configurable: true })
    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  /** Leave the wizard on a DIFFERENT source, where a stale error would render. */
  function moveToAnotherSource(el: HTMLElement) {
    click(findButton(el, 'Choose a different source'))
    click(findButton(el, 'ProjectionLab'))
    expect(el.querySelector('[role="alert"]'), 'the fresh step starts clean').toBeNull()
  }

  it('drops a file-read failure that lands after the user moved on', async () => {
    const el = render()
    const gate = deferred<ArrayBuffer>()
    await startPendingRead(el, () => gate.promise)
    moveToAnotherSource(el)

    await act(async () => {
      gate.reject(new Error('NotFoundError'))
      await Promise.resolve()
    })

    expect(el.querySelector('[role="alert"]'), 'no failure from the abandoned file').toBeNull()
  })

  it('drops a too-large refusal that lands after the user moved on', async () => {
    const el = render()
    // Under the byte gate, over the character cap: the refusal is decided
    // after the read, which is where a stale wizard can be clobbered.
    const gate = deferred<ArrayBuffer>()
    await startPendingRead(el, () => gate.promise)
    moveToAnotherSource(el)

    await act(async () => {
      gate.resolve(new ArrayBuffer(MAX_CSV_CHARS + 1))
      await Promise.resolve()
    })

    expect(el.querySelector('[role="alert"]'), 'no refusal from the abandoned file').toBeNull()
  })

  it('neither complains nor navigates when the abandoned draft finishes saving', async () => {
    const gate = deferred<void>()
    const el = render({ ...workingStore, savePlan: () => gate.promise })
    click(findButton(el, 'Broker CSV'))
    await chooseFile(
      el,
      new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' }),
      () => el.querySelector('.import-review') !== null,
      'the review checklist',
    )

    click(findButton(el, 'Save draft'))
    click(findButton(el, 'Start over')) // the draft is abandoned mid-write
    await act(async () => {
      gate.resolve()
      await Promise.resolve()
    })

    // A late navigation would drop the user into a plan they walked away from.
    expect(el.querySelector('[data-testid="plan-route"]')).toBeNull()
    expect(el.querySelector('[role="alert"]')).toBeNull()
  })

  it('drops a save failure that lands after the draft was abandoned', async () => {
    const gate = deferred<void>()
    const el = render({ ...workingStore, savePlan: () => gate.promise })
    click(findButton(el, 'Broker CSV'))
    await chooseFile(
      el,
      new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' }),
      () => el.querySelector('.import-review') !== null,
      'the review checklist',
    )

    click(findButton(el, 'Save draft'))
    click(findButton(el, 'Start over'))
    await act(async () => {
      gate.reject(new Error('quota exceeded'))
      await Promise.resolve()
    })

    expect(el.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('ImportPage report disclosure', () => {
  it('names what the downloadable report contains, and points the button at it', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))
    await chooseFile(
      el,
      new File([BROKER_CSV], 'positions.csv', { type: 'text/csv' }),
      () => el.querySelector('.import-review') !== null,
      'the review checklist',
    )

    const hint = el.querySelector('#import-report-contents')
    expect(hint, 'the report action carries a hint about what leaves with the file').not.toBeNull()
    // Source-neutral: this hint renders for every source's draft, and the 1040
    // and ProjectionLab paths have no broker account labels to name.
    expect(hint!.textContent).toContain('what mapped and what was skipped')
    expect(findButton(el, 'Download import report')!.getAttribute('aria-describedby')).toBe('import-report-contents')
  })
})
