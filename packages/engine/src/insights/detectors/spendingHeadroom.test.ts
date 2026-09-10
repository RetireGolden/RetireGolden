import { beforeEach, describe, expect, it, vi } from 'vitest'

import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'

vi.mock('../../decisions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../decisions/index.js')>()
  return {
    ...original,
    solveMaxSustainableSpending: vi.fn(original.solveMaxSustainableSpending),
    createDecisionContext: vi.fn(original.createDecisionContext),
  }
})

vi.mock('../../tax/federalTax.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../tax/federalTax.js')>()
  return {
    ...original,
    createFederalTaxCalculator: vi.fn(original.createFederalTaxCalculator),
    combineTaxCalculators: vi.fn(original.combineTaxCalculators),
  }
})

vi.mock('../../tax/stateTax.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../tax/stateTax.js')>()
  return {
    ...original,
    createStateTaxCalculator: vi.fn(original.createStateTaxCalculator),
  }
})

import {
  createDecisionContext,
  solveMaxSustainableSpending,
  SPENDING_SOLVER_UI_BUDGET,
} from '../../decisions/index.js'
import type { SustainableSpendingResult } from '../../decisions/spendingSolver.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../../tax/federalTax.js'
import { createStateTaxCalculator } from '../../tax/stateTax.js'
import { spendingHeadroom } from './spendingHeadroom.js'

/**
 * Engine-local coverage for the spending-headroom detector.
 *
 * Screen gates ($250,000 excess estate, $2,000/yr rough headroom, depletion,
 * ABW refusal) are fixtured on both sides. `evaluate()` boundary coverage
 * stubs only the sustainable-spending solver and tax-calculator factories;
 * the detector's MIN_SOLVED_SLACK gate, patch max, slack narration, solver
 * budget, estate floor, and createDecisionContext wiring are asserted through
 * the real `evaluate()` entry point with deliberately non-collinear solver
 * outputs (slack dollars ≠ maxBaseAnnual − current baseAnnual).
 */
const START_YEAR = 2026
const CURRENT_BASE_ANNUAL = 60_000

const mockedSolver = vi.mocked(solveMaxSustainableSpending)
const mockedCreateDecisionContext = vi.mocked(createDecisionContext)
const mockedCreateFederalTaxCalculator = vi.mocked(createFederalTaxCalculator)
const mockedCreateStateTaxCalculator = vi.mocked(createStateTaxCalculator)
const mockedCombineTaxCalculators = vi.mocked(combineTaxCalculators)

const MOCK_FEDERAL_TAX_CALCULATOR = { kind: 'federal-mock' } as never
const MOCK_STATE_TAX_CALCULATOR = { kind: 'state-mock' } as never
const MOCK_COMBINED_TAX_CALCULATOR = { kind: 'combined-mock' } as never

function solverFixture(
  partial: Pick<SustainableSpendingResult, 'maxBaseAnnual' | 'spendingSlackDollars'> &
    Partial<SustainableSpendingResult>,
): SustainableSpendingResult {
  return {
    bestEvaluation: null,
    converged: true,
    limitingConstraint: null,
    simulationCount: 1,
    diagnostics: [],
    ...partial,
  }
}

