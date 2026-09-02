/** @vitest-environment jsdom */
/**
 * Results year table semantics (#522): a caption names the table and every
 * header cell is column-scoped, so a screen reader can associate a cell in a
 * ~20-column financial table with its header. Rendered DOM.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'

import { YearByYearLedger } from './ResultsPage'
import { taxCalculatorFor } from './useProjection'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('Results year table semantics (#522)', () => {
  it('has a caption and scope="col" on every header cell', async () => {
    const plan = validatePlan(singlePersonPlan({ dob: '1965-06-15', planningAge: 70, retirementAge: null }))
    const result = simulatePlan(plan, { startYear: 2030, taxCalculator: taxCalculatorFor(plan) })
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plan/p/results']}>
          <YearByYearLedger
            plan={plan}
            years={result.years}
            adj={(_year, v) => v}
            dollars="nominal"
            dollarLabel="nominal $"
            hasLayeredSpending={true}
            hasAmt={true}
            hasCarryforward={true}
          />
        </MemoryRouter>,
      )
    })
    const table = container.querySelector('table.year-table')!
    expect(table).not.toBeNull()
    const caption = table.querySelector('caption')!
    expect(caption, 'caption').not.toBeNull()
    expect(caption.textContent).toBe('Year-by-year projection, one row per plan year')
    expect(caption.className).toBe('sr-only')
    const headers = [...table.querySelectorAll('thead th')]
    // Every optional column is on, so the widest header row is the one checked.
    expect(headers.length).toBeGreaterThanOrEqual(20)
    for (const th of headers) expect(th.getAttribute('scope'), th.textContent ?? '').toBe('col')
    // The scroll wrap keeps its own name; the caption names the table itself.
    expect(table.closest('[role="region"]')?.getAttribute('aria-label')).toBe('Year-by-year table')
  })
})
