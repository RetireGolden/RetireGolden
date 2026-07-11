/**
 * Sustainable-spending solver tests (planning-depth roadmap §4 acceptance
 * criteria): stable answers under fixed assumptions, estate-floor
 * monotonicity, and exact-ledger (never approximated) feasibility.
 */

import { describe, expect, it } from 'vitest'

import { simOptions, noTraditionalPlan } from './decisionFixtures.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import { makeMaximizeSustainableSpending } from './objectives.js'
import { solveMaxSustainableSpending, type SustainableSpendingOptions } from './spendingSolver.js'

describe('solveMaxSustainableSpending', () => {
  it('returns a stable spending amount under fixed assumptions', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const first = solveMaxSustainableSpending(ctx)
    const second = solveMaxSustainableSpending(ctx)

    expect(first.converged).toBe(true)
    expect(first.maxBaseAnnual).not.toBeNull()
    // Deterministic: identical inputs ⇒ identical probes and answer.
    expect(second.maxBaseAnnual).toBe(first.maxBaseAnnual)
    expect(second.simulationCount).toBe(first.simulationCount)

    // ~$700k of flat-return assets over an 18-year horizon: the answer must
    // beat the current $30k spending and stay in a plausible band.
    expect(first.maxBaseAnnual!).toBeGreaterThan(30_000)
    expect(first.maxBaseAnnual!).toBeLessThan(60_000)
    expect(first.spendingSlackDollars!).toBe(first.maxBaseAnnual! - 30_000)

    // The answer is priced by the exact ledger and never depletes.
    expect(first.bestEvaluation!.candidateResult.depletionYear).toBeNull()
  })

  it('increasing the required estate floor lowers or preserves recommended spending', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const noFloor = solveMaxSustainableSpending(ctx)
    const withFloor = solveMaxSustainableSpending(ctx, { estateFloorTodayDollars: 250_000 })

    expect(withFloor.maxBaseAnnual!).toBeLessThanOrEqual(noFloor.maxBaseAnnual!)
    // Fixture inflation is 0%, so today's-dollar floor == nominal floor here.
    expect(withFloor.bestEvaluation!.candidateSummary.endingAfterTaxEstate).toBeGreaterThanOrEqual(250_000)
  })

  it('enforces the estate floor in real terms under inflation', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const inflationPct = 3
    const floorToday = 200_000
    const result = solveMaxSustainableSpending(ctx, {
      basePatch: { assumptions: { inflationPct } },
      estateFloorTodayDollars: floorToday,
    })

    // The floor is a today's-dollars bequest target: the nominal ending estate
    // must clear the floor inflated to the plan's end year, not the raw floor.
    const candidateResult = result.bestEvaluation!.candidateResult
    const years = candidateResult.endYear - candidateResult.years[0].year
    const nominalFloor = floorToday * Math.pow(1 + inflationPct / 100, years)
    expect(nominalFloor).toBeGreaterThan(floorToday)
    expect(result.bestEvaluation!.candidateSummary.endingAfterTaxEstate).toBeGreaterThanOrEqual(nominalFloor)
  })

  it('solves downward when current spending is unsustainable and reports negative slack', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const result = solveMaxSustainableSpending(ctx, { basePatch: { expenses: { baseAnnual: 100_000 } } })

    // $100k/yr from ~$700k depletes well before the horizon; the solver must
    // come back with a smaller feasible level, not fail.
    expect(result.maxBaseAnnual).not.toBeNull()
    expect(result.maxBaseAnnual!).toBeLessThan(100_000)
    expect(result.bestEvaluation!.candidateResult.depletionYear).toBeNull()
    // Slack is measured against the patched current spending, so it reports
    // overspending (negative), not headroom against the plan's original $30k.
    expect(result.spendingSlackDollars!).toBe(result.maxBaseAnnual! - 100_000)
    expect(result.spendingSlackDollars!).toBeLessThan(0)
  })

  it('ignores a cached candidateResult smuggled through evaluation options', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const clean = solveMaxSustainableSpending(ctx)
    // A cached projection would make every probe look exactly as feasible as
    // the baseline; the solver must strip it and simulate each probe.
    const poisoned = solveMaxSustainableSpending(ctx, {
      evaluation: { candidateResult: ctx.baselineResult } as unknown as SustainableSpendingOptions['evaluation'],
    })

    expect(poisoned.maxBaseAnnual).toBe(clean.maxBaseAnnual)
    expect(poisoned.simulationCount).toBe(clean.simulationCount)
  })

  it('reports which constraint binds the answer', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    // No floor: the next-higher spending level fails by running out of money.
    const noFloor = solveMaxSustainableSpending(ctx)
    expect(noFloor.limitingConstraint).toBe('depletion')
    // A floor near the fixture's asset base binds before depletion does.
    const floored = solveMaxSustainableSpending(ctx, { estateFloorTodayDollars: 400_000 })
    expect(floored.limitingConstraint).toBe('estate-floor')
    expect(floored.maxBaseAnnual!).toBeLessThan(noFloor.maxBaseAnnual!)
  })

  it('stops at the deterministic simulation budget', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const budget = 5
    const first = solveMaxSustainableSpending(ctx, { maxSimulations: budget })
    const second = solveMaxSustainableSpending(ctx, { maxSimulations: budget })

    expect(first.simulationCount).toBeLessThanOrEqual(budget)
    expect(second.maxBaseAnnual).toBe(first.maxBaseAnnual)
    expect(second.simulationCount).toBe(first.simulationCount)
    // A truncated run still reports a feasible lower bound, flagged as such.
    if (!first.converged && first.maxBaseAnnual !== null) {
      expect(first.diagnostics.length).toBeGreaterThan(0)
    }
  })
})

describe('maximizeSustainableSpending policy', () => {
  it('ranks higher feasible spending above lower and disqualifies depleting candidates', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const policy = makeMaximizeSustainableSpending()

    const spendingCandidate = (baseAnnual: number) => ({
      id: `spend-${baseAnnual}`,
      source: 'heuristic' as const,
      category: 'spending' as const,
      label: `Spend $${baseAnnual}`,
      explanation: 'test',
      planPatch: { expenses: { baseAnnual } },
    })

    const modest = evaluateCandidate(ctx, spendingCandidate(32_000))
    const richer = evaluateCandidate(ctx, spendingCandidate(36_000))
    const tooMuch = evaluateCandidate(ctx, spendingCandidate(90_000))

    expect(policy.constraintViolations(modest, ctx)).toEqual([])
    expect(policy.constraintViolations(richer, ctx)).toEqual([])
    expect(policy.primaryMetric(richer, ctx)).toBeGreaterThan(policy.primaryMetric(modest, ctx))
    // $90k/yr depletes the fixture before the horizon ⇒ hard disqualification.
    expect(policy.constraintViolations(tooMuch, ctx).some((v) => v.includes('depletes'))).toBe(true)
  })

  it('enforces the estate floor as a hard constraint', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const floored = makeMaximizeSustainableSpending(600_000)
    const evaluation = evaluateCandidate(ctx, {
      id: 'spend-36k',
      source: 'heuristic',
      category: 'spending',
      label: 'Spend $36k',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 36_000 } },
    })

    expect(floored.constraintViolations(evaluation, ctx).some((v) => v.includes('floor'))).toBe(true)
  })
})
