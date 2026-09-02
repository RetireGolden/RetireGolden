import { describe, expect, it } from 'vitest'

import {
  annualFundingFixedPoint,
  type AnnualFundingFixedPointEvaluation,
  type AnnualFundingFixedPointEvaluationRequest,
  type AnnualFundingFixedPointInput,
} from './annualFundingFixedPoint.js'

interface GoldenEvaluation extends AnnualFundingFixedPointEvaluation {
  readonly request: Readonly<AnnualFundingFixedPointEvaluationRequest>
}

const evaluation = (
  request: Readonly<AnnualFundingFixedPointEvaluationRequest>,
  requiredNeed: number,
  options: Readonly<{
    shortfall?: number
    healthcare?: number
    overCliff?: boolean | null
  }> = {},
): GoldenEvaluation => ({
  request: { ...request },
  requiredNeed,
  withdrawalPlan: { shortfall: options.shortfall ?? 0 },
  healthcare: options.healthcare ?? 0,
  acaQuote: options.overCliff === null || options.overCliff === undefined
    ? null
    : { overCliff: options.overCliff },
  acaSupportCodes: [],
})

const solve = (
  evaluate: AnnualFundingFixedPointInput<GoldenEvaluation>['evaluate'],
  overrides: Partial<AnnualFundingFixedPointInput<GoldenEvaluation>> = {},
) => annualFundingFixedPoint({
  spendingUsesBeforeTax: 120,
  baseCashInflows: 20,
  currentHealthcare: 0,
  coordinatedHecmCapacity: 0,
  acaActive: false,
  acaGrossEnrollmentPremium: 0,
  acaInitialSupportCodeCount: 0,
  tolerancePlanDollars: 0.005,
  evaluate,
  ...overrides,
})

/**
 * Hand-worked numerical oracles for the coordinator's control rules.
 *
 * Each evaluator equation/table below is the declared problem input. The
 * expected root or endpoint is calculated in the adjacent worksheet; no
 * expected value was captured from RetireGolden or from a reference copy of
 * the production solver.
 */
describe('annualFundingFixedPoint hand-worked oracles', () => {
  it('solves an affine fixed point', () => {
    const result = solve(request =>
      evaluation(request, 100 + request.need / 2))

    // Independent worksheet:
    // n = 100 + n / 2
    // n / 2 = 100
    // n = 200
    expect(result.converged).toBe(true)
    expect(result.evaluation.request.need).toBeCloseTo(200, 2)
    expect(result.evaluation.requiredNeed).toBeCloseTo(200, 2)
    expect(result.closestResidual).toBe(0)
  })

  it('selects the bounded root after portfolio exhaustion', () => {
    const requests: number[] = []
    const result = solve(request => {
      requests.push(request.need)
      const requiredNeed = request.need === 0
        ? 300
        : request.need === 100
          ? 200
          : request.need === 150
            ? 150
            : request.need === 200
              ? 300
              : 100
      return evaluation(request, requiredNeed, {
        shortfall: request.need === 200 ? 25 : 0,
      })
    }, { spendingUsesBeforeTax: 320 })

    // Independent worksheet (r(n) = requiredNeed - n):
    // initial n = 320 uses - 20 cash = 300; direct iteration cycles
    // 300 -> 100 -> 200 -> 300. The n=200 row has a $25 shortfall.
    // Bracket rows: n=0 has r=+300; n=200 has r=+100 and is exhausted.
    // The bounded-need jump tests n=300, where r=-200.
    // Bisection midpoint: (0 + 300) / 2 = 150, and r(150)=0.
    expect(result.converged).toBe(true)
    expect(result.evaluation.request.need).toBe(150)
    expect(result.evaluation.requiredNeed).toBe(150)
    expect(result.closestResidual).toBe(0)
    expect(requests).toEqual([
      300, 100, 200, 300, 100, 200, 300, 100,
      0, 200, 300, 150,
    ])
  })

  it('selects the closest endpoint across a discontinuity with no root', () => {
    const result = solve(request =>
      evaluation(request, request.need < 100 ? 200 : 0))

    // Independent worksheet:
    // for n < 100, r(n) = 200 - n, whose infimum is +100;
    // for n >= 100, r(n) = -n, whose smallest magnitude is 100 at n=100.
    // No n satisfies r(n)=0. The closest represented endpoint is therefore
    // n=100, requiredNeed=0, with |r|=100.
    expect(result.converged).toBe(false)
    expect(result.evaluation.request.need).toBe(100)
    expect(result.evaluation.requiredNeed).toBe(0)
    expect(result.closestResidual).toBe(100)
  })

  it('restarts a failed subsidized solve at the gross ACA root', () => {
    const result = solve(request => {
      const requiredNeed = request.forceGrossAca
        ? 120
        : request.need < 100 ? 200 : 0
      return evaluation(request, requiredNeed, {
        healthcare: request.forceGrossAca ? 12_000 : 2_000,
        overCliff: request.forceGrossAca,
      })
    }, {
      acaActive: true,
      acaGrossEnrollmentPremium: 10_000,
    })

    // Independent worksheet:
    // subsidized r(n) is the discontinuity above, so it has no root.
    // Gross pricing is requiredNeed=120 for every n, whose sole root is 120.
    // Fail-closed selection therefore accepts n=120 and $12,000 healthcare.
    expect(result.acaFixedPointFailed).toBe(true)
    expect(result.converged).toBe(true)
    expect(result.evaluation.request).toEqual({
      need: 120,
      forceGrossAca: true,
      cashInflows: 20,
    })
    expect(result.evaluation.healthcare).toBe(12_000)
  })

  it('selects gross pricing when subsidized and gross ACA roots coexist', () => {
    const result = solve(request => {
      const gross = request.forceGrossAca || request.need >= 100
      return evaluation(request, gross ? 100 : 80, {
        healthcare: gross ? 120 : 100,
        overCliff: gross,
      })
    }, {
      spendingUsesBeforeTax: 100,
      acaActive: true,
      acaGrossEnrollmentPremium: 20,
    })

    // Independent worksheet:
    // ordinary starting need = 100 uses - 20 cash = 80, so the subsidized
    // equation has the root n=80 with healthcare=100.
    // Forced-gross requiredNeed=100 has the root n=100; evaluating n=100
    // normally is also over-cliff with healthcare=120. Both roots are valid,
    // so fail-closed basin selection accepts the gross n=100 result.
    expect(result.converged).toBe(true)
    expect(result.acaConflictingCliffBasins).toBe(true)
    expect(result.evaluation.request).toEqual({
      need: 100,
      forceGrossAca: false,
      cashInflows: 20,
    })
    expect(result.evaluation.healthcare).toBe(120)
  })

  it('caps a coordinated HECM draw and solves with the accepted cash', () => {
    const result = solve(request =>
      evaluation(request, 150 - request.cashInflows), {
      spendingUsesBeforeTax: 150,
      baseCashInflows: 50,
      coordinatedHecmCapacity: 40,
    })

    // Independent worksheet:
    // pre-tax need = 150 uses - 50 base cash = 100.
    // draw = min($40 capacity, $100 need) = $40.
    // accepted cash = $50 + $40 = $90.
    // final required withdrawal = $150 - $90 = $60, so n=60 is the root.
    expect(result.acceptedCoordinatedHecmDraw).toBe(40)
    expect(result.acceptedCashInflows).toBe(90)
    expect(result.converged).toBe(true)
    expect(result.evaluation.request).toEqual({
      need: 60,
      forceGrossAca: false,
      cashInflows: 90,
    })
    expect(result.evaluation.requiredNeed).toBe(60)
  })
})
