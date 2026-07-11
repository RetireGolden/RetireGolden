/**
 * Generalized tournament, dedupe, generators, and objective-policy tests
 * (decision engine Phases 1.5–3).
 */

import { describe, expect, it } from 'vitest'

import type { ProjectionResult } from '../projection/types.js'
import type { ProjectionSummary } from '../projection/compare.js'
import {
  inheritedOnlyPlan,
  noTraditionalPlan,
  simOptions,
  ssTaxabilityPlan,
  survivorPlan,
  tradHeavyPlan,
} from './decisionFixtures.js'
import { createDecisionContext, evaluateCandidate, planForCandidate } from './evaluateCandidate.js'
import {
  milpScheduleGenerator,
  noConversionGenerator,
  simpleRothConversionGenerator,
  socialSecurityClaimGenerator,
  withdrawalOrderGenerator,
} from './generators.js'
import {
  makeMinimizeLifetimeTaxWithEstateFloor,
  maximizeAfterTaxEstate,
  maximizeDownsideResilience,
  maximizeSpendingDurability,
  minimizeLifetimeTaxWithEstateFloor,
  objectivePolicyForPlan,
  protectSurvivorLiquidity,
} from './objectives.js'
import {
  candidateEquivalenceKey,
  dedupeCandidates,
  rankEvaluations,
  runDecisionTournament,
} from './tournament.js'
import type { DecisionCandidate, DecisionContext, ExactDecisionEvaluation, StochasticDecisionMetrics } from './types.js'

const emptyResult: ProjectionResult = {
  startYear: 2026,
  endYear: 2046,
  years: [],
  depletionYear: null,
  endingInvestable: 0,
  endingNetWorth: 0,
  endingNondeductibleIraBasis: 0,
  warnings: [],
}

function fakeEvaluation(
  id: string,
  deltas: Partial<ExactDecisionEvaluation['deltas']>,
  recommendationState: ExactDecisionEvaluation['recommendationState'] = 'neutral',
): ExactDecisionEvaluation {
  return {
    candidate: { id, source: 'heuristic', category: 'roth', label: id, explanation: id },
    baselineSummary: {} as ProjectionSummary,
    candidateSummary: {} as ProjectionSummary,
    candidateResult: emptyResult,
    deltas: { endingAfterTaxEstate: 0, endingNetWorth: 0, lifetimeTax: 0, moneyLastsYears: 0, ...deltas },
    conversionExecution: null,
    traditionalDepletionYear: null,
    diagnostics: [],
    recommendationState,
  }
}

function withStochastic(
  evaluation: ExactDecisionEvaluation,
  successRate: number,
  p10EndingAfterTaxEstateDelta: number,
  expectedShortfallDelta = 0,
): ExactDecisionEvaluation {
  const baseline: StochasticDecisionMetrics = {
    pathCount: 200,
    seed: 99,
    successRate: 0.9,
    requiredFloorSuccessRate: 0.9,
    targetLifestyleSuccessRate: 0.9,
    p10EndingAfterTaxEstate: 100_000,
    medianEndingAfterTaxEstate: 200_000,
    expectedShortfallDollars: 10_000,
    averageTargetShortfallDollars: 2_000,
  }
  const candidate: StochasticDecisionMetrics = {
    ...baseline,
    successRate,
    requiredFloorSuccessRate: successRate,
    targetLifestyleSuccessRate: successRate,
    p10EndingAfterTaxEstate: baseline.p10EndingAfterTaxEstate + p10EndingAfterTaxEstateDelta,
    medianEndingAfterTaxEstate: baseline.medianEndingAfterTaxEstate + p10EndingAfterTaxEstateDelta,
    expectedShortfallDollars: baseline.expectedShortfallDollars + expectedShortfallDelta,
  }
  evaluation.stochastic = {
    baseline,
    candidate,
    deltas: {
      successRate: candidate.successRate - baseline.successRate,
      requiredFloorSuccessRate: candidate.requiredFloorSuccessRate - baseline.requiredFloorSuccessRate,
      targetLifestyleSuccessRate: candidate.targetLifestyleSuccessRate - baseline.targetLifestyleSuccessRate,
      p10EndingAfterTaxEstate: candidate.p10EndingAfterTaxEstate - baseline.p10EndingAfterTaxEstate,
      medianEndingAfterTaxEstate: candidate.medianEndingAfterTaxEstate - baseline.medianEndingAfterTaxEstate,
      expectedShortfallDollars: candidate.expectedShortfallDollars - baseline.expectedShortfallDollars,
      averageTargetShortfallDollars: 0,
    },
  }
  return evaluation
}

