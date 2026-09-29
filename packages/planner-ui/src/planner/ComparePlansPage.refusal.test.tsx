/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 (review F6): the Compare page's two guards around the
 * engine's headline comparison.
 *
 * - A comparison the engine refuses is stated on the page, in an alert that
 *   says in plain words which plan it is about and what to fix, instead of
 *   breaking the page (check correction 1; PR #754 finding 11: never the
 *   engine's own wording).
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

import { comparePlanHeadlines, PlanHeadlineRefusal } from '@retiregolden/engine/scenarios/planHeadlines'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
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
  for (const [what, refusal, sentence] of [
    [
      'a figure of Plan B that is not finite',
      () => new NonFiniteComparisonError('proposal', Number.NaN),
      "These two plans can't be compared: one of Plan B's figures could not be computed. Open Plan B's Results page to check its projection, then compare again.",
    ],
    [
      'a difference that is not finite',
      () => new NonFiniteComparisonError('difference', Number.POSITIVE_INFINITY),
      "These two plans can't be compared: the difference between their figures could not be computed. Open each plan's Results page to check its projection, then compare again.",
    ],
    [
      'a depleting Plan A with no valid date of birth',
      () => new PlanHeadlineRefusal('birth-date-missing', 'baseline', "The baseline plan's first person has no birth date in YYYY-MM-DD form, so no depletion age can be published"),
      "These two plans can't be compared: Plan A runs out of money, and its first person has no valid date of birth, so the age when that happens can't be worked out. Add the date of birth on Plan A's Household page, then compare again.",
    ],
    [
      // Unreachable from the page (both sides share compareStartYear), so it
      // gets the plain fallback, not a reload hint that would not help.
      'two different start years',
      () => new PlanHeadlineRefusal('start-years-differ', null, 'Two plans are compared only from one start year; the baseline starts in 2026 and the proposal in 2027'),
      "These two plans can't be compared: one plan's projection gave a result this page can't use. Open each plan's Results page to check its projection, then compare again.",
    ],
    [
      'any other refusal',
      () => new Error('Projection year 2031 publishes no usable inflationScale (undefined), so it has no dollar basis'),
      "These two plans can't be compared: one plan's projection gave a result this page can't use. Open each plan's Results page to check its projection, then compare again.",
    ],
  ] as const) {
    it(`states ${what} in plain words with a next step, and shows no table`, async () => {
      mockedCompare.mockImplementation(() => {
        throw refusal()
      })
      await mount(makeStore(pair('example-couple', 'hsa-stealth-retirement')))
      await waitFor(() => container.querySelector('[role="alert"]') !== null, { what: 'the refusal alert' })
      const text = container.querySelector('[role="alert"]')?.textContent ?? ''
      expect(text).toBe(sentence)
      for (const jargon of ['NaN', 'Infinity', 'YYYY-MM-DD', 'baseline', 'proposal', 'finite number', 'inflationScale']) {
        expect(text, jargon).not.toContain(jargon)
      }
      expect(container.querySelector('.compare-table')).toBeNull()
      expect(mockedCompare).toHaveBeenCalled()
    })
  }

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
