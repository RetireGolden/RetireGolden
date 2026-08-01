/**
 * Coordinate-descent local search tests (decision engine Phase 4): search
 * mutates candidate schedules, keeps only exact-ledger improvements, and is
 * deterministic under a fixed simulation budget.
 */

import { describe, expect, it } from 'vitest'

import { runExactLedgerTournament } from '../projection/optimizePlan.js'
import { simulatePlan } from '../projection/simulate.js'
import { simOptions, tradHeavyPlan } from './decisionFixtures.js'
import { createDecisionContext } from './evaluateCandidate.js'
import { refineConversionSchedule } from './search.js'

function seedSchedule() {
  // A deliberately coarse flat schedule with obvious local slack.
  return [
    { year: 2026, amount: 20_000 },
    { year: 2027, amount: 20_000 },
    { year: 2028, amount: 20_000 },
    { year: 2029, amount: 20_000 },
  ]
}

describe('refineConversionSchedule', () => {
  it('stops local search at deterministic budget', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const budget = 9
    const first = refineConversionSchedule(ctx, seedSchedule(), { maxSimulations: budget })
    const second = refineConversionSchedule(ctx, seedSchedule(), { maxSimulations: budget })

    expect(first.simulationCount).toBeLessThanOrEqual(budget)
    // Deterministic: identical budget ⇒ identical schedule and evaluation.
    expect(second.bestConversions).toEqual(first.bestConversions)
    expect(second.simulationCount).toBe(first.simulationCount)
    expect(second.bestEvaluation.deltas.endingAfterTaxEstate).toBe(first.bestEvaluation.deltas.endingAfterTaxEstate)
  })

  it('prices the seed but does not refine an aggregate exploratory schedule into a recommendation', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const seed = seedSchedule()
    const refined = refineConversionSchedule(ctx, seed, { maxSimulations: 60 })

    // The aggregate seed still receives exact-ledger deltas, but every move is
    // diagnostic-only until the schedule has identity-complete allocations.
    expect(refined.improved).toBe(false)
    expect(refined.bestEvaluation.deltas.endingAfterTaxEstate).toBeGreaterThan(0)
    expect(refined.bestEvaluation.recommendationState).toBe('diagnostic')

    // Never worse than the seed by construction.
    const seedEvaluation = refineConversionSchedule(ctx, seed, { maxSimulations: 1 })
    expect(refined.bestEvaluation.deltas.endingAfterTaxEstate).toBeGreaterThanOrEqual(
      seedEvaluation.bestEvaluation.deltas.endingAfterTaxEstate,
    )
  })

  it('does not let a Proxy forge legacy optimizer calculation authority', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const forged = new Proxy({ maxSimulations: 8 }, {
      get: (target, key, receiver) => typeof key === 'symbol' ? true : Reflect.get(target, key, receiver),
    })
    const refined = refineConversionSchedule(ctx, seedSchedule(), forged)

    expect(refined.improved).toBe(false)
    expect(refined.bestEvaluation.recommendationState).toBe('diagnostic')
  })

  it('search improves or matches legacy optimizer tournament results', () => {
    const plan = tradHeavyPlan()
    const opts = simOptions()
    const baseline = simulatePlan(plan, opts)

    const unrefined = runExactLedgerTournament(plan, baseline, null, opts)
    const refined = runExactLedgerTournament(plan, baseline, null, opts, { search: { maxSimulations: 40 } })

    expect(unrefined.winnerSource).toBe('candidate')
    expect(refined.winnerSource).toBe('candidate')
    expect(refined.winnerValidation!.afterTaxEstateDelta).toBeGreaterThanOrEqual(
      unrefined.winnerValidation!.afterTaxEstateDelta,
    )
    expect(refined.searchSimulations).toBeGreaterThan(0)
    expect(refined.searchSimulations).toBeLessThanOrEqual(80)
    if (refined.searchRefined) {
      expect(refined.winnerValidation!.executedConversionRatio).toBeGreaterThan(0.999)
      expect(refined.winnerValidation!.recommendationState).toBe('beneficial')
    }
    // Determinism at the tournament level too.
    const rerun = runExactLedgerTournament(plan, baseline, null, opts, { search: { maxSimulations: 40 } })
    expect(rerun.winnerConversions).toEqual(refined.winnerConversions)
  })
})
