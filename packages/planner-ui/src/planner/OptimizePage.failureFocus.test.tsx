/** @vitest-environment jsdom */
/**
 * Optimizer failure wells (#525): a run's outcome is announced through a
 * live region, and an explicit Run / Re-run / Try again that ends in a
 * failure moves focus to the well so keyboard and screen-reader users land
 * on it instead of on <body>. An auto-run announces but never steals focus.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))

import { runOptimize } from '../optimize/runner'
import type { OptimizeResult } from '../optimize/messages'
import { OptimizePage } from './OptimizePage'

const mockedRunOptimize = vi.mocked(runOptimize)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

async function mount(plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>
          <OptimizePage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  // Past the 300 ms auto-run debounce.
  await settle()
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

/** The shape the page reads for a run that found no feasible schedule. */
function infeasibleResult(): OptimizeResult {
  return {
    schedule: { status: 'infeasible', endingAfterTax: 0, lifetimeTax: 0, schedule: [], conversions: [], solveMs: 1 },
    postProcessed: null,
    tournament: {
      policyId: 'max-after-tax-estate',
      winnerSource: 'none',
      winnerCandidateId: null,
      winnerLabel: '',
      winnerConversions: [],
      winnerValidation: null,
      marginOverMilpDollars: 0,
      candidates: [],
      retirementActionReadinessVeto: null,
      retirementActionPromotion: null,
      acaActionabilityVeto: null,
      searchRefined: false,
      searchSimulations: 0,
    },
    convergence: {},
    claimAge: null,
  } as unknown as OptimizeResult
}

const findButton = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === text)
const status = () => container.querySelector('[role="status"]')

describe('Optimize failure well (#525)', () => {
  it('announces a thrown failure, and Try again moves focus to the alert well', async () => {
    mockedRunOptimize.mockRejectedValue(new Error('solver exploded'))
    await mount(createSamplePlan())

    const well = container.querySelector<HTMLElement>('.optimizer-failure')!
    expect(well, 'the failure well rendered').not.toBeNull()
    expect(well.getAttribute('role')).toBe('alert')
    expect(well.textContent).toContain('Optimizer error: solver exploded')
    expect(status()?.textContent).toContain('Optimizer failed: solver exploded')
    // The auto-run never takes focus from whatever the user was doing.
    expect(document.activeElement).toBe(document.body)

    const tryAgain = findButton('Try again')!
    tryAgain.focus()
    await act(async () => tryAgain.click())
    await settle()
    const rerendered = container.querySelector<HTMLElement>('.optimizer-failure')!
    expect(document.activeElement).toBe(rerendered)
    expect(rerendered.tabIndex).toBe(-1)
  })

  it("announces a run that found no schedule, and Re-run focuses the Couldn't-optimize well", async () => {
    mockedRunOptimize.mockResolvedValue(infeasibleResult())
    await mount(createSamplePlan())

    expect(container.textContent).toContain("Couldn't optimize this plan")
    expect(status()?.textContent).toContain("couldn't optimize this plan")
    expect(document.activeElement).toBe(document.body)

    const rerun = findButton('Re-run optimizer')!
    rerun.focus()
    await act(async () => rerun.click())
    await settle()
    const well = container.querySelector<HTMLElement>('.card.optimizer-failure')!
    expect(well.textContent).toContain("Couldn't optimize this plan")
    expect(document.activeElement).toBe(well)
  })
})
