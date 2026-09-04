/**
 * Delegation and live-identity guard for the annual expense assembly phase.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. Each producer
 * inside the phase has its own suite; nothing here re-checks a premium, a
 * guardrail band or a goal schedule.
 *
 * **Two sentinels, because the phase publishes two different kinds of thing.**
 * `irmaaTier` is a pure pass-through -- the year reads it once and publishes
 * it -- so a distinguishable per-pass number proves the published value came
 * from this seam. `goalOutcomeCounts` is published BY IDENTITY as the year's
 * `flexibleGoals`, so a fresh object per pass proves the year did not rebuild
 * the counts beside an orphaned helper. A caller that re-derived either one
 * fails here while leaving every balance in the ledger correct, which is
 * exactly why the equivalence dump cannot stand in for this file.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualExpenseAssemblyPhaseInput,
  AnnualExpenseAssemblyPhaseResult,
} from './internal/annualExpenseAssemblyPhase.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualExpenseAssemblyPhaseInput,
      AnnualExpenseAssemblyPhaseResult
    >(),
)

vi.mock('./internal/annualExpenseAssemblyPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualExpenseAssemblyPhase.js')
    >(),
    'annualExpenseAssemblyPhase',
    (natural, { ordinal }): AnnualExpenseAssemblyPhaseResult => ({
      ...natural,
      irmaaTier: natural.irmaaTier + 7 + ordinal,
      // A fresh counts object per pass, so the identity assertion below cannot
      // be satisfied by a cached or rebuilt one.
      goalOutcomeCounts: { ...natural.goalOutcomeCounts },
    }),
  ),
)

import {
  expectDistinctInjections,
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import type { Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { basePlan, cash, validate } from './simulate.test-support.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027

function spendingPlan(): Plan {
  const plan = basePlan()
  plan.accounts = [cash(400_000)]
  plan.expenses.baseAnnual = 30_000
  plan.expenses.oneTimeGoals = [
    { id: 'goal-first', label: 'First', year: START_YEAR, amount: 4_000, classification: 'target' },
    { id: 'goal-second', label: 'Second', year: END_YEAR, amount: 6_000, classification: 'ideal' },
  ]
  return validate(plan)
}

describe('annual expense assembly delegation', () => {
  it('publishes the seam\'s own IRMAA tier and goal-counts object', () => {
    seam.reset()
    const plan = spendingPlan()
    const result = simulatePlan(plan, {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const calls = expectSeamRan(seam, END_YEAR - START_YEAR + 1)
    expectDistinctInjections(seam)

    for (const [index, call] of calls.entries()) {
      // The caller hands the phase this year's own facts, not a stale copy.
      expect(call.input.year).toBe(START_YEAR + index)
      expect(call.input.startYear).toBe(START_YEAR)
      // The Plan itself, not a per-year rebuild.
      expect(call.input.plan).toBe(calls[0]?.input.plan)

      const published = result.years[index]
      if (published === undefined) throw new Error('expected a published year')
      expect(published.irmaaTier).toBe(call.injected.irmaaTier)
      // The natural answer really was different, so the assertion above cannot
      // pass on a value the phase would have produced anyway.
      expect(call.natural.irmaaTier).not.toBe(call.injected.irmaaTier)
      expectPublishedFromSeam(
        published.flexibleGoals,
        call.injected.goalOutcomeCounts,
        'the year\'s flexible-goal counts',
      )
    }
  })
})