const fakeCtx = { baselineResult: emptyResult } as DecisionContext

describe('candidate generators', () => {
  it('candidate generators produce bounded candidates', () => {
    for (const plan of [tradHeavyPlan(), noTraditionalPlan(), inheritedOnlyPlan(), ssTaxabilityPlan()]) {
      const ctx = createDecisionContext(plan, simOptions())
      // 6 whole-horizon fills + up to 5 income-boundary windows × 3 brackets.
      const fills = simpleRothConversionGenerator.generate(ctx)
      expect(fills.length).toBeGreaterThanOrEqual(6)
      expect(fills.length).toBeLessThanOrEqual(21)
      expect(withdrawalOrderGenerator.generate(ctx).length).toBeLessThanOrEqual(4)
      expect(socialSecurityClaimGenerator.generate(ctx).length).toBeLessThanOrEqual(6)
      expect(noConversionGenerator.generate(ctx).length).toBeLessThanOrEqual(1)
    }
  })

  it('generates patches that survive plan validation', () => {
    const plan = ssTaxabilityPlan()
    const ctx = createDecisionContext(plan, simOptions())
    const all = [
      ...simpleRothConversionGenerator.generate(ctx),
      ...withdrawalOrderGenerator.generate(ctx),
      ...socialSecurityClaimGenerator.generate(ctx),
    ]
    for (const candidate of all) {
      const built = planForCandidate(plan, candidate)
      expect(built.ok, `${candidate.id} should produce a valid plan`).toBe(true)
    }
  })

  it('excludes the current withdrawal order and claim age from candidates', () => {
    const ctx = createDecisionContext(ssTaxabilityPlan(), simOptions())
    const withdrawalIds = withdrawalOrderGenerator.generate(ctx).map((candidate) => candidate.id)
    expect(withdrawalIds).not.toContain('withdrawal-sequential') // plan default
    const claimLabels = socialSecurityClaimGenerator.generate(ctx).map((candidate) => candidate.label)
    expect(claimLabels.some((label) => label.includes('at 70'))).toBe(false) // already claims at 70
    expect(claimLabels.some((label) => label.includes('at 62'))).toBe(true)
  })

  it('wraps milp schedules as candidates without recommending them', () => {
    const generator = milpScheduleGenerator({
      raw: {
        status: 'optimal',
        endingAfterTax: 0,
        lifetimeTax: 0,
        schedule: [],
        conversions: [{ year: 2027, amount: 50_000 }],
        solveMs: 0,
      },
      cleanedConversions: [{ year: 2027, amount: 45_000 }],
    })
    const candidates = generator.generate({} as DecisionContext)
    expect(candidates.map((candidate) => candidate.id)).toEqual(['milp-raw', 'milp-cleaned'])
    expect(candidates.every((candidate) => candidate.source === 'milp')).toBe(true)
  })
})

