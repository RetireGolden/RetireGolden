/**
 * Hostile seam proof for the post-solve account-growth extraction.
 *
 * The wrapper returns deliberately non-economic first-year values. Assertions
 * observe those exact values at independent downstream boundaries, so an
 * orphaned helper, a caller-side rebuild, a skipped reinvestment commit, a
 * skipped basis commit, a skipped allocation-track commit, or a skipped HECM
 * signal commit cannot pass merely because the real helper matches the former
 * inline arithmetic.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualPostSolveAccountGrowthInput,
  AnnualPostSolveAccountGrowthResult,
} from './internal/annualPostSolveAccountGrowth.js'

/** Live caller-owned row state, snapshotted before the real helper runs. */
interface GrowthCapture {
  readonly openingBalances: readonly number[]
  readonly openingCostBases: readonly number[]
  readonly openingWeights: readonly (readonly number[] | null)[]
}

type CallerGrowthState = AnnualPostSolveAccountGrowthInput['states'][number] & {
  readonly costBasis: number
}

const hostile = vi.hoisted(() => ({
  inject: false,
  hecmPriorReturns: [] as number[],
  sentinelWeights: [0, 0, 0, 1] as number[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualPostSolveAccountGrowthInput,
      AnnualPostSolveAccountGrowthResult,
      GrowthCapture
    >(),
)

vi.mock('./internal/annualPostSolveAccountGrowth.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualPostSolveAccountGrowth.js')
    >(),
    'annualPostSolveAccountGrowth',
    (natural, { ordinal }): AnnualPostSolveAccountGrowthResult =>
      hostile.inject && ordinal === 0
        ? {
            rows: natural.rows.map((row, balanceIndex) =>
              balanceIndex === 0
                ? {
                    kind: 'allocated' as const,
                    marketClosingBalance: 12_345,
                    driftedWeights: hostile.sentinelWeights,
                    reinvestedYield: 67,
                  }
                : row),
            priorYearPortfolioReturnPct: -77,
          }
        : natural,
    {
      capture: (input): GrowthCapture => ({
        openingBalances: input.states.map((state) => state.balance),
        // Cost basis is caller-owned and deliberately absent from the helper's
        // input contract. The hostile seam observes the live caller rows only.
        openingCostBases: input.states.map(
          (state) => (state as CallerGrowthState).costBasis,
        ),
        openingWeights: input.states.map((_state, balanceIndex) =>
          input.allocationTrack.get(String(balanceIndex))?.weights ?? null),
      }),
    },
  ),
)

vi.mock('./internal/annualCoordinatedHecm.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualCoordinatedHecm.js')>()
  return {
    ...original,
    annualCoordinatedHecmEligibility: (
      input: Parameters<typeof original.annualCoordinatedHecmEligibility>[0],
    ) => {
      hostile.hecmPriorReturns.push(input.priorYearPortfolioReturnPct)
      return original.annualCoordinatedHecmEligibility(input)
    },
  }
})

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import type { Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
const OPENING_BASIS = 4_000
const zeroTax: TaxCalculator = { compute: () => 0 }

function quietAllocatedPlan(): Plan {
  const plan = singlePersonPlan({
    dob: '1970-01-01',
    planningAge: 90,
  })
  const account = taxableAccount(
    'growth',
    10_000,
    OPENING_BASIS,
  ) as Extract<Plan['accounts'][number], { type: 'taxable' }>
  account.annualReturnPct = 0
  account.interestYieldPct = 0
  account.dividendYieldPct = 0
  account.taxExemptInterestYieldPct = 0
  account.allocation = {
    mode: 'static',
    rebalancing: 'none',
    weights: { usStocks: 100, intlStocks: 0, bonds: 0, cash: 0 },
  }
  plan.accounts = [account]
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  return validatePlan(plan)
}

describe('simulatePlan annual post-solve account-growth delegation', () => {
  beforeEach(() => {
    hostile.inject = false
    hostile.hecmPriorReturns.length = 0
    hostile.sentinelWeights = [0, 0, 0, 1]
    seam.reset()
  })

  it('commits the helper rows, basis, weight identity, and prior-return signal', () => {
    hostile.inject = true
    const result = simulatePlan(quietAllocatedPlan(), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR + 1,
      taxCalculator: zeroTax,
    })

    const growthCalls = expectSeamRan(seam, 2)
    expect(growthCalls[0]!.injected.rows).toHaveLength(
      growthCalls[0]!.input.states.length,
    )
    expect(result.years[0]!.balances.growth).toBe(12_345 + 67)
    expect(growthCalls[1]!.captured.openingBalances).toEqual([12_345 + 67])
    expect(growthCalls[1]!.captured.openingCostBases).toEqual([
      OPENING_BASIS + 67,
    ])
    expectPublishedFromSeam(
      growthCalls[1]!.captured.openingWeights[0],
      hostile.sentinelWeights,
      'the committed drifted weights',
    )
    expect(hostile.hecmPriorReturns.slice(0, 2)).toEqual([0, -77])
  })
})
