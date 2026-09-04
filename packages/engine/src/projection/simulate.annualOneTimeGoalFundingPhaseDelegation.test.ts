/**
 * Delegation and live-identity guard for the annual one-time-goal funding
 * phase. The scheduler's own suite (`spending/flexibleGoals.test.ts`) owns
 * which goals resolve; this file proves the caller consumes the phase's answer
 * rather than re-folding the goals beside an orphaned helper.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 *
 * The load-bearing assertion is object identity: the year's
 * `spending.flexibleGoals` has to BE the counts object the seam returned, which
 * a caller that rebuilt the counts itself could not satisfy. The funded totals
 * are checked with distinguishable per-year sentinels on top of that.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualOneTimeGoalFundingPhaseInput,
  AnnualOneTimeGoalFundingPhaseResult,
} from './internal/annualOneTimeGoalFundingPhase.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualOneTimeGoalFundingPhaseInput,
      AnnualOneTimeGoalFundingPhaseResult
    >(),
)

vi.mock('./internal/annualOneTimeGoalFundingPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualOneTimeGoalFundingPhase.js')
    >(),
    'annualOneTimeGoalFundingPhase',
    (natural, { ordinal }): AnnualOneTimeGoalFundingPhaseResult => ({
      ...natural,
      // A fresh counts object per pass, so the identity assertion below cannot
      // be satisfied by a cached or rebuilt one.
      goalOutcomeCounts: {
        ...natural.goalOutcomeCounts,
        deferred: 700 + ordinal,
      },
      skippedTargetNominal: natural.skippedTargetNominal + 11 + ordinal,
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
import {
  cashAccount,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027

function goalPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1955-01-01', planningAge: 90 })
  plan.accounts = [cashAccount('cash', 500_000)]
  plan.expenses.baseAnnual = 10_000
  plan.expenses.oneTimeGoals = [
    { id: 'goal-first', label: 'First', year: START_YEAR, amount: 4_000, classification: 'target' },
    { id: 'goal-second', label: 'Second', year: END_YEAR, amount: 6_000, classification: 'ideal' },
  ]
  return validatePlan(plan)
}

describe('annual one-time goal funding delegation', () => {
  it('publishes the seam\'s own counts object, one distinct pass per year', () => {
    seam.reset()
    const result = simulatePlan(goalPlan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const calls = expectSeamRan(seam, END_YEAR - START_YEAR + 1)
    expectDistinctInjections(seam)

    for (const [index, call] of calls.entries()) {
      // The caller hands the phase this year's own facts.
      expect(call.input.year).toBe(START_YEAR + index)
      expect(call.input.oneTimeGoals).toBe(
        // Same array the Plan carries, not a per-year rebuild.
        calls[0]?.input.oneTimeGoals,
      )

      const published = result.years[index]
      if (published === undefined) throw new Error('expected a published year')
      expectPublishedFromSeam(
        published.flexibleGoals,
        call.injected.goalOutcomeCounts,
        'the year\'s flexible-goal counts',
      )
      expect(published.flexibleGoals.deferred).toBe(700 + index)
      // The natural answer really was different, so the assertion is not
      // passing on a value the phase would have produced anyway.
      expect(call.natural.goalOutcomeCounts.deferred).not.toBe(700 + index)
    }
  })
})