describe('dedupe', () => {
  it('dedupes equivalent candidate schedules before tournament evaluation', () => {
    const a: DecisionCandidate = {
      id: 'a',
      source: 'heuristic',
      category: 'roth',
      label: 'a',
      explanation: 'a',
      conversions: [{ year: 2028, amount: 10_000 }, { year: 2027, amount: 5_000 }],
    }
    const b: DecisionCandidate = {
      ...a,
      id: 'b',
      // Same schedule in a different order with cent-level noise.
      conversions: [{ year: 2027, amount: 5_000.001 }, { year: 2028, amount: 10_000 }],
    }
    expect(candidateEquivalenceKey(a)).toBe(candidateEquivalenceKey(b))
    expect(dedupeCandidates([a, b])).toHaveLength(1)
    expect(dedupeCandidates([a, b])[0].id).toBe('a')
  })

  it('treats patch key order as irrelevant', () => {
    const a: DecisionCandidate = {
      id: 'a',
      source: 'heuristic',
      category: 'roth',
      label: 'a',
      explanation: 'a',
      planPatch: { strategies: { rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12 } } },
    }
    const b: DecisionCandidate = {
      ...a,
      id: 'b',
      planPatch: { strategies: { rothConversion: { targetValue: 12, target: 'topOfBracket', mode: 'fillToTarget' } } },
    }
    expect(dedupeCandidates([a, b])).toHaveLength(1)
  })

  it('spends exactly one exact simulation per unique candidate', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    // Two copies of the same generator: every candidate is a duplicate.
    const uniqueCount = simpleRothConversionGenerator.generate(ctx).length
    const result = runDecisionTournament(ctx, [simpleRothConversionGenerator, simpleRothConversionGenerator])
    expect(result.simulationCount).toBe(uniqueCount)
    expect(result.ranked).toHaveLength(uniqueCount)
  })
})

