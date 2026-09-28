/** @vitest-environment jsdom */
/**
 * The survivor page's SSA-44 cell and call to action on the rows no example
 * plan has (the B2-P1 slice 5 review's L9): relief that saves nothing in its
 * two years but changes later premiums, and relief whose whole difference
 * falls in its two years. The engine's analysis runs for real on
 * example-couple; only the two SSA-44 figures of its rows are replaced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { survivorTransitionAnalysis } from '@retiregolden/engine/projection/survivorTransition'
import { getExampleById } from './examples/registry'
import { demoPlanId } from './examples/loadExample'
import { waitFor } from '../testSupport/settle'
import { SurvivorTransitionPage } from './SurvivorTransitionPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

vi.mock('@retiregolden/engine/projection/survivorTransition', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@retiregolden/engine/projection/survivorTransition')>()
  return { ...actual, survivorTransitionAnalysis: vi.fn(actual.survivorTransitionAnalysis) }
})
const actual = await vi.importActual<typeof import('@retiregolden/engine/projection/survivorTransition')>('@retiregolden/engine/projection/survivorTransition')

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function example(): Plan {
  const plan: Plan = { ...getExampleById('example-couple')!.build(), id: demoPlanId('example-couple'), origin: 'example', exampleSourceId: 'example-couple' }
  plan.expenses.healthcare.ssa44 = { survivorYears: false, retirementYears: false }
  return plan
}

/** Every row's SSA-44 figures replaced: `total` over the projection, `relief` over the two relief years. */
function withSsa44(total: number, relief: number) {
  vi.mocked(survivorTransitionAnalysis).mockImplementation((plan, options) => {
    const analysis = actual.survivorTransitionAnalysis(plan, options)
    return { ...analysis, rows: analysis.rows.map((row) => ({ ...row, ssa44PremiumSavings: total, ssa44ReliefYearSavings: relief })) }
  })
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
  await waitFor(() => container.querySelector('.skeleton') === null, {
    what: 'the death-timing sweep',
    attempts: 1500,
    intervalMs: 20,
    describe: () => container.textContent ?? '',
  })
}

const text = (): string => (container.textContent ?? '').replace(/\s+/gu, ' ')
const cta = 'Some timings show IRMAA relief your plan is not currently modeling.'

describe('the SSA-44 cell', () => {
  it('shows no saving and no call to action when the relief years save nothing, and names the later difference (SV3, SV4)', async () => {
    withSsa44(3_000, 0)
    await mount(example())
    expect(text()).toContain('no surcharge to relieve at this timing; later years differ by $3,000')
    expect([...container.querySelectorAll('td span.delta-pos')].some((s) => s.textContent === '$3,000')).toBe(false)
    expect(text()).not.toContain(cta)
  }, 120_000)

  it('names no later difference when the relief years hold all of it (SV5)', async () => {
    withSsa44(2_000, 2_000)
    await mount(example())
    expect([...container.querySelectorAll('td span.delta-pos')].some((s) => s.textContent === '$2,000')).toBe(true)
    expect(text()).not.toContain('in later years')
    expect(text()).toContain(cta)
  }, 120_000)
})
