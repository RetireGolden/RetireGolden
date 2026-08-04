/** @vitest-environment jsdom */
/**
 * Optimize page precondition: a plan carrying identity-bearing retirement
 * actions must never reach the optimizer worker.
 *
 * Before this guard the page dispatched, the engine threw from
 * `buildOptimizerInput`, and the user got the raw engine string
 * ("Optimizer error: The optimizer does not yet support identity-bearing
 * retirement actions") beside a "Try again" button that was guaranteed to fail
 * identically forever. These tests pin both halves of the fix: no dispatch, and
 * a non-actionable state with no retry affordance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createActionReason, parseRetirementActionRequest } from '@retiregolden/engine/actions'
import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))

import { runOptimize } from '../optimize/runner'
import { OptimizePage } from './OptimizePage'
import {
  OPTIMIZER_RETIREMENT_ACTION_HEADING,
  OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP,
  optimizerRetirementActionExplanation,
} from './optimizerRetirementActionCopy'

const mockedRunOptimize = vi.mocked(runOptimize)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
  // Never resolves: a dispatch that happened is proved by the call count, and
  // an unresolved promise keeps a bypassed guard from painting a real result.
  mockedRunOptimize.mockImplementation(() => new Promise(() => {}))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
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
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

/** The plan a user lands on after recording one action in the WS5 editor. */
function actionBearingPlan(): Plan {
  const plan = createSamplePlan()
  const owner = plan.household.people[0]!
  const source = plan.accounts.find((a) => a.type === 'traditional' && a.ownerPersonId === owner.id)!
  const parsed = parseRetirementActionRequest({
    actionId: 'guard-withdrawal',
    kind: 'ordinaryWithdrawal',
    year: 2034,
    executionDate: '2034-03-04',
    executionSequence: 1,
    requestedAmount: 10_000_00,
    provenance: { source: 'manual' },
    personId: owner.id,
    allocations: [{
      allocationId: 'guard-withdrawal-allocation',
      sourceAccountId: source.id,
      requestedAmount: 10_000_00,
    }],
    purpose: { kind: 'spending' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  plan.strategies.retirementActions = [parsed.request]
  return plan
}

const buttonTexts = () => [...container.querySelectorAll('button')].map((b) => b.textContent ?? '')

describe('Optimize page retirement-action precondition', () => {
  it('never dispatches to the optimizer worker for an action-bearing plan', async () => {
    await mount(actionBearingPlan())

    // The product fix. If the guard is bypassed the page dispatches, the engine
    // throws, and the raw string is back on screen.
    expect(mockedRunOptimize).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('Optimizer error')
    expect(container.textContent).not.toContain('identity-bearing')
    expect(container.querySelector('[aria-label="Optimizing"]')).toBeNull()

    await act(async () => root.unmount())
  })

  it('renders the non-actionable state with no retry affordance', async () => {
    const plan = actionBearingPlan()
    await mount(plan)

    expect(container.textContent).toContain(OPTIMIZER_RETIREMENT_ACTION_HEADING)
    expect(container.textContent).toContain(
      optimizerRetirementActionExplanation(
        plan.strategies.retirementActions.map(() =>
          createActionReason('optimizer-retirement-action-unsupported'),
        ),
      ),
    )
    expect(container.textContent).toContain(OPTIMIZER_RETIREMENT_ACTION_NEXT_STEP)
    // Retrying cannot clear this condition, so no control offers to.
    expect(buttonTexts()).not.toContain('Try again')
    expect(buttonTexts()).not.toContain('Run optimizer')
    expect(buttonTexts()).not.toContain('Re-run optimizer')
    expect(buttonTexts()).not.toContain('Download recommendation report')

    await act(async () => root.unmount())
  })

  it('still dispatches, and shows no such card, for the same plan without actions', async () => {
    // The control: without this the first two assertions would also pass on a
    // page that had simply stopped working.
    await mount(createSamplePlan())

    expect(mockedRunOptimize).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain(OPTIMIZER_RETIREMENT_ACTION_HEADING)

    await act(async () => root.unmount())
  })
})
