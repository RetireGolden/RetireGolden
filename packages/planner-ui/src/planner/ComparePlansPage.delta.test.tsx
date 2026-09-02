/** @vitest-environment jsdom */
/**
 * Compare-plans delta column (#499): rendered DOM. Two plans that differ in
 * when the money runs out get a years delta on Money lasts and Depletion age
 * and a percentage-point delta on Success %, instead of a dash; the legend
 * under the table says which color means what.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { createSamplePlan } from '../testSupport/samplePlan'
import { settle, waitFor } from '../testSupport/settle'
import { ComparePlansPage } from './ComparePlansPage'

function makeStore(plans: Plan[]): PlanStore {
  const docs = new Map<string, Plan>(plans.map((p) => [p.id, structuredClone(p)]))
  return {
    async listPlans(): Promise<PlanSummary[]> {
      return [...docs.values()].map((p) => ({ id: p.id, name: p.name, updatedAtIso: p.updatedAtIso }))
    },
    async loadPlan(id: string) {
      return docs.get(id) ?? null
    },
    async savePlan(plan: Plan) {
      docs.set(plan.id, structuredClone(plan))
    },
    async deletePlan(id: string) {
      docs.delete(id)
    },
  }
}

/** Plan A: the example couple. Plan B: the same couple spending far beyond its means, so it depletes. */
function differingPlans(): [Plan, Plan] {
  const a = createSamplePlan()
  a.id = 'plan-a'
  a.name = 'Alpha'
  const b = createSamplePlan()
  b.id = 'plan-b'
  b.name = 'Beta'
  b.expenses.baseAnnual = 600_000
  return [a, b]
}

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

function rowByLabel(label: string): string[] {
  const row = [...container.querySelectorAll('.compare-table tbody tr')].find(
    (tr) => tr.querySelector('th')?.textContent === label,
  )
  expect(row, `row ${label}`).toBeTruthy()
  return [...row!.querySelectorAll('td')].map((td) => td.textContent ?? '')
}

describe('ComparePlansPage delta column (#499)', () => {
  it('subtracts years, ages, and percentage points for rows that differ, and explains the colors', async () => {
    const [a, b] = differingPlans()
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={makeStore([a, b])}>
            <ComparePlansPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    await settle()
    await waitFor(() => container.querySelector('.compare-table tbody') !== null, { what: 'compare table' })

    const lasts = rowByLabel('Money lasts')
    expect(lasts[0]).toMatch(/^Full plan through \d{4}$/)
    expect(lasts[1]).toMatch(/^Depletes in \d{4}$/)
    // Plan B runs out earlier than Plan A's end: a negative years delta, in red.
    expect(lasts[2]).toMatch(/^−\d+ yrs?$/)

    const success = rowByLabel('Success % (deterministic)')
    expect(success).toEqual(['100%', '0%', '−100 pp'])

    const age = rowByLabel('Depletion age (primary)')
    expect(age[0]).toBe('—')
    expect(age[1]).toMatch(/^\d+$/)
    // One side never depletes: the age difference is undefined, and only then a dash.
    expect(age[2]).toBe('—')

    const deltaCells = [...container.querySelectorAll('.compare-table tbody tr')].map((tr) => tr.querySelectorAll('td')[2]!)
    const lastsCell = deltaCells[0]!
    expect(lastsCell.className).toBe('delta-neg')

    const legend = container.querySelector('.compare-delta-legend')!
    expect(legend.textContent).toContain('green')
    expect(legend.textContent).toContain('red')
    expect(legend.textContent).toContain('Lifetime tax reads lower as better')
    // The row headers are row-scoped so the delta cell reads with its metric.
    expect(container.querySelector('.compare-table tbody th')?.getAttribute('scope')).toBe('row')
  })

  it('reads an equal pair as 0 pp and same, never as a dash', async () => {
    const a = createSamplePlan()
    a.id = 'plan-a'
    a.name = 'Alpha'
    const twin = structuredClone(a)
    twin.id = 'plan-twin'
    twin.name = 'Twin'
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={makeStore([a, twin])}>
            <ComparePlansPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    await settle()
    await waitFor(() => container.querySelector('.compare-table tbody') !== null, { what: 'compare table' })
    expect(rowByLabel('Success % (deterministic)')[2]).toBe('0 pp')
    // Both full plan: no gap to quote, so the cell is a dash by design.
    expect(rowByLabel('Money lasts')[2]).toBe('—')
    expect(rowByLabel('Ending net worth')[2]).toBe('$0')
  })
})
