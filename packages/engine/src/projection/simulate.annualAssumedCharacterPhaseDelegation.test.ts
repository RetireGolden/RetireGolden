/**
 * Delegation and live-identity guard for the annual assumed-character phase.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 *
 * **What the sentinel is.** The phase's three callbacks are consumed inside the
 * annual pass, where a delegation test cannot watch them fire without mocking
 * half the ledger. Its fourth answer can be watched: the live
 * `form8606ConsequentialByOwner` map travels into the funding-close phase and
 * out through `publishedEntityFacts` onto the year's entity-fact rows. So this
 * guard seeds a map the real phase would never have produced — an owner with no
 * omitted basis at all — and requires the published year to carry it. A caller
 * that built its own map beside an orphaned helper publishes nothing.
 *
 * **Per pass, not per year.** `simulatePlan` may re-enter the annual ledger
 * several times in one year (T0, staging, the committed settlement), and the
 * phase is built on each entry, so the seam count is not the year count.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualAssumedCharacterPhaseInput,
  AnnualAssumedCharacterPhaseResult,
} from './internal/annualAssumedCharacterPhase.js'

const SENTINEL_OWNER = 'seam-assumed-character-owner'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualAssumedCharacterPhaseInput,
      AnnualAssumedCharacterPhaseResult
    >(),
)

vi.mock('./internal/annualAssumedCharacterPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualAssumedCharacterPhase.js')
    >(),
    'annualAssumedCharacterPhase',
    (natural, { ordinal }): AnnualAssumedCharacterPhaseResult => {
      const seeded = new Map(natural.form8606ConsequentialByOwner)
      seeded.set(SENTINEL_OWNER, {
        distributions: 3_100 + ordinal,
        conversions: 0,
        annuityPayments: 0,
      })
      return { ...natural, form8606ConsequentialByOwner: seeded }
    },
  ),
)

import {
  expectDistinctInjections,
  expectSeamRanAtLeastOnce,
} from './simulate.seamGuard.test-support.js'
import type { Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026

function iraPlan(): Plan {
  // Past every RMD start cohort, so the year actually runs an owned-IRA
  // distribution and the annual pass reaches the assumed-character seam.
  const plan = singlePersonPlan({ dob: '1948-01-01', planningAge: 95 })
  plan.accounts = [
    cashAccount('cash', 50_000),
    traditionalAccount('ira', 400_000, 'p1', 'ira'),
  ]
  plan.expenses.baseAnnual = 30_000
  return validatePlan(plan)
}

describe('annual assumed-character delegation', () => {
  it('publishes the seam\'s own Form 8606 consequential map', () => {
    seam.reset()
    const plan = iraPlan()
    const result = simulatePlan(plan, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const calls = expectSeamRanAtLeastOnce(seam)
    expectDistinctInjections(seam)
    for (const call of calls) {
      // The caller hands the phase this year's own facts, not a stale copy.
      expect(call.input.year).toBe(YEAR)
      expect(call.input.planId).toBe(plan.id)
      // The natural map never carries the sentinel owner, so the assertion
      // below cannot pass on a value the phase would have produced anyway.
      expect(call.natural.form8606ConsequentialByOwner.has(SENTINEL_OWNER))
        .toBe(false)
    }

    // The committed year is published from one of the passes, not necessarily
    // the last, so the assertion is that the number came from THIS seam.
    const published = result.years[0]?.ownedTraditionalIraAggregateActivity
      ?.find((row) => row.ownerPersonId === SENTINEL_OWNER)
    const injectedAmounts = calls.map((call) =>
      call.injected.form8606ConsequentialByOwner.get(SENTINEL_OWNER)
        ?.distributions)
    expect(injectedAmounts).toContain(
      published?.assumedBasisConsequential?.distributions,
    )
    expect(published?.assumedBasisConsequential?.distributions)
      .toBeGreaterThanOrEqual(3_100)
  })
})
