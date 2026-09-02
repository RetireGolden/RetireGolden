import { describe, expect, it, vi } from 'vitest'

import {
  ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS,
  annualFundingFixedPoint,
  type AnnualFundingFixedPointEvaluation,
  type AnnualFundingFixedPointEvaluationRequest,
  type AnnualFundingFixedPointInput,
} from './annualFundingFixedPoint.js'

interface TestEvaluation extends AnnualFundingFixedPointEvaluation {
  readonly request: Readonly<AnnualFundingFixedPointEvaluationRequest>
  readonly marker: number
}

const frozenEvaluation = (
  request: Readonly<AnnualFundingFixedPointEvaluationRequest>,
  marker: number,
  requiredNeed: number,
  options: Readonly<{
    shortfall?: number
    healthcare?: number
    overCliff?: boolean | null
    supportCodes?: readonly string[]
  }> = {},
): TestEvaluation => Object.freeze({
  request: Object.freeze({ ...request }),
  marker,
  requiredNeed,
  withdrawalPlan: Object.freeze({ shortfall: options.shortfall ?? 0 }),
  healthcare: options.healthcare ?? 0,
  acaQuote: options.overCliff === null || options.overCliff === undefined
    ? null
    : Object.freeze({ overCliff: options.overCliff }),
  acaSupportCodes: Object.freeze([...(options.supportCodes ?? [])]),
})

const baseInput = (
  evaluate: AnnualFundingFixedPointInput<TestEvaluation>['evaluate'],
): AnnualFundingFixedPointInput<TestEvaluation> => ({
  spendingUsesBeforeTax: 120,
  baseCashInflows: 20,
  currentHealthcare: 0,
  coordinatedHecmCapacity: 0,
  acaActive: false,
  acaGrossEnrollmentPremium: 0,
  acaInitialSupportCodeCount: 0,
  tolerancePlanDollars: 0.005,
  evaluate,
})

