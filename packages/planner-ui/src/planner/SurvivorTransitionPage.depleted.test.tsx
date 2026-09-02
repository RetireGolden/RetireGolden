/** @vitest-environment jsdom */
/**
 * Survivor transition on a plan with nothing to transition (#513): when every
 * death timing shows no income, tax, balance, or estate on either side, the
 * page shows an empty state per person instead of confident-looking $0 → $0
 * rows. A plan that runs short of money but still has Social Security keeps
 * every row: the filing-status, SS, tax, and IRMAA columns are the point of
 * the page (review of #543). Rendered DOM through the real analysis.
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

/**
 * Planning ages of 78 keep the sweep to two death ages (70, 75) per person
 * over a short horizon, so each case is a few ledger runs, not dozens.
 */
function shortHorizon(plan: Plan): Plan {
  plan.household.people = plan.household.people.map((p) => ({ ...p, longevity: { ...p.longevity, planningAge: 78 } }))
  return plan
}

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
    attempts: 600,
    intervalMs: 20,
  })
}

/** The example couple with its assets and income stripped: nothing on either side of any transition. */
function bareCouple(): Plan {
  const plan = shortHorizon(createSamplePlan())
  plan.accounts = plan.accounts.filter((a) => a.type === 'cash').map((a) => ({ ...a, balance: 5_000 }))
  plan.incomes = []
  plan.insurance = []
  return plan
}

/** The same stripped couple, but keeping Social Security: out of money early, yet a real transition. */
function depletedCoupleWithSocialSecurity(): Plan {
  const plan = bareCouple()
  plan.incomes = createSamplePlan().incomes.filter((income) => income.type === 'socialSecurity')
  return plan
}

describe('SurvivorTransitionPage empty state (#513)', () => {
  it('shows an empty state per person when every timing has nothing on either side, naming the depletion year', async () => {
    const plan = bareCouple()
    const depletionYear = projectPlan(plan).summary.depletionYear
    expect(depletionYear, 'fixture depletes').not.toBeNull()
    await mount(plan)

    const wells = [...container.querySelectorAll('.empty-state[data-survivor-empty="degenerate"]')]
    expect(wells).toHaveLength(2)
    for (const well of wells) {
      expect(well.textContent).toContain('shows no income, tax, or balance on either side of the transition')
      expect(well.textContent).toContain(`runs out of money in ${depletionYear}`)
      expect(well.querySelector('a')?.getAttribute('href')).toBe(`/plan/${plan.id}/insights`)
    }
    // No timing row survives to assert shortfall years or a $0 estate.
    expect(container.querySelector('.survivor-table')).toBeNull()
    expect(container.textContent).not.toContain('shortfall yrs')
  }, 20_000)

  it('keeps every row for a plan that runs short of money but still has Social Security', async () => {
    const plan = depletedCoupleWithSocialSecurity()
    expect(plan.incomes.length).toBeGreaterThan(0)
    expect(projectPlan(plan).summary.depletionYear, 'fixture depletes').not.toBeNull()
    await mount(plan)

    expect(container.querySelector('[data-survivor-empty]')).toBeNull()
    expect(container.querySelector('[data-survivor-omitted]')).toBeNull()
    const tables = [...container.querySelectorAll('.survivor-table')]
    expect(tables).toHaveLength(2)
    // The transition is real: Social Security changes at the death, and the headers are column-scoped.
    for (const table of tables) {
      expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
      for (const th of table.querySelectorAll('thead th')) expect(th.getAttribute('scope')).toBe('col')
    }
    expect(container.textContent).toMatch(/\$[\d,.]+k? → \$[\d,.]+k?/)
  }, 20_000)

  it('keeps every timing row on a plan that never depletes', async () => {
    const plan = shortHorizon(createSamplePlan())
    expect(projectPlan(plan).summary.depletionYear).toBeNull()
    await mount(plan)
    expect(container.querySelector('[data-survivor-empty]')).toBeNull()
    expect(container.querySelectorAll('.survivor-table').length).toBe(2)
    expect(container.querySelector('[data-survivor-omitted]')).toBeNull()
  }, 20_000)
})
