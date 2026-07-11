/** @vitest-environment jsdom */
/**
 * Import & migrate wizard wiring: source cards render, the 1040 guided path
 * builds a reviewable draft and saves it through the plan store, and a broker
 * CSV file walks file → review checklist → saved plan.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, listUserPlanSummaries } from '../data/planStore'
import { ImportPage } from './ImportPage'

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

function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/import']}>
        <Routes>
          <Route path="/import" element={<ImportPage />} />
          <Route path="/plan/:planId/*" element={<div data-testid="plan-route" />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return container
}

function click(el: Element | null | undefined) {
  expect(el, 'expected element to click').toBeTruthy()
  act(() => {
    ;(el as HTMLElement).click()
  })
}

function findButton(el: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))
}

async function chooseFile(el: HTMLElement, file: File) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

describe('ImportPage', () => {
  it('offers all four guided sources', () => {
    const el = render()
    const cards = Array.from(el.querySelectorAll('.home-path-card')).map((c) => c.textContent ?? '')
    expect(cards).toHaveLength(4)
    expect(cards.join(' ')).toContain('Broker CSV')
    expect(cards.join(' ')).toContain('ProjectionLab')
    expect(cards.join(' ')).toContain('Spreadsheet / RPM')
    expect(cards.join(' ')).toContain('tax return')
  })

  it('walks the 1040 guided path to a reviewed, saved draft plan', async () => {
    const el = render()
    click(findButton(el, 'tax return'))

    // The guided form shows the 1040 line fields; keep the defaults (all $0)
    // and build — a coherent (if empty) draft with MAGI context still results.
    expect(el.textContent).toContain('Line 11')
    click(findButton(el, 'Build my draft plan'))

    // Review checklist appears with the always-present unmapped guidance.
    expect(el.querySelector('.import-review')).not.toBeNull()
    expect(el.textContent).toContain('Not imported')

    const before = await listUserPlanSummaries()
    expect(before).toHaveLength(0)
    await act(async () => {
      findButton(el, 'Save draft')!.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    const after = await listUserPlanSummaries()
    expect(after).toHaveLength(1)
    expect(after[0]!.name).toBe('Seeded from your 1040')
    expect(el.querySelector('[data-testid="plan-route"]')).not.toBeNull()
  })

  it('walks a broker CSV to a draft with the review checklist', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))

    const csv = `"Positions for account Roth IRA ...321 as of 09:12 PM ET, 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","VANGUARD TOTAL STOCK MARKET ETF","$14,000.00","$10,000.00"
`
    await chooseFile(el, new File([csv], 'positions.csv', { type: 'text/csv' }))

    expect(el.textContent).toContain('Schwab positions file')
    expect(el.querySelector('.import-review')).not.toBeNull()
    expect(el.textContent).toContain('Roth IRA ...321')

    await act(async () => {
      findButton(el, 'Save draft')!.click()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    const plans = await listUserPlanSummaries()
    expect(plans).toHaveLength(1)
    expect(plans[0]!.name).toBe('Imported from Schwab')
  })

  it('surfaces a helpful error for unrecognized files instead of importing junk', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))
    await chooseFile(el, new File(['name,phone\nalice,555\n'], 'junk.csv', { type: 'text/csv' }))
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('spreadsheet import')
    expect(await listUserPlanSummaries()).toHaveLength(0)
  })
})