describe('annualFundingFixedPoint', () => {
  it('returns the accepted evaluator object by identity after the bounded solve', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = vi.fn((request: AnnualFundingFixedPointEvaluationRequest) => {
      const result = frozenEvaluation(
        request,
        evaluations.length,
        100 + request.need / 2,
      )
      evaluations.push(result)
      return result
    })
    const input = Object.freeze(baseInput(evaluate))

    const result = annualFundingFixedPoint(input)

    expect(result.converged).toBe(true)
    expect(result.evaluation.requiredNeed).toBeCloseTo(200, 2)
    expect(evaluations).toContain(result.evaluation)
    expect(result.evaluationCount).toBe(evaluate.mock.calls.length)
    expect(result.maxEvaluationCount)
      .toBe(ANNUAL_FUNDING_FIXED_POINT_MAX_EVALUATIONS)
    expect(result.acceptedCashInflows).toBe(input.baseCashInflows)
    expect(result.acceptedCoordinatedHecmDraw).toBe(0)
    expect(evaluate.mock.calls.every(([request]) =>
      request.cashInflows === 20 && request.forceGrossAca === false,
    )).toBe(true)
  })

  it('retains the exact closest endpoint when a discontinuity has no root', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = (request: AnnualFundingFixedPointEvaluationRequest) => {
      const result = frozenEvaluation(
        request,
        evaluations.length,
        request.need < 100 ? 200 : 0,
      )
      evaluations.push(result)
      return result
    }

    const result = annualFundingFixedPoint(baseInput(evaluate))

    expect(result.converged).toBe(false)
    expect(result.closestResidual).toBeGreaterThan(0.005)
    expect(evaluations).toContain(result.evaluation)
    expect(result.evaluationCount).toBe(evaluations.length)
  })

  it('fails closed to the gross ACA solve after subsidized nonconvergence', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = (request: AnnualFundingFixedPointEvaluationRequest) => {
      const requiredNeed = request.forceGrossAca
        ? 120
        : request.need < 100 ? 200 : 0
      const result = frozenEvaluation(
        request,
        evaluations.length,
        requiredNeed,
        {
          healthcare: request.forceGrossAca ? 12_000 : 2_000,
          overCliff: request.forceGrossAca,
        },
      )
      evaluations.push(result)
      return result
    }

    const result = annualFundingFixedPoint({
      ...baseInput(evaluate),
      acaActive: true,
      acaGrossEnrollmentPremium: 10_000,
    })

    expect(result.acaFixedPointFailed).toBe(true)
    expect(result.converged).toBe(true)
    expect(result.evaluation.request.forceGrossAca).toBe(true)
    expect(result.evaluation.healthcare).toBe(12_000)
    expect(evaluations).toContain(result.evaluation)
  })

  it('detects a lower subsidized basin without replacing an accepted gross result', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = (request: AnnualFundingFixedPointEvaluationRequest) => {
      const lowerBasin = request.need < 90
      const result = frozenEvaluation(
        request,
        evaluations.length,
        lowerBasin ? 80 : 100,
        {
          healthcare: lowerBasin ? 100 : 120,
          overCliff: !lowerBasin,
        },
      )
      evaluations.push(result)
      return result
    }

    const result = annualFundingFixedPoint({
      ...baseInput(evaluate),
      acaActive: true,
      acaGrossEnrollmentPremium: 20,
    })

    expect(result.acaConflictingCliffBasins).toBe(true)
    expect(result.evaluation.request.need).toBe(100)
    expect(result.evaluation.acaQuote?.overCliff).toBe(true)
    expect(evaluations).toContain(result.evaluation)
  })

  it('rechecks a forced-gross candidate normally before replacing a subsidized result', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = (request: AnnualFundingFixedPointEvaluationRequest) => {
      const gross = request.forceGrossAca || request.need >= 100
      const result = frozenEvaluation(
        request,
        evaluations.length,
        gross ? 100 : 80,
        {
          healthcare: gross ? 120 : 100,
          overCliff: gross,
        },
      )
      evaluations.push(result)
      return result
    }

    const result = annualFundingFixedPoint({
      ...baseInput(evaluate),
      spendingUsesBeforeTax: 100,
      acaActive: true,
      acaGrossEnrollmentPremium: 20,
    })

    expect(result.acaConflictingCliffBasins).toBe(true)
    expect(result.evaluation.request).toEqual({
      need: 100,
      forceGrossAca: false,
      cashInflows: 20,
    })
    expect(result.evaluation.acaQuote?.overCliff).toBe(true)
    expect(evaluations).toContain(result.evaluation)
  })

  it('sizes a coordinated HECM draw through probes and resets final diagnostics', () => {
    const evaluations: TestEvaluation[] = []
    const evaluate = vi.fn((request: AnnualFundingFixedPointEvaluationRequest) => {
      const result = frozenEvaluation(
        request,
        evaluations.length,
        150 - request.cashInflows,
      )
      evaluations.push(result)
      return result
    })

    const result = annualFundingFixedPoint({
      ...baseInput(evaluate),
      spendingUsesBeforeTax: 150,
      baseCashInflows: 50,
      coordinatedHecmCapacity: 40,
    })

    expect(result.acceptedCoordinatedHecmDraw).toBe(40)
    expect(result.acceptedCashInflows).toBe(90)
    expect(result.evaluation.requiredNeed).toBe(60)
    expect(result.evaluation.request).toEqual({
      need: 60,
      forceGrossAca: false,
      cashInflows: 90,
    })
    expect(evaluations).toContain(result.evaluation)
    // HECM probes are deliberately excluded from published ACA diagnostics.
    expect(result.evaluationCount).toBe(1)
    expect(evaluate.mock.calls.map(([request]) => request.cashInflows))
      .toEqual([50, 90, 90])
  })

  it('accepts no coordinated HECM draw when its funding probe cannot converge', () => {
    const evaluate = vi.fn((request: AnnualFundingFixedPointEvaluationRequest) =>
      frozenEvaluation(
        request,
        evaluate.mock.calls.length,
        request.need < 100 ? 200 : 0,
      ))

    const result = annualFundingFixedPoint({
      ...baseInput(evaluate),
      coordinatedHecmCapacity: 40,
    })

    expect(result.acceptedCoordinatedHecmDraw).toBe(0)
    expect(result.acceptedCashInflows).toBe(20)
    expect(result.converged).toBe(false)
    expect(evaluate.mock.calls.every(([request]) =>
      request.cashInflows === 20,
    )).toBe(true)
  })
})
