/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 parity for the relocation rows on library examples: each row's
 * lifetime tax difference and today's-dollar estate are the engine's
 * (RelocationCandidateRow.lifetimeTaxesAndPenaltiesDeltaVsBaseline and
 * .endingAfterTaxEstateTodayDollars), and they are the retired page
 * expressions (kept here) bit for bit; the page prints them unchanged and
 * names the first row as the baseline (P7).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { planDollarBasis, toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import type { RelocationCandidateRow, RelocationComparison } from '@retiregolden/engine/projection/relocation'
import { runRelocationCompareRequest } from '../relocation/runRelocation'
import { appExamplePlanById } from '../testSupport/appExamples'
import { settle, waitFor } from '../testSupport/settle'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { fmtMoney } from './format'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { RelocationComparePage } from './RelocationComparePage'

// ------------------------------------------------ the retired page expressions (RelocationComparePage.tsx at 4a80669e)
function retiredDelta(row: RelocationCandidateRow, baseline: RelocationCandidateRow): number | null {
  return row.error ? null : row.lifetimeTaxesAndPenalties - baseline.lifetimeTaxesAndPenalties
}
function retiredEstateToday(plan: Plan, result: RelocationComparison, row: RelocationCandidateRow): number | null {
  if (row.error || row.endYear < result.startYear) return null
  return toTodayDollars(planDollarBasis(plan.assumptions.inflationPct, result.startYear, row.endYear), row.endYear, row.endingAfterTaxEstate)
}
function retiredDeltaCell(row: RelocationCandidateRow, delta: number | null): string {
  return row.id === 'baseline' || delta === null ? '—' : `${delta > 0 ? '+' : ''}${fmtMoney(delta)}`
}

describe('relocation rows on library examples (B2-P1 slice 3)', () => {
  for (const id of ['example-couple', 'moving-state-tax']) {
    it(`${id}: the engine's row figures are the retired expressions for FL, TX and CA`, () => {
      const plan = appExamplePlanById(id)
      const result = runRelocationCompareRequest({
        plan,
        candidates: [{ state: 'FL' }, { state: 'TX' }, { state: 'CA' }],
        startYear: EXAMPLE_FIXED_YEAR,
        monteCarlo: null,
      })
      const baseline = result.rows[0]!
      expect(baseline.id).toBe('baseline')
      expect(result.rows).toHaveLength(4)
      for (const row of result.rows) {
        const retired = row.id === 'baseline' ? null : retiredDelta(row, baseline)
        expect(Object.is(row.lifetimeTaxesAndPenaltiesDeltaVsBaseline, retired), `${id} ${row.label} delta`).toBe(true)
        expect(
          Object.is(row.endingAfterTaxEstateTodayDollars, retiredEstateToday(plan, result, row)),
          `${id} ${row.label} estate`,
        ).toBe(true)
      }
    })
  }

  it('example-couple: the worksheet sample rows print as before', () => {
    const plan = appExamplePlanById('example-couple')
    const result = runRelocationCompareRequest({
      plan,
      candidates: [{ state: 'FL' }, { state: 'CA' }],
      startYear: EXAMPLE_FIXED_YEAR,
      monteCarlo: null,
    })
    const [baseline, florida, california] = result.rows
    expect(retiredDeltaCell(florida!, florida!.lifetimeTaxesAndPenaltiesDeltaVsBaseline)).toBe('-$69,920')
    expect(retiredDeltaCell(california!, california!.lifetimeTaxesAndPenaltiesDeltaVsBaseline)).toBe('+$43,302')
    expect([baseline, florida, california].map((row) => fmtMoney(row!.endingAfterTaxEstateTodayDollars!))).toEqual([
      '$1,638,837',
      '$1,796,477',
      '$1,521,481',
    ])
  })
})

describe('the rendered relocation table (B2-P1 slice 3)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR}-07-01T12:00:00.000Z`))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function contextFor(plan: Plan): PlanContextValue {
    return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  }

  const button = (text: string) => [...container.querySelectorAll('button')].find((b) => b.textContent === text)!

  it('moving-state-tax: prints the engine figures and names the first row, not a stay-put state', async () => {
    const plan = appExamplePlanById('moving-state-tax')
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <RelocationComparePage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    // FL is the default candidate; add TX and run without the Monte Carlo column.
    await act(async () => button('Add state').click())
    const mc = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => mc.click())
    await act(async () => button('Run compare').click())
    await settle()
    await waitFor(() => container.querySelector('table.year-table tbody') !== null, { what: 'ranked results' })

    const hint = [...container.querySelectorAll('.card-hint')].find((p) => p.textContent?.includes('Deltas are against'))
    expect(hint?.textContent).toContain('Deltas are against the first row (Your plan (FL → KY)).')
    expect(container.textContent).not.toContain('staying in KY')
    expect([...container.querySelectorAll('th')].some((th) => th.textContent === 'Δ vs your plan')).toBe(true)

    const expected = runRelocationCompareRequest({
      plan,
      candidates: [{ state: 'FL' }, { state: 'TX' }],
      startYear: EXAMPLE_FIXED_YEAR,
      monteCarlo: null,
    })
    const baseline = expected.rows[0]!
    // The ranked table is the first; the drivers panels below hold their own tables.
    const ranked = container.querySelector('table.year-table')!
    const printedRows = [...ranked.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent ?? ''),
    )
    // A row's first cell is its label, followed by any help text.
    const printedRow = (label: string) => printedRows.find((cells) => cells[0]!.startsWith(label))
    const printed = { get: printedRow }
    for (const row of expected.rows) {
      const cells = printed.get(row.label)
      expect(cells, `${row.label} among ${printedRows.map((cells) => cells[0]).join(' | ')}`).toBeDefined()
      expect(cells![3], `${row.label} delta`).toBe(retiredDeltaCell(row, row.id === 'baseline' ? null : retiredDelta(row, baseline)))
      expect(cells![4], `${row.label} estate`).toBe(fmtMoney(retiredEstateToday(plan, expected, row)!))
    }
    expect(printed.get('FL')![3]).toBe('-$145,118')
  })
})
