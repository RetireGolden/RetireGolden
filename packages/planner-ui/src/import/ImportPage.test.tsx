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
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, listUserPlanSummaries } from '../data/planStore'
import { ImportPage } from './ImportPage'
import { parseImportProvenance } from './provenance'

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

/** Resolve a select through its visible label, the way keyboard/AT users reach it. */
function findSelect(el: HTMLElement, label: string): HTMLSelectElement {
  const lab = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.includes(label))
  expect(lab, `expected a label containing "${label}"`).toBeTruthy()
  const sel = el.ownerDocument.getElementById(lab!.htmlFor)
  expect(sel instanceof HTMLSelectElement, `expected a select labelled "${label}"`).toBe(true)
  return sel as HTMLSelectElement
}

function findInput(el: HTMLElement, label: string): HTMLInputElement {
  const lab = Array.from(el.querySelectorAll('label')).find((l) => l.textContent?.includes(label))
  expect(lab, `expected a label containing "${label}"`).toBeTruthy()
  const input = el.ownerDocument.getElementById(lab!.htmlFor)
  expect(input instanceof HTMLInputElement, `expected an input labelled "${label}"`).toBe(true)
  return input as HTMLInputElement
}

/**
 * Drive a select the way a keyboard commit does: focus it, then update the
 * value and fire the bubbling change event a browser fires when an option is
 * chosen with arrows/typeahead + Enter. (jsdom implements no native select
 * keyboard behavior, so the key press itself is emulated at the event level.)
 */
