import { beforeEach, describe, expect, it, vi } from 'vitest'

import { simOptions } from '../../testing/decisionFixtures.js'
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

import { createDecisionContext, solveMaxSustainableSpending } from '../../decisions/index.js'
import { spendingHeadroom } from './spendingHeadroom.js'

/**
 * Engine-local coverage for the spending-headroom detector.
 *
 * Screen gates ($250,000 excess estate, $2,000/yr rough headroom, depletion,
 * ABW refusal) are fixtured on both sides. `evaluate()` boundary coverage
 * stubs only the sustainable-spending solver — the detector's own
 * MIN_SOLVED_SLACK_PER_YEAR gate and patch wiring are asserted through the
 * real `evaluate()` entry point, not a second copy of solver arithmetic.
 */
const START_YEAR = 2026
const CURRENT_BASE_ANNUAL = 60_000

const mockedSolver = vi.mocked(solveMaxSustainableSpending)
const mockedCreateDecisionContext = vi.mocked(createDecisionContext)

function context(
  opts: {
    endYear?: number
    endingAfterTaxEstate?: number
    bequestTargetDollars?: number
    depletionYear?: number | null
    spendingPolicyMode?: string
  } = {},
): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.baseAnnual = CURRENT_BASE_ANNUAL
  if (opts.bequestTargetDollars !== undefined) plan.expenses.bequestTargetDollars = opts.bequestTargetDollars
  if (opts.spendingPolicyMode !== undefined) {
    plan.expenses.spendingPolicy = { mode: opts.spendingPolicyMode } as never
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

describe('spendingHeadroom', () => {
  beforeEach(() => {
    mockedSolver.mockReset()
    mockedCreateDecisionContext.mockReset()
    mockedCreateDecisionContext.mockReturnValue({
      plan: {} as never,
      baselineResult: {} as never,
      baselineSummary: {} as never,
      simulateOptions: simOptions(),
    })
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
    mockedSolver.mockReturnValue({
      maxBaseAnnual: 60_999,
      spendingSlackDollars: 999,
      bestEvaluation: null,
      converged: true,
      limitingConstraint: null,
      simulationCount: 1,
      diagnostics: [],
    })

    expect(() => spendingHeadroom.evaluate!(screenEligibleContext())).toThrow(/no meaningful headroom/i)
    expect(mockedSolver).toHaveBeenCalledOnce()
  })

  it('evaluate() returns the solved spending patch when slack clears the $1,000/yr gate', () => {
    mockedSolver.mockReturnValue({
      maxBaseAnnual: 61_000,
      spendingSlackDollars: 1_000,
      bestEvaluation: null,
      converged: true,
      limitingConstraint: null,
      simulationCount: 1,
      diagnostics: [],
    })

    const result = spendingHeadroom.evaluate!(screenEligibleContext())
    expect(result.action.kind).toBe('preview-scenario')
    if (result.action.kind !== 'preview-scenario') throw new Error('expected a preview scenario')
    expect(result.action.patch).toEqual({ expenses: { baseAnnual: 61_000 } })
    if (!result.impact) throw new Error('expected evaluate() to publish impact')
    expect(result.impact.qualitative).toContain('$1,000/yr above your current level')
    expect(mockedSolver).toHaveBeenCalledOnce()
  })
})
