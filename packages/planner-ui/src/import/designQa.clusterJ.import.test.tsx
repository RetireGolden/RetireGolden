/** @vitest-environment jsdom */
/**
 * Design-QA cluster J, the import half.
 *
 * #568 — a 1040 with line 3a (qualified dividends) filled and line 3b
 * (ordinary dividends) at zero built a draft that mentioned the dividends
 * nowhere: not under Imported, not under Not imported. The checklist's own
 * copy promises "nothing imports silently", so a value the mapper cannot use
 * has to say so.
 *
 * #569 — two columns could carry the same mapping role. `draftPlanFromGenericCsv`
 * reads one column per role (`roles.indexOf`), so the second column's data was
 * dropped with no row-level skip, no review item, and no warning; Continue
 * accepted the mapping.
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
import {
  analyzeGenericCsv,
  draftPlanFromGenericCsv,
  duplicateColumnRoles,
  duplicateRoleMessage,
  type ColumnRole,
} from './genericCsv'
import { ESTIMATED_BROKERAGE_NAME, seedPlanFromTenForty, type TenFortyInputs } from './tenForty'

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

// --- #568: the 1040 guided seed ------------------------------------------------

const BASE_1040: TenFortyInputs = {
  filingStatus: 'single',
  state: 'KY',
  primaryDob: '1960-04-02',
  wages: 0,
  taxExemptInterest: 0,
  taxableInterest: 0,
  qualifiedDividends: 0,
  ordinaryDividends: 0,
  iraDistributions: 0,
  pensionsAndAnnuities: 0,
  socialSecurityBenefits: 0,
  capitalGain: 0,
  agi: 0,
}

let seq = 0
const ids = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`

/** The seeded-brokerage row, found by what it is rather than by its wording. */
function estimateRow(review: ReturnType<typeof seed>['review']) {
  const rows = review.filter((i) => i.confidence === 'estimated')
  expect(rows, 'exactly one estimated row').toHaveLength(1)
  return rows[0]!
}

function seed(overrides: Partial<TenFortyInputs>) {
  seq = 0
  const r = seedPlanFromTenForty({ ...BASE_1040, ...overrides }, ids, () => new Date('2026-06-01T12:00:00Z'))
  if (!r.ok) throw new Error(r.message)
  return r
}

