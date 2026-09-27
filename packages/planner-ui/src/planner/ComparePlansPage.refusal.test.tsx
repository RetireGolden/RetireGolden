/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 (review F6): the Compare page's two guards around the
 * engine's headline comparison.
 *
 * - A comparison the engine refuses is stated on the page, in an alert naming
 *   the engine's reason, instead of breaking the page (check correction 1).
 * - Both plans are projected from the one start year the page reads before
 *   loading them: a clock that crosses a New Year between the two loads must
 *   not give the two sides different start years, which the engine refuses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { appExamplePlanById } from '../testSupport/appExamples'
import { settle, waitFor } from '../testSupport/settle'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'

vi.mock('@retiregolden/engine/scenarios/planHeadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@retiregolden/engine/scenarios/planHeadlines')>()
  return { ...actual, comparePlanHeadlines: vi.fn(actual.comparePlanHeadlines) }
})

import { comparePlanHeadlines } from '@retiregolden/engine/scenarios/planHeadlines'
import { ComparePlansPage } from './ComparePlansPage'

const mockedCompare = vi.mocked(comparePlanHeadlines)

/** A stub store; `beforeLoad` runs inside loadPlan before the plan is returned. */
function makeStore(plans: Plan[], beforeLoad: (id: string) => Promise<void> = async () => {}): PlanStore {
  const docs = new Map<string, Plan>(plans.map((p) => [p.id, structuredClone(p)]))
  return {
    async listPlans(): Promise<PlanSummary[]> {
      return [...docs.values()].map((p) => ({ id: p.id, name: p.name, updatedAtIso: p.updatedAtIso }))
    },
    async loadPlan(id: string) {
      await beforeLoad(id)
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

/** Example ids route to the browser's own example store, so the pair is saved as two user plans. */
function pair(a: string, b: string): Plan[] {
  return [
    { ...appExamplePlanById(a), id: 'compare-plan-a', origin: 'user' as const },
    { ...appExamplePlanById(b), id: 'compare-plan-b', origin: 'user' as const },
  ]
}

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
  mockedCompare.mockReset()
  vi.useRealTimers()
})

async function mount(store: PlanStore) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanStoreProvider store={store}>
          <ComparePlansPage />
        </PlanStoreProvider>
      </MemoryRouter>,
    )
  })
  await settle()
}

describe('Compare page guards (B2-P1 slice 3, review F6)', () => {
  it('states a comparison the engine refuses in an alert, and shows no table', async () => {
    const reason = 'A compared figure must be a finite number; the proposal is NaN'
    mockedCompare.mockImplementation(() => {
      throw new RangeError(reason)
    })
    await mount(makeStore(pair('example-couple', 'hsa-stealth-retirement')))
    await waitFor(() => container.querySelector('[role="alert"]') !== null, { what: 'the refusal alert' })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(`These two plans cannot be compared: ${reason}`)
    expect(container.querySelector('.compare-table')).toBeNull()
    expect(mockedCompare).toHaveBeenCalled()
  })

  it('projects both plans from the start year it read before loading them, across a New Year', async () => {
    // The first plan loads at once; the second loads after the clock has
    // crossed into the next year. Projected from the clock at load time, the
    // two sides would start in different years and the engine would refuse.
    await mount(
      makeStore(pair('example-couple', 'hsa-stealth-retirement'), async (id) => {
        if (id !== 'compare-plan-b') return
        await new Promise((resolve) => setTimeout(resolve, 20))
        vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR + 1}-01-01T12:00:00.000Z`))
      }),
    )
    await waitFor(() => container.querySelector('.compare-table tbody') !== null, { what: 'compare table' })
    expect(container.querySelector('[role="alert"]')).toBeNull()
    const calls = mockedCompare.mock.calls
    const [baseline, proposal] = calls[calls.length - 1]!
    expect(baseline.result.startYear).toBe(EXAMPLE_FIXED_YEAR)
    expect(proposal.result.startYear).toBe(EXAMPLE_FIXED_YEAR)
    expect(container.querySelector('.compare-basis')?.textContent).toContain(`${EXAMPLE_FIXED_YEAR} dollars`)
  })
})
