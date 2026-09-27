import { expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import * as evaluation from './evaluateCandidate.js'
import { roundSolvedSpending, solveMaxSustainableSpending } from './spendingSolver.js'
import { isExactAnswerDiagnostic } from './spendingSolverDiagnostics.js'

type Mode = 'fixedTarget' | 'withdrawalRateGuardrails'

/**
 * The real solver on the worksheet's feasibility predicate: every probe runs
 * the production search, and an evaluation double only answers whether a
 * level passes (no depletion when it does), as the bisection evidence does.
 */
function solveOn(opts: {
  currentBaseAnnual: number
  passes: (amount: number) => boolean
  mode?: Mode
  requiredAnnual?: number
  resolutionDollars?: number
}) {
  const plan: Plan = noTraditionalPlan()
  plan.expenses.baseAnnual = opts.currentBaseAnnual
  if (opts.requiredAnnual !== undefined) plan.expenses.requiredAnnual = opts.requiredAnnual
  if (opts.mode !== undefined && opts.mode !== 'fixedTarget') plan.expenses.spendingPolicy = { mode: opts.mode }
  const ctx = evaluation.createDecisionContext(plan, simOptions())
  const reference = evaluation.evaluateCandidate(ctx, {
    id: 'worksheet-shape', source: 'search', category: 'spending', label: 'Fixture shape', explanation: 'Schema scaffolding only',
  })
  const probes: number[] = []
  const spy = vi.spyOn(evaluation, 'evaluateCandidate').mockImplementation((_ctx, candidate) => {
    const amount = (candidate.planPatch!['expenses'] as { baseAnnual: number }).baseAnnual
    probes.push(amount)
    return {
      ...reference,
      recommendationState: 'beneficial',
      candidateResult: { ...reference.candidateResult, depletionYear: opts.passes(amount) ? null : 2030 },
      candidateSummary: { ...reference.candidateSummary, endingAfterTaxEstate: 0 },
    }
  })
  try {
    return {
      result: solveMaxSustainableSpending(ctx, { resolutionDollars: opts.resolutionDollars ?? 500, maxSimulations: 25 }),
      probes,
    }
  } finally {
    spy.mockRestore()
  }
}

describeCalculation(
  'solved-spending-rounding',
  {
    example: {
      inputs: {
        caseA: { currentBaseAnnual: 40_000, feasibleThrough: 62_850 },
        caseAPrime: { currentBaseAnnual: 40_000.4, feasibleThrough: 62_850 },
        caseB: { feasibleBaseAnnual: 62_800, currentBaseAnnual: 60_000 },
        caseC: { feasibleBaseAnnual: 45_099, currentBaseAnnual: 48_500.5 },
        caseD: { feasibleBaseAnnual: 0, currentBaseAnnual: 12_000 },
        caseE: { feasibleBaseAnnual: 99, currentBaseAnnual: 0 },
        caseG: { feasibleBaseAnnual: 61_080, currentBaseAnnual: 60_050 },
        caseH: { currentBaseAnnual: 40_000, feasibleThrough: 62_850, mode: 'withdrawalRateGuardrails' },
        caseI: { currentBaseAnnual: 40_000, feasibleThrough: 62_850, failsAt: 62_800, mode: 'withdrawalRateGuardrails' },
        caseJ: { currentBaseAnnual: 40_060, requiredAnnual: 40_050, feasibleThrough: 40_060 },
        caseK: { currentBaseAnnual: 41_000, requiredAnnual: 40_000, feasibleThrough: 40_060, resolutionDollars: 50 },
        caseL: { currentBaseAnnual: 72_030, feasibleThrough: 72_030 },
      },
      expected: {
        caseA: {
          maxBaseAnnual: 62_800,
          feasibleBaseAnnual: 62_813,
          spendingSlackDollars: 22_800,
          simulationCount: 9,
          probes: [40_000, 80_000, 60_000, 70_000, 65_000, 62_500, 63_750, 63_125, 62_813],
        },
        caseAPrime: { maxBaseAnnual: 62_800, feasibleBaseAnnual: 62_813, spendingSlackDollars: 22_799.6 },
        caseB: { maxBaseAnnual: 62_800, spendingSlackDollars: 2_800 },
        caseC: { maxBaseAnnual: 45_000, spendingSlackDollars: -3_500.5 },
        caseD: { maxBaseAnnual: 0, spendingSlackDollars: -12_000 },
        caseE: { maxBaseAnnual: 0, spendingSlackDollars: 0 },
        caseG: { maxBaseAnnual: 61_000, spendingSlackDollars: 950, insightSlackGate: 1_000 },
        caseH: { maxBaseAnnual: 62_800, feasibleBaseAnnual: 62_813, simulationCount: 10, extraRunAt: 62_800 },
        caseI: { maxBaseAnnual: 62_813, feasibleBaseAnnual: 62_813, spendingSlackDollars: 22_813, simulationCount: 10 },
        caseJ: { maxBaseAnnual: 40_060, feasibleBaseAnnual: 40_060, spendingSlackDollars: 0 },
        caseK: { maxBaseAnnual: 40_000, feasibleBaseAnnual: 40_032, simulationCount: 7, probes: [41_000, 40_000, 40_500, 40_250, 40_125, 40_063, 40_032] },
        caseL: { maxBaseAnnual: 72_000, spendingSlackDollars: -30, sustainsCurrentBase: 1 },
        wrongReadings: { nearestHundredA: 62_900, resolutionFloorA: 62_500, exactSlackA: 22_813, roundedSlackC: -3_500 },
      },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/solved-spending-rounded-to-hundred.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/solved-spending-rounded-to-hundred.mutation.md',
  },
  ({ example }) => {
    type Case = {
      currentBaseAnnual: number
      feasibleThrough?: number
      feasibleBaseAnnual?: number
      failsAt?: number
      requiredAnnual?: number
      resolutionDollars?: number
      mode?: Mode
    }
    const inputs = example.inputs as Record<string, Case>
    const expected = example.expected as Record<string, Record<string, number | number[]>>
    const near = (actual: number | null, target: number, label: string) =>
      expect(actual !== null && withinTolerance(actual, target, example.tolerance), `${label}: ${actual} against the worksheet's ${target}`).toBe(true)

    it('case A: bisects to 62,813 in nine probes and publishes 62,800 with a slack of 22,800', () => {
      const c = inputs.caseA!
      const { result, probes } = solveOn({ currentBaseAnnual: c.currentBaseAnnual, passes: (x) => x <= c.feasibleThrough! })
      const e = expected.caseA!
      expect(probes).toEqual(e.probes)
      expect(result.simulationCount).toBe(e.simulationCount)
      expect(result.converged).toBe(true)
      expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
      expect(result.spendingSlackDollars).toBe(e.spendingSlackDollars)
      // The worksheet's wrong readings.
      const wrong = expected.wrongReadings!
      expect(result.maxBaseAnnual).not.toBe(wrong.nearestHundredA)
      expect(result.maxBaseAnnual).not.toBe(wrong.resolutionFloorA)
      expect(result.spendingSlackDollars).not.toBe(wrong.exactSlackA)
    })

    it('case A prime: a fractional current base keeps its cents in the slack, 22,799.6', () => {
      const c = inputs.caseAPrime!
      const { result } = solveOn({ currentBaseAnnual: c.currentBaseAnnual, passes: (x) => x <= c.feasibleThrough! })
      const e = expected.caseAPrime!
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
      near(result.spendingSlackDollars, e.spendingSlackDollars as number, 'caseAPrime slack')
    })

    it('cases B to G: the floor of the passing probe, and the slack measured from it', () => {
      for (const key of ['caseB', 'caseC', 'caseD', 'caseE', 'caseG'] as const) {
        const c = inputs[key]!
        const e = expected[key]!
        const published = roundSolvedSpending(c.feasibleBaseAnnual!)
        expect(published, key).toBe(e.maxBaseAnnual)
        near(published - c.currentBaseAnnual, e.spendingSlackDollars as number, `${key} slack`)
      }
      // Case C: rounding the slack instead of the amount reads -3,500.
      const c = inputs.caseC!
      expect(roundSolvedSpending(c.feasibleBaseAnnual!) - c.currentBaseAnnual).not.toBe(expected.wrongReadings!.roundedSlackC)
      // Case G: the slack the page shows is under the insight card's $1,000 gate.
      const g = inputs.caseG!
      expect(roundSolvedSpending(g.feasibleBaseAnnual!) - g.currentBaseAnnual).toBeLessThan(expected.caseG!.insightSlackGate as number)
    })

    it('case F: nothing passes, so every published figure is null', () => {
      const { result } = solveOn({ currentBaseAnnual: 30_000, passes: () => false })
      expect(result.maxBaseAnnual).toBeNull()
      expect(result.feasibleBaseAnnual).toBeNull()
      expect(result.maxBaseAnnualRounding).toBeNull()
      expect(result.spendingSlackDollars).toBeNull()
    })

    it('refuses a negative or non-finite amount', () => {
      for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => roundSolvedSpending(bad)).toThrow(RangeError)
    })

    it('case H: under guardrails the rounded amount is run once more, passes, and is published', () => {
      const c = inputs.caseH!
      const { result, probes } = solveOn({ currentBaseAnnual: c.currentBaseAnnual, passes: (x) => x <= c.feasibleThrough!, mode: c.mode! })
      const e = expected.caseH!
      expect(probes.at(-1)).toBe(e.extraRunAt)
      expect(result.simulationCount).toBe(e.simulationCount)
      expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.maxBaseAnnualRounding).toBe('down-to-hundred')
    })

    it('case I: under guardrails a rounded amount that fails is not published; the exact amount is, and says why', () => {
      const c = inputs.caseI!
      const { result } = solveOn({
        currentBaseAnnual: c.currentBaseAnnual,
        passes: (x) => x <= c.feasibleThrough! && x !== c.failsAt,
        mode: c.mode!,
      })
      const e = expected.caseI!
      expect(result.simulationCount).toBe(e.simulationCount)
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
      expect(result.spendingSlackDollars).toBe(e.spendingSlackDollars)
      expect(result.maxBaseAnnualRounding).toBe('none')
      expect(result.diagnostics.filter(isExactAnswerDiagnostic)).toHaveLength(1)
    })

    it('case K: a rounded amount equal to the whole-hundred floor is published, with no extra run under either policy', () => {
      const c = inputs.caseK!
      const e = expected.caseK!
      for (const mode of ['fixedTarget', 'withdrawalRateGuardrails'] as const) {
        const { result, probes } = solveOn({
          currentBaseAnnual: c.currentBaseAnnual,
          requiredAnnual: c.requiredAnnual!,
          resolutionDollars: c.resolutionDollars!,
          passes: (x) => x <= c.feasibleThrough!,
          mode,
        })
        expect(probes, mode).toEqual(e.probes)
        expect(result.feasibleBaseAnnual, mode).toBe(e.feasibleBaseAnnual)
        expect(result.maxBaseAnnual, mode).toBe(e.maxBaseAnnual)
        expect(result.maxBaseAnnualRounding, mode).toBe('down-to-hundred')
        expect(result.simulationCount, mode).toBe(e.simulationCount)
      }
    })

    it('case L: a base that passes is sustained although the published amount sits $30 under it', () => {
      const c = inputs.caseL!
      const e = expected.caseL!
      const { result } = solveOn({ currentBaseAnnual: c.currentBaseAnnual, passes: (x) => x <= c.feasibleThrough! })
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.spendingSlackDollars).toBe(e.spendingSlackDollars)
      expect(result.sustainsCurrentBase).toBe(e.sustainsCurrentBase === 1)
    })

    it('case J: a rounded amount below the required spending floor is never published', () => {
      const c = inputs.caseJ!
      const { result, probes } = solveOn({
        currentBaseAnnual: c.currentBaseAnnual,
        requiredAnnual: c.requiredAnnual!,
        passes: (x) => x <= c.feasibleThrough!,
      })
      const e = expected.caseJ!
      expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
      expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
      expect(result.spendingSlackDollars).toBe(e.spendingSlackDollars)
      expect(result.maxBaseAnnualRounding).toBe('none')
      expect(probes.every((amount) => amount >= c.requiredAnnual!)).toBe(true)
    })
  },
)
