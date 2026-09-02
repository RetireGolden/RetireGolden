/** @vitest-environment jsdom */
/**
 * Survivor transition on a depleted plan (#513): when the steady-market
 * projection runs out of money before any death timing, the page shows an
 * empty state per person instead of confident-looking $0 → $0 rows; a funded
 * plan still gets its tables. Rendered DOM through the real analysis.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { SurvivorTransitionPage } from './SurvivorTransitionPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { projectPlan } from './useProjection'

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

async function mount(plan: Plan) {
  const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={value}>
          <SurvivorTransitionPage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  // The sweep is debounced 200 ms off the keystroke path.
  await waitFor(() => container.querySelector('.skeleton') === null, {
    what: 'the death-timing sweep',
    attempts: 3000,
    intervalMs: 20,
  })
}

/** The example couple with its assets and income stripped: out of money in the first years. */
function depletedCouple(): Plan {
  const plan = createSamplePlan()
  plan.accounts = plan.accounts.filter((a) => a.type === 'cash').map((a) => ({ ...a, balance: 5_000 }))
  plan.incomes = []
  plan.insurance = []
  return plan
}

describe('SurvivorTransitionPage on a depleted plan (#513)', () => {
  it('shows an empty state per person that names the depletion year and links to Insights', async () => {
    const plan = depletedCouple()
    const depletionYear = projectPlan(plan).summary.depletionYear
    expect(depletionYear, 'fixture depletes').not.toBeNull()
    await mount(plan)

    const wells = [...container.querySelectorAll('.empty-state[data-survivor-empty="depleted"]')]
    expect(wells).toHaveLength(2)
    for (const well of wells) {
      expect(well.textContent).toContain(`after ${depletionYear}, when this plan's steady-market projection runs out of money`)
      expect(well.querySelector('a')?.getAttribute('href')).toBe(`/plan/${plan.id}/insights`)
    }
    // No timing row survives to assert shortfall years or a $0 estate.
    expect(container.querySelector('.survivor-table')).toBeNull()
    expect(container.textContent).not.toContain('shortfall yrs')
  }, 90_000)

  it('keeps every timing row on a plan that never depletes', async () => {
    const plan = createSamplePlan()
    expect(projectPlan(plan).summary.depletionYear).toBeNull()
    await mount(plan)
    expect(container.querySelector('.empty-state[data-survivor-empty]')).toBeNull()
    expect(container.querySelectorAll('.survivor-table').length).toBe(2)
    expect(container.querySelector('[data-survivor-omitted]')).toBeNull()
  }, 90_000)
})
