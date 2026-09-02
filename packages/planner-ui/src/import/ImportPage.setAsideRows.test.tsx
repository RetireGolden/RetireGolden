/** @vitest-environment jsdom */
/**
 * Rendered map step for a spreadsheet with rows that carry no dollar value
 * (#557): the count sentence, the per-row list by source row number, the cap
 * with its "and N more" tail, and the checklist entries after Continue.
 * Rendered through the real ImportPage, so the singular/plural wording and the
 * list are what a person sees, not a string in the source.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests } from '../data/planStore'
import { MAX_CELL_PREVIEW_CHARS, MAX_SET_ASIDE_LISTED } from './genericCsv'
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

const findButton = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text))

async function chooseCsv(el: HTMLElement, csv: string, done: () => boolean, what: string) {
  const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [new File([csv], 'sheet.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await waitFor(done, { what, attempts: 400, intervalMs: 5 })
}

const mapStepShown = (el: HTMLElement) => /data rows? found/.test(el.textContent ?? '')
const listed = (el: HTMLElement) => Array.from(el.querySelector('[data-testid="set-aside-rows"]')!.querySelectorAll('li')).map((li) => li.textContent)

describe('Import map step: rows with no dollar value (#557)', () => {
  it('one set-aside row: singular sentence, the row listed by number, then a skipped checklist entry', async () => {
    const el = render()
    click(el.querySelector('[data-source="generic"]'))
    // The third cell is long: the list echoes a bounded preview of it.
    const long = 'abc'.repeat(40)
    await chooseCsv(el, `Account,Type,Balance\nBrokerage,Taxable,"$120,000"\nMystery,???,${long}\n`, () => mapStepShown(el), 'the map step')
    const hint = el.querySelector('.card-hint')!.textContent ?? ''
    expect(el.textContent).toContain('1 data row found.')
    expect(el.textContent).toContain('1 row with no dollar value in any column was set aside and will be reported as skipped after Continue:')
    expect(hint).not.toContain('were set aside')
    expect(listed(el)).toEqual([`Row 3: Mystery · ??? · ${long.slice(0, MAX_CELL_PREVIEW_CHARS - 1)}…`])
    expect(el.textContent).not.toContain(long)
    // The list takes the stylesheet's class, not one-off inline spacing.
    const list = el.querySelector('[data-testid="set-aside-rows"]')!
    expect(list.classList.contains('import-set-aside')).toBe(true)
    expect(list.getAttribute('style')).toBeNull()

    click(findButton(el, 'Continue with these columns'))
    await waitFor(() => el.querySelector('.import-review') !== null, { what: 'the review checklist', attempts: 400, intervalMs: 5 })
    const skippedGroup = el.querySelector('.import-review-group--skipped')!
    expect(skippedGroup.querySelector('h4')!.textContent).toContain('Skipped')
    expect(skippedGroup.textContent).toContain('Row 3: Mystery')
    expect(skippedGroup.textContent).toContain('No cell in this row read as a dollar value')
  })

  it('several set-aside rows: plural sentence and every row listed, a truncated account and a footer alike, by source line', async () => {
    const el = render()
    click(el.querySelector('[data-source="generic"]'))
    // A title line above the header is set aside too (row 1); a blank line
    // before the footer makes it row 7 in the sheet, and it is called row 7.
    await chooseCsv(
      el,
      'Net worth,2025\nAccount,Type,Balance\nBrokerage,Taxable,"$120,000"\nNotes,first,n/a\nI-bonds,,\n\nPrepared by Chase,,\n',
      () => mapStepShown(el),
      'the map step',
    )
    expect(el.textContent).toContain('4 rows with no dollar value in any column were set aside and will be reported as skipped after Continue:')
    expect(listed(el)).toEqual(['Row 1: Net worth · 2025', 'Row 4: Notes · first · n/a', 'Row 5: I-bonds', 'Row 7: Prepared by Chase'])
    expect(el.textContent).not.toContain('Row 2: Account')
    // The preview table itself still shows only the data rows.
    expect(el.querySelectorAll('.year-table tbody tr')).toHaveLength(1)
  })

  it('caps the list like the preview and says how many more there are, with their row range', async () => {
    const el = render()
    click(el.querySelector('[data-source="generic"]'))
    const lines = ['Account,Balance', 'Brokerage,"$120,000"']
    const extra = MAX_SET_ASIDE_LISTED + 4
    for (let i = 0; i < extra; i++) lines.push(`Note ${i + 1},x`)
    await chooseCsv(el, lines.join('\n') + '\n', () => mapStepShown(el), 'the map step')
    expect(el.textContent).toContain(`${extra} rows with no dollar value in any column were set aside`)
    const items = listed(el)
    expect(items).toHaveLength(MAX_SET_ASIDE_LISTED + 1)
    expect(items[0]).toBe('Row 3: Note 1 · x')
    expect(items[MAX_SET_ASIDE_LISTED]).toBe(`and 4 more (rows ${MAX_SET_ASIDE_LISTED + 3} to ${extra + 2})`)
  })
})