function context(
  opts: {
    endYear?: number
    endingAfterTaxEstate?: number
    bequestTargetDollars?: number
    depletionYear?: number | null
    spendingPolicyMode?: string
    stateEffectiveTaxPct?: number
    localIncomeTaxPct?: number
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.baseAnnual = CURRENT_BASE_ANNUAL
  if (opts.bequestTargetDollars !== undefined) plan.expenses.bequestTargetDollars = opts.bequestTargetDollars
  if (opts.spendingPolicyMode !== undefined) {
    plan.expenses.spendingPolicy = { mode: opts.spendingPolicyMode } as never
  }
  if (opts.stateEffectiveTaxPct !== undefined) {
    plan.assumptions.stateEffectiveTaxPct = opts.stateEffectiveTaxPct
  }
  if (opts.localIncomeTaxPct !== undefined) {
    plan.assumptions.localIncomeTaxPct = opts.localIncomeTaxPct
  }
  return {
    plan,
    params: { year: START_YEAR },
    projection: {
      startYear: START_YEAR,
      result: { endYear: opts.endYear ?? START_YEAR + 30, years: [] },
      summary: {
        depletionYear: opts.depletionYear ?? null,
        endingAfterTaxEstate: opts.endingAfterTaxEstate ?? 1_000_000,
      },
      deflate: (_year: number, amount: number) => amount,
    },
  } as unknown as DetectorContext
}

function screenEligibleContext(): DetectorContext {
  return context({ endingAfterTaxEstate: 1_000_000 })
}

function expectEvaluateWiring(
  eligibleCtx: DetectorContext,
  expectedEstateFloorTodayDollars: number,
): void {
  expect(mockedCreateStateTaxCalculator).toHaveBeenCalledWith({
    overridePct: eligibleCtx.plan.assumptions.stateEffectiveTaxPct,
    localPct: eligibleCtx.plan.assumptions.localIncomeTaxPct,
  })
  expect(mockedCreateFederalTaxCalculator).toHaveBeenCalledOnce()
  expect(mockedCombineTaxCalculators).toHaveBeenCalledWith(
    MOCK_FEDERAL_TAX_CALCULATOR,
    MOCK_STATE_TAX_CALCULATOR,
  )
  expect(mockedCreateDecisionContext).toHaveBeenCalledWith(
    eligibleCtx.plan,
    { startYear: START_YEAR, taxCalculator: MOCK_COMBINED_TAX_CALCULATOR },
    { result: eligibleCtx.projection.result, summary: eligibleCtx.projection.summary },
  )
  const decisionCtx = mockedCreateDecisionContext.mock.results[0]?.value
  expect(decisionCtx).toBeDefined()
  expect(mockedSolver).toHaveBeenCalledWith(decisionCtx, {
    maxSimulations: SPENDING_SOLVER_UI_BUDGET,
    estateFloorTodayDollars: expectedEstateFloorTodayDollars,
  })
}

describe('spendingHeadroom', () => {
  beforeEach(() => {
    mockedSolver.mockReset()
    mockedCreateDecisionContext.mockReset()
    mockedCreateFederalTaxCalculator.mockReset()
    mockedCreateStateTaxCalculator.mockReset()
    mockedCombineTaxCalculators.mockReset()

    mockedCreateFederalTaxCalculator.mockReturnValue(MOCK_FEDERAL_TAX_CALCULATOR)
    mockedCreateStateTaxCalculator.mockReturnValue(MOCK_STATE_TAX_CALCULATOR)
    mockedCombineTaxCalculators.mockReturnValue(MOCK_COMBINED_TAX_CALCULATOR)
    mockedCreateDecisionContext.mockImplementation((plan, simulateOptions, baseline) => ({
      plan,
      baselineResult: baseline!.result,
      baselineSummary: baseline!.summary ?? ({} as never),
      simulateOptions,
    }))
  })

  it('fires on a never-depleting plan whose ending estate clears the bequest target', () => {
    const card = spendingHeadroom.screen(context({ endingAfterTaxEstate: 1_000_000 }))
    expect(card?.id).toBe('spending-headroom')
    expect(card?.category).toBe('sequence-risk')
    expect(card?.severity).toBe('info')
    expect(card?.exact).toBe(false)
    expect(card?.plannerRoute).toBe('spending-solver')
    expect(card?.evidence).toContainEqual({
      label: "Ending after-tax estate (today's $)",
      value: '$1,000,000',
      year: START_YEAR + 30,
    })
    expect(card?.evidence).toContainEqual({ label: 'Bequest target', value: '$0' })
    expect(card?.rationale).toContain('with no bequest target set')
  })

  it('measures the excess against the bequest target, not the whole estate', () => {
    // 1,000,000 estate against a 900,000 target is 100,000 of excess — below
    // the $250,000 screen — even though the estate itself is large.
    expect(
      spendingHeadroom.screen(context({ endingAfterTaxEstate: 1_000_000, bequestTargetDollars: 900_000 })),
    ).toBeNull()
    const card = spendingHeadroom.screen(
      context({ endingAfterTaxEstate: 1_000_000, bequestTargetDollars: 700_000 }),
    )
    expect(card?.id).toBe('spending-headroom')
    expect(card?.rationale).toContain('well above your $700,000 bequest target')
  })

  it('holds the $250,000 excess-estate gate on both sides', () => {
    expect(spendingHeadroom.screen(context({ endingAfterTaxEstate: 250_000 }))?.id).toBe('spending-headroom')
    expect(spendingHeadroom.screen(context({ endingAfterTaxEstate: 249_999 }))).toBeNull()
  })

  it('holds the $2,000/yr rough-headroom gate on both sides', () => {
    // Spread thin enough, even a large excess is not a meaningful lifestyle
    // bump: 400,000 over 200 remaining years is exactly $2,000/yr, and one
    // dollar less is not.
    const longHorizon = { endYear: START_YEAR + 200 }
    expect(
      spendingHeadroom.screen(context({ ...longHorizon, endingAfterTaxEstate: 400_000 }))?.id,
    ).toBe('spending-headroom')
    expect(spendingHeadroom.screen(context({ ...longHorizon, endingAfterTaxEstate: 399_999 }))).toBeNull()
  })

  it('stays silent on a plan that depletes', () => {
    expect(
      spendingHeadroom.screen(context({ depletionYear: 2050, endingAfterTaxEstate: 1_000_000 })),
    ).toBeNull()
  })

  it('stays silent for an amortized-spending plan, which spends the portfolio down by design', () => {
    expect(spendingHeadroom.screen(context({ spendingPolicyMode: 'abw' }))).toBeNull()
    // A fixed-target policy is still eligible.
    expect(spendingHeadroom.screen(context({ spendingPolicyMode: 'fixedTarget' }))?.id).toBe(
      'spending-headroom',
    )
  })

  it('evaluate() refuses a plan the screen already rejected', () => {
    expect(() => spendingHeadroom.evaluate!(context({ depletionYear: 2050 }))).toThrow(/not eligible/i)
  })

  it('evaluate() refuses when solved slack is below the $1,000/yr gate', () => {
    const solvedMaxBaseAnnual = 72_000
    const solvedSlackDollars = 999
    expect(solvedSlackDollars).not.toBe(solvedMaxBaseAnnual - CURRENT_BASE_ANNUAL)

    mockedSolver.mockReturnValue(
      solverFixture({
        maxBaseAnnual: solvedMaxBaseAnnual,
        spendingSlackDollars: solvedSlackDollars,
      }),
    )

    const eligibleCtx = screenEligibleContext()
    expect(() => spendingHeadroom.evaluate!(eligibleCtx)).toThrow(/no meaningful headroom/i)
    expectEvaluateWiring(eligibleCtx, 0)
  })

  it('evaluate() refuses when the solver returns no feasible max spending', () => {
    mockedSolver.mockReturnValue(
      solverFixture({
        maxBaseAnnual: null,
        spendingSlackDollars: 5_000,
      }),
    )

    const eligibleCtx = screenEligibleContext()
    expect(() => spendingHeadroom.evaluate!(eligibleCtx)).toThrow(/no meaningful headroom/i)
    expectEvaluateWiring(eligibleCtx, 0)
  })

  it('evaluate() refuses when solved slack is null and treated as zero', () => {
    mockedSolver.mockReturnValue(
      solverFixture({
        maxBaseAnnual: 65_000,
        spendingSlackDollars: null,
      }),
    )

    const eligibleCtx = screenEligibleContext()
    expect(() => spendingHeadroom.evaluate!(eligibleCtx)).toThrow(/no meaningful headroom/i)
    expectEvaluateWiring(eligibleCtx, 0)
  })

  it('evaluate() returns the solved spending patch when slack clears the $1,000/yr gate', () => {
    const solvedMaxBaseAnnual = 64_500
    const solvedSlackDollars = 1_000
    expect(solvedSlackDollars).not.toBe(solvedMaxBaseAnnual - CURRENT_BASE_ANNUAL)

    mockedSolver.mockReturnValue(
      solverFixture({
        maxBaseAnnual: solvedMaxBaseAnnual,
        spendingSlackDollars: solvedSlackDollars,
      }),
    )

    const eligibleCtx = screenEligibleContext()
    const result = spendingHeadroom.evaluate!(eligibleCtx)
    expect(result.action.kind).toBe('preview-scenario')
    if (result.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(result.action.patch).toEqual({ expenses: { baseAnnual: solvedMaxBaseAnnual } })
    if (!result.impact) throw new Error('expected evaluate() to publish impact')
    expect(result.impact.qualitative).toContain('$1,000/yr above your current level')
    expect(result.impact.qualitative).not.toContain('$4,500/yr above your current level')
    expectEvaluateWiring(eligibleCtx, 0)
  })

  it('evaluate() passes the bequest target as the solver estate floor', () => {
    const solvedMaxBaseAnnual = 63_000
    const solvedSlackDollars = 2_500
    expect(solvedSlackDollars).not.toBe(solvedMaxBaseAnnual - CURRENT_BASE_ANNUAL)

    mockedSolver.mockReturnValue(
      solverFixture({
        maxBaseAnnual: solvedMaxBaseAnnual,
        spendingSlackDollars: solvedSlackDollars,
      }),
    )

    const eligibleCtx = context({
      endingAfterTaxEstate: 1_000_000,
      bequestTargetDollars: 500_000,
      stateEffectiveTaxPct: 4.5,
      localIncomeTaxPct: 1.25,
    })
    const result = spendingHeadroom.evaluate!(eligibleCtx)
    expect(result.action.kind).toBe('preview-scenario')
    if (result.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(result.action.patch).toEqual({ expenses: { baseAnnual: solvedMaxBaseAnnual } })
    expect(result.impact?.qualitative).toContain('$2,500/yr above your current level')
    expectEvaluateWiring(eligibleCtx, 500_000)
  })
})