describe('objective policies and ranking', () => {
  it('rejects candidates that improve tax but lower exact estate', () => {
    const taxSaver = fakeEvaluation('tax-saver', { lifetimeTax: -20_000, endingAfterTaxEstate: -5_000 }, 'rejected')
    const neutral = fakeEvaluation('neutral', {})

    // Estate policy: the tax saver is eligible but not an improvement — no winner.
    const estateRanking = rankEvaluations([taxSaver, neutral], fakeCtx, maximizeAfterTaxEstate)
    expect(estateRanking.winner).toBeNull()
    expect(estateRanking.ranked[0].evaluation.candidate.id).toBe('neutral')

    // Tax policy with an estate floor: the tax saver violates the hard constraint.
    const taxRanking = rankEvaluations([taxSaver, neutral], fakeCtx, minimizeLifetimeTaxWithEstateFloor)
    const taxSaverRow = taxRanking.ranked.find((row) => row.evaluation.candidate.id === 'tax-saver')!
    expect(taxSaverRow.eligible).toBe(false)
    expect(taxSaverRow.constraintViolations.join(' ')).toMatch(/reduces the after-tax estate/)
    expect(taxRanking.winner).toBeNull()
  })

  it('explains primary metric, hard constraints, and why a candidate lost', () => {
    const winner = fakeEvaluation('winner', { endingAfterTaxEstate: 50_000 }, 'beneficial')
    const runnerUp = fakeEvaluation('runner-up', { endingAfterTaxEstate: 20_000 }, 'beneficial')
    const shortener = fakeEvaluation('shortener', { endingAfterTaxEstate: 90_000, moneyLastsYears: -3 }, 'beneficial')

    const { ranked, winner: top } = rankEvaluations([runnerUp, shortener, winner], fakeCtx, maximizeAfterTaxEstate)
    expect(top!.evaluation.candidate.id).toBe('winner')
    expect(top!.lossReason).toBeNull()

    const runnerUpRow = ranked.find((row) => row.evaluation.candidate.id === 'runner-up')!
    expect(runnerUpRow.lossReason).toMatch(/trails the winner by 30,000/)

    const shortenerRow = ranked.find((row) => row.evaluation.candidate.id === 'shortener')!
    expect(shortenerRow.eligible).toBe(false)
    expect(shortenerRow.constraintViolations.join(' ')).toMatch(/shortens money-lasts by 3 year/)
  })

  it('lets spending durability outrank a bigger estate', () => {
    const durable = fakeEvaluation('durable', { moneyLastsYears: 4, endingAfterTaxEstate: 1_000 }, 'beneficial')
    const rich = fakeEvaluation('rich', { moneyLastsYears: 0, endingAfterTaxEstate: 80_000 }, 'beneficial')
    const { winner } = rankEvaluations([rich, durable], fakeCtx, maximizeSpendingDurability)
    expect(winner!.evaluation.candidate.id).toBe('durable')
  })

  it('robust ranking requires stochastic metrics over the success target', () => {
    const robust = withStochastic(
      fakeEvaluation('robust', { endingAfterTaxEstate: 5_000 }, 'beneficial'),
      0.88,
      25_000,
      -5_000,
    )
    const fragile = withStochastic(
      fakeEvaluation('fragile', { endingAfterTaxEstate: 80_000 }, 'beneficial'),
      0.72,
      90_000,
      20_000,
    )
    const missing = fakeEvaluation('missing', { endingAfterTaxEstate: 100_000 }, 'beneficial')

    const { ranked, winner } = rankEvaluations([fragile, robust, missing], fakeCtx, maximizeDownsideResilience)
    expect(winner!.evaluation.candidate.id).toBe('robust')
    expect(ranked.find((row) => row.evaluation.candidate.id === 'fragile')!.eligible).toBe(false)
    expect(ranked.find((row) => row.evaluation.candidate.id === 'missing')!.constraintViolations.join(' ')).toMatch(
      /stochastic metrics unavailable/,
    )
  })

  it('re-ranks the SAME evaluations to a different winner under a different objective — no new simulations', () => {
    // Sustainable-spending plan, Step 5 acceptance: switching objectives is a
    // pure re-rank of already-produced exact-ledger evaluations.
    const durable = fakeEvaluation('durable', { moneyLastsYears: 4, endingAfterTaxEstate: 1_000 }, 'beneficial')
    const rich = fakeEvaluation('rich', { moneyLastsYears: 0, endingAfterTaxEstate: 80_000 }, 'beneficial')
    const evaluations = [rich, durable]
    expect(rankEvaluations(evaluations, fakeCtx, maximizeAfterTaxEstate).winner!.evaluation.candidate.id).toBe('rich')
    expect(rankEvaluations(evaluations, fakeCtx, maximizeSpendingDurability).winner!.evaluation.candidate.id).toBe(
      'durable',
    )
  })

  it('robust ranking still rejects candidates that shorten the exact money-lasts horizon', () => {
    const shortener = withStochastic(
      fakeEvaluation('shortener', { endingAfterTaxEstate: 100_000, moneyLastsYears: -2 }, 'beneficial'),
      0.91,
      100_000,
    )
    const durable = withStochastic(
      fakeEvaluation('durable', { endingAfterTaxEstate: 5_000, moneyLastsYears: 0 }, 'beneficial'),
      0.88,
      10_000,
    )

    const { ranked, winner } = rankEvaluations([shortener, durable], fakeCtx, maximizeDownsideResilience)
    expect(winner!.evaluation.candidate.id).toBe('durable')
    const shortenerRow = ranked.find((row) => row.evaluation.candidate.id === 'shortener')!
    expect(shortenerRow.eligible).toBe(false)
    expect(shortenerRow.constraintViolations.join(' ')).toMatch(/shortens money-lasts by 2 year/)
  })

  it('enforces the bequest target as an absolute estate floor in the tax policy', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop-spend',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 30_000 } },
    })

    // A floor above anything the fixture can leave violates; a modest one passes.
    const strict = makeMinimizeLifetimeTaxWithEstateFloor(5_000_000)
    expect(strict.constraintViolations(evaluation, ctx).some((v) => v.includes('bequest target'))).toBe(true)
    const loose = makeMinimizeLifetimeTaxWithEstateFloor(50_000)
    expect(loose.constraintViolations(evaluation, ctx).some((v) => v.includes('bequest target'))).toBe(false)
  })

  it('objectivePolicyForPlan resolves floor policies with the plan bequest target', () => {
    const plan = noTraditionalPlan()
    // No target: the shared registry instances come back untouched.
    expect(objectivePolicyForPlan('max-after-tax-estate', plan)).toBe(maximizeAfterTaxEstate)
    expect(objectivePolicyForPlan('min-lifetime-tax-estate-floor', plan)).toBe(minimizeLifetimeTaxWithEstateFloor)

    const withTarget = { ...plan, expenses: { ...plan.expenses, bequestTargetDollars: 5_000_000 } }
    const policy = objectivePolicyForPlan('min-lifetime-tax-estate-floor', withTarget)
    expect(policy).not.toBe(minimizeLifetimeTaxWithEstateFloor)
    const ctx = createDecisionContext(withTarget, simOptions())
    const evaluation = evaluateCandidate(ctx, {
      id: 'noop-spend',
      source: 'heuristic',
      category: 'spending',
      label: 'noop',
      explanation: 'test',
      planPatch: { expenses: { baseAnnual: 30_000 } },
    })
    expect(policy.constraintViolations(evaluation, ctx).some((v) => v.includes('bequest target'))).toBe(true)
  })

  it('protects survivor liquidity on plans with survivor years', () => {
    const ctx = createDecisionContext(survivorPlan(), simOptions())
    // Sanity: the fixture actually has survivor years (one alive of two).
    const survivorYears = ctx.baselineResult.years.filter(
      (year) => year.people.length > 1 && year.people.filter((person) => person.alive).length === 1,
    )
    expect(survivorYears.length).toBeGreaterThan(0)

    const result = runDecisionTournament(ctx, [simpleRothConversionGenerator], {
      policy: protectSurvivorLiquidity,
    })
    expect(result.policyId).toBe('protect-survivor-liquidity')
    expect(result.ranked).toHaveLength(simpleRothConversionGenerator.generate(ctx).length)
    // Every row got a real primary value and an explanation or a win.
    for (const row of result.ranked) {
      expect(Number.isFinite(row.primaryValue)).toBe(true)
      if (row !== result.winner) expect(row.lossReason).not.toBeNull()
    }
  })
})

