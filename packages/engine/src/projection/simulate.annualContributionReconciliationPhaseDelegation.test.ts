/**
 * Delegation guard for the annual contribution reconciliation phase.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. The planner's
 * own arithmetic is pinned by `simulate.annualContributionsAndEmployerMatchDelegation.test.ts`
 * and block U; nothing here re-checks a limit.
 *
 * **What the sentinel is.** The phase hands back eight channels, and two of
 * them -- `employerMatch` and `contributions` -- are published verbatim on the
 * year. So the seam adds a distinguishable per-pass offset to both and requires
 * the published year to carry it. A caller that derived its own totals beside
 * the still-called phase publishes the natural numbers instead, and fails here.
 *
 * **Why the totals and not the balances.** The phase also mutates `balances`,
 * `rothBasis` and the runtime journal, but those effects survive an orphan: a
 * caller that re-derived the totals while still calling the phase would leave
 * every balance correct and only the published totals wrong. Sentinels on the
 * published totals are therefore the assertion that actually bites, and they
 * are the reason the equivalence dump alone cannot stand in for this file.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualContributionReconciliationPhaseInput,
  AnnualContributionReconciliationPhaseResult,
} from './internal/annualContributionReconciliationPhase.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualContributionReconciliationPhaseInput,
      AnnualContributionReconciliationPhaseResult
    >(),
)

vi.mock('./internal/annualContributionReconciliationPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualContributionReconciliationPhase.js')
    >(),
    'annualContributionReconciliationPhase',
    (natural, { ordinal }): AnnualContributionReconciliationPhaseResult => ({
      ...natural,
      employerMatch: natural.employerMatch + 130 + ordinal,
      contributions: natural.contributions + 1_700 + ordinal,
    }),
  ),
)

import {
  expectDistinctInjections,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { basePlan, cash, validate, wages } from './simulate.test-support.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027

/**
 * Working, contributing and matched, so the natural totals this year are both
 * non-zero and the sentinel offsets cannot be mistaken for them.
 */
function contributingPlan(): Plan {
  const plan = basePlan()
  const employer: Account = {
    type: 'traditional',
    id: 'employer-401k',
    name: '401k',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'employer',
    balance: 120_000,
    annualContribution: 10_000,
    employerMatch: { matchPct: 50, capPctOfPay: 6 },
  }
  plan.accounts = [cash(200_000), employer]
  plan.incomes = [wages(90_000)]
  plan.expenses.baseAnnual = 40_000
  return validate(plan)
}

describe('annual contribution reconciliation delegation', () => {
  it('publishes the seam\'s own contribution and match totals', () => {
    seam.reset()
    const plan = contributingPlan()
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
      // The live physical rows, by identity: a copy would drop the year's
      // contributions on the floor.
      expect(call.input.balances).toBe(calls[0]?.input.balances)

      const published = result.years[index]
      if (published === undefined) throw new Error('expected a published year')
      expect(published.employerMatch).toBe(call.injected.employerMatch)
      expect(published.contributions).toBe(call.injected.contributions)
      // The natural answer really was different, so neither assertion above
      // can pass on a value the phase would have produced anyway.
      expect(call.natural.employerMatch).not.toBe(call.injected.employerMatch)
      expect(call.natural.contributions).not.toBe(call.injected.contributions)
      expect(call.natural.employerMatch).toBeGreaterThan(0)
      expect(call.natural.contributions).toBeGreaterThan(0)
    }
  })
})
