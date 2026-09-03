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
    expect(hint!.textContent).toContain('account labels and amounts')
    expect(findButton(el, 'Download import report')!.getAttribute('aria-describedby')).toBe('import-report-contents')
  })
})
