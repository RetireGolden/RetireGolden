/**
 * Mounts the real Results page (or any planner page) for one plan under a bare
 * plan context and a memory router, so a jsdom test reads what the page
 * actually prints. The caller pins the clock (the page projects from the
 * calendar year) and mocks the background Monte Carlo hook in its own file.
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planner/planContextCore'

export interface MountedPage {
  readonly container: HTMLDivElement
  unmount: () => Promise<void>
}

/** Render `page` for `plan` at `path`, with the plan in context and no pending edits. */
export async function mountPlanPage(plan: Plan, page: ReactNode, path = `/plan/${plan.id}/results`): Promise<MountedPage> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <PlanCtx.Provider
        value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
      >
        {page}
      </PlanCtx.Provider>
    </MemoryRouter>
  )
  // A promise-returning act callback, so the await settles the render's effects.
  await act(() => Promise.resolve(root.render(tree)))
  return {
    container,
    unmount: async () => {
      await act(() => Promise.resolve(root.unmount()))
      container.remove()
    },
  }
}

/** Press the Results page's dollar toggle ("Today's $" or "Nominal $"). */
export async function chooseDollars(container: HTMLElement, mode: 'today' | 'nominal'): Promise<void> {
  const label = mode === 'today' ? "Today's $" : 'Nominal $'
  const button = [...container.querySelectorAll<HTMLButtonElement>('.seg button')].find((b) => b.textContent === label)
  if (!button) throw new Error(`dollar toggle "${label}" not rendered`)
  await act(() => Promise.resolve(button.click()))
}

/** The year-by-year table's header labels and a cell reader keyed by year and header label. */
export function yearTable(container: HTMLElement): {
  headers: string[]
  years: number[]
  cell: (year: number, header: string) => HTMLTableCellElement
} {
  const table = container.querySelector<HTMLTableElement>('#year-table table.year-table')
  if (!table) throw new Error('year-by-year table not rendered')
  const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '')
  const rows = [...table.querySelectorAll('tbody tr')]
  const years = rows.map((tr) => Number(tr.querySelector('td')?.textContent))
  return {
    headers,
    years,
    cell: (year, header) => {
      const column = headers.indexOf(header)
      if (column < 0) throw new Error(`column "${header}" not rendered`)
      const row = rows[years.indexOf(year)]
      if (!row) throw new Error(`row ${year} not rendered`)
      return row.querySelectorAll('td')[column] as HTMLTableCellElement
    },
  }
}
