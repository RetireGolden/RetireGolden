/**
 * Hostile seam proof for the post-solve account-growth extraction.
 *
 * The wrapper returns deliberately non-economic first-year values. Assertions
 * observe those exact values at independent downstream boundaries, so an
 * orphaned helper, a caller-side rebuild, a skipped reinvestment commit, a
 * skipped basis commit, a skipped allocation-track commit, or a skipped HECM
 * signal commit cannot pass merely because the real helper matches the former
 * inline arithmetic.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualPostSolveAccountGrowthInput,
  AnnualPostSolveAccountGrowthResult,
} from './internal/annualPostSolveAccountGrowth.js'

interface GrowthCall {
  readonly input: AnnualPostSolveAccountGrowthInput
  readonly openingBalances: readonly number[]
  readonly openingCostBases: readonly number[]
  readonly openingWeights: readonly (readonly number[] | null)[]
  readonly returned: AnnualPostSolveAccountGrowthResult
}

const seam = vi.hoisted(() => ({
  inject: false,
  growthCalls: [] as GrowthCall[],
  hecmPriorReturns: [] as number[],
  sentinelWeights: [0, 0, 0, 1] as number[],
}))

vi.mock('./internal/annualPostSolveAccountGrowth.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualPostSolveAccountGrowth.js')>()
  return {
    ...original,
    annualPostSolveAccountGrowth: (input: AnnualPostSolveAccountGrowthInput) => {
      const originalResult = original.annualPostSolveAccountGrowth(input)
      const returned: AnnualPostSolveAccountGrowthResult =
        seam.inject && seam.growthCalls.length === 0
          ? {
              rows: originalResult.rows.map((row, balanceIndex) =>
                balanceIndex === 0
                  ? {
                      kind: 'allocated' as const,
                      marketClosingBalance: 12_345,
                      driftedWeights: seam.sentinelWeights,
                      reinvestedYield: 67,
                    }
                  : row),
              priorYearPortfolioReturnPct: -77,
            }
          : originalResult
      seam.growthCalls.push({
        input,
        openingBalances: input.states.map((state) => state.balance),
        openingCostBases: input.states.map((state) => state.costBasis),
        openingWeights: input.states.map((_state, balanceIndex) =>
          input.allocationTrack.get(String(balanceIndex))?.weights ?? null),
        returned,
      })
      return returned
    },
  }
})

vi.mock('./internal/annualCoordinatedHecm.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/annualCoordinatedHecm.js')>()
  return {
    ...original,
    annualCoordinatedHecmEligibility: (
      input: Parameters<typeof original.annualCoordinatedHecmEligibility>[0],
    ) => {
      seam.hecmPriorReturns.push(input.priorYearPortfolioReturnPct)
      return original.annualCoordinatedHecmEligibility(input)
    },
  }
})

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
    seam.inject = false
    seam.growthCalls.length = 0
    seam.hecmPriorReturns.length = 0
    seam.sentinelWeights = [0, 0, 0, 1]
  })

  it('commits the helper rows, basis, weight identity, and prior-return signal', () => {
    seam.inject = true
    const result = simulatePlan(quietAllocatedPlan(), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR + 1,
      taxCalculator: zeroTax,
    })

    expect(seam.growthCalls).toHaveLength(2)
    expect(seam.growthCalls[0]!.returned.rows).toHaveLength(
      seam.growthCalls[0]!.input.states.length,
    )
    expect(result.years[0]!.balances.growth).toBe(12_345 + 67)
    expect(seam.growthCalls[1]!.openingBalances).toEqual([12_345 + 67])
    expect(seam.growthCalls[1]!.openingCostBases).toEqual([
      OPENING_BASIS + 67,
    ])
    expect(seam.growthCalls[1]!.openingWeights[0]).toBe(
      seam.sentinelWeights,
    )
    expect(seam.hecmPriorReturns.slice(0, 2)).toEqual([0, -77])
  })
})
