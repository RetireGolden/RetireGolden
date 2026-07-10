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
import { MemoryRouter } from 'react-router-dom'

import type { Plan } from '../engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { importErrorMessage } from './home/importErrorMessage'
import type { SpendingSolveResult } from '../optimize/spendingMessages'

vi.mock('../optimize/spendingRunner', () => ({ runSpendingSolve: vi.fn() }))
import { runSpendingSolve } from '../optimize/spendingRunner'
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
    // Deliberately NOT a multiple of 100 so the test exercises the
    // floor-to-$100 display/apply rule.
    maxBaseAnnual: 92_450,
    spendingSlackDollars: 12_450,
    currentBaseAnnual: 80_000,
    estateFloorTodayDollars: 0,
    converged: true,
    limitingConstraint: 'depletion',
    simulationCount: 20,
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

    // 92,450 floors to 92,400 — applying the raw solver dollars (or rounding
    // up) would fail here.
    expect(mutated.expenses.baseAnnual).toBe(92_400)
  })
})
