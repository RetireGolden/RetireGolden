/** @vitest-environment jsdom */
/**
 * Step 6 (UI/UX round 2): error-recovery and result affordances — human import
 * copy (no enum leak), and the Spending Solver's "Apply to Spending" writing the
 * solved level straight into the plan the way the Optimizer's "Use this schedule"
 * does. (MC/SS retry buttons are covered in workerErrors.test.tsx; the undo toast
 * in home/home.test.tsx.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { importErrorMessage } from './home/importErrorMessage'
import type { SpendingSolveResult } from '../optimize/spendingMessages'

vi.mock('../optimize/spendingRunner', () => ({ runSpendingSolve: vi.fn() }))
import { runSpendingSolve } from '../optimize/spendingRunner'
import { WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from '../workers/spawn'
import { SpendingSolverPage } from './SpendingSolverPage'

const mockedSolve = vi.mocked(runSpendingSolve)

describe('importErrorMessage', () => {
  const reasons = ['too_large', 'not_json', 'wrong_kind', 'unsupported_version', 'no_valid_plans', 'anything-else']

  it('never leaks the raw enum reason (no underscores, no schema jargon)', () => {
    for (const reason of reasons) {
      const msg = importErrorMessage(reason)
      expect(msg, reason).not.toContain('_')
      expect(msg.length, reason).toBeGreaterThan(20)
    }
  })

  it('points the user at the backup export when re-exporting would help', () => {
    // unsupported_version is the one case where a fresh export cannot fix it, so
    // its copy explains the mismatch instead of a dead-end next step.
    for (const reason of reasons.filter((r) => r !== 'unsupported_version')) {
      expect(importErrorMessage(reason), reason).toContain('Download backup')
    }
    expect(importErrorMessage('unsupported_version')).toMatch(/different version/)
  })
})

describe('Spending Solver — Apply to Spending', () => {
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
    vi.restoreAllMocks()
  })

  const result: SpendingSolveResult = {
    // The engine publishes the level that passed (92,450, deliberately NOT a
    // multiple of 100) rounded down to 92,400, and the page applies exactly
    // the published amount.
    maxBaseAnnual: 92_400,
    feasibleBaseAnnual: 92_450,
    maxBaseAnnualRounding: 'down-to-hundred',
    initialWithdrawalRatePct: null,
    spendingSlackDollars: 12_400,
    currentBaseAnnual: 80_000,
    estateFloorTodayDollars: 0,
    converged: true,
    limitingConstraint: 'depletion',
    simulationCount: 20,
    acaGrossPremiumYears: [],
    acaGrossPremiumReasons: [],
    acaGrossPremiumDirection: null,
    zeroSpendingDepletes: false,
    diagnostics: [],
    evidence: {
      endingAfterTaxEstate: 500_000,
      endingNetWorth: 500_000,
      lifetimeTaxesAndPenalties: 100_000,
      depletionYear: null,
      endYear: 2075,
    },
  }

  it('writes the solved baseline straight into the plan', async () => {
    mockedSolve.mockResolvedValue(result)
    const plan = createSamplePlan()
    let mutated: Plan = plan
    const ctx: PlanContextValue = {
      plan,
      update: (fn) => {
        // Apply the mutation to a shallow-cloned draft to observe the write.
        const draft = structuredClone(plan)
        fn(draft)
        mutated = draft
      },
      discardPendingSave: () => {},
      saveState: 'saved',
      issues: [],
    }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={ctx}>
            <SpendingSolverPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400)) // past the 300 ms auto-run debounce
    })

    const applyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Apply to Spending')
    expect(applyBtn, 'the solver answer should offer Apply to Spending').toBeTruthy()
    await act(async () => applyBtn!.click())

    // The published 92,400, not the 92,450 that passed: applying the passing
    // probe (or rounding up) would fail here.
    expect(mutated.expenses.baseAnnual).toBe(92_400)
  })

  it('shows the no-Worker reason for the solve and for the per-shape solves', async () => {
    const plan = createSamplePlan()
    const ctx: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
    // The page's own solve succeeds so the per-shape section renders; the
    // per-shape solves then fail the way a production build without Worker does.
    mockedSolve.mockResolvedValueOnce(result).mockRejectedValue(new WorkerUnavailableError())
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={ctx}>
            <SpendingSolverPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    const perShape = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Solve per shape'))
    expect(perShape, 'the per-shape solve button').toBeTruthy()
    await act(async () => perShape!.click())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(container.textContent).toContain(`Per-shape solve error: ${WORKER_UNAVAILABLE_MESSAGE}`)

    // A fresh mount whose own solve fails.
    await act(async () => root.unmount())
    root = createRoot(container)
    mockedSolve.mockReset()
    mockedSolve.mockRejectedValue(new WorkerUnavailableError())
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={ctx}>
            <SpendingSolverPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(container.textContent).toContain(`Solver error: ${WORKER_UNAVAILABLE_MESSAGE}`)
  })
})