function selectByKeyboard(sel: HTMLSelectElement, value: string) {
  act(() => {
    sel.focus()
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    sel.value = value
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/** Poll for an observable UI condition instead of sleeping a fixed interval. */
async function waitForUi(done: () => boolean, what: string) {
  const deadline = Date.now() + 2000
  for (;;) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    if (done()) return
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
  }
}

async function chooseFile(el: HTMLElement, file: File, done: () => boolean, what: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitForUi(done, what)
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

    // The guided form shows the 1040 line fields. The dollar defaults (all $0)
    // are fine, but the state has no default — select one, then build.
    expect(el.textContent).toContain('Line 11')
    selectByKeyboard(findSelect(el, 'State of residence'), 'KY')
    act(() => findButton(el, 'Build my draft plan')!.click())
    await waitForUi(() => el.querySelector('.import-review') !== null, 'the review checklist')

    // Review checklist appears with the always-present unmapped guidance.
    expect(el.textContent).toContain('Not imported')

    const before = await listUserPlanSummaries()
    expect(before).toHaveLength(0)
    act(() => findButton(el, 'Save draft')!.click())
    await waitForUi(() => el.querySelector('[data-testid="plan-route"]') !== null, 'the saved plan route')
    const after = await listUserPlanSummaries()
    expect(after).toHaveLength(1)
    expect(after[0]!.name).toBe('Seeded from your 1040')
    expect(el.querySelector('[data-testid="plan-route"]')).not.toBeNull()
  })

  it('does not build the 1040 draft when Backspace is pressed in Line 7', () => {
    const el = render()
    click(findButton(el, 'tax return'))
    selectByKeyboard(findSelect(el, 'State of residence'), 'CO')

    const line7 = findInput(el, 'Line 7')
    act(() => {
      line7.focus()
      line7.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
      line7.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }))
      line7.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(el.querySelector('.import-review')).toBeNull()
    expect(findButton(el, 'Build my draft plan')).toBeTruthy()
    expect(line7.form).toBeTruthy()
  })

  it('starts the 1040 state unanswered and refuses to build until one is chosen', () => {
    const el = render()
    click(findButton(el, 'tax return'))

    // No prefilled state: the control starts on a visible placeholder, so a
    // selection that never registers cannot silently seed a default state.
    const state = findSelect(el, 'State of residence')
    expect(state.value).toBe('')
    expect(state.required).toBe(true)
    expect(state.options[0]!.value).toBe('')
    expect(state.options[0]!.disabled).toBe(true)
    expect(state.options[0]!.textContent).toContain('Select your state')

    act(() => findButton(el, 'Build my draft plan')!.click())
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Select your state of residence')
    expect(el.querySelector('.import-review')).toBeNull()
  })

  it('carries a keyboard-selected state into the draft review (guided-1040 CO regression)', async () => {
    const el = render()
    click(findButton(el, 'tax return'))

    const state = findSelect(el, 'State of residence')
    selectByKeyboard(state, 'CO')
    expect(state.value).toBe('CO')

    act(() => findButton(el, 'Build my draft plan')!.click())
    await waitForUi(() => el.querySelector('.import-review') !== null, 'the review checklist')
    // The review reports the state actually chosen — never a default.
    expect(el.textContent).toContain('Resident of CO')
    expect(el.textContent).not.toContain('Resident of KY')
  })

  it('walks a broker CSV to a draft with the review checklist', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))

    const csv = `"Positions for account Roth IRA ...321 as of 09:12 PM ET, 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","VANGUARD TOTAL STOCK MARKET ETF","$14,000.00","$10,000.00"
`
    await chooseFile(el, new File([csv], 'positions.csv', { type: 'text/csv' }), () => el.querySelector('.import-review') !== null, 'the review checklist')

    expect(el.textContent).toContain('Schwab positions file')
    expect(el.textContent).toContain('Roth IRA ...321')

    act(() => findButton(el, 'Save draft')!.click())
    await waitForUi(() => el.querySelector('[data-testid="plan-route"]') !== null, 'the saved plan route')
    const plans = await listUserPlanSummaries()
    expect(plans).toHaveLength(1)
    expect(plans[0]!.name).toBe('Imported from Schwab')
  })

  it('offers a download-report action for a drafted import whose envelope round-trips', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))

    // No draft yet — no report action is offered.
    expect(findButton(el, 'Download import report')).toBeUndefined()

    const csv = `"Positions for account Roth IRA ...321 as of 09:12 PM ET, 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","VANGUARD TOTAL STOCK MARKET ETF","$14,000.00","$10,000.00"
`
    await chooseFile(el, new File([csv], 'positions.csv', { type: 'text/csv' }), () => el.querySelector('.import-review') !== null, 'the review checklist')

    // Capture the blob the download assembles without touching the filesystem.
    let captured: Blob | null = null
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    const origClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      captured = obj as Blob
      return 'blob:mock'
    }
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = () => {}
    try {
      const btn = findButton(el, 'Download import report')
      expect(btn, 'download-report action should exist once a draft exists').toBeTruthy()
      click(btn)
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      HTMLAnchorElement.prototype.click = origClick
    }

    expect(captured).not.toBeNull()
    const json = await captured!.text()
    const parsed = parseImportProvenance(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('report did not parse')

    const prov = parsed.provenance
    // Exactly one source, correctly identified — file name, mapper, a real
    // 64-hex SHA-256, and the independently-computed UTF-8 byte length.
    expect(prov.sources).toHaveLength(1)
    expect(prov.sources[0]!.file).toBe('positions.csv')
    expect(prov.sources[0]!.mapper).toBe('brokerCsv')
    expect(prov.sources[0]!.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(prov.sources[0]!.bytes).toBe(new TextEncoder().encode(csv).length)

    // The report NEVER embeds the raw document.
    expect(json).not.toContain('VANGUARD TOTAL STOCK MARKET ETF')

    // Every exported entry carries structured provenance and no reviewer decision.
    const entries = [...prov.mappings, ...prov.unresolved]
    expect(entries.length).toBeGreaterThan(0)
    for (const e of entries) {
      expect(e.locator).toBeTruthy()
      expect(e.confidence).toBeTruthy()
      expect(e.decision).toBeUndefined()
    }
    // The page's own file-level summary landed in mappings with a locator.
    expect(prov.mappings.some((m) => m.source.includes('positions file'))).toBe(true)

    // The sourced aggregate is joined to the plan account it populated: the
    // balance mapping carries both its CSV-row locator and the accounts[i] target.
    const balance = prov.mappings.find((m) => m.source.startsWith('Roth IRA') && m.locator.kind === 'derived')
    expect(balance?.target).toBe('accounts[0]')
  })

  it('does not advertise a costBasis target on accounts that do not track basis', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))
    // A Roth section with mixed basis: the partial-basis note appears, but the
    // drafted roth plan account has no costBasis field to target.
    const csv = `"Positions for account Roth IRA ...9 as of 09:12 PM ET, 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","FUND","$10,000.00","$8,000.00"
"CASH","--","$500.00","--"
`
    await chooseFile(el, new File([csv], 'roth.csv', { type: 'text/csv' }), () => el.querySelector('.import-review') !== null, 'the review checklist')

    let captured: Blob | null = null
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    const origClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      captured = obj as Blob
      return 'blob:mock'
    }
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = () => {}
    try {
      click(findButton(el, 'Download import report'))
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      HTMLAnchorElement.prototype.click = origClick
    }
    const parsed = parseImportProvenance(await captured!.text())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('report did not parse')
    const entries = parsed.provenance.mappings
    const basisNote = entries.find((m) => m.detail.includes('had no cost basis'))!
    expect(basisNote).toBeTruthy()
    expect(basisNote.target).toBeUndefined()
    const balance = entries.find((m) => m.source.startsWith('Roth IRA') && m.locator.kind === 'derived')!
    expect(balance.target).toBe('accounts[0]')
  })

  it('refuses an oversized file before reading or hashing it', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))
    const big = new File([new Uint8Array(5_000_001)], 'huge.csv', { type: 'text/csv' })
    await chooseFile(el, big, () => el.querySelector('[role="alert"]') !== null, 'the error alert')
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('too large')
  })

  it('identifies the guided 1040 path without fingerprinting the typed inputs', async () => {
    const el = render()
    click(findButton(el, 'tax return'))
    selectByKeyboard(findSelect(el, 'State of residence'), 'KY')
    act(() => findButton(el, 'Build my draft plan')!.click())
    await waitForUi(() => el.querySelector('.import-review') !== null, 'the review checklist')

    let captured: Blob | null = null
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    const origClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      captured = obj as Blob
      return 'blob:mock'
    }
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = () => {}
    try {
      click(findButton(el, 'Download import report'))
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      HTMLAnchorElement.prototype.click = origClick
    }

    const parsed = parseImportProvenance(await captured!.text())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('report did not parse')
    expect(parsed.provenance.sources[0]!.file).toBe('guided-1040-entry')
    expect(parsed.provenance.sources[0]!.mapper).toBe('tenForty')
    // Deliberately NO hash: the typed inputs are low-entropy personal data, so
    // a deterministic fingerprint in a handoff report would be dictionary-
    // attackable (a DOB has ~36,500 plausible values).
    expect(parsed.provenance.sources[0]!.sha256).toBe('')
    expect(parsed.provenance.sources[0]!.bytes).toBe(0)
  })

  it('surfaces a helpful error for unrecognized files instead of importing junk', async () => {
    const el = render()
    click(findButton(el, 'Broker CSV'))
    await chooseFile(el, new File(['name,phone\nalice,555\n'], 'junk.csv', { type: 'text/csv' }), () => el.querySelector('[role="alert"]') !== null, 'the error alert')
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('spreadsheet import')
    expect(await listUserPlanSummaries()).toHaveLength(0)
  })
})
