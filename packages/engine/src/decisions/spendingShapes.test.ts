/**
 * Spending shape × sustainable-spending solver (spending-paths & SWR-lenses
 * plan, Goal 1 acceptance): the smirk fixture must reproduce the documented
 * SWR-uplift *direction* — a declining real spending path supports a higher
 * sustainable initial spending level than constant-real on the same plan
 * (Blanchett: shape-aware plans support materially higher initial withdrawals).
 */

import { describe, expect, it } from 'vitest'

import { simOptions, noTraditionalPlan } from './decisionFixtures.js'
import { createDecisionContext } from './evaluateCandidate.js'
import { solveMaxSustainableSpending } from './spendingSolver.js'
import { spendingShapePhases } from '../spending/shapePresets.js'

describe('sustainable spending by shape', () => {
  it('smirk (declining real) sustains a higher initial spend than constant-real; front-loaded sustains less', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const retirementAge = 65

    const solveWithShape = (shape: Parameters<typeof spendingShapePhases>[0]) =>
      solveMaxSustainableSpending(ctx, {
        basePatch: { expenses: { phases: spendingShapePhases(shape, retirementAge) } },
      })

    const flat = solveWithShape('flat')
    const smirk = solveWithShape('smirk')
    const smile = solveWithShape('smile')
    const frontLoaded = solveWithShape('frontLoaded')

    expect(flat.maxBaseAnnual).not.toBeNull()
    expect(smirk.maxBaseAnnual).not.toBeNull()

    // The uplift direction: later spending shrinks, so the same portfolio
    // clears a higher initial level. Front-loaded (+10% early) goes the other
    // way. Smile sits between flat and smirk on this fixture.
    expect(smirk.maxBaseAnnual!).toBeGreaterThan(flat.maxBaseAnnual!)
    expect(smile.maxBaseAnnual!).toBeGreaterThan(flat.maxBaseAnnual!)
    expect(frontLoaded.maxBaseAnnual!).toBeLessThan(flat.maxBaseAnnual!)

    // Deterministic per shape (same probe sequence on re-solve).
    const again = solveWithShape('smirk')
    expect(again.maxBaseAnnual).toBe(smirk.maxBaseAnnual)
  })

  it('refuses to bisect an ABW plan (baseAnnual has no effect there) with a clear diagnostic', () => {
    // Under amortized spending every baseAnnual probe simulates the identical
    // plan, so the solver must bail out instead of reporting a made-up level
    // (Codex review P2).
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const result = solveMaxSustainableSpending(ctx, {
      basePatch: { expenses: { spendingPolicy: { mode: 'abw' } } },
    })
    expect(result.maxBaseAnnual).toBeNull()
    expect(result.simulationCount).toBe(0)
    expect(result.diagnostics.join(' ')).toMatch(/amortized spending/i)
  })
})