describe('cluster J: a 1040 line never leaves the checklist silent (#568)', () => {
  it('qualified dividends with line 3b at zero get a Not-imported row naming the reason', () => {
    // The filed repro: line 3a 50,000, line 3b 0.
    const { plan, review } = seed({ qualifiedDividends: 50_000, agi: 50_000 })
    // Nothing landed — the estimate is sized from 2b + 3b, both zero here.
    expect(plan.accounts).toHaveLength(0)
    const item = review.find((i) => i.source.includes('line 3a'))
    expect(item, 'a review item for line 3a').toBeDefined()
    expect(item!.status).toBe('unmapped')
    expect(item!.confidence).toBe('unmapped')
    expect(item!.locator).toEqual({ kind: 'form1040', line: '3a' })
    // The amount the user typed is in the row, so they can see what was dropped.
    expect(item!.detail).toContain('$50,000')
    expect(item!.detail).toContain('line 3b')
    // Nothing was seeded, so adding the account by hand is the right remedy.
    expect(item!.detail).toContain('add the brokerage account')
    expect(item!.detail).not.toContain(ESTIMATED_BROKERAGE_NAME)
  })

  it('says nothing extra when line 3b carries the dividends (the normal return)', () => {
    const { plan, review } = seed({ qualifiedDividends: 8_000, ordinaryDividends: 10_000, agi: 10_000 })
    expect(plan.accounts).toHaveLength(1)
    expect(review.filter((i) => i.source.includes('line 3a'))).toHaveLength(0)
    const estimate = estimateRow(review)
    expect(estimate.detail).toContain('The qualified-dividend share was kept.')
    // Line 2b is $0 on this return, so the estimate does not claim it either.
    expect(estimate.source).toBe('From your 1040, lines 3a/3b (dividends)')
  })

  it('sources all three lines only when interest and dividends both fed the estimate', () => {
    const { review } = seed({ taxableInterest: 2_000, qualifiedDividends: 8_000, ordinaryDividends: 10_000, agi: 12_000 })
    const estimate = estimateRow(review)
    expect(estimate.source).toBe('From your 1040, lines 2b/3a/3b (interest & dividends)')
    expect(estimate.locator).toEqual({
      kind: 'derived',
      from: [
        { kind: 'form1040', line: '2b' },
        { kind: 'form1040', line: '3a' },
        { kind: 'form1040', line: '3b' },
      ],
      note: 'balance implied by a 2.5% yield',
    })
  })

  it('reports line 3a as dropped even when line 2b interest builds the account without it', () => {
    // The account exists (sized from 2b alone), so the estimate row is there —
    // but its qualified ratio is 0, and 3a still landed nowhere. Both facts
    // have to be on the checklist, and neither row may claim the other's.
    const { plan, review } = seed({ taxableInterest: 5_000, qualifiedDividends: 50_000, agi: 55_000 })
    const account = plan.accounts[0]!
    expect(account.type === 'taxable' && account.qualifiedRatio).toBe(0)
    expect(account.type === 'taxable' && account.dividendYieldPct).toBe(0)
    const estimate = estimateRow(review)
    expect(estimate.detail).not.toContain('The qualified-dividend share was kept.')
    expect(estimate.detail).not.toContain('capped at 100%')
    expect(estimate.detail).toContain('Line 3b (ordinary dividends) is $0')
    // The estimate may not source a line that set nothing on it: with 3b at
    // zero, line 3a fed neither the balance nor the qualified ratio.
    expect(estimate.source).toBe('From your 1040, line 2b (taxable interest)')
    expect(estimate.locator).toEqual({
      kind: 'derived',
      from: [{ kind: 'form1040', line: '2b' }],
      note: 'balance implied by a 2.5% yield',
    })
    const dropped = review.find((i) => i.source.includes('line 3a'))!
    expect(dropped.status).toBe('unmapped')
    expect(dropped.detail).toContain('$50,000')
    // And the remedy points at the account that already exists. Telling the
    // user to "add the brokerage account" here would leave them holding two.
    expect(dropped.detail).toContain(ESTIMATED_BROKERAGE_NAME)
    expect(dropped.detail).toContain('rather than adding a second one')
    expect(dropped.detail).not.toContain('add the brokerage account')
    expect(plan.accounts.filter((a) => a.name === ESTIMATED_BROKERAGE_NAME)).toHaveLength(1)
  })

  it('names the cap when line 3a exceeds line 3b instead of claiming the share was kept', () => {
    // 3a is the qualified portion of 3b, so 3a > 3b cannot be a filed return;
    // the ratio is capped at 1 and the copy has to say so (#568, deep108).
    const { plan, review } = seed({ qualifiedDividends: 8_000, ordinaryDividends: 5_000, agi: 5_000 })
    const account = plan.accounts[0]!
    expect(account.type === 'taxable' && account.qualifiedRatio).toBe(1)
    const estimate = estimateRow(review)
    expect(estimate.detail).not.toContain('The qualified-dividend share was kept.')
    expect(estimate.detail).toContain('capped at 100%')
    expect(estimate.detail).toContain('$8,000')
    expect(estimate.detail).toContain('$5,000')
    // 3b is non-zero, so this is the capped case, not the dropped one.
    expect(review.filter((i) => i.source.includes('line 3a'))).toHaveLength(0)
  })
})

// --- #569: duplicate mapping roles ---------------------------------------------

/** The walk's sheet: two header cells that both guess "Account name". */
const DUPLICATE_ROLE_CSV = 'Account,Name,Balance\nBrokerage,Riley taxable,120000\nRoth,Riley Roth,80000\n'

function analyzed(text: string) {
  const r = analyzeGenericCsv(text)
  if (!r.ok) throw new Error(r.message)
  return r.analysis
}