describe('runDecisionTournament', () => {
  it('selects bracket-fill candidate when exact ledger beats milp', () => {
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    // A deliberately over-converting "solver" schedule alongside the simple fills.
    const milp = milpScheduleGenerator({
      cleanedConversions: [
        { year: 2026, amount: 250_000 },
        { year: 2027, amount: 250_000 },
      ],
    })
    const result = runDecisionTournament(ctx, [simpleRothConversionGenerator, milp])

    expect(result.winner).not.toBeNull()
    expect(result.winner!.evaluation.candidate.source).not.toBe('milp')
    expect(result.winner!.evaluation.candidate.id).toMatch(/bracket|cap/)
    const milpRow = result.ranked.find((row) => row.evaluation.candidate.id === 'milp-cleaned')!
    expect(milpRow.lossReason).not.toBeNull()
  })

  it('does not let milp infeasibility override a solvent exact projection', () => {
    // No MILP generator at all (the solver said "infeasible"): simple
    // candidates still win on the exact ledger.
    const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
    const result = runDecisionTournament(ctx, [simpleRothConversionGenerator])
    expect(result.winner).not.toBeNull()
    expect(result.winner!.evaluation.recommendationState).toBe('beneficial')
  })

  it('returns no winner when nothing improves the plan', () => {
    const ctx = createDecisionContext(noTraditionalPlan(), simOptions())
    const result = runDecisionTournament(ctx, [simpleRothConversionGenerator])
    expect(result.winner).toBeNull()
    for (const row of result.ranked) expect(row.lossReason).toMatch(/does not improve|violates/)
  })

  it('recommendations are stable under rerun', () => {
    const run = () => {
      const ctx = createDecisionContext(tradHeavyPlan(), simOptions())
      const result = runDecisionTournament(ctx, [simpleRothConversionGenerator, withdrawalOrderGenerator])
      return {
        winnerId: result.winner?.evaluation.candidate.id ?? null,
        order: result.ranked.map((row) => row.evaluation.candidate.id),
        deltas: result.ranked.map((row) => row.evaluation.deltas.endingAfterTaxEstate),
      }
    }
    expect(run()).toEqual(run())
  })
})
