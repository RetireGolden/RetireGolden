/** @vitest-environment jsdom */
/**
 * Import wizard cancel semantics (#507): "Choose a different source" and
 * "Start over" discard the guided-1040 draft instead of handing the typed
 * values back on the next visit.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests } from '../data/planStore'
import { ImportPage } from './ImportPage'
import { ImportAvailabilityProvider } from './ImportAvailabilityProvider'
import { waitFor } from '../testSupport/settle'

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
        <ImportAvailabilityProvider enabled resolved>
          <Routes>
            <Route path="/import" element={<ImportPage />} />
          </Routes>
        </ImportAvailabilityProvider>
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

function findInput(el: HTMLElement, label: string): HTMLInputElement {
  const lab = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.includes(label))
  expect(lab, `expected a label containing "${label}"`).toBeTruthy()
  const input = el.ownerDocument.getElementById(lab!.htmlFor)
  expect(input instanceof HTMLInputElement, `expected an input labelled "${label}"`).toBe(true)
  return input as HTMLInputElement
}

/** Type into a money field the way a user does: focus, replace the text, blur to commit. */
function typeMoney(input: HTMLInputElement, text: string) {
  act(() => {
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
    input.dispatchEvent(new Event('blur', { bubbles: true }))
  })
}

function findSelect(el: HTMLElement, label: string): HTMLSelectElement {
  const lab = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.includes(label))
  expect(lab, `expected a label containing "${label}"`).toBeTruthy()
  const sel = el.ownerDocument.getElementById(lab!.htmlFor)
  expect(sel instanceof HTMLSelectElement, `expected a select labelled "${label}"`).toBe(true)
  return sel as HTMLSelectElement
}

function selectByKeyboard(sel: HTMLSelectElement, value: string) {
  act(() => {
    sel.focus()
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    sel.value = value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const wagesDigits = (el: HTMLElement) => findInput(el, 'Line 1a').value.replace(/[^0-9]/g, '')

describe('Import wizard cancel semantics (#507)', () => {
  it('Start over after a built 1040 draft returns to a blank form', async () => {
    const el = render()
    click(el.querySelector('[data-source="tenforty"]'))
    typeMoney(findInput(el, 'Line 1a'), '85000')
    selectByKeyboard(findSelect(el, 'State of residence'), 'KY')
    expect(wagesDigits(el)).toBe('85000')

    click(findButton(el, 'Build my draft plan'))
    await waitFor(() => el.querySelector('.import-review') !== null, { what: 'the review checklist', attempts: 400, intervalMs: 5 })

    click(findButton(el, 'Start over'))
    expect(el.querySelector('.import-review')).toBeNull()
    expect(findButton(el, 'Build my draft plan')).toBeTruthy()
    // The form is back, and blank: no wages, no state.
    expect(wagesDigits(el)).toBe('0')
    expect(findSelect(el, 'State of residence').value).toBe('')
  })

  it('Choose a different source discards the typed 1040 lines', () => {
    const el = render()
    click(el.querySelector('[data-source="tenforty"]'))
    const wages = findInput(el, 'Line 1a')
    typeMoney(wages, '85000')
    expect(findInput(el, 'Line 1a').value.replace(/[^0-9]/g, '')).toBe('85000')

    click(findButton(el, 'Choose a different source'))
    expect(el.querySelector('[data-source="tenforty"]')).not.toBeNull()

    click(el.querySelector('[data-source="tenforty"]'))
    expect(findInput(el, 'Line 1a').value.replace(/[^0-9]/g, '')).toBe('0')
  })

  it('Choose a different source restores focus to the opened card, which carries the app ring class hook', () => {
    const el = render()
    click(el.querySelector('[data-source="tenforty"]'))
    click(findButton(el, 'Choose a different source'))
    const card = el.querySelector<HTMLButtonElement>('[data-source="tenforty"]')!
    expect(document.activeElement).toBe(card)
    // The ring rule targets .import-page .home-path-card:focus (pinned in
    // designQa.clusterB.test.ts); the markup has to match that selector.
    expect(card.classList.contains('home-path-card')).toBe(true)
    expect(card.closest('.import-page')).not.toBeNull()
  })
})