describe('cluster J: two columns cannot quietly share one role (#569)', () => {
  it('the header-row guess really does put "name" on both columns', () => {
    // Without this the rest of the cluster would be testing a mapping the
    // wizard never produces.
    const analysis = analyzed(DUPLICATE_ROLE_CSV)
    expect(analysis.guessedRoles).toEqual(['name', 'name', 'balance'])
    expect(duplicateColumnRoles(analysis.guessedRoles)).toEqual(['name'])
  })

  it('the warning counts nothing: three name columns and two clashing roles both read true', () => {
    // `guessColumnRole` sends account / name / description all to `name`, so a
    // three-way clash is an ordinary header row, not an exotic hand mapping.
    const three = analyzed('Account,Name,Description,Balance\nBrokerage,Riley taxable,Joint,120000\n')
    expect(three.guessedRoles).toEqual(['name', 'name', 'name', 'balance'])
    const message = duplicateRoleMessage(duplicateColumnRoles(three.guessedRoles))
    expect(message).toContain('More than one column is set to “Account name”')
    expect(message).not.toContain('Two columns')
    // Two roles at once are named as a list, not as a count either.
    const both = duplicateRoleMessage(duplicateColumnRoles(['name', 'name', 'balance', 'balance']))
    expect(both).toContain('“Account name” and “Balance / value”')
    expect(both).not.toContain('Two columns')
  })

  it('"ignore" is the one role a sheet may repeat', () => {
    expect(duplicateColumnRoles(['ignore', 'ignore', 'name', 'balance'])).toEqual([])
    expect(duplicateColumnRoles(['name', 'balance', 'costBasis'])).toEqual([])
    expect(duplicateColumnRoles(['balance', 'balance', 'name', 'name'])).toEqual(['balance', 'name'])
  })

  it('the mapper refuses a duplicated role instead of reading the first column', () => {
    const analysis = analyzed(DUPLICATE_ROLE_CSV)
    const r = draftPlanFromGenericCsv(analysis, analysis.guessedRoles, ids)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('unreachable')
    expect(r.message).toContain('Account name')
    // Correcting the second column is all it takes.
    const fixed: ColumnRole[] = ['ignore', 'name', 'balance']
    const ok = draftPlanFromGenericCsv(analysis, fixed, ids)
    expect(ok.ok).toBe(true)
    if (!ok.ok) throw new Error('unreachable')
    expect(ok.plan.accounts.map((a) => a.name)).toEqual(['Riley taxable', 'Riley Roth'])
  })

  it('the mapping step warns and holds Continue until the clash is fixed', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => {
      root!.render(
        <MemoryRouter initialEntries={['/import']}>
          <ImportAvailabilityProvider enabled resolved>
            <Routes>
              <Route path="/import" element={<ImportPage />} />
              <Route path="/plan/:planId/*" element={<div data-testid="plan-route" />} />
            </Routes>
          </ImportAvailabilityProvider>
        </MemoryRouter>,
      )
    })
    const el = container
    const openSpreadsheet = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Spreadsheet / RPM'))
    act(() => openSpreadsheet!.click())

    const input = el.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', {
      value: [new File([DUPLICATE_ROLE_CSV], 'sheet.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitFor(() => el.querySelectorAll('select[aria-label^="Role for column"]').length > 0, {
      what: 'the column-mapping step',
      attempts: 400,
      intervalMs: 5,
    })

    const continueBtn = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Continue with these columns'),
    ) as HTMLButtonElement
    const alert = el.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('Account name')
    expect(continueBtn.disabled).toBe(true)
    // The alert is reachable from the selects that caused it, not just visible.
    const selects = [...el.querySelectorAll<HTMLSelectElement>('select[aria-label^="Role for column"]')]
    const flagged = selects.filter((s) => s.getAttribute('aria-invalid') === 'true')
    expect(flagged).toHaveLength(2)
    expect(flagged.every((s) => s.getAttribute('aria-describedby') === alert!.id)).toBe(true)

    // Choosing which column really is the name clears the warning and Continue,
    // and the column the user picked is the one that lands.
    await act(async () => {
      selects[0]!.value = 'ignore'
      selects[0]!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(el.querySelector('[role="alert"]')).toBeNull()
    const enabled = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Continue with these columns'),
    ) as HTMLButtonElement
    expect(enabled.disabled).toBe(false)
    act(() => enabled.click())
    await waitFor(() => el.querySelector('.import-review') !== null, {
      what: 'the review checklist',
      attempts: 400,
      intervalMs: 5,
    })
    expect(el.textContent).toContain('Riley taxable')
  })
})
